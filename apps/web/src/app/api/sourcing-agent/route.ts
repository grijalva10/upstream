import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    // Create output directory if it doesn't exist
    const timestamp = Date.now();
    const outputDir = path.join(
      process.cwd(),
      "..",
      "..",
      "output",
      "queries"
    );
    await mkdir(outputDir, { recursive: true });

    // Generate filename from buyer name if available
    const buyerName =
      criteria.buyer?.entityName ||
      criteria.buyer?.name ||
      `web_input_${timestamp}`;
    const safeFileName = buyerName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const criteriaFile = path.join(outputDir, `${safeFileName}_input.json`);

    // Save the criteria JSON
    await writeFile(criteriaFile, JSON.stringify(criteria, null, 2));

    return NextResponse.json({
      status: "submitted",
      message: `Criteria saved to ${criteriaFile}. Run the sourcing-agent in Claude Code to generate CoStar queries.`,
      file: criteriaFile,
    });
  } catch (error) {
    console.error("Sourcing agent error:", error);
    return NextResponse.json(
      { error: "Failed to process criteria" },
      { status: 500 }
    );
  }
}
