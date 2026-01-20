import win32com.client
import sys
sys.stdout.reconfigure(encoding='utf-8')

outlook = win32com.client.Dispatch('Outlook.Application')
namespace = outlook.GetNamespace('MAPI')

inbox = namespace.GetDefaultFolder(6)
items = inbox.Items
items.Sort('[ReceivedTime]', True)

print(f'Inbox count: {inbox.Items.Count}')
print()
print('Remaining emails (most recent first):')
print()

count = 0
for item in items:
    if count >= 50:
        print('...(showing first 50)')
        break
    try:
        if item.Class != 43:
            continue
        date = str(item.ReceivedTime)[:10]
        sender = str(item.SenderName or '')[:22]
        subject = str(item.Subject or '')[:50].encode('ascii', 'replace').decode()
        unread = '*' if item.UnRead else ' '
        print(f'{unread} {date} | {sender:22s} | {subject}')
        count += 1
    except:
        continue
