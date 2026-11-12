-- Tiko backend, file 10: privileges and row-level security. Run after 00_tables.sql. Safe to run twice.
--
-- Principle: take everything away from the two public roles first, then give back only what the
-- policies need. Row-level security is enabled AND forced on all six tables.
--   anon          = a visitor who is not signed in
--   authenticated = a signed-in parent
-- Because child and device ids are scoped to the account (primary keys start with account_id), every family policy
-- is the same plain rule: account_id = the signed-in user. progress carries account_id itself, and its foreign key
-- (account_id, child_id) -> children(account_id, id) means a progress row can only hang from the SAME account's child.

begin;

-- ---------------------------------------------------------------- start from nothing
revoke all on table public.accounts, public.consents, public.children, public.progress,
                    public.devices, public.open_countries from anon, authenticated;
revoke all on sequence public.consents_id_seq from anon, authenticated;

-- ---------------------------------------------------------------- privileges that are given back
-- (columns that the server owns are also protected by the triggers in file 00)
grant select, insert, update on table public.accounts to authenticated;          -- no delete: only delete_my_account()
grant select on table public.consents to authenticated;
grant insert (account_id, policy_version, what, adult_confirmed) on table public.consents to authenticated;
                                                                                  -- no update, no delete, no id / agreed_at / withdrawn_at
grant select, insert, update, delete on table public.children to authenticated;
grant select, insert, update, delete on table public.progress to authenticated;
grant select, insert, update, delete on table public.devices to authenticated;
grant select on table public.open_countries to anon, authenticated;              -- the only thing a visitor may read

-- ---------------------------------------------------------------- row-level security on, and forced
alter table public.accounts enable row level security;
alter table public.accounts force row level security;
alter table public.consents enable row level security;
alter table public.consents force row level security;
alter table public.children enable row level security;
alter table public.children force row level security;
alter table public.progress enable row level security;
alter table public.progress force row level security;
alter table public.devices enable row level security;
alter table public.devices force row level security;
alter table public.open_countries enable row level security;
alter table public.open_countries force row level security;

-- ---------------------------------------------------------------- policies
-- (select auth.uid()) instead of auth.uid(): evaluated once per statement, not once per row.

-- accounts
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists accounts_insert on public.accounts;
create policy accounts_insert on public.accounts for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists accounts_update on public.accounts;
create policy accounts_update on public.accounts for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- The table owner (role postgres) needs to read and update accounts for the dormant-account job.
-- With FORCE row level security the owner is subject to policies unless it has BYPASSRLS
-- (to confirm on hosted Supabase), so this policy makes it work either way.
drop policy if exists accounts_owner on public.accounts;
create policy accounts_owner on public.accounts for all to postgres
  using (true) with check (true);

-- consents: read and add only. Never edited or deleted from a client.
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents for select to authenticated
  using (account_id = (select auth.uid()));
drop policy if exists consents_insert on public.consents;
create policy consents_insert on public.consents for insert to authenticated
  with check (account_id = (select auth.uid()));

-- children
drop policy if exists children_select on public.children;
create policy children_select on public.children for select to authenticated
  using (account_id = (select auth.uid()));
drop policy if exists children_insert on public.children;
create policy children_insert on public.children for insert to authenticated
  with check (account_id = (select auth.uid()));
drop policy if exists children_update on public.children;
create policy children_update on public.children for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));
drop policy if exists children_delete on public.children;
create policy children_delete on public.children for delete to authenticated
  using (account_id = (select auth.uid()));

-- progress: same rule; the composite foreign key ties it to the caller's own child
drop policy if exists progress_select on public.progress;
create policy progress_select on public.progress for select to authenticated
  using (account_id = (select auth.uid()));
drop policy if exists progress_insert on public.progress;
create policy progress_insert on public.progress for insert to authenticated
  with check (account_id = (select auth.uid()));
drop policy if exists progress_update on public.progress;
create policy progress_update on public.progress for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));
drop policy if exists progress_delete on public.progress;
create policy progress_delete on public.progress for delete to authenticated
  using (account_id = (select auth.uid()));

-- devices
drop policy if exists devices_select on public.devices;
create policy devices_select on public.devices for select to authenticated
  using (account_id = (select auth.uid()));
drop policy if exists devices_insert on public.devices;
create policy devices_insert on public.devices for insert to authenticated
  with check (account_id = (select auth.uid()));
drop policy if exists devices_update on public.devices;
create policy devices_update on public.devices for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));
drop policy if exists devices_delete on public.devices;
create policy devices_delete on public.devices for delete to authenticated
  using (account_id = (select auth.uid()));

-- open_countries: readable by everyone, writable by nobody from the outside
drop policy if exists open_countries_select on public.open_countries;
create policy open_countries_select on public.open_countries for select to anon, authenticated
  using (true);
drop policy if exists open_countries_owner on public.open_countries;
create policy open_countries_owner on public.open_countries for all to postgres
  using (true) with check (true);

-- ---------------------------------------------------------------- no anonymous users (defence in depth)
-- Supabase's anonymous sign-ins give the role "authenticated" and a token claim is_anonymous = true.
-- They are switched off in the dashboard; these restrictive policies refuse them in the database too.
drop policy if exists no_anonymous_users on public.accounts;
create policy no_anonymous_users on public.accounts as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
drop policy if exists no_anonymous_users on public.consents;
create policy no_anonymous_users on public.consents as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
drop policy if exists no_anonymous_users on public.children;
create policy no_anonymous_users on public.children as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
drop policy if exists no_anonymous_users on public.progress;
create policy no_anonymous_users on public.progress as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
drop policy if exists no_anonymous_users on public.devices;
create policy no_anonymous_users on public.devices as restrictive for all to authenticated
  using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

-- ---------------------------------------------------------------- later objects are not born public
-- Supabase normally grants every new table, sequence and function in "public" to anon and authenticated, and a
-- new view bypasses row-level security. Remove those defaults for objects that role postgres creates from now on.
-- Every later object then needs its own explicit grants (and RLS, and for views security_invoker): intended.
-- Only anon and authenticated are touched; service_role and the Supabase admin roles keep their defaults.
-- To confirm: if Supabase set these defaults globally rather than "in schema public", the schema-level revoke does
-- not remove them; 99_verify.sql prints the current defaults (pg_default_acl) so this can be seen.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;   -- global; PostgreSQL's own default
-- (to confirm: that these two forms are accepted by the SQL editor's role; if a statement errors, send the message)

commit;

notify pgrst, 'reload schema';
