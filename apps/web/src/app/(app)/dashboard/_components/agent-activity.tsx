import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AgentActivity {
  name: string;
  displayName: string;
  runs: number;
  description: string;
}

interface AgentActivityProps {
  activities: AgentActivity[];
}

export function AgentActivityTimeline({ activities }: AgentActivityProps) {
  const maxRuns = Math.max(...activities.map((a) => a.runs), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Agent Activity (last 24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{activity.displayName}</span>
                <span className="text-muted-foreground text-xs">
                  {activity.description}
                </span>
              </div>
              <Progress
                value={(activity.runs / maxRuns) * 100}
                className="h-2"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
