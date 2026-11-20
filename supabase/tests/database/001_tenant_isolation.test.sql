-- Tenant isolation and role rules for the phase 0 foundation.
-- Run with:  supabase test db        (or scripts/plain-postgres/test.sh without Docker)
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@acme.test',    '{"full_name":"Alice Owner"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@borealis.test',  '{"full_name":"Bob Owner"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@acme.test',    '{"full_name":"Carol Crew"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@nowhere.test',  '{"full_name":"Dave Outsider"}'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@acme.test',     '{"full_name":"Erin Office"}');

select is(
  (select count(*)::int from public.profiles),
  5,
  'a profile is created for every new auth user'
);

-- Alice creates Acme
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select lives_ok(
  $$ select public.create_organization('Acme Insulation', 'acme') $$,
  'a signed-in user can create an organization'
);

-- Bob creates Borealis
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select public.create_organization('Borealis Roofing', 'borealis');

-- Carol joins Acme as crew (added directly by the server)
reset role;
insert into public.memberships (organization_id, user_id, role)
select id, '00000000-0000-0000-0000-00000000000c', 'crew' from public.organizations where slug = 'acme';

-- ---------------------------------------------------------------------------
-- Cross-tenant isolation (Alice vs Borealis)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

select results_eq(
  $$ select slug from public.organizations $$,
  array['acme'],
  'Alice sees only her own organization'
);
select is_empty(
  $$ select 1 from public.memberships m join public.organizations o on o.id = m.organization_id where o.slug = 'borealis' $$,
  'Alice cannot see another org''s memberships'
);
select is_empty(
  $$ update public.organizations set name = 'Hacked' where slug = 'borealis' returning id $$,
  'Alice cannot update another org'
);
select throws_ok(
  $$ insert into public.memberships (organization_id, user_id, role)
     select id, '00000000-0000-0000-0000-00000000000a', 'owner' from public.organizations where slug = 'borealis' $$,
  '42501',
  null,
  'Alice cannot add herself to another org'
);
select throws_ok(
  $$ insert into public.organizations (name, slug) values ('Direct', 'direct') $$,
  '42501',
  null,
  'organizations cannot be inserted directly; only through create_organization'
);
select results_eq(
  $$ select full_name from public.profiles order by full_name $$,
  array['Alice Owner', 'Carol Crew'],
  'Alice sees her own and her teammates'' profiles only'
);
select is_empty(
  $$ update public.profiles set full_name = 'Renamed' where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'Alice cannot edit someone else''s profile'
);

select throws_ok(
  $$ update public.profiles set email = 'spoof@acme.test' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'users cannot change the email on their profile directly'
);

reset role;
update auth.users set email = 'alice.new@acme.test' where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select email from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'alice.new@acme.test',
  'an email change in Auth is copied to the profile'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Crew role limits (Carol)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);

select results_eq(
  $$ select slug from public.organizations $$,
  array['acme'],
  'Carol (crew) can read her org'
);
select is_empty(
  $$ update public.organizations set name = 'Carol Co' where slug = 'acme' returning id $$,
  'crew cannot edit org settings'
);
select is_empty(
  $$ update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000c' returning id $$,
  'crew cannot promote themselves'
);
select throws_ok(
  $$ insert into public.invitations (organization_id, email, role, invited_by)
     select id, 'friend@acme.test', 'office', '00000000-0000-0000-0000-00000000000c' from public.organizations where slug = 'acme' $$,
  '42501',
  null,
  'crew cannot send invitations'
);
select is_empty(
  $$ select 1 from public.invitations $$,
  'crew cannot read invitations'
);

-- ---------------------------------------------------------------------------
-- Invitations (Alice invites Erin)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

select lives_ok(
  $$ insert into public.invitations (organization_id, email, role, invited_by)
     select id, 'erin@acme.test', 'office', '00000000-0000-0000-0000-00000000000a' from public.organizations where slug = 'acme' $$,
  'an owner can invite a teammate'
);
select throws_ok(
  $$ insert into public.invitations (organization_id, email, role, invited_by)
     select id, 'boss2@acme.test', 'owner', '00000000-0000-0000-0000-00000000000a' from public.organizations where slug = 'acme' $$,
  '23514',
  null,
  'nobody can be invited straight in as owner'
);

reset role;
select set_config('test.token', (select token::text from public.invitations where email = 'erin@acme.test'), true);
set local role authenticated;

-- Dave tries to use Erin's invitation
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
select throws_ok(
  $$ select public.accept_invitation(current_setting('test.token')::uuid) $$,
  'P0001',
  'this invitation was sent to a different email address',
  'an invitation only works for the email it was sent to'
);
select is_empty(
  $$ select 1 from public.organizations $$,
  'a user with no membership sees no organizations'
);

-- Erin accepts
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true);
select lives_ok(
  $$ select public.accept_invitation(current_setting('test.token')::uuid) $$,
  'the invited person can accept'
);
select results_eq(
  $$ select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000e' $$,
  array['office'],
  'accepting creates a membership with the invited role'
);
select throws_ok(
  $$ select public.accept_invitation(current_setting('test.token')::uuid) $$,
  'P0001',
  'invitation already used',
  'an invitation cannot be reused'
);

-- ---------------------------------------------------------------------------
-- Owner protection
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select throws_ok(
  $$ update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'P0001',
  'an organization must keep at least one active owner',
  'the last owner cannot demote themselves'
);
select lives_ok(
  $$ update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000e' $$,
  'an owner can promote a member to admin'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', true);
select throws_ok(
  $$ update public.memberships set active = false where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'P0001',
  'only an owner can change owner memberships',
  'an admin cannot remove an owner'
);
select throws_ok(
  $$ update public.memberships set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000e' $$,
  'P0001',
  'only an owner can change owner memberships',
  'an admin cannot make themselves owner'
);

-- ---------------------------------------------------------------------------
-- Anonymous access
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.organizations $$,
  '42501',
  null,
  'anonymous users cannot read organizations at all'
);

select * from finish();
rollback;
