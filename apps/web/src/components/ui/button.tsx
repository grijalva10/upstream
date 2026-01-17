import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button component variants based on design-system-prd.md
 *
 * Hierarchy:
 * - Primary: Filled, dark - Main actions
 * - Secondary: Outlined - Alternative actions
 * - Ghost: Text only - Tertiary actions
 * - Danger: Red filled - Destructive actions
 * - Accent: Blue filled - Accent/highlight actions
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // Primary: Filled dark background
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        // Secondary: Outlined
        secondary:
          "border border-border bg-transparent text-foreground hover:bg-secondary active:bg-secondary/80",
        // Ghost: Text only
        ghost:
          "text-foreground hover:bg-secondary active:bg-secondary/80",
        // Danger/Destructive: Red
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive",
        // Accent: Blue primary action
        accent:
          "bg-accent-blue text-white hover:bg-blue-600 active:bg-blue-700 focus-visible:ring-accent-blue",
        // Outline variant (different from secondary)
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        // Link style
        link: "text-accent-blue underline-offset-4 hover:underline",
        // Success variant
        success:
          "bg-accent-green text-white hover:bg-green-600 active:bg-green-700 focus-visible:ring-accent-green",
        // Warning variant
        warning:
          "bg-accent-orange text-white hover:bg-orange-600 active:bg-orange-700 focus-visible:ring-accent-orange",
      },
      size: {
        // Compact: 32px height
        sm: "h-8 rounded-md gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        // Default: 40px height
        default: "h-10 px-4 py-2 rounded-md text-sm has-[>svg]:px-3",
        // Large: 48px height
        lg: "h-12 rounded-lg px-6 text-base has-[>svg]:px-4",
        // Icon buttons
        icon: "size-10 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
