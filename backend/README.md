# Tiko backend: the database

This folder holds the SQL for the Tiko parent-account backend (Supabase) and nothing else. No app file uses it yet.
Nothing here stores a child's name: a child is a random id and a short nickname the parent picks.

Apply everything to the **test project first**. Nothing in this folder has been run against a database yet (it was written by
careful reading and reviewed); the attack check described below is what proves it.

## Files

| File | What it does | When |
|---|---|---|
| `00_tables.sql` | the six tables, limits, server-set fields (triggers), the list of open countries, and the lock-down (rights revoked, row-level security on and forced) in the same transaction | first |
| `10_security.sql` | repeats the lock-down, gives back only what is needed, writes the policies (including the refusal of anonymous users), and stops later objects from being born public | second |
| `20_functions.sql` | `delete_my_account()` and `export_my_data()` | third |
| `99_verify.sql` | read-only self-check of the settings; every row must say `true`; "info:" rows must be pasted back | fourth, and after any later change |
| `90_dormant.sql` | dormant-account job. **Do not apply yet**: only when the email sender exists | later |

Every file can be run twice without harm, **but 00, 10 and 20 are always re-run together, in that order**: file 00 revokes every
right of signed-in parents and only file 10 gives them back, so re-running 00 alone leaves the app locked out ("permission denied",
which fails closed, not a leak). Each file is a single transaction: if a statement fails, nothing in that file is kept; fix
the cause and run it again. "Safe to run twice" is not "migrates": `create table if not exists` keeps an existing table as it is, so
a later change to a table or a constraint (for example the progress size limit) needs its own `alter` statement.

## How to apply (test project)

1. **Dashboard settings** below (items 1 to 4, 6 and 7). **Leave "Confirm email" ON for now.**
2. Open the project's **SQL Editor** (left menu), paste the whole of `00_tables.sql`, run it. Then `10_security.sql`, then
   `20_functions.sql`, each pasted whole, in that order.
   - The editor may ask you to confirm a "destructive operation" because the files contain `drop policy` and `drop trigger`. That is
     expected: confirm it (to confirm that the dialog appears).
   - If a file shows an error, copy the exact message, then run `rollback;` **on its own** (it clears a transaction the editor's session
     may still hold open; harmless if there is nothing to roll back; to confirm), and only then paste the files again, **all three**
     (00, 10, 20) in order.
   - After file 00 alone the tables are already closed to the public API.
3. Paste `99_verify.sql` and run it. Every row must show `true` in the `ok` column. Paste back any row that shows false, and the
   "info:" rows.
4. Now switch "Confirm email" **OFF** in the test project and save. On this PC run `node D:\new\tools\rls-check.js`. It must print
   `leftover accounts: none` and no `FAIL` line.
5. Switch "Confirm email" back **ON** straight away (or pause the project).
6. Never run `90_dormant.sql` until the warning-email piece exists.

## What the database enforces

- Row-level security is **enabled and forced** on all six tables. A signed-in parent reads and writes only rows that belong to them;
  a visitor who is not signed in can read only `open_countries`. Anonymous (guest) sign-ins are refused in the database as well
  (restrictive policy `no_anonymous_users`), as a second lock behind the dashboard switch.
- All table rights are first revoked from `anon` and `authenticated`, then granted one by one. There is no right to delete an
  account row, to edit or delete a consent, or to write `open_countries`, and no signed-in parent can erase an account except through `delete_my_account()` (the dashboard, the SQL editor and
  `service_role` of course still can).
- **Ids are scoped to the account.** `children` and `devices` have primary keys `(account_id, id)`; `progress` has `account_id` too,
  primary key `(account_id, child_id, section)`, and a foreign key `(account_id, child_id)` to `children(account_id, id)`. So every
  policy is the same plain rule `account_id = the signed-in user`; another account can neither learn that a tablet-made id exists nor
  take it before its owner (no "already exists" oracle, no squatting). Two accounts may hold the same child id as two separate rows.
  App note: upserts must name the key, for example `?on_conflict=account_id,id` (children, devices) and
  `?on_conflict=account_id,child_id,section` (progress).
- Server-set fields: `created_at`, `last_seen_at`, `agreed_at`, `updated_at` and `last_backup_at` are always overwritten by the server
  clock; a time sent by a tablet is ignored (the exception: a client may clear `last_backup_at`, which is harmless). Key columns
  (`id`, `account_id`, `child_id`, `section`, `country`) cannot be changed after creation.
- Limits: 10 children, 10 devices and 50 consent records per account (clear error message; guarded against two requests at the same
  instant; an upsert of an existing child or device does not count as a new one); a progress section must be a JSON object of at
  most 131072 bytes (128 KB, measured on its text form); section names are a fixed list of eight. 128 KB is a first, generous
  value: a later piece measures real section sizes and may lower it (the free database is 500 MB: to confirm).
- An account can only be created for a country in `open_countries` (31 rows: 27 EU states, IS, LI, NO, GB; add the home country later with
  `insert into public.open_countries (code) values ('XX');` in the SQL editor). An upsert of an existing account row skips that check.
- `delete_my_account()` (security definer, empty `search_path`, no parameters, signed-in callers only) deletes the caller's row in
  `auth.users`; the foreign keys (`on delete cascade`) then remove the account, consents, children, progress and devices.
- `export_my_data()` (security invoker, so the policies still apply) returns `{ account, consents, children, progress, devices, exported_at }`;
  `account` also carries the sign-in email taken from the caller's own token (it may be stale after an email change).
- Later objects are not born public: file 10 removes the default rights of `anon` and `authenticated` on new tables, sequences and
  functions made by the `postgres` role (to confirm that it takes effect; `99_verify.sql` prints the defaults). From then on every new
  table needs its own `revoke`/`grant`, RLS and policies, and every new view needs `security_invoker = true`. The function rule
  (`revoke execute ... from public`) is global, not only for `public`: it applies to every function the `postgres` role creates later,
  in any schema, which can surprise when an extension is enabled later while connected as `postgres` (low likelihood; to confirm).

## Things that are accepted or still to confirm

- Approximate row counts (`Prefer: count=estimated`) and the API's table and column names are visible to a signed-in user. No data is
  exposed. If GraphQL is not used, the extension can be disabled (to confirm it is on).
- `progress.device_id` is a free value, not checked to be the caller's device: harmless.
- **Is `delete_my_account()` allowed?** It needs the `postgres` role to hold DELETE on `auth.users` **and** either no row-level
  security on `auth.users` or BYPASSRLS on `postgres` (otherwise the delete finds no row and the function says "no account found")
  (to confirm). `99_verify.sql` prints both facts as rows.
- If `postgres` has no BYPASSRLS (info row), then `select * from public.children` (and consents, progress, devices) in the SQL editor
  shows 0 rows by design: those tables have no owner policy. That is not a fault. **Fallback only, if that row is false:** an Edge Function that checks the caller's token and calls the
  admin API `auth.admin.deleteUser(uid)`. That needs the administrative key on the server side only (never in the app, never in this
  repository). Do not build it unless the row is false.
- **Audit log (to confirm):** Supabase's own `auth.audit_log_entries` table has no foreign key to the user and its payload may hold
  the email address and IP address; the platform's request logs keep IP addresses for some days. Whether these exist on the project, can
  be switched off or can be purged is to confirm. Until then the privacy page must not promise that "everything is deleted at once".
- The dormant job moves later to a `private` schema if the API description should not show it (file 90).

## Dashboard settings (things SQL cannot set)

Menu names are from memory of the Supabase dashboard and may differ slightly; every item marked **(to confirm)** must be checked on screen.

1. **Authentication, Providers (or Sign In / Providers), Email: on.** (to confirm the menu path)
2. **Email OTP length: 6** and **expiry: 600 seconds** (10 minutes). Look for "Email OTP Length" and "Email OTP Expiration" on the Email
   provider page or under Authentication, Sign In / Providers. (to confirm both field names and that they are there)
3. **Email templates** (Authentication, Emails, Templates). Change both "Magic Link" and "Confirm signup" (to confirm which one the
   service sends in each situation) so that they show the code and no link. Use `{{ .Token }}` and do not use `{{ .ConfirmationURL }}`.
   One template serves everyone, so each carries English and French:

   Subject: `Your Tiko code / Votre code Tiko`

   ```html
   <p>Your Tiko sign-in code is:</p>
   <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>It works for 10 minutes. If you did not ask for it, you can ignore this email.</p>
   <hr>
   <p>Votre code de connexion Tiko :</p>
   <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>Il est valable 10 minutes. Si vous ne l'avez pas demand&eacute;, ignorez simplement ce message.</p>
   ```
4. **Anonymous sign-ins: off** (Authentication, Sign In / Providers, "Allow anonymous sign-ins"). The check fails if they are on. (to confirm the label)
5. **Test project only, and only for the minutes of step 4: "Confirm email" OFF** (Email provider settings), so that `rls-check.js`
   can create throwaway accounts with a password and no mailbox. Leave it ON during set-up and switch it back ON right after the check:
   with it off anybody who holds the publishable key can create accounts without a mailbox. The check asks the project
   (`/auth/v1/settings`, field `mailer_autoconfirm`; field name to confirm) and **refuses to sign anybody up unless auto-confirm is
   on**. Never switch this off on the live project.
6. **Region:** the owner has confirmed that the test project is in an EU region (a region cannot be changed after creation: to confirm).
7. **API settings:** the `public` schema is exposed to the data API by default (to confirm). That is intended: nothing in it is
   reachable without the policies above.

## Checklist for the LIVE project (not now)

- "Confirm email" **stays on** (back on, if it was ever off); parents sign in only with the emailed code.
- **CAPTCHA** on sign-in and sign-up (Authentication, Attack Protection; to confirm the label and the provider choice, which is a third party to review for privacy).
- Review the auth email rate limits and the sign-in rate limits (Authentication, Rate Limits; to confirm).
- A **custom mail sender** with its own sending limit (the built-in one is, to confirm, limited to a few emails an hour and not meant for
  real users).
- **Spend cap on** and a watch on the database size on the usage page (paid plan; to confirm the options), because one account can store
  up to 10 children x 8 sections x 128 KB and the free database is small.
- Whether password sign-up should be switched off on live: to be decided then (to confirm it can be, without stopping the emailed code).
- Run `99_verify.sql` on live too; never run `rls-check.js` against live (it refuses to run unless "Confirm email" is off).

## The attack check

`node D:\new\tools\rls-check.js` reads the address and the publishable key from `D:\New\supabase.md`, creates throwaway parents A, B
(and C), proves that B cannot read, change, count or hijack anything of A's (also through embedded joins), that a visitor is refused
against A's real rows for the right reason, that limits, validation and server-set fields hold, that export contains exactly the
caller's rows, and that deleting an account removes everything; then it deletes every account it made and prints
`leftover accounts: none`. It prints "TEST PROJECT ONLY" at the start.

Safety built into the tool: it refuses to use anything but the publishable key (it refuses to start if `supabase.md` holds a secret
key or a JWT whose role is not `anon`) and refuses to start unless `supabase.md` names exactly one project address; it refuses to
sign up unless auto-confirm is on; every update or delete must name a row id; it never sends an unfiltered write, never writes
to `open_countries`, and every write attempt names rows that the run created itself. It cleans up on normal exit, on an error and
on Ctrl-C (after Ctrl-C no new account is made; an account whose sign-up answer was lost is found again by signing in). If it cannot delete an account it lists the email addresses so they can be removed by hand in the dashboard
(Authentication, Users). It makes about 4 sign-ups and about 8 password sign-ins per run: repeated runs within minutes may hit
rate limits (the tool then reports the exact answer; to confirm the limits). The throwaway addresses are `rls-<random>@example.com`;
if the service rejects that domain (a real chance; to confirm), the check prints a hint and you set
`$env:RLS_EMAIL_DOMAIN = "yourdomain.example"` (any domain you control; no mail is sent while "Confirm email" is off) before running it.
App note for later: a request that inserts several rows at once must give every object the same keys (or name `?columns=`).

It stops cleanly with "tables not found" before the SQL is applied. Run it again after every change to this folder, **against the
test project only**.

## Not done here (later pieces)

The app side (`cloud.js`, consent screen), the warning email, withdrawal of a consent (a new decision, not an edit), the `packs`
catalogue, the later tables (`shares`, `assignments`, `entitlements`), measuring real progress-section sizes.
