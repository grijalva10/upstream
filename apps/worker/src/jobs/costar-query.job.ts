/**
 * CoStar Query Job - Executes CoStar queries with rate limiting and stealth.
 *
 * This job:
 * 1. Checks if within business hours (stealth)
 * 2. Checks CoStar service session status
 * 3. Runs CoStar query via HTTP service API
 * 4. Persists results to database
 * 5. Logs execution for audit
 */

import PgBoss from "pg-boss";
import { config } from "../config.js";
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

interface CoStarSessionStatus {
  status: "offline" | "starting" | "authenticating" | "connected" | "error";
  session_valid: boolean;
  expires_in_minutes: number;
  error?: string;
}

/**
 * Check if the CoStar service session is available and valid.
 */
async function checkCoStarSession(): Promise<CoStarSessionStatus> {
  try {
    const res = await fetch(`${config.costarServiceUrl}/status`);
    if (!res.ok) {
      return {
        status: "offline",
        session_valid: false,
        expires_in_minutes: 0,
        error: "CoStar service not responding",
      };
    }
    return (await res.json()) as CoStarSessionStatus;
  } catch (err) {
    return {
      status: "offline",
      session_valid: false,
      expires_in_minutes: 0,
      error: "CoStar service not running",
    };
  }
}

/**
 * Execute a CoStar query via the HTTP service.
 */
async function runCoStarQuery(
  queryType: string,
  payload: Record<string, unknown>,
  options: CoStarQueryJob["options"] = {}
): Promise<CoStarQueryResult> {
  const res = await fetch(`${config.costarServiceUrl}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query_type: queryType,
      payload,
      options: {
        max_properties: options.maxProperties,
        include_parcel: options.includeParcel,
      },
    }),
  });

  const data = (await res.json()) as CoStarQueryResult & { error?: string };

  if (!res.ok) {
    throw new Error(data.error || `Query failed with status ${res.status}`);
  }

  return data;
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

  // 2. Check CoStar service session
  const sessionStatus = await checkCoStarSession();
  if (sessionStatus.status === "offline") {
    console.log(`[costar-query] CoStar service not running`);
    return {
      success: false,
      error: "CoStar service not running. Start it with: python integrations/costar/service.py",
    };
  }

  if (!sessionStatus.session_valid) {
    console.log(`[costar-query] CoStar session not valid (status: ${sessionStatus.status})`);
    return {
      success: false,
      error: `CoStar session not valid. Go to Settings > CoStar to authenticate. Status: ${sessionStatus.status}`,
    };
  }

  console.log(`[costar-query] Session valid, expires in ${sessionStatus.expires_in_minutes} minutes`);

  // 3. Create extraction list if not provided
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

  // 4. Update status to extracting
  await updateExtractionListStatus(extractionListId, "extracting");

  try {
    // 5. Run the CoStar query via HTTP service
    console.log(`[costar-query] Running ${queryType} via CoStar service...`);
    const result = await runCoStarQuery(queryType, payload, options);

    if (result.error) {
      throw new Error(result.error);
    }

    // 6. Persist results
    if (queryType === "find_sellers" && result.contacts) {
      console.log(`[costar-query] Persisting ${result.contacts.length} contacts...`);
      const persistResult = await saveSellers(
        result.contacts,
        extractionListId,
        criteriaId
      );

      // 7. Update status
      await updateExtractionListStatus(extractionListId, "completed");

      // 8. Log execution
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
