# Memory — PostHog + Initial InsForge schema

Last updated: 2026-07-04 00:00 UTC

## What was built
- Added PostHog tracking wrapper: `lib/posthog.ts` (client-side wrapper for `posthog-js`).
- Instrumented key pages and CTAs to emit events:
	- `app/page.tsx` (homepage CTAs: `hero_cta_clicked`)
	- `app/dashboard/page.tsx` (`dashboard_viewed`)
	- `app/find-jobs/page.tsx` (`find_jobs_viewed`)
	- `app/profile/page.tsx` (`profile_viewed`)
	- `app/(auth)/login/page.tsx` (login page events: `login_page_viewed`, `oauth_login_started`, `oauth_login_redirected`, `oauth_login_failed`)
- Created migration file `migrations/20260703165837_create-initial-schema.sql` and applied it to the linked InsForge project (created `profiles`, `agent_runs`, `jobs`, `agent_logs` tables, indexes, and RLS policies).
- Created a private InsForge storage bucket `resumes` for resume PDF uploads using the CLI.
- Saved a project memory entry in InsForge noting the initial backend schema migration.

## Decisions made
- Migration-first backend setup: use `npx @insforge/cli db migrations` to create and apply schema changes (repeatable, reviewable).
- Row-level security: enable RLS on `profiles`, `agent_runs`, `jobs`, and `agent_logs` and restrict access using `auth.uid()` to enforce per-user ownership.
- Storage: use a private `resumes` bucket for user resume PDFs; bucket creation handled via the InsForge CLI (not raw SQL).
- PostHog initialization: preserve existing wizard initialization and use a small `lib/posthog.ts` wrapper to capture events rather than re-initializing PostHog multiple times.

## Problems solved
- Fixed a TypeScript runtime typing error in `app/(auth)/login/page.tsx` by avoiding access to a non-existent `result.error.code` property.
- Resolved migration parsing issues by:
	- Switching from `CREATE POLICY IF NOT EXISTS` to explicit `DROP POLICY` / `CREATE POLICY` blocks compatible with the backend parser.
	- Removing unsupported direct `storage.buckets` INSERT from the SQL and creating the `resumes` bucket via `insforge` CLI instead.

## Current state
- App code changes are committed locally:
	- `lib/posthog.ts` created
	- Instrumentation added to homepage, dashboard, find-jobs, profile, and login pages
	- Migration file present at `migrations/20260703165837_create-initial-schema.sql`
- Database: migration applied successfully; tables and RLS policies are in place.
- Storage: private `resumes` bucket created.
- Runtime: `npm run build` completed successfully after fixes; dev server started (local dev server available to test flows).
- PostHog: instrumentation will send events only when `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` are set in environment; the project used the PostHog wizard for initial setup (no keys are stored in memory).

## Next session starts with
- Verify events appear in the PostHog project by exercising the app locally (open homepage, click CTAs, view dashboard, open login page, start OAuth flow).
- Implement `posthog.identify(userId)` immediately after successful login and `posthog.reset()` on logout so events are tied to authenticated users.
- Add server-side PostHog client (`lib/posthog-server.ts`) for server-originated events (optional but recommended for agent-run logging).
- Begin wiring the profiles CRUD (server action `actions/profile.ts`) to persist profile data into the new `profiles` table.

## Open questions
- Confirm whether `profiles.id` should be the same as `auth.users(id)` (current migration uses that mapping). If not, adjust the profile primary key strategy.
- Do you want to capture additional properties on events (e.g., `match_score`, `job_id`) as part of the first analytics charts, or keep events minimal for now?

Memory saved to memory.md.

Next session: run `/remember restore` to pick up from here.
