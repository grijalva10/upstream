import Link from "next/link";
import { Cog, ChevronRight } from "lucide-react";

const settingsSections = [
  {
    href: "/settings/worker",
    icon: Cog,
    title: "Worker",
    description: "Background job worker, rate limits, and job intervals",
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Application configuration
        </p>
      </div>
      <div className="space-y-2">
        {settingsSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <section.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">{section.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
