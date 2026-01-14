import PgBoss from 'pg-boss';
import { spawn } from 'child_process';
import { config } from '../config.js';
import path from 'path';

export interface EmailSyncResult {
  success: boolean;
  newEmails: number;
  duration: number;
  error?: string;
}

export async function handleEmailSync(
  _job: PgBoss.Job
): Promise<EmailSyncResult> {
  console.log('[email-sync] Starting Outlook sync...');
  const startTime = Date.now();

  if (config.dryRun) {
    console.log('[email-sync] DRY RUN - skipping actual sync');
    return {
      success: true,
      newEmails: 0,
      duration: Date.now() - startTime,
    };
  }

  const scriptPath = path.join(config.python.scriptsDir, 'sync_all_emails.py');

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.executable, [scriptPath], {
      cwd: config.python.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (config.debug) {
        process.stdout.write(text);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (config.debug) {
        process.stderr.write(text);
      }
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        // Parse output for metrics
        const newMatch = stdout.match(/Total new emails:\s*(\d+)/i) ||
                         stdout.match(/Synced\s*(\d+)\s*new/i) ||
                         stdout.match(/new emails:\s*(\d+)/i);
        const newEmails = newMatch ? parseInt(newMatch[1]) : 0;

        console.log(`[email-sync] Completed in ${duration}ms, ${newEmails} new emails`);
        resolve({
          success: true,
          newEmails,
          duration,
        });
      } else {
        const errorMsg = stderr || stdout || `Exit code ${code}`;
        console.error(`[email-sync] Failed: ${errorMsg}`);
        reject(new Error(errorMsg));
      }
    });

    proc.on('error', (error) => {
      console.error('[email-sync] Process error:', error);
      reject(error);
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Sync timeout after 10 minutes'));
    }, 10 * 60 * 1000);
  });
}
