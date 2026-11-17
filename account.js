'use strict';
// Tiko backend piece 4: the parent's account screen (English and French), behind the parent gate.
// HIDDEN FROM EVERY FAMILY: this file is not in index.html. cloudLoad() (app.js) adds it, with cloud.js, only on a tablet that has the switch
// (localStorage['tiko.cloud']). Without the switch the parent corner is exactly as it was, nothing is loaded and no request is made.
// All screen code, all texts (EN and FR) and the country names live here. Every call to the server goes through cloud.js (cloud*); this file keeps
// nothing about the account in any child's save (only the link record, through linkSet / linkDrop, which lives outside every save).
// Privacy rules (docs/DEVELOPING.md section 12): the cloud nickname is NEVER prefilled from a profile name and is refused when it equals or contains the name
// (or the "spoken as" text) of a child on this tablet; nothing private is typed into a request (cloudUpload guards the payload); errors never show a code or English jargon.
// Texts that came from the server or were typed are put in the page through esc() or textContent only.
// Piece 5 (also here): the automatic backup (acctAuto, silent, started by the two one-line hooks in app.js), the conditional upload (cloudUpload with the stamps this tablet
// believes: another tablet's newer copy is never overwritten), the choice between this tablet's progress and the online copy, "Restore a child", and the sentences for reset,
// removal and a restored backup file. The flags of all that live only in the link record (tiko.link): never in a child's save, never in backupText(), never uploaded.

const ACCT_POLICY = '2026-11-draft';          // the privacy policy version the parent agrees to (the lawyer's review will change it)
const ACCT_WORDING = 2;                       // the version of the consent wording below (change it whenever that wording or the list changes)
const ACCT_WHAT = 'wording-' + ACCT_WORDING;  // what cloudConsent records (the server stores a short text, not a number)
let ACCT_RESEND_S = 60;                       // seconds before a new code may be asked for
let ACCT_ASK_MS = 1500;                     // a confirm button of a question stays dead this long after the question appears (no double tap goes through)
let ACCT_AUTO_GAP_MS = 60000;               // at least this long between two automatic backups of this tablet (a call inside the gap is carried out once, when the gap ends)

const ACCT_COUNTRIES = {
  AT: ['Austria', 'Autriche'], BE: ['Belgium', 'Belgique'], BG: ['Bulgaria', 'Bulgarie'], HR: ['Croatia', 'Croatie'], CY: ['Cyprus', 'Chypre'], CZ: ['Czechia', 'Tchéquie'],
  DK: ['Denmark', 'Danemark'], EE: ['Estonia', 'Estonie'], FI: ['Finland', 'Finlande'], FR: ['France', 'France'], DE: ['Germany', 'Allemagne'], GR: ['Greece', 'Grèce'],
  HU: ['Hungary', 'Hongrie'], IE: ['Ireland', 'Irlande'], IT: ['Italy', 'Italie'], LV: ['Latvia', 'Lettonie'], LT: ['Lithuania', 'Lituanie'], LU: ['Luxembourg', 'Luxembourg'],
  MT: ['Malta', 'Malte'], NL: ['Netherlands', 'Pays-Bas'], PL: ['Poland', 'Pologne'], PT: ['Portugal', 'Portugal'], RO: ['Romania', 'Roumanie'], SK: ['Slovakia', 'Slovaquie'],
  SI: ['Slovenia', 'Slovénie'], ES: ['Spain', 'Espagne'], SE: ['Sweden', 'Suède'], IS: ['Iceland', 'Islande'], LI: ['Liechtenstein', 'Liechtenstein'], NO: ['Norway', 'Norvège'],
  GB: ['United Kingdom', 'Royaume-Uni'], MU: ['Mauritius', 'Maurice'], ZA: ['South Africa', 'Afrique du Sud'],
};
// The country is pre-selected from the time zone this tablet is set to (v56). It is read on the tablet: no location is asked for, no request is made, nothing is looked up
// from the network address. Only a zone that belongs to one open country is listed; anything else pre-selects nothing. The parent sees a line saying where the choice came
// from and can change it; what is sent later is the country the parent leaves selected, as before.
const ACCT_ZONES = {
  'Europe/Vienna': 'AT', 'Europe/Brussels': 'BE', 'Europe/Sofia': 'BG', 'Europe/Zagreb': 'HR', 'Asia/Nicosia': 'CY', 'Europe/Nicosia': 'CY', 'Europe/Prague': 'CZ',
  'Europe/Copenhagen': 'DK', 'Europe/Tallinn': 'EE', 'Europe/Helsinki': 'FI', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE', 'Europe/Athens': 'GR',
  'Europe/Budapest': 'HU', 'Europe/Dublin': 'IE', 'Europe/Rome': 'IT', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT', 'Europe/Luxembourg': 'LU', 'Europe/Malta': 'MT',
  'Europe/Amsterdam': 'NL', 'Europe/Warsaw': 'PL', 'Europe/Lisbon': 'PT', 'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Europe/Bucharest': 'RO', 'Europe/Bratislava': 'SK',
  'Europe/Ljubljana': 'SI', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Africa/Ceuta': 'ES', 'Europe/Stockholm': 'SE', 'Atlantic/Reykjavik': 'IS', 'Europe/Vaduz': 'LI',
  'Europe/Oslo': 'NO', 'Europe/London': 'GB', 'Indian/Mauritius': 'MU', 'Africa/Johannesburg': 'ZA',
};
function acctGuessCountry(list) {
  try { const c = ACCT_ZONES[Intl.DateTimeFormat().resolvedOptions().timeZone]; return c && Array.isArray(list) && list.includes(c) ? c : ''; } catch (e) { return ''; }
}

// ---------------------------------------------------------------- what is stored: the list, and the map that keeps it true
// The lines of the "Stored" list (texts ln_<id> in ACCT_T). ACCT_COVER says which line speaks of each key of the save that is uploaded (SAVE_SECTIONS in app.js) and of each
// setting that may leave the tablet (SAVE_SYNCED_SETTINGS). acctCoverGaps() lists every such key with no line: account-check.js fails when it is not empty,
// so a new section or a new synced setting cannot be added without a line in the list the parent agrees to (and a new ACCT_WORDING).
const ACCT_LINES = ['email', 'account', 'child', 'progress', 'goals', 'days', 'answers', 'settings', 'place'];
const ACCT_COVER = {
  sections: { boxes: 'progress', due: 'progress', levels: 'progress', streak: 'progress', simonLen: 'progress', seenStage: 'progress', counts: 'progress', placed: 'progress', used: 'progress',
    books: 'progress', sci: 'progress', stars: 'progress', stickers: 'progress', badges: 'progress', totals: 'progress', goals: 'goals', days: 'days', plays: 'days', diary: 'answers',
    settings: 'settings', lang: 'child', knownV22: 'child', memV23: 'child', newChild: 'child' },
  settings: { stops: 'settings', perStop: 'settings', sessionMin: 'settings', theme: 'settings', calm: 'settings', breaks: 'settings', nudge: 'settings', artInPath: 'settings', discovery: 'settings',
    review: 'settings', hide: 'settings', font: 'settings', spacing: 'settings', textSize: 'settings', simpleHome: 'settings', listenFirst: 'settings', sfx: 'settings', music: 'settings',
    ambient: 'settings', ambientWork: 'settings', voicePack: 'settings' },
};
function acctCoverGaps() {
  const out = [];
  for (const sec of Object.keys(SAVE_SECTIONS)) for (const k of SAVE_SECTIONS[sec]) { const l = ACCT_COVER.sections[k]; if (!ACCT_LINES.includes(l)) out.push('section key ' + k); }
  for (const k of SAVE_SYNCED_SETTINGS) { const l = ACCT_COVER.settings[k]; if (!ACCT_LINES.includes(l)) out.push('setting ' + k); }
  for (const l of ACCT_LINES) for (const lang of ['en', 'fr']) if (typeof ACCT_T[lang]['ln_' + l] !== 'string') out.push('text ' + l + ' ' + lang);
  return out;
}

// ---------------------------------------------------------------- the texts
const ACCT_T = {
  en: {
    title: 'Back up to an account', leave: 'Back to the parent corner', back: 'Back', next: 'Continue', working: 'Working…', tryAgain: 'Try again', cancel: 'Cancel',
    entryP: 'Keep an online copy of the progress of the children on this tablet so that you can restore it on another tablet. This is optional: Tiko works fully without it.', entryBtn: 'Open the account screen',
    infoH: 'What is stored', infoIntro: 'Tiko works fully without an account. An account only keeps an online copy of the progress of the children on this tablet, so that you can restore it on another tablet.',
    storedH: 'Stored',
    ln_email: 'Your email address: to sign you in, and to write to you about the account itself (for example before an account that is no longer used is deleted). Never for anything else.',
    ln_account: 'About the account: your country, the date and version of your agreement, and for each tablet a random number, the Tiko version and the date of its last backup.',
    ln_child: 'For each child: a nickname you choose, the picture and the language.',
    ln_progress: 'For each child, the learning progress: what they know and when it comes back for review, levels, place on the map, library books read, discoveries, stars, stickers and badges.',
    ln_goals: 'For each child, the reward goals, with the text you typed.',
    ln_days: 'For each child, what was played each day (up to two years of days).',
    ln_answers: 'For each child, the last 800 answers, with the wrong choice picked when there was one.',
    ln_settings: 'For each child, the settings you chose in the parent corner: session, practice style, picture world, calm mode, hidden activities, reading and sound.',
    ln_place: 'The online copy is kept by our hosting provider on servers in the European Union.',
    neverH: 'Never stored',
    never1: 'Your child’s name and how Tiko says it, the tablet voice and its speed, whether Tiko speaks to a boy, what your child tells Tiko in Chat, recordings, photos and drawings.',
    goalsWarn: 'Please do not put your child’s name in a reward goal: goals are part of the online copy.',
    lose: 'If you lose access to this email address, you lose access to the account. The progress on this tablet is not affected.',
    privacy: 'Read the privacy policy',
    shortList: 'The online copy holds your email address, your country, your agreement, a random number for each tablet, and for each child a nickname, the picture, the language, the learning progress, the reward goals with the text you typed, and the settings. It never holds your child’s name, the voice, the chat, recordings, photos or drawings. It is kept on servers in the European Union.',
    showList: 'Show the full list',
    countryH: 'Your country', countryP: 'For now, accounts are open in some countries only. Tiko does not use your location, so please choose.', countryExisting: 'If you already have an account, choose any country: it is not changed.',
    countryGuess: 'Chosen from the time zone this tablet is set to. Please check it and change it if it is wrong.',
    countryLabel: 'Country', countryPick: 'Choose a country', countryOther: 'Another country', countryLoading: 'Loading the list…', countryNone: 'Please choose a country.',
    closedH: 'Not open yet', closed: 'Accounts are not open in your country yet. Tiko works fully without one. You can keep the progress of your children safe with a backup file (Backup, above).',
    consentH: 'Your agreement',
    adult: 'I am an adult and the parent or legal guardian of the children who use this tablet',
    agree: 'I agree that Tiko keeps the information listed on this screen so that I can restore it on another tablet',
    emailLabel: 'Your email address', emailHelp: 'We send sign-in codes to this address. We use it only for your account: sign-in, and messages about the account itself.', send: 'Send me a code', badEmail: 'Please check the email address.',
    consentHint: 'The button works when both boxes are ticked and the address looks right.', consentHintSigned: 'The button works when both boxes are ticked.',
    codeH: 'Enter your code', sent: e => `We sent a 6-digit code to ${e}. It works for 10 minutes.`, codeLabel: 'Code', codeShort: 'The code has 6 digits.',
    resend: 'Send a new code', codeHint: 'Take your time. If the code has not arrived, you can ask for a new one after a minute.', another: 'Use another address', newSent: 'A new code was sent.',
    settingUp: 'Setting up your account…', retryH: 'Not finished yet',
    kidsH: 'Your children', kidsP: 'Choose a nickname for the online copy. Please do not use your child’s name.', nickLabel: 'Nickname for the online copy',
    nickPh: n => `Child ${n}`, tick: 'Back up this child’s progress', save: 'Save and back up', saveName: 'Save',
    nameRefused: 'This is the name of a child on this tablet. To keep it private, please choose another nickname, or leave the field empty.', nickEmpty: 'Please type a nickname.',
    kidsNone: 'There is no child to add.',
    statusH: 'Your account', loading: 'Loading…', signedAs: e => `Signed in as ${e}.`, daysLeft: n => (n <= 1 ? 'Within a day you will need to sign in again with a new code.' : `In ${n} days you will need to sign in again with a new code.`),
    inAcctH: 'Children in the account', notInH: 'Children not in the account yet', copiesH: 'Online copies not linked to a child on this tablet', copiesNote: 'These copies stay online until you delete them.',
    lastBk: t => `Last backup from this tablet: ${t}`, copyBk: t => `Last backup: ${t}`, notYet: 'not backed up yet',
    change: 'Change', changeFor: n => `Change the nickname of ${n}`, add: 'Add to the account', addFor: n => `Add ${n} to the account`,
    delCopy: 'Delete this online copy', delCopyFor: n => `Delete the online copy ${n}`, delCopyAsk: n => `Delete the online copy “${n}”? It cannot be undone. The progress on the tablets stays.`, delCopyYes: 'Yes, delete this copy',
    copyDeleted: 'The online copy was deleted.',
    devH: 'Tablets', thisTab: 'this tablet', tabN: n => `Tablet ${n}`, ver: v => `Tiko version ${v}`, devBk: t => `last backup: ${t}`, devNone: 'no backup yet', remove: 'Remove', removeFor: n => `Remove ${n} from the list`,
    backNow: 'Back up now', download: 'Download my data', signOut: 'Sign out', signOutOthers: 'Sign out all other tablets', del: 'Delete my account',
    rmThis: 'Remove this tablet from the list? This tablet will be signed out. Its progress and the online copy both stay.',
    rmOther: n => `Remove ${n} from the list? This frees a place. It does not sign that tablet out: a tablet that is still signed in comes back to the list when it next opens this screen. To cut off a lost tablet, use “Sign out all other tablets”.`,
    rmYes: 'Yes, remove it', signOutAsk: 'Sign out? Nothing is backed up while you are signed out. The progress on this tablet and the online copy both stay.', signOutYes: 'Yes, sign out',
    othersAsk: 'Sign out every other tablet? Each one will ask for a new code the next time it is used. This tablet stays signed in. Their progress and the online copy both stay.', othersYes: 'Yes, sign them out', othersDone: 'Every other tablet was signed out.',
    delAsk1: 'Delete your account? This cannot be undone.',
    delAsk2: e => `Delete the account of ${e}? The online copies are deleted from the account. The provider’s own safety copies disappear later; the privacy page says when. The progress on this tablet stays.`, delYes: 'Yes, delete the account',
    signedOut: 'You are signed out.', deleted: 'The account was deleted. The progress on this tablet is intact.', removedThis: 'This tablet was removed and you are signed out.',
    removedOther: 'The tablet was removed from the list.', renamed: 'The nickname was changed.', downloaded: 'The file tiko-account-data.json was prepared. If it does not appear in Downloads, try again.', needNew: 'Please sign in again with a new code.',
    noLinked: 'No child is in the account yet.', backing: n => `Backing up ${n}…`, backedUp: (n, t) => `${n}: backed up (${t}).`,
    newer: n => `The online copy of ${n} was last saved from another tablet, so this tablet did not replace it. Nothing was changed. Choose below what to do.`,
    notBacked: (n, why) => `${n}: not backed up. ${why}`, readFail: 'This child’s progress could not be read on this tablet.', unknownKid: 'this child', gone: n => `${n}: not in the account any more.`,
    linkFail: 'This tablet’s memory is full, so the link to the online copy could not be saved.',
    today: 'today', yesterday: 'yesterday', at: 'at',
    // ---- piece 5: automatic backup, the choice, restore, reset / removal
    restoreBtn: 'Restore a child', restoreH: 'Restore a child', restoreP: 'These are the online copies in your account. You can add one to this tablet as a new child. The children already on this tablet are not changed.',
    restoring: n => `Adding ${n}…`, rowChoose: n => `${n} is already on this tablet. Choose whether to keep this tablet’s progress or take the online copy.`,
    restoreNone: 'There is no online copy in the account.', addHere: 'Add to this tablet', addHereFor: n => `Add ${n} to this tablet`, onThis: 'Already on this tablet', chooseBtn: 'Choose', chooseFor: n => `Choose what to do for ${n}`,
    restoreFull: 'This tablet already holds the most children it can (8). Remove one first.', noBackupYet: n => `${n} has no backup yet, so there is nothing to add.`,
    restoreBad: n => `The online copy of ${n} is incomplete or damaged, so nothing was added.`, restoreNewer: 'This online copy was made by a newer Tiko. Update the app on this tablet, then try again. Nothing was changed.',
    restoreSave: 'This tablet’s memory is full, so nothing was added.', restoredH: 'Added to this tablet', restoredOk: n => `${n} was added to this tablet.`,
    nameLabel: 'Name on this tablet (optional)', nameHelp: 'The name stays on this tablet. It is never sent online, and it is not the nickname of the online copy.', nameSave: 'Save the name', nameSaved: 'The name was saved on this tablet.',
    voiceNote: 'The voice is chosen in the parent corner, on each tablet. It is not stored online.', doneBtn: 'Done',
    secNewer: n => `Another tablet has a newer backup of ${n}. Open the account to choose.`, secHold: n => `A backup file was restored into ${n}. The online copy has not been changed. Open the account to choose.`, secWaiting: 'Backups are waiting for a sign-in. Open the account to sign in.', secConsent: 'Automatic backups are paused. Open the account to continue backups.',
    secPrev: n => `The earlier progress of ${n} was put back. The online copy has not been changed. Open the account to choose.`,
    thisSide: (n, d) => (n ? `On this tablet: ${n} ${n === 1 ? 'day' : 'days'} played, the last on ${d}.` : 'On this tablet: nothing played yet.'), onlineSide: (t, w) => `Online copy: saved ${t}, from ${w}.`,
    whoThis: 'this tablet', whoTab: n => `Tablet ${n}`, whoOther: 'another tablet',
    rowNewer: n => `Another tablet has a newer backup of ${n}. Nothing is uploaded until you choose.`, rowFile: n => `A backup file was restored into ${n}. The online copy has not been changed.`, rowPrev: n => `The earlier progress of ${n} was put back. The online copy has not been changed.`,
    keepBtn: 'Keep this tablet’s', takeBtn: 'Take the other one’s', replaceBtn: 'Replace the online copy', takeOnBtn: 'Take the online copy',
    keepFor: n => `Keep this tablet’s progress for ${n}`, takeFor: n => `Take the other tablet’s progress for ${n}`, replaceFor: n => `Replace the online copy of ${n}`, takeOnFor: n => `Take the online copy for ${n}`,
    keepAsk: n => `Replace the online copy of ${n} with the progress on this tablet? What the other tablet saved will be overwritten online.`, keepYes: 'Yes, replace the online copy',
    takeAsk: n => `Replace the progress of ${n} on this tablet with the online copy? This tablet’s earlier progress is kept aside once, so you can put it back. The name, the voice and this tablet’s other choices stay.`,
    takeNoRoom: 'This tablet’s memory is full, so its earlier progress cannot be kept aside. Free some space first: nothing can be replaced now.', takeYes: 'Yes, take the online copy',
    putBack: 'Put back this tablet’s earlier progress', putBackFor: n => `Put back the earlier progress of ${n}`, putBackAsk: (n, when) => `Put back the earlier progress of ${n}? Everything played on this tablet since ${when} will be set aside, and the earlier progress comes back. You can put it back the same way, so nothing is lost. Nothing is sent online until you choose.`,
    thenW: 'it was set aside', prevSide: (n, d) => (n ? `Earlier progress, on the shelf: ${n} ${n === 1 ? 'day' : 'days'} played, the last on ${d}.` : 'Earlier progress, on the shelf: nothing played yet.'),
    laterBtn: 'Decide later', keepHeldAsk: n => `Replace the online copy of ${n} with the progress now on this tablet? The online copy may hold newer progress, from this tablet or from another one. If you replace it, that progress is lost online. If you are not sure, choose Cancel.`,
    resetNoteHeld: 'This child is backed up to an account, but nothing is uploaded for them until you choose in the account screen. The online copy is not replaced by the reset until then.', pausedNote: 'Backups for this child are paused until you choose in the account screen (this tablet’s memory is full, so the pause is kept for this session only).', putBackYes: 'Yes, put it back',
    keptDone: n => `${n}: the online copy now matches this tablet.`, tookDone: n => `${n}: this tablet now has the online copy. The earlier progress was kept aside.`, putDone: n => `${n}: the earlier progress is back on this tablet. The online copy has not been changed.`,
    takeBad: 'The online copy is incomplete or damaged, so nothing was changed.', takeNewer: 'The online copy was made by a newer Tiko. Update the app on this tablet, then try again. Nothing was changed.', takeSave: 'This tablet’s memory is full, so nothing was changed.',
    heldNow: n => `${n}: nothing was uploaded. Choose below what to do.`, errLine: (n, why) => `${n}: the last automatic backup was stopped. ${why}`,
    resetNote: e => `This child is backed up to the account${e ? ` (${e})` : ''}. The online copy will be replaced too, at the next backup.`, removeNote: 'The online copy stays in the account. You can delete it from the account screen.',
    err: {
      newer: 'Another tablet saved a newer backup. Nothing was changed.',
      offline: 'No connection. Nothing was changed. Try again when the tablet is online.', code: 'That code is wrong or has expired. Check the latest email, or ask for a new code.',
      throttled: 'Too many tries. Please wait a few minutes.', signedout: 'Please sign in again with a new code.', storage: 'This tablet’s memory is full, so the sign-in could not be saved.',
      limit: 'The account is full: it holds up to 10 children and 10 tablets.', country: 'Accounts are not open in this country yet. Nothing was changed.',
      toobig: 'This child’s progress is too big to back up. Nothing was changed.', private: 'To protect your child’s privacy, this backup was stopped. Nothing was sent.',
      refused: 'This was refused. Nothing was changed. Please try again later.', server: 'The backup service is not available right now. Nothing was changed. Please try again later.',
      off: 'Accounts are not available on this tablet.',
    },
  },
  fr: {
    title: 'Sauvegarder dans un compte', leave: 'Retour au coin des parents', back: 'Retour', next: 'Continuer', working: 'Un instant…', tryAgain: 'Réessayer', cancel: 'Annuler',
    entryP: 'Gardez une copie en ligne de la progression des enfants de cette tablette pour pouvoir la retrouver sur une autre tablette. C’est facultatif : Tiko fonctionne très bien sans.', entryBtn: 'Ouvrir l’écran du compte',
    infoH: 'Ce qui est conservé', infoIntro: 'Tiko fonctionne très bien sans compte. Un compte sert seulement à garder une copie en ligne de la progression des enfants de cette tablette, pour pouvoir la retrouver sur une autre tablette.',
    storedH: 'Conservé',
    ln_email: 'Votre adresse e-mail : pour vous connecter et pour vous écrire au sujet du compte lui-même (par exemple avant la suppression d’un compte qui n’est plus utilisé). Jamais pour autre chose.',
    ln_account: 'Pour le compte : votre pays, la date et la version de votre accord, et pour chaque tablette un numéro au hasard, la version de Tiko et la date de la dernière sauvegarde.',
    ln_child: 'Pour chaque enfant : un surnom que vous choisissez, l’image et la langue.',
    ln_progress: 'Pour chaque enfant, la progression : ce que l’enfant sait et quand cela revient en révision, les niveaux, l’étape sur la carte, les livres lus, les découvertes, les étoiles, les autocollants et les badges.',
    ln_goals: 'Pour chaque enfant, les objectifs de récompense, avec le texte que vous avez écrit.',
    ln_days: 'Pour chaque enfant, ce qui a été joué chaque jour (sur deux ans au plus).',
    ln_answers: 'Pour chaque enfant, les 800 dernières réponses, avec le mauvais choix quand il y en a eu un.',
    ln_settings: 'Pour chaque enfant, les réglages choisis dans le coin des parents : séance, façon de réviser, univers, mode calme, activités masquées, lecture et son.',
    ln_place: 'La copie en ligne est conservée par notre hébergeur, sur des serveurs situés dans l’Union européenne.',
    neverH: 'Jamais conservé',
    never1: 'Le prénom de votre enfant et la façon dont Tiko le prononce, la voix de la tablette et sa vitesse, le fait que Tiko s’adresse à un garçon, ce que votre enfant dit à Tiko dans le chat, les enregistrements, les photos et les dessins.',
    goalsWarn: 'Merci de ne pas écrire le prénom de votre enfant dans un objectif de récompense : les objectifs font partie de la copie en ligne.',
    lose: 'Si vous perdez l’accès à cette adresse e-mail, vous perdez l’accès au compte. La progression sur cette tablette n’est pas touchée.',
    privacy: 'Lire la politique de confidentialité',
    shortList: 'La copie en ligne contient votre adresse e-mail, votre pays, votre accord, un numéro au hasard par tablette, et pour chaque enfant un surnom, l’image, la langue, la progression, les objectifs de récompense avec le texte que vous avez écrit, et les réglages. Elle ne contient jamais le prénom de votre enfant, la voix, le chat, les enregistrements, les photos ni les dessins. Elle est conservée sur des serveurs situés dans l’Union européenne.',
    showList: 'Afficher la liste complète',
    countryH: 'Votre pays', countryP: 'Pour l’instant, les comptes ne sont ouverts que dans certains pays. Tiko n’utilise pas votre position : veuillez choisir.', countryExisting: 'Si vous avez déjà un compte, choisissez n’importe quel pays : il n’est pas modifié.',
    countryGuess: 'Choisi d’après le fuseau horaire réglé sur cette tablette. Vérifiez-le et changez-le s’il est faux.',
    countryLabel: 'Pays', countryPick: 'Choisir un pays', countryOther: 'Un autre pays', countryLoading: 'Chargement de la liste…', countryNone: 'Veuillez choisir un pays.',
    closedH: 'Pas encore ouvert', closed: 'Les comptes ne sont pas encore ouverts dans votre pays. Tiko fonctionne très bien sans compte. Vous pouvez garder la progression de vos enfants en lieu sûr avec un fichier de sauvegarde (rubrique Sauvegarde).',
    consentH: 'Votre accord',
    adult: 'Je suis majeur(e) et je suis le parent ou le représentant légal des enfants qui utilisent cette tablette',
    agree: 'J’accepte que Tiko conserve les informations listées sur cet écran pour que je puisse les retrouver sur une autre tablette',
    emailLabel: 'Votre adresse e-mail', emailHelp: 'Nous envoyons les codes de connexion à cette adresse. Elle ne sert qu’à votre compte : la connexion et les messages qui concernent le compte.', send: 'Envoyer un code', badEmail: 'Veuillez vérifier l’adresse e-mail.',
    consentHint: 'Le bouton fonctionne quand les deux cases sont cochées et que l’adresse semble correcte.', consentHintSigned: 'Le bouton fonctionne quand les deux cases sont cochées.',
    codeH: 'Saisissez votre code', sent: e => `Nous avons envoyé un code à 6 chiffres à ${e}. Il est valable 10 minutes.`, codeLabel: 'Code', codeShort: 'Le code comporte 6 chiffres.',
    resend: 'Envoyer un nouveau code', codeHint: 'Prenez votre temps. Si le code n’est pas arrivé, vous pourrez en demander un nouveau après une minute.', another: 'Utiliser une autre adresse', newSent: 'Un nouveau code a été envoyé.',
    settingUp: 'Mise en place de votre compte…', retryH: 'Pas encore terminé',
    kidsH: 'Vos enfants', kidsP: 'Choisissez un surnom pour la copie en ligne. Merci de ne pas utiliser le prénom ni le nom de votre enfant.', nickLabel: 'Surnom pour la copie en ligne',
    nickPh: n => `Enfant ${n}`, tick: 'Sauvegarder la progression de cet enfant', save: 'Enregistrer et sauvegarder', saveName: 'Enregistrer',
    nameRefused: 'C’est le prénom d’un enfant de cette tablette. Pour le garder privé, choisissez un autre surnom, ou laissez le champ vide.', nickEmpty: 'Veuillez saisir un surnom.',
    kidsNone: 'Il n’y a pas d’enfant à ajouter.',
    statusH: 'Votre compte', loading: 'Chargement…', signedAs: e => `Compte : ${e}.`, daysLeft: n => (n <= 1 ? 'D’ici un jour, il faudra vous reconnecter avec un nouveau code.' : `Dans ${n} jours, il faudra vous reconnecter avec un nouveau code.`),
    inAcctH: 'Enfants dans le compte', notInH: 'Enfants qui ne sont pas encore dans le compte', copiesH: 'Copies en ligne qui ne sont liées à aucun enfant de cette tablette', copiesNote: 'Ces copies restent en ligne jusqu’à ce que vous les supprimiez.',
    lastBk: t => `Dernière sauvegarde depuis cette tablette : ${t}`, copyBk: t => `Dernière sauvegarde : ${t}`, notYet: 'pas encore sauvegardé',
    change: 'Modifier', changeFor: n => `Modifier le surnom de ${n}`, add: 'Ajouter au compte', addFor: n => `Ajouter ${n} au compte`,
    delCopy: 'Supprimer cette copie en ligne', delCopyFor: n => `Supprimer la copie en ligne ${n}`, delCopyAsk: n => `Supprimer la copie en ligne « ${n} » ? Cette action est définitive. La progression sur les tablettes est conservée.`, delCopyYes: 'Oui, supprimer cette copie',
    copyDeleted: 'La copie en ligne a été supprimée.',
    devH: 'Tablettes', thisTab: 'cette tablette', tabN: n => `Tablette ${n}`, ver: v => `Tiko version ${v}`, devBk: t => `dernière sauvegarde : ${t}`, devNone: 'pas encore de sauvegarde', remove: 'Retirer', removeFor: n => `Retirer ${n} de la liste`,
    backNow: 'Sauvegarder maintenant', download: 'Télécharger mes données', signOut: 'Se déconnecter', signOutOthers: 'Déconnecter toutes les autres tablettes', del: 'Supprimer mon compte',
    rmThis: 'Retirer cette tablette de la liste ? Cette tablette sera déconnectée. Sa progression et la copie en ligne sont conservées.',
    rmOther: n => `Retirer ${n} de la liste ? Cela libère une place. Cette tablette n’est pas déconnectée : une tablette encore connectée revient dans la liste la prochaine fois qu’elle ouvre cet écran. Pour couper l’accès d’une tablette perdue, utilisez « Déconnecter toutes les autres tablettes ».`,
    rmYes: 'Oui, la retirer', signOutAsk: 'Se déconnecter ? Rien n’est sauvegardé tant que vous êtes déconnecté(e). La progression sur cette tablette et la copie en ligne sont conservées.', signOutYes: 'Oui, me déconnecter',
    othersAsk: 'Déconnecter toutes les autres tablettes ? Chacune demandera un nouveau code la prochaine fois qu’elle sera utilisée. Cette tablette reste connectée. Leur progression et la copie en ligne sont conservées.', othersYes: 'Oui, les déconnecter', othersDone: 'Toutes les autres tablettes ont été déconnectées.',
    delAsk1: 'Supprimer votre compte ? Cette action est définitive.',
    delAsk2: e => `Supprimer le compte de ${e} ? Les copies en ligne sont supprimées du compte. Les copies de sécurité du fournisseur disparaissent plus tard ; la page de confidentialité indique quand. La progression sur cette tablette est conservée.`, delYes: 'Oui, supprimer le compte',
    signedOut: 'La session est fermée.', deleted: 'Le compte a été supprimé. La progression sur cette tablette est intacte.', removedThis: 'Cette tablette a été retirée et la session est fermée.',
    removedOther: 'La tablette a été retirée de la liste.', renamed: 'Le surnom a été modifié.', downloaded: 'Le fichier tiko-account-data.json a été préparé. S’il n’apparaît pas dans Téléchargements, réessayez.', needNew: 'Veuillez vous reconnecter avec un nouveau code.',
    noLinked: 'Aucun enfant n’est encore dans le compte.', backing: n => `Sauvegarde de ${n}…`, backedUp: (n, t) => `${n} : sauvegardé (${t}).`,
    newer: n => `La copie en ligne de ${n} a été enregistrée en dernier depuis une autre tablette : cette tablette ne l’a pas remplacée. Rien n’a été modifié. Choisissez ci-dessous quoi faire.`,
    notBacked: (n, why) => `${n} : pas sauvegardé. ${why}`, readFail: 'La progression de cet enfant n’a pas pu être lue sur cette tablette.', unknownKid: 'cet enfant', gone: n => `${n} : n’est plus dans le compte.`,
    linkFail: 'La mémoire de cette tablette est pleine : le lien avec la copie en ligne n’a pas pu être enregistré.',
    today: 'aujourd’hui', yesterday: 'hier', at: 'à',
    // ---- pièce 5 : sauvegarde automatique, le choix, la restauration, la remise à zéro et le retrait
    restoreBtn: 'Restaurer un enfant', restoreH: 'Restaurer un enfant', restoreP: 'Voici les copies en ligne de votre compte. Vous pouvez en ajouter une à cette tablette comme nouvel enfant. Les enfants déjà présents sur cette tablette ne sont pas modifiés.',
    restoring: n => `Ajout de ${n}…`, rowChoose: n => `${n} est déjà sur cette tablette. Choisissez de garder la progression de cette tablette ou de prendre la copie en ligne.`,
    restoreNone: 'Il n’y a aucune copie en ligne dans le compte.', addHere: 'Ajouter à cette tablette', addHereFor: n => `Ajouter ${n} à cette tablette`, onThis: 'Déjà sur cette tablette', chooseBtn: 'Choisir', chooseFor: n => `Choisir quoi faire pour ${n}`,
    restoreFull: 'Cette tablette contient déjà le maximum d’enfants (8). Retirez-en un d’abord.', noBackupYet: n => `${n} n’a pas encore de sauvegarde : il n’y a rien à ajouter.`,
    restoreBad: n => `La copie en ligne de ${n} est incomplète ou abîmée : rien n’a été ajouté.`, restoreNewer: 'Cette copie en ligne a été faite par une version plus récente de Tiko. Mettez l’application à jour sur cette tablette, puis réessayez. Rien n’a été modifié.',
    restoreSave: 'La mémoire de cette tablette est pleine : rien n’a été ajouté.', restoredH: 'Ajouté à cette tablette', restoredOk: n => `${n} a été ajouté à cette tablette.`,
    nameLabel: 'Prénom sur cette tablette (facultatif)', nameHelp: 'Le prénom reste sur cette tablette. Il n’est jamais envoyé en ligne, et ce n’est pas le surnom de la copie en ligne.', nameSave: 'Enregistrer le prénom', nameSaved: 'Le prénom a été enregistré sur cette tablette.',
    voiceNote: 'La voix se choisit dans le coin des parents, sur chaque tablette. Elle n’est pas conservée en ligne.', doneBtn: 'Terminé',
    secNewer: n => `Une autre tablette a une sauvegarde plus récente de ${n}. Ouvrez le compte pour choisir.`, secHold: n => `Un fichier de sauvegarde a été restauré dans ${n}. La copie en ligne n’a pas été modifiée. Ouvrez le compte pour choisir.`, secWaiting: 'Des sauvegardes attendent une connexion. Ouvrez le compte pour vous connecter.', secConsent: 'Les sauvegardes automatiques sont en pause. Ouvrez le compte pour continuer les sauvegardes.',
    secPrev: n => `La progression précédente de ${n} a été remise. La copie en ligne n’a pas été modifiée. Ouvrez le compte pour choisir.`,
    thisSide: (n, d) => (n ? `Sur cette tablette : ${n} ${n === 1 ? 'jour joué' : 'jours joués'}, le dernier le ${d}.` : 'Sur cette tablette : rien n’a encore été joué.'), onlineSide: (t, w) => `Copie en ligne : enregistrée ${t}, depuis ${w}.`,
    whoThis: 'cette tablette', whoTab: n => `la tablette ${n}`, whoOther: 'une autre tablette',
    rowNewer: n => `Une autre tablette a une sauvegarde plus récente de ${n}. Rien n’est envoyé tant que vous n’avez pas choisi.`, rowFile: n => `Un fichier de sauvegarde a été restauré dans ${n}. La copie en ligne n’a pas été modifiée.`, rowPrev: n => `La progression précédente de ${n} a été remise. La copie en ligne n’a pas été modifiée.`,
    keepBtn: 'Garder celle de cette tablette', takeBtn: 'Prendre l’autre', replaceBtn: 'Remplacer la copie en ligne', takeOnBtn: 'Prendre la copie en ligne',
    keepFor: n => `Garder la progression de cette tablette pour ${n}`, takeFor: n => `Prendre la progression de l’autre tablette pour ${n}`, replaceFor: n => `Remplacer la copie en ligne de ${n}`, takeOnFor: n => `Prendre la copie en ligne pour ${n}`,
    keepAsk: n => `Remplacer la copie en ligne de ${n} par la progression de cette tablette ? Ce que l’autre tablette a enregistré sera écrasé en ligne.`, keepYes: 'Oui, remplacer la copie en ligne',
    takeAsk: n => `Remplacer la progression de ${n} sur cette tablette par la copie en ligne ? La progression actuelle de cette tablette est mise de côté une fois, pour que vous puissiez la remettre. Le prénom, la voix et les autres choix de cette tablette sont conservés.`,
    takeNoRoom: 'La mémoire de cette tablette est pleine : sa progression actuelle ne peut pas être mise de côté. Libérez d’abord de la place : rien ne peut être remplacé maintenant.', takeYes: 'Oui, prendre la copie en ligne',
    putBack: 'Remettre la progression précédente de cette tablette', putBackFor: n => `Remettre la progression précédente de ${n}`, putBackAsk: (n, when) => `Remettre la progression précédente de ${n} ? Tout ce qui a été joué sur cette tablette depuis ${when} sera mis de côté, et la progression précédente revient. Vous pourrez la remettre de la même façon : rien n’est perdu. Rien n’est envoyé en ligne tant que vous n’avez pas choisi.`,
    thenW: 'sa mise de côté', prevSide: (n, d) => (n ? `Progression précédente, mise de côté : ${n} ${n === 1 ? 'jour joué' : 'jours joués'}, le dernier le ${d}.` : 'Progression précédente, mise de côté : rien n’a encore été joué.'),
    laterBtn: 'Décider plus tard', keepHeldAsk: n => `Remplacer la copie en ligne de ${n} par la progression qui est maintenant sur cette tablette ? La copie en ligne contient peut-être une progression plus récente, de cette tablette ou d’une autre. Si vous la remplacez, cette progression est perdue en ligne. Si vous hésitez, choisissez Annuler.`,
    resetNoteHeld: 'Cet enfant est sauvegardé dans un compte, mais rien n’est envoyé pour lui tant que vous n’avez pas choisi dans l’écran du compte. La copie en ligne n’est pas remplacée par la remise à zéro d’ici là.', pausedNote: 'Les sauvegardes de cet enfant sont en pause jusqu’à ce que vous choisissiez dans l’écran du compte (la mémoire de cette tablette est pleine : la pause n’est gardée que pour cette session).', putBackYes: 'Oui, la remettre',
    keptDone: n => `${n} : la copie en ligne correspond maintenant à cette tablette.`, tookDone: n => `${n} : cette tablette a maintenant la copie en ligne. La progression précédente a été mise de côté.`, putDone: n => `${n} : la progression précédente est de retour sur cette tablette. La copie en ligne n’a pas été modifiée.`,
    takeBad: 'La copie en ligne est incomplète ou abîmée : rien n’a été modifié.', takeNewer: 'La copie en ligne a été faite par une version plus récente de Tiko. Mettez l’application à jour sur cette tablette, puis réessayez. Rien n’a été modifié.', takeSave: 'La mémoire de cette tablette est pleine : rien n’a été modifié.',
    heldNow: n => `${n} : rien n’a été envoyé. Choisissez ci-dessous quoi faire.`, errLine: (n, why) => `${n} : la dernière sauvegarde automatique a été arrêtée. ${why}`,
    resetNote: e => `Cet enfant est sauvegardé dans le compte${e ? ` (${e})` : ''}. La copie en ligne sera aussi remplacée, à la prochaine sauvegarde.`, removeNote: 'La copie en ligne reste dans le compte. Vous pouvez la supprimer depuis l’écran du compte.',
    err: {
      newer: 'Une autre tablette a enregistré une sauvegarde plus récente. Rien n’a été modifié.',
      offline: 'Pas de connexion. Rien n’a été modifié. Réessayez quand la tablette sera en ligne.', code: 'Ce code est incorrect ou a expiré. Vérifiez le dernier e-mail reçu, ou demandez un nouveau code.',
      throttled: 'Trop d’essais. Veuillez patienter quelques minutes.', signedout: 'Veuillez vous reconnecter avec un nouveau code.', storage: 'La mémoire de cette tablette est pleine : la connexion n’a pas pu être enregistrée.',
      limit: 'Le compte est plein : il accepte jusqu’à 10 enfants et 10 tablettes.', country: 'Les comptes ne sont pas encore ouverts dans ce pays. Rien n’a été modifié.',
      toobig: 'La progression de cet enfant est trop volumineuse pour être sauvegardée. Rien n’a été modifié.', private: 'Pour protéger la vie privée de votre enfant, cette sauvegarde a été arrêtée. Rien n’a été envoyé.',
      refused: 'La demande a été refusée. Rien n’a été modifié. Veuillez réessayer plus tard.', server: 'Le service de sauvegarde est indisponible pour le moment. Rien n’a été modifié. Veuillez réessayer plus tard.',
      off: 'Les comptes ne sont pas disponibles sur cette tablette.',
    },
  },
};
// French typography: a narrow no-break space (U+202F) before ":" ";" "?" "!" and inside « », so a line never breaks before the mark. Applied to every French text once, here.
(() => {
  const fix = s => (typeof s === 'string' ? s.replace(/ ([:;?!»])/g, ' $1').replace(/(«) /g, '$1 ') : s);
  const wrap = v => (typeof v === 'function' ? (...a) => fix(v(...a)) : fix(v));
  for (const k of Object.keys(ACCT_T.fr)) { if (k === 'err') for (const e of Object.keys(ACCT_T.fr.err)) ACCT_T.fr.err[e] = fix(ACCT_T.fr.err[e]); else ACCT_T.fr[k] = wrap(ACCT_T.fr[k]); }
})();

// ---------------------------------------------------------------- state
const ACCT = { lang: 'en', view: 'info', gen: 0, busy: false, country: '', adult: false, agree: false, email: '', code: '', nick: {}, tick: {}, only: null, renaming: null, ask: null,
  note: '', err: '', sentAt: 0, timer: 0, countries: null, countriesErr: '', data: null, dataErr: '', log: [], sync: null,
  auto: { running: false, again: false, last: 0, timer: 0 }, restored: null, choosing: null,
  after: null };                       // where "Back to the parent corner" leads when the screen was opened from the first-time setup (setup.js); null = the parent corner
const acctT = k => { const v = ACCT_T[ACCT.lang][k]; return v === undefined ? ACCT_T.en[k] : v; };
const acctS = (k, ...a) => { const v = acctT(k); return typeof v === 'function' ? v(...a) : v; };
const acctErr = code => ACCT_T[ACCT.lang].err[code] || ACCT_T[ACCT.lang].err.server;
const acctLive = gen => gen === ACCT.gen && !!document.querySelector('.acct');
const acctEmailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
const acctUid = () => cloudState().uid || '';

// ---------------------------------------------------------------- helpers on this tablet's children
const acctNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// one child's save: the playing child's is S; another child's is read from its storage through the same defaults and upgrades as the playing child's (loadSaveOf in app.js)
const acctSaveOf = p => (p.id === PROFILES.current ? S : loadSaveOf(p.id));
// the names typed on this tablet (the child's name and how Tiko says it), normalised, only those of 3 letters or more: used ONLY to refuse a nickname, never sent anywhere
function acctNames() {
  const out = [];
  for (const p of PROFILES.list) { const st = (acctSaveOf(p) || {}).settings || {}; for (const n of [st.name, st.nameSay]) { const v = acctNorm(n); if (v.length >= 3) out.push(v); } }
  return out;
}
const acctProfIndex = p => PROFILES.list.indexOf(p) + 1;
// the label of a child on this screen: the name typed on this tablet (shown to the parent only, never sent), or "Child 2" in the screen's own language
function acctLabel(p) { const st = (acctSaveOf(p) || {}).settings || {}; return String(st.name || '').trim() || `${ACCT.lang === 'fr' ? 'Enfant' : 'Child'} ${acctProfIndex(p)}`; }
const acctNickOf = (p, typed) => (String(typed || '').trim() ? cloudChars(String(typed).trim(), 20) : acctS('nickPh', acctProfIndex(p)));
function acctTime(ms) {
  const d = new Date(ms), n = new Date(), loc = ACCT.lang === 'fr' ? 'fr-FR' : 'en-GB', hm = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === n.toDateString()) return `${acctS('today')} ${acctS('at')} ${hm}`;
  if (d.toDateString() === y.toDateString()) return `${acctS('yesterday')} ${acctS('at')} ${hm}`;
  return `${d.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })} ${acctS('at')} ${hm}`;
}
const acctLast = up => { const v = Object.values(up || {}).filter(Number.isFinite); return v.length ? Math.max(...v) : null; };
// the link of a child on this tablet to a child of the account that is signed in now. A record of another account, an old record not yet adopted and a record still marked pending are
// NOT links here (they are neither used nor dropped); acctReconcile settles them against what the server has.
function acctRec(p) { const r = linkGet(p.id); return r && r.uid && r.uid === acctUid() && !r.pending ? r : null; }
const acctLinked = () => PROFILES.list.filter(p => acctRec(p));
const acctUnlinked = () => PROFILES.list.filter(p => !acctRec(p));
// Settles the link records of this tablet against the children the signed-in account has on the server (call it after every read of the children):
//  - another account's record: left alone (never dropped);   - an old record without an account: adopted if the server has that child, else left alone;
//  - a pending record (written before its child was created): completed if the child is there, dropped if not;   - this account's record whose child is gone: dropped.
function acctReconcile(kids) {
  const uid = acctUid(); if (!uid) return;
  for (const p of PROFILES.list) {
    const rec = linkGet(p.id); if (!rec || (rec.uid && rec.uid !== uid)) continue;
    const has = kids.some(k => k.id === rec.child);
    const { pending, ...rest } = rec;                  // the flags of the backup (at, conflict, hold, err) stay on the record
    if (pending) { if (has) linkSet(p.id, { ...rest, uid }); else linkDrop(p.id); continue; }
    if (!rec.uid) { if (has) linkSet(p.id, { ...rest, uid }); continue; }
    if (!has) linkDrop(p.id);
  }
}

// ---------------------------------------------------------------- the one-call-at-a-time wrapper
function acctSyncBusy() {
  $$('.acct button, .acct input, .acct select').forEach(e => { if (!e.classList.contains('acct-leave')) e.disabled = ACCT.busy; });
  if (!ACCT.busy && ACCT.sync) ACCT.sync();
}
async function acctRun(btn, fn) {
  if (ACCT.busy) return;
  ACCT.busy = true;
  const gen = ACCT.gen, old = btn ? btn.textContent : '';
  if (btn) { btn.textContent = acctS('working'); btn.setAttribute('aria-busy', 'true'); }
  acctSyncBusy();
  try { await fn(gen); }
  finally {
    if (gen === ACCT.gen) ACCT.busy = false;          // a call that outlives the screen (or a reopening) must not free a newer call's lock
    if (btn && btn.isConnected) { btn.textContent = old; btn.removeAttribute('aria-busy'); }
    if (acctLive(gen)) acctSyncBusy();
  }
}
function acctSay(sel, text, root) { const e = $(sel, root || document); if (e) e.textContent = text || ''; }

// ---------------------------------------------------------------- entry from the parent corner
function acctSection() {
  const s = document.createElement('section');
  // from the link records alone: one line for a child that needs a choice (a newer online copy, a restored backup file), one when backups wait for a sign-in
  s.innerHTML = `<h3>☁️ ${esc(ACCT_T.en.title)} / ${esc(ACCT_T.fr.title)}</h3><p>${esc(ACCT_T.en.entryP)} / ${esc(ACCT_T.fr.entryP)}</p>
    ${acctSectionLines().map(l => `<p class="acct-secnote" role="status"><b>${l}</b></p>`).join('')}
    <button class="pbtn acct-open">${esc(ACCT_T.en.entryBtn)} / ${esc(ACCT_T.fr.entryBtn)}</button>`;
  $('.acct-open', s).onclick = acctOpen;
  return s;
}
function acctLeave() {
  ACCT.gen++; clearInterval(ACCT.timer); ACCT.busy = false; ACCT.sync = null; document.documentElement.lang = S.lang;
  const back = ACCT.after; ACCT.after = null;
  if (typeof back === 'function') return back();          // opened from the setup: back to its last step
  parentTab = 'data'; parents();
}
function acctReset() { Object.assign(ACCT, { country: '', adult: false, agree: false, email: '', code: '', nick: {}, tick: {}, only: null, renaming: null, ask: null, err: '', log: [], data: null, dataErr: '', restored: null, choosing: null }); }
function acctOpen() {
  const gen = ++ACCT.gen;
  clearInterval(ACCT.timer); ACCT.busy = false; ACCT.sync = null; stopSpeech(); zoomable(true);
  acctReset(); ACCT.lang = S.lang === 'fr' ? 'fr' : 'en'; ACCT.note = ''; ACCT.countries = null; ACCT.countriesErr = ''; ACCT.loadingC = false; ACCT.loadingS = false;
  const st = cloudState();
  if (!st.on) { ACCT.err = 'off'; return acctGo('retry'); }
  if (!st.signedIn) return acctGo('info');
  acctGo('loading'); acctOnOpen(gen);
}

// ---------------------------------------------------------------- the steps of the account (ensure-steps are the same at sign-up and at every opening)
async function acctConsentsOk() {
  const r = await cloudConsents();
  if (!r.ok) return r;
  return { ok: true, data: r.data.some(c => c.policy_version === ACCT_POLICY && c.what === ACCT_WHAT && !c.withdrawn_at) };
}
// The consent this tablet's session was confirmed for (tiko.consent: tablet-wide, next to the session; never in a child's save or a backup; dropped with the session by cloudAuthClear and by
// "Turn off"). The automatic backup uploads only while it equals the current ACCT_POLICY + ACCT_WHAT: after a wording change nothing goes up until the parent has opened the account.
const acctConsentId = () => ACCT_POLICY + '|' + ACCT_WHAT;
function acctRememberConsent() { try { localStorage.setItem('tiko.consent', JSON.stringify({ uid: cloudState().uid, id: acctConsentId() })); } catch (e) { /* the automatic backup then simply stays paused */ } }
function acctConsentCurrent() { try { const c = JSON.parse(localStorage.getItem('tiko.consent')); return !!c && c.id === acctConsentId() && !!c.uid && c.uid === cloudState().uid; } catch (e) { return false; } }
// -> { ok: true, did } | { need: 'country' | 'consent' } | { error }
async function acctEnsure() {
  let did = false;                    // true when this run had to make the account or record the consent (a sign-up being finished)
  const a = await cloudAccount();
  if (!a.ok) return { error: a.error };
  if (!a.data) {
    if (!ACCT.country || ACCT.country === '*') return { need: 'country' };
    const c = await cloudCreateAccount(ACCT.country);
    if (!c.ok) return { error: c.error };
    did = true;
  }
  const k = await acctConsentsOk();
  if (!k.ok) return { error: k.error };
  if (!k.data) {                      // no consent of this version on the server: it is recorded once, and only from boxes the parent ticked in this session
    if (!(ACCT.adult && ACCT.agree)) return { need: 'consent' };
    const c = await cloudConsent({ policy: ACCT_POLICY, what: ACCT_WHAT, adult: true });
    if (!c.ok) return { error: c.error };
    did = true;
  }
  acctRememberConsent();              // the consent of the current wording is on the server (found or just recorded)
  const d = await cloudDevice(APP_VERSION);
  if (!d.ok) return { error: d.error };
  return { ok: true, did };
}
function acctFail(code) {
  if (code === 'signedout') { ACCT.note = 'needNew'; ACCT.country = ''; ACCT.adult = false; ACCT.agree = false; return acctGo('info'); }     // nothing ticked before may count for the next sign-in
  ACCT.err = code; return acctGo('retry');
}
// runs the ensure-steps and goes on: country / consent when something is needed, else the children step (a brand-new account) or the status
async function acctAfterSignIn(gen, fresh) {
  const r = await acctEnsure();
  if (!acctLive(gen)) return;
  if (r.need === 'country') return acctGo('country');
  if (r.need === 'consent') return acctGo('consent');
  if (r.error) return acctFail(r.error);
  ACCT.code = '';
  const kids = await cloudChildren();
  if (!acctLive(gen)) return;
  if (!kids.ok) return acctFail(kids.error);
  acctReconcile(kids.data);          // before anything chooses between "children" and "status": the links of this account are known now
  if ((fresh || r.did) && !kids.data.length && acctUnlinked().length) { ACCT.only = null; return acctGo('children'); }   // a sign-up (this one or one finished now) with no child online yet
  ACCT.data = null; ACCT.dataErr = ''; acctGo('status');
}
function acctOnOpen(gen) { acctRun(null, async () => { await acctAfterSignIn(gen, false); }); }

// ---------------------------------------------------------------- drawing
function acctShell(inner) {
  return `<div class="screen parent acct"><div class="wrap">
    <div class="acct-top"><button class="pbtn alt acct-leave">${esc('← ' + acctS('leave'))}</button>
      <div class="acct-langs" role="group" aria-label="Language / Langue">${['en', 'fr'].map(l => `<button class="pbtn alt acct-l ${ACCT.lang === l ? 'on' : ''}" data-l="${l}" lang="${l}" aria-pressed="${ACCT.lang === l}">${l === 'en' ? 'English' : 'Français'}</button>`).join('')}</div></div>
    ${inner}</div></div>`;
}
function acctDraw(force) {
  const f = document.activeElement, refocus = force || !f || f === document.body || (f.classList && f.classList.contains('acct-h'));
  const v = ACCT_VIEW[ACCT.view] || ACCT_VIEW.info;
  ACCT.sync = null;
  app.innerHTML = acctShell(v.html());
  document.documentElement.lang = ACCT.lang;
  $('.acct-leave').onclick = acctLeave;
  $$('.acct-l').forEach(b => b.onclick = () => { if (ACCT.lang === b.dataset.l) return; ACCT.lang = b.dataset.l; acctDraw(); const nb = $(`.acct-l[data-l="${ACCT.lang}"]`); if (nb) nb.focus(); });
  v.wire();
  acctSyncBusy();
  if (refocus) { const h = $('.acct-h'); if (h) h.focus({ preventScroll: false }); }
}
function acctGo(view) {
  clearInterval(ACCT.timer);
  ACCT.view = view;
  if (view !== 'info') ACCT.note = '';
  acctDraw(true);
  const s = $('.acct'); if (s) s.scrollTop = 0;
}
const acctH = (key, extra) => `<h3 class="acct-h" tabindex="-1">${esc(acctS(key))}</h3>${extra || ''}`;
const acctBack = to => `<button class="pbtn alt acct-back" data-to="${to}">${esc(acctS('back'))}</button>`;
const acctWireBack = () => $$('.acct-back').forEach(b => b.onclick = () => { if (b.dataset.to === 'leave') acctLeave(); else acctGo(b.dataset.to); });
const acctCheck = (cls, label, checked) => `<label class="acct-chk"><input type="checkbox" class="${cls}" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
// the full list of what is and is not stored (also shown, in place, on the consent screen)
const acctListHTML = () => `<h4>${esc(acctS('storedH'))}</h4><ul>${ACCT_LINES.map(l => `<li>${esc(acctS('ln_' + l))}</li>`).join('')}</ul>
  <h4>${esc(acctS('neverH'))}</h4><ul><li>${esc(acctS('never1'))}</li></ul><p><b>${esc(acctS('goalsWarn'))}</b></p>`;

const ACCT_VIEW = {
  // ---- A1: what is stored
  info: {
    html: () => `<section>${acctH('infoH')}
      ${ACCT.note ? `<p class="acct-note" role="status">${esc(acctS(ACCT.note))}</p>` : ''}
      <p>${esc(acctS('infoIntro'))}</p>${acctListHTML()}<p>${esc(acctS('lose'))}</p>
      <p><a class="pbtn alt acct-priv" href="privacy.html" target="_blank" rel="noopener">${esc(acctS('privacy'))}</a></p>
      <div class="acct-nav"><button class="pbtn acct-next">${esc(acctS('next'))}</button></div></section>`,
    wire: () => { $('.acct-next').onclick = () => acctGo('country'); },
  },
  // ---- signed in: the ensure-steps are running
  loading: {
    html: () => `<section>${acctH('statusH')}<p role="status">${esc(acctS('settingUp'))}</p></section>`,
    wire: () => {},
  },
  // ---- A2: country (the list is what the server returns)
  country: {
    html: () => {
      let body;
      if (ACCT.countriesErr) body = `<p class="acct-msg" role="alert">${esc(acctErr(ACCT.countriesErr))}</p><button class="pbtn acct-retry">${esc(acctS('tryAgain'))}</button>`;
      else if (!ACCT.countries) body = `<p role="status">${esc(acctS('countryLoading'))}</p>`;
      else {
        const loc = ACCT.lang === 'fr' ? 'fr' : 'en', name = c => (ACCT_COUNTRIES[c] ? ACCT_COUNTRIES[c][ACCT.lang === 'fr' ? 1 : 0] : c);
        const list = [...ACCT.countries].sort((a, b) => name(a).localeCompare(name(b), loc));
        body = `<label for="acct-country">${esc(acctS('countryLabel'))}</label>
          <select id="acct-country" class="acct-country"><option value="">${esc(acctS('countryPick'))}</option>${list.map(c => `<option value="${esc(c)}" ${ACCT.country === c ? 'selected' : ''}>${esc(name(c))}</option>`).join('')}
          <option value="*" ${ACCT.country === '*' ? 'selected' : ''}>${esc(acctS('countryOther'))}</option></select>
          <p class="acct-help acct-guess" ${ACCT.guess && ACCT.country === ACCT.guess ? '' : 'hidden'}>${esc(acctS('countryGuess'))}</p>
          <p class="acct-msg" role="alert"></p>
          <div class="acct-nav"><button class="pbtn acct-next">${esc(acctS('next'))}</button></div>`;
      }
      return `<section>${acctH('countryH')}<p>${esc(acctS('countryP'))}</p><p class="acct-help">${esc(acctS('countryExisting'))}</p>${body}<div class="acct-nav">${acctBack(cloudState().signedIn ? 'leave' : 'info')}</div></section>`;
    },
    wire: () => {
      acctWireBack();
      const sel = $('.acct-country'), rt = $('.acct-retry');
      if (rt) rt.onclick = () => { ACCT.countriesErr = ''; acctLoadCountries(ACCT.gen); };
      if (!ACCT.countries && !ACCT.countriesErr && !ACCT.loadingC) acctLoadCountries(ACCT.gen);
      if (!sel) return;
      sel.onchange = () => { ACCT.country = sel.value; acctSay('.acct-msg', ''); const g = $('.acct-guess'); if (g) g.hidden = !(ACCT.guess && ACCT.country === ACCT.guess); };
      $('.acct-next').onclick = () => {
        if (!ACCT.country) { acctSay('.acct-msg', acctS('countryNone')); sel.focus(); return; }
        acctGo(ACCT.country === '*' ? 'closed' : 'consent');
      };
    },
  },
  // ---- A2b: not open in this country (the flow stops)
  closed: {
    html: () => `<section>${acctH('closedH')}<p class="acct-note" role="status">${esc(acctS('closed'))}</p><div class="acct-nav">${acctBack('country')}</div></section>`,
    wire: () => acctWireBack(),
  },
  // ---- A3: consent and the email address (when already signed in, only the two boxes). The consent sits with a short form of the list, and the full list opens in place.
  consent: {
    html: () => {
      const signed = cloudState().signedIn;
      return `<section>${acctH('consentH')}
        <p class="acct-short">${esc(acctS('shortList'))}</p>
        <details class="acct-det"><summary>${esc(acctS('showList'))}</summary>${acctListHTML()}</details>
        ${acctCheck('acct-adult', acctS('adult'), ACCT.adult)}${acctCheck('acct-agree', acctS('agree'), ACCT.agree)}
        ${signed ? '' : `<label for="acct-email">${esc(acctS('emailLabel'))}</label><input id="acct-email" class="acct-email" type="email" autocomplete="email" inputmode="email" maxlength="254" value="${esc(ACCT.email)}" aria-describedby="acct-emailhelp acct-msg1">
          <p id="acct-emailhelp" class="acct-help">${esc(acctS('emailHelp'))}</p>`}
        <p id="acct-msg1" class="acct-msg" role="alert"></p>
        <p class="acct-help">${esc(acctS(signed ? 'consentHintSigned' : 'consentHint'))}</p>
        <div class="acct-nav"><button class="pbtn acct-send" disabled>${esc(acctS(signed ? 'next' : 'send'))}</button>${acctBack(signed && !ACCT.country ? 'leave' : 'country')}</div></section>`;
    },
    wire: () => {
      acctWireBack();
      const ad = $('.acct-adult'), ag = $('.acct-agree'), em = $('.acct-email'), go = $('.acct-send'), signed = cloudState().signedIn;
      const sync = ACCT.sync = () => { go.disabled = ACCT.busy || !(ACCT.adult && ACCT.agree && (signed || acctEmailOk(ACCT.email.trim()))); };
      ad.onchange = () => { ACCT.adult = ad.checked; sync(); };
      ag.onchange = () => { ACCT.agree = ag.checked; sync(); };
      if (em) em.oninput = () => { ACCT.email = em.value; acctSay('#acct-msg1', ''); sync(); };
      sync();
      go.onclick = () => acctRun(go, async gen => {
        if (signed) { await acctAfterSignIn(gen, false); return; }
        const email = ACCT.email.trim();
        if (!acctEmailOk(email)) { acctSay('#acct-msg1', acctS('badEmail')); return; }
        const r = await cloudSendCode(email);
        if (!acctLive(gen)) return;
        if (!r.ok) { acctSay('#acct-msg1', acctErr(r.error)); return; }
        ACCT.email = email; ACCT.sentAt = Date.now(); acctGo('code');
      });
    },
  },
  // ---- A4: the code
  code: {
    html: () => `<section>${acctH('codeH')}<p>${esc(acctS('sent', ACCT.email))}</p>
      <label for="acct-code">${esc(acctS('codeLabel'))}</label><input id="acct-code" class="acct-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" value="${esc(ACCT.code)}" aria-describedby="acct-msg2">
      <p id="acct-msg2" class="acct-msg" role="alert"></p>
      <div class="acct-nav"><button class="pbtn acct-go">${esc(acctS('next'))}</button></div>
      <div class="acct-nav"><button class="pbtn alt acct-resend" disabled>${esc(acctS('resend'))}</button><button class="pbtn alt acct-other">${esc(acctS('another'))}</button></div>
      <p class="acct-hint">${esc(acctS('codeHint'))}</p></section>`,
    wire: () => {
      const inp = $('.acct-code'), go = $('.acct-go'), rs = $('.acct-resend');
      inp.oninput = () => { ACCT.code = inp.value; acctSay('#acct-msg2', ''); };
      const tick = () => {
        const left = Math.max(0, Math.ceil((ACCT.sentAt + ACCT_RESEND_S * 1000 - Date.now()) / 1000));
        // no visible countdown: a parent read the ticking seconds as the time left to type the code (the code works for 10 minutes); the button is simply unavailable for the first minute
        rs.dataset.wait = left; rs.disabled = ACCT.busy || left > 0;
      };
      ACCT.sync = tick; tick(); ACCT.timer = setInterval(() => { if (!$('.acct-resend')) { clearInterval(ACCT.timer); return; } if (!ACCT.busy) tick(); }, 1000);
      $('.acct-other').onclick = () => acctGo('consent');
      rs.onclick = () => acctRun(rs, async gen => {
        const r = await cloudSendCode(ACCT.email);
        if (!acctLive(gen)) return;
        if (!r.ok) { acctSay('#acct-msg2', acctErr(r.error)); return; }
        ACCT.sentAt = Date.now(); acctSay('#acct-msg2', acctS('newSent'));
      });
      go.onclick = () => acctRun(go, async gen => {
        const raw = inp.value.replace(/\s+/g, '');
        if (!/^\d{6}$/.test(raw)) { acctSay('#acct-msg2', acctS('codeShort')); return; }
        const r = await cloudVerifyCode(ACCT.email, raw);
        if (!acctLive(gen)) return;
        if (!r.ok) { acctSay('#acct-msg2', acctErr(r.error)); return; }
        acctSay('#acct-msg2', acctS('settingUp'));
        await acctAfterSignIn(gen, true);
      });
    },
  },
  // ---- something could not be finished: say so plainly and offer to try again (a later opening finishes it too)
  retry: {
    html: () => `<section>${ACCT.err === 'off' ? acctH('statusH') : acctH('retryH')}<p class="acct-msg" role="alert">${esc(acctErr(ACCT.err))}</p>
      <div class="acct-nav">${ACCT.err === 'off' ? '' : `<button class="pbtn acct-again">${esc(acctS('tryAgain'))}</button>`}</div></section>`,
    wire: () => {
      const b = $('.acct-again'); if (!b) return;
      b.onclick = () => acctRun(b, async gen => { await acctAfterSignIn(gen, false); });
    },
  },
  // ---- A5: the children (a nickname per child, never prefilled)
  children: {
    html: () => {
      const rows = (ACCT.only ? PROFILES.list.filter(p => p.id === ACCT.only) : acctUnlinked());
      if (!rows.length) return `<section>${acctH('kidsH')}<p>${esc(acctS('kidsNone'))}</p><div class="acct-nav">${acctBack('status')}</div></section>`;
      return `<section>${acctH('kidsH')}<p>${esc(acctS('kidsP'))}</p>
        ${rows.map(p => `<fieldset class="acct-kid" data-p="${esc(p.id)}"><legend><span aria-hidden="true">${esc(p.avatar || AVATARS[0])}</span> ${esc(acctLabel(p))}</legend>
          ${acctCheck('acct-tick', acctS('tick'), ACCT.tick[p.id] !== false)}
          <label for="acct-nick-${esc(p.id)}">${esc(acctS('nickLabel'))}</label>
          <input id="acct-nick-${esc(p.id)}" class="acct-nick" type="text" maxlength="20" autocomplete="off" placeholder="${esc(acctS('nickPh', acctProfIndex(p)))}" value="${esc(ACCT.nick[p.id] || '')}" aria-describedby="acct-km-${esc(p.id)}">
          <p id="acct-km-${esc(p.id)}" class="acct-msg" role="alert"></p></fieldset>`).join('')}
        <p class="acct-log" role="status" aria-live="polite"></p>
        <div class="acct-nav"><button class="pbtn acct-save">${esc(acctS('save'))}</button>${acctBack('status')}</div></section>`;
    },
    wire: () => {
      acctWireBack();
      $$('.acct-kid').forEach(k => {
        const id = k.dataset.p, tk = $('.acct-tick', k), ni = $('.acct-nick', k);
        tk.onchange = () => { ACCT.tick[id] = tk.checked; };
        ni.oninput = () => { ACCT.nick[id] = ni.value; acctSay('.acct-msg', '', k); };
      });
      const sv = $('.acct-save'); if (!sv) return;
      sv.onclick = () => acctRun(sv, async gen => { await acctSaveChildren(gen); });
    },
  },
  // ---- piece 5: Restore a child (the online copies of the account; one that is not on this tablet becomes a NEW child here)
  restore: {
    html: () => {
      const D = ACCT.data;
      if (!D) return `<section>${acctH('restoreH')}<p role="status">${esc(acctS('loading'))}</p><div class="acct-nav">${acctBack('status')}</div></section>`;
      const onTablet = id => PROFILES.list.find(p => { const r = acctRec(p); return r && r.child === id; });
      const last = k => { const v = Object.values(k.sections || {}).map(s => s.updated_at).filter(Number.isFinite); return v.length ? Math.max(...v) : null; };
      const rows = D.kids.map(k => { const p = onTablet(k.id);
        return `<div class="acct-row" data-c="${esc(k.id)}"><div class="acct-who"><b class="acct-nk">${esc(k.nickname)}</b>
          <small>${esc(last(k) ? acctS('copyBk', acctTime(last(k))) : acctS('notYet'))}${p ? ` · ${esc(acctS('onThis'))}` : ''}</small></div>
          ${p ? `<button class="pbtn alt acct-choose" data-p="${esc(p.id)}" aria-label="${esc(acctS('chooseFor', k.nickname))}">${esc(acctS('chooseBtn'))}</button>`
              : `<button class="pbtn acct-addhere" aria-label="${esc(acctS('addHereFor', k.nickname))}">${esc(acctS('addHere'))}</button>`}</div>`; }).join('');
      return `<section>${acctH('restoreH')}<p>${esc(acctS('restoreP'))}</p>${rows || `<p>${esc(acctS('restoreNone'))}</p>`}
        <p class="acct-log" role="status" aria-live="polite">${ACCT.log.map(l => esc(l)).join('<br>')}</p><div class="acct-nav">${acctBack('status')}</div></section>`;
    },
    wire: () => {
      $$('.acct-back').forEach(b => b.onclick = () => { ACCT.log = []; ACCT.data = null; ACCT.dataErr = ''; acctGo('status'); });
      const D = ACCT.data; if (!D) { if (!ACCT.loadingS) acctLoadStatus(ACCT.gen); return; }
      $$('.acct-choose').forEach(b => b.onclick = () => { ACCT.choosing = b.dataset.p; ACCT.log = []; acctGo('status'); setTimeout(() => { const k = $(`.acct-row[data-p="${CSS.escape(b.dataset.p)}"] .acct-keep`); if (k) { k.scrollIntoView({ block: 'center' }); k.focus(); } }, 30); });
      $$('.acct-addhere').forEach(b => b.onclick = () => acctRun(b, async gen => {
        const kid = D.kids.find(k => k.id === b.closest('.acct-row').dataset.c); if (!kid) return;
        ACCT.log = [acctS('restoring', kid.nickname)]; acctSay('.acct-log', ACCT.log[0]);
        const r = await acctAddFromCopy(kid);
        if (!acctLive(gen)) return;
        if (r.ok) { ACCT.restored = { id: r.id, nick: kid.nickname }; ACCT.log = []; ACCT.data = null; ACCT.dataErr = ''; return acctGo('restored'); }
        if (r.error === 'signedout') return acctFail('signedout');
        const nm = kid.nickname;
        ACCT.log = [r.limit ? acctS('restoreFull') : r.empty ? acctS('noBackupYet', nm) : r.newer ? acctS('restoreNewer') : r.bad ? acctS('restoreBad', nm) : r.full ? acctS('restoreSave') : acctErr(r.error)];
        acctDraw(); const x = $('.acct-log'); if (x) x.scrollIntoView({ block: 'center' });
      }));
    },
  },
  // ---- piece 5: after a restore: the two things that were never uploaded (the name on this tablet, typed here and kept here; the voice, chosen in the parent corner)
  restored: {
    html: () => `<section>${acctH('restoredH')}<p role="status">${esc(acctS('restoredOk', (ACCT.restored || {}).nick || ''))}</p>
      <label for="acct-rname">${esc(acctS('nameLabel'))}</label><input id="acct-rname" class="acct-rname" type="text" maxlength="30" autocomplete="off" aria-describedby="acct-rnh">
      <p id="acct-rnh" class="acct-help">${esc(acctS('nameHelp'))}</p><p class="acct-help">${esc(acctS('voiceNote'))}</p>
      <p class="acct-log" role="status" aria-live="polite"></p>
      <div class="acct-nav"><button class="pbtn acct-rnsave2">${esc(acctS('nameSave'))}</button><button class="pbtn alt acct-done">${esc(acctS('doneBtn'))}</button></div></section>`,
    wire: () => {
      const inp = $('.acct-rname'), id = (ACCT.restored || {}).id;
      $('.acct-done').onclick = () => { ACCT.restored = null; ACCT.data = null; ACCT.dataErr = ''; acctGo('status'); };
      $('.acct-rnsave2').onclick = () => {
        const name = inp.value.trim().slice(0, 30);
        try {
          const s = JSON.parse(localStorage.getItem(storeKey(id))); s.settings = s.settings || {}; s.settings.name = name; localStorage.setItem(storeKey(id), JSON.stringify(s));      // this tablet only: no request carries it
          acctSay('.acct-log', acctS('nameSaved'));
        } catch (e) { acctSay('.acct-log', acctS('restoreSave')); }
      };
    },
  },
  // ---- B: signed in
  status: {
    html: () => {
      const st = cloudState(), D = ACCT.data;
      if (!D) return `<section>${acctH('statusH')}${ACCT.dataErr ? `<p class="acct-msg" role="alert">${esc(acctErr(ACCT.dataErr))}</p><button class="pbtn acct-reload">${esc(acctS('tryAgain'))}</button>` : `<p role="status">${esc(acctS('loading'))}</p>`}</section>`;
      const kidOf = p => { const r = acctRec(p); return r ? D.kids.find(k => k.id === r.child) : null; };
      const linked = acctLinked().filter(p => kidOf(p)), un = PROFILES.list.filter(p => !linked.includes(p));
      const mine = new Set(linked.map(p => acctRec(p).child));
      const copies = D.kids.filter(k => !mine.has(k.id));
      // what needs the parent for a linked child: a newer online copy, a restored backup file or earlier progress put back (the choice, with the facts of both sides),
      // a backup that was stopped, and the way back after "Take the online copy"
      const flagsHTML = (p, rec, kid) => {
        const nm = kid.nickname, hold = rec.hold, flag = hold === 'file' ? acctS('rowFile', nm) : hold === 'prev' ? acctS('rowPrev', nm) : rec.conflict ? acctS('rowNewer', nm) : acctS('rowChoose', nm);
        const held = !!(hold || rec.conflict || ACCT.choosing === p.id), f = held ? [acctS(hold ? 'replaceFor' : 'keepFor', nm), acctS(rec.conflict ? 'takeFor' : 'takeOnFor', nm)] : [];
        // neither destructive action is the main one: the prominent button is "Decide later" (it changes nothing); both actions ask a protected question first
        return `${held ? `<div class="acct-choice" role="group" aria-label="${esc(nm)}"><p class="acct-flag" role="status">${esc(flag)}</p><p class="acct-facts">${acctFacts(p, kid)}</p>
            <div class="acct-btns"><button class="pbtn acct-later">${esc(acctS('laterBtn'))}</button><button class="pbtn alt acct-keep" aria-label="${esc(f[0])}">${esc(acctS(hold ? 'replaceBtn' : 'keepBtn'))}</button><button class="pbtn alt acct-take" aria-label="${esc(f[1])}">${esc(acctS(rec.conflict ? 'takeBtn' : 'takeOnBtn'))}</button></div></div>`
          : rec.err ? `<p class="acct-flag acct-errline" role="status">${esc(acctS('errLine', nm, acctErr(rec.err)))}</p>` : ''}
          ${acctHasPrev(p.id) ? `<div class="acct-btns"><button class="pbtn alt acct-putback" aria-label="${esc(acctS('putBackFor', nm))}">${esc(acctS('putBack'))}</button></div>` : ''}`;
      };
      const kidRow = p => {
        const rec = acctRec(p), kid = kidOf(p), last = acctLast(rec.up), editing = ACCT.renaming === p.id;
        return `<div class="acct-row" data-p="${esc(p.id)}"><div class="acct-who"><span class="acct-av" aria-hidden="true">${esc(p.avatar || AVATARS[0])}</span> <b>${esc(acctLabel(p))}</b> <span class="acct-nk">${esc(kid.nickname)}</span>
          <small>${esc(last ? acctS('lastBk', acctTime(last)) : acctS('notYet'))}</small></div>
          ${flagsHTML(p, rec, kid)}
          ${editing ? `<div class="acct-edit"><label for="acct-rn">${esc(acctS('nickLabel'))}</label><input id="acct-rn" class="acct-rn" type="text" maxlength="20" autocomplete="off" placeholder="${esc(acctS('nickPh', acctProfIndex(p)))}" value="${esc(ACCT.nick['~' + p.id] || '')}" aria-describedby="acct-rnm">
            <p id="acct-rnm" class="acct-msg" role="alert"></p><button class="pbtn acct-rnsave">${esc(acctS('saveName'))}</button><button class="pbtn alt acct-rncancel">${esc(acctS('cancel'))}</button></div>`
          : `<button class="pbtn alt acct-chg" aria-label="${esc(acctS('changeFor', acctLabel(p)))}">${esc(acctS('change'))}</button>`}</div>`;
      };
      const unRow = p => `<div class="acct-row" data-p="${esc(p.id)}"><div class="acct-who"><span class="acct-av" aria-hidden="true">${esc(p.avatar || AVATARS[0])}</span> <b>${esc(acctLabel(p))}</b></div>
        <button class="pbtn alt acct-add" aria-label="${esc(acctS('addFor', acctLabel(p)))}">${esc(acctS('add'))}</button></div>`;
      const copyLast = k => { const v = Object.values(k.sections || {}).map(s => s.updated_at).filter(Number.isFinite); return v.length ? Math.max(...v) : null; };
      const copyRow = k => `<div class="acct-row" data-c="${esc(k.id)}"><div class="acct-who"><b class="acct-nk">${esc(k.nickname)}</b>
          <small>${esc(copyLast(k) ? acctS('copyBk', acctTime(copyLast(k))) : acctS('notYet'))}</small></div>
        <button class="pbtn alt acct-delc" aria-label="${esc(acctS('delCopyFor', k.nickname))}">${esc(acctS('delCopy'))}</button></div>`;
      const devLabel = d => (d.current ? acctS('thisTab') : acctS('tabN', String(d.id).slice(-4).toUpperCase()));
      const devRow = d => `<div class="acct-row" data-d="${esc(d.id)}"><div class="acct-who"><b>${esc(devLabel(d))}</b>
          <small>${esc(acctS('ver', d.app_version))} · ${esc(d.last_backup_at ? acctS('devBk', acctTime(d.last_backup_at)) : acctS('devNone'))}</small></div>
        <button class="pbtn alt acct-rmd" aria-label="${esc(acctS('removeFor', devLabel(d)))}">${esc(acctS('remove'))}</button></div>`;
      const askHTML = !ACCT.ask ? '' : (() => {
        const a = ACCT.ask, k = a.kind;
        const txt = k === 'signout' ? acctS('signOutAsk') : k === 'others' ? acctS('othersAsk') : k === 'del1' ? acctS('delAsk1') : k === 'del2' ? acctS('delAsk2', st.email || '')
          : k === 'delcopy' ? acctS('delCopyAsk', a.name) : k === 'keep' ? acctS(a.held ? 'keepHeldAsk' : 'keepAsk', a.name) : k === 'take' ? acctS(a.room === false ? 'takeNoRoom' : 'takeAsk', a.name)
          : k === 'putback' ? acctS('putBackAsk', a.name, a.made ? acctTime(a.made) : acctS('thenW'))
          : (a.current ? acctS('rmThis') : acctS('rmOther', a.label));
        // the facts of both sides sit under the questions of the choice, so the parent can tell the sides apart before confirming
        const askP = PROFILES.list.find(x => x.id === a.pid), askRec = askP && acctRec(askP), askKid = askRec && D.kids.find(x => x.id === askRec.child);
        const facts = (k === 'keep' || k === 'take') && askKid ? `<p class="acct-facts">${acctFacts(askP, askKid)}</p>`
          : k === 'putback' && askP ? `<p class="acct-facts">${acctPutFacts(askP)}</p>` : '';
        const yes = k === 'signout' ? acctS('signOutYes') : k === 'others' ? acctS('othersYes') : k === 'del1' ? acctS('next') : k === 'del2' ? acctS('delYes') : k === 'delcopy' ? acctS('delCopyYes')
          : k === 'keep' ? acctS('keepYes') : k === 'take' ? acctS('takeYes') : k === 'putback' ? acctS('putBackYes') : acctS('rmYes');
        const choiceQ = k === 'keep' || k === 'take' || k === 'putback';
        const yesB = `<button class="pbtn ${choiceQ ? 'alt ' : ''}warn acct-yes" disabled>${esc(yes)}</button>`, noB = `<button class="pbtn ${choiceQ ? '' : 'alt '}acct-no">${esc(acctS('cancel'))}</button>`;
        // the second delete question puts "Cancel" where the first one's "Continue" was and the confirm button on its own row below: a double tap cannot go through.
        // The questions of the choice put the safe answer (Cancel) first and prominent.
        return `<div class="acct-ask" role="group" aria-labelledby="acct-askp" tabindex="-1"><p id="acct-askp">${esc(txt)}</p>${facts}${k === 'del2' ? `${noB}<span class="acct-askrow">${yesB}</span>` : choiceQ ? `${noB}${yesB}` : `${yesB}${noB}`}</div>`;
      })();
      return `<section>${acctH('statusH')}
        <p>${esc(acctS('signedAs', st.email || ''))}${st.daysLeft && st.daysLeft < 7 ? ` ${esc(acctS('daysLeft', st.daysLeft))}` : ''}</p>
        <h4>${esc(acctS('inAcctH'))}</h4>${linked.length ? linked.map(kidRow).join('') : `<p>${esc(acctS('noLinked'))}</p>`}
        ${un.length ? `<h4>${esc(acctS('notInH'))}</h4>${un.map(unRow).join('')}` : ''}
        ${copies.length ? `<h4>${esc(acctS('copiesH'))}</h4><p class="acct-help">${esc(acctS('copiesNote'))}</p>${copies.map(copyRow).join('')}` : ''}
        <div class="acct-btns"><button class="pbtn acct-bk">${esc(acctS('backNow'))}</button><button class="pbtn alt acct-restore">${esc(acctS('restoreBtn'))}</button><button class="pbtn alt acct-dl">${esc(acctS('download'))}</button>
          <button class="pbtn alt acct-so">${esc(acctS('signOut'))}</button><button class="pbtn alt acct-sox">${esc(acctS('signOutOthers'))}</button><button class="pbtn warn acct-del">${esc(acctS('del'))}</button></div>
        ${askHTML}<p class="acct-log" role="status" aria-live="polite">${ACCT.log.map(l => esc(l)).join('<br>')}</p>
        <h4>${esc(acctS('devH'))}</h4>${D.devs.map(devRow).join('')}</section>`;
    },
    wire: () => acctWireStatus(),
  },
};

// ---------------------------------------------------------------- loading
async function acctLoadCountries(gen) {
  if (ACCT.loadingC) return;
  ACCT.countries = null; ACCT.countriesErr = ''; ACCT.loadingC = true;
  const r = await cloudCountries();
  if (gen === ACCT.gen) ACCT.loadingC = false;
  if (!acctLive(gen) || ACCT.view !== 'country') return;
  if (r.ok) ACCT.countries = r.data; else ACCT.countriesErr = r.error;
  if (r.ok && !ACCT.country) ACCT.country = ACCT.guess = acctGuessCountry(r.data);     // pre-selected from the tablet's time zone, only when the parent has chosen nothing yet
  acctDraw();
}
// the account's children and tablets; the link records are settled against what the server has (acctReconcile)
async function acctLoadStatus(gen) {
  if (ACCT.loadingS) return;
  ACCT.data = null; ACCT.dataErr = ''; ACCT.loadingS = true;
  const k = await cloudChildren();
  if (gen === ACCT.gen && !k.ok) ACCT.loadingS = false;
  if (!acctLive(gen) || !['status', 'restore'].includes(ACCT.view)) return;
  if (!k.ok) { if (k.error === 'signedout') return acctFail('signedout'); ACCT.dataErr = k.error; return acctDraw(); }
  const d = await cloudDevices();
  if (gen === ACCT.gen) ACCT.loadingS = false;
  if (!acctLive(gen) || !['status', 'restore'].includes(ACCT.view)) return;
  if (!d.ok) { if (d.error === 'signedout') return acctFail('signedout'); ACCT.dataErr = d.error; return acctDraw(); }
  acctReconcile(k.data);
  ACCT.data = { kids: k.data, devs: d.data };
  acctDraw();
}
async function acctRefresh(gen) {          // after an action: new numbers, and keep the messages
  const k = await cloudChildren(), d = await cloudDevices();
  if (!acctLive(gen) || ACCT.view !== 'status') return;
  if (k.ok && d.ok) { acctReconcile(k.data); ACCT.data = { kids: k.data, devs: d.data }; }
  acctDraw();
}

// ---------------------------------------------------------------- nicknames and children
// -> { nick } or { refuse: text }. Empty means the placeholder ("Child 2"). Refused when it equals OR contains (ignoring case, spaces, accents and punctuation) the name or the
// "spoken as" text of any child on this tablet, for names of 3 letters or more.
function acctCheckNick(p, typed) {
  const nick = acctNickOf(p, typed);
  if (!String(typed || '').trim()) return { nick };
  const n = acctNorm(nick);
  if (acctNames().some(x => n.includes(x))) return { refuse: acctS('nameRefused') };
  return { nick };
}
// ---------------------------------------------------------------- stamps: what this tablet believes, and what the server holds
// this tablet's own stamp of each section (S.stamp, 0 when it never changed), the stamps the link record believes the server has (null: no row), and the same read from a child of cloudChildren
const acctStampsOf = save => { const st = save && save.stamp && typeof save.stamp === 'object' ? save.stamp : {}, o = {}; for (const n of CLOUD_SECTIONS_LIST) o[n] = Number.isFinite(st[n]) ? st[n] : 0; return o; };
const acctExpectOf = rec => { const o = {}; for (const n of CLOUD_SECTIONS_LIST) { const v = (rec.up || {})[n]; o[n] = Number.isFinite(v) ? v : null; } return o; };
const acctServerOf = kid => { const o = {}; for (const n of CLOUD_SECTIONS_LIST) { const s = kid && kid.sections ? kid.sections[n] : null; o[n] = s && Number.isFinite(s.updated_at) ? s.updated_at : null; } return o; };
const acctSame = (a, b) => CLOUD_SECTIONS_LIST.every(n => (a[n] === undefined ? null : a[n]) === (b[n] === undefined ? null : b[n]));
// the sections whose stamp on this tablet is not what it was at the last upload or restore ("differs", not "is greater": a reset or a restore may lower a stamp)
const acctChanged = (save, rec) => { const now = acctStampsOf(save), at = rec.at || null; return CLOUD_SECTIONS_LIST.filter(n => !at || at[n] !== now[n]); };
// the record with the flags of a finished backup or choice: stamps in place, no conflict, no hold, no error
const acctClean = (rec, up, at, fmt) => ({ child: rec.child, up, uid: rec.uid, at, ...(Number.isInteger(fmt) ? { fmt } : {}) });
// Does every section on the server (as far as this tablet knows) hold the current format? `fmt` of the link = the format of the last full upload or restore; `kid` (from cloudChildren) shows the
// formats the server really has. Anything else, and the next backup sends ALL eight sections, so no copy is left with mixed formats (which "Take" and "Restore" refuse) after a format change.
const acctFormatOk = (rec, kid) => rec.fmt === CLOUD_FORMAT && !CLOUD_SECTIONS_LIST.some(n => { const s = kid && kid.sections ? kid.sections[n] : null; return !!s && Number.isInteger(s.format) && s.format !== CLOUD_FORMAT; });
// A conditional upload answered "newer": mark the child, unless the link record was already brought up to date meanwhile by another run on this tablet
// (a manual backup and an automatic one at the same time): then the server's answer is simply what that run wrote.
function acctNewer(p, detail) {
  const fresh = linkGet(p.id);
  if (!fresh) return;
  if (detail && detail.stamps && acctSame(acctExpectOf(fresh), detail.stamps)) return false;
  linkSet(p.id, { ...fresh, conflict: true });
  return true;
}
// one child's backup. -> { ok, at, sent } | { newer } | { retry } | { held } | { error } . `forced`: the server's own stamps (read just now): all eight sections are sent with them as
// `expect`, ignoring a conflict or a hold (only the parent's choice "Keep this tablet's" / "Replace the online copy" does that).
// `kid` (optional): the child as cloudChildren just showed it, for the formats on the server.
// The link record is read again AFTER the upload (it may have changed while the request was out: a hold set by a restored file, the profile removed): the answer only updates up / at / fmt
// and clears conflict / err; it never clears a hold that appeared meanwhile, and never recreates a record that is gone.
async function acctBackupOne(p, rec, forced, kid) {
  if (!rec) return { error: 'refused', gone: true };                 // the link record is gone (dropped meanwhile): nothing is uploaded
  if (rec.hold && !forced) return { held: true };
  if (rec.conflict && !forced) return { newer: true };
  const save = acctSaveOf(p); if (!save) return { error: 'refused', readFail: true };
  const sections = cloudSections(save), at = acctStampsOf(save), names = (forced || !acctFormatOk(rec, kid)) ? CLOUD_SECTIONS_LIST : acctChanged(save, rec);      // sections and stamps from the same instant
  if (!names.length) return { ok: true, at: acctLast(rec.up) || Date.now(), sent: false };
  const r = await cloudUpload(rec.child, sections, names, forced || acctExpectOf(rec));
  if (!r.ok) {
    if (r.error === 'newer') { const flagged = acctNewer(p, r.detail); return flagged === false ? { retry: true } : { newer: true }; }
    if (['toobig', 'private', 'refused'].includes(r.error)) { const fresh = linkGet(p.id); if (fresh && fresh.child === rec.child && fresh.uid === rec.uid) linkSet(p.id, { ...fresh, err: r.error }); }
    return { error: r.error };
  }
  const fresh = linkGet(p.id), when = acctLast(r.data.stamps) || Date.now();
  if (!fresh || fresh.child !== rec.child || fresh.uid !== rec.uid) return { ok: true, at: when, sent: true, gone: true };       // removed or re-linked meanwhile: write nothing
  const next = { ...fresh, up: r.data.stamps, at };
  if (names.length === CLOUD_SECTIONS_LIST.length) next.fmt = CLOUD_FORMAT;
  delete next.conflict; delete next.err;
  if (forced) delete next.hold;                                   // the parent's choice "Keep this tablet's" / "Replace the online copy": all eight went up, the hold is resolved
  else if (fresh.hold) next.at = fresh.at;                            // a hold appeared during the flight: keep the old `at`, so the held save still counts as changed (and a later "Replace" sends everything)
  linkSet(p.id, next);
  return { ok: true, at: when, sent: true };
}

// ---------------------------------------------------------------- automatic backup (silent: no element, sound, focus change or message on any child's screen, whatever happens)
// Called by autoBackup() in app.js, never awaited: at app open (open = true) and after a finished activity. Everything here swallows every error.
//  - only when signed in, online, and the playing child has a link of the signed-in account and no hold;
//  - at app open ONE cloudChildren() first, so a newer online copy is noticed even when nothing changed here (it sets `conflict`); after an activity straight to the
//    conditional upload (one request: the server notices a conflict itself);
//  - one run at a time; a call during a run, or inside ACCT_AUTO_GAP_MS of the last one, sets a flag and ONE later run follows (a single timer for the end of the gap, never a retry);
//  - signedout just stops; offline, server, throttled: nothing, the next trigger tries again; toobig, private, refused: remembered in the link record (`err`) for the account screen.
function acctAutoLater() {
  const A = ACCT.auto;
  if (A.timer || A.running) return;
  A.timer = setTimeout(() => { A.timer = 0; if (A.again) { const o = A.open; A.again = false; A.open = false; acctAuto(o); } }, Math.max(50, A.last + ACCT_AUTO_GAP_MS - Date.now() + 20));
}
function acctAuto(open) {
  try {
    const A = ACCT.auto;
    if (A.running || Date.now() - A.last < ACCT_AUTO_GAP_MS) { A.again = true; A.open = A.open || open === true; acctAutoLater(); return; }
    const st = cloudState();
    if (!st.on || !st.signedIn || navigator.onLine === false) return;
    if (!acctConsentCurrent()) return;                                  // an outdated (or never confirmed) consent: nothing goes up until the parent has opened the account
    const p = curProfile(), rec = p && acctRec(p);
    if (!rec || rec.hold) return;
    A.running = true; A.last = Date.now();
    acctAutoRun(p, open === true).catch(() => {}).then(() => { A.running = false; if (A.again) acctAutoLater(); });
  } catch (e) { /* never into a child's screen */ }
}
async function acctAutoRun(p, open) {
  try {
    let rec = acctRec(p), kidSeen = null;
    if (!rec) return;
    if (open) {
      const k = await cloudChildren();
      if (!k.ok) return;
      acctReconcile(k.data);
      rec = acctRec(p); if (!rec || rec.hold) return;
      const kid = k.data.find(x => x.id === rec.child); if (!kid) return;
      kidSeen = kid;
      if (!acctSame(acctServerOf(kid), acctExpectOf(rec))) { linkSet(p.id, { ...rec, conflict: true }); return; }       // somebody else wrote since this tablet's last backup
    }
    if (rec.conflict || rec.hold) return;
    await new Promise(r => setTimeout(r, 50));            // the snapshot is taken in a later turn, never in the caller's
    rec = acctRec(p); if (!rec || rec.conflict || rec.hold) return;
    const b = await acctBackupOne(p, rec, false, kidSeen);
    if (b.sent) await cloudDevice(APP_VERSION, true);
  } catch (e) { /* silent */ }
}
async function acctSaveChildren(gen) {
  const rows = (ACCT.only ? PROFILES.list.filter(p => p.id === ACCT.only) : acctUnlinked()), todo = [];
  let bad = false;
  for (const p of rows) {
    if (ACCT.tick[p.id] === false) continue;
    const c = acctCheckNick(p, ACCT.nick[p.id]), box = $(`.acct-kid[data-p="${CSS.escape(p.id)}"]`);
    if (c.refuse) { acctSay('.acct-msg', c.refuse, box); if (!bad) { const i = $('.acct-nick', box); if (i) i.focus(); } bad = true; } else { acctSay('.acct-msg', '', box); todo.push([p, c.nick]); }
  }
  if (bad) return;                                       // nothing is sent while any nickname is refused
  ACCT.log = []; let anyOk = false;
  const uid = acctUid();
  for (const [p, nick] of todo) {
    const save = acctSaveOf(p) || {}, id = cloudNewId(), line = $('.acct-log');
    if (line) line.textContent = acctS('backing', nick);
    // the link is written FIRST, marked pending, so leaving the screen (or a lost answer) cannot leave a child on the server that this tablet knows nothing about:
    // the next status load completes the record if the child is there and drops it if not (acctReconcile)
    if (!linkSet(p.id, { child: id, up: {}, uid, pending: true })) { ACCT.log.push(acctS('notBacked', nick, acctS('linkFail'))); continue; }
    const r = await cloudPutChild({ id, nickname: nick, avatar: p.avatar || AVATARS[0], lang: save.lang === 'fr' ? 'fr' : 'en' });
    if (!r.ok) { if (acctLive(gen) && r.error === 'signedout') return acctFail('signedout'); ACCT.log.push(acctS('notBacked', nick, acctErr(r.error))); if (r.error === 'limit') break; continue; }
    if (!linkSet(p.id, { child: id, up: {}, uid })) { await cloudDeleteChild(id); linkDrop(p.id); ACCT.log.push(acctS('notBacked', nick, acctS('linkFail'))); continue; }   // done even when the screen was left
    if (!acctLive(gen)) return;
    const b = await acctBackupOne(p, acctRec(p), null);
    if (!acctLive(gen)) return;
    if (b.ok && b.sent) anyOk = true;
    ACCT.log.push(b.ok ? acctS('backedUp', nick, acctTime(b.at)) : acctS('notBacked', nick, acctErr(b.error || 'refused')));
    if (b.error === 'signedout') return acctFail('signedout');
  }
  if (anyOk) await cloudDevice(APP_VERSION, true);       // the database stamps this tablet's last backup
  if (!acctLive(gen)) return;
  ACCT.only = null; ACCT.renaming = null; ACCT.ask = null; ACCT.data = null; ACCT.dataErr = '';
  acctGo('status');
}

// ---------------------------------------------------------------- the choice: this tablet's progress or the online copy
const acctPrevKey = id => 'tiko.prev.' + id;                       // one slot per profile: this tablet's progress as it was just before "Take the online copy" (kept until overwritten; dropped with the profile)
const acctHasPrev = id => { try { return localStorage.getItem(acctPrevKey(id)) !== null; } catch (e) { return false; } };
const acctMap8 = m => { const o = {}; for (const n of CLOUD_SECTIONS_LIST) o[n] = m && Number.isFinite(m[n]) ? m[n] : null; return o; };
function acctDayText(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '')); if (!m) return String(key || '');
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(ACCT.lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
// the two lines that let the parent tell the sides apart: days played here and the last one; for the online copy, when it was written and by which tablet
function acctFacts(p, kid) {
  const save = acctSaveOf(p) || {}, keys = Object.keys(save.days || {}).sort(), me = cloudState().device;
  let best = null;
  for (const n of CLOUD_SECTIONS_LIST) { const s = kid && kid.sections ? kid.sections[n] : null; if (s && Number.isFinite(s.updated_at) && (!best || s.updated_at > best.updated_at)) best = s; }
  const who = !best ? acctS('whoOther') : !best.device_id ? acctS('whoOther') : best.device_id === me ? acctS('whoThis') : acctS('whoTab', String(best.device_id).slice(-4).toUpperCase());
  return `${esc(acctS('thisSide', keys.length, acctDayText(keys[keys.length - 1])))}<br>${esc(best ? acctS('onlineSide', acctTime(best.updated_at), who) : acctS('notYet'))}`;
}
// the online copy -> a save this tablet can use, or why not. Refuses (and the caller changes nothing) when a section is missing or was changed by the check, when the formats
// differ between sections, or when a format is newer than this app knows.
function acctValidate(dl) {
  if (!dl || !dl.sections || !dl.formats) return { bad: 'bad' };
  const have = CLOUD_SECTIONS_LIST.filter(n => dl.sections[n]);
  if (!have.length) return { bad: 'empty' };
  const fm = have.map(n => dl.formats[n]);
  if (fm.some(f => Number.isInteger(f) && f > CLOUD_FORMAT)) return { bad: 'newer' };
  if (new Set(fm).size !== 1 || !Number.isInteger(fm[0]) || fm[0] < 1) return { bad: 'bad' };
  const r = fromCloudSections(dl.sections, dl.stamps || {}, fm[0]);
  if (r.missing.length || r.rejected.length) return { bad: 'bad' };
  return { save: r.save, fmt: fm[0] };
}
// the earlier progress on the shelf (tiko.prev.<id>): when it was set aside, and what it holds, for the questions (null when there is none)
function acctPrevInfo(id) {
  try {
    const t = localStorage.getItem(acctPrevKey(id)); if (t === null) return null;
    const s = JSON.parse(t) || {}, days = Object.keys(s.days || {}).sort();
    let made = null; try { made = (JSON.parse(localStorage.getItem('tiko.prevmeta.' + id)) || {}).made; } catch (e) { /* ignore */ }
    return { n: days.length, last: days[days.length - 1], made: Number.isFinite(made) ? made : null };
  } catch (e) { return null; }
}
const acctPutFacts = p => { const save = acctSaveOf(p) || {}, keys = Object.keys(save.days || {}).sort(), pv = acctPrevInfo(p.id) || { n: 0 };
  return `${esc(acctS('thisSide', keys.length, acctDayText(keys[keys.length - 1])))}<br>${esc(acctS('prevSide', pv.n, acctDayText(pv.last)))}`; };
// what stays of this tablet when the online copy is taken: its private settings (SAVE_PRIVATE_SETTINGS) and everything in SAVE_LOCAL except the stamps (which are the server's now)
function acctCarry(next, local) {
  local = local || {}; next.settings = next.settings || {};
  const ls = local.settings && typeof local.settings === 'object' ? local.settings : {};
  for (const k of SAVE_PRIVATE_SETTINGS) { if (Object.prototype.hasOwnProperty.call(ls, k)) next.settings[k] = ls[k]; else delete next.settings[k]; }
  for (const k of SAVE_LOCAL) { if (k === 'stamp') continue; if (local[k] !== undefined) next[k] = structuredClone(local[k]); else delete next[k]; }
  return next;
}
// the playing child's save is replaced in memory without calling save() (which would stamp every changed section as "now") and the app's idea of "what was saved last" follows
function acctAdopt(next) { S = next; lastSnap = sectionSnap(S); path = null; applySettings(); }
function acctProbe(len) {
  try { localStorage.setItem('tiko.probe', 'x'.repeat(Math.max(1, len))); localStorage.removeItem('tiko.probe'); return true; } catch (e) { try { localStorage.removeItem('tiko.probe'); } catch (e2) { /* ignore */ } return false; }
}
// is there room to keep this child's progress aside? (asked before the parent confirms)
function acctRoomForPrev(p) { try { const t = localStorage.getItem(storeKey(p.id)); return acctProbe((t === null ? JSON.stringify(acctSaveOf(p) || {}) : t).length); } catch (e) { return false; } }

// "Take the other one's" / "Take the online copy": -> { ok } | { bad } | { newer } | { full } | { error }. Nothing is changed unless everything before the write has worked; the earlier progress is kept aside first.
async function acctTake(p) {
  const rec0 = acctRec(p); if (!rec0) return { error: 'refused' };
  const dl = await cloudDownload(rec0.child);
  if (!dl.ok) return { error: dl.error };
  const rec = acctRec(p);                                                                            // the record as it is now (the download took a while)
  if (!rec || rec.child !== rec0.child) return { error: 'refused' };
  const v = acctValidate(dl.data);
  if (v.bad) return { [v.bad === 'newer' ? 'newer' : 'bad']: true };
  const playing = p.id === PROFILES.current, local = playing ? S : loadSaveOf(p.id);
  let old = null; try { old = localStorage.getItem(storeKey(p.id)); } catch (e) { /* ignore */ }
  const oldText = old !== null ? old : JSON.stringify(local || {});
  // the same defaults and upgrades as any other save (a setting an older app did not know is filled in; the one-off flags come from the sections, so nothing is undone)
  const next = upgradeSave(withDefaults(acctCarry(v.save, local))), text = JSON.stringify(next), pk = acctPrevKey(p.id), had = acctHasPrev(p.id);
  try { localStorage.setItem(pk, oldText); } catch (e) { return { full: true } }                      // never replace what cannot be put back
  try { localStorage.setItem(storeKey(p.id), text); } catch (e) { if (!had) { try { localStorage.removeItem(pk); } catch (e2) { /* ignore */ } } return { full: true }; }
  try { localStorage.setItem('tiko.prevmeta.' + p.id, JSON.stringify({ made: Date.now() })); } catch (e) { /* the date is only for the question */ }
  if (playing) acctAdopt(next);
  linkSet(p.id, acctClean(rec, acctMap8(dl.data.stamps), acctStampsOf(next), v.fmt));
  return { ok: true };
}
// "Put back this tablet's earlier progress" is a SWAP: the progress on this tablet now goes on the shelf and the earlier progress comes back, so it can always be undone by doing it again.
// If the shelf cannot be written nothing is changed. The earlier save comes back exactly as it was written; nothing is uploaded until the parent chooses (hold 'prev').
function acctPutBack(p) {
  const rec = acctRec(p); if (!rec) return { error: 'refused' };
  const pk = acctPrevKey(p.id);
  let text = null, cur = null; try { text = localStorage.getItem(pk); cur = localStorage.getItem(storeKey(p.id)); } catch (e) { /* ignore */ }
  if (text === null) return { error: 'refused' };
  let obj = null; try { obj = JSON.parse(text); } catch (e) { /* ignore */ }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'refused' };
  const curText = cur !== null ? cur : JSON.stringify(acctSaveOf(p) || {});
  try { localStorage.setItem(pk, curText); } catch (e) { return { full: true }; }                    // the progress of now goes on the shelf first
  try { localStorage.setItem(storeKey(p.id), text); } catch (e) { try { localStorage.setItem(pk, text); } catch (e2) { /* ignore */ } return { full: true }; }
  try { localStorage.setItem('tiko.prevmeta.' + p.id, JSON.stringify({ made: Date.now() })); } catch (e) { /* ignore */ }
  if (p.id === PROFILES.current) { const s = upgradeSave(withDefaults(obj)); S = s; lastSnap = sectionSnap(S); path = null; applySettings(); }
  const next = { ...rec, hold: 'prev' }; delete next.conflict; delete next.err;
  linkSet(p.id, next);
  return { ok: true };
}
// "Keep this tablet's" / "Replace the online copy": the server's stamps are read now and become `expect`; all eight sections go up
async function acctKeep(p) {
  if (!acctRec(p)) return { error: 'refused' };
  const k = await cloudChildren();
  if (!k.ok) return { error: k.error };
  const rec = acctRec(p); if (!rec) return { error: 'refused' };                                     // read again after the wait
  const kid = k.data.find(x => x.id === rec.child);
  if (!kid) { linkDrop(p.id); return { gone: true }; }
  const b = await acctBackupOne(p, rec, acctServerOf(kid), kid);
  if (b.ok) { await cloudDevice(APP_VERSION, true); return { ok: true }; }
  return b.newer || b.retry ? { newer: true } : { error: b.error || 'refused', readFail: b.readFail };
}
// Restore a child: an online copy that no profile here is linked to becomes a NEW profile (the playing child and S are not touched). -> { ok, id } | { empty } | { full } | { bad } | { newer } | { error }
async function acctAddFromCopy(kid) {
  if (PROFILES.list.length >= 8) return { limit: true };
  if (!kid || !kid.sections || !Object.keys(kid.sections).length) return { empty: true };
  const dl = await cloudDownload(kid.id);
  if (!dl.ok) return { error: dl.error };
  const v = acctValidate(dl.data);
  if (v.bad === 'empty') return { empty: true };
  if (v.bad) return { [v.bad === 'newer' ? 'newer' : 'bad']: true };
  const id = 'c' + Math.random().toString(36).slice(2, 10), used = PROFILES.list.map(x => x.avatar), save = v.save, st = S.settings;
  for (const k of ['rate', 'pitch', 'pitch_fr', 'voice_en', 'voice_fr']) if (st[k] !== undefined) save.settings[k] = st[k];       // this tablet's voice, as for any child added here (the name stays empty)
  save.settings.pitchV17 = true; save.settings.name = ''; save.settings.nameSay = '';
  const avatar = AVATARS.includes(kid.avatar) ? kid.avatar : (AVATARS.find(a => !used.includes(a)) || AVATARS[0]);
  try { localStorage.setItem(storeKey(id), JSON.stringify(save)); } catch (e) { return { full: true }; }
  const undo = () => { try { localStorage.removeItem(storeKey(id)); } catch (e) { /* ignore */ } };
  if (!linkSet(id, { child: kid.id, up: acctMap8(dl.data.stamps), uid: acctUid(), at: acctStampsOf(save), fmt: v.fmt })) { undo(); return { full: true }; }
  PROFILES.list.push({ id, avatar });
  if (!saveProfiles()) { PROFILES.list.pop(); linkDrop(id); undo(); return { full: true }; }     // the list of children must be written, or the new save would be orphaned
  return { ok: true, id };
}

// ---------------------------------------------------------------- notes for the parent corner (from the link records alone: no request)
// -> '' or the text of one sentence in both languages (the parent corner itself is in English; this screen is bilingual)
const acctBoth = (key, ...a) => `<span lang="en">${esc(ACCT_T.en[key] instanceof Function ? ACCT_T.en[key](...a) : ACCT_T.en[key])}</span> <span lang="fr">${esc(ACCT_T.fr[key] instanceof Function ? ACCT_T.fr[key](...a) : ACCT_T.fr[key])}</span>`;
function acctNote(kind, profileId) {
  try {
    if (kind === 'paused') return Object.hasOwn(LINK_MEMHOLD, profileId) ? acctBoth('pausedNote') : '';           // a hold that could only be kept in memory
    const r = linkGet(profileId); if (!r || r.pending) return '';
    if (kind === 'reset') {
      // the address only when the record belongs to the account signed in now; a child waiting for a choice is not uploaded until the parent chooses
      const st = cloudState(), mine = st.signedIn && r.uid === st.uid;
      return r.hold || r.conflict ? acctBoth('resetNoteHeld') : acctBoth('resetNote', mine ? st.email || '' : '');
    }
    if (kind === 'remove') return acctBoth('removeNote');
  } catch (e) { /* ignore */ }
  return '';
}
// one line per child that needs the parent (a newer online copy, a held backup), and one when backups wait for a sign-in
function acctSectionLines() {
  const out = [];
  try {
    const st = cloudState(), saveOf = p => (p.id === PROFILES.current ? S : loadSaveOf(p.id));
    let waiting = false;
    for (const p of PROFILES.list) {
      const r = linkGet(p.id); if (!r || r.pending) continue;
      const label = (String(((saveOf(p) || {}).settings || {}).name || '').trim()) || `${S.lang === 'fr' ? 'Enfant' : 'Child'} ${PROFILES.list.indexOf(p) + 1}`;
      if (st.signedIn && r.uid && r.uid !== st.uid) continue;
      if (r.hold) out.push(acctBoth(r.hold === 'prev' ? 'secPrev' : 'secHold', label)); else if (r.conflict) out.push(acctBoth('secNewer', label));
      if (!st.signedIn && r.at && !r.hold && acctChanged(saveOf(p) || {}, r).length) waiting = true;
    }
    if (waiting) out.push(acctBoth('secWaiting'));
    if (st.signedIn && !acctConsentCurrent() && PROFILES.list.some(p => { const r = linkGet(p.id); return r && !r.pending && r.uid === st.uid; })) out.push(acctBoth('secConsent'));
  } catch (e) { /* ignore */ }
  return out;
}

// ---------------------------------------------------------------- the status screen's buttons
function acctWireStatus() {
  const rl = $('.acct-reload'); if (rl) rl.onclick = () => { ACCT.dataErr = ''; acctDraw(); acctLoadStatus(ACCT.gen); };
  if (!ACCT.data && !ACCT.dataErr && !ACCT.loadingS) acctLoadStatus(ACCT.gen);      // arriving at the status with no numbers yet: fetch them
  if (!ACCT.data) return;
  const D = ACCT.data;
  const kidRec = el => { const pid = el.closest('.acct-row').dataset.p; return [PROFILES.list.find(p => p.id === pid), pid]; };
  $$('.acct-chg').forEach(b => b.onclick = () => { const [, pid] = kidRec(b); ACCT.renaming = pid; ACCT.ask = null; acctDraw(); const i = $('.acct-rn'); if (i) i.focus(); });
  $$('.acct-rncancel').forEach(b => b.onclick = () => { const [, pid] = kidRec(b); ACCT.renaming = null; acctDraw(); const c = $(`.acct-row[data-p="${CSS.escape(pid)}"] .acct-chg`); if (c) c.focus(); });
  const rn = $('.acct-rn');
  if (rn) { const [p, pid] = kidRec(rn); rn.oninput = () => { ACCT.nick['~' + pid] = rn.value; acctSay('.acct-msg', '', rn.closest('.acct-edit')); };
    const sv = $('.acct-rnsave'); sv.onclick = () => acctRun(sv, async gen => {
      const typed = ACCT.nick['~' + pid], box = rn.closest('.acct-edit');
      if (!String(typed || '').trim()) { acctSay('.acct-msg', acctS('nickEmpty'), box); rn.focus(); return; }       // a rename never silently becomes "Child N"
      const c = acctCheckNick(p, typed);
      if (c.refuse) { acctSay('.acct-msg', c.refuse, box); rn.focus(); return; }
      const rec = acctRec(p), save = acctSaveOf(p) || {};
      if (!rec) return;
      const r = await cloudPutChild({ id: rec.child, nickname: c.nick, avatar: p.avatar || AVATARS[0], lang: save.lang === 'fr' ? 'fr' : 'en' });
      if (!acctLive(gen)) return;
      if (!r.ok) { if (r.error === 'signedout') return acctFail('signedout'); acctSay('.acct-msg', acctErr(r.error), box); return; }
      ACCT.renaming = null; ACCT.nick['~' + pid] = ''; ACCT.log = [acctS('renamed')]; await acctRefresh(gen);
    }); }
  $$('.acct-add').forEach(b => b.onclick = () => { const [, pid] = kidRec(b); ACCT.only = pid; ACCT.log = []; delete ACCT.tick[pid]; ACCT.nick[pid] = ''; acctGo('children'); });
  // a question: its confirm button is dead for ACCT_ASK_MS, and a second delete question looks different from the first (see askHTML)
  const ask = (kind, extra, opener) => { ACCT.ask = { kind, at: Date.now(), opener, ...extra }; acctDraw(); const a = $('.acct-ask'); if (a) { a.focus(); a.scrollIntoView({ block: 'center' }); } };
  $('.acct-so').onclick = () => ask('signout', {}, '.acct-so');
  $('.acct-sox').onclick = () => ask('others', {}, '.acct-sox');
  $('.acct-del').onclick = () => ask('del1', {}, '.acct-del');
  $$('.acct-rmd').forEach(b => b.onclick = () => { const id = b.closest('.acct-row').dataset.d, d = D.devs.find(x => x.id === id); ask('rmdev', { id, current: !!(d && d.current), label: acctS('tabN', String(id).slice(-4).toUpperCase()) }, `.acct-row[data-d="${CSS.escape(id)}"] .acct-rmd`); });
  $$('.acct-delc').forEach(b => b.onclick = () => { const id = b.closest('.acct-row').dataset.c, k = D.kids.find(x => x.id === id); ask('delcopy', { id, name: k ? k.nickname : '' }, `.acct-row[data-c="${CSS.escape(id)}"] .acct-delc`); });
  // the choice (piece 5): each button opens a protected question
  const choiceAsk = (kind, b, withRoom) => { const [p, pid] = kidRec(b), kid = D.kids.find(x => x.id === (acctRec(p) || {}).child);
    ask(kind, { pid, name: kid ? kid.nickname : '', held: !!(acctRec(p) || {}).hold, made: kind === 'putback' ? (acctPrevInfo(pid) || {}).made : null, ...(withRoom ? { room: acctRoomForPrev(p) } : {}) }, `.acct-row[data-p="${CSS.escape(pid)}"] .${b.className.split(' ').find(c => /^acct-(keep|take|putback)$/.test(c))}`); };
  $$('.acct-keep').forEach(b => b.onclick = () => choiceAsk('keep', b));
  $$('.acct-take').forEach(b => b.onclick = () => choiceAsk('take', b, true));
  $$('.acct-putback').forEach(b => b.onclick = () => choiceAsk('putback', b));
  $$('.acct-later').forEach(b => b.onclick = () => { const pid = b.closest('.acct-row').dataset.p; ACCT.choosing = null; ACCT.ask = null; ACCT.log = []; acctDraw(); const r = $(`.acct-row[data-p="${CSS.escape(pid)}"] .acct-chg`); if (r) r.focus(); });
  $('.acct-restore').onclick = () => { ACCT.log = []; ACCT.ask = null; acctGo('restore'); };
  const a0 = ACCT.ask;
  if (a0) {
    const syncAsk = ACCT.sync = () => { const y = $('.acct-yes'); if (y) y.disabled = ACCT.busy || Date.now() - a0.at < ACCT_ASK_MS || a0.room === false; };
    syncAsk(); const left = a0.at + ACCT_ASK_MS - Date.now(); if (left > 0) setTimeout(() => { if (ACCT.ask === a0 && $('.acct-yes')) acctSyncBusy(); }, left + 30);
  }
  const no = $('.acct-no'); if (no) no.onclick = () => { const o = ACCT.ask && ACCT.ask.opener; ACCT.ask = null; acctDraw(); const x = o && $(o); if (x) x.focus(); };
  const yes = $('.acct-yes'); if (yes) yes.onclick = () => {
    const a = ACCT.ask;
    if (!a || Date.now() - a.at < ACCT_ASK_MS || a.room === false) return;
    if (a.kind === 'del1') { ACCT.ask = { kind: 'del2', at: Date.now(), opener: a.opener }; acctDraw(); const x = $('.acct-ask'); if (x) { x.focus(); x.scrollIntoView({ block: 'center' }); } return; }
    acctRun(yes, async gen => {
      if (a.kind === 'keep' || a.kind === 'take' || a.kind === 'putback') {
        const p = PROFILES.list.find(x => x.id === a.pid), nm = a.name; ACCT.ask = null;
        if (!p || !acctRec(p)) { ACCT.log = [acctS('gone', nm)]; await acctRefresh(gen); return; }
        const r = a.kind === 'keep' ? await acctKeep(p) : a.kind === 'take' ? await acctTake(p) : acctPutBack(p);
        if (!acctLive(gen)) return;
        if (r.error === 'signedout') return acctFail('signedout');
        const done = a.kind === 'keep' ? 'keptDone' : a.kind === 'take' ? 'tookDone' : 'putDone';
        if (r.ok) ACCT.choosing = null;
        ACCT.log = [r.ok ? acctS(done, nm) : r.gone ? acctS('gone', nm) : r.newer ? (a.kind === 'take' ? acctS('takeNewer') : acctS('newer', nm)) : r.bad ? acctS('takeBad') : r.full ? acctS('takeSave') : acctErr(r.error || 'refused')];
        await acctRefresh(gen); return;
      }
      if (a.kind === 'signout') {
        await cloudSignOut(); if (!acctLive(gen)) return;
        acctReset(); ACCT.note = 'signedOut'; acctGo('info'); return;
      }
      if (a.kind === 'others') {
        const r = await cloudSignOutOthers(); if (!acctLive(gen)) return;
        ACCT.ask = null; if (!r.ok && r.error === 'signedout') return acctFail('signedout');
        ACCT.log = [r.ok ? acctS('othersDone') : acctErr(r.error)]; acctDraw(); return;
      }
      if (a.kind === 'del2') {
        const uid = acctUid(), r = await cloudDeleteAccount(); if (!acctLive(gen)) return;
        if (!r.ok) { ACCT.ask = null; if (r.error === 'signedout') return acctFail('signedout'); ACCT.log = [acctErr(r.error)]; acctDraw(); return; }
        for (const [id, rec] of Object.entries(linkAll())) if (rec && rec.uid === uid) linkDrop(id);        // only this account's records; another account's stay
        acctReset(); ACCT.note = 'deleted'; acctGo('info'); return;
      }
      if (a.kind === 'delcopy') {
        const r = await cloudDeleteChild(a.id); if (!acctLive(gen)) return;
        ACCT.ask = null; if (!r.ok) { if (r.error === 'signedout') return acctFail('signedout'); ACCT.log = [acctErr(r.error)]; acctDraw(); return; }
        ACCT.log = [acctS('copyDeleted')]; await acctRefresh(gen); return;
      }
      if (a.kind === 'rmdev') {
        const r = await cloudRemoveDevice(a.id); if (!acctLive(gen)) return;
        if (!r.ok) { ACCT.ask = null; if (r.error === 'signedout') return acctFail('signedout'); ACCT.log = [acctErr(r.error)]; acctDraw(); return; }
        if (a.current) { await cloudSignOut(); if (!acctLive(gen)) return; acctReset(); ACCT.note = 'removedThis'; acctGo('info'); return; }
        ACCT.ask = null; ACCT.log = [acctS('removedOther')]; await acctRefresh(gen);
      }
    });
  };
  const bk = $('.acct-bk'); bk.onclick = () => acctRun(bk, async gen => { await acctBackupAll(gen); });
  const dl = $('.acct-dl'); dl.onclick = () => acctRun(dl, async gen => {
    const r = await cloudExport(); if (!acctLive(gen)) return;
    if (!r.ok) { if (r.error === 'signedout') return acctFail('signedout'); ACCT.log = [acctErr(r.error)]; acctDraw(); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' })); a.download = 'tiko-account-data.json';
    document.body.appendChild(a); a.click(); a.remove();
    ACCT.log = [acctS('downloaded')]; acctDraw();
  });
}
async function acctBackupAll(gen) {
  ACCT.ask = null; ACCT.log = [];
  const logEl = () => $('.acct-log'), show = () => { const e = logEl(); if (e) e.innerHTML = ACCT.log.map(l => esc(l)).join('<br>'); };
  if (!acctLinked().length) { ACCT.log = [acctS('noLinked')]; show(); return; }
  let anyOk = false;
  const kids = await cloudChildren();                   // one read for all: which child is gone, and where the server stands (the upload itself is checked by the server, atomically)
  if (!acctLive(gen)) return;
  if (!kids.ok) { if (kids.error === 'signedout') return acctFail('signedout'); ACCT.log.push(acctErr(kids.error)); show(); return; }
  for (const p of acctLinked()) {
    let rec = acctRec(p); if (!rec) continue;
    const label = acctLabel(p), kid = kids.data.find(k => k.id === rec.child);
    if (!kid) { linkDrop(p.id); ACCT.log.push(acctS('gone', label)); show(); continue; }     // gone from the server: nothing is sent to it
    const nick = kid.nickname;
    // another tablet wrote since this tablet's last backup: mark the child and upload nothing for it (a held child, below, is not touched either)
    if (!rec.hold && !rec.conflict && !acctSame(acctServerOf(kid), acctExpectOf(rec))) { linkSet(p.id, { ...rec, conflict: true }); rec = acctRec(p); }
    ACCT.log.push(acctS('backing', nick)); show();
    let b = await acctBackupOne(p, rec, null, kid);
    if (b.retry) { rec = acctRec(p); if (rec) b = await acctBackupOne(p, rec, null, kid); }
    if (!acctLive(gen)) return;
    ACCT.log.pop();
    if (b.error === 'signedout') return acctFail('signedout');
    if (b.ok && b.sent) anyOk = true;
    ACCT.log.push(b.ok ? acctS('backedUp', nick, acctTime(b.at)) : b.held ? acctS('heldNow', nick) : b.newer ? acctS('newer', nick) : b.retry ? acctErr('server') : acctS('notBacked', nick, b.readFail ? acctS('readFail') : acctErr(b.error))); show();
  }
  if (anyOk) await cloudDevice(APP_VERSION, true);       // the database stamps this tablet's last backup (the tablets list shows it)
  await acctRefresh(gen);
}
