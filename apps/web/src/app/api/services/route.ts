import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "unknown";
  pid?: number;
  port?: number;
  uptime?: string;
}

async function checkPort(port: number): Promise<number | null> {
  try {
    // Use netstat which is more reliable across Windows versions
    const { stdout } = await execAsync(
      `netstat -ano | findstr ":${port}" | findstr "LISTENING"`
    );
    // Parse the PID from the last column
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

async function getProcessUptime(pid: number): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `powershell -Command "$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $ts = (Get-Date) - $p.StartTime; '{0}h {1}m' -f [int]$ts.TotalHours, $ts.Minutes }"`
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const services: ServiceStatus[] = [];

  // Check CoStar service (port 8765)
  const costarPid = await checkPort(8765);
  services.push({
    name: "costar",
    status: costarPid ? "running" : "stopped",
    pid: costarPid || undefined,
    port: 8765,
    uptime: costarPid ? (await getProcessUptime(costarPid)) || undefined : undefined,
  });

  // Check Worker (we'll check by looking for node process with "worker" in path)
  try {
    const { stdout } = await execAsync(
      `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'node.exe'\\" | Where-Object { $_.CommandLine -match 'apps.worker' } | Select-Object ProcessId -First 1 | ForEach-Object { $_.ProcessId }"`
    );
    const workerPid = parseInt(stdout.trim());
    services.push({
      name: "worker",
      status: !isNaN(workerPid) ? "running" : "stopped",
      pid: !isNaN(workerPid) ? workerPid : undefined,
      uptime: !isNaN(workerPid) ? (await getProcessUptime(workerPid)) || undefined : undefined,
    });
  } catch {
    services.push({
      name: "worker",
      status: "stopped",
    });
  }

  // Check Web App (port 3000) - informational only
  const webPid = await checkPort(3000);
  services.push({
    name: "web",
    status: webPid ? "running" : "stopped",
    pid: webPid || undefined,
    port: 3000,
    uptime: webPid ? (await getProcessUptime(webPid)) || undefined : undefined,
  });

  return NextResponse.json({ services });
}
