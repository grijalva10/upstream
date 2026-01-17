import { NextResponse } from "next/server";
import { runBatch } from "@upstream/claude-cli";
import { resolve } from "path";

interface EntityContext {
  type: string | null;
  id: string | null;
  data: Record<string, unknown> | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedAction {
  type: string;
  label: string;
  data: Record<string, unknown>;
  confirmed: boolean;
}

interface ChatRequest {
  messages: ChatMessage[];
  context?: EntityContext;
}

function buildSystemPrompt(context?: EntityContext): string {
  let contextSection = "";

  if (context?.type && context?.data) {
    const data = context.data;
    switch (context.type) {
      case "contact":
        contextSection = `
Current Context - Contact:
- ID: ${context.id}
- Name: ${data.first_name || ""} ${data.last_name || ""} ${data.name || ""}
- Email: ${data.email || "N/A"}
- Phone: ${data.phone || "N/A"}
- Company: ${typeof data.company === "object" && data.company ? (data.company as Record<string, unknown>).name : "N/A"}
- Role: ${data.role || "N/A"}
- Type: ${data.type || "N/A"}
- Status: ${data.status || "N/A"}
`;
        break;
      case "company":
        contextSection = `
Current Context - Company:
- ID: ${context.id}
- Name: ${data.name || "N/A"}
- Status: ${data.status || "N/A"}
- Type: ${data.type || "N/A"}
`;
        break;
      case "email":
        contextSection = `
Current Context - Email:
- ID: ${context.id}
- From: ${data.from_name || ""} <${data.from_email || ""}>
- Subject: ${data.subject || "N/A"}
- Date: ${data.received_at || data.date || "N/A"}
- Classification: ${data.classification || "N/A"}
- Body Preview: ${typeof data.body === "string" ? data.body.slice(0, 500) : "N/A"}
`;
        break;
      case "search":
        contextSection = `
Current Context - Search:
- ID: ${context.id}
- Name: ${data.name || "N/A"}
- Status: ${data.status || "N/A"}
- Criteria: ${JSON.stringify(data.criteria_json || {}, null, 2)}
`;
        break;
      case "property":
        contextSection = `
Current Context - Property:
- ID: ${context.id}
- Address: ${data.address || "N/A"}
- City: ${data.city || "N/A"}
- State: ${data.state || "N/A"}
- Property Type: ${data.property_type || "N/A"}
- Building Size: ${data.building_size || "N/A"} sqft
- Year Built: ${data.year_built || "N/A"}
`;
        break;
      case "deal":
        contextSection = `
Current Context - Deal:
- ID: ${context.id}
- Status: ${data.status || "N/A"}
- Property: ${typeof data.property === "object" && data.property ? (data.property as Record<string, unknown>).address : "N/A"}
`;
        break;
    }
  }

  return `You are an AI assistant for Upstream, a CRE (Commercial Real Estate) deal sourcing tool. You help the operator (a commercial real estate broker) manage their deal pipeline.

${contextSection}

You can help with:
1. Creating contacts (sellers, buyers, brokers, team members)
2. Creating searches from buyer criteria
3. Drafting email replies
4. Scheduling calls
5. Updating deal/contact status
6. Answering questions about contacts, deals, properties
7. Parsing unstructured text (like forwarded notes) into structured data

When the user provides unstructured text (like pasted notes, forwarded emails, or verbal summaries), extract any structured data you can identify and suggest creating appropriate records.

IMPORTANT: When you want to suggest an action, include a JSON block at the end of your response in this exact format:

\`\`\`action
{
  "type": "create_contact" | "create_search" | "create_deal" | "send_email" | "create_task" | "update_contact" | "mark_dnc",
  "label": "Human readable action label",
  "data": { ... action-specific data ... }
}
\`\`\`

Action data formats:
- create_contact: { "first_name": "", "last_name": "", "email": "", "phone": "", "company_name": "", "role": "", "type": "seller|buyer|broker|team" }
- create_search: { "name": "", "property_type": "", "market": "", "budget": "", "criteria": {} }
- create_deal: { "property_id": "", "contact_id": "", "status": "" }
- send_email: { "to": "", "subject": "", "body": "" }
- create_task: { "title": "", "due_date": "", "contact_id": "" }
- update_contact: { "contact_id": "", "updates": {} }
- mark_dnc: { "contact_id": "", "reason": "" }

Always confirm before taking actions. Show what you'll create and let the user approve.

Be concise and professional. You're talking to an experienced CRE broker who values efficiency.`;
}

function buildPromptFromMessages(messages: ChatMessage[], systemPrompt: string): string {
  // Build a prompt that includes the conversation history
  let prompt = systemPrompt + "\n\n--- CONVERSATION HISTORY ---\n\n";

  for (const msg of messages.slice(0, -1)) {
    const role = msg.role === "user" ? "User" : "Assistant";
    prompt += `${role}: ${msg.content}\n\n`;
  }

  // Add the latest user message as the actual query
  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    prompt += `User: ${lastMessage.content}\n\nAssistant:`;
  }

  return prompt;
}

function parseAction(content: string): SuggestedAction | undefined {
  const actionMatch = content.match(/```action\s*([\s\S]*?)\s*```/);
  if (!actionMatch) return undefined;

  try {
    const actionData = JSON.parse(actionMatch[1].trim());
    return {
      type: actionData.type,
      label: actionData.label || actionData.type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
      data: actionData.data || {},
      confirmed: false,
    };
  } catch {
    return undefined;
  }
}

function cleanContent(content: string): string {
  // Remove the action block from the visible message
  return content.replace(/```action\s*[\s\S]*?```/g, "").trim();
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(context);
    const prompt = buildPromptFromMessages(messages, systemPrompt);

    // Use CLI for chat - simple single-turn with history in prompt
    const result = await runBatch({
      prompt,
      maxTurns: 1,
      timeout: 30000,
      cwd: resolve(process.cwd(), "../.."), // Project root
    });

    if (!result.success) {
      console.error("AI chat error:", result.error);
      return NextResponse.json(
        { error: "Failed to process chat request" },
        { status: 500 }
      );
    }

    const rawContent = result.output;

    // Parse action if present
    const action = parseAction(rawContent);
    const cleanedContent = cleanContent(rawContent);

    return NextResponse.json({
      message: cleanedContent,
      action,
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
