import Link from "next/link";
import { ArrowRight, Building2, Users, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultsSectionProps {
  searchId: string;
  totalProperties: number | null;
  totalCompanies: number | null;
  totalContacts: number | null;
}

export function ResultsSection({ searchId, totalProperties, totalCompanies, totalContacts }: ResultsSectionProps) {
  const results = [
    {
      label: "Properties",
      count: totalProperties ?? 0,
      icon: Building2,
      href: `/data/properties?search=${searchId}`,
    },
    {
      label: "Companies",
      count: totalCompanies ?? 0,
      icon: Users,
      href: `/data/companies?search=${searchId}`,
    },
    {
      label: "Contacts",
      count: totalContacts ?? 0,
      icon: Mail,
      href: `/data/contacts?search=${searchId}`,
    },
  ];

  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Results</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {results.map(({ label, count, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </section>
  );
}
