import { Suspense } from "react";
import { KanbanBoard } from "./_components/kanban-board";
import { PipelineFilters } from "./_components/pipeline-filters";
import { NewDealDialog } from "./_components/new-deal-dialog";
import { KanbanSkeleton } from "./_components/skeletons";
import { getDeals, getSearches, parseDeals } from "@/lib/deals";

interface Props {
  searchParams: Promise<{ search?: string; searchId?: string }>;
}

export default async function PipelinePage({ searchParams }: Props) {
  const params = await searchParams;
  const [rawDeals, searches] = await Promise.all([
    getDeals(params),
    getSearches(),
  ]);

  const deals = parseDeals(rawDeals);

  return (
    <div className="p-6 h-full flex flex-col">
      <header className="flex items-start justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Track deals through qualification
          </p>
        </div>
        <NewDealDialog />
      </header>

      <div className="mb-4 flex-shrink-0">
        <PipelineFilters searches={searches} />
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<KanbanSkeleton />}>
          <KanbanBoard deals={deals} />
        </Suspense>
      </div>
    </div>
  );
}
