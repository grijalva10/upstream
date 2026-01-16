import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Send,
  Mail,
  MessageSquare,
  ExternalLink,
  Clock,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CampaignActions } from "./_components/campaign-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
};

async function getCampaign(id: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, search:searches(id, name)")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  return data;
}

async function getEnrollments(campaignId: string) {
  const supabase = createAdminClient();

  const { data, count } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      current_step,
      created_at,
      contact:contacts(id, name, email),
      property:properties(id, address, city, state)
    `,
      { count: "exact" }
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(50);

  return { enrollments: data ?? [], total: count ?? 0 };
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [campaign, { enrollments, total }] = await Promise.all([
    getCampaign(id),
    getEnrollments(id),
  ]);

  const metrics = [
    {
      label: "Enrolled",
      value: campaign.total_enrolled ?? 0,
      icon: Users,
      color: "text-blue-600",
    },
    {
      label: "Sent",
      value: campaign.total_sent ?? 0,
      icon: Send,
      color: "text-slate-600",
    },
    {
      label: "Opened",
      value: campaign.total_opened ?? 0,
      icon: Mail,
      color: "text-amber-600",
    },
    {
      label: "Replied",
      value: campaign.total_replied ?? 0,
      icon: MessageSquare,
      color: "text-emerald-600",
    },
  ];

  const emails = [
    { num: 1, subject: campaign.email_1_subject, delay: null },
    { num: 2, subject: campaign.email_2_subject, delay: campaign.email_2_delay_days ?? 3 },
    { num: 3, subject: campaign.email_3_subject, delay: campaign.email_3_delay_days ?? 4 },
  ];

  return (
    <div className="p-6 pb-8 space-y-6 max-w-5xl">
      {/* Back link */}
      <Link
        href="/campaigns"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Campaigns
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
          </div>
          {campaign.search && (
            <p className="text-sm text-muted-foreground">
              Search:{" "}
              <Link
                href={`/searches/${campaign.search.id}`}
                className="text-foreground hover:underline inline-flex items-center gap-1"
              >
                {campaign.search.name}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </p>
          )}
        </div>
        <CampaignActions
          campaignId={campaign.id}
          status={campaign.status}
          enrollmentCount={total}
        />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
            </div>
            <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Email Sequence */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Email Sequence
        </h2>
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {emails.map(({ num, subject, delay }) => (
            <div key={num} className="flex items-center gap-4 p-4">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-medium">
                {num}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {subject || <span className="text-muted-foreground italic">No subject</span>}
                </p>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {delay === null ? "Immediate" : `+${delay} days`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Enrollments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Enrollments
          </h2>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_100px_80px] gap-4 px-4 py-3 bg-muted/30 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div>Contact</div>
            <div>Property</div>
            <div>Progress</div>
            <div className="text-right">Status</div>
          </div>

          {/* Rows */}
          {enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No contacts enrolled yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click &quot;Enroll Contacts&quot; to add contacts from the search
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_80px] gap-2 sm:gap-4 p-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Contact */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <span className="text-sm font-medium">
                        {(enrollment.contact?.name || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {enrollment.contact?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {enrollment.contact?.email || "No email"}
                      </p>
                    </div>
                  </div>

                  {/* Property */}
                  <div className="flex items-center gap-2 pl-12 sm:pl-0">
                    <Building2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        {enrollment.property?.address || "Unknown property"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[enrollment.property?.city, enrollment.property?.state]
                          .filter(Boolean)
                          .join(", ") || ""}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2 pl-12 sm:pl-0">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={`h-2 w-5 rounded-full ${
                            step <= (enrollment.current_step ?? 0)
                              ? "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {enrollment.current_step ?? 0}/3
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-start sm:justify-end pl-12 sm:pl-0">
                    <Badge
                      variant="outline"
                      className={
                        enrollment.status === "replied"
                          ? "text-emerald-600 border-emerald-200"
                          : enrollment.status === "stopped"
                          ? "text-red-600 border-red-200"
                          : ""
                      }
                    >
                      {enrollment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
