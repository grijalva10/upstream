"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/searches", icon: Search, label: "Searches" },
  { href: "/campaigns", icon: Send, label: "Campaigns" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/pipeline", icon: Kanban, label: "Pipeline" },
  { href: "/calls", icon: Phone, label: "Calls" },
  { href: "/data", icon: Database, label: "Data" },
  { href: "/jobs", icon: Layers, label: "Jobs" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="h-full w-12 border-r bg-background flex flex-col flex-shrink-0">
      <div className="flex h-full flex-col items-center py-4">
        {/* Logo */}
        <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
          U
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-2">
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
                        "flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent",
                        isActive && "bg-accent text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* User menu at bottom */}
        <div className="flex flex-col items-center gap-2">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Sign out</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[10px]">JG</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </aside>
  );
}
