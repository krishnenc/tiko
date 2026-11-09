// Tiko – learning content.
// Words are split into "units" (sounds in English, syllables/graphemes in French).
// A unit starting with "_" is a silent letter: shown in grey, not spoken.
'use strict';

const DATA = {
  en: {
    voiceLang: 'en-GB',
    // letter, sound (TTS approximation – parents can record their own), keyword, emoji
    letters: [
      ['a', 'aah', 'apple', '🍎'], ['b', 'buh', 'ball', '⚽'], ['c', 'kuh', 'cat', '🐱'],
      ['d', 'duh', 'dog', '🐶'], ['e', 'eh', 'egg', '🥚'], ['f', 'fff', 'fish', '🐟'],
      ['g', 'guh', 'goat', '🐐'], ['h', 'huh', 'hat', '🎩'], ['i', 'ih', 'insect', '🐜'],
      ['j', 'juh', 'juice', '🧃'], ['k', 'kuh', 'kite', '🪁'], ['l', 'lll', 'lion', '🦁'],
      ['m', 'mmm', 'moon', '🌙'], ['n', 'nnn', 'nose', '👃'], ['o', 'aw', 'octopus', '🐙'],
      ['p', 'puh', 'pig', '🐷'], ['q', 'kwuh', 'queen', '👸'], ['r', 'rrr', 'rabbit', '🐰'],
      ['s', 'sss', 'snake', '🐍'], ['t', 'tuh', 'tiger', '🐯'], ['u', 'uh', 'umbrella', '☂️'],
      ['v', 'vvv', 'van', '🚐'], ['w', 'wuh', 'watermelon', '🍉'], ['x', 'ks', 'box', '📦'],
      ['y', 'yuh', 'yo-yo', '🪀'], ['z', 'zzz', 'zebra', '🦓'],
    ],
    // extra sound units (digraphs) – used in words and in the parent recording list
    extraSounds: { sh: 'shh', ch: 'ch', th: 'th', ck: 'kuh', ll: 'lll', ng: 'ng', ee: 'ee', oo: 'oo', ar: 'ar',
      ay: 'ay', igh: 'eye', oa: 'oh', ue: 'you', or: 'or', ow: 'ow', oi: 'oy', er: 'er' },
    // words in teaching order: simple CVC first, then digraphs/blends
    words: [
      ['cat', 'c a t', '🐱'], ['sun', 's u n', '☀️'], ['dog', 'd o g', '🐶'], ['pig', 'p i g', '🐷'],
      ['hat', 'h a t', '🎩'], ['bus', 'b u s', '🚌'], ['bed', 'b e d', '🛏️'], ['fox', 'f o x', '🦊'],
      ['hen', 'h e n', '🐔'], ['cup', 'c u p', '🥤'], ['bat', 'b a t', '🦇'], ['map', 'm a p', '🗺️'],
      ['pen', 'p e n', '🖊️'], ['bug', 'b u g', '🐛'], ['box', 'b o x', '📦'], ['nut', 'n u t', '🥜'],
      ['web', 'w e b', '🕸️'], ['leg', 'l e g', '🦵'], ['van', 'v a n', '🚐'], ['rat', 'r a t', '🐀'],
      ['mug', 'm u g', '☕'], ['ten', 't e n', '🔟'], ['lip', 'l i p', '👄'], ['pan', 'p a n', '🍳'],
      ['net', 'n e t', '🥅'], ['tub', 't u b', '🛁'],
      ['fish', 'f i sh', '🐟'], ['ship', 'sh i p', '🚢'], ['duck', 'd u ck', '🦆'], ['sock', 's o ck', '🧦'],
      ['bell', 'b e ll', '🔔'], ['shell', 'sh e ll', '🐚'], ['chick', 'ch i ck', '🐤'], ['king', 'k i ng', '🤴'],
      ['ring', 'r i ng', '💍'], ['bee', 'b ee', '🐝'], ['tree', 't r ee', '🌳'], ['sheep', 'sh ee p', '🐑'],
      ['moon', 'm oo n', '🌙'], ['book', 'b oo k', '📖'], ['frog', 'f r o g', '🐸'], ['crab', 'c r a b', '🦀'],
      ['drum', 'd r u m', '🥁'], ['flag', 'f l a g', '🚩'], ['hand', 'h a n d', '✋'], ['milk', 'm i l k', '🥛'],
      ['tent', 't e n t', '⛺'], ['bath', 'b a th', '🛁'], ['car', 'c ar', '🚗'], ['star', 's t ar', '⭐'],
      // level 3: long vowels & vowel teams ("text:sound" — the tile shows the letters, plays the sound; _e = silent e)
      ['cake', 'c a:ay k _e', '🎂'], ['kite', 'k i:igh t _e', '🪁'], ['bike', 'b i:igh k _e', '🚲'], ['snake', 's n a:ay k _e', '🐍'],
      ['cube', 'c u:ue b _e', '🧊'], ['bone', 'b o:oa n _e', '🦴'], ['rain', 'r ai:ay n', '🌧️'], ['snail', 's n ai:ay l', '🐌'],
      ['train', 't r ai:ay n', '🚂'], ['boat', 'b oa t', '⛵'], ['goat', 'g oa t', '🐐'], ['coat', 'c oa t', '🧥'],
      ['queen', 'qu:q ee n', '👸'], ['corn', 'c or n', '🌽'], ['fork', 'f or k', '🍴'], ['horse', 'h or s _e', '🐴'],
      ['cow', 'c ow', '🐄'], ['owl', 'ow l', '🦉'], ['coin', 'c oi n', '🪙'], ['night', 'n igh t', '🌃'], ['light', 'l igh t', '💡'],
      // level 4: two-syllable words
      ['rabbit', 'r a bb:b i t', '🐰'], ['robot', 'r o:oa b o t', '🤖'], ['lemon', 'l e m o:u n', '🍋'], ['pencil', 'p e n c:s i l', '✏️'],
      ['rocket', 'r o ck e t', '🚀'], ['carrot', 'c a rr:r o:u t', '🥕'], ['picnic', 'p i c n i c', '🧺'], ['hotdog', 'h o t d o g', '🌭'],
      ['laptop', 'l a p t o p', '💻'], ['pumpkin', 'p u m p k i n', '🎃'], ['sandwich', 's a n d w i ch', '🥪'], ['muffin', 'm u ff:f i n', '🧁'],
      ['tiger', 't i:igh g er', '🐯'], ['spider', 's p i:igh d er', '🕷️'], ['monster', 'm o n s t er', '👾'], ['button', 'b u tt:t o:u n', '🔘'],
      ['sunflower', 's u n f l ow er', '🌻'], ['rainbow', 'r ai:ay n b ow:oa', '🌈'], ['snowman', 's n ow:oa m a n', '⛄'],
    ],
    tiers: [26, 50, 71, 90],   // end of each difficulty level in the list above
    sight: ['I', 'a', 'the', 'and', 'is', 'it', 'in', 'to', 'you', 'my', 'we', 'see', 'go', 'he', 'she',
      'me', 'can', 'like', 'look', 'up', 'no', 'yes', 'said', 'was', 'are', 'for', 'on', 'at', 'big',
      'little', 'here', 'come', 'play', 'this', 'they', 'have', 'do', 'of', 'all', 'with'],
  },

  fr: {
    voiceLang: 'fr-FR',
    letters: [
      ['a', 'a', 'avion', '✈️'], ['b', 'beu', 'ballon', '🎈'], ['c', 'keu', 'canard', '🦆'],
      ['d', 'deu', 'dinosaure', '🦕'], ['e', 'eu', 'cheval', '🐴'], ['é', 'é', 'éléphant', '🐘'],
      ['f', 'ffff', 'fusée', '🚀'], ['g', 'gueu', 'gâteau', '🎂'], ['i', 'i', 'île', '🏝️'],
      ['j', 'jjjj', 'jus', '🧃'], ['k', 'keu', 'kiwi', '🥝'], ['l', 'llll', 'lune', '🌙'],
      ['m', 'mmmm', 'maison', '🏠'], ['n', 'nnnn', 'nuage', '☁️'], ['o', 'o', 'orange', '🍊'],
      ['p', 'peu', 'pomme', '🍎'], ['q', 'keu', 'quille', '🎳'], ['r', 'rrrr', 'renard', '🦊'],
      ['s', 'ssss', 'serpent', '🐍'], ['t', 'teu', 'tortue', '🐢'], ['u', 'u', 'usine', '🏭'],
      ['v', 'vvvv', 'vélo', '🚲'], ['z', 'zzzz', 'zèbre', '🦓'],
    ],
    extraSounds: { ou: 'ou', on: 'on', an: 'an', in: 'in', oi: 'oi', ch: 'chhh', eau: 'o', au: 'o', 'è': 'è' },
    // syllable method: simple open syllables first, then ou/on/an/ch/eau and silent letters
    words: [
      ['papa', 'pa pa', '👨'], ['moto', 'mo to', '🏍️'], ['vélo', 'vé lo', '🚲'], ['lune', 'lu ne', '🌙'],
      ['lama', 'la ma', '🦙'], ['kiwi', 'ki wi', '🥝'], ['bébé', 'bé bé', '👶'], ['judo', 'ju do', '🥋'],
      ['café', 'ca fé', '☕'], ['robe', 'ro be', '👗'], ['tomate', 'to ma te', '🍅'], ['salade', 'sa la de', '🥗'],
      ['tulipe', 'tu li pe', '🌷'], ['pirate', 'pi ra te', '🏴‍☠️'], ['canapé', 'ca na pé', '🛋️'],
      ['ananas', 'a na nas', '🍍'], ['piano', 'pi a no', '🎹'], ['radio', 'ra di o', '📻'],
      ['vache', 'va che', '🐄'], ['chat', 'cha _t', '🐱'], ['loup', 'lou _p', '🐺'], ['poule', 'pou le', '🐔'],
      ['mouton', 'mou ton', '🐑'], ['lapin', 'la pin', '🐰'], ['cheval', 'che val', '🐴'], ['banane', 'ba na ne', '🍌'],
      ['melon', 'me lon', '🍈'], ['lion', 'li on', '🦁'], ['pomme', 'pom me', '🍎'], ['robot', 'ro bo _t', '🤖'],
      ['souris', 'sou ri _s', '🐭'], ['bateau', 'ba teau', '🚢'], ['gâteau', 'gâ teau', '🎂'], ['cadeau', 'ca deau', '🎁'],
      ['citron', 'ci tron', '🍋'], ['avion', 'a vion', '✈️'], ['maison', 'mai son', '🏠'], ['poisson', 'poi sson', '🐟'],
      ['fourmi', 'four mi', '🐜'], ['oiseau', 'oi seau', '🐦'], ['chocolat', 'cho co la _t', '🍫'], ['chien', 'chien', '🐶'],
      // niveau 3 : sons complexes et mots longs
      ['papillon', 'pa pi llon', '🦋'], ['grenouille', 'gre nouille', '🐸'], ['fraise', 'frai se', '🍓'], ['montagne', 'mon ta gne', '⛰️'],
      ['étoile', 'é toi le', '⭐'], ['pingouin', 'pin gouin', '🐧'], ['crocodile', 'cro co di le', '🐊'], ['citrouille', 'ci trouille', '🎃'],
      ['tortue', 'tor tue', '🐢'], ['fromage', 'fro ma ge', '🧀'], ['voiture', 'voi tu re', '🚗'], ['girafe', 'gi ra fe', '🦒'],
      ['baleine', 'ba lei ne', '🐋'], ['dauphin', 'dau phin', '🐬'], ['requin', 're quin', '🦈'], ['camion', 'ca mion', '🚚'],
      ['chameau', 'cha meau', '🐫'], ['abeille', 'a beille', '🐝'], ['soleil', 'so leil', '☀️'], ['parapluie', 'pa ra pluie', '☂️'],
      ['éléphant', 'é lé phant', '🐘'], ['escargot', 'es car go _t', '🐌'],
    ],
    tiers: [18, 42, 64, 64],
    sight: ['je', 'tu', 'il', 'elle', 'on', 'un', 'une', 'le', 'la', 'les', 'et', 'est', 'a', 'de', 'des',
      'mon', 'ma', 'dans', 'sur', 'avec', 'oui', 'non', "c'est", 'pas', 'petit', 'grand', 'voici', 'moi',
      'papa', 'maman'],
  },
};

// How many of the words (from the start of the list) are "simple" – the rest need digraphs etc.
DATA.en.simpleWords = 26;
DATA.fr.simpleWords = 18;
// French grammatical gender (feminine words); everything else is masculine
const FR_FEM = new Set(['radio', 'lune', 'moto', 'tomate', 'salade', 'tulipe', 'robe', 'vache', 'poule', 'banane', 'pomme', 'souris', 'maison', 'fourmi',
  'grenouille', 'fraise', 'montagne', 'étoile', 'citrouille', 'tortue', 'voiture', 'girafe', 'baleine', 'abeille']);
const aan = w => /^[aeiou]/.test(w) ? 'an' : 'a';   // a cat, an owl
const frUn = w => FR_FEM.has(w) ? 'une' : 'un';
const frLe = w => /^[aeiouéèêh]/.test(w) ? "l'" : FR_FEM.has(w) ? 'la ' : 'le ';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const frCol = c => /^[aeiou]/.test(c) ? "l'" + c : 'le ' + c;   // le rouge, l'orange

// Sentences & tiny stories, built from words she has already met.
const SENTENCES = {
  en: [w => `I see ${aan(w)} ${w}.`, w => `The ${w} is big.`, w => `I like the ${w}.`, w => `Look at the ${w}!`,
    w => `Here is my ${w}.`, w => `Can you see the ${w}?`, w => `It is ${aan(w)} ${w}.`],
  fr: [w => `Je vois ${frUn(w)} ${w}.`, w => `Voici ${frUn(w)} ${w}.`, w => `J'aime ${frLe(w)}${w}.`,
    w => `Il y a ${frUn(w)} ${w}.`, w => `Regarde ${frLe(w)}${w} !`, w => `C'est ${frUn(w)} ${w}.`],
};
// harder sentences (later on the journey): two things to read — answered with a pair of pictures
const SENTENCES2 = {
  en: [(a, b) => `I can see ${aan(a)} ${a} and ${aan(b)} ${b}.`, (a, b) => `The ${a} is next to the ${b}.`,
    (a, b) => `Look at the ${a} and the ${b}!`, (a, b) => `My ${a} is bigger than my ${b}.`],
  fr: [(a, b) => `Je vois ${frUn(a)} ${a} et ${frUn(b)} ${b}.`, (a, b) => `Il y a ${frUn(a)} ${a} et ${frUn(b)} ${b}.`,
    (a, b) => `Regarde ${frLe(a)}${a} et ${frLe(b)}${b} !`, (a, b) => `J'aime ${frLe(a)}${a} et ${frLe(b)}${b}.`],
};
// each story: (A, B) => { lines, q, answer: 'A'|'B' }
const STORIES = {
  en: [
    (A, B) => ({ lines: [`I see ${aan(A)} ${A}.`, `The ${A} can see ${aan(B)} ${B}.`, `The ${B} is big.`, `Look at the ${A} and the ${B}!`], q: `What can the ${A} see?`, answer: 'B' }),
    (A, B) => ({ lines: [`I have ${aan(A)} ${A}.`, `I have ${aan(B)} ${B} too.`, `The ${A} is little.`, `I like my ${B}!`], q: 'What is little?', answer: 'A' }),
    (A, B) => ({ lines: [`Here is ${aan(A)} ${A}.`, `The ${A} is on ${aan(B)} ${B}.`, `Is it a big ${B}?`, `Yes! It is big.`], q: `The ${A} is on a…?`, answer: 'B' }),
  ],
  fr: [
    (A, B) => ({ lines: [`Je vois ${frUn(A)} ${A}.`, `${cap(frLe(A))}${A} voit ${frUn(B)} ${B}.`, `Regarde ${frLe(A)}${A} et ${frLe(B)}${B} !`], q: `Qu'est-ce que ${frLe(A)}${A} voit ?`, answer: 'B' }),
    (A, B) => ({ lines: [`J'ai ${frUn(A)} ${A}.`, `J'ai aussi ${frUn(B)} ${B}.`, `J'aime ${frLe(B)}${B} !`], q: "Qu'est-ce que j'aime ?", answer: 'B' }),
    (A, B) => ({ lines: [`Voici ${frUn(A)} ${A}.`, `${cap(frLe(A))}${A} est sur ${frUn(B)} ${B}.`, 'Oh ! Comme c\'est drôle !'], q: `Qui est sur ${frLe(B)}${B} ?`, answer: 'A' }),
  ],
};

// Normalise into objects
for (const lang of Object.keys(DATA)) {
  const d = DATA[lang];
  d.letters = d.letters.map(([l, s, k, e]) => ({ id: l, l, s, k, e }));
  d.words = d.words.map(([w, u, e]) => ({ id: w, w, units: u.split(' '), e }));
  d.sight = d.sight.map(w => ({ id: w, w }));
  d.sounds = Object.assign({}, d.extraSounds);
  for (const x of d.letters) d.sounds[x.l] = x.s;
  d.recordable = [...d.letters.map(x => x.l), ...Object.keys(d.extraSounds)];
  // every syllable/part the words use (French: the syllables), so a parent can hear and re-record any of them
  d.syllables = [...new Set(d.words.flatMap(w => w.units).filter(u => !u.startsWith('_')).map(u => u.includes(':') ? u.split(':')[1] : u))];
}

// Built-in pure phonics sound clips in sounds/<lang>-<unit>.wav (generated from IPA, see tools/).
// French vowels and syllables are read well by the French voice, so only consonants have clips.
const SOUND_CLIPS = {
  en: ['a', 'ar', 'b', 'c', 'ch', 'ck', 'd', 'e', 'ee', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'll', 'm', 'n', 'ng', 'o', 'oo',
    'p', 'q', 'r', 's', 'sh', 't', 'th', 'u', 'v', 'w', 'x', 'y', 'z', 'ay', 'igh', 'oa', 'ue', 'or', 'ow', 'oi', 'er'],
  fr: ['b', 'c', 'ch', 'd', 'f', 'g', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 's', 't', 'v', 'z'],
};
// How the French VOICE should say a syllable on its own. The child still SEES the normal spelling; this is only
// what's spoken. Fixes syllables that voices misread alone (spelled out, wrong vowel, silent letters, "eau", "ill"...).
const FR_SAY = {
  be: 'beu', pe: 'peu', ge: 'jeu', re: 'reu', fe: 'feu', gre: 'greu', che: 'cheu', gne: 'gneu',
  wi: 'oui', nas: 'nasse', gi: 'ji', es: 'esse', pom: 'pomme',
  teau: 'tô', deau: 'dô', seau: 'sô', meau: 'mô', dau: 'dô',
  sson: 'son', llon: 'lon', mai: 'mè', frai: 'frè', lei: 'lè', leil: 'lèye', beille: 'bèye', nouille: 'nouye', trouille: 'trouye',
  poi: 'pwa', voi: 'vwa', oi: 'wa', quin: 'kin', phin: 'fin', phant: 'fan',
};
for (const [k, v] of Object.entries(FR_SAY)) if (!DATA.fr.sounds[k] || DATA.fr.sounds[k] === k) DATA.fr.sounds[k] = v;

// a word part is "text" or "text:sound" (tile shows text, plays sound); "_x" = silent letter
const unitText = u => u.replace(/^_/, '').split(':')[0];
const unitSound = u => u.includes(':') ? u.split(':')[1] : u;

const OBJECTS = ['🍎', '🍓', '⭐', '🐟', '🎈', '🐞', '🍪', '🚗', '🌸', '⚽', '🦆', '🍌'];
const STICKERS = ['🦄', '🐶', '🐱', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐢', '🐙', '🦋', '🐞', '🐝',
  '🦖', '🐳', '🐬', '🦀', '🐠', '🦒', '🐘', '🦔', '🌈', '⭐', '🍓', '🍩', '🚀', '🎈', '🌻', '🍦', '🐰', '🦜', '🐹', '🌙'];

const T = {
  en: {
    start: 'Start', reading: 'Reading', maths: 'Maths', stickers: 'My stickers', parents: 'Parents',
    go: "Let's go!", next: 'Next', home: 'Home', iDidIt: 'I did it!',
    praise: ['Woohoo! Great job!', 'Yes! You got it!', 'Wow! Super!', 'Yay! Well done!', 'High five!', 'Brilliant!',
      "You're a superstar!", 'Amazing!', 'Hooray!', 'Fantastic!', 'Ooh, so clever!', 'Yippee!', 'Wow, look at you go!', 'Awesome!'],
    retry: 'Try again.', itsThis: "It's this one.",
    gotSticker: 'You got a sticker!', allDone: 'All done! You are amazing!',
    breakTitle: 'Move break!', pathTitle: 'My path',
    acts: {
      letters: 'Letter sounds', sight: 'Magic words', blend: 'Blend it', spell: 'Build a word',
      count: 'Count', add: 'Add', sub: 'Take away', bonds: 'Make 10', next: 'What comes next?', compare: 'More or less',
    },
    q: {
      letter: 'Which letter says', like: 'like', findWord: 'Find the word', newWord: 'This word is', tapIt: 'Tap it!', tapItL: 'Tap it!',
      blend: 'Tap the sounds. Then slide your finger along the arrow!', blendBtn: 'Blend', whichPic: 'Which picture is it?',
      spell: 'Build the word', howMany: 'How many?', plus: 'plus', minus: 'take away', equals: 'is',
      makeTo: n => `How many more to make ${n}?`, after: n => `What comes after ${n}?`, before: n => `What comes before ${n}?`,
      moreGroup: 'Which has more?', bigger: 'Which number is bigger?',
    },
    paper: {
      writeLetter: l => `Get your pencil! Write the letter ${l} three times on your paper.`,
      writeWord: w => `Get your pencil! Write the word ${w} on your paper.`,
      drawWord: 'Read this word. Then draw it on your paper!',
      wasIt: 'It was',
      writeNums: (a, b) => `Write the numbers from ${a} to ${b} on your paper.`,
      drawAdd: (a, b) => `Draw ${a} circles. Then draw ${b} more circles. How many altogether?`,
      drawSub: (a, b) => `Draw ${a} circles. Cross out ${b}. How many are left?`,
      drawShapes: (a, b) => `Draw a ${a} and a ${b} on your paper. Colour them in!`,
      drawPattern: 'Copy this pattern on your paper. Then draw what comes next, two times!',
      trace: 'Trace it with your finger!', nowPaper: 'Now write it three times on your paper!',
      done: 'Done!', photo: 'Show Tiko', photoThanks: 'Wow! Tiko loves it!', answer: 'What did you get?',
      myWork: 'My work', clear: 'Again',
    },
    newLetter: 'This letter says',
    read: { find: 'Read it. Then find the picture!', help: 'Help', iRead: 'I read it!', story: 'Read the story.',
      yourTurn: 'Your turn!', journey: 'My journey', unlocked: 'You reached a new place!', next: 'Next stop',
      go: "Let's go!", locked: 'Keep going to unlock it!' },
    m: {
      shapes: { circle: 'circle', square: 'square', triangle: 'triangle', rectangle: 'rectangle', star: 'star', heart: 'heart',
        oval: 'oval', diamond: 'diamond', pentagon: 'pentagon', hexagon: 'hexagon' },
      findShape: s => `Find the ${s}!`, sides: 'How many sides?', sidesAns: (s, n) => `A ${s} has ${n} sides.`,
      nextPattern: 'What comes next?',
      whatTime: 'What time is it?', oclock: h => `${h} o'clock`, half: h => `half past ${h}`, quarter: h => `quarter past ${h}`,
      double: n => `Double ${n}!`, doubleAns: (n) => `${n} plus ${n} is ${n * 2}.`,
      missingAdd: (a, s) => `${a} plus what makes ${s}?`, missingSub: (a, r) => `${a} take away what leaves ${r}?`,
      frog: k => `The frog jumps by ${k}. Where does it land next?`, frogBack: 'The frog jumps back by 1. Where does it land?',
      tens: 'How many? Count the tens, then the ones.',
      longer: 'Which one is longer?', shorter: 'Which one is shorter?', blocks: 'How many blocks long?',
      flash: 'Look quickly! How many dots?', seeAgain: 'Look again',
      pop: n => `Pop all the ${n}s!`, popTen: 'Pop the bubbles that make 10!',
      storyAdd: (n, a, b) => [`Tiko has ${a} ${n}.`, `He finds ${b} more.`, `How many ${n} now?`],
      storySub: (n, a, b, verb) => [`There are ${a} ${n}.`, `${b} ${verb}.`, `How many are left?`],
      things: [['apples', '🍎'], ['stars', '⭐'], ['fish', '🐟'], ['cookies', '🍪'], ['flowers', '🌸']],
      away: [['balloons', '🎈', 'fly away'], ['cookies', '🍪', 'get eaten'], ['birds', '🐦', 'fly away'], ['ducks', '🦆', 'swim away']],
    },
    thinkName: 'Thinking',
    th: { ready: "I'm ready!", peek: 'Peek', memoryGo: 'Now find the pairs!', memory: 'Look carefully! Tap "I\'m ready" when you remember them.', simonWatch: 'Watch and listen!', simonYou: 'Your turn! Copy me.',
      simonAgain: "Oops! Let's watch again.", showAgain: 'Show me again', kimLook: 'Look carefully! Remember them all. Tap "I\'m ready" when you know them.', kimQ: "What's missing?",
      odd: 'Which one does not belong?', oddWhy: c => `The others are all ${c}.`, jigsaw: 'Tap two pieces to swap them. Make the picture!',
      cats: { animals: 'animals', fruit: 'fruit', vehicles: 'vehicles', clothes: 'clothes', weather: 'weather', red: 'red', yellow: 'yellow' } },
    c: { addSay: (a, b) => `${a}, and ${b} more. Put them together!`, together: 'Put together', countAll: 'Now count them all. Tick each one!',
      subSay: (a, b) => b === 1 ? `There are ${a}. Take 1 away! Tap 1 to take it away.` : `There are ${a}. Take ${b} away! Tap ${b} to take them away.`, takeLeft: 'Take away', countLeft: 'Now count what is left. Tick each one!',
      watch: 'Watch me first!', myTurn: 'My turn!', addRule: (a, b, s) => `${a}, and ${b} more, makes ${s}!`, subRule: (a, b, r) => `${a}, take away ${b}, leaves ${r}!`,
      tooMany: 'That is enough! Now count what is left.',
      hopAdd: (a, b) => `The frog starts on ${a}. Tap the frog to hop ${b} times forward!`,
      hopSub: (a, b) => `The frog starts on ${a}. Tap the frog to hop ${b} times back!`, landed: 'Where did the frog land?' },
    bl: { robot: 'Robot Tiko talks in sounds. Listen! Which picture is it?', sayFast: 'Listen again, faster!',
      family: 'Word family!', familyIntro: 'This word family ends in', slideNow: 'Now slide to blend!', findSyl: 'Find' },
    tr: { word: 'Listen. Then trace the word!', sentence: 'Listen. Then trace the sentence, one word at a time!',
      nowWord: 'Now write the word on your paper!', nowSentence: 'Now write the sentence on your paper!' },
    artName: 'Art',
    art: {
      paintTitle: 'Paint!', mirrorTitle: 'Magic mirror', paintSay: 'Draw anything you like! Tap a colour to change it.',
      mirrorSay: 'Paint on one side. Watch the magic mirror!', readDraw: 'Read the word. Then draw it!', itWas: 'It was',
      done: 'Finished!', clearAgain: 'Tap again to clear everything.', saved: 'I love it! I put it in your gallery.',
      cbnSay: 'Pick a colour. Then colour the parts with the same number!', thisIs: (n, c) => `This part is number ${n}. ${c}!`,
      cbnDone: 'Beautiful colouring!', mixQ: (a, b) => `What colour do ${a} and ${b} make?`, mixAns: (a, b, c) => `${a} and ${b} make ${c}!`,
      musicSay: 'Tap the bars to make music!', followSay: 'Follow the shining bar!', songDone: 'You played the whole song!', free: 'Free play',
      colours: { red: 'red', yellow: 'yellow', blue: 'blue', orange: 'orange', green: 'green', purple: 'purple', pink: 'pink',
        white: 'white', black: 'black', grey: 'grey', lightblue: 'light blue', brown: 'brown' },
      songs: { twinkle: 'Twinkle Twinkle', frere: 'Brother John', mary: 'Mary had a little lamb', lune: 'Au clair de la lune' },
    },
    hi: { letsPlay: "Let's play!", morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
      happy: "I'm so happy to see you! Let's have fun!", tapStart: 'Tap the big Start button!', streak: n => `That's ${n} days in a row!`, combo: n => `${n} in a row!`, there: '' },
    lvl: { up: 'Level up!', now: (name, n) => `${name}: level ${n}!` },
    aw: { newBadge: 'New badge!', badges: 'Badges', goalReached: 'You did it! You earned:', tellGrownUp: 'Show a grown-up!' },
    journey: ['Sound Island', 'Blending Bridge', 'Magic Word Forest', 'Tricky Sound Mountain', 'Sentence River', 'Long Vowel Lagoon', 'Story Castle', 'Big Word Peak'],
    sheet: { title: 'My worksheet', name: 'Name', date: 'Date', trace: 'Trace and write', read: 'Read and draw',
      sums: 'Work it out', line: 'Fill in the numbers' },
    moves: ['Jump 5 times!', 'Touch your toes!', 'Stretch up high like a tree!', 'Spin around slowly!',
      'Wiggle like a worm!', 'Stand on one leg!', 'Clap 10 times!', 'March on the spot!', 'Take 3 big breaths.'],
  },
  fr: {
    start: 'Commencer', reading: 'Lecture', maths: 'Maths', stickers: 'Mes autocollants', parents: 'Parents',
    go: "C'est parti !", next: 'Suivant', home: 'Accueil', iDidIt: "J'ai réussi !",
    praise: ['Bravo !', 'Super !', 'Oui, bien joué !', 'Youpi !', 'Génial !', 'Waouh, excellent !', 'Tope là !',
      'Tu es une championne !', 'Hourra !', 'Fantastique !', 'Trop fort !', 'Magnifique !', 'Tu assures !'],
    retry: 'Essaie encore.', itsThis: "C'est celui-là.",
    gotSticker: 'Tu as gagné un autocollant !', allDone: 'Fini ! Tu es formidable !',
    breakTitle: 'On bouge !', pathTitle: 'Mon chemin',
    acts: {
      letters: 'Les sons', sight: 'Mots magiques', blend: 'Assemble', spell: 'Construis le mot',
      count: 'Compter', add: 'Additionner', sub: 'Enlever', bonds: 'Faire 10', next: 'Et après ?', compare: 'Plus ou moins',
    },
    q: {
      letter: 'Quelle lettre fait', like: 'comme', findWord: 'Trouve le mot', newWord: 'Ce mot, c\'est', tapIt: 'Touche-le !', tapItL: 'Touche-la !',
      blend: 'Touche les sons. Puis glisse ton doigt sur la flèche !', blendBtn: 'Assemble', whichPic: "Quelle image est-ce ?",
      spell: 'Construis le mot', howMany: 'Combien ?', plus: 'plus', minus: 'moins', equals: 'égale',
      makeTo: n => `Combien il en manque pour faire ${n} ?`, after: n => `Qu'est-ce qui vient après ${n} ?`,
      before: n => `Qu'est-ce qui vient avant ${n} ?`, moreGroup: 'Où y en a-t-il le plus ?', bigger: 'Quel nombre est le plus grand ?',
    },
    paper: {
      writeLetter: l => `Prends ton crayon ! Écris la lettre ${l} trois fois sur ta feuille.`,
      writeWord: w => `Prends ton crayon ! Écris le mot ${w} sur ta feuille.`,
      drawWord: 'Lis ce mot. Puis dessine-le sur ta feuille !',
      wasIt: "C'était",
      writeNums: (a, b) => `Écris les nombres de ${a} à ${b} sur ta feuille.`,
      drawAdd: (a, b) => `Dessine ${a} ronds. Puis dessine ${b} ronds de plus. Combien en tout ?`,
      drawSub: (a, b) => `Dessine ${a} ronds. Barre-en ${b}. Combien en reste-t-il ?`,
      drawShapes: (a, b) => `Dessine ${a} et ${b} sur ta feuille. Colorie-les !`,
      drawPattern: 'Recopie ce motif sur ta feuille. Puis dessine la suite, deux fois !',
      trace: 'Suis le tracé avec ton doigt !', nowPaper: 'Maintenant, à toi ! Recopie-le trois fois sur ta feuille.',
      done: 'Fini !', photo: 'Montre à Tiko', photoThanks: 'Waouh ! Tiko adore !', answer: "Qu'est-ce que tu as trouvé ?",
      myWork: 'Mon travail', clear: 'Encore',
    },
    newLetter: 'Cette lettre fait',
    read: { find: "Lis la phrase. Puis trouve l'image !", help: 'Aide', iRead: "J'ai lu !", story: "Lis l'histoire.",
      yourTurn: 'À toi !', journey: 'Mon voyage', unlocked: 'Tu as atteint un nouveau lieu !', next: 'Prochaine étape',
      go: "C'est parti !", locked: 'Continue pour le débloquer !' },
    m: {
      shapes: { circle: 'le cercle', square: 'le carré', triangle: 'le triangle', rectangle: 'le rectangle', star: "l'étoile",
        heart: 'le cœur', oval: "l'ovale", diamond: 'le losange', pentagon: 'le pentagone', hexagon: "l'hexagone" },
      findShape: s => `Trouve ${s} !`, sides: 'Combien de côtés ?', sidesAns: (s, n) => `${cap(s)} a ${n} côtés.`,
      nextPattern: "Qu'est-ce qui vient ensuite ?",
      whatTime: 'Quelle heure est-il ?', oclock: h => `${h} heure${h > 1 ? 's' : ''}`, half: h => `${h} heure${h > 1 ? 's' : ''} et demie`,
      quarter: h => `${h} heure${h > 1 ? 's' : ''} et quart`,
      double: n => `Le double de ${n} !`, doubleAns: n => `${n} plus ${n} égale ${n * 2}.`,
      missingAdd: (a, s) => `${a} plus combien font ${s} ?`, missingSub: (a, r) => `${a} moins combien font ${r} ?`,
      frog: k => `La grenouille saute de ${k} en ${k}. Où arrive-t-elle ?`, frogBack: 'La grenouille recule de 1. Où arrive-t-elle ?',
      tens: 'Combien ? Compte les dizaines, puis les unités.',
      longer: 'Lequel est le plus long ?', shorter: 'Lequel est le plus court ?', blocks: 'Ça mesure combien de cubes ?',
      flash: 'Regarde vite ! Combien de points ?', seeAgain: 'Revoir',
      pop: n => `Éclate tous les ${n} !`, popTen: 'Éclate les bulles qui font 10 !',
      storyAdd: (n, a, b) => [`Tiko a ${a} ${n}.`, `Il en trouve ${b} de plus.`, `Combien de ${n} a-t-il maintenant ?`],
      storySub: (n, a, b, verb) => [`Il y a ${a} ${n}.`, `${b} ${verb}.`, `Combien en reste-t-il ?`],
      things: [['pommes', '🍎'], ['étoiles', '⭐'], ['poissons', '🐟'], ['biscuits', '🍪'], ['fleurs', '🌸']],
      away: [['ballons', '🎈', "s'envolent"], ['biscuits', '🍪', 'sont mangés'], ['oiseaux', '🐦', "s'envolent"], ['canards', '🦆', "s'en vont à la nage"]],
    },
    thinkName: 'Réflexion',
    th: { ready: 'Je suis prête !', peek: 'Regarder', memoryGo: 'Maintenant, trouve les paires !', memory: 'Regarde bien ! Touche « Je suis prête » quand tu les as retenues.', simonWatch: 'Regarde et écoute !', simonYou: 'À toi ! Imite-moi.',
      simonAgain: 'Oups ! On regarde encore.', showAgain: 'Montre encore', kimLook: 'Regarde bien ! Retiens-les tous. Touche « Je suis prête » quand tu les connais.', kimQ: "Qu'est-ce qui manque ?",
      odd: "Lequel n'est pas comme les autres ?", oddWhy: c => `Les autres, ce sont ${c}.`, jigsaw: 'Touche deux pièces pour les échanger. Fais le dessin !',
      cats: { animals: 'des animaux', fruit: 'des fruits', vehicles: 'des véhicules', clothes: 'des vêtements', weather: 'des choses de la météo', red: 'des choses rouges', yellow: 'des choses jaunes' } },
    c: { addSay: (a, b) => `${a}, et encore ${b}. Mets-les ensemble !`, together: 'Mettre ensemble', countAll: 'Maintenant, compte-les tous. Coche-les un par un !',
      subSay: (a, b) => b === 1 ? `Il y en a ${a}. Enlèves-en 1 ! Touche-en 1 pour l'enlever.` : `Il y en a ${a}. Enlèves-en ${b} ! Touche-en ${b} pour les enlever.`, takeLeft: 'Enlève', countLeft: 'Maintenant, compte ce qui reste. Coche-les un par un !',
      watch: "Regarde-moi d'abord !", myTurn: 'À moi !', addRule: (a, b, s) => `${a}, et encore ${b}, ça fait ${s} !`, subRule: (a, b, r) => `${a}, moins ${b}, il en reste ${r} !`,
      tooMany: "C'est assez ! Maintenant, compte ce qui reste.",
      hopAdd: (a, b) => `La grenouille part du ${a}. Touche-la pour sauter ${b} fois en avant !`,
      hopSub: (a, b) => `La grenouille part du ${a}. Touche-la pour sauter ${b} fois en arrière !`, landed: 'Où est arrivée la grenouille ?' },
    bl: { robot: 'Robot Tiko parle en sons. Écoute ! Quelle image est-ce ?', sayFast: 'Écoute encore, plus vite !',
      family: 'Les syllabes !', familyIntro: 'Cette famille finit par', slideNow: 'Maintenant, glisse pour assembler !', findSyl: 'Trouve' },
    tr: { word: 'Écoute. Puis suis le mot avec ton doigt !', sentence: 'Écoute. Puis suis la phrase, un mot à la fois !',
      nowWord: 'Maintenant, écris le mot sur ta feuille !', nowSentence: 'Maintenant, écris la phrase sur ta feuille !' },
    artName: 'Arts',
    art: {
      paintTitle: 'Peinture !', mirrorTitle: 'Miroir magique', paintSay: 'Dessine ce que tu veux ! Touche une couleur pour changer.',
      mirrorSay: "Peins d'un côté. Regarde le miroir magique !", readDraw: 'Lis le mot. Puis dessine-le !', itWas: "C'était",
      done: 'Fini !', clearAgain: 'Touche encore pour tout effacer.', saved: "J'adore ! Je l'ai rangé dans ta galerie.",
      cbnSay: 'Choisis une couleur. Puis colorie les parties avec le même numéro !', thisIs: (n, c) => `Cette partie, c'est le numéro ${n}. ${cap(c)} !`,
      cbnDone: 'Magnifique coloriage !',
      mixQ: (a, b) => `Quelle couleur font ${frCol(a)} et ${frCol(b)} ?`, mixAns: (a, b, c) => `${cap(frCol(a))} et ${frCol(b)} font ${/^[aeiou]/.test(c) ? "de l'" + c : 'du ' + c} !`,
      musicSay: 'Touche les barres pour faire de la musique !', followSay: 'Suis la barre qui brille !', songDone: 'Tu as joué toute la chanson !', free: 'Jeu libre',
      colours: { red: 'rouge', yellow: 'jaune', blue: 'bleu', orange: 'orange', green: 'vert', purple: 'violet', pink: 'rose',
        white: 'blanc', black: 'noir', grey: 'gris', lightblue: 'bleu clair', brown: 'marron' },
      songs: { twinkle: 'Ah ! vous dirai-je maman', frere: 'Frère Jacques', mary: 'Marie avait un agneau', lune: 'Au clair de la lune' },
    },
    hi: { letsPlay: 'On joue !', morning: 'Bonjour', afternoon: 'Bonjour', evening: 'Bonsoir',
      happy: 'Je suis trop content de te voir ! On va bien s\'amuser !', tapStart: 'Appuie sur le gros bouton Commencer !', streak: n => `${n} jours de suite, bravo !`, combo: n => `${n} d'affilée !`, there: '' },
    lvl: { up: 'Niveau supérieur !', now: (name, n) => `${name} : niveau ${n} !` },
    aw: { newBadge: 'Nouveau badge !', badges: 'Badges', goalReached: 'Bravo ! Tu as gagné :', tellGrownUp: 'Montre à un adulte !' },
    journey: ["L'île des sons", 'Le pont des syllabes', 'La forêt des mots magiques', 'La montagne des sons difficiles',
      'La rivière des phrases', 'Le lagon des grands mots', 'Le château des histoires', 'Le sommet des champions'],
    sheet: { title: 'Ma fiche', name: 'Prénom', date: 'Date', trace: 'Repasse et écris', read: 'Lis et dessine',
      sums: 'Calcule', line: 'Complète les nombres' },
    moves: ['Saute 5 fois !', 'Touche tes pieds !', 'Étire-toi comme un arbre !', 'Tourne doucement sur toi-même !',
      'Tortille-toi comme un ver !', 'Tiens-toi sur un pied !', 'Tape 10 fois dans tes mains !', 'Marche sur place !',
      'Prends 3 grandes inspirations.'],
  },
};
