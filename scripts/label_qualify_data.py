#!/usr/bin/env python3
"""Auto-label qualify-agent training data."""

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

training_path = Path('output/qualify_agent_training_data.json')
with open(training_path, encoding='utf-8') as f:
    records = json.load(f)

price_count = 0
for r in records:
    body = r.get('reply_body') or ''

    # Extract prices
    # Pattern: $6.5M, $18.7M, $6.5 million, paid $18.7M
    patterns = [
        r'\$(\d+(?:\.\d+)?)\s*[mM]',
        r'\$(\d+(?:\.\d+)?)\s*million',
        r'paid\s+\$?(\d+(?:\.\d+)?)\s*[mM]',
        r'asking\s+\$?(\d+(?:\.\d+)?)\s*[mM]',
        r'market for\s+\$?(\d+(?:\.\d+)?)\s*[mM]',
    ]

    for pattern in patterns:
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            try:
                price = float(match.group(1))
                if price < 1000:
                    price = price * 1000000
                r['extracted_data']['asking_price'] = int(price)
                price_count += 1
                break
            except:
                pass

# Save
with open(training_path, 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

print(f'Extracted {price_count} prices')
print()

# Show summary
print('=== QUALIFY-AGENT TRAINING DATA SUMMARY ===')
print()
print('| Temperature | Count | Next Actions |')
print('|-------------|------:|--------------|')

for temp in ['hot', 'warm', 'lukewarm']:
    temp_records = [r for r in records if r.get('lead_temperature') == temp]
    actions = {}
    for r in temp_records:
        a = r.get('next_action', 'unknown')
        actions[a] = actions.get(a, 0) + 1
    action_str = ', '.join([f'{a}({c})' for a, c in sorted(actions.items(), key=lambda x: -x[1])])
    print(f'| {temp} | {len(temp_records)} | {action_str} |')

print()
print('=== SAMPLE HOT LEADS ===')
print()
hot = [r for r in records if r.get('lead_temperature') == 'hot'][:5]
for i, r in enumerate(hot):
    print(f'{i+1}. {r["reply_from_name"]} | Action: {r["next_action"]}')
    print(f'   Phone: {r["extracted_data"].get("phone_number", "N/A")}')
    print(f'   Price: ${r["extracted_data"].get("asking_price", 0):,}' if r["extracted_data"].get("asking_price") else '   Price: N/A')
    body = (r['reply_body'] or '')[:150].replace('\r\n', ' ').replace('\n', ' ')
    print(f'   Reply: {body}...')
    print()

print('=== SAMPLE PRICING_GIVEN ===')
print()
pricing = [r for r in records if r.get('classification') == 'pricing_given']
for i, r in enumerate(pricing):
    print(f'{i+1}. {r["reply_from_name"]} | Action: {r["next_action"]}')
    print(f'   Price: ${r["extracted_data"].get("asking_price", 0):,}' if r["extracted_data"].get("asking_price") else '   Price: N/A')
    body = (r['reply_body'] or '')[:200].replace('\r\n', ' ').replace('\n', ' ')
    print(f'   Reply: {body}...')
    print()
