# packages/db

Supabase schema, migrations, and generated types.

## What Goes Here
- `schema.sql` - Table definitions
- `migrations/` - Schema changes over time
- `types.ts` - Generated TypeScript types from Supabase
- `seed.sql` - Test data (optional)

## Tables (Rough Ideas)
- `campaigns` - Buyer criteria + status
- `prospects` - Properties from CoStar
- `emails` - Generated/sent emails
- `decisions` - Human decision queue
- `deals` - Qualified opportunities

## When To Build
When we need to persist data across sessions.
Probably after Stage 1 (query builder) is solid.

## For Now
Don't create tables until we know what data we actually need.
