import type { DealStatus, DealActivityType } from "./schema";

// Kanban columns
export const COLUMNS = [
  { id: "qualifying", title: "Qualifying", color: "bg-slate-500" },
  { id: "qualified", title: "Qualified", color: "bg-blue-500" },
  { id: "packaged", title: "Packaged", color: "bg-amber-500" },
  { id: "handed_off", title: "Handed Off", color: "bg-green-500" },
  { id: "closed", title: "Closed", color: "bg-purple-500" },
  { id: "lost", title: "Lost", color: "bg-red-500" },
] as const satisfies readonly { id: DealStatus; title: string; color: string }[];

// Status badge variants
export const STATUS_VARIANTS: Record<
  DealStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  qualifying: "secondary",
  qualified: "default",
  packaged: "outline",
  handed_off: "default",
  closed: "outline",
  lost: "destructive",
};

// Qualification field config
export const QUALIFICATION_FIELDS = [
  { key: "asking_price", label: "Asking Price", type: "currency" },
  { key: "noi", label: "NOI", type: "currency" },
  { key: "motivation", label: "Motivation", type: "select" },
  { key: "timeline", label: "Timeline", type: "select" },
  { key: "decision_maker_confirmed", label: "Decision Maker", type: "checkbox" },
  { key: "price_realistic", label: "Price Realistic", type: "boolean" },
] as const;

// Motivation options
export const MOTIVATIONS = [
  "Estate planning",
  "Retirement",
  "Refinance pressure",
  "Partnership dissolution",
  "Portfolio rebalancing",
  "Relocation",
  "Health issues",
  "Financial distress",
  "Market timing",
  "Other",
] as const;

// Timeline options
export const TIMELINES = [
  "30 days",
  "60 days",
  "90 days",
  "120 days",
  "6+ months",
  "Flexible",
] as const;

// Activity type colors for timeline display
export const ACTIVITY_COLORS: Record<DealActivityType, string> = {
  email_sent: "text-blue-500 bg-blue-100",
  email_received: "text-green-500 bg-green-100",
  call_scheduled: "text-amber-500 bg-amber-100",
  call_completed: "text-emerald-500 bg-emerald-100",
  doc_received: "text-purple-500 bg-purple-100",
  status_change: "text-slate-500 bg-slate-100",
  note_added: "text-gray-500 bg-gray-100",
  handed_off: "text-indigo-500 bg-indigo-100",
};
