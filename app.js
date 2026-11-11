'use strict';
/* Tiko – a calm, fun, bilingual reading & maths app. */
const APP_VERSION = 40;   // keep in step with VERSION in sw.js; shown on the home screen

// ================= helpers =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const L = () => T[S.lang];
const app = $('#app');

// ================= state =================
const STORE_KEY = 'tiko.v1';
const DEFAULTS = {
  lang: 'en', stars: 0, stickers: [], boxes: {}, levels: {}, streak: {}, days: {}, counts: {}, seenStage: {},
  totals: {}, badges: {}, goals: [], due: {},
  settings: { stops: 5, perStop: 5, rate: 0.9, pitch: 1.6, pitch_fr: 1.25, sfx: true, music: true, ambient: true, ambientWork: false, sessionMin: 0, theme: 'unicorn', calm: false, breaks: true, nudge: true, artInPath: true, discovery: true,
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
// lift tablets still on the old default pitch to the new bubblier one (custom choices are left alone)
if (S.settings.pitch === 1.35) S.settings.pitch = 1.5;
// v17: the voice had gone flat on her tablet — lift anything below the bubbly range back up (once)
if (!S.settings.pitchV17) { if (S.settings.pitch < 1.6) S.settings.pitch = 1.6; S.settings.pitchV17 = true; }
// v22: "known once = never again". Anything she has already got right (box 2+) becomes known for ever.
if (!S.knownV22) { for (const k of Object.keys(S.boxes || {})) if (S.boxes[k] >= 2) { S.boxes[k] = 5; S.due[k] = 'never'; } S.knownV22 = true; }
// v23: Memory pairs was too hard — new gentler ladder (2 pairs first), so she starts again at the bottom (once)
if (!S.memV23) { S.levels = S.levels || {}; S.streak = S.streak || {}; S.levels.memory = 1; S.streak.memory = { ok: 0, bad: 0 }; S.memV23 = true; }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
function applySettings() {
  document.body.classList.toggle('calm', !!S.settings.calm); document.documentElement.lang = S.lang;
  // the theme a parent chose: colours and scenery come from body[data-theme] in styles.css, the mascot from MASCOTS
  const th = themeName(); document.body.dataset.theme = th;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = THEMES[th][2];
}
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
    // soft, round, bell-like sounds (pure tones, gentle volumes) — nothing sharp or startling
    if (kind === 'good') { tone(784, t, .25, 'sine', .1); tone(1175, t + .1, .45, 'sine', .08); tone(1568, t + .1, .3, 'sine', .02); }
    else if (kind === 'oops') { tone(330, t, .2, 'sine', .06); tone(277, t + .13, .3, 'sine', .05); }
    else if (kind === 'tap') tone(660, t, .07, 'sine', .045);
    else if (kind === 'pop') tone(880, t, .1, 'sine', .06);
    else if (kind === 'win') [523, 587, 659, 784, 880, 1047, 1319].forEach((f, i) => { tone(f, t + i * .09, .7, 'sine', .085); tone(f * 2, t + i * .09, .35, 'sine', .015); });
  } catch (e) { /* ignore */ }
}

// ================= relaxing music (synthesised, no files): a slow music box over a warm, quiet pad =================
// It plays on the calm screens (home, menus, map, stickers, drawing), goes silent whenever Tiko speaks, and stays off
// during learning activities unless a parent asks for it there too (then very quietly).
const music = { on: false, mode: 'off', g: null, timer: 0, next: 0, bar: 0, speaking: 0, upT: 0 };
// C – Am – F – G: [bass, pad, then the notes the music box may play]
const M_CHORDS = [[130.8, 196, 261.6, 329.6, 392, 493.9], [110, 164.8, 261.6, 329.6, 392, 440], [87.3, 174.6, 261.6, 349.2, 440, 523.3], [98, 196, 293.7, 392, 440, 493.9]];
function mVoice(f, t0, dur, vol, att = .02) {
  const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(music.g); o.start(t0); o.stop(t0 + dur + .05);
}
function musicTick() {
  if (!music.on || !actx) return;
  const BAR = 4.8;
  if (music.next < actx.currentTime) music.next = actx.currentTime + .1;
  while (music.next < actx.currentTime + 1.5) {
    const c = M_CHORDS[music.bar % 4], t = music.next;
    mVoice(c[0], t, BAR * 1.2, .1, 1.4); mVoice(c[1], t, BAR * 1.2, .055, 1.8);
    (music.bar % 2 ? [2, 4, 3, 5, 4, 2] : [2, 3, 4, 3, 5, 3]).forEach((n, i) => {
      if (i && Math.random() < .22) return;   // little rests, so it never becomes a tune that nags
      const f = c[n] * 2, at = t + i * BAR / 6 + Math.random() * .03;
      mVoice(f, at, 2.4, .05); mVoice(f * 2, at, 1.1, .012);
    });
    music.next += BAR; music.bar++;
  }
}
function musicSet() {
  try {
    const st = S.settings, lvl2 = !st.ambient || document.hidden ? 0 : music.mode === 'calm' ? 1 : music.mode === 'work' && st.ambientWork ? .3 : 0;
    if (lvl2 > 0 && !music.on) {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (!music.g) { music.g = actx.createGain(); music.g.gain.value = 0.0001; music.g.connect(actx.destination); }
      music.on = true; musicTick(); music.timer = setInterval(musicTick, 400);
    } else if (!lvl2 && music.on) { music.on = false; clearInterval(music.timer); }
    if (!music.g) return;
    if (lvl2 > 0 && actx.state === 'suspended' && !music.speaking) actx.resume();
    const want = music.speaking ? 0 : lvl2 * .6;
    music.g.gain.cancelScheduledValues(actx.currentTime);
    music.g.gain.setTargetAtTime(Math.max(0.0001, want), actx.currentTime, want ? .9 : .07);   // slow fade in, quick duck
  } catch (e) { /* ignore */ }
}
function musicMode(m) { music.mode = m; if (m !== 'off') document.body.classList.toggle('work', m === 'work'); musicSet(); }
document.addEventListener('visibilitychange', musicSet);

// ================= speech =================
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function voicesFor(lang) { return voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang)); }
function voiceFor(lang) {
  const list = voicesFor(lang), want = S.settings['voice_' + lang];
  // prefer brighter, friendlier voices when the device names them
  const bright = /female|libby|sonia|maisie|hollie|denise|eloise|amelie|amélie|audrey|julie|aria|jenny|zira|hortense|samantha|karen/i;
  // on-device voices first: they start instantly and work offline; online voices lag and can cut out
  const local = list.filter(v => v.localService);
  return list.find(v => v.name === want) || local.find(v => bright.test(v.name) && v.lang.replace('_', '-') === DATA[lang].voiceLang) ||
    local.find(v => bright.test(v.name)) || local.find(v => /google/i.test(v.name)) ||
    local.find(v => v.lang.replace('_', '-') === DATA[lang].voiceLang) || local[0] ||
    list.find(v => bright.test(v.name)) ||
    list.find(v => v.lang.replace('_', '-') === DATA[lang].voiceLang) || list[0] || null;
}
// ONE sound at a time. Every clip that is playing is tracked so stopSpeech can silence all of them (not just the
// latest) and release anything waiting on them; letter sounds go through a single queue so they never overlap.
let speakToken = 0, curAudio = null;
const liveAudio = new Set();
let unitChain = Promise.resolve();
function stopSpeech() {
  speakToken++;
  try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  for (const a of [...liveAudio]) { try { a.pause(); } catch (e) { /* ignore */ } if (a.__fin) a.__fin(); }
  liveAudio.clear(); curAudio = null;
}
// Bubbly voice: raised pitch overall, and an extra lift for anything exclaimed ("Bravo !", "Great job!")
// French device voices distort when pitched very high, so French has its own, gentler pitch
const langPitch = lang => lang === 'fr' ? (S.settings.pitch_fr || 1.25) : S.settings.pitch;
function say(text, lang = S.lang, rate = S.settings.rate, pitch = langPitch(lang)) {
  return new Promise(res => {
    // never read punctuation aloud: "Combien ?" / "…?" would otherwise be spoken as "question mark"
    text = String(text || '').replace(/…\s*\?/g, '?').replace(/…/g, ', ').replace(/\s+([?!.,;:])/g, '$1').replace(/^[\s?!.,;:]+/, '').trim();
    if (!('speechSynthesis' in window) || !text || /^[?!.,;:\s]*$/.test(text)) return res();
    const u = new SpeechSynthesisUtterance(text), v = voiceFor(lang);
    if (v) u.voice = v;
    // Expression, so Tiko doesn't sound like a flat robot: cheering is higher and quicker (with a little random
    // sparkle each time), short "Wow!"-style words are extra high, questions rise, everything else varies slightly.
    const excited = /!\s*$/.test(text), question = /\?\s*$/.test(text), shout = excited && text.split(/\s+/).length <= 2;
    const fr = lang === 'fr', jitter = (Math.random() - .5) * (fr ? .06 : .12);
    u.lang = v ? v.lang : DATA[lang].voiceLang;
    u.rate = Math.min(1.5, rate * (shout ? 1.12 : excited ? 1.08 : question ? 1.0 : 1.0));
    u.pitch = Math.min(2, Math.max(.5, pitch + jitter + (shout ? (fr ? .15 : .25) : excited ? (fr ? .1 : .2) + Math.random() * (fr ? .05 : .12) : question ? (fr ? .05 : .1) : 0)));
    // Safety timers, in case the engine never reports "end" (happens on Android):
    // allow a long wait for speech to START (online voices can take seconds), and only once it has
    // started, a length-based limit. Giving up early made the app move on and cut Tiko off mid-sentence.
    let done = false, startT = null, endT = null, keep = null;
    const fin = () => { if (done) return; done = true; clearTimeout(startT); clearTimeout(endT); clearInterval(keep); res(); };
    u.onend = fin; u.onerror = fin;
    u.onstart = () => { clearTimeout(startT); endT = setTimeout(fin, 3000 + text.length * 160 / u.rate); };
    startT = setTimeout(fin, 10000);
    // Chrome can silently pause long-running speech; nudge it along
    keep = setInterval(() => { try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) { /* ignore */ } }, 1000);
    speechSynthesis.speak(u);
  });
}
// A sound unit plays, in order of preference: the parent's own recording → the built-in phonics clip → the voice
// queued: a new letter sound waits for the previous one to finish (and is dropped if Tiko has moved on meanwhile)
function playUnit(unit, lang = S.lang, rate) {
  const tok = speakToken;
  unitChain = unitChain.catch(() => {}).then(() => (tok === speakToken ? playUnitNow(unit, lang, rate) : null));
  return unitChain;
}
async function playUnitNow(unit, lang = S.lang, rate) {
  if (unit.startsWith('_')) return;
  const snd = unitSound(unit);                     // "ai:ay" plays the "ay" sound
  const key = `${lang}:${snd}`;
  if (recKeys.has(key)) {
    const blob = await idb.get('rec', key);
    if (blob) return playBlob(blob);
  }
  // the clip; if it can't load (e.g. offline right after an update) fall back to the voice rather than silence
  // A clip ALWAYS plays exactly as it was recorded: no speeding up, no slowing down, no pitch change (v37).
  // Sped up without pitch correction it came out as a squeaky "baby voice"; slowed down, the tablet stretched it into mush.
  if (rate === 'clear') rate = 0;
  if ((SOUND_CLIPS[lang] || []).includes(snd) && await playUrl(`sounds/${lang}-${snd}.wav`) !== false) return;
  // letter sounds stay close to natural pitch so they remain clear
  return say(DATA[lang].sounds[snd] || unitText(unit), lang, (rate || S.settings.rate) * 0.9, Math.min(langPitch(lang), 1.4));
}
function playUrl(url) {
  return new Promise(res => {
    const a = new Audio(url); curAudio = a; liveAudio.add(a);
    // resolves true when it played, false when the file couldn't be played (so the caller can fall back)
    let done = false; const fin = a.__fin = (ok = true) => { if (!done) { done = true; liveAudio.delete(a); res(ok); } };
    a.onended = () => fin(true); a.onerror = () => fin(false); a.play().catch(err => fin(err && err.name === 'AbortError'));
    setTimeout(() => fin(true), 4000);
  });
}
function playBlob(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob), a = new Audio(url); curAudio = a; liveAudio.add(a);
    let done = false; const fin = a.__fin = () => { if (!done) { done = true; liveAudio.delete(a); URL.revokeObjectURL(url); res(); } };
    a.onended = fin; a.onerror = fin; a.play().catch(fin);
    setTimeout(fin, 6000);
  });
}
// speak(...parts): string | {unit} | {pause} | {text, lang}
async function speak(...parts) {
  // the music goes quiet while Tiko talks, and drifts back a moment after she has finished
  music.speaking++; clearTimeout(music.upT); musicSet();
  try { await speakParts(parts); } finally { music.speaking--; clearTimeout(music.upT); music.upT = setTimeout(musicSet, 900); }
}
async function speakParts(parts) {
  stopSpeech(); const t = speakToken;
  await sleep(150);
  for (const p of parts.flat()) {
    if (t !== speakToken) return;
    if (!p) continue;
    // normal-length speech goes out as one smooth piece; only very long text is split into sentences
    if (typeof p === 'string') { for (const s of (p.length > 160 ? p.split(/(?<=[.!?])\s+/) : [p])) { if (t !== speakToken) return; await say(s); } }
    else if (p.pause) await sleep(p.pause);
    else if (p.run) p.run();                             // something to show at this point of the talk (e.g. light the picture being named)
    else if (p.unit !== undefined) await playUnit(p.unit, p.lang || S.lang, p.rate);
    else if (p.name) await sayName(p.bang);
    // a run of sound units, each one finishing before the next starts (never on top of each other):
    // fast (gap < 450) = back-to-back, slightly quicker, so they run together; slow = "robot talk" with a pause between
    else if (p.seq) {
      const fast = (p.gap || 650) < 450;
      for (const [i, u] of p.seq.entries()) {
        if (t !== speakToken) return; if (u.startsWith('_')) continue;
        if (p.onUnit) p.onUnit(i);                       // e.g. light a dot for the sound being said
        await playUnit(u, p.lang || S.lang, p.clear ? 'clear' : fast ? 1.15 : 1);
        if (!fast) await sleep(Math.max(150, (p.gap || 650) - 450));
      }
      await sleep(250);
    }
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
  // "Woohoo! Great job!" is said as two bursts so the "Woohoo!" can be extra high and bouncy
  const bursts = pick(L().praise).split(/(?<=!)\s+/);
  if (childName() && Math.random() < 0.35) { const last = bursts.pop(); return [...bursts, last.replace(/\s*!\s*$/, ''), { name: true, bang: true }]; }
  return bursts;
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
    for (const [n, d] of mel) { tone(N[n], t, d * b * 1.6, 'sine', 0.1); tone(N[n] * 2, t, d * b, 'sine', 0.02); t += d * b; }   // music-box sound
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
const FX_COLORS = ['#f9a8c9', '#ffd580', '#8fdccb', '#b9a0ee', '#9ed0f5', '#a6e3bd', '#ffc2dd'];
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
  el.querySelector('b').textContent = S.stars; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ================= mascot =================
// Tiko changes with the theme a parent picks: a winged unicorn, a little dragon, a dinosaur, or an owl. Every mascot is an SVG
// in a 120×120 box using the same class names (owl-body, wing l / wing r, eyes, mouth), so all the animations
// (blink, bob, hop, flap, dance, talk, sleep) work for each of them. owl(cls) draws the current one.
const THEMES = { unicorn: ['Unicorn', 'pink and lavender', '#f6c1da'], dino: ['Dragon', 'blue, green and orange', '#bfdcf6'], rex: ['Dinosaur', 'jungle green and orange', '#cfe9c4'], owl: ['Owl', 'soft and natural', '#d5e9dc'] };
const themeName = () => (THEMES[S.settings.theme] ? S.settings.theme : 'unicorn');
const MASCOTS = {};
function owl(cls = '', theme = themeName()) { return MASCOTS[theme](cls); }
MASCOTS.dino = (cls = '') => `<div class="owl ${cls}"><svg viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="115" rx="30" ry="4.5" fill="#0000001a"/>
  <g class="owl-body" stroke="#3f9f86" stroke-width="1.2" stroke-linejoin="round">
    <path class="wing l" d="M38 80 q-14 -20 -30 -12 q6 4 5 10 q6 -2 8 4 q5 -3 9 2 q4 -1 8 -4z" fill="#ffb26b" stroke="#e8914a"/>
    <path class="wing r" d="M82 80 q14 -20 30 -12 q-6 4 -5 10 q-6 -2 -8 4 q-5 -3 -9 2 q-4 -1 -8 -4z" fill="#ffb26b" stroke="#e8914a"/>
    <path d="M80 100 q22 4 22 -14 q8 14 -4 24 q-10 6 -18 -2z" fill="#6fcfae"/>
    <path d="M100 84 l8 -6 l-2 10z" fill="#ffb26b" stroke="#e8914a"/>
    <rect x="43" y="98" width="13" height="16" rx="6" fill="#6fcfae"/><rect x="64" y="98" width="13" height="16" rx="6" fill="#6fcfae"/>
    <path d="M45 113 h2 M49.5 113.5 h1 M53 113 h1 M66 113 h2 M70.5 113.5 h1 M74 113 h1" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <ellipse cx="60" cy="92" rx="25" ry="18" fill="#6fcfae"/>
    <ellipse cx="60" cy="95" rx="15" ry="13" fill="#fff3cf" stroke="none"/>
    <path d="M50 90 h20 M49 96 h22 M52 102 h16" stroke="#f3dfa6" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <path d="M36 30 l-4 -16 l14 9z M84 30 l4 -16 l-14 9z" fill="#fff3cf" stroke="#e6d190"/>
    <path d="M52 25 l4 -11 l5 9 l5 -11 l4 12z" fill="#ffb26b" stroke="#e8914a"/>
    <ellipse cx="60" cy="54" rx="36" ry="31" fill="#7fdcbb"/>
    <g class="eyes" stroke="none">
      <ellipse cx="45" cy="52" rx="7.5" ry="9" fill="#fff"/><ellipse cx="75" cy="52" rx="7.5" ry="9" fill="#fff"/>
      <ellipse cx="46" cy="53" rx="5" ry="6.4" fill="#2f4156"/><ellipse cx="74" cy="53" rx="5" ry="6.4" fill="#2f4156"/>
      <circle cx="48" cy="50" r="2.2" fill="#fff"/><circle cx="76" cy="50" r="2.2" fill="#fff"/>
    </g>
    <ellipse cx="31" cy="64" rx="6" ry="4" fill="#ff9f8a" opacity=".5" stroke="none"/><ellipse cx="89" cy="64" rx="6" ry="4" fill="#ff9f8a" opacity=".5" stroke="none"/>
    <ellipse cx="60" cy="71" rx="17" ry="10.5" fill="#a5ecd2" stroke="none"/>
    <circle cx="54" cy="67.5" r="1.5" fill="#3f9f86" stroke="none"/><circle cx="66" cy="67.5" r="1.5" fill="#3f9f86" stroke="none"/>
    <path class="mouth" d="M52 74 q8 5.5 16 0" stroke="#2f7f6a" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M64.5 75.2 l1.6 3 l1.6 -3.6z" fill="#fff" stroke="none"/>
  </g></svg></div>`;
// a little triceratops (nothing like the dragon): a big frill behind the head, two brow horns and a nose horn, a beak,
// warm orange instead of green, no wings — its short arms carry the "wing" classes so the animations still work
MASCOTS.rex = (cls = '') => `<div class="owl ${cls}"><svg viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="115" rx="30" ry="4.5" fill="#0000001a"/>
  <g class="owl-body" stroke="#d98a34" stroke-width="1.2" stroke-linejoin="round">
    <path d="M80 103 q18 3 21 -9 q4 13 -6 19 q-9 3 -15 -4z" fill="#ffb760"/>
    <rect x="43" y="98" width="13" height="16" rx="6" fill="#ffb760"/><rect x="64" y="98" width="13" height="16" rx="6" fill="#ffb760"/>
    <path d="M45 113 h2 M49.500 113.500 h1 M53 113 h1 M66 113 h2 M70.500 113.500 h1 M74 113 h1" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <ellipse cx="60" cy="93" rx="24" ry="17" fill="#ffb760"/>
    <ellipse cx="60" cy="96" rx="14" ry="12" fill="#fff6d6" stroke="none"/>
    <path class="wing l" d="M38 86 q-11 -1 -13 8 q3 -1 4 2 q3 -2 5 1 q4 -2 7 -5z" fill="#ffb760"/>
    <path class="wing r" d="M82 86 q11 -1 13 8 q-3 -1 -4 2 q-3 -2 -5 1 q-4 -2 -7 -5z" fill="#ffb760"/>
    <ellipse cx="60" cy="40" rx="47" ry="34" fill="#ffd98a" stroke="#e8a23c"/>
    <ellipse cx="60" cy="43" rx="37" ry="26" fill="#ffc15e" stroke="none"/>
    <g fill="#ff8f5a" stroke="#e0703c" stroke-width=".8"><circle cx="15" cy="34" r="4"/><circle cx="24" cy="18" r="4"/><circle cx="41" cy="8" r="4"/><circle cx="60" cy="5" r="4"/><circle cx="79" cy="8" r="4"/><circle cx="96" cy="18" r="4"/><circle cx="105" cy="34" r="4"/></g>
    <ellipse cx="60" cy="60" rx="31" ry="26" fill="#ffc474"/>
    <path d="M43 42 q-7 -13 -4 -25 q9 8 14 21z M77 42 q7 -13 4 -25 q-9 8 -14 21z" fill="#fffaf0" stroke="#cdbb95"/>
    <g class="eyes" stroke="none">
      <ellipse cx="45" cy="57" rx="7" ry="8.500" fill="#fff"/><ellipse cx="75" cy="57" rx="7" ry="8.500" fill="#fff"/>
      <ellipse cx="46" cy="58" rx="4.800" ry="6" fill="#4a3526"/><ellipse cx="74" cy="58" rx="4.800" ry="6" fill="#4a3526"/>
      <circle cx="48" cy="55" r="2.100" fill="#fff"/><circle cx="76" cy="55" r="2.100" fill="#fff"/>
    </g>
    <ellipse cx="33" cy="69" rx="5.500" ry="3.600" fill="#ff8f7a" opacity=".5" stroke="none"/><ellipse cx="87" cy="69" rx="5.500" ry="3.600" fill="#ff8f7a" opacity=".5" stroke="none"/>
    <ellipse cx="60" cy="77" rx="17" ry="10" fill="#ffe2ad" stroke="none"/>
    <path d="M54 72 q6 -18 12 0z" fill="#fffaf0" stroke="#cdbb95"/>
    <circle cx="53" cy="77" r="1.400" fill="#c9792c" stroke="none"/><circle cx="67" cy="77" r="1.400" fill="#c9792c" stroke="none"/>
    <path class="mouth" d="M52 81 q8 5 16 0" stroke="#a85f1f" stroke-width="2" stroke-linecap="round" fill="none"/>
  </g></svg></div>`;
MASCOTS.owl = (cls = '') => `<div class="owl ${cls}"><svg viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="114" rx="32" ry="5" fill="#0000001a"/>
  <g class="owl-body">
    <path class="wing l" d="M24 58 q-16 20 2 40 q8-16 6-40z" fill="#b98a5a"/>
    <path class="wing r" d="M96 58 q16 20 -2 40 q-8-16 -6-40z" fill="#b98a5a"/>
    <path d="M28 36 l4 -20 l16 14z M92 36 l-4 -20 l-16 14z" fill="#c79763"/>
    <ellipse cx="60" cy="66" rx="38" ry="42" fill="#dcae78"/>
    <ellipse cx="60" cy="82" rx="24" ry="24" fill="#fff3dd"/>
    <path d="M48 76 q4 4 8 0 M56 86 q4 4 8 0 M64 76 q4 4 8 0" stroke="#edd3a8" stroke-width="2" fill="none"/>
    <g class="eyes">
      <circle cx="44" cy="50" r="15" fill="#fff"/><circle cx="76" cy="50" r="15" fill="#fff"/>
      <circle cx="46" cy="52" r="8" fill="#40463f"/><circle cx="74" cy="52" r="8" fill="#40463f"/>
      <circle cx="49" cy="48" r="3" fill="#fff"/><circle cx="77" cy="48" r="3" fill="#fff"/>
    </g>
    <circle cx="30" cy="66" r="5" fill="#ff9f8a" opacity=".55"/><circle cx="90" cy="66" r="5" fill="#ff9f8a" opacity=".55"/>
    <path class="mouth" d="M54 62 l6 9 l6 -9z" fill="#f29a4a"/>
    <path d="M48 106 l-4 6 M53 107 l0 6 M67 107 l0 6 M72 106 l4 6" stroke="#f29a4a" stroke-width="3.5" stroke-linecap="round"/>
  </g></svg></div>`;
MASCOTS.unicorn = (cls = '') => {
  return `<div class="owl ${cls}"><svg viewBox="0 0 120 120" aria-hidden="true">
  <ellipse cx="60" cy="115" rx="30" ry="4.5" fill="#0000001a"/>
  <g class="owl-body" stroke="#e3cfee" stroke-width="1.2" stroke-linejoin="round">
    <path class="wing l" d="M38 82 q-12 -16 -27 -9 q-6 9 3 14 q-3 7 6 9 q1 6 9 3 q7 -2 11 -9z" fill="#dccdfb" stroke="#c9b4f2"/>
    <path class="wing r" d="M82 82 q12 -16 27 -9 q6 9 -3 14 q3 7 -6 9 q-1 6 -9 3 q-7 -2 -11 -9z" fill="#dccdfb" stroke="#c9b4f2"/>
    <path d="M80 100 q20 0 17 -18 q12 14 0 25 q-9 7 -17 -1z" fill="#ff9ecb" stroke="none"/>
    <path d="M82 102 q13 1 14 -9 q5 9 -3 14 q-6 3 -11 -2z" fill="#b99cf0" stroke="none"/>
    <rect x="43" y="98" width="12" height="16" rx="5.5" fill="#fff"/><rect x="65" y="98" width="12" height="16" rx="5.5" fill="#fff"/>
    <path d="M43 109 h12 a5.5 5.5 0 0 1 -5.5 5.5 h-1 a5.5 5.5 0 0 1 -5.5 -5.5z M65 109 h12 a5.5 5.5 0 0 1 -5.5 5.5 h-1 a5.5 5.5 0 0 1 -5.5 -5.5z" fill="#f7a8cc" stroke="none"/>
    <ellipse cx="60" cy="92" rx="25" ry="18" fill="#fff"/>
    <path d="M29 36 l1 -22 l17 13z M91 36 l-1 -22 l-17 13z" fill="#fff"/>
    <path d="M33 31 l1 -11 l9 7z M87 31 l-1 -11 l-9 7z" fill="#ffc2dd" stroke="none"/>
    <path d="M60 0 l8.5 27 h-17z" fill="#ffd66b" stroke="#f0b848"/>
    <path d="M56.5 12 l7.5 -3 M54.5 19 l10.5 -4.5 M53 25.5 l13.5 -5" stroke="#f0b13c" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <ellipse cx="60" cy="55" rx="36" ry="31" fill="#fff"/>
    <path d="M44 27 q9 -10 24 -4 q-1 9 -11 9 q4 4 1 9 q-11 -2 -14 -14z" fill="#ff9ecb" stroke="none"/>
    <path d="M31 33 q-13 10 -10 30 q2 12 -5 18 q15 3 18 -11 q1 -9 -2 -17 q-1 -11 5 -17 q-3 -4 -6 -3z" fill="#b99cf0" stroke="none"/>
    <path d="M25 42 q-6 10 -3 22 q1 8 -2 13 q8 -2 9 -11 q0 -8 -2 -13 q-1 -6 -2 -11z" fill="#8fd3f4" stroke="none"/>
    <g class="eyes" stroke="none">
      <ellipse cx="45" cy="55" rx="7" ry="8.5" fill="#3b2f4a"/><ellipse cx="75" cy="55" rx="7" ry="8.5" fill="#3b2f4a"/>
      <circle cx="47.5" cy="51.5" r="2.8" fill="#fff"/><circle cx="77.5" cy="51.5" r="2.8" fill="#fff"/>
      <circle cx="43" cy="58.5" r="1.3" fill="#fff"/><circle cx="73" cy="58.5" r="1.3" fill="#fff"/>
    </g>
    <ellipse cx="33" cy="67" rx="6" ry="4" fill="#ff9ecb" opacity=".55" stroke="none"/><ellipse cx="87" cy="67" rx="6" ry="4" fill="#ff9ecb" opacity=".55" stroke="none"/>
    <ellipse cx="60" cy="73" rx="13" ry="8.5" fill="#ffe3ef" stroke="none"/>
    <circle cx="55.5" cy="71" r="1.2" fill="#e79bbd" stroke="none"/><circle cx="64.5" cy="71" r="1.2" fill="#e79bbd" stroke="none"/>
    <path class="mouth" d="M54.5 75.5 q5.5 4 11 0" stroke="#d77aa3" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  </g></svg></div>`;
}
// which part of the universe she is in (each has its own sky colours)
function zone(z) { document.body.dataset.zone = z || 'home'; }
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
  // items she already knows are "resting" until their review date — they don't come back the same day
  const avail = intro.filter(i => isDue(set, i.id));
  const learning = avail.filter(i => boxOf(set, i.id) <= 2).length;
  const fresh = items.find(i => boxOf(set, i.id) === 0);
  const rec = recent[set] || [];
  let item, isNew = false;
  // Items she missed (box 1–2) come back for practice once a few others have gone by (the "recent" window);
  // a new item comes in when there's nothing ready to practise, or half the time while fewer than 5 are being learned.
  const ready = avail.filter(i => !rec.includes(i.id));
  void ready; void learning; void fresh; void avail;   // (replaced by the simpler rule below)
  // THE RULE (parent's wish): right first time = known for ever, never shown again. Only items she got WRONG
  // come back, at random, until she gets them right. Everything else is new.
  const missed = items.filter(i => { const b = boxOf(set, i.id); return b > 0 && b < 5 && !isKnown(set, i.id); });
  const newOnes = items.filter(i => boxOf(set, i.id) === 0 && !isKnown(set, i.id));
  const practise = missed.filter(i => !rec.includes(i.id));
  if (practise.length && (!newOnes.length || Math.random() < 0.4)) item = pick(practise);
  else if (newOnes.length) { item = newOnes[0]; isNew = true; S.boxes[bkey(set, item.id)] = 1; }
  else if (missed.length) { const notLast = missed.filter(i => i.id !== rec[0]); item = pick(notLast.length ? notLast : missed); }
  else { const notLast = items.filter(i => i.id !== rec[0]); item = pick(notLast.length ? notLast : items); }   // she knows every one at this level
  recent[set] = [item.id, ...rec].slice(0, Math.max(1, Math.min(3, missed.length - 1)));
  return { item, isNew };
}
// a word counts as known if she got it right in ANY word activity (blending, robot talk, build a word, families)
const WORD_SETS = ['blend', 'oral', 'spell', 'fam'];
function isKnown(set, id) { return boxOf(set, id) >= 5 || (WORD_SETS.includes(set) && WORD_SETS.some(s => boxOf(s, id) >= 5)); }
// Right first time = she knows it: it moves to box 3+ and rests until its review date (3 days, then 7, then 21),
// so a known word is never repeated the same day. A miss puts it back in box 1 and it stays in today's practice.
const REVIEW_DAYS = [0, 0, 1, 3, 7, 21];
const dayPlus = n => ymd(new Date(Date.now() + n * 864e5));
const isDue = (set, id) => { const d = S.due[bkey(set, id)]; return !d || d <= today(); };
// a brand-new item right first time might be a lucky guess: it rests until tomorrow (box 2), then one more right = known
// right first time → known for ever (box 5, never due again); a mistake → box 1, it will come back to practise
function gradeItem(set, id, first) {
  const k = bkey(set, id);
  S.boxes[k] = first ? 5 : 1;
  S.due[k] = first ? 'never' : today();
  diary(first ? 'ok' : 'miss', set, id, first ? '' : lastWrong);
}
// A small diary for the parent report: what she learned, missed (and what she chose instead), day by day.
// Kept short (about the last 800 answers) and only on this device.
let lastWrong = '';
function diary(kind, set, id, extra) {
  S.diary = S.diary || []; S.diary.push([today(), S.lang, kind, set, String(id), extra || '']);
  if (S.diary.length > 800) S.diary.splice(0, S.diary.length - 800);
}
// time spent playing, per day (only while she is actually touching the screen now and then, and not in the parent corner)
let lastTouch = Date.now();
addEventListener('pointerdown', () => { lastTouch = Date.now(); }, true);
setInterval(() => {
  if (document.hidden || Date.now() - lastTouch > 90000 || $('.parent')) return;
  const d = S.days[today()] = S.days[today()] || { q: 0, ok: 0 }; d.t = (d.t || 0) + 15; save();
}, 15000);
function introduced(set, items) { const l = items.filter(i => boxOf(set, i.id) > 0); return l.length ? l : items.slice(0, 3); }

// ================= the literacy journey =================
// Six places. Each unlocks when the skill before it is genuinely remembered (spaced-repetition box >= 3).
// share of items she knows (a word known through ANY word activity counts)
const frac = (lg, set, items) => items.length ? items.filter(i => (S.boxes[`${lg}:${set}:${i.id}`] || 0) >= 3 ||
  (['blend', 'oral', 'spell', 'fam'].includes(set) && ['blend', 'oral', 'spell', 'fam'].some(s => (S.boxes[`${lg}:${s}:${i.id}`] || 0) >= 5))).length / items.length : 1;
const cnt = (lg, k) => ((S.counts[lg] || {})[k]) || 0;
function bumpCount(k) { const c = S.counts[S.lang] = S.counts[S.lang] || {}; c[k] = (c[k] || 0) + 1; }
// word difficulty levels: tier(lg, 1) = simple words, 2 = digraphs/blends (FR: ou/on/ch…), 3 = long vowels (FR: complex
// sounds, long words), 4 = two-syllable words (EN)
const tier = (lg, n) => { const t = DATA[lg].tiers; return DATA[lg].words.slice(n > 1 ? t[n - 2] : 0, t[n - 1]); };
// The word lists are long (so she never runs out of new words), but a place on the journey is won by knowing a fixed
// NUMBER of words of that level — not a share of the whole list — so the journey keeps the same pace.
const wordsKnown = (lg, n, need) => Math.min(1, tier(lg, n).length ? frac(lg, 'blend', tier(lg, n)) * tier(lg, n).length / Math.min(need, tier(lg, n).length) : 1);
const STAGES = [
  { icon: '🏝️', goal: .8, prog: lg => frac(lg, 'letter', DATA[lg].letters) },
  { icon: '🌉', goal: 1, prog: lg => wordsKnown(lg, 1, 22) },
  { icon: '🌲', goal: .8, prog: lg => frac(lg, 'sight', DATA[lg].sight.slice(0, 20)) },
  { icon: '⛰️', goal: 1, prog: lg => wordsKnown(lg, 2, 18) },
  { icon: '🛶', goal: 1, prog: lg => Math.min(1, cnt(lg, 'sentence') / 15) },
  { icon: '🌊', goal: 1, prog: lg => wordsKnown(lg, 3, 16) },
  { icon: '🏰', goal: 1, prog: lg => Math.min(1, cnt(lg, 'story') / 10) },
  // the summit: English two-syllable words; French has no level 4 words, so the magic words instead
  { icon: '🏔️', goal: 1, prog: lg => tier(lg, 4).length ? wordsKnown(lg, 4, 16) : Math.min(1, frac(lg, 'sight', DATA[lg].sight.slice(0, 30)) / .7) },
];
const stagePct = (i, lg = S.lang) => Math.min(1, STAGES[i].prog(lg) / STAGES[i].goal);
// a place she has already reached is never taken away again (new content, or a word going back to practice, can't move her back)
function stageOf(lg = S.lang) { for (let i = (S.seenStage || {})[lg] || 0; i < STAGES.length; i++) if (stagePct(i, lg) < 1) return i; return STAGES.length; }
// Parent "start the journey at…": mark everything belonging to the earlier places as known (box 3, resting),
// so she starts at the chosen place. Forward only — it never erases progress.
function startJourneyAt(lg, target) {
  let n = 0;
  const know = (set, items) => items.forEach(i => { const k = `${lg}:${set}:${i.id}`; if ((S.boxes[k] || 0) < 5) { S.boxes[k] = 5; S.due[k] = 'never'; n++; } });
  const c = S.counts[lg] = S.counts[lg] || {};
  const steps = [() => know('letter', DATA[lg].letters), () => know('blend', tier(lg, 1)), () => know('sight', DATA[lg].sight.slice(0, 20)),
    () => know('blend', tier(lg, 2)), () => { c.sentence = Math.max(c.sentence || 0, 15); }, () => know('blend', tier(lg, 3)),
    () => { c.story = Math.max(c.story || 0, 10); }, () => (tier(lg, 4).length ? know('blend', tier(lg, 4)) : know('sight', DATA[lg].sight))];
  for (let i = 0; i < target && i < steps.length; i++) steps[i]();
  S.seenStage[lg] = Math.max(S.seenStage[lg] || 0, stageOf(lg)); save();
  return n;
}
// words she meets now grow with the journey: level 1 → +2 at Tricky Sound Mountain → +3 at the Lagoon → +4 at the Summit
function wordLevel(lg = S.lang) {
  const st = stageOf(lg); let lv = st < 3 ? 1 : st < 5 ? 2 : st < 7 ? 3 : 4;
  // never run out of new words: if she already knows every word at this level, open up the next one
  const known = w => WORD_SETS.some(s => (S.boxes[`${lg}:${s}:${w.id}`] || 0) >= 5);
  const maxLv = DATA[lg].tiers.filter((t, i, a) => i === 0 || t > a[i - 1]).length;
  while (lv < maxLv && DATA[lg].words.slice(0, DATA[lg].tiers[lv - 1]).every(known)) lv++;
  return lv;
}
function wordsNow() { const d = DATA[S.lang]; return d.words.slice(0, d.tiers[wordLevel() - 1]); }
// the order new words are met in: mostly words of her CURRENT level (discovery!), now and then one left over from an easier level
function wordQueue() {
  const d = DATA[S.lang], lv = wordLevel(), all = wordsNow();
  if (lv < 2) return all;
  const cut = d.tiers[lv - 2], low = all.slice(0, cut), top = all.slice(cut);
  return Math.random() < .3 ? all : [...top, ...low];
}
// Caught a lucky guess: she "knew" this word but could not read it inside a sentence → it goes back to practice (once, quietly)
function forgetWord(id) {
  if (!isKnown('blend', id)) return;
  for (const s of WORD_SETS) { const k = bkey(s, id); if ((S.boxes[k] || 0) >= 5 || s === 'blend') { S.boxes[k] = 1; S.due[k] = today(); } }
  tally('caught'); diary('caught', 'blend', id);
}
// A fresh pick: something not used yet TODAY by this activity (same language). Only once every item has had a turn
// does the list start over — so the same word (e.g. "vélo") doesn't keep coming back.
function pickFresh(key, list) {
  // remembered across days: each item is used once before any repeats
  S.used = S.used || {}; delete S.used.day;
  const k = S.lang + ':' + key, used = S.used[k] = S.used[k] || [];
  let pool = list.filter(x => !used.includes(x.id)); if (!pool.length) { used.length = 0; pool = list; }
  const it = pick(pool); used.push(it.id); save(); return it;
}
// words she hasn't yet shown she knows (falls back to all of them if she knows every word at this level)
const notKnown = list => { const l = list.filter(w => !isKnown('blend', w.id)); return l.length ? l : list; };
function knownWords() {
  // only "things" (a cat, a ship): words like "red" or "run" don't fit the "I see a …" sentences
  const k = DATA[S.lang].words.filter(w => !w.x && WORD_SETS.some(s => boxOf(s, w.id) > 0));
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
  { id: 'castle', icon: '👑', en: 'Reached Story Castle', fr: 'Arrivée au château', ok: () => ['en', 'fr'].some(lg => stageOf(lg) >= 6) },
  { id: 'explore5', icon: '🔭', en: 'Discovered 5 new games', fr: '5 nouveaux jeux découverts', ok: () => tot('discover') >= 5 },
  { id: 'explore15', icon: '🚀', en: 'Great explorer (15 new games)', fr: 'Grande exploratrice (15 jeux)', ok: () => tot('discover') >= 15 },
  { id: 'chat5', icon: '💬', en: 'Chatterbox (5 chats with Tiko)', fr: 'Bavarde (5 discussions avec Tiko)', ok: () => tot('chats') >= 5 },
  { id: 'books3', icon: '📚', en: 'Read 3 little books', fr: 'Lu 3 petits livres', ok: () => tot('books') >= 3 },
  { id: 'aloud5', icon: '🎤', en: 'Read aloud 5 times', fr: 'Lu à voix haute 5 fois', ok: () => tot('readAloud') >= 5 },
  { id: 'sci5', icon: '🔭', en: '5 science discoveries', fr: '5 découvertes en sciences', ok: () => tot('sciNew') >= 5 },
  { id: 'planets', icon: '🪐', en: 'Visited the Sun, the Moon and every planet', fr: 'Visité le Soleil, la Lune et toutes les planètes', ok: () => typeof sciAllPlanets === 'function' && sciAllPlanets() },
  { id: 'rocket3', icon: '🚀', en: '3 rocket flights', fr: '3 vols en fusée', ok: () => tot('rockets') >= 3 },
  { id: 'skies', icon: '✨', en: 'Joined every star picture', fr: "Relié tous les dessins d'étoiles", ok: () => typeof sciAllSkies === 'function' && sciAllSkies() },
  { id: 'think5', icon: '🧠', en: '5 thinking games', fr: '5 jeux de réflexion', ok: () => tot('think') >= 5 },
  { id: 'simon5', icon: '🎶', en: 'Copied 5 in a row', fr: 'Imité 5 à la suite', ok: () => tot('simon5') >= 1 },
  { id: 'puzzle3', icon: '🧩', en: '3 jigsaws done', fr: '3 puzzles finis', ok: () => tot('puzzles') >= 3 },
  { id: 'art1', icon: '🖌️', en: 'My first artwork', fr: 'Ma première œuvre', ok: () => tot('art') >= 1 },
  { id: 'song1', icon: '🎵', en: 'Played a whole song', fr: 'Joué une chanson entière', ok: () => tot('songs') >= 1 },
  { id: 'cbn3', icon: '🖍️', en: 'Coloured 3 pictures', fr: 'Colorié 3 images', ok: () => tot('cbn') >= 3 },
  { id: 'art10', icon: '🎨', en: '10 artworks', fr: '10 œuvres d’art', ok: () => tot('art') >= 10 },
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
  // a skill got harder: celebrate it so the progress is visible
  const ups = (S.levelUps || []).splice(0); save();
  for (const [a, n] of ups.slice(-2)) if (ACTS[a]) await celebrate(`<div class="prize">${ACTS[a].icon}</div><div class="lvlstars">${'⭐'.repeat(n)}</div>`, L().lvl.up, L().lvl.now(actName(a), n));
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
const MATH_MAX = { count: 3, add: 5, sub: 5, money: 3, groups: 3, bonds: 2, next: 3, compare: 3, shapes: 3, patterns: 3, clock: 3, doubles: 2,
  missing: 3, skip: 3, tens: 3, measure: 3, flash: 3, pop: 3, mathStory: 2 };
function gradeMath(a, first, max = MATH_MAX[a] || 3) { if (first) tally('mathOk'); gradeLevel(a, first, max); }
const THINK_MAX = { memory: 6, simon: 3, kim: 3, odd: 2, jigsaw: 3 };
// levels go up after 3 first-try successes in a row (she moves on instead of staying on easy things), down after 3 misses
function gradeLevel(a, first, max = THINK_MAX[a] || MATH_MAX[a] || 3) {
  const st = S.streak[a] = S.streak[a] || { ok: 0, bad: 0 };
  if (first) { st.ok++; st.bad = Math.max(0, st.bad - 1); } else { st.bad++; st.ok = 0; }
  if (st.ok >= 3 && lvl(a) < max) { S.levels[a] = lvl(a) + 1; st.ok = 0; st.bad = 0; (S.levelUps = S.levelUps || []).push([a, S.levels[a]]); }
  if (st.bad >= 3 && lvl(a) > 1) { S.levels[a] = lvl(a) - 1; st.ok = 0; st.bad = 0; }
}
function numOpts(ans, min, max, n = 3) {
  const set = new Set([ans]); const c = shuffle([ans - 1, ans + 1, ans - 2, ans + 2, ans + 3, ans - 3]);
  for (const x of c) { if (set.size >= n) break; if (x >= min && x <= max) set.add(x); }
  return shuffle([...set]).map(v => ({ html: v, val: v }));
}
function objsHTML(n, e, { crossed = 0, offset = 0, away = 0 } = {}) {
  let h = '<div class="objs">';
  for (let g = 0; g < n; g += 5) {
    h += '<div class="five">';
    for (let i = g; i < Math.min(n, g + 5); i++) h += `<span class="obj ${i >= n - crossed ? 'x' : ''} ${i >= n - away ? 'away' : ''}" style="--i:${i + offset}">${e}</span>`;
    h += '</div>';
  }
  return h + '</div>';
}
// Counting cue: tapping an object puts a ✓ tick on it (tap again to untick). No number is spoken —
// she counts herself; the ticks just help her keep track of what she has counted.
function tapToCount(root) {
  $$('.obj', root).forEach(o => {
    if (o.dataset.tick) return; o.dataset.tick = '1';
    o.addEventListener('pointerdown', () => {
      if (o.classList.contains('gone') || o.classList.contains('away') || o.classList.contains('x') || !o.closest('.ticking')) return;
      o.classList.toggle('ticked'); sfx('tap');
    });
  });
  $$('.objs', root).forEach(g => g.closest('.basket, .visual') && g.closest('.basket, .visual').classList.add('ticking'));
}
// Tiko models counting: ticks each object in turn and says the number (used for demos and after two misses)
async function autoCount(objs) {
  const tok = speakToken;   // stops if she leaves or Tiko moves on
  objs.forEach(o => o.classList.remove('ticked'));
  for (const [i, o] of objs.entries()) {
    if (tok !== speakToken) return;
    o.classList.add('ticked', 'pulse1'); sfx('tap'); await say(String(i + 1), S.lang, 1.05); o.classList.remove('pulse1');
  }
}
const liveObjs = r => $$('.obj', r).filter(o => !o.classList.contains('gone') && !o.classList.contains('away') && !o.classList.contains('x') && !o.classList.contains('ghost'));

// ================= activities =================
const ACTS = {
  letters: { icon: '🔤', area: 'read', make: mkLetters },
  sight: { icon: '✨', area: 'read', make: mkSight },
  robot: { icon: '👂', area: 'read', make: mkFirstSound },   // key kept from the old Robot talk, so her play history carries over
  blend: { icon: '🧩', area: 'read', make: mkBlend },
  family: { icon: '🏠', area: 'read', make: mkFamily },
  spell: { icon: '🧱', area: 'read', make: mkSpell },
  trace: { icon: '✍️', area: 'read', make: mkTrace, per: 2 },
  paper: { icon: '📝', area: 'read', make: mkPaperRead, per: 2 },
  traceWord: { icon: '👂', area: 'read', make: mkTraceWord, per: 2 },
  traceSentence: { icon: '📜', area: 'read', make: mkTraceSentence, per: 1 },
  sentence: { icon: '🛶', area: 'read', make: mkSentence, per: 4 },
  story: { icon: '🏰', area: 'read', make: mkStory, per: 2 },
  readAloud: { icon: '🎤', area: 'read', make: mkReadAloud, per: 2 },
  books: { icon: '📚', area: 'read', studio: () => library() },
  count: { icon: '🔢', area: 'math', make: mkCount },
  add: { icon: '➕', area: 'math', make: mkAdd },
  sub: { icon: '➖', area: 'math', make: mkSub },
  bonds: { icon: '🔟', area: 'math', make: mkBonds },
  next: { icon: '➡️', area: 'math', make: mkNext },
  compare: { icon: '⚖️', area: 'math', make: mkCompare },
  shapes: { icon: '🔷', area: 'math', make: mkShapes },
  patterns: { icon: '🔁', area: 'math', make: mkPatterns },
  clock: { icon: '🕐', area: 'math', make: mkClock },
  doubles: { icon: '🦋', area: 'math', make: mkDoubles },
  missing: { icon: '❓', area: 'math', make: mkMissing },
  skip: { icon: '🐸', area: 'math', make: mkSkip },
  tens: { icon: '🧱', area: 'math', make: mkTens },
  money: { icon: '🪙', area: 'math', make: mkMoney },
  groups: { icon: '🧺', area: 'math', make: mkGroups },
  measure: { icon: '📏', area: 'math', make: mkMeasure },
  flash: { icon: '⚡', area: 'math', make: mkFlash },
  pop: { icon: '🫧', area: 'math', make: mkPop, per: 3 },
  mathStory: { icon: '📖', area: 'math', make: mkMathStory, per: 4 },
  traceNum: { icon: '✏️', area: 'math', make: mkTraceNum, per: 2 },
  memory: { icon: '🃏', area: 'think', make: mkMemory, per: 2 },
  simon: { icon: '🎶', area: 'think', make: mkSimon, per: 1 },
  kim: { icon: '🙈', area: 'think', make: mkKim, per: 4 },
  odd: { icon: '🔍', area: 'think', make: mkOdd, per: 5 },
  jigsaw: { icon: '🧩', area: 'think', make: mkJigsaw, per: 2 },
  paint: { icon: '🖌️', area: 'art', studio: () => paintStudio({}) },
  mirror: { icon: '🦋', area: 'art', studio: () => paintStudio({ mirror: true }) },
  readDraw: { icon: '✏️', area: 'art', studio: () => paintStudio({ word: true }) },
  cbn: { icon: '🖍️', area: 'art', studio: () => colourByNumber() },
  mix: { icon: '🧪', area: 'art', make: mkMix, per: 4 },
  music: { icon: '🎵', area: 'art', studio: () => musicStudio() },
  paperMath: { icon: '📒', area: 'math', make: mkPaperMath, per: 2 },
  // the science track lives in science.js (pure curiosity: nothing is graded)
  space: { icon: '🪐', area: 'sci', studio: () => spaceExplorer() },
  rocket: { icon: '🚀', area: 'sci', studio: () => rocketLaunch() },
  constel: { icon: '✨', area: 'sci', studio: () => starPictures() },
  zoom: { icon: '🔭', area: 'sci', studio: () => zoomOut() },
  wonder: { icon: '💡', area: 'sci', studio: () => wonderCards() },
};
const actName = id => L().acts[id] || (id === 'traceNum' ? L().paper.trace.replace(/!.*/, '') + ' 123' : id === 'paperMath' ? '📝 ' + L().maths : '');
// fill names that are not in T
T.en.acts.trace = 'Trace letters'; T.fr.acts.trace = 'Tracer les lettres';
T.en.acts.paper = 'Paper mission'; T.fr.acts.paper = 'Mission papier';
T.en.acts.traceNum = 'Trace numbers'; T.fr.acts.traceNum = 'Tracer les nombres';
T.en.acts.paperMath = 'Paper maths'; T.fr.acts.paperMath = 'Maths sur papier';
Object.assign(T.en.acts, { shapes: 'Shapes', patterns: 'Patterns', clock: 'Tell the time', doubles: 'Doubles', missing: 'Missing number',
  skip: 'Frog jumps', tens: 'Tens and ones', measure: 'Measuring', flash: 'Quick look', pop: 'Bubble pop', mathStory: 'Maths stories' });
Object.assign(T.fr.acts, { shapes: 'Les formes', patterns: 'Les suites', clock: "Lire l'heure", doubles: 'Les doubles', missing: 'Le nombre caché',
  skip: 'Sauts de grenouille', tens: 'Dizaines et unités', measure: 'Mesurer', flash: 'Coup d’œil', pop: 'Éclate les bulles', mathStory: 'Histoires de maths' });
Object.assign(T.en.acts, { memory: 'Memory pairs', simon: 'Copy me', kim: "What's missing?", odd: 'Odd one out', jigsaw: 'Jigsaw' });
Object.assign(T.fr.acts, { memory: 'Les paires', simon: 'Imite-moi', kim: "Qu'est-ce qui manque ?", odd: "L'intrus", jigsaw: 'Puzzle' });
Object.assign(T.en.acts, { robot: 'Same sound', family: 'Word families' });
Object.assign(T.fr.acts, { robot: 'Le même son', family: 'Les syllabes' });
Object.assign(T.en.acts, { traceWord: 'Listen and trace a word', traceSentence: 'Listen and trace a sentence' });
Object.assign(T.fr.acts, { traceWord: 'Écoute et trace un mot', traceSentence: 'Écoute et trace une phrase' });
Object.assign(T.en.acts, { paint: 'Paint', mirror: 'Magic mirror', readDraw: 'Read and draw', cbn: 'Colour by number', mix: 'Mix colours', music: 'Music' });
Object.assign(T.fr.acts, { paint: 'Peinture', mirror: 'Miroir magique', readDraw: 'Lis et dessine', cbn: 'Coloriage magique', mix: 'Mélange les couleurs', music: 'Musique' });
T.en.acts.sentence = 'Read a sentence'; T.fr.acts.sentence = 'Lire une phrase';
T.en.acts.story = 'Little stories'; T.fr.acts.story = 'Petites histoires';
T.en.acts.readAloud = 'Read it to Tiko'; T.fr.acts.readAloud = 'Lis-le à Tiko';
T.en.acts.books = 'Little books'; T.fr.acts.books = 'Petits livres';
T.en.sciName = 'Science'; T.fr.sciName = 'Sciences';
Object.assign(T.en.acts, { space: 'Space explorer', rocket: 'Rocket launch', zoom: 'Zoom out!', wonder: 'I wonder…', constel: 'Star pictures' });
Object.assign(T.fr.acts, { space: "Explore l'espace", rocket: 'Décollage de fusée', zoom: 'Recule, recule !', wonder: 'Je me demande…', constel: "Dessins d'étoiles" });

// ================= discovery path =================
// Parent's wish: she tends to replay the same easy things. Tiko steers her FORWARD instead, building on what she
// already knows: an activity she has mastered (or already played twice today) rests, and new ones she is ready for sparkle.
T.en.disc = { rest: "You did this one today! Let's discover something new!", mastered: "You're a champion at this one! Let's try something new!",
  conquered: "You conquered this place! Let's keep going forward!", path: "Let's go on today's adventure!" };
T.fr.disc = { rest: "Tu l'as déjà fait aujourd'hui ! Découvrons autre chose !", mastered: 'Tu es championne ! Essayons quelque chose de nouveau !',
  conquered: 'Tu as conquis cet endroit ! Allons plus loin !', path: "Allons à l'aventure du jour !" };
// the journey place from which each reading activity makes sense (builds on the one before)
const READ_UNLOCK = { letters: 0, robot: 0, blend: 0, trace: 0, sight: 0, paper: 1, traceWord: 1, family: 1, spell: 1, sentence: 3, traceSentence: 3, story: 5, readAloud: 1, books: 1 };
const playKey = a => S.lang + ':' + a;
function recordPlay(a) {
  S.plays = S.plays || {};
  const p = S.plays[playKey(a)] = S.plays[playKey(a)] || { total: 0, day: '', n: 0 };
  if (!p.total) tally('discover');
  p.total++; if (p.day !== today()) { p.day = today(); p.n = 0; } p.n++; save();
}
const playsToday = a => { const p = (S.plays || {})[playKey(a)]; return p && p.day === today() ? p.n : 0; };
const playedEver = a => ((S.plays || {})[playKey(a)] || {}).total || 0;
// too easy for her now: she has moved past it on the journey, or reached the top level and keeps getting it right
function mastered(a) {
  const st = stageOf();
  if (a === 'letters') return st >= 2 || frac(S.lang, 'letter', DATA[S.lang].letters) >= 1;
  if (a === 'trace') return st >= 2;            // she traces words and sentences by then
  if (a === 'robot') return st >= 3;            // listening-only blending is behind her
  if (a === 'sight') return frac(S.lang, 'sight', DATA[S.lang].sight) >= 1;
  const max = MATH_MAX[a] || THINK_MAX[a];
  if (max) return lvl(a) >= max && ((S.streak[a] || {}).ok || 0) >= 3;
  return false;
}
// Tracks a parent can hide (parent corner → "What she sees"). Hidden = not on the home screen and not on the daily path.
const AREAS = ['read', 'math', 'art', 'think', 'sci'];
const TRACKS = [['read', '📖', 'Reading'], ['math', '🔢', 'Maths'], ['sci', '🚀', 'Science'], ['art', '🎨', 'Art'], ['think', '🧠', 'Thinking'],['journey', '🗺️', 'My journey (the reading map)'], ['stickers', '🌟', 'My stickers'], ['chat', '💬', 'Chat with Tiko']];
const hid = k => !!(S.settings.hide || {})[k];
const readyFor = a => ACTS[a].area !== 'read' || (READ_UNLOCK[a] ?? 9) <= stageOf();
function actState(a) {
  if (!S.settings.discovery) return 'open';
  if (mastered(a)) return 'mastered';
  if (playsToday(a) >= 2) return 'rest';
  return !playedEver(a) && readyFor(a) ? 'new' : 'open';
}
// what Tiko suggests next in a menu: something new she is ready for, else what she has played least
function suggestIn(area) {
  const ids = Object.keys(ACTS).filter(k => ACTS[k].area === area && readyFor(k));
  const nw = ids.find(k => actState(k) === 'new'); if (nw) return nw;
  const op = ids.filter(k => actState(k) === 'open').sort((x, y) => playsToday(x) - playsToday(y) || playedEver(x) - playedEver(y));
  return op[0] || null;
}
// on the daily path, a mastered stop is swapped for a fresh one from the same area (new ones first)
function freshen(stops) {
  if (!S.settings.discovery) return stops;
  const out = [];
  for (const a of stops) {
    if (!ACTS[a] || !mastered(a)) { out.push(a); continue; }
    const pool = Object.keys(ACTS).filter(k => ACTS[k].area === ACTS[a].area && !mastered(k) && readyFor(k) && !out.includes(k) && !stops.includes(k));
    out.push(pool.length ? (pool.find(k => !playedEver(k)) || pick(pool)) : a);
  }
  return out;
}

function mkSentence() {
  const R = L().read, known = knownWords(), w = pickFresh('sentence', known);
  // from Long Vowel Lagoon on, half the sentences have two things to read; the answer is a PAIR of pictures,
  // and the wrong pairs share one picture, so both words really have to be read
  if (stageOf() >= 5 && Math.random() < .5) {
    const pool = shuffle(known.filter(x => x.e !== w.e)), b = pool[0];
    const c = pool.find(x => x.e !== b.e) || DATA[S.lang].words.find(x => x.e !== w.e && x.e !== b.e);
    const d = DATA[S.lang].words.find(x => ![w.e, b.e, c.e].includes(x.e));
    const s = pick(SENTENCES2[S.lang])(w.w, b.w);
    const pair = (p, q2) => ({ html: `<span class="pair">${p.e}${q2.e}</span>`, val: p.w + '+' + q2.w });
    return { kind: 'sentence', title: R.find, speak: [R.find], lines: [s], optClass: '',
      options: shuffle([pair(w, b), pair(w, c), pair(d, b)]), answer: w.w + '+' + b.w, correctSpeak: [s],
      onMiss: r => cueWords(r, [w.w, b.w]), retrySpeak: [{ seq: soundsOf(w), gap: 330 }, { pause: 400 }, { seq: soundsOf(b), gap: 330 }],
      // a wrong pair shows which of the two words she could not read
      grade(f) { if (f) bumpCount('sentence'); else (this.wrong || []).forEach(v => { const [p, q2] = v.split('+'); if (p !== w.w) forgetWord(w.id); if (q2 !== b.w) forgetWord(b.id); }); } };
  }
  const s = pickFresh('sentenceT', SENTENCES[S.lang].map((f, i) => ({ id: i, f }))).f(w.w);
  return { kind: 'sentence', title: R.find, speak: [R.find], lines: [s], optClass: '',
    options: pictureOptions(w, DATA[S.lang].words), answer: w.w, correctSpeak: [s],
    // after a miss: the word that matters pulses and Tiko says its sounds one by one (she still blends it herself)
    onMiss: r => cueWords(r, [w.w]), retrySpeak: [{ seq: soundsOf(w), gap: 330 }],
    grade: f => { if (f) bumpCount('sentence'); else forgetWord(w.id); } };
}
const soundsOf = w => w.units.filter(u => !u.startsWith('_'));
function cueWords(root, words) {
  $$('.reader .w', root).forEach(s => { const t = (s.dataset.w || '').toLowerCase().replace(/^(l'|d')/, ''); if (words.some(x => t === x.toLowerCase())) s.classList.add('cue'); });
}
function mkStory() {
  const R = L().read, ws = shuffle(knownWords()), A = pickFresh('story', ws), B = ws.find(x => x.e !== A.e);
  const st = pickFresh('storyT', STORIES[S.lang].map((f, i) => ({ id: i, f }))).f(A.w, B.w), ans = st.answer === 'A' ? A : B;
  const C = shuffle(DATA[S.lang].words.filter(x => x.e !== A.e && x.e !== B.e))[0];
  return { kind: 'story', title: R.story, speak: [R.story], lines: st.lines, q: st.q, optClass: '',
    options: shuffle([A, B, C]).map(x => ({ html: x.e, val: x.w })), answer: ans.w, correctSpeak: [ans.w],
    // after a miss: the line of the story that holds the answer lights up, so she knows where to read again
    onMiss: r => [].concat(st.cue == null ? [] : st.cue).forEach(i => { const p = $$('.reader p', r)[i]; if (p) p.classList.add('cue'); }),
    grade: f => { if (f) bumpCount('story'); } };
}

function mkLetters() {
  const d = DATA[S.lang], q = L().q;
  const { item, isNew } = chooseItem('letter', d.letters);
  // never two letters that make the same sound (c/k, or c/k/q in French) in one question
  const opts = shuffle([item, ...shuffle(d.letters.filter(x => x.l !== item.l && x.s !== item.s)).slice(0, 2)]);
  return {
    title: isNew ? `${L().newLetter}…` : `${q.letter}…?`,
    speak: isNew ? [L().newLetter, { unit: item.l }, q.like, item.k, { pause: 200 }, q.tapItL] : [q.letter, { unit: item.l }, q.like, item.k],
    visual: `<div class="pic bob">${item.e}</div>`,
    options: opts.map(x => ({ html: `<span class="glyph">${esc(x.l)}</span>`, val: x.l })), answer: item.l,
    correctSpeak: [{ unit: item.l }, item.k],
    grade: f => gradeItem('letter', item.id, f, isNew),
  };
}
function mkSight() {
  const d = DATA[S.lang], q = L().q;
  const { item, isNew } = chooseItem('sight', d.sight);
  const opts = shuffle([item, ...shuffle(d.sight.filter(x => x.w !== item.w)).slice(0, 2)]);
  return {
    title: isNew ? `${q.newWord}…` : `${q.findWord} 👂`,
    speak: isNew ? [q.newWord, item.w, { pause: 200 }, q.tapIt] : [q.findWord, { pause: 150 }, item.w],
    visual: '', optClass: 'word',
    options: opts.map(x => ({ html: esc(x.w), val: x.w })), answer: item.w,
    correctSpeak: [item.w], grade: f => gradeItem('sight', item.id, f, isNew),
  };
}
function unitsHTML(units, cls = '') {
  return `<div class="units">${units.map((u, i) => `<button class="unit ${cls} ${u.startsWith('_') ? 'silent' : ''}" data-i="${i}" style="--i:${i}">${esc(unitText(u))}</button>`).join('')}</div>`;
}
// three pictures: the answer + two others whose pictures differ (e.g. tub & bath share 🛁)
function pictureOptions(item, pool) {
  const others = [];
  for (const x of shuffle(pool)) if (x.e !== item.e && !others.some(o => o.e === x.e)) { others.push(x); if (others.length === 2) break; }
  return shuffle([item, ...others]).map(x => ({ html: x.e, val: x.w }));
}
// Slide-to-blend: dragging along the arrow plays each sound as the finger passes under its tile,
// so a quick slide runs the sounds together — the physical feeling of blending.
function blendSlider(root, units, onDone, players = []) {
  const playTile = i => players[i] ? players[i]() : (!units[i].startsWith('_') && playUnit(units[i], S.lang, 1.1));
  // Child-friendly: she can slide anywhere along the word (over the tiles OR the big arrow); lifting her finger
  // keeps her progress; simply TAPPING the arrow slides it for her. Sounds always play in order (they're queued).
  const tiles = $$('.units .unit', root), sl = $('.slider', root), knob = $('.knob', sl), area = $('.blendbox', root) || sl;
  const played = new Set(); let dragging = false, finished = false, startX = 0, moved = 0, onTile = -1, maxX = 0;
  const tileX = i => { const tr = tiles[i].getBoundingClientRect(); return tr.left + tr.width / 2; };
  const reach = clientX => {
    const r = sl.getBoundingClientRect();
    maxX = Math.max(maxX, Math.max(0, Math.min(r.width, clientX - r.left)));
    knob.style.left = maxX + 'px';
    // tiles play strictly left to right, however fast or messy the slide is
    for (let i = 0; i < tiles.length; i++) {
      if (played.has(i)) continue;
      if (clientX < tileX(i) - 6) break;
      played.add(i); tiles[i].classList.add('lit'); playTile(i);
    }
    if (!finished && played.size === tiles.length && maxX >= r.width * .75) finish();
  };
  const finish = () => { finished = true; knob.style.left = sl.getBoundingClientRect().width + 'px'; sl.classList.add('done'); onDone(); };
  // tap on the arrow (no real slide) = Tiko slides it for her, sound by sound
  const autoSlide = async () => {
    const r = sl.getBoundingClientRect();
    for (let i = 0; i < tiles.length && !finished; i++) { reach(tileX(i) + 1); await sleep(380); }
    if (!finished) reach(r.right);
  };
  area.addEventListener('pointerdown', e => {
    if (finished) return;
    onTile = tiles.findIndex(t => t.contains(e.target));
    dragging = true; startX = e.clientX; moved = 0;
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  area.addEventListener('pointermove', e => {
    if (!dragging || finished) return;
    moved = Math.max(moved, Math.abs(e.clientX - startX));
    if (moved > 14) reach(e.clientX);
  });
  const up = e => {
    if (!dragging) return; dragging = false;
    if (finished || moved > 14) return;
    if (onTile >= 0) { stopSpeech(); playTile(onTile); tiles[onTile].classList.add('lit'); const k = onTile; setTimeout(() => !finished && !played.has(k) && tiles[k].classList.remove('lit'), 600); }
    else if (sl.contains(e.target) || e.clientY >= sl.getBoundingClientRect().top - 20) autoSlide();
  };
  area.addEventListener('pointerup', up); area.addEventListener('pointercancel', () => { dragging = false; });
}
const sliderHTML = () => `<div class="slider"><div class="arrow"></div><span class="knob">👉</span></div>`;
// on a correct answer the tiles glide together into one word
const mergeTiles = r => { const u = $('.units', r); if (u) u.classList.add('merged'); };
function mkBlend() {
  const q = L().q;
  const { item, isNew } = chooseItem('blend', wordQueue());
  const sounds = item.units.filter(u => !u.startsWith('_'));
  return {
    title: q.blend, speak: [q.blend], gate: true,
    visual: `<div class="blendbox">${unitsHTML(item.units)}${sliderHTML()}</div>`,
    options: pictureOptions(item, wordsNow()), answer: item.w,
    // first miss: hear the sounds again, fast, so they run together
    retrySpeak: [L().bl.sayFast, { seq: sounds, gap: 330 }],
    correctSpeak: [{ seq: sounds, gap: 300 }, item.w], grade: f => gradeItem('blend', item.id, f, isNew), onCorrect: mergeTiles,
    setup(root, unlock) { blendSlider(root, item.units, async () => { unlock(); await unitChain; speak(q.whichPic); }); },   // let every sound finish first
  };
}
// 👂 Same first sound (took the place of Robot talk in v36, whose single-sound clips were not clear on the tablet).
// Listening only, and WHOLE WORDS only, said by the normal voice: Tiko says a word, names the three pictures one by one
// (each lights up as it is named), and she finds the one that starts with the same sound. No isolated sounds anywhere.
const SND_SAME = { c: 'k', ck: 'k', q: 'kw' };
// sounds too close to tell apart by ear are never offered against each other (s/z, m/n, b/p, d/t, g/k, f/v/th…)
const SND_GROUP = { s: 1, z: 1, sh: 2, ch: 2, j: 2, m: 3, n: 3, b: 4, p: 4, d: 5, t: 5, g: 6, k: 6, kw: 6, f: 7, v: 7, th: 7 };
// the sound a word starts with ('' = not usable here; French vowels are all 'V' and are only ever wrong choices)
function firstSound(w, lg = S.lang) {
  if (lg === 'fr') {
    const s = w.w.toLowerCase();
    if (/^[hxwy]/.test(s)) return '';
    if (/^[aeiouàâéèêëîïôûœ]/.test(s)) return 'V';
    if (s.startsWith('ch')) return 'ch'; if (s.startsWith('ph')) return 'f';
    if (/^(c[eiyéèê]|ç)/.test(s)) return 's'; if (/^[ckq]/.test(s)) return 'k';
    if (/^g[eiyéèê]/.test(s)) return 'j';
    return s[0];
  }
  const s = unitSound(w.units.find(u => !u.startsWith('_')));
  return SND_SAME[s] || s;
}
const sndGroup = s => /^[aeiouV]/.test(s) ? 'V' : SND_GROUP[s] || s;
// the letters that write the first sound (shown only once she has found the answer)
const headLen = (w, lg) => lg === 'fr' ? (/^(ch|ph|qu|gu)/.test(w.w) ? 2 : 1) : unitText(w.units[0]).length;
function mkFirstSound() {
  const lg = S.lang, all = wordsNow().filter(w => firstSound(w, lg));
  const matesOf = w => all.filter(x => x.e !== w.e && x.w !== w.w && firstSound(x, lg) === firstSound(w, lg));
  const ok = w => firstSound(w, lg) && firstSound(w, lg) !== 'V' && matesOf(w).length;
  let pool = wordQueue().filter(ok); if (!pool.length) pool = all.filter(ok);
  const { item } = chooseItem('first', pool);
  const mate = pick(matesOf(item)), g = sndGroup(firstSound(item, lg)), others = [];
  for (const x of shuffle(all)) { if (others.length === 2) break; if (sndGroup(firstSound(x, lg)) !== g && ![item, mate, ...others].some(o => o.e === x.e)) others.push(x); }
  const opts = shuffle([mate, ...others]);
  const light = i => $$('.options .opt').forEach((b, j) => b.classList.toggle('say', j === i));
  const names = [...opts.flatMap((o, i) => [{ run: () => light(i) }, o.w, { pause: 250 }]), { run: () => light(-1) }];
  const written = w => `<span><b>${esc(w.w.slice(0, headLen(w, lg)))}</b>${esc(w.w.slice(headLen(w, lg)))}</span>`;
  return {
    title: '👂 ' + L().bl.firstT, speak: [L().bl.first(item.w), { pause: 250 }, ...names],
    visual: `<div class="fsbox"><div class="pic bob">${item.e}</div><div class="fsw"></div></div>`,
    options: opts.map(x => ({ html: x.e, val: x.w })), answer: mate.w,
    retrySpeak: [item.w, { pause: 350 }, ...names],
    correctSpeak: [item.w, { pause: 150 }, mate.w], grade: f => gradeItem('first', item.id, f),
    // only now the two words are written, with the letters of the shared sound lit: the ear first, then the eye
    onCorrect(root) { light(-1); const b = $('.fsw', root); if (b) { b.innerHTML = written(item) + written(mate); b.classList.add('on'); } },
  };
}
// 🏠 Word families (English): only the first sound changes — cat, hat, bat, rat.
// Syllables (French, méthode syllabique): m + a → ma; find the syllable Tiko says.
const FAMILIES = { at: ['cat', 'hat', 'bat', 'rat'], en: ['hen', 'pen', 'ten'], ox: ['fox', 'box'], an: ['van', 'pan', 'can', 'man'], ug: ['bug', 'mug', 'hug'],
  ap: ['map', 'cap', 'tap', 'zap'], et: ['net', 'jet'], ag: ['bag', 'tag'], un: ['sun', 'run'], in: ['bin', 'pin', 'win'], ot: ['pot', 'hot'],
  og: ['dog', 'log'], ig: ['pig', 'dig'], ed: ['bed', 'red'], ix: ['six', 'fix'], ad: ['sad', 'mad'], ut: ['nut', 'hut', 'cut'],
  ell: ['bell', 'shell'], ing: ['king', 'ring', 'sing'], ip: ['lip', 'ship'], ock: ['sock', 'lock', 'rock'], ill: ['pill'], ish: ['fish', 'dish', 'wish'],
  ark: ['park', 'shark'], eep: ['sheep', 'jeep'], ook: ['book', 'hook', 'cook'], ake: ['cake'], ain: ['rain', 'chain'], ail: ['nail', 'mail'],
  oat: ['boat', 'goat', 'coat'], ight: ['night', 'light'], ose: ['rose', 'nose'], each: ['peach', 'beach'], oy: ['boy', 'toy'], aw: ['saw', 'paw'] };
const famOf = w => Object.values(FAMILIES).find(l => l.length >= 2 && l.includes(w));
function mkFamily() {
  if (S.lang === 'fr') {
    const c = pick(['m', 'l', 'p', 't', 'r', 's', 'v', 'n', 'b', 'd', 'f']), vs = shuffle(['a', 'i', 'o', 'u', 'é']), v = vs[0];
    const syl = c + v, opts = Math.random() < .5 ? vs.slice(0, 3).map(x => c + x) : [syl, ...shuffle(['m', 'l', 'p', 't', 'r', 's'].filter(x => x !== c)).slice(0, 2).map(x => x + v)];
    return { title: `${L().bl.findSyl} « ${syl} »`, speak: [L().bl.findSyl, { pause: 150 }, syl], optClass: 'word',
      visual: `<div class="units merged-demo"><span class="unit lit">${c}</span><span class="sign">+</span><span class="unit lit">${v}</span></div>`,
      options: shuffle(opts).map(s => ({ html: s, val: s })), answer: syl, correctSpeak: [{ unit: c }, syl],
      grade: f => gradeItem('syl', syl, f) };
  }
  const words = DATA.en.words, byW = w => words.find(x => x.w === w);
  // a word she doesn't know yet (at her level) comes first — the same rule as everywhere: no repeats of what she knows
  let pool = wordQueue().filter(w => famOf(w.w)); if (!pool.length) pool = words.filter(w => famOf(w.w));
  const item = chooseItem('fam', pool).item, ws = famOf(item.w), onset = item.units[0], rimeUnits = item.units.slice(1), rime = item.w.slice(unitText(onset).length);
  // choices: other words from the same family first (cat vs hat vs bat — only the first sound tells them apart)
  const fam = shuffle(ws.filter(w => w !== item.w).map(byW)), others = [];
  for (const x of [...fam, ...shuffle(words)]) if (x.e !== item.e && !others.some(o => o.e === x.e)) { others.push(x); if (others.length === 2) break; }
  const runRime = () => playRun(rimeUnits, 240);
  return {
    title: `🏠 -${rime}`, speak: [L().bl.familyIntro, { seq: rimeUnits, gap: 280 }, { pause: 200 }, L().bl.slideNow], gate: true,
    visual: `<div class="blendbox"><div class="famhouse">🏠 <b>-${esc(rime)}</b></div>
      <div class="units"><button class="unit onset">${esc(unitText(onset))}</button><button class="unit rime">${esc(rime)}</button></div>${sliderHTML()}</div>`,
    options: shuffle([item, ...others]).map(x => ({ html: x.e, val: x.w })), answer: item.w,
    retrySpeak: [L().bl.sayFast, { seq: [onset, ...rimeUnits], gap: 330 }],
    correctSpeak: [{ seq: [onset, ...rimeUnits], gap: 300 }, item.w], grade: f => gradeItem('fam', item.id, f), onCorrect: mergeTiles,
    // the "-at" tile plays its sounds run together, as one chunk
    setup(root, unlock) { blendSlider(root, [onset, rimeUnits[0]], async () => { unlock(); await unitChain; speak(L().q.whichPic); }, [null, runRime]); },
  };
}
// play sound units one after another without interrupting other speech (used while sliding)
async function playRun(units) { for (const u of units) if (!u.startsWith('_')) await playUnit(u, S.lang, 1.15); }   // queued: back-to-back, never overlapping
async function speakQuick(u) { if (u.startsWith('_')) return sleep(150); await playUnit(u, S.lang, 1.15); }
function mkSpell() {
  const d = DATA[S.lang], q = L().q;
  const { item, isNew } = chooseItem('spell', wordQueue());
  const known = new Set(item.units.map(unitText));
  const pool = shuffle(d.words.flatMap(w => w.units.map(unitText))).filter(u => !known.has(u));
  const extra = [...new Set(pool)].slice(0, item.units.length <= 3 ? 2 : 1);
  return { kind: 'build', item, title: `${q.spell} ${item.e}`, speak: [q.spell, { pause: 100 }, item.w], tiles: shuffle([...item.units.map(unitText), ...extra]),
    grade: f => gradeItem('spell', item.id, f, isNew) };
}
function mkCount() {
  const max = [5, 10, 20][lvl('count') - 1], n = 1 + rand(max), e = pick(OBJECTS), q = L().q;
  return { title: `${q.howMany} ✓`, speak: [q.howMany, L().c.countAll.split('. ')[1] || ''], visual: `<div class="basket">${objsHTML(n, e)}</div>`, optClass: 'num',
    options: numOpts(n, 1, max + 2), answer: n, correctSpeak: [String(n)], setup: r => tapToCount(r), grade: f => gradeMath('count', f),
    explain: r => autoCount(liveObjs(r)) };
}
// ADDING = putting together. Two baskets; she presses "Put together" and the second group jumps into the
// first basket. Then she ticks and counts the whole group herself.
// Level 4 adding / taking away: bigger numbers (up to 30) on a number line. She taps the frog once per hop,
// so she still does the "adding on" / "counting back" herself, then reads where it landed.
function mkHop(op) {
  const C = L().c, q = L().q;
  let a, b;
  if (op === '+') { a = 8 + rand(13); b = 2 + rand(Math.min(8, 30 - a - 1)); } else { a = 12 + rand(19); b = 2 + rand(8); }
  const ans = op === '+' ? a + b : a - b, lo = Math.min(a, ans) - 2, hi = Math.max(a, ans) + 2;
  return { title: `${a} ${op === '+' ? '+' : '−'} ${b} = ?`, speak: [op === '+' ? C.hopAdd(a, b) : C.hopSub(a, b)], optClass: 'num', gate: true,
    visual: `<div class="addwrap"><div class="nline">${Array.from({ length: hi - lo + 1 }, (_, i) => `<span class="nl ${lo + i === a ? 'start' : ''}" data-n="${lo + i}">${lo + i}</span>`).join('')}
      <button class="nfrog" aria-label="hop">🐸</button></div><div class="takeaway">${'<span class="tdots">' + '<i></i>'.repeat(b) + '</span>'}</div></div>`,
    options: numOpts(ans, 0, 40), answer: ans, correctSpeak: [op === '+' ? C.addRule(a, b, ans) : C.subRule(a, b, ans)],
    grade: f => gradeMath(op === '+' ? 'add' : 'sub', f),
    setup(root, unlock) {
      let at = a, hops = 0;
      const frog = $('.nfrog', root), cellOf = n => $(`.nl[data-n="${n}"]`, root);
      const place = () => { const c = cellOf(at); frog.style.left = (c.offsetLeft + c.offsetWidth / 2) + 'px'; try { c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ } };
      requestAnimationFrame(place);
      // returns 'more' while hops remain, 'done' on the last hop, 'already' if she had finished
      root.__hop = async () => {
        if (hops >= b) return 'already';
        at += op === '+' ? 1 : -1; hops++; cellOf(at).classList.add('hopped');
        frog.classList.remove('jump'); void frog.offsetWidth; frog.classList.add('jump'); place(); sfx('pop');
        const d = $$('.tdots i', root)[hops - 1]; if (d) d.classList.add('on');
        if (hops === b) { await sleep(450); unlock(); $('.bubble').textContent = C.landed; return 'done'; }
        return 'more';
      };
      frog.onclick = async () => { if (await root.__hop() === 'done') speak(C.landed); };
    },
    // Tiko hops the rest of the way, saying each number she lands on
    explain: async r => { let s; do { s = await r.__hop(); if (s === 'more') await sleep(450); } while (s === 'more'); } };
}
function mkAdd(fixed) {
  if (!fixed && lvl('add') >= 5) return mkBig('+');
  if (!fixed && lvl('add') >= 4) return mkHop('+');
  const l = lvl('add'), max = [5, 10, 20][l - 1], C = L().c;
  let s = 2 + rand(max - 1), a = 1 + rand(Math.min(s - 1, 10)), b = s - a;
  if (fixed) [a, b, s] = [fixed[0], fixed[1], fixed[0] + fixed[1]];
  const e = pick(OBJECTS);
  return { title: `${a} + ${b} = ?`, speak: [C.addSay(a, b)], optClass: 'num', gate: true,
    visual: `<div class="addwrap"><div class="baskets"><div class="basket ba">${objsHTML(a, e)}</div><span class="sign">+</span>
      <div class="basket bb">${objsHTML(b, e, { offset: a })}</div></div><button class="btn sun together pulse">🤲 ${esc(C.together)}</button></div>`,
    options: numOpts(s, 0, max + 2), answer: s, correctSpeak: [C.addRule(a, b, s)], grade: f => gradeMath('add', f),
    setup(root, unlock) {
      let joined = false;
      root.__join = async () => {
        if (joined) return; joined = true; const btn = $('.together', root); if (btn) btn.remove();
        const bb = $('.bb', root), sign = $('.baskets .sign', root);
        bb.classList.add('flyin'); if (sign) sign.classList.add('fade'); sfx('pop');
        await sleep(550);
        $('.ba', root).innerHTML = objsHTML(s, e); bb.remove(); if (sign) sign.remove();
        $('.ba', root).classList.add('joined'); tapToCount(root); unlock();
      };
      $('.together', root).onclick = async () => { await root.__join(); speak(C.countAll); };
    },
    explain: async r => { await r.__join(); await autoCount(liveObjs(r)); } };
}
// TAKING AWAY = removing. She taps the right number of objects herself and they fly away, then she
// ticks and counts what is left.
function mkSub(fixed) {
  if (!fixed && lvl('sub') >= 5) return mkBig('-');
  if (!fixed && lvl('sub') >= 4) return mkHop('-');
  const l = lvl('sub'), max = [5, 10, 20][l - 1], C = L().c;
  let a = 2 + rand(max - 1), b = 1 + rand(a - 1);
  if (fixed) [a, b] = fixed;
  const r0 = a - b, e = pick(OBJECTS);
  return { title: `${a} − ${b} = ?`, speak: [C.subSay(a, b)], optClass: 'num', gate: true,
    visual: `<div class="addwrap"><div class="basket bs">${objsHTML(a, e)}</div>
      <div class="takeaway">${esc(C.takeLeft)} ${b}: <span class="tdots">${'<i></i>'.repeat(b)}</span></div></div>`,
    options: numOpts(r0, 0, max), answer: r0, correctSpeak: [C.subRule(a, b, r0)], grade: f => gradeMath('sub', f),
    setup(root, unlock) {
      let removed = 0, done = false;
      const takeOne = o => {
        o.classList.add('gone'); removed++; sfx('pop');
        const d = $$('.tdots i', root)[removed - 1]; if (d) d.classList.add('on');
        if (removed === b && !done) { done = true; $('.basket', root).classList.add('ticking'); tapToCount(root); unlock(); return true; }
        return false;
      };
      $$('.obj', root).forEach(o => o.addEventListener('pointerdown', () => {
        if (done || o.classList.contains('gone')) return;
        if (takeOne(o)) speak(C.countLeft);
      }));
      root.__take = async () => { for (const o of $$('.obj', root).reverse()) { if (done) break; if (!o.classList.contains('gone')) { takeOne(o); await sleep(450); } } };
    },
    explain: async r => { await r.__take(); await sleep(500); await autoCount(liveObjs(r)); } };
}
// "Watch me first": the first time each day, Tiko shows how adding / taking away works before she tries.
async function conceptDemo(act) {
  const q = act === 'add' ? mkAdd([2, 1]) : mkSub([4, 1]), C = L().c;
  app.innerHTML = actFrame({ index: 0, count: 1 }, `${promptHTML('👀 ' + C.watch)}<div class="visual">${q.visual}</div>
    <div class="btnrow"><button class="btn primary huge myturn" hidden>✋ ${esc(C.myTurn)}</button></div>`);
  let go, left = false; const pr = new Promise(r => { go = r; });
  $('.home').onclick = () => { left = true; stopSpeech(); go(false); };   // leaving stops the demo completely
  $('.replay').onclick = () => {};
  const root = $('.stage');
  q.setup(root, () => {});
  $$('.together', root).forEach(b => { b.classList.remove('pulse'); b.disabled = true; });
  (async () => {
    await speak(C.watch); if (left) return; await speak(...q.speak); if (left) return;
    await sleep(400); if (left) return; await q.explain(root); if (left) return;
    owlReact('happy'); sfx('good');
    await speak(...q.correctSpeak); if (left) return;
    const btn = $('.myturn'); if (btn) { btn.hidden = false; btn.classList.add('pulse'); btn.onclick = () => { sfx('pop'); go(true); }; }
  })();
  return pr;
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
  return { title: before ? q.before(n) : q.after(n), speak: [before ? q.before(n) : q.after(n)], visual: vis, optClass: 'num', drop: '.track b.q',
    options: numOpts(ans, 0, max + 1), answer: ans, correctSpeak: [String(ans)], grade: f => gradeMath('next', f),
    // after a miss: a little number line with its neighbours, so she can count her way to it
    onMiss: r => { if ($('.numline', r)) return; const lo = Math.max(0, Math.min(n, ans) - 2);
      $('.visual', r).insertAdjacentHTML('beforeend', `<div class="numline">${Array.from({ length: 5 }, (_, i) => lo + i).map(x => `<b class="${x === ans ? 'q' : x === n ? 'me' : ''}">${x === ans ? '?' : x}</b>`).join('')}</div>`); } };
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
  const opts = shuffle([{ html: a, val: a }, { html: b, val: b }]);
  return { title: q.bigger, speak: [q.bigger], visual: '', optClass: 'num',
    options: opts, answer: Math.max(a, b),
    correctSpeak: [String(Math.max(a, b))], grade: f => gradeMath('compare', f),
    // after a miss: both numbers built from tens and ones, so she can SEE which is more
    onMiss: r => { if ($('.cmpcue', r)) return; $('.visual', r).innerHTML = `<div class="cmpcue">${opts.map(o => `<div><b>${o.val}</b>${pvHTML(o.val)}</div>`).join('')}</div>`; } };
}
// ================= more maths =================
const SHAPE_COLORS = ['#ff7a6b', '#20b2a0', '#9b7fd1', '#ffc94a', '#5bb8f5', '#4cc47c', '#ff9ed2'];
const SIDES = { triangle: 3, square: 4, rectangle: 4, diamond: 4, pentagon: 5, hexagon: 6 };
const BASIC_SHAPES = ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart'];
const ALL_SHAPES = [...BASIC_SHAPES, 'oval', 'diamond', 'pentagon', 'hexagon'];
const regPoly = (n, r = 44, rot = -90) => Array.from({ length: n }, (_, i) => { const a = (rot + i * 360 / n) * Math.PI / 180; return `${(50 + r * Math.cos(a)).toFixed(1)},${(52 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
const starPts = () => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 19 : 46, a = (-90 + i * 36) * Math.PI / 180; return `${(50 + r * Math.cos(a)).toFixed(1)},${(53 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
function shapeSVG(name, color, size = 120, extra = '') {
  const body = {
    circle: '<circle cx="50" cy="50" r="42"/>', square: '<rect x="10" y="10" width="80" height="80" rx="3"/>',
    triangle: '<polygon points="50,6 95,90 5,90"/>', rectangle: '<rect x="3" y="25" width="94" height="50" rx="3"/>',
    star: `<polygon points="${starPts()}"/>`, oval: '<ellipse cx="50" cy="50" rx="46" ry="28"/>',
    heart: '<path d="M50 90 C 8 62 2 32 24 17 C 38 9 48 18 50 30 C 52 18 62 9 76 17 C 98 32 92 62 50 90 Z"/>',
    diamond: '<polygon points="50,3 88,50 50,97 12,50"/>', pentagon: `<polygon points="${regPoly(5)}"/>`, hexagon: `<polygon points="${regPoly(6, 45, 0)}"/>`,
  }[name];
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="fill:${color};stroke:#00000022;stroke-width:3;stroke-linejoin:round;overflow:visible">${body}${extra}</svg>`;
}
// the corners of the straight-sided shapes, so each side can be tapped and counted
const sidePts = t => ({ triangle: '50,6 95,90 5,90', square: '10,10 90,10 90,90 10,90', rectangle: '3,25 97,25 97,75 3,75', diamond: '50,3 88,50 50,97 12,50',
  pentagon: regPoly(5), hexagon: regPoly(6, 45, 0) }[t].split(' ').map(p => p.split(',')));
const sideLines = t => { const p = sidePts(t); return p.map(([x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return `<line class="side" x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"/>`; }).join(''); };
const M = () => L().m;

function mkShapes() {
  const l = lvl('shapes'), m = M();
  if (l >= 3 && Math.random() < .5) {
    const t = pick(Object.keys(SIDES)), n = SIDES[t];
    // she can tap each side to mark it as counted (no number is spoken: she counts, the marks keep track)
    return { title: m.sides, speak: [m.sides], visual: `<div class="sidesvg">${shapeSVG(t, pick(SHAPE_COLORS), 190, sideLines(t))}</div>`, optClass: 'num',
      options: numOpts(n, 3, 8), answer: n, correctSpeak: [m.sidesAns(m.shapes[t], n)], grade: f => gradeMath('shapes', f),
      setup: r => $$('.side', r).forEach(s => s.addEventListener('pointerdown', () => { s.classList.toggle('counted'); sfx('tap'); })),
      // second miss: Tiko counts the sides one by one
      explain: async r => { const tok = speakToken, ss = $$('.side', r); ss.forEach(s => s.classList.remove('counted'));
        for (const [i, s] of ss.entries()) { if (tok !== speakToken) return; s.classList.add('counted'); sfx('tap'); await say(String(i + 1), S.lang, 1.05); } } };
  }
  const pool = l === 1 ? BASIC_SHAPES : ALL_SHAPES, t = pick(pool);
  const opts = shuffle([t, ...shuffle(pool.filter(s => s !== t)).slice(0, 2)]), cols = shuffle(SHAPE_COLORS);
  return { title: m.findShape(m.shapes[t]), speak: [m.findShape(m.shapes[t])], visual: '',
    options: opts.map((s, i) => ({ html: shapeSVG(s, cols[i]), val: s })), answer: t, correctSpeak: [m.shapes[t]],
    grade: f => gradeMath('shapes', f) };
}
const PATTERN_SETS = [['🍎', '🍌', '🍇'], ['🔴', '🔵', '🟡'], ['🐶', '🐱', '🐭'], ['⭐', '🌙', '☀️'], ['🚗', '🚌', '🚲'], ['🌸', '🍀', '🍄']];
function mkPatterns() {
  const l = lvl('patterns'), m = M();
  if (l >= 3 && Math.random() < .5) {
    const k = pick([1, 2, 5, 10]), s = k * (1 + rand(4)), seq = [0, 1, 2, 3].map(i => s + i * k), ans = s + 4 * k;
    return { title: m.nextPattern, speak: [m.nextPattern], optClass: 'num', answer: ans, correctSpeak: [String(ans)], drop: '.seq b.q',
      visual: `<div class="seq">${seq.map((x, i) => `<b style="--i:${i}">${x}</b>`).join('')}<b class="q" style="--i:4">?</b></div>`,
      options: numOpts(ans, 0, 120), grade: f => gradeMath('patterns', f), onMiss: r => hopCue(r, '.seq b', `+${k}`) };
  }
  const set = pick(PATTERN_SETS), unit = l === 1 ? [0, 1] : pick([[0, 1, 2], [0, 0, 1], [0, 1, 1]]);
  const seq = Array.from({ length: 6 }, (_, i) => set[unit[i % unit.length]]), ans = set[unit[6 % unit.length]];
  return { title: m.nextPattern, speak: [m.nextPattern], answer: ans, correctSpeak: [], drop: '.seq b.q',
    visual: `<div class="seq">${seq.map((x, i) => `<b style="--i:${i}">${x}</b>`).join('')}<b class="q" style="--i:6">?</b></div>`,
    options: shuffle(set).map(x => ({ html: x, val: x })), grade: f => gradeMath('patterns', f),
    // after a miss: the part that repeats bounces group by group, like clapping the rhythm
    onMiss: r => { const s = $('.seq', r); s.classList.remove('beat'); void s.offsetWidth;
      $$('b', s).forEach((b, i) => { if (!b.classList.contains('q')) b.style.animationDelay = `${i * 170 + Math.floor(i / unit.length) * 420}ms`; b.classList.toggle('gap', i > 0 && i % unit.length === 0); }); s.classList.add('beat'); } };
}
// after a miss in a number pattern: the size of each jump appears between the numbers
function hopCue(root, sel, label) {
  if ($('.hopk', root)) return;
  $$(sel, root).slice(0, -1).forEach(b => b.insertAdjacentHTML('beforeend', `<i class="hopk">${label}</i>`));   // sits under the gap to the next number
}
function clockSVG(h, mi) {
  const ha = ((h % 12) + mi / 60) * 30, ma = mi * 6;
  const nums = Array.from({ length: 12 }, (_, i) => { const n = i + 1, a = (n * 30 - 90) * Math.PI / 180; return `<text data-n="${n}" x="${(100 + 74 * Math.cos(a)).toFixed(1)}" y="${(100 + 74 * Math.sin(a)).toFixed(1)}">${n}</text>`; }).join('');
  const ticks = Array.from({ length: 60 }, (_, i) => `<line x1="100" y1="${i % 5 ? 12 : 10}" x2="100" y2="${i % 5 ? 16 : 22}" transform="rotate(${i * 6} 100 100)" stroke="${i % 5 ? '#c9c2da' : '#9b7fd1'}" stroke-width="${i % 5 ? 2 : 4}"/>`).join('');
  return `<svg class="clock" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" fill="#fff" stroke="#9b7fd1" stroke-width="8"/>${ticks}
    <g font-size="22" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#2d3142" font-family="Andika, sans-serif">${nums}</g>
    <line class="hh" x1="100" y1="100" x2="100" y2="52" stroke="#ff7a6b" stroke-width="9" stroke-linecap="round" transform="rotate(${ha} 100 100)"/>
    <line x1="100" y1="100" x2="100" y2="26" stroke="#20b2a0" stroke-width="6" stroke-linecap="round" transform="rotate(${ma} 100 100)"/>
    <circle cx="100" cy="100" r="8" fill="#2d3142"/></svg>`;
}
function mkClock() {
  const l = lvl('clock'), m = M(), mins = l === 1 ? [0] : l === 2 ? [0, 30] : [0, 15, 30];
  const h = 1 + rand(12), mi = pick(mins);
  const say = (hh, mm) => mm === 0 ? m.oclock(hh) : mm === 30 ? m.half(hh) : m.quarter(hh);
  const dig = (hh, mm) => `${hh}:${String(mm).padStart(2, '0')}`;
  const set = new Map([[dig(h, mi), [h, mi]]]);
  while (set.size < 3) { const hh = 1 + rand(12), mm = l === 1 ? 0 : pick(mins.length > 1 && Math.random() < .5 ? mins : [mi]); set.set(dig(hh, mm), [hh, mm]); }
  return { title: m.whatTime, speak: [m.whatTime], visual: clockSVG(h, mi), optClass: 'word',
    // French children read "3 h 00" rather than "3:00"
    options: shuffle([...set.keys()]).map(k => ({ html: `<span class="digital">${S.lang === 'fr' ? k.replace(':', ' h ') : k}</span>`, val: k })), answer: dig(h, mi),
    correctSpeak: [say(h, mi)], grade: f => gradeMath('clock', f),
    // after a miss: the short hand and the number it shows light up, and Tiko says so
    retrySpeak: [L().cue.shortHand(h)],
    onMiss: r => { const hh = $('.clock .hh', r), tx = $(`.clock text[data-n="${h}"]`, r); if (hh) hh.classList.add('cue'); if (tx) tx.classList.add('cue'); } };
}
function mkDoubles() {
  const m = M(), n = 1 + rand(lvl('doubles') >= 2 ? 10 : 5), spots = Array.from({ length: n }, (_, i) => `<span class="obj spot" style="--i:${i}">●</span>`).join('');
  return { title: `${n} + ${n} = ?`, speak: [m.double(n)], optClass: 'num',
    visual: `<div class="fly"><div class="wing l">${spots}</div><div class="fbody"></div><div class="wing r">${spots}</div></div>`,
    options: numOpts(2 * n, 2, 22), answer: 2 * n, correctSpeak: [m.doubleAns(n)], setup: r => { tapToCount(r); $('.fly', r).classList.add('ticking'); }, grade: f => gradeMath('doubles', f),
    explain: r => autoCount(liveObjs(r)) };
}
function mkMissing() {
  const l = lvl('missing'), m = M(), q = L().q, max = [5, 10, 20][l - 1], e = pick(OBJECTS);
  if (l >= 3 && Math.random() < .4) {
    const a = 3 + rand(max - 2), ans = 1 + rand(a - 1), r = a - ans;
    return { title: `${a} − ? = ${r}`, speak: [m.missingSub(a, r)], optClass: 'num', drop: '.eq .q', visual: `<div class="eq">${a} − <span class="q">?</span> = ${r}</div>`,
      options: numOpts(ans, 0, max), answer: ans, correctSpeak: [`${a} ${q.minus} ${ans} ${q.equals} ${r}`], grade: f => gradeMath('missing', f, 3) };
  }
  const s = 2 + rand(max - 1), a = 1 + rand(s - 1), ans = s - a;
  const ghosts = l < 3 ? `<span class="sign">+</span><div class="objs"><div class="five">${Array.from({ length: ans }, (_, i) => `<span class="obj ghost" style="--i:${a + i}">${e}</span>`).join('')}</div></div>` : '';
  return { title: `${a} + ? = ${s}`, speak: [m.missingAdd(a, s)], optClass: 'num', drop: '.eq .q',
    visual: `<div style="display:flex;flex-direction:column;align-items:center;gap:14px"><div class="eq">${a} + <span class="q">?</span> = ${s}</div>
      ${l < 3 ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center">${objsHTML(a, e)}${ghosts}</div>` : ''}</div>`,
    options: numOpts(ans, 0, max), answer: ans, correctSpeak: [`${a} ${q.plus} ${ans} ${q.equals} ${s}`], setup: r => tapToCount(r), grade: f => gradeMath('missing', f),
    // count on: start from the first number and count the ghost ones
    explain: async r => { const gh = $$('.obj.ghost', r); if (!gh.length) return; await say(String(a), S.lang, 1);
      for (const [i, o] of gh.entries()) { o.classList.add('ticked', 'pulse1'); await say(String(a + i + 1), S.lang, 1.05); o.classList.remove('pulse1'); } } };
}
function mkSkip() {
  const l = lvl('skip'), m = M();
  let k, seq, ans, prompt;
  if (l >= 3 && Math.random() < .3) { const s = 8 + rand(40); seq = [s, s - 1, s - 2]; ans = s - 3; prompt = m.frogBack; }
  else {
    k = l === 1 ? 10 : l === 2 ? pick([2, 5, 10]) : pick([2, 5, 10, 3]);
    const s = l === 1 ? 10 : k * (1 + rand(l === 2 ? 2 : 5));
    seq = [s, s + k, s + 2 * k]; ans = s + 3 * k; prompt = m.frog(k);
  }
  return { title: prompt, speak: [prompt], optClass: 'num', answer: ans, correctSpeak: [String(ans)], drop: '.pad.q',
    onMiss: r => hopCue(r, '.pad', k ? `+${k}` : '−1'),
    visual: `<div class="pads">${seq.map((x, i) => `<span class="pad" style="--i:${i}">${x}${i === 2 ? '<i class="frog">🐸</i>' : ''}</span>`).join('')}<span class="pad q" style="--i:3">?</span></div>`,
    options: numOpts(ans, 0, 130), grade: f => gradeMath('skip', f),
    onCorrect: r => { const fr = $('.frog', r), qp = $('.pad.q', r); if (fr && qp) { qp.textContent = ans; qp.appendChild(fr); fr.classList.add('hop'); } } };
}
function mkTens() {
  const l = lvl('tens'), m = M(), n = l === 1 ? 11 + rand(9) : l === 2 ? 11 + rand(40) : 11 + rand(89), t = Math.floor(n / 10), o = n % 10;
  const rods = Array.from({ length: t }, (_, i) => `<button class="rod" style="--i:${i}">${'<i></i>'.repeat(10)}</button>`).join('');
  const cubes = Array.from({ length: o }, (_, i) => `<button class="cube" style="--i:${t + i}"></button>`).join('');
  const cand = new Set([n]); const swap = o * 10 + t;
  [swap !== n && o > 0 && swap <= 99 ? swap : null, n + 10 <= 99 ? n + 10 : n - 10, n - 1, n + 1].forEach(x => { if (x && x > 0 && cand.size < 3) cand.add(x); });
  return { title: m.tens, speak: [m.tens], optClass: 'num', visual: `<div class="pv"><div class="rods">${rods}</div><div class="cubes">${cubes}</div></div>`,
    options: shuffle([...cand]).map(v => ({ html: v, val: v })), answer: n, correctSpeak: [String(n)], grade: f => gradeMath('tens', f),
    setup(root) {
      let c = 0;
      $$('.rod, .cube', root).forEach(b => b.addEventListener('click', () => {
        if (b.classList.contains('counted')) return;
        c += b.classList.contains('rod') ? 10 : 1; b.classList.add('counted'); b.dataset.n = c; sfx('tap'); say(String(c), S.lang, 1);
      }));
    } };
}
// ---------- bigger maths: numbers to 99 with tens and ones, coins, and "groups of" ----------
T.en.cue = { shortHand: h => `Look at the short hand. It shows the hour: ${h}.` };
T.fr.cue = { shortHand: h => `Regarde la petite aiguille. Elle montre l'heure : ${h}.` };
T.en.m2 = { bigAdd: (a, b) => `${a} plus ${b}. Count the tens, then the ones!`, bigSub: (a, b) => `${a} take away ${b}. Count what is left: the tens, then the ones!`,
  money: 'How much money? Tap each coin to count.', groups: (g, k) => `${g} groups of ${k}. How many in all?`, groupsRule: (g, k, n) => `${g} groups of ${k} make ${n}.` };
T.fr.m2 = { bigAdd: (a, b) => `${a} plus ${b}. Compte les dizaines, puis les unités !`, bigSub: (a, b) => `${a} moins ${b}. Compte ce qui reste : les dizaines, puis les unités !`,
  money: 'Ça fait combien ? Touche chaque pièce pour compter.', groups: (g, k) => `${g} groupes de ${k}. Combien en tout ?`, groupsRule: (g, k, n) => `${g} groupes de ${k}, ça fait ${n}.` };
Object.assign(T.en.acts, { money: 'Coins', groups: 'Groups of' }); Object.assign(T.fr.acts, { money: 'Les pièces', groups: 'Les groupes' });
const pvHTML = (n, { goneT = 0, goneO = 0, off = 0 } = {}) => {
  const t = Math.floor(n / 10), o = n % 10;
  return `<div class="pv"><div class="rods">${Array.from({ length: t }, (_, i) => `<button class="rod ${i >= t - goneT ? 'gone' : ''}" style="--i:${off + i}">${'<i></i>'.repeat(10)}</button>`).join('')}</div>
    <div class="cubes">${Array.from({ length: o }, (_, i) => `<button class="cube ${i >= o - goneO ? 'gone' : ''}" style="--i:${off + t + i}"></button>`).join('')}</div></div>`;
};
// tapping a rod adds 10, a cube adds 1 (or a coin its value): Tiko says the running total, so she counts on by herself
function tapTotal(root, sel, valueOf) {
  let c = 0;
  $$(sel, root).forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('counted') || b.classList.contains('gone')) return;
    c += valueOf(b); b.classList.add('counted'); b.dataset.n = c; sfx('tap'); say(String(c), S.lang, 1);
  }));
}
const nearOpts = (ans, max = 99) => { const s = new Set([ans]); for (const x of shuffle([ans + 10, ans - 10, ans + 1, ans - 1, ans + 2])) { if (s.size >= 3) break; if (x > 0 && x <= max) s.add(x); } return shuffle([...s]).map(v => ({ html: v, val: v })); };
// Level 5 adding / taking away: two-digit numbers, adding or removing whole tens OR a few ones (no carrying yet)
function mkBig(op) {
  const C = L().c, m = L().m2, tens = Math.random() < .5; let a, b;
  if (op === '+') {
    if (tens) { a = 11 + rand(60); b = 10 * (1 + rand(Math.min(3, Math.floor((99 - a) / 10)))); }
    else { a = 10 * (1 + rand(8)) + 1 + rand(7); b = 1 + rand(9 - a % 10); }
  } else if (tens) { a = 31 + rand(68); b = 10 * (1 + rand(Math.min(3, Math.floor(a / 10) - 1))); }
  else { a = 10 * (1 + rand(9)) + 2 + rand(8); b = 1 + rand(a % 10); }
  const ans = op === '+' ? a + b : a - b;
  return { title: `${a} ${op === '+' ? '+' : '−'} ${b} = ?`, speak: [op === '+' ? m.bigAdd(a, b) : m.bigSub(a, b)], optClass: 'num',
    visual: op === '+' ? `<div class="bigsum">${pvHTML(a)}<span class="sign">+</span>${pvHTML(b, { off: 10 })}</div>` : `<div class="bigsum">${pvHTML(a, tens ? { goneT: b / 10 } : { goneO: b })}</div>`,
    options: nearOpts(ans), answer: ans, correctSpeak: [op === '+' ? C.addRule(a, b, ans) : C.subRule(a, b, ans)],
    grade: f => gradeMath(op === '+' ? 'add' : 'sub', f), setup(root) { tapTotal(root, '.rod, .cube', b2 => (b2.classList.contains('rod') ? 10 : 1)); } };
}
// 🪙 Coins: 1s and 2s first, then 5s, then 10s
function mkMoney() {
  const l = lvl('money'), kinds = [[1, 1, 2], [1, 2, 5, 5], [10, 10, 5, 2, 1]][l - 1], n = 3 + rand(l === 1 ? 4 : 3);
  const coins = Array.from({ length: n }, () => pick(kinds)).sort((x, y) => y - x), total = coins.reduce((s, x) => s + x, 0);
  return { title: `🪙 ${L().m2.money.split('?')[0]}?`, speak: [L().m2.money], optClass: 'num',
    visual: `<div class="coins">${coins.map((v, i) => `<button class="coin ${v >= 5 ? 'big' : ''}" data-v="${v}" style="--i:${i}">${v}</button>`).join('')}</div>`,
    options: numOpts(total, 1, 99), answer: total, correctSpeak: [String(total)], grade: f => gradeMath('money', f),
    setup(root) { tapTotal(root, '.coin', b => +b.dataset.v); } };
}
// 🧺 Groups of: the first step towards multiplying — equal groups, counted all together
function mkGroups() {
  const l = lvl('groups'), k = l === 1 ? 2 : l === 2 ? pick([2, 5]) : pick([3, 4]), g = 2 + rand(l === 1 ? 3 : 4), n = g * k, e = pick(OBJECTS), m = L().m2;
  return { title: `${g} × ${k} = ?`, speak: [m.groups(g, k)], optClass: 'num',
    visual: `<div class="groups">${Array.from({ length: g }, (_, i) => `<div class="grp">${objsHTML(k, e, { offset: i * k })}</div>`).join('')}</div>`,
    options: numOpts(n, 1, 60), answer: n, correctSpeak: [m.groupsRule(g, k, n)], grade: f => gradeMath('groups', f),
    setup: r => tapToCount(r), explain: r => autoCount(liveObjs(r)) };
}
function ribbon(len, color, unit) { return `<span class="ribbon" style="width:${len * unit}px;background:${color}"><i>🐛</i></span>`; }
function mkMeasure() {
  const l = lvl('measure'), m = M(), unit = Math.min(44, Math.floor((innerWidth - 120) / 14));
  if (l >= 2) {
    const n = 2 + rand(l === 2 ? 7 : 11), color = pick(SHAPE_COLORS);
    return { title: m.blocks, speak: [m.blocks], optClass: 'num', answer: n, correctSpeak: [String(n)], grade: f => gradeMath('measure', f, 3),
      visual: `<div class="measure">${ribbon(n, color, unit)}<div class="ruler">${Array.from({ length: n + 3 }, (_, i) => `<button class="blk" style="width:${unit}px"></button>`).join('')}</div></div>`,
      options: numOpts(n, 1, 16),
      setup(root) { let c = 0; $$('.blk', root).forEach(b => b.addEventListener('click', () => { if (b.classList.contains('counted')) return; c++; b.classList.add('counted'); b.textContent = c; sfx('tap'); say(String(c), S.lang, 1); })); } };
  }
  let a = 3 + rand(9), b = 3 + rand(9); while (Math.abs(a - b) < 2) b = 3 + rand(9);
  const longer = Math.random() < .6, ans = longer ? (a > b ? 'A' : 'B') : (a < b ? 'A' : 'B'), cols = shuffle(SHAPE_COLORS);
  const prompt = longer ? m.longer : m.shorter;
  return { title: prompt, speak: [prompt], optClass: 'stack', answer: ans, correctSpeak: [], grade: f => gradeMath('measure', f, 3), visual: '',
    options: [{ html: ribbon(a, cols[0], unit), val: 'A' }, { html: ribbon(b, cols[1], unit), val: 'B' }] };
}
const DICE = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function mkFlash() {
  const l = lvl('flash'), m = M(), n = l === 1 ? 1 + rand(6) : l === 2 ? 1 + rand(10) : 3 + rand(7);
  let dots;
  if (l === 1) dots = `<div class="dice">${Array.from({ length: 9 }, (_, i) => `<i class="${DICE[n].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;
  else if (l === 2) dots = `<div class="frame">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}" style="--i:0">${i < n ? '🔴' : ''}</i>`).join('')}</div>`;
  else {
    const pos = []; while (pos.length < n) { const p = [8 + rand(80), 8 + rand(80)]; if (pos.every(q => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 > 380)) pos.push(p); }
    dots = `<div class="scatter">${pos.map(p => `<i style="left:${p[0]}%;top:${p[1]}%"></i>`).join('')}</div>`;
  }
  const show = l === 1 ? 2200 : 1800;
  return { title: m.flash, speak: [m.flash], optClass: 'num', gate: true, answer: n, correctSpeak: [String(n)], grade: f => gradeMath('flash', f),
    visual: `<div class="flashbox">${dots}<div class="cover">☁️</div></div><button class="btn sun again" hidden>👀 ${esc(m.seeAgain)}</button>`,
    options: numOpts(n, 1, 12),
    setup(root, unlock) {
      const box = $('.flashbox', root), again = $('.again', root);
      const hide = () => { box.classList.add('hidden'); again.hidden = false; unlock(); };
      setTimeout(hide, show);
      again.onclick = () => { sfx('tap'); box.classList.remove('hidden'); setTimeout(() => box.classList.add('hidden'), 1300); };
    } };
}
function mkPop() {
  const l = lvl('pop'), m = M();
  let bubbles, prompt;
  if (l >= 3) {
    const good = shuffle([[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]]).slice(0, 3).map(([a, b]) => ({ t: `${a}+${b}`, ok: true }));
    const bad = Array.from({ length: 6 }, () => { let a = 1 + rand(8), b = 1 + rand(8); while (a + b === 10) b = 1 + rand(8); return { t: `${a}+${b}`, ok: false }; });
    bubbles = shuffle([...good, ...bad]); prompt = m.popTen;
  } else {
    const target = l === 1 ? 1 + rand(9) : 5 + rand(16);
    const near = Array.from({ length: 12 }, (_, i) => target - 4 + i).filter(x => x > 0 && x !== target);
    bubbles = shuffle([...Array(3).fill({ t: String(target), ok: true }), ...shuffle(near).slice(0, 6).map(x => ({ t: String(x), ok: false }))]);
    prompt = m.pop(target);
  }
  return { kind: 'pop', title: prompt, speak: [prompt], bubbles, grade: f => gradeMath('pop', f) };
}
function mkMathStory() {
  const l = lvl('mathStory'), m = M(), max = l >= 2 ? 10 : 5;
  if (Math.random() < .5) {
    // at least 2 of everything, so the story never says "1 apples"
    const [name, e] = pick(m.things), a = 2 + rand(max - 3), b = 2 + rand(Math.max(1, max - a - 1)), lines = m.storyAdd(name, a, b);
    return { title: lines[2], speak: lines, optClass: 'num', answer: a + b, correctSpeak: [String(a + b)], setup: r => tapToCount(r),
      visual: `${objsHTML(a, e)}<span class="sign late">+</span><div class="late">${objsHTML(b, e, { offset: 0 })}</div>`,
      options: numOpts(a + b, 0, max + 2), grade: f => gradeMath('mathStory', f, 2), explain: r => autoCount(liveObjs(r)) };
  }
  const [name, e, verb] = pick(m.away), a = 3 + rand(max - 2), b = 2 + rand(a - 2), lines = m.storySub(name, a, b, verb);
  return { title: lines[2], speak: lines, optClass: 'num', answer: a - b, correctSpeak: [String(a - b)],
    visual: objsHTML(a, e, { away: b }), setup: r => tapToCount(r),
    options: numOpts(a - b, 0, max), grade: f => gradeMath('mathStory', f, 2), explain: r => autoCount(liveObjs(r)) };
}

function mkTrace() {
  const d = DATA[S.lang], l = pickFresh('trace', introduced('letter', d.letters));
  return { kind: 'trace', glyph: l.l, say: [{ unit: l.l }, L().q.like, l.k], hint: l.e };
}
function mkTraceNum() {
  const n = lvl('count') >= 2 ? rand(21) : rand(10);
  return { kind: 'trace', glyph: String(n), say: [String(n)], hint: '' };
}
function mkPaperRead() {
  const d = DATA[S.lang], P = L().paper, kind = rand(3);
  if (kind === 0) {
    const l = pickFresh('paperLetter', introduced('letter', d.letters));
    return { kind: 'paper', text: P.writeLetter(l.l), speak: [P.writeLetter(l.l)], visual: `<div class="wordbig">${esc(l.l)}</div><div class="pic">${l.e}</div>` };
  }
  const w = pickFresh('paperWord', notKnown(wordsNow()));
  if (kind === 1) return { kind: 'paper', text: P.writeWord(w.w), speak: [P.writeWord(w.w)], visual: `<div class="wordbig">${esc(w.w)}</div><div class="pic">${w.e}</div>` };
  return { kind: 'paper', text: P.drawWord, speak: [P.drawWord], visual: `<div class="wordbig">${esc(w.w)}</div>`,
    reveal: { html: `<div class="pic bob">${w.e}</div>`, speak: [P.wasIt, w.w] } };
}
function mkPaperMath() {
  const P = L().paper, kind = rand(5);
  if (kind === 3) {
    const [a, b] = shuffle(BASIC_SHAPES).slice(0, 2), m = M();
    const nm = s => S.lang === 'fr' ? m.shapes[s].replace(/^le /, 'un ').replace(/^l'étoile/, 'une étoile') : m.shapes[s];
    return { kind: 'paper', text: P.drawShapes(nm(a), nm(b)), speak: [P.drawShapes(nm(a), nm(b))],
      visual: `${shapeSVG(a, pick(SHAPE_COLORS), 90)}${shapeSVG(b, pick(SHAPE_COLORS), 90)}` };
  }
  if (kind === 4) {
    const set = pick([['○', '△'], ['○', '□', '△'], ['□', '□', '○'], ['★', '○']]);
    const seq = Array.from({ length: 6 }, (_, i) => set[i % set.length]).join(' ');
    return { kind: 'paper', text: P.drawPattern, speak: [P.drawPattern], visual: `<div class="wordbig" style="letter-spacing:8px">${seq} …</div>` };
  }
  if (kind === 0) {
    const a = 2 + rand(4), b = 2 + rand(3);   // never "Draw 1 circles"
    return { kind: 'paper', text: P.drawAdd(a, b), speak: [P.drawAdd(a, b)], visual: `<div class="eq">${a} + ${b} = <span class="q">?</span></div>`,
      answer: a + b, options: numOpts(a + b, 0, 12), grade: f => gradeMath('add', f) };
  }
  if (kind === 1) {
    const a = 3 + rand(6), b = 2 + rand(a - 2);
    return { kind: 'paper', text: P.drawSub(a, b), speak: [P.drawSub(a, b)], visual: `<div class="eq">${a} − ${b} = <span class="q">?</span></div>`,
      answer: a - b, options: numOpts(a - b, 0, 10), grade: f => gradeMath('sub', f) };
  }
  const s = [1, 11, 21, 31, 41][rand(Math.min(5, lvl('next') * 2))];
  return { kind: 'paper', text: P.writeNums(s, s + 9), speak: [P.writeNums(s, s + 9)],
    visual: `<div class="track"><b>${s}</b><span>…</span><b>${s + 9}</b></div>` };
}

// ================= thinking games (memory, sequences, attention, categories, puzzles) =================
const TH = () => L().th;
const CARD_EMOJI = ['🐶', '🐱', '🦊', '🐸', '🐵', '🐼', '🦁', '🐷', '🍎', '🍌', '🍓', '⭐', '🌈', '🚗', '🎈', '⚽', '🦋', '🐢', '🍦', '🌻'];
const ODD_CATS = { animals: ['🐶', '🐱', '🐰', '🐻', '🐸', '🐵', '🐷', '🐮', '🐥'], fruit: ['🍎', '🍌', '🍇', '🍓', '🍐', '🍊', '🍒'],
  vehicles: ['🚗', '🚌', '🚲', '✈️', '🚂', '🚀', '🚜', '🚒'], clothes: ['👕', '👖', '👗', '🧦', '🧢', '👟'], weather: ['☀️', '🌧️', '⛄', '🌈', '⚡', '☁️'],
  red: ['🍎', '🍓', '🚒', '❤️', '🌹', '🍒'], yellow: ['🍌', '🌻', '⭐', '🐥', '🧀', '🌽'] };

// 🃏 Memory pairs — she looks at every card for as long as she wants first (friendly for a poor short-term memory).
// Gentle ladder: 2 pairs → 3 → 4 → 5 → 6 → 8. Levels 1-3 also help her: after two wrong tries the partner card glows.
const MEM_PAIRS = [2, 3, 4, 5, 6, 8];
function mkMemory() { const l = lvl('memory'), pairs = MEM_PAIRS[l - 1] || 2, set = shuffle(CARD_EMOJI).slice(0, pairs); return { kind: 'memory', cards: shuffle([...set, ...set]), pairs, help: l <= 3 }; }
function askMemory(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const n = q.cards.length, cols = n <= 4 ? 2 : n <= 6 ? 3 : n === 10 ? 5 : n === 16 && innerWidth > innerHeight ? 6 : 4;   // wide screens: 16 cards in 3 rows, leaving room for the pictures to drag
    app.innerHTML = actFrame(meta, `${promptHTML(TH().memory)}<div class="memgrid ${n <= 6 ? 'big' : ''}" style="--cols:${cols}">${q.cards.map((c, i) =>
      `<button class="mcard up" data-i="${i}" style="--i:${i}"><span class="face">${c}</span><span class="back">❓</span></button>`).join('')}</div>
      <div class="btnrow memrow"><div class="mtray" hidden>${shuffle([...new Set(q.cards)]).map(e => `<button class="mopt" data-e="${e}">${e}</button>`).join('')}</div>
      <button class="btn primary huge readyb pulse">👀 ${esc(TH().ready)}</button>
      <button class="btn sun peekb" hidden>👀 ${esc(TH().peek)}</button></div>`);
    wire(meta, finish, () => speak(TH().memory), [TH().memory]);
    const cards = $$('.mcard'); let open = [], matched = 0, misses = 0, ready = false, closeT = null, missRun = 0;
    // She decides when she has looked long enough — no timer.
    $('.readyb').onclick = () => {
      sfx('pop'); cards.forEach(c => c.classList.remove('up')); ready = true;
      $('.readyb').remove(); $('.peekb').hidden = false; $('.mtray').hidden = false; $('.bubble').textContent = TH().memoryGo; speak(TH().memoryGo);
    };
    const picOf = c => q.cards[+c.dataset.i], mateOf = c => cards.find(x => x !== c && picOf(x) === picOf(c));
    const glowCard = m => { if (!m) return; m.classList.remove('hint'); void m.offsetWidth; m.classList.add('hint'); setTimeout(() => m.classList.remove('hint'), 1800); };
    const stuck = () => (q.help && missRun >= 2) || missRun >= 3;   // easy levels help after two wrong tries, bigger boards after three
    // both cards of a picture are found
    const pairDone = async (a, b) => {
      [a, b].forEach(c => { c.classList.remove('found'); c.classList.add('up', 'matched'); }); matched++; missRun = 0; sfx('good'); burstAt(b, 20);
      const t = $(`.mopt[data-e="${picOf(a)}"]`); if (t) t.classList.add('gone');
      if (matched === q.pairs) {
        const first = misses <= q.pairs; gradeLevel('memory', first); tally('think'); logDay(first); if (first) flyStar($('.memgrid')); save();
        owlReact('happy'); await sleep(400); await speak(...praiseParts()); await sleep(300); finish(first);
      }
    };
    // Recall with something to hold: she drags a picture from the row onto the card where it is hiding.
    // Right → the card turns over and stays. Wrong → the card shows what it really is for a moment, then hides again.
    $$('.mopt').forEach(b => {
      let id = null, sx = 0, sy = 0, drag = false;
      b.addEventListener('pointerdown', e => { if (!ready || id !== null || b.classList.contains('gone')) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; drag = false; try { b.setPointerCapture(id); } catch (err) { /* ignore */ } });
      b.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return; const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!drag && Math.hypot(dx, dy) > 12) {
          drag = true; b.classList.add('dragging'); sfx('tap'); if (open.length) closeOpen();
          if (stuck()) glowCard(cards.find(c => !c.classList.contains('up') && picOf(c) === b.dataset.e));
        }
        if (drag) b.style.translate = `${dx}px ${dy}px`;
      });
      const end = (e, cancelled) => {
        if (e.pointerId !== id) return; id = null; if (!drag) return;
        drag = false; b.classList.remove('dragging'); b.style.translate = '';
        if (cancelled || !ready) return;
        const c = cards.find(x => { if (x.classList.contains('up')) return false; const r = x.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
        if (!c) return;                                   // let go anywhere else: it just slides home, never a mistake
        c.classList.add('up');
        if (picOf(c) === b.dataset.e) { const m = mateOf(c); if (m.classList.contains('found')) pairDone(m, c); else { c.classList.add('found'); missRun = 0; sfx('good'); burstAt(c, 10); } }
        else { misses++; missRun++; sfx('oops'); owlReact('think'); setTimeout(() => { if (!c.classList.contains('found') && !c.classList.contains('matched') && !open.includes(c)) c.classList.remove('up'); }, q.help ? 2200 : 1600); }
      };
      b.addEventListener('pointerup', e => end(e, false)); b.addEventListener('pointercancel', e => end(e, true));
    });
    // Peek: all cards face up for 2 s — as often as she likes
    $('.peekb').onclick = async () => {
      if (!ready) return; sfx('tap');
      ready = false; const shown = cards.filter(c => !c.classList.contains('up')); shown.forEach(c => c.classList.add('up'));
      await sleep(2000); shown.forEach(c => { if (!c.classList.contains('matched') && !open.includes(c)) c.classList.remove('up'); }); ready = true;
    };
    // a wrong pair stays open for 2.5 s so she can remember it; tapping any card closes it sooner
    const closeOpen = () => { clearTimeout(closeT); open.forEach(c => c.classList.remove('up')); open = []; };
    cards.forEach(c => c.addEventListener('click', async () => {
      if (!ready) return;
      if (open.length >= 2) { closeOpen(); if (c.classList.contains('up')) return; }
      if (c.classList.contains('up')) return;
      // its partner was already found by dragging: turning this one over completes the pair
      if (!open.length && mateOf(c).classList.contains('found')) { sfx('tap'); return pairDone(mateOf(c), c); }
      c.classList.add('up'); sfx('tap'); open.push(c);
      if (open.length < 2) {
        // stuck after wrong tries → the partner card glows to help her find it
        if (stuck()) { const m = mateOf(c); if (!m.classList.contains('up')) glowCard(m); }
        return;
      }
      const [a, b] = open;
      if (picOf(a) === picOf(b)) { open = []; pairDone(a, b); }
      else { misses++; missRun++; closeT = setTimeout(() => { if (open.length === 2) closeOpen(); }, q.help ? 3500 : 2500); }
    }));
    speak(TH().memory);
  });
}
// 🎶 Copy me — animal pads light up and sing; she repeats. Length starts at 2 and grows with success.
const SIMON_PADS = [['🐸', '#4cc47c', 392], ['🐱', '#ff9f1c', 523.25], ['🐶', '#3a86ff', 659.25], ['🐰', '#ff70a6', 783.99]];
function mkSimon() { return { kind: 'simon', rounds: 3 }; }
function askSimon(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    app.innerHTML = actFrame(meta, `${promptHTML(TH().simonWatch)}<div class="simon">${SIMON_PADS.map(([e, c], i) =>
      `<button class="spad" data-i="${i}" style="--c:${c}">${e}</button>`).join('')}</div><div class="slen"></div>
      <button class="btn sun againb" hidden>👀 ${esc(TH().showAgain)}</button>`);
    wire(meta, finish, () => playSeq(), [TH().simonYou]);
    const pads = $$('.spad');
    let len = Math.max(2, Math.min(7, S.simonLen || 2)), round = 0, seq = [], pos = 0, accepting = false, misses = 0, fails = 0, cueNext = false;
    // one dot per sound; each fills in as she copies it, so she can see how far along she is
    const dots = () => { $('.slen').innerHTML = seq.map((_, i) => `<i class="${i < pos ? 'on' : ''}"></i>`).join(''); };
    const uncue = () => pads.forEach(p => p.classList.remove('cue'));
    const light = async (i, ms = 520) => {
      pads[i].classList.add('lit');
      try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); tone(SIMON_PADS[i][2], actx.currentTime, .45, 'triangle', .16); } catch (e) { /* ignore */ }
      await sleep(ms); pads[i].classList.remove('lit'); await sleep(140);
    };
    const playSeq = async () => {
      if (done) return;   // she left the game
      accepting = false; uncue(); pos = 0; dots(); $('.againb').hidden = true; $('.bubble').textContent = TH().simonWatch; await sleep(300);
      for (const i of seq) { if (done) return; await light(i); }
      $('.bubble').textContent = TH().simonYou; pos = 0; accepting = true; $('.againb').hidden = false; speak(TH().simonYou);
      if (cueNext) { cueNext = false; pads[seq[0]].classList.add('cue'); }   // after a miss: the first one pulses to get her started
    };
    // watch the sequence again as many times as she likes — never counts as a mistake
    $('.againb').onclick = () => { if (accepting) { sfx('tap'); playSeq(); } };
    const newRound = async () => { if (done) return; seq = Array.from({ length: len }, () => rand(4)); pos = 0; dots(); await speak(TH().simonWatch); await playSeq(); };
    pads.forEach((p, i) => p.addEventListener('pointerdown', async () => {
      if (!accepting) return;
      light(i, 280); uncue();
      if (i !== seq[pos]) {
        accepting = false; misses++; fails++; cueNext = true; sfx('oops'); owlReact('think'); await sleep(500); await speak(TH().simonAgain);
        if (fails >= 2) { fails = 0; if (len > 2) len--; return newRound(); }   // twice wrong: a new, shorter sequence
        return playSeq();                                                       // first miss: watch the same one again
      }
      pos++; dots();
      if (pos === seq.length) {
        accepting = false; fails = 0; sfx('good'); burstAt($('.simon'), 30); owlReact('happy'); round++;
        if (len >= 5) tally('simon5');
        len = Math.min(7, len + 1); S.simonLen = len - 1; save();
        await sleep(500);
        if (round >= q.rounds) {
          const first = misses === 0; gradeLevel('simon', first); tally('think'); logDay(first); if (first) flyStar($('.simon')); save();
          await speak(...praiseParts()); await sleep(300); return finish(first);
        }
        await speak(pick(L().praise)); newRound();
      }
    }));
    newRound();
  });
}
// 🙈 What's missing? (Kim's game) — look, a cloud covers them, one disappears
function mkKim() {
  const l = lvl('kim'), n = [3, 4, 5][l - 1], items = shuffle(CARD_EMOJI).slice(0, n + 2), shown = items.slice(0, n), gone = pick(shown);
  const opts = shuffle([gone, ...items.slice(n, n + 2)]);
  return { title: TH().kimLook, speak: [TH().kimLook], gate: true, optClass: '', answer: gone, correctSpeak: [], retrySpeak: [TH().kimQ],
    // she drags the missing picture back into the gap it left
    drop: '.titem.empty', onCorrect: root => { const el = $('.titem.empty', root); if (el) { el.textContent = gone; el.classList.remove('empty', 'over'); el.classList.add('back'); } },
    visual: `<div class="addwrap"><div class="tray">${shown.map((e, i) => `<span class="titem" data-e="${e}" style="--i:${i}">${e}</span>`).join('')}<div class="cover">☁️</div></div>
      <button class="btn primary huge readyb pulse">👀 ${esc(TH().ready)}</button></div>`,
    options: opts.map(e => ({ html: e, val: e })), grade: f => { gradeLevel('kim', f); tally('think'); },
    setup(root, unlock) {
      // she looks for as long as she wants, then taps "I'm ready"
      $('.readyb', root).addEventListener('click', async () => {
        $('.readyb', root).remove(); sfx('pop');
        const tray = $('.tray', root); if (!tray) return;
        tray.classList.add('covered'); await sleep(900);
        const el = $(`.titem[data-e="${gone}"]`, root); if (el) { el.textContent = ''; el.classList.add('empty'); }
        if (l >= 3) { const items2 = $$('.titem', root); items2.forEach(x => x.style.order = rand(10)); }
        tray.classList.remove('covered'); unlock(); $('.bubble').textContent = TH().kimQ; speak(TH().kimQ);
      });
    } };
}
// 🔍 Odd one out — by category, then (level 2) by colour
function mkOdd() {
  const l = lvl('odd'), keys = l === 1 ? ['animals', 'fruit', 'vehicles', 'clothes', 'weather'] : ['animals', 'fruit', 'vehicles', 'red', 'yellow'];
  const k = pick(keys); let other = pick(keys.filter(x => x !== k));
  const same = shuffle(ODD_CATS[k]).slice(0, 3);
  const odd = shuffle(ODD_CATS[other]).find(e => !ODD_CATS[k].includes(e)) || '🎈';
  return { title: TH().odd, speak: [TH().odd], visual: '', answer: odd, options: shuffle([...same, odd]).map(e => ({ html: e, val: e })),
    correctSpeak: [TH().oddWhy(TH().cats[k])], grade: f => { gradeLevel('odd', f); tally('think'); } };
}
// 🧩 Jigsaw — a cheerful picture cut into 4 / 6 / 9 pieces; tap two pieces to swap them
function jigsawImage() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 450; const g = c.getContext('2d');
  const h = rand(360), gr = g.createLinearGradient(0, 0, 0, 450); gr.addColorStop(0, `hsl(${h} 80% 82%)`); gr.addColorStop(1, `hsl(${(h + 60) % 360} 75% 70%)`);
  g.fillStyle = gr; g.fillRect(0, 0, 600, 450);
  g.fillStyle = '#ffffff55'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(rand(600), rand(450), 30 + rand(60), 0, 7); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';   // solid, not the see-through bubble colour
  g.font = '230px serif'; g.fillText(pick(['🦁', '🐼', '🦄', '🐸', '🐙', '🦋', '🐢', '🐬', '🦊', '🐵']), 300, 235);
  g.font = '70px serif'; [[70, 70], [530, 70], [70, 390], [530, 390]].forEach(([x, y]) => g.fillText(pick(['⭐', '🌸', '🎈', '🌈', '☀️', '🍭']), x, y));
  return c.toDataURL('image/png');
}
function mkJigsaw() { const l = lvl('jigsaw'), [cols, rows] = [[2, 2], [3, 2], [3, 3]][l - 1]; return { kind: 'jigsaw', cols, rows }; }
function askJigsaw(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const n = q.cols * q.rows, img = jigsawImage(), W = Math.min(innerWidth * .62, 560, innerHeight * .62 * 4 / 3), H = W * .75;
    let order = shuffle([...Array(n).keys()]); while (order.every((v, i) => v === i)) order = shuffle(order);
    app.innerHTML = actFrame(meta, `${promptHTML(TH().jigsaw)}<div class="jigrow"><div class="jig" style="width:${W}px;height:${H}px;grid-template-columns:repeat(${q.cols},1fr)"></div>
      <img class="jigref" src="${img}" alt=""></div>`);
    wire(meta, finish, () => speak(TH().jigsaw), [TH().jigsaw]);
    const jig = $('.jig'); let sel = null, moves = 0, bad = 0, dragT = 0;
    const solved = () => jig.classList.contains('solved');
    // swap two places. Three swaps in a row that put nothing home → one piece and its home glow together
    const swap = async (a, b) => {
      [order[a], order[b]] = [order[b], order[a]]; sel = null; moves++; sfx('pop');
      bad = (order[a] === a || order[b] === b) ? 0 : bad + 1; draw();
      [a, b].forEach(s => { if (order[s] === s) burstAt($$('.piece', jig)[s], 12); });
      if (order.every((v, i) => v === i)) {
        jig.classList.add('solved'); sfx('win'); rain(); owlReact('happy');
        gradeLevel('jigsaw', true); tally('think'); tally('puzzles'); logDay(true); flyStar(jig); save();
        await speak(...praiseParts()); await sleep(700); finish(true);
      } else if (bad >= 3) {
        bad = 0; const s = order.findIndex((p, i) => p !== i), ps = $$('.piece', jig);
        [ps[s], ps[order[s]]].forEach(x => x.classList.add('hint')); setTimeout(() => $$('.piece.hint', jig).forEach(x => x.classList.remove('hint')), 3000);
      }
    };
    const draw = () => {
      jig.innerHTML = order.map((p, slot) => { const px = p % q.cols, py = Math.floor(p / q.cols);
        return `<button class="piece ${p === slot ? 'ok' : ''}" data-s="${slot}" style="background-image:url(${img});background-size:${W}px ${H}px;background-position:${-px * W / q.cols}px ${-py * H / q.rows}px"></button>`; }).join('');
      $$('.piece', jig).forEach(b => {
        // tap two pieces to swap them …
        b.onclick = () => {
          if (solved() || Date.now() - dragT < 500) return;   // solved: no more swaps during the praise
          const s = +b.dataset.s;
          if (sel === null) { sel = s; b.classList.add('sel'); sfx('tap'); return; }
          if (sel === s) { sel = null; b.classList.remove('sel'); return; }
          swap(sel, s);
        };
        // … or drag a piece onto the place she wants it
        let id = null, sx = 0, sy = 0, drag = false;
        b.addEventListener('pointerdown', e => { if (solved() || id !== null) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; drag = false; try { b.setPointerCapture(id); } catch (err) { /* ignore */ } });
        b.addEventListener('pointermove', e => {
          if (e.pointerId !== id) return; const dx = e.clientX - sx, dy = e.clientY - sy;
          if (!drag && Math.hypot(dx, dy) > 12) { drag = true; b.classList.add('dragging'); $$('.piece.sel', jig).forEach(x => x.classList.remove('sel')); sel = null; sfx('tap'); }
          if (drag) b.style.translate = `${dx}px ${dy}px`;
        });
        const end = (e, cancelled) => {
          if (e.pointerId !== id) return; id = null; if (!drag) return;
          drag = false; dragT = Date.now(); b.classList.remove('dragging'); b.style.translate = '';
          const t = cancelled || solved() ? null : $$('.piece', jig).find(p => { if (p === b) return false; const r = p.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
          if (t) swap(+b.dataset.s, +t.dataset.s);
        };
        b.addEventListener('pointerup', e => end(e, false)); b.addEventListener('pointercancel', e => end(e, true));
      });
    };
    draw(); speak(TH().jigsaw);
  });
}

// ================= creative arts =================
const A = () => L().art;
const PAINT_COLORS = ['#ff4d4d', '#ff9f1c', '#ffd60a', '#4cc47c', '#3a86ff', '#9b5de5', '#ff70a6', '#8d5524', '#2d3142'];
const STAMPS = ['⭐', '🌸', '❤️', '🐱', '🦋', '🌈', '☀️', '🐟', '🌳', '🏠', '🚗', '🎈'];
function studioFrame(title, extraTop = '') {
  return `<div class="screen studio"><header class="bar"><button class="ic home" aria-label="home">🏠</button>
    <div class="stitle">${title}</div>${extraTop}<button class="btn teal donebtn">✅ ${esc(A().done)}</button></header>`;
}
async function saveArt(blob, label) {
  if (!blob) return;
  await idb.set('photos', Date.now(), { blob, label, date: today() });
}
// Paint / Magic mirror / Read & draw
function paintStudio(opts = {}) {
  return new Promise(resolve => {
    clearIdle(); stopSpeech();
    const word = opts.word ? pickFresh('readDraw', knownWords()) : null;
    const title = word ? `<span class="wordchip">${esc(word.w)}</span>` : esc(opts.mirror ? A().mirrorTitle : A().paintTitle);
    app.innerHTML = studioFrame(title) + `
      <div class="paintwrap ${opts.mirror ? 'mirror' : ''}"><canvas class="paint"></canvas></div>
      <div class="tools">
        ${PAINT_COLORS.map((c, i) => `<button class="sw ${i === 0 ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}
        <button class="tool" data-t="rainbow">🌈</button><button class="tool" data-t="eraser">🧽</button><span class="sep"></span>
        ${[1, 2, 3].map(s => `<button class="size ${s === 2 ? 'on' : ''}" data-s="${s}"><i style="width:${s * 9}px;height:${s * 9}px"></i></button>`).join('')}
        <span class="sep"></span><button class="tool" data-t="stamp">${STAMPS[0]}</button>
        <button class="tool ${opts.mirror ? 'on' : ''}" data-t="mirror">🪞</button><button class="tool" data-t="undo">↩️</button><button class="tool" data-t="clear">🗑️</button>
      </div></div>`;
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    $('.home').onclick = () => { sfx('tap'); finish(null); };
    const wrap = $('.paintwrap'), cv = $('.paint'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
    let W = wrap.clientWidth, H = wrap.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.scale(dpr, dpr); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    // tablet rotated: resize the canvas and keep her picture (the mirror line follows the new middle)
    const onResize = () => {
      if (!cv.isConnected) return removeEventListener('resize', onResize);
      const nW = wrap.clientWidth, nH = wrap.clientHeight; if (nW === W && nH === H) return;
      const old = document.createElement('canvas'); old.width = cv.width; old.height = cv.height; old.getContext('2d').drawImage(cv, 0, 0);
      W = nW; H = nH; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(old, 0, 0, old.width / dpr, old.height / dpr);
      undo.length = 0;
    };
    addEventListener('resize', onResize);
    let color = PAINT_COLORS[0], size = 2, mode = 'brush', stampI = 0, mirror = !!opts.mirror, hue = 0, drawing = false, last = null, strokes = 0;
    const undo = [];
    const widths = [0, 8, 18, 38];
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const line = (a, b) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = widths[size];
      ctx.strokeStyle = mode === 'eraser' ? '#fff' : mode === 'rainbow' ? `hsl(${hue = (hue + 5) % 360} 90% 55%)` : color;
      const seg = (p, q) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
      seg(a, b); if (mirror) seg({ x: W - a.x, y: a.y }, { x: W - b.x, y: b.y });
    };
    const stamp = p => {
      ctx.font = `${widths[size] * 2.2 + 20}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(STAMPS[stampI], p.x, p.y); if (mirror) ctx.fillText(STAMPS[stampI], W - p.x, p.y);
    };
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 6) undo.shift();   // 6 steps back is plenty and kinder to tablet memory
      const p = pos(e); strokes++;
      if (mode === 'stamp') { stamp(p); sfx('pop'); burst(e.clientX, e.clientY, 10); return; }
      drawing = true; last = p; line(p, { x: p.x + .1, y: p.y + .1 });
    });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const p = pos(e); line(last, p); last = p; });
    const up = () => { drawing = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const setOn = (sel, el) => { $$(sel).forEach(x => x.classList.toggle('on', x === el)); };
    $$('.sw').forEach(b => b.onclick = () => { color = b.dataset.c; mode = 'brush'; setOn('.sw', b); $$('.tool').forEach(t => t.dataset.t !== 'mirror' && t.classList.remove('on')); sfx('tap'); });
    $$('.size').forEach(b => b.onclick = () => { size = +b.dataset.s; setOn('.size', b); sfx('tap'); });
    let clearArmed = false;
    $$('.tool').forEach(b => b.onclick = () => {
      const t = b.dataset.t; sfx('tap');
      if (t === 'rainbow' || t === 'eraser') { mode = t; $$('.sw').forEach(x => x.classList.remove('on')); $$('.tool').forEach(x => x.dataset.t !== 'mirror' && x.classList.toggle('on', x === b)); }
      else if (t === 'stamp') {
        if (mode === 'stamp') { stampI = (stampI + 1) % STAMPS.length; b.textContent = STAMPS[stampI]; }
        mode = 'stamp'; $$('.sw').forEach(x => x.classList.remove('on')); $$('.tool').forEach(x => x.dataset.t !== 'mirror' && x.classList.toggle('on', x === b));
      }
      else if (t === 'mirror') { mirror = !mirror; b.classList.toggle('on', mirror); wrap.classList.toggle('mirror', mirror); }
      else if (t === 'undo') { const img = undo.pop(); if (img) ctx.putImageData(img, 0, 0); }
      else if (t === 'clear') {
        if (!clearArmed) { clearArmed = true; b.classList.add('wobble'); speak(A().clearAgain); setTimeout(() => { clearArmed = false; b.classList.remove('wobble'); }, 3000); return; }
        clearArmed = false; undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      }
    });
    $('.donebtn').onclick = async () => {
      $('.donebtn').disabled = true; sfx('win'); rain();
      // saving to the gallery must never leave her stuck on this screen
      try { const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .85)); await saveArt(blob, word ? word.w : 'art'); } catch (e) { /* gallery copy is optional */ }
      tally('art'); save();
      if (word) {
        const rv = document.createElement('div'); rv.className = 'reveal'; rv.innerHTML = `<div class="prize">${word.e}</div>`; wrap.appendChild(rv);
        await speak(A().itWas, word.w, ...praiseParts());
      } else await speak(A().saved);
      await sleep(400); finish(true);
    };
    speak(word ? A().readDraw : opts.mirror ? A().mirrorSay : A().paintSay);
  });
}

// Render the coloured-in picture to a JPEG for the gallery. Styles from the stylesheet don't travel with a
// standalone SVG image, so outlines/white fills/labels are written inline on a copy first.
async function svgToJpeg(svgEl) {
  const copy = svgEl.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '800'); copy.setAttribute('height', '600');
  copy.querySelectorAll('.reg').forEach(r => {
    r.setAttribute('fill', r.style.fill || '#ffffff'); r.setAttribute('stroke', '#2d3142'); r.setAttribute('stroke-width', '3');
    r.setAttribute('stroke-linejoin', 'round'); r.removeAttribute('style'); r.removeAttribute('class');
  });
  copy.querySelectorAll('.lbl').forEach(t => { t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700'); t.setAttribute('font-family', 'sans-serif');
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'central'); t.setAttribute('fill', '#2d3142'); });
  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg image failed to load')); img.src = src; });
  const c = document.createElement('canvas'); c.width = 800; c.height = 600;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 800, 600); g.drawImage(img, 0, 0, 800, 600);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .85));
}

// Colour by number
const CBN_COLORS = { 1: ['#ff4d4d', 'red'], 2: ['#ffd60a', 'yellow'], 3: ['#3a86ff', 'blue'], 4: ['#4cc47c', 'green'],
  5: ['#ff9f1c', 'orange'], 6: ['#9b5de5', 'purple'], 7: ['#8d5524', 'brown'], 8: ['#ff70a6', 'pink'] };
// each region: [number, svg shape, labelX, labelY]
const CBN_PICS = [
  [[3, '<rect x="2" y="2" width="396" height="228"/>', 40, 40], [2, '<circle cx="335" cy="60" r="36"/>', 335, 60],
    [4, '<rect x="2" y="230" width="396" height="68"/>', 40, 270], [5, '<rect x="110" y="130" width="180" height="130"/>', 135, 240],
    [1, '<polygon points="92,136 200,52 308,136"/>', 200, 108], [7, '<rect x="182" y="190" width="44" height="70"/>', 204, 228],
    [2, '<rect x="128" y="152" width="38" height="36"/>', 147, 170], [2, '<rect x="242" y="152" width="38" height="36"/>', 261, 170]],
  [[3, '<rect x="2" y="2" width="396" height="230"/>', 40, 40], [2, '<path d="M2 232 Q100 212 200 232 T398 232 V298 H2Z"/>', 330, 270],
    [5, '<ellipse cx="190" cy="130" rx="95" ry="58"/>', 175, 140], [1, '<polygon points="280,130 345,80 345,180"/>', 322, 130],
    [6, '<path d="M150 76 Q190 30 230 76Z"/>', 190, 64], [4, '<path d="M60 232 Q40 180 70 140 Q90 180 75 232Z"/>', 66, 200],
    [4, '<path d="M350 232 Q335 190 360 160 Q378 195 365 232Z"/>', 357, 210]],
  [[8, '<circle cx="200" cy="80" r="34"/>', 200, 64], [8, '<circle cx="245" cy="115" r="34"/>', 262, 115], [8, '<circle cx="155" cy="115" r="34"/>', 138, 115],
    [8, '<circle cx="225" cy="160" r="30"/>', 238, 172], [8, '<circle cx="175" cy="160" r="30"/>', 162, 172], [2, '<circle cx="200" cy="122" r="26"/>', 200, 122],
    [4, '<rect x="193" y="186" width="14" height="70"/>', 228, 230], [4, '<ellipse cx="160" cy="225" rx="30" ry="12" transform="rotate(-25 160 225)"/>', 158, 225],
    [7, '<polygon points="145,256 255,256 240,296 160,296"/>', 200, 278], [3, '<circle cx="60" cy="60" r="28"/>', 60, 60]],
  [[6, '<rect x="2" y="2" width="396" height="296"/>', 40, 40], [5, '<rect x="165" y="80" width="70" height="140" rx="10"/>', 200, 195],
    [1, '<path d="M165 82 Q200 0 235 82Z"/>', 200, 55], [3, '<circle cx="200" cy="130" r="20"/>', 200, 130],
    [1, '<polygon points="165,170 130,230 165,220"/>', 154, 210], [1, '<polygon points="235,170 270,230 235,220"/>', 246, 210],
    [2, '<polygon points="175,220 225,220 200,285"/>', 200, 243], [2, '<polygon points="60,50 66,64 80,64 69,73 73,88 60,79 47,88 51,73 40,64 54,64"/>', 60, 70],
    [2, '<circle cx="330" cy="240" r="16"/>', 330, 240]],
];
function colourByNumber() {
  return new Promise(resolve => {
    clearIdle(); stopSpeech();
    const pic = pick(CBN_PICS), nums = [...new Set(pic.map(r => r[0]))].sort();
    app.innerHTML = studioFrame('🖍️ 1 · 2 · 3') + `
      <div class="cbnwrap"><svg class="cbn" viewBox="0 0 400 300">${pic.map((r, i) => r[1].replace(/^<(\w+)/, `<$1 data-i="${i}" class="reg"`)).join('')}
        ${pic.map((r, i) => `<text class="lbl" data-i="${i}" x="${r[2]}" y="${r[3]}">${r[0]}</text>`).join('')}</svg></div>
      <div class="tools">${nums.map((n, i) => `<button class="sw num ${i === 0 ? 'on' : ''}" data-n="${n}" style="background:${CBN_COLORS[n][0]}">${n}</button>`).join('')}</div></div>`;
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    $('.home').onclick = () => { sfx('tap'); finish(null); };
    let sel = nums[0], left = pic.length;
    const colName = n => A().colours[CBN_COLORS[n][1]];
    $$('.sw').forEach(b => b.onclick = () => { sel = +b.dataset.n; $$('.sw').forEach(x => x.classList.toggle('on', x === b)); sfx('tap'); speak(String(sel), colName(sel)); });
    $$('.reg').forEach(el => el.addEventListener('click', async () => {
      const i = +el.dataset.i, n = pic[i][0];
      if (el.classList.contains('filled')) return;
      if (n === sel) {
        el.classList.add('filled'); el.style.fill = CBN_COLORS[n][0]; $(`.lbl[data-i="${i}"]`).remove(); sfx('pop');
        const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 12); left--;
        if (!left) {
          sfx('win'); rain(); tally('art'); tally('cbn'); save();
          try { await saveArt(await svgToJpeg($('.cbn')), 'colouring'); } catch (e) { window.__cbnSaveError = String(e && e.message || e); }
          await speak(A().cbnDone, ...praiseParts()); await sleep(400); finish(true);
        }
      } else {
        sfx('oops'); el.classList.remove('wobble'); void el.getBoundingClientRect(); el.classList.add('wobble');
        $$('.sw').forEach(x => x.classList.toggle('hint', +x.dataset.n === n)); setTimeout(() => $$('.sw.hint').forEach(x => x.classList.remove('hint')), 2500);
        speak(A().thisIs(n, colName(n)));
      }
    }));
    $('.donebtn').onclick = () => { sfx('tap'); finish(left < pic.length ? true : null); };
    speak(A().cbnSay);
  });
}

// Colour mixing (a quiz in the normal question engine)
const MIXES = [['red', 'yellow', 'orange'], ['blue', 'yellow', 'green'], ['red', 'blue', 'purple'], ['red', 'white', 'pink'], ['blue', 'white', 'lightblue'], ['black', 'white', 'grey']];
const HEX = { red: '#ff4d4d', yellow: '#ffd60a', blue: '#3a86ff', orange: '#ff9f1c', green: '#4cc47c', purple: '#9b5de5', pink: '#ff9ec7',
  white: '#ffffff', black: '#2d3142', grey: '#9aa0ad', lightblue: '#9ed0ff', brown: '#8d5524' };
function mkMix() {
  const [a, b, c] = pick(MIXES), C = A().colours;
  const others = shuffle(MIXES.map(m => m[2]).filter(x => x !== c)).slice(0, 2);
  const blob = (k, cls = '') => `<span class="blob ${cls}" style="--c:${HEX[k]}"></span>`;
  return { title: A().mixQ(C[a], C[b]), speak: [A().mixQ(C[a], C[b])], optClass: 'word',
    visual: `<div class="mixrow">${blob(a, 'pour l')}<span class="sign">+</span>${blob(b, 'pour r')}<span class="sign">=</span><span class="bowl"><i></i></span></div>`,
    options: shuffle([c, ...others]).map(k => ({ html: `<span class="mixopt">${blob(k)}<small>${esc(C[k])}</small></span>`, val: k })), answer: c,
    correctSpeak: [A().mixAns(C[a], C[b], C[c])], onCorrect: r => { const bw = $('.bowl i', r); if (bw) { bw.style.background = HEX[c]; bw.classList.add('fill'); } } };
}

// Music: rainbow xylophone, free play or follow-the-light songs
const NOTE_F = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
const BAR_COLORS = ['#ff4d4d', '#ff9f1c', '#ffd60a', '#4cc47c', '#20b2a0', '#3a86ff', '#9b5de5', '#ff70a6'];
const SONGS = { twinkle: [1, 1, 5, 5, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1], frere: [1, 2, 3, 1, 1, 2, 3, 1, 3, 4, 5, 3, 4, 5],
  mary: [3, 2, 1, 2, 3, 3, 3, 2, 2, 2, 3, 5, 5], lune: [1, 1, 1, 2, 3, 2, 1, 3, 2, 2, 1] };
function bell(i) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime, f = NOTE_F[i];
    tone(f, t, 1.3, 'sine', .2); tone(f * 2, t, .7, 'sine', .05); tone(f * 3, t, .25, 'triangle', .025);
  } catch (e) { /* ignore */ }
}
function musicStudio() {
  return new Promise(resolve => {
    clearIdle(); stopSpeech();
    const songBtns = Object.keys(SONGS).map(k => `<button class="songb" data-s="${k}">🎶 ${esc(A().songs[k])}</button>`).join('');
    app.innerHTML = studioFrame('🎵') + `
      <div class="songs"><button class="songb on" data-s="">🎹 ${esc(A().free)}</button>${songBtns}</div>
      <div class="xylo">${NOTE_F.map((_, i) => `<button class="xbar" data-i="${i}" style="--c:${BAR_COLORS[i]};--h:${100 - i * 7}%"><span>${i + 1}</span></button>`).join('')}</div></div>`;
    let done = false, played = 0, song = null, pos = 0, playing = false;
    const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    $('.home').onclick = () => { sfx('tap'); finish(null); };
    const bars = $$('.xbar');
    const flash = i => { const b = bars[i]; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      const r = b.getBoundingClientRect(), n = document.createElement('div'); n.className = 'note'; n.textContent = pick(['♪', '♫', '♬']);
      n.style.left = (r.left + r.width / 2 - 14) + 'px'; n.style.top = (r.top - 10) + 'px'; n.style.color = BAR_COLORS[i]; document.body.appendChild(n); setTimeout(() => n.remove(), 1200); };
    const markNext = () => { bars.forEach(b => b.classList.remove('next')); if (song) bars[SONGS[song][pos] - 1].classList.add('next'); };
    const playBack = async seq => { playing = true; for (const k of seq) { if (done) return; bell(k - 1); flash(k - 1); await sleep(420); } playing = false; };
    bars.forEach((b, i) => b.addEventListener('pointerdown', async () => {
      if (playing) return;
      bell(i); flash(i); played++;
      if (!song) return;
      if (i === SONGS[song][pos] - 1) {
        pos++;
        if (pos >= SONGS[song].length) {
          const s = song; song = null; markNext(); tally('songs'); tally('art'); save();
          sfx('win'); rain(); await sleep(600); await speak(A().songDone, ...praiseParts()); await playBack(SONGS[s]);
          $$('.songb').forEach(x => x.classList.toggle('on', !x.dataset.s));
        } else markNext();
      }
    }));
    $$('.songb').forEach(b => b.onclick = async () => {
      sfx('tap'); $$('.songb').forEach(x => x.classList.toggle('on', x === b));
      song = b.dataset.s || null; pos = 0; markNext();
      if (song) { await speak(A().songs[song], A().followSay); await playBack(SONGS[song].slice(0, 7)); markNext(); }
    });
    $('.donebtn').onclick = () => { sfx('tap'); finish(played >= 3 ? true : null); };
    speak(A().musicSay);
  });
}

// run any activity: art studios have their own screen, everything else goes through the question engine
async function runAct(a) {
  if (ACTS[a].studio) { zone(ACTS[a].area); musicMode(a === 'music' ? 'off' : 'calm'); }
  const r = ACTS[a].studio ? ((await ACTS[a].studio()) ? { first: 1, count: 1 } : null) : await runStop(a, ACTS[a].per || S.settings.perStop);
  if (r) recordPlay(a);
  return r;
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
  if (q.kind === 'readAloud') return askReadAloud(q, meta);
  if (q.kind === 'pop') return askPop(q, meta);
  if (q.kind === 'traceText') return askTraceText(q, meta);
  if (q.kind === 'memory') return askMemory(q, meta);
  if (q.kind === 'simon') return askSimon(q, meta);
  if (q.kind === 'jigsaw') return askJigsaw(q, meta);
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
      if (s.dataset.w) { resetIdle(); await say(s.dataset.w, S.lang, S.settings.rate * 1.05); }   // reading along counts as busy
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
        $('.options').hidden = false; speak(q.q); setIdle(() => nudge([q.q]));
        q.retrySpeak = [q.q]; $('.replay').onclick = () => { sfx('tap'); speak(q.q); };   // now the question is what to repeat
        run();
      };
    } else run();
    speak(...q.speak);
  });
}
// Drag an answer onto its place (`q.drop` = selector of the place). The picture follows her finger; let go on the place
// and it counts as her answer, let go anywhere else and it just slides home (never a mistake). A plain tap still works.
function dragOpt(b, target, choose) {
  let id = null, sx = 0, sy = 0, drag = false;
  b.classList.add('drag');
  const onPlace = e => {
    const t = target(); if (!t) return false;
    const r = t.getBoundingClientRect(), c = b.getBoundingClientRect(), m = 30;
    const inside = (x, y) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
    return inside(e.clientX, e.clientY) || inside(c.left + c.width / 2, c.top + c.height / 2);
  };
  const glow = on => { const t = target(); if (t) t.classList.toggle('over', on); };
  b.addEventListener('pointerdown', e => {
    if (b.disabled || id !== null) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; drag = false;
    try { b.setPointerCapture(id); } catch (err) { /* ignore */ }
  });
  b.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!drag && Math.hypot(dx, dy) > 12) { drag = true; b.classList.add('dragging'); sfx('tap'); }
    if (drag) { b.style.translate = `${dx}px ${dy}px`; glow(onPlace(e)); }
  });
  const end = (e, cancelled) => {
    if (e.pointerId !== id) return; id = null;
    if (!drag) return;
    const hit = !cancelled && onPlace(e);
    drag = false; b._dragT = Date.now(); b.classList.remove('dragging'); b.style.translate = ''; glow(false);
    if (hit) choose(b);
  };
  b.addEventListener('pointerup', e => end(e, false));
  b.addEventListener('pointercancel', e => end(e, true));
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
    const choose = async b => {
      if (busy || b.disabled) return;
      const o = q.options[+b.dataset.i];
      if (String(o.val) === String(q.answer)) {
        busy = true; b.classList.add('correct'); btns.forEach(x => { if (x !== b) x.disabled = true; });
        const at = (q.drop && $(q.drop, root)) || b;   // drag games: the picture lands in its place, so the party is there
        if (q.drop) b.classList.add('placed');
        if (q.onCorrect) q.onCorrect(root); else if (q.drop && at !== b) { at.innerHTML = o.html; at.classList.remove('over'); at.classList.add('filled'); }
        const first = attempts === 0;
        stopSpeech(); sfx('good'); burstAt(at, first ? 50 : 20); owlReact('happy');
        if (first) flyStar(at); else tally('retryOk');
        lastWrong = (q.wrong || [])[0] || ''; q.grade && q.grade(first); lastWrong = ''; logDay(first); save();
        const cb = comboHit(first);
        await sleep(300);   // let the chime finish before Tiko talks
        await speak(...(q.correctSpeak || []), ...(first ? (cb ? [cb] : praiseParts()) : []));
        await sleep(350); finish(first);
      } else {
        attempts++; const mine = attempts; (q.wrong = q.wrong || []).push(String(o.val)); b.classList.add('wrong'); b.disabled = true; stopSpeech(); sfx('oops'); owlReact('think');
        if (q.onMiss) q.onMiss(root, attempts);   // a cue that only ever appears after a miss (so it can't turn a guess into "known")
        await sleep(350);   // the soft "oops" first, then Tiko
        if (mine !== attempts || busy || done) return;   // she already tapped again (or got it right) — that tap takes over
        if (attempts === 1 && btns.length > 2) speak(L().retry, { pause: 150 }, ...(q.retrySpeak || q.speak));
        else {
          // second miss: Tiko shows HOW (puts together / takes away / counts with ticks), then the answer glows
          if (q.explain && !q.__explained) { q.__explained = true; busy = true; stopSpeech(); await q.explain(root); busy = false; }
          const c = btns.find(x => String(q.options[+x.dataset.i].val) === String(q.answer)); c.classList.add('hint'); speak(L().itsThis, ...(q.correctSpeak || []));
        }
      }
    };
    btns.forEach(b => b.addEventListener('click', () => { if (Date.now() - (b._dragT || 0) > 500) choose(b); }));
    if (q.drop) btns.forEach(b => dragOpt(b, () => $(q.drop, root), choose));
    // brand-new item: all choices shown, the right one glows (errorless first meeting)
    const glowNew = () => { if (!q.hintNew) return; const c = btns.find(x => String(q.options[+x.dataset.i].val) === String(q.answer)); if (c) c.classList.add('hint'); };
    if (q.setup) q.setup(root, () => { box.hidden = false; glowNew(); });
    if (!q.gate) glowNew();
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
        speak({ unit: units[pos] }); pos++;   // just the letter sound — no click on top of it
        if (pos === units.length) {
          const first = misses === 0;
          sfx('good'); burstAt($('.slots'), 60); owlReact('happy'); if (first) flyStar($('.slots'));
          tally('built'); if (!first) tally('retryOk');
          q.grade(first); logDay(first); save();
          const cb = comboHit(first);
          await unitChain; await sleep(300); await speak(q.item.w, ...(first ? (cb ? [cb] : praiseParts()) : []));
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

// ---------- bubble pop: tap every bubble that matches ----------
function askPop(q, meta) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const cols = 4, rows = Math.ceil(q.bubbles.length / cols);
    app.innerHTML = actFrame(meta, `${promptHTML(q.title)}<div class="pond" style="--rows:${rows}">${q.bubbles.map((b, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return `<button class="bub" data-i="${i}" style="left:${(c + .5) / cols * 100 + (rand(9) - 4)}%;top:${(r + .5) / rows * 100 + (rand(9) - 4)}%;--d:${(2.4 + Math.random() * 1.6).toFixed(2)}s;--w:${(-Math.random() * 3).toFixed(2)}s;--h:${rand(360)}">${esc(b.t)}</button>`;
    }).join('')}</div>`);
    wire(meta, finish, () => speak(...q.speak), q.speak);
    let left = q.bubbles.filter(b => b.ok).length, misses = 0;
    $$('.bub').forEach(el => el.addEventListener('click', async () => {
      if (el.classList.contains('popped')) return;
      const b = q.bubbles[+el.dataset.i];
      if (b.ok) {
        el.classList.add('popped'); burstAt(el, 25); sfx('pop'); left--;
        if (!left) {
          const first = misses === 0;
          sfx('good'); owlReact('happy'); if (first) flyStar($('.pond')); else tally('retryOk');
          q.grade(first); logDay(first); save();
          const cb = comboHit(first);
          await sleep(300); await speak(...(first ? (cb ? [cb] : praiseParts()) : [pick(L().praise)]));
          await sleep(300); finish(first);
        }
      } else {
        misses++; el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); sfx('oops'); owlReact('think');
        if (misses >= 2) $$('.bub').forEach((x, i) => { if (q.bubbles[i].ok && !x.classList.contains('popped')) x.classList.add('hint'); });
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
    // whole pixels! a fractional size (e.g. 480.8 on a 601-px-wide tablet) scrambled the letter-shape check below
    const size = Math.floor(Math.min(innerWidth * 0.8 - (q.hint ? 110 : 0), innerHeight * 0.52, 520));   // room for the picture beside it
    app.innerHTML = actFrame(meta, `${promptHTML(P.trace)}
      <div style="display:flex;align-items:center;gap:20px">${q.hint ? `<div class="pic bob" style="font-size:80px">${q.hint}</div>` : ''}
      <div class="tracebox" style="width:${size}px;height:${size}px"><canvas class="guide"></canvas><canvas class="cue"></canvas><canvas class="ink"></canvas></div></div>
      <div class="meter"><i></i></div>
      <div class="btnrow"><button class="btn again">🔄 ${P.clear}</button><button class="btn teal tracedone" hidden>✅ ${esc(P.done)}</button></div>`);
    wire(meta, finish, () => speak(P.trace, ...q.say), [P.trace]);
    try { await document.fonts.load(`700 ${Math.round(size * .8)}px Andika`); } catch (e) { /* fallback font */ }
    const box = $('.tracebox'), gC = $('.guide'), iC = $('.ink'), cC = $('canvas.cue'), dpr = devicePixelRatio || 1;
    [gC, iC, cC].forEach(c => { c.width = size * dpr; c.height = size * dpr; c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); });
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
    // She must trace (nearly) the WHOLE letter: ~70% of its shape. Nothing finishes it early by time.
    // A "Done!" button appears only once she has traced at least half, as a backup if she can't quite finish.
    const GOAL = .7;
    let covered = 0, drawing = false, last = null, hue = 0, success = false, inkTime = 0, lastMove = 0, resets = 0;
    const R = size * .12, meter = $('.meter i');
    const reset = () => { ink.clearRect(0, 0, size, size); pts.forEach(p => p.c = false); covered = 0; meter.style.width = '0%'; };
    const pos = e => { const r = iC.getBoundingClientRect(); return { x: (e.clientX - r.left) * size / r.width, y: (e.clientY - r.top) * size / r.height }; };
    const mark = p => {
      for (const t of pts) if (!t.c && (t.x - p.x) ** 2 + (t.y - p.y) ** 2 < R * R) { t.c = true; covered++; }
      meter.style.width = Math.min(100, covered / pts.length / GOAL * 100) + '%';
      if (covered / pts.length >= .6) $('.tracedone').hidden = false;   // backup only when she's nearly there
    };
    const enough = () => covered / pts.length >= GOAL;
    // Cue 1: a green "start here" dot where the pencil first touches down (it goes away once she starts).
    const startPt = (() => {
      const ch = q.glyph[0], all = pts.length ? pts : null; if (!all) return null;
      const x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x)), wAll = x1 - x0;
      const mine = q.glyph.length > 1 ? all.filter(p => p.x <= x0 + wAll / q.glyph.length) : all; if (!mine.length) return null;
      const a = Math.min(...mine.map(p => p.x)), b = Math.max(...mine.map(p => p.x)), t = Math.min(...mine.map(p => p.y)), u = Math.max(...mine.map(p => p.y)), w = b - a, h = u - t;
      // where a child starts each shape: round letters at the top right of the curve, most others at the top left
      const [fx, fy] = 'acgoqsf0689'.includes(ch) ? [.85, .1] : ch === 'd' ? [.7, .42] : ch === 'e' ? [.15, .5] : 'ij'.includes(ch) ? [.3, .38] : [0, 0];
      const tx = a + w * fx, ty = t + h * fy;
      return mine.reduce((m, p) => ((p.x - tx) ** 2 + (p.y - ty) ** 2 < (m.x - tx) ** 2 + (m.y - ty) ** 2 ? p : m));
    })();
    if (startPt) box.insertAdjacentHTML('beforeend', `<i class="startdot" style="left:${startPt.x}px;top:${startPt.y}px"></i>`);
    // Cue 2: if she stops part-way, the bits not traced yet glow softly for a moment. It never finishes the letter for her.
    const cg = cC.getContext('2d'); let stallT = null;
    const hideCue = () => { clearTimeout(stallT); cC.classList.remove('show'); };
    const showCue = () => {
      if (done || success || drawing || !covered) return;
      cg.clearRect(0, 0, size, size); cg.fillStyle = '#ff8fb8';
      pts.forEach(p => { if (!p.c) { cg.beginPath(); cg.arc(p.x, p.y, step * .75, 0, 7); cg.fill(); } });
      cC.classList.add('show'); stallT = setTimeout(() => cC.classList.remove('show'), 3500);
    };
    iC.addEventListener('pointerdown', () => { hideCue(); const d = $('.startdot', box); if (d) d.remove(); });
    iC.addEventListener('pointerdown', e => { if (success) return; drawing = true; last = pos(e); try { iC.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } mark(last); });
    iC.addEventListener('pointermove', e => {
      if (!drawing) return; const p = pos(e);
      // also mark points in between fast finger moves so quick strokes still count
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / (R / 2)));
      for (let s = 1; s <= steps; s++) mark({ x: last.x + (p.x - last.x) * s / steps, y: last.y + (p.y - last.y) * s / steps });
      ink.strokeStyle = `hsl(${hue = (hue + 4) % 360} 85% 60%)`; ink.lineWidth = size * .07; ink.lineCap = 'round'; ink.lineJoin = 'round';
      ink.beginPath(); ink.moveTo(last.x, last.y); ink.lineTo(p.x, p.y); ink.stroke(); last = p;
      const now = performance.now(); if (now - lastMove < 200) inkTime += now - lastMove; lastMove = now;
    });
    const succeed = async () => {
      if (success) return;
      success = true; $('.tracedone').hidden = true; sfx('win'); burstAt(box, 80); owlReact('happy'); flyStar(box); tally('traces'); logDay(true); save();
      await speak(...praiseParts(), ...q.say);
      await askPaperStep(P.nowPaper, `<div class="wordbig">${esc(q.glyph)}</div>`);
      finish(true);
    };
    const up = () => { if (!drawing) return; drawing = false; if (!success && enough()) succeed(); else if (!success) { clearTimeout(stallT); stallT = setTimeout(showCue, 6000); } };
    iC.addEventListener('pointerup', up); iC.addEventListener('pointercancel', up);
    $('.again').onclick = () => { sfx('tap'); resets++; hideCue(); reset(); };
    $('.tracedone').onclick = () => { sfx('tap'); succeed(); };
    speak(P.trace, ...q.say);
  });
}

// ---------- listen & trace: words (sound by sound) and sentences (word by word) ----------
function mkTraceWord() {
  const w = pickFresh('traceWord', notKnown(wordsNow())), T2 = L().tr;   // any word at her level, a different one each time
  return { kind: 'traceText', intro: T2.word, items: [{ text: w.w, units: w.units, say: w.w }], full: w.w, pic: w.e, paper: T2.nowWord };
}
function mkTraceSentence() {
  const w = pickFresh('traceSentence', knownWords()), s = pick(SENTENCES[S.lang])(w.w), T2 = L().tr;
  const words = s.split(' ').filter(t => /\p{L}/u.test(t));
  return { kind: 'traceText', intro: T2.sentence, items: words.map(t => ({ text: t, units: null, say: t.replace(/[.,!?;:]/g, '') })),
    full: s, pic: w.e, paper: T2.nowSentence };
}
function askTraceText(q, meta) {
  return new Promise(async resolve => {
    let done = false; const finish = v => { if (done) return; done = true; stopSpeech(); resolve(v); };
    const multi = q.items.length > 1;
    let idx = 0;
    app.innerHTML = actFrame(meta, `${promptHTML(q.intro)}
      ${multi ? `<div class="strip">${q.items.map((it, i) => `<span class="sw-${i}">${esc(it.text)}</span>`).join(' ')}</div>` : ''}
      <div class="tracebox wide"><canvas class="guide"></canvas><canvas class="ink"></canvas></div>
      <div class="chips"></div><div class="meter"><i></i></div>
      <div class="btnrow"><button class="btn again">🔄 ${L().paper.clear}</button><button class="btn teal tracedone" hidden>✅ ${esc(L().paper.done)}</button></div>`);
    const curSay = () => q.items[idx].say;
    wire(meta, finish, () => speak(curSay()), [curSay()]);
    try { await document.fonts.load('700 100px Andika'); } catch (e) { /* fallback font */ }
    const box = $('.tracebox'), gC = $('.guide'), iC = $('.ink'), dpr = devicePixelRatio || 1;
    const Wd = Math.floor(Math.min(innerWidth * .92, 1000)), Ht = Math.floor(Math.min(innerHeight * (multi ? .32 : .36), 300));
    box.style.width = Wd + 'px'; box.style.height = Ht + 'px';
    [gC, iC].forEach(c => { c.width = Wd * dpr; c.height = Ht * dpr; c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); });
    const g = gC.getContext('2d'), ink = iC.getContext('2d');
    let pts = [], segs = [], R = 20, covered = 0, drawing = false, last = null, hue = 0, inkTime = 0, lastMove = 0, resets = 0, busy = false;
    let soundChain = Promise.resolve();
    const meter = $('.meter i');

    const setup = () => {
      const it = q.items[idx];
      const parts = it.units ? it.units : [...it.text];                     // sound units for single words, letters for sentence words
      const texts = parts.map(unitText);
      let fs = Ht * .72;
      const fontOf = s => `700 ${Math.round(s)}px Andika, 'Comic Sans MS', sans-serif`;
      g.font = fontOf(fs); while (g.measureText(it.text).width > Wd * .9 && fs > 30) { fs -= 4; g.font = fontOf(fs); }
      R = fs * .16;
      const x0 = (Wd - g.measureText(it.text).width) / 2, y = Ht / 2 + fs * .05;
      g.clearRect(0, 0, Wd, Ht); ink.clearRect(0, 0, Wd, Ht);
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = '#efe8fb'; g.fillText(it.text, x0, y);
      g.setLineDash([7, 9]); g.lineWidth = 2.5; g.strokeStyle = '#9b7fd1'; g.strokeText(it.text, x0, y); g.setLineDash([]);
      // segment x-ranges from text widths
      let acc = 0; segs = texts.map((t, i) => { const a = x0 + acc; acc += g.measureText(t).width; return { a, b: x0 + acc, unit: parts[i], text: t, n: 0, c: 0, done: false }; });
      // sample the letters' shape
      const m = document.createElement('canvas'); m.width = Math.ceil(Wd); m.height = Math.ceil(Ht); const mc = m.getContext('2d');
      mc.font = g.font; mc.textAlign = 'left'; mc.textBaseline = 'middle'; mc.fillText(it.text, x0, y);
      const d = mc.getImageData(0, 0, m.width, m.height).data, step = Math.max(5, Math.round(fs / 22));
      pts = [];
      for (let yy = 0; yy < m.height; yy += step) for (let xx = 0; xx < m.width; xx += step) if (d[(yy * m.width + xx) * 4 + 3] > 128) {
        const si = segs.findIndex(s => xx >= s.a && xx < s.b); if (si < 0 || !/\p{L}/u.test(segs[si].text)) continue;   // full stops, ! and ? don't need tracing
        pts.push({ x: xx, y: yy, c: false, s: si }); segs[si].n++;
      }
      covered = 0; inkTime = 0; resets = 0; meter.style.width = '0%'; $('.tracedone').hidden = true;
      $('.chips').innerHTML = it.units ? segs.map((s, i) => `<span class="chip ${s.unit.startsWith('_') ? 'silent' : ''}" data-i="${i}">${esc(s.text)}</span>`).join('') : '';
      if (multi) $$('.strip span').forEach((sp, i) => { sp.classList.toggle('now', i === idx); sp.classList.toggle('did', i < idx); });
    };
    const pos = e => { const r = iC.getBoundingClientRect(); return { x: (e.clientX - r.left) * Wd / r.width, y: (e.clientY - r.top) * Ht / r.height }; };
    const mark = p => {
      for (const t of pts) if (!t.c && (t.x - p.x) ** 2 + (t.y - p.y) ** 2 < R * R) { t.c = true; covered++; segs[t.s].c++; }
      meter.style.width = Math.min(100, covered / Math.max(1, pts.length) / .65 * 100) + '%';
      if (covered / Math.max(1, pts.length) >= .55) $('.tracedone').hidden = false;   // backup only when she's nearly there
      // sounds play strictly in reading order: a part counts once she has traced about half of it
      // AND every part before it is done (so "cat" is always c… a… t, never t first)
      const queue = [];
      for (const [i, s] of segs.entries()) {
        if (s.done || !s.n) continue;
        if (s.c / s.n < .5) break;
        s.done = true; queue.push(i);
      }
      playParts(queue);
    };
    // one shared queue, so sounds from separate finger moves can never overlap or jump the order
    const playParts = list => {
      for (const i of list) {
        const s = segs[i], it = q.items[idx];
        soundChain = soundChain.then(async () => {
          const chip = $(`.chip[data-i="${i}"]`); if (chip) chip.classList.add('lit');
          if (it && it.units && !s.unit.startsWith('_')) await playUnit(s.unit, S.lang, 1.05); else sfx('tap');
        });
      }
    };
    // She must trace the whole word: ~65% overall AND every letter at least half traced. Nothing finishes it by time.
    const complete = () => {
      const all = covered / Math.max(1, pts.length);
      return all >= .65 && segs.every(s => !s.n || s.c / s.n >= .5);
    };
    iC.addEventListener('pointerdown', e => { if (busy) return; drawing = true; last = pos(e); try { iC.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } mark(last); });
    iC.addEventListener('pointermove', e => {
      if (!drawing) return; const p = pos(e);
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / (R / 2)));
      for (let s2 = 1; s2 <= steps; s2++) mark({ x: last.x + (p.x - last.x) * s2 / steps, y: last.y + (p.y - last.y) * s2 / steps });
      ink.strokeStyle = `hsl(${hue = (hue + 4) % 360} 85% 60%)`; ink.lineWidth = R * .55; ink.lineCap = 'round'; ink.lineJoin = 'round';
      ink.beginPath(); ink.moveTo(last.x, last.y); ink.lineTo(p.x, p.y); ink.stroke(); last = p;
      const now = performance.now(); if (now - lastMove < 200) inkTime += now - lastMove; lastMove = now;
    });
    const up = () => { if (!drawing) return; drawing = false; if (!busy && complete()) advance(); };
    const advance = async () => {
      if (busy) return;
      busy = true; $('.tracedone').hidden = true;
      // any parts not sounded yet are played now, in order, so she always hears the whole word built up
      const rest = segs.map((s, i) => i).filter(i => segs[i].n && !segs[i].done); rest.forEach(i => { segs[i].done = true; }); playParts(rest);
      await soundChain; sfx('good'); burstAt(box, 40); owlReact('happy');
      await sleep(250); await speak(curSay());
      idx++;
      if (idx < q.items.length) { setup(); busy = false; return; }
      // all done: hear the whole thing, see the picture, then copy it on paper
      sfx('win'); flyStar(box); tally('traces'); logDay(true); save();
      if (multi) $$('.strip span').forEach(sp => { sp.classList.remove('now'); sp.classList.add('did'); });
      await speak(q.full, ...praiseParts());
      await askPaperStep(q.paper, `<div class="wordbig">${esc(q.full)}</div><div class="pic">${q.pic}</div>`);
      finish(true);
    };
    iC.addEventListener('pointerup', up); iC.addEventListener('pointercancel', up);
    $('.again').onclick = () => { sfx('tap'); const r = resets + 1; setup(); resets = r; };
    $('.tracedone').onclick = () => { sfx('tap'); advance(); };
    setup();
    speak(q.intro, { pause: 200 }, multi ? q.full : curSay());
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
    clearIdle();   // she's writing on paper — no "Your turn!" nudges
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
    clearIdle();   // paper work takes time — no "Your turn!" nudges while she writes
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
  zone((ACTS[act] || {}).area); musicMode('work');
  if ((act === 'add' || act === 'sub') && (S.demoDay || {})[act] !== today()) {
    const ok = await conceptDemo(act);
    if (!ok) { clearIdle(); return null; }
    S.demoDay = { ...(S.demoDay || {}), [act]: today() }; save();
  }
  for (let i = 0; i < count; i++) {
    const q = ACTS[act].make();
    const r = await ask(q, { index: i, count, act });
    if (r === null) { clearIdle(); save(); return null; }
    if (r) first++;
  }
  clearIdle(); save();
  return { first, count };
}

// ================= 🎤 Read it to Tiko: she is the reader =================
// No picture to guess from: she reads a word (later a sentence) out loud, hears herself back, then hears Tiko read it.
// Her recordings stay on this tablet, for her parents to listen to in the Parent corner.
T.en.ra = { title: 'Read it to me!', start: 'Start', stop: 'I finished', listen: 'Listen to yourself!', again: 'Again', done: 'I read it!',
  mine: 'Now listen to me.', noMic: 'Read it out loud to a grown-up!', listening: "I'm listening…" };
T.fr.ra = { title: 'Lis-le-moi !', start: 'Commencer', stop: "J'ai fini", listen: 'Écoute-toi !', again: 'Encore', done: "Je l'ai lu !",
  mine: 'Maintenant, écoute-moi.', noMic: 'Lis-le à voix haute à un adulte !', listening: "Je t'écoute…" };
function mkReadAloud() {
  const w = pickFresh('readAloud', knownWords());
  const text = stageOf() >= 3 ? pickFresh('sentenceT', SENTENCES[S.lang].map((f, i) => ({ id: i, f }))).f(w.w) : w.w;
  return { kind: 'readAloud', title: L().ra.title, speak: [L().ra.title], lines: [text] };
}
async function keepReading(blob, text) {
  try {
    const k = 'read:' + Date.now(); await idb.set('rec', k, blob);
    S.readings = S.readings || []; S.readings.unshift({ k, text, lang: S.lang, d: today() });
    for (const old of S.readings.splice(12)) idb.del('rec', old.k).catch(() => {});
  } catch (e) { /* storage full or unavailable: the activity still works */ }
}
function askReadAloud(q, meta) {
  return new Promise(resolve => {
    let done = false, mr = null, stream = null, blob = null, timer = 0;
    const R = L().ra;
    const release = () => { clearTimeout(timer); if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
    const finish = v => { if (done) return; done = true; try { if (mr && mr.state === 'recording') mr.stop(); } catch (e) { /* ignore */ } release(); musicMode('work'); stopSpeech(); resolve(v); };
    app.innerHTML = actFrame(meta, `${promptHTML(q.title)}<div class="visual">${readerHTML(q.lines)}</div>
      <div class="btnrow ra"><button class="btn primary huge pulse recb">🎤 ${R.start}</button></div>`);
    const row = $('.ra');
    wire(meta, finish, () => speak(...q.speak), q.speak);
    const complete = async () => {
      if (done || row.dataset.busy) return; row.dataset.busy = 1; row.innerHTML = '';
      sfx('good'); owlReact('happy'); flyStar($('.reader')); tally('readAloud'); logDay(true);
      if (blob) await keepReading(blob, q.lines.join(' '));
      save();
      await sleep(300); await speak(R.mine, { pause: 200 }, ...q.lines, { pause: 200 }, ...praiseParts());
      await sleep(300); finish(true);
    };
    const review = () => {
      row.innerHTML = `<button class="btn sun hear">▶ 👂</button><button class="btn again2">🎤 ${R.again}</button><button class="btn teal okb">✅ ${R.done}</button>`;
      $('.hear').onclick = () => { stopSpeech(); playBlob(blob); }; $('.again2').onclick = start; $('.okb').onclick = complete;
    };
    const noMic = () => {
      release(); row.innerHTML = `<button class="btn teal huge okb">✅ ${R.done}</button>`; $('.okb').onclick = complete;
      $('.bubble').textContent = R.noMic; speak(R.noMic);
    };
    async function start() {
      stopSpeech();
      try {
        if (!navigator.mediaDevices || !window.MediaRecorder) return noMic();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (done) return release();
        const chunks = [], rec = mr = new MediaRecorder(stream);
        rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          release(); if (done) return;
          blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); review();
          $('.bubble').textContent = R.listen; setIdle(() => nudge([R.done]));
          await speak(R.listen); if (!done) playBlob(blob);
        };
        musicMode('off'); clearIdle(); rec.start();   // nothing else makes a sound while she reads
        row.innerHTML = `<button class="btn primary huge stopb"><i class="recdot"></i> ${R.stop}</button>`; $('.bubble').textContent = R.listening;
        $('.stopb').onclick = () => { if (rec.state === 'recording') rec.stop(); };
        timer = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 20000);
      } catch (e) { noMic(); }
    }
    $('.recb').onclick = start;
    speak(...q.speak);
  });
}

// ================= 💬 Chat with Tiko: tiny conversations, in English and in French =================
// Tiko asks, she answers by tapping a picture-sentence (Tiko says her sentence out loud, as a model to copy), Tiko replies.
// She can switch language at any moment, or hear any line in the other language. Tiko remembers what she likes.
// option = [picture, her answer EN, her answer FR, Tiko's reply EN, Tiko's reply FR, what to remember (EN, FR)]
const CHATS = [
  { id: 'feel', turns: [
    { en: 'Hello! How are you today?', fr: "Coucou ! Comment ça va aujourd'hui ?", opts: [
      ['😊', 'I am happy!', 'Je suis contente !', 'Yay! Me too! I am doing a happy dance!', 'Youpi ! Moi aussi ! Je fais la danse de la joie !'],
      ['😴', 'I am tired.', 'Je suis fatiguée.', 'Oh! Then we will go gently.', 'Oh ! Alors on y va tout doucement.'],
      ['😢', 'I am sad.', 'Je suis triste.', 'Oh no. Here is a big {hug}.', 'Oh non. Voici un gros {hug}.']] },
    { en: 'What would you like to do today?', fr: "Qu'est-ce que tu veux faire aujourd'hui ?", opts: [
      ['📖', 'I want to read.', 'Je veux lire.', 'Great idea! I love reading with you.', "Bonne idée ! J'adore lire avec toi."],
      ['🎨', 'I want to draw.', 'Je veux dessiner.', 'Ooh! Draw me a rainbow!', 'Oh ! Dessine-moi un arc-en-ciel !'],
      ['🔢', 'I want to count.', 'Je veux compter.', "One, two, three! Let's go!", "Un, deux, trois ! C'est parti !"]] },
    { en: 'Shall we be friends for ever?', fr: 'On est amies pour toujours ?', opts: [
      ['💖', 'Yes! Friends for ever!', 'Oui ! Amies pour toujours !', 'Hooray! Best friends!', 'Hourra ! Meilleures amies !'],
      ['🤗', 'Yes! Big hug!', 'Oui ! Gros câlin !', 'Mmm! What a lovely hug!', 'Mmm ! Quel beau câlin !']] }] },
  { id: 'colour', turns: [
    { en: 'What is your favourite colour?', fr: 'Quelle est ta couleur préférée ?', mem: 'colour', opts: [
      ['💗', 'I like pink.', "J'aime le rose.", 'Pink! Like the sky in the evening!', 'Le rose ! Comme le ciel du soir !', 'pink', 'le rose'],
      ['💜', 'I like purple.', "J'aime le violet.", 'Purple is magic!', "Le violet, c'est magique !", 'purple', 'le violet'],
      ['💙', 'I like blue.', "J'aime le bleu.", 'Blue, like the sky!', 'Bleu, comme le ciel !', 'blue', 'le bleu'],
      ['💛', 'I like yellow.', "J'aime le jaune.", 'Yellow, like the sun!', 'Jaune, comme le soleil !', 'yellow', 'le jaune']] },
    { en: 'What colour is the sun?', fr: 'De quelle couleur est le soleil ?', opts: [
      ['💛', 'The sun is yellow.', 'Le soleil est jaune.', 'Yes! Bright yellow!', 'Oui ! Tout jaune !'],
      ['💚', 'The sun is green.', 'Le soleil est vert.', 'Hee hee! A green sun! That is funny!', "Hi hi ! Un soleil vert ! C'est rigolo !"]] },
    { en: 'And what colour is the grass?', fr: "Et de quelle couleur est l'herbe ?", opts: [
      ['💚', 'The grass is green.', "L'herbe est verte.", 'Yes! I love to roll in the green grass!', "Oui ! J'adore me rouler dans l'herbe verte !"],
      ['💗', 'The grass is pink.', "L'herbe est rose.", 'Pink grass! In my world, maybe!', "De l'herbe rose ! Dans mon monde, peut-être !"]] }] },
  { id: 'animal', turns: [
    { en: 'Which animal do you like best?', fr: 'Quel animal préfères-tu ?', mem: 'animal', opts: [
      ['🐱', 'I like cats.', "J'aime les chats.", 'Meow! Cats are so soft.', 'Miaou ! Les chats sont tout doux.', 'cats', 'les chats'],
      ['🐶', 'I like dogs.', "J'aime les chiens.", 'Woof! Dogs are good friends.', 'Ouaf ! Les chiens sont de bons amis.', 'dogs', 'les chiens'],
      ['🐰', 'I like rabbits.', "J'aime les lapins.", 'Hop hop! Rabbits jump like me!', 'Hop hop ! Les lapins sautent comme moi !', 'rabbits', 'les lapins'],
      ['🐴', 'I like horses.', "J'aime les chevaux.", 'Horses run so fast!', 'Les chevaux courent si vite !', 'horses', 'les chevaux']] },
    { en: 'Is it big or little?', fr: 'Il est grand ou petit ?', opts: [
      ['🐘', 'It is big.', 'Il est grand.', 'Wow! So big!', 'Waouh ! Si grand !'],
      ['🐭', 'It is little.', 'Il est petit.', 'Aww! So little and cute!', 'Oh ! Si petit et mignon !']] },
    { en: 'Would you like to ride on my back?', fr: 'Tu veux monter sur mon dos ?', opts: [
      ['🌈', 'Yes, please!', "Oui, s'il te plaît !", 'Hold on tight! We fly over the rainbow!', "Tiens-toi bien ! On vole au-dessus de l'arc-en-ciel !"],
      ['🙈', 'No, thank you.', 'Non, merci.', 'That is fine. We can walk together.', "D'accord. On peut marcher ensemble."]] }] },
  { id: 'food', turns: [
    { en: 'What do you like to eat?', fr: "Qu'est-ce que tu aimes manger ?", mem: 'food', opts: [
      ['🍕', 'I like pizza.', "J'aime la pizza.", 'Yum! Pizza!', 'Miam ! La pizza !', 'pizza', 'la pizza'],
      ['🍎', 'I like apples.', "J'aime les pommes.", 'Crunch! I love apples too!', "Croc ! Moi aussi, j'adore les pommes !", 'apples', 'les pommes'],
      ['🍦', 'I like ice cream.', "J'aime la glace.", 'Brrr! Cold and sweet!', 'Brrr ! Froid et sucré !', 'ice cream', 'la glace'],
      ['🍌', 'I like bananas.', "J'aime les bananes.", 'Bananas! Like a little monkey!', 'Des bananes ! Comme un petit singe !', 'bananas', 'les bananes']] },
    { en: 'Do you know what I eat?', fr: 'Tu sais ce que je mange ?', opts: [
      ['🧁', 'Rainbow cakes?', 'Des gâteaux arc-en-ciel ?', 'Yes! Rainbow cakes are the best!', "Oui ! Les gâteaux arc-en-ciel, c'est le meilleur !"],
      ['🍓', 'Red berries?', 'Des fruits rouges ?', 'Yes! And sometimes a rainbow cake!', 'Oui ! Et parfois un gâteau arc-en-ciel !']] },
    { en: 'Are you hungry now?', fr: 'Tu as faim maintenant ?', opts: [
      ['😋', 'Yes, I am hungry.', "Oui, j'ai faim.", 'Me too! We can ask a grown-up for a snack.', 'Moi aussi ! On peut demander un goûter à un adulte.'],
      ['🙂', 'No, I am fine.', 'Non, ça va.', "Good! Then let's play!", 'Super ! Alors on joue !']] }] },
  { id: 'weather', turns: [
    { en: 'Look outside! What is the weather like?', fr: 'Regarde dehors ! Quel temps fait-il ?', opts: [
      ['☀️', 'It is sunny.', 'Il fait beau.', 'Lovely! The sun makes me happy.', 'Super ! Le soleil me met de bonne humeur.'],
      ['🌧️', 'It is raining.', 'Il pleut.', 'Rain makes rainbows! I love rainbows.', "La pluie fait des arcs-en-ciel ! J'adore les arcs-en-ciel."],
      ['☁️', 'It is cloudy.', 'Il y a des nuages.', 'I like to jump on the clouds!', "J'aime sauter sur les nuages !"]] },
    { en: 'What do you wear when it rains?', fr: "Qu'est-ce que tu mets quand il pleut ?", opts: [
      ['🥾', 'I wear my boots.', 'Je mets mes bottes.', 'Splash, splash in the puddles!', 'Plouf, plouf dans les flaques !'],
      ['🧥', 'I wear my coat.', 'Je mets mon manteau.', 'Nice and warm!', 'Bien au chaud !'],
      ['☂️', 'I take my umbrella.', 'Je prends mon parapluie.', 'Good idea! Stay dry!', 'Bonne idée ! Reste au sec !']] },
    { en: 'Do you like the snow?', fr: 'Tu aimes la neige ?', opts: [
      ['⛄', 'Yes! I make a snowman.', 'Oui ! Je fais un bonhomme de neige.', 'Can he have wings like me?', 'Il peut avoir des ailes comme moi ?'],
      ['🥶', 'No, it is too cold.', 'Non, il fait trop froid.', 'Brrr! You are right.', 'Brrr ! Tu as raison.']] }] },
  { id: 'ask', turns: [
    { en: 'Now you can ask me something!', fr: 'Maintenant, pose-moi une question !', opts: [
      ['🎂', 'How old are you?', 'Tu as quel âge ?', 'I am seven. That is a lot!', "J'ai sept ans. C'est beaucoup !"],
      ['🏰', 'Where do you live?', 'Tu habites où ?', 'I live {home}.', "J'habite {home}."],
      ['💤', 'Where do you sleep?', 'Tu dors où ?', 'I sleep on a soft cloud.', 'Je dors sur un nuage tout doux.']] },
    { en: 'Ask me another one!', fr: 'Pose-moi une autre question !', opts: [
      ['🌈', 'Can you fly?', 'Tu sais voler ?', 'Yes! I fly over the rainbow.', "Oui ! Je vole au-dessus de l'arc-en-ciel."],
      ['🎵', 'Can you sing?', 'Tu sais chanter ?', 'La la la! I sing with the birds.', 'La la la ! Je chante avec les oiseaux.'],
      ['📖', 'Can you read?', 'Tu sais lire ?', 'I am learning, just like you!', "J'apprends, comme toi !"]] },
    { en: 'One more?', fr: 'Encore une ?', opts: [
      ['🤝', 'Do you have friends?', 'Tu as des amis ?', 'Yes! You are my best friend.', 'Oui ! Tu es ma meilleure amie.'],
      ['⭐', 'What do you love?', "Qu'est-ce que tu aimes ?", 'I love stars, books, and you!', "J'aime les étoiles, les livres, et toi !"]] }] },
  { id: 'swap' },   // the two-languages game, built from CHAT_WORDS
];
// the two-languages game: [picture, English, French (with its little word)]
const CHAT_WORDS = [['🐱', 'cat', 'chat'], ['🐶', 'dog', 'chien'], ['☀️', 'sun', 'soleil'], ['🌙', 'moon', 'lune'], ['🍎', 'apple', 'pomme'], ['🐟', 'fish', 'poisson'],
  ['🏠', 'house', 'maison'], ['🌸', 'flower', 'fleur'], ['📖', 'book', 'livre'], ['⭐', 'star', 'étoile'], ['🐦', 'bird', 'oiseau'], ['🥛', 'milk', 'lait']];
T.en.chat = { btn: 'Chat', hello: 'Hello', bye: 'I loved talking with you! See you soon!', tap: 'Tap your answer!', remember: (a, b) => `I remember! You like ${a}${b ? ' and ' + b : ''}!`,
  swapIntro: "Let's play the two languages game!", swapTeach: (a, b) => [`In French, ${a} is`, b], swapAsk: w => ['What is', w, '?'], swapShow: (a, b, w) => `In French, ${a} is « ${b} ». What is « ${w} »?`,
  swapYes: (w, a) => ['Yes!', w, `is ${a}! Bravo!`], swapNo: (w, a) => ['Good try!', w, `is ${a}.`], ans: a => cap(a) + '!' };
T.fr.chat = { btn: 'Parler', hello: 'Coucou', bye: "J'ai adoré parler avec toi ! À bientôt !", tap: 'Touche ta réponse !', remember: (a, b) => `Je me souviens ! Tu aimes ${a}${b ? ' et ' + b : ''} !`,
  swapIntro: 'On joue au jeu des deux langues !', swapTeach: (a, b) => [`En anglais, ${a} se dit`, b], swapAsk: w => ['Que veut dire', w, '?'], swapShow: (a, b, w) => `En anglais, ${a} se dit « ${b} ». Que veut dire « ${w} » ?`,
  swapYes: (w, a) => ['Oui !', w, `veut dire ${a} ! Bravo !`], swapNo: (w, a) => ['Bien essayé !', w, `veut dire ${a}.`], ans: a => cap(a) + ' !' };
const CHAT_ME = {
  unicorn: { en: { hug: 'unicorn hug', home: 'in the pink castle, up on the hill' }, fr: { hug: 'câlin de licorne', home: 'dans le château rose, sur la colline' } },
  dino: { en: { hug: 'dragon hug', home: 'in a cosy cave, next to the volcano' }, fr: { hug: 'câlin de dragon', home: 'dans une grotte douillette, près du volcan' } },
  rex: { en: { hug: 'dinosaur hug', home: 'in the jungle, under the giant ferns' }, fr: { hug: 'câlin de dinosaure', home: 'dans la jungle, sous les grandes fougères' } },
  owl: { en: { hug: 'owl hug', home: 'in a big old tree, in the forest' }, fr: { hug: 'câlin de chouette', home: 'dans un grand arbre, dans la forêt' } },
};
let chatToken = 0;
async function chatWithTiko() {
  stopSpeech(); clearIdle(); zone('home'); musicMode('work');
  const my = ++chatToken, alive = () => my === chatToken && !!$('.chat');
  const other = () => (S.lang === 'en' ? 'fr' : 'en');
  // a different topic every time, whatever the language: each one has its turn before any comes back
  S.used = S.used || {}; const usedT = S.used.chat = S.used.chat || [];
  let pool = CHATS.filter(c => !usedT.includes(c.id)); if (!pool.length) { usedT.length = 0; pool = CHATS; }
  const topic = pick(pool); usedT.push(topic.id); save();
  app.innerHTML = `<div class="screen chat">
    <div class="topline"><button class="ic back">🏠</button><div class="langs" style="flex:1;justify-content:center">
      <button class="lang" data-l="en">🇬🇧</button><button class="lang" data-l="fr">🇫🇷</button></div><div style="width:64px"></div></div>
    <div class="chatstage">${owl('big')}<div class="tikoline"><div class="bubble tikosay"></div>
      <div class="chatbtns"><button class="ic again" aria-label="again">🔊</button><button class="ic otherl" aria-label="other language"></button></div></div></div>
    <div class="bubble me" hidden></div>
    <div class="replies"></div>
  </div>`;
  const leave = () => { chatToken++; stopSpeech(); home(); };
  $('.back').onclick = leave; exitCurrent = leave;
  const chips = () => { $$('.chat .lang').forEach(b => b.classList.toggle('on', b.dataset.l === S.lang)); $('.otherl').textContent = other() === 'fr' ? '🇫🇷' : '🇬🇧'; };
  chips();
  let line = null, relang = null;   // the line Tiko is saying now: { show: {en, fr}, parts: lang => [...] }
  const talk = async (l, lang = S.lang) => {
    line = l; const o = $('.chat .owl'); $('.tikosay').textContent = l.show[lang]; $('.tikosay').classList.remove('pop2'); void $('.tikosay').offsetWidth; $('.tikosay').classList.add('pop2');
    if (o) o.classList.add('talk');
    await speak(...l.parts(lang).map(p => typeof p === 'string' ? { text: p, lang } : p));
    if (o) o.classList.remove('talk');
  };
  // {hug} and {home} depend on who Tiko is in the chosen theme
  const fill = (s, lang) => s.replace(/\{(\w+)\}/g, (_, k) => CHAT_ME[themeName()][lang][k] || '');
  const plain = (en, fr) => { en = fill(en, 'en'); fr = fill(fr, 'fr'); return { show: { en, fr }, parts: lang => [lang === 'en' ? en : fr] }; };
  $('.again').onclick = () => { if (line) { sfx('tap'); talk(line); } };
  $('.otherl').onclick = () => { if (line) { sfx('tap'); talk(line, other()); } };   // hear the same thing in the other language
  $$('.chat .lang').forEach(b => b.onclick = () => { if (b.dataset.l === S.lang) return; S.lang = b.dataset.l; save(); applySettings(); sfx('pop'); chips(); if (relang) relang(); });
  // her answer: a tap on a picture-sentence. (Answering by voice was removed in v40: the browser's speech
  // recognition sends the recording to an outside service, and a child's voice never leaves the device.)
  const choose = opts => new Promise(res => {
    const draw = () => {
      $('.replies').innerHTML = opts.map((o, i) => `<button class="btn reply" data-i="${i}" style="--i:${i}"><span>${o.e}</span><b>${esc(o[S.lang])}</b></button>`).join('');
      $$('.reply').forEach(b => b.onclick = () => { sfx('pop'); res(opts[+b.dataset.i]); });
    };
    relang = () => { draw(); if (line) talk(line); }; draw();
    setIdle(() => { if (alive()) speak(L().chat.tap); });
  });
  const mine = async (o) => {   // her sentence appears on her side and is said out loud for her to copy
    relang = null; clearIdle(); $('.replies').innerHTML = ''; const me = $('.bubble.me'); me.hidden = false; me.textContent = `${o.e} ${o[S.lang]}`;
    await speak({ text: o[S.lang], lang: S.lang }); await sleep(250);
  };
  await sleep(400); if (!alive()) return;
  // hello — and Tiko remembers what she said before
  const mem = S.chat || {}, likes = ['colour', 'animal', 'food'].filter(k => mem[k]);
  const nm = childName();
  await talk({ show: { en: `${T.en.chat.hello}${nm ? ', ' + nm : ''}! 👋`, fr: `${T.fr.chat.hello}${nm ? ', ' + nm : ''} ! 👋` }, parts: lang => [T[lang].chat.hello, ...(nm ? [{ name: true, bang: true }] : [])] });
  if (!alive()) return;
  if (likes.length) {
    const a = mem[shuffle(likes)[0]], b = likes.length > 1 ? mem[likes.find(k => mem[k] !== a)] : null;
    await sleep(300); await talk(plain(T.en.chat.remember(a.en, b && b.en), T.fr.chat.remember(a.fr, b && b.fr))); if (!alive()) return;
  }
  if (topic.id === 'swap') {
    await sleep(300); await talk(plain(T.en.chat.swapIntro, T.fr.chat.swapIntro)); if (!alive()) return;
    const ws = shuffle(CHAT_WORDS);
    for (let i = 0; i < 3; i++) {
      const [A, B, C, D] = ws.slice(i * 4, i * 4 + 4);   // teach A, ask B; C and D are the other choices
      const far = lang => (lang === 'en' ? 'fr' : 'en'), wd = (x, lang) => x[lang === 'en' ? 1 : 2], fw = (x, lang) => ({ text: wd(x, far(lang)), lang: far(lang) });
      const show = lang => T[lang].chat.swapShow(`${A[0]} ${wd(A, lang)}`, wd(A, far(lang)), wd(B, far(lang)));
      const q = { show: { en: show('en'), fr: show('fr') }, parts: lang => { const t = T[lang].chat.swapTeach(wd(A, lang), fw(A, lang)), k = T[lang].chat.swapAsk(fw(B, lang)); return [...t, { pause: 350 }, ...k]; } };
      await sleep(300); await talk(q); if (!alive()) return;
      const opts = shuffle([B, C, D]).map(x => ({ e: x[0], en: T.en.chat.ans(x[1]), fr: T.fr.chat.ans(x[2]), x }));
      const o = await choose(opts); if (!alive()) return;
      await mine(o); if (!alive()) return;
      const ok = o.x === B, mk = f => ({ show: { en: `${B[0]} ${B[2]} = ${B[1]}`, fr: `${B[0]} ${B[1]} = ${B[2]}` }, parts: lang => T[lang].chat[f](fw(B, lang), wd(B, lang)) });
      if (ok) { sfx('good'); owlReact('happy'); burstAt($('.chat .owl'), 20); } await talk(mk(ok ? 'swapYes' : 'swapNo')); if (!alive()) return;
      $('.bubble.me').hidden = true;
    }
  } else {
    for (const t of topic.turns) {
      await sleep(300); await talk(plain(t.en, t.fr)); if (!alive()) return;
      const o = await choose(t.opts.map(([e, en, fr, ren, rfr, men, mfr]) => ({ e, en, fr, ren, rfr, men, mfr }))); if (!alive()) return;
      if (t.mem && o.men) { S.chat = S.chat || {}; S.chat[t.mem] = { en: o.men, fr: o.mfr }; save(); }
      await mine(o); if (!alive()) return;
      owlReact('happy'); await talk(plain(o.ren, o.rfr)); if (!alive()) return;
      $('.bubble.me').hidden = true;
    }
  }
  // goodbye, with a little present
  tally('chats'); logDay(true); S.stars += 2; save();
  sfx('win'); burstAt($('.chat .owl'), 40); const o2 = $('.chat .owl'); if (o2) o2.classList.add('dance');
  await talk({ show: { en: T.en.chat.bye + ' ⭐⭐', fr: T.fr.chat.bye + ' ⭐⭐' }, parts: lang => [T[lang].chat.bye] }); if (!alive()) return;
  await sleep(900); if (!alive()) return;
  chatToken++; await celebrateAwards(); home();
}

// ================= 📚 Tiko's little library: real little books to read, page by page =================
// Short sentences made of simple words and magic words; one picture per page; she can tap any word to hear it,
// or the ear to be read to. One question at the end. A book read today rests until tomorrow (discovery!).
// page = [picture, sentence]; q = [question, right answer [picture, words], wrong answer [picture, words]]
const BOOKS = [
  { id: 'hat', stage: 1, cover: '🐱',
    en: { t: 'The cat and the hat', p: [['🐱', 'I am a cat.'], ['🐱🎩', 'I see a hat.'], ['🎩', 'It is a big red hat.'], ['🐱❓', 'Can I sit in it?'], ['🎩🐱', 'Yes! I can sit in the hat.'], ['😴🎩', 'The cat naps in the hat.']],
      q: ['Where is the cat?', ['🎩', 'in the hat'], ['🛏️', 'in the bed']] },
    fr: { t: 'Le chat et le sac', p: [['🐱', 'Je suis un chat.'], ['🐱👜', 'Je vois un sac.'], ['👜', "C'est un sac rose."], ['🐱❓', 'Je vais dans le sac ?'], ['👜🐱', 'Oui ! Je suis dans le sac.'], ['😴👜', 'Le chat fait dodo dans le sac.']],
      q: ['Où est le chat ?', ['👜', 'dans le sac'], ['🛏️', 'dans le lit']] } },
  { id: 'bus', stage: 1, cover: '🚌',
    en: { t: 'The red bus', p: [['🚌', 'The bus is red.'], ['🐶🚌', 'A dog is on the bus.'], ['🐷🚌', 'A pig is on the bus.'], ['🐔🚌', 'A hen is on the bus!'], ['🚌💨', 'The bus can go, go, go.'], ['🛑🌳', 'Stop! We are at the park.']],
      q: ['What colour is the bus?', ['🔴', 'red'], ['🟢', 'green']] },
    fr: { t: 'Le bus rose', p: [['🚌', 'Le bus est rose.'], ['🐱🚌', 'Un chat est dans le bus.'], ['🐄🚌', 'Une vache est dans le bus.'], ['🐔🚌', 'Une poule est dans le bus !'], ['🚌💨', 'Le bus va vite, vite, vite.'], ['🛑🌳', 'Stop ! Voici le parc.']],
      q: ['De quelle couleur est le bus ?', ['💗', 'rose'], ['💚', 'vert']] } },
  { id: 'ring', stage: 3, cover: '🐟',
    en: { t: 'The fish and the ring', p: [['🐟🌊', 'A fish is in the sea.'], ['🚢', 'It sees a big ship.'], ['🤴🚢', 'The king is on the ship.'], ['💍', 'The king has a ring.'], ['💦💍', 'Splash! The ring is in the sea.'], ['🐟💍🤴', 'The fish gets the ring for the king.']],
      q: ['What fell in the sea?', ['💍', 'the ring'], ['👑', 'the crown']] },
    fr: { t: 'Le poisson et la bague', p: [['🐟🌊', 'Un poisson est dans la mer.'], ['🚢', 'Il voit un grand bateau.'], ['🤴🚢', 'Le roi est sur le bateau.'], ['💍', 'Le roi a une bague.'], ['💦💍', 'Plouf ! La bague tombe dans la mer.'], ['🐟💍🤴', 'Le poisson rapporte la bague au roi.']],
      q: ["Qu'est-ce qui tombe dans la mer ?", ['💍', 'la bague'], ['👑', 'la couronne']] } },
  { id: 'frog', stage: 3, cover: '🐸',
    en: { t: 'The frog and the moon', p: [['🐸🪵', 'A frog sits on a log.'], ['🌃', 'It is night.'], ['🐸🌙', 'The frog sees the moon.'], ['🌙💧', 'Is the moon in the pond?'], ['🐸💦', 'The frog jumps in. Splash!'], ['🐸😊', 'No moon. But a happy, wet frog!']],
      q: ['What did the frog see?', ['🌙', 'the moon'], ['☀️', 'the sun']] },
    fr: { t: 'La grenouille et la lune', p: [['🐸', 'Une grenouille est assise.'], ['🌃', "C'est la nuit."], ['🐸🌙', 'La grenouille voit la lune.'], ['🌙💧', "La lune est dans l'eau ?"], ['🐸💦', 'La grenouille saute. Plouf !'], ['🐸😊', 'Pas de lune. Mais une grenouille contente !']],
      q: ["Qu'est-ce que la grenouille voit ?", ['🌙', 'la lune'], ['☀️', 'le soleil']] } },
  { id: 'snail', stage: 5, cover: '🐌',
    en: { t: 'The snail and the cake', p: [['🐌', 'The snail is slow.'], ['🐌👃', 'It can smell a cake.'], ['🎂🏞️', 'The cake is by the lake.'], ['🐌➡️', 'The snail goes on and on.'], ['🌃🐌🎂', 'At night, the snail is at the cake.'], ['😋🎂', 'Yum! It was a good day.']],
      q: ['What does the snail eat?', ['🎂', 'the cake'], ['🍎', 'an apple']] },
    fr: { t: "L'escargot et le gâteau", p: [['🐌', "L'escargot est lent."], ['🐌👃', 'Il sent un gâteau.'], ['🎂🏞️', 'Le gâteau est près du lac.'], ['🐌➡️', "L'escargot avance, avance."], ['🌃🐌🎂', 'Le soir, il arrive au gâteau.'], ['😋🎂', 'Miam ! Quelle bonne journée !']],
      q: ["Qu'est-ce que l'escargot mange ?", ['🎂', 'le gâteau'], ['🍎', 'une pomme']] } },
  { id: 'tiko', stage: 5, cover: '🦄',
    en: { t: 'Luna the unicorn', p: [['🦄', 'Luna is a little unicorn.'], ['🦄💗', 'Luna has a pink mane.'], ['🏰', 'Luna lives in a castle.'], ['🌃🦄✨', 'At night, Luna flies to the stars.'], ['⭐🎁', 'Luna brings a star for you.'], ['🌙⭐', 'Good night, little star.']],
      q: ['Where does Luna live?', ['🏰', 'in a castle'], ['⛺', 'in a tent']] },
    fr: { t: 'Luna la licorne', p: [['🦄', 'Luna est une petite licorne.'], ['🦄💗', 'Luna a une crinière rose.'], ['🏰', 'Luna habite dans un château.'], ['🌃🦄✨', 'La nuit, Luna vole vers les étoiles.'], ['⭐🎁', 'Luna rapporte une étoile pour toi.'], ['🌙⭐', 'Bonne nuit, petite étoile.']],
      q: ['Où habite Luna ?', ['🏰', 'dans un château'], ['⛺', 'dans une tente']] } },
];
T.en.lib = { choose: 'Choose a book!', locked: 'This book opens later on your journey!', done: 'You read a whole book!', turn: 'Read the page, then turn it!' };
T.fr.lib = { choose: 'Choisis un livre !', locked: "Ce livre s'ouvre plus tard dans ton voyage !", done: 'Tu as lu un livre entier !', turn: 'Lis la page, puis tourne-la !' };
function library() {
  return new Promise(resolve => {
    const draw = () => {
      zone('read'); musicMode('calm');
      const st = stageOf(), B = S.books = S.books || {}, key = b => S.lang + ':' + b.id;
      const firstNew = BOOKS.find(b => b.stage <= st && !B[key(b)]);
      app.innerHTML = `<div class="screen sub library"><div class="topline"><button class="ic back">🏠</button><h2>📚 ${esc(actName('books'))}</h2><div style="width:64px"></div></div>
        <div class="shelf">${BOOKS.map((b, i) => { const locked = b.stage > st, read = B[key(b)], rest = read === today();
          return `<button class="btn bookc ${locked ? 'locked' : rest ? 'st-rest' : ''} ${b === firstNew ? 'suggest' : ''}" data-b="${i}" style="--i:${i}"><span class="cov">${b.cover}</span><b>${esc(b[S.lang].t)}</b>
            <i class="tag">${locked ? '🔒' : rest ? '💤' : read ? '✅' : '✨'}</i></button>`; }).join('')}</div></div>`;
      $('.back').onclick = () => { stopSpeech(); resolve(null); }; exitCurrent = () => resolve(null);
      $$('[data-b]').forEach(el => el.onclick = async () => {
        const b = BOOKS[+el.dataset.b], wob = () => { el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); sfx('tap'); };
        if (b.stage > st) { wob(); return speak(L().lib.locked); }
        if (B[key(b)] === today()) { wob(); return speak(L().disc.rest); }
        sfx('pop'); const done = await readBook(b);
        if (done) resolve(true); else if (done === null) resolve(null); else draw();
      });
      speak(L().lib.choose);
    };
    draw();
  });
}
// resolves true when the whole book was read, false when she went back to the shelf, null for 🏠
function readBook(b) {
  return new Promise(resolve => {
    const bk = b[S.lang]; let i = 0, done = false;
    const finish = v => { if (done) return; done = true; stopSpeech(); clearIdle(); resolve(v); };
    zone('read'); musicMode('work');
    const page = () => {
      const last = i === bk.p.length - 1, [pic, text] = bk.p[i];
      app.innerHTML = `<div class="screen act bookread"><header class="bar"><button class="ic home" aria-label="home">🏠</button>
        <div class="dots">${bk.p.map((_, j) => `<i class="${j < i ? 'done' : j === i ? 'now' : ''}"></i>`).join('')}</div><button class="ic shelfb" aria-label="books">📚</button></header>
        <div class="stage"><div class="bookpage"><div class="scene">${pic}</div>${readerHTML([text])}</div>
          <div class="btnrow">${i ? '<button class="btn prevb" aria-label="back">◀</button>' : ''}<button class="btn sun helpbtn" aria-label="read to me">👂</button>
          <button class="btn primary huge nextb" aria-label="next">${last ? '✅' : '▶'}</button></div></div></div>`;
      wireReader($('.stage'));
      $('.home').onclick = () => finish(null); $('.shelfb').onclick = () => finish(false); exitCurrent = () => finish(null);
      const p = $('.prevb'); if (p) p.onclick = () => { sfx('tap'); stopSpeech(); i--; page(); };
      $('.nextb').onclick = () => { sfx('pop'); stopSpeech(); if (last) return question(); i++; page(); };
      setIdle(() => nudge([L().lib.turn]));
      if (i === 0) speak(bk.t);
    };
    const question = async () => {
      const [qq, right, wrong] = bk.q, opt = ([e, w], v) => ({ html: `${e}<br><small>${esc(w)}</small>`, val: v });
      const first = await askChoice({ title: qq, speak: [qq], visual: `<div class="pic bob">${b.cover}</div>`, optClass: 'group bookq',
        options: shuffle([opt(right, 1), opt(wrong, 0)]), answer: 1, correctSpeak: [right[1]] }, { index: 0, count: 1 }, null);
      if (first === null || done) return finish(null);
      S.books = S.books || {}; S.books[S.lang + ':' + b.id] = today(); tally('books'); S.stars += 2; save();
      sfx('win'); rain(); await speak(L().lib.done); await sleep(400); finish(true);
    };
    page();
  });
}

// ================= 📊 weekly report for parents (to read, or to share with a teacher or therapist) =================
function weekReport() {
  const days = []; for (let i = 6; i >= 0; i--) days.push(ymd(new Date(Date.now() - i * 864e5)));
  const inWeek = new Set(days), dz = days.map(d => S.days[d] || { q: 0, ok: 0 });
  const sum = f => dz.reduce((s, d) => s + (f(d) || 0), 0), q = sum(d => d.q);
  const R = { from: days[0], to: days[6], played: dz.filter(d => d.q > 0).length, q, pct: q ? Math.round(sum(d => d.ok) / q * 100) : 0, mins: Math.round(sum(d => d.t) / 60),
    chats: 0, caught: 0, langs: {} };
  const dia = S.diary || [], kind = set => (set === 'letter' ? 'letters' : set === 'sight' ? 'magic' : set === 'syl' ? 'syllables' : 'words');
  const keep = S.lang;
  for (const lg of ['en', 'fr']) {
    S.lang = lg;   // (only so the helpers below look at this language; put back afterwards, nothing is saved)
    const ev = dia.filter(e => e[1] === lg), wk = ev.filter(e => inWeek.has(e[0]));
    const learned = { letters: [], magic: [], words: [], syllables: [] }, practise = { letters: [], magic: [], words: [], syllables: [] };
    for (const e of wk) if (e[2] === 'ok' && (S.boxes[`${lg}:${e[3]}:${e[4]}`] || 0) >= 5 && !learned[kind(e[3])].includes(e[4])) learned[kind(e[3])].push(e[4]);
    for (const [k, v] of Object.entries(S.boxes)) { const [l, set, ...rest] = k.split(':'), id = rest.join(':');
      if (l === lg && v > 0 && v < 5 && !isKnown(set, id) && !practise[kind(set)].includes(id)) practise[kind(set)].push(id); }
    const mix = {}; for (const e of ev) if (e[2] === 'miss' && e[5] && !e[5].includes('+')) { const k = `${e[4]} → ${e[5]}`; mix[k] = (mix[k] || 0) + 1; }
    const acts = Object.keys(ACTS), P = S.plays || {}, played = acts.filter(a => inWeek.has((P[lg + ':' + a] || {}).day)).map(a => actName(a));
    let never = acts.filter(a => !(P[lg + ':' + a] || {}).total && readyFor(a) && ACTS[a].area !== 'art' && !hid(ACTS[a].area)).map(a => actName(a));
    if (never.length > 8) never = [...never.slice(0, 8), `+${never.length - 8} more`];
    const st = stageOf(lg);
    R.langs[lg] = { any: wk.length > 0 || played.length > 0, stage: `${Math.min(st + 1, STAGES.length)}/${STAGES.length} ${st >= STAGES.length ? '(complete)' : T.en.journey[st]}`, learned, practise,
      mix: Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => (n > 1 ? `${k} (×${n})` : k)), played, never,
      known: { letters: DATA[lg].letters.filter(x => isKnown('letter', x.id)).length, magic: DATA[lg].sight.filter(x => isKnown('sight', x.id)).length, words: DATA[lg].words.filter(x => isKnown('blend', x.id)).length } };
    R.caught += wk.filter(e => e[2] === 'caught').length;
  }
  S.lang = keep;
  return R;
}
function weekReportText(R = weekReport()) {
  const L2 = [`Tiko – week ${R.from} to ${R.to}`, `Played on ${R.played} of 7 days${R.mins ? `, about ${R.mins} minutes` : ''}. ${R.q} answers, ${R.pct}% right first time.`];
  for (const lg of ['en', 'fr']) { const x = R.langs[lg]; if (!x.any) continue;
    L2.push('', lg === 'en' ? 'ENGLISH' : 'FRENCH', `Journey place ${x.stage}. Knows ${x.known.letters} letter sounds, ${x.known.words} words, ${x.known.magic} magic words.`);
    const list = (t, o) => { for (const k of ['letters', 'words', 'magic', 'syllables']) if (o[k].length) L2.push(`${t} ${k === 'magic' ? 'magic words' : k}: ${o[k].slice(0, 40).join(', ')}`); };
    list('New this week –', x.learned); list('Still practising –', x.practise);
    if (x.mix.length) L2.push(`Mix-ups (asked → chose): ${x.mix.join('; ')}`);
    if (x.played.length) L2.push(`Played this week: ${x.played.join(', ')}`);
    if (x.never.length) L2.push(`Ready but never tried: ${x.never.join(', ')}`);
  }
  if (R.caught) L2.push('', `${R.caught} word(s) she seemed to know but could not read in a sentence went back to practice.`);
  return L2.join('\n');
}
// ---------- backup: everything she has learned, in one small file ----------
function backupText() { return JSON.stringify({ app: 'tiko', version: APP_VERSION, date: today(), data: S }); }
function restoreBackup(text) {
  const d = JSON.parse(text);
  if (!d || d.app !== 'tiko' || !d.data || typeof d.data.boxes !== 'object' || typeof d.data.settings !== 'object') throw new Error('not a Tiko backup');
  S = { ...structuredClone(DEFAULTS), ...d.data, settings: { ...DEFAULTS.settings, ...d.data.settings } }; save();
  return d.date;
}

// ================= session shape: a clear plan, a length set by a parent, a calm ending =================
// When the day's play time is used up, Tiko never cuts an activity short: the goodbye comes at the next natural
// stop (home, a menu, the path). First time: breathing together, what she won, goodbye. After that: Tiko rests.
T.en.end = { title: 'All done for today!', breathe: "Let's breathe together.", in: 'Breathe in…', out: 'And breathe out…', did: n => `Today you won ${n} stars!`,
  bye: 'See you tomorrow! Sweet dreams!', rest: 'Tiko is resting. See you tomorrow!', now: 'Now', then: 'Then', fin: 'Finished!' };
T.fr.end = { title: "C'est fini pour aujourd'hui !", breathe: 'Respirons ensemble.', in: 'Inspire…', out: 'Et souffle…', did: n => `Aujourd'hui, tu as gagné ${n} étoiles !`,
  bye: 'À demain ! Fais de beaux rêves !', rest: 'Tiko se repose. À demain !', now: 'Maintenant', then: 'Après', fin: 'Fini !' };
const playedSecs = () => (S.days[today()] || {}).t || 0;
const extraMin = () => (S.extra && S.extra.day === today() ? S.extra.min : 0);
function sessionOver() { const m = S.settings.sessionMin; return m > 0 && playedSecs() >= (m + extraMin()) * 60; }
// stars won today (for the goodbye): remember how many she had when the day started
function dayStars() { if (!S.dayStart || S.dayStart.day !== today()) { S.dayStart = { day: today(), stars: S.stars }; save(); } return S.stars - S.dayStart.stars; }
let endToken = 0;
async function calmEnding() {
  stopSpeech(); clearIdle(); zone('think'); musicMode('calm');
  const my = ++endToken, alive = () => my === endToken && !!$('.ending'), E = L().end, first = S.endedDay !== today();
  app.innerHTML = `<div class="screen center ending"><button class="ic corner" aria-label="parents">⚙️</button>
    ${owl('big')}<h1 class="endt">${esc(first ? E.title : E.rest)}</h1><div class="breath" ${first ? '' : 'hidden'}><i></i></div><p class="bline"></p><div class="zzz" hidden>💤 🌙</div></div>`;
  $('.corner').onclick = () => { endToken++; parentGate(); };
  exitCurrent = null;
  const rest = () => { const o = $('.ending .owl'); if (o) o.classList.add('sleep'); $('.breath').hidden = true; $('.zzz').hidden = false; $('.bline').textContent = ''; $('.endt').textContent = E.rest; };
  if (!first) { rest(); return speak(E.rest); }
  S.endedDay = today(); save();
  await speak(E.title, { pause: 300 }, E.breathe); if (!alive()) return;
  for (let i = 0; i < 3; i++) {
    $('.breath').className = 'breath in'; $('.bline').textContent = E.in; speak(E.in); await sleep(4000); if (!alive()) return;
    $('.breath').className = 'breath out'; $('.bline').textContent = E.out; speak(E.out); await sleep(4500); if (!alive()) return;
  }
  const n = dayStars(); $('.breath').hidden = true;
  if (n > 0) { $('.bline').textContent = `⭐ ${n}`; await speak(E.did(n)); if (!alive()) return; }
  $('.endt').textContent = E.bye; await speak(E.bye); if (!alive()) return;
  await sleep(1200); if (alive()) rest();
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
  const leave = () => { if (leaving) return; leaving = true; home(true); };
  $('.playb').onclick = async () => {
    const btn = $('.playb'); btn.remove();
    $('.hello').hidden = false; $('.owl').classList.add('dance');
    const ms = jingle(); burst(innerWidth / 2, innerHeight * .35, 70); setTimeout(rain, 400);
    setTimeout(() => { const i = $('.intro'); if (i) i.addEventListener('click', leave); }, 400); // tap anywhere to skip (not this same tap)
    setTimeout(leave, Math.min(ms, 3600) + 20000);          // safety net: never get stuck on the intro
    await sleep(Math.min(ms, 3600) + 200);
    if (leaving) return;
    // release the speaker from the music so the voice isn't clipped (sfx() resumes it later)
    try { if (actx) await actx.suspend(); } catch (e) { /* ignore */ }
    await sleep(350);
    const st = streakDays();
    await speak(greet, ...(name ? [{ name: true, bang: true }] : []), H.happy, ...(st >= 2 ? [H.streak(st)] : []));
    await sleep(500); leave();
  };
}

// ================= screens =================
function home(fromIntro) {
  dayStars();
  if (sessionOver()) return calmEnding();
  stopSpeech(); clearIdle(); applySettings(); zone('home'); musicMode('calm');
  if (fromIntro === true) setTimeout(() => { if ($('.home')) speak(L().hi.tapStart); }, 500);   // (back buttons pass a click event — not 'from intro')
  if (S.seenStage[S.lang] === undefined) { S.seenStage[S.lang] = stageOf(); save(); }
  app.innerHTML = `<div class="screen home">
    <button class="ic corner" aria-label="parents">⚙️</button>
    <button class="ic themepick" aria-label="theme">🎨</button>
    <div class="langs"><button class="lang ${S.lang === 'en' ? 'on' : ''}" data-l="en">🇬🇧 English</button>
      <button class="lang ${S.lang === 'fr' ? 'on' : ''}" data-l="fr">🇫🇷 Français</button></div>
    <div class="hero">${owl('big')}${hid('chat') ? '' : `<button class="chatb">💬 ${L().chat.btn}</button>`}<h1 class="logo"><span>T</span><span>i</span><span>k</span><span>o</span></h1></div>
    <button class="btn primary huge pulse go">▶ ${L().start}</button>
    <div class="row">${[['read', '📖', L().reading], ['math', '🔢', L().maths], ['sci', '🚀', L().sciName], ['art', '🎨', L().artName], ['think', '🧠', L().thinkName], ['journey', '🗺️', L().read.journey], ['stickers', '🌟', L().stickers]]
      .filter(([k]) => !hid(k)).map(([k, ic, n]) => `<button class="btn card" data-m="${k}">${ic}<span>${n}</span></button>`).join('')}
    </div>
    <div class="row" style="align-items:center;gap:12px"><div class="starcount">⭐ ${S.stars} &nbsp; 🌟 ${S.stickers.length} &nbsp; 🏅 ${Object.keys(S.badges).length}</div>
    ${goalBarHTML()}</div>
    <div class="ver">v${APP_VERSION}</div>
  </div>`;
  $$('.lang').forEach(b => b.onclick = () => {
    S.lang = b.dataset.l; save(); sfx('pop'); home(); owlReact('happy');
    speak(S.lang === 'fr' ? 'Coucou' : 'Hello', { name: true, bang: true }, S.lang === 'fr' ? 'On parle français !' : "Let's speak English!");
  });
  // tapping Tiko gives a random silly reaction
  const silly = S.lang === 'fr' ? ['Youpi !', 'Ça chatouille !', 'Hi hi hi !', 'On joue ?', 'Tu es super !', 'Ça brille !']
    : ['Wheee!', 'That tickles!', 'Hee hee hee!', "Let's play!", "You're awesome!", 'Sparkle, sparkle!'];
  $('.owl').onclick = () => {
    const o = $('.owl'), k = pick(['happy', 'dance', 'spin']);
    o.classList.remove('happy', 'dance', 'spin'); void o.offsetWidth; o.classList.add(k); setTimeout(() => o.classList.remove(k), 1600);
    sfx('pop'); burstAt(o, 20); speak(pick(silly));
  };
  $('.go').onclick = () => { sfx('pop'); startPath(); };
  if ($('.chatb')) $('.chatb').onclick = () => { sfx('pop'); chatWithTiko(); };
  $('.themepick').onclick = () => { sfx('pop'); themePicker(); };
  $$('[data-m]').forEach(b => b.onclick = () => { sfx('tap'); const m = b.dataset.m; m === 'stickers' ? stickerBook() : m === 'journey' ? journey() : menu(m); });
  $('.corner').onclick = () => parentGate();
}
function menu(area) {
  if (sessionOver()) return calmEnding();
  zone(area); musicMode('calm');
  const ids = Object.keys(ACTS).filter(k => ACTS[k].area === area), sug = suggestIn(area);
  const TAG = { new: '✨', mastered: '🏆', rest: '💤' };
  app.innerHTML = `<div class="screen menu">
    <div class="topline"><button class="ic back">🏠</button><h2>${area === 'read' ? '📖 ' + L().reading : area === 'art' ? '🎨 ' + L().artName : area === 'think' ? '🧠 ' + L().thinkName : area === 'sci' ? '🚀 ' + L().sciName : '🔢 ' + L().maths}</h2><div style="width:64px"></div></div>
    <div class="grid">${ids.map((k, i) => { const s = actState(k);
      return `<button class="btn card st-${s} ${k === sug ? 'suggest' : ''}" data-a="${k}" style="--i:${i}">${ACTS[k].icon}<span>${esc(actName(k))}</span>${TAG[s] && (s !== 'new' || k === sug) ? `<i class="tag">${TAG[s]}</i>` : ''}</button>`; }).join('')}</div></div>`;
  $('.back').onclick = home;
  // Tiko points her to something new to discover
  const point = () => { const s = $('.card.suggest'); if (!s) return false; s.classList.remove('wobble'); void s.offsetWidth; s.classList.add('wobble'); s.scrollIntoView({ block: 'nearest' }); return true; };
  if (sug && actState(sug) === 'new') setTimeout(point, 900);
  $$('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a, st = actState(a);
    if (st === 'rest' || st === 'mastered') {   // easy / already done today: no replay — off to discover something else
      sfx('tap'); b.classList.remove('wobble'); void b.offsetWidth; b.classList.add('wobble');
      return speak(L().disc[st === 'rest' ? 'rest' : 'mastered'], ...(point() ? [] : [L().disc.path]));
    }
    sfx('pop');
    const r = await runAct(a);
    if (!r) return home();   // 🏠 means home
    await reward(); await checkUnlock(); await celebrateAwards(); menu(area);
  });
}

// ---------- the daily path ----------
let path = null;
function buildPath() {
  const day = new Date().getDate(), odd = day % 2 === 1;
  const lit = odd ? 'letters' : 'sight', lit2 = odd ? 'sight' : 'letters';
  // maths rotates daily through a wide mix so each day feels different
  const dayNo = Math.floor(Date.now() / 864e5);
  const MATH_A = ['add', 'sub', 'mathStory', 'missing', 'doubles', 'add', 'sub'];
  const MATH_B = ['shapes', 'patterns', 'pop', 'clock', 'skip', 'tens', 'flash', 'measure', 'bonds', 'next', 'compare', 'count', 'money', 'groups'];
  const mathA = MATH_A[dayNo % MATH_A.length], mathB = MATH_B[dayNo % MATH_B.length];
  // what the path focuses on depends on where she is on the literacy journey
  const PLANS = [
    // blending is built up in steps every day: listen-only (robot) → slide-to-blend → word families
    ['letters', 'robot', 'A', 'blend', 'B', 'trace', 'sight', 'paperMath'],
    ['robot', 'blend', 'A', odd ? 'traceWord' : 'paper', 'B', 'family', 'spell', 'traceNum'],
    ['robot', 'family', 'A', 'blend', 'B', 'sight', 'traceWord', 'paper'],
    ['blend', 'family', 'A', odd ? 'traceWord' : 'traceSentence', 'B', 'spell', 'paper', 'sentence'],
    ['sentence', 'traceSentence', 'A', 'paper', 'B', 'blend', 'paperMath', 'spell'],
    // Long Vowel Lagoon: new harder words to blend and build
    ['blend', 'sentence', 'A', odd ? 'traceWord' : 'spell', 'B', 'robot', 'paper', 'family'],
    ['story', 'traceSentence', 'A', 'sentence', 'B', 'paper', 'blend', 'sight'],
    // Big Word Peak: two-syllable words, longer sentences and stories
    ['blend', 'story', 'A', odd ? 'spell' : 'traceSentence', 'B', 'sentence', 'paper', 'traceWord'],
  ];
  const order = PLANS[Math.min(stageOf(), PLANS.length - 1)].map(x => x === 'A' ? mathA : x === 'B' ? mathB : x);
  // tracks the parent has hidden never appear on the path
  const stops = order.filter(a => !hid(ACTS[a].area)).slice(0, S.settings.stops);
  // a fun treat at the end of every path: art one day, a thinking game the next (whichever of the two is not hidden)
  // (v38: science takes its turn too — art, thinking, science, day after day)
  const treats = [['art', ['paint', 'cbn', 'music', 'mirror', 'mix', 'readDraw']], ['think', ['memory', 'simon', 'jigsaw', 'kim', 'odd']], ['sci', ['space', 'wonder', 'constel', 'rocket', 'space', 'wonder', 'constel', 'zoom']]].filter(([k]) => !hid(k));
  if (S.settings.artInPath && treats.length) { const list = treats[dayNo % treats.length][1]; stops.push(list[Math.floor(dayNo / treats.length) % list.length]); }
  // with reading or maths hidden the plan runs short: top it up from the tracks she does see (new things first)
  const want = S.settings.stops + (S.settings.artInPath && treats.length ? 1 : 0);
  if (stops.length < want) {
    const extra = shuffle(Object.keys(ACTS).filter(k => !hid(ACTS[k].area) && readyFor(k) && !mastered(k) && !stops.includes(k) && k !== 'books'));
    extra.sort((x, y) => playedEver(x) - playedEver(y));
    stops.push(...extra.slice(0, want - stops.length));
  }
  // discovery: anything she has mastered is swapped for something fresh she is ready for
  stops.splice(0, stops.length, ...freshen(stops));
  const seq = [];
  stops.forEach((s, i) => { seq.push(s); if (S.settings.breaks && i === 2 && stops.length > 3) seq.push('break'); });
  return seq.map(a => ({ a, done: false, sticker: null }));
}
// today's path is kept: pressing 🏠 by accident and coming back carries on where she was (with her stickers)
let pathDay = null;
function startPath() {
  if (!(path && pathDay === today() && path.some(s => !s.done))) { path = buildPath(); pathDay = today(); }
  showPath();
}
function showPath() {
  const cur = path.findIndex(s => !s.done);
  zone('home'); musicMode('calm');
  if (cur === -1) return finale();
  if (sessionOver()) return calmEnding();
  // "first this, then that": she always sees what comes now and what comes after
  const E = L().end, card = (s, lbl, cls) => `<div class="ft ${cls}"><small>${esc(lbl)}</small><span>${s ? (s.a === 'break' ? '🤸' : ACTS[s.a].icon) : '🏆'}</span><b>${esc(s ? (s.a === 'break' ? L().breakTitle : actName(s.a)) : E.fin)}</b></div>`;
  const firstThen = `<div class="firstthen">${card(path[cur], E.now, 'now')}<i>➜</i>${card(path[cur + 1], E.then, '')}</div>`;
  app.innerHTML = `<div class="screen path">
    <div class="topline"><button class="ic back">🏠</button><h2>🗺️ ${L().pathTitle}</h2><div class="stars">⭐ <b>${S.stars}</b></div></div>
    <div class="stones">${path.map((s, i) => `<div class="stone ${s.done ? 'done' : i === cur ? 'now' : ''} ${s.a === 'break' ? 'brk' : ''}" style="--i:${i}">
      ${s.a === 'break' ? '🤸' : ACTS[s.a].icon}${s.done && s.sticker ? `<span class="badge">${s.sticker}</span>` : ''}${i === cur ? '' : ''}</div>`).join('')}
      <div class="stone" style="--i:${path.length};background:#fff3c4">🏆</div></div>
    ${firstThen}
    ${owl('')}
    <button class="btn primary huge pulse go">${L().go}</button></div>`;
  $('.back').onclick = home;
  const next = path[cur];
  speak(next.a === 'break' ? L().breakTitle : actName(next.a));
  $('.go').onclick = async () => {
    sfx('pop');
    if (next.a === 'break') { await moveBreak(); next.done = true; return showPath(); }
    const r = await runAct(next.a);
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
  if (sessionOver()) return calmEnding();
  stopSpeech(); clearIdle(); zone('read'); musicMode('calm');
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
  // what each place practises when tapped after it's been reached
  const PRACTICE = ['letters', 'blend', 'sight', 'spell', 'sentence', 'blend', 'story', 'blend'];
  let busy = false;
  $$('.isle').forEach(b => b.onclick = async () => {
    if (busy) return;
    const i = +b.dataset.i;
    if (i > cur) {                       // locked: wiggle + encouragement
      sfx('oops'); b.classList.remove('wobble'); void b.offsetWidth; b.classList.add('wobble');
      return speak(names[i], L().read.locked);
    }
    if (i < cur && S.settings.discovery) {   // conquered places are not replayed: celebrate, then point forward
      sfx('pop'); burstAt(b, 20); owlReact('happy');
      const now = $('.isle.now'); if (now) { now.scrollIntoView({ block: 'center', behavior: 'smooth' }); now.classList.remove('wobble'); void now.offsetWidth; now.classList.add('wobble'); }
      return speak(names[i], L().disc.conquered);
    }
    busy = true; sfx('pop'); burstAt(b, 30); owlReact('happy');
    await speak(names[i], L().read.go);
    if (i === cur) return startPath();   // today's path is built around the current place
    const a = PRACTICE[i], r = await runStop(a, ACTS[a].per || S.settings.perStop);
    if (r) { await reward(); await checkUnlock(); await celebrateAwards(); }
    journey();
  });
  speak(L().read.journey, cur < STAGES.length ? names[cur] : L().allDone);
  const now = $('.isle.now'); if (now) now.scrollIntoView({ block: 'center' });
}
function reward() {
  musicMode('calm');
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
  zone('home'); musicMode('calm');
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
  musicMode('off');
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
      h += `<h4>${lg === 'en' ? '🇬🇧 English' : '🇫🇷 Français'}: journey stage ${Math.min(stg + 1, STAGES.length)}/${STAGES.length} (${stg >= STAGES.length ? 'complete!' : esc(T.en.journey[stg])}) · word level ${wordLevel(lg)}/${DATA[lg].tiers.filter((t, i, a) => i === 0 || t > a[i - 1]).length}</h4>
        <p>${STAGES.map((s, i) => `${s.icon} ${Math.round(stagePct(i, lg) * 100)}%`).join(' → ')} · sentences read: ${cnt(lg, 'sentence')}, stories: ${cnt(lg, 'story')}</p>${pr('Letter sounds', 'letter', d.letters)}${pr('Magic words', 'sight', d.sight)}${pr('Blending', 'blend', d.words)}${pr('Building words', 'spell', d.words)}`;
    }
    h += `<h4>🏅 Badges: ${Object.keys(S.badges).length}/${BADGES.length}</h4><p>${BADGES.map(b => `<span title="${esc(b.en)}" style="${S.badges[b.id] ? '' : 'opacity:.25;filter:grayscale(1)'}">${b.icon}</span>`).join(' ')}</p>
      <p>Streak: ${streakDays()} day(s) · kept trying after a mistake: ${tot('retryOk')} times · paper missions: ${tot('papers')}</p>`;
    h += `<h4>🔢 Maths levels (rise after 5 first-try answers in a row, drop after 3 misses)</h4><p>${Object.keys(MATH_MAX).map(a => `${ACTS[a].icon} ${T.en.acts[a]}: <b>${lvl(a)}</b>/${MATH_MAX[a]}`).join(' · ')}</p>`;
    h += `<h4>🧠 Thinking games</h4><p>${Object.keys(THINK_MAX).map(a => `${ACTS[a].icon} ${T.en.acts[a]}: <b>${lvl(a)}</b>/${THINK_MAX[a]}`).join(' · ')} · "Copy me" sequence length: <b>${S.simonLen || 2}</b></p>`;
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return [d.toLocaleDateString(undefined, { weekday: 'short' }), S.days[k] || { q: 0, ok: 0 }]; });
    const mx = Math.max(10, ...days.map(d => d[1].q));
    h += `<h4>Last 7 days (answers · first-try correct)</h4><div class="days">${days.map(([n, v]) => `<div><span>${v.q ? `${v.q}·${v.ok}` : ''}</span><i style="height:${v.q / mx * 90}%"></i>${n}</div>`).join('')}</div>`;
    return h;
  };
  app.innerHTML = `<div class="screen parent"><div class="wrap">
    <div class="topline"><button class="ic back">🏠</button><h2>👪 Parent corner</h2></div>

    <section><h3>📊 This week</h3><div class="wkrep"></div>
      <button class="pbtn sharerep">📤 Share / copy this report</button> <span class="repmsg" style="font-size:14px;color:var(--teal-d)"></span>
      <p style="font-size:13px">The report has no name in it. It is made on this tablet from what she did here; nothing is sent anywhere unless you share it.</p></section>

    <section><h3>🎨 Theme</h3><p>Choose the world and the friend Tiko is. Everything else (activities, progress, stars) stays the same.</p>
      <div class="themes">${Object.entries(THEMES).map(([k, [n, d]]) => `<button class="themeb ${themeName() === k ? 'on' : ''}" data-theme="${k}">${owl('', k)}${n}<small>${d}</small></button>`).join('')}</div></section>

    <section><h3>📲 Install on the tablet</h3>
      <p>In Chrome, tap <b>⋮ → Add to Home screen / Install app</b>. After that Tiko works offline and opens full-screen.</p>
      ${installEvt ? '<button class="pbtn inst">Install Tiko now</button>' : ''}</section>

    <section><h3>🖨️ Paper worksheets (blended learning)</h3>
      <p>A <b>library of ${SHEETS.length} kinds of worksheet</b> for reading, writing and maths. Every sheet is one page, is made fresh each time, and follows where she is <b>right now</b>: her place on the journey (now ${stageOf('en') + 1} of ${STAGES.length + 1} in English, ${stageOf('fr') + 1} in French), the letters and words she is still learning, and her maths levels (adding ${lvl('add')}, taking away ${lvl('sub')}, counting ${lvl('count')}).
      Open a sheet, or a whole pack, then <b>print it</b>, <b>save it as a PDF</b>, or <b>download</b> it as a file you can open and print from any device.
      Every daily path also includes a <b>paper mission</b>. She works on paper, then taps ✅ or uses 📷 to show Tiko her work.</p>
      <button class="pbtn wsopen" data-l="en">📚 Open the worksheet library</button><button class="pbtn alt wsopen" data-l="fr">🇫🇷 Fiches en français</button></section>

    <section><h3>🧒 The child's name</h3>
      <p>Tiko welcomes the child by name and sometimes uses it in praise. It's stored only on this tablet, never online.
      If the robot voice says it wrong, type how it sounds, syllable by syllable (e.g. "Mee-ah"), or better, record it in your voice.</p>
      <label class="set">Name <input class="nm-in" data-s="name" type="text" maxlength="30" value="${esc(st.name)}" placeholder="Name"></label>
      <label class="set">In French, Tiko speaks to a boy ("champion", "prêt", "content"… instead of "championne", "prête", "contente") <input type="checkbox" data-s="frBoy" ${st.frBoy ? 'checked' : ''}></label>
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

    <section><h3>🎚️ Difficulty</h3>
      <p>Tiko makes things harder by itself as she succeeds (and easier if she struggles). If she is ready for harder work already, move her ahead here.
      It keeps adjusting automatically afterwards.</p>
      ${['en', 'fr'].map(lg => `<label class="set">${lg === 'en' ? '🇬🇧 English' : '🇫🇷 French'} reading — start the journey at
        <select class="jstart" data-lg="${lg}">${STAGES.map((s, i) => `<option value="${i}" ${i === stageOf(lg) ? 'selected' : ''} ${i < stageOf(lg) ? 'disabled' : ''}>${s.icon} ${esc(T[lg].journey[i])}</option>`).join('')}</select></label>`).join('')}
      <div class="set" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee;font-size:17px;flex-wrap:wrap">🔢 All maths to level
        <span>${[1, 2, 3, 4].map(n => `<button class="pbtn alt mset" data-n="${n}">${n}</button>`).join('')}</span></div>
      <div class="set" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;font-size:17px;flex-wrap:wrap">🧠 All thinking games to level
        <span>${[1, 2, 3].map(n => `<button class="pbtn alt tset" data-n="${n}">${n}</button>`).join('')}</span></div>
      <p class="diffmsg" style="color:var(--teal-d);font-weight:600"></p></section>

    <section><h3>👁️ What she sees</h3>
      <p>Untick a track to hide it. A hidden track disappears from the home screen and from the daily path; her progress in it is kept, and ticking it again brings it straight back.</p>
      <div class="tracks">${TRACKS.map(([k, ic, n]) => `<label class="trackb ${hid(k) ? '' : 'on'}"><input type="checkbox" data-track="${k}" ${hid(k) ? '' : 'checked'}> ${ic} ${n}</label>`).join('')}</div>
      <p class="trackmsg" style="color:var(--teal-d);font-weight:600"></p></section>

    <section><h3>⚙️ Session</h3>
      <label class="set">Stops on the daily path <select data-s="stops">${[3, 4, 5, 6, 7, 8].map(n => `<option ${st.stops === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="set">Questions per stop <select data-s="perStop">${[3, 4, 5, 6, 8].map(n => `<option ${st.perStop === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="set">Session length: Tiko says a calm goodbye (breathing together, then "see you tomorrow") after about this much play a day
        <select data-s="sessionMin">${[0, 10, 15, 20, 30, 45].map(n => `<option value="${n}" ${st.sessionMin === n ? 'selected' : ''}>${n ? n + ' minutes' : 'no limit'}</option>`).join('')}</select></label>
      <div class="set" style="padding:10px 0;border-bottom:1px solid #eee;font-size:17px">Played today: <b>${Math.round(playedSecs() / 60)} min</b>${extraMin() ? ` (+${extraMin()} min extra allowed)` : ''}
        <button class="pbtn alt moretime">➕ 10 more minutes today</button></div>
      <label class="set">Movement break mid-path <input type="checkbox" data-s="breaks" ${st.breaks ? 'checked' : ''}></label>
      <label class="set">Fun treat at the end of the path (art or thinking game) <input type="checkbox" data-s="artInPath" ${st.artInPath ? 'checked' : ''}></label>
      <label class="set">Discovery mode (mastered activities, or ones played twice today, rest; new ones sparkle) <input type="checkbox" data-s="discovery" ${st.discovery ? 'checked' : ''}></label>
      <label class="set">Focus nudges (Tiko says "Your turn!" after 15 s with no taps) <input type="checkbox" data-s="nudge" ${st.nudge ? 'checked' : ''}></label>
      <label class="set">Sound effects <input type="checkbox" data-s="sfx" ${st.sfx ? 'checked' : ''}></label>
      <label class="set">Intro music <input type="checkbox" data-s="music" ${st.music ? 'checked' : ''}></label>
      <label class="set">Relaxing music on the home screen, menus, map and drawing (goes quiet when Tiko speaks) <input type="checkbox" data-s="ambient" ${st.ambient ? 'checked' : ''}></label>
      <label class="set">…and very quietly during the activities too <input type="checkbox" data-s="ambientWork" ${st.ambientWork ? 'checked' : ''}></label>
      <label class="set">Calm mode (less motion and confetti) <input type="checkbox" data-s="calm" ${st.calm ? 'checked' : ''}></label>
      <div class="set" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee;font-size:17px">Voice style
        <span><button class="pbtn alt vs" data-p="1.7" data-pf="1.3" data-r="0.95">🫧 Bubbly</button><button class="pbtn alt vs" data-p="1.1" data-pf="1.0" data-r="0.88">🙂 Normal</button><button class="pbtn alt vs" data-p="0.95" data-pf="0.9" data-r="0.8">🌙 Calm</button></span></div>
      <label class="set">🇬🇧 English voice pitch (higher = more bubbly) <input type="range" min="0.8" max="2" step="0.05" value="${st.pitch}" data-s="pitch"></label>
      <label class="set">🇫🇷 French voice pitch (French voices sound strange if too high) <input type="range" min="0.8" max="1.6" step="0.05" value="${st.pitch_fr || 1.25}" data-s="pitch_fr"></label>
      <p class="voiceinfo" style="font-size:14px;color:#666"></p>
      <label class="set">Voice speed <input type="range" min="0.5" max="1.1" step="0.05" value="${st.rate}" data-s="rate"></label>
      <label class="set">English voice <select data-s="voice_en">${voiceOpts('en')}</select></label>
      <label class="set">French voice <select data-s="voice_fr">${voiceOpts('fr')}</select></label>
      <button class="pbtn alt tv" data-l="en">▶ Test English</button><button class="pbtn alt tv" data-l="fr">▶ Tester le français</button>
      <h4 style="margin:16px 0 4px">🎧 Find the most fun voice</h4>
      <p style="font-size:14px">Every voice on this tablet. Tap ▶ to hear Tiko in that voice, then <b>Use</b> on the one she likes best. Voices marked "online" need internet and can be slower.</p>
      <div class="voicelist"></div>
      <p>No French voice listed? On the tablet go to <b>Settings → General management → Text-to-speech → Google → Install voice data</b> and download English (UK) and French (France). Then they work offline too.</p></section>

    <section><h3>🎙️ Record letter sounds in your voice (recommended)</h3>
      <p>Tiko has built-in pure phonics sounds ("sss", "mmm", "t" not "tuh"). Tap ▶ to hear them. If you'd rather she hears your voice or your accent, record a sound (about 1 second) and Tiko will use your recording instead.</p>
      <div class="tabs" style="margin-bottom:10px"><button class="rl on" data-l="en">🇬🇧 sounds</button><button class="rl" data-l="fr">🇫🇷 sons</button><button class="rl" data-l="fr" data-syl="1">🇫🇷 syllabes</button></div>
      <p class="sylnote" hidden style="font-size:14px">The French syllables Tiko says while blending (pa, mo, teau…). Tap ▶ to check each one; if one sounds wrong, record it in your voice and Tiko will use that.</p>
      <div class="recgrid"></div></section>

    <section><h3>📊 Progress</h3><p>✓ = remembered well (reached box 4 of 5 in spaced repetition). New items come in slowly, a few at a time, and anything she misses comes back more often.</p>
      <div class="progx">${progHTML()}</div></section>

    <section><h3>🎤 Her reading</h3><p>In "Read it to Tiko" she records herself reading. The latest 12 recordings are kept here, on this tablet only.</p><div class="readlist"></div></section>

    <section><h3>📷 Her paper work</h3><div class="gallery pg"></div></section>

    <section><h3>💾 Backup</h3>
      <p>Her progress lives only in this tablet's browser storage. Save a backup file now and then (it goes to Downloads); you can restore it here, or on a new tablet. Voice recordings and photos are not included.${S.lastBackup ? ` Last backup: <b>${esc(S.lastBackup)}</b>.` : ' <b>No backup yet.</b>'}</p>
      <button class="pbtn bkup">💾 Save a backup file</button> <button class="pbtn alt rstr">📂 Restore from a backup file</button><input type="file" class="bkfile" accept=".json,application/json" hidden>
      <p class="bkmsg" style="color:var(--teal-d);font-weight:600"></p></section>

    <section><h3>🔒 Privacy</h3>
      <p>Tiko has no account, no adverts and no tracking. Everything about your child (name, progress, recordings, photos) stays on this tablet and is never sent anywhere. The app asks no other website for anything, and works without internet.</p>
      <a class="pbtn alt privlink" href="privacy.html" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none">Read the privacy policy</a></section>

    <section><h3>🧹 Reset</h3><button class="pbtn warn rst">Reset all progress</button></section>
  </div></div>`;
  $('.back').onclick = home;
  $$('[data-s]').forEach(el => el.onchange = el.oninput = () => {
    const k = el.dataset.s; st[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : /^\d+$/.test(el.value) ? +el.value : el.value;
    save(); applySettings();
  });
  // show which device voice is really in use (helps if the voice ever sounds wrong)
  const vinfo = () => {
    const d = l => { const v = voiceFor(l); return v ? `${v.name} (${v.lang}${v.localService ? ', on this tablet' : ', online'})` : 'tablet default'; };
    $('.voiceinfo').textContent = `Voices in use — English: ${d('en')}, pitch ${st.pitch} · French: ${d('fr')}, pitch ${st.pitch_fr || 1.25}. ` +
      (voiceFor('fr') && !voiceFor('fr').localService ? 'The French voice is online-only: download French voice data (see below) for smoother speech.' : '');
  };
  vinfo(); $$('[data-s]').forEach(el => el.addEventListener('change', vinfo));
  // voice audition list
  const drawVoices = () => {
    const rows = ['en', 'fr'].flatMap(lg => voicesFor(lg).map(v => ({ lg, v })));
    $('.voicelist').innerHTML = rows.length ? rows.map(({ lg, v }, i) => {
      const inUse = voiceFor(lg) && voiceFor(lg).name === v.name;
      return `<div class="vrow ${inUse ? 'inuse' : ''}"><span>${lg === 'en' ? '🇬🇧' : '🇫🇷'} ${esc(v.name)} <small>${esc(v.lang)}${v.localService ? '' : ' · online'}</small></span>
        <button class="pbtn alt" data-vp="${i}">▶</button><button class="pbtn ${inUse ? '' : 'alt'}" data-vu="${i}">${inUse ? '✓ In use' : 'Use'}</button></div>`;
    }).join('') : '<p><i>No voices found yet. Try again in a moment.</i></p>';
    $$('[data-vp]').forEach(b => b.onclick = async () => {
      const { lg, v } = rows[+b.dataset.vp], keep = st['voice_' + lg];
      st['voice_' + lg] = v.name; stopSpeech();
      await speak(lg === 'fr' ? 'Coucou ! Je suis Tiko !' : "Hi there! I'm Tiko!", ...(lg === 'fr' ? ['Youpi ! Bravo !'] : ['Woohoo! Great job!']));
      st['voice_' + lg] = keep;
    });
    $$('[data-vu]').forEach(b => b.onclick = () => {
      const { lg, v } = rows[+b.dataset.vu]; st['voice_' + lg] = v.name; save();
      const sel = $(`[data-s="voice_${lg}"]`); if (sel) sel.value = v.name;
      vinfo(); drawVoices(); sfx('good');
    });
  };
  drawVoices(); if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', () => { if ($('.voicelist')) drawVoices(); });
  const demo = async l => { stopSpeech(); await sleep(80); await say(l === 'fr' ? "Coucou ! Je suis Tiko. On lit ensemble ?" : "Hi there! I'm Tiko. Shall we read together?", l); await say(l === 'fr' ? 'Bravo, super !' : 'Great job, superstar!', l); };
  $$('.tv').forEach(b => b.onclick = () => demo(b.dataset.l));
  $$('.nm-in').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
  $('.nm-test').onclick = () => speak(S.lang === 'fr' ? 'Coucou' : 'Hello', { name: true, bang: true }, ...praiseParts());
  $('.nm-del').onclick = async () => { await idb.del('rec', 'name'); recKeys.delete('name'); $('.nm-del').hidden = true; };
  $('.nm-rec').onclick = () => record('name', $('.nm-rec'), () => { $('.nm-del').hidden = false; $('.nm-rec').className = 'pbtn nm-rec'; $('.nm-rec').textContent = '⏺ Record again'; });
  $$('.vs').forEach(b => b.onclick = () => {
    st.pitch = +b.dataset.p; st.pitch_fr = +b.dataset.pf; st.rate = +b.dataset.r; save();
    $('[data-s="pitch"]').value = st.pitch; $('[data-s="pitch_fr"]').value = st.pitch_fr; $('[data-s="rate"]').value = st.rate; vinfo(); demo(S.lang);
  });
  $$('.wsopen').forEach(b => b.onclick = () => worksheetLibrary(b.dataset.l));
  // difficulty controls
  const diffMsg = t => { $('.diffmsg').textContent = t; };
  $$('.jstart').forEach(sel => sel.onchange = () => {
    const lg = sel.dataset.lg, target = +sel.value, n = startJourneyAt(lg, target);
    diffMsg(`${lg === 'en' ? 'English' : 'French'}: journey now starts at ${T.en.journey[target]} (${n} earlier items marked as known).`);
  });
  $$('.mset').forEach(b => b.onclick = () => {
    const n = +b.dataset.n; Object.keys(MATH_MAX).forEach(k => { S.levels[k] = Math.min(n, MATH_MAX[k]); S.streak[k] = { ok: 0, bad: 0 }; }); save();
    diffMsg(`All maths activities set to level ${n} (or their highest level).`);
  });
  $$('.tset').forEach(b => b.onclick = () => {
    const n = +b.dataset.n; Object.keys(THINK_MAX).forEach(k => { S.levels[k] = Math.min(n, THINK_MAX[k]); S.streak[k] = { ok: 0, bad: 0 }; }); save();
    diffMsg(`All thinking games set to level ${n}.`);
  });
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
  let recLang = 'en', recSyl = false;
  const drawRec = () => {
    $('.recgrid').innerHTML = (recSyl ? DATA[recLang].syllables : DATA[recLang].recordable).map(u => `<div><b class="${recKeys.has(recLang + ':' + u) ? 'has' : ''}">${esc(u)}</b>
      <button data-p="${esc(u)}">▶</button><button data-r="${esc(u)}">⏺</button>${recKeys.has(recLang + ':' + u) ? `<button data-d="${esc(u)}">🗑</button>` : ''}</div>`).join('');
    $$('[data-p]').forEach(b => b.onclick = () => { stopSpeech(); playUnit(b.dataset.p, recLang); });
    $$('[data-d]').forEach(b => b.onclick = async () => { await idb.del('rec', recLang + ':' + b.dataset.d); recKeys.delete(recLang + ':' + b.dataset.d); drawRec(); });
    $$('[data-r]').forEach(b => b.onclick = () => record(recLang + ':' + b.dataset.r, b, drawRec));
  };
  $$('.rl').forEach(b => b.onclick = () => { $$('.rl').forEach(x => x.classList.toggle('on', x === b)); recLang = b.dataset.l; recSyl = !!b.dataset.syl; $('.sylnote').hidden = !recSyl; drawRec(); });
  drawRec();
  let armed = false;
  $('.rst').onclick = e => {
    if (!armed) { armed = true; e.target.textContent = 'Tap again to confirm reset'; setTimeout(() => { armed = false; e.target.textContent = 'Reset all progress'; }, 4000); return; }
    const keep = S.settings; S = structuredClone(DEFAULTS); S.settings = keep; save(); parents();
  };
  const drawReadings = () => {
    const box = $('.readlist'), list = S.readings || [];
    box.innerHTML = list.length ? list.map((r, i) => `<div class="goalrow"><button class="pbtn alt" data-rp="${i}">▶</button><b>${esc(r.text)}</b><span>${r.lang === 'fr' ? '🇫🇷' : '🇬🇧'} ${esc(r.d)}</span><button class="pbtn alt" data-rd="${i}">🗑</button></div>`).join('') : '<p>No recordings yet.</p>';
    $$('[data-rp]', box).forEach(b => b.onclick = async () => { const bl = await idb.get('rec', list[+b.dataset.rp].k); if (bl) { stopSpeech(); playBlob(bl); } });
    $$('[data-rd]', box).forEach(b => b.onclick = async () => { const [r] = list.splice(+b.dataset.rd, 1); save(); idb.del('rec', r.k).catch(() => {}); drawReadings(); });
  };
  drawReadings();
  // this week's report
  (() => {
    const R = weekReport(), chips = l => l.map(x => `<span class="chipw">${esc(x)}</span>`).join('') || '<i>—</i>';
    const NAMES = { letters: 'letter sounds', words: 'words', magic: 'magic words', syllables: 'syllables' };
    let h = `<div class="tiles"><div><b>${R.played}/7</b>days played</div><div><b>${R.mins || '–'}</b>minutes</div><div><b>${R.q}</b>answers</div><div><b>${R.q ? R.pct + '%' : '–'}</b>right first time</div></div>`;
    for (const lg of ['en', 'fr']) { const x = R.langs[lg]; if (!x.any) continue;
      const rows = (o, t) => ['letters', 'words', 'magic', 'syllables'].filter(k => o[k].length).map(k => `<p><b>${t} ${NAMES[k]} (${o[k].length}):</b> ${chips(o[k].slice(0, 40))}</p>`).join('');
      h += `<h4>${lg === 'en' ? '🇬🇧 English' : '🇫🇷 Français'} · journey place ${esc(x.stage)}</h4>
        <p>Knows <b>${x.known.letters}</b> letter sounds, <b>${x.known.words}</b> words, <b>${x.known.magic}</b> magic words.</p>
        ${rows(x.learned, '🌱 New this week –') || '<p>Nothing new learned this week yet.</p>'}${rows(x.practise, '🔁 Still practising –')}
        ${x.mix.length ? `<p><b>🔀 Mix-ups (asked → chose):</b> ${chips(x.mix)}</p>` : ''}
        ${x.played.length ? `<p><b>▶ Played this week:</b> ${esc(x.played.join(', '))}</p>` : ''}
        ${x.never.length ? `<p><b>🙈 Ready but never tried:</b> ${esc(x.never.join(', '))}</p>` : ''}`; }
    if (!R.langs.en.any && !R.langs.fr.any) h += '<p>No activity recorded this week yet. (Details such as mix-ups are collected from version 27 on.)</p>';
    if (R.caught) h += `<p>🎣 <b>${R.caught}</b> word(s) she seemed to know but could not read inside a sentence went back to practice.</p>`;
    $('.wkrep').innerHTML = h;
    $('.sharerep').onclick = async () => {
      const text = weekReportText(R), msg = $('.repmsg');
      try { if (navigator.share) { await navigator.share({ title: 'Tiko – weekly report', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied — paste it into a message or an email.'; }
      catch (e) { msg.innerHTML = `<textarea style="width:100%;height:160px;user-select:text;-webkit-user-select:text">${esc(text)}</textarea>`; }
    };
  })();
  $('[data-s="frBoy"]').addEventListener('change', () => setTimeout(() => location.reload(), 150));   // the French texts are prepared when the app starts
  $$('[data-track]').forEach(c => c.addEventListener('change', () => {
    const h = S.settings.hide = S.settings.hide || {}, k = c.dataset.track;
    if (!c.checked && AREAS.includes(k) && AREAS.every(a => a === k || h[a])) {   // something to learn must stay
      c.checked = true; $('.trackmsg').textContent = 'At least one of Reading, Maths, Art and Thinking has to stay.'; return;
    }
    if (c.checked) delete h[k]; else h[k] = true;
    c.closest('.trackb').classList.toggle('on', c.checked); $('.trackmsg').textContent = ''; path = null; save();
  }));
  $$('.themeb').forEach(b => b.onclick =() => { S.settings.theme = b.dataset.theme; save(); applySettings(); parents(); });
  // a little more time today: from wherever she is now, 10 more minutes
  $('.moretime').onclick = () => {
    const m = S.settings.sessionMin || 0; S.extra = { day: today(), min: Math.max(0, Math.ceil(playedSecs() / 60) - m) + 10 }; S.endedDay = ''; save(); parents();
  };
  // backup / restore
  $('.bkup').onclick = () => {
    S.lastBackup = today(); save();
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([backupText()], { type: 'application/json' })); a.download = `tiko-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); $('.bkmsg').textContent = `Saved tiko-backup-${today()}.json (look in Downloads).`;
  };
  $('.rstr').onclick = () => $('.bkfile').click();
  $('.bkfile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const text = await f.text(), d = JSON.parse(text);
      if (!d || d.app !== 'tiko' || !d.data) throw new Error('x');
      $('.bkmsg').innerHTML = `Backup from <b>${esc(d.date || '?')}</b> with ${Object.values(d.data.boxes || {}).filter(v => v >= 5).length} things known. This replaces the progress on this tablet. <button class="pbtn warn doit">Yes, restore it</button>`;
      $('.doit').onclick = () => { try { restoreBackup(text); parents(); setTimeout(() => { const m = $('.bkmsg'); if (m) { m.textContent = 'Restored ✓'; m.scrollIntoView({ block: 'center' }); } }, 50); } catch (err) { $('.bkmsg').textContent = 'That file could not be restored.'; } };
    } catch (err) { $('.bkmsg').textContent = 'That is not a Tiko backup file.'; }
    e.target.value = '';
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
// The worksheet library lives in sheets.js (worksheetLibrary, worksheetShow): a catalogue of one-page sheets for
// reading, writing and maths, each made fresh from where she is now.

// ================= she picks her own world: the theme chooser on the home screen =================
T.en.theme = { ask: 'Who is Tiko today?', unicorn: 'Unicorn', dino: 'Dragon', rex: 'Dinosaur', owl: 'Owl', iam: n => `I am Tiko the ${n.toLowerCase()}!` };
T.fr.theme = { ask: "Qui est Tiko aujourd'hui ?", unicorn: 'Licorne', dino: 'Dragon', rex: 'Dinosaure', owl: 'Chouette', iam: n => `Je suis Tiko ${['Dragon', 'Dinosaure'].includes(n) ? 'le ' : 'la '}${n.toLowerCase()} !` };
function themePicker() {
  stopSpeech(); clearIdle(); musicMode('calm');
  const TH = L().theme;
  app.innerHTML = `<div class="screen center themescreen"><div class="topline"><button class="ic back">🏠</button><h2>🎨 ${esc(TH.ask)}</h2><div style="width:64px"></div></div>
    <div class="themechoice">${Object.keys(THEMES).map((k, i) => `<button class="btn themec ${themeName() === k ? 'on' : ''}" data-theme="${k}" style="--i:${i}">${owl('', k)}<b>${esc(TH[k])}</b></button>`).join('')}</div></div>`;
  $('.back').onclick = home; exitCurrent = home;
  let busy = false;
  $$('.themec').forEach(b => b.onclick = async () => {
    if (busy) return; busy = true;
    S.settings.theme = b.dataset.theme; save(); applySettings();
    $$('.themec').forEach(x => x.classList.toggle('on', x === b));
    const o = $('.owl', b); o.classList.add('dance'); sfx('win'); burstAt(b, 40);
    await speak(TH.iam(TH[b.dataset.theme])); await sleep(400);
    if ($('.themescreen')) home();
  });
  speak(TH.ask);
}

// ================= French for a boy =================
// French words addressed to the child are written in the feminine. If a parent says the child is a boy, they are
// switched to the masculine once, when the app starts (interface text, badges and chat lines; not the story books).
function frenchForBoy() {
  const MAP = [['une championne', 'un champion'], ['championne', 'champion'], ['prête', 'prêt'], ['courageuse', 'courageux'], ['Grande exploratrice', 'Grand explorateur'],
    ['exploratrice', 'explorateur'], ['Exploratrice', 'Explorateur'], ['Bavarde', 'Bavard'], ['contente', 'content'], ['fatiguée', 'fatigué'], ['Meilleures amies', 'Meilleurs amis'],
    ['meilleure amie', 'meilleur ami'], ['amies', 'amis'], ['Amies', 'Amis']];
  const fix = s => MAP.reduce((t, [a, b]) => t.split(a).join(b), s);
  const walk = o => { for (const k of Object.keys(o)) { if (typeof o[k] === 'string') o[k] = fix(o[k]); else if (o[k] && typeof o[k] === 'object') walk(o[k]); } };
  walk(T.fr);
  for (const b of BADGES) b.fr = fix(b.fr);
  for (const c of CHATS) for (const t of c.turns || []) { t.fr = fix(t.fr); for (const o of t.opts) { o[2] = fix(o[2]); o[4] = fix(o[4]); } }
}
if (S.settings.frBoy) frenchForBoy();

// ================= boot =================
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // register the offline worker; if an install attempt fails (flaky network, interfering extensions), retry a few times
  const registerSW = (tries = 0) => navigator.serviceWorker.register('sw.js').then(reg => {
    const w = reg.installing || reg.waiting;
    if (w) w.addEventListener('statechange', () => { if (w.state === 'redundant' && !reg.active && tries < 4) setTimeout(() => registerSW(tries + 1), 4000); });
  }).catch(() => { if (tries < 4) setTimeout(() => registerSW(tries + 1), 4000); });
  registerSW();
  // Quietly fetch the phonics clips one at a time so they're cached for offline use
  // (the service worker caches each response). Skips ones already cached; retries next launch if offline.
  setTimeout(async () => {
    try {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(r => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 10000); });
      for (const [l, keys] of Object.entries(SOUND_CLIPS)) for (const k of keys) {
        const url = `sounds/${l}-${k}.wav`;
        if (await caches.match(url, { ignoreSearch: true })) continue;
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 10000);
        try { await fetch(url, { signal: ctl.signal }); } catch (e) { /* try again next launch */ }
        clearTimeout(tm);
      }
    } catch (e) { /* ignore */ }
  }, 3000);
}
applySettings();
intro();
