import win32com.client

outlook = win32com.client.Dispatch('Outlook.Application')
namespace = outlook.GetNamespace('MAPI')

inbox = namespace.GetDefaultFolder(6)
archive_folder = inbox.Folders['_Archive']
newsletters_folder = archive_folder.Folders['Newsletters']

# Add rule for AIR CRE
rules = namespace.DefaultStore.GetRules()

rule = rules.Create('Archive AIR CRE Super Sheets', 0)
condition = rule.Conditions.Subject
condition.Enabled = True
condition.Text = ['AIR CRE Super Sheets']

action = rule.Actions.MoveToFolder
action.Enabled = True
action.Folder = newsletters_folder

try:
    rules.Save()
    print('Created rule: Archive AIR CRE Super Sheets')
except Exception as e:
    print(f'Rule created but save warning: {e}')

print()
print('Scanning inbox for other archivable emails...')

# Patterns for archivable emails
archive_senders = ['dropbox', 'paddle.com', 'n8n', 'sharepoint', 'microsoft', 'lee secure', 'entralon', 'loopnet', 'crexi']
archive_subjects = ['unsubscribe', 'your receipt', 'trial ended', 'trial cancelled', 'security:', 'quarantine', 'news you might have missed']

items = inbox.Items
to_archive = []

for item in items:
    try:
        if item.Class != 43:
            continue
        sender = str(item.SenderEmailAddress or '').lower()
        sender_name = str(item.SenderName or '').lower()
        subject = str(item.Subject or '').lower()

        should_archive = False

        for pattern in archive_senders:
            if pattern in sender or pattern in sender_name:
                should_archive = True
                break

        if not should_archive:
            for pattern in archive_subjects:
                if pattern in subject:
                    should_archive = True
                    break

        if should_archive:
            to_archive.append(item)
    except:
        continue

print(f'Found {len(to_archive)} more emails to archive')
print()

for item in to_archive:
    try:
        subj = str(item.Subject or '')[:55]
        sender = str(item.SenderName or '')[:20]
        print(f'{sender:20s} | {subj}')
        item.Move(newsletters_folder)
    except:
        pass

print()
print('Done!')
