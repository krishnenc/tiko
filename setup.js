// ================= The first-time setup for a new child (v56) =================
// A short set of questions for a GROWN-UP, shown before the intro on the first launch of a tablet, for a child added in the parent corner (when they are switched
// to), and on demand ("Run setup again", parent corner, Child tab). It customises the experience with settings that already exist, plus one new tablet-only
// setting (what the child likes). Rules, all proved by tools/setup-check.js:
//   - It never speaks (no speak(), no sfx(), no music) and has no timer and nothing that moves: it is written text, English and French, for a grown-up.
//   - Every step has Back and "Skip this step" (the first screen has "Skip the setup"). Skipping everything leaves exactly what a new child gets without a setup.
//   - Choices live in a draft until the last button; nothing is written to the child's save before that (the one exception is a first launch that goes on to the
//     online backup: the child is saved first, because the account screen needs a child that exists). Closing the app half-way loses nothing and asks again.
//   - The only new storage key is the tablet-wide marker localStorage['tiko.setup'] = '1' (written when the setup is finished or skipped; in no child's save, no backup
//     file, never uploaded). The per-child "pending" flag of a child added in the parent corner is a field of that child's entry in tiko.profiles.
//   - The online-backup step exists only on a tablet where cloudLoad() accepts the switch; otherwise it is not counted and nothing about accounts appears. No request is made
//     before the parent presses "Set up the backup", and that button asks the grown-up question first.
// Loaded after placement.js (uses startJourneyAt, setMathStart, needsPlacement, parentGate, intro and parents from app.js).

const SETUP_FONTS = ['andika', 'hyper', 'lexend', 'dys'], SETUP_SESSIONS = [0, 10, 15, 20, 30, 45];
const SETUP_T = {
  en: {
    stepOf: (n, t) => `Step ${n} of ${t}`, back: 'Back', next: 'Next', skipStep: 'Skip this step', skipAll: 'Skip the setup', cancel: 'Cancel', begin: 'Start the questions',
    on: 'On', off: 'Off', none: 'none',
    welcomeH: 'Welcome to Tiko', welcomeP1: 'A few questions to make Tiko fit your child. It takes about two minutes, and a grown-up should answer them.',
    welcomeP2: 'Everything can be changed later in the parent corner. Your answers are saved on this tablet.', langL: 'Language',
    basicsH: 'About your child', nameL: 'First name (optional)', nameHelp: 'It stays on this tablet. It is never sent to us.', picL: 'Choose a picture', pic: n => `Picture ${n}`,
    themeL: 'Choose Tiko’s friend and world', frBoy: 'In French, Tiko speaks to a boy',
    calmH: 'Calm and sound',
    calm: ['Less movement', 'Calmer animations and less confetti.'], sfx: ['Sound effects', 'Soft sounds when your child taps.'], ambient: ['Relaxing music', 'Quiet music on the home screen and the menus.'],
    simpleHome: ['Simpler home screen', 'Only Tiko, a Start button and a “More” button.'], listenFirst: ['Listen first', 'Answers wait until Tiko has finished asking.'],
    readH: 'Reading comfort', readP: 'No font suits every child. Try them with your child and keep the one that is easiest to read.', fontL: 'Font', sizeL: 'Text size', spaceL: 'Letter and word spacing',
    fonts: { andika: 'Andika (the usual one)', hyper: 'Atkinson Hyperlegible', lexend: 'Lexend', dys: 'OpenDyslexic' }, sizes: ['Usual', 'Bigger', 'Biggest'], spaces: ['Usual', 'Wider', 'Widest'],
    prevL: 'Preview', prev: 'The cat sat on the mat.',
    practiceH: 'How practice goes', styleL: 'Practice style',
    gentle: ['Gentle review', 'Things your child knows come back after 3, 7 and 21 days.'], discovery: ['Discovery', 'Right first time means known for good, and it is never shown again.'],
    sessionL: 'Play time each day', session: m => (m ? `${m} minutes` : 'No limit'), sessionHelp: 'After this much play Tiko says a calm goodbye.',
    likesH: 'What does your child like?', likesP: 'Tick any. Tiko shows these first. Nothing is taken away and nothing gets harder.',
    likes: { space: 'Space and science', stories: 'Stories and books', numbers: 'Numbers', draw: 'Drawing and painting', music: 'Music and songs', puzzles: 'Puzzles and memory' },
    startH: 'Where to start', startP: 'Tiko always begins very gently and adjusts by itself as your child plays.', readQ: l => (l === 'fr' ? 'Reading in French' : 'Reading in English'), mathQ: 'Numbers',
    readOpts: { find: 'Let Tiko find out with a short game', none: 'Not yet', little: 'A little: some letters (Tiko checks with a short game)', well: 'Quite well: reads some words' },
    mathOpts: { find: 'Let Tiko find out as your child plays', none: 'Not yet', little: 'A little: counts to 10', well: 'Quite well: adds small numbers' },
    backupH: 'Online backup (optional)', backupP: 'Tiko works fully without it. A backup keeps a copy of your child’s progress online, so that you can bring it back on another tablet.',
    backupBtn: 'Set up the backup', backupNo: 'Not now', backupLater: 'You can find it later in the parent corner.',
    doneH: 'All set', doneP: 'Everything can be changed later in the parent corner (the gear on the home screen).', start: 'Start', save: 'Save these choices',
    sum: { name: 'Name', theme: 'Friend and world', lang: 'Language', sound: 'Calm and sound', font: 'Reading', style: 'Practice', session: 'Play time', likes: 'Likes', read: 'Reading starts', math: 'Numbers start' },
    langName: { en: 'English', fr: 'French' }, themes: { unicorn: 'Unicorn', dino: 'Dragon', rex: 'Dinosaur', owl: 'Owl' },
  },
  fr: {
    stepOf: (n, t) => `Étape ${n} sur ${t}`, back: 'Retour', next: 'Suivant', skipStep: 'Passer cette étape', skipAll: 'Passer la configuration', cancel: 'Annuler', begin: 'Commencer les questions',
    on: 'Oui', off: 'Non', none: 'aucun',
    welcomeH: 'Bienvenue dans Tiko', welcomeP1: 'Quelques questions pour adapter Tiko à votre enfant. Cela prend environ deux minutes et c’est à un adulte d’y répondre.',
    welcomeP2: 'Tout peut être modifié plus tard dans le coin des parents. Vos réponses sont enregistrées sur cette tablette.', langL: 'Langue',
    basicsH: 'À propos de votre enfant', nameL: 'Prénom (facultatif)', nameHelp: 'Il reste sur cette tablette. Il ne nous est jamais envoyé.', picL: 'Choisir une image', pic: n => `Image ${n}`,
    themeL: 'Choisir l’ami et le monde de Tiko', frBoy: 'En français, Tiko parle à un garçon',
    calmH: 'Calme et sons',
    calm: ['Moins de mouvement', 'Des animations plus calmes et moins de confettis.'], sfx: ['Effets sonores', 'De petits sons doux quand votre enfant touche l’écran.'], ambient: ['Musique douce', 'Une musique tranquille sur l’accueil et dans les menus.'],
    simpleHome: ['Écran d’accueil simplifié', 'Seulement Tiko, le bouton Commencer et un bouton « Encore ».'], listenFirst: ['Écouter d’abord', 'Les réponses attendent que Tiko ait fini de poser la question.'],
    readH: 'Confort de lecture', readP: 'Aucune police ne convient à tous les enfants. Essayez-les avec votre enfant et gardez celle qui se lit le plus facilement.', fontL: 'Police', sizeL: 'Taille du texte', spaceL: 'Espacement des lettres et des mots',
    fonts: { andika: 'Andika (la police habituelle)', hyper: 'Atkinson Hyperlegible', lexend: 'Lexend', dys: 'OpenDyslexic' }, sizes: ['Habituelle', 'Plus grande', 'Très grande'], spaces: ['Habituel', 'Plus large', 'Très large'],
    prevL: 'Aperçu', prev: 'Le chat est sur le tapis.',
    practiceH: 'Comment se passe l’entraînement', styleL: 'Façon de s’entraîner',
    gentle: ['Révision douce', 'Ce que votre enfant sait revient après 3, 7 et 21 jours.'], discovery: ['Découverte', 'Réussi du premier coup : c’est acquis pour de bon et ça ne revient plus.'],
    sessionL: 'Temps de jeu par jour', session: m => (m ? `${m} minutes` : 'Sans limite'), sessionHelp: 'Après ce temps de jeu, Tiko dit un au revoir tranquille.',
    likesH: 'Qu’est-ce que votre enfant aime ?', likesP: 'Cochez ce que vous voulez. Tiko les montre en premier. Rien n’est retiré et rien ne devient plus difficile.',
    likes: { space: 'L’espace et les sciences', stories: 'Histoires et livres', numbers: 'Les nombres', draw: 'Dessin et peinture', music: 'Musique et chansons', puzzles: 'Casse-têtes et mémoire' },
    startH: 'Par où commencer', startP: 'Tiko commence toujours très doucement et s’ajuste tout seul pendant que votre enfant joue.', readQ: l => (l === 'fr' ? 'Lecture en français' : 'Lecture en anglais'), mathQ: 'Les nombres',
    readOpts: { find: 'Laisser Tiko découvrir avec un petit jeu', none: 'Pas encore', little: 'Un peu : quelques lettres (Tiko vérifie avec un petit jeu)', well: 'Assez bien : lit quelques mots' },
    mathOpts: { find: 'Laisser Tiko découvrir pendant que votre enfant joue', none: 'Pas encore', little: 'Un peu : compte jusqu’à 10', well: 'Assez bien : additionne de petits nombres' },
    backupH: 'Sauvegarde en ligne (facultatif)', backupP: 'Tiko fonctionne très bien sans. Une sauvegarde garde une copie en ligne de la progression de votre enfant, pour la retrouver sur une autre tablette.',
    backupBtn: 'Configurer la sauvegarde', backupNo: 'Pas maintenant', backupLater: 'Vous la trouverez plus tard dans le coin des parents.',
    doneH: 'Tout est prêt', doneP: 'Tout peut être modifié plus tard dans le coin des parents (la roue dentée sur l’écran d’accueil).', start: 'Démarrer', save: 'Enregistrer ces choix',
    sum: { name: 'Prénom', theme: 'Ami et monde', lang: 'Langue', sound: 'Calme et sons', font: 'Lecture', style: 'Entraînement', session: 'Temps de jeu', likes: 'Centres d’intérêt', read: 'Lecture : point de départ', math: 'Nombres : point de départ' },
    langName: { en: 'anglais', fr: 'français' }, themes: { unicorn: 'Licorne', dino: 'Dragon', rex: 'Dinosaure', owl: 'Chouette' },
  },
};
const SETUP_LIKE_ICON = { space: '🚀', stories: '📚', numbers: '🔢', draw: '🎨', music: '🎵', puzzles: '🧩' };

let SETUP = null;      // the setup on screen: { mode: 'first' | 'child' | 'again', D: the draft, d0: the draft at the start, steps, q: which start questions apply, i, backup, started, reload, shot }

// the choices as they stand now (the draft starts from the child's settings, with the gentle review a new child gets)
function setupDraft(mode) {
  const s = S.settings, one = (v, list, d) => (list.includes(v) ? v : d);
  return { lang: S.lang === 'fr' ? 'fr' : 'en', name: s.name || '', avatar: curProfile().avatar || AVATARS[0], theme: themeName(), frBoy: !!s.frBoy,
    calm: !!s.calm, sfx: s.sfx !== false, ambient: !!s.ambient, simpleHome: !!s.simpleHome, listenFirst: s.listenFirst !== false,
    font: one(s.font, SETUP_FONTS, 'andika'), spacing: one(s.spacing, [0, 1, 2], 0), textSize: one(s.textSize, [0, 1, 2], 0),
    review: mode === 'first' ? 'gentle' : reviewMode(), sessionMin: one(s.sessionMin, SETUP_SESSIONS, 0),
    likes: likesOf(), read: 'find', math: 'find' };
}
// which "where to start" questions apply: reading only for a child who has not started it in the chosen language (a first launch has nothing yet), numbers only in
// the first two modes (never in "Run setup again"). Neither applies: there is no start step.
function setupQs() {
  const lang = SETUP.D.lang;
  return { read: SETUP.mode === 'first' || needsPlacement(lang), math: SETUP.mode !== 'again' };
}
// the step list: the starting-point step only when a question applies (it would do nothing for a child who has started); the backup step only when the switch is on
function setupSteps() {
  const st = ['welcome', 'basics', 'calm', 'read', 'practice', 'likes'];
  SETUP.q = setupQs();
  if (SETUP.q.read || SETUP.q.math) st.push('start');
  if (SETUP.backup) st.push('backup');
  st.push('done');
  return st;
}
function setupRun(mode) {
  stopSpeech(); clearIdle(); musicMode('off'); zoomable(true); zone('home');
  const D = setupDraft(mode);
  SETUP = { mode, D, d0: JSON.stringify(D), frBoy0: !!S.settings.frBoy, steps: [], q: { read: false, math: false }, i: 0, backup: false, started: false, reload: false, shot: null };
  SETUP.steps = setupSteps();
  setupShow();
  // the online-backup step exists only on a tablet with the switch (cloudLoad reads the switch from storage and loads nothing, and asks no server, otherwise)
  cloudLoad().then(ok => {
    if (!SETUP || !ok || typeof cloudState !== 'function' || !cloudState().on) return;
    const cur = SETUP.steps[SETUP.i]; SETUP.backup = true; SETUP.steps = setupSteps(); SETUP.i = Math.max(0, SETUP.steps.indexOf(cur));
    const d = $('.su-dots'); if (d) d.outerHTML = setupDots();
  }).catch(() => {});
}
function setupDots() {
  const t = SETUP_T[SETUP.D.lang], n = SETUP.steps.length;
  return `<div class="su-dots" role="img" aria-label="${esc(t.stepOf(SETUP.i + 1, n))}">${SETUP.steps.map((s, i) => `<i class="${i === SETUP.i ? 'now' : i < SETUP.i ? 'past' : ''}"></i>`).join('')}</div>`;
}
// the preview: the look chosen so far is shown on the page itself (colours, friend, font, spacing, size, calm); the saved settings are not touched
function setupPreview() {
  const D = SETUP.D, b = document.body, m = document.querySelector('meta[name="theme-color"]');
  b.dataset.theme = Object.hasOwn(THEMES, D.theme) ? D.theme : 'unicorn'; if (m) m.content = THEMES[b.dataset.theme][2];
  b.dataset.font = D.font; b.dataset.sp = D.spacing; b.dataset.tz = D.textSize; b.classList.toggle('calm', D.calm || isCalm());
  document.documentElement.lang = D.lang;
}
const setupChip = (name, value, label, checked, extra = '') => `<label class="su-chip ${extra}"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
const setupToggle = (key, pair, on) => `<label class="su-row"><span><b>${esc(pair[0])}</b><small>${esc(pair[1])}</small></span><input type="checkbox" data-k="${key}" ${on ? 'checked' : ''}></label>`;
const setupSet = (legend, body, extra = '') => `<fieldset class="su-set ${extra}"><legend>${esc(legend)}</legend><div class="su-chips">${body}</div></fieldset>`;

// each step: head, body, and what the Next button says
function setupStepHTML(id) {
  const D = SETUP.D, t = SETUP_T[D.lang];
  if (id === 'welcome') return { h: t.welcomeH, body: `<p>${esc(t.welcomeP1)}</p><p>${esc(t.welcomeP2)}</p>
    ${setupSet(t.langL, ['en', 'fr'].map(l => setupChip('lang', l, l === 'en' ? 'English' : 'Français', D.lang === l)).join(''))}`, next: t.begin };
  if (id === 'basics') return { h: t.basicsH, body: `<div class="su-2col"><div>
      <label class="su-name"><b>${esc(t.nameL)}</b><input type="text" class="nm-in su-nm" maxlength="30" autocomplete="off" value="${esc(D.name)}"><small>${esc(t.nameHelp)}</small></label>
      <fieldset class="su-set"><legend>${esc(t.picL)}</legend><div class="su-avs">${AVATARS.map((a, i) => `<button type="button" class="su-av ${a === D.avatar ? 'on' : ''}" data-av="${esc(a)}" aria-label="${esc(t.pic(i + 1))}" aria-pressed="${a === D.avatar}">${a}</button>`).join('')}</div></fieldset></div>
      <div><fieldset class="su-set"><legend>${esc(t.themeL)}</legend><div class="su-themes">${Object.keys(THEMES).map(k => `<button type="button" class="themeb su-th ${D.theme === k ? 'on' : ''}" data-th="${k}" aria-pressed="${D.theme === k}">${owl('', k)}${esc(t.themes[k])}</button>`).join('')}</div></fieldset>
      ${D.lang === 'fr' ? `<label class="su-row"><span><b>${esc(t.frBoy)}</b></span><input type="checkbox" data-k="frBoy" ${D.frBoy ? 'checked' : ''}></label>` : ''}</div></div>`, next: t.next };
  if (id === 'calm') return { h: t.calmH, body: [['calm', t.calm], ['sfx', t.sfx], ['ambient', t.ambient], ['simpleHome', t.simpleHome], ['listenFirst', t.listenFirst]].map(([k, p]) => setupToggle(k, p, D[k])).join(''), next: t.next };
  if (id === 'read') return { h: t.readH, body: `<p>${esc(t.readP)}</p>
    <div class="su-3col">${setupSet(t.fontL, SETUP_FONTS.map(f => setupChip('font', f, esc(t.fonts[f]), D.font === f)).join(''))}
    ${setupSet(t.sizeL, t.sizes.map((n, i) => setupChip('textSize', i, esc(n), D.textSize === i)).join(''))}
    ${setupSet(t.spaceL, t.spaces.map((n, i) => setupChip('spacing', i, esc(n), D.spacing === i)).join(''))}</div>
    <div class="su-prev" role="group" aria-label="${esc(t.prevL)}"><p lang="${D.lang}">${esc(t.prev)}</p></div>`, next: t.next };
  if (id === 'practice') return { h: t.practiceH, body: `${setupSet(t.styleL, [['gentle', t.gentle], ['discovery', t.discovery]].map(([k, p]) => `<label class="su-chip su-wide"><input type="radio" name="review" value="${k}" ${D.review === k ? 'checked' : ''}><span><b>${esc(p[0])}</b><small>${esc(p[1])}</small></span></label>`).join(''), 'su-col')}
    <label class="su-name"><b>${esc(t.sessionL)}</b><select class="su-sel" data-k="sessionMin">${SETUP_SESSIONS.map(m => `<option value="${m}" ${D.sessionMin === m ? 'selected' : ''}>${esc(t.session(m))}</option>`).join('')}</select><small>${esc(t.sessionHelp)}</small></label>`, next: t.next };
  if (id === 'likes') return { h: t.likesH, body: `<p>${esc(t.likesP)}</p><div class="su-likes">${LIKE_KEYS.map(k => `<label class="su-chip su-like"><input type="checkbox" data-like="${k}" ${D.likes.includes(k) ? 'checked' : ''}><span><i aria-hidden="true">${SETUP_LIKE_ICON[k]}</i>${esc(t.likes[k])}</span></label>`).join('')}</div>`, next: t.next };
  if (id === 'start') return { h: t.startH, body: `<p>${esc(t.startP)}</p><div class="su-2col">${SETUP.q.read ? setupSet(t.readQ(D.lang), ['find', 'none', 'little', 'well'].map(k => setupChip('read', k, esc(t.readOpts[k]), D.read === k, 'su-wide')).join(''), 'su-col') : ''}
    ${SETUP.q.math ? setupSet(t.mathQ, ['find', 'none', 'little', 'well'].map(k => setupChip('math', k, esc(t.mathOpts[k]), D.math === k, 'su-wide')).join(''), 'su-col') : ''}</div>`, next: t.next };
  if (id === 'backup') return { h: t.backupH, body: `<p>${esc(t.backupP)}</p><div class="su-bk"><button type="button" class="pbtn su-bkgo">${esc(t.backupBtn)}</button> <button type="button" class="pbtn alt su-bkno">${esc(t.backupNo)}</button></div><p class="su-help">${esc(t.backupLater)}</p>`, next: null };
  // done: a short summary of the choices
  const rows = [[t.sum.name, D.name.trim() || '—'], [t.sum.theme, `${D.avatar} ${t.themes[D.theme] || ''}`], [t.sum.lang, D.lang === 'fr' ? 'Français' : 'English'],
    [t.sum.sound, [D.calm && t.calm[0], D.sfx && t.sfx[0], D.ambient && t.ambient[0], D.simpleHome && t.simpleHome[0], D.listenFirst && t.listenFirst[0]].filter(Boolean).join(', ') || '—'],
    [t.sum.font, `${t.fonts[D.font]}, ${t.sizes[D.textSize].toLowerCase()}, ${t.spaces[D.spacing].toLowerCase()}`], [t.sum.style, t[D.review][0]], [t.sum.session, t.session(D.sessionMin)],
    [t.sum.likes, D.likes.map(k => t.likes[k]).join(', ') || '—']];
  if (SETUP.q.read) rows.push([t.sum.read, t.readOpts[D.read]]);
  if (SETUP.q.math) rows.push([t.sum.math, t.mathOpts[D.math]]);
  return { h: t.doneH, body: `<dl class="su-sum">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl><p>${esc(t.doneP)}</p>`, next: SETUP.mode === 'again' ? t.save : t.start };
}

function setupShow() {
  if (!SETUP) return;
  const D = SETUP.D, t = SETUP_T[D.lang], id = SETUP.steps[SETUP.i], st = setupStepHTML(id), first = SETUP.i === 0, last = id === 'done';
  SETUP.shot = JSON.stringify(D);                        // what the draft was when this step came up (Skip this step puts it back)
  setupPreview(); stopSpeech(); musicMode('off');
  app.innerHTML = `<div class="screen setup" role="group" aria-label="Tiko" lang="${D.lang}"><div class="su-card">
    ${setupDots()}<h2 class="su-h" tabindex="-1">${esc(st.h)}</h2><div class="su-body">${st.body}</div>
    <div class="su-nav">${first ? '' : `<button type="button" class="pbtn alt su-back">${esc(t.back)}</button>`}
      ${first || last || id === 'backup' ? '' : `<button type="button" class="pbtn alt su-skip">${esc(t.skipStep)}</button>`}
      ${st.next ? `<button type="button" class="pbtn su-next">${esc(st.next)}</button>` : ''}
      ${first ? `<button type="button" class="pbtn alt su-skipall">${esc(SETUP.mode === 'again' ? t.cancel : t.skipAll)}</button>` : ''}</div></div></div>`;
  setupWire(id);
  const h = $('.su-h'); if (h) h.focus({ preventScroll: true });
}
function setupGo(to) { SETUP.i = Math.max(0, Math.min(SETUP.steps.length - 1, to)); setupShow(); const s = $('.setup'); if (s) s.scrollTop = 0; }
function setupWire(id) {
  const D = SETUP.D, root = $('.su-body');
  const redo = () => { const s = $('.setup'), y = s ? s.scrollTop : 0; setupShow(); const s2 = $('.setup'); if (s2) s2.scrollTop = y; };
  $('.su-next') && ($('.su-next').onclick = () => (id === 'done' ? setupFinish() : setupGo(SETUP.i + 1)));
  $('.su-back') && ($('.su-back').onclick = () => setupGo(SETUP.i - 1));
  $('.su-skip') && ($('.su-skip').onclick = () => { Object.assign(D, JSON.parse(SETUP.shot)); setupGo(SETUP.i + 1); });
  $('.su-skipall') && ($('.su-skipall').onclick = setupSkipAll);
  $$('.su-nm').forEach(i => { i.addEventListener('keydown', e => e.stopPropagation()); i.addEventListener('input', () => { D.name = i.value; }); });
  $$('input[type=radio]', root).forEach(r => r.addEventListener('change', () => {
    const k = r.name, v = r.value;
    if (k === 'lang') { D.lang = v === 'fr' ? 'fr' : 'en'; const cur = SETUP.steps[SETUP.i]; SETUP.steps = setupSteps(); SETUP.i = Math.max(0, SETUP.steps.indexOf(cur)); return redo(); }
    if (k === 'font') D.font = SETUP_FONTS.includes(v) ? v : 'andika';
    else if (k === 'textSize' || k === 'spacing') D[k] = [0, 1, 2].includes(+v) ? +v : 0;
    else if (k === 'review') D.review = v === 'discovery' ? 'discovery' : 'gentle';
    else if (k === 'read' || k === 'math') D[k] = ['find', 'none', 'little', 'well'].includes(v) ? v : 'find';
    setupPreview();
  }));
  $$('input[type=checkbox][data-k]', root).forEach(c => c.addEventListener('change', () => { D[c.dataset.k] = c.checked; setupPreview(); }));
  $$('input[data-like]', root).forEach(c => c.addEventListener('change', () => { const k = c.dataset.like; D.likes = c.checked ? [...new Set([...D.likes, k])] : D.likes.filter(x => x !== k); }));
  $$('.su-sel', root).forEach(s => s.addEventListener('change', () => { D.sessionMin = SETUP_SESSIONS.includes(+s.value) ? +s.value : 0; }));
  $$('.su-av', root).forEach(b => b.onclick = () => { D.avatar = b.dataset.av; $$('.su-av').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); });
  $$('.su-th', root).forEach(b => b.onclick = () => { D.theme = b.dataset.th; $$('.su-th').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); setupPreview(); });
  if ($('.su-bkno')) $('.su-bkno').onclick = () => setupGo(SETUP.i + 1);
  if ($('.su-bkgo')) $('.su-bkgo').onclick = setupBackup;
}

// writes the draft into the child's settings and saves. Can run again (a first launch is committed before the backup step, and the grown-up may come back and change
// things): the settings, name, picture and language part is rewritten from the draft each time; the starting point the parent chose (through the same code the parent corner and
// the starting game use, forward only) and "new child" are applied once. Never touches progress otherwise.
function setupCommit() {
  if (!SETUP) return;
  const D = SETUP.D, st = S.settings, p = curProfile();
  st.name = String(D.name || '').trim().slice(0, 30);
  S.lang = D.lang;
  Object.assign(st, { theme: D.theme, calm: D.calm, sfx: D.sfx, ambient: D.ambient, simpleHome: D.simpleHome, listenFirst: D.listenFirst, font: D.font, spacing: D.spacing, textSize: D.textSize, review: D.review, sessionMin: D.sessionMin });
  if (D.likes.length || 'likes' in st) st.likes = [...D.likes];      // (a setting that was absent and has nothing ticked stays absent)
  if (!!D.frBoy !== !!st.frBoy) st.frBoy = D.frBoy;
  SETUP.reload = !!D.frBoy !== SETUP.frBoy0;        // the French texts are prepared when the app starts, so a change of this one restarts the app
  if (!SETUP.started) {
    SETUP.started = true;
    if (SETUP.mode === 'first') S.newChild = true;  // a child of this tablet: the starting game and the gentle review, as for a child added in the parent corner
    // the starting game's own code, for the outcome the parent says. "A little: some letters" marks nothing on the parent's word (owner's ruling, v56): the short
    // starting game finds which letters the child knows, exactly as "Let Tiko find out"
    if (SETUP.q.read && (D.read === 'none' || D.read === 'well')) startJourneyAt(S.lang, { none: 0, well: 2 }[D.read], true);
    if (SETUP.q.math && D.math === 'well') setMathStart(2, true);
  }
  let profs = false;
  if (D.avatar !== p.avatar && AVATARS.includes(D.avatar)) { p.avatar = D.avatar; profs = true; }
  if (p.setup) { delete p.setup; profs = true; }
  if (profs) saveProfiles();
  save(); setupMark();
}
const setupMark = () => { try { localStorage.setItem('tiko.setup', '1'); } catch (e) { /* the setup may then come once more; nothing is lost */ } };

// ends the setup and goes where the mode leads (the intro, or back to the parent corner)
function setupLeave() {
  const mode = SETUP.mode, reload = SETUP.reload; SETUP = null;
  zoomable(false); applySettings(); document.documentElement.lang = S.lang;
  if (reload) return location.reload();
  if (mode === 'again') { parentTab = 'child'; return parents(); }
  intro();
}
function setupFinish() {
  // "Run setup again" with nothing changed: nothing is written at all (no save, so no new stamp)
  if (SETUP.mode === 'again' && JSON.stringify(SETUP.D) === SETUP.d0) { SETUP.reload = false; return setupLeave(); }
  setupCommit(); setupLeave();
}
// the account screen replaced this child (the online copy was taken, or the earlier progress put back): the draft must not be written over it. Nothing is committed;
// the child's pending flag is cleared, the marker written, and the setup ends.
function setupEndRestored(pid) {
  const p = PROFILES.list.find(x => x.id === pid); if (p && p.setup) { delete p.setup; saveProfiles(); }
  if (SETUP.mode !== 'again') setupMark();
  SETUP.reload = false; setupLeave();
}
// "Skip the setup". A child added in the parent corner keeps exactly what they had (only the marker and the pending flag are written), and "Run setup again" changes nothing.
// A skipped FIRST LAUNCH becomes a new child like any other (owner's ruling, v56): the gentle review and the short starting game, in the language chosen on the welcome screen;
// no other answer is kept.
function setupSkipAll() {
  if (SETUP.mode !== 'again') {
    const p = curProfile(); if (p.setup) { delete p.setup; saveProfiles(); }
    if (SETUP.mode === 'first' && !SETUP.started) { S.lang = SETUP.D.lang; S.settings.review = 'gentle'; S.newChild = true; save(); }
    setupMark();
  }
  SETUP.reload = false; setupLeave();
}
// "Set up the backup": the grown-up question first, then the account screen; leaving that screen comes back to the last step. A first launch is saved before that, because the account
// screen works on children that exist (the choices are then final, as at "Start").
function setupBackup() {
  const mode = SETUP.mode, back = () => { if (SETUP) setupShow(); };
  parentGate(async () => {
    if (mode === 'first') setupCommit();
    if (!(await cloudLoad()) || typeof acctOpen !== 'function') return back();
    // The account screen replaces S (a new object) when the online copy is taken or earlier progress is put back (acctTake, acctPutBack: both end in `S = ...`); nothing else
    // there replaces S or switches the playing child ("Restore a child" adds a profile and leaves S alone; delete only talks to the server). So a changed S means: end without committing.
    const before = S, pid = PROFILES.current;
    ACCT.after = () => {
      if (!SETUP) return home();
      if (S !== before || PROFILES.current !== pid) return setupEndRestored(pid);
      zoomable(true); setupGo(SETUP.steps.length - 1);
    };
    acctOpen();
  }, back);
}
