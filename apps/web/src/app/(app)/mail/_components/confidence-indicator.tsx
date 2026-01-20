"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DOT_COUNT = 5;
const DOT_INDICES = [1, 2, 3, 4, 5] as const;

function getConfidenceColor(confidence: number): string {
  if (confidence < 0.6) return "text-amber-500";
  if (confidence < 0.8) return "text-blue-500";
  return "text-green-500";
}

interface ConfidenceIndicatorProps {
  confidence: number;
  size?: "sm" | "md";
  showPercentage?: boolean;
}

export function ConfidenceIndicator({
  confidence,
  size = "md",
  showPercentage = false,
}: ConfidenceIndicatorProps): React.ReactElement {
  const filledDots = Math.ceil(confidence * DOT_COUNT);
  const percentage = Math.round(confidence * 100);
  const colorClass = getConfidenceColor(confidence);

  const dotSize = size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center", gap)}>
            {DOT_INDICES.map((dot) => (
              <span
                key={dot}
                className={cn(
                  "rounded-full transition-colors",
                  dotSize,
                  dot <= filledDots
                    ? `${colorClass} bg-current`
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
            {showPercentage && (
              <span className={cn("ml-1 text-xs tabular-nums", colorClass)}>
                {percentage}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI Confidence: {percentage}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
