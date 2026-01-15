import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  campaignIdSchema,
  listEnrollmentsSchema,
  formatZodError,
} from "@/app/(app)/campaigns/_lib/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const idParsed = campaignIdSchema.safeParse({ id });
    if (!idParsed.success) {
      return NextResponse.json(
        { error: formatZodError(idParsed.error) },
        { status: 400 }
      );
    }

    const queryParsed = listEnrollmentsSchema.safeParse({
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      search: searchParams.get("search") || undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        { error: formatZodError(queryParsed.error) },
        { status: 400 }
      );
    }

    const { status, page, limit, search } = queryParsed.data;
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    // Build query
    let query = supabase
      .from("enrollments")
      .select(`
        *,
        contact:contacts (id, first_name, last_name, email, company_id),
        property:properties (id, address, city, state)
      `, { count: "exact" })
      .eq("campaign_id", idParsed.data.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    // Note: search filter on contact/property would require more complex query
    // For now, we'll do client-side filtering or skip

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching enrollments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: data ?? [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error("List enrollments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollments" },
      { status: 500 }
    );
  }
}
