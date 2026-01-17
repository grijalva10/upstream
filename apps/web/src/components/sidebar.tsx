"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Send,
  Inbox,
  Kanban,
  Phone,
  Database,
  Layers,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Sidebar component based on design-system-prd.md
 *
 * Specifications:
 * - Width: 240px (expanded), 64px (collapsed) - Currently using icon-only (48px)
 * - Section headers: Overline style, uppercase
 * - Active indicator: Left border accent + filled background
 * - Icons: 20px, aligned left
 */

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  section?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Monitor",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/inbox", icon: Inbox, label: "Inbox" },
      { href: "/pipeline", icon: Kanban, label: "Pipeline" },
    ],
  },
  {
    title: "Orchestrate",
    items: [
      { href: "/searches", icon: Search, label: "Searches" },
      { href: "/campaigns", icon: Send, label: "Campaigns" },
      { href: "/calls", icon: Phone, label: "Calls" },
    ],
  },
  {
    title: "Delegate",
    items: [
      { href: "/data", icon: Database, label: "Data" },
      { href: "/jobs", icon: Layers, label: "Jobs" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

// Flat list for icon-only mode
const navItems = navSections.flatMap((section) => section.items);

interface SidebarProps {
  expanded?: boolean;
}

export function Sidebar({ expanded = false }: SidebarProps) {
  const pathname = usePathname();

  if (expanded) {
    // Expanded sidebar with sections
    return (
      <aside className="h-full w-60 border-r bg-sidebar flex flex-col flex-shrink-0">
        <div className="flex h-full flex-col py-4">
          {/* Logo */}
          <div className="mb-6 flex items-center gap-3 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              U
            </div>
            <span className="text-heading-sm text-sidebar-foreground">Upstream</span>
          </div>

          {/* Navigation sections */}
          <nav className="flex flex-1 flex-col px-3">
            {navSections.map((section) => (
              <div key={section.title} className="mb-6">
                {/* Section header */}
                <div className="mb-2 px-2 text-overline text-muted-foreground">
                  {section.title}
                </div>

                {/* Section items */}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 text-body-sm transition-colors",
                          "hover:bg-sidebar-accent text-sidebar-foreground",
                          isActive && [
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                            "border-l-2 border-accent-blue -ml-[2px] pl-[calc(0.5rem+2px)]",
                          ]
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    );
  }

  // Collapsed (icon-only) sidebar
  return (
    <aside className="h-full w-12 border-r bg-sidebar flex flex-col flex-shrink-0">
      <div className="flex h-full flex-col items-center py-4">
        {/* Logo */}
        <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          U
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                        "hover:bg-sidebar-accent text-sidebar-foreground",
                        isActive && [
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                          "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                          "before:h-5 before:w-0.5 before:rounded-r before:bg-accent-blue",
                        ]
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="shadow-dropdown">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>
      </div>
    </aside>
  );
}
