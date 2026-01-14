"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  CircleHelp,
  Clock,
  Database,
  DollarSign,
  FileEdit,
  HelpCircle,
  Inbox,
  Loader2,
  Mail,
  MailX,
  RefreshCw,
  Send,
  ShieldAlert,
  UserPlus,
  XCircle,
} from "lucide-react";
import { type FilterType, type FolderType } from "./use-mail";

interface FolderItem {
  id: FolderType;
  label: string;
  icon: React.ElementType;
}

const folderItems: FolderItem[] = [
  { id: "all", label: "All Mail", icon: Mail },
  { id: "Inbox", label: "Inbox", icon: Inbox },
  { id: "Sent Items", label: "Sent", icon: Send },
  { id: "Archive", label: "Archive", icon: Archive },
  { id: "Drafts", label: "Drafts", icon: FileEdit },
  { id: "Junk Email", label: "Junk", icon: ShieldAlert },
];

interface FilterItem {
  id: FilterType;
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
    title: "Action Needed",
    items: [
      { id: "needs_review", label: "Needs Review", icon: AlertCircle, colorClass: "text-amber-500" },
      { id: "question", label: "Questions", icon: HelpCircle, colorClass: "text-blue-500" },
    ],
  },
  {
    title: "Positive",
    items: [
      { id: "interested", label: "Interested", icon: CheckCircle2, colorClass: "text-green-500" },
      { id: "pricing_given", label: "Pricing", icon: DollarSign, colorClass: "text-green-500" },
      { id: "referral", label: "Referrals", icon: UserPlus, colorClass: "text-purple-500" },
    ],
  },
  {
    title: "Neutral",
    items: [
      { id: "ooo", label: "OOO", icon: Calendar, colorClass: "text-slate-500" },
      { id: "unclear", label: "Unclear", icon: CircleHelp, colorClass: "text-amber-500" },
      { id: "stale_data", label: "Stale", icon: Database, colorClass: "text-slate-500" },
    ],
  },
  {
    title: "Negative",
    items: [
      { id: "soft_pass", label: "Soft Pass", icon: Clock, colorClass: "text-gray-500" },
      { id: "broker_redirect", label: "Broker", icon: Building2, colorClass: "text-orange-500" },
      { id: "hard_pass", label: "Hard Pass", icon: XCircle, colorClass: "text-red-500" },
      { id: "bounce", label: "Bounces", icon: MailX, colorClass: "text-red-500" },
    ],
  },
];

interface MailSidebarProps {
  folder: FolderType;
  filter: FilterType;
  counts: Record<string, number>;
  folderCounts: Record<string, number>;
  onFolderChange: (folder: FolderType) => void;
  onFilterChange: (filter: FilterType) => void;
}

export function MailSidebar({
  folder,
  filter,
  counts,
  folderCounts,
  onFolderChange,
  onFilterChange,
}: MailSidebarProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ newEmails: number } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/inbox/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ newEmails: data.newEmails });
        // Refresh the page to show new emails
        if (data.newEmails > 0) {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

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
        {/* Sync Button */}
        <div className={cn("p-2 border-b", isCollapsed ? "flex justify-center" : "")}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="h-8 w-8"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isSyncing ? "Syncing..." : "Sync emails"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Emails
                </>
              )}
            </Button>
          )}
          {syncResult && !isSyncing && syncResult.newEmails === 0 && !isCollapsed && (
            <p className="text-xs text-muted-foreground text-center mt-1">
              Already up to date
            </p>
          )}
        </div>

        <ScrollArea className="flex-1 h-full">
          <div className={cn("py-4", isCollapsed ? "px-2" : "px-4")}>
            {/* Folders Section */}
            {!isCollapsed && (
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                Folders
              </h2>
            )}
            <div className={cn("mb-4", isCollapsed ? "space-y-1" : "space-y-1")}>
              {folderItems.map((item) => {
                const count = folderCounts[item.id] || 0;
                const isActive = folder === item.id;
                const Icon = item.icon;

                const button = (
                  <button
                    key={item.id}
                    onClick={() => onFolderChange(item.id)}
                    className={cn(
                      "w-full flex items-center rounded-md text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent text-accent-foreground font-medium",
                      isCollapsed ? "justify-center p-2" : "justify-between px-2 py-1.5"
                    )}
                  >
                    {isCollapsed ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <>
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon className="h-4 w-4 flex-shrink-0" />
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

            <Separator className="mb-4" />

            {/* Classifications Section */}
            {!isCollapsed && (
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
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
                      const count = counts[item.id] || 0;
                      const isActive = filter === item.id;
                      const Icon = item.icon;

                      const button = (
                        <button
                          key={item.id}
                          onClick={() => onFilterChange(item.id)}
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
          {/* Bottom padding to ensure last items aren't cut off */}
          <div className="h-8" />
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
