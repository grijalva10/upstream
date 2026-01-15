import { Building2, Users, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isProcessing } from "../../_lib/utils";

interface ResultsTabProps {
  totalProperties: number | null;
  totalCompanies: number | null;
  totalContacts: number | null;
  status: string;
}

export function ResultsTab({ totalProperties, totalCompanies, totalContacts, status }: ResultsTabProps) {
  if (isProcessing(status)) {
    return <ProcessingState status={status} />;
  }

  const properties = totalProperties ?? 0;
  const companies = totalCompanies ?? 0;
  const contacts = totalContacts ?? 0;
  const isEmpty = properties === 0 && companies === 0 && contacts === 0;
  if (isEmpty) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <StatsGrid
        properties={properties}
        companies={companies}
        contacts={contacts}
      />
      <PreviewCard title="Properties" message="Property list preview coming soon" />
      <PreviewCard title="Companies" message="Company list preview coming soon" />
      <PreviewCard title="Contacts" message="Contact list preview coming soon" />
    </div>
  );
}

function ProcessingState({ status }: { status: string }) {
  const message =
    status === "pending_queries"
      ? "Waiting for query generation..."
      : "Extracting properties from CoStar...";

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 border rounded-lg bg-muted/20 text-center">
      <div className="animate-pulse flex flex-col items-center">
        <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
        <p className="text-sm sm:text-base text-muted-foreground">{message}</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Results will appear here once extraction is complete
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 border rounded-lg bg-muted/20 text-center">
      <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50 mb-4" aria-hidden="true" />
      <p className="text-sm sm:text-base text-muted-foreground">No results found</p>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1">Try adjusting your search criteria</p>
    </div>
  );
}

interface StatsGridProps {
  properties: number;
  companies: number;
  contacts: number;
}

function StatsGrid({ properties, companies, contacts }: StatsGridProps) {
  const stats = [
    { label: "Properties", value: properties, icon: Building2 },
    { label: "Companies", value: companies, icon: Users },
    { label: "Contacts", value: contacts, icon: Mail },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <span className="text-2xl sm:text-3xl font-bold">{value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PreviewCard({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg bg-muted/20">
          {message}
        </div>
      </CardContent>
    </Card>
  );
}
