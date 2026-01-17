import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ApprovalsCardProps {
  emailDrafts: number;
  lowConfidence: number;
}

export function ApprovalsCard({ emailDrafts, lowConfidence }: ApprovalsCardProps) {
  const total = emailDrafts + lowConfidence;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Approvals Needed</CardTitle>
          <span className="text-2xl font-bold">{total}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Email drafts</span>
          </div>
          <span className="font-medium">{emailDrafts}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertCircle className="h-4 w-4" />
            <span>Low-confidence</span>
          </div>
          <span className="font-medium text-amber-500">{lowConfidence}</span>
        </div>
        <Button variant="ghost" className="w-full mt-2 justify-between" asChild>
          <Link href="/inbox?viewMode=needs_review">
            Review All
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
