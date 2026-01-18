/**
 * Batch mode for Claude CLI - waits for completion and returns result.
 *
 * Used by worker jobs that need to run Claude and wait for the full response.
 */

import type { ClaudeRunOptions, ClaudeResult } from './types.js';
import { runClaudeRaw, parseJsonResponse, extractSessionId } from './runner.js';

/**
 * Run Claude CLI in batch mode.
 *
 * Waits for the process to complete and returns the full result.
 * If outputFormat is 'json', the response is parsed automatically.
 *
 * @example
 * ```ts
 * const result = await runBatch({
 *   prompt: 'Classify this email...',
 *   maxTurns: 1,
 *   timeout: 60000,
 * });
 *
 * if (result.success) {
 *   console.log(result.output);
 * }
 * ```
 */
export async function runBatch(options: ClaudeRunOptions): Promise<ClaudeResult> {
  const startTime = Date.now();

  try {
    const { stdout, stderr, exitCode } = await runClaudeRaw(options);
    const durationMs = Date.now() - startTime;

    // Handle non-zero exit code
    if (exitCode !== 0) {
      return {
        success: false,
        output: stdout,
        error: stderr || `Exit code ${exitCode}`,
        durationMs,
      };
    }

    // Parse JSON response if requested
    if (options.outputFormat === 'json') {
      const jsonResponse = parseJsonResponse(stdout);

      if (jsonResponse) {
        return {
          success: !jsonResponse.is_error,
          output: jsonResponse.result || stdout,
          parsed: jsonResponse,
          sessionId: jsonResponse.session_id,
          error: jsonResponse.is_error ? jsonResponse.result : undefined,
          durationMs: jsonResponse.duration_ms || durationMs,
        };
      }
    }

    // Return text response
    return {
      success: true,
      output: stdout.trim(),
      sessionId: extractSessionId(stdout) ?? undefined,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    };
  }
}

/**
 * Run Claude CLI with a specific agent.
 *
 * Convenience wrapper that sets up agent-specific options.
 *
 * @example
 * ```ts
 * const result = await runAgent('sourcing-agent', {
 *   prompt: 'Generate CoStar queries for this buyer criteria...',
 *   maxTurns: 10,
 * });
 * ```
 */
export async function runAgent(
  agentName: string,
  options: Omit<ClaudeRunOptions, 'agent'>
): Promise<ClaudeResult> {
  // Note: Currently Claude CLI doesn't have a direct --agent flag.
  // Agents are loaded via .claude/agents/ directory automatically.
  // This function is provided for future compatibility and clarity.
  return runBatch({
    ...options,
    agent: agentName,
  });
}

/**
 * Run a simple prompt and get the text response.
 *
 * Simplified interface for quick queries without agentic capabilities.
 *
 * @example
 * ```ts
 * const response = await runSimple('What is 2 + 2?');
 * console.log(response); // "4"
 * ```
 */
export async function runSimple(
  prompt: string,
  options?: Partial<ClaudeRunOptions>
): Promise<string> {
  const result = await runBatch({
    prompt,
    maxTurns: 1,
    timeout: 60000,
    ...options,
  });

  if (!result.success) {
    throw new Error(result.error || 'Claude request failed');
  }

  return result.output;
}
