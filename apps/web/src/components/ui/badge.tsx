import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge component based on design-system-prd.md
 *
 * Variants include semantic colors from the design system:
 * - default: Primary (dark)
 * - secondary: Muted background
 * - accent/blue: Blue accent color
 * - success/green: Green for success states
 * - destructive/red: Red for errors/attention
 * - warning/orange: Orange for warnings
 * - outline: Border only
 */
const badgeVariants = cva(
  [
    "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5",
    "text-xs font-medium w-fit whitespace-nowrap shrink-0",
    "[&>svg]:size-3 gap-1 [&>svg]:pointer-events-none",
    "transition-colors",
  ],
  {
    variants: {
      variant: {
        // Primary (default)
        default:
          "border-transparent bg-primary text-primary-foreground",
        // Secondary/muted
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        // Blue accent
        accent:
          "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-200 dark:text-blue-100",
        blue:
          "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-200 dark:text-blue-100",
        // Green success
        success:
          "border-transparent bg-green-100 text-green-700 dark:bg-green-200 dark:text-green-100",
        green:
          "border-transparent bg-green-100 text-green-700 dark:bg-green-200 dark:text-green-100",
        // Red destructive
        destructive:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-200 dark:text-red-100",
        red:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-200 dark:text-red-100",
        // Orange warning
        warning:
          "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-200 dark:text-orange-100",
        orange:
          "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-200 dark:text-orange-100",
        // Purple (for special states)
        purple:
          "border-transparent bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
        // Outline (border only)
        outline:
          "border-border bg-transparent text-foreground",
      },
      size: {
        sm: "h-5 px-2 text-[10px]",
        default: "h-6 px-2.5 text-xs",
        lg: "h-7 px-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
