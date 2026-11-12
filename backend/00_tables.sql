-- Tiko backend, file 00: tables, server-side guards (triggers), indexes, seed, and the lock-down.
-- Safe to run more than once (it does NOT migrate: a changed constraint on an existing table needs an ALTER, see README).
-- Run it first, in the Supabase SQL editor of the TEST project.
-- No child's name or personal detail is stored anywhere in these tables.
--
-- Child and device ids are made on the tablet. They are scoped to the account: the primary keys are
-- (account_id, id), and progress carries the account id too. So another account can neither learn that an id
-- exists nor take it before the real owner.

begin;

-- ---------------------------------------------------------------- open countries
create table if not exists public.open_countries (
  code text primary key constraint open_countries_code_chk check (code ~ '^[A-Z]{2}$')
);

-- ---------------------------------------------------------------- accounts
-- One row per parent. The email lives only in Supabase's own auth.users table.
create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  country text not null constraint accounts_country_chk check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  dormant_warned_at timestamptz
);
alter table public.accounts add column if not exists dormant_warned_at timestamptz;

-- ---------------------------------------------------------------- consents
create table if not exists public.consents (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  policy_version text not null constraint consents_policy_version_chk check (char_length(policy_version) between 1 and 64),
  what text not null constraint consents_what_chk check (char_length(what) between 1 and 200),
  adult_confirmed boolean not null constraint consents_adult_chk check (adult_confirmed),
  agreed_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

-- ---------------------------------------------------------------- children
create table if not exists public.children (
  id uuid not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  nickname text not null constraint children_nickname_chk check (char_length(nickname) between 1 and 20),
  avatar text not null default '' constraint children_avatar_chk check (char_length(avatar) <= 16),
  lang text not null constraint children_lang_chk check (lang in ('en', 'fr')),
  created_at timestamptz not null default now(),
  primary key (account_id, id)
);

-- ---------------------------------------------------------------- progress
-- The size limit is on the text form of the JSON (exact and uncompressed): 131072 bytes (128 KB) for now.
-- A later piece measures real section sizes and may lower it.
create table if not exists public.progress (
  account_id uuid not null,
  child_id uuid not null,
  section text not null constraint progress_section_chk
    check (section in ('boxes', 'levels', 'journey', 'days', 'rewards', 'science', 'settings', 'meta')),
  data jsonb not null
    constraint progress_data_object_chk check (jsonb_typeof(data) = 'object')
    constraint progress_data_size_chk check (octet_length(data::text) <= 131072),
  format int not null constraint progress_format_chk check (format >= 0),
  device_id uuid,   -- free value, deliberately no foreign key and not checked to be the caller's device (harmless)
  updated_at timestamptz not null default now(),
  primary key (account_id, child_id, section),
  foreign key (account_id, child_id) references public.children (account_id, id) on delete cascade
);

-- ---------------------------------------------------------------- devices
create table if not exists public.devices (
  id uuid not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  app_version int not null constraint devices_app_version_chk check (app_version >= 0),
  last_backup_at timestamptz,
  primary key (account_id, id)
);

-- ---------------------------------------------------------------- indexes
-- (children, devices and progress are already indexed by their primary keys, which start with account_id)
create index if not exists consents_account_id_idx on public.consents (account_id);

-- ---------------------------------------------------------------- guard functions (triggers)
-- All are SECURITY INVOKER (the default) so that row-level security still applies inside them,
-- with an empty search_path and fully qualified names.
-- "client" below means a request that carries a signed-in user (auth.uid() is not null);
-- the SQL editor, scheduled jobs and service_role have no such user and are not restricted by the "client" rules.
-- On INSERT, a client row for another account is let through untouched: the row policy refuses it right
-- after the trigger, so the trigger never locks or counts another account's rows.

create or replace function public.tg_accounts_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    -- an upsert of an existing account row turns into an update: no country check then
    if not exists (select 1 from public.accounts x where x.id = new.id)
       and not exists (select 1 from public.open_countries oc where oc.code = new.country) then
      raise exception 'accounts are not open in this country yet';
    end if;
    new.created_at := pg_catalog.now();
    new.last_seen_at := pg_catalog.now();
    new.dormant_warned_at := null;
    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id then
    raise exception 'the account id cannot be changed';
  end if;
  new.created_at := old.created_at;
  if (select auth.uid()) is not null then
    if new.country is distinct from old.country then
      raise exception 'the country cannot be changed';
    end if;
    new.last_seen_at := pg_catalog.now();   -- the parent is active, so any warning is cleared
    new.dormant_warned_at := null;
  end if;
  return new;
end
$fn$;

create or replace function public.tg_consents_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    new.agreed_at := pg_catalog.now();
    new.withdrawn_at := null;
    if (select auth.uid()) is not null and new.account_id is distinct from (select auth.uid()) then
      return new;   -- refused by the row policy next
    end if;
    -- one account at a time, so two parallel requests cannot both pass the count
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('consents:' || new.account_id::text, 0));
    if (select pg_catalog.count(*) from public.consents c where c.account_id = new.account_id) >= 50 then
      raise exception 'consent record limit reached (50 per account)';
    end if;
    return new;
  end if;

  -- UPDATE: never from a signed-in client (they also have no privilege to do it).
  -- Intended: from the SQL editor, service_role or a later withdrawal function (no signed-in user) it is allowed.
  if (select auth.uid()) is not null then
    raise exception 'consent records cannot be edited';
  end if;
  return new;
end
$fn$;

create or replace function public.tg_children_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.now();
    if (select auth.uid()) is not null and new.account_id is distinct from (select auth.uid()) then
      return new;   -- refused by the row policy next
    end if;
    -- the lock comes first, so a parallel request that creates the same child is seen by the test below
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('children:' || new.account_id::text, 0));
    if exists (select 1 from public.children c where c.account_id = new.account_id and c.id = new.id) then
      return new;   -- an upsert of an existing child: it turns into an update, no new row, no limit
    end if;
    if (select pg_catalog.count(*) from public.children c where c.account_id = new.account_id) >= 10 then
      raise exception 'child limit reached (10 per account)';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id then
    raise exception 'the child id cannot be changed';
  end if;
  if new.account_id is distinct from old.account_id then
    raise exception 'a child cannot be moved to another account';
  end if;
  new.created_at := old.created_at;
  return new;
end
$fn$;

create or replace function public.tg_progress_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'UPDATE' then
    if new.account_id is distinct from old.account_id
       or new.child_id is distinct from old.child_id
       or new.section is distinct from old.section then
      raise exception 'account, child and section cannot be changed';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$fn$;

create or replace function public.tg_devices_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.last_backup_at is not null then
      new.last_backup_at := pg_catalog.now();
    end if;
    if (select auth.uid()) is not null and new.account_id is distinct from (select auth.uid()) then
      return new;   -- refused by the row policy next
    end if;
    -- the lock comes first, so a parallel request that creates the same device is seen by the test below
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('devices:' || new.account_id::text, 0));
    if exists (select 1 from public.devices d where d.account_id = new.account_id and d.id = new.id) then
      return new;   -- an upsert of an existing device: no new row, no limit
    end if;
    if (select pg_catalog.count(*) from public.devices d where d.account_id = new.account_id) >= 10 then
      raise exception 'device limit reached (10 per account)';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id then
    raise exception 'the device id cannot be changed';
  end if;
  if new.account_id is distinct from old.account_id then
    raise exception 'a device cannot be moved to another account';
  end if;
  -- a client may clear last_backup_at (harmless); any new value is the server's clock, not the tablet's
  if new.last_backup_at is distinct from old.last_backup_at and new.last_backup_at is not null then
    new.last_backup_at := pg_catalog.now();
  end if;
  return new;
end
$fn$;

-- Trigger functions are never meant to be called by anyone directly.
revoke all on function public.tg_accounts_guard() from public, anon, authenticated;
revoke all on function public.tg_consents_guard() from public, anon, authenticated;
revoke all on function public.tg_children_guard() from public, anon, authenticated;
revoke all on function public.tg_progress_guard() from public, anon, authenticated;
revoke all on function public.tg_devices_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------- triggers
drop trigger if exists accounts_guard on public.accounts;
create trigger accounts_guard before insert or update on public.accounts
  for each row execute function public.tg_accounts_guard();

drop trigger if exists consents_guard on public.consents;
create trigger consents_guard before insert or update on public.consents
  for each row execute function public.tg_consents_guard();

drop trigger if exists children_guard on public.children;
create trigger children_guard before insert or update on public.children
  for each row execute function public.tg_children_guard();

drop trigger if exists progress_guard on public.progress;
create trigger progress_guard before insert or update on public.progress
  for each row execute function public.tg_progress_guard();

drop trigger if exists devices_guard on public.devices;
create trigger devices_guard before insert or update on public.devices
  for each row execute function public.tg_devices_guard();

-- ---------------------------------------------------------------- seed: open countries
-- 27 EU states, Iceland, Liechtenstein, Norway, United Kingdom. The owner's home country is added later.
-- (Done before row-level security is forced below.)
insert into public.open_countries (code) values
  ('AT'),('BE'),('BG'),('HR'),('CY'),('CZ'),('DK'),('EE'),('FI'),('FR'),('DE'),('GR'),('HU'),('IE'),
  ('IT'),('LV'),('LT'),('LU'),('MT'),('NL'),('PL'),('PT'),('RO'),('SK'),('SI'),('ES'),('SE'),
  ('IS'),('LI'),('NO'),('GB')
on conflict (code) do nothing;

-- ---------------------------------------------------------------- closed from birth
-- Supabase normally grants everything on a new table to anon and authenticated. Take it away, and switch row-level
-- security on and force it, in THIS transaction, so there is never a moment when the new tables are reachable
-- through the public API (even if file 10 is never run). File 10 repeats this and adds the rights and policies.
revoke all on table public.accounts, public.consents, public.children, public.progress,
                    public.devices, public.open_countries from anon, authenticated;
revoke all on sequence public.consents_id_seq from anon, authenticated;

alter table public.accounts       enable row level security;
alter table public.accounts       force row level security;
alter table public.consents       enable row level security;
alter table public.consents       force row level security;
alter table public.children       enable row level security;
alter table public.children       force row level security;
alter table public.progress       enable row level security;
alter table public.progress       force row level security;
alter table public.devices        enable row level security;
alter table public.devices        force row level security;
alter table public.open_countries enable row level security;
alter table public.open_countries force row level security;

-- The table owner (role postgres) must still be able to seed and run the dormant job when forced RLS binds it
-- (it does not bind a role with BYPASSRLS; 99_verify.sql prints whether postgres has it: to confirm).
drop policy if exists open_countries_owner on public.open_countries;
create policy open_countries_owner on public.open_countries for all to postgres
  using (true) with check (true);
drop policy if exists accounts_owner on public.accounts;
create policy accounts_owner on public.accounts for all to postgres
  using (true) with check (true);

commit;

notify pgrst, 'reload schema';
