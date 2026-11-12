// ================= The starting game for a new child =================
// A child who has just been added to the tablet plays four short rungs (a letter sound, a word to match to a picture, a magic word,
// a longer word to match to a picture) so Tiko can start them at the right place on the journey. Nothing here is graded: every tap gets
// the same friendly reaction, there is no retry, no star, no diary entry and no timer. Loaded after science.js (uses sciFrame).
const PLACE_Q = 3;                       // questions per rung
const placeDeclined = {};                // a child who left the game is not asked again until the app is opened again

const PLC = {
  en: { intro: "Let's play a little game, so I know what you like!", outro: 'Thank you! Now I know where to start.',
    ask: ['Which letter says this?', 'Which picture goes with this word?', 'Which word did I say?', 'Which picture goes with this word?'] },
  fr: { intro: 'On joue à un petit jeu, pour que je sache ce que tu aimes !', outro: 'Merci ! Maintenant je sais par où commencer.',
    ask: ['Quelle lettre fait ce son ?', 'Quelle image va avec ce mot ?', "Quel mot ai-je dit ?", 'Quelle image va avec ce mot ?'] },
};

// words that sound the same: never offered together in the "hear a magic word" rung
const SAME_SOUND = [['et', 'est'], ['a', 'à'], ['ou', 'où'], ['on', 'ont'], ['son', 'sont'], ['ce', 'se'], ['ces', 'ses'], ['la', 'là'], ['mais', 'mes'],
  ['to', 'too', 'two'], ['for', 'four'], ['no', 'know'], ['there', 'their'], ['be', 'bee'], ['see', 'sea'], ['one', 'won'], ['by', 'buy'], ['here', 'hear']];
const soundGroup = w => { const x = String(w).toLowerCase(), i = SAME_SOUND.findIndex(g => g.includes(x)); return i < 0 ? 'w:' + x : 'g:' + i; };
let placeRun = null;                     // the game on screen, if any
const placementActive = () => !!placeRun;

// only a child added on this tablet, only at the very start of the journey, only if the parent has not chosen a place yet
function needsPlacement(lg = S.lang) {
  return S.newChild === true && !(S.placed || {})[lg] && stageOf(lg) === 0 && !Object.keys(S.boxes || {}).some(k => k.startsWith(lg + ':'));
}

// three questions for one rung: { stem, say, opts: [{ html, label, ok }] }
function placementQuestions(rung, lg) {
  const D = DATA[lg], out = [];
  const three = (item, pool, same) => { const others = []; for (const x of shuffle(pool)) { if (others.length === 2) break; if (!same(x, item) && !others.some(o => same(o, x))) others.push(x); } return shuffle([item, ...others]); };
  if (rung === 1) {
    for (const l of shuffle(D.letters).slice(0, PLACE_Q)) out.push({ stem: '🔊', listen: true, say: [PLC[lg].ask[0], { unit: l.l }], opts: three(l, D.letters, (a, b) => a.l === b.l || a.s === b.s).map(x => ({ html: esc(x.l), label: x.l, snd: x.s, ok: x === l })) });
  } else if (rung === 3) {
    const pool = D.sight.slice(0, 20);
    for (const w of shuffle(pool).slice(0, PLACE_Q)) out.push({ stem: '👂', listen: true, say: [PLC[lg].ask[2], w.w], opts: three(w, pool, (a, b) => soundGroup(a.w) === soundGroup(b.w)).map(x => ({ html: esc(x.w), label: x.w, grp: soundGroup(x.w), ok: x === w })) });
  } else {
    const pool = tier(lg, rung === 2 ? 1 : 2).filter(w => w.e && w.w);
    for (const w of shuffle(pool).slice(0, PLACE_Q)) out.push({ stem: esc(w.w), say: [PLC[lg].ask[rung - 1]], opts: three(w, pool, (a, b) => a.e === b.e || a.w === b.w).map(x => ({ html: x.e, label: x.w, ok: x === w })) });
  }
  return out;
}

// resolves with the number of rungs passed (0 to 4), after applying it; null if the child left
function placement() {
  if (placeRun) return placeRun;         // never two games at once
  return placeRun = new Promise(resolve => {
    const lg = S.lang, P = PLC[lg];
    let alive = true, applied = null, n = 0, said = [], locked = false, token = 0;
    const fin = v => { if (!alive) return; alive = false; placeRun = null; const row = $('.plc-row'); if (row) lfStop(row); stopSpeech(); clearIdle(); if (v === null) placeDeclined[lg] = true; resolve(v); };
    clearIdle(); stopSpeech(); zone('home'); musicMode('calm'); exitCurrent = () => fin(applied);
    const frame = (inner, rung, qi, extra) => { app.innerHTML = sciFrame('placement', inner, PLACE_Q, qi); const sc = $('.placement'); sc.dataset.n = extra; sc.dataset.rung = rung;
      $('.home').onclick = () => fin(applied); $('.replay').onclick = () => { sfx('tap'); if (said.length) lfSay($('.plc-row'), ...said); }; };
    const run = async () => {
      let passed = 0, first = true;
      for (let rung = 1; rung <= 4 && alive; rung++) {
        let right = 0;
        for (const [qi, q] of placementQuestions(rung, lg).entries()) {
          if (!alive) return;
          const my = ++token; locked = false; said = q.say;
          frame(`<div class="plc-stem bob"${q.listen ? ` role="button" tabindex="0" aria-label="${lg === 'fr' ? 'Écouter encore' : 'Listen again'}"` : ''}>${q.stem}</div><div class="btnrow plc-row">${q.opts.map((o, i) => `<button class="btn plc-opt" data-i="${i}" ${o.ok ? 'data-ok="1"' : ''} aria-label="${esc(o.label)}">${o.html}</button>`).join('')}</div>`, rung, qi, n);
          const stemEl = $('.plc-stem[role="button"]'); if (stemEl) { stemEl.onclick = () => { sfx('tap'); if (said.length) lfSay($('.plc-row'), ...said); }; stemEl.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stemEl.click(); } }; }
          // Tiko says hello first (once); the question is spoken once that is finished
          const lead = first ? speak(P.intro) : Promise.resolve(); first = false;
          const asked = lead.then(() => { if (alive && my === token && !locked) return speak(...said); });
          listenFirst($('.plc-row'), asked);   // the choices wait until Tiko has finished asking (the parent's "listen first" setting)
          const row = $('.plc-row');   // a finger put down while the choices wait must not answer when lifted after they woke
          row.addEventListener('pointerdown', () => { row._downWait = row.classList.contains('wait'); }, true);
          for (const ev of ['pointerup', 'pointercancel']) row.addEventListener(ev, () => setTimeout(() => { row._downWait = false; }, 600), true);
          const tapped = await new Promise(res => $$('.plc-opt').forEach(b => b.onclick = () => { if (locked || !alive || row.classList.contains('wait') || row._downWait) return; locked = true; b.classList.add('chosen'); sfx('pop'); res(b); }));
          if (tapped.dataset.ok) right++;
          await sleep(650); n++;
        }
        if (right < PLACE_Q) break;
        passed++;
      }
      if (!alive) return;
      startJourneyAt(lg, passed, true); S.placed = S.placed || {}; S.placed[lg] = true; save(); applied = passed;
      token++; frame(`<div class="plc-stem">${owl('big')}</div>${sciText(P.outro)}`, 0, 0, 'end'); said = [P.outro];
      sfx('win'); await speak(P.outro); await sleep(500); fin(passed);
    };
    run();
  });
}
