"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Query {
  name: string;
  strategy: string;
  rationale: string;
  actual_results?: {
    properties?: number;
    contacts?: number;
    contact_rate?: string;
  };
  payload: Record<string, any>;
}

interface QueriesDisplayProps {
  queries: Query[] | { queries: Query[] };
}

export function QueriesDisplay({ queries }: QueriesDisplayProps) {
  const queryList = Array.isArray(queries) ? queries : queries.queries || [];

  if (!queryList.length) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">
        Generated Queries ({queryList.length})
      </h2>
      <div className="space-y-3">
        {queryList.map((query, index) => (
          <QueryCard key={index} query={query} index={index} />
        ))}
      </div>
    </div>
  );
}

function QueryCard({ query, index }: { query: Query; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              #{index + 1}
            </span>
            <h3 className="font-medium">{query.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Strategy: {query.strategy}
          </p>
        </div>

        {/* Results badge if available */}
        {query.actual_results && (
          <div className="text-right mr-4">
            <p className="text-sm font-medium">
              {query.actual_results.properties || 0} properties
            </p>
            <p className="text-xs text-muted-foreground">
              {query.actual_results.contacts || 0} contacts
            </p>
          </div>
        )}

        {expanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t p-4 space-y-4">
          {/* Rationale */}
          <div>
            <h4 className="text-sm font-medium mb-1">Rationale</h4>
            <p className="text-sm text-muted-foreground">{query.rationale}</p>
          </div>

          {/* Payload */}
          <div>
            <h4 className="text-sm font-medium mb-1">CoStar Payload</h4>
            <div className="rounded bg-muted/50 p-3">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(query.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
