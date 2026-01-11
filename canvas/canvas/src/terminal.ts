import { spawn, spawnSync, execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const isWindows = process.platform === "win32";

export interface TerminalEnvironment {
  inTmux: boolean;
  inWindowsTerminal: boolean;
  platform: "windows" | "unix";
  summary: string;
}

export function detectTerminal(): TerminalEnvironment {
  const inTmux = !!process.env.TMUX;
  const inWindowsTerminal = !!process.env.WT_SESSION;
  const platform = isWindows ? "windows" : "unix";

  let summary: string;
  if (isWindows) {
    summary = inWindowsTerminal ? "Windows Terminal" : "Windows (no WT)";
  } else {
    summary = inTmux ? "tmux" : "no tmux";
  }

  return { inTmux, inWindowsTerminal, platform, summary };
}

export interface SpawnResult {
  method: string;
  pid?: number;
}

export interface SpawnOptions {
  socketPath?: string;
  scenario?: string;
}

export async function spawnCanvas(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions
): Promise<SpawnResult> {
  const env = detectTerminal();

  if (isWindows) {
    return spawnCanvasWindows(kind, id, configJson, options, env);
  } else {
    return spawnCanvasUnix(kind, id, configJson, options, env);
  }
}

// ============= Windows Implementation =============

async function spawnCanvasWindows(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions,
  env?: TerminalEnvironment
): Promise<SpawnResult> {
  if (!env?.inWindowsTerminal) {
    throw new Error(
      "Canvas requires Windows Terminal. Please run inside Windows Terminal (wt.exe)."
    );
  }

  // Get the directory of this script (skill directory)
  const scriptDir = import.meta.dir.replace(/[\\\/]src$/, "");
  const runScript = join(scriptDir, "run-canvas.ps1");

  // Auto-generate socket path (port number) for IPC if not provided
  const socketPath = options?.socketPath || getWindowsSocketPath(id);

  // Write config to temp file to avoid escaping issues
  let configFile: string | undefined;
  if (configJson) {
    configFile = join(tmpdir(), `canvas-config-${id}.json`).replace(/\\/g, "/");
    writeFileSync(configFile, configJson);
  }

  // Build the command arguments for the canvas
  // Config file will be read by a wrapper script
  let canvasArgs = `show ${kind} --id ${id} --socket ${socketPath}`;
  if (configFile) {
    canvasArgs += ` --config-file "${configFile}"`;
  }
  if (options?.scenario) {
    canvasArgs += ` --scenario ${options.scenario}`;
  }

  // Check if we have an existing pane to reuse
  const existingPane = await getWindowsCanvasPane();
  if (existingPane) {
    const reused = await reuseWindowsPane(runScript, canvasArgs);
    if (reused) {
      return { method: "windows-terminal-reuse" };
    }
  }

  // Create new split pane
  const created = await createWindowsPane(runScript, canvasArgs);
  if (created) {
    return { method: "windows-terminal" };
  }

  throw new Error("Failed to spawn Windows Terminal pane");
}

function getWindowsSocketPath(id: string): string {
  // Hash the id to get a consistent port in the ephemeral range (49152-65535)
  const hash = id.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  const port = 49152 + (Math.abs(hash) % 16383);
  return String(port);
}

// File to track Windows Terminal canvas state
const WINDOWS_PANE_FILE = join(tmpdir(), "claude-canvas-wt-pane");

async function getWindowsCanvasPane(): Promise<boolean> {
  try {
    if (existsSync(WINDOWS_PANE_FILE)) {
      const timestamp = parseInt(readFileSync(WINDOWS_PANE_FILE, "utf-8").trim(), 10);
      // Consider pane valid if created within last 30 minutes
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}

async function saveWindowsCanvasPane(): Promise<void> {
  writeFileSync(WINDOWS_PANE_FILE, String(Date.now()));
}

async function createWindowsPane(runScript: string, canvasArgs: string): Promise<boolean> {
  // Use wt.exe to create a vertical split pane
  // -w 0 targets current window
  // sp (split-pane) -V for vertical split (side by side)
  // -s 0.5 gives 50/50 split

  // Get the canvas directory
  const canvasDir = runScript.replace(/[\\\/]run-canvas\.ps1$/, "");

  // Build full command - use PowerShell for better argument handling
  const fullCommand = `bun run src/cli.ts ${canvasArgs}`;

  try {
    // Use -d to set the starting directory, then run PowerShell with the command
    // shell: true needed to find wt.exe via PATH
    const proc = spawn("wt.exe", [
      "-w", "0",
      "sp", "-V", "-s", "0.5",
      "-d", canvasDir,
      "powershell", "-Command", fullCommand
    ], {
      detached: true,
      stdio: "ignore",
      shell: true,
    });

    proc.unref();

    // Give it a moment to spawn
    await new Promise(resolve => setTimeout(resolve, 500));
    await saveWindowsCanvasPane();
    return true;
  } catch (err) {
    console.error("Failed to spawn wt.exe:", err);
    return false;
  }
}

async function reuseWindowsPane(runScript: string, canvasArgs: string): Promise<boolean> {
  // Windows Terminal doesn't have a direct way to send commands to other panes
  // We'll create a new pane instead (the old one will be orphaned)
  // Clear the pane file and create fresh
  try {
    unlinkSync(WINDOWS_PANE_FILE);
  } catch {
    // Ignore
  }
  return false;
}

// ============= Unix/tmux Implementation =============

async function spawnCanvasUnix(
  kind: string,
  id: string,
  configJson?: string,
  options?: SpawnOptions,
  env?: TerminalEnvironment
): Promise<SpawnResult> {
  if (!env?.inTmux) {
    throw new Error("Canvas requires tmux. Please run inside a tmux session.");
  }

  // Get the directory of this script (skill directory)
  const scriptDir = import.meta.dir.replace("/src", "");
  const runScript = `${scriptDir}/run-canvas.sh`;

  // Auto-generate socket path for IPC if not provided
  const socketPath = options?.socketPath || `/tmp/canvas-${id}.sock`;

  // Build the command to run
  let command = `${runScript} show ${kind} --id ${id}`;
  if (configJson) {
    // Write config to a temp file to avoid shell escaping issues
    const configFile = `/tmp/canvas-config-${id}.json`;
    await Bun.write(configFile, configJson);
    command += ` --config "$(cat ${configFile})"`;
  }
  command += ` --socket ${socketPath}`;
  if (options?.scenario) {
    command += ` --scenario ${options.scenario}`;
  }

  const result = await spawnTmux(command);
  if (result) return { method: "tmux" };

  throw new Error("Failed to spawn tmux pane");
}

// File to track the canvas pane ID
const CANVAS_PANE_FILE = "/tmp/claude-canvas-pane-id";

async function getCanvasPaneId(): Promise<string | null> {
  try {
    const file = Bun.file(CANVAS_PANE_FILE);
    if (await file.exists()) {
      const paneId = (await file.text()).trim();
      // Verify the pane still exists by checking if tmux can find it
      const result = spawnSync("tmux", ["display-message", "-t", paneId, "-p", "#{pane_id}"]);
      const output = result.stdout?.toString().trim();
      // Pane exists only if command succeeds AND returns the same pane ID
      if (result.status === 0 && output === paneId) {
        return paneId;
      }
      // Stale pane reference - clean up the file
      await Bun.write(CANVAS_PANE_FILE, "");
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function saveCanvasPaneId(paneId: string): Promise<void> {
  await Bun.write(CANVAS_PANE_FILE, paneId);
}

async function createNewPane(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use split-window -h for vertical split (side by side)
    // -p 67 gives canvas 2/3 width (1:2 ratio, Claude:Canvas)
    // -P -F prints the new pane ID so we can save it
    const args = ["split-window", "-h", "-p", "67", "-P", "-F", "#{pane_id}", command];
    const proc = spawn("tmux", args);
    let paneId = "";
    proc.stdout?.on("data", (data) => {
      paneId += data.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && paneId.trim()) {
        await saveCanvasPaneId(paneId.trim());
      }
      resolve(code === 0);
    });
    proc.on("error", () => resolve(false));
  });
}

async function reuseExistingPane(paneId: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Send Ctrl+C to interrupt any running process
    const killProc = spawn("tmux", ["send-keys", "-t", paneId, "C-c"]);
    killProc.on("close", () => {
      // Wait for process to terminate before sending new command
      setTimeout(() => {
        // Clear the terminal and run the new command
        const args = ["send-keys", "-t", paneId, `clear && ${command}`, "Enter"];
        const proc = spawn("tmux", args);
        proc.on("close", (code) => resolve(code === 0));
        proc.on("error", () => resolve(false));
      }, 150);
    });
    killProc.on("error", () => resolve(false));
  });
}

async function spawnTmux(command: string): Promise<boolean> {
  // Check if we have an existing canvas pane to reuse
  const existingPaneId = await getCanvasPaneId();

  if (existingPaneId) {
    // Try to reuse existing pane
    const reused = await reuseExistingPane(existingPaneId, command);
    if (reused) {
      return true;
    }
    // Reuse failed (pane may have been closed) - clear stale reference and create new
    await Bun.write(CANVAS_PANE_FILE, "");
  }

  // Create a new split pane
  return createNewPane(command);
}
