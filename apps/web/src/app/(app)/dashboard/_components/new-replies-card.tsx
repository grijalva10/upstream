import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ClassificationBadge, Classification } from "@/components/classification-badge";

interface RepliesByType {
  type: Classification;
  count: number;
}

interface NewRepliesCardProps {
  replies: RepliesByType[];
  total: number;
}

export function NewRepliesCard({ replies, total }: NewRepliesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">New Replies</CardTitle>
          <span className="text-2xl font-bold">{total}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <Mail className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No new replies</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {replies.map(({ type, count }) => (
              <div key={type} className="flex items-center gap-1">
                <ClassificationBadge type={type} size="sm" />
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" className="w-full mt-2 justify-between" asChild>
          <Link href="/inbox">
            Process Inbox
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
