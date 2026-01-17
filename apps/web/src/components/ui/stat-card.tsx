"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * StatCard component for displaying metrics
 * Based on design-system-prd.md Metric Card pattern
 *
 * Features:
 * - Icon with semantic color
 * - Large metric value
 * - Optional trend indicator
 * - Optional subtitle/description
 * - Clickable variant with hover state
 */

const statCardVariants = cva(
  "rounded-xl border bg-card p-4 transition-all",
  {
    variants: {
      variant: {
        default: "shadow-card",
        flat: "",
        outline: "shadow-none",
      },
      status: {
        default: "",
        success: "border-green-200 dark:border-green-800",
        warning: "border-orange-200 dark:border-orange-800",
        error: "border-red-200 dark:border-red-800",
        info: "border-blue-200 dark:border-blue-800",
      },
      interactive: {
        true: "cursor-pointer hover:shadow-dropdown hover:border-border",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      status: "default",
      interactive: false,
    },
  }
)

const statIconVariants = cva(
  "flex h-9 w-9 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5",
  {
    variants: {
      status: {
        default: "bg-secondary text-foreground",
        success: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        warning: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
        error: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
)

interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof statCardVariants> {
  icon?: LucideIcon
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label?: string
  }
  href?: string
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  href,
  variant,
  status,
  className,
  ...props
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-caption text-muted-foreground truncate">{title}</p>
          <p className="text-heading-lg tabular-nums tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className={cn(statIconVariants({ status }))}>
            <Icon />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-caption">
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                trend.value > 0 && "text-green-600 dark:text-green-400",
                trend.value < 0 && "text-red-600 dark:text-red-400",
                trend.value === 0 && "text-muted-foreground"
              )}
            >
              {trend.value > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {trend.value > 0 ? "+" : ""}
              {trend.value}%
              {trend.label && (
                <span className="text-muted-foreground font-normal ml-1">
                  {trend.label}
                </span>
              )}
            </span>
          )}
          {subtitle && !trend && (
            <span className="text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          statCardVariants({ variant, status, interactive: true }),
          className
        )}
      >
        {content}
      </Link>
    )
  }

  return (
    <div
      className={cn(
        statCardVariants({ variant, status, interactive: !!props.onClick }),
        className
      )}
      {...props}
    >
      {content}
    </div>
  )
}

export { StatCard, statCardVariants, statIconVariants }
