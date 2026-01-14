import { spawn } from 'child_process';
import { config } from '../config.js';

export async function sendViaOutlook(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // Escape special characters for Python string
  const escapeForPython = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

  const pythonCode = `
import sys
sys.path.insert(0, r'${config.python.projectRoot}')

try:
    from integrations.outlook import OutlookClient
    client = OutlookClient()
    client.email.send(
        to='${escapeForPython(to)}',
        subject='${escapeForPython(subject)}',
        body='''${escapeForPython(body)}''',
        html=False
    )
    print('SENT')
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
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
      if (code === 0 && stdout.includes('SENT')) {
        resolve();
      } else {
        const errorMsg = stderr || stdout || `Exit code ${code}`;
        reject(new Error(`Outlook send failed: ${errorMsg}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn Python: ${error.message}`));
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Send timeout after 60 seconds'));
    }, 60000);
  });
}

export async function syncOutlookEmails(): Promise<{ newCount: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      config.python.executable,
      ['scripts/sync_all_emails.py'],
      {
        cwd: config.python.projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
        },
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const match = stdout.match(/Total new emails:\s*(\d+)/i);
        const newCount = match ? parseInt(match[1]) : 0;
        resolve({ newCount });
      } else {
        reject(new Error(stderr || stdout || `Exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Sync timeout'));
    }, 10 * 60 * 1000);
  });
}
