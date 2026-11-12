-- Tiko backend, file 99: read-only self-check. Run after 00, 10 and 20. It changes nothing.
-- Every row must show ok = true. Paste any row that shows false back to the developer.
-- Rows that start with "info:" only report a fact (always true); read them and paste them back too.
-- Update the expected counts below whenever a policy, table or function is added.

select 'rls enabled and forced on ' || c.relname as what,
       (c.relrowsecurity and c.relforcerowsecurity) as ok
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('accounts', 'consents', 'children', 'progress', 'devices', 'open_countries')

union all
select 'six family tables exist', (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r' and c.relname in ('accounts', 'consents', 'children', 'progress', 'devices', 'open_countries')) = 6

union all
select 'no table in schema public lacks row-level security (count of tables without: ' || count(*) || ')',
       count(*) = 0
from pg_tables where schemaname = 'public' and not rowsecurity

union all
select 'anon has no privilege at all on ' || t,
       not has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete,truncate,references,trigger')
from unnest(array['accounts', 'consents', 'children', 'progress', 'devices']) as t

union all
select 'anon can only select open_countries',
       has_table_privilege('anon', 'public.open_countries', 'select')
       and not has_table_privilege('anon', 'public.open_countries', 'insert,update,delete,truncate')

union all
select 'authenticated cannot write open_countries',
       not has_table_privilege('authenticated', 'public.open_countries', 'insert,update,delete,truncate')

union all
select 'authenticated cannot update or delete consents, nor delete accounts',
       not has_table_privilege('authenticated', 'public.consents', 'update,delete,truncate')
       and not has_table_privilege('authenticated', 'public.accounts', 'delete,truncate')

union all
select 'authenticated has no truncate on any family table',
       not (has_table_privilege('authenticated', 'public.accounts', 'truncate')
         or has_table_privilege('authenticated', 'public.children', 'truncate')
         or has_table_privilege('authenticated', 'public.progress', 'truncate')
         or has_table_privilege('authenticated', 'public.devices', 'truncate')
         or has_table_privilege('authenticated', 'public.consents', 'truncate'))

union all
select 'function ' || p.proname || ' has an empty search_path, anon cannot run it, authenticated can',
       exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s where s = 'search_path=""')
       and not has_function_privilege('anon', p.oid, 'execute')
       and has_function_privilege('authenticated', p.oid, 'execute')
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname in ('delete_my_account', 'export_my_data')

union all
select 'info: stored function settings (expect search_path="") for ' || p.proname || ': ' || coalesce(p.proconfig::text, 'none'), true
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname in ('delete_my_account', 'export_my_data')

union all
select 'delete_my_account is security definer; export_my_data is security invoker',
       (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'delete_my_account')
       and not (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'export_my_data')

union all
select 'two functions found (delete_my_account, export_my_data)',
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
          and proname in ('delete_my_account', 'export_my_data')) = 2

union all
select 'no function in public is executable by anon (' || coalesce(string_agg(p.proname, ', '), 'none') || ')', count(*) = 0
from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')

union all
select 'anon holds no right on any relation in public but open_countries (' || coalesce(string_agg(c.relname, ', '), 'none') || ')', count(*) = 0
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  and c.relname <> 'open_countries'
  and (case when c.relkind = 'S' then has_sequence_privilege('anon', c.oid, 'usage,select,update')
            else has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger') end)

union all
select 'policies in place: ' || count(*) || ' (expected 25)', count(*) = 25
from pg_policies where schemaname = 'public'

union all
select 'open_countries holds ' || count(*) || ' countries (expected 31)', count(*) = 31
from public.open_countries

union all
select 'five guard triggers are in place',
       (select count(*) from pg_trigger where not tgisinternal
          and tgname in ('accounts_guard', 'consents_guard', 'children_guard', 'progress_guard', 'devices_guard')) = 5

union all
select 'children, devices and progress have account-scoped primary keys',
       (select count(*) from pg_constraint k where k.contype = 'p' and k.conrelid in
          ('public.children'::regclass, 'public.devices'::regclass) and
          (select array_agg(a.attname::text order by a.attname) from pg_attribute a
            where a.attrelid = k.conrelid and a.attnum = any (k.conkey)) = array['account_id', 'id']) = 2
       and (select count(*) from pg_constraint k where k.contype = 'p' and k.conrelid = 'public.progress'::regclass
            and array_length(k.conkey, 1) = 3) = 1

-- needed by delete_my_account(): settles "can the owner role delete sign-in records?" without a destructive test
union all
select 'postgres may delete from auth.users (needed by delete_my_account)',
       has_table_privilege('postgres', 'auth.users', 'delete')

union all
select 'info: auth.users has row-level security = ' || c.relrowsecurity::text
       || ' (if true and BYPASSRLS below is false, delete_my_account cannot see the row it deletes)', true
from pg_class c where c.oid = 'auth.users'::regclass

union all
select 'progress has the foreign key (account_id, child_id) -> children (account_id, id) on delete cascade',
       exists (select 1 from pg_constraint k
               where k.contype = 'f' and k.conrelid = 'public.progress'::regclass
                 and k.confrelid = 'public.children'::regclass and k.confdeltype = 'c'
                 and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                       where a.attrelid = k.conrelid and a.attnum = any (k.conkey)) = array['account_id', 'child_id'])

union all
select 'info: postgres has BYPASSRLS = ' || r.rolbypassrls::text, true from pg_roles r where r.rolname = 'postgres'

union all
select 'info: default privileges now: ' || coalesce(string_agg(
         defaclrole::regrole::text || ' / ' || coalesce(nullif(defaclnamespace::regnamespace::text, '-'), 'global')
         || ' / ' || defaclobjtype::text || ' = ' || defaclacl::text, ' ; '), 'none'), true
from pg_default_acl

order by 2, 1;
