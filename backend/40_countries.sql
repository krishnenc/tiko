-- Tiko backend: countries where parent accounts are open (added 17 November 2026).
-- Adds Mauritius (MU) and South Africa (ZA) to a project that was created from an earlier 00_tables.sql.
-- Safe to run more than once. Paste into the SQL Editor and run; the result shows the full list (33 rows).
--
-- The account screen offers every code in this table. The names come from ACCT_COUNTRIES (account.js); an app
-- release older than v56 shows these two as the bare codes "MU" and "ZA".

insert into public.open_countries (code) values ('MU'), ('ZA')
on conflict (code) do nothing;

select code from public.open_countries order by code;
