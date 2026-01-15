"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Archive,
  Building2,
  CheckCircle2,
  CircleHelp,
  DollarSign,
  HelpCircle,
  Inbox,
  Mail,
  MailX,
  Phone,
  ShoppingCart,
  UserX,
  XCircle,
  Ban,
} from "lucide-react";
import { type Classification, type Status } from "@/lib/inbox/schemas";

type StatusFilter = Status | "all";
type ClassificationFilter = Classification | "all";

interface StatusItem {
  id: StatusFilter;
  label: string;
}

const statusItems: StatusItem[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "reviewed", label: "Reviewed" },
  { id: "actioned", label: "Actioned" },
];

interface FilterItem {
  id: ClassificationFilter;
  label: string;
  icon: React.ElementType;
  colorClass: string;
}

const filterGroups: { title: string; items: FilterItem[] }[] = [
  {
    title: "All",
    items: [
      { id: "all", label: "All", icon: Mail, colorClass: "text-foreground" },
    ],
  },
  {
    title: "Hot Leads",
    items: [
      { id: "interested", label: "Interested", icon: CheckCircle2, colorClass: "text-green-500" },
      { id: "wants_offer", label: "Wants Offer", icon: DollarSign, colorClass: "text-green-500" },
      { id: "wants_to_buy", label: "Wants to Buy", icon: ShoppingCart, colorClass: "text-blue-500" },
    ],
  },
  {
    title: "Action Required",
    items: [
      { id: "schedule_call", label: "Schedule Call", icon: Phone, colorClass: "text-purple-500" },
      { id: "question", label: "Question", icon: HelpCircle, colorClass: "text-yellow-500" },
      { id: "unclassified", label: "Unclassified", icon: CircleHelp, colorClass: "text-gray-500" },
    ],
  },
  {
    title: "Closed",
    items: [
      { id: "not_interested", label: "Not Interested", icon: XCircle, colorClass: "text-gray-500" },
      { id: "wrong_contact", label: "Wrong Contact", icon: UserX, colorClass: "text-orange-500" },
      { id: "broker_redirect", label: "Broker", icon: Building2, colorClass: "text-orange-500" },
      { id: "dnc", label: "DNC", icon: Ban, colorClass: "text-red-500" },
      { id: "bounce", label: "Bounce", icon: MailX, colorClass: "text-red-500" },
    ],
  },
];

interface MailSidebarProps {
  statusFilter: StatusFilter;
  classificationFilter: ClassificationFilter;
  statusCounts: Record<string, number>;
  classificationCounts: Record<string, number>;
  onStatusChange: (status: StatusFilter) => void;
  onClassificationChange: (filter: ClassificationFilter) => void;
}

export function MailSidebar({
  statusFilter,
  classificationFilter,
  statusCounts,
  classificationCounts,
  onStatusChange,
  onClassificationChange,
}: MailSidebarProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCollapsed(entry.contentRect.width < 120);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <div ref={containerRef} className="flex h-full flex-col bg-muted/30 overflow-hidden">
        {/* Status Tabs */}
        <div className={cn("p-2 border-b", isCollapsed ? "space-y-1" : "")}>
          {!isCollapsed && (
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-2">
              Status
            </h2>
          )}
          <div className={cn(isCollapsed ? "space-y-1" : "grid grid-cols-2 gap-1")}>
            {statusItems.map((item) => {
              const count = statusCounts[item.id] || 0;
              const isActive = statusFilter === item.id;

              const button = (
                <button
                  key={item.id}
                  onClick={() => onStatusChange(item.id)}
                  className={cn(
                    "flex items-center rounded-md text-xs transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground font-medium",
                    isCollapsed
                      ? "justify-center p-2 w-full"
                      : "justify-between px-2 py-1.5 w-full"
                  )}
                >
                  {isCollapsed ? (
                    <span className="font-medium">{item.label.charAt(0)}</span>
                  ) : (
                    <>
                      <span>{item.label}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "text-[10px] tabular-nums ml-1",
                            isActive ? "text-accent-foreground" : "text-muted-foreground"
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      <span>{item.label}</span>
                      {count > 0 && <span className="ml-1 text-muted-foreground">({count})</span>}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })}
          </div>
        </div>

        <ScrollArea className="flex-1 h-full">
          <div className={cn("py-4", isCollapsed ? "px-2" : "px-4")}>
            {/* Classifications Section */}
            {!isCollapsed && (
              <h2 className="text-xs font-semibold text-muted-foreground mb-2">
                Classification
              </h2>
            )}
            <div className="space-y-3">
              {filterGroups.map((group, groupIndex) => (
                <div key={group.title}>
                  {groupIndex > 0 && !isCollapsed && <Separator className="mb-3" />}
                  {group.title !== "All" && !isCollapsed && (
                    <p className="mb-1.5 px-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {group.title}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const count = classificationCounts[item.id] || 0;
                      const isActive = classificationFilter === item.id;
                      const Icon = item.icon;

                      const button = (
                        <button
                          key={item.id}
                          onClick={() => onClassificationChange(item.id)}
                          className={cn(
                            "w-full flex items-center rounded-md text-sm transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            isActive && "bg-accent text-accent-foreground font-medium",
                            isCollapsed ? "justify-center p-2" : "justify-between px-2 py-1"
                          )}
                        >
                          {isCollapsed ? (
                            <Icon className={cn("h-4 w-4", item.colorClass)} />
                          ) : (
                            <>
                              <span className="flex items-center gap-2 min-w-0">
                                <Icon className={cn("h-4 w-4 flex-shrink-0", item.colorClass)} />
                                <span className="truncate">{item.label}</span>
                              </span>
                              {count > 0 && (
                                <span
                                  className={cn(
                                    "text-xs tabular-nums ml-2 flex-shrink-0",
                                    isActive ? "text-accent-foreground" : "text-muted-foreground"
                                  )}
                                >
                                  {count}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );

                      if (isCollapsed) {
                        return (
                          <Tooltip key={item.id}>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right">
                              <span>{item.label}</span>
                              {count > 0 && <span className="ml-1 text-muted-foreground">({count})</span>}
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return button;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-8" />
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
