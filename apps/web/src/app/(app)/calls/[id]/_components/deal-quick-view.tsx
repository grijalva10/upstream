"use client";

import Link from "next/link";
import { ExternalLink, DollarSign, TrendingUp, Target, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/format";

interface DealQuickViewProps {
  deal: {
    id: string;
    display_id?: string;
    asking_price?: number;
    noi?: number;
    cap_rate?: number;
    motivation?: string;
    timeline?: string;
    decision_maker_confirmed?: boolean;
    status?: string;
    property?: {
      id: string;
      address: string;
      city: string;
      state_code: string;
      property_type?: string;
      sqft?: number;
    };
  } | null;
  contact: {
    id: string;
    name: string | null;
    company?: {
      name: string;
    };
  };
}

const statusColors: Record<string, string> = {
  qualifying: "bg-blue-100 text-blue-800",
  qualified: "bg-green-100 text-green-800",
  packaged: "bg-purple-100 text-purple-800",
  handed_off: "bg-amber-100 text-amber-800",
  closed: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

export function DealQuickView({ deal, contact }: DealQuickViewProps) {
  if (!deal) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm mb-3">No deal linked to this call</p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/pipeline/new?contact_id=${contact.id}`}>
                Create Deal
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const capRate = deal.cap_rate || (deal.noi && deal.asking_price
    ? (deal.noi / deal.asking_price) * 100
    : null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">
            {deal.display_id || "Deal"}
          </CardTitle>
          {deal.status && (
            <Badge
              variant="outline"
              className={statusColors[deal.status] || ""}
            >
              {deal.status}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/pipeline/${deal.id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {deal.property && (
          <div className="text-sm">
            <p className="font-medium">{deal.property.address}</p>
            <p className="text-muted-foreground">
              {deal.property.city}, {deal.property.state_code}
            </p>
            <p className="text-muted-foreground">
              {deal.property.property_type}
              {deal.property.sqft && ` • ${formatNumber(deal.property.sqft)} SF`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Asking</p>
              <p className="font-medium">{formatCurrency(deal.asking_price)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">NOI</p>
              <p className="font-medium">{formatCurrency(deal.noi)}</p>
            </div>
          </div>
          {capRate && (
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cap Rate</p>
                <p className="font-medium">{capRate.toFixed(2)}%</p>
              </div>
            </div>
          )}
          {deal.timeline && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Timeline</p>
                <p className="font-medium">{deal.timeline}</p>
              </div>
            </div>
          )}
        </div>

        {deal.motivation && (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground mb-1">Motivation</p>
            <p>{deal.motivation}</p>
          </div>
        )}

        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">Qualification</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!deal.asking_price}
                disabled
                className="h-4 w-4"
              />
              <span className={!deal.asking_price ? "text-muted-foreground" : ""}>
                Asking price confirmed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!deal.noi}
                disabled
                className="h-4 w-4"
              />
              <span className={!deal.noi ? "text-muted-foreground" : ""}>
                NOI / financials
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!deal.motivation}
                disabled
                className="h-4 w-4"
              />
              <span className={!deal.motivation ? "text-muted-foreground" : ""}>
                Motivation understood
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!deal.timeline}
                disabled
                className="h-4 w-4"
              />
              <span className={!deal.timeline ? "text-muted-foreground" : ""}>
                Timeline established
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!deal.decision_maker_confirmed}
                disabled
                className="h-4 w-4"
              />
              <span className={!deal.decision_maker_confirmed ? "text-muted-foreground" : ""}>
                Decision maker confirmed
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
