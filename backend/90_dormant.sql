-- Tiko backend, file 90: dormant accounts.
--
-- ############################################################################
-- #  DO NOT APPLY YET. Apply only when the email sender exists (a later piece). #
-- ############################################################################
-- Why: the function below MARKS accounts as warned and returns who to email. If it is scheduled before
-- something sends those emails, accounts would be marked "warned" without the parent ever being told,
-- and 30 days later they would be deleted. The owner must not run this file until the sender is built.
--
-- Rules (the owner's decision: 24 months):
--   * "last active" = the latest of accounts.last_seen_at, the sign-in service's last sign-in time and the
--     account's creation time (greatest() ignores NULLs).
--   * A warning only counts if it is NEWER than the last activity: a parent who came back after a warning
--     starts again, and is warned again before any deletion.
--   * Not active for 23 months and not (validly) warned -> mark dormant_warned_at = now(), return the account
--     with its email so the sender can warn the parent.
--   * Not active for 24 months and validly warned at least 30 days ago -> delete the account (cascade) and
--     return its id with action 'deleted' (no email address: it is gone).
--   * Sign-ups never finished (a sign-in record with no accounts row) older than 7 days are deleted too
--     (action 'purged'), so a stray email address does not stay on the server for ever.
-- Run it once a day. It is not callable by visitors or signed-in parents.
-- Consider later moving it out of the exposed "public" schema (for example to a "private" one) so that it never
-- appears in the API description.

begin;

create or replace function public.mark_dormant_accounts()
returns table (account_id uuid, email text, action text)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  r record;
begin
  -- 1. delete: dormant 24 months, validly warned at least 30 days ago. Done first so that nobody is warned
  --    and deleted in the same run.
  for r in
    select a.id
    from public.accounts a
    join auth.users u on u.id = a.id
    where a.dormant_warned_at is not null
      and a.dormant_warned_at <= pg_catalog.now() - interval '30 days'
      and a.dormant_warned_at > greatest(a.last_seen_at, u.last_sign_in_at, a.created_at)
      and greatest(a.last_seen_at, u.last_sign_in_at, a.created_at) < pg_catalog.now() - interval '24 months'
  loop
    delete from auth.users u2 where u2.id = r.id;   -- cascades to the account and all its rows
    account_id := r.id;
    email := null;
    action := 'deleted';
    return next;
  end loop;

  -- 2. warn: dormant 23 months, and not warned since the last activity
  for r in
    select a.id, u.email::text as email
    from public.accounts a
    join auth.users u on u.id = a.id
    where (a.dormant_warned_at is null
           or a.dormant_warned_at <= greatest(a.last_seen_at, u.last_sign_in_at, a.created_at))
      and greatest(a.last_seen_at, u.last_sign_in_at, a.created_at) < pg_catalog.now() - interval '23 months'
  loop
    update public.accounts a2 set dormant_warned_at = pg_catalog.now() where a2.id = r.id;
    account_id := r.id;
    email := r.email;
    action := 'warn';
    return next;
  end loop;

  -- 3. purge sign-ups that never became an account
  for r in
    select u.id
    from auth.users u
    where u.created_at < pg_catalog.now() - interval '7 days'
      and not exists (select 1 from public.accounts a where a.id = u.id)
  loop
    delete from auth.users u2 where u2.id = r.id;
    account_id := r.id;
    email := null;
    action := 'purged';
    return next;
  end loop;
end
$fn$;

revoke all on function public.mark_dormant_accounts() from public, anon, authenticated;
-- service_role is the role of the (later) email-sending job; it is not used by the app.
grant execute on function public.mark_dormant_accounts() to service_role;

-- ---------------------------------------------------------------- schedule (pg_cron)
-- Enable the extension first: Dashboard, Database, Extensions, "pg_cron" (to confirm the exact path).
-- Re-running cron.schedule with the same job name replaces the job (to confirm for the pg_cron version in use).
-- Daily at 03:17 UTC. NOTE: the result of the scheduled call is thrown away, so the email sender has to
-- call public.mark_dormant_accounts() itself instead of relying on this schedule, or this statement must be
-- changed when the sender is designed. Leave it commented until then.
--
-- create extension if not exists pg_cron;
-- select cron.schedule('tiko-dormant-accounts', '17 3 * * *', $job$select public.mark_dormant_accounts()$job$);

commit;

notify pgrst, 'reload schema';
