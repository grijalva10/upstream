import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Approval Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve AI-generated emails
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The approval queue will show pending email drafts and low-confidence
            classifications that need your review.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
