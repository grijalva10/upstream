/**
 * Generate Queries Job - Uses sourcing agent to generate CoStar query payloads.
 *
 * This job:
 * 1. Takes buyer criteria from a search
 * 2. Runs sourcing agent to generate strategy + payloads
 * 3. Updates search with results
 * 4. Queues costar-query jobs for each payload
 */

import PgBoss from "pg-boss";
import { pool } from "../db.js";
import { config } from "../config.js";

export interface GenerateQueriesJob {
  searchId: string;
  name: string;
  source: string;
  criteriaJson: Record<string, unknown>;
}

interface SourcingAgentResult {
  strategy_summary: string;
  payloads: Array<{
    name: string;
    payload: Record<string, unknown>;
  }>;
}

/**
 * Handle a generate-queries job.
 */
export async function handleGenerateQueries(
  jobOrJobs: PgBoss.Job<GenerateQueriesJob> | PgBoss.Job<GenerateQueriesJob>[],
  boss: PgBoss
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  // pg-boss may pass a single job or an array - normalize it
  const job = Array.isArray(jobOrJobs) ? jobOrJobs[0] : jobOrJobs;

  if (!job) {
    console.error(`[generate-queries] No job received`);
    return { success: false, error: "No job received" };
  }

  console.log(`[generate-queries] Job ID: ${job.id}, has data: ${!!job.data}`);

  // Handle case where job.data might be undefined
  if (!job.data) {
    console.error(`[generate-queries] job.data is undefined. Job ID: ${job.id}`);
    return { success: false, error: "Job data is undefined" };
  }

  const { searchId, name, criteriaJson } = job.data;

  if (!searchId) {
    console.error(`[generate-queries] searchId is missing from job data`);
    return { success: false, error: "searchId is missing" };
  }

  console.log(`[generate-queries] Starting for search: ${name} (${searchId})`);

  try {
    // Update search status to generating
    await pool.query(
      `UPDATE searches SET status = 'generating_queries', updated_at = NOW() WHERE id = $1`,
      [searchId]
    );

    // TODO: Run sourcing agent via Claude Code CLI
    // For now, create a stub implementation
    const result = await runSourcingAgent(criteriaJson);

    // Update search with results
    await pool.query(
      `UPDATE searches
       SET strategy_summary = $1,
           payloads_json = $2,
           status = 'pending_extraction',
           updated_at = NOW()
       WHERE id = $3`,
      [result.strategy_summary, JSON.stringify(result.payloads), searchId]
    );

    console.log(
      `[generate-queries] Generated ${result.payloads.length} payloads for search ${searchId}`
    );

    // Queue costar-query jobs for each payload (if auto-execute is enabled)
    if (config.autoExecuteQueries) {
      for (let i = 0; i < result.payloads.length; i++) {
        const payload = result.payloads[i];
        await boss.send("costar-query", {
          queryType: "find_sellers",
          criteriaId: searchId,
          queryName: payload.name,
          queryIndex: i,
          payload: payload.payload,
          options: {
            maxProperties: 100,
          },
        });
        console.log(`[generate-queries] Queued costar-query: ${payload.name}`);
      }
    }

    return {
      success: true,
      result: {
        payloadsGenerated: result.payloads.length,
        strategySummary: result.strategy_summary,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[generate-queries] Failed: ${errorMsg}`);

    // Update search status to failed
    await pool.query(
      `UPDATE searches SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [searchId]
    );

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Run the sourcing agent to generate query payloads.
 *
 * TODO: Implement actual Claude Code CLI call:
 * ```
 * claude -p "@sourcing-agent <criteria>" --output-format json
 * ```
 */
async function runSourcingAgent(
  criteriaJson: Record<string, unknown>
): Promise<SourcingAgentResult> {
  // Stub implementation - generates basic payloads from criteria
  const criteria = criteriaJson as {
    target_markets?: string[];
    property_types?: string[];
    size_range?: { min?: number; max?: number };
    price_range?: { min?: number; max?: number };
  };

  const markets = criteria.target_markets || ["Phoenix"];
  const propertyTypes = criteria.property_types || ["Industrial"];

  // Generate a basic strategy summary
  const strategySummary = `
## Sourcing Strategy for ${markets.join(", ")}

### Target Profile
- Property Types: ${propertyTypes.join(", ")}
- Size Range: ${criteria.size_range?.min || "Any"} - ${criteria.size_range?.max || "Any"} SF
- Price Range: $${(criteria.price_range?.min || 0).toLocaleString()} - $${(criteria.price_range?.max || 10000000).toLocaleString()}

### Query Approach
Generated ${markets.length} market-based queries to identify potential sellers.

### Notes
- Stub implementation - real sourcing agent will provide more detailed analysis
- Auto-execution is ${config.autoExecuteQueries ? "enabled" : "disabled"}
  `.trim();

  // Generate basic payloads (one per market)
  const payloads = markets.map((market) => ({
    name: `${market} ${propertyTypes[0] || "Properties"}`,
    payload: {
      PropertyCriteria: {
        Property: {
          Building: {
            PropertyType: propertyTypes.map((t) => getPropertyTypeId(t)),
          },
        },
        GeographyCriteria: {
          Markets: [getMarketId(market)],
        },
      },
    },
  }));

  return {
    strategy_summary: strategySummary,
    payloads,
  };
}

// Stub ID lookups - real implementation uses reference/costar/
function getPropertyTypeId(type: string): number {
  const map: Record<string, number> = {
    Industrial: 1,
    Office: 2,
    Retail: 3,
    Multifamily: 4,
  };
  return map[type] || 1;
}

function getMarketId(market: string): number {
  const map: Record<string, number> = {
    Phoenix: 47,
    "Los Angeles": 31,
    Dallas: 15,
  };
  return map[market] || 47;
}
