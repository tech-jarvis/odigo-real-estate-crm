# MCP Server — Implementation Plan

## Overview

Build a Node.js/TypeScript MCP server that gives Claude tools to: pull and personalize new
leads, log activity back to the CRM, sweep the pipeline for a daily report, and create
Google Calendar invites — all backed by the existing Supabase database.

**Stack:** `@modelcontextprotocol/sdk` · `@supabase/supabase-js` (service-role) · `googleapis` · `zod` · TypeScript

---

## Phase 0 — MCP Ramp-up + Scaffolding (6–12h)

**Goal:** Working MCP server that Claude Desktop can connect to and call a test tool.

### Steps
1. Read the MCP spec and `@modelcontextprotocol/sdk` docs; run the example server.
2. Scaffold a new repo (or sub-package inside this monorepo): `mcp-server/`.
3. Wire stdio transport, register one tool (`ping`), verify Claude Desktop picks it up.
4. Set up TypeScript + ESLint + a test runner (Vitest recommended).
5. Configure environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_*` — never in source.

### Output
- `mcp-server/src/index.ts` — entry point + server init
- `mcp-server/src/tools/` — directory for tool modules
- Claude Desktop `claude_desktop_config.json` updated with server path

---

## Phase 1 — Schema Extensions (4–8h)

**Goal:** Add the two personalization fields the lead-outreach feature depends on.

### Migration
```sql
-- Add to companies or projects depending on client data model decision
alter table public.companies
  add column industry    text,
  add column funnel_source text;
```

### Steps
1. Write migration file `supabase/08_personalization_fields.sql`.
2. Update `02_rls.sql` patterns to allow `authenticated` read, `admin` write on new columns.
3. Backfill existing rows (CSV import or a one-shot UPDATE from known data).
4. Run `supabase gen types typescript` and commit updated `database.types.ts`.

### Decisions needed
- Is `industry` on `companies` or `projects`? (Company-level makes more sense; confirm with client.)
- Is `funnel_source` a free-text string or an enum? Start as text; promote to enum if values stabilise.

---

## Phase 2 — Data-Access Layer + Read Tools (8–14h)

**Goal:** All CRM read operations the AI needs, with typed inputs and validated outputs.

### Supabase client (`mcp-server/src/lib/supabase.ts`)
```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // bypasses RLS — validate inputs in tool layer
)
```

### Tools to build
| Tool name | Query | Inputs |
|-----------|-------|--------|
| `list_new_leads` | `projects` where `stage='lead'` + `created_at > since` | `since: date` |
| `get_project` | project + company + contacts join | `project_id: uuid` |
| `get_company` | company row + contacts | `company_id: uuid` |
| `get_contact` | contact row + company | `contact_id: uuid` |
| `list_pipeline` | all non-archived projects, any stage | `stage?: enum`, `limit?: int` |
| `get_activity_log` | recent activity for a project | `project_id: uuid`, `limit?: int` |
| `search_contacts` | ilike on name/email | `query: string` |

### Notes
- Use `zod` for every tool's input schema — this is the only system boundary.
- Return only the fields Claude needs; avoid over-fetching.

---

## Phase 3 — Activity-Logging Tools (4–7h)

**Goal:** Let Claude write back to the CRM after every action.

### Tool: `log_activity`
```ts
// Input schema (zod)
{ project_id: z.string().uuid(), type: ActivityTypeEnum, body: z.string().min(1).max(2000) }

// Insert
await supabase.from('activity_log').insert({
  project_id, type, body,
  author_id: BOT_PROFILE_ID  // a dedicated service profile, not a real user
})
```

### Steps
1. Create a bot/service profile row in `profiles` (id = a fixed UUID stored in env).
2. Confirm with client: activity is logged to `project`, not to `contact` directly (schema constraint).
   If per-contact logging is required, a separate `contact_activity_log` table is needed — raise as change order.
3. Build `log_activity` tool with the four `activity_type` enum values.

---

## Phase 4 — Daily Lead-Outreach Feature (6–10h)

**Goal:** Claude can identify new leads, read their personalization fields, draft an invite, and trigger the calendar tool.

### Idempotency — "processed" marker
A lead is considered processed for outreach when `activity_log` contains a `call_summary`
entry with body starting with `[OUTREACH]` for that project. `list_new_leads` filters these
out. No new columns needed.

```sql
-- Unprocessed new leads:
SELECT p.* FROM projects p
WHERE p.stage = 'lead'
  AND p.created_at > $since
  AND NOT EXISTS (
    SELECT 1 FROM activity_log a
    WHERE a.project_id = p.id AND a.type = 'call_summary' AND a.body LIKE '[OUTREACH]%'
  )
```

### Tool: `draft_calendar_invite`
Returns a structured object (not a live event). Claude presents it to the operator for approval.
```ts
{ contact_id, contact_name, contact_email, suggested_title, suggested_body, suggested_time_slot }
```

### Tool: `send_calendar_invite` (calls Phase 5 calendar layer)
Only fires after explicit operator confirmation. Logs `[OUTREACH] invite sent` to `activity_log`.

---

## Phase 5 — Google Calendar Integration (6–12h)

**Goal:** Create real Google Calendar events from approved invite drafts.

### OAuth setup
1. Enable Google provider in Supabase Auth dashboard.
2. Add `https://www.googleapis.com/auth/calendar.events` to the OAuth scopes.
3. On first login (via the CRM), capture `provider_refresh_token` from the Supabase session
   and store it in a new table:

```sql
create table public.oauth_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  provider     text not null,           -- 'google'
  refresh_token text not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (user_id, provider)
);
```

4. Build `lib/google-calendar.ts`:
   - Load refresh token from `oauth_tokens`.
   - Use `google-auth-library` to exchange for an access token.
   - Call `calendar.events.insert` with attendees + `sendUpdates: 'all'`.

### Risk: Google app verification
If invites go to **external attendees** (not your own Workspace domain), Google will require
app verification before allowing `calendar.events` scope in production. Start the review
process in week 1 — it can take 1–4 weeks.

---

## Phase 6 — Daily CRM Sweep (5–9h)

**Goal:** One tool call returns a prioritized, structured pipeline snapshot for the day.

### Tool: `get_daily_pipeline_report`
Returns structured JSON; Claude writes the narrative and recommendations.

```ts
{
  leads_count: number,
  proposals_count: number,
  active_count: number,
  stale_projects: Project[],       // no activity_log entry in > 7 days
  high_value_at_risk: Project[],   // stage=lead|proposal + project_value > threshold + stale
  actions_needed: string[]         // Claude synthesises these from the data
}
```

### Steps
1. Define "stale" with client (default: no activity in 7 days).
2. Define "high-value" threshold (configurable via env, default: $100k).
3. Single aggregation query joining `projects` + latest `activity_log` per project.

---

## Phase 7 — Hardening (4–7h)

- All tool inputs validated with `zod` — reject malformed requests before any DB query.
- Service-role key loaded from env only, never logged, never returned in tool output.
- All DB errors caught and returned as structured MCP error responses (never stack traces).
- Run `npx @claude-flow/cli@latest security scan` after completion.
- Review: no RLS protection on service-role queries — double-check every query has an
  explicit `user_id` / `project_id` filter where relevant.

---

## Phase 8 — Testing, Docs, Deploy (6–10h)

### Tests (Vitest)
- Unit tests for each zod schema (valid + invalid inputs).
- Integration tests against a local Supabase instance for read/write tools.
- Manual end-to-end: connect Claude Desktop, run outreach + sweep prompts, verify DB writes.

### Docs
- `mcp-server/README.md`: setup, env vars, Claude Desktop config, first-run checklist.
- `claude_desktop_config.json` snippet with correct server path + env.

---

## Phase 9 — Daily Runbook (2–4h)

Save these as named prompts the operator pastes into Claude each morning.

**Daily outreach prompt (example)**
```
Using the CRM tools, list all unprocessed leads created in the last 48 hours.
For each lead, read the company segment, industry, and funnel source.
Draft a personalized calendar invite for each. Show me each draft before sending.
After I approve, send the invite and log the outreach to the project.
```

**Daily sweep prompt (example)**
```
Run get_daily_pipeline_report and give me a prioritized action list for today.
Flag any stale projects and high-value deals at risk. Keep it under 300 words.
```

---

## File Structure

```
mcp-server/
├── src/
│   ├── index.ts                  # MCP server init + tool registration
│   ├── lib/
│   │   ├── supabase.ts           # service-role client
│   │   ├── google-calendar.ts    # token refresh + events.insert
│   │   └── database.types.ts     # generated by supabase gen types
│   └── tools/
│       ├── read.ts               # list_new_leads, get_project, list_pipeline, etc.
│       ├── write.ts              # log_activity
│       ├── outreach.ts           # draft_calendar_invite, send_calendar_invite
│       └── sweep.ts              # get_daily_pipeline_report
├── tests/
├── .env.example
└── README.md

supabase/
└── 08_personalization_fields.sql  # new migration
```

---

## Environment Variables

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
BOT_PROFILE_ID=                   # UUID of the service profile in public.profiles
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
HIGH_VALUE_THRESHOLD=100000        # project_value above which a stale deal is flagged
STALE_DAYS=7                       # days without activity before a project is "stale"
```

---

## Key Decisions to Confirm With Client Before Starting

1. Is `industry` on `companies` or `projects`?
2. Are calendar invites sent to external attendees (affects Google app-verification timeline)?
3. Is the manual-trigger workflow acceptable for v1, or is unattended automation required?
4. Is logging activity to `project_id` acceptable, or is per-contact logging needed?
5. What is the "high-value" threshold for the daily sweep?
