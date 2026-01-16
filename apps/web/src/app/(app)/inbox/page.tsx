import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import {
  parseInboxMessages,
  inboxFiltersSchema,
  expandClassificationFilter,
  type InboxFilters,
  type InboxMessage,
  type Status,
  type Classification,
  type ViewMode,
  type InboxCounts,
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
    viewMode: searchParams.viewMode,
    status: searchParams.status,
    classification: searchParams.classification,
    search: searchParams.search,
    page: searchParams.page,
    limit: searchParams.limit,
  };

  const parsed = inboxFiltersSchema.safeParse(rawFilters);
  const filters = parsed.success ? parsed.data : inboxFiltersSchema.parse({});

  const supabase = await createClient();

  // Query from inbox_view (includes all joined data: contact, company, property, deal, draft)
  let query = supabase
    .from("inbox_view")
    .select("*", { count: "exact" })
    .order("received_at", { ascending: false });

  // Apply view mode filter (default: needs_review)
  if (filters.viewMode === "needs_review") {
    query = query.eq("needs_review", true);
  } else if (filters.viewMode === "auto_handled") {
    query = query.eq("auto_handled", true);
  }
  // "all" mode shows everything (no filter)

  // Apply status filter
  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  // Apply classification filter (supports groups like "hot" or individual like "hot_interested")
  const classifications = expandClassificationFilter(filters.classification);
  if (classifications) {
    if (classifications.includes("unclear")) {
      // Include both null and 'unclear' as unclassified
      const others = classifications.filter(c => c !== "unclear");
      if (others.length > 0) {
        query = query.or(`classification.is.null,classification.in.(${classifications.join(",")})`);
      } else {
        query = query.or("classification.is.null,classification.eq.unclear");
      }
    } else if (classifications.length === 1) {
      query = query.eq("classification", classifications[0]);
    } else {
      query = query.in("classification", classifications);
    }
  }

  // Apply search filter
  if (filters.search) {
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
async function getInboxCounts(): Promise<InboxCounts> {
  const supabase = await createClient();

  // Get all inbound emails for counting
  const { data, error } = await supabase
    .from("synced_emails")
    .select("status, classification, needs_review, auto_handled")
    .eq("direction", "inbound");

  if (error || !data) {
    return {
      byViewMode: { needs_review: 0, auto_handled: 0, all: 0 },
      byStatus: { all: 0, new: 0, reviewed: 0, actioned: 0 },
      byClassification: { all: 0 } as Record<Classification | "all", number>,
    };
  }

  // Count by view mode
  const byViewMode: Record<ViewMode, number> = {
    needs_review: 0,
    auto_handled: 0,
    all: data.length,
  };

  // Count by status
  const byStatus: Record<string, number> = { all: data.length, new: 0, reviewed: 0, actioned: 0 };

  // Count by classification
  const byClassification: Record<string, number> = { all: data.length };

  for (const row of data) {
    // View mode counts
    if (row.needs_review) byViewMode.needs_review++;
    if (row.auto_handled) byViewMode.auto_handled++;

    // Status counts
    if (row.status) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    }

    // Classification counts
    const classification = row.classification || "unclear";
    byClassification[classification] = (byClassification[classification] || 0) + 1;
  }

  return {
    byViewMode,
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
