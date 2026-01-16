import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "./delete-button";
import { RetryButton } from "./retry-button";
import type { SearchWithRelations, SearchContact } from "../../_lib/types";
import { StatusBadge, getSourceLabel } from "../../_lib/utils";

interface SearchHeaderProps {
  search: SearchWithRelations & { source_contact: SearchContact | null };
}

export function SearchHeader({ search }: SearchHeaderProps) {
  const sourceLabel = getSourceLabel(search.source);
  const timeAgo = search.created_at
    ? formatDistanceToNow(new Date(search.created_at), { addSuffix: true })
    : null;

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{search.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{sourceLabel}</span>
            {search.source_contact && (
              <>
                <span>•</span>
                <span>{search.source_contact.first_name} {search.source_contact.last_name}</span>
              </>
            )}
            {timeAgo && (
              <>
                <span>•</span>
                <span>{timeAgo}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={search.status} />
          <RetryButton searchId={search.id} status={search.status} />
          <DeleteButton searchId={search.id} searchName={search.name} />
        </div>
      </div>
    </div>
  );
}
