import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MetricCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  href?: string;
  variant?: "default" | "warning" | "success";
  children?: React.ReactNode;
}

export function MetricCard({
  title,
  count,
  icon: Icon,
  href,
  variant = "default",
  children,
}: MetricCardProps) {
  const content = (
    <Card
      className={cn(
        "transition-colors",
        href && "hover:bg-accent/50 cursor-pointer"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "h-4 w-4",
                variant === "warning" && "text-amber-500",
                variant === "success" && "text-green-500"
              )}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {title}
            </span>
          </div>
          <span
            className={cn(
              "text-2xl font-bold",
              variant === "warning" && "text-amber-500",
              variant === "success" && "text-green-500"
            )}
          >
            {count}
          </span>
        </div>
        {children}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
