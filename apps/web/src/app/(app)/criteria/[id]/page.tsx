import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CriteriaActions } from "./_components/criteria-actions";
import { QueriesDisplay } from "./_components/queries-display";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CriteriaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: criteria, error } = await supabase
    .from("client_criteria")
    .select(`
      id,
      name,
      status,
      criteria_json,
      queries_json,
      strategy_summary,
      total_properties,
      total_contacts,
      last_extracted_at,
      created_at,
      updated_at,
      clients (
        id,
        name
      )
    `)
    .eq("id", id)
    .single();

  if (error || !criteria) {
    notFound();
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    generating: "bg-yellow-100 text-yellow-700",
    pending_review: "bg-blue-100 text-blue-700",
    approved: "bg-purple-100 text-purple-700",
    extracting: "bg-orange-100 text-orange-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-gray-100 text-gray-700",
    archived: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6 max-w-5xl">
      {/* Back link */}
      <Link
        href="/criteria"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Criteria
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{criteria.name}</h1>
          <p className="text-sm text-muted-foreground">
            Client: {(criteria.clients as { name: string }[] | null)?.[0]?.name || "Unknown"}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            statusColors[criteria.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {criteria.status}
        </span>
      </div>

      {/* Action Buttons */}
      <CriteriaActions
        criteriaId={criteria.id}
        status={criteria.status}
        hasQueries={!!criteria.queries_json}
      />

      {/* Stats */}
      {(criteria.total_properties > 0 || criteria.total_contacts > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Properties</p>
            <p className="text-2xl font-bold">{criteria.total_properties || 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Contacts</p>
            <p className="text-2xl font-bold">{criteria.total_contacts || 0}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Last Extracted</p>
            <p className="text-sm font-medium">
              {criteria.last_extracted_at
                ? new Date(criteria.last_extracted_at).toLocaleDateString()
                : "Never"}
            </p>
          </div>
        </div>
      )}

      {/* Criteria JSON */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Buyer Criteria</h2>
        <div className="rounded-lg border bg-muted/30 p-4">
          <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(criteria.criteria_json, null, 2)}
          </pre>
        </div>
      </div>

      {/* Strategy Summary */}
      {criteria.strategy_summary && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Strategy Summary</h2>
          <div className="rounded-lg border p-4 prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm">
              {criteria.strategy_summary}
            </pre>
          </div>
        </div>
      )}

      {/* Generated Queries */}
      {criteria.queries_json && (
        <QueriesDisplay queries={criteria.queries_json} />
      )}

      {/* Metadata */}
      <div className="mt-8 pt-4 border-t text-sm text-muted-foreground">
        <p>Created: {new Date(criteria.created_at).toLocaleString()}</p>
        <p>Updated: {new Date(criteria.updated_at).toLocaleString()}</p>
      </div>
    </div>
  );
}
