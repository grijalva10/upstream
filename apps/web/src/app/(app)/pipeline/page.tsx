import { Suspense } from "react";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { KanbanBoard } from "./_components/kanban-board";
import { PipelineFilters } from "./_components/pipeline-filters";
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
    <PageSetup>
      <PageContainer className="h-full flex flex-col">
        <div className="mb-4 flex-shrink-0">
          <PipelineFilters searches={searches} />
        </div>

        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<KanbanSkeleton />}>
            <KanbanBoard deals={deals} />
          </Suspense>
        </div>
      </PageContainer>
    </PageSetup>
  );
}
