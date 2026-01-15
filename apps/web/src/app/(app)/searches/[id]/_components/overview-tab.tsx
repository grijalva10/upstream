import { Building2, Users, Mail, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchWithRelations, SearchContact } from "../../_lib/types";
import { parseCriteria, formatPriceRange, formatPercentRange } from "../../_lib/utils";

interface OverviewTabProps {
  search: SearchWithRelations & { source_contact: SearchContact | null };
}

export function OverviewTab({ search }: OverviewTabProps) {
  const criteria = parseCriteria(search.criteria_json);

  return (
    <div className="space-y-6">
      <StatsGrid search={search} />
      <CriteriaCard criteria={criteria} />
      {search.source === "inbound" && search.source_contact && (
        <InboundSourceCard contact={search.source_contact} />
      )}
      <Timestamps createdAt={search.created_at} updatedAt={search.updated_at} />
    </div>
  );
}

function StatsGrid({ search }: { search: SearchWithRelations }) {
  const stats = [
    { label: "Properties", value: search.total_properties ?? 0, icon: Building2 },
    { label: "Companies", value: search.total_companies ?? 0, icon: Users },
    { label: "Contacts", value: search.total_contacts ?? 0, icon: Mail },
    { label: "Created", value: search.created_at ? new Date(search.created_at).toLocaleDateString() : "—", icon: Calendar },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" aria-hidden="true" />
              <span className={typeof value === "number" ? "text-xl sm:text-2xl font-bold" : "text-xs sm:text-sm font-medium"}>
                {value}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CriteriaCardProps {
  criteria: ReturnType<typeof parseCriteria>;
}

function CriteriaCard({ criteria }: CriteriaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Criteria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {criteria.markets.length > 0 && (
          <TagGroup label="Markets" items={criteria.markets} color="blue" />
        )}
        {criteria.propertyTypes.length > 0 && (
          <TagGroup label="Property Types" items={criteria.propertyTypes} color="green" />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <MetricDisplay label="Price Range" value={formatPriceRange(criteria.priceRange)} />
          <MetricDisplay label="Cap Rate" value={formatPercentRange(criteria.capRate)} />
          <MetricDisplay label="Strategy" value={criteria.strategy} />
        </div>

        {criteria.deadline && (
          <MetricDisplay
            label="Target Close Date"
            value={new Date(criteria.deadline).toLocaleDateString()}
          />
        )}
        {criteria.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{criteria.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TagGroupProps {
  label: string;
  items: string[];
  color: "blue" | "green";
}

function TagGroup({ label, items, color }: TagGroupProps) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
    green: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300",
  };

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className={`inline-flex items-center rounded-md px-2 py-1 text-sm ${colors[color]}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MetricDisplay({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function InboundSourceCard({ contact }: { contact: SearchContact }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inbound Source</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">This search was created from an inbound inquiry from:</p>
        <p className="font-medium mt-1">{contact.first_name} {contact.last_name}</p>
        <p className="text-sm text-muted-foreground">{contact.email}</p>
      </CardContent>
    </Card>
  );
}

function Timestamps({ createdAt, updatedAt }: { createdAt: string | null; updatedAt: string | null }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6 text-xs sm:text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        Created: {createdAt ? new Date(createdAt).toLocaleString() : "—"}
      </span>
      <span className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
      </span>
    </div>
  );
}
