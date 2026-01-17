/**
 * @upstream/claude-cli
 *
 * Unified TypeScript wrapper for Claude CLI.
 * Provides both batch (worker jobs) and streaming (web chat) modes.
 *
 * @example
 * ```ts
 * // Batch mode for worker jobs
 * import { runBatch } from '@upstream/claude-cli';
 *
 * const result = await runBatch({
 *   prompt: 'Classify this email...',
 *   maxTurns: 1,
 * });
 *
 * // Streaming mode for web chat
 * import { runStream } from '@upstream/claude-cli';
 *
 * for await (const chunk of runStream({ prompt: 'Hello' })) {
 *   console.log(chunk);
 * }
 * ```
 */

// Types
export type {
  ClaudeRunOptions,
  ClaudeResult,
  StreamChunk,
  StreamChunkType,
  ClaudeJsonResponse,
  ClaudeStreamLine,
} from './types.js';

// Batch mode (worker jobs)
export { runBatch, runAgent, runSimple } from './batch.js';

// Streaming mode (web chat)
export { runStream, createSSEStream } from './stream.js';

// Low-level utilities (for advanced use)
export {
  buildArgs,
  spawnClaude,
  runClaudeRaw,
  parseJsonResponse,
  extractSessionId,
} from './runner.js';
