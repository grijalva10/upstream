// IPC Server - Canvas side (for standalone CLI mode)
// Listens on a Unix domain socket (Unix) or TCP port (Windows) for controller commands

import type { ControllerMessage, CanvasMessage } from "./types";
import { isWindows, getConnectionConfig } from "./types";
import { unlinkSync, existsSync } from "fs";

export interface IPCServerOptions {
  socketPath: string;
  onMessage: (msg: ControllerMessage) => void;
  onClientConnect?: () => void;
  onClientDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface IPCServer {
  broadcast: (msg: CanvasMessage) => void;
  close: () => void;
}

export async function createIPCServer(options: IPCServerOptions): Promise<IPCServer> {
  const { socketPath, onMessage, onClientConnect, onClientDisconnect, onError } = options;

  // Remove existing socket file if it exists (Unix only)
  if (!isWindows && existsSync(socketPath)) {
    unlinkSync(socketPath);
  }

  const clients = new Set<any>();
  let buffer = "";

  // Build connection config - on Windows use TCP, on Unix use domain socket
  const connectionConfig = isWindows
    ? { port: parseInt(socketPath, 10), hostname: "127.0.0.1" }
    : { unix: socketPath };

  const server = Bun.listen({
    ...connectionConfig,
    socket: {
      open(socket) {
        clients.add(socket);
        onClientConnect?.();
      },

      data(socket, data) {
        // Accumulate data and parse complete JSON messages
        buffer += data.toString();

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const msg = JSON.parse(line) as ControllerMessage;
              onMessage(msg);
            } catch (e) {
              onError?.(new Error(`Failed to parse message: ${line}`));
            }
          }
        }
      },

      close(socket) {
        clients.delete(socket);
        onClientDisconnect?.();
      },

      error(socket, error) {
        onError?.(error);
      },
    },
  });

  return {
    broadcast(msg: CanvasMessage) {
      const data = JSON.stringify(msg) + "\n";
      for (const client of clients) {
        client.write(data);
      }
    },

    close() {
      server.stop();
      // Only clean up socket file on Unix
      if (!isWindows && existsSync(socketPath)) {
        unlinkSync(socketPath);
      }
    },
  };
}
