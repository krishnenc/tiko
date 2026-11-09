'use strict';
/* Tiko – a calm, fun, bilingual reading & maths app. */

// ================= helpers =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const unitText = u => u.replace(/^_/, '');
const L = () => T[S.lang];
const app = $('#app');

// ================= state =================
const STORE_KEY = 'tiko.v1';
const DEFAULTS = {
  lang: 'en', stars: 0, stickers: [], boxes: {}, levels: {}, streak: {}, days: {}, counts: {}, seenStage: {},
  totals: {}, badges: {}, goals: [],
  settings: { stops: 5, perStop: 5, rate: 0.9, pitch: 1.35, sfx: true, music: true, calm: false, breaks: true, nudge: true,
    voice_en: '', voice_fr: '', name: '', nameSay: '' },
};
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    if (d) return { ...structuredClone(DEFAULTS), ...d, settings: { ...DEFAULTS.settings, ...d.settings } };
  } catch (e) { /* fall through */ }
  return structuredClone(DEFAULTS);
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
function applySettings() { document.body.classList.toggle('calm', !!S.settings.calm); document.documentElement.lang = S.lang; }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignore */ }

// ================= IndexedDB (recordings + photos) =================
const idb = {
  _db: null,
  open() {
    return this._db || (this._db = new Promise((res, rej) => {
      const r = indexedDB.open('tiko', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('rec'); r.result.createObjectStore('photos'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  },
  async req(store, mode, fn) {
    const db = await this.open();
    return new Promise(res => { const q = fn(db.transaction(store, mode).objectStore(store)); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
  },
  get(st, k) { return this.req(st, 'readonly', s => s.get(k)); },
  set(st, k, v) { return this.req(st, 'readwrite', s => s.put(v, k)); },
  del(st, k) { return this.req(st, 'readwrite', s => s.delete(k)); },
  keys(st) { return this.req(st, 'readonly', s => s.getAllKeys()); },
};
let recKeys = new Set();
idb.keys('rec').then(k => { recKeys = new Set(k || []); }).catch(() => {});

// ================= sound effects =================
let actx = null;
function tone(f, t0, dur, type = 'sine', vol = 0.15) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function sfx(kind) {
  if (!S.settings.sfx) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    if (kind === 'good') { tone(660, t, .15, 'triangle'); tone(880, t + .1, .3, 'triangle'); }
    else if (kind === 'oops') { tone(320, t, .18, 'sine', .08); tone(250, t + .13, .25, 'sine', .07); }
    else if (kind === 'tap') tone(560, t, .07, 'sine', .07);
    else if (kind === 'pop') tone(940, t, .09, 'triangle', .08);
    else if (kind === 'win') [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * .11, .35, 'triangle', .13));
  } catch (e) { /* ignore */ }
}

// ================= speech =================
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function voicesFor(lang) { return voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang)); }
function voiceFor(lang) {
  const list = voicesFor(lang), want = S.settings['voice_' + lang];
  // prefer brighter, friendlier voices when the device names them
  const bright = /female|libby|sonia|maisie|hollie|denise|eloise|amelie|amélie|audrey|julie|aria|jenny|zira|hortense|samantha|karen/i;
  return list.find(v => v.name === want) || list.find(v => bright.test(v.name) && v.lang.replace('_', '-') === DATA[lang].voiceLang) ||
    list.find(v => bright.test(v.name)) || list.find(v => v.localService && /google/i.test(v.name)) ||
    list.find(v => v.lang.replace('_', '-') === DATA[lang].voiceLang) || list[0] || null;
}
let speakToken = 0, curAudio = null;
function stopSpeech() {
  speakToken++;
  try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  if (curAudio) { curAudio.pause(); curAudio = null; }
}
// Bubbly voice: raised pitch overall, and an extra lift for anything exclaimed ("Bravo !", "Great job!")
function say(text, lang = S.lang, rate = S.settings.rate, pitch = S.settings.pitch) {
  return new Promise(res => {
    // never read punctuation aloud: "Combien ?" / "…?" would otherwise be spoken as "question mark"
    text = String(text || '').replace(/…\s*\?/g, '?').replace(/…/g, ', ').replace(/\s+([?!.,;:])/g, '$1').replace(/^[\s?!.,;:]+/, '').trim();
    if (!('speechSynthesis' in window) || !text || /^[?!.,;:\s]*$/.test(text)) return res();
    const u = new SpeechSynthesisUtterance(text), v = voiceFor(lang);
    if (v) u.voice = v;
    const excited = /!\s*$/.test(text);
    u.lang = v ? v.lang : DATA[lang].voiceLang;
    u.rate = Math.min(1.5, excited ? rate * 1.06 : rate);
    u.pitch = Math.min(2, excited ? pitch + 0.15 : pitch);
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    u.onend = fin; u.onerror = fin;
    setTimeout(fin, 1500 + text.length * 110 / rate); // Android sometimes never fires onend
    speechSynthesis.speak(u);
  });
}
async function playUnit(unit, lang = S.lang, rate) {
  if (unit.startsWith('_')) return;
  const key = `${lang}:${unit}`;
  if (recKeys.has(key)) {
    const blob = await idb.get('rec', key);
    if (blob) return playBlob(blob);
  }
  // letter sounds stay close to natural pitch so they remain clear
  return say(DATA[lang].sounds[unit] || unit, lang, (rate || S.settings.rate) * 0.9, Math.min(S.settings.pitch, 1.15));
}
function playBlob(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob), a = new Audio(url); curAudio = a;
    const fin = () => { URL.revokeObjectURL(url); res(); };
    a.onended = fin; a.onerror = fin; a.play().catch(fin);
  });
}
// speak(...parts): string | {unit} | {pause} | {text, lang}
async function speak(...parts) {
  stopSpeech(); const t = speakToken;
  await sleep(80);
  for (const p of parts.flat()) {
    if (t !== speakToken) return;
    if (!p) continue;
    if (typeof p === 'string') await say(p);
    else if (p.pause) await sleep(p.pause);
    else if (p.unit !== undefined) await playUnit(p.unit, p.lang || S.lang, p.rate);
    else if (p.name) await sayName(p.bang);
    else if (p.text) await say(p.text, p.lang || S.lang, p.rate || S.settings.rate);
  }
}

// ================= her name (kept only on this device, never in the code) =================
const childName = () => (S.settings.name || '').trim();
async function sayName(bang) {
  if (recKeys.has('name')) { const b = await idb.get('rec', 'name'); if (b) return playBlob(b); }
  const n = (S.settings.nameSay || '').trim() || childName();
  if (n) return say(n + (bang ? '!' : ''));
}
// praise, sometimes with her name: "Great job, <name>!"
function praiseParts() {
  const p = pick(L().praise);
  if (childName() && Math.random() < 0.35) return [p.replace(/\s*!\s*$/, ''), { name: true, bang: true }];
  return [p];
}

// ================= intro jingle (synthesised, no files needed) =================
function jingle() {
  if (!S.settings.music) return 0;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + 0.05, b = 0.19; // one beat
    // bouncy melody (C major) – [note, beats]
    const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784, C6: 1047 };
    const mel = [['G4', 1], ['C5', 1], ['E5', 1], ['G5', 1], ['E5', 1], ['C5', 1], ['D5', 2],
      ['A4', 1], ['D5', 1], ['F4', 1], ['A4', 1], ['G4', 1], ['B4', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['C6', 4]];
    let t = t0;
    for (const [n, d] of mel) { tone(N[n], t, d * b * 0.95, 'triangle', 0.11); t += d * b; }
    // soft bass + chord pad
    [['C4', 0, 8], ['F4', 8, 4], ['G4', 12, 6], ['C4', 18, 6]].forEach(([n, s, d]) => {
      tone(N[n] / 2, t0 + s * b, d * b, 'sine', 0.09); tone(N[n], t0 + s * b, d * b, 'sine', 0.035);
    });
    // sparkle at the end
    [1568, 2093, 2637].forEach((f, i) => tone(f, t - 4 * b + i * 0.07, 0.5, 'sine', 0.04));
    return (t - t0) * 1000;
  } catch (e) { return 0; }
}

// ================= combos: Tiko dances on a run of first-try answers =================
let combo = 0;
function comboHit(first) {
  if (!first) { combo = 0; return; }
  combo++;
  if (combo === 3 || combo === 6 || combo === 10 || (combo > 10 && combo % 5 === 0)) {
    const el = document.createElement('div'); el.className = 'combo';
    el.innerHTML = `<span>🔥</span> ${esc(L().hi.combo(combo))}`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2000);
    const o = $('.owl'); if (o) { o.classList.remove('dance'); void o.offsetWidth; o.classList.add('dance'); setTimeout(() => o.classList.remove('dance'), 1800); }
    sfx('win'); rain();
    return L().hi.combo(combo);
  }
}

// ================= fx: confetti + flying stars =================
const fx = $('#fx'), fctx = fx.getContext('2d');
let parts = [], fxRunning = false;
function sizeFx() { const d = devicePixelRatio || 1; fx.width = innerWidth * d; fx.height = innerHeight * d; fctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', sizeFx); sizeFx();
const FX_COLORS = ['#ff7a6b', '#ffc94a', '#20b2a0', '#9b7fd1', '#5bb8f5', '#4cc47c', '#ff9ed2'];
function burst(x, y, n = 40, spread = 1) {
  if (S.settings.calm) n = Math.min(n, 10);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (3 + Math.random() * 7) * spread;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: .25, r: 5 + Math.random() * 7, rot: Math.random() * 6,
      vr: (Math.random() - .5) * .4, c: pick(FX_COLORS), life: 70 + rand(50), star: Math.random() < .35 });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxTick); }
}
function rain() { for (let i = 0; i < 6; i++) setTimeout(() => burst(Math.random() * innerWidth, -20, 30, .8), i * 220); }
function burstAt(el, n) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n); }
function drawStar(c, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .45 : r, a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
function fxTick() {
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.globalAlpha = Math.min(1, p.life / 30); fctx.fillStyle = p.c;
    if (p.star) drawStar(fctx, p.r); else fctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    fctx.restore();
  }
  if (parts.length) requestAnimationFrame(fxTick); else { fxRunning = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function flyStar(fromEl) {
  const target = $('.stars'); if (!fromEl || !target) return addStar();
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const s = document.createElement('div'); s.className = 'flystar'; s.textContent = '⭐';
  s.style.left = (a.left + a.width / 2 - 22) + 'px'; s.style.top = (a.top + a.height / 2 - 22) + 'px';
  document.body.appendChild(s);
  const dx = b.left + 10 - a.left - a.width / 2 + 22, dy = b.top - a.top - a.height / 2 + 22;
  const anim = s.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx * .4}px, ${dy * .4 - 80}px) scale(1.6) rotate(180deg)`, offset: .45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.6) rotate(360deg)` },
  ], { duration: 900, easing: 'cubic-bezier(.5,0,.5,1)' });
  anim.onfinish = () => { s.remove(); addStar(); };
}
function addStar() {
  S.stars++; save();
  const el = $('.stars'); if (!el) return;
  el.querySelector('b').textContent = S.stars; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); sfx('pop');
}

// ================= mascot =================
function owl(cls = '') {
  return `<div class="owl ${cls}"><svg viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="114" rx="32" ry="5" fill="#0000001a"/>
  <g class="owl-body">
    <path class="wing l" d="M24 58 q-16 20 2 40 q8-16 6-40z" fill="#7d5ba6"/>
    <path class="wing r" d="M96 58 q16 20 -2 40 q-8-16 -6-40z" fill="#7d5ba6"/>
    <path d="M28 36 l4 -20 l16 14z M92 36 l-4 -20 l-16 14z" fill="#8a6cc4"/>
    <ellipse cx="60" cy="66" rx="38" ry="42" fill="#9b7fd1"/>
    <ellipse cx="60" cy="82" rx="24" ry="24" fill="#efe6ff"/>
    <path d="M48 76 q4 4 8 0 M56 86 q4 4 8 0 M64 76 q4 4 8 0" stroke="#d6c6f5" stroke-width="2" fill="none"/>
    <g class="eyes">
      <circle cx="44" cy="50" r="15" fill="#fff"/><circle cx="76" cy="50" r="15" fill="#fff"/>
      <circle cx="46" cy="52" r="8" fill="#2d3142"/><circle cx="74" cy="52" r="8" fill="#2d3142"/>
      <circle cx="49" cy="48" r="3" fill="#fff"/><circle cx="77" cy="48" r="3" fill="#fff"/>
    </g>
    <circle cx="30" cy="66" r="5" fill="#ff9ed2" opacity=".6"/><circle cx="90" cy="66" r="5" fill="#ff9ed2" opacity=".6"/>
    <path d="M54 62 l6 9 l6 -9z" fill="#ffb347"/>
    <path d="M48 106 l-4 6 M53 107 l0 6 M67 107 l0 6 M72 106 l4 6" stroke="#ffb347" stroke-width="3.5" stroke-linecap="round"/>
  </g></svg></div>`;
}
function owlReact(kind) {
  const o = $('.owl'); if (!o) return;
  o.classList.remove('happy', 'think'); void o.offsetWidth; o.classList.add(kind);
  setTimeout(() => o.classList.remove(kind), 1100);
}

// ================= spaced repetition (Leitner boxes) =================
// box 0 = not yet introduced, 1..5 = learning → mastered. Few new items at a time (poor memory friendly).
const recent = {};
const bkey = (set, id) => `${S.lang}:${set}:${id}`;
const boxOf = (set, id) => S.boxes[bkey(set, id)] || 0;
function weighted(list, w) { const tot = list.reduce((s, x) => s + w(x), 0); let r = Math.random() * tot; for (const x of list) { r -= w(x); if (r <= 0) return x; } return list[list.length - 1]; }
function chooseItem(set, items) {
  const intro = items.filter(i => boxOf(set, i.id) > 0);
  const learning = intro.filter(i => boxOf(set, i.id) <= 2).length;
  const fresh = items.find(i => boxOf(set, i.id) === 0);
  let item, isNew = false;
  if (fresh && (intro.length < 2 || (learning < 3 && Math.random() < 0.4))) {
    item = fresh; isNew = true; S.boxes[bkey(set, item.id)] = 1;
  } else {
    const rec = recent[set] || [];
    let pool = intro.filter(i => !rec.includes(i.id)); if (!pool.length) pool = intro;
    const W = [0, 10, 6, 3, 2, 1];
    item = weighted(pool, i => W[boxOf(set, i.id)]);
  }
  recent[set] = [item.id, ...(recent[set] || [])].slice(0, Math.max(1, Math.min(3, Math.floor(intro.length / 2))));
  return { item, isNew };
}
function gradeItem(set, id, first) { const k = bkey(set, id); S.boxes[k] = first ? Math.min(5, (S.boxes[k] || 1) + 1) : 1; }
function introduced(set, items) { const l = items.filter(i => boxOf(set, i.id) > 0); return l.length ? l : items.slice(0, 3); }

// ================= the literacy journey =================
// Six places. Each unlocks when the skill before it is genuinely remembered (spaced-repetition box >= 3).
const frac = (lg, set, items) => items.length ? items.filter(i => (S.boxes[`${lg}:${set}:${i.id}`] || 0) >= 3).length / items.length : 1;
const cnt = (lg, k) => ((S.counts[lg] || {})[k]) || 0;
function bumpCount(k) { const c = S.counts[S.lang] = S.counts[S.lang] || {}; c[k] = (c[k] || 0) + 1; }
const STAGES = [
  { icon: '🏝️', goal: .8, prog: lg => frac(lg, 'letter', DATA[lg].letters) },
  { icon: '🌉', goal: .8, prog: lg => frac(lg, 'blend', DATA[lg].words.slice(0, DATA[lg].simpleWords)) },
  { icon: '🌲', goal: .8, prog: lg => frac(lg, 'sight', DATA[lg].sight.slice(0, 20)) },
  { icon: '⛰️', goal: .7, prog: lg => frac(lg, 'blend', DATA[lg].words.slice(DATA[lg].simpleWords)) },
  { icon: '🛶', goal: 1, prog: lg => Math.min(1, cnt(lg, 'sentence') / 15) },
  { icon: '🏰', goal: 1, prog: lg => Math.min(1, cnt(lg, 'story') / 10) },
];
const stagePct = (i, lg = S.lang) => Math.min(1, STAGES[i].prog(lg) / STAGES[i].goal);
function stageOf(lg = S.lang) { for (let i = 0; i < STAGES.length; i++) if (stagePct(i, lg) < 1) return i; return STAGES.length; }
// words available right now: simple words until Tricky Sound Mountain
function wordsNow() { const d = DATA[S.lang]; return stageOf() >= 3 ? d.words : d.words.slice(0, d.simpleWords); }
function knownWords() {
  const k = DATA[S.lang].words.filter(w => boxOf('blend', w.id) > 0);
  return new Set(k.map(w => w.e)).size >= 3 ? k : DATA[S.lang].words.slice(0, 8);
}

// ================= achievements: badges + parent-set goals =================
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function tally(k, n = 1) { S.totals[k] = (S.totals[k] || 0) + n; }
const tot = k => S.totals[k] || 0;
function streakDays() {
  let n = 0; const d = new Date();
  while ((S.days[ymd(d)] || {}).q > 0) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const playedDays = () => Object.values(S.days).filter(v => v.q > 0).length;
const knownMax = (set, items) => Math.max(...['en', 'fr'].map(lg => items(lg).filter(i => (S.boxes[`${lg}:${set}:${i.id}`] || 0) >= 3).length));
const bothCnt = k => cnt('en', k) + cnt('fr', k);
// effort badges come first on purpose: showing up and trying again count as much as getting things right
const BADGES = [
  { id: 'firstStar', icon: '⭐', en: 'First star', fr: 'Première étoile', ok: () => S.stars >= 1 },
  { id: 'path1', icon: '🗺️', en: 'Finished a whole path', fr: 'Un chemin entier', ok: () => tot('paths') >= 1 },
  { id: 'brave5', icon: '💪', en: 'Kept trying (5 times)', fr: "N'abandonne jamais (5 fois)", ok: () => tot('retryOk') >= 5 },
  { id: 'streak3', icon: '🔥', en: '3 days in a row', fr: '3 jours de suite', ok: () => streakDays() >= 3 },
  { id: 'paper5', icon: '✏️', en: '5 paper missions', fr: '5 missions papier', ok: () => tot('papers') >= 5 },
  { id: 'photo1', icon: '📷', en: 'Showed Tiko my work', fr: 'Montré mon travail', ok: () => tot('photos') >= 1 },
  { id: 'trace10', icon: '🌈', en: 'Traced 10 times', fr: 'Tracé 10 fois', ok: () => tot('traces') >= 10 },
  { id: 'letters10', icon: '🔤', en: 'Knows 10 letter sounds', fr: 'Connaît 10 sons', ok: () => knownMax('letter', lg => DATA[lg].letters) >= 10 },
  { id: 'words10', icon: '🧩', en: 'Can blend 10 words', fr: 'Sait lire 10 mots', ok: () => knownMax('blend', lg => DATA[lg].words) >= 10 },
  { id: 'magic10', icon: '✨', en: '10 magic words', fr: '10 mots magiques', ok: () => knownMax('sight', lg => DATA[lg].sight) >= 10 },
  { id: 'build20', icon: '🧱', en: 'Built 20 words', fr: 'Construit 20 mots', ok: () => tot('built') >= 20 },
  { id: 'math50', icon: '🔢', en: '50 maths answers', fr: '50 réponses en maths', ok: () => tot('mathOk') >= 50 },
  { id: 'stars50', icon: '🌟', en: '50 stars', fr: '50 étoiles', ok: () => S.stars >= 50 },
  { id: 'bilingual', icon: '🌍', en: 'English and French!', fr: 'Anglais et français !', ok: () => tot('q_en') > 0 && tot('q_fr') > 0 },
  { id: 'brave25', icon: '🦁', en: 'Super brave (25 retries)', fr: 'Super courageuse (25 essais)', ok: () => tot('retryOk') >= 25 },
  { id: 'streak7', icon: '🏅', en: '7 days in a row', fr: '7 jours de suite', ok: () => streakDays() >= 7 },
  { id: 'days10', icon: '📅', en: 'Played on 10 days', fr: 'Joué 10 jours', ok: () => playedDays() >= 10 },
  { id: 'path10', icon: '🧭', en: '10 paths finished', fr: '10 chemins finis', ok: () => tot('paths') >= 10 },
  { id: 'sentence1', icon: '🛶', en: 'Read my first sentence', fr: 'Ma première phrase', ok: () => bothCnt('sentence') >= 1 },
  { id: 'story1', icon: '📖', en: 'Read my first story', fr: 'Ma première histoire', ok: () => bothCnt('story') >= 1 },
  { id: 'lettersAll', icon: '🅰️', en: 'Knows all letter sounds', fr: 'Connaît tous les sons', ok: () => ['en', 'fr'].some(lg => frac(lg, 'letter', DATA[lg].letters) >= .9) },
  { id: 'stars200', icon: '💫', en: '200 stars', fr: '200 étoiles', ok: () => S.stars >= 200 },
  { id: 'story10', icon: '🏰', en: 'Read 10 stories', fr: 'Lu 10 histoires', ok: () => bothCnt('story') >= 10 },
  { id: 'castle', icon: '👑', en: 'Reached Story Castle', fr: 'Arrivée au château', ok: () => ['en', 'fr'].some(lg => stageOf(lg) >= 5) },
  { id: 'stickersAll', icon: '🦄', en: 'Every sticker!', fr: 'Tous les autocollants !', ok: () => STICKERS.every(s => S.stickers.includes(s)) },
];
const badgeName = b => b[S.lang] || b.en;
function newBadges() {
  const got = [];
  for (const b of BADGES) if (!S.badges[b.id] && b.ok()) { S.badges[b.id] = today(); got.push(b); }
  return got;
}
const goalProgress = g => Math.max(0, Math.min(g.cost, S.stars - g.base));
function newGoals() {
  const got = [];
  for (const g of S.goals) if (!g.done && goalProgress(g) >= g.cost) { g.done = today(); got.push(g); }
  return got;
}
// show any newly earned badges / goals, one celebration each
async function celebrateAwards() {
  const badges = newBadges(), goals = newGoals(); save();
  for (const b of badges) await celebrate(`<div class="medal">${b.icon}</div>`, L().aw.newBadge, badgeName(b));
  for (const g of goals) await celebrate(`<div class="prize">${g.emoji}</div>`, L().aw.goalReached, g.text, L().aw.tellGrownUp);
}
function celebrate(art, title, name, extra = '') {
  return new Promise(res => {
    clearIdle();
    app.innerHTML = `<div class="screen center"><div class="rays"></div><h1>${esc(title)}</h1>${art}
      <div class="bubble" style="font-size:36px">${esc(name)}</div>${extra ? `<div class="bubble" style="font-size:26px">${esc(extra)}</div>` : ''}
      <button class="btn primary huge okb">${L().next} ➜</button></div>`;
    sfx('win'); rain(); setTimeout(rain, 900);
    speak(title, name, extra);
    const art1 = $('.medal, .prize'); art1.onclick = () => { burstAt(art1, 40); sfx('pop'); };
    $('.okb').onclick = () => { sfx('tap'); res(); };
  });
}
function goalBarHTML() {
  const earned = S.goals.find(g => g.done && !g.given), g = S.goals.find(x => !x.done);
  if (earned) return `<div class="goalbar earned">${earned.emoji} ${esc(earned.text)}: ${esc(L().aw.tellGrownUp)}</div>`;
  if (!g) return '';
  const p = goalProgress(g);
  return `<div class="goalbar"><span>${g.emoji}</span><span class="gt">${esc(g.text)}</span>
    <span class="gb"><i style="width:${p / g.cost * 100}%"></i></span><span>⭐ ${p}/${g.cost}</span></div>`;
}

// ================= attention support: gentle nudges when she drifts =================
let idleFn = null, idleT = null, nudges = 0;
function setIdle(fn) { idleFn = fn; nudges = 0; resetIdle(); }
function clearIdle() { idleFn = null; clearTimeout(idleT); }
function resetIdle() {
  clearTimeout(idleT);
  if (idleFn && S.settings.nudge) idleT = setTimeout(() => { if (idleFn && nudges < 4) { nudges++; idleFn(); resetIdle(); } }, 15000);
}
document.addEventListener('pointerdown', resetIdle, true);
function nudge(replayParts) {
  owlReact('happy'); sfx('pop');
  const st = $('.stage'); if (st) { st.classList.remove('nudge'); void st.offsetWidth; st.classList.add('nudge'); }
  speak(L().read.yourTurn, { pause: 150 }, ...replayParts);
}

// ================= maths levels =================
const lvl = a => S.levels[a] || 1;
function gradeMath(a, first, max = 3) {
  const st = S.streak[a] = S.streak[a] || { ok: 0, bad: 0 };
  if (first) { st.ok++; st.bad = Math.max(0, st.bad - 1); tally('mathOk'); } else { st.bad++; st.ok = 0; }
  if (st.ok >= 5 && lvl(a) < max) { S.levels[a] = lvl(a) + 1; st.ok = 0; st.bad = 0; }
  if (st.bad >= 3 && lvl(a) > 1) { S.levels[a] = lvl(a) - 1; st.ok = 0; st.bad = 0; }
}
function numOpts(ans, min, max, n = 3) {
  const set = new Set([ans]); const c = shuffle([ans - 1, ans + 1, ans - 2, ans + 2, ans + 3, ans - 3]);
  for (const x of c) { if (set.size >= n) break; if (x >= min && x <= max) set.add(x); }
  return shuffle([...set]).map(v => ({ html: v, val: v }));
}
function objsHTML(n, e, { crossed = 0, offset = 0 } = {}) {
  let h = '<div class="objs">';
  for (let g = 0; g < n; g += 5) {
    h += '<div class="five">';
    for (let i = g; i < Math.min(n, g + 5); i++) h += `<span class="obj ${i >= n - crossed ? 'x' : ''}" style="--i:${i + offset}">${e}</span>`;
    h += '</div>';
  }
  return h + '</div>';
}
function tapToCount(root) {
  let c = 0;
  $$('.obj', root).forEach(o => o.addEventListener('pointerdown', () => {
    if (o.classList.contains('counted')) return;
    c++; o.dataset.n = c; o.classList.add('counted'); sfx('tap'); say(String(c), S.lang, 1);
  }));
}

// ================= activities =================
const ACTS = {
  letters: { icon: '🔤', area: 'read', make: mkLetters },
  sight: { icon: '✨', area: 'read', make: mkSight },
  blend: { icon: '🧩', area: 'read', make: mkBlend },
  spell: { icon: '🧱', area: 'read', make: mkSpell },
  trace: { icon: '✍️', area: 'read', make: mkTrace, per: 2 },
  paper: { icon: '📝', area: 'read', make: mkPaperRead, per: 2 },
  sentence: { icon: '🛶', area: 'read', make: mkSentence, per: 4 },
  story: { icon: '🏰', area: 'read', make: mkStory, per: 2 },
  count: { icon: '🔢', area: 'math', make: mkCount },
  add: { icon: '➕', area: 'math', make: mkAdd },
  sub: { icon: '➖', area: 'math', make: mkSub },
  bonds: { icon: '🔟', area: 'math', make: mkBonds },
  next: { icon: '➡️', area: 'math', make: mkNext },
  compare: { icon: '⚖️', area: 'math', make: mkCompare },
  traceNum: { icon: '✏️', area: 'math', make: mkTraceNum, per: 2 },
  paperMath: { icon: '📒', area: 'math', make: mkPaperMath, per: 2 },
};
const actName = id => L().acts[id] || (id === 'traceNum' ? L().paper.trace.replace(/!.*/, '') + ' 123' : id === 'paperMath' ? '📝 ' + L().maths : '');
// fill names that are not in T
T.en.acts.trace = 'Trace letters'; T.fr.acts.trace = 'Tracer les lettres';
T.en.acts.paper = 'Paper mission'; T.fr.acts.paper = 'Mission papier';
T.en.acts.traceNum = 'Trace numbers'; T.fr.acts.traceNum = 'Tracer les chiffres';
T.en.acts.paperMath = 'Paper maths'; T.fr.acts.paperMath = 'Maths sur papier';
T.en.acts.sentence = 'Read a sentence'; T.fr.acts.sentence = 'Lire une phrase';
T.en.acts.story = 'Little stories'; T.fr.acts.story = 'Petites histoires';

function mkSentence() {
  const R = L().read, w = pick(knownWords()), s = pick(SENTENCES[S.lang])(w.w);
  const others = shuffle(DATA[S.lang].words.filter(x => x.e !== w.e)).slice(0, 2);
  return { kind: 'sentence', title: R.find, speak: [R.find], lines: [s], optClass: '',
    options: shuffle([w, ...others]).map(x => ({ html: x.e, val: x.w })), answer: w.w, correctSpeak: [s],
    grade: f => { if (f) bumpCount('sentence'); } };
}
function mkStory() {
  const R = L().read, ws = shuffle(knownWords()), A = ws[0], B = ws.find(x => x.e !== A.e);
  const st = pick(STORIES[S.lang])(A.w, B.w), ans = st.answer === 'A' ? A : B;
  const C = shuffle(DATA[S.lang].words.filter(x => x.e !== A.e && x.e !== B.e))[0];
  return { kind: 'story', title: R.story, speak: [R.story], lines: st.lines, q: st.q, optClass: '',
    options: shuffle([A, B, C]).map(x => ({ html: x.e, val: x.w })), answer: ans.w, correctSpeak: [ans.w],
    grade: f => { if (f) bumpCount('story'); } };
}

function mkLetters() {
  const d = DATA[S.lang], q = L().q;
  const { item, isNew } = chooseItem('letter', d.letters);
  const opts = isNew ? [item] : shuffle([item, ...shuffle(d.letters.filter(x => x.l !== item.l)).slice(0, 2)]);
  return {
    title: isNew ? `${L().newLetter}…` : `${q.letter}…?`,
    speak: isNew ? [L().newLetter, { unit: item.l }, q.like, item.k, { pause: 200 }, q.tapIt] : [q.letter, { unit: item.l }, q.like, item.k],
    visual: `<div class="pic bob">${item.e}</div>`,
    options: opts.map(x => ({ html: `<span class="glyph">${esc(x.l)}</span>`, val: x.l })), answer: item.l,
    correctSpeak: [{ unit: item.l }, item.k],
    grade: f => gradeItem('letter', item.id, f),
  };
}
function mkSight() {
  const d = DATA[S.lang], q = L().q;
  const { item, isNew } = chooseItem('sight', d.sight);
  const opts = isNew ? [item] : shuffle([item, ...shuffle(d.sight.filter(x => x.w !== item.w)).slice(0, 2)]);
  return {
    title: isNew ? `${q.newWord}…` : `${q.findWord} 👂`,
    speak: isNew ? [q.newWord, item.w, { pause: 200 }, q.tapIt] : [q.findWord, { pause: 150 }, item.w],
    visual: '', optClass: 'word',
    options: opts.map(x => ({ html: esc(x.w), val: x.w })), answer: item.w,
    correctSpeak: [item.w], grade: f => gradeItem('sight', item.id, f),
  };
}
function unitsHTML(units, cls = '') {
  return `<div class="units">${units.map((u, i) => `<button class="unit ${cls} ${u.startsWith('_') ? 'silent' : ''}" data-i="${i}" style="--i:${i}">${esc(unitText(u))}</button>`).join('')}</div>`;
}
function mkBlend() {
  const d = DATA[S.lang], q = L().q;
  const { item, isNew } = chooseItem('blend', wordsNow());
  const others = shuffle(wordsNow().filter(x => x.e !== item.e)).slice(0, 2);
  const opts = isNew ? [item] : shuffle([item, ...others]);
  return {
    title: q.blend, speak: [q.blend], gate: true,
    visual: `<div style="display:flex;flex-direction:column;align-items:center;gap:18px">${unitsHTML(item.units)}
      <button class="btn sun blendbtn" disabled style="opacity:.4">🔗 ${q.blendBtn}</button></div>`,
    options: opts.map(x => ({ html: x.e, val: x.w })), answer: item.w,
    correctSpeak: [item.w], grade: f => gradeItem('blend', item.id, f),
    setup(root, unlock) {
      const tiles = $$('.unit', root), btn = $('.blendbtn', root), need = new Set();
      tiles.forEach((t, i) => { if (!item.units[i].startsWith('_')) need.add(i); });
      tiles.forEach((t, i) => t.addEventListener('click', () => {
        t.classList.add('lit'); sfx('tap'); speak({ unit: item.units[i] }); need.delete(i);
        if (!need.size) { btn.disabled = false; btn.style.opacity = 1; btn.classList.add('pulse'); }
      }));
      btn.addEventListener('click', async () => {
        btn.classList.remove('pulse');
        for (const [i, t] of tiles.entries()) { t.classList.remove('lit'); void t.offsetWidth; t.classList.add('lit'); await speakQuick(item.units[i]); }
        unlock(); speak(q.whichPic);
      });
    },
  };
}
async function speakQuick(u) { if (u.startsWith('_')) return sleep(150); await playUnit(u, S.lang, 1.15); }
function mkSpell() {
  const d = DATA[S.lang], q = L().q;
  const { item } = chooseItem('spell', wordsNow());
  const known = new Set(item.units.map(unitText));
  const pool = shuffle(d.words.flatMap(w => w.units.map(unitText))).filter(u => !known.has(u));
  const extra = [...new Set(pool)].slice(0, item.units.length <= 3 ? 2 : 1);
  return { kind: 'build', item, title: `${q.spell} ${item.e}`, speak: [q.spell, { pause: 100 }, item.w], tiles: shuffle([...item.units.map(unitText), ...extra]),
    grade: f => gradeItem('spell', item.id, f) };
}
function mkCount() {
  const max = [5, 10, 20][lvl('count') - 1], n = 1 + rand(max), e = pick(OBJECTS), q = L().q;
  return { title: `${q.howMany} 👆`, speak: [q.howMany], visual: objsHTML(n, e), optClass: 'num',
    options: numOpts(n, 1, max + 2), answer: n, correctSpeak: [String(n)], setup: r => tapToCount(r), grade: f => gradeMath('count', f) };
}
function mkAdd() {
  const l = lvl('add'), max = [5, 10, 20][l - 1], q = L().q;
  const s = 2 + rand(max - 1), a = 1 + rand(Math.min(s - 1, 10)), b = s - a, e = pick(OBJECTS);
  return { title: `${a} + ${b} = ?`, speak: [`${a} ${q.plus} ${b}`], optClass: 'num',
    visual: `${objsHTML(a, e)}<span class="sign">+</span>${objsHTML(b, e, { offset: a })}`,
    options: numOpts(s, 0, max + 2), answer: s, correctSpeak: [`${a} ${q.plus} ${b} ${q.equals} ${s}`],
    setup: r => tapToCount(r), grade: f => gradeMath('add', f) };
}
function mkSub() {
  const l = lvl('sub'), max = [5, 10, 20][l - 1], q = L().q;
  const a = 2 + rand(max - 1), b = 1 + rand(a - 1), r = a - b, e = pick(OBJECTS);
  return { title: `${a} − ${b} = ?`, speak: [`${a} ${q.minus} ${b}`], optClass: 'num',
    visual: objsHTML(a, e, { crossed: b }), options: numOpts(r, 0, max), answer: r,
    correctSpeak: [`${a} ${q.minus} ${b} ${q.equals} ${r}`], grade: f => gradeMath('sub', f) };
}
function mkBonds() {
  const T10 = lvl('bonds') >= 2 ? 10 : 5, k = 1 + rand(T10 - 1), q = L().q, e = pick(OBJECTS);
  let f = '<div class="frame">'; for (let i = 0; i < T10; i++) f += `<i class="${i < k ? 'on' : ''}" style="--i:${i}">${i < k ? e : ''}</i>`; f += '</div>';
  return { title: q.makeTo(T10), speak: [q.makeTo(T10)], visual: f, optClass: 'num',
    options: numOpts(T10 - k, 0, T10), answer: T10 - k, correctSpeak: [`${k} ${q.plus} ${T10 - k} ${q.equals} ${T10}`],
    grade: g => gradeMath('bonds', g, 2) };
}
function mkNext() {
  const l = lvl('next'), max = [20, 50, 100][l - 1], q = L().q;
  const before = l > 1 && Math.random() < .4;
  const n = before ? 2 + rand(max - 1) : 1 + rand(max - 1), ans = before ? n - 1 : n + 1;
  const vis = before ? `<div class="track"><b class="q">?</b><span>➜</span><b>${n}</b></div>` : `<div class="track"><b>${n}</b><span>➜</span><b class="q">?</b></div>`;
  return { title: before ? q.before(n) : q.after(n), speak: [before ? q.before(n) : q.after(n)], visual: vis, optClass: 'num',
    options: numOpts(ans, 0, max + 1), answer: ans, correctSpeak: [String(ans)], grade: f => gradeMath('next', f) };
}
function mkCompare() {
  const l = lvl('compare'), q = L().q;
  if (l === 1) {
    let a = 1 + rand(10), b = 1 + rand(10); while (b === a) b = 1 + rand(10);
    const e1 = pick(OBJECTS), e2 = pick(OBJECTS);
    return { title: q.moreGroup, speak: [q.moreGroup], visual: '', optClass: 'group',
      options: [{ html: objsHTML(a, e1), val: 'A' }, { html: objsHTML(b, e2), val: 'B' }], answer: a > b ? 'A' : 'B',
      correctSpeak: [String(Math.max(a, b))], grade: f => gradeMath('compare', f) };
  }
  const max = l === 2 ? 50 : 100;
  let a = 1 + rand(max), b = 1 + rand(max); while (b === a) b = 1 + rand(max);
  return { title: q.bigger, speak: [q.bigger], visual: '', optClass: 'num',
    options: shuffle([{ html: a, val: a }, { html: b, val: b }]), answer: Math.max(a, b),
    correctSpeak: [String(Math.max(a, b))], grade: f => gradeMath('compare', f) };
}
function mkTrace() {
  const d = DATA[S.lang], l = pick(introduced('letter', d.letters));
  return { kind: 'trace', glyph: l.l, say: [{ unit: l.l }, L().q.like, l.k], hint: l.e };
}
function mkTraceNum() {
  const n = lvl('count') >= 2 ? rand(21) : rand(10);
  return { kind: 'trace', glyph: String(n), say: [String(n)], hint: '' };
}
function mkPaperRead() {
  const d = DATA[S.lang], P = L().paper, kind = rand(3);
  if (kind === 0) {
    const l = pick(introduced('letter', d.letters));
    return { kind: 'paper', text: P.writeLetter(l.l), speak: [P.writeLetter(l.l)], visual: `<div class="wordbig">${esc(l.l)}</div><div class="pic">${l.e}</div>` };
  }
  const w = pick(introduced('blend', d.words));
  if (kind === 1) return { kind: 'paper', text: P.writeWord(w.w), speak: [P.writeWord(w.w)], visual: `<div class="wordbig">${esc(w.w)}</div><div class="pic">${w.e}</div>` };
  return { kind: 'paper', text: P.drawWord, speak: [P.drawWord], visual: `<div class="wordbig">${esc(w.w)}</div>`,
    reveal: { html: `<div class="pic bob">${w.e}</div>`, speak: [P.wasIt, w.w] } };
}
function mkPaperMath() {
  const P = L().paper, kind = rand(3);
  if (kind === 0) {
    const a = 1 + rand(5), b = 1 + rand(4);
    return { kind: 'paper', text: P.drawAdd(a, b), speak: [P.drawAdd(a, b)], visual: `<div class="eq">${a} + ${b} = <span class="q">?</span></div>`,
      answer: a + b, options: numOpts(a + b, 0, 12), grade: f => gradeMath('add', f) };
  }
  if (kind === 1) {
    const a = 3 + rand(6), b = 1 + rand(a - 1);
    return { kind: 'paper', text: P.drawSub(a, b), speak: [P.drawSub(a, b)], visual: `<div class="eq">${a} − ${b} = <span class="q">?</span></div>`,
      answer: a - b, options: numOpts(a - b, 0, 10), grade: f => gradeMath('sub', f) };
  }
  const s = [1, 11, 21, 31, 41][rand(Math.min(5, lvl('next') * 2))];
  return { kind: 'paper', text: P.writeNums(s, s + 9), speak: [P.writeNums(s, s + 9)],
    visual: `<div class="track"><b>${s}</b><span>…</span><b>${s + 9}</b></div>` };
}

// ================= question runner =================
let exitCurrent = null;
function actFrame(meta, inner) {
  const dots = Array.from({ length: meta.count }, (_, i) => `<i class="${i < meta.index ? 'done' : i === meta.index ? 'now' : ''}"></i>`).join('');
  return `<div class="screen act">
    <header class="bar"><button class="ic home" aria-label="home">🏠</button><div class="dots">${dots}</div>
      <div class="stars">⭐ <b>${S.stars}</b></div><button class="ic replay" aria-label="repeat">🔊</button></header>
    <div class="stage">${inner}</div></div>`;
}
function promptHTML(text) { return `<div class="prompt">${owl('mini')}<div class="bubble">${esc(text)}</div></div>`; }
function logDay(first) { const d = S.days[today()] = S.days[today()] || { q: 0, ok: 0 }; d.q++; if (first) d.ok++; tally('q_' + S.lang); }

function ask(q, meta) {
  if (q.kind === 'build') return askBuild(q, meta);
  if (q.kind === 'trace') return askTrace(q, meta);
  if (q.kind === 'paper') return askPaper(q, meta);
  if (q.kind === 'sentence' || q.kind === 'story') return askReading(q, meta);
  return askChoice(q, meta, null);
}
function wire(meta, finish, replay, nudgeParts) {
  $('.home').onclick = () => { sfx('tap'); finish(null); };
  $('.replay').onclick = () => { sfx('tap'); replay(); };
  exitCurrent = () => finish(null);
  setIdle(() => nudge(nudgeParts || []));
}
// ---------- reading sentences & stories (tap any word to hear it; Help reads along) ----------
function readerHTML(lines) {
  return `<div class="reader ${lines.length > 1 ? 'story' : ''}">${lines.map(l => `<p>${l.split(' ').map(w => `<span class="w" data-w="${esc(w.replace(/[.,!?;:…]/g, ''))}">${esc(w)}</span>`).join(' ')}</p>`).join('')}</div>`;
}
function wireReader(root) {
  $$('.w', root).forEach(s => s.addEventListener('click', () => {
    if (!s.dataset.w) return; s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); sfx('tap'); speak(s.dataset.w);
  }));
  const help = $('.helpbtn', root);
  if (help) help.onclick = async () => {
    stopSpeech(); const t = speakToken;
    for (const s of $$('.w', root)) {
      if (t !== speakToken) break;
      $$('.w.on', root).forEach(x => x.classList.remove('on')); s.classList.add('on');
      if (s.dataset.w) await say(s.dataset.w, S.lang, S.settings.rate * 1.05);
    }
    $$('.w.on', root).forEach(x => x.classList.remove('on'));
  };
}
function askReading(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const R = L().read, story = q.kind === 'story';
    app.innerHTML = actFrame(meta, `${promptHTML(q.title)}
      <div class="visual">${readerHTML(q.lines)}</div>
      <div class="btnrow"><button class="btn sun helpbtn">👂 ${R.help}</button>
      ${story ? `<button class="btn teal readdone">✅ ${R.iRead}</button>` : ''}</div>
      <div class="options" ${story ? 'hidden' : ''}></div>`);
    const root = $('.stage');
    wireReader(root);
    wire(meta, finish, () => speak(...q.speak), q.speak);
    const run = async () => { const r = await askChoice(q, meta, $('.options')); finish(r); };
    if (story) {
      $('.readdone').onclick = () => {
        sfx('good'); owlReact('happy'); $('.readdone').remove(); $('.helpbtn').remove();
        $('.bubble').textContent = q.q; $('.reader').classList.add('small');
        $('.options').hidden = false; speak(q.q); setIdle(() => nudge([q.q])); run();
      };
    } else run();
    speak(...q.speak);
  });
}
// multiple choice. If `container` given, renders options into it (used by paper missions).
function askChoice(q, meta, container) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    if (!container) {
      app.innerHTML = actFrame(meta, `${promptHTML(q.title)}<div class="visual">${q.visual || ''}</div>
        <div class="options ${q.optClass || ''}" ${q.gate ? 'hidden' : ''}></div>`);
      wire(meta, finish, () => speak(...q.speak), q.speak);
    }
    const root = $('.stage'), box = container || $('.options', root);
    box.innerHTML = q.options.map((o, i) => `<button class="opt ${q.optClass || ''}" data-i="${i}" style="--i:${i}">${o.html}</button>`).join('');
    const btns = $$('.opt', box);
    let attempts = 0, busy = false;
    btns.forEach(b => b.addEventListener('click', async () => {
      if (busy || b.disabled) return;
      const o = q.options[+b.dataset.i];
      if (String(o.val) === String(q.answer)) {
        busy = true; b.classList.add('correct'); btns.forEach(x => { if (x !== b) x.disabled = true; });
        const first = attempts === 0;
        sfx('good'); burstAt(b, first ? 50 : 20); owlReact('happy');
        if (first) flyStar(b); else tally('retryOk');
        q.grade && q.grade(first); logDay(first); save();
        const cb = comboHit(first);
        await speak(...(q.correctSpeak || []), ...(first ? (cb ? [cb] : praiseParts()) : []));
        await sleep(350); finish(first);
      } else {
        attempts++; b.classList.add('wrong'); b.disabled = true; sfx('oops'); owlReact('think');
        if (attempts === 1 && btns.length > 2) speak(L().retry, { pause: 150 }, ...q.speak);
        else { const c = btns.find(x => String(q.options[+x.dataset.i].val) === String(q.answer)); c.classList.add('hint'); speak(L().itsThis, ...(q.correctSpeak || [])); }
      }
    }));
    if (q.setup) q.setup(root, () => { box.hidden = false; });
    if (!container) speak(...q.speak);
  });
}
function askBuild(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const units = q.item.units;
    app.innerHTML = actFrame(meta, `${promptHTML(q.title)}<div class="visual"><div class="pic bob">${q.item.e}</div></div>
      <div class="units slots">${units.map((u, i) => `<div class="unit slot" data-i="${i}">&nbsp;</div>`).join('')}</div>
      ${unitsHTML(q.tiles).replace('class="units"', 'class="units pool"')}`);
    wire(meta, finish, () => speak(...q.speak), q.speak);
    const slots = $$('.slot'), tiles = $$('.pool .unit');
    tiles.forEach(t => t.classList.remove('silent'));
    let pos = 0, misses = 0;
    tiles.forEach(t => t.addEventListener('click', async () => {
      if (t.classList.contains('used') || pos >= units.length) return;
      const want = unitText(units[pos]);
      if (t.textContent === want) {
        t.classList.add('used'); slots[pos].textContent = want; slots[pos].classList.add('filled');
        if (units[pos].startsWith('_')) slots[pos].classList.add('silent');
        $$('.hint').forEach(h => h.classList.remove('hint'));
        sfx('tap'); speak({ unit: units[pos] }); pos++;
        if (pos === units.length) {
          const first = misses === 0;
          sfx('good'); burstAt($('.slots'), 60); owlReact('happy'); if (first) flyStar($('.slots'));
          tally('built'); if (!first) tally('retryOk');
          q.grade(first); logDay(first); save();
          const cb = comboHit(first);
          await sleep(500); await speak(q.item.w, ...(first ? (cb ? [cb] : praiseParts()) : []));
          await sleep(300); finish(first);
        }
      } else {
        misses++; t.classList.remove('wobble'); void t.offsetWidth; t.classList.add('wobble'); sfx('oops'); owlReact('think');
        if (misses >= 2) { const h = tiles.find(x => !x.classList.contains('used') && x.textContent === want); h && h.classList.add('hint'); speak({ unit: units[pos] }); }
      }
    }));
    speak(...q.speak);
  });
}

// ---------- finger tracing → then copy onto paper ----------
function askTrace(q, meta) {
  return new Promise(async resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const P = L().paper;
    const size = Math.min(innerWidth * 0.8, innerHeight * 0.52, 520);
    app.innerHTML = actFrame(meta, `${promptHTML(P.trace)}
      <div style="display:flex;align-items:center;gap:20px">${q.hint ? `<div class="pic bob" style="font-size:80px">${q.hint}</div>` : ''}
      <div class="tracebox" style="width:${size}px;height:${size}px"><canvas class="guide"></canvas><canvas class="ink"></canvas></div></div>
      <div class="meter"><i></i></div>
      <div class="btnrow"><button class="btn again">🔄 ${P.clear}</button></div>`);
    wire(meta, finish, () => speak(P.trace, ...q.say), [P.trace]);
    try { await document.fonts.load(`700 ${Math.round(size * .8)}px Andika`); } catch (e) { /* fallback font */ }
    const box = $('.tracebox'), gC = $('.guide'), iC = $('.ink'), dpr = devicePixelRatio || 1;
    [gC, iC].forEach(c => { c.width = size * dpr; c.height = size * dpr; c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); });
    const g = gC.getContext('2d'), ink = iC.getContext('2d');
    const font = `700 ${Math.round(size * (q.glyph.length > 1 ? .62 : .8))}px Andika, 'Comic Sans MS', sans-serif`;
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#efe8fb'; g.fillText(q.glyph, size / 2, size / 2 + size * .04);
    g.setLineDash([8, 10]); g.lineWidth = 3; g.strokeStyle = '#9b7fd1'; g.strokeText(q.glyph, size / 2, size / 2 + size * .04);
    // sample the glyph shape to measure coverage
    const m = document.createElement('canvas'); m.width = m.height = size; const mc = m.getContext('2d');
    mc.font = font; mc.textAlign = 'center'; mc.textBaseline = 'middle'; mc.fillText(q.glyph, size / 2, size / 2 + size * .04);
    const data = mc.getImageData(0, 0, size, size).data, pts = [], step = Math.max(6, Math.round(size / 60));
    for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) if (data[(y * size + x) * 4 + 3] > 128) pts.push({ x, y, c: false });
    let covered = 0, drawing = false, last = null, hue = 0, success = false;
    const R = size * .07, meter = $('.meter i');
    const reset = () => { ink.clearRect(0, 0, size, size); pts.forEach(p => p.c = false); covered = 0; meter.style.width = '0%'; };
    const pos = e => { const r = iC.getBoundingClientRect(); return { x: (e.clientX - r.left) * size / r.width, y: (e.clientY - r.top) * size / r.height }; };
    const mark = p => { for (const t of pts) if (!t.c && (t.x - p.x) ** 2 + (t.y - p.y) ** 2 < R * R) { t.c = true; covered++; } meter.style.width = Math.min(100, covered / pts.length / .65 * 100) + '%'; };
    iC.addEventListener('pointerdown', e => { if (success) return; drawing = true; last = pos(e); try { iC.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } mark(last); });
    iC.addEventListener('pointermove', e => {
      if (!drawing) return; const p = pos(e);
      ink.strokeStyle = `hsl(${hue = (hue + 4) % 360} 85% 60%)`; ink.lineWidth = size * .065; ink.lineCap = 'round'; ink.lineJoin = 'round';
      ink.beginPath(); ink.moveTo(last.x, last.y); ink.lineTo(p.x, p.y); ink.stroke(); last = p; mark(p);
      if (Math.random() < .08) sfx('tap');
    });
    const up = async () => {
      if (!drawing) return; drawing = false;
      if (!success && covered / pts.length >= .65) {
        success = true; sfx('win'); burstAt(box, 80); owlReact('happy'); flyStar(box); tally('traces'); logDay(true); save();
        await speak(...praiseParts(), ...q.say);
        await askPaperStep(P.nowPaper, `<div class="wordbig">${esc(q.glyph)}</div>`);
        finish(true);
      }
    };
    iC.addEventListener('pointerup', up); iC.addEventListener('pointercancel', up);
    $('.again').onclick = () => { sfx('tap'); reset(); };
    speak(P.trace, ...q.say);
  });
}

// ---------- paper missions ----------
function missionHTML(text, visual, withPhoto = true) {
  const P = L().paper;
  return `<div class="mission"><div class="pencil">✏️</div><div class="txt">${esc(text)}</div>
    <div class="visual">${visual || ''}</div></div>
    <div class="btnrow"><button class="btn teal huge donebtn">✅ ${P.done}</button>
    ${withPhoto ? `<button class="btn grape photobtn">📷 ${P.photo}</button>` : ''}</div>
    <input type="file" accept="image/*" capture="environment" class="cam" hidden>`;
}
function wirePhoto(label) {
  const btn = $('.photobtn'), cam = $('.cam'); if (!btn) return;
  btn.onclick = () => { sfx('tap'); cam.click(); };
  cam.onchange = async () => {
    const f = cam.files && cam.files[0]; if (!f) return;
    try { await savePhoto(f, label); sfx('win'); rain(); owlReact('happy'); speak(L().paper.photoThanks); btn.textContent = '🌟'; }
    catch (e) { /* ignore */ }
  };
}
async function savePhoto(file, label) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .8));
  await idb.set('photos', Date.now(), { blob, label, date: today() });
  tally('photos'); save();
}
// replaces the stage with a "now do it on paper" card; resolves on Done
function askPaperStep(text, visual) {
  return new Promise(res => {
    $('.stage').innerHTML = promptHTML('✏️ 📄') + missionHTML(text, visual);
    wirePhoto(text);
    $('.donebtn').onclick = () => { sfx('good'); burstAt($('.donebtn'), 40); tally('papers'); save(); res(); };
    speak(text);
  });
}
function askPaper(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    app.innerHTML = actFrame(meta, promptHTML('✏️ 📄') + missionHTML(q.text, q.visual));
    wire(meta, finish, () => speak(...q.speak), q.speak);
    wirePhoto(q.text);
    $('.donebtn').onclick = async () => {
      sfx('good'); burstAt($('.donebtn'), 50); owlReact('happy'); tally('papers'); save();
      if (q.reveal) {
        $('.mission .visual').innerHTML += q.reveal.html; $('.btnrow').hidden = true; flyStar($('.mission'));
        logDay(true); save(); await speak(...q.reveal.speak, ...praiseParts()); await sleep(500); return finish(true);
      }
      if (q.answer !== undefined) {
        $('.stage').innerHTML = `${promptHTML(L().paper.answer)}<div class="visual">${q.visual}</div><div class="options num"></div>`;
        speak(L().paper.answer);
        const r = await askChoice({ ...q, optClass: 'num', correctSpeak: [String(q.answer)] }, meta, $('.options'));
        return finish(r);
      }
      flyStar($('.mission')); logDay(true); save(); await speak(...praiseParts()); await sleep(400); finish(true);
    };
    speak(...q.speak);
  });
}

async function runStop(act, count) {
  let first = 0;
  for (let i = 0; i < count; i++) {
    const q = ACTS[act].make();
    const r = await ask(q, { index: i, count, act });
    if (r === null) { clearIdle(); save(); return null; }
    if (r) first++;
  }
  clearIdle(); save();
  return { first, count };
}

// ================= intro: music + personal welcome =================
function intro() {
  applySettings();
  const H = L().hi, name = childName(), h = new Date().getHours();
  const greet = h < 12 ? H.morning : h < 18 ? H.afternoon : H.evening;
  const bubbles = Array.from({ length: 14 }, (_, i) =>
    `<i style="left:${rand(96)}%;--s:${30 + rand(60)}px;--d:${6 + rand(7)}s;--w:${-rand(12)}s;--h:${rand(360)}"></i>`).join('');
  app.innerHTML = `<div class="screen center intro"><div class="bubbles">${bubbles}</div>
    ${owl('big wave')}<h1 class="logo"><span>T</span><span>i</span><span>k</span><span>o</span></h1>
    <h1 class="hello" hidden>${esc(greet)}${name ? ', ' + esc(name) : (H.there ? ' ' + H.there : '')}! 👋</h1>
    <button class="btn primary huge pulse playb">▶ ${L().hi.letsPlay}</button></div>`;
  let leaving = false;
  const leave = () => { if (leaving) return; leaving = true; home(); };
  $('.playb').onclick = async () => {
    const btn = $('.playb'); btn.remove();
    $('.hello').hidden = false; $('.owl').classList.add('dance');
    const ms = jingle(); burst(innerWidth / 2, innerHeight * .35, 70); setTimeout(rain, 400);
    setTimeout(() => { const i = $('.intro'); if (i) i.addEventListener('click', leave); }, 400); // tap anywhere to skip (not this same tap)
    await sleep(Math.min(ms, 3600) + 200);
    if (leaving) return;
    const st = streakDays();
    await speak(greet, ...(name ? [{ name: true, bang: true }] : []), H.happy, ...(st >= 2 ? [H.streak(st)] : []));
    await sleep(500); leave();
  };
}

// ================= screens =================
function home() {
  stopSpeech(); clearIdle(); applySettings();
  if (S.seenStage[S.lang] === undefined) { S.seenStage[S.lang] = stageOf(); save(); }
  app.innerHTML = `<div class="screen home">
    <button class="ic corner" aria-label="parents">⚙️</button>
    <div class="langs"><button class="lang ${S.lang === 'en' ? 'on' : ''}" data-l="en">🇬🇧 English</button>
      <button class="lang ${S.lang === 'fr' ? 'on' : ''}" data-l="fr">🇫🇷 Français</button></div>
    <div class="hero">${owl('big')}<h1 class="logo"><span>T</span><span>i</span><span>k</span><span>o</span></h1></div>
    <button class="btn primary huge pulse go">▶ ${L().start}</button>
    <div class="row">
      <button class="btn card" data-m="read">📖<span>${L().reading}</span></button>
      <button class="btn card" data-m="math">🔢<span>${L().maths}</span></button>
      <button class="btn card" data-m="journey">🗺️<span>${L().read.journey}</span></button>
      <button class="btn card" data-m="stickers">🌟<span>${L().stickers}</span></button>
    </div>
    <div class="row" style="align-items:center;gap:12px"><div class="starcount">⭐ ${S.stars} &nbsp; 🌟 ${S.stickers.length} &nbsp; 🏅 ${Object.keys(S.badges).length}</div>
    ${goalBarHTML()}</div>
  </div>`;
  $$('.lang').forEach(b => b.onclick = () => {
    S.lang = b.dataset.l; save(); sfx('pop'); home(); owlReact('happy');
    speak(S.lang === 'fr' ? 'Coucou' : 'Hello', { name: true, bang: true }, S.lang === 'fr' ? 'On parle français !' : "Let's speak English!");
  });
  // tapping Tiko gives a random silly reaction
  const silly = S.lang === 'fr' ? ['Hou hou !', 'Ça chatouille !', 'Hi hi hi !', 'On joue ?', 'Tu es super !']
    : ['Hoo hoo!', 'That tickles!', 'Hee hee hee!', "Let's play!", "You're awesome!"];
  $('.owl').onclick = () => {
    const o = $('.owl'), k = pick(['happy', 'dance', 'spin']);
    o.classList.remove('happy', 'dance', 'spin'); void o.offsetWidth; o.classList.add(k); setTimeout(() => o.classList.remove(k), 1600);
    sfx('pop'); burstAt(o, 20); speak(pick(silly));
  };
  $('.go').onclick = () => { sfx('pop'); startPath(); };
  $$('[data-m]').forEach(b => b.onclick = () => { sfx('tap'); const m = b.dataset.m; m === 'stickers' ? stickerBook() : m === 'journey' ? journey() : menu(m); });
  $('.corner').onclick = () => parentGate();
}
function menu(area) {
  const ids = Object.keys(ACTS).filter(k => ACTS[k].area === area);
  app.innerHTML = `<div class="screen menu">
    <div class="topline"><button class="ic back">🏠</button><h2>${area === 'read' ? '📖 ' + L().reading : '🔢 ' + L().maths}</h2><div style="width:64px"></div></div>
    <div class="grid">${ids.map((k, i) => `<button class="btn card" data-a="${k}" style="--i:${i}">${ACTS[k].icon}<span>${esc(actName(k))}</span></button>`).join('')}</div></div>`;
  $('.back').onclick = home;
  $$('[data-a]').forEach(b => b.onclick = async () => {
    sfx('pop'); const a = b.dataset.a;
    const r = await runStop(a, ACTS[a].per || S.settings.perStop);
    if (r) { await reward(); await checkUnlock(); await celebrateAwards(); } menu(area);
  });
}

// ---------- the daily path ----------
let path = null;
function buildPath() {
  const day = new Date().getDate(), odd = day % 2 === 1;
  const lit = odd ? 'letters' : 'sight', lit2 = odd ? 'sight' : 'letters';
  const mathA = odd ? 'add' : 'sub', mathB = ['count', 'bonds', 'next', 'compare'][day % 4];
  // what the path focuses on depends on where she is on the literacy journey
  const PLANS = [
    ['letters', 'blend', 'A', 'trace', 'B', 'sight', 'paperMath', 'spell'],
    ['blend', lit, 'A', 'paper', 'B', 'spell', 'traceNum', lit2],
    ['sight', 'blend', 'A', 'paper', 'B', 'spell', 'paperMath', 'letters'],
    ['blend', 'sight', 'A', 'spell', 'B', 'paper', 'traceNum', 'sentence'],
    ['sentence', 'blend', 'A', 'paper', 'B', 'sight', 'paperMath', 'spell'],
    ['story', 'sentence', 'A', 'paper', 'B', 'blend', 'paperMath', 'sight'],
  ];
  const order = PLANS[Math.min(stageOf(), 5)].map(x => x === 'A' ? mathA : x === 'B' ? mathB : x);
  const stops = order.slice(0, S.settings.stops);
  const seq = [];
  stops.forEach((s, i) => { seq.push(s); if (S.settings.breaks && i === 2 && stops.length > 3) seq.push('break'); });
  return seq.map(a => ({ a, done: false, sticker: null }));
}
function startPath() { path = buildPath(); showPath(); }
function showPath() {
  const cur = path.findIndex(s => !s.done);
  if (cur === -1) return finale();
  app.innerHTML = `<div class="screen path">
    <div class="topline"><button class="ic back">🏠</button><h2>🗺️ ${L().pathTitle}</h2><div class="stars">⭐ <b>${S.stars}</b></div></div>
    <div class="stones">${path.map((s, i) => `<div class="stone ${s.done ? 'done' : i === cur ? 'now' : ''} ${s.a === 'break' ? 'brk' : ''}" style="--i:${i}">
      ${s.a === 'break' ? '🤸' : ACTS[s.a].icon}${s.done && s.sticker ? `<span class="badge">${s.sticker}</span>` : ''}${i === cur ? '' : ''}</div>`).join('')}
      <div class="stone" style="--i:${path.length};background:#fff3c4">🏆</div></div>
    ${owl('')}
    <button class="btn primary huge pulse go">${L().go}</button></div>`;
  $('.back').onclick = home;
  const next = path[cur];
  speak(next.a === 'break' ? L().breakTitle : actName(next.a));
  $('.go').onclick = async () => {
    sfx('pop');
    if (next.a === 'break') { await moveBreak(); next.done = true; return showPath(); }
    const r = await runStop(next.a, ACTS[next.a].per || S.settings.perStop);
    if (!r) return home();
    next.sticker = await reward(); next.done = true;
    if (path.every(s => s.done)) { tally('paths'); save(); }
    await checkUnlock();
    await celebrateAwards();
    showPath();
  };
}
// celebrate reaching a new place on the journey
async function checkUnlock() {
  const st = stageOf(), seen = S.seenStage[S.lang] || 0;
  if (st <= seen) return false;
  S.seenStage[S.lang] = st; save();
  await new Promise(res => {
    clearIdle();
    const s = STAGES[Math.min(st, STAGES.length - 1)], name = L().journey[Math.min(st, STAGES.length - 1)];
    app.innerHTML = `<div class="screen center"><div class="rays"></div><h1>${L().read.unlocked}</h1>
      <div class="prize">${st >= STAGES.length ? '👑' : s.icon}</div><div class="bubble" style="font-size:38px">${esc(st >= STAGES.length ? L().allDone : name)}</div>
      ${owl('big')}<button class="btn primary huge okb">${L().next} ➜</button></div>`;
    sfx('win'); rain(); setTimeout(rain, 900); owlReact('happy');
    speak(L().read.unlocked, st >= STAGES.length ? L().allDone : name);
    $('.okb').onclick = () => { sfx('tap'); res(); };
  });
  return true;
}
function journey() {
  stopSpeech(); clearIdle();
  const cur = stageOf(), names = L().journey;
  app.innerHTML = `<div class="screen sub"><div class="topline"><button class="ic back">🏠</button><h2>🗺️ ${L().read.journey}</h2><div style="width:64px"></div></div>
    <div class="map">${STAGES.map((s, i) => {
      const p = stagePct(i), state = i < cur ? 'done' : i === cur ? 'now' : 'locked';
      return `<button class="isle ${state}" data-i="${i}" style="--i:${i};--p:${Math.round(p * 100)}%">
        <span class="ico">${state === 'locked' ? '🔒' : s.icon}</span><span class="nm">${esc(names[i])}<span class="pb"><i></i></span></span>
        ${state === 'done' ? '<span class="flag">🚩</span>' : ''}${state === 'now' ? owl('mini') : ''}</button>`;
    }).join('')}</div>
    <button class="btn primary huge pulse go">▶ ${L().start}</button></div>`;
  $('.back').onclick = home;
  $('.go').onclick = () => { sfx('pop'); startPath(); };
  $$('.isle').forEach(b => b.onclick = () => {
    const i = +b.dataset.i; sfx('tap'); burstAt(b, 15);
    speak(names[i], i === cur ? L().read.next : '');
  });
  speak(L().read.journey, cur < STAGES.length ? names[cur] : L().allDone);
  const now = $('.isle.now'); if (now) now.scrollIntoView({ block: 'center' });
}
function reward() {
  return new Promise(res => {
    const left = STICKERS.filter(s => !S.stickers.includes(s));
    const st = left.length ? pick(left) : pick(STICKERS);
    if (!S.stickers.includes(st)) S.stickers.push(st);
    save();
    app.innerHTML = `<div class="screen center"><div class="rays"></div><h1>${L().gotSticker}</h1>
      <div class="prize">${st}</div><button class="btn primary huge nextb">${L().next} ➜</button></div>`;
    sfx('win'); rain(); speak(L().gotSticker);
    $('.prize').onclick = () => { burstAt($('.prize'), 40); sfx('pop'); };
    $('.nextb').onclick = () => { sfx('tap'); res(st); };
  });
}
function moveBreak() {
  return new Promise(res => {
    const mv = pick(L().moves), em = pick(['🤸', '🙆', '🦘', '🐸', '🌳', '💃', '🕺']);
    app.innerHTML = `<div class="screen center"><h1>${L().breakTitle}</h1><div class="mover">${em}</div>
      <div class="bubble" style="font-size:36px">${esc(mv)}</div><div class="ring"><span>20</span></div>
      <button class="btn teal huge okb">✅ ${L().iDidIt}</button></div>`;
    speak(L().breakTitle, mv);
    let t = 20; const ring = $('.ring');
    const iv = setInterval(() => { t--; if (!ring.isConnected) return clearInterval(iv); ring.style.setProperty('--p', ((20 - t) / 20 * 100) + '%'); ring.querySelector('span').textContent = Math.max(0, t); if (t <= 0) { clearInterval(iv); sfx('good'); } }, 1000);
    $('.okb').onclick = () => { clearInterval(iv); sfx('win'); burstAt($('.okb'), 60); setTimeout(res, 500); };
  });
}
function finale() {
  app.innerHTML = `<div class="screen center"><div class="rays"></div><h1>${L().allDone}</h1>
    <div class="prize">🏆</div><div class="row">${path.filter(s => s.sticker).map(s => `<span style="font-size:60px">${s.sticker}</span>`).join('')}</div>
    ${owl('big')}<button class="btn primary huge homeb">🏠 ${L().home}</button></div>`;
  sfx('win'); rain(); setTimeout(rain, 1200); owlReact('happy'); speak(L().allDone);
  $('.homeb').onclick = home;
}

// ---------- sticker book + my work ----------
async function stickerBook(tab = 'stickers') {
  const P = L().paper;
  app.innerHTML = `<div class="screen sub"><div class="topline"><button class="ic back">🏠</button>
    <div class="tabs" style="flex:1;justify-content:center"><button data-t="stickers" class="${tab === 'stickers' ? 'on' : ''}">🌟 ${L().stickers}</button>
    <button data-t="badges" class="${tab === 'badges' ? 'on' : ''}">🏅 ${L().aw.badges}</button>
    <button data-t="work" class="${tab === 'work' ? 'on' : ''}">📷 ${P.myWork}</button></div><div style="width:64px"></div></div>
    <div class="content" style="width:100%;display:flex;justify-content:center"></div></div>`;
  $('.back').onclick = home;
  $$('[data-t]').forEach(b => b.onclick = () => { sfx('tap'); stickerBook(b.dataset.t); });
  const c = $('.content');
  if (tab === 'stickers') {
    c.innerHTML = `<div class="book">${STICKERS.map((s, i) => `<div class="${S.stickers.includes(s) ? '' : 'locked'}" style="--i:${i}">${s}</div>`).join('')}</div>`;
    $$('.book div:not(.locked)').forEach(d => d.onclick = () => { burstAt(d, 25); sfx('pop'); });
  } else if (tab === 'badges') {
    c.innerHTML = `<div class="badges">${BADGES.map((b, i) => `<button class="badge ${S.badges[b.id] ? '' : 'locked'}" data-b="${i}" style="--i:${i}">
      <span class="bi">${b.icon}</span><span class="bn">${esc(badgeName(b))}</span></button>`).join('')}</div>`;
    $$('.badge').forEach(d => d.onclick = () => {
      const b = BADGES[+d.dataset.b]; sfx('pop'); speak(badgeName(b));
      if (S.badges[b.id]) burstAt(d, 30);
    });
  } else {
    const keys = ((await idb.keys('photos')) || []).sort((a, b) => b - a);
    if (!keys.length) { c.innerHTML = `<div class="empty">📷 ✏️ 📄</div>`; return; }
    c.innerHTML = '<div class="gallery"></div>';
    const g = $('.gallery');
    for (const k of keys) {
      const p = await idb.get('photos', k); if (!p) continue;
      const img = new Image(); img.src = URL.createObjectURL(p.blob); img.style.setProperty('--r', (rand(7) - 3) + 'deg');
      img.onclick = () => { const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${img.src}">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); };
      g.appendChild(img);
    }
  }
}

// ================= parents =================
function parentGate() {
  const a = 3 + rand(6), b = 4 + rand(5), ans = a * b; let val = '';
  app.innerHTML = `<div class="screen gate"><h2>👪 ${L().parents}: ${a} × ${b} = ?</h2><div class="gatein">&nbsp;</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✔'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <button class="btn back">🏠</button></div>`;
  $('.back').onclick = home;
  $$('[data-k]').forEach(btn => btn.onclick = () => {
    const k = btn.dataset.k;
    if (k === '⌫') val = val.slice(0, -1); else if (k === '✔') { if (+val === ans) return parents(); val = ''; } else if (val.length < 3) val += k;
    $('.gatein').textContent = val || ' ';
  });
}
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

function parents() {
  stopSpeech();
  const st = S.settings;
  const voiceOpts = lang => `<option value="">(auto)</option>` + voicesFor(lang).map(v => `<option ${st['voice_' + lang] === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  const pr = (label, set, items) => { const n = items.length, m = items.filter(i => S.boxes[`${lg}:${set}:${i.id}`] >= 4).length, s = items.filter(i => S.boxes[`${lg}:${set}:${i.id}`] > 0).length;
    return `<div class="prog"><span>${label}</span><div class="barx"><i style="width:${m / n * 100}%"></i></div><span>${m}/${n} ✓<br><small>${s} seen</small></span></div>`; };
  let lg = 'en';
  const progHTML = () => {
    let h = '';
    for (lg of ['en', 'fr']) {
      const d = DATA[lg], stg = stageOf(lg);
      h += `<h4>${lg === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}: journey stage ${Math.min(stg + 1, 6)}/6 (${stg >= 6 ? 'complete!' : esc(T.en.journey[stg])})</h4>
        <p>${STAGES.map((s, i) => `${s.icon} ${Math.round(stagePct(i, lg) * 100)}%`).join(' → ')} · sentences read: ${cnt(lg, 'sentence')}, stories: ${cnt(lg, 'story')}</p>${pr('Letter sounds', 'letter', d.letters)}${pr('Magic words', 'sight', d.sight)}${pr('Blending', 'blend', d.words)}${pr('Building words', 'spell', d.words)}`;
    }
    h += `<h4>🏅 Badges: ${Object.keys(S.badges).length}/${BADGES.length}</h4><p>${BADGES.map(b => `<span title="${esc(b.en)}" style="${S.badges[b.id] ? '' : 'opacity:.25;filter:grayscale(1)'}">${b.icon}</span>`).join(' ')}</p>
      <p>Streak: ${streakDays()} day(s) · kept trying after a mistake: ${tot('retryOk')} times · paper missions: ${tot('papers')}</p>`;
    h += `<h4>🔢 Maths levels</h4><p>${['count', 'add', 'sub', 'bonds', 'next', 'compare'].map(a => `${T.en.acts[a]}: <b>${lvl(a)}</b>/${a === 'bonds' ? 2 : 3}`).join(' · ')}</p>`;
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return [d.toLocaleDateString(undefined, { weekday: 'short' }), S.days[k] || { q: 0, ok: 0 }]; });
    const mx = Math.max(10, ...days.map(d => d[1].q));
    h += `<h4>Last 7 days (answers · first-try correct)</h4><div class="days">${days.map(([n, v]) => `<div><span>${v.q ? `${v.q}·${v.ok}` : ''}</span><i style="height:${v.q / mx * 90}%"></i>${n}</div>`).join('')}</div>`;
    return h;
  };
  app.innerHTML = `<div class="screen parent"><div class="wrap">
    <div class="topline"><button class="ic back">🏠</button><h2>👪 Parent corner</h2></div>

    <section><h3>📲 Install on the tablet</h3>
      <p>In Chrome, tap <b>⋮ → Add to Home screen / Install app</b>. After that Tiko works offline and opens full-screen.</p>
      ${installEvt ? '<button class="pbtn inst">Install Tiko now</button>' : ''}</section>

    <section><h3>🖨️ Paper worksheets (blended learning)</h3>
      <p>A worksheet made from what she's learning right now: letters to trace, words to read and draw, sums at her current level.
      Print it or save it as a PDF. Every daily path also includes a <b>paper mission</b>. She works on paper, then taps ✅ or uses 📷 to show Tiko her work.</p>
      <button class="pbtn ws" data-l="en">🇬🇧 English worksheet</button><button class="pbtn ws" data-l="fr">🇫🇷 Fiche en français</button></section>

    <section><h3>👧 Her name</h3>
      <p>Tiko welcomes her by name and sometimes uses it in praise. It's stored only on this tablet, never online.
      If the robot voice says it wrong, type how it sounds (e.g. "Koo-zha-lee"), or better, record it in your voice.</p>
      <label class="set">Name <input class="nm-in" data-s="name" type="text" maxlength="30" value="${esc(st.name)}" placeholder="Her name"></label>
      <label class="set">Spoken as (optional) <input class="nm-in" data-s="nameSay" type="text" maxlength="40" value="${esc(st.nameSay)}" placeholder="How it sounds"></label>
      <button class="pbtn alt nm-test">▶ Hear it</button><button class="pbtn nm-rec">⏺ Record her name</button>
      <button class="pbtn alt nm-del" ${recKeys.has('name') ? '' : 'hidden'}>🗑 Delete recording</button></section>

    <section><h3>🎁 Rewards she's working towards</h3>
      <p>Set a real-world reward and a star price. Stars count from the moment you add it. Her progress bar shows on the home screen, and Tiko celebrates when she gets there.
      Small, quick rewards (10–30 stars) work best at first. Stars only come from first-try answers, so a typical path earns about 15–25.</p>
      <div class="goals"></div>
      <div class="goalform">
        <select class="g-emoji">${['🎁', '🛝', '🍦', '🎨', '📚', '🧸', '🎮', '🍕', '🎬', '🌳', '🏊', '🚲'].map(e => `<option>${e}</option>`).join('')}</select>
        <input class="g-text" type="text" maxlength="40" placeholder="e.g. Trip to the park">
        <select class="g-cost">${[10, 20, 30, 50, 75, 100, 150, 200].map(n => `<option ${n === 30 ? 'selected' : ''}>${n}</option>`).join('')}</select> ⭐
        <button class="pbtn g-add">Add</button>
      </div></section>

    <section><h3>⚙️ Session</h3>
      <label class="set">Stops on the daily path <select data-s="stops">${[3, 4, 5, 6, 7, 8].map(n => `<option ${st.stops === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="set">Questions per stop <select data-s="perStop">${[3, 4, 5, 6, 8].map(n => `<option ${st.perStop === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="set">Movement break mid-path <input type="checkbox" data-s="breaks" ${st.breaks ? 'checked' : ''}></label>
      <label class="set">Focus nudges (Tiko says "Your turn!" after 15 s with no taps) <input type="checkbox" data-s="nudge" ${st.nudge ? 'checked' : ''}></label>
      <label class="set">Sound effects <input type="checkbox" data-s="sfx" ${st.sfx ? 'checked' : ''}></label>
      <label class="set">Intro music <input type="checkbox" data-s="music" ${st.music ? 'checked' : ''}></label>
      <label class="set">Calm mode (less motion and confetti) <input type="checkbox" data-s="calm" ${st.calm ? 'checked' : ''}></label>
      <div class="set" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee;font-size:17px">Voice style
        <span><button class="pbtn alt vs" data-p="1.4" data-r="0.95">🫧 Bubbly</button><button class="pbtn alt vs" data-p="1.1" data-r="0.88">🙂 Normal</button><button class="pbtn alt vs" data-p="0.95" data-r="0.8">🌙 Calm</button></span></div>
      <label class="set">Voice pitch (higher = more bubbly) <input type="range" min="0.8" max="1.7" step="0.05" value="${st.pitch}" data-s="pitch"></label>
      <label class="set">Voice speed <input type="range" min="0.5" max="1.1" step="0.05" value="${st.rate}" data-s="rate"></label>
      <label class="set">English voice <select data-s="voice_en">${voiceOpts('en')}</select></label>
      <label class="set">French voice <select data-s="voice_fr">${voiceOpts('fr')}</select></label>
      <button class="pbtn alt tv" data-l="en">▶ Test English</button><button class="pbtn alt tv" data-l="fr">▶ Tester le français</button>
      <p>No French voice listed? On the tablet go to <b>Settings → General management → Text-to-speech → Google → Install voice data</b> and download English (UK) and French (France). Then they work offline too.</p></section>

    <section><h3>🎙️ Record letter sounds in your voice (recommended)</h3>
      <p>Robot voices can't say pure sounds like "sss" or "mmm" very well. Record each sound once (about 1 second) and Tiko will use your voice in every game.</p>
      <div class="tabs" style="margin-bottom:10px"><button class="rl on" data-l="en">🇬🇧</button><button class="rl" data-l="fr">🇫🇷</button></div>
      <div class="recgrid"></div></section>

    <section><h3>📊 Progress</h3><p>✓ = remembered well (reached box 4 of 5 in spaced repetition). New items come in slowly, a few at a time, and anything she misses comes back more often.</p>
      <div class="progx">${progHTML()}</div></section>

    <section><h3>📷 Her paper work</h3><div class="gallery pg"></div></section>

    <section><h3>🧹 Reset</h3><button class="pbtn warn rst">Reset all progress</button></section>
  </div></div>`;
  $('.back').onclick = home;
  $$('[data-s]').forEach(el => el.onchange = el.oninput = () => {
    const k = el.dataset.s; st[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : /^\d+$/.test(el.value) ? +el.value : el.value;
    save(); applySettings();
  });
  const demo = async l => { stopSpeech(); await sleep(80); await say(l === 'fr' ? "Coucou ! Je suis Tiko. On lit ensemble ?" : "Hi there! I'm Tiko. Shall we read together?", l); await say(l === 'fr' ? 'Bravo, super !' : 'Great job, superstar!', l); };
  $$('.tv').forEach(b => b.onclick = () => demo(b.dataset.l));
  $$('.nm-in').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
  $('.nm-test').onclick = () => speak(S.lang === 'fr' ? 'Coucou' : 'Hello', { name: true, bang: true }, ...praiseParts());
  $('.nm-del').onclick = async () => { await idb.del('rec', 'name'); recKeys.delete('name'); $('.nm-del').hidden = true; };
  $('.nm-rec').onclick = () => record('name', $('.nm-rec'), () => { $('.nm-del').hidden = false; $('.nm-rec').className = 'pbtn nm-rec'; $('.nm-rec').textContent = '⏺ Record again'; });
  $$('.vs').forEach(b => b.onclick = () => {
    st.pitch = +b.dataset.p; st.rate = +b.dataset.r; save();
    $('[data-s="pitch"]').value = st.pitch; $('[data-s="rate"]').value = st.rate; demo(S.lang);
  });
  $$('.ws').forEach(b => b.onclick = () => worksheet(b.dataset.l));
  const drawGoals = () => {
    const box = $('.goals');
    box.innerHTML = S.goals.length ? S.goals.map((g, i) => `<div class="goalrow"><span style="font-size:28px">${g.emoji}</span>
      <b>${esc(g.text)}</b><span>${g.done ? `✅ earned ${esc(g.done)}` : `⭐ ${goalProgress(g)}/${g.cost}`}</span>
      ${g.done ? `<button class="pbtn" data-give="${i}">Given ✓</button>` : `<button class="pbtn alt" data-del="${i}">🗑</button>`}</div>`).join('')
      : '<p><i>No rewards set yet.</i></p>';
    $$('[data-give]', box).forEach(b => b.onclick = () => { S.goals.splice(+b.dataset.give, 1); save(); drawGoals(); });
    $$('[data-del]', box).forEach(b => b.onclick = () => { S.goals.splice(+b.dataset.del, 1); save(); drawGoals(); });
  };
  drawGoals();
  $('.g-add').onclick = () => {
    const text = $('.g-text').value.trim(); if (!text) { $('.g-text').focus(); return; }
    S.goals.push({ id: Date.now(), emoji: $('.g-emoji').value, text, cost: +$('.g-cost').value, base: S.stars, done: null });
    $('.g-text').value = ''; save(); drawGoals();
  };
  $('.g-text').addEventListener('keydown', e => e.stopPropagation());
  const inst = $('.inst'); if (inst) inst.onclick = async () => { installEvt.prompt(); installEvt = null; inst.remove(); };
  let recLang = 'en';
  const drawRec = () => {
    $('.recgrid').innerHTML = DATA[recLang].recordable.map(u => `<div><b class="${recKeys.has(recLang + ':' + u) ? 'has' : ''}">${esc(u)}</b>
      <button data-p="${esc(u)}">▶</button><button data-r="${esc(u)}">⏺</button>${recKeys.has(recLang + ':' + u) ? `<button data-d="${esc(u)}">🗑</button>` : ''}</div>`).join('');
    $$('[data-p]').forEach(b => b.onclick = () => { stopSpeech(); playUnit(b.dataset.p, recLang); });
    $$('[data-d]').forEach(b => b.onclick = async () => { await idb.del('rec', recLang + ':' + b.dataset.d); recKeys.delete(recLang + ':' + b.dataset.d); drawRec(); });
    $$('[data-r]').forEach(b => b.onclick = () => record(recLang + ':' + b.dataset.r, b, drawRec));
  };
  $$('.rl').forEach(b => b.onclick = () => { $$('.rl').forEach(x => x.classList.toggle('on', x === b)); recLang = b.dataset.l; drawRec(); });
  drawRec();
  let armed = false;
  $('.rst').onclick = e => {
    if (!armed) { armed = true; e.target.textContent = 'Tap again to confirm reset'; setTimeout(() => { armed = false; e.target.textContent = 'Reset all progress'; }, 4000); return; }
    const keep = S.settings; S = structuredClone(DEFAULTS); S.settings = keep; save(); parents();
  };
  (async () => {
    const g = $('.pg'), keys = ((await idb.keys('photos')) || []).sort((a, b) => b - a);
    if (!keys.length) { g.outerHTML = '<p>No photos yet. She can take one with 📷 during paper missions.</p>'; return; }
    for (const k of keys) {
      const p = await idb.get('photos', k); if (!p) continue;
      const w = document.createElement('div'); w.style.position = 'relative';
      w.innerHTML = `<img style="--r:0deg" src="${URL.createObjectURL(p.blob)}"><p style="margin:4px 0;font-size:13px">${esc(p.date)}</p><button class="pbtn alt" style="position:absolute;top:6px;right:0">🗑</button>`;
      w.querySelector('button').onclick = async () => { await idb.del('photos', k); w.remove(); };
      g.appendChild(w);
    }
  })();
}
let recorder = null;
async function record(key, btn, after) {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream), chunks = []; recorder = mr;
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); recorder = null;
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      await idb.set('rec', key, blob); recKeys.add(key); after(); playBlob(blob);
    };
    mr.start(); btn.classList.add('pbtn', 'rec'); btn.textContent = '⏹';
    setTimeout(() => mr.state === 'recording' && mr.stop(), 2500);
  } catch (e) { btn.textContent = '🚫'; }
}

// ================= printable worksheet =================
function worksheet(lang) {
  const d = DATA[lang], t = T[lang], sh = t.sheet, q = t.q;
  const box = set => id => S.boxes[`${lang}:${set}:${id}`] || 0;
  const lb = box('letter'), wb = box('blend');
  let letters = d.letters.filter(x => lb(x.id) > 0).sort((a, b) => lb(a.id) - lb(b.id)).slice(0, 4);
  if (letters.length < 4) letters = [...letters, ...d.letters.filter(x => !letters.includes(x))].slice(0, 4);
  let words = shuffle(d.words.filter(x => wb(x.id) > 0)).slice(0, 3);
  if (words.length < 3) words = [...words, ...d.words.filter(x => !words.includes(x))].slice(0, 3);
  const la = lvl('add'), ls = lvl('sub'), max = n => [5, 10, 20][n - 1];
  const sums = [];
  for (let i = 0; i < 3; i++) { const s = 2 + rand(max(la) - 1), a = 1 + rand(Math.min(s - 1, 10)); sums.push([a, '+', s - a]); }
  for (let i = 0; i < 3; i++) { const a = 2 + rand(max(ls) - 1), b = 1 + rand(a - 1); sums.push([a, '−', b]); }
  const dotsOf = n => n <= 10 ? '○'.repeat(n) : '';
  const nmax = [20, 50, 100][lvl('next') - 1], s0 = 1 + rand(nmax - 8);
  const seq = [...Array(8)].map((_, i) => s0 + i).map((n, i) => (i % 3 === 1 || i === 5) ? '___' : n).join(', ');
  const el = $('#sheet');
  el.innerHTML = `<div class="sh-close"><button class="pbtn" onclick="window.print()">🖨️ Print / PDF</button><button class="pbtn alt" id="shx">✕</button></div>
    <div class="sh-head"><h1>🦉 ${sh.title}</h1><span>${sh.name}: ____________ &nbsp; ${sh.date}: ________</span></div>
    <div class="sh-sec"><h2>✏️ ${sh.trace}</h2>${letters.map(l => `<div class="sh-trace">${`<span>${esc(l.l)}</span>`.repeat(6)}<span style="font-size:40px;color:#000">${l.e}</span></div><div class="sh-trace"></div>`).join('')}</div>
    <div class="sh-sec"><h2>📖 ${sh.read}</h2><div class="sh-words">${words.map(w => `<div><b>${esc(w.w)}</b></div>`).join('')}</div></div>
    <div class="sh-sec"><h2>🔢 ${sh.sums}</h2><div class="sh-sums">${sums.map(([a, o, b]) => `<div>${a} ${o} ${b} = ____<small>${o === '+' ? dotsOf(a) + ' + ' + dotsOf(b) : dotsOf(a)}</small></div>`).join('')}</div></div>
    <div class="sh-sec"><h2>➡️ ${sh.line}</h2><div class="sh-line">${seq}</div></div>`;
  el.classList.add('preview');
  $('#shx').onclick = () => { el.classList.remove('preview'); el.innerHTML = ''; };
}

// ================= boot =================
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
applySettings();
intro();
