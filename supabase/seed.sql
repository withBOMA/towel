-- Local development seed (runs on `supabase db reset`).
--
-- Users can't be seeded usefully here because sign-in is by email code.
-- To get started locally:
--   1. npm run dev, open http://localhost:3000, sign in with any email.
--   2. Open the email in Mailpit (http://127.0.0.1:55324) and enter the code.
--   3. Create your company on the onboarding screen.
--
-- A second demo org with no members, so you can see that it stays invisible
-- to everyone who signs in (tenant isolation, by eye).
insert into public.organizations (name, slug, timezone)
values ('Demo Roofing Co', 'demo-roofing', 'America/Winnipeg')
on conflict (slug) do nothing;
