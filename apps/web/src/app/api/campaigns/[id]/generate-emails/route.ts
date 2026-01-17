import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBatch } from "@upstream/claude-cli";
import { resolve } from "path";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Campaign ID required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get campaign with search relationship
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select(`
        *,
        search:searches (
          id,
          name,
          criteria_json,
          strategy_summary
        )
      `)
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Can only generate emails for draft campaigns" },
        { status: 400 }
      );
    }

    if (!campaign.search) {
      return NextResponse.json(
        { error: "Campaign has no associated search" },
        { status: 400 }
      );
    }

    // Extract buyer context from criteria_json
    const criteriaJson = campaign.search.criteria_json as Record<string, unknown> || {};
    const buyer = criteriaJson.buyer as Record<string, unknown> || {};
    const buyerEntity = buyer.entity as Record<string, unknown> || {};
    const criteria = criteriaJson.criteria as Record<string, unknown> || criteriaJson;

    // Build the prompt for the agent
    const buyerContext = {
      dealsCompleted: buyerEntity.dealsCompleted || buyerEntity.deals_completed || 0,
      capital: buyerEntity.capital || 0,
      closeTimeline: buyerEntity.typicalCloseDays ? `${buyerEntity.typicalCloseDays} days` : "30 days",
      decisionMaker: buyerEntity.decisionMaker || "single",
      deadline: criteria.deadline || null,
      exchangeType: criteria.exchangeType || (criteria.deadline ? "1031" : null),
    };

    const searchContext = {
      markets: criteria.markets || criteria.targetMarkets || [],
      propertyTypes: criteria.propertyTypes || criteria.property_types || [],
      priceRange: criteria.priceRange || criteria.price || {},
      capRate: criteria.capRate || {},
      strategies: (criteria.strategies || []) as string[],
    };

    // Format the prompt
    const priceMin = (searchContext.priceRange as Record<string, number>)?.min;
    const priceMax = (searchContext.priceRange as Record<string, number>)?.max;
    const capRateMin = (searchContext.capRate as Record<string, number>)?.min;

    const criteriaDetails = [
      priceMin ? `$${(priceMin / 1000000).toFixed(0)}M+` : null,
      priceMax ? `up to $${(priceMax / 1000000).toFixed(0)}M` : null,
      capRateMin ? `${capRateMin}%+ cap` : null,
    ].filter(Boolean).join(", ");

    const prompt = `IMPORTANT: Output ONLY valid JSON. No markdown. No explanations.

STYLE: Write like a top producer texting a peer. Short, casual, professional. 3-5 sentences max (50-80 words per email).

Email bodies must:
- START with "{{FirstName}}," (NO "Hi", NO "Hello", NO "Dear")
- Use "my client" / "my buyer" / "they" voice - NOT "we" (broker represents buyer)
- Be SHORT: 3-5 sentences, 50-80 words max
- Include 2-3 buyer criteria specifics (price range, property type, etc.)
- END with signature (no "Best," or closings before it):

Jeff Grijalva
Lee & Associates | Newport Beach, CA
(949) 939-2654

Generate a 3-email sequence for:

Buyer Profile:
- Well-capitalized, experienced buyer
- Can close quickly, no financing contingency
- Single decision maker, no committees
${buyerContext.deadline ? `- 1031 exchange (use soft timeframe like "end of Q1" - NOT exact dates)` : ""}

Search Criteria:
- Markets: ${Array.isArray(searchContext.markets) ? searchContext.markets.join(", ") : "Not specified"}
- Property types: ${Array.isArray(searchContext.propertyTypes) ? searchContext.propertyTypes.join(", ") : "Not specified"}
- Price: ${criteriaDetails || "Not specified"}

EXAMPLE Email 1 (follow this style):
{{FirstName}},

Got a buyer looking for industrial in the IE - your building on {{PropertyAddress}} came up. They're targeting $5-15M, 1+ acres, and can close quick with no financing contingency.

Worth a conversation?

Jeff Grijalva
Lee & Associates | Newport Beach, CA
(949) 939-2654

Output JSON only:
{
  "emails": [
    {"step": 1, "subject": "...", "body": "{{FirstName}},\\n\\n[2-3 sentences + soft CTA]\\n\\nJeff Grijalva\\nLee & Associates | Newport Beach, CA\\n(949) 939-2654", "delay_days": 0},
    {"step": 2, "subject": "Re: ...", "body": "{{FirstName}},\\n\\n[2-3 sentences, different angle]\\n\\nJeff Grijalva\\nLee & Associates | Newport Beach, CA\\n(949) 939-2654", "delay_days": 4},
    {"step": 3, "subject": "...", "body": "{{FirstName}},\\n\\n[2-3 sentences, final touch]\\n\\nJeff Grijalva\\nLee & Associates | Newport Beach, CA\\n(949) 939-2654", "delay_days": 4}
  ]
}`;

    // Run via Claude CLI
    const result = await runBatch({
      prompt,
      maxTurns: 5,
      timeout: 120000,
      cwd: resolve(process.cwd(), "../.."), // Project root
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Agent execution failed",
        output: result.output || "",
      }, { status: 500 });
    }

    // Parse the agent output to extract JSON
    const output = result.output || "";
    let generatedEmails = null;

    // Extract JSON from output, handling markdown code blocks
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch
      ? jsonMatch[1].trim()
      : output.replace(/^```(?:json)?|```$/g, "").trim();

    try {
      generatedEmails = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse agent response:", output);
      return NextResponse.json(
        { error: "Failed to parse generated emails", raw: output },
        { status: 500 }
      );
    }

    if (!generatedEmails.emails && generatedEmails.sequence) {
      // Handle alternative format
      generatedEmails.emails = generatedEmails.sequence;
    }

    if (!generatedEmails.emails || !Array.isArray(generatedEmails.emails)) {
      return NextResponse.json(
        { error: "Invalid response format from agent", raw: generatedEmails },
        { status: 500 }
      );
    }

    // Map the generated emails to campaign fields
    type EmailEntry = { step?: number; email_number?: number; subject?: string; body?: string; delay_days?: number };
    const findEmail = (step: number): EmailEntry | undefined =>
      generatedEmails.emails.find((e: EmailEntry) => e.step === step || e.email_number === step) ||
      generatedEmails.emails[step - 1];

    const email1 = findEmail(1);
    const email2 = findEmail(2);
    const email3 = findEmail(3);

    // Update the campaign with generated emails
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("campaigns")
      .update({
        email_1_subject: email1?.subject || null,
        email_1_body: email1?.body || null,
        email_2_subject: email2?.subject || null,
        email_2_body: email2?.body || null,
        email_2_delay_days: email2?.delay_days ?? 4,
        email_3_subject: email3?.subject || null,
        email_3_body: email3?.body || null,
        email_3_delay_days: email3?.delay_days ?? 4,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error updating campaign:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      generated: generatedEmails,
    });
  } catch (error) {
    console.error("Generate emails error:", error);
    return NextResponse.json(
      { error: "Failed to generate emails" },
      { status: 500 }
    );
  }
}
