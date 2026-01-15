/**
 * Data transformation utilities for Supabase query results.
 * Supabase returns single-relation results as arrays, so we need to flatten them.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Unwraps an array to its first element or returns the value as-is.
 */
function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

/**
 * Transforms a Supabase call result to flatten single-item arrays into objects.
 * Handles contact, contact.company, deal, and deal.property relations.
 */
export function transformCall(call: any): any {
  const contact = unwrap(call.contact);
  const deal = unwrap(call.deal);

  return {
    ...call,
    contact: contact
      ? {
          ...contact,
          company: unwrap(contact.company),
        }
      : null,
    deal: deal
      ? {
          ...deal,
          property: unwrap(deal.property),
          company: unwrap(deal.company),
        }
      : null,
  };
}

/**
 * Transforms an array of Supabase call results.
 */
export function transformCalls(calls: any[]): any[] {
  return calls.map(transformCall);
}
