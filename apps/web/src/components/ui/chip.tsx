"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Chip/Tag component based on design-system-prd.md
 *
 * Specifications:
 * - Height: 28px
 * - Padding: 4px 12px
 * - Border radius: 14px (pill)
 * - Active: filled background
 * - Inactive: outlined
 */
const chipVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-all cursor-default",
  {
    variants: {
      variant: {
        // Outlined (inactive)
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        // Filled (active/selected)
        filled: "bg-primary text-primary-foreground",
        // Accent variants
        blue: "bg-blue-100 text-blue-700 dark:bg-blue-200 dark:text-blue-100",
        green:
          "bg-green-100 text-green-700 dark:bg-green-200 dark:text-green-100",
        red: "bg-red-100 text-red-700 dark:bg-red-200 dark:text-red-100",
        orange:
          "bg-orange-100 text-orange-700 dark:bg-orange-200 dark:text-orange-100",
        // Muted/subtle
        muted: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "h-6 px-2 text-xs",
        default: "h-7 px-3 text-sm",
        lg: "h-8 px-4 text-sm",
      },
      interactive: {
        true: "cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
      interactive: false,
    },
  }
)

interface ChipProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof chipVariants> {
  onRemove?: () => void
  removable?: boolean
}

function Chip({
  className,
  variant,
  size,
  interactive,
  children,
  onRemove,
  removable = false,
  onClick,
  ...props
}: ChipProps) {
  return (
    <div
      data-slot="chip"
      role={interactive || onClick ? "button" : undefined}
      tabIndex={interactive || onClick ? 0 : undefined}
      className={cn(
        chipVariants({ variant, size, interactive: interactive || !!onClick }),
        removable && "pr-1.5",
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }}
      {...props}
    >
      {children}
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove?.()
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export { Chip, chipVariants }
