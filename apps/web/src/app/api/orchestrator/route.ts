import { NextRequest, NextResponse } from "next/server";
import { spawn, exec } from "child_process";
import { createAdminClient } from "@/lib/supabase/admin";
import path from "path";

// Store the process reference (in-memory, resets on server restart)
let orchestratorProcess: ReturnType<typeof spawn> | null = null;

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orchestrator_status")
    .select("*")
    .eq("id", "main")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if actually running (heartbeat within 60s)
  const lastHeartbeat = data?.last_heartbeat ? new Date(data.last_heartbeat) : null;
  const isActuallyRunning =
    data?.is_running &&
    lastHeartbeat &&
    Date.now() - lastHeartbeat.getTime() < 60 * 1000;

  return NextResponse.json({
    ...data,
    isActuallyRunning,
    processAttached: orchestratorProcess !== null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, dryRun = false, sendLoop = true, responseLoop = true } = body;

  if (action === "start") {
    // Check if already running
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orchestrator_status")
      .select("is_running, last_heartbeat")
      .eq("id", "main")
      .single();

    const lastHeartbeat = data?.last_heartbeat ? new Date(data.last_heartbeat) : null;
    const isRunning =
      data?.is_running &&
      lastHeartbeat &&
      Date.now() - lastHeartbeat.getTime() < 60 * 1000;

    if (isRunning) {
      return NextResponse.json({ error: "Orchestrator is already running" }, { status: 400 });
    }

    // Build command arguments
    const args = ["-m", "orchestrator.main"];
    if (dryRun) args.push("--dry-run");
    if (!sendLoop && responseLoop) args.push("--response-only");
    if (sendLoop && !responseLoop) args.push("--send-only");

    // Get the project root (go up from apps/web)
    const projectRoot = path.resolve(process.cwd(), "../..");

    try {
      // Spawn the orchestrator process
      orchestratorProcess = spawn("python", args, {
        cwd: projectRoot,
        detached: true,
        stdio: "ignore",
        shell: true,
      });

      orchestratorProcess.unref();

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      return NextResponse.json({
        success: true,
        message: "Orchestrator started",
        pid: orchestratorProcess.pid,
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (action === "stop") {
    const supabase = createAdminClient();

    // Get the PID from the database
    const { data } = await supabase
      .from("orchestrator_status")
      .select("pid, is_running")
      .eq("id", "main")
      .single();

    if (!data?.is_running || !data?.pid) {
      return NextResponse.json({ error: "Orchestrator is not running" }, { status: 400 });
    }

    try {
      // Kill the process by PID
      const isWindows = process.platform === "win32";
      const killCommand = isWindows
        ? `taskkill /PID ${data.pid} /F /T`
        : `kill -TERM ${data.pid}`;

      await new Promise<void>((resolve, reject) => {
        exec(killCommand, (error) => {
          if (error) {
            // Process might already be dead, that's ok
            console.log("Kill command result:", error.message);
          }
          resolve();
        });
      });

      // Update database to mark as stopped
      await supabase
        .from("orchestrator_status")
        .update({ is_running: false, updated_at: new Date().toISOString() })
        .eq("id", "main");

      orchestratorProcess = null;

      return NextResponse.json({
        success: true,
        message: "Orchestrator stopped",
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
