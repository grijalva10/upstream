# Unified Operator Implementation Plan

Concrete steps to transform the current multi-agent + web UI architecture into a unified chat-first operator.

## Phase 1: Skills Conversion (Foundation)

### 1.1 Create Skills Directory Structure
```bash
mkdir -p .claude/skills/{source,campaign,classify,qualify,schedule,package,report}
```

### 1.2 Convert Existing Agents to Skills

Each agent becomes a skill with YAML frontmatter:

| Agent File | Skill Directory | Invocation |
|------------|-----------------|------------|
| `sourcing-agent.md` | `.claude/skills/source/` | `/source` |
| `drip-campaign-exec.md` | `.claude/skills/campaign/` | `/campaign` |
| `response-classifier.md` | `.claude/skills/classify/` | `/classify` |
| `qualify-agent.md` | `.claude/skills/qualify/` | `/qualify` |
| `schedule-agent.md` | `.claude/skills/schedule/` | `/schedule` |
| `deal-packager.md` | `.claude/skills/package/` | `/package` |

### 1.3 Create Unified Operator Skill

The master skill that coordinates all others:

```yaml
---
name: upstream
description: Unified CRE deal sourcing operator. Manages pipeline from buyer criteria through deal packaging. Start here.
---

# Upstream Operator

You are Jeff's AI partner for CRE deal sourcing. You have access to:

## Skills
- /source - Generate CoStar queries from buyer criteria
- /campaign - Execute email drip campaigns
- /classify - Classify email responses
- /qualify - Process leads through qualification
- /schedule - Handle call scheduling
- /package - Package qualified deals

## Data Access
Direct database queries via MCP or SQL commands.

## Natural Commands
Respond to natural language:
- "status" / "dashboard" - Pipeline overview
- "pending" - Items needing action
- "who" / "show" - Query entities
- "draft" / "write" - Create content
- "help" - Show capabilities

## Philosophy
- Chat is primary, UI is secondary
- Show data, don't describe it
- Confirm before actions
- Track everything
```

## Phase 2: Enhanced Chat API

### 2.1 Add Skill Router

Modify `/api/ai/chat/route.ts`:

```typescript
// Detect skill invocation
function parseSkillInvocation(message: string): { skill: string; args: string } | null {
  const match = message.match(/^\/(\w+)\s*(.*)/);
  if (match) {
    return { skill: match[1], args: match[2] };
  }
  return null;
}

// Route to skill or general chat
async function handleMessage(message: string, context: EntityContext) {
  const skillInvoke = parseSkillInvocation(message);

  if (skillInvoke) {
    return runSkill(skillInvoke.skill, skillInvoke.args, context);
  }

  return runGeneralChat(message, context);
}
```

### 2.2 Add Session Persistence

```typescript
// Store session in database
interface ChatSession {
  id: string;
  userId: string;
  context: EntityContext;
  lastActiveAt: Date;
}

// Resume previous session
async function getOrCreateSession(userId: string): Promise<ChatSession> {
  const existing = await db.chatSessions
    .where('userId', userId)
    .orderBy('lastActiveAt', 'desc')
    .first();

  if (existing && isRecent(existing.lastActiveAt)) {
    return existing;
  }

  return db.chatSessions.create({ userId, context: null });
}
```

### 2.3 Add Streaming Support

```typescript
// Use createSSEStream from claude-cli
export async function POST(request: Request) {
  const { messages, context, stream } = await request.json();

  if (stream) {
    const sseStream = createSSEStream({
      prompt: buildPrompt(messages, context),
      maxTurns: 5,
      cwd: projectRoot,
    });

    return new Response(sseStream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // ... existing batch mode
}
```

## Phase 3: MCP Integration

### 3.1 Supabase MCP (Already Documented)

Add to Claude settings:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server", "--url", "http://127.0.0.1:55321"]
    }
  }
}
```

### 3.2 Outlook MCP (To Build)

Create `packages/outlook-mcp/`:

```typescript
// MCP server for Outlook integration
const server = new MCPServer({
  name: 'outlook',
  tools: {
    'outlook.sync': async () => { /* sync inbox */ },
    'outlook.send': async ({ to, subject, body }) => { /* send email */ },
    'outlook.read': async ({ messageId }) => { /* read message */ },
    'outlook.search': async ({ query }) => { /* search emails */ },
  }
});
```

### 3.3 CoStar MCP (To Build)

Create `packages/costar-mcp/`:

```typescript
// MCP server wrapping CoStar extraction
const server = new MCPServer({
  name: 'costar',
  tools: {
    'costar.extract': async ({ payloads }) => { /* run extraction */ },
    'costar.property': async ({ id }) => { /* get property details */ },
    'costar.owner': async ({ id }) => { /* get owner info */ },
  }
});
```

## Phase 4: Document Skills

### 4.1 Install Anthropic Skills

```bash
# From anthropics/skills repo
cp -r skills/xlsx .claude/skills/
cp -r skills/pdf .claude/skills/
cp -r skills/pptx .claude/skills/
```

### 4.2 Create Custom Report Skill

`.claude/skills/report/SKILL.md`:

```yaml
---
name: report
description: Generate pipeline analytics, performance reports, and business insights
---

# Report Skill

Generate reports from pipeline data.

## Available Reports
- Pipeline summary (by stage, by market)
- Outreach performance (open rates, response rates)
- Deal flow (qualified, packaged, handed off)
- Contact velocity (new contacts, conversions)

## Output Formats
- Markdown table (default)
- /xlsx for spreadsheet
- /pdf for document
```

## Phase 5: Minimal UI

### 5.1 Keep These UI Components

| Component | Reason |
|-----------|--------|
| Authentication | Security requirement |
| Settings page | MCP config, preferences |
| Approval queue | High-stakes actions need visual review |
| Document viewer | Preview generated PDFs/xlsx |

### 5.2 Replace These with Chat

| Current UI | Chat Equivalent |
|------------|-----------------|
| Searches list | "show my searches" |
| Search detail | "show search [name]" |
| Campaigns list | "show campaigns" |
| Contacts CRUD | "add contact..." / "show contact..." |
| Email viewer | "show email from [name]" |
| Pipeline dashboard | "status" |

### 5.3 Chat-First Home Page

Replace the current dashboard with a chat interface:

```tsx
// apps/web/src/app/page.tsx
export default function Home() {
  return (
    <div className="flex h-screen">
      <ChatInterface className="flex-1" />
      <ApprovalSidebar className="w-80" />
    </div>
  );
}
```

## Phase 6: Self-Modification

### 6.1 Enable Code Tools

Allow the operator to modify its own codebase:

```yaml
# In unified operator skill
tools:
  - Read
  - Write
  - Edit
  - Bash (restricted)
```

### 6.2 Migration Generation

```
You: "Add a motivation_level field to companies"

Operator: I'll create a migration:

```sql
-- supabase/migrations/20250117_add_motivation_level.sql
ALTER TABLE companies
ADD COLUMN motivation_level TEXT
CHECK (motivation_level IN ('low', 'medium', 'high', 'urgent'));
```

Run `npx supabase db push` to apply?
```

### 6.3 Type Updates

Automatically update TypeScript types when schema changes:

```typescript
// Operator detects migration includes new column
// Updates packages/shared/types/companies.ts
export interface Company {
  // ... existing fields
  motivation_level?: 'low' | 'medium' | 'high' | 'urgent';
}
```

## Database Schema Additions

```sql
-- Chat session persistence
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, last_active_at DESC);

-- Message history (optional, for search/reference)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    skill_invoked TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

## File Changes Summary

### New Files
```
.claude/skills/source/SKILL.md
.claude/skills/campaign/SKILL.md
.claude/skills/classify/SKILL.md
.claude/skills/qualify/SKILL.md
.claude/skills/schedule/SKILL.md
.claude/skills/package/SKILL.md
.claude/skills/report/SKILL.md
.claude/skills/upstream/SKILL.md (master operator)
packages/outlook-mcp/           (new package)
packages/costar-mcp/            (new package)
```

### Modified Files
```
apps/web/src/app/api/ai/chat/route.ts  (skill routing, streaming)
apps/web/src/app/page.tsx              (chat-first UI)
supabase/migrations/                    (session tables)
.claude/settings.json                   (MCP servers)
CLAUDE.md                               (updated architecture docs)
```

### Deprecated (can remove later)
```
apps/web/src/app/searches/      (replaced by /source skill)
apps/web/src/app/campaigns/     (replaced by /campaign skill)
apps/web/src/app/contacts/      (replaced by chat queries)
```

## Success Metrics

| Metric | Target |
|--------|--------|
| Primary interface | 80%+ interactions via chat |
| Context switches | Zero (stay in terminal) |
| Time to new search | < 30 seconds via /source |
| Question answering | Any question about business |
| Self-modification | Add fields/features via chat |

## Next Steps

1. **Start with Phase 1.3** - Create unified operator skill
2. **Test in Claude Code** - Use it directly before building UI
3. **Iterate on skills** - Refine based on actual usage
4. **Add MCP servers** - As needed for data access
5. **Reduce UI** - Remove pages as chat replaces them
