import { Badge } from "@/components/ui/badge";
import type { CriteriaJson } from "../../_lib/types";
import { parseCriteria, formatPriceRange, formatPercentRange } from "../../_lib/utils";

interface CriteriaSectionProps {
  criteria: CriteriaJson;
}

export function CriteriaSection({ criteria }: CriteriaSectionProps) {
  const parsed = parseCriteria(criteria);

  const hasMarkets = parsed.markets.length > 0;
  const hasPropertyTypes = parsed.propertyTypes.length > 0;
  const hasPriceRange = parsed.priceRange && (parsed.priceRange.min || parsed.priceRange.max);
  const hasCapRate = parsed.capRate && (parsed.capRate.min || parsed.capRate.max);
  const hasStrategy = Boolean(parsed.strategy);
  const hasDeadline = Boolean(parsed.deadline);
  const hasNotes = Boolean(parsed.notes);

  const isEmpty = !hasMarkets && !hasPropertyTypes && !hasPriceRange && !hasCapRate && !hasStrategy;

  if (isEmpty) {
    return null;
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Criteria</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {hasMarkets && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1.5">Markets</dt>
            <dd className="flex flex-wrap gap-1.5">
              {parsed.markets.map((market) => (
                <Badge key={market} variant="secondary" className="font-normal">
                  {market}
                </Badge>
              ))}
            </dd>
          </div>
        )}

        {hasPropertyTypes && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1.5">Property Types</dt>
            <dd className="flex flex-wrap gap-1.5">
              {parsed.propertyTypes.map((type) => (
                <Badge key={type} variant="outline" className="font-normal">
                  {type}
                </Badge>
              ))}
            </dd>
          </div>
        )}

        {hasPriceRange && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Price Range</dt>
            <dd className="text-sm font-medium">{formatPriceRange(parsed.priceRange)}</dd>
          </div>
        )}

        {hasCapRate && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Cap Rate</dt>
            <dd className="text-sm font-medium">{formatPercentRange(parsed.capRate)}</dd>
          </div>
        )}

        {hasStrategy && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Strategy</dt>
            <dd className="text-sm font-medium capitalize">{parsed.strategy}</dd>
          </div>
        )}

        {hasDeadline && (
          <div>
            <dt className="text-xs text-muted-foreground mb-1">Target Close</dt>
            <dd className="text-sm font-medium">
              {new Date(parsed.deadline!).toLocaleDateString()}
            </dd>
          </div>
        )}

        {hasNotes && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground mb-1">Notes</dt>
            <dd className="text-sm text-muted-foreground">{parsed.notes}</dd>
          </div>
        )}
      </div>
    </section>
  );
}
