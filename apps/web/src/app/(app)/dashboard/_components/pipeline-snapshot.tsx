import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PipelineStage {
  name: string;
  count: number;
  color: string;
}

interface PipelineSnapshotProps {
  title: string;
  stages: PipelineStage[];
  href: string;
}

export function PipelineSnapshot({ title, stages, href }: PipelineSnapshotProps) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Link href={href} className="block">
          <div className="flex items-center gap-1 h-8 rounded-md overflow-hidden bg-muted">
            {stages.map((stage, index) => {
              const width = total > 0 ? (stage.count / total) * 100 : 0;
              return (
                <div
                  key={stage.name}
                  className={cn(
                    "h-full flex items-center justify-center transition-all hover:opacity-80",
                    stage.color
                  )}
                  style={{ width: `${Math.max(width, 8)}%` }}
                  title={`${stage.name}: ${stage.count}`}
                >
                  {width > 10 && (
                    <span className="text-xs font-medium text-white">
                      {stage.count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-3 text-xs">
            {stages.map((stage) => (
              <div key={stage.name} className="text-center">
                <div className="font-medium">{stage.count}</div>
                <div className="text-muted-foreground">{stage.name}</div>
              </div>
            ))}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
