import { createClient } from "@/lib/supabase/server";
import { Mail } from "./_components/mail";
import { type ClassificationCount, type Email, type FolderCount } from "./_components/use-mail";

async function getMailData() {
  const supabase = await createClient();

  const [emailsResult, countsResult, folderCountsResult] = await Promise.all([
    // Fetch emails with relations
    supabase
      .from("synced_emails")
      .select(
        `
        *,
        company:matched_company_id(name),
        contact:matched_contact_id(name, title)
      `
      )
      .order("received_at", { ascending: false })
      .limit(500),

    // Fetch counts grouped by classification (need to fetch all rows for accurate counts)
    supabase.rpc("get_email_classification_counts"),

    // Fetch folder counts
    supabase.rpc("get_email_folder_counts"),
  ]);

  // Process emails
  const emails = (emailsResult.data || []) as Email[];

  // RPC returns pre-aggregated counts: { classification, count, needs_review_count }
  const counts: ClassificationCount[] = (countsResult.data || []).map(
    (row: { classification: string | null; count: number; needs_review_count: number }) => ({
      classification: row.classification as ClassificationCount["classification"],
      count: Number(row.count),
      needs_review_count: Number(row.needs_review_count),
    })
  );

  // RPC returns pre-aggregated folder counts: { folder, count }
  const folderCounts: FolderCount[] = (folderCountsResult.data || []).map(
    (row: { folder: string | null; count: number }) => ({
      folder: row.folder,
      count: Number(row.count),
    })
  );

  return { emails, counts, folderCounts };
}

export default async function InboxPage() {
  const { emails, counts, folderCounts } = await getMailData();

  return <Mail emails={emails} counts={counts} folderCounts={folderCounts} />;
}
