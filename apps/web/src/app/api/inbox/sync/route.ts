import { spawn } from "child_process";
import { NextResponse } from "next/server";
import path from "path";

export async function POST() {
  try {
    const projectRoot = path.resolve(process.cwd(), "../..");
    const scriptPath = path.join(projectRoot, "scripts", "sync_all_emails.py");

    // Spawn the sync process
    const child = spawn("python", [scriptPath], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Wait for process to complete (with timeout)
    const result = await Promise.race([
      new Promise<{ code: number | null }>((resolve) => {
        child.on("close", (code) => resolve({ code }));
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Sync timeout after 5 minutes")), 300000)
      ),
    ]);

    if (result.code !== 0) {
      return NextResponse.json(
        { error: "Sync failed", details: stderr || stdout },
        { status: 500 }
      );
    }

    // Parse output to extract counts
    const newMatch = stdout.match(/Total new emails: (\d+)/);
    const skippedMatch = stdout.match(/Total skipped.*: (\d+)/);

    return NextResponse.json({
      success: true,
      newEmails: newMatch ? parseInt(newMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      message: "Sync completed successfully",
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
