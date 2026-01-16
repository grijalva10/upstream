import { format } from "date-fns";
import { formatCurrency, formatNumber } from "./format";

interface Contact {
  id: string;
  name: string | null;
  email?: string;
  phone?: string;
  title?: string;
}

interface Company {
  id: string;
  name: string;
  status?: string;
}

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  property_type?: string;
  sqft?: number;
  building_class?: string;
  year_built?: number;
}

interface Deal {
  id: string;
  display_id?: string;
  asking_price?: number;
  noi?: number;
  motivation?: string;
  timeline?: string;
  status?: string;
}

interface Activity {
  activity_type: string;
  description?: string;
  created_at: string;
}

interface CallPrepData {
  contact: Contact | null;
  company?: Company | null;
  property?: Property | null;
  deal?: Deal | null;
  scheduledAt?: string;
  recentActivity?: Activity[];
}

function formatActivityType(type: string): string {
  const typeMap: Record<string, string> = {
    email_sent: "Email sent",
    email_received: "Email received",
    call_scheduled: "Call scheduled",
    call_completed: "Call completed",
    doc_received: "Document received",
    status_change: "Status updated",
    note_added: "Note added",
    handed_off: "Handed off",
  };
  return typeMap[type] || type.replace(/_/g, " ");
}

export function generateCallPrep(data: CallPrepData): string {
  const { contact, company, property, deal, scheduledAt, recentActivity } = data;

  const sections: string[] = [];

  // Header
  if (property) {
    sections.push(`# Call Prep: ${property.address}`);
  } else if (contact) {
    sections.push(`# Call Prep: ${contact.name || "Unknown"}`);
  } else {
    sections.push("# Call Prep");
  }

  if (scheduledAt) {
    sections.push(`*Scheduled: ${format(new Date(scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a")}*`);
  }

  sections.push("");

  // Contact Information
  if (contact) {
    sections.push("## Contact Information");
    sections.push("");
    sections.push(`- **Name:** ${contact.name || "Unknown"}`);
    if (contact.title) {
      sections.push(`- **Title:** ${contact.title}`);
    }
    if (contact.phone) {
      sections.push(`- **Phone:** ${contact.phone}`);
    }
    if (contact.email) {
      sections.push(`- **Email:** ${contact.email}`);
    }
    sections.push("");
  }

  // Company Information
  if (company) {
    sections.push("## Company");
    sections.push("");
    sections.push(`- **Name:** ${company.name}`);
    if (company.status) {
      sections.push(`- **Status:** ${company.status}`);
    }
    sections.push("");
  }

  // Property Overview
  if (property) {
    sections.push("## Property Overview");
    sections.push("");
    sections.push(`- **Address:** ${property.address}, ${property.city}, ${property.state}${property.zip ? ` ${property.zip}` : ""}`);
    if (property.property_type) {
      sections.push(`- **Type:** ${property.property_type}`);
    }
    if (property.sqft) {
      sections.push(`- **Size:** ${formatNumber(property.sqft)} SF`);
    }
    if (property.building_class) {
      sections.push(`- **Class:** ${property.building_class}`);
    }
    if (property.year_built) {
      sections.push(`- **Year Built:** ${property.year_built}`);
    }
    sections.push("");
  }

  // Deal Information
  if (deal) {
    sections.push("## Deal Details");
    sections.push("");
    if (deal.display_id) {
      sections.push(`- **Deal ID:** ${deal.display_id}`);
    }
    sections.push(`- **Asking Price:** ${formatCurrency(deal.asking_price, "Not provided")}`);
    if (deal.noi) {
      sections.push(`- **NOI:** ${formatCurrency(deal.noi, "Not provided")}`);
      if (deal.asking_price && deal.noi) {
        const capRate = (deal.noi / deal.asking_price) * 100;
        sections.push(`- **Implied Cap Rate:** ${capRate.toFixed(2)}%`);
      }
    }
    if (deal.motivation) {
      sections.push(`- **Motivation:** ${deal.motivation}`);
    }
    if (deal.timeline) {
      sections.push(`- **Timeline:** ${deal.timeline}`);
    }
    if (deal.status) {
      sections.push(`- **Status:** ${deal.status}`);
    }
    sections.push("");
  }

  // Conversation History
  if (recentActivity && recentActivity.length > 0) {
    sections.push("## Conversation History");
    sections.push("");
    for (const activity of recentActivity.slice(0, 10)) {
      const date = format(new Date(activity.created_at), "MMM d");
      const type = formatActivityType(activity.activity_type);
      const desc = activity.description ? ` - ${activity.description}` : "";
      sections.push(`- **${date}:** ${type}${desc}`);
    }
    sections.push("");
  }

  // What We Know
  sections.push("## What We Know");
  sections.push("");
  if (deal) {
    sections.push(`- **Asking:** ${formatCurrency(deal.asking_price, "Not provided")}`);
    sections.push(`- **Motivation:** ${deal.motivation || "Unknown - need to confirm"}`);
    sections.push(`- **Timeline:** ${deal.timeline || "Unknown - need to confirm"}`);
  } else {
    sections.push("- *No deal created yet - this is an exploratory call*");
  }
  sections.push("");

  // Talking Points
  sections.push("## Talking Points");
  sections.push("");
  sections.push("1. **Confirm interest** - Verify they're still considering selling");
  sections.push("2. **Decision maker** - Confirm they have authority to transact");
  sections.push("3. **Motivation** - Understand why they're selling");
  sections.push("4. **Timeline** - When do they want to close?");
  sections.push("5. **Price expectations** - Discuss asking price and flexibility");
  sections.push("6. **Financials** - Request NOI, rent roll, operating statements");
  sections.push("7. **Loans** - Any existing debt on the property?");
  sections.push("");

  // Key Questions
  sections.push("## Key Questions to Ask");
  sections.push("");
  sections.push("- What's driving your decision to sell?");
  sections.push("- What timeline are you looking at?");
  sections.push("- Have you had any other offers or interest?");
  sections.push("- Is there a loan on the property? When does it mature?");
  sections.push("- Can you share the rent roll and recent operating statements?");
  sections.push("- Are there any tenants with renewal options or concerns?");
  sections.push("- What would make this deal not work for you?");
  sections.push("");

  // Qualification Checklist
  sections.push("## Qualification Checklist");
  sections.push("");
  sections.push("- [ ] Asking price confirmed");
  sections.push("- [ ] NOI / financials discussed");
  sections.push("- [ ] Motivation understood");
  sections.push("- [ ] Timeline established");
  sections.push("- [ ] Decision maker confirmed");
  sections.push("- [ ] Documents requested");

  return sections.join("\n");
}
