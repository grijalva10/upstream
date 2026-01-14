import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Kanban } from "lucide-react";

export default function PipelinePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Qualification Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Track deals progressing through qualification stages
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Kanban className="h-5 w-5 text-blue-500" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The pipeline view will show a kanban board of deals moving through:
            New → Contacted → Engaged → Qualified → Handed Off
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
