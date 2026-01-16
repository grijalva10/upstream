import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { CheckCircle } from "lucide-react";

export default function ApprovalsPage() {
  return (
    <PageSetup>
      <PageContainer>
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
      </PageContainer>
    </PageSetup>
  );
}
