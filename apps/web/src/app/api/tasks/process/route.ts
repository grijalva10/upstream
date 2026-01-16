import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Task Processor API
 *
 * This endpoint fetches and processes pending agent tasks.
 * In production, this would be called by:
 * - A cron job
 * - An n8n workflow
 * - The orchestrator service
 *
 * For now, it can be called manually to process the next pending task.
 */

interface AgentTask {
  id: string;
  task_type: string;
  priority: number;
  status: string;
  input_data: Record<string, unknown>;
  created_at: string;
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json().catch(() => ({}));
    const { task_type, limit = 1 } = body;

    // Build query for pending tasks
    let query = supabase
      .from("agent_tasks")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);

    // Optionally filter by task type
    if (task_type) {
      query = query.eq("task_type", task_type);
    }

    const { data: tasks, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching tasks:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch pending tasks" },
        { status: 500 }
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        status: "no_tasks",
        message: "No pending tasks found",
      });
    }

    const results = [];

    for (const task of tasks as AgentTask[]) {
      // Mark task as running
      await supabase
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task.id);

      try {
        let result;

        switch (task.task_type) {
          case "generate_queries":
            result = await processGenerateQueries(supabase, task);
            break;
          case "run_extraction":
            result = await processRunExtraction(supabase, task);
            break;
          default:
            result = {
              success: false,
              error: `Unknown task type: ${task.task_type}`,
            };
        }

        // Update task status based on result
        await supabase
          .from("agent_tasks")
          .update({
            status: result.success ? "completed" : "failed",
            completed_at: new Date().toISOString(),
            output_data: result,
          })
          .eq("id", task.id);

        results.push({
          task_id: task.id,
          task_type: task.task_type,
          ...result,
        });
      } catch (taskError) {
        // Mark task as failed
        await supabase
          .from("agent_tasks")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            output_data: { error: (taskError as Error).message },
          })
          .eq("id", task.id);

        results.push({
          task_id: task.id,
          task_type: task.task_type,
          success: false,
          error: (taskError as Error).message,
        });
      }
    }

    return NextResponse.json({
      status: "processed",
      tasks_processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Task processor error:", error);
    return NextResponse.json(
      { error: "Failed to process tasks: " + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Process generate_queries task
 *
 * This task type is for invoking the sourcing agent to generate CoStar queries.
 * In a real setup, this would:
 * 1. Call the Claude API with the sourcing-agent prompt
 * 2. Parse the generated queries and strategy
 * 3. Update the search record
 */
async function processGenerateQueries(
  supabase: ReturnType<typeof createAdminClient>,
  task: AgentTask
): Promise<{ success: boolean; message?: string; error?: string }> {
  const searchId = task.input_data?.search_id as string;

  if (!searchId) {
    return { success: false, error: "No search_id in task" };
  }

  // In production, this is where you would:
  // 1. Invoke the sourcing agent via Claude API
  // 2. Parse the response for payloads_json and strategy_summary
  // 3. Update the search record

  // For now, we'll just update the status to show the flow works
  // The actual agent invocation would be done by n8n or an orchestrator

  const { error: updateError } = await supabase
    .from("searches")
    .update({
      status: "pending_approval",
      // In production, these would come from the agent:
      // payloads_json: agentResponse.queries,
      // strategy_summary: agentResponse.strategy,
    })
    .eq("id", searchId);

  if (updateError) {
    return {
      success: false,
      error: `Failed to update search: ${updateError.message}`,
    };
  }

  return {
    success: true,
    message: `Search ${searchId} marked as pending_approval. Run sourcing agent to generate queries.`,
  };
}

/**
 * Process run_extraction task
 *
 * This task runs the CoStar extraction for approved searches.
 * In production, this would invoke the extraction via the CoStar service.
 */
async function processRunExtraction(
  supabase: ReturnType<typeof createAdminClient>,
  task: AgentTask
): Promise<{ success: boolean; message?: string; error?: string }> {
  const searchId = task.input_data?.search_id as string;

  if (!searchId) {
    return { success: false, error: "No search_id in task" };
  }

  // Get the search with payloads
  const { data: search, error: fetchError } = await supabase
    .from("searches")
    .select("id, name, payloads_json, status")
    .eq("id", searchId)
    .single();

  if (fetchError || !search) {
    return { success: false, error: "Search not found" };
  }

  if (!search.payloads_json) {
    return { success: false, error: "No payloads_json in search - run sourcing agent first" };
  }

  // Update status to extracting
  const { error: updateError } = await supabase
    .from("searches")
    .update({ status: "extracting" })
    .eq("id", searchId);

  if (updateError) {
    return {
      success: false,
      error: `Failed to update search status: ${updateError.message}`,
    };
  }

  // In production, this would call:
  // POST /api/searches/[id]/run-extraction
  // which talks to the CoStar service

  return {
    success: true,
    message: `Extraction started for search ${searchId}. Call POST /api/searches/${searchId}/run-extraction to run.`,
  };
}

/**
 * GET endpoint to view pending tasks
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: tasks, error } = await supabase
      .from("agent_tasks")
      .select(`
        id,
        task_type,
        priority,
        status,
        input_data,
        created_at,
        started_at,
        completed_at
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pending = tasks?.filter((t) => t.status === "pending") || [];
    const running = tasks?.filter((t) => t.status === "running") || [];
    const completed = tasks?.filter((t) => t.status === "completed") || [];
    const failed = tasks?.filter((t) => t.status === "failed") || [];

    return NextResponse.json({
      summary: {
        pending: pending.length,
        running: running.length,
        completed: completed.length,
        failed: failed.length,
      },
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
