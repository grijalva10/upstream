/**
 * Shared types for Claude CLI wrapper.
 */

/**
 * Options for running Claude CLI.
 */
export interface ClaudeRunOptions {
  /** The prompt to send to Claude */
  prompt: string;
  /** System prompt for context (optional) */
  systemPrompt?: string;
  /** Path to system prompt file (alternative to systemPrompt) */
  systemPromptFile?: string;
  /** Agent name from .claude/agents/ (optional) */
  agent?: string;
  /** Maximum number of agentic turns (default: 10) */
  maxTurns?: number;
  /** Timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Allowed tools (comma-separated or array) */
  allowedTools?: string | string[];
  /** Session ID to resume a conversation */
  sessionId?: string;
  /** Output format: 'text' | 'json' | 'stream-json' */
  outputFormat?: 'text' | 'json' | 'stream-json';
  /** Working directory for Claude CLI (default: project root) */
  cwd?: string;
}

/**
 * Result from a batch Claude run.
 */
export interface ClaudeResult {
  /** Whether the run completed successfully */
  success: boolean;
  /** Raw output text from Claude */
  output: string;
  /** Parsed JSON output (if outputFormat was 'json') */
  parsed?: unknown;
  /** Session ID for resuming (if available) */
  sessionId?: string;
  /** Error message if failed */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Chunk types for streaming output.
 */
export type StreamChunkType =
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'done';

/**
 * Streaming chunk from Claude CLI.
 */
export interface StreamChunk {
  /** Type of chunk */
  type: StreamChunkType;
  /** Content of the chunk */
  content: string;
  /** Tool name (for tool_use/tool_result) */
  tool?: string;
  /** Raw data from stream-json output */
  raw?: unknown;
}

/**
 * Claude CLI JSON response format (when using --output-format json).
 */
export interface ClaudeJsonResponse {
  type: 'result';
  subtype: 'success' | 'error_max_turns' | 'error';
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id?: string;
  total_cost_usd?: number;
}

/**
 * Claude CLI stream-json line format.
 */
export interface ClaudeStreamLine {
  type: 'assistant' | 'result' | 'system' | 'user';
  message?: {
    type: 'text' | 'tool_use' | 'tool_result';
    text?: string;
    name?: string;
    content?: string;
  };
  subtype?: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
}
