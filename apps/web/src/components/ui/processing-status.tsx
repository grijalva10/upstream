"use client"

import * as React from "react"
import { Check, Circle, Loader2 } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

/**
 * ProcessingStatus component for Agentic UI
 * Based on design-system-prd.md Transparency principle
 *
 * Shows multi-step processing with:
 * - Step list with status indicators
 * - Current step description
 * - Overall progress bar
 */

export type StepStatus = "pending" | "in_progress" | "completed" | "error"

export interface ProcessingStep {
  id: string
  label: string
  status: StepStatus
  icon?: React.ReactNode
}

const stepIndicatorVariants = cva(
  "flex h-5 w-5 items-center justify-center rounded-full text-xs transition-colors",
  {
    variants: {
      status: {
        pending: "border border-border text-muted-foreground",
        in_progress: "bg-accent-blue text-white",
        completed: "bg-accent-green text-white",
        error: "bg-accent-red text-white",
      },
    },
    defaultVariants: {
      status: "pending",
    },
  }
)

interface StepIndicatorProps extends VariantProps<typeof stepIndicatorVariants> {
  className?: string
}

function StepIndicator({ status, className }: StepIndicatorProps) {
  return (
    <div className={cn(stepIndicatorVariants({ status }), className)}>
      {status === "pending" && <Circle className="h-2.5 w-2.5" />}
      {status === "in_progress" && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {status === "completed" && <Check className="h-3 w-3" />}
      {status === "error" && <span className="font-bold">!</span>}
    </div>
  )
}

interface ProcessingStatusProps {
  steps: ProcessingStep[]
  title?: string
  description?: string
  progress?: number
  className?: string
}

function ProcessingStatus({
  steps,
  title,
  description,
  progress,
  className,
}: ProcessingStatusProps) {
  const currentStep = steps.find((s) => s.status === "in_progress")
  const completedCount = steps.filter((s) => s.status === "completed").length
  const calculatedProgress =
    progress ?? Math.round((completedCount / steps.length) * 100)

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 shadow-card",
        className
      )}
    >
      {/* Steps list */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 text-sm transition-opacity",
              step.status === "pending" && "opacity-50"
            )}
          >
            <StepIndicator status={step.status} />
            <span
              className={cn(
                step.status === "in_progress" && "font-medium",
                step.status === "completed" && "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="my-4 border-t" />

      {/* Current status */}
      <div className="space-y-3">
        {title && (
          <div className="text-body-sm font-medium">
            {title}
          </div>
        )}
        {(description || currentStep) && (
          <p className="text-caption text-muted-foreground">
            {description || `${currentStep?.label}...`}
          </p>
        )}

        {/* Progress bar */}
        <Progress value={calculatedProgress} className="h-1.5" />
      </div>
    </div>
  )
}

export { ProcessingStatus, StepIndicator, stepIndicatorVariants }
