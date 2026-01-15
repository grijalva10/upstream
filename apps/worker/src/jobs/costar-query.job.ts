/**
 * CoStar Query Job - Executes CoStar queries with rate limiting and stealth.
 *
 * This job:
 * 1. Checks if within business hours (stealth)
 * 2. Checks rate limits
 * 3. Runs CoStar query via Python subprocess
 * 4. Persists results to database
 * 5. Logs execution for audit
 */

import { spawn } from "child_process";
import path from "path";
import PgBoss from "pg-boss";
import { config } from "../config.js";
import { isWithinSendWindow } from "../lib/send-window.js";
import {
  saveSellers,
  createExtractionList,
  updateExtractionListStatus,
  logQueryExecution,
  SellerContact,
} from "../lib/costar-persist.js";

export interface CoStarQueryJob {
  queryType: "find_sellers" | "find_buyers" | "market_analytics";
  criteriaId: string;
  extractionListId?: string;
  queryName: string;
  queryIndex: number;
  payload: Record<string, unknown>;
  options?: {
    maxProperties?: number;
    includeParcel?: boolean;
    headless?: boolean;
  };
}

interface CoStarQueryResult {
  contacts?: SellerContact[];
  error?: string;
  propertiesProcessed?: number;
}

/**
 * Execute a Python CoStar query script and return JSON result.
 */
async function runPythonQuery(
  queryType: string,
  payload: Record<string, unknown>,
  options: CoStarQueryJob["options"] = {}
): Promise<CoStarQueryResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      config.python.scriptsDir,
      "..",
      "integrations",
      "costar",
      "run_query.py"
    );

    const args = [
      scriptPath,
      "--query-type",
      queryType,
      "--payload",
      JSON.stringify(payload),
    ];

    if (options.maxProperties) {
      args.push("--max-properties", String(options.maxProperties));
    }
    if (options.includeParcel) {
      args.push("--include-parcel");
    }
    if (options.headless === false) {
      args.push("--no-headless");
    }

    const proc = spawn("python", args, {
      cwd: path.join(config.python.scriptsDir, ".."),
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
      // Log stderr in real-time for debugging
      if (config.debug) {
        console.log(`[costar] ${data.toString().trim()}`);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Find the JSON output (last line or marked section)
        const lines = stdout.trim().split("\n");
        const jsonLine = lines[lines.length - 1];
        const result = JSON.parse(jsonLine);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

/**
 * Handle a CoStar query job.
 */
export async function handleCoStarQuery(
  job: PgBoss.Job<CoStarQueryJob>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const {
    queryType,
    criteriaId,
    queryName,
    queryIndex,
    payload,
    options = {},
  } = job.data;
  let { extractionListId } = job.data;

  const startTime = Date.now();

  console.log(`[costar-query] Starting ${queryType}: ${queryName}`);

  // 1. Check business hours (stealth - only run during work hours)
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHours = hour >= 9 && hour < 18;

  if (!isWeekday || !isBusinessHours) {
    // Reschedule for next business day/hour
    const nextRun = getNextBusinessHour();
    console.log(`[costar-query] Outside business hours, rescheduling to ${nextRun.toISOString()}`);
    return {
      success: false,
      error: `Rescheduled to ${nextRun.toISOString()} (business hours only)`,
    };
  }

  // 2. Create extraction list if not provided
  if (!extractionListId) {
    try {
      extractionListId = await createExtractionList(
        criteriaId,
        queryName,
        queryIndex,
        payload
      );
      console.log(`[costar-query] Created extraction list: ${extractionListId}`);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  // 3. Update status to extracting
  await updateExtractionListStatus(extractionListId, "extracting");

  try {
    // 4. Run the Python query
    console.log(`[costar-query] Running Python ${queryType}...`);
    const result = await runPythonQuery(queryType, payload, options);

    if (result.error) {
      throw new Error(result.error);
    }

    // 5. Persist results
    if (queryType === "find_sellers" && result.contacts) {
      console.log(`[costar-query] Persisting ${result.contacts.length} contacts...`);
      const persistResult = await saveSellers(
        result.contacts,
        extractionListId,
        criteriaId
      );

      // 6. Update status
      await updateExtractionListStatus(extractionListId, "completed");

      // 7. Log execution
      const durationMs = Date.now() - startTime;
      await logQueryExecution(
        queryType,
        criteriaId,
        {
          contacts: persistResult.contacts,
          properties: persistResult.properties,
          companies: persistResult.companies,
          loans: persistResult.loans,
          errors: persistResult.errors.length,
        },
        durationMs
      );

      console.log(
        `[costar-query] Complete: ${persistResult.properties} properties, ` +
          `${persistResult.contacts} contacts in ${durationMs}ms`
      );

      return {
        success: true,
        result: persistResult,
      };
    }

    // For other query types (future)
    return {
      success: true,
      result,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[costar-query] Failed: ${errorMsg}`);

    await updateExtractionListStatus(extractionListId, "failed", errorMsg);

    const durationMs = Date.now() - startTime;
    await logQueryExecution(queryType, criteriaId, { error: errorMsg }, durationMs, "failed");

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Get the next business hour datetime.
 */
function getNextBusinessHour(): Date {
  const now = new Date();
  const result = new Date(now);

  // If it's after 6pm, move to next day
  if (now.getHours() >= 18) {
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
  }
  // If it's before 9am, set to 9am
  else if (now.getHours() < 9) {
    result.setHours(9, 0, 0, 0);
  }

  // Skip weekends
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}
