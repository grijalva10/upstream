#!/usr/bin/env python3
"""Dedupe hot leads in qualify agent training data."""

import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('output/qualify_agent_training_data.json', encoding='utf-8') as f:
    records = json.load(f)

print(f'Total records before: {len(records)}')

# Separate hot from non-hot
hot = [r for r in records if r.get('lead_temperature') == 'hot']
non_hot = [r for r in records if r.get('lead_temperature') != 'hot']

print(f'Hot leads before: {len(hot)}')

# Dedupe hot leads by email - keep the most informative one (longest reply or has phone)
seen_emails = {}
for r in hot:
    email = r.get('reply_from_email', '').lower()
    if email not in seen_emails:
        seen_emails[email] = r
    else:
        # Keep the one with more info
        existing = seen_emails[email]
        existing_phone = existing.get('extracted_data', {}).get('phone_number')
        new_phone = r.get('extracted_data', {}).get('phone_number')
        existing_price = existing.get('extracted_data', {}).get('asking_price')
        new_price = r.get('extracted_data', {}).get('asking_price')

        # Prefer one with phone, then with price, then longer reply
        score_existing = (1 if existing_phone else 0) + (1 if existing_price else 0) + len(existing.get('reply_body', '') or '')
        score_new = (1 if new_phone else 0) + (1 if new_price else 0) + len(r.get('reply_body', '') or '')

        if score_new > score_existing:
            seen_emails[email] = r

deduped_hot = list(seen_emails.values())
print(f'Hot leads after dedupe: {len(deduped_hot)}')
print(f'Removed: {len(hot) - len(deduped_hot)} duplicates')

# Show what we kept
print()
print('DEDUPED HOT LEADS:')
print('=' * 80)
for i, r in enumerate(deduped_hot, 1):
    name = r.get('reply_from_name', 'Unknown')
    email = r.get('reply_from_email', '')
    phone = r.get('extracted_data', {}).get('phone_number', '-')
    action = r.get('next_action', '')
    print(f'{i:2}. {name} | {email} | Phone: {phone} | {action}')

# Combine and save
final = non_hot + deduped_hot
print()
print(f'Total records after: {len(final)}')

with open('output/qualify_agent_training_data.json', 'w', encoding='utf-8') as f:
    json.dump(final, f, indent=2, ensure_ascii=False)

print('Saved to output/qualify_agent_training_data.json')
