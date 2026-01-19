"use client";

interface Deal {
  id: string;
  display_id: string | null;
  status: string;
  asking_price: number | null;
  noi: number | null;
  cap_rate: number | null;
  motivation: string | null;
  timeline: string | null;
  property: {
    address: string | null;
    property_type: string | null;
  } | null;
}

interface DealsCardProps {
  deals: Deal[];
}

function formatCurrency(amount: number | null): string {
  if (!amount) return "-";
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function DealsCard({ deals }: DealsCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-muted/40 border-b">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Deals
        </h3>
      </div>

      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">
          No deals yet
        </p>
      ) : (
        <div className="p-4 space-y-3">
          {deals.map((deal) => (
            <div key={deal.id}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {deal.display_id || `Deal ${deal.id.slice(0, 8)}`}
                </p>
                <span className="text-xs text-muted-foreground">
                  · {deal.status}
                </span>
              </div>
              {deal.property && (
                <p className="text-xs text-muted-foreground truncate">
                  {deal.property.address || "No address"}
                  {deal.property.property_type && ` · ${deal.property.property_type}`}
                </p>
              )}
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {deal.asking_price && (
                  <span>{formatCurrency(deal.asking_price)}</span>
                )}
                {deal.cap_rate && (
                  <span>· {deal.cap_rate.toFixed(1)}% cap</span>
                )}
                {deal.timeline && (
                  <span>· {deal.timeline}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
