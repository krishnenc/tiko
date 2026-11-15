-- Tiko backend, file 30: the conditional, all-or-nothing upload of a child's backup. Run after 00, 10 and 20. Safe to run twice.
--
--   upload_sections(p_child, p_rows, p_expect, p_device)   SECURITY INVOKER, signed-in parents only
--
-- Why it exists: two tablets may back up the same child. A tablet reads what the server holds, and a moment later uploads. Without a guard a
-- second tablet could write between the two and be overwritten without anyone knowing. Here the tablet says which `updated_at` it BELIEVES
-- each of the eight sections has (p_expect); the server compares, under a lock on the child, in the same transaction as the write:
--   - every section equal to the belief  -> the rows of p_rows are written, and the new stamps are returned  { ok: true, stamps }
--   - any section different               -> NOTHING is written and the server's truth is returned         { ok: false, stamps, devices }
-- It adds no power: it is SECURITY INVOKER, so row-level security, the table checks and the triggers (tg_progress_guard sets updated_at)
-- do the protecting exactly as for a direct write. Its own refusals only keep the arguments honest.
-- Not changed by this file: 00, 10, 20, 90.
--
-- Arguments
--   p_child   the child's id (a child of the caller; another account's id answers "no such child", the same as an id that does not exist)
--   p_rows    a JSON array of at most 8 objects { "section": "...", "data": {...}, "format": n }, no other key, no section twice (may be empty)
--   p_expect  a JSON object naming EXACTLY the eight sections; each value is the updated_at in whole milliseconds the tablet believes the
--             section has on the server, or null for "there is no such row"
--   p_device  the tablet's random id (a free value, like progress.device_id itself; may be null)
--
-- Refusals (nothing is written in any of them; the whole call is one transaction)
--   28000  nobody is signed in                                  (also: execute is revoked from public and anon, so a visitor never gets this far)
--   22023  an argument is not what it must be                   (p_child null; p_rows not an array, more than 8, an item not an object with
--                                                                exactly section / data / format, a section name not one of the eight, a
--                                                                section twice, data not a JSON object, format not a whole number;
--                                                                p_expect not an object, not naming exactly the eight, a value that is not a
--                                                                number or null)
--   P0002  no such child                                        (not the caller's, or not there: one message for both, so no id can be probed)
--   23514  (from the table) a section over 131072 bytes, data not an object, format below 0
-- No dynamic SQL anywhere: the only text that reaches a statement is a value, never a name.

begin;

create or replace function public.upload_sections(p_child uuid, p_rows jsonb, p_expect jsonb, p_device uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  caller uuid := (select auth.uid());
  names constant text[] := array['boxes', 'levels', 'journey', 'days', 'rewards', 'science', 'settings', 'meta'];
  s text;
  r jsonb;
  seen text[] := '{}';
  nrows int;
  have jsonb;           -- section -> the stamp the server holds now, in whole ms
  dev jsonb;            -- section -> the device that wrote it (only where there is one)
  stamps jsonb := '{}'::jsonb;
  differ boolean := false;
  locked uuid;
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- ---- the arguments (read only; nothing has been locked or written yet)
  if p_child is null then
    raise exception 'a child is required' using errcode = '22023';
  end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be a list' using errcode = '22023';
  end if;
  nrows := pg_catalog.jsonb_array_length(p_rows);
  if nrows > 8 then
    raise exception 'at most eight sections' using errcode = '22023';
  end if;
  if p_expect is null or pg_catalog.jsonb_typeof(p_expect) <> 'object' then
    raise exception 'expect must be an object' using errcode = '22023';
  end if;
  -- exactly the eight names: no name missing (checked one by one below) and none extra (the count)
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_expect)) <> 8 then
    raise exception 'expect must name the eight sections' using errcode = '22023';
  end if;
  foreach s in array names loop
    if not (p_expect ? s) then
      raise exception 'expect must name the eight sections' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(p_expect -> s) not in ('number', 'null') then
      raise exception 'an expected stamp must be a number or null' using errcode = '22023';
    end if;
  end loop;
  for r in select e.value from pg_catalog.jsonb_array_elements(p_rows) e loop
    if pg_catalog.jsonb_typeof(r) <> 'object'
       or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(r)) <> 3
       or not (r ? 'section' and r ? 'data' and r ? 'format') then
      raise exception 'a row must hold exactly section, data and format' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(r -> 'section') <> 'string' or not ((r ->> 'section') = any (names)) then
      raise exception 'unknown section' using errcode = '22023';
    end if;
    if (r ->> 'section') = any (seen) then
      raise exception 'a section twice' using errcode = '22023';
    end if;
    seen := seen || (r ->> 'section');
    if pg_catalog.jsonb_typeof(r -> 'data') <> 'object' then
      raise exception 'data must be an object' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(r -> 'format') <> 'number' or (r ->> 'format') !~ '^[0-9]{1,9}$' then
      raise exception 'format must be a whole number' using errcode = '22023';
    end if;
  end loop;

  -- ---- the lock: the child's own row, for this caller only. Row-level security applies (an UPDATE policy "account_id = caller" is what lets
  -- FOR UPDATE see the row), so another account's child and a child that does not exist are the same answer. Two uploads for one child
  -- queue here; the second one reads AFTER the first has committed (READ COMMITTED: each statement takes a new snapshot).
  select c.id into locked from public.children c where c.account_id = caller and c.id = p_child for update;
  if locked is null then
    raise exception 'no such child' using errcode = 'P0002';
  end if;

  -- ---- what the server holds now (whole ms; cut to milliseconds first, then rounded, so double-precision arithmetic cannot be off by one)
  select coalesce(pg_catalog.jsonb_object_agg(p.section,
           pg_catalog.round(pg_catalog.date_part('epoch', pg_catalog.date_trunc('milliseconds', p.updated_at)) * 1000)::bigint), '{}'::jsonb),
         coalesce(pg_catalog.jsonb_object_agg(p.section, p.device_id) filter (where p.device_id is not null), '{}'::jsonb)
    into have, dev
    from public.progress p
   where p.account_id = caller and p.child_id = p_child;

  foreach s in array names loop
    stamps := stamps || pg_catalog.jsonb_build_object(s, have -> s);           -- null where there is no row
    if ((p_expect ->> s)::numeric) is distinct from ((have ->> s)::numeric) then
      differ := true;
    end if;
  end loop;

  if differ then
    return pg_catalog.jsonb_build_object('ok', false, 'stamps', stamps, 'devices', dev);
  end if;

  -- ---- all equal: write. Each row names its key; account_id is the caller, never a value from the arguments.
  for r in select e.value from pg_catalog.jsonb_array_elements(p_rows) e loop
    insert into public.progress as pr (account_id, child_id, section, data, format, device_id)
    values (caller, p_child, r ->> 'section', r -> 'data', (r ->> 'format')::int, p_device)
    on conflict (account_id, child_id, section)
    do update set data = excluded.data, format = excluded.format, device_id = excluded.device_id;
  end loop;

  -- ---- the new stamps (all eight; null where there is still no row)
  select coalesce(pg_catalog.jsonb_object_agg(p.section,
           pg_catalog.round(pg_catalog.date_part('epoch', pg_catalog.date_trunc('milliseconds', p.updated_at)) * 1000)::bigint), '{}'::jsonb)
    into have
    from public.progress p
   where p.account_id = caller and p.child_id = p_child;
  stamps := '{}'::jsonb;
  foreach s in array names loop
    stamps := stamps || pg_catalog.jsonb_build_object(s, have -> s);
  end loop;
  return pg_catalog.jsonb_build_object('ok', true, 'stamps', stamps);
end
$fn$;

revoke all on function public.upload_sections(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.upload_sections(uuid, jsonb, jsonb, uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
