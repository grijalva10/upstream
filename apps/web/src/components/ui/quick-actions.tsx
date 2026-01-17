"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * QuickActions component for Agentic UI
 * Based on design-system-prd.md Quick Actions pattern
 *
 * Provides contextual AI actions that users can invoke with one click:
 * - Draft a Reply
 * - Summarize
 * - Regenerate
 * - Approve
 */

const quickActionVariants = cva(
  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-foreground hover:bg-secondary/80 active:bg-secondary/60",
        accent:
          "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-200 dark:text-blue-100 dark:hover:bg-blue-300",
        ghost:
          "text-foreground hover:bg-secondary active:bg-secondary/80",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
      },
      size: {
        sm: "px-2.5 py-2 text-xs",
        default: "px-3 py-2.5 text-sm",
        lg: "px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface QuickAction {
  id: string
  label: string
  icon?: LucideIcon
  description?: string
  shortcut?: string
}

interface QuickActionButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof quickActionVariants> {
  action: QuickAction
}

function QuickActionButton({
  action,
  variant,
  size,
  className,
  ...props
}: QuickActionButtonProps) {
  const Icon = action.icon

  return (
    <button
      type="button"
      className={cn(quickActionVariants({ variant, size }), className)}
      title={action.description}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span>{action.label}</span>
      {action.shortcut && (
        <kbd className="ml-auto rounded bg-black/5 px-1.5 py-0.5 text-xs text-muted-foreground dark:bg-white/10">
          {action.shortcut}
        </kbd>
      )}
    </button>
  )
}

interface QuickActionsProps {
  actions: QuickAction[]
  onAction: (action: QuickAction) => void
  variant?: VariantProps<typeof quickActionVariants>["variant"]
  size?: VariantProps<typeof quickActionVariants>["size"]
  orientation?: "horizontal" | "vertical"
  className?: string
}

function QuickActions({
  actions,
  onAction,
  variant = "default",
  size = "default",
  orientation = "vertical",
  className,
}: QuickActionsProps) {
  return (
    <div
      className={cn(
        "flex gap-2",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
        className
      )}
      role="group"
      aria-label="Quick actions"
    >
      {actions.map((action) => (
        <QuickActionButton
          key={action.id}
          action={action}
          variant={variant}
          size={size}
          onClick={() => onAction(action)}
        />
      ))}
    </div>
  )
}

export { QuickActions, QuickActionButton, quickActionVariants }
