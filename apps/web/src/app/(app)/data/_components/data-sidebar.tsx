"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Building2, MapPin, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/data/contacts", icon: Users, label: "Contacts" },
  { href: "/data/companies", icon: Building2, label: "Companies" },
  { href: "/data/properties", icon: MapPin, label: "Properties" },
  { href: "/data/exclusions", icon: Ban, label: "Exclusions" },
];

export function DataSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 border-r bg-background p-4 flex-shrink-0">
      <h2 className="font-semibold text-sm text-muted-foreground mb-4 uppercase tracking-wide">
        Data
      </h2>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
