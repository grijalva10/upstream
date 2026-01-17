"use client"

import * as React from "react"
import { Check, ChevronDown, Sparkles, Zap, Brain } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * ModelSelector component for Agentic UI
 * Based on design-system-prd.md Model Selector Pattern
 *
 * Shows for each model:
 * - Provider icon
 * - Model name and version
 * - Power/capability rating
 * - Context window
 * - Primary use case (Reasoning, Balanced, Fast, Complex Tasks)
 */

export interface Model {
  id: string
  name: string
  provider: string
  powerRating: 1 | 2 | 3 | 4 | 5
  contextWindow: string
  useCase: "reasoning" | "balanced" | "fast" | "complex"
  isNew?: boolean
}

const useCaseLabels: Record<Model["useCase"], string> = {
  reasoning: "Reasoning",
  balanced: "Balanced",
  fast: "Fast",
  complex: "Complex Tasks",
}

const useCaseIcons: Record<Model["useCase"], React.ReactNode> = {
  reasoning: <Brain className="h-3.5 w-3.5" />,
  balanced: <Sparkles className="h-3.5 w-3.5" />,
  fast: <Zap className="h-3.5 w-3.5" />,
  complex: <Sparkles className="h-3.5 w-3.5" />,
}

interface ModelSelectorProps {
  models: Model[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

function PowerRating({ rating }: { rating: number }) {
  return (
    <span className="text-caption text-muted-foreground">
      Power {rating}/5
    </span>
  )
}

function ModelSelector({
  models,
  value,
  onValueChange,
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const selectedModel = models.find((m) => m.id === value)

  // Group models by provider
  const groupedModels = React.useMemo(() => {
    const groups: Record<string, Model[]> = {}
    models.forEach((model) => {
      if (!groups[model.provider]) {
        groups[model.provider] = []
      }
      groups[model.provider].push(model)
    })
    return groups
  }, [models])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
            "hover:bg-secondary transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-accent-blue text-white text-xs font-medium">
              AI
            </div>
            <span>{selectedModel?.name ?? "Select model..."}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0 shadow-dropdown"
        align="start"
      >
        <div className="max-h-[300px] overflow-y-auto">
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider}>
              {/* Provider header */}
              <div className="sticky top-0 bg-popover px-3 py-2 text-overline text-muted-foreground border-b">
                {provider}
              </div>

              {/* Models */}
              {providerModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onValueChange(model.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                    "hover:bg-secondary",
                    model.id === value && "bg-secondary"
                  )}
                >
                  {/* AI icon */}
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-accent-blue text-white text-xs font-medium shrink-0 mt-0.5">
                    AI
                  </div>

                  {/* Model info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
                      {model.isNew && (
                        <span className="rounded bg-accent-blue px-1.5 py-0.5 text-[10px] font-medium text-white uppercase">
                          New
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-caption text-muted-foreground">
                      <PowerRating rating={model.powerRating} />
                      <span>·</span>
                      <span>{model.contextWindow}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        {useCaseIcons[model.useCase]}
                        {useCaseLabels[model.useCase]}
                      </span>
                    </div>
                  </div>

                  {/* Check mark */}
                  {model.id === value && (
                    <Check className="h-4 w-4 text-accent-blue shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ModelSelector }
