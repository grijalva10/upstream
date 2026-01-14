import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { criteria } = await request.json();

    // Validate criteria structure
    if (!criteria || typeof criteria !== "object") {
      return NextResponse.json(
        { error: "Invalid criteria JSON" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Extract buyer info
    const buyerName =
      criteria.buyer?.entityName ||
      criteria.buyer?.name ||
      "Unknown Buyer";
    const buyerEmail = criteria.buyer?.contact?.email || null;
    const buyerPhone = criteria.buyer?.contact?.phone || null;

    // Check if client already exists by name
    let clientId: string;
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("name", buyerName)
      .single();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: buyerName,
          company_name: criteria.buyer?.entityName || criteria.buyer?.name,
          email: buyerEmail,
          phone: buyerPhone,
          status: "active",
          notes: `Capital: ${criteria.buyer?.entity?.capital || criteria.buyer?.capitalAvailable || "N/A"}`,
        })
        .select("id")
        .single();

      if (clientError) {
        console.error("Error creating client:", clientError);
        return NextResponse.json(
          { error: "Failed to create client: " + clientError.message },
          { status: 500 }
        );
      }
      clientId = newClient.id;
    }

    // Create client_criteria record with status 'pending_queries'
    const criteriaName =
      criteria.criteria?.criteriaName ||
      criteria.criteria?.name ||
      `Search ${new Date().toLocaleDateString()}`;

    const { data: newCriteria, error: criteriaError } = await supabase
      .from("client_criteria")
      .insert({
        client_id: clientId,
        name: criteriaName,
        criteria_json: criteria,
        status: "pending_queries", // Waiting for sourcing agent to generate queries
      })
      .select("id")
      .single();

    if (criteriaError) {
      console.error("Error creating criteria:", criteriaError);
      return NextResponse.json(
        { error: "Failed to create criteria: " + criteriaError.message },
        { status: 500 }
      );
    }

    // Create agent_task to trigger sourcing agent
    const { error: taskError } = await supabase
      .from("agent_tasks")
      .insert({
        task_type: "generate_queries",
        priority: 7, // High priority
        status: "pending",
        criteria_id: newCriteria.id,
        input_data: {
          criteria_id: newCriteria.id,
          client_id: clientId,
          buyer_name: buyerName,
          criteria_name: criteriaName,
          criteria_json: criteria,
        },
      });

    if (taskError) {
      console.error("Error creating task:", taskError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({
      status: "submitted",
      message: `Created client "${buyerName}" and criteria "${criteriaName}". Sourcing agent task queued.`,
      clientId,
      criteriaId: newCriteria.id,
    });
  } catch (error) {
    console.error("Sourcing agent error:", error);
    return NextResponse.json(
      { error: "Failed to process criteria: " + (error as Error).message },
      { status: 500 }
    );
  }
}
