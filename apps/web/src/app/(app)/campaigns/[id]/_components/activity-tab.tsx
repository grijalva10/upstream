import { Activity, Send, Mail, MessageSquare, MousePointer, Clock } from "lucide-react";

interface ActivityTabProps {
  campaignId: string;
}

export function ActivityTab({ campaignId }: ActivityTabProps) {
  // Activity timeline would require a separate activity table or events
  // For now, show a polished placeholder with preview of what's coming

  return (
    <div className="space-y-6">
      {/* Coming soon banner */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-8">
        <div className="relative z-10 text-center max-w-md mx-auto">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Activity Timeline Coming Soon</h3>
          <p className="text-sm text-muted-foreground">
            Track every email send, open, click, and reply in real-time.
            This feature is currently in development.
          </p>
        </div>

        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] bg-[length:24px_24px]" />
        </div>
      </div>

      {/* Preview of activity types */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          What you'll see
        </h4>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: Send,
              label: "Email Sent",
              description: "Track when each email in your sequence is delivered",
              color: "text-blue-600",
              bgColor: "bg-blue-50 dark:bg-blue-950/50",
            },
            {
              icon: Mail,
              label: "Email Opened",
              description: "See when recipients open your emails",
              color: "text-amber-600",
              bgColor: "bg-amber-50 dark:bg-amber-950/50",
            },
            {
              icon: MousePointer,
              label: "Link Clicked",
              description: "Monitor engagement with links in your emails",
              color: "text-purple-600",
              bgColor: "bg-purple-50 dark:bg-purple-950/50",
            },
            {
              icon: MessageSquare,
              label: "Reply Received",
              description: "Get notified when contacts respond",
              color: "text-emerald-600",
              bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
            },
          ].map(({ icon: Icon, label, description, color, bgColor }) => (
            <div
              key={label}
              className={`flex items-start gap-3 p-4 rounded-xl border ${bgColor}`}
            >
              <div className={`p-2 rounded-lg bg-background ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample timeline preview (mocked) */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Preview
        </h4>
        <div className="rounded-xl border bg-card overflow-hidden opacity-60">
          <div className="divide-y">
            {[
              { type: "sent", contact: "John Smith", time: "2 hours ago" },
              { type: "opened", contact: "Jane Doe", time: "3 hours ago" },
              { type: "replied", contact: "Mike Johnson", time: "5 hours ago" },
              { type: "sent", contact: "Sarah Williams", time: "1 day ago" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <div className={`p-2 rounded-lg ${
                  activity.type === "sent" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50" :
                  activity.type === "opened" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50" :
                  "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"
                }`}>
                  {activity.type === "sent" ? <Send className="h-4 w-4" /> :
                   activity.type === "opened" ? <Mail className="h-4 w-4" /> :
                   <MessageSquare className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{activity.contact}</span>
                    <span className="text-muted-foreground">
                      {activity.type === "sent" && " received Email 1"}
                      {activity.type === "opened" && " opened Email 1"}
                      {activity.type === "replied" && " replied to Email 2"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {activity.time}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-3">
          Sample data for illustration purposes
        </p>
      </div>
    </div>
  );
}
