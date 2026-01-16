/**
 * Claude CLI Runner
 *
 * Shared utility for running Claude CLI commands from worker jobs.
 */

import { spawn } from 'child_process';
import { config } from '../config.js';

export interface RunClaudeOptions {
  timeoutMs?: number;
}

/**
 * Run a prompt through the Claude CLI and return the response.
 */
export function runClaude(prompt: string, options: RunClaudeOptions = {}): Promise<string> {
  const { timeoutMs = 60000 } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['-p', prompt], {
      cwd: config.python.projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env },
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
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || stdout || `Exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });

    setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Claude timeout'));
    }, timeoutMs);
  });
}
