#!/usr/bin/env python3
"""Show hot leads from qualify agent training data."""

import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('output/qualify_agent_training_data.json', encoding='utf-8') as f:
    records = json.load(f)

hot = [r for r in records if r.get('lead_temperature') == 'hot']
print(f'HOT LEADS ({len(hot)} total)')
print('=' * 80)
print()

for i, r in enumerate(hot, 1):
    name = r.get('reply_from_name', 'Unknown')
    email = r.get('reply_from_email', '')
    phone = r.get('extracted_data', {}).get('phone_number', '-')
    action = r.get('next_action', '')

    print(f'{i:2}. {name}')
    print(f'    Email: {email}')
    print(f'    Phone: {phone}')
    print(f'    Action: {action}')

    body = (r.get('reply_body') or '')[:180].replace('\r\n', ' ').replace('\n', ' ').strip()
    if body:
        print(f'    Reply: {body}...')
    print()
