# Towelapp

Job, crew and client management for trade contractors. Multi-tenant from day one: every company's data is isolated in the database with Row Level Security.

**Phase 0 (this repo today):** sign-in by email code or link, company setup, team invites and roles, switching between companies, and tests proving one company can't see another's data.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth, RLS) · Vercel · Resend (optional).

---

## 1. Run it locally (about 15 minutes)

You need **Node 22+**, **Docker Desktop** (for the local Supabase stack) and **Git**.

```bash
npm install
npm run db:start            # starts local Postgres, Auth, Studio, Mailpit (first run downloads images)
npx supabase status         # copy "API URL" and "Publishable key"
cp .env.example .env.local  # paste those two values in
npm run db:types            # replace hand-written types with generated ones
npm run dev                 # http://localhost:3000
```

Sign in with any email address. Local emails don't leave your machine: open **Mailpit at http://127.0.0.1:55324**, copy the code (or click the link), then create your company.

Local ports use the 553xx range so towelapp can run beside other Supabase projects.

Useful local URLs: Studio (database UI) http://127.0.0.1:55323 · Mailpit http://127.0.0.1:55324

To try invites, open Team → invite a second email → copy the link → open it in a private window and sign in as that email.

## 2. Tests

```bash
npm run db:test   # pgTAP tests in supabase/tests (needs db:start)
npm run check     # lint + typecheck
npm run build
```

No Docker? `DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run db:test:plain` runs the same database tests on any Postgres 15+ with pgTAP installed.

The database tests are the most important tests in the project. Every new table gets a test that another company can't read or change it.

## 3. Set up staging and production (one time)

### Supabase
1. Create **two** projects at supabase.com: `towelapp-staging` and `towelapp-prod`. Pick region **Canada (Central)** for both.
2. In each: **Authentication → Emails → Templates**, paste the body of `supabase/templates/magic_link.html` into both **Magic link** and **Confirm signup**. Subject: "Your sign-in code".
3. **Authentication → URL Configuration**: Site URL = your app URL (e.g. `https://app.yourdomain.ca`); add `https://*-yourteam.vercel.app/**` to Redirect URLs for preview deploys.
4. Push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <staging-ref>
   npx supabase db push
   ```
   Repeat with the production ref when you release.
5. Free-tier note: Supabase's built-in email sender is heavily rate-limited (a few emails per hour). Before real users, add custom SMTP under **Project Settings → Auth → SMTP** (Resend's free tier works).

### Vercel
1. Push this repo to GitHub and import it in Vercel.
2. Environment variables (Production → prod Supabase values; Preview → staging values):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_NAME`, and optionally `RESEND_API_KEY`, `EMAIL_FROM`.

### GitHub
CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, and the database tests on every push and pull request. Protect `main` so changes go through a pull request with green checks.

## 4. Rules of the road

- **Schema changes only through migrations.** `npm run db:new <name>`, write SQL, `npm run db:reset` to apply locally, `npm run db:types`, add tests. Never edit tables in the hosted dashboard.
- **Every org-owned table**: `organization_id uuid not null references organizations`, RLS enabled, policies using `private.is_member()` / `private.has_role()`, and a test in `supabase/tests/database`.
- **Never trust the browser.** Server Actions re-check the user and org; RLS is the final gate. The service-role key is not used anywhere in this app. Keep it that way unless a background job truly needs it.
- **Times are stored in UTC** and shown in the org's time zone (`organizations.timezone`).

## 5. How it fits together

| Area | Where |
| --- | --- |
| Schema, RLS, RPCs | `supabase/migrations/20261120000000_foundation.sql` |
| Database tests | `supabase/tests/database/` |
| Session refresh + sign-in redirect | `src/proxy.ts`, `src/lib/supabase/proxy.ts` |
| Current user / org / role | `src/lib/auth.ts` (`getOrgContext()`) |
| Sign-in | `src/app/login`, `src/app/auth/confirm` |
| Company setup | `src/app/onboarding` |
| Team and invites | `src/app/(app)/settings/members`, `src/app/invite/[token]` |

**Roles:** `owner` (everything; only owners manage other owners) · `admin` (team and settings) · `office` (clients, jobs, scheduling, from phase 1) · `crew_lead` / `crew` (their assigned work, from phase 1). Every company always keeps at least one active owner. The database enforces this.

**Invites:** an owner or admin invites an email address with a role. The link works only for that email and expires after 7 days. With Resend configured the email is sent automatically; otherwise copy the link from the Team page.

## 6. Changing the display name

The name appears in `NEXT_PUBLIC_APP_NAME`, `package.json` (`name`), `supabase/config.toml` (`project_id`) and this README. Nothing else depends on it.

## Next: phase 1

Clients, properties, the sales pipeline (inquiry → estimate booked → site visit → quote → signed) and the hand-off to operations.
