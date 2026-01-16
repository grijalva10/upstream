import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { PageSetup } from "./_components/page-setup";
import { ListTodo } from "lucide-react";

export default function TasksPage() {
  return (
    <PageSetup>
      <PageContainer>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-amber-500" />
              Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The tasks view will show scheduled calls with call prep sheets,
              follow-up reminders, and other action items.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </PageSetup>
  );
}
