import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Mail, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  name: string;
  description: string;
  lastActive: Date | null;
  icon: "costar" | "outlook" | "claude";
}

interface ServicesStatusCardProps {
  services: ServiceStatus[];
}

function getStatusInfo(lastActive: Date | null) {
  if (!lastActive) {
    return { status: "cold", label: "never", color: "bg-zinc-600" };
  }

  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  let label: string;
  if (diffMin < 1) {
    label = "now";
  } else if (diffMin < 60) {
    label = `${diffMin}m`;
  } else if (diffHours < 24) {
    label = `${diffHours}h`;
  } else {
    label = `${diffDays}d`;
  }

  if (diffMin < 5) {
    return { status: "healthy", label, color: "bg-emerald-500" };
  } else if (diffMin < 30) {
    return { status: "stale", label, color: "bg-amber-500" };
  } else {
    return { status: "cold", label, color: "bg-zinc-600" };
  }
}

const iconMap = {
  costar: Database,
  outlook: Mail,
  claude: Sparkles,
};

export function ServicesStatusCard({ services }: ServicesStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Services</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {services.map((service, index) => {
          const Icon = iconMap[service.icon];
          const { status, label, color } = getStatusInfo(service.lastActive);

          return (
            <div
              key={service.name}
              className={cn(
                "flex items-center gap-3 py-2",
                index !== services.length - 1 && "border-b border-border"
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              <span className="text-sm flex-1">{service.name}</span>

              <span className="text-xs text-muted-foreground font-mono">
                {label}
              </span>

              <div className="relative">
                <div className={cn("h-2 w-2 rounded-full", color)} />
                {status === "healthy" && (
                  <div
                    className={cn(
                      "absolute inset-0 h-2 w-2 rounded-full animate-ping opacity-75",
                      color
                    )}
                    style={{ animationDuration: "2s" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
