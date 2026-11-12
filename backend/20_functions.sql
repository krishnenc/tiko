-- Tiko backend, file 20: the two functions a signed-in parent can call. Run after 10_security.sql. Safe to run twice.
--
--   delete_my_account()  erases the caller's whole account (SECURITY DEFINER, no parameters)
--   export_my_data()     returns everything the server holds for the caller as one JSON object (SECURITY INVOKER)

begin;

-- ---------------------------------------------------------------- delete_my_account
-- Deleting the caller's row in auth.users removes, by cascade, the account and everything that hangs
-- from it (consents, children, progress, devices), and Supabase's own sessions and identities.
-- It can only ever touch auth.uid(): there are no parameters.
-- To confirm: that role postgres holds DELETE on auth.users (99_verify.sql shows it). If not, the fallback is an Edge
-- Function that checks the caller's token and calls the admin API (server-side key only); see the README.
-- Not removed by the cascade: Supabase's own auth.audit_log_entries (email and IP in its payload) and request logs.
-- Whether those exist and can be switched off is to confirm; the privacy page must say so until then.
-- The email in export_my_data() is the one in the caller's token, which may be stale after an email change.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  caller uuid := (select auth.uid());
  removed bigint;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from auth.users u where u.id = caller;
  get diagnostics removed = row_count;
  if removed = 0 then
    -- the sign-in record is already gone (for example a second call with an old token): nothing to do
    raise exception 'no account found' using errcode = 'P0002';
  end if;
end
$fn$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- export_my_data
-- SECURITY INVOKER: it runs as the caller, so row-level security applies exactly as for a direct query.
-- The explicit "= caller" filters are a second lock on top of the policies.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $fn$
declare
  caller uuid := (select auth.uid());
  result jsonb;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select pg_catalog.jsonb_build_object(
    'account', (
      select pg_catalog.to_jsonb(a) || pg_catalog.jsonb_build_object('email', (select auth.jwt()) ->> 'email')
      from public.accounts a where a.id = caller
    ),
    'consents', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.id), '[]'::jsonb)
      from public.consents c where c.account_id = caller
    ),
    'children', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(ch) order by ch.created_at, ch.id), '[]'::jsonb)
      from public.children ch where ch.account_id = caller
    ),
    'progress', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.child_id, p.section), '[]'::jsonb)
      from public.progress p where p.account_id = caller
    ),
    'devices', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d.id), '[]'::jsonb)
      from public.devices d where d.account_id = caller
    ),
    'exported_at', pg_catalog.now()
  ) into result;

  return result;
end
$fn$;

revoke all on function public.export_my_data() from public, anon, authenticated;
grant execute on function public.export_my_data() to authenticated;

commit;

notify pgrst, 'reload schema';
