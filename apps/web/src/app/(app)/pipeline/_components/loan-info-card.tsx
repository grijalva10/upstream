"use client";

import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditableField } from "./editable-field";
import { createFieldUpdater } from "@/lib/deals/utils";
import type { Deal } from "@/lib/deals/schema";

interface LoanInfoCardProps {
  deal: Deal;
}

export function LoanInfoCard({ deal }: LoanInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          Loan Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditableField
            label="Loan Amount"
            value={deal.loan_amount}
            type="currency"
            placeholder="Enter loan amount"
            onSave={createFieldUpdater(deal.id, "loan_amount")}
          />

          <EditableField
            label="Maturity Date"
            value={deal.loan_maturity}
            type="date"
            onSave={createFieldUpdater(deal.id, "loan_maturity")}
          />

          <EditableField
            label="Interest Rate (%)"
            value={deal.loan_rate}
            type="number"
            placeholder="e.g., 5.25"
            onSave={createFieldUpdater(deal.id, "loan_rate")}
          />

          <EditableField
            label="Lender Name"
            value={deal.lender_name}
            type="text"
            placeholder="e.g., Wells Fargo"
            onSave={createFieldUpdater(deal.id, "lender_name")}
          />
        </div>
      </CardContent>
    </Card>
  );
}
