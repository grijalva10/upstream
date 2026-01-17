"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * ConfidenceScore component for AI confidence visualization
 * Based on design-system-prd.md Agentic UI patterns
 *
 * Shows AI confidence as:
 * - Visual bar (default)
 * - Percentage badge
 * - Compact dot indicator
 *
 * Color coding:
 * - High (≥80%): Green
 * - Medium (50-79%): Orange/Yellow
 * - Low (<50%): Red (needs review)
 */

const confidenceBarVariants = cva(
  "h-full rounded-full transition-all",
  {
    variants: {
      level: {
        high: "bg-green-500 dark:bg-green-400",
        medium: "bg-orange-500 dark:bg-orange-400",
        low: "bg-red-500 dark:bg-red-400",
      },
    },
    defaultVariants: {
      level: "medium",
    },
  }
)

const confidenceBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      level: {
        high: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        medium: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
        low: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      },
    },
    defaultVariants: {
      level: "medium",
    },
  }
)

const confidenceDotVariants = cva(
  "rounded-full",
  {
    variants: {
      level: {
        high: "bg-green-500 dark:bg-green-400",
        medium: "bg-orange-500 dark:bg-orange-400",
        low: "bg-red-500 dark:bg-red-400",
      },
      size: {
        sm: "h-2 w-2",
        default: "h-2.5 w-2.5",
        lg: "h-3 w-3",
      },
    },
    defaultVariants: {
      level: "medium",
      size: "default",
    },
  }
)

type ConfidenceLevel = "high" | "medium" | "low"

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return "high"
  if (score >= 0.5) return "medium"
  return "low"
}

function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "High confidence"
    case "medium":
      return "Medium confidence"
    case "low":
      return "Low confidence - needs review"
  }
}

interface ConfidenceScoreProps {
  /** Confidence score from 0 to 1 */
  score: number
  /** Display variant */
  variant?: "bar" | "badge" | "dot"
  /** Show percentage text */
  showLabel?: boolean
  /** Size for dot variant */
  size?: "sm" | "default" | "lg"
  /** Width for bar variant */
  barWidth?: string
  className?: string
}

function ConfidenceScore({
  score,
  variant = "bar",
  showLabel = true,
  size = "default",
  barWidth = "w-20",
  className,
}: ConfidenceScoreProps) {
  const level = getConfidenceLevel(score)
  const percentage = Math.round(score * 100)
  const label = getConfidenceLabel(level)

  if (variant === "dot") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1.5", className)}>
              <div className={cn(confidenceDotVariants({ level, size }))} />
              {showLabel && (
                <span className="text-caption text-muted-foreground">
                  {percentage}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (variant === "badge") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(confidenceBadgeVariants({ level }), className)}>
              {percentage}%
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Default: bar variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div
              className={cn(
                "h-1.5 rounded-full bg-secondary overflow-hidden",
                barWidth
              )}
            >
              <div
                className={cn(confidenceBarVariants({ level }))}
                style={{ width: `${percentage}%` }}
              />
            </div>
            {showLabel && (
              <span className="text-caption text-muted-foreground tabular-nums">
                {percentage}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export {
  ConfidenceScore,
  confidenceBarVariants,
  confidenceBadgeVariants,
  confidenceDotVariants,
  getConfidenceLevel,
  getConfidenceLabel,
}
