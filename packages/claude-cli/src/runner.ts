/**
 * Core Claude CLI spawn logic.
 *
 * Handles the complexity of spawning the Claude CLI process
 * with proper argument handling, stdin piping, and output parsing.
 */

import { spawn, type ChildProcess } from 'child_process';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ClaudeRunOptions, ClaudeJsonResponse } from './types.js';

/** Default timeout in milliseconds (2 minutes) */
const DEFAULT_TIMEOUT = 120000;

/** Maximum command line length before using temp file for prompt */
const MAX_CMD_LENGTH = 8000;

/**
 * Build CLI arguments from options.
 */
export function buildArgs(options: ClaudeRunOptions): string[] {
  const args: string[] = ['-p']; // Print mode (non-interactive)

  // Output format
  if (options.outputFormat && options.outputFormat !== 'text') {
    args.push('--output-format', options.outputFormat);
  }

  // Max turns
  if (options.maxTurns !== undefined) {
    args.push('--max-turns', String(options.maxTurns));
  }

  // Resume session
  if (options.sessionId) {
    args.push('--resume', options.sessionId);
  }

  // Allowed tools
  if (options.allowedTools) {
    const tools = Array.isArray(options.allowedTools)
      ? options.allowedTools.join(',')
      : options.allowedTools;
    args.push('--allowedTools', tools);
  }

  // System prompt
  if (options.systemPromptFile) {
    args.push('--system-prompt-file', options.systemPromptFile);
  } else if (options.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  return args;
}

/**
 * Determine if we need to use a temp file for the prompt.
 * This is necessary on Windows where command line length is limited.
 */
function needsTempFile(prompt: string): boolean {
  return prompt.length > MAX_CMD_LENGTH || prompt.includes('\n');
}

/**
 * Create a temp file with the prompt content.
 */
async function createPromptFile(prompt: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'claude-'));
  const tempFile = join(tempDir, 'prompt.txt');
  await writeFile(tempFile, prompt, 'utf-8');
  return tempFile;
}

/**
 * Clean up temp file.
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
    // Try to remove the directory too
    const { rmdir } = await import('fs/promises');
    await rmdir(filePath.replace(/[/\\][^/\\]+$/, ''));
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Spawn Claude CLI process with the given options.
 * Returns the process and a cleanup function.
 */
export async function spawnClaude(
  options: ClaudeRunOptions
): Promise<{
  process: ChildProcess;
  cleanup: () => Promise<void>;
}> {
  const args = buildArgs(options);

  // Short prompt - pass directly as argument
  if (!needsTempFile(options.prompt)) {
    args.push(options.prompt);
    const proc = spawn('claude', args, {
      cwd: options.cwd,
      env: { ...process.env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { process: proc, cleanup: async () => {} };
  }

  // Long prompt - use temp file and pipe via shell
  const tempFile = await createPromptFile(options.prompt);
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd' : 'sh';
  const catCmd = isWindows ? 'type' : 'cat';
  const shellArg = isWindows ? '/c' : '-c';
  const pipeCmd = `${catCmd} "${tempFile}" | claude ${args.join(' ')}`;

  const proc = spawn(shell, [shellArg, pipeCmd], {
    cwd: options.cwd,
    env: { ...process.env },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    process: proc,
    cleanup: async () => cleanupTempFile(tempFile),
  };
}

/**
 * Parse JSON response from Claude CLI.
 */
export function parseJsonResponse(output: string): ClaudeJsonResponse | null {
  try {
    // Find JSON object in output (handle potential text before/after)
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate it's a Claude response
    if (parsed.type === 'result' && typeof parsed.is_error === 'boolean') {
      return parsed as ClaudeJsonResponse;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract session ID from Claude output.
 * The session ID appears in various formats depending on output mode.
 */
export function extractSessionId(output: string): string | null {
  // Try JSON format first
  const jsonResponse = parseJsonResponse(output);
  if (jsonResponse?.session_id) {
    return jsonResponse.session_id;
  }

  // Try to find session_id in text output
  const sessionMatch = output.match(/session[_-]?id[:\s]+([a-f0-9-]+)/i);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  return null;
}

/**
 * Run Claude CLI and collect all output.
 * This is a low-level function used by both batch and stream modes.
 */
export async function runClaudeRaw(
  options: ClaudeRunOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const { process: proc, cleanup } = await spawnClaude(options);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      reject(new Error(`Claude CLI timed out after ${timeout}ms`));
    }, timeout);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      clearTimeout(timer);
      await cleanup();

      if (timedOut) return;

      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on('error', async (err) => {
      clearTimeout(timer);
      await cleanup();
      reject(err);
    });
  });
}
