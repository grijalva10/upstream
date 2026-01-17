"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check, Circle, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * StatusTimeline component for showing progression through stages
 * Based on design-system-prd.md
 *
 * Used for:
 * - Deal pipeline progression (new → contacted → engaged → qualified → handed_off)
 * - Sequence status (active → completed)
 * - Qualification flow
 */

const timelineItemVariants = cva(
  "flex items-center gap-3",
  {
    variants: {
      status: {
        completed: "",
        current: "",
        upcoming: "opacity-50",
      },
    },
    defaultVariants: {
      status: "upcoming",
    },
  }
)

const timelineIndicatorVariants = cva(
  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors shrink-0",
  {
    variants: {
      status: {
        completed: "border-green-500 bg-green-500 text-white dark:border-green-400 dark:bg-green-400",
        current: "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-400",
        upcoming: "border-border bg-background text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "upcoming",
    },
  }
)

const timelineConnectorVariants = cva(
  "absolute left-4 top-8 w-0.5 -translate-x-1/2",
  {
    variants: {
      status: {
        completed: "bg-green-500 dark:bg-green-400",
        current: "bg-border",
        upcoming: "bg-border",
      },
    },
    defaultVariants: {
      status: "upcoming",
    },
  }
)

type TimelineStatus = "completed" | "current" | "upcoming"

interface TimelineStep {
  id: string
  label: string
  description?: string
  timestamp?: string
  icon?: LucideIcon
}

interface StatusTimelineProps {
  steps: TimelineStep[]
  currentStepId?: string
  completedStepIds?: string[]
  orientation?: "vertical" | "horizontal"
  className?: string
}

function StatusTimeline({
  steps,
  currentStepId,
  completedStepIds = [],
  orientation = "vertical",
  className,
}: StatusTimelineProps) {
  const getStepStatus = (stepId: string, index: number): TimelineStatus => {
    if (completedStepIds.includes(stepId)) return "completed"
    if (stepId === currentStepId) return "current"

    // If no current step specified, use index-based logic
    if (!currentStepId) {
      const lastCompletedIndex = steps.findIndex(
        (s, i) => i > 0 && !completedStepIds.includes(steps[i - 1].id)
      )
      if (lastCompletedIndex === -1 && completedStepIds.length === steps.length) {
        return "completed"
      }
      if (index <= completedStepIds.length) return "completed"
    }

    return "upcoming"
  }

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-center", className)}>
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, index)
          const Icon = step.icon
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2">
                <div className={cn(timelineIndicatorVariants({ status }))}>
                  {status === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : Icon ? (
                    <Icon className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "text-caption font-medium",
                      status === "upcoming" && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.timestamp && (
                    <p className="text-caption text-muted-foreground">
                      {step.timestamp}
                    </p>
                  )}
                </div>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2",
                    status === "completed"
                      ? "bg-green-500 dark:bg-green-400"
                      : "bg-border"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  // Vertical orientation (default)
  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const status = getStepStatus(step.id, index)
        const Icon = step.icon
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="relative">
            <div className={cn(timelineItemVariants({ status }), "pb-6")}>
              <div className={cn(timelineIndicatorVariants({ status }))}>
                {status === "completed" ? (
                  <Check className="h-4 w-4" />
                ) : Icon ? (
                  <Icon className="h-4 w-4" />
                ) : status === "current" ? (
                  <Circle className="h-3 w-3 fill-current" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-body-sm font-medium",
                    status === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-caption text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                )}
                {step.timestamp && (
                  <p className="text-caption text-muted-foreground mt-1">
                    {step.timestamp}
                  </p>
                )}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  timelineConnectorVariants({ status }),
                  "h-[calc(100%-2rem)]"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export {
  StatusTimeline,
  timelineItemVariants,
  timelineIndicatorVariants,
  timelineConnectorVariants,
}
