/**
 * Generate Queries Job - Uses sourcing agent to generate CoStar query payloads.
 *
 * This job:
 * 1. Takes buyer criteria from a search
 * 2. Runs sourcing agent via the Agent HTTP Service
 * 3. Reads generated files from output/queries/
 * 4. Updates search with results
 * 5. Optionally queues costar-query jobs for each payload
 */

import PgBoss from "pg-boss";
import { pool } from "../db.js";
import { config } from "../config.js";
import { getAgentClient } from "../lib/agent-client.js";

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
  jobOrJobs: PgBoss.Job<GenerateQueriesJob> | PgBoss.Job<GenerateQueriesJob>[]
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

    // Run sourcing agent via HTTP service
    const result = await runSourcingAgent(criteriaJson, name);

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

    // Extraction is done via UI -> /api/searches/[id]/run-extraction

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
 * Run the sourcing agent via the Agent HTTP Service.
 * The agent writes files to output/queries/, which we then read.
 */
async function runSourcingAgent(
  criteriaJson: Record<string, unknown>,
  searchName: string
): Promise<SourcingAgentResult> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const client = getAgentClient();

  // Check if agent service is running
  const isAvailable = await client.isAvailable();
  if (!isAvailable) {
    throw new Error(
      `Agent service not available at ${config.agentServiceUrl}. ` +
      `Start it with: python orchestrator/service.py`
    );
  }

  // Sanitize name for filename
  const safeName = searchName.replace(/[^a-zA-Z0-9]/g, "_");
  const outputDir = path.join(config.python.projectRoot, "output", "queries");
  const payloadsFile = path.join(outputDir, `${safeName}_payloads.json`);
  const strategyFile = path.join(outputDir, `${safeName}_strategy.md`);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Delete old output files if they exist
  try {
    await fs.unlink(payloadsFile);
  } catch {
    /* ignore */
  }
  try {
    await fs.unlink(strategyFile);
  } catch {
    /* ignore */
  }

  // Write criteria to temp file for the agent
  const tempCriteriaFile = path.join(outputDir, `${safeName}_input.json`);
  await fs.writeFile(tempCriteriaFile, JSON.stringify(criteriaJson, null, 2));

  console.log(`[generate-queries] Invoking sourcing agent for: ${searchName}`);
  console.log(`[generate-queries] Criteria file: ${tempCriteriaFile}`);
  console.log(`[generate-queries] Agent service: ${config.agentServiceUrl}`);

  // Build the prompt for the sourcing agent
  const prompt = `Read the buyer criteria from: ${tempCriteriaFile} and generate CoStar query payloads.

Save payloads to: ${payloadsFile}
Save strategy to: ${strategyFile}

Use reference/costar/ for market ID lookups. DO NOT run extraction - just generate the files.`;

  // Run via HTTP service
  const result = await client.run({
    agent: "sourcing-agent",
    prompt,
    context: { criteria_type: criteriaJson.type },
    timeout: 300000, // 5 minutes
  });

  if (!result.success) {
    throw new Error(`Sourcing agent failed: ${result.error || "Unknown error"}`);
  }

  console.log(`[generate-queries] Agent completed, reading output files...`);

  // Read the output files
  let payloadsContent: string;
  try {
    payloadsContent = await fs.readFile(payloadsFile, "utf-8");
  } catch (err) {
    throw new Error(
      `Sourcing agent completed but payloads file not found: ${payloadsFile}. ` +
      `Agent output: ${result.output?.slice(0, 500)}`
    );
  }

  let payloadsData: { queries?: Array<{ name: string; payload: Record<string, unknown> }> };
  try {
    payloadsData = JSON.parse(payloadsContent);
  } catch (err) {
    throw new Error(`Failed to parse payloads JSON: ${err}`);
  }

  const queries = payloadsData.queries || [];
  if (queries.length === 0) {
    throw new Error(
      `Sourcing agent generated empty payloads. ` +
      `Agent output: ${result.output?.slice(0, 500)}`
    );
  }

  // Read strategy file
  let strategySummary = "";
  try {
    strategySummary = await fs.readFile(strategyFile, "utf-8");
  } catch {
    strategySummary = "Strategy file not generated";
  }

  console.log(`[generate-queries] Found ${queries.length} payloads`);

  return {
    strategy_summary: strategySummary,
    payloads: queries.map((q) => ({
      name: q.name,
      payload: q.payload,
    })),
  };
}
