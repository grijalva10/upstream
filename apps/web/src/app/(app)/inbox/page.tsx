import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import {
  parseInboxMessages,
  inboxFiltersSchema,
  type InboxFilters,
  type InboxMessage,
  type Status,
  type Classification,
} from "@/lib/inbox/schemas";
import { InboxShell } from "./_components/inbox-shell";
import { InboxSkeleton } from "./_components/inbox-skeleton";

// =============================================================================
// Data Fetching
// =============================================================================

interface InboxData {
  messages: InboxMessage[];
  total: number;
  filters: InboxFilters;
}

async function getInboxData(searchParams: Record<string, string | string[] | undefined>): Promise<InboxData> {
  // Parse and validate filters
  const rawFilters = {
    status: searchParams.status,
    classification: searchParams.classification,
    search: searchParams.search,
    page: searchParams.page,
    limit: searchParams.limit,
  };

  const parsed = inboxFiltersSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : inboxFiltersSchema.parse({});

  const supabase = await createClient();

  // Build query with server-side filtering
  let query = supabase
    .from("synced_emails")
    .select(
      `
      *,
      contact:matched_contact_id(name, email),
      property:matched_property_id(address, property_name),
      enrollment:enrollment_id(campaign_id)
    `,
      { count: "exact" }
    )
    .eq("direction", "inbound")
    .order("received_at", { ascending: false });

  // Apply filters
  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.classification !== "all") {
    if (filters.classification === "unclear") {
      query = query.is("classification", null);
    } else {
      query = query.eq("classification", filters.classification);
    }
  }

  if (filters.search) {
    // Search across multiple fields using OR
    query = query.or(
      `from_email.ilike.%${filters.search}%,from_name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`
    );
  }

  // Pagination
  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching inbox messages:", error);
    return { messages: [], total: 0, filters };
  }

  // Validate and parse messages
  const messages = parseInboxMessages(data);

  return {
    messages,
    total: count || 0,
    filters,
  };
}

// Fetch counts separately for sidebar (not affected by current filters)
async function getInboxCounts(): Promise<{
  byStatus: Record<Status | "all", number>;
  byClassification: Record<Classification | "all", number>;
}> {
  const supabase = await createClient();

  // Get all inbound messages for counting (just ids and relevant fields)
  const { data, error } = await supabase
    .from("synced_emails")
    .select("status, classification")
    .eq("direction", "inbound");

  if (error || !data) {
    return {
      byStatus: { all: 0, new: 0, reviewed: 0, actioned: 0 },
      byClassification: { all: 0 } as Record<Classification | "all", number>,
    };
  }

  const byStatus: Record<string, number> = { all: data.length, new: 0, reviewed: 0, actioned: 0 };
  const byClassification: Record<string, number> = { all: data.length };

  for (const row of data) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    const classification = row.classification || "unclear";
    byClassification[classification] = (byClassification[classification] || 0) + 1;
  }

  return {
    byStatus: byStatus as Record<Status | "all", number>,
    byClassification: byClassification as Record<Classification | "all", number>,
  };
}

// =============================================================================
// Page Component
// =============================================================================

interface InboxPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = await searchParams;

  return (
    <PageSetup>
      <PageContainer variant="full-bleed">
        <Suspense fallback={<InboxSkeleton />}>
          <InboxContent searchParams={params} />
        </Suspense>
      </PageContainer>
    </PageSetup>
  );
}

async function InboxContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [data, counts] = await Promise.all([
    getInboxData(searchParams),
    getInboxCounts(),
  ]);

  return (
    <InboxShell
      messages={data.messages}
      total={data.total}
      filters={data.filters}
      counts={counts}
    />
  );
}
