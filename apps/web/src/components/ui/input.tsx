import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Input component based on design-system-prd.md
 *
 * Specifications:
 * - Height: 40px (default), 32px (compact)
 * - Padding: 12px horizontal
 * - Border: 1px solid border-default
 * - Border radius: 8px
 * - Focus: 2px ring with accent color
 */
const inputVariants = cva(
  [
    "flex w-full min-w-0 rounded-md border bg-background text-foreground",
    "placeholder:text-muted-foreground",
    "transition-all duration-150",
    "outline-none",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    // Focus state
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-ring",
    // Invalid state
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
    // File input styles
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  ],
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 text-sm",
        default: "h-10 px-3 text-sm",
        lg: "h-12 px-4 text-base",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  }
)

interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

function Input({ className, type, inputSize, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
