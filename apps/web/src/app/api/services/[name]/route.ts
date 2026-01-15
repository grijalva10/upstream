import { NextRequest, NextResponse } from "next/server";
import { spawn, exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// Get project root (assuming we're in apps/web)
const PROJECT_ROOT = path.resolve(process.cwd(), "../..");

async function findProcessByPort(port: number): Promise<number | null> {
  try {
    // Use netstat which is more reliable across Windows versions
    const { stdout } = await execAsync(
      `netstat -ano | findstr ":${port}" | findstr "LISTENING"`
    );
    const lines = stdout.trim().split("\n");
    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1]);
      return isNaN(pid) ? null : pid;
    }
    return null;
  } catch {
    return null;
  }
}

async function findWorkerProcess(): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'node.exe'\\" | Where-Object { $_.CommandLine -match 'apps.worker' } | Select-Object ProcessId -First 1 | ForEach-Object { $_.ProcessId }"`
    );
    const pid = parseInt(stdout.trim());
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function killProcess(pid: number): Promise<boolean> {
  try {
    await execAsync(`powershell -Command "Stop-Process -Id ${pid} -Force"`);
    return true;
  } catch {
    return false;
  }
}

// POST - Start a service
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (name === "costar") {
    // Check if already running
    const existingPid = await findProcessByPort(8765);
    if (existingPid) {
      return NextResponse.json({ error: "CoStar service already running", pid: existingPid }, { status: 400 });
    }

    // Start CoStar service
    const proc = spawn("python", ["integrations/costar/service.py"], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      shell: true,
    });
    proc.unref();

    // Wait a moment for it to start
    await new Promise((r) => setTimeout(r, 2000));

    const pid = await findProcessByPort(8765);
    return NextResponse.json({
      message: "CoStar service starting",
      pid: pid || proc.pid,
    });
  }

  if (name === "worker") {
    // Check if already running
    const existingPid = await findWorkerProcess();
    if (existingPid) {
      return NextResponse.json({ error: "Worker already running", pid: existingPid }, { status: 400 });
    }

    // Start worker
    const workerPath = path.join(PROJECT_ROOT, "apps/worker");
    const proc = spawn("npm", ["run", "dev"], {
      cwd: workerPath,
      detached: true,
      stdio: "ignore",
      shell: true,
    });
    proc.unref();

    // Wait a moment for it to start
    await new Promise((r) => setTimeout(r, 3000));

    const pid = await findWorkerProcess();
    return NextResponse.json({
      message: "Worker starting",
      pid: pid || proc.pid,
    });
  }

  return NextResponse.json({ error: "Unknown service" }, { status: 404 });
}

// DELETE - Stop a service
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (name === "costar") {
    const pid = await findProcessByPort(8765);
    if (!pid) {
      return NextResponse.json({ error: "CoStar service not running" }, { status: 400 });
    }

    const killed = await killProcess(pid);
    return NextResponse.json({
      message: killed ? "CoStar service stopped" : "Failed to stop",
      pid,
    });
  }

  if (name === "worker") {
    const pid = await findWorkerProcess();
    if (!pid) {
      return NextResponse.json({ error: "Worker not running" }, { status: 400 });
    }

    const killed = await killProcess(pid);
    return NextResponse.json({
      message: killed ? "Worker stopped" : "Failed to stop",
      pid,
    });
  }

  return NextResponse.json({ error: "Unknown service" }, { status: 404 });
}
