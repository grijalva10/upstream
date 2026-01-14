#!/usr/bin/env python3
"""
Export campaign training data: outbound emails + replies as thread pairs.

Output structure:
- campaign: template name
- campaign_type: BUYER or SELLER
- thread_id: conversation ID
- outbound_subject: subject of initial outreach
- outbound_body: body of initial outreach
- outbound_sent_at: when sent
- reply_from_name: responder name
- reply_from_email: responder email
- reply_body: body of reply
- reply_received_at: when received
- classification: (to be labeled)
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path


CAMPAIGN_PATTERNS = {
    'acquisition_interest': {
        'pattern': '%acquisition interest%',
        'type': 'SELLER',
        'name': 'Property-specific: acquisition interest'
    },
    'q4_closing': {
        'pattern': '%Q4 closing timeline%',
        'type': 'SELLER',
        'name': 'Property-specific: Q4 closing timeline'
    },
    'cash_44m': {
        'patterns': ['%44m%cash%', '%cash%44m%'],
        'type': 'SELLER',
        'name': '$44M Cash Buyer'
    },
    'institutional_buyer': {
        'pattern': '%institutional buyer%',
        'type': 'SELLER',
        'name': 'Institutional Buyer Seeking'
    },
    'seattle_243': {
        'patterns': ['%243-unit%', '%u-district%seattle%'],
        'type': 'BUYER',
        'name': '243-Unit Seattle'
    },
    'truck_terminal': {
        'patterns': ['%truck terminal%', '%19-acre%'],
        'type': 'BUYER',
        'name': '19-Acre Truck Terminal'
    },
    'ca_market_update': {
        'pattern': '%ca commercial market update%',
        'type': 'SELLER',
        'name': 'CA Commercial Market Update'
    },
    'all_cash_offer': {
        'pattern': '%all-cash offer ready%',
        'type': 'SELLER',
        'name': 'All-cash offer'
    },
    'flex_buyer': {
        'pattern': '%active buyer seeking flex%',
        'type': 'SELLER',
        'name': 'Active Buyer Seeking Flex'
    },
}


def clean_body(body: str) -> str:
    """Clean email body - remove external sender warnings."""
    if not body:
        return ""

    lines = body.split('\n')
    cleaned = []
    skip = 0

    for line in lines:
        if skip > 0:
            skip -= 1
            continue
        if 'External Sender:' in line:
            skip = 2
            continue
        if 'Warning: The sender of this email could not be validated' in line:
            skip = 1
            continue
        cleaned.append(line)

    text = '\n'.join(cleaned).strip()

    while '\n\n\n' in text:
        text = text.replace('\n\n\n', '\n\n')

    return text


def main():
    conn = psycopg2.connect(
        host="127.0.0.1",
        port=55322,
        database="postgres",
        user="postgres",
        password="postgres"
    )

    # Build campaign case statement
    case_parts = []
    for key, config in CAMPAIGN_PATTERNS.items():
        if 'patterns' in config:
            conditions = ' OR '.join([f"subject ILIKE '{p}'" for p in config['patterns']])
            case_parts.append(f"WHEN {conditions} THEN '{key}'")
        else:
            case_parts.append(f"WHEN subject ILIKE '{config['pattern']}' THEN '{key}'")

    case_stmt = "CASE " + " ".join(case_parts) + " END"

    query = f"""
    WITH emails_with_campaign AS (
        SELECT
            *,
            {case_stmt} as campaign
        FROM synced_emails
    ),
    -- Get conversations that have both outbound and inbound
    valid_threads AS (
        SELECT outlook_conversation_id
        FROM emails_with_campaign
        WHERE campaign IS NOT NULL
        GROUP BY outlook_conversation_id
        HAVING COUNT(*) FILTER (WHERE direction = 'outbound') > 0
           AND COUNT(*) FILTER (WHERE direction = 'inbound' AND from_email NOT LIKE '%lee-associates.com%') > 0
    ),
    -- Get outbound emails
    outbound AS (
        SELECT
            e.outlook_conversation_id,
            e.campaign,
            e.subject as outbound_subject,
            e.body_text as outbound_body,
            e.sent_at as outbound_sent_at
        FROM emails_with_campaign e
        JOIN valid_threads v ON e.outlook_conversation_id = v.outlook_conversation_id
        WHERE e.direction = 'outbound' AND e.campaign IS NOT NULL
    ),
    -- Get inbound replies
    inbound AS (
        SELECT
            e.outlook_conversation_id,
            e.id as reply_id,
            e.from_name as reply_from_name,
            e.from_email as reply_from_email,
            e.body_text as reply_body,
            e.received_at as reply_received_at
        FROM emails_with_campaign e
        JOIN valid_threads v ON e.outlook_conversation_id = v.outlook_conversation_id
        WHERE e.direction = 'inbound'
          AND e.from_email NOT LIKE '%lee-associates.com%'
    )
    SELECT DISTINCT ON (i.reply_id)
        o.campaign,
        o.outlook_conversation_id as thread_id,
        o.outbound_subject,
        o.outbound_body,
        o.outbound_sent_at,
        i.reply_id,
        i.reply_from_name,
        i.reply_from_email,
        i.reply_body,
        i.reply_received_at
    FROM outbound o
    JOIN inbound i ON o.outlook_conversation_id = i.outlook_conversation_id
    ORDER BY i.reply_id, o.outbound_sent_at DESC
    """

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    conn.close()

    # Process into training data
    training_data = []
    for row in rows:
        campaign_key = row['campaign']
        config = CAMPAIGN_PATTERNS.get(campaign_key, {})

        record = {
            'campaign': config.get('name', campaign_key),
            'campaign_type': config.get('type', 'UNKNOWN'),
            'thread_id': row['thread_id'],
            'outbound_subject': row['outbound_subject'],
            'outbound_body': clean_body(row['outbound_body'] or ''),
            'outbound_sent_at': row['outbound_sent_at'].isoformat() if row['outbound_sent_at'] else None,
            'reply_id': str(row['reply_id']),
            'reply_from_name': row['reply_from_name'],
            'reply_from_email': row['reply_from_email'],
            'reply_body': clean_body(row['reply_body'] or ''),
            'reply_received_at': row['reply_received_at'].isoformat() if row['reply_received_at'] else None,
            'classification': None,  # To be labeled
            'confidence': None,
            'notes': None
        }
        training_data.append(record)

    # Sort by campaign then date
    training_data.sort(key=lambda x: (x['campaign'], x['reply_received_at'] or ''))

    # Save
    output_path = Path('output/campaign_training_data.json')
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(training_data, f, indent=2, ensure_ascii=False)

    # Summary
    print(f'Exported {len(training_data)} training records')
    print()
    print('By campaign:')
    by_campaign = {}
    for r in training_data:
        c = r['campaign']
        if c not in by_campaign:
            by_campaign[c] = {'count': 0, 'type': r['campaign_type']}
        by_campaign[c]['count'] += 1

    print('| Campaign | Type | Records |')
    print('|----------|------|--------:|')
    for c, data in sorted(by_campaign.items(), key=lambda x: -x[1]['count']):
        print(f"| {c} | {data['type']} | {data['count']} |")

    print()
    print(f'Saved to: {output_path}')


if __name__ == '__main__':
    main()
