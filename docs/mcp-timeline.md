# MCP Server — Project Timeline

## Assumptions
- **Both Google Calendar and Outlook (Microsoft Graph)** supported in v1
- Provider abstraction layer so tools (`send_calendar_invite`) are calendar-agnostic
- Google auth via Supabase OAuth; Outlook via Microsoft MSAL OAuth (separate flow)
- Manual-assisted daily trigger (human runs prompt in Claude Desktop)
- Schema columns (`industry`, `funnel_source`) added with migration + backfill
- Human-approval gate before any calendar invite sends

---

## Week-by-Week Schedule

| Week | Days | Phase | Deliverable | Hours |
|------|------|-------|-------------|-------|
| 1 | 1–2 | **Phase 0** — MCP ramp-up + scaffolding | Working MCP server skeleton, stdio transport, hello-world tool verified in Claude Desktop | 6–12 |
| 1 | 3–5 | **Phase 1** — Schema extensions | Migration adding `industry` + `funnel_source`, RLS updated, existing rows backfilled, TS types regenerated | 4–8 |
| 2 | 1–3 | **Phase 2** — Data-access layer + read tools | Service-role Supabase client, 6–8 read tools (`list_new_leads`, `get_company`, `get_contact`, `list_pipeline`, etc.) | 8–14 |
| 2 | 4–5 | **Phase 3** — Activity-logging tools | `log_activity` tool writing to `activity_log`, bot/service author profile resolved | 4–7 |
| 3 | 1–3 | **Phase 4** — Lead outreach feature | "New lead" definition, idempotency marker, personalization fields exposed, invite-draft tool | 6–10 |
| 3 | 4–5 | **Phase 5a** — Google Calendar integration | Supabase Google OAuth w/ calendar scopes, token capture + refresh store, `events.insert` with approval gate | 6–12 |
| 4 | 1–2 | **Phase 5b** — Outlook / Microsoft Graph | MSAL OAuth consent flow, Microsoft Graph `/events`, token store + refresh, provider abstraction layer unifying both providers | 10–16 |
| 4 | 3–4 | **Phase 6** — Daily CRM sweep | Pipeline aggregation, stale-project detection, value-weighted prioritization, report tool | 5–9 |
| 4 | 5 | **Phase 7** — Hardening | Service-role key handling, zod validation at all boundaries, error handling, security scan | 4–7 |
| 5 | 1–3 | **Phase 8** — Testing, docs, deploy | Unit tests, end-to-end runs with Claude (both calendar providers), README, Claude Desktop config, client walkthrough | 6–10 |
| 5 | 4 | **Phase 9** — Daily runbook | Saved daily prompts (outreach + sweep), idempotency guidance doc | 2–4 |

---

## Total

| | Min | Max | Recommended Quote |
|-|----:|----:|:-----------------:|
| Subtotal (phases 0–9, single provider) | 51h | 93h | — |
| + Outlook / provider abstraction (Phase 5b) | 10h | 16h | — |
| **Subtotal with both providers** | **61h** | **109h** | — |
| Buffer (~15%) | 9h | 16h | — |
| **Total** | **~70h** | **~125h** | **95h (90–100h band)** |

**Calendar elapsed time: ~5 weeks** at part-time pace (roughly 15–20h/week).

---

## Schedule Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google app-verification (external attendees) | Days–weeks delay, not dev hours | Confirm attendee model in week 1; start review process immediately |
| Microsoft tenant admin-consent requirement | Outlook OAuth blocked until tenant admin approves | Identify client's M365 admin early; confirm they can grant consent |
| Google token refresh lifecycle overrun | Phase 5a +4–8h | 2h OAuth spike in week 1 before committing |
| Outlook Graph permissions scope creep | Phase 5b +2–4h | Lock Graph permission list before coding; `Calendars.ReadWrite` is sufficient |
| Provider abstraction added complexity | Phase 5b +2–4h | Define the interface before coding either provider |
| New-lead idempotency edge cases | Phase 4 +2–4h | Define + test marker logic before wiring outreach |
| Client feedback rounds on invite copy | Phase 4/9 +2–4h | Align on template in week 2, not week 5 |

---

## Phase-2 Change Orders (not in scope v1)

- **True unattended automation** (cron + Agent SDK runner + hosting): +8–16h
- **CRM UI** to capture `industry`/`funnel_source` on new records: separate estimate
