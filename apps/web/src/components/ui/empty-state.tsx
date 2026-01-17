"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { type LucideIcon, FileQuestion } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * EmptyState component for displaying when no data is available
 * Based on design-system-prd.md
 *
 * Used for:
 * - Empty search results
 * - No items in a list
 * - First-time user states
 * - Error states with recovery actions
 */

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center",
  {
    variants: {
      size: {
        sm: "py-8 gap-3",
        default: "py-12 gap-4",
        lg: "py-16 gap-5",
        full: "min-h-[400px] gap-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const emptyStateIconVariants = cva(
  "flex items-center justify-center rounded-full bg-secondary text-muted-foreground",
  {
    variants: {
      size: {
        sm: "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5",
        default: "h-12 w-12 [&>svg]:h-6 [&>svg]:w-6",
        lg: "h-16 w-16 [&>svg]:h-8 [&>svg]:w-8",
        full: "h-16 w-16 [&>svg]:h-8 [&>svg]:w-8",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  variant?: "default" | "secondary" | "outline" | "ghost" | "accent"
}

interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  secondaryAction,
  size,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(emptyStateVariants({ size }), className)}
      {...props}
    >
      <div className={cn(emptyStateIconVariants({ size }))}>
        <Icon />
      </div>

      <div className="space-y-1">
        <h3 className="text-heading-sm text-foreground">{title}</h3>
        {description && (
          <p className="text-body-sm text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {action && (
            <Button
              variant={action.variant || "default"}
              onClick={action.onClick}
              asChild={!!action.href}
            >
              {action.href ? (
                <a href={action.href}>{action.label}</a>
              ) : (
                action.label
              )}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || "ghost"}
              onClick={secondaryAction.onClick}
              asChild={!!secondaryAction.href}
            >
              {secondaryAction.href ? (
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              ) : (
                secondaryAction.label
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export { EmptyState, emptyStateVariants }
