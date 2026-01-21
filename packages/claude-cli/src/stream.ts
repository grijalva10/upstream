/**
 * Streaming mode for Claude CLI.
 *
 * Uses --output-format stream-json to yield chunks as they arrive.
 * Useful for real-time UI updates and Server-Sent Events (SSE).
 */

import type { ClaudeRunOptions, StreamChunk, ClaudeStreamLine } from './types.js';
import { spawnClaude } from './runner.js';

/**
 * Run Claude CLI in streaming mode.
 *
 * Yields chunks as they arrive from Claude. Each chunk contains
 * the type (text, tool_use, etc.) and content.
 *
 * @example
 * ```ts
 * for await (const chunk of runStream({
 *   prompt: 'Tell me a story',
 *   maxTurns: 1,
 * })) {
 *   if (chunk.type === 'text') {
 *     process.stdout.write(chunk.content);
 *   }
 * }
 * ```
 */
export async function* runStream(
  options: ClaudeRunOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  // Force stream-json output format
  const streamOptions: ClaudeRunOptions = {
    ...options,
    outputFormat: 'stream-json',
  };

  const { process: proc, cleanup } = await spawnClaude(streamOptions);
  const timeout = options.timeout ?? 120000;

  try {
    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Claude CLI streaming timed out after ${timeout}ms`));
      }, timeout);
    });

    // Buffer for incomplete lines
    let buffer = '';

    // Create async iterator from stdout
    const stdout = proc.stdout;
    if (!stdout) {
      throw new Error('No stdout available from Claude process');
    }

    // Process chunks as they arrive
    for await (const data of stdout) {
      buffer += data.toString();

      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        const chunk = parseStreamLine(line);
        if (chunk) {
          yield chunk;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const chunk = parseStreamLine(buffer);
      if (chunk) {
        yield chunk;
      }
    }

    // Signal completion
    yield {
      type: 'done',
      content: '',
    };
  } catch (err) {
    yield {
      type: 'error',
      content: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await cleanup();
  }
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  input?: unknown;
  content?: string;
}

interface StreamMessage {
  type: string;
  message?: {
    content?: ContentBlock[];
  };
  result?: string;
}

/**
 * Parse a single line from stream-json output.
 */
function parseStreamLine(line: string): StreamChunk | null {
  try {
    const parsed: StreamMessage = JSON.parse(line);

    // Handle assistant messages with content array
    if (parsed.type === 'assistant' && parsed.message?.content) {
      const chunks: StreamChunk[] = [];

      for (const block of parsed.message.content) {
        if (block.type === 'text' && block.text) {
          chunks.push({
            type: 'text',
            content: block.text,
            raw: parsed,
          });
        } else if (block.type === 'tool_use' && block.name) {
          chunks.push({
            type: 'tool_use',
            content: '',
            tool: block.name,
            raw: parsed,
          });
        } else if (block.type === 'tool_result') {
          chunks.push({
            type: 'tool_result',
            content: typeof block.content === 'string' ? block.content : '',
            raw: parsed,
          });
        }
      }

      // Return first chunk (we'll handle multiple chunks in the generator)
      return chunks[0] || null;
    }

    // Handle result/completion
    if (parsed.type === 'result') {
      return {
        type: 'done',
        content: parsed.result || '',
        raw: parsed,
      };
    }

    return null;
  } catch {
    // Not valid JSON - might be plain text output
    if (line.trim()) {
      return {
        type: 'text',
        content: line,
      };
    }
    return null;
  }
}

/**
 * Create a ReadableStream for SSE responses.
 *
 * Useful for Next.js API routes that want to stream responses.
 *
 * @example
 * ```ts
 * // In a Next.js API route
 * export async function POST(request: Request) {
 *   const stream = createSSEStream({
 *     prompt: 'Tell me a story',
 *     maxTurns: 1,
 *   });
 *   return new Response(stream, {
 *     headers: {
 *       'Content-Type': 'text/event-stream',
 *       'Cache-Control': 'no-cache',
 *       'Connection': 'keep-alive',
 *     },
 *   });
 * }
 * ```
 */
export function createSSEStream(options: ClaudeRunOptions): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of runStream(options)) {
          const event = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(event));
        }
      } catch (err) {
        const errorEvent = `data: ${JSON.stringify({
          type: 'error',
          content: err instanceof Error ? err.message : String(err),
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });
}
