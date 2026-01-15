/**
 * Formatting utilities for currency, numbers, and display values.
 */

export function formatCurrency(
  amount: number | undefined | null,
  fallback = "-"
): string {
  if (!amount) return fallback;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(
  num: number | undefined | null,
  fallback = "-"
): string {
  if (!num) return fallback;
  return new Intl.NumberFormat("en-US").format(num);
}
