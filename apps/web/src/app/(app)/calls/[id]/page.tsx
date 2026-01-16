import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { transformCall } from "@/lib/transforms";
import { CallHeader } from "./_components/call-header";
import { CallPrepPanel } from "./_components/call-prep-panel";
import { CallNotesEditor } from "./_components/call-notes-editor";
import { DealQuickView } from "./_components/deal-quick-view";
import { ActionItemsList } from "./_components/action-items-list";
import { OutcomeSelector } from "./_components/outcome-selector";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getCall(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      `
      id,
      scheduled_at,
      duration_minutes,
      status,
      call_prep_md,
      notes_md,
      outcome,
      action_items,
      created_at,
      updated_at,
      contact:contacts(
        id,
        name,
        email,
        phone,
        title,
        company:companies(id, name, status)
      ),
      deal:deals(
        id,
        display_id,
        asking_price,
        noi,
        cap_rate,
        motivation,
        timeline,
        decision_maker_confirmed,
        status,
        property:properties(
          id,
          address,
          city,
          state,
          zip,
          property_type,
          sqft,
          building_class,
          year_built
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return transformCall(data);
}

export default async function CallDetailPage({ params }: PageProps) {
  const { id } = await params;
  const call = await getCall(id);

  if (!call) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <CallHeader call={call} />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left column - Call prep and notes */}
        <div className="space-y-6">
          <CallPrepPanel callId={call.id} prepMd={call.call_prep_md} />
          <CallNotesEditor callId={call.id} initialNotes={call.notes_md} />
        </div>

        {/* Right column - Deal info, action items, outcome */}
        <div className="space-y-6">
          <DealQuickView deal={call.deal} contact={call.contact} />
          <ActionItemsList callId={call.id} items={call.action_items} />
          <OutcomeSelector
            callId={call.id}
            currentOutcome={call.outcome}
            status={call.status}
          />
        </div>
      </div>
    </div>
  );
}
