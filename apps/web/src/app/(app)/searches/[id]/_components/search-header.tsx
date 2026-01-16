import { formatDistanceToNow } from "date-fns";
import { DeleteButton } from "./delete-button";
import { RetryButton } from "./retry-button";
import { CreateCampaignButton } from "./create-campaign-button";
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

  const canCreateCampaign =
    (search.status === "ready" || search.status === "extraction_complete") &&
    (search.campaigns?.length ?? 0) === 0;

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
                <span>{search.source_contact.name || "Unknown Contact"}</span>
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
          {canCreateCampaign && (
            <CreateCampaignButton searchId={search.id} searchName={search.name} />
          )}
          <RetryButton searchId={search.id} status={search.status} />
          <DeleteButton searchId={search.id} searchName={search.name} />
        </div>
      </div>
    </div>
  );
}
