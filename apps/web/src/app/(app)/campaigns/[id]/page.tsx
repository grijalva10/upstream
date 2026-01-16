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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CampaignActions } from "./_components/campaign-actions";
import { GenerateEmailsButton } from "./_components/generate-emails-button";
import { SendTestButton } from "./_components/send-test-button";
import { EmailSequence } from "./_components/email-sequence";
import { EnrollmentsTable } from "./_components/enrollments-table";

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

interface Enrollment {
  id: string;
  status: string;
  current_step: number | null;
  created_at: string;
  contact: { id: string; name: string | null; email: string | null } | null;
  property: { id: string; address: string | null; city: string | null; state_code: string | null } | null;
}

async function getEnrollments(campaignId: string): Promise<{ enrollments: Enrollment[]; total: number }> {
  const supabase = createAdminClient();

  const { data, count, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      current_step,
      created_at,
      contact:contacts(id, name, email),
      property:properties(id, address, city, state_code)
    `,
      { count: "exact" }
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching enrollments:", error);
    return { enrollments: [], total: 0 };
  }

  return { enrollments: (data ?? []) as unknown as Enrollment[], total: count ?? 0 };
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
    { num: 1, subject: campaign.email_1_subject, body: campaign.email_1_body, delay: null },
    { num: 2, subject: campaign.email_2_subject, body: campaign.email_2_body, delay: campaign.email_2_delay_days ?? 3 },
    { num: 3, subject: campaign.email_3_subject, body: campaign.email_3_body, delay: campaign.email_3_delay_days ?? 4 },
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
          scheduledStartAt={campaign.scheduled_start_at}
          hasEmails={Boolean(campaign.email_1_subject && campaign.email_1_body)}
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Email Sequence
          </h2>
          <div className="flex items-center gap-2">
            <SendTestButton
              campaignId={campaign.id}
              disabled={!campaign.email_1_body || total === 0}
            />
            <GenerateEmailsButton
              campaignId={campaign.id}
              disabled={campaign.status !== "draft"}
            />
          </div>
        </div>
        <EmailSequence emails={emails} />
      </section>

      {/* Enrollments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Enrollments
          </h2>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>
        <EnrollmentsTable enrollments={enrollments} total={total} />
      </section>
    </div>
  );
}
