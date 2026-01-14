import { cn } from "@/lib/utils";

type ClassificationType =
  | "interested"
  | "pricing_given"
  | "question"
  | "referral"
  | "broker_redirect"
  | "soft_pass"
  | "hard_pass"
  | "bounce"
  | "ooo"
  | "unclear"
  | "stale_data"
  | "needs_review";

const classificationConfig: Record<
  ClassificationType,
  { label: string; shortLabel?: string; className: string }
> = {
  interested: {
    label: "Interested",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  pricing_given: {
    label: "Pricing",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  question: {
    label: "Question",
    shortLabel: "?",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  referral: {
    label: "Referral",
    className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  broker_redirect: {
    label: "Broker",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  soft_pass: {
    label: "Soft Pass",
    shortLabel: "Soft",
    className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
  hard_pass: {
    label: "Hard Pass",
    shortLabel: "Hard",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  bounce: {
    label: "Bounce",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  ooo: {
    label: "OOO",
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  },
  unclear: {
    label: "Unclear",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  stale_data: {
    label: "Stale",
    className: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  },
  needs_review: {
    label: "Review",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
};

interface ClassificationBadgeProps {
  type: ClassificationType;
  count?: number;
  size?: "sm" | "default";
}

export function ClassificationBadge({ type, count, size = "default" }: ClassificationBadgeProps) {
  const config = classificationConfig[type];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-medium",
        config.className,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      )}
    >
      {size === "sm" ? (config.shortLabel || config.label) : config.label}
      {count !== undefined && <span className="ml-1 font-semibold">{count}</span>}
    </span>
  );
}

export type { ClassificationType };
