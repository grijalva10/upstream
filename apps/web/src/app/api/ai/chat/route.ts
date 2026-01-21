import { createSSEStream } from "@upstream/claude-cli";
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

You have full access to tools - you can read files, query the database, run commands, and take actions. Use them freely to help the user.

You can help with:
1. Querying the database for contacts, leads, properties, searches
2. Creating and updating records
3. Drafting emails and messages
4. Analyzing deal data
5. Running searches and generating reports
6. Any other task the operator needs

Be concise and professional. You're talking to an experienced CRE broker who values efficiency.`;
}

function buildPromptFromMessages(messages: ChatMessage[], systemPrompt: string): string {
  let prompt = systemPrompt + "\n\n--- CONVERSATION HISTORY ---\n\n";

  for (const msg of messages.slice(0, -1)) {
    const role = msg.role === "user" ? "User" : "Assistant";
    prompt += `${role}: ${msg.content}\n\n`;
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage) {
    prompt += `User: ${lastMessage.content}\n\nAssistant:`;
  }

  return prompt;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, context } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(context);
    const prompt = buildPromptFromMessages(messages, systemPrompt);

    // Create SSE stream with full agentic capabilities
    const stream = createSSEStream({
      prompt,
      maxTurns: 50,
      timeout: 300000, // 5 minutes
      cwd: resolve(process.cwd(), "../.."),
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
