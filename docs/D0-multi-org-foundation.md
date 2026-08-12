# D0: Multi-Org Foundation — real-estat-crm changes

## What this branch does, in plain English

Today the CRM database has one customer's data in it, and every logged-in user can see all of it — there's no concept of "which company do you belong to." The V2 plan is bringing on two more customers (Odigo Enterprise, ContentGen) into the *same* database, so before anything else in V2 can be built, the database itself needs a real wall between customers' data. This branch builds that wall.

## The core idea

Every table that holds real business data (companies, contacts, projects, activity notes, user profiles) now has an "organization" tag on every row. Postgres itself — not the app code — enforces that a logged-in user can only ever see or touch rows tagged with their own organization. This is enforced at the database layer (Row-Level Security), which means even a bug in the app's own code can't accidentally leak data across organizations — the database refuses the query before it ever gets that far.

## What changed, phase by phase

**1. Created the organizations.** Three organizations now exist: Odigo SMB (the current, real customer — keeps all its existing data), Odigo Enterprise and ContentGen (both brand new, completely empty, fully isolated).

**2. Tagged every existing row.** Every company, contact, project, and activity note in the database — all belonging to the one current customer — got tagged as belonging to Odigo SMB.

**3. Rewrote the database's access rules.** The rules that decide "can this user see/edit this row" were rewritten so that, on top of the existing admin/viewer permission check, every rule now also requires the row to belong to the user's own organization.

**4. Closed a related gap found along the way.** The first pass of the new rules checked "does this row belong to my org," but didn't fully check that things a row *points to* also belonged to the same org (e.g., a note attached to a project — was the project itself verified to be in the same org?). That's now closed for every case we found.

**5. Proved it actually works, twice over.** Two separate live tests: one seeds a second organization with real data and shows a database-level API call from one org can never retrieve the other org's data (bypassing the app UI entirely, straight against the database's own access rules). The other logs in as real users from two different organizations through the actual website and confirms each only ever sees their own company's data — both in what's shown on screen and in raw API calls.

## Bottom line

Before this branch: the database had no isolation between customers — everything was implicitly shared. After: every customer's data lives in a genuinely separate, database-enforced compartment, verified against a live database and a live login, with the existing customer's data fully intact and untouched.
