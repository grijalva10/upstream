# Database Schema

## Core Entities

| Table | Purpose |
|-------|---------|
| `properties` | CRE assets (address, type, size, class, year built) |
| `leads` | Organizations we engage (status, source, assigned user) |
| `contacts` | People at leads (name, email, phone, title) |
| `deals` | Property opportunities being qualified |
| `property_loans` | Loan data (maturity, LTV, DSCR, payment status) |
| `property_leads` | Junction: property ↔ lead (owner/manager/lender) |

## Searches & Sourcing

| Table | Purpose |
|-------|---------|
| `searches` | Search profiles with criteria + CoStar payloads |
| `search_properties` | Junction: search ↔ property |

## Outreach

| Table | Purpose |
|-------|---------|
| `campaigns` | Email campaigns linked to searches |
| `enrollments` | Contact enrolled in campaign with step tracking |
| `activities` | All touchpoints (email, call, note, meeting) |
| `exclusions` | Unified exclusion list (email/phone/domain + reason) |
| `email_drafts` | Approval queue for AI-generated emails |

## Email Sync

| Table | Purpose |
|-------|---------|
| `email_sync_state` | Outlook sync cursor (folder, last_sync_at) |
| `synced_emails` | Raw emails synced from Outlook |

## Qualification

| Table | Purpose |
|-------|---------|
| `tasks` | Follow-ups, call reminders, review items |
| `qualification_data` | Pricing, motivation, timeline per deal |
| `deal_packages` | Packaged qualified deals for handoff |

## System

| Table | Purpose |
|-------|---------|
| `users` | App users (email, name, role) |
| `settings` | Config key-value store |
