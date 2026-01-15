import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QualificationCard } from "../_components/qualification-card";
import { DocumentsCard } from "../_components/documents-card";
import { LoanInfoCard } from "../_components/loan-info-card";
import { PackagePreviewCard } from "../_components/package-preview-card";
import { ActivityTimeline } from "../_components/activity-timeline";
import { AddNoteForm } from "../_components/add-note-form";
import { DealDetailSkeleton } from "../_components/skeletons";
import { getDeal, getDealActivities } from "@/lib/deals";
import { STATUS_VARIANTS, COLUMNS } from "@/lib/deals/constants";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [deal, activities] = await Promise.all([
    getDeal(id),
    getDealActivities(id),
  ]);

  if (!deal) {
    notFound();
  }

  const statusConfig = COLUMNS.find((c) => c.id === deal.status);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/pipeline"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Pipeline
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {deal.display_id}
            </h1>
            <Badge variant={STATUS_VARIANTS[deal.status]}>
              {statusConfig?.title ?? deal.status}
            </Badge>
          </div>
          <p className="text-lg">{deal.properties?.address ?? "No address"}</p>
          <p className="text-muted-foreground">
            {deal.properties?.property_type ?? "Unknown type"}
            {deal.properties?.building_size_sqft &&
              ` - ${deal.properties.building_size_sqft.toLocaleString()} sqft`}
            {deal.properties?.building_class &&
              ` - Class ${deal.properties.building_class}`}
          </p>
          <p className="text-muted-foreground mt-1">
            {deal.companies?.name ?? "No company"}
            {deal.contacts?.name && ` - ${deal.contacts.name}`}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {deal.contacts?.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${deal.contacts.phone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </a>
            </Button>
          )}
          {deal.contacts?.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${deal.contacts.email}`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Main content */}
        <div className="lg:col-span-2 space-y-6">
          <QualificationCard deal={deal} />
          <DocumentsCard deal={deal} />
          <LoanInfoCard deal={deal} />
          <PackagePreviewCard deal={deal} />
        </div>

        {/* Right column - Activity */}
        <div className="space-y-6">
          <AddNoteForm dealId={deal.id} />
          <ActivityTimeline activities={activities} />
        </div>
      </div>
    </div>
  );
}
