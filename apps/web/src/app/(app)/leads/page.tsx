import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { Pagination } from "./_components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/ui/status-dot";
import { StatValue } from "@/components/ui/stat-value";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SortField = "name" | "status" | "lead_type" | "created_at" | "last_activity";
type SortDir = "asc" | "desc";

const LEAD_STATUSES = [
  "new", "contacted", "replied", "engaged",
  "waiting", "qualified", "handed_off", "nurture", "closed"
] as const;
type LeadStatus = typeof LEAD_STATUSES[number];

interface Lead {
  id: string;
  name: string;
  status: string;
  lead_type: string;
  source: string | null;
  created_at: string;
  contacts: { id: string; name: string; email: string | null }[];
  property_count: number;
  last_activity_at: string | null;
}

const PAGE_SIZE = 25;

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? "just now" : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

async function getLeads(
  page: number,
  sortField: SortField = "created_at",
  sortDir: SortDir = "desc",
  statusFilter?: LeadStatus
): Promise<{ data: Lead[]; count: number }> {
  const supabase = createAdminClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Map sort field to actual column (last_activity handled separately)
  const dbSortField = sortField === "last_activity" ? "created_at" : sortField;

  let query = supabase
    .from("leads")
    .select(
      `
      id,
      name,
      status,
      lead_type,
      source,
      created_at,
      contacts (id, name, email),
      property_leads (property_id)
    `,
      { count: "exact" }
    );

  // Apply status filter if provided
  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, count, error } = await query
    .order(dbSortField, { ascending: sortDir === "asc" })
    .range(from, to);

  if (error) {
    console.error("Failed to fetch leads:", error);
    return { data: [], count: 0 };
  }

  // Get last activity for these leads (most recent email or activity)
  const leadIds = data?.map((l: any) => l.id) || [];
  const lastActivityMap = new Map<string, string>();

  if (leadIds.length > 0) {
    // Get latest email per lead
    const { data: emails } = await supabase
      .from("synced_emails")
      .select("matched_lead_id, received_at")
      .in("matched_lead_id", leadIds)
      .order("received_at", { ascending: false });

    // Get latest activity per lead
    const { data: activities } = await supabase
      .from("activities")
      .select("lead_id, activity_at")
      .in("lead_id", leadIds)
      .order("activity_at", { ascending: false });

    // Build map of lead_id -> latest timestamp
    emails?.forEach((e: any) => {
      if (e.matched_lead_id && e.received_at) {
        const existing = lastActivityMap.get(e.matched_lead_id);
        if (!existing || new Date(e.received_at) > new Date(existing)) {
          lastActivityMap.set(e.matched_lead_id, e.received_at);
        }
      }
    });

    activities?.forEach((a: any) => {
      if (a.lead_id && a.activity_at) {
        const existing = lastActivityMap.get(a.lead_id);
        if (!existing || new Date(a.activity_at) > new Date(existing)) {
          lastActivityMap.set(a.lead_id, a.activity_at);
        }
      }
    });
  }

  let leads =
    data?.map((lead: any) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      lead_type: lead.lead_type,
      source: lead.source,
      created_at: lead.created_at,
      contacts: lead.contacts || [],
      property_count: lead.property_leads?.length || 0,
      last_activity_at: lastActivityMap.get(lead.id) || null,
    })) || [];

  // Sort by last_activity if requested (can't do in DB query)
  if (sortField === "last_activity") {
    leads = leads.sort((a, b) => {
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    });
  }

  return { data: leads, count: count ?? 0 };
}


interface PageProps {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string; status?: string }>;
}

const VALID_SORT_FIELDS: SortField[] = ["name", "status", "lead_type", "created_at", "last_activity"];

function buildUrl(params: { sort: string; dir: string; status?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  searchParams.set("sort", params.sort);
  searchParams.set("dir", params.dir);
  if (params.status) searchParams.set("status", params.status);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  return `?${searchParams.toString()}`;
}

interface SortableHeaderProps {
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  currentStatus?: LeadStatus;
  children: React.ReactNode;
}

function SortableHeader({ field, currentSort, currentDir, currentStatus, children }: SortableHeaderProps) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  const href = buildUrl({ sort: field, dir: nextDir, status: currentStatus });

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground"
      )}
    >
      {children}
      {isActive ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </Link>
  );
}

interface StatusFilterProps {
  currentStatus?: LeadStatus;
  sortField: string;
  sortDir: string;
}

function StatusFilter({ currentStatus, sortField, sortDir }: StatusFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-muted-foreground">
        Status
        {currentStatus && (
          <StatusDot status={currentStatus} showLabel className="ml-1" />
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <Link href={buildUrl({ sort: sortField, dir: sortDir })} className="flex items-center justify-between">
            All
            {!currentStatus && <Check className="h-4 w-4" />}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {LEAD_STATUSES.map((status) => (
          <DropdownMenuItem key={status} asChild>
            <Link
              href={buildUrl({ sort: sortField, dir: sortDir, status })}
              className="flex items-center justify-between gap-4"
            >
              <StatusDot status={status} showLabel />
              {currentStatus === status && <Check className="h-4 w-4" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sortField: SortField = VALID_SORT_FIELDS.includes(params.sort as SortField)
    ? (params.sort as SortField)
    : "last_activity";
  const sortDir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const statusFilter: LeadStatus | undefined = LEAD_STATUSES.includes(params.status as LeadStatus)
    ? (params.status as LeadStatus)
    : undefined;

  // Reset to page 1 when filter changes (or if page is invalid)
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));

  const { data: leads, count } = await getLeads(currentPage, sortField, sortDir, statusFilter);
  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <PageSetup count={count}>
      <PageContainer>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader field="name" currentSort={sortField} currentDir={sortDir} currentStatus={statusFilter}>
                    Name
                  </SortableHeader>
                </TableHead>
                <TableHead>
                  <StatusFilter
                    currentStatus={statusFilter}
                    sortField={sortField}
                    sortDir={sortDir}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader field="lead_type" currentSort={sortField} currentDir={sortDir} currentStatus={statusFilter}>
                    Type
                  </SortableHeader>
                </TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>
                  <SortableHeader field="last_activity" currentSort={sortField} currentDir={sortDir} currentStatus={statusFilter}>
                    Last Activity
                  </SortableHeader>
                </TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="hover:underline"
                      >
                        {lead.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusDot status={lead.status} showLabel />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.lead_type}
                    </TableCell>
                    <TableCell>
                      <StatValue muted>{lead.contacts.length}</StatValue>
                    </TableCell>
                    <TableCell>
                      <StatValue muted>{lead.property_count}</StatValue>
                    </TableCell>
                    <TableCell>
                      <StatValue muted>
                        {lead.last_activity_at
                          ? formatRelativeDate(lead.last_activity_at)
                          : "-"}
                      </StatValue>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.source || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={count}
            pageSize={PAGE_SIZE}
          />
        )}
      </PageContainer>
    </PageSetup>
  );
}
