// Tiko worksheet library — pen-and-paper practice for the parent to print or download.
// A catalogue of sheets in four tracks (reading, writing, maths, science). Every sheet is one A4 page, is made fresh each
// time, and follows where she is now: her place on the reading journey, the words and letters she is still
// learning (those come first; what she already knows only fills the gaps) and her maths levels.
// A whole track can be opened as a pack (one sheet per page). Everything can be printed / saved as PDF, or
// downloaded as one self-contained HTML file (all styles are in WS_CSS, so the file needs nothing else).
// Loaded after app.js; uses its helpers (S, DATA, lvl, stageOf, boxOf, wordsNow, …).

const tr = (en, fr) => (S.lang === 'fr' ? fr : en);
const wsLine = '<span class="ws-line"></span>', wsBox = '<span class="ws-ans"></span>';
// items she is still learning first (missed ones before brand-new ones); what she already knows only fills the gaps
function wsRank(items, known, met) { const rank = i => (known(i) ? 2 : met(i) ? 0 : 1); return shuffle(items).sort((x, y) => rank(x) - rank(y)); }
const wsDistinct = (list, n) => { const out = []; for (const w of list) { if (!out.some(o => o.e === w.e || o.w === w.w)) out.push(w); if (out.length === n) break; } return out; };
const wsUniq = (n, gen) => { const out = [], seen = new Set(); for (let i = 0; i < 300 && out.length < n; i++) { const x = gen(), k = [].concat(x).join(); if (!seen.has(k)) { seen.add(k); out.push(x); } } return out; };
// n items, different from each other for as long as that is possible, then repeats (small number ranges run out)
const wsMany = (n, gen) => { const out = wsUniq(n, gen); while (out.length < n) out.push(gen()); return out; };
const wsLetters = () => wsRank(DATA[S.lang].letters, i => boxOf('letter', i.id) >= 5, i => boxOf('letter', i.id) > 0);
const wsWords = (n, filter = () => true) => wsDistinct(wsRank(wordsNow().filter(filter), w => isKnown('blend', w.id), w => WORD_SETS.some(s => boxOf(s, w.id) > 0)), n);
const wsSight = n => wsRank(stageOf() >= 2 ? DATA[S.lang].sight : DATA[S.lang].sight.slice(0, 20), i => boxOf('sight', i.id) >= 5, i => boxOf('sight', i.id) > 0).slice(0, n);
const wsPlain = w => !w.x && /^[a-zàâçéèêëîïôûùüœ]{3,6}$/.test(w.w);   // one plain word for a clear picture: fits letter boxes
const wsThings = () => shuffle(knownWords());                           // words she has met that are things (fit "I see a …")
const wsSentence = w => pick(SENTENCES[S.lang])(w.w);
const wsMatch = items => { const right = shuffle(items); return `<div class="ws-match">${items.map((x, i) => `<span class="l">${esc(x.w)}</span><span></span><span class="r ws-pic">${right[i].e}</span>`).join('')}</div>`; };
const wsDots = n => (n <= 10 ? '○'.repeat(n) : '');
const wsObjs = (n, e) => `<span class="ws-objs">${Array.from({ length: n }, (_, j) => e + (j % 5 === 4 ? ' ' : '')).join('')}</span>`;
const wsPlace = () => `${tr('place', 'étape')} ${stageOf() + 1}/${STAGES.length + 1}`;
// the same number ranges as the app at her level
function wsAddPair() {
  const la = lvl('add');
  if (la >= 5) { if (Math.random() < .5) { const a = 11 + rand(60); return [a, 10 * (1 + rand(Math.min(3, Math.floor((99 - a) / 10))))]; } const a = 10 * (1 + rand(8)) + 1 + rand(7); return [a, 1 + rand(9 - a % 10)]; }
  if (la === 4) { const a = 10 + rand(16); return [a, 1 + rand(Math.min(6, 30 - a))]; }
  const s = 2 + rand([5, 10, 20][la - 1] - 1), a = 1 + rand(Math.min(s - 1, 10)); return [a, s - a];
}
function wsSubPair() {
  const ls = lvl('sub');
  if (ls >= 5) { if (Math.random() < .5) { const a = 31 + rand(68); return [a, 10 * (1 + rand(Math.min(3, Math.floor(a / 10) - 1)))]; } const a = 10 * (1 + rand(9)) + 2 + rand(8); return [a, 1 + rand(a % 10)]; }
  if (ls === 4) { const a = 12 + rand(19); return [a, 1 + rand(6)]; }
  const a = 2 + rand([5, 10, 20][ls - 1] - 1); return [a, 1 + rand(a - 1)];
}
const wsSums = (pairs, op, help) => `<div class="ws-sums ${pairs.some(p => p[0] > 30) ? 'wide' : ''}">${pairs.map(([a, b]) => `<div>${a} ${op} ${b} = ${wsBox}${help ? `<small>${wsDots(a)}${op === '+' ? ' &nbsp; ' + wsDots(b) : ''}</small>` : ''}</div>`).join('')}</div>`;
function wsSeqRow(start, step, blanks) {
  const v = Array.from({ length: 6 }, (_, i) => start + i * step), hide = shuffle([1, 2, 3, 4, 5]).slice(0, blanks);
  return { html: `<div class="ws-seq">${v.map((n, i) => (hide.includes(i) ? wsBox : `<span>${n}</span>`)).join('<span>,</span>')}</div>`, ans: v.filter((_, i) => hide.includes(i)).join(' ') };
}

// ---------------------------------------------------------------- the catalogue
// make() runs with S.lang set to the sheet's language and returns { secs: [[instruction, html], …], answers?, level? }
const SHEETS = [
  // ===== reading =====
  { id: 'letters', track: 'read', icon: '🔤', en: 'Letters and sounds', fr: 'Lettres et sons', done: st => st >= 2, make() {
    const d = DATA[S.lang], ls = wsLetters(), a = wsDistinct(ls.map(x => ({ ...x, w: x.l })), 6), b = ls.filter(x => !a.some(y => y.l === x.l));
    const pool = [...b, ...a], c = pool.slice(0, 8), e2 = pool.slice(8, 17).length >= 6 ? pool.slice(8, 17) : shuffle(pool).slice(0, 9);
    return { secs: [
      [tr('Draw a line from each letter to the picture that starts with it.', "Relie chaque lettre à l'image qui commence par cette lettre."), wsMatch(a)],
      [tr('Say the picture. Circle the letter it starts with.', "Dis le nom de l'image. Entoure la lettre du début."), `<div class="ws-grid2">${c.map(l => { const o = shuffle([l, ...shuffle(d.letters.filter(x => x.l !== l.l && x.s !== l.s)).slice(0, 2)]);
        return `<div class="ws-crow"><span class="ws-pic">${l.e}</span><span class="opts">${o.map(x => `<i>${esc(x.l)}</i>`).join('')}</span></div>`; }).join('')}</div>`],
      [tr('Say the picture. Write the letter it starts with.', "Dis le nom de l'image. Écris la lettre du début."), `<div class="ws-grid3">${e2.map(l => `<div class="ws-crow"><span class="ws-pic">${l.e}</span>${wsBox}</div>`).join('')}</div>`],
    ], answers: '3) ' + e2.map(l => l.l).join(' ') }; } },
  { id: 'match', track: 'read', icon: '🔗', en: 'Read and match', fr: 'Lis et relie', make() {
    const ws = wsWords(16);
    return { secs: [
      [tr('Read each word. Draw a line to its picture.', 'Lis chaque mot. Relie-le à son image.'), wsMatch(ws.slice(0, 5))],
      [tr('Again, with new words!', 'Encore, avec de nouveaux mots !'), wsMatch(ws.slice(5, 10))],
      [tr('Read the word. Draw it in the box.', 'Lis le mot. Dessine-le dans le cadre.'), `<div class="ws-boxes three">${ws.slice(10, 16).map(w => `<div><b>${esc(w.w)}</b></div>`).join('')}</div>`],
    ] }; } },
  { id: 'sounds', track: 'read', icon: '👂', en: 'Missing sounds', fr: 'Le son qui manque', make() {
    const first = w => { const u = unitText(w.units[0]); return !w.units[0].startsWith('_') && w.w.startsWith(u) && u.length < w.w.length; };
    const last = w => { const raw = w.units[w.units.length - 1], u = unitText(raw); return !raw.startsWith('_') && !raw.includes(':') && w.w.endsWith(u) && u.length < w.w.length; };
    const all = wsWords(60), f = all.filter(first).slice(0, 12), l = all.filter(w => last(w) && !f.includes(w)).slice(0, 10);
    const cut = (w, atEnd) => { const u = unitText(w.units[atEnd ? w.units.length - 1 : 0]); return atEnd ? `${esc(w.w.slice(0, -u.length))}<u></u>` : `<u></u>${esc(w.w.slice(u.length))}`; };
    const secs = [[tr('Say the picture. Write the missing FIRST sound.', "Dis le nom de l'image. Écris le son qui manque AU DÉBUT."), `<div class="ws-grid2 roomy">${f.map(w => `<div class="ws-crow"><span class="ws-pic">${w.e}</span><span>${cut(w, false)}</span></div>`).join('')}</div>`]];
    if (l.length >= 2) secs.push([tr('Say the picture. Write the missing LAST sound.', "Dis le nom de l'image. Écris le son qui manque À LA FIN."), `<div class="ws-grid2 roomy">${l.map(w => `<div class="ws-crow"><span class="ws-pic">${w.e}</span><span>${cut(w, true)}</span></div>`).join('')}</div>`]);
    return { secs, answers: '1) ' + f.map(w => unitText(w.units[0])).join(' ') + (l.length >= 2 ? ' &nbsp; 2) ' + l.map(w => unitText(w.units[w.units.length - 1])).join(' ') : '') }; } },
  { id: 'families', track: 'read', icon: '🏠', en: 'Word families', fr: 'Les syllabes', make() {
    if (S.lang === 'fr') {
      // méthode syllabique: a consonant and a vowel make a syllable
      const cons = wsLetters().filter(x => /^[bdflmnprstv]$/.test(x.l)).slice(0, 7).map(x => x.l), vow = ['a', 'e', 'i', 'o', 'u'];
      const grid = cons.map(c => `<div class="ws-syl">${vow.map(v => `<span>${c} + ${v} = ${wsBox}</span>`).join('')}</div>`).join('');
      const ws = wsWords(30, w => w.units.length === 2 && !w.units.some(u => u.startsWith('_') || u.includes(':')) && w.w === w.units.join('')).slice(0, 10);
      const secs = [['Colle la consonne et la voyelle. Écris la syllabe, puis lis-la.', grid]];
      if (ws.length >= 3) secs.push(['Tape dans tes mains pour chaque syllabe. Trace un trait entre les syllabes.', `<div class="ws-grid2 roomy">${ws.map(w => `<div class="ws-crow"><span class="ws-pic">${w.e}</span><span class="spaced">${esc(w.w)}</span></div>`).join('')}</div>`]);
      return { secs, answers: ws.length >= 3 ? '2) ' + ws.map(w => w.units.map(unitText).join('|')).join(' ') : '' };
    }
    const byW = Object.fromEntries(DATA.en.words.map(w => [w.w, w])), now = new Set(wordsNow().map(w => w.w));
    const fams = shuffle(Object.entries(FAMILIES).filter(([, l]) => l.filter(w => byW[w] && now.has(w)).length >= 2)).slice(0, 5);
    return { secs: fams.map(([end, l]) => { const ws = l.filter(w => byW[w] && now.has(w)).slice(0, 4);
      return [`These words all end in <b class="fam">-${end}</b>. Write the ending. Then read the word.`, `<div class="ws-grid2">${ws.map(w => `<div class="ws-crow"><span class="ws-pic">${byW[w].e}</span><span>${esc(w.slice(0, -end.length))}<u></u></span></div>`).join('')}</div>
        <div class="ws-trow"><span class="small">One more word that ends in -${end}:</span>${wsLine}</div>`]; }) }; } },
  { id: 'magic', track: 'read', icon: '✨', en: 'Magic words', fr: 'Mots magiques', make() {
    const d = DATA[S.lang], sg = wsSight(20), find = sg.slice(0, 8);
    return { secs: [
      [tr('Read the magic word. Circle it every time you see it in the row.', 'Lis le mot magique. Entoure-le chaque fois que tu le vois dans la ligne.'), find.map(x => { const others = shuffle(d.sight.filter(y => y.w !== x.w)).slice(0, 3);
        return `<div class="ws-find"><b>${esc(x.w)}</b><span>${shuffle([x, x, ...others]).map(y => `<i>${esc(y.w)}</i>`).join('')}</span></div>`; }).join('')],
      [tr('Read each word to a grown-up. Colour the star when you can read it.', 'Lis chaque mot à un adulte. Colorie l’étoile quand tu sais le lire.'), `<div class="ws-stars">${sg.slice(8, 20).map(x => `<span>☆ ${esc(x.w)}</span>`).join('')}</div>`],
    ] }; } },
  { id: 'readdraw', track: 'read', icon: '🖍️', en: 'Read and draw', fr: 'Lis et dessine', make() {
    const st = stageOf(), ws = st >= 4 ? wsThings().slice(0, 4) : wsWords(4);
    return { secs: [[st >= 4 ? tr('Read each sentence. Draw what it says.', 'Lis chaque phrase. Dessine ce qu’elle dit.') : tr('Read each word. Draw it.', 'Lis chaque mot. Dessine-le.'),
      `<div class="ws-boxes two">${ws.map(w => `<div><b class="${st >= 4 ? 'long' : ''}">${esc(st >= 4 ? wsSentence(w) : w.w)}</b></div>`).join('')}</div>`]] }; } },
  { id: 'sentences', track: 'read', icon: '🛶', en: 'Sentences', fr: 'Les phrases', ahead: st => st < 4, make() {
    const ws = wsDistinct(wsThings(), 10), all = DATA[S.lang].words;
    return { secs: [[tr('Read the sentence. Circle the picture that goes with it.', 'Lis la phrase. Entoure l’image qui va avec.'), ws.map(w => { const o = wsDistinct(shuffle(all.filter(x => x.e !== w.e)), 2);
      return `<div class="ws-srow"><span class="ws-sent">${esc(wsSentence(w))}</span><span class="pics">${shuffle([w, ...o]).map(x => `<i>${x.e}</i>`).join('')}</span></div>`; }).join('')]] }; } },
  { id: 'story', track: 'read', icon: '🏰', en: 'Story and question', fr: 'Histoire et question', ahead: st => st < 6, make() {
    const kw = wsThings(), secs = [], ans = [];
    shuffle(STORIES[S.lang]).slice(0, 3).forEach((f, i) => { const A = kw[(i * 2) % kw.length], B = kw.slice((i * 2 + 1) % kw.length).find(x => x.e !== A.e) || kw.find(x => x.e !== A.e), s = f(A.w, B.w);
      secs.push([tr('Read the story. Write the answer. Then draw the story.', "Lis l'histoire. Écris la réponse. Puis dessine l'histoire."), `<div class="ws-story"><div>${s.lines.map(l => `<div class="ws-sent">${esc(l)}</div>`).join('')}
        <div class="ws-trow q"><span class="ws-sent">${esc(s.q)}</span>${wsLine}</div></div><div class="ws-box"></div></div>`]); ans.push((s.answer === 'A' ? A : B).w); });
    return { secs, answers: ans.map((a, i) => `${i + 1}) ${a}`).join(' &nbsp; ') }; } },
  { id: 'readmix', track: 'read', icon: '🎒', en: 'Mixed reading practice', fr: 'Lecture : un peu de tout', make() {
    const st = stageOf(), secs = [];
    if (st === 0) {
      const ls = wsLetters(), b = wsDistinct(ls.map(x => ({ ...x, w: x.l })), 5);
      secs.push([tr('Trace each letter. Then write it on the line.', 'Repasse sur chaque lettre. Puis écris-la sur la ligne.'), ls.slice(0, 4).map(l => `<div class="ws-trow"><span class="ws-pic">${l.e}</span><span class="ws-tr"><b>${esc(l.l)}</b>${esc(l.l).repeat(4)}</span>${wsLine}</div>`).join('')]);
      secs.push([tr('Draw a line from each letter to the picture that starts with it.', "Relie chaque lettre à l'image qui commence par cette lettre."), wsMatch(b)]);
      secs.push([tr('Say the picture. Write the letter it starts with.', "Dis le nom de l'image. Écris la lettre du début."), `<div class="ws-grid3">${ls.slice(4, 10).map(l => `<div class="ws-crow"><span class="ws-pic">${l.e}</span>${wsBox}</div>`).join('')}</div>`]);
      return { secs };
    }
    const ws = wsWords(11);
    secs.push([tr('Read each word. Draw a line to its picture.', 'Lis chaque mot. Relie-le à son image.'), wsMatch(ws.slice(0, 5))]);
    if (st < 4) secs.push([tr('Read the word. Draw it in the box.', 'Lis le mot. Dessine-le dans le cadre.'), `<div class="ws-boxes three">${ws.slice(8, 11).map(w => `<div><b>${esc(w.w)}</b></div>`).join('')}</div>`]);
    secs.push([tr('Trace the word. Then write it on the line.', 'Repasse sur le mot. Puis écris-le sur la ligne.'), ws.slice(5, 8).map(w => `<div class="ws-trow"><span class="ws-pic">${w.e}</span><span class="ws-tr word">${esc(w.w)}</span>${wsLine}</div>`).join('')]);
    secs.push([tr('Magic words: read, trace, then write.', 'Mots magiques : lis, repasse, puis écris.'), wsSight(3).map(x => `<div class="ws-trow"><span class="ws-tr word"><b>${esc(x.w)}</b> ${esc(x.w)}</span>${wsLine}</div>`).join('')]);
    if (st >= 4) secs.push([tr('Read the sentence. Draw it in the box. Then copy it.', 'Lis la phrase. Dessine-la dans le cadre. Puis recopie-la.'), `<div class="ws-sent">${esc(wsSentence(wsThings()[0]))}</div><div class="ws-draw"><div class="ws-box"></div><div class="lines">${wsLine}${wsLine}</div></div>`]);
    return { secs }; } },

  // ===== writing =====
  { id: 'traceletters', track: 'write', icon: '✍️', en: 'Trace the letters', fr: 'Repasse sur les lettres', done: st => st >= 2, make() {
    return { secs: [[tr('Trace each letter. Then write it on the line. Say its sound as you write.', 'Repasse sur chaque lettre. Puis écris-la sur la ligne. Dis son bruit en écrivant.'),
      wsLetters().slice(0, 13).map(l => `<div class="ws-trow tall"><span class="ws-pic">${l.e}</span><span class="ws-tr"><b>${esc(l.l)}</b>${esc(l.l).repeat(4)}</span>${wsLine}</div>`).join('')]] }; } },
  { id: 'tracewords', track: 'write', icon: '📝', en: 'Trace and write words', fr: 'Repasse et écris', make() {
    return { secs: [[tr('Trace the word. Then write it on the line.', 'Repasse sur le mot. Puis écris-le sur la ligne.'),
      wsWords(13, w => /^[\p{L}]{2,8}$/u.test(w.w)).map(w => `<div class="ws-trow tall"><span class="ws-pic">${w.e}</span><span class="ws-tr word">${esc(w.w)}</span>${wsLine}</div>`).join('')]] }; } },
  { id: 'spell', track: 'write', icon: '🧱', en: 'Write the word', fr: 'Écris le mot', make() {
    const st = stageOf(), ws = wsWords(16, wsPlain);
    return { secs: [[st < 3 ? tr('Say the picture slowly. Write one letter in each box. The first one is done for you.', "Dis le nom de l'image lentement. Écris une lettre dans chaque case. La première est déjà là.")
      : tr('Say the picture slowly. Write one letter in each box.', "Dis le nom de l'image lentement. Écris une lettre dans chaque case."),
      `<div class="ws-grid2 roomy">${ws.map(w => `<div class="ws-crow"><span class="ws-pic">${w.e}</span><span class="ws-cells">${[...w.w].map((c, i) => `<i>${st < 3 && i === 0 ? esc(c) : ''}</i>`).join('')}</span></div>`).join('')}</div>`]],
      answers: ws.map(w => w.w).join(', ') }; } },
  { id: 'unscramble', track: 'write', icon: '🔀', en: 'Mixed-up letters', fr: 'Lettres mélangées', make() {
    const ws = wsWords(13, w => wsPlain(w) && w.w.length <= 5 && new Set(w.w).size > 1);
    const mix = w => { let s; for (let i = 0; i < 20; i++) { s = shuffle([...w]).join(''); if (s !== w) break; } return s; };
    return { secs: [[tr('The letters are mixed up! Look at the picture. Write the word.', "Les lettres sont mélangées ! Regarde l'image. Écris le mot."),
      ws.map(w => `<div class="ws-trow tall"><span class="ws-pic">${w.e}</span><span class="ws-mix">${[...mix(w.w)].map(c => `<i>${esc(c)}</i>`).join('')}</span>${wsLine}</div>`).join('')]], answers: ws.map(w => w.w).join(', ') }; } },
  { id: 'magicwrite', track: 'write', icon: '🌟', en: 'Write the magic words', fr: 'Écris les mots magiques', make() {
    return { secs: [[tr('Read the magic word. Trace it. Then write it two times.', 'Lis le mot magique. Repasse dessus. Puis écris-le deux fois.'),
      wsSight(14).map(x => `<div class="ws-trow tall"><span class="ws-tr word"><b>${esc(x.w)}</b> ${esc(x.w)}</span>${wsLine}</div>`).join('')]] }; } },
  { id: 'finish', track: 'write', icon: '🧩', en: 'Finish the sentence', fr: 'Complète la phrase', ahead: st => st < 3, make() {
    const ws = wsDistinct(wsThings(), 10), rows = ws.map(w => { let s = wsSentence(w); for (let i = 0; i < 10 && !s.includes(w.w); i++) s = wsSentence(w); return [w, s.replace(w.w, '<u class="wide"></u>')]; });
    return { secs: [[tr('Look at the picture. Choose the right word from the box and write it.', "Regarde l'image. Choisis le bon mot dans le cadre et écris-le."),
      `<div class="ws-bank">${shuffle(ws).map(w => `<span>${esc(w.w)}</span>`).join('')}</div>${rows.map(([w, s]) => `<div class="ws-srow"><span class="ws-pic">${w.e}</span><span class="ws-sent grow">${s}</span></div>`).join('')}`]],
      answers: ws.map(w => w.w).join(', ') }; } },
  { id: 'copy', track: 'write', icon: '📜', en: 'Copy the sentence', fr: 'Recopie la phrase', ahead: st => st < 4, make() {
    const ws = wsDistinct(wsThings(), 5);
    return { secs: [[tr('Read the sentence. Trace it. Then write it yourself. Start with a capital letter and end with a full stop.', 'Lis la phrase. Repasse dessus. Puis écris-la tout seul. Commence par une majuscule et finis par un point.'),
      ws.map(w => { const s = wsSentence(w); return `<div class="ws-copy"><div class="ws-trow"><span class="ws-pic">${w.e}</span><span class="ws-sent">${esc(s)}</span></div><div class="ws-tr sent">${esc(s)}</div><div class="ws-trow">${wsLine}</div></div>`; }).join('')]] }; } },
  { id: 'mysentence', track: 'write', icon: '💭', en: 'My own sentence', fr: 'Ma phrase à moi', ahead: st => st < 4, make() {
    const ws = wsDistinct(wsThings(), 5), bank = shuffle(DATA[S.lang].sight.filter(x => boxOf('sight', x.id) > 0)).slice(0, 8);
    const words = bank.length >= 5 ? bank : DATA[S.lang].sight.slice(0, 8);
    return { secs: [[tr('Write a sentence about each picture. The words in the box can help you.', "Écris une phrase sur chaque image. Les mots du cadre peuvent t'aider."),
      `<div class="ws-bank">${words.map(x => `<span>${esc(x.w)}</span>`).join('')}</div>${ws.map(w => `<div class="ws-own"><span class="ws-pic big">${w.e}</span><div class="lines"><span class="small">${esc(w.w)}</span>${wsLine}${wsLine}${wsLine}</div></div>`).join('')}`]] }; } },
  { id: 'writemix', track: 'write', icon: '🎒', en: 'Mixed writing practice', fr: 'Écriture : un peu de tout', make() {
    const st = stageOf(), ws = wsWords(10, wsPlain), secs = [];
    if (st < 2) secs.push([tr('Trace each letter. Then write it on the line.', 'Repasse sur chaque lettre. Puis écris-la sur la ligne.'), wsLetters().slice(0, 3).map(l => `<div class="ws-trow"><span class="ws-pic">${l.e}</span><span class="ws-tr"><b>${esc(l.l)}</b>${esc(l.l).repeat(4)}</span>${wsLine}</div>`).join('')]);
    secs.push([tr('Trace the word. Then write it on the line.', 'Repasse sur le mot. Puis écris-le sur la ligne.'), ws.slice(0, 3).map(w => `<div class="ws-trow"><span class="ws-pic">${w.e}</span><span class="ws-tr word">${esc(w.w)}</span>${wsLine}</div>`).join('')]);
    secs.push([tr('Say the picture slowly. Write one letter in each box.', "Dis le nom de l'image lentement. Écris une lettre dans chaque case."), `<div class="ws-grid2 roomy">${ws.slice(3, 9).map(w => `<div class="ws-crow"><span class="ws-pic">${w.e}</span><span class="ws-cells">${[...w.w].map((c, i) => `<i>${st < 3 && i === 0 ? esc(c) : ''}</i>`).join('')}</span></div>`).join('')}</div>`]);
    secs.push([tr('Magic words: read, trace, then write.', 'Mots magiques : lis, repasse, puis écris.'), wsSight(3).map(x => `<div class="ws-trow"><span class="ws-tr word"><b>${esc(x.w)}</b> ${esc(x.w)}</span>${wsLine}</div>`).join('')]);
    if (st >= 4) { const w = wsThings()[0], s = wsSentence(w); secs.push([tr('Trace the sentence. Then write it yourself.', 'Repasse sur la phrase. Puis écris-la tout seul.'), `<div class="ws-copy"><div class="ws-tr sent">${esc(s)}</div><div class="ws-trow">${wsLine}</div></div>`]); }
    return { secs, answers: ws.slice(3, 9).map(w => w.w).join(', ') }; } },

  // ===== maths =====
  { id: 'count', track: 'math', icon: '🔢', en: 'Count and write', fr: 'Compte et écris', make() {
    const l = lvl('count'), max = [5, 10, 20][l - 1], ns = wsMany(l === 3 ? 10 : 12, () => Math.max(l > 1 ? 4 : 1, 1 + rand(max))), es = shuffle(OBJECTS);
    return { secs: [[tr('Count. Write how many. You can put a tick on each one as you count.', 'Compte. Écris combien il y en a. Tu peux cocher chaque objet en comptant.'),
      `<div class="ws-count">${ns.map((n, i) => `<div>${wsObjs(n, es[i % es.length])}${wsBox}</div>`).join('')}</div>`]], answers: ns.join(', '), level: tr('counting level ', 'compter niveau ') + l }; } },
  { id: 'drawn', track: 'math', icon: '⚫', en: 'Draw the number', fr: 'Dessine le nombre', make() {
    const l = lvl('count'), max = [5, 10, 20][l - 1], ns = wsMany(9, () => 1 + rand(max));
    return { secs: [[tr('Read the number. Draw that many dots in the box.', 'Lis le nombre. Dessine autant de points dans le cadre.'), `<div class="ws-boxes three num">${ns.map(n => `<div><b>${n}</b></div>`).join('')}</div>`]], level: tr('counting level ', 'compter niveau ') + l }; } },
  { id: 'tracenum', track: 'math', icon: '✏️', en: 'Write the numbers', fr: 'Écris les nombres', make() {
    const big = lvl('count') >= 3, rows = big ? [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12], [13, 14, 15], [16, 17, 18], [19, 20]] : [[0, 1, 2], [3, 4, 5], [6, 7], [8, 9, 10]];
    return { secs: [[tr('Trace each number. Then write it yourself.', 'Repasse sur chaque nombre. Puis écris-le tout seul.'),
      rows.map(r => `<div class="ws-trow"><span class="ws-tr word">${r.map(n => `${n} ${n}`).join('  ')}</span></div><div class="ws-trow">${wsLine}</div><div class="ws-trow ${big ? '' : 'tall'}">${wsLine}</div>`).join('')]] }; } },
  { id: 'add', track: 'math', icon: '➕', en: 'Adding', fr: 'Additions', make() {
    const la = lvl('add'), ps = wsMany(la <= 2 ? 18 : la >= 5 ? 16 : 24, wsAddPair);
    return { secs: [[tr('Put together. Write the answer.', 'Mets ensemble. Écris la réponse.') + (la <= 2 ? ` <small>${tr('You can draw dots or use your fingers.', 'Tu peux dessiner des points ou compter sur tes doigts.')}</small>` : ''), wsSums(ps, '+', la <= 2)]],
      answers: ps.map(([a, b]) => a + b).join(', '), level: tr('adding level ', 'additions niveau ') + la }; } },
  { id: 'sub', track: 'math', icon: '➖', en: 'Taking away', fr: 'Soustractions', make() {
    const ls = lvl('sub'), ps = wsMany(ls <= 2 ? 18 : ls >= 5 ? 16 : 24, wsSubPair);
    return { secs: [[tr('Take away. Write the answer.', 'Enlève. Écris la réponse.') + (ls <= 2 ? ` <small>${tr('Cross out the dots you take away.', 'Barre les points que tu enlèves.')}</small>` : ''), wsSums(ps, '−', ls <= 2)]],
      answers: ps.map(([a, b]) => a - b).join(', '), level: tr('taking away level ', 'soustractions niveau ') + ls }; } },
  { id: 'bonds', track: 'math', icon: '🔟', en: 'Number friends', fr: 'Les amis des nombres', make() {
    const T = lvl('bonds') >= 2 ? 10 : 5, all = Array.from({ length: T - 1 }, (_, i) => i + 1), ks = [...shuffle(all), ...shuffle(all), ...shuffle(all)].slice(0, T === 5 ? 12 : 14);
    const frame = k => `<span class="ws-frame t${T}">${Array.from({ length: T }, (_, i) => `<i>${i < k ? '●' : ''}</i>`).join('')}</span>`;
    return { secs: [[tr(`How many more to make ${T}? Draw the missing dots. Write the number.`, `Combien en faut-il encore pour faire ${T} ? Dessine les points qui manquent. Écris le nombre.`),
      `<div class="ws-grid2 roomy">${ks.map(k => `<div class="ws-bond">${frame(k)}<span>${k} + ${wsBox} = ${T}</span></div>`).join('')}</div>`]], answers: ks.map(k => T - k).join(', '), level: tr('make ', 'faire ') + T }; } },
  { id: 'doubles', track: 'math', icon: '🦋', en: 'Doubles', fr: 'Les doubles', make() {
    const max = lvl('doubles') >= 2 ? 10 : 5, all = Array.from({ length: max }, (_, i) => i + 1), ns = [...shuffle(all), ...shuffle(all), ...shuffle(all)].slice(0, max === 5 ? 12 : 14);
    return { secs: [[tr('A double is the same number two times. Write the answer.', 'Un double, c’est deux fois le même nombre. Écris la réponse.'),
      `<div class="ws-sums wide">${ns.map(n => `<div>${n} + ${n} = ${wsBox}<small>${wsDots(n)} &nbsp; ${wsDots(n)}</small></div>`).join('')}</div>`]], answers: ns.map(n => 2 * n).join(', ') }; } },
  { id: 'order', track: 'math', icon: '➡️', en: 'Number order', fr: 'La suite des nombres', make() {
    const ln = lvl('next'), nmax = [20, 50, 100][ln - 1], blanks = ln > 1 ? 3 : 2, rows = [];
    for (let i = 0; i < 4; i++) rows.push(wsSeqRow(1 + rand(nmax - 6), 1, blanks));
    const back = [0, 1, 2].map(() => wsSeqRow(8 + rand(nmax - 8), -1, blanks));
    const steps = lvl('skip') === 1 ? [10, 10, 10] : shuffle([2, 5, 10]), jump = steps.map((s, i) => wsSeqRow(s * (lvl('skip') === 1 ? 1 + i : 1 + rand(3)), s, blanks));
    return { secs: [[tr('Count forwards. Write the missing numbers.', 'Compte en avançant. Écris les nombres qui manquent.'), rows.map(r => r.html).join('')],
      [tr('Count backwards. Write the missing numbers.', 'Compte à reculons. Écris les nombres qui manquent.'), back.map(r => r.html).join('')],
      [tr('The frog jumps! Find the size of its jump. Write the missing numbers.', 'La grenouille saute ! Trouve la taille de son saut. Écris les nombres qui manquent.'), jump.map(r => r.html).join('')]],
      answers: [...rows, ...back, ...jump].map(r => r.ans).join(' | '), level: tr('numbers to ', "nombres jusqu'à ") + nmax }; } },
  { id: 'compare', track: 'math', icon: '⚖️', en: 'Bigger and smaller', fr: 'Plus grand, plus petit', make() {
    const max = [10, 50, 100][lvl('compare') - 1], gen = () => { const a = 1 + rand(max); let b = 1 + rand(max); if (b === a) b = a === max ? a - 1 : a + 1; return [a, b]; };
    const big = wsUniq(9, gen), small = wsUniq(9, gen), pairs = l => `<div class="ws-pairs">${l.map(([a, b]) => `<span>${a} ${b}</span>`).join('')}</div>`;
    const secs = [[tr('Circle the BIGGER number.', 'Entoure le nombre le plus GRAND.'), pairs(big)], [tr('Circle the SMALLER number.', 'Entoure le nombre le plus PETIT.'), pairs(small)]];
    const three = wsUniq(5, () => wsUniq(3, () => 1 + rand(max)));
    secs.push([tr('Write the three numbers from smallest to biggest.', 'Écris les trois nombres du plus petit au plus grand.'), three.map(t => `<div class="ws-seq"><span class="given">${t.join(' &nbsp; ')}</span><span>→</span>${wsBox}${wsBox}${wsBox}</div>`).join('')]);
    return { secs, answers: '1) ' + big.map(p => Math.max(...p)).join(', ') + ' &nbsp; 2) ' + small.map(p => Math.min(...p)).join(', '), level: tr('numbers to ', "nombres jusqu'à ") + max }; } },
  { id: 'tens', track: 'math', icon: '🧱', en: 'Tens and ones', fr: 'Dizaines et unités', ahead: () => lvl('add') < 3 && lvl('tens') < 2, make() {
    const l = lvl('tens'), ns = wsUniq(l === 1 ? 8 : 10, () => (l === 1 ? 11 + rand(9) : l === 2 ? 11 + rand(40) : 11 + rand(89)));
    const pic = n => `<span class="ws-pv">${'<i class="wsrod"></i>'.repeat(Math.floor(n / 10))}<span class="wscubes">${'<i class="wscube"></i>'.repeat(n % 10)}</span></span>`;
    return { secs: [[tr('A long bar is 10. A small square is 1. Count the tens, then the ones. Write the number.', 'Une barre, c’est 10. Un petit carré, c’est 1. Compte les dizaines, puis les unités. Écris le nombre.'),
      `<div class="ws-grid2 roomy">${ns.map(n => `<div class="ws-tens">${pic(n)}<span>${wsBox} ${tr('tens', 'diz.')} ${wsBox} ${tr('ones', 'unités')} = ${wsBox}</span></div>`).join('')}</div>`]], answers: ns.join(', ') }; } },
  { id: 'patterns', track: 'math', icon: '🔁', en: 'Patterns', fr: 'Les suites', make() {
    const l = lvl('patterns'), rows = [...shuffle(PATTERN_SETS), ...shuffle(PATTERN_SETS)].slice(0, 8).map(set => { const unit = l === 1 ? [0, 1] : pick([[0, 1, 2], [0, 0, 1], [0, 1, 1]]), s = shuffle(set);
      return { shown: Array.from({ length: 6 }, (_, i) => s[unit[i % unit.length]]), next: [6, 7].map(i => s[unit[i % unit.length]]) }; });
    return { secs: [[tr('Look at the pattern. Draw the next two.', 'Regarde bien la suite. Dessine les deux suivants.'), rows.map(r => `<div class="ws-pat">${r.shown.map(x => `<span>${x}</span>`).join('')}${wsBox}${wsBox}</div>`).join('')],
      [tr('Make your own pattern with two shapes.', 'Invente ta suite avec deux formes.'), `<div class="ws-pat">${wsBox.repeat(8)}</div><div class="ws-pat">${wsBox.repeat(8)}</div>`]], answers: rows.map(r => r.next.join('')).join('  ') }; } },
  { id: 'shapes', track: 'math', icon: '🔷', en: 'Shapes', fr: 'Les formes', make() {
    const m = M(), basic = ['circle', 'square', 'triangle', 'rectangle'], targets = shuffle(basic).slice(0, 2);
    const out = (s, size) => `<span class="ws-shape">${shapeSVG(s, '#fff', size)}</span>`, sided = shuffle(Object.keys(SIDES)).slice(0, 6);
    const hunt = target => { const row = shuffle([target, target, target, target, ...basic.filter(s => s !== target), ...basic.filter(s => s !== target), ...shuffle(['star', 'heart', 'oval', 'diamond']).slice(0, 3)]);
      return [tr(`Colour every ${m.shapes[target]}.`, `Colorie cette forme chaque fois que tu la vois : ${m.shapes[target]}.`), `<div class="ws-shapes">${row.map(s => out(s, 56)).join('')}</div>`]; };
    return { secs: [hunt(targets[0]), hunt(targets[1]),
      [tr('How many sides? Count them and write the number.', 'Combien de côtés ? Compte-les et écris le nombre.'), `<div class="ws-grid3">${sided.map(s => `<div class="ws-crow">${out(s, 62)}${wsBox}</div>`).join('')}</div>`],
      [tr('Draw a circle, a square and a triangle.', 'Dessine un cercle, un carré et un triangle.'), `<div class="ws-boxes three low"><div></div><div></div><div></div></div>`]], answers: '3) ' + sided.map(s => SIDES[s]).join(', ') }; } },
  { id: 'clock', track: 'math', icon: '🕐', en: 'What time is it?', fr: 'Quelle heure est-il ?', ahead: () => lvl('add') < 2 && lvl('clock') < 2, make() {
    const l = lvl('clock'), mins = l === 1 ? [0] : l === 2 ? [0, 30] : [0, 15, 30], ts = wsUniq(9, () => [1 + rand(12), pick(mins)]);
    return { secs: [[tr('Look at the short hand first: it shows the hour. Write the time.', "Regarde d'abord la petite aiguille : elle montre l'heure. Écris l'heure."),
      `<div class="ws-clocks">${ts.map(([h, mi]) => `<div>${clockSVG(h, mi)}<span>${wsBox} ${S.lang === 'fr' ? 'h' : ':'} ${wsBox}</span></div>`).join('')}</div>`]],
      answers: ts.map(([h, mi]) => `${h}${S.lang === 'fr' ? ' h ' : ':'}${String(mi).padStart(2, '0')}`).join(', ') }; } },
  { id: 'problems', track: 'math', icon: '📖', en: 'Maths stories', fr: 'Petits problèmes', ahead: () => stageOf() < 3, make() {
    const m = M(), max = lvl('mathStory') >= 2 ? 10 : 5, ans = [], blocks = [];
    const things = shuffle(m.things);
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) { const [name, e] = things[(i / 2) % things.length], a = 2 + rand(max - 3), b = 2 + rand(Math.max(1, max - a - 1));
        blocks.push(`<div class="ws-prob"><div>${m.storyAdd(name, a, b).map(esc).join(' ')}</div><div class="work">${wsObjs(a, e)} &nbsp;+&nbsp; ${wsObjs(b, e)}</div><div>${a} + ${b} = ${wsBox}</div></div>`); ans.push(a + b); }
      else { const [name, e, verb] = pick(m.away), a = 3 + rand(max - 2), b = 2 + rand(a - 2);
        blocks.push(`<div class="ws-prob"><div>${m.storySub(name, a, b, verb).map(esc).join(' ')}</div><div class="work">${wsObjs(a, e)}</div><div>${a} − ${b} = ${wsBox}</div></div>`); ans.push(a - b); }
    }
    return { secs: [[tr('Read the story (a grown-up can help). Cross out or count the pictures. Write the answer.', "Lis l'histoire (un adulte peut t'aider). Barre ou compte les images. Écris la réponse."), blocks.join('')]], answers: ans.join(', ') }; } },
  { id: 'mathmix', track: 'math', icon: '🎒', en: 'Mixed maths practice', fr: 'Maths : un peu de tout', make() {
    const la = lvl('add'), ls = lvl('sub'), lc = lvl('count'), secs = [], ans = [];
    const ns = wsUniq(4, () => Math.max(lc > 1 ? 4 : 1, 1 + rand([5, 10, 20][lc - 1]))), es = shuffle(OBJECTS);
    secs.push([tr('Count. Write how many.', 'Compte. Écris combien il y en a.'), `<div class="ws-count">${ns.map((n, i) => `<div>${wsObjs(n, es[i])}${wsBox}</div>`).join('')}</div>`]); ans.push(ns.join(', '));
    const ad = wsUniq(6, wsAddPair), sb = wsUniq(6, wsSubPair);
    secs.push([tr('Put together. Write the answer.', 'Mets ensemble. Écris la réponse.'), wsSums(ad, '+', la <= 2)]); ans.push(ad.map(([a, b]) => a + b).join(', '));
    secs.push([tr('Take away. Write the answer.', 'Enlève. Écris la réponse.'), wsSums(sb, '−', ls <= 2)]); ans.push(sb.map(([a, b]) => a - b).join(', '));
    const nmax = [20, 50, 100][lvl('next') - 1], r1 = wsSeqRow(1 + rand(nmax - 6), 1, 2), k = lvl('skip') === 1 ? 10 : pick([2, 5, 10]), r2 = wsSeqRow(k, k, 2);
    secs.push([tr('Write the missing numbers.', 'Écris les nombres qui manquent.'), r1.html + r2.html]); ans.push(r1.ans + ' | ' + r2.ans);
    const bmax = [10, 50, 100][lvl('compare') - 1], pairs = wsUniq(6, () => { const a = 1 + rand(bmax); let b = 1 + rand(bmax); if (b === a) b = a === bmax ? a - 1 : a + 1; return [a, b]; });
    secs.push([tr('Circle the bigger number.', 'Entoure le plus grand nombre.'), `<div class="ws-pairs">${pairs.map(([a, b]) => `<span>${a} ${b}</span>`).join('')}</div>`]); ans.push(pairs.map(p => Math.max(...p)).join(', '));
    return { secs, answers: ans.map((a, i) => `${i + 1}) ${a}`).join(' &nbsp; '), level: `+ ${la} · − ${ls}` }; } },
  // ===== science: for curiosity (nothing to get wrong), with drawing, colouring, a little writing and things to try for real =====
  { id: 'solar', track: 'sci', icon: '🪐', en: 'The Sun and the planets', fr: 'Le Soleil et les planètes', make() {
    const lg = S.lang, order = SPACE.filter(b => b.id !== 'moon'), five = shuffle(order.filter(b => ['sun', 'earth', 'mars', 'jupiter', 'saturn'].includes(b.id)));
    return { secs: [
      [tr('Here are the Sun and its eight planets, in order. Colour them. Then trace each name.', "Voici le Soleil et ses huit planètes, dans l'ordre. Colorie-les. Puis repasse sur chaque nom."),
        `<div class="ws-plan">${order.map(b => `<div>${wsBody(b.id, 10 + 11 * b.z)}<b>${esc(b[lg][1])}</b></div>`).join('')}</div>`],
      [tr('Read each name. Draw a line to its picture.', 'Lis chaque nom. Relie-le à son image.'), wsMatch(five.map(b => ({ w: b[lg][1], e: wsBody(b.id, 12) })))],
      [tr('Invent a new planet! Draw it, and give it a name.', 'Invente une nouvelle planète ! Dessine-la, et donne-lui un nom.'), `<div class="ws-draw"><div class="ws-box"></div><div class="lines">${wsLine}${wsLine}</div></div>`],
    ] }; } },
  { id: 'whoami', track: 'sci', icon: '❓', en: 'Who am I? Space riddles', fr: "Qui suis-je ? Devinettes de l'espace", make() {
    const lg = S.lang, all = [['sun', 'I am a star. I give you light and I keep you warm.', "Je suis une étoile. Je t'éclaire et je te réchauffe."], ['earth', 'You live on me. I look blue.', 'Tu habites sur moi. Je suis toute bleue.'],
      ['moon', 'I go around the Earth. You see me at night.', 'Je tourne autour de la Terre. Tu me vois la nuit.'], ['mars', 'I am the red planet.', 'Je suis la planète rouge.'], ['jupiter', 'I am the biggest planet.', 'Je suis la plus grosse planète.'],
      ['saturn', 'I have beautiful rings.', "J'ai de beaux anneaux."], ['mercury', 'I am the smallest planet.', 'Je suis la plus petite planète.'], ['neptune', 'I am the planet farthest from the Sun.', 'Je suis la planète la plus éloignée du Soleil.']];
    const rs = shuffle(all).slice(0, 6), name = id => SPACE.find(b => b.id === id)[lg][1];
    return { secs: [
      [tr('Read each riddle (a grown-up can help). Find the answer in the box, and write it.', "Lis chaque devinette (un adulte peut t'aider). Trouve la réponse dans le cadre, et écris-la."),
        `<div class="ws-bank">${shuffle(rs).map(r => `<span>${esc(name(r[0]))}</span>`).join('')}</div>${rs.map(r => `<div class="ws-rid"><div class="ws-sent">${esc(r[lg === 'fr' ? 2 : 1])}</div><div class="ws-trow">${wsLine}</div></div>`).join('')}`],
      [tr('Draw your favourite one.', 'Dessine celui que tu préfères.'), `<div class="ws-wide low"></div>`],
    ], answers: rs.map(r => name(r[0])).join(', ') }; } },
  { id: 'rocketws', track: 'sci', icon: '🚀', en: 'My rocket', fr: 'Ma fusée', make() {
    const hide = shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4), nums = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    return { secs: [
      [tr('Colour the rocket. Then finish the countdown!', 'Colorie la fusée. Puis complète le compte à rebours !'),
        `<div class="ws-rocket">${wsRocket(88)}<div class="ws-seq">${nums.map((n, i) => (hide.includes(i) ? wsBox : `<span>${n}</span>`)).join('')}<span class="ws-pic">🔥</span></div></div>`],
      [tr('Trace the word. Then write it on the line.', 'Repasse sur le mot. Puis écris-le sur la ligne.'),
        [tr('rocket', 'fusée'), tr('moon', 'lune'), tr('star', 'étoile')].map(w => `<div class="ws-trow"><span class="ws-tr word">${w}</span>${wsLine}</div>`).join('')],
      [tr('Where is your rocket going? Draw it. Then finish the sentence.', 'Où va ta fusée ? Dessine. Puis termine la phrase.'),
        `<div class="ws-draw"><div class="ws-box"></div><div class="lines"><span class="ws-sent">${tr('My rocket is going to', 'Ma fusée va')}</span>${wsLine}</div></div>`],
    ], answers: '1) ' + nums.filter((_, i) => hide.includes(i)).join(', ') }; } },
  { id: 'starjoin', track: 'sci', icon: '✨', en: 'Join the stars', fr: 'Relie les étoiles', make() {
    const lg = S.lang, four = shuffle(SKIES).slice(0, 4);
    return { secs: [
      [tr('Trace the dotted lines to join the stars. Colour the stars. Then trace the name.', 'Repasse sur les pointillés pour relier les étoiles. Colorie les étoiles. Puis repasse sur le nom.'),
        `<div class="ws-skies">${four.map(c => `<div class="ws-sky">${wsSky(c)}<b>${esc(c[lg][1])}</b></div>`).join('')}</div>`],
      [tr('Invent your own star picture: draw some stars, join them, and give it a name.', "Invente ton dessin d'étoiles : dessine des étoiles, relie-les, et donne-lui un nom."), `<div class="ws-draw"><div class="ws-box"></div><div class="lines">${wsLine}${wsLine}</div></div>`],
    ] }; } },
  { id: 'moondiary', track: 'sci', icon: '🌙', en: 'My Moon diary', fr: 'Mon carnet de la Lune', make() {
    return { secs: [
      [tr('Look at the Moon every evening for a week. Draw the shape you see. (Too cloudy? Draw a cloud!)', 'Regarde la Lune chaque soir pendant une semaine. Dessine la forme que tu vois. (Trop de nuages ? Dessine un nuage !)'),
        `<div class="ws-moons">${Array.from({ length: 7 }, (_, i) => `<div><i></i>${tr('Day', 'Jour')} ${i + 1}: ________</div>`).join('')}</div>`],
      [tr('What happened to the Moon? Circle your answer.', "Qu'est-il arrivé à la Lune ? Entoure ta réponse."), `<div class="ws-find pick"><span><i>${tr('It got bigger', 'Elle a grossi')}</i><i>${tr('It got smaller', 'Elle a rétréci')}</i><i>${tr('It stayed the same', "Elle n'a pas changé")}</i></span></div>`],
      [tr('Trace the words. Then write them on the line.', 'Repasse sur les mots. Puis écris-les sur la ligne.'), `<div class="ws-trow"><span class="ws-tr word">${tr('the Moon', 'la Lune')}</span>${wsLine}</div>
        <div class="small" style="white-space:normal;margin-top:10px">${tr('Did you know? The Moon is always a ball. The Sun lights one side of it, and we see more or less of that bright side.', 'Le sais-tu ? La Lune est toujours une boule. Le Soleil éclaire un seul côté, et nous voyons plus ou moins ce côté éclairé.')}</div>`],
    ] }; } },
  { id: 'address', track: 'sci', icon: '🔭', en: 'My address in space', fr: "Mon adresse dans l'espace", make() {
    const row = (lab, word) => `<div class="ws-trow tall"><span class="ws-lab">${lab}</span>${word ? `<span class="ws-tr word">${word}</span>` : ''}${wsLine}</div>`;
    return { secs: [
      [tr('Finish your address in space. Write on the lines, and trace the grey words.', "Complète ton adresse dans l'espace. Écris sur les lignes, et repasse sur les mots gris."),
        row(tr('My name', 'Mon prénom')) + row(tr('My town', 'Ma ville')) + row(tr('My country', 'Mon pays')) + row(tr('My planet', 'Ma planète'), tr('Earth', 'la Terre')) + row(tr('My star', 'Mon étoile'), tr('the Sun', 'le Soleil')) + row(tr('My galaxy', 'Ma galaxie'), tr('the Milky Way', 'la Voie lactée'))],
      [tr('Draw your home, on planet Earth.', 'Dessine ta maison, sur la planète Terre.'), `<div class="ws-wide"></div>`],
    ] }; } },
  { id: 'floatsink', track: 'sci', icon: '🧪', en: 'Float or sink?', fr: 'Flotte ou coule ?', make() {
    const all = [['🍏', 'an apple', 'une pomme', 1], ['🥄', 'a spoon', 'une cuillère', 0], ['🍃', 'a leaf', 'une feuille', 1], ['✏️', 'a pencil', 'un crayon', 1], ['🔑', 'a key', 'une clé', 0], ['⚽', 'a ball', 'un ballon', 1],
      ['🍋', 'a lemon', 'un citron', 1], ['🥕', 'a carrot', 'une carotte', 0], ['🥚', 'an egg', 'un œuf', 0]];
    const it = shuffle(all).slice(0, 6), f = tr('floats', 'flotte'), s = tr('sinks', 'coule'), fr = S.lang === 'fr';
    return { secs: [
      [tr('Be a scientist! First GUESS: circle "floats" or "sinks". Then TEST it in a bowl of water, and circle what really happened.', "Fais comme les scientifiques ! D'abord DEVINE : entoure « flotte » ou « coule ». Puis ESSAIE dans un bol d'eau, et entoure ce qui s'est vraiment passé."),
        `<div class="ws-exp"><span></span><span></span><span class="h">${tr('My guess', 'Je devine')}</span><span class="h">${tr('What happened', 'Ce qui se passe')}</span>
          ${it.map(x => `<span class="ws-pic">${x[0]}</span><b>${x[fr ? 2 : 1]}</b><span class="g"><i>${f}</i><i>${s}</i></span><span class="g"><i>${f}</i><i>${s}</i></span>`).join('')}</div>`],
      [tr('Which one surprised you?', 'Laquelle était une surprise ?'), `<div class="ws-trow">${wsLine}</div>`],
      [tr('Find one more thing to test. Draw it, and write what happened.', "Trouve encore une chose à essayer. Dessine-la, et écris ce qui s'est passé."), `<div class="ws-draw"><div class="ws-box"></div><div class="lines">${wsLine}${wsLine}</div></div>`],
    ], answers: tr('usually: ', 'en général : ') + it.map(x => `${x[fr ? 2 : 1].replace(/^\S+ /, '')} ${x[3] ? f : s}`).join(', ') }; } },
  { id: 'wonderws', track: 'sci', icon: '💡', en: 'My "I wonder" page', fr: 'Ma page « Je me demande »', make() {
    return { secs: [
      [tr('What do you wonder about? Write your question (a grown-up can help).', "Qu'est-ce que tu te demandes ? Écris ta question (un adulte peut t'aider)."), `<div class="ws-trow"><span class="ws-tr word">${tr('I wonder', 'Je me demande')}</span>${wsLine}</div><div class="ws-trow tall">${wsLine}</div>`],
      [tr('My guess. Draw it, or write it.', 'Mon idée. Dessine-la, ou écris-la.'), `<div class="ws-draw"><div class="ws-box"></div><div class="lines">${wsLine}${wsLine}</div></div>`],
      [tr('How can I find out? Circle one or more.', 'Comment le savoir ? Entoure une ou plusieurs idées.'), `<div class="ws-find pick"><span><i>👀 ${tr('look closely', 'bien regarder')}</i><i>🧪 ${tr('try it', 'essayer')}</i><i>🙋 ${tr('ask someone', 'demander')}</i><i>📖 ${tr('look in a book', 'chercher dans un livre')}</i></span></div>`],
      [tr('What I found out. Draw it, or write it.', "Ce que j'ai découvert. Dessine-le, ou écris-le."), `<div class="ws-draw"><div class="ws-box"></div><div class="lines">${wsLine}${wsLine}</div></div>`],
    ] }; } },
];
const WS_TRACKS = [['read', '📖', 'Reading', 'Lecture'], ['write', '✍️', 'Writing', 'Écriture'], ['math', '🔢', 'Maths', 'Maths'], ['sci', '🚀', 'Science', 'Sciences']];

// ---------------------------------------------------------------- outline drawings for the science sheets
// black lines only: they print well on any printer, and she does the colouring
function wsBody(id, mm = 22) {
  const R = id === 'saturn' || id === 'sun' ? 27 : 40, s = 'fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"';
  const band = dy => { const h = Math.sqrt(R * R - dy * dy) - 1; return `<path d="M${(50 - h).toFixed(1)} ${50 + dy} H${(50 + h).toFixed(1)}" ${s}/>`; };
  const crat = pts => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${s}/>`).join('');
  const ring = front => (id === 'saturn' ? `<path d="M3 50 A47 12 0 0 ${front ? 0 : 1} 97 50" transform="rotate(-16 50 50)" ${s}/>` : '');
  const inside = {
    sun: Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, c = Math.cos(a), n = Math.sin(a); return `<path d="M${(50 + 33 * c).toFixed(1)} ${(50 + 33 * n).toFixed(1)} L${(50 + 45 * c).toFixed(1)} ${(50 + 45 * n).toFixed(1)}" ${s}/>`; }).join(''),
    mercury: crat([[36, 38, 7], [62, 60, 10], [58, 30, 4], [34, 66, 5]]), moon: crat([[38, 36, 9], [64, 54, 7], [46, 68, 6], [66, 30, 4]]),
    venus: `<path d="M16 36 Q50 24 84 38 M12 54 Q50 66 88 52 M22 72 Q50 62 78 72" ${s}/>`,
    earth: `<path d="M22 30 q10 -12 24 -6 q6 8 -2 14 q-4 8 -12 6 q-2 10 -10 6 q-6 -10 0 -20z M56 46 q14 -6 22 4 q4 12 -4 20 q-10 6 -14 -4 q-8 -8 -4 -20z M36 70 q8 -4 12 4 q-2 10 -10 10 q-6 -6 -2 -14z" ${s}/>`,
    mars: `<path d="M34 14 Q50 23 66 14 M24 44 q12 -10 26 -2 q8 8 -4 12 q-14 4 -22 -10z" ${s}/>` + crat([[64, 64, 7]]),
    jupiter: band(-26) + band(-10) + band(4) + band(24) + `<ellipse cx="62" cy="64" rx="9" ry="5" ${s}/>`,
    saturn: band(-8) + band(8), uranus: band(-6), neptune: `<path d="M30 36 H54 M52 64 H72" ${s}/><ellipse cx="34" cy="58" rx="8" ry="5" ${s}/>`,
  }[id];
  return `<svg viewBox="0 0 100 100" style="width:${mm.toFixed(1)}mm;height:${mm.toFixed(1)}mm;display:inline-block;vertical-align:middle">${ring(0)}<circle cx="50" cy="50" r="${R}" fill="#fff" stroke="#000" stroke-width="2.500"/>${inside}${ring(1)}</svg>`;
}
const wsRocket = mm => `<svg viewBox="0 0 80 196" style="height:${mm}mm;width:${(mm * 80 / 196).toFixed(1)}mm;flex:none" fill="#fff" stroke="#000" stroke-width="2.500" stroke-linejoin="round">
  <path d="M28 152 Q40 198 52 152"/><path d="M24 122 L6 156 L24 150Z"/><path d="M56 122 L74 156 L56 150Z"/><path d="M24 44 Q40 -6 56 44 V152 H24Z"/><path d="M26 36 H54 M24 98 H56 M24 112 H56"/><circle cx="40" cy="62" r="9"/></svg>`;
const wsSky = c => `<svg viewBox="0 0 100 100">${c.l.map(([a, b]) => `<path d="M${c.p[a][0]} ${c.p[a][1]} L${c.p[b][0]} ${c.p[b][1]}" stroke="#888" stroke-width=".8" stroke-dasharray="1.6 1.8" fill="none"/>`).join('')}
  ${c.p.map(([x, y, z = 1]) => `<path transform="translate(${x} ${y}) scale(${(z * .9).toFixed(2)})" d="M0 -5 L1.5 -1.6 L5 -1.5 L2.3 .9 L3.1 4.4 L0 2.5 L-3.1 4.4 L-2.3 .9 L-5 -1.5 L-1.5 -1.6Z" fill="#fff" stroke="#000" stroke-width=".8" stroke-linejoin="round"/>`).join('')}</svg>`;

// ---------------------------------------------------------------- styles of a printed sheet (also go into the downloaded file)
const WS_CSS = `
.ws { font-family: Andika, 'Comic Sans MS', 'Segoe Print', sans-serif; color: #000; max-width: 186mm; margin: 0 auto; font-size: 13pt; line-height: 1.25;
  min-height: 262mm; display: flex; flex-direction: column; }
.ws-foot { margin-top: auto !important; }
.ws * { box-sizing: border-box; } .ws i { font-style: normal; }
.ws + .ws { break-before: page; page-break-before: always; border-top: 2px dashed #bbb; margin-top: 12mm; padding-top: 12mm; }
@media print { .ws + .ws { border-top: 0; margin-top: 0; padding-top: 0; } }
.ws-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 2px 12px; border-bottom: 2.5px solid #000; padding-bottom: 4px; }
.ws-head h1 { font-size: 18pt; margin: 0; white-space: nowrap; } .ws-head span { font-size: 11pt; white-space: nowrap; }
.ws-sec { margin: 14px 0 0; break-inside: avoid; page-break-inside: avoid; }
.ws-sec h2 { font-size: 13pt; margin: 0 0 6px; font-weight: 700; } .ws-sec h2 > b.n { display: inline-block; min-width: 22px; height: 22px; line-height: 22px; text-align: center; border-radius: 50%; background: #000; color: #fff; font-size: 11pt; margin-right: 6px; }
.ws-sec h2 small { font-weight: 400; font-size: 10.5pt; color: #444; } .ws-sec h2 .fam { font-size: 16pt; }
.ws-pic { font-size: 26pt; line-height: 1; } .ws-pic.big { font-size: 40pt; } .ws .small { font-size: 11pt; color: #444; white-space: nowrap; }
.ws-line { flex: 1; min-width: 30mm; height: 30px; border-bottom: 2px solid #000; background: repeating-linear-gradient(90deg, #999 0 5px, transparent 5px 10px) 0 45%/100% 1px no-repeat; }
.ws-trow { display: flex; align-items: flex-end; gap: 12px; margin: 4px 0; } .ws-trow.tall { margin: 13px 0; } .ws-trow.q { margin-top: 6px; }
.ws-tr { font-size: 30pt; line-height: 1; color: #cfcfcf; letter-spacing: 6px; white-space: pre; } .ws-tr b { color: #000; font-weight: 700; }
.ws-tr.word { font-size: 24pt; letter-spacing: 3px; } .ws-tr.sent { font-size: 21pt; letter-spacing: 2px; white-space: normal; margin: 4px 0 0; border-bottom: 2px solid #000; }
.ws-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 26px; } .ws-grid2.roomy { gap: 17px 26px; } .ws-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 20px; }
.ws-match { display: grid; grid-template-columns: auto 1fr auto; row-gap: 4px; align-items: center; max-width: 120mm; margin: 0 auto; }
.ws-match .l { font-size: 20pt; font-weight: 700; } .ws-match .l::after, .ws-match .r::before { content: '●'; font-size: 9pt; margin: 0 8px; vertical-align: middle; }
.ws-crow { display: flex; align-items: center; gap: 14px; font-size: 20pt; font-weight: 700; margin: 2px 0; }
.ws-crow .opts { display: flex; gap: 22px; } .ws-crow u, .ws-sent u { display: inline-block; width: 15mm; border-bottom: 2px solid #000; text-decoration: none; margin: 0 2px; } .ws-sent u.wide { width: 34mm; }
.ws-crow .spaced { letter-spacing: 5px; }
.ws-cells { display: flex; gap: 3px; } .ws-cells i { width: 10mm; height: 11mm; border: 2px solid #000; border-radius: 4px; display: grid; place-items: center; font-size: 17pt; color: #999; }
.ws-mix { display: flex; gap: 5px; } .ws-mix i { min-width: 9mm; height: 10mm; border: 1.5px dashed #777; border-radius: 50%; display: grid; place-items: center; font-size: 17pt; font-weight: 700; }
.ws-sent { font-size: 19pt; font-weight: 700; margin: 2px 0; } .ws-sent.grow { flex: 1; }
.ws-srow { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 13px 0; padding-bottom: 9px; border-bottom: 1px dotted #bbb; } .ws-srow .pics { display: flex; gap: 18px; font-size: 26pt; flex: none; }
.ws-srow .ws-pic + .ws-sent { margin-left: 4px; }
.ws-draw, .ws-story, .ws-own { display: flex; gap: 12px; align-items: stretch; } .ws-box { width: 62mm; height: 36mm; border: 2px solid #000; border-radius: 10px; flex: none; }
.ws-draw .lines, .ws-own .lines { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; } .ws-story > div:first-child { flex: 1; } .ws-story .ws-box { height: auto; min-height: 40mm; width: 56mm; }
.ws-own { margin: 12px 0; align-items: center; min-height: 40mm; } .ws-copy { margin: 0 0 16px; }
.ws-boxes { display: grid; gap: 10px 14px; } .ws-boxes.two { grid-template-columns: 1fr 1fr; } .ws-boxes.three { grid-template-columns: repeat(3, 1fr); }
.ws-boxes > div { border: 2px solid #000; border-radius: 10px; height: 46mm; } .ws-boxes.two > div { height: 96mm; } .ws-boxes.three.num > div { height: 60mm; } .ws-boxes.three.low > div { height: 32mm; }
.ws-boxes b { display: block; text-align: center; font-size: 20pt; border-bottom: 2px dashed #999; padding: 1px 4px; } .ws-boxes b.long { font-size: 15pt; } .ws-boxes.num b { font-size: 26pt; }
.ws-bank { display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: center; border: 2px solid #000; border-radius: 10px; padding: 5px 12px; margin: 0 0 8px; font-size: 17pt; font-weight: 700; }
.ws-find { display: flex; align-items: center; gap: 18px; margin: 13px 0; font-size: 19pt; } .ws-find b { min-width: 30mm; border: 2px solid #000; border-radius: 8px; text-align: center; padding: 0 8px; } .ws-find span { display: flex; gap: 20px; flex-wrap: wrap; }
.ws-stars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 8px; font-size: 19pt; font-weight: 700; }
.ws-syl { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 15pt; font-weight: 700; margin: 9px 0; } .ws-syl .ws-ans { width: 11mm; height: 10mm; }
.ws-count { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; } .ws-count > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1.5px solid #bbb; border-radius: 10px; padding: 4px 8px; min-height: 21mm; }
.ws-objs { font-size: 15pt; line-height: 1.15; word-spacing: 6px; }
.ws-ans { display: inline-block; width: 14mm; height: 11mm; border: 2px solid #000; border-radius: 6px; vertical-align: middle; flex: none; }
.ws-sums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 19px 14px; font-size: 19pt; font-weight: 700; } .ws-sums.wide { grid-template-columns: repeat(2, 1fr); }
.ws-sums small { display: block; font-size: 10pt; font-weight: 400; letter-spacing: 2px; color: #555; min-height: 12pt; }
.ws-seq { font-size: 19pt; font-weight: 700; margin: 7px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .ws-seq .ws-ans { width: 15mm; } .ws-seq .given { min-width: 44mm; }
.ws-pairs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; font-size: 19pt; font-weight: 700; text-align: center; } .ws-pairs span { border: 1.5px solid #bbb; border-radius: 10px; padding: 4px 0; word-spacing: 22px; }
.ws-frame { display: inline-grid; grid-template-columns: repeat(5, 8mm); border: 2px solid #000; } .ws-frame i { height: 8mm; border: 1px solid #000; display: grid; place-items: center; font-size: 13pt; }
.ws-bond { display: flex; align-items: center; gap: 12px; font-size: 18pt; font-weight: 700; }
.ws-tens { display: flex; flex-direction: column; gap: 5px; font-size: 13pt; font-weight: 700; border: 1.5px solid #bbb; border-radius: 10px; padding: 6px 8px; } .ws-tens .ws-ans { width: 11mm; height: 9mm; }
.ws-pv { display: flex; gap: 3px; align-items: flex-end; min-height: 21mm; } .ws-pv .wsrod { width: 4mm; height: 20mm; border: 1.5px solid #000; background: repeating-linear-gradient(#fff 0 1.850mm, #000 1.850mm 2mm); }
.ws-pv .wscubes { display: grid; grid-template-columns: repeat(3, 4mm); gap: 1.5px; margin-left: 5px; } .ws-pv .wscube { width: 4mm; height: 4mm; border: 1.5px solid #000; }
.ws-pat { display: flex; align-items: center; gap: 9px; font-size: 23pt; margin: 8px 0; } .ws-pat .ws-ans { width: 13mm; height: 13mm; }
.ws-shapes { display: flex; flex-wrap: wrap; gap: 6px 14px; justify-content: center; } .ws-shape svg { display: block; stroke: #000 !important; stroke-width: 3px !important; }
.ws-clocks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 10px; text-align: center; font-size: 17pt; font-weight: 700; } .ws-clocks svg { width: 40mm; height: 40mm; display: block; margin: 0 auto 4px; filter: none; animation: none; }
.ws-prob { border: 1.5px solid #bbb; border-radius: 10px; padding: 6px 10px; margin: 0 0 9px; font-size: 15pt; } .ws-prob .work { margin: 4px 0; } .ws-prob > div:last-child { font-size: 19pt; font-weight: 700; }
.ws-plan { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px 4px; align-items: end; text-align: center; }
.ws-plan b, .ws-sky b { display: block; font-size: 15pt; color: #c4c4c4; letter-spacing: 1px; white-space: nowrap; margin-top: 2px; }
.ws-match svg { vertical-align: middle; }
.ws-rid { margin: 0 0 8px; } .ws-rid .ws-sent { font-size: 16pt; }
.ws-rocket { display: flex; align-items: center; justify-content: center; gap: 14mm; } .ws-rocket .ws-seq { display: grid; grid-template-columns: repeat(5, 17mm); gap: 14px 6px; justify-items: center; font-size: 24pt; }
.ws-skies { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; text-align: center; }
.ws-sky svg { width: 56mm; height: 56mm; border: 2px solid #000; border-radius: 10px; display: block; margin: 0 auto; }
.ws-moons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 6px; text-align: center; font-size: 11pt; }
.ws-moons i { display: block; width: 34mm; height: 34mm; border: 2px solid #000; border-radius: 50%; margin: 0 auto 4px; }
.ws-find.pick i { border: 1.5px solid #bbb; border-radius: 10px; padding: 2px 10px; font-size: 15pt; font-weight: 700; }
.ws-lab { font-size: 13pt; font-weight: 700; min-width: 30mm; }
.ws-exp { display: grid; grid-template-columns: auto 1fr auto auto; gap: 0 16px; align-items: center; font-size: 15pt; }
.ws-exp > * { padding: 8px 0; } .ws-exp .h { font-size: 11pt; font-weight: 700; color: #444; text-align: center; padding: 0; }
.ws-exp .g { display: flex; gap: 10px; } .ws-exp .g i { border: 1.5px solid #bbb; border-radius: 8px; padding: 1px 9px; }
.ws-wide { height: 78mm; border: 2px solid #000; border-radius: 10px; } .ws-wide.low { height: 46mm; }
.ws-foot { margin-top: 12px; padding-top: 4px; border-top: 1px dashed #999; font-size: 8.5pt; color: #555; display: flex; justify-content: space-between; gap: 12px; }
@page { size: A4; margin: 11mm; }
`;
// styles of the library screen itself (never printed)
const WSLIB_CSS = `
.wslib { max-width: 900px; margin: 0 auto; font-family: var(--font); color: #333; }
.wslib h1 { font-size: 28px; margin: 0 0 4px; } .wslib p { font-size: 17px; margin: 4px 0 10px; line-height: 1.4; }
.wslib h2 { font-size: 22px; margin: 22px 0 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.wscards { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 10px; }
.wscard { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 12px 14px; border-radius: 16px; border: 3px solid #e6e6e6; background: #fff; font-size: 30px; line-height: 1.1; cursor: pointer; }
.wscard b { font-size: 17px; } .wscard small { font-size: 13px; color: #777; font-weight: 600; min-height: 16px; } .wscard.ahead { border-style: dashed; } .wscard.ahead small { color: #b06a00; } .wscard.done small { color: #2f9a83; }
.wslang { display: inline-flex; gap: 6px; margin-right: auto; } .wslang .pbtn { margin: 0; } .wslang .pbtn:not(.on) { background: #eee; color: #333; }
@media print { .wslib { display: none; } }
`;

// ---------------------------------------------------------------- building and showing
function wsPageHTML(sh, lang) {
  const keep = S.lang; let r; S.lang = lang;                       // the helpers read "her language"; put it back straight after
  try { r = sh.make(); r.place = sh.track === 'math' ? (r.level || '') : sh.track === 'sci' ? '' : wsPlace();
    r.made = sh.track === 'sci' ? tr('Made by Tiko for curious minds', 'Préparé par Tiko pour les curieux') : tr('Made by Tiko for her level today', 'Préparé par Tiko pour son niveau du jour'); r.ansLabel = tr('Answers, for the grown-up', "Réponses, pour l'adulte"); r.nd = tr('Name', 'Prénom'); }
  finally { S.lang = keep; }
  return `<div class="ws" data-sheet="${sh.id}"><div class="ws-head"><h1>${sh.icon} Tiko · ${sh[lang]}</h1><span>${r.nd}: ____________ &nbsp; Date: ________</span></div>
    ${r.secs.map(([h, body], i) => `<div class="ws-sec"><h2><b class="n">${i + 1}</b>${h}</h2>${body}</div>`).join('')}
    <div class="ws-foot"><span>${r.made}${r.place ? ' (' + r.place + ')' : ''}</span><span>${r.answers ? r.ansLabel + ': ' + r.answers : ''}</span></div></div>`;
}
// the library: every sheet as a card, by track; a whole track can be opened as a pack
function worksheetLibrary(lang) {
  const el = $('#sheet'); if (lang) S.wsLang = lang; const lg = S.wsLang || S.lang;
  const close = () => { el.classList.remove('preview'); el.innerHTML = ''; };
  const keep = S.lang; S.lang = lg; let cards;
  try {
    const st = stageOf();
    cards = WS_TRACKS.map(([k, ic, en, fr]) => { const list = SHEETS.filter(s => s.track === k);
      return `<h2><span>${ic} ${lg === 'fr' ? fr : en} <small style="font-weight:400;font-size:15px;color:#777">· ${list.length} sheets</small></span><button class="pbtn alt wspack" data-track="${k}">📦 Whole pack (${list.length} pages)</button></h2>
        <div class="wscards">${list.map(s => { const ah = s.ahead && s.ahead(st), dn = s.done && s.done(st);
          return `<button class="wscard ${ah ? 'ahead' : ''} ${dn ? 'done' : ''}" data-id="${s.id}">${s.icon}<b>${esc(s[lg])}</b><small>${ah ? '⏳ a little ahead of her' : dn ? '✓ she is past this' : ''}</small></button>`; }).join('')}</div>`; }).join('');
  } finally { S.lang = keep; }
  el.innerHTML = `<style>${WSLIB_CSS}</style><div class="sh-close"><span class="wslang"><button class="pbtn ${lg === 'en' ? 'on' : ''}" data-l="en">🇬🇧 English</button><button class="pbtn ${lg === 'fr' ? 'on' : ''}" data-l="fr">🇫🇷 Français</button></span><button class="pbtn alt" id="shx">✕ Close</button></div>
    <div class="wslib"><h1>📚 Worksheet library</h1>
    <p>${SHEETS.length} kinds of sheet for pen and paper. Each one is a single page, is <b>made fresh every time</b> you open it, and follows where she is today: her place on the reading journey, the letters and words she is still learning, and her maths levels. Tap a sheet to see it, then print it, save it as a PDF, or download it. "Whole pack" gives you every sheet of a track in one go.</p>
    ${cards}</div>`;
  el.classList.add('preview'); el.scrollTop = 0;
  $('#shx').onclick = close;
  $$('.wslang [data-l]', el).forEach(b => b.onclick = () => worksheetLibrary(b.dataset.l));
  $$('.wscard', el).forEach(b => b.onclick = () => worksheetShow([b.dataset.id], lg));
  $$('.wspack', el).forEach(b => b.onclick = () => worksheetShow(SHEETS.filter(s => s.track === b.dataset.track).map(s => s.id), lg, b.dataset.track));
}
// one sheet, or a pack of sheets (one per page): preview → print / download / another one
function worksheetShow(ids, lang, pack) {
  const el = $('#sheet'), list = ids.map(id => SHEETS.find(s => s.id === id)).filter(Boolean);
  const draw = () => {
    const html = list.map(s => wsPageHTML(s, lang)).join(''), name = `tiko-${pack ? 'pack-' + pack : list[0].id}-${lang}-${today()}.html`;
    const title = pack ? WS_TRACKS.find(t => t[0] === pack)[lang === 'fr' ? 3 : 2] : list[0][lang];
    el.innerHTML = `<div class="sh-close"><button class="pbtn alt" id="shb" style="margin-right:auto">← Library</button><button class="pbtn" id="shp">🖨️ Print / save as PDF</button><button class="pbtn" id="shd">⬇️ Download</button><button class="pbtn alt" id="shn">🔄 Another one</button><button class="pbtn alt" id="shx">✕</button><span class="sh-msg">${list.length > 1 ? list.length + ' pages' : ''}</span></div><div class="wshost"></div>`;
    // the sheet sits in its own shadow root: none of the app's styles reach it, so the preview, the print and the
    // downloaded file all look exactly the same
    $('.wshost', el).attachShadow({ mode: 'open' }).innerHTML = `<style>${WS_CSS}</style>${html}`;
    $('#shp').onclick = () => window.print();
    // one self-contained file: opens in any browser, on any device, and prints one sheet per page
    $('#shd').onclick = () => {
      const doc = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tiko – ${title} – ${today()}</title><style>body{margin:10mm auto;background:#fff}@media print{body{margin:0}}${WS_CSS}</style></head><body>${html}</body></html>`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); $('.sh-msg').textContent = `Saved ${name} (look in Downloads)`;
    };
    $('#shn').onclick = () => { draw(); el.scrollTop = 0; };
    $('#shb').onclick = () => worksheetLibrary(lang);
    $('#shx').onclick = () => { el.classList.remove('preview'); el.innerHTML = ''; };
  };
  draw(); el.classList.add('preview'); el.scrollTop = 0;
}
