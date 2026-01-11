// IPC Message Types for Canvas Communication

// Messages sent from Controller (Claude) to Canvas
export type ControllerMessage =
  | { type: "close" }
  | { type: "update"; config: unknown }
  | { type: "ping" }
  | { type: "getSelection" }
  | { type: "getContent" };

// Messages sent from Canvas to Controller (Claude)
export type CanvasMessage =
  | { type: "ready"; scenario: string }
  | { type: "selected"; data: unknown }
  | { type: "cancelled"; reason?: string }
  | { type: "error"; message: string }
  | { type: "pong" }
  | { type: "selection"; data: { selectedText: string; startOffset: number; endOffset: number } | null }
  | { type: "content"; data: { content: string; cursorPosition: number } };

// Platform detection
export const isWindows = process.platform === "win32";

// Socket/port convention - Windows uses TCP ports, Unix uses domain sockets
export function getSocketPath(id: string): string {
  if (isWindows) {
    // On Windows, return a port number as string (we'll use TCP)
    // Hash the id to get a consistent port in the ephemeral range (49152-65535)
    const hash = id.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const port = 49152 + (Math.abs(hash) % 16383);
    return String(port);
  }
  return `/tmp/canvas-${id}.sock`;
}

// Get connection config for Bun.listen/Bun.connect
export function getConnectionConfig(id: string): { unix: string } | { port: number; hostname: string } {
  if (isWindows) {
    const port = parseInt(getSocketPath(id), 10);
    return { port, hostname: "127.0.0.1" };
  }
  return { unix: getSocketPath(id) };
}
