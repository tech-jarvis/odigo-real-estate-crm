# Odigo CRM

A lightweight internal CRM for a premium Pacific-Northwest general contractor. It tracks the project pipeline, clients and their contacts, and a per-project activity log, behind email/password auth with two roles enforced at the database layer.

Built for The Odigo Group technical assessment.

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase (Postgres, Auth, RLS) · TanStack Query v5 · Tailwind CSS · Radix UI · Recharts · Vercel.

---

## Live demo

- **App:** https://odigo-real-estate-crm.vercel.app/
- **Repo:** https://github.com/tech-jarvis/odigo-real-estate-crm

### Test accounts

| Email                   | Password         | Role                    |
| ----------------------- | ---------------- | ----------------------- |
| `admin@odigo-test.com`  | `OdigoTest2026!` | Admin — full read/write |
| `viewer@odigo-test.com` | `OdigoTest2026!` | Viewer — read-only      |

The login screen has one-click buttons to fill either account.

---

## What's inside

- **Dashboard** — projects by stage, open vs. total pipeline value, a count of projects closing within 30 days, a bar chart of pipeline value by stage, a list of imminent closes, and the 10 most recent activity entries across all projects.
- **Pipeline** — a Kanban board across the four stages (Lead → Proposal → Active → Completed) with drag-and-drop stage changes (optimistic, with rollback on error), per-column counts and value totals, and full project CRUD + archive for admins.
- **Project detail** — all project fields, quick stage change, linked contacts, and the append-only activity log with a typed entry composer.
- **Clients** — companies with industry segment, address and contact details; each company has multiple contacts (full CRUD) and a list of its linked projects.
- **Activity log** — append-only by design; entries are timestamped, attributed to their author, and typed (note / status change / file reference / call summary).

Every data-fetching view has explicit **loading**, **error**, and **empty** states.

---

## Local setup

### Prerequisites

- Node.js 18.18+ (or 20+)
- A Supabase project

### 1. Install

```bash
git clone <repo-url>
cd odigo-crm
npm install
```

### 2. Environment variables

Copy the example and fill in your Supabase project values (Dashboard → Project Settings → API):

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key

# Optional — protects the soft-delete cleanup cron endpoint.
# If omitted, the endpoint runs without auth checks.
CRON_SECRET=some-long-random-string
```

> Only the public (publishable/anon) key is used — there are no service-role keys in this app or repo. All writes go through RLS as the signed-in user.

### 3. Database

Run the SQL files in `supabase/` in order, via the Supabase SQL Editor (or `psql`):

1. `supabase/01_schema.sql` — tables, enums, indexes, triggers, helper functions
2. `supabase/02_rls.sql` — row-level security policies
3. `supabase/03_seed.sql` — test accounts + sample data
4. `supabase/04_add_slugs.sql` — generated slug columns on companies and projects for URL-safe routing
5. `supabase/05_file_attachments.sql` — `file_url` column on activity log + `project-files` storage bucket and policies

`03_seed.sql` is idempotent: it clears the two seed users and all CRM rows, then recreates them, so you can re-run it any time to reset to a known state.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with one of the test accounts.

---

## Seed data

`supabase/03_seed.sql` creates:

- The two auth users above (with confirmed emails and password login wired up).
- 5 companies across all three segments, 8 contacts, 8 projects spanning every stage, 11 project↔contact links, and 12 activity entries with realistic timestamps (so "closing in 30 days" and the recent-activity feed are populated).

---

## Architecture & decisions

### Data model

Six tables, fully normalised rather than one flat table per module:

```
auth.users ─1:1─ profiles (role)
companies ─1:many─ contacts
companies ─1:many─ projects ─many:1─ profiles (assignee)
projects ─many:many─ contacts   (via project_contacts)
projects ─1:many─ activity_log ─many:1─ profiles (author)
```

`profiles` mirrors `auth.users` and is auto-populated by an `on_auth_user_created` trigger, with the role read from sign-up metadata (defaulting to `viewer`).

### Access control (database-layer RLS)

Access control lives in the database, not the UI. RLS is enabled on every table:

- **Read:** any authenticated user can read all CRM data.
- **Write:** only users whose `profiles.role = 'admin'` can insert/update/delete. This is evaluated through a `security definer` `is_admin()` helper used in the policies.
- **Activity log is append-only at the DB layer:** it has a `select` and an `insert` policy and _no_ update/delete policies, so edits and deletes are rejected by Postgres for everyone, including admins — not merely hidden in the UI.

The UI mirrors these rules (viewers don't see write controls), but the database is the enforcement point. A viewer calling the API directly still cannot write.

### Server vs. client components

- Pages and data fetching use a **hybrid model**: Server Components handle auth and server-side prefetching; Client Components own interactivity and read from the React Query cache.
- Mutations are **server actions** (`actions.ts`) that re-validate the relevant paths.
- Only genuinely interactive pieces are client components: the Kanban board (drag-and-drop + optimistic state), dialogs/forms, and the chart.
- Sessions persist via cookie handling in `middleware.ts`, which also guards protected routes and bounces signed-in users away from `/login`.

### Data caching (TanStack Query v5)

The app uses [TanStack Query](https://tanstack.com/query/latest) for client-side caching with a **server-prefetch → hydration → client-cache** pattern:

| Layer                         | Responsibility                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Server Component              | Calls `queryClient.prefetchQuery` using the SSR Supabase client (cookie auth)             |
| `HydrationBoundary`           | Serialises the prefetched state and transfers it to the browser's singleton `QueryClient` |
| Client Component (`useQuery`) | Reads from the already-populated cache — no loading spinner on first render               |

**Cache configuration (global defaults):**

- `staleTime: 5 min` — data is considered fresh for 5 minutes; navigating back to a page within that window skips the network entirely
- `gcTime: 10 min` — inactive cache entries survive for 10 minutes after unmounting
- `refetchOnWindowFocus: false` — no surprise refetch when the user switches tabs
- `refetchOnMount: false` — honours `staleTime` on component remount

**Query keys:**

| Key                  | Data                                                             | Used by                              |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `['projects', view]` | Projects list filtered by view (`active` / `archived` / `trash`) | `PipelineView`                       |
| `['companies']`      | `id + name` — lightweight list for the project form combobox     | `PipelineView` → `ProjectFormDialog` |
| `['companies-full']` | Full company rows with contact/project counts                    | `CompanyList`                        |
| `['members']`        | Profiles for the assignee dropdown                               | `PipelineView` → `ProjectFormDialog` |

**Mutation invalidation:**

After any write (create, update, delete, archive, restore, drag-and-drop stage move), the relevant mutation handler calls `queryClient.invalidateQueries` to mark the affected queries as stale. React Query then triggers a background refetch and updates the UI without a full page reload.

| Mutation                           | Invalidates                           |
| ---------------------------------- | ------------------------------------- |
| Create / edit project              | `['projects']` (all views)            |
| Drag-and-drop stage change         | `['projects']`                        |
| Archive / restore / delete project | `['projects']`                        |
| Create / edit company              | `['companies']`, `['companies-full']` |

**Before/after behaviour:**

| Scenario                                 | Before                                                                                      | After                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Create a project                         | Dialog closes, then `router.refresh()` triggers full RSC re-render (~300–600 ms round-trip) | `invalidateQueries` triggers React Query background refetch from the browser; board updates in ~50–150 ms |
| Navigate pipeline → companies → pipeline | Each visit re-fetches all projects server-side                                              | Second pipeline visit served from browser cache (0 ms) if within 5-min staleTime                          |
| Create a company                         | List stayed stale until manual refresh                                                      | `invalidateQueries` on both company keys updates the list instantly                                       |
| First page load                          | Same as before — server renders with full data                                              | Same — server prefetches into `HydrationBoundary`, client renders without a loading spinner               |

**Trade-offs:**

- `staleTime: 5 min` means users see data up to 5 minutes old without a visible refetch. For a single-team internal CRM this is acceptable; lower it (or set `refetchOnWindowFocus: true`) if collaborative real-time accuracy matters more.
- Server Components still run on every navigation (due to `force-dynamic`), so auth checks and server-side prefetch happen on each visit — the React Query cache shortens client-side rendering to zero, but doesn't eliminate the server execution.
- No optimistic updates in dialogs yet — the mutation fires and waits for server confirmation before updating the cache. The existing board drag-and-drop already has optimistic UI.

### Design

No design file was provided. The direction follows the brand brief — dark neutral base, warm gold accent, clean content surfaces; precise and minimal, in the spirit of Linear's density and Notion's calm utility. Theme tokens live as CSS variables in `globals.css`. Hover, focus, drag, and dialog transitions are deliberate rather than default. The layout is responsive: the sidebar collapses into a drawer on mobile and the Kanban reflows to fewer columns.

### Activity logging side-effects

Creating a project, moving a stage (via board or detail), all write a `status_change`/`note` entry to the activity log automatically, so the log reflects real history without manual entry.

---

## Project structure

```
src/
  app/
    login/                     # auth screen + form (client)
    auth/signout/              # POST route to sign out
    (app)/                     # authenticated route group
      layout.tsx               # loads profile, provides role context, app shell
      page.tsx                 # Dashboard
      pipeline/                # Kanban board, project CRUD, actions
        [id]/                  # project detail + activity log
      companies/               # client list, company + contact CRUD
        [id]/                  # company detail
  components/
    ui/                        # Radix-based primitives (button, dialog, select…)
    shared/                    # logo, badges, avatar, empty/error states
    shell/                     # sidebar, app shell, user menu
    activity/                  # activity feed + composer
    dashboard/                 # stat cards
  lib/
    supabase/                  # browser / server / middleware clients
    types.ts, database.types.ts, auth.ts, utils.ts
supabase/                      # 01_schema · 02_rls · 03_seed (run in order)
```

---

## Trade-offs & what I'd do next

- **Team members = auth users.** "Assigned team member" maps to an app user (the same identities used for activity attribution). A real firm has field staff who never log in, which would warrant a separate `team_members` table; I kept it simple and consistent for the assessment scope.
- **No realtime yet.** Mutations use server actions + `queryClient.invalidateQueries` for the current user's view. Supabase Realtime subscriptions would propagate changes to all connected users without a refresh.
- **Given more time:** global search across projects/companies, activity filters and pagination, per-user invites and an admin user-management screen, CSV export, and audit coverage on reads. Optimistic UI is currently only on the board; it could extend to dialogs.
