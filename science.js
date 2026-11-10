// Tiko – the science track (v38). Loaded after app.js.
// Pure curiosity: nothing here is marked right or wrong, nothing is tested and nothing "comes back to practise".
// Four places: 🪐 Space explorer (the Sun, the Moon and the eight planets), 🚀 Rocket launch, 🔭 Zoom out (from her
// to the galaxies) and 💡 I wonder (question cards: guess first, then find out, then often something to try for real).
// What she has discovered is kept in S.sci ("<lang>:<id>" → day), so new things are offered first and something
// already seen today rests (the same discovery rule as the little library).
'use strict';

const sciKey = id => S.lang + ':' + id;
const sciSeen = id => (S.sci || {})[sciKey(id)];
const sciToday = id => sciSeen(id) === today();
function sciMark(id) { S.sci = S.sci || {}; if (!S.sci[sciKey(id)]) tally('sciNew'); S.sci[sciKey(id)] = today(); tally('sci'); S.stars += 1; save(); }
const sciAllPlanets = () => ['en', 'fr'].some(lg => SPACE.every(b => (S.sci || {})[lg + ':space:' + b.id]));

// ---------- words ----------
const TS = {
  en: {
    spaceSay: 'Where shall we go? Tap the Sun, the Moon or a planet!', found: n => `You discovered ${n}!`, next: 'Tap the arrow to find out more!',
    rkWhere: 'Where shall we fly today?', rkReady: 'The rocket is ready. Press the big red button!', rkGo: 'Lift-off!', rkBtn: 'Launch',
    rkTank: 'The big tank is empty. Tap it to let it go!', rkArrive: n => `We made it to ${n}!`, rkFly: n => `We are flying to ${n}!`,
    rkFacts: ['A rocket pushes fire down. That pushes the rocket up!', 'To leave the Earth, a rocket must go much, much faster than a plane.',
      'A rocket drops its empty tanks. Lighter is faster!', 'In space there is no air. So astronauts wear a space suit to breathe.'],
    zoomBtn: 'Zoom out', zoomSay: 'Tap the telescope to zoom out!', zoomEnd: 'Space is enormous. And you are part of it!',
    wonderSay: 'What are you wondering about? Pick a card!', think: 'What do you think?', or: 'or', yes: 'Yes! Good thinking!', letsSee: "Good guess! Let's find out!",
    tryIt: 'Try it for real!', wonderDone: 'Now you know! Keep wondering!',
  },
  fr: {
    spaceSay: 'Où va-t-on ? Touche le Soleil, la Lune ou une planète !', found: n => `Tu as découvert ${n} !`, next: 'Touche la flèche pour en savoir plus !',
    rkWhere: "Où vole-t-on aujourd'hui ?", rkReady: 'La fusée est prête. Appuie sur le gros bouton rouge !', rkGo: 'Décollage !', rkBtn: 'Décollage',
    rkTank: 'Le gros réservoir est vide. Touche-le pour le lâcher !', rkArrive: n => `Nous voilà arrivés : ${n} !`, rkFly: n => `En route vers ${n} !`,
    rkFacts: ['Une fusée pousse du feu vers le bas. Et ça pousse la fusée vers le haut !', 'Pour quitter la Terre, une fusée doit aller beaucoup, beaucoup plus vite qu’un avion.',
      'Une fusée lâche ses réservoirs vides. Plus légère, elle va plus vite !', "Dans l'espace, il n'y a pas d'air. Alors les astronautes portent une combinaison pour respirer."],
    zoomBtn: 'Recule', zoomSay: 'Touche le télescope pour reculer !', zoomEnd: "L'espace est immense. Et tu en fais partie !",
    wonderSay: 'Qu’est-ce que tu te demandes ? Choisis une carte !', think: "Qu'en penses-tu ?", or: 'ou', yes: 'Oui ! Bien pensé !', letsSee: 'Bonne idée ! Allons voir !',
    tryIt: 'Essaie pour de vrai !', wonderDone: 'Maintenant tu sais ! Continue à te poser des questions !',
  },
};
const TSL = () => TS[S.lang];
// (the names of the track and of its four places are in app.js, next to the other activity names)

// ---------- the Sun, the Moon and the planets ----------
// z = how big it is drawn next to the others (not to scale: the Sun would not fit on the tablet!)
const SPACE = [
  { id: 'sun', z: 1.5, en: ['the Sun', 'The Sun'], fr: ['le Soleil', 'Le Soleil'],
    f: { en: ['The Sun is a star. It is the star closest to us.', 'The Sun is so big that a million Earths could fit inside it!', 'The Sun gives us light and keeps us warm. But never look straight at it!'],
      fr: ["Le Soleil est une étoile. C'est l'étoile la plus proche de nous.", 'Le Soleil est si gros qu’un million de Terres pourraient tenir dedans !', 'Le Soleil nous éclaire et nous réchauffe. Mais ne le regarde jamais en face !'] } },
  { id: 'mercury', z: .6, en: ['Mercury', 'Mercury'], fr: ['Mercure', 'Mercure'],
    f: { en: ['Mercury is the smallest planet. It is the closest to the Sun.', 'Mercury goes around the Sun very fast. A year there is only 88 days!', 'Mercury has no moon, and almost no air.'],
      fr: ["Mercure est la plus petite planète. C'est la plus proche du Soleil.", 'Mercure tourne très vite autour du Soleil. Là-bas, une année dure seulement 88 jours !', "Mercure n'a pas de lune, et presque pas d'air."] } },
  { id: 'venus', z: .85, en: ['Venus', 'Venus'], fr: ['Vénus', 'Vénus'],
    f: { en: ['Venus is the hottest planet. It is hotter than an oven!', 'Venus spins backwards, and very slowly.', 'You can see Venus from Earth. It shines like a very bright star.'],
      fr: ["Vénus est la planète la plus chaude. Plus chaude qu'un four !", "Vénus tourne à l'envers, et très lentement.", 'On peut voir Vénus depuis la Terre. Elle brille comme une étoile très brillante.'] } },
  { id: 'earth', z: .9, en: ['Earth', 'Earth'], fr: ['la Terre', 'La Terre'],
    f: { en: ['Earth is our home. It is the only planet we know with life.', 'Most of the Earth is covered with water. That is why it looks blue.', 'The Earth spins like a top. That gives us day and night.'],
      fr: ["La Terre est notre maison. C'est la seule planète connue où il y a de la vie.", "La Terre est presque toute couverte d'eau. C'est pour ça qu'elle est bleue.", 'La Terre tourne comme une toupie. Ça nous donne le jour et la nuit.'] } },
  { id: 'moon', z: .55, en: ['the Moon', 'The Moon'], fr: ['la Lune', 'La Lune'],
    f: { en: ['The Moon goes around the Earth.', 'The Moon has no light of its own. It shines because the Sun lights it.', 'People have walked on the Moon! Their footprints are still there.'],
      fr: ['La Lune tourne autour de la Terre.', "La Lune n'a pas de lumière à elle. Elle brille parce que le Soleil l'éclaire.", 'Des gens ont marché sur la Lune ! Leurs traces de pas y sont encore.'] } },
  { id: 'mars', z: .7, en: ['Mars', 'Mars'], fr: ['Mars', 'Mars'],
    f: { en: ['Mars is the red planet. Its ground is rusty, like old iron.', 'Mars has a giant volcano. It is much taller than any mountain on Earth.', 'Robots on wheels are driving on Mars right now. They send us pictures!'],
      fr: ['Mars est la planète rouge. Son sol est rouillé, comme du vieux fer.', "Mars a un volcan géant. Il est bien plus haut que toutes les montagnes de la Terre.", 'Des robots à roues roulent sur Mars en ce moment. Ils nous envoient des photos !'] } },
  { id: 'jupiter', z: 1.25, en: ['Jupiter', 'Jupiter'], fr: ['Jupiter', 'Jupiter'],
    f: { en: ['Jupiter is the biggest planet. All the other planets could fit inside it!', 'Jupiter is made of gas. There is no ground to stand on.', 'Its big red spot is a storm. A storm bigger than the Earth!'],
      fr: ['Jupiter est la plus grosse planète. Toutes les autres planètes pourraient tenir dedans !', "Jupiter est faite de gaz. Il n'y a pas de sol pour marcher.", "Sa grande tache rouge est une tempête. Une tempête plus grande que la Terre !"] } },
  { id: 'saturn', z: 1.35, en: ['Saturn', 'Saturn'], fr: ['Saturne', 'Saturne'],
    f: { en: ['Saturn has beautiful rings. They are made of ice and rock.', 'Saturn is so light that it would float in a giant bathtub!', 'Saturn has more than one hundred moons.'],
      fr: ['Saturne a de beaux anneaux. Ils sont faits de glace et de cailloux.', 'Saturne est si légère qu’elle flotterait dans une baignoire géante !', 'Saturne a plus de cent lunes.'] } },
  { id: 'uranus', z: 1, en: ['Uranus', 'Uranus'], fr: ['Uranus', 'Uranus'],
    f: { en: ['Uranus is a giant made of ice and gas. It is very, very cold.', 'Uranus rolls on its side, like a ball.', 'Uranus is a pale blue-green colour.'],
      fr: ['Uranus est une géante de glace et de gaz. Il y fait très, très froid.', 'Uranus roule sur le côté, comme une balle.', "Uranus est d'un bleu-vert très pâle."] } },
  { id: 'neptune', z: 1, en: ['Neptune', 'Neptune'], fr: ['Neptune', 'Neptune'],
    f: { en: ['Neptune is the planet farthest from the Sun.', 'Neptune has the fastest winds of all the planets.', 'Neptune is so far away that one year there lasts 165 of our years!'],
      fr: ['Neptune est la planète la plus éloignée du Soleil.', 'Neptune a les vents les plus rapides de toutes les planètes.', 'Neptune est si loin qu’une année là-bas dure 165 de nos années !'] } },
];
const bodyOf = id => SPACE.find(b => b.id === id);

// ---------- drawings ----------
let sciN = 0;
const SCI_COL = { sun: ['#fffbd0', '#ffd23f', '#ff9a2e'], mercury: ['#e2ddd8', '#a8a199', '#6f6962'], venus: ['#fff4d2', '#f1c27d', '#c98f4e'], earth: ['#b5e6ff', '#3d9be9', '#1f5fb5'],
  moon: ['#ffffff', '#d5d5dc', '#9a9aa6'], mars: ['#ffbfa6', '#e2603f', '#a63a22'], jupiter: ['#f6e3c6', '#d9a877', '#a9683f'], saturn: ['#fdeebf', '#e6c47a', '#b8935a'],
  uranus: ['#e2fdff', '#9be3ea', '#5fb9c4'], neptune: ['#a9c2ff', '#4b6fe0', '#2b3fa8'] };
function bodySVG(id) {
  const n = ++sciN, g = 'sg' + n, c = 'sc' + n, sh = 'ss' + n, [c1, c2, c3] = SCI_COL[id], ringed = id === 'saturn' || id === 'uranus', R = ringed ? 30 : id === 'sun' ? 34 : 44;
  const ring = (front, col, w) => `<path d="M3 50 A47 ${id === 'saturn' ? 13 : 9} 0 0 ${front ? 0 : 1} 97 50" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const tilt = id === 'saturn' ? -16 : 72;
  const inside = {
    sun: '', uranus: '<ellipse cx="50" cy="42" rx="34" ry="5" fill="#fff" opacity=".18"/>',
    mercury: '<g fill="#6f6962" opacity=".35"><circle cx="36" cy="38" r="7"/><circle cx="62" cy="58" r="10"/><circle cx="58" cy="28" r="4"/><circle cx="34" cy="66" r="5"/><circle cx="74" cy="40" r="3"/></g>',
    moon: '<g fill="#8f8f9c" opacity=".4"><circle cx="38" cy="36" r="9"/><circle cx="64" cy="54" r="7"/><circle cx="46" cy="68" r="6"/><circle cx="66" cy="30" r="4"/><circle cx="26" cy="56" r="4"/></g>',
    venus: '<g fill="none" stroke="#fff" stroke-width="6" opacity=".28" stroke-linecap="round"><path d="M8 34 Q50 22 92 36"/><path d="M6 54 Q50 66 94 52"/><path d="M14 74 Q50 64 88 74"/></g>',
    earth: '<g fill="#5cc66b"><path d="M22 30 q10 -12 24 -6 q6 8 -2 14 q-4 8 -12 6 q-2 10 -10 6 q-6 -10 0 -20z"/><path d="M56 46 q14 -6 22 4 q4 12 -4 20 q-10 6 -14 -4 q-8 -8 -4 -20z"/><path d="M36 70 q8 -4 12 4 q-2 10 -10 10 q-6 -6 -2 -14z"/></g><g fill="#fff" opacity=".75"><ellipse cx="40" cy="18" rx="16" ry="4"/><ellipse cx="68" cy="34" rx="12" ry="3"/><ellipse cx="30" cy="54" rx="10" ry="3"/><ellipse cx="60" cy="84" rx="14" ry="4"/></g>',
    mars: '<g fill="#8f2f1c" opacity=".4"><path d="M24 44 q12 -10 26 -2 q8 8 -4 12 q-14 4 -22 -10z"/><ellipse cx="66" cy="64" rx="12" ry="6"/><circle cx="36" cy="70" r="5"/></g><ellipse cx="50" cy="9" rx="16" ry="5" fill="#fff" opacity=".9"/>',
    jupiter: '<g opacity=".8"><rect x="0" y="16" width="100" height="9" fill="#c98f5f"/><rect x="0" y="33" width="100" height="7" fill="#f8ecd8"/><rect x="0" y="46" width="100" height="11" fill="#b9774a"/><rect x="0" y="64" width="100" height="6" fill="#f3e2c6"/><rect x="0" y="76" width="100" height="9" fill="#c98f5f"/></g><ellipse cx="66" cy="58" rx="10" ry="6" fill="#d2553a"/>',
    saturn: '<g opacity=".5"><rect x="0" y="36" width="100" height="5" fill="#c9a25e"/><rect x="0" y="50" width="100" height="7" fill="#fff5d6"/><rect x="0" y="64" width="100" height="5" fill="#c9a25e"/></g>',
    neptune: '<g fill="#fff" opacity=".5"><ellipse cx="40" cy="34" rx="14" ry="2.500"/><ellipse cx="62" cy="62" rx="12" ry="2"/></g><ellipse cx="34" cy="58" rx="8" ry="5" fill="#22307f" opacity=".55"/>',
  }[id];
  return `<svg class="body b-${id}" viewBox="0 0 100 100" aria-hidden="true"><defs>
    <radialGradient id="${g}" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient>
    <radialGradient id="${sh}" cx=".34" cy=".3" r=".85"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <radialGradient id="${g}h"><stop offset=".45" stop-color="#ffd23f" stop-opacity=".75"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>
    <clipPath id="${c}"><circle cx="50" cy="50" r="${R}"/></clipPath></defs>
    ${id === 'sun' ? `<circle class="halo" cx="50" cy="50" r="50" fill="url(#${g}h)"/>` : ''}
    ${ringed ? `<g transform="rotate(${tilt} 50 50)">${id === 'saturn' ? ring(0, '#cdb27a', 7) + ring(0, '#f3dfa8', 3) : ring(0, '#c8f4f8', 1.6)}</g>` : ''}
    <circle cx="50" cy="50" r="${R}" fill="url(#${g})"/><g clip-path="url(#${c})">${inside}</g>
    ${id === 'sun' ? '' : `<circle cx="50" cy="50" r="${R}" fill="url(#${sh})"/>`}
    ${ringed ? `<g transform="rotate(${tilt} 50 50)">${id === 'saturn' ? ring(1, '#cdb27a', 7) + ring(1, '#f3dfa8', 3) : ring(1, '#c8f4f8', 1.6)}</g>` : ''}</svg>`;
}
const rocketSVG = () => `<svg class="rocket" viewBox="0 0 80 190" aria-hidden="true">
  <g class="rk-flame"><path d="M26 150 Q40 196 54 150Z" fill="#ff9a2e"/><path d="M32 150 Q40 180 48 150Z" fill="#ffe27a"/></g>
  <g class="rk-boost"><rect x="24" y="96" width="32" height="56" rx="4" fill="#cfd6e4"/><rect x="24" y="112" width="32" height="6" fill="#9aa5bb"/>
    <path d="M24 122 L6 156 L24 150Z" fill="#f2637e"/><path d="M56 122 L74 156 L56 150Z" fill="#f2637e"/></g>
  <g class="rk-top"><path d="M24 44 Q40 -6 56 44 V98 H24Z" fill="#fff"/><path d="M27.500 34 Q40 -4 52.500 34Z" fill="#f2637e"/>
    <circle cx="40" cy="58" r="9" fill="#7fd0ff" stroke="#5a6b8c" stroke-width="3"/><rect x="24" y="84" width="32" height="6" fill="#57c4b3"/>
    <g class="rk-mini"><path d="M30 98 Q40 122 50 98Z" fill="#ff9a2e"/></g></g></svg>`;
// a swirl of stars: two arms, drawn tilted, with a bright middle
function galaxySVG(n = 420, here) {
  const cols = ['#ffffff', '#cfe0ff', '#ffd9f2', '#fff3c4', '#bfe9ff']; let s = '';
  for (let i = 0; i < n; i++) {
    const t = Math.sqrt((i % (n / 2)) / (n / 2)), a = (i < n / 2 ? 0 : Math.PI) + t * 2.5 * Math.PI, r = 6 + t * 40, j = () => (Math.random() - .5) * (2 + t * 6) * (Math.random() < .25 ? 2.2 : 1);
    s += `<circle cx="${(50 + r * Math.cos(a) + j()).toFixed(1)}" cy="${(50 + r * Math.sin(a) + j()).toFixed(1)}" r="${(.3 + Math.random() * .8).toFixed(2)}" fill="${cols[i % cols.length]}" opacity="${(.45 + Math.random() * .55).toFixed(2)}"/>`;
  }
  const id = 'gx' + (++sciN);
  // the stars turn in their own flat plane; the whole plane is squashed so we see it tilted
  return `<svg class="galaxy" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe9b8" stop-opacity=".8"/><stop offset="1" stop-color="#ffe9b8" stop-opacity="0"/></radialGradient></defs>
    <g transform="translate(0 19) scale(1 .62)"><g class="spin">${s}<circle cx="50" cy="50" r="14" fill="url(#${id})"/>
    ${here ? '<circle cx="79" cy="60" r="3" fill="none" stroke="#ffd23f" stroke-width="1"/><circle cx="79" cy="60" r="1.200" fill="#ffd23f"/>' : ''}</g></g></svg>`;
}
const solarSVG = () => `<svg class="solar" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="7" fill="#ffd23f"/><circle cx="50" cy="50" r="10" fill="#ffd23f" opacity=".25"/>
  ${[[13, '#a8a199', 1.2, 5], [18, '#f1c27d', 1.8, 8], [24, '#3d9be9', 2, 11], [29, '#e2603f', 1.5, 15], [35, '#d9a877', 3.4, 24], [41, '#e6c47a', 3, 32], [45, '#9be3ea', 2.2, 42], [49, '#4b6fe0', 2.2, 54]]
    .map(([r, col, s, d], i) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#ffffff30" stroke-width=".3"/><g class="orb" style="animation-duration:${d}s;animation-delay:-${i * 3.7}s"><circle cx="${50 + r}" cy="50" r="${s}" fill="${col}"/>${i === 2 ? `<circle cx="${50 + r}" cy="50" r="3.600" fill="none" stroke="#fff" stroke-width=".5"/>` : ''}</g>`).join('')}</svg>`;

// ---------- one frame for every science screen ----------
function sciFrame(cls, inner, dots = 0, at = 0) {
  return `<div class="screen act sci ${cls}"><header class="bar"><button class="ic home" aria-label="home">🏠</button>
    <div class="dots">${Array.from({ length: dots }, (_, j) => `<i class="${j < at ? 'done' : j === at ? 'now' : ''}"></i>`).join('')}</div>
    <button class="ic replay" aria-label="repeat">🔊</button></header><div class="stage">${inner}</div></div>`;
}
const sciText = t => `<div class="scicard">${esc(t)}</div>`;
async function sciCheer(text) { sfx('win'); rain(); await speak(text); await sleep(300); }

// ---------- 🪐 Space explorer ----------
function spaceExplorer() {
  return new Promise(resolve => {
    const N = b => b[S.lang];
    const map = () => {
      clearIdle(); stopSpeech(); zone('sci'); musicMode('calm');
      const allRest = SPACE.every(b => sciToday('space:' + b.id)), firstNew = SPACE.find(b => !sciSeen('space:' + b.id));
      app.innerHTML = `<div class="screen sub sci spacemap"><div class="topline"><button class="ic back">🏠</button><h2>🪐 ${esc(actName('space'))}</h2><div style="width:64px"></div></div>
        <div class="bodies">${SPACE.map((b, i) => { const rest = !allRest && sciToday('space:' + b.id), seen = sciSeen('space:' + b.id);
          return `<button class="bodyb ${rest ? 'st-rest' : ''} ${b === firstNew ? 'suggest' : ''}" data-b="${b.id}" style="--i:${i};--z:${b.z}"><span class="bw">${bodySVG(b.id)}</span><b>${esc(N(b)[1])}</b><i class="tag">${rest ? '💤' : seen ? '✅' : '✨'}</i></button>`; }).join('')}</div></div>`;
      $('.back').onclick = () => { stopSpeech(); resolve(null); }; exitCurrent = () => resolve(null);
      $$('[data-b]').forEach(el => el.onclick = async () => {
        if (el.classList.contains('st-rest')) { el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); sfx('tap'); return speak(L().disc.rest); }
        sfx('pop'); const r = await visit(bodyOf(el.dataset.b));
        if (r) resolve(true); else if (r === null) resolve(null); else map();
      });
      speak(TSL().spaceSay);
    };
    // true = all three things heard, false = back to the map, null = 🏠
    const visit = b => new Promise(res => {
      const facts = b.f[S.lang]; let i = 0, done = false;
      const fin = v => { if (done) return; done = true; stopSpeech(); clearIdle(); res(v); };
      const page = () => {
        const last = i === facts.length - 1;
        app.innerHTML = sciFrame('visit', `<h2 class="scih">${esc(N(b)[1])}</h2><div class="bigbody" style="--z:${b.z}">${bodySVG(b.id)}</div>${sciText(facts[i])}
          <div class="btnrow">${i ? '<button class="btn prevb" aria-label="back">◀</button>' : '<button class="btn mapb" aria-label="map">🪐</button>'}<button class="btn primary huge nextb" aria-label="next">${last ? '✅' : '▶'}</button></div>`, facts.length, i);
        $('.home').onclick = () => fin(null); exitCurrent = () => fin(null);
        $('.replay').onclick = () => { sfx('tap'); speak(facts[i]); };
        const p = $('.prevb'), m = $('.mapb'); if (p) p.onclick = () => { sfx('tap'); i--; page(); }; if (m) m.onclick = () => { sfx('tap'); fin(false); };
        $('.nextb').onclick = async () => {
          sfx('pop'); if (!last) { i++; return page(); }
          $('.nextb').disabled = true; sciMark('space:' + b.id); burstAt($('.bigbody'), 50); await sciCheer(TSL().found(N(b)[0])); fin(true);
        };
        setIdle(() => nudge([TSL().next]));
        speak(...(i ? [] : [N(b)[1] + '!', { pause: 200 }]), facts[i]);
      };
      page();
    });
    map();
  });
}

// ---------- 🚀 Rocket launch ----------
const RK_DEST = ['moon', 'mars', 'jupiter', 'saturn', 'neptune'];
const RK_TRIP = {
  en: { moon: 'A real rocket takes about three days to reach the Moon.', mars: 'A real rocket takes about seven months to reach Mars.', jupiter: 'A real rocket takes about five years to reach Jupiter. Only robots have made the trip!',
    saturn: 'A real rocket takes about seven years to reach Saturn. Only robots have made the trip!', neptune: 'A real rocket takes about twelve years to reach Neptune. Only one robot has ever been there!' },
  fr: { moon: 'Une vraie fusée met environ trois jours pour aller sur la Lune.', mars: 'Une vraie fusée met environ sept mois pour aller sur Mars.', jupiter: 'Une vraie fusée met environ cinq ans pour arriver à Jupiter. Seuls des robots ont fait le voyage !',
    saturn: 'Une vraie fusée met environ sept ans pour arriver à Saturne. Seuls des robots ont fait le voyage !', neptune: "Une vraie fusée met environ douze ans pour arriver à Neptune. Un seul robot y est allé !" },
};
function rocketLaunch() {
  return new Promise(resolve => {
    clearIdle(); stopSpeech(); zone('sci'); musicMode('calm');
    const R = TSL(); let done = false, said = [R.rkWhere];
    const finish = v => { if (done) return; done = true; stopSpeech(); clearIdle(); resolve(v); };
    // three places to choose from: the ones she has not flown to yet come first
    const dests = [...RK_DEST].sort((a, b) => (sciSeen('rk:' + a) ? 1 : 0) - (sciSeen('rk:' + b) ? 1 : 0)).slice(0, 3).map(bodyOf);
    const flights = tot('rockets'), facts = [R.rkFacts[(flights * 2) % 4], R.rkFacts[(flights * 2 + 1) % 4]];
    app.innerHTML = sciFrame('launch', `<div class="rk-sky"><div class="rk-stars"></div><div class="rk-ground"></div></div>
      <div class="rk-say">${sciText(R.rkWhere)}</div><div class="rk-scene"><div class="rk-count"></div><div class="rk-dest"></div><div class="rk-ship">${rocketSVG()}</div></div>
      <div class="btnrow rk-btns">${dests.map(b => `<button class="btn rk-pick" data-d="${b.id}"><span class="bw">${bodySVG(b.id)}</span>${esc(b[S.lang][1])}</button>`).join('')}</div>`);
    const scr = $('.launch'), sayBox = $('.rk-say'), btns = $('.rk-btns'), ship = $('.rk-ship');
    const tell = async (...t) => { said = t; sayBox.innerHTML = sciText(t.join(' ')); setIdle(() => nudge(said)); await speak(...t); };
    $('.home').onclick = () => finish(null); exitCurrent = () => finish(null);
    $('.replay').onclick = () => { sfx('tap'); speak(...said); };
    $$('.rk-pick').forEach(b => b.onclick = async () => {
      const dest = bodyOf(b.dataset.d), name = dest[S.lang][0]; sfx('pop');
      $('.rk-dest').innerHTML = bodySVG(dest.id); $('.rk-dest').style.setProperty('--z', dest.z);
      btns.innerHTML = `<button class="btn rk-go pulse"><i></i>${esc(R.rkBtn)}</button>`;
      $('.rk-go').onclick = async () => {
        $('.rk-go').disabled = true; $('.rk-go').classList.remove('pulse'); clearIdle(); stopSpeech(); sayBox.innerHTML = '';
        const cnt = $('.rk-count');
        for (let n = 5; n >= 1 && !done; n--) { cnt.textContent = n; cnt.classList.remove('tick'); void cnt.offsetWidth; cnt.classList.add('tick'); sfx('tap'); ship.classList.toggle('rumble', n <= 3); await speak(String(n)); }
        if (done) return;
        cnt.textContent = '🔥'; scr.classList.add('fly'); ship.classList.remove('rumble'); sfx('win'); btns.innerHTML = '';
        await speak(R.rkGo); cnt.textContent = ''; if (done) return;
        await tell(R.rkFly(name), facts[0]); if (done) return;
        // the empty tank: she lets it go herself (no timer — the rocket waits for her)
        await new Promise(ok => { const bo = $('.rk-boost'); scr.classList.add('tank'); tell(R.rkTank);
          const drop = () => { if (scr.classList.contains('dropped')) return; sfx('pop'); scr.classList.add('dropped'); scr.classList.remove('tank'); stopSpeech(); ok(); };
          bo.addEventListener('click', drop); ship.addEventListener('click', drop); });
        if (done) return;
        await tell(facts[1]); if (done) return;
        scr.classList.add('arrive'); await sleep(1600); if (done) return;
        btns.innerHTML = `<button class="btn primary huge okb" aria-label="done">✅</button>`;
        $('.okb').onclick = async () => { $('.okb').disabled = true; sciMark('rk:' + dest.id); tally('rockets'); save(); burstAt($('.rk-dest'), 50); await sciCheer(R.found(name)); finish(true); };
        await tell(R.rkArrive(name), RK_TRIP[S.lang][dest.id]);
      };
      await tell(R.rkReady);
    });
    setIdle(() => nudge(said)); speak(R.rkWhere);
  });
}

// ---------- 🔭 Zoom out: from her to the galaxies ----------
const ZOOM = [
  { pic: () => '<div class="zemo">🧒</div>', en: 'This is you!', fr: "Ça, c'est toi !" },
  { pic: () => '<div class="zemo">🏠</div>', en: 'You live in a home.', fr: 'Tu habites dans une maison.' },
  { pic: () => '<div class="zemo">🏙️</div>', en: 'Your home is in a town, with lots of other homes.', fr: "Ta maison est dans une ville, avec plein d'autres maisons." },
  { pic: () => `<div class="zbody">${bodySVG('earth')}</div>`, en: 'Your town is on a big blue ball: planet Earth.', fr: 'Ta ville est sur une grosse boule bleue : la planète Terre.' },
  { pic: solarSVG, en: 'The Earth goes around the Sun, with seven other planets. Can you see it? It has a white ring around it.', fr: "La Terre tourne autour du Soleil, avec sept autres planètes. Tu la vois ? Elle est entourée d'un petit cercle blanc." },
  { pic: () => galaxySVG(520, true), en: 'Our Sun is one little star in a giant swirl of stars. It is our galaxy, the Milky Way. We are in the yellow circle.', fr: "Notre Soleil est une petite étoile dans un tourbillon géant d'étoiles. C'est notre galaxie, la Voie lactée. Nous sommes dans le cercle jaune." },
  { pic: () => `<div class="zmany">${[[18, 22, .5, 20], [70, 16, .36, -40], [44, 50, .7, 0], [82, 62, .44, 70], [14, 74, .4, -15], [58, 84, .3, 35]].map(([x, y, s, r]) => `<span style="left:${x}%;top:${y}%;--s:${s};--r:${r}deg">${galaxySVG(150)}</span>`).join('')}</div>`,
    en: 'And there are more galaxies than you could ever count!', fr: "Et il y a plus de galaxies qu'on ne pourra jamais en compter !" },
];
function zoomOut() {
  return new Promise(resolve => {
    clearIdle(); stopSpeech(); zone('sci'); musicMode('calm');
    let i = 0, done = false, busy = false;
    const finish = v => { if (done) return; done = true; stopSpeech(); clearIdle(); resolve(v); };
    app.innerHTML = sciFrame('zoom', `<div class="zstage"><div class="zscene now">${ZOOM[0].pic()}</div></div><div class="zsay">${sciText(ZOOM[0][S.lang])}</div>
      <div class="btnrow"><button class="btn primary huge zb">🔭 ${esc(TSL().zoomBtn)}</button></div>`, ZOOM.length, 0);
    const dots = () => $$('.dots i').forEach((d, j) => { d.className = j < i ? 'done' : j === i ? 'now' : ''; });
    $('.home').onclick = () => finish(null); exitCurrent = () => finish(null);
    $('.replay').onclick = () => { sfx('tap'); speak(ZOOM[i][S.lang]); };
    $('.zb').onclick = async () => {
      if (busy) return; busy = true; sfx('pop'); stopSpeech();
      if (i === ZOOM.length - 1) { $('.zb').disabled = true; sciMark('zoom'); burstAt($('.zstage'), 50); await sciCheer(TSL().zoomEnd); return finish(true); }
      // the old picture shrinks away into the middle while the bigger one settles around it
      const st = $('.zstage'), old = $('.zscene.now'), nx = document.createElement('div');
      i++; nx.className = 'zscene in'; nx.innerHTML = ZOOM[i].pic(); st.appendChild(nx); old.classList.remove('now'); old.classList.add('out');
      void nx.offsetWidth; nx.classList.add('now'); nx.classList.remove('in'); dots();
      $('.zsay').innerHTML = sciText(ZOOM[i][S.lang]); if (i === ZOOM.length - 1) $('.zb').textContent = '✅';
      setTimeout(() => old.remove(), 1300); await sleep(700); busy = false;
      speak(ZOOM[i][S.lang]);
    };
    setIdle(() => nudge([TSL().zoomSay]));
    speak(ZOOM[0][S.lang], { pause: 250 }, TSL().zoomSay);
  });
}

// ---------- 💡 I wonder: guess, find out, try ----------
// g: two guesses, the first one is what really happens (they are shuffled on screen). Guessing "wrong" costs nothing.
const WONDER = [
  { id: 'star', pic: '⭐', en: { t: 'Stars', q: 'What is a star?', g: [['☀️', 'A giant hot ball, like the Sun'], ['💡', 'A little lamp in the sky']],
      a: 'A star is a giant ball of hot, glowing gas, like our Sun. Stars look tiny because they are very, very far away.', y: 'Tonight, look up at the sky. Can you count ten stars?' },
    fr: { t: 'Les étoiles', q: "Qu'est-ce qu'une étoile ?", g: [['☀️', 'Une boule géante très chaude, comme le Soleil'], ['💡', 'Une petite lampe dans le ciel']],
      a: "Une étoile est une boule géante de gaz très chaud qui brille, comme notre Soleil. Les étoiles ont l'air toutes petites parce qu'elles sont très, très loin.", y: 'Ce soir, regarde le ciel. Peux-tu compter dix étoiles ?' } },
  { id: 'rainbow', pic: '🌈', en: { t: 'Rainbows', q: 'What makes a rainbow?', g: [['🌦️', 'Sun and rain together'], ['🖌️', 'A giant paintbrush']],
      a: 'Sunlight looks white, but all the colours are hiding inside it. Raindrops split the light, and the colours come out. That makes a rainbow!', y: 'On a sunny day, spray some water with the Sun behind you. Look for a rainbow!' },
    fr: { t: 'Les arcs-en-ciel', q: "Qu'est-ce qui fait un arc-en-ciel ?", g: [['🌦️', 'Le soleil et la pluie ensemble'], ['🖌️', 'Un pinceau géant']],
      a: "La lumière du Soleil a l'air blanche, mais toutes les couleurs se cachent dedans. Les gouttes de pluie séparent la lumière, et les couleurs sortent. Ça fait un arc-en-ciel !", y: "Un jour de soleil, arrose avec le Soleil dans ton dos. Cherche l'arc-en-ciel !" } },
  { id: 'moonshape', pic: '🌙', en: { t: 'The Moon', q: 'Why does the Moon change shape?', g: [['🌗', 'The Sun lights only one side'], ['🍪', 'Somebody takes a bite']],
      a: 'The Moon is always a ball. The Sun lights one side of it. As the Moon goes around the Earth, we see more or less of its bright side.', y: 'Draw the Moon tonight. Draw it again next week. Did it change?' },
    fr: { t: 'La Lune', q: 'Pourquoi la Lune change-t-elle de forme ?', g: [['🌗', "Le Soleil n'éclaire qu'un côté"], ['🍪', "Quelqu'un en croque un bout"]],
      a: "La Lune est toujours une boule. Le Soleil éclaire un seul côté. Quand la Lune tourne autour de la Terre, on voit plus ou moins son côté éclairé.", y: 'Dessine la Lune ce soir. Dessine-la encore la semaine prochaine. Est-ce qu’elle a changé ?' } },
  { id: 'gravity', pic: '🍎', en: { t: 'Falling', q: 'Why do things fall down?', g: [['🌍', 'The Earth pulls them'], ['💨', 'The wind pushes them']],
      a: 'The Earth pulls everything towards it. This pull is called gravity. On the Moon the pull is weaker, so you could jump six times higher!', y: 'Drop a ball and a sheet of paper. Which one lands first? Now crumple the paper and try again!' },
    fr: { t: 'Tomber', q: 'Pourquoi les choses tombent-elles ?', g: [['🌍', 'La Terre les attire'], ['💨', 'Le vent les pousse']],
      a: "La Terre attire tout vers elle. Ça s'appelle la gravité. Sur la Lune, ça tire moins fort : tu pourrais sauter six fois plus haut !", y: 'Lâche une balle et une feuille de papier. Laquelle arrive en premier ? Maintenant froisse la feuille et recommence !' } },
  { id: 'daynight', pic: '🌗', en: { t: 'Day and night', q: 'Why is it dark at night?', g: [['🌍', 'The Earth turns'], ['😴', 'The Sun goes to sleep']],
      a: 'The Earth spins like a top. When your side faces the Sun, it is day. When your side turns away, it is night. The Sun never stops shining!', y: 'Take a lamp and a ball. The lamp is the Sun. Turn the ball slowly: you made day and night!' },
    fr: { t: 'Le jour et la nuit', q: 'Pourquoi fait-il noir la nuit ?', g: [['🌍', 'La Terre tourne'], ['😴', 'Le Soleil va dormir']],
      a: "La Terre tourne comme une toupie. Quand ton côté regarde le Soleil, c'est le jour. Quand ton côté se détourne, c'est la nuit. Le Soleil ne s'arrête jamais de briller !", y: "Prends une lampe et une balle. La lampe, c'est le Soleil. Tourne doucement la balle : tu as fait le jour et la nuit !" } },
  { id: 'volcano', pic: '🌋', en: { t: 'Volcanoes', q: 'What comes out of a volcano?', g: [['🔥', 'Melted rock'], ['🍅', 'Tomato sauce']],
      a: 'Deep inside the Earth it is so hot that rock melts. A volcano is a mountain where the melted rock comes out. It is called lava.' },
    fr: { t: 'Les volcans', q: "Qu'est-ce qui sort d'un volcan ?", g: [['🔥', 'De la roche fondue'], ['🍅', 'De la sauce tomate']],
      a: "Tout au fond de la Terre, il fait si chaud que la roche fond. Un volcan est une montagne par où sort la roche fondue. On l'appelle la lave." } },
  { id: 'shooting', pic: '🌠', en: { t: 'Shooting stars', q: 'What is a shooting star?', g: [['🪨', 'A tiny rock from space'], ['⭐', 'A star that fell down']],
      a: 'A shooting star is not a star! It is a tiny rock from space. It falls so fast through the air that it burns and glows.' },
    fr: { t: 'Les étoiles filantes', q: "Qu'est-ce qu'une étoile filante ?", g: [['🪨', "Un petit caillou de l'espace"], ['⭐', 'Une étoile qui est tombée']],
      a: "Une étoile filante n'est pas une étoile ! C'est un petit caillou de l'espace. Il tombe si vite dans l'air qu'il brûle et qu'il brille." } },
  { id: 'plants', pic: '🌱', en: { t: 'Plants', q: 'What does a plant need to grow?', g: [['🌦️', 'Sun and water'], ['🍕', 'Pizza']],
      a: 'A plant drinks water with its roots, and its leaves catch the sunlight. With light, water and air, it makes its own food!', y: 'Put a bean on wet cotton. Look at it every day, and draw what you see.' },
    fr: { t: 'Les plantes', q: 'De quoi une plante a-t-elle besoin pour pousser ?', g: [['🌦️', "De soleil et d'eau"], ['🍕', 'De pizza']],
      a: "Une plante boit l'eau avec ses racines, et ses feuilles attrapent la lumière du Soleil. Avec la lumière, l'eau et l'air, elle fabrique sa nourriture toute seule !", y: 'Pose un haricot sur du coton mouillé. Regarde-le chaque jour, et dessine ce que tu vois.' } },
  { id: 'galaxy', pic: '🌌', en: { t: 'Galaxies', q: 'What is a galaxy?', g: [['✨', 'A giant family of stars'], ['🍫', 'A chocolate bar']],
      a: 'A galaxy is a giant family of stars, turning slowly together. We live in a galaxy called the Milky Way. It has more stars than you could ever count!' },
    fr: { t: 'Les galaxies', q: "Qu'est-ce qu'une galaxie ?", g: [['✨', "Une famille géante d'étoiles"], ['🍫', 'Une tablette de chocolat']],
      a: "Une galaxie est une famille géante d'étoiles qui tournent lentement ensemble. Nous habitons dans une galaxie qui s'appelle la Voie lactée. Elle a plus d'étoiles qu'on ne pourra jamais en compter !" } },
  { id: 'magnet', pic: '🧲', en: { t: 'Magnets', q: 'What does a magnet pull?', g: [['📎', 'Things made of iron'], ['🪵', 'Things made of wood']],
      a: 'A magnet pulls things made of iron, like nails and paper clips. It does not pull wood, paper or plastic.', y: 'Take a fridge magnet and go hunting. What sticks to it? What does not?' },
    fr: { t: 'Les aimants', q: "Qu'est-ce qu'un aimant attire ?", g: [['📎', 'Les objets en fer'], ['🪵', 'Les objets en bois']],
      a: "Un aimant attire les objets en fer, comme les clous et les trombones. Il n'attire pas le bois, le papier ou le plastique.", y: "Prends un aimant du frigo et pars à la chasse. Qu'est-ce qui colle ? Qu'est-ce qui ne colle pas ?" } },
  { id: 'sleep', pic: '🧑‍🚀', en: { t: 'Astronauts', q: 'How do astronauts sleep in space?', g: [['🎒', 'In a bag tied to the wall'], ['🛏️', 'In a big bed']],
      a: 'In a spaceship, everything floats! So astronauts sleep in a sleeping bag tied to the wall. Without it, they would drift away while they dream.' },
    fr: { t: 'Les astronautes', q: "Comment dorment les astronautes dans l'espace ?", g: [['🎒', 'Dans un sac attaché au mur'], ['🛏️', 'Dans un grand lit']],
      a: "Dans un vaisseau spatial, tout flotte ! Alors les astronautes dorment dans un sac de couchage attaché au mur. Sinon, ils s'envoleraient en rêvant." } },
  { id: 'thunder', pic: '⚡', en: { t: 'Storms', q: 'In a storm, which comes first?', g: [['⚡', 'The flash of lightning'], ['🔊', 'The boom of thunder']],
      a: 'Lightning is a giant spark in the clouds. Thunder is the noise it makes. Light travels faster than sound, so you see the flash first.', y: 'Next storm, count the seconds between the flash and the boom.' },
    fr: { t: 'Les orages', q: "Pendant un orage, qu'est-ce qui arrive en premier ?", g: [['⚡', "L'éclair"], ['🔊', 'Le tonnerre']],
      a: "L'éclair est une étincelle géante dans les nuages. Le tonnerre, c'est le bruit qu'elle fait. La lumière va plus vite que le son, alors tu vois l'éclair en premier.", y: "Au prochain orage, compte les secondes entre l'éclair et le tonnerre." } },
  { id: 'blackhole', pic: '🌀', en: { t: 'Black holes', q: 'What is a black hole?', g: [['🌀', 'A place that pulls everything in'], ['🕳️', 'A hole in the ground']],
      a: 'A black hole pulls so hard that nothing can get out, not even light. That is why it looks black. Do not worry: black holes are very, very far from us!' },
    fr: { t: 'Les trous noirs', q: "Qu'est-ce qu'un trou noir ?", g: [['🌀', 'Un endroit qui attire tout'], ['🕳️', 'Un trou dans la terre']],
      a: "Un trou noir attire si fort que rien ne peut en sortir, même pas la lumière. C'est pour ça qu'il est noir. Pas de souci : les trous noirs sont très, très loin de nous !" } },
  { id: 'ice', pic: '🧊', en: { t: 'Ice', q: 'What is ice made of?', g: [['💧', 'Water'], ['🪨', 'Stone']],
      a: 'Ice is water that got very cold. When it warms up, it melts back into water. And when water gets very hot, it turns into steam and floats away!', y: 'Put an ice cube on a plate. How long does it take to melt?' },
    fr: { t: 'La glace', q: 'De quoi est faite la glace ?', g: [['💧', "D'eau"], ['🪨', 'De pierre']],
      a: "La glace, c'est de l'eau devenue très froide. Quand elle se réchauffe, elle fond et redevient de l'eau. Et quand l'eau devient très chaude, elle se change en vapeur et s'envole !", y: 'Pose un glaçon sur une assiette. Combien de temps met-il à fondre ?' } },
  { id: 'dino', pic: '🦕', en: { t: 'Dinosaurs', q: 'How do we know about dinosaurs?', g: [['🦴', 'We found their bones'], ['📷', 'We have photos of them']],
      a: 'Dinosaurs lived a very, very long time ago, long before people. We find their bones inside rocks. These very old bones are called fossils.' },
    fr: { t: 'Les dinosaures', q: 'Comment connaît-on les dinosaures ?', g: [['🦴', 'On a trouvé leurs os'], ['📷', 'On a des photos']],
      a: "Les dinosaures vivaient il y a très, très longtemps, bien avant les humains. On trouve leurs os dans les roches. Ces très vieux os s'appellent des fossiles." } },
  { id: 'heart', pic: '❤️', en: { t: 'Your heart', q: 'What does your heart do?', g: [['🩸', 'It pumps your blood'], ['💭', 'It does your thinking']],
      a: 'Your heart is a muscle about as big as your fist. It pumps blood all around your body, all day and all night, without ever stopping.', y: 'Put your hand on your chest. Now jump ten times. Is your heart beating faster?' },
    fr: { t: 'Ton cœur', q: 'À quoi sert ton cœur ?', g: [['🩸', 'Il pompe ton sang'], ['💭', 'Il réfléchit pour toi']],
      a: "Ton cœur est un muscle gros comme ton poing. Il pompe le sang dans tout ton corps, jour et nuit, sans jamais s'arrêter.", y: 'Pose ta main sur ta poitrine. Maintenant saute dix fois. Ton cœur bat-il plus vite ?' } },
];
function wonderCards() {
  return new Promise(resolve => {
    const deck = () => {
      clearIdle(); stopSpeech(); zone('sci'); musicMode('calm');
      const allRest = WONDER.every(w => sciToday('w:' + w.id)), firstNew = WONDER.find(w => !sciSeen('w:' + w.id));
      app.innerHTML = `<div class="screen sub sci library"><div class="topline"><button class="ic back">🏠</button><h2>💡 ${esc(actName('wonder'))}</h2><div style="width:64px"></div></div>
        <div class="shelf">${WONDER.map((w, i) => { const rest = !allRest && sciToday('w:' + w.id), seen = sciSeen('w:' + w.id);
          return `<button class="btn bookc ${rest ? 'st-rest' : ''} ${w === firstNew ? 'suggest' : ''}" data-w="${i}" style="--i:${i}"><span class="cov">${w.pic}</span><b>${esc(w[S.lang].t)}</b><i class="tag">${rest ? '💤' : seen ? '✅' : '✨'}</i></button>`; }).join('')}</div></div>`;
      $('.back').onclick = () => { stopSpeech(); resolve(null); }; exitCurrent = () => resolve(null);
      $$('[data-w]').forEach(el => el.onclick = async () => {
        if (el.classList.contains('st-rest')) { el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); sfx('tap'); return speak(L().disc.rest); }
        sfx('pop'); const r = await card(WONDER[+el.dataset.w]);
        if (r) resolve(true); else if (r === null) resolve(null); else deck();
      });
      speak(TSL().wonderSay);
    };
    const card = w => new Promise(res => {
      const c = w[S.lang], R = TSL(), opts = shuffle([0, 1]); let done = false, said = [];
      const fin = v => { if (done) return; done = true; stopSpeech(); clearIdle(); res(v); };
      const steps = c.y ? 3 : 2, light = k => $$('.wg').forEach((b, j) => b.classList.toggle('say', j === k));
      app.innerHTML = sciFrame('wonder', `<div class="wpic bob">${w.pic}</div><div class="wtext">${sciText(c.q)}</div>
        <div class="btnrow wrow">${opts.map(k => `<button class="btn wg" data-k="${k}"><span>${c.g[k][0]}</span><b>${esc(c.g[k][1])}</b></button>`).join('')}</div>`, steps, 0);
      const dots = n => $$('.dots i').forEach((d, j) => { d.className = j < n ? 'done' : j === n ? 'now' : ''; });
      const tell = (...t) => { said = t; return speak(...t); };
      $('.home').onclick = () => fin(null); exitCurrent = () => fin(null);
      $('.replay').onclick = () => { sfx('tap'); speak(...said); };
      $$('.wg').forEach(b => b.onclick = async () => {
        if ($('.wrow').classList.contains('chosen')) return;
        const right = b.dataset.k === '0'; $('.wrow').classList.add('chosen'); light(-1); b.classList.add('mine'); sfx('pop'); stopSpeech();
        await speak(right ? R.yes : R.letsSee); if (done) return;
        // find out: the real answer lights up, whatever she guessed
        $$('.wg').forEach(x => x.classList.toggle('real', x.dataset.k === '0')); $('.wtext').innerHTML = sciText(c.a); dots(1);
        $('.wrow').insertAdjacentHTML('afterend', `<div class="btnrow"><button class="btn primary huge nextb" aria-label="next">${c.y ? '▶' : '✅'}</button></div>`);
        const end = async () => { $('.nextb').disabled = true; sciMark('w:' + w.id); burstAt($('.wpic'), 50); await sciCheer(R.wonderDone); fin(true); };
        $('.nextb').onclick = () => {
          sfx('pop'); if (!c.y) return end();
          $('.wrow').remove(); $('.wtext').innerHTML = `<div class="scicard try"><b>📝 ${esc(R.tryIt)}</b>${esc(c.y)}</div>`; dots(2); $('.nextb').textContent = '✅'; $('.nextb').onclick = () => { sfx('pop'); end(); };
          tell(R.tryIt, { pause: 200 }, c.y);
        };
        setIdle(() => nudge([R.next])); tell(c.a);
      });
      setIdle(() => nudge(said));
      // the question, then the two ideas named one after the other while each lights up
      tell(c.q, { pause: 250 }, R.think, { pause: 150 }, { run: () => light(0) }, c.g[opts[0]][1], { run: () => light(-1) }, R.or, { run: () => light(1) }, c.g[opts[1]][1], { run: () => light(-1) });
    });
    deck();
  });
}
