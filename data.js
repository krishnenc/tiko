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
    extraSounds: { sh: 'shh', ch: 'ch', th: 'th', ck: 'kuh', ll: 'lll', ng: 'ng', ee: 'ee', oo: 'oo', ar: 'ar' },
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
    ],
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
    ],
    sight: ['je', 'tu', 'il', 'elle', 'on', 'un', 'une', 'le', 'la', 'les', 'et', 'est', 'a', 'de', 'des',
      'mon', 'ma', 'dans', 'sur', 'avec', 'oui', 'non', "c'est", 'pas', 'petit', 'grand', 'voici', 'moi',
      'papa', 'maman'],
  },
};

// How many of the words (from the start of the list) are "simple" – the rest need digraphs etc.
DATA.en.simpleWords = 26;
DATA.fr.simpleWords = 18;
// French grammatical gender (feminine words); everything else is masculine
const FR_FEM = new Set(['lune', 'moto', 'tomate', 'salade', 'tulipe', 'robe', 'vache', 'poule', 'banane', 'pomme', 'souris', 'maison', 'fourmi']);
const frUn = w => FR_FEM.has(w) ? 'une' : 'un';
const frLe = w => /^[aeiouéèêh]/.test(w) ? "l'" : FR_FEM.has(w) ? 'la ' : 'le ';
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Sentences & tiny stories, built from words she has already met.
const SENTENCES = {
  en: [w => `I see a ${w}.`, w => `The ${w} is big.`, w => `I like the ${w}.`, w => `Look at the ${w}!`,
    w => `Here is my ${w}.`, w => `Can you see the ${w}?`, w => `It is a ${w}.`],
  fr: [w => `Je vois ${frUn(w)} ${w}.`, w => `Voici ${frUn(w)} ${w}.`, w => `J'aime ${frLe(w)}${w}.`,
    w => `Il y a ${frUn(w)} ${w}.`, w => `Regarde ${frLe(w)}${w} !`, w => `C'est ${frUn(w)} ${w}.`],
};
// each story: (A, B) => { lines, q, answer: 'A'|'B' }
const STORIES = {
  en: [
    (A, B) => ({ lines: [`I see a ${A}.`, `The ${A} can see a ${B}.`, `The ${B} is big.`, `Look at the ${A} and the ${B}!`], q: `What can the ${A} see?`, answer: 'B' }),
    (A, B) => ({ lines: [`I have a ${A}.`, `I have a ${B} too.`, `The ${A} is little.`, `I like my ${B}!`], q: 'What is little?', answer: 'A' }),
    (A, B) => ({ lines: [`Here is a ${A}.`, `The ${A} is on a ${B}.`, `Is it a big ${B}?`, `Yes! It is big.`], q: `The ${A} is on a…?`, answer: 'B' }),
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
}

const OBJECTS = ['🍎', '🍓', '⭐', '🐟', '🎈', '🐞', '🍪', '🚗', '🌸', '⚽', '🦆', '🍌'];
const STICKERS = ['🦄', '🐶', '🐱', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧', '🐢', '🐙', '🦋', '🐞', '🐝',
  '🦖', '🐳', '🐬', '🦀', '🐠', '🦒', '🐘', '🦔', '🌈', '⭐', '🍓', '🍩', '🚀', '🎈', '🌻', '🍦', '🐰', '🦜', '🐹', '🌙'];

const T = {
  en: {
    start: 'Start', reading: 'Reading', maths: 'Maths', stickers: 'My stickers', parents: 'Parents',
    go: "Let's go!", next: 'Next', home: 'Home', iDidIt: 'I did it!',
    praise: ['Great job!', 'Yes!', 'Super!', 'Well done!', 'You got it!', 'Brilliant!'],
    retry: 'Try again.', itsThis: "It's this one.",
    gotSticker: 'You got a sticker!', allDone: 'All done! You are amazing!',
    breakTitle: 'Move break!', pathTitle: 'My path',
    acts: {
      letters: 'Letter sounds', sight: 'Magic words', blend: 'Blend it', spell: 'Build a word',
      count: 'Count', add: 'Add', sub: 'Take away', bonds: 'Make 10', next: 'What comes next?', compare: 'More or less',
    },
    q: {
      letter: 'Which letter says', like: 'like', findWord: 'Find the word', newWord: 'This word is', tapIt: 'Tap it!',
      blend: 'Tap each sound. Then blend!', blendBtn: 'Blend', whichPic: 'Which picture is it?',
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
      trace: 'Trace it with your finger!', nowPaper: 'Now write it three times on your paper!',
      done: 'Done!', photo: 'Show Tiko', photoThanks: 'Wow! Tiko loves it!', answer: 'What did you get?',
      myWork: 'My work', clear: 'Again',
    },
    newLetter: 'This letter says',
    read: { find: 'Read it. Then find the picture!', help: 'Help', iRead: 'I read it!', story: 'Read the story.',
      yourTurn: 'Your turn!', journey: 'My journey', unlocked: 'You reached a new place!', next: 'Next stop' },
    hi: { letsPlay: "Let's play!", morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
      happy: "I'm so happy to see you! Let's have fun!", tapStart: 'Tap the big Start button!', streak: n => `That's ${n} days in a row!`, combo: n => `${n} in a row!`, there: 'there' },
    aw: { newBadge: 'New badge!', badges: 'Badges', goalReached: 'You did it! You earned:', tellGrownUp: 'Show a grown-up!' },
    journey: ['Sound Island', 'Blending Bridge', 'Magic Word Forest', 'Tricky Sound Mountain', 'Sentence River', 'Story Castle'],
    sheet: { title: 'My worksheet', name: 'Name', date: 'Date', trace: 'Trace and write', read: 'Read and draw',
      sums: 'Work it out', line: 'Fill in the numbers' },
    moves: ['Jump 5 times!', 'Touch your toes!', 'Stretch up high like a tree!', 'Spin around slowly!',
      'Wiggle like a worm!', 'Stand on one leg!', 'Clap 10 times!', 'March on the spot!', 'Take 3 big breaths.'],
  },
  fr: {
    start: 'Commencer', reading: 'Lecture', maths: 'Maths', stickers: 'Mes autocollants', parents: 'Parents',
    go: "C'est parti !", next: 'Suivant', home: 'Accueil', iDidIt: "J'ai réussi !",
    praise: ['Bravo !', 'Super !', 'Oui !', 'Très bien !', 'Génial !', 'Excellent !'],
    retry: 'Essaie encore.', itsThis: "C'est celui-là.",
    gotSticker: 'Tu as gagné un autocollant !', allDone: 'Fini ! Tu es formidable !',
    breakTitle: 'On bouge !', pathTitle: 'Mon chemin',
    acts: {
      letters: 'Les sons', sight: 'Mots magiques', blend: 'Assemble', spell: 'Construis le mot',
      count: 'Compter', add: 'Additionner', sub: 'Enlever', bonds: 'Faire 10', next: 'Et après ?', compare: 'Plus ou moins',
    },
    q: {
      letter: 'Quelle lettre fait', like: 'comme', findWord: 'Trouve le mot', newWord: 'Ce mot, c\'est', tapIt: 'Touche-le !',
      blend: 'Touche chaque son. Puis assemble !', blendBtn: 'Assemble', whichPic: "Quelle image est-ce ?",
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
      trace: 'Suis le tracé avec ton doigt !', nowPaper: 'Maintenant, à toi ! Recopie trois fois sur ta feuille.',
      done: 'Fini !', photo: 'Montre à Tiko', photoThanks: 'Waouh ! Tiko adore !', answer: "Qu'est-ce que tu as trouvé ?",
      myWork: 'Mon travail', clear: 'Encore',
    },
    newLetter: 'Cette lettre fait',
    read: { find: "Lis la phrase. Puis trouve l'image !", help: 'Aide', iRead: "J'ai lu !", story: "Lis l'histoire.",
      yourTurn: 'À toi !', journey: 'Mon voyage', unlocked: 'Tu as atteint un nouveau lieu !', next: 'Prochaine étape' },
    hi: { letsPlay: 'On joue !', morning: 'Bonjour', afternoon: 'Bonjour', evening: 'Bonsoir',
      happy: 'Je suis trop content de te voir ! On va bien s\'amuser !', tapStart: 'Appuie sur le gros bouton Commencer !', streak: n => `${n} jours de suite, bravo !`, combo: n => `${n} d'affilée !`, there: '' },
    aw: { newBadge: 'Nouveau badge !', badges: 'Badges', goalReached: 'Bravo ! Tu as gagné :', tellGrownUp: 'Montre à un adulte !' },
    journey: ["L'île des sons", 'Le pont des syllabes', 'La forêt des mots magiques', 'La montagne des sons difficiles',
      'La rivière des phrases', 'Le château des histoires'],
    sheet: { title: 'Ma fiche', name: 'Prénom', date: 'Date', trace: 'Repasse et écris', read: 'Lis et dessine',
      sums: 'Calcule', line: 'Complète les nombres' },
    moves: ['Saute 5 fois !', 'Touche tes pieds !', 'Étire-toi comme un arbre !', 'Tourne doucement sur toi-même !',
      'Tortille-toi comme un ver !', 'Tiens-toi sur un pied !', 'Tape 10 fois dans tes mains !', 'Marche sur place !',
      'Respire 3 grandes fois.'],
  },
};
