import type { Deal } from "./schema";
import { QUALIFICATION_FIELDS } from "./constants";
import { updateDeal } from "./actions";

// Create a bound update function for a specific deal field
export function createFieldUpdater(dealId: string, field: string) {
  return async (value: string | number | boolean | null) => {
    return updateDeal(dealId, { [field]: value });
  };
}

// Calculate qualification progress
export function getQualificationProgress(deal: Deal) {
  let completed = 0;
  if (deal.asking_price !== null) completed++;
  if (deal.noi !== null) completed++;
  if (deal.motivation) completed++;
  if (deal.timeline) completed++;
  if (deal.decision_maker_confirmed) completed++;
  if (deal.price_realistic !== null) completed++;
  return { completed, total: QUALIFICATION_FIELDS.length };
}

// Check if fully qualified
export function isQualified(deal: Deal) {
  const { completed, total } = getQualificationProgress(deal);
  return completed === total;
}

// Calculate days since last update
export function getDaysInStage(updatedAt: string) {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / 86400000);
}

// Format price for display
export function formatPrice(price: number | null) {
  if (price === null) return null;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toFixed(0)}`;
}

// Format relative time
export function formatRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Group deals by status
export function groupByStatus(deals: Deal[]) {
  return deals.reduce(
    (acc, deal) => {
      (acc[deal.status] ??= []).push(deal);
      return acc;
    },
    {} as Record<string, Deal[]>
  );
}
