"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

interface ResizablePanelGroupProps extends React.ComponentProps<typeof Group> {
  orientation?: "horizontal" | "vertical"
}

function ResizablePanelGroup({
  className,
  orientation = "horizontal",
  ...props
}: ResizablePanelGroupProps) {
  return (
    <Group
      orientation={orientation}
      data-panel-group-direction={orientation}
      className={cn(
        "flex h-full w-full",
        orientation === "vertical" && "flex-col",
        className
      )}
      {...props}
    />
  )
}

interface ResizablePanelProps extends React.ComponentProps<typeof Panel> {
  className?: string
}

function ResizablePanel({ className, ...props }: ResizablePanelProps) {
  return (
    <Panel
      {...props}
      className={className}
    />
  )
}

interface ResizableHandleProps extends React.ComponentProps<typeof Separator> {
  withHandle?: boolean
  className?: string
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <Separator
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        "focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
