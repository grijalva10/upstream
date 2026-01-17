"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, LogOut, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { useAISheet } from "@/components/ai-sheet";

export function HeaderActions(): ReactNode {
  const router = useRouter();
  const { toggle } = useAISheet();

  async function handleSignOut(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">AI</span>
              <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">Cmd</span>J
              </kbd>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open AI Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="ghost" size="icon" onClick={toggle} className="sm:hidden h-8 w-8">
        <Sparkles className="h-4 w-4" />
        <span className="sr-only">AI Assistant</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search...</span>
        <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8">
        <Search className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8 relative">
        <Bell className="h-4 w-4" />
        <span className="sr-only">Notifications</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-[10px]">JG</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
