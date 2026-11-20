-- =============================================================================
-- Phase 0 foundation: organizations, profiles, memberships, invitations.
-- Multi-tenant: every org-owned row carries organization_id and is protected
-- by Row Level Security keyed on the caller's active membership.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Helper functions live in a schema the API does not expose.
create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'office', 'crew_lead', 'crew');

-- -----------------------------------------------------------------------------
-- Generic triggers
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  timezone    text not null default 'America/Winnipeg',
  phone       text,
  logo_path   text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  deleted_at  timestamptz
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,  -- copied from auth.users by trigger; not user-editable here
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  phone       text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- References profiles (1:1 with auth.users) so the API can embed member names.
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            public.org_role not null,
  active         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id) where active;

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            public.org_role not null check (role <> 'owner'),
  token           uuid not null unique default gen_random_uuid(),
  invited_by      uuid references auth.users (id) on delete set null,
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create unique index invitations_one_open_per_email
  on public.invitations (organization_id, lower(email))
  where accepted_at is null;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies on memberships don't recurse)
-- -----------------------------------------------------------------------------
create or replace function private.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.active
      and o.deleted_at is null
  );
$$;

create or replace function private.has_role(org uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.active
      and m.role = any (roles)
      and o.deleted_at is null
  );
$$;

-- True when the caller shares at least one active org with the given user.
create or replace function private.shares_org_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and mine.active
      and theirs.user_id = other_user
  );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_role(uuid, public.org_role[]) from public;
revoke all on function private.shares_org_with(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.org_role[]) to authenticated;
grant execute on function private.shares_org_with(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Membership guard: owners can only be changed by owners, and every org keeps
-- at least one active owner. Skipped for trusted server contexts (no auth.uid()).
-- -----------------------------------------------------------------------------
create or replace function private.guard_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  loses_owner boolean;
begin
  if actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
      raise exception 'membership organization and user cannot be changed';
    end if;
  end if;

  -- Touching an owner row, or promoting someone to owner, needs an owner.
  if (old.role = 'owner' or (tg_op = 'UPDATE' and new.role = 'owner'))
     and not private.has_role(old.organization_id, array['owner']::public.org_role[]) then
    raise exception 'only an owner can change owner memberships';
  end if;

  loses_owner := old.role = 'owner' and old.active and (
    tg_op = 'DELETE' or new.role <> 'owner' or not new.active
  );

  if loses_owner and not exists (
    select 1 from public.memberships m
    where m.organization_id = old.organization_id
      and m.role = 'owner' and m.active and m.id <> old.id
  ) then
    raise exception 'an organization must keep at least one active owner';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger memberships_guard
  before update or delete on public.memberships
  for each row execute function private.guard_membership_change();

-- -----------------------------------------------------------------------------
-- New auth user -> profile row
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;

-- The anon role never touches tenant data.
revoke all on public.organizations, public.profiles, public.memberships, public.invitations from anon;

-- organizations: members read; owner/admin update. Create/delete go through RPC / service role.
create policy "members read their orgs" on public.organizations
  for select to authenticated
  using (deleted_at is null and private.is_member(id));

create policy "owners and admins update their org" on public.organizations
  for update to authenticated
  using (private.has_role(id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_role(id, array['owner', 'admin']::public.org_role[]));

revoke insert, delete on public.organizations from authenticated;
revoke update on public.organizations from authenticated;
grant update (name, timezone, phone, logo_path, settings) on public.organizations to authenticated;

-- profiles: read your own and people you share an org with; edit only your own safe columns.
create policy "read own and teammates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

-- memberships: members see their org's roster; owner/admin change roles or deactivate.
create policy "members read their org's memberships" on public.memberships
  for select to authenticated
  using (private.is_member(organization_id) or user_id = (select auth.uid()));

create policy "owners and admins update memberships" on public.memberships
  for update to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_role(organization_id, array['owner', 'admin']::public.org_role[]));

create policy "owners and admins remove memberships" on public.memberships
  for delete to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.org_role[]));

revoke insert on public.memberships from authenticated;
revoke update on public.memberships from authenticated;
grant update (role, active) on public.memberships to authenticated;

-- invitations: owner/admin manage. Invitees use the RPCs below.
create policy "owners and admins read invitations" on public.invitations
  for select to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.org_role[]));

create policy "owners and admins create invitations" on public.invitations
  for insert to authenticated
  with check (
    private.has_role(organization_id, array['owner', 'admin']::public.org_role[])
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
  );

create policy "owners and admins revoke invitations" on public.invitations
  for delete to authenticated
  using (private.has_role(organization_id, array['owner', 'admin']::public.org_role[]));

revoke update on public.invitations from authenticated;
revoke insert on public.invitations from authenticated;
grant insert (organization_id, email, role, invited_by, expires_at) on public.invitations to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------

-- Create an organization and make the caller its owner.
create or replace function public.create_organization(
  org_name text,
  org_slug text,
  org_timezone text default 'America/Winnipeg'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_org uuid;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug, timezone, created_by)
  values (btrim(org_name), lower(btrim(org_slug)), coalesce(org_timezone, 'America/Winnipeg'), caller)
  returning id into new_org;

  insert into public.memberships (organization_id, user_id, role, created_by)
  values (new_org, caller, 'owner', caller);

  return new_org;
end;
$$;

-- Public details of an invitation, for the accept screen.
create or replace function public.get_invitation(invite_token uuid)
returns table (organization_name text, role public.org_role, email text, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.role, i.email, i.expires_at < now(), i.accepted_at is not null
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = invite_token and o.deleted_at is null;
$$;

-- Accept an invitation. The signed-in user's email must match the invite.
create or replace function public.accept_invitation(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
  inv public.invitations%rowtype;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  select email into caller_email from auth.users where id = caller;

  select * into inv from public.invitations where token = invite_token for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation already used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitation expired';
  end if;
  if lower(inv.email) <> lower(coalesce(caller_email, '')) then
    raise exception 'this invitation was sent to a different email address';
  end if;

  insert into public.memberships (organization_id, user_id, role, created_by)
  values (inv.organization_id, caller, inv.role, inv.invited_by)
  on conflict (organization_id, user_id) do update
    set active = true,
        role = case when public.memberships.role = 'owner' then 'owner'::public.org_role else excluded.role end;

  update public.invitations
     set accepted_at = now(), accepted_by = caller
   where id = inv.id;

  return inv.organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public, anon;
revoke all on function public.get_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.get_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
