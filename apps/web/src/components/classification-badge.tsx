import { cn } from "@/lib/utils";
import { CLASSIFICATIONS, type Classification } from "@/lib/inbox/schemas";

const colorClasses = {
  green: "bg-green-500/10 text-green-600 border-green-500/20",
  blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  yellow: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  orange: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  red: "bg-red-500/10 text-red-600 border-red-500/20",
  gray: "bg-gray-500/10 text-gray-600 border-gray-500/20",
} as const;

interface ClassificationBadgeProps {
  type: Classification | null;
  size?: "sm" | "default";
  showLabel?: boolean;
}

export function ClassificationBadge({
  type,
  size = "default",
  showLabel = true,
}: ClassificationBadgeProps) {
  const config = type ? CLASSIFICATIONS[type] : CLASSIFICATIONS.unclassified;
  const colorClass = colorClasses[config.color];

  if (!showLabel) {
    return (
      <span
        className={cn(
          "inline-block rounded-full",
          colorClass,
          size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
        )}
        aria-label={config.label}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-medium",
        colorClass,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      )}
    >
      {size === "sm" ? config.shortLabel : config.label}
    </span>
  );
}

export { type Classification };
