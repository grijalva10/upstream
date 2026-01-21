# Lead-Search Association Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable associating searches with leads so buyer criteria can be tracked and campaigns run on their behalf.

**Architecture:** Add `source_lead_id` to searches table, update search form with lead selector combobox, add SearchesCard to lead detail page sidebar.

**Tech Stack:** Next.js, Supabase, shadcn/ui (Combobox, Command), Zod validation

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00038_search_source_lead.sql`
- Modify: `docs/SCHEMA.md`

**Step 1: Create migration file**

```sql
-- Add source_lead_id to searches table
ALTER TABLE searches
ADD COLUMN source_lead_id UUID REFERENCES leads(id);

-- Index for efficient lookups from lead detail page
CREATE INDEX idx_searches_source_lead_id ON searches(source_lead_id);

COMMENT ON COLUMN searches.source_lead_id IS 'The buyer lead whose criteria this search represents';
```

**Step 2: Apply migration**

Run: `npx supabase db reset` (or `npx supabase migration up` if preserving data)

Expected: Migration applies successfully

**Step 3: Update schema docs**

In `docs/SCHEMA.md`, update the Searches & Sourcing section:

```markdown
## Searches & Sourcing

| Table | Purpose |
|-------|---------|
| `searches` | Search profiles with criteria + CoStar payloads. `source_lead_id` links to buyer. |
| `search_properties` | Junction: search ↔ property |
```

**Step 4: Commit**

```bash
git add supabase/migrations/00038_search_source_lead.sql docs/SCHEMA.md
git commit -m "feat: add source_lead_id to searches table"
```

---

## Task 2: Update Search API Schema

**Files:**
- Modify: `apps/web/src/app/(app)/searches/_lib/schemas.ts`

**Step 1: Add source_lead_id to createSearchSchema**

Update the schema to accept optional `source_lead_id`:

```typescript
export const createSearchSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be less than 200 characters"),
  source: searchSourceSchema.default("manual"),
  source_lead_id: z.string().uuid().optional().nullable(),
  criteria_json: z
    .record(z.string(), z.unknown())
    .optional(),
});
```

**Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/searches/_lib/schemas.ts
git commit -m "feat: add source_lead_id to search schema"
```

---

## Task 3: Update Search API Endpoints

**Files:**
- Modify: `apps/web/src/app/api/searches/route.ts`

**Step 1: Update POST to include source_lead_id**

In the POST handler, extract and insert `source_lead_id`:

```typescript
const { name, source, criteria_json, source_lead_id } = parsed.data;

// ...

const { data: search, error: searchError } = await supabase
  .from("searches")
  .insert({
    name,
    source,
    source_lead_id: source_lead_id || null,
    criteria_json: criteria_json || {},
    status: initialStatus,
  })
  .select("id")
  .single();
```

**Step 2: Update GET to include source_lead in response**

Update the select query to join the lead name:

```typescript
let query = supabase
  .from("searches")
  .select(`
    id, name, source, status, criteria_json, strategy_summary,
    payloads_json, total_properties, total_leads, total_contacts,
    source_contact_id, source_lead_id, created_at, updated_at,
    source_lead:leads!source_lead_id (id, name),
    campaigns (id, name, status, total_enrolled, total_sent, total_opened, total_replied)
  `)
  .order("created_at", { ascending: false });
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/searches/route.ts
git commit -m "feat: update search API to handle source_lead_id"
```

---

## Task 4: Create Lead Search API Endpoint

**Files:**
- Create: `apps/web/src/app/api/leads/search/route.ts`

**Step 1: Create endpoint for searching leads**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    let dbQuery = supabase
      .from("leads")
      .select("id, name, lead_type, status")
      .order("name")
      .limit(20);

    if (query.trim()) {
      dbQuery = dbQuery.ilike("name", `%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("Error searching leads:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in GET /api/leads/search:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/leads/search/route.ts
git commit -m "feat: add lead search endpoint for combobox"
```

---

## Task 5: Update Leads POST to Support Buyer Type

**Files:**
- Modify: `apps/web/src/app/api/leads/route.ts`

**Step 1: Add lead_type parameter**

Update POST to accept and set `lead_type`:

```typescript
const { leadName, contactName, email, phone, leadType } = body;

// ...

const { data: lead, error: leadError } = await supabase
  .from("leads")
  .insert({
    name: leadName,
    status: "new",
    source: "manual",
    lead_type: leadType || null,
  })
  .select()
  .single();
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/leads/route.ts
git commit -m "feat: add lead_type parameter to lead creation"
```

---

## Task 6: Create LeadCombobox Component

**Files:**
- Create: `apps/web/src/components/lead-combobox.tsx`

**Step 1: Create the combobox component**

```typescript
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Lead {
  id: string;
  name: string;
  lead_type: string | null;
  status: string;
}

interface LeadComboboxProps {
  value: string | null;
  onChange: (leadId: string | null, lead?: Lead) => void;
  onCreateNew?: (name: string) => Promise<Lead | null>;
  placeholder?: string;
  disabled?: boolean;
}

export function LeadCombobox({
  value,
  onChange,
  onCreateNew,
  placeholder = "Select lead...",
  disabled = false,
}: LeadComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);

  // Fetch leads on search change
  React.useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(search)}`);
        if (res.ok) {
          const data = await res.json();
          setLeads(data);
        }
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchLeads, 200);
    return () => clearTimeout(debounce);
  }, [search]);

  // Fetch selected lead on mount if value provided
  React.useEffect(() => {
    if (value && !selectedLead) {
      const fetchLead = async () => {
        try {
          const res = await fetch(`/api/leads/search?q=`);
          if (res.ok) {
            const data = await res.json();
            const found = data.find((l: Lead) => l.id === value);
            if (found) setSelectedLead(found);
          }
        } catch (error) {
          console.error("Error fetching selected lead:", error);
        }
      };
      fetchLead();
    }
  }, [value, selectedLead]);

  const handleSelect = (lead: Lead) => {
    setSelectedLead(lead);
    onChange(lead.id, lead);
    setOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    setSelectedLead(null);
    onChange(null);
    setSearch("");
  };

  const handleCreateNew = async () => {
    if (!onCreateNew || !search.trim()) return;
    setCreating(true);
    try {
      const newLead = await onCreateNew(search.trim());
      if (newLead) {
        handleSelect(newLead);
      }
    } finally {
      setCreating(false);
    }
  };

  const showCreateOption = search.trim() && !leads.some(
    (l) => l.name.toLowerCase() === search.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedLead ? (
            <span className="truncate">{selectedLead.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search leads..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : leads.length === 0 && !showCreateOption ? (
              <CommandEmpty>No leads found.</CommandEmpty>
            ) : (
              <>
                <CommandGroup>
                  {leads.map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={lead.id}
                      onSelect={() => handleSelect(lead)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === lead.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{lead.name}</span>
                        {lead.lead_type && (
                          <span className="text-xs text-muted-foreground">
                            {lead.lead_type}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {showCreateOption && onCreateNew && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={handleCreateNew}
                        disabled={creating}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {creating ? "Creating..." : `Create "${search}"`}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
          {selectedLead && (
            <>
              <CommandSeparator />
              <div className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={handleClear}
                >
                  Clear selection
                </Button>
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/lead-combobox.tsx
git commit -m "feat: add LeadCombobox component"
```

---

## Task 7: Update NewSearchDialog with Lead Selector

**Files:**
- Modify: `apps/web/src/app/(app)/searches/_components/new-search-dialog.tsx`

**Step 1: Add lead selector to dialog**

Import the combobox and add state:

```typescript
import { LeadCombobox } from "@/components/lead-combobox";

// Inside component, add state:
const [sourceLeadId, setSourceLeadId] = useState<string | null>(null);

// Add createLead handler:
const createLead = async (name: string) => {
  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadName: name, leadType: "buyer" }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.lead;
    }
  } catch (error) {
    console.error("Error creating lead:", error);
  }
  return null;
};

// Update reset function:
const reset = () => {
  setName("");
  setSource("manual");
  setSourceLeadId(null);
  setError("");
};

// Update handleSubmit to include source_lead_id:
body: JSON.stringify({
  name: name.trim(),
  source,
  source_lead_id: sourceLeadId,
}),
```

Add the field in JSX after the name input:

```tsx
<div className="space-y-2">
  <Label>Source Lead (optional)</Label>
  <LeadCombobox
    value={sourceLeadId}
    onChange={(id) => setSourceLeadId(id)}
    onCreateNew={createLead}
    placeholder="Search or create lead..."
  />
  <p className="text-xs text-muted-foreground">
    The buyer whose criteria this search represents
  </p>
</div>
```

**Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/searches/_components/new-search-dialog.tsx
git commit -m "feat: add lead selector to new search dialog"
```

---

## Task 8: Create SearchesCard Component

**Files:**
- Create: `apps/web/src/app/(app)/leads/[id]/_components/searches-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Search {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface SearchesCardProps {
  searches: Search[];
  leadId: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "ready":
    case "campaign_created":
      return "default";
    case "extracting":
    case "generating_queries":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SearchesCard({ searches, leadId }: SearchesCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-muted/40 border-b flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Searches {searches.length > 0 && `(${searches.length})`}
        </h3>
        <Link href={`/searches/new?leadId=${leadId}`}>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {searches.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">No searches yet</p>
      ) : (
        <div className="p-4 space-y-3">
          {searches.map((search) => (
            <Link
              key={search.id}
              href={`/searches/${search.id}`}
              className="block hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{search.name}</p>
                <Badge variant={getStatusVariant(search.status)} className="shrink-0 text-xs">
                  {search.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(search.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/leads/\[id\]/_components/searches-card.tsx
git commit -m "feat: add SearchesCard component for lead detail page"
```

---

## Task 9: Update Lead Detail Page

**Files:**
- Modify: `apps/web/src/app/(app)/leads/[id]/page.tsx`

**Step 1: Add getSearches function**

```typescript
interface Search {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

async function getSearches(leadId: string): Promise<Search[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("searches")
    .select("id, name, status, created_at")
    .eq("source_lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching searches:", error);
    return [];
  }

  return data ?? [];
}
```

**Step 2: Import SearchesCard and add to Promise.all**

```typescript
import { SearchesCard } from "./_components/searches-card";

// Update Promise.all:
const [lead, contacts, properties, deals, tasks, searches] = await Promise.all([
  getLead(id),
  getContacts(id),
  getProperties(id),
  getDeals(id),
  getTasks(id),
  getSearches(id),
]);
```

**Step 3: Add SearchesCard to sidebar**

Add after DealsCard in the left column:

```tsx
<div className="space-y-6 lg:col-span-1">
  <ContactsCard contacts={contacts} leadId={id} />
  <TasksCard tasks={tasks} leadId={id} />
  <PropertiesCard properties={properties} />
  <DealsCard deals={deals} />
  <SearchesCard searches={searches} leadId={id} />
</div>
```

**Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/leads/\[id\]/page.tsx
git commit -m "feat: add SearchesCard to lead detail page"
```

---

## Task 10: Handle leadId Query Parameter in New Search

**Files:**
- Modify: `apps/web/src/app/(app)/searches/_components/new-search-dialog.tsx`

**Step 1: Accept initialLeadId prop**

Update component to accept and use initial lead ID:

```typescript
interface NewSearchDialogProps {
  initialLeadId?: string;
  trigger?: React.ReactNode;
}

export function NewSearchDialog({ initialLeadId, trigger }: NewSearchDialogProps) {
  // ...existing state
  const [sourceLeadId, setSourceLeadId] = useState<string | null>(initialLeadId || null);

  // Update reset to preserve initialLeadId:
  const reset = () => {
    setName("");
    setSource("manual");
    setSourceLeadId(initialLeadId || null);
    setError("");
  };
```

**Step 2: Create wrapper page for /searches/new**

Create `apps/web/src/app/(app)/searches/new/page.tsx`:

```typescript
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadCombobox } from "@/components/lead-combobox";

export default function NewSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialLeadId = searchParams.get("leadId");

  const [name, setName] = useState("");
  const [source, setSource] = useState("manual");
  const [sourceLeadId, setSourceLeadId] = useState<string | null>(initialLeadId);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createLead = async (leadName: string) => {
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadName, leadType: "buyer" }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.lead;
      }
    } catch (error) {
      console.error("Error creating lead:", error);
    }
    return null;
  };

  const handleSubmit = async () => {
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          source,
          source_lead_id: sourceLeadId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create search");
        return;
      }

      router.push(`/searches/${data.id}`);
    } catch {
      setError("Failed to connect to API");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name.trim() && !loading;

  return (
    <div className="p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-6">New Search</h1>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Source Lead (optional)</Label>
            <LeadCombobox
              value={sourceLeadId}
              onChange={(id) => setSourceLeadId(id)}
              onCreateNew={createLead}
              placeholder="Search or create lead..."
            />
            <p className="text-xs text-muted-foreground">
              The buyer whose criteria this search represents
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              placeholder="e.g., Inland Empire Industrial Q1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-source">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="search-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="lee-1031-x">Lee 1031-X</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? "Creating..." : "Create Search"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/\(app\)/searches/new/page.tsx
git commit -m "feat: add /searches/new page with leadId query param support"
```

---

## Task 11: Final Testing & Cleanup

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test the flow**

1. Go to `/searches` and create a new search, verify lead selector works
2. Create a new lead inline from the lead selector
3. Go to `/leads/{id}` for that lead, verify SearchesCard shows the search
4. Click "+ Add Search" from lead detail, verify leadId is pre-filled
5. Create another search from lead detail, verify it appears in the list

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete lead-search association implementation"
```
