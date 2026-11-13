// Tiko backend piece 3: the ONLY code that knows about the parent-account backend (Supabase). Plain fetch, no library, no build step.
//
// OFF FOR EVERYONE. This file is not in index.html. app.js has cloudLoad(), which adds it only on a tablet that has the switch:
// localStorage['tiko.cloud'] = { "url": "https://<project>.supabase.co", "key": "<publishable key>" }. There is no address and no key in the
// repository. Without a valid switch every call answers { ok: false, error: 'off' } and no request is made.
// Only the parent's account screen (account.js, loaded together with this file by cloudLoad) calls these functions; no child's screen does.
//
// Every call returns a promise of { ok: true, data } or { ok: false, error, detail? }; it never throws and never waits for ever
// (15 s per request, 30 s overall per call, renewals and the repeat included).
// error: off | offline | signedout | code | throttled | country | limit | toobig | private | refused | storage | server
// Storage keys (tablet-wide, outside every child's save, never in a backup file): tiko.cloud (switch), tiko.auth (the session), tiko.device (this tablet's random id).
// NEVER sent: the child's name or spoken name, voice choices, chat, recordings, photos, anything in SAVE_LOCAL or SAVE_PRIVATE_SETTINGS
// (cloudUpload copies its payload once, checks the copy and sends that same copy; it refuses with 'private').
// The parent's email is used for sign-in only and is kept only in tiko.auth.
// No console output, no analytics, no request to any address but the configured one. Runs in a browser or, with a stubbed localStorage, in Node.

const CLOUD_TIMEOUT_MS = 15000;                    // every request
const CLOUD_CALL_MS = 30000;                       // one call as a whole: renewal, request, renewal, repeat
const CLOUD_SESSION_DAYS = 30;                     // a session older than this is dropped locally, whatever the server says
const CLOUD_MAX_SECTION_BYTES = 131072;            // the server's limit on one section, measured on the jsonb text form
const CLOUD_SECTIONS_LIST = ['boxes', 'levels', 'journey', 'days', 'rewards', 'science', 'settings', 'meta'];
// the keys each section may hold in its cloud form (a copy of SAVE_SECTIONS in app.js, with boxes packed into one key; the check compares them)
const CLOUD_SECTION_KEYS = {
  boxes: ['boxes'], levels: ['levels', 'streak', 'simonLen'], journey: ['seenStage', 'counts', 'placed', 'books', 'used'], days: ['days', 'diary', 'plays'],
  rewards: ['stars', 'stickers', 'badges', 'goals', 'totals'], science: ['sci'], settings: ['settings', 'lang'], meta: ['knownV22', 'memV23', 'newChild'],
};
// the only settings that may leave the tablet (a copy of SAVE_SYNCED_SETTINGS in app.js; when app.js is loaded too, a key must be in both lists)
const CLOUD_SETTINGS_ALLOWED = ['stops', 'perStop', 'sessionMin', 'theme', 'calm', 'breaks', 'nudge', 'artInPath', 'discovery', 'review', 'hide', 'font', 'spacing', 'textSize', 'simpleHome', 'listenFirst', 'sfx', 'music', 'ambient', 'ambientWork', 'voicePack'];
const CLOUD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let cloudRenewing = null;                          // the one renewal in flight, shared by calls that need it at the same moment
let cloudGen = 0;                                  // bumped by sign-in, sign-out, delete-account and the 30-day drop: a renewal or call that began under another number is void
let cloudMem = null;                               // the newest session when it could not be written to storage (kept for the life of the page; the write is retried)
let cloudDeviceMemo = null;

// ---------------------------------------------------------------- small helpers
const cloudOk = data => ({ ok: true, data: data === undefined ? null : data });
const cloudBad = (error, detail) => (detail === undefined ? { ok: false, error } : { ok: false, error, detail });
const cloudIsObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function cloudGuard(fn) { return (async () => { try { return await fn(); } catch (e) { return cloudBad('server'); } })(); }
function cloudStoreGet(key) { try { const t = localStorage.getItem(key); return t === null ? null : JSON.parse(t); } catch (e) { return null; } }
function cloudStoreSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
function cloudStoreDrop(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
// A server timestamp ("2026-11-13T10:00:00.123456+00:00", also "+00" or no fraction) to ms. Done by hand, not by Date parsing of microseconds
// (older WebKit refuses more than 3 fraction digits): the fraction is cut to milliseconds, the time zone is kept.
function cloudMs(iso) {
  const m = typeof iso === 'string' && /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(iso);
  if (!m) return null;
  let tz = m[8];
  if (tz !== 'Z') { const d = tz.replace(':', ''); tz = d.slice(0, 3) + ':' + (d.slice(3) || '00'); }
  const t = Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + '.' + ((m[7] || '') + '000').slice(0, 3) + tz);
  return Number.isFinite(t) ? t : null;
}
function cloudChars(s, n) { return Array.from(s).slice(0, n).join(''); }            // by code point, as the database counts
function cloudLen(s) { return Array.from(s).length; }
function cloudNewId() {
  try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch (e) { /* fall through */ }
  const b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
const cloudLeft = dl => dl - Date.now();

// ---------------------------------------------------------------- the switch
// An allow-list: a publishable key (sb_publishable_...), or a JWT of exactly three parts whose role is exactly "anon". Anything else is refused.
function cloudKeyOk(k) {
  if (typeof k !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{8,500}$/.test(k)) return true;
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k)) {
    try {
      const b = k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b + '='.repeat((4 - b.length % 4) % 4))).role === 'anon';
    } catch (e) { return false; }
  }
  return false;
}
// -> { url, key } or null. The address must be https, or the page's own origin (for the checks); nothing else (no path, no credentials).
function cloudCfg() {
  const c = cloudStoreGet('tiko.cloud');
  if (!cloudIsObj(c) || typeof c.url !== 'string' || typeof c.key !== 'string') return null;
  let u; try { u = new URL(c.url); } catch (e) { return null; }
  const own = typeof location !== 'undefined' && !!location && !!location.origin && u.origin === location.origin;
  if (!(u.protocol === 'https:' || own)) return null;
  if (u.username || u.password || u.search || u.hash || (u.pathname && u.pathname !== '/')) return null;
  if (!cloudKeyOk(c.key)) return null;
  return { url: u.origin, key: c.key };
}

// ---------------------------------------------------------------- the session (tiko.auth)
function cloudAuthClear() { cloudGen++; cloudMem = null; cloudStoreDrop('tiko.auth'); }
function cloudAuthShape(s) {
  return cloudIsObj(s) && typeof s.access === 'string' && typeof s.refresh === 'string' && typeof s.uid === 'string' && CLOUD_UUID.test(s.uid) && Number.isFinite(s.exp) && Number.isFinite(s.since)
    ? { access: s.access, refresh: s.refresh, exp: s.exp, uid: s.uid, email: typeof s.email === 'string' ? s.email : '', since: s.since } : null;
}
// the session as stored (or kept in memory), without any side effect; null when there is none
function cloudAuthPeek() { return cloudAuthShape(cloudMem || cloudStoreGet('tiko.auth')); }
// -> the session, or null (none, malformed, or older than 30 days: then it is cleared and the server is asked, best effort, to end it)
function cloudAuthGet() {
  const raw = cloudMem || cloudStoreGet('tiko.auth'), s = cloudAuthShape(raw);
  if (!s) { if (raw !== null) cloudAuthClear(); return null; }
  if (Date.now() - s.since > CLOUD_SESSION_DAYS * 864e5) {
    cloudAuthClear();
    const cfg = cloudCfg(); if (cfg) cloudServerLogout(cfg, s).catch(() => {});
    return null;
  }
  if (cloudMem && cloudStoreSet('tiko.auth', cloudMem)) cloudMem = null;          // a write that failed earlier is retried
  return s;
}
// the answer of /auth/v1/verify or /auth/v1/token -> a session object (not stored). Expiry is the tablet's clock at receipt plus expires_in.
function cloudSessionFrom(j, old, email) {
  if (!cloudIsObj(j) || typeof j.access_token !== 'string' || typeof j.refresh_token !== 'string') return null;
  const user = cloudIsObj(j.user) ? j.user : {}, uid = typeof user.id === 'string' ? user.id : (old ? old.uid : '');
  if (!CLOUD_UUID.test(uid)) return null;
  const now = Date.now();
  const exp = Number.isFinite(j.expires_in) ? now + j.expires_in * 1000 : (Number.isFinite(j.expires_at) ? j.expires_at * 1000 : now + 3600000);
  return { access: j.access_token, refresh: j.refresh_token, exp, uid, email: typeof user.email === 'string' ? user.email : (old ? old.email : (email || '')), since: old ? old.since : now };
}
// best effort: end this session on the server (scope=local: the parent's other tablets stay signed in). An expired access token is renewed first, once.
async function cloudServerLogout(cfg, s) {
  let token = s.access;
  if (s.exp <= Date.now() + 10000) {
    const r = await cloudRaw(cfg, 'POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh }, timeout: 5000 });
    if (r.status >= 200 && r.status < 300 && !r.bad && cloudIsObj(r.json) && typeof r.json.access_token === 'string') token = r.json.access_token; else return;
  }
  await cloudRaw(cfg, 'POST', '/auth/v1/logout?scope=local', { token, timeout: 5000 });
}
function cloudDeviceId() {
  try {
    const t = localStorage.getItem('tiko.device');
    if (typeof t === 'string' && CLOUD_UUID.test(t)) return t;
  } catch (e) { /* fall through */ }
  if (!cloudDeviceMemo) cloudDeviceMemo = cloudNewId();
  try { localStorage.setItem('tiko.device', cloudDeviceMemo); } catch (e) { /* kept in memory only */ }
  return cloudDeviceMemo;
}

// ---------------------------------------------------------------- one request
// -> { status, json, bad } or { net: true } (no answer: no network, refused, dropped, redirected, or the timeout). Never throws. The timer covers reading the body too.
async function cloudRaw(cfg, method, path, opts) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), Math.max(1, opts.timeout || CLOUD_TIMEOUT_MS));
  try {
    const h = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (opts.token) h.Authorization = 'Bearer ' + opts.token;
    if (opts.prefer) h.Prefer = opts.prefer;
    const res = await fetch(cfg.url + path, {
      method, headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctl.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error',
    });
    const text = await res.text();
    let json = null, bad = false;
    if (text) { try { json = JSON.parse(text); } catch (e) { bad = true; } }
    return { status: res.status, json, bad };
  } catch (e) {
    return { net: true };
  } finally {
    clearTimeout(timer);
  }
}
// a short code for the detail of an error answer: PostgREST's string code, else GoTrue's error_code (its numeric "code" is only the status)
function cloudCodeOf(j) { return typeof j.code === 'string' ? j.code : (typeof j.error_code === 'string' ? j.error_code : ''); }
// the error name for an answer that is not a success (and not a 401 that a renewal could cure)
function cloudKind(r) {
  if (r.net) return 'offline';
  if (r.status === 429) return 'throttled';
  if (r.status >= 500) return 'server';
  const j = cloudIsObj(r.json) ? r.json : {}, msg = String(j.message || j.msg || '');
  if (j.code === 'P0001' && /not open/i.test(msg)) return 'country';
  if (j.code === 'P0001' && /limit/i.test(msg)) return 'limit';
  if (j.code === '23514' && /progress_data_size_chk/.test(msg)) return 'toobig';
  return 'refused';
}
function cloudFinish(r) {
  if (r.net) return cloudBad('offline');
  if (r.status >= 200 && r.status < 300) return r.bad ? cloudBad('server', 'unreadable') : cloudOk(r.json);
  const j = cloudIsObj(r.json) ? r.json : {}, c = cloudCodeOf(j);
  return cloudBad(cloudKind(r), r.status + (c ? ' ' + c : ''));
}
// Renew the session once. `used` is the access token the caller sent: if the stored one differs, somebody already renewed and nothing is asked again.
// -> { ok: true } or an error answer. A renewal that fails for lack of network keeps the session; a refusal clears it. The result is stored ONLY if the
// session is still the one that was renewed: if the parent signed out, deleted the account or signed in again meanwhile (cloudGen moved), the answer is thrown away.
function cloudRenew(cfg, used, dl) {
  if (cloudRenewing) return cloudRenewing;
  const s = cloudAuthGet();
  if (!s) return Promise.resolve(cloudBad('signedout'));
  if (used && s.access !== used) return Promise.resolve(cloudOk());
  const gen = cloudGen;
  cloudRenewing = (async () => {
    const r = await cloudRaw(cfg, 'POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh }, timeout: Math.min(CLOUD_TIMEOUT_MS, Math.max(1000, cloudLeft(dl))) });
    if (cloudGen !== gen) return cloudBad('signedout');
    if (r.net) return cloudBad('offline');
    if (r.status >= 200 && r.status < 300) {
      if (r.bad) return cloudBad('server', 'unreadable');
      const cur = cloudAuthGet();
      if (!cur) return cloudBad('signedout');
      if (cur.refresh !== s.refresh) return cur.uid === s.uid ? cloudOk() : cloudBad('signedout');      // another tab renewed, or another parent signed in
      const ns = cloudSessionFrom(r.json, s);
      if (!ns) return cloudBad('server', 'unreadable');
      cloudMem = cloudStoreSet('tiko.auth', ns) ? null : ns;                                              // a failed write keeps the rotated session in memory
      return cloudOk();
    }
    if (r.status === 429) return cloudBad('throttled');
    if (r.status >= 500) return cloudBad('server');
    const cur = cloudAuthGet(); if (cur && cur.refresh === s.refresh) cloudAuthClear();
    return cloudBad('signedout');
  })().then(x => { cloudRenewing = null; return x; }, () => { cloudRenewing = null; return cloudBad('server'); });
  return cloudRenewing;
}
// opts: { auth: true (needs a session), body, prefer, timeout, deadline (ms clock; default 30 s from now) }
async function cloudCall(method, path, opts) {
  opts = opts || {};
  const cfg = cloudCfg();
  if (!cfg) return cloudBad('off');
  const dl = opts.deadline || Date.now() + CLOUD_CALL_MS, one = () => Math.min(opts.timeout || CLOUD_TIMEOUT_MS, cloudLeft(dl));
  let token = null, gen = cloudGen;
  if (opts.auth) {
    let s = cloudAuthGet();
    if (!s) return cloudBad('signedout');
    gen = cloudGen;
    if (s.exp <= Date.now() + 10000) {
      const rr = await cloudRenew(cfg, s.access, dl);
      if (!rr.ok) return rr;
      if (cloudGen !== gen) return cloudBad('signedout');
      s = cloudAuthGet();
      if (!s) return cloudBad('signedout');
    }
    token = s.access;
  }
  if (cloudLeft(dl) <= 0) return cloudBad('offline');
  let r = await cloudRaw(cfg, method, path, { body: opts.body, prefer: opts.prefer, timeout: one(), token });
  if (opts.auth && r.status === 401) {
    if (cloudGen !== gen) return cloudBad('signedout');
    const rr = await cloudRenew(cfg, token, dl);
    if (!rr.ok) return rr;
    if (cloudGen !== gen) return cloudBad('signedout');
    const s2 = cloudAuthGet();
    if (!s2) return cloudBad('signedout');
    if (cloudLeft(dl) <= 0) return cloudBad('offline');
    r = await cloudRaw(cfg, method, path, { body: opts.body, prefer: opts.prefer, timeout: one(), token: s2.access });
    if (r.status === 401) { cloudAuthClear(); return cloudBad('signedout'); }
  }
  return cloudFinish(r);
}
const cloudUpsert = 'resolution=merge-duplicates,return=representation';

// ---------------------------------------------------------------- the calls
function cloudState() {
  const off = { on: false, signedIn: false, email: null, uid: null, device: null, daysLeft: 0 };
  try {
    if (!cloudCfg()) return off;
    const s = cloudAuthGet();
    return {
      on: true, signedIn: !!s, email: s ? s.email : null, uid: s ? s.uid : null, device: cloudDeviceId(),
      daysLeft: s ? Math.max(0, Math.ceil((s.since + CLOUD_SESSION_DAYS * 864e5 - Date.now()) / 864e5)) : 0,
    };
  } catch (e) { return off; }
}

function cloudCountries() {
  return cloudGuard(async () => {
    const r = await cloudCall('GET', '/rest/v1/open_countries?select=code&order=code');
    if (!r.ok) return r;
    if (!Array.isArray(r.data)) return cloudBad('server', 'unreadable');
    return cloudOk(r.data.map(x => (cloudIsObj(x) ? x.code : null)).filter(c => typeof c === 'string'));
  });
}

function cloudSendCode(email) {
  return cloudGuard(async () => {
    const e = typeof email === 'string' ? email.trim() : '';
    if (e.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(e)) return cloudBad('refused', 'email');
    return cloudCall('POST', '/auth/v1/otp', { body: { email: e, create_user: true } });
  });
}

// the code must be 6 digits. { ok:false, error:'storage' }: the sign-in could not be written to this tablet (the server session is ended again, best effort).
function cloudVerifyCode(email, code) {
  return cloudGuard(async () => {
    const e = typeof email === 'string' ? email.trim() : '', t = typeof code === 'string' ? code.trim() : '';
    if (e.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(e)) return cloudBad('refused', 'email');
    if (!/^\d{6}$/.test(t)) return cloudBad('code');
    const cfg = cloudCfg();
    if (!cfg) return cloudBad('off');
    const r = await cloudRaw(cfg, 'POST', '/auth/v1/verify', { body: { type: 'email', email: e, token: t } });
    if (r.net) return cloudBad('offline');
    if (r.status >= 200 && r.status < 300) {
      const s = r.bad ? null : cloudSessionFrom(r.json, null, e);
      if (!s) return cloudBad('server', 'unreadable');
      if (!cloudStoreSet('tiko.auth', s)) { await cloudServerLogout(cfg, s); return cloudBad('storage'); }
      cloudMem = null; cloudGen++;
      return cloudOk({ email: s.email, uid: s.uid });
    }
    if (r.status === 429) return cloudBad('throttled');
    if (r.status >= 500) return cloudBad('server');
    return cloudBad('code', String(r.status));          // a wrong, used or expired code
  });
}

// ends this session: the local session is cleared FIRST (and any renewal in flight is voided), then the server is asked, best effort, to end it
function cloudSignOut() {
  return cloudGuard(async () => {
    const s = cloudAuthPeek();
    cloudAuthClear();
    const cfg = cloudCfg();
    if (!cfg) return cloudBad('off');
    if (s) await cloudServerLogout(cfg, s);
    return cloudOk();
  });
}

// ends every OTHER session of this parent on the server (GoTrue logout scope "others"): this tablet stays signed in; the other tablets answer 401 and
// their renewal is refused at their next call, so they ask for a new code. Not yet confirmed against the real service (the fake mimics it).
function cloudSignOutOthers() {
  return cloudGuard(async () => {
    if (!cloudUid()) return cloudNoSession();
    return cloudCall('POST', '/auth/v1/logout?scope=others', { auth: true });
  });
}

// the caller's account id for a request, or null
function cloudUid() { const s = cloudAuthGet(); return s ? s.uid : null; }
const cloudNoSession = () => cloudBad(cloudCfg() ? 'signedout' : 'off');

function cloudAccount() {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    const r = await cloudCall('GET', '/rest/v1/accounts?select=id,country,created_at,last_seen_at&id=eq.' + uid, { auth: true });
    if (!r.ok) return r;
    if (!Array.isArray(r.data)) return cloudBad('server', 'unreadable');
    return cloudOk(r.data.length ? r.data[0] : null);
  });
}

function cloudCreateAccount(country) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return cloudBad('refused', 'country');
    const r = await cloudCall('POST', '/rest/v1/accounts?on_conflict=id', { auth: true, prefer: cloudUpsert, body: { id: uid, country } });
    if (!r.ok) return r;
    return cloudOk(Array.isArray(r.data) && r.data.length ? r.data[0] : null);
  });
}

// records a consent (insert only; the server never edits or deletes one)
function cloudConsent(c) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (!cloudIsObj(c) || typeof c.policy !== 'string' || typeof c.what !== 'string' || c.adult !== true
        || cloudLen(c.policy) < 1 || cloudLen(c.policy) > 64 || cloudLen(c.what) < 1 || cloudLen(c.what) > 200) return cloudBad('refused', 'consent');
    return cloudCall('POST', '/rest/v1/consents', { auth: true, prefer: 'return=minimal', body: { account_id: uid, policy_version: c.policy, what: c.what, adult_confirmed: true } });
  });
}

// the consents recorded for this account: [{ policy_version, what, withdrawn_at }] (read only; lets a screen tell whether a consent of the current wording exists)
function cloudConsents() {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    const r = await cloudCall('GET', '/rest/v1/consents?select=policy_version,what,withdrawn_at&account_id=eq.' + uid + '&order=id.asc', { auth: true });
    if (!r.ok) return r;
    if (!Array.isArray(r.data)) return cloudBad('server', 'unreadable');
    return cloudOk(r.data.filter(cloudIsObj).map(c => ({ policy_version: c.policy_version, what: c.what, withdrawn_at: c.withdrawn_at || null })));
  });
}

// registers or refreshes this tablet. With `backedUp` true it also asks the server to stamp last_backup_at: the database trigger (tg_devices_guard) replaces ANY
// non-null value that differs from the stored one with its own now(), so the value sent is a fixed placeholder (the tablet's clock is never sent).
function cloudDevice(appVersion, backedUp) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (!Number.isInteger(appVersion) || appVersion < 0) return cloudBad('refused', 'version');
    const body = { id: cloudDeviceId(), account_id: uid, app_version: appVersion };
    if (backedUp === true) body.last_backup_at = '2000-01-01T00:00:00Z';
    const r = await cloudCall('POST', '/rest/v1/devices?on_conflict=account_id,id', { auth: true, prefer: cloudUpsert, body });
    if (!r.ok) return r;
    return cloudOk(Array.isArray(r.data) && r.data.length ? r.data[0] : null);
  });
}

// the tablets registered on the account: [{ id, app_version, last_backup_at, current }]; `current` is this tablet
function cloudDevices() {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    const r = await cloudCall('GET', '/rest/v1/devices?select=id,app_version,last_backup_at&account_id=eq.' + uid + '&order=id.asc', { auth: true });
    if (!r.ok) return r;
    if (!Array.isArray(r.data)) return cloudBad('server', 'unreadable');
    const me = cloudDeviceId();
    return cloudOk(r.data.filter(cloudIsObj).map(d => ({ id: d.id, app_version: d.app_version, last_backup_at: d.last_backup_at === null ? null : cloudMs(d.last_backup_at), current: d.id === me })));
  });
}

// forgets one tablet of the account (frees a place of the 10). Removing THIS tablet is allowed (it registers itself again at the next cloudDevice call).
function cloudRemoveDevice(deviceId) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (typeof deviceId !== 'string' || !CLOUD_UUID.test(deviceId.toLowerCase())) return cloudBad('refused', 'device');
    return cloudCall('DELETE', '/rest/v1/devices?account_id=eq.' + uid + '&id=eq.' + deviceId.toLowerCase(), { auth: true, prefer: 'return=minimal' });
  });
}

// the parent's children, with for each child every section's updated_at (ms), device_id and format. No data is fetched.
function cloudChildren() {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    const dl = Date.now() + CLOUD_CALL_MS;                      // one deadline for both requests
    const a = await cloudCall('GET', '/rest/v1/children?select=id,nickname,avatar,lang,created_at&account_id=eq.' + uid + '&order=created_at.asc', { auth: true, deadline: dl });
    if (!a.ok) return a;
    const b = await cloudCall('GET', '/rest/v1/progress?select=child_id,section,updated_at,device_id,format&account_id=eq.' + uid, { auth: true, deadline: dl });
    if (!b.ok) return b;
    if (!Array.isArray(a.data) || !Array.isArray(b.data)) return cloudBad('server', 'unreadable');
    const out = a.data.filter(cloudIsObj).map(c => ({ id: c.id, nickname: c.nickname, avatar: c.avatar, lang: c.lang, created_at: c.created_at, sections: {} }));
    for (const p of b.data) {
      if (!cloudIsObj(p) || !CLOUD_SECTIONS_LIST.includes(p.section)) continue;
      const c = out.find(x => x.id === p.child_id);
      if (c) c.sections[p.section] = { updated_at: cloudMs(p.updated_at), device_id: p.device_id || null, format: p.format };
    }
    return cloudOk(out);
  });
}

// creates or renames a child. { id (uuid made on the tablet), nickname, avatar, lang }
// The nickname is the parent's choice and must never be the child's name: a screen must not prefill it from a profile name (see docs/DEVELOPING.md section 12).
function cloudPutChild(ch) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (!cloudIsObj(ch) || typeof ch.id !== 'string' || !CLOUD_UUID.test(ch.id.toLowerCase()) || typeof ch.nickname !== 'string') return cloudBad('refused', 'child');
    const nickname = cloudChars(ch.nickname.trim(), 20), avatar = ch.avatar === undefined ? '' : ch.avatar;
    if (!nickname) return cloudBad('refused', 'nickname');
    if (typeof avatar !== 'string' || cloudLen(avatar) > 16 || (ch.lang !== 'en' && ch.lang !== 'fr')) return cloudBad('refused', 'child');
    const r = await cloudCall('POST', '/rest/v1/children?on_conflict=account_id,id', { auth: true, prefer: cloudUpsert, body: { id: ch.id.toLowerCase(), account_id: uid, nickname, avatar, lang: ch.lang } });
    if (!r.ok) return r;
    return cloudOk(Array.isArray(r.data) && r.data.length ? r.data[0] : null);
  });
}

// ---- upload
// A number as Postgres prints it in jsonb text: every digit, never an exponent (JS prints 1e+21 and 5e-324).
function cloudNum(n) {
  if (!Number.isFinite(n)) return 'null';
  const s = String(n);
  if (!/e/i.test(s)) return s;
  const parts = s.toLowerCase().split('e'), neg = parts[0][0] === '-', mant = neg ? parts[0].slice(1) : parts[0], ip = mant.split('.')[0], fp = mant.split('.')[1] || '';
  const digits = ip + fp, pt = ip.length + Number(parts[1]);
  const out = pt <= 0 ? '0.' + '0'.repeat(-pt) + digits : pt >= digits.length ? digits + '0'.repeat(pt - digits.length) : digits.slice(0, pt) + '.' + digits.slice(pt);
  return (neg ? '-' : '') + out;
}
// The jsonb text form Postgres prints for data::text (octet_length is the limit): ", " between members, ": " after keys, raw UTF-8, numbers in full.
function cloudJsonbText(v) {
  if (Array.isArray(v)) return '[' + v.map(cloudJsonbText).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).map(k => JSON.stringify(k) + ': ' + cloudJsonbText(v[k])).join(', ') + '}';
  return typeof v === 'number' ? cloudNum(v) : JSON.stringify(v === undefined ? null : v);
}
function cloudBytes(s) { return new TextEncoder().encode(s).length; }
// true when a string or a key anywhere inside v holds \u0000 or a lone surrogate (jsonb refuses both, for ever)
function cloudBadText(v) {
  const bad = s => /\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);
  if (typeof v === 'string') return bad(v);
  if (Array.isArray(v)) return v.some(cloudBadText);
  if (v && typeof v === 'object') return Object.keys(v).some(k => bad(k) || cloudBadText(v[k]));
  return false;
}
// Rule 4, on the COPY: only the eight section names, only each section's own keys, and in `settings` only the allowed settings. -> null, or 'private' / 'refused'.
// The check is shallow by design: values inside an allowed key are trusted to come from cloudSections.
function cloudCheckPayload(sections, names) {
  if (!cloudIsObj(sections) || !Array.isArray(names) || !names.length) return 'refused';
  const synced = typeof SAVE_SYNCED_SETTINGS !== 'undefined' && Array.isArray(SAVE_SYNCED_SETTINGS) ? SAVE_SYNCED_SETTINGS : null;
  for (const k of Object.keys(sections)) {
    if (!CLOUD_SECTIONS_LIST.includes(k)) return 'private';
    if (sections[k] === undefined) continue;
    if (!cloudIsObj(sections[k])) return 'refused';
    for (const kk of Object.keys(sections[k])) if (!CLOUD_SECTION_KEYS[k].includes(kk)) return 'private';
    const st = sections[k].settings;
    if (k === 'settings' && st !== undefined) {
      if (!cloudIsObj(st)) return 'refused';
      for (const s of Object.keys(st)) if (!CLOUD_SETTINGS_ALLOWED.includes(s) || (synced && !synced.includes(s))) return 'private';
    }
  }
  for (const n of names) {
    if (typeof n !== 'string') return 'refused';
    if (!CLOUD_SECTIONS_LIST.includes(n)) return 'private';
    if (!cloudIsObj(sections[n])) return 'refused';
  }
  return null;
}
// uploads the named sections of one child in one request (every row has the same keys). `sections` is the output of cloudSections(S).
// The payload is copied ONCE through JSON (plain objects, own data only; a toJSON or a getter is run exactly once), every guard runs on that copy,
// and the request body is made from that same copy.
function cloudUpload(childId, sections, names) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (typeof childId !== 'string' || !CLOUD_UUID.test(childId.toLowerCase())) return cloudBad('refused', 'child');
    let copy, nm;
    try { copy = JSON.parse(JSON.stringify(sections)); nm = JSON.parse(JSON.stringify(names)); } catch (e) { return cloudBad('refused', 'data'); }
    const bad = cloudCheckPayload(copy, nm);
    if (bad) return cloudBad(bad);
    const list = [...new Set(nm)], rows = [], device = cloudDeviceId(), format = typeof CLOUD_FORMAT === 'number' ? CLOUD_FORMAT : 2;
    for (const n of list) {
      if (cloudBadText(copy[n])) return cloudBad('refused', n);
      if (cloudBytes(cloudJsonbText(copy[n])) > CLOUD_MAX_SECTION_BYTES) return cloudBad('toobig', n);
      rows.push({ account_id: uid, child_id: childId.toLowerCase(), section: n, data: copy[n], format, device_id: device });
    }
    const r = await cloudCall('POST', '/rest/v1/progress?on_conflict=account_id,child_id,section&select=section,updated_at', { auth: true, prefer: cloudUpsert, body: rows });
    if (!r.ok) return r;
    const stamps = {};
    if (Array.isArray(r.data)) for (const x of r.data) if (cloudIsObj(x) && typeof x.section === 'string') stamps[x.section] = cloudMs(x.updated_at);
    return cloudOk({ stamps });
  });
}

// one child's backup: { sections, stamps (ms, from the server's updated_at), formats, devices } -> pass to fromCloudSections(sections, stamps, format) per format
function cloudDownload(childId) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (typeof childId !== 'string' || !CLOUD_UUID.test(childId.toLowerCase())) return cloudBad('refused', 'child');
    const r = await cloudCall('GET', '/rest/v1/progress?select=section,data,format,device_id,updated_at&account_id=eq.' + uid + '&child_id=eq.' + childId.toLowerCase(), { auth: true });
    if (!r.ok) return r;
    if (!Array.isArray(r.data)) return cloudBad('server', 'unreadable');
    const out = { sections: {}, stamps: {}, formats: {}, devices: {} };
    for (const p of r.data) {
      if (!cloudIsObj(p) || !CLOUD_SECTIONS_LIST.includes(p.section) || !cloudIsObj(p.data)) continue;
      out.sections[p.section] = p.data; out.formats[p.section] = p.format; out.devices[p.section] = p.device_id || null;
      const ms = cloudMs(p.updated_at); if (ms !== null) out.stamps[p.section] = ms;
    }
    return cloudOk(out);
  });
}

// deletes one child's backup (the progress rows go with it)
function cloudDeleteChild(childId) {
  return cloudGuard(async () => {
    const uid = cloudUid(); if (!uid) return cloudNoSession();
    if (typeof childId !== 'string' || !CLOUD_UUID.test(childId.toLowerCase())) return cloudBad('refused', 'child');
    return cloudCall('DELETE', '/rest/v1/children?account_id=eq.' + uid + '&id=eq.' + childId.toLowerCase(), { auth: true, prefer: 'return=minimal' });
  });
}

// "download my data": everything the server holds for this parent, as one document
function cloudExport() {
  return cloudGuard(async () => {
    if (!cloudUid()) return cloudNoSession();
    return cloudCall('POST', '/rest/v1/rpc/export_my_data', { auth: true, body: {} });
  });
}

// deletes the account and everything under it, then clears the session (which also voids any renewal in flight).
// An account that is already gone counts as deleted.
function cloudDeleteAccount() {
  return cloudGuard(async () => {
    if (!cloudUid()) return cloudNoSession();
    const r = await cloudCall('POST', '/rest/v1/rpc/delete_my_account', { auth: true, body: {} });
    if (r.ok) { cloudAuthClear(); return cloudOk(); }
    if (r.error === 'refused' && /P0002/.test(r.detail || '')) { cloudAuthClear(); return cloudOk({ already: true }); }
    return r;
  });
}
