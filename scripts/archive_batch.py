import win32com.client
import sys
sys.stdout.reconfigure(encoding='utf-8')

outlook = win32com.client.Dispatch('Outlook.Application')
namespace = outlook.GetNamespace('MAPI')

inbox = namespace.GetDefaultFolder(6)
archive_folder = inbox.Folders['_Archive']
newsletters_folder = archive_folder.Folders['Newsletters']

items = inbox.Items
to_archive = []

# Patterns to archive
archive_senders = ['christian kasparian', 'patti murray', 'brock baker']
archive_subjects = ['kiplinger', 'gym showers', 'frank out sick', 'ocean newsletter', 'see you next week', 'zoominfo', 'industrial sublease', 'ooo', 'out of office', 'jan 12/13']
archive_from_eva = ['kiplinger', 'gym', 'sick', 'silver exposure']

for item in items:
    try:
        if item.Class != 43:
            continue
        sender_name = str(item.SenderName or '').lower()
        subject = str(item.Subject or '').lower()

        should_archive = False

        # Check sender matches
        for pattern in archive_senders:
            if pattern in sender_name:
                should_archive = True
                break

        # Check subject matches
        if not should_archive:
            for pattern in archive_subjects:
                if pattern in subject:
                    should_archive = True
                    break

        # Eva Abrego specific patterns (office admin, not deal related)
        if not should_archive and 'eva abrego' in sender_name:
            for pattern in archive_from_eva:
                if pattern in subject:
                    should_archive = True
                    break

        # OCEAN newsletters
        if not should_archive and 'ocean' in sender_name:
            should_archive = True

        # Rick Turner OOO
        if not should_archive and 'rick turner' in sender_name and ('jan 12' in subject or 'ooo' in subject or 'out of' in subject):
            should_archive = True

        if should_archive:
            to_archive.append(item)
    except:
        continue

print(f'Found {len(to_archive)} emails to archive')
print()

for item in to_archive:
    try:
        sender = str(item.SenderName or '')[:20]
        subj = str(item.Subject or '')[:50].encode('ascii', 'replace').decode()
        print(f'{sender:20s} | {subj}')
        item.Move(newsletters_folder)
    except Exception as e:
        print(f'Error: {e}')

print()
print('Done!')
