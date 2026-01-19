"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface PropertyLoan {
  id: string;
  lender_name: string | null;
  loan_type: string | null;
  original_amount: number | null;
  current_balance: number | null;
  origination_date: string | null;
  maturity_date: string | null;
  interest_rate: number | null;
  interest_rate_type: string | null;
  ltv_current: number | null;
  dscr_current: number | null;
  payment_status: string | null;
}

interface Property {
  id: string;
  address: string | null;
  city: string | null;
  state_code: string | null;
  property_type: string | null;
  property_name: string | null;
  building_size_sqft: number | null;
  lot_size_acres: number | null;
  year_built: number | null;
  building_class: string | null;
  percent_leased: number | null;
  relationship: string;
  loans: PropertyLoan[];
}

interface PropertiesCardProps {
  properties: Property[];
}

function formatSqft(sqft: number | null): string {
  if (!sqft) return "-";
  if (sqft >= 1000) {
    return `${(sqft / 1000).toFixed(0)}K SF`;
  }
  return `${sqft.toLocaleString()} SF`;
}

function formatAcres(acres: number | null): string {
  if (!acres) return "-";
  return `${acres.toFixed(2)} acres`;
}

function formatPercent(pct: number | null): string {
  if (pct === null || pct === undefined) return "-";
  return `${pct.toFixed(0)}%`;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatRate(rate: number | null): string {
  if (rate === null || rate === undefined) return "-";
  return `${rate.toFixed(2)}%`;
}

function PropertyItem({ property }: { property: Property }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left hover:bg-muted/30 rounded p-2 -m-2 transition-colors"
      >
        <div className="flex items-start gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">
                {property.property_name || property.address || "Unknown"}
              </p>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                · {property.relationship}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {property.property_type || "Unknown type"}
              {property.building_size_sqft && ` · ${formatSqft(property.building_size_sqft)}`}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 ml-6 space-y-4">
          {/* Property Details */}
          <table className="text-sm w-full">
            <tbody>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Address</td>
                <td className="py-0.5">{property.address || "-"}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">City</td>
                <td className="py-0.5">{[property.city, property.state_code].filter(Boolean).join(", ") || "-"}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Type</td>
                <td className="py-0.5">{property.property_type || "-"}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Class</td>
                <td className="py-0.5">{property.building_class || "-"}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Building</td>
                <td className="py-0.5">{formatSqft(property.building_size_sqft)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Lot</td>
                <td className="py-0.5">{formatAcres(property.lot_size_acres)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Year Built</td>
                <td className="py-0.5">{property.year_built || "-"}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-4 py-0.5">Leased</td>
                <td className="py-0.5">{formatPercent(property.percent_leased)}</td>
              </tr>
            </tbody>
          </table>

          {/* Loan Info */}
          {property.loans && property.loans.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Loan {property.loans.length > 1 ? `(${property.loans.length})` : ""}
              </p>
              {property.loans.map((loan, idx) => (
                <table key={loan.id} className={`text-sm w-full ${idx > 0 ? "mt-3 pt-3 border-t" : ""}`}>
                  <tbody>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Lender</td>
                      <td className="py-0.5">{loan.lender_name || "-"}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Type</td>
                      <td className="py-0.5 capitalize">{loan.loan_type || "-"}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Original</td>
                      <td className="py-0.5">{formatCurrency(loan.original_amount)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Balance</td>
                      <td className="py-0.5">{formatCurrency(loan.current_balance)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Rate</td>
                      <td className="py-0.5">
                        {formatRate(loan.interest_rate)}
                        {loan.interest_rate_type && ` (${loan.interest_rate_type})`}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Originated</td>
                      <td className="py-0.5">{formatDate(loan.origination_date)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Maturity</td>
                      <td className="py-0.5">{formatDate(loan.maturity_date)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">LTV</td>
                      <td className="py-0.5">{formatPercent(loan.ltv_current)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">DSCR</td>
                      <td className="py-0.5">{loan.dscr_current?.toFixed(2) || "-"}</td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground pr-4 py-0.5">Status</td>
                      <td className="py-0.5 capitalize">{loan.payment_status?.replace(/_/g, " ") || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              ))}
            </div>
          )}

          {property.loans && property.loans.length === 0 && (
            <p className="text-xs text-muted-foreground">No loan data</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PropertiesCard({ properties }: PropertiesCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-muted/40 border-b">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Properties
        </h3>
      </div>

      {properties.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">
          No properties yet
        </p>
      ) : (
        <div className="p-4 space-y-2">
          {properties.map((property) => (
            <PropertyItem key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
