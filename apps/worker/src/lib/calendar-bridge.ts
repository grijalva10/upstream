/**
 * Calendar Bridge - TypeScript wrapper for Outlook calendar operations
 *
 * Uses Python subprocess to interact with Outlook via COM (Windows only)
 */

import { spawn } from 'child_process';
import { config } from '../config.js';

export interface CalendarSlot {
  datetime: string; // ISO string
  display: string; // Human-readable format
}

export interface CalendarEvent {
  entry_id: string;
  subject: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

/**
 * Get available calendar slots for the next N business days
 */
export async function getCalendarAvailability(days: number = 5): Promise<CalendarSlot[]> {
  const pythonCode = `
import sys
import json
sys.path.insert(0, r'${config.python.projectRoot}')

from datetime import datetime, timedelta
from integrations.outlook import OutlookClient

def get_availability(days=5):
    client = OutlookClient()
    slots = []

    # Get existing appointments for the next N days
    now = datetime.now()
    end_date = now + timedelta(days=days + 2)  # Extra buffer for weekends

    try:
        appointments = client.calendar.get_appointments(now, end_date)
        busy_times = set()
        for appt in appointments:
            # Mark busy slots (hourly blocks)
            start = appt.start
            while start < appt.end:
                busy_times.add(start.strftime('%Y-%m-%d %H:00'))
                start += timedelta(hours=1)
    except Exception as e:
        print(f"Warning: Could not get appointments: {e}", file=sys.stderr)
        busy_times = set()

    # Generate available slots
    business_days_found = 0
    day_offset = 0

    while business_days_found < days and day_offset < 14:
        check_date = now + timedelta(days=day_offset)
        day_offset += 1

        # Skip weekends
        if check_date.weekday() >= 5:
            continue

        business_days_found += 1

        # Check hours 9am-5pm (skip noon for lunch)
        for hour in [9, 10, 11, 14, 15, 16]:
            slot_time = check_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            slot_key = slot_time.strftime('%Y-%m-%d %H:00')

            if slot_key not in busy_times and slot_time > now:
                slots.append({
                    'datetime': slot_time.isoformat(),
                    'display': slot_time.strftime('%A %b %d at %I:%M %p PT')
                })

                if len(slots) >= 8:  # Return up to 8 slots
                    break

        if len(slots) >= 8:
            break

    return slots

try:
    slots = get_availability(${days})
    print(json.dumps(slots))
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.executable, ['-c', pythonCode], {
      cwd: config.python.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const slots = JSON.parse(stdout.trim());
          resolve(slots);
        } catch (err) {
          reject(new Error(`Failed to parse calendar response: ${stdout}`));
        }
      } else {
        reject(new Error(`Calendar availability failed: ${stderr || stdout || `Exit code ${code}`}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn Python: ${error.message}`));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Calendar availability timeout'));
    }, 30000);
  });
}

/**
 * Create a calendar meeting with an attendee
 */
export async function createCalendarMeeting(
  subject: string,
  start: Date,
  durationMinutes: number,
  attendeeEmail: string,
  body?: string
): Promise<string> {
  const startIso = start.toISOString();
  const endTime = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const endIso = endTime.toISOString();

  // Escape strings for Python
  const escapeForPython = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

  const pythonCode = `
import sys
sys.path.insert(0, r'${config.python.projectRoot}')

from datetime import datetime
from integrations.outlook import OutlookClient

try:
    client = OutlookClient()

    start = datetime.fromisoformat('${startIso}'.replace('Z', '+00:00'))
    end = datetime.fromisoformat('${endIso}'.replace('Z', '+00:00'))

    meeting = client.calendar.create_meeting(
        subject='${escapeForPython(subject)}',
        start=start,
        end=end,
        attendees='${escapeForPython(attendeeEmail)}',
        body='''${escapeForPython(body || '')}''',
        reminder_minutes=15,
        send_invites=True
    )

    print(meeting.entry_id or 'CREATED')
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.executable, ['-c', pythonCode], {
      cwd: config.python.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Create meeting failed: ${stderr || stdout || `Exit code ${code}`}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn Python: ${error.message}`));
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Create meeting timeout'));
    }, 60000);
  });
}

/**
 * Get upcoming appointments
 */
export async function getUpcomingAppointments(days: number = 7): Promise<CalendarEvent[]> {
  const pythonCode = `
import sys
import json
sys.path.insert(0, r'${config.python.projectRoot}')

from datetime import datetime, timedelta
from integrations.outlook import OutlookClient

try:
    client = OutlookClient()
    now = datetime.now()
    end_date = now + timedelta(days=${days})

    appointments = client.calendar.get_appointments(now, end_date)

    result = []
    for appt in appointments:
        result.append({
            'entry_id': appt.entry_id or '',
            'subject': appt.subject,
            'start': appt.start.isoformat() if appt.start else '',
            'end': appt.end.isoformat() if appt.end else '',
            'location': appt.location or '',
            'attendees': [a.email for a in appt.attendees] if appt.attendees else []
        })

    print(json.dumps(result))
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.executable, ['-c', pythonCode], {
      cwd: config.python.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (err) {
          reject(new Error(`Failed to parse appointments: ${stdout}`));
        }
      } else {
        reject(new Error(`Get appointments failed: ${stderr || stdout || `Exit code ${code}`}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn Python: ${error.message}`));
    });

    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Get appointments timeout'));
    }, 30000);
  });
}
