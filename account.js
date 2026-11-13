'use strict';
// Tiko backend piece 4: the parent's account screen (English and French), behind the parent gate.
// HIDDEN FROM EVERY FAMILY: this file is not in index.html. cloudLoad() (app.js) adds it, with cloud.js, only on a tablet that has the switch
// (localStorage['tiko.cloud']). Without the switch the parent corner is exactly as it was, nothing is loaded and no request is made.
// All screen code, all texts (EN and FR) and the country names live here. Every call to the server goes through cloud.js (cloud*); this file keeps
// nothing about the account in any child's save (only the link record, through linkSet / linkDrop, which lives outside every save).
// Privacy rules (docs/DEVELOPING.md section 12): the cloud nickname is NEVER prefilled from a profile name and is refused when it equals or contains the name
// (or the "spoken as" text) of a child on this tablet; nothing private is typed into a request (cloudUpload guards the payload); errors never show a code or English jargon.
// Texts that came from the server or were typed are put in the page through esc() or textContent only.
// Not in this piece (piece 5): automatic backup, "Restore a child", the choice when another tablet has a newer backup, reset / delete-child handling,
// a server-side guard between the read and the upload of a backup, the warning when a backup file was restored before "Back up now".

const ACCT_POLICY = '2026-11-draft';          // the privacy policy version the parent agrees to (the lawyer's review will change it)
const ACCT_WORDING = 2;                       // the version of the consent wording below (change it whenever that wording or the list changes)
const ACCT_WHAT = 'wording-' + ACCT_WORDING;  // what cloudConsent records (the server stores a short text, not a number)
let ACCT_RESEND_S = 60;                       // seconds before a new code may be asked for
let ACCT_ASK_MS = 1500;                     // a confirm button of a question stays dead this long after the question appears (no double tap goes through)

const ACCT_COUNTRIES = {
  AT: ['Austria', 'Autriche'], BE: ['Belgium', 'Belgique'], BG: ['Bulgaria', 'Bulgarie'], HR: ['Croatia', 'Croatie'], CY: ['Cyprus', 'Chypre'], CZ: ['Czechia', 'Tchéquie'],
  DK: ['Denmark', 'Danemark'], EE: ['Estonia', 'Estonie'], FI: ['Finland', 'Finlande'], FR: ['France', 'France'], DE: ['Germany', 'Allemagne'], GR: ['Greece', 'Grèce'],
  HU: ['Hungary', 'Hongrie'], IE: ['Ireland', 'Irlande'], IT: ['Italy', 'Italie'], LV: ['Latvia', 'Lettonie'], LT: ['Lithuania', 'Lituanie'], LU: ['Luxembourg', 'Luxembourg'],
  MT: ['Malta', 'Malte'], NL: ['Netherlands', 'Pays-Bas'], PL: ['Poland', 'Pologne'], PT: ['Portugal', 'Portugal'], RO: ['Romania', 'Roumanie'], SK: ['Slovakia', 'Slovaquie'],
  SI: ['Slovenia', 'Slovénie'], ES: ['Spain', 'Espagne'], SE: ['Sweden', 'Suède'], IS: ['Iceland', 'Islande'], LI: ['Liechtenstein', 'Liechtenstein'], NO: ['Norway', 'Norvège'],
  GB: ['United Kingdom', 'Royaume-Uni'],
};

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
    countryLabel: 'Country', countryPick: 'Choose a country', countryOther: 'Another country', countryLoading: 'Loading the list…', countryNone: 'Please choose a country.',
    closedH: 'Not open yet', closed: 'Accounts are not open in your country yet. Tiko works fully without one. You can keep the progress of your children safe with a backup file (Backup, above).',
    consentH: 'Your agreement',
    adult: 'I am an adult and the parent or legal guardian of the children who use this tablet',
    agree: 'I agree that Tiko keeps the information listed on this screen so that I can restore it on another tablet',
    emailLabel: 'Your email address', emailHelp: 'We send sign-in codes to this address. We use it only for your account: sign-in, and messages about the account itself.', send: 'Send me a code', badEmail: 'Please check the email address.',
    consentHint: 'The button works when both boxes are ticked and the address looks right.', consentHintSigned: 'The button works when both boxes are ticked.',
    codeH: 'Enter your code', sent: e => `We sent a 6-digit code to ${e}. It works for 10 minutes.`, codeLabel: 'Code', codeShort: 'The code has 6 digits.',
    resend: 'Send a new code', resendWait: n => `Send a new code (available in ${n} s)`, another: 'Use another address', newSent: 'A new code was sent.',
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
    newer: n => `The online copy of ${n} was last saved from another tablet, so this tablet did not replace it. Nothing was changed.`,
    notBacked: (n, why) => `${n}: not backed up. ${why}`, readFail: 'This child’s progress could not be read on this tablet.', unknownKid: 'this child', gone: n => `${n}: not in the account any more.`,
    linkFail: 'This tablet’s memory is full, so the link to the online copy could not be saved.',
    today: 'today', yesterday: 'yesterday', at: 'at',
    err: {
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
    countryLabel: 'Pays', countryPick: 'Choisir un pays', countryOther: 'Un autre pays', countryLoading: 'Chargement de la liste…', countryNone: 'Veuillez choisir un pays.',
    closedH: 'Pas encore ouvert', closed: 'Les comptes ne sont pas encore ouverts dans votre pays. Tiko fonctionne très bien sans compte. Vous pouvez garder la progression de vos enfants en lieu sûr avec un fichier de sauvegarde (rubrique Sauvegarde).',
    consentH: 'Votre accord',
    adult: 'Je suis majeur(e) et je suis le parent ou le représentant légal des enfants qui utilisent cette tablette',
    agree: 'J’accepte que Tiko conserve les informations listées sur cet écran pour que je puisse les retrouver sur une autre tablette',
    emailLabel: 'Votre adresse e-mail', emailHelp: 'Nous envoyons les codes de connexion à cette adresse. Elle ne sert qu’à votre compte : la connexion et les messages qui concernent le compte.', send: 'Envoyer un code', badEmail: 'Veuillez vérifier l’adresse e-mail.',
    consentHint: 'Le bouton fonctionne quand les deux cases sont cochées et que l’adresse semble correcte.', consentHintSigned: 'Le bouton fonctionne quand les deux cases sont cochées.',
    codeH: 'Saisissez votre code', sent: e => `Nous avons envoyé un code à 6 chiffres à ${e}. Il est valable 10 minutes.`, codeLabel: 'Code', codeShort: 'Le code comporte 6 chiffres.',
    resend: 'Envoyer un nouveau code', resendWait: n => `Envoyer un nouveau code (disponible dans ${n} s)`, another: 'Utiliser une autre adresse', newSent: 'Un nouveau code a été envoyé.',
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
    newer: n => `La copie en ligne de ${n} a été enregistrée en dernier depuis une autre tablette : cette tablette ne l’a pas remplacée. Rien n’a été modifié.`,
    notBacked: (n, why) => `${n} : pas sauvegardé. ${why}`, readFail: 'La progression de cet enfant n’a pas pu être lue sur cette tablette.', unknownKid: 'cet enfant', gone: n => `${n} : n’est plus dans le compte.`,
    linkFail: 'La mémoire de cette tablette est pleine : le lien avec la copie en ligne n’a pas pu être enregistré.',
    today: 'aujourd’hui', yesterday: 'hier', at: 'à',
    err: {
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
  note: '', err: '', sentAt: 0, timer: 0, countries: null, countriesErr: '', data: null, dataErr: '', log: [], sync: null };
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
    if (rec.pending) { if (has) linkSet(p.id, { child: rec.child, up: rec.up, uid }); else linkDrop(p.id); continue; }
    if (!rec.uid) { if (has) linkSet(p.id, { child: rec.child, up: rec.up, uid }); continue; }
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
  s.innerHTML = `<h3>☁️ ${esc(ACCT_T.en.title)} / ${esc(ACCT_T.fr.title)}</h3><p>${esc(ACCT_T.en.entryP)} / ${esc(ACCT_T.fr.entryP)}</p>
    <button class="pbtn acct-open">${esc(ACCT_T.en.entryBtn)} / ${esc(ACCT_T.fr.entryBtn)}</button>`;
  $('.acct-open', s).onclick = acctOpen;
  return s;
}
function acctLeave() { ACCT.gen++; clearInterval(ACCT.timer); ACCT.busy = false; ACCT.sync = null; document.documentElement.lang = S.lang; parentTab = 'data'; parents(); }
function acctReset() { Object.assign(ACCT, { country: '', adult: false, agree: false, email: '', code: '', nick: {}, tick: {}, only: null, renaming: null, ask: null, err: '', log: [], data: null, dataErr: '' }); }
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
      sel.onchange = () => { ACCT.country = sel.value; acctSay('.acct-msg', ''); };
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
      <div class="acct-nav"><button class="pbtn alt acct-resend" disabled>${esc(acctS('resend'))}</button><button class="pbtn alt acct-other">${esc(acctS('another'))}</button></div></section>`,
    wire: () => {
      const inp = $('.acct-code'), go = $('.acct-go'), rs = $('.acct-resend');
      inp.oninput = () => { ACCT.code = inp.value; acctSay('#acct-msg2', ''); };
      const tick = () => {
        const left = Math.max(0, Math.ceil((ACCT.sentAt + ACCT_RESEND_S * 1000 - Date.now()) / 1000));
        rs.textContent = left ? acctS('resendWait', left) : acctS('resend'); rs.dataset.wait = left; rs.disabled = ACCT.busy || left > 0;
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
  // ---- B: signed in
  status: {
    html: () => {
      const st = cloudState(), D = ACCT.data;
      if (!D) return `<section>${acctH('statusH')}${ACCT.dataErr ? `<p class="acct-msg" role="alert">${esc(acctErr(ACCT.dataErr))}</p><button class="pbtn acct-reload">${esc(acctS('tryAgain'))}</button>` : `<p role="status">${esc(acctS('loading'))}</p>`}</section>`;
      const kidOf = p => { const r = acctRec(p); return r ? D.kids.find(k => k.id === r.child) : null; };
      const linked = acctLinked().filter(p => kidOf(p)), un = PROFILES.list.filter(p => !linked.includes(p));
      const mine = new Set(linked.map(p => acctRec(p).child));
      const copies = D.kids.filter(k => !mine.has(k.id));
      const kidRow = p => {
        const rec = acctRec(p), kid = kidOf(p), last = acctLast(rec.up), editing = ACCT.renaming === p.id;
        return `<div class="acct-row" data-p="${esc(p.id)}"><div class="acct-who"><span class="acct-av" aria-hidden="true">${esc(p.avatar || AVATARS[0])}</span> <b>${esc(acctLabel(p))}</b> <span class="acct-nk">${esc(kid.nickname)}</span>
          <small>${esc(last ? acctS('lastBk', acctTime(last)) : acctS('notYet'))}</small></div>
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
          : k === 'delcopy' ? acctS('delCopyAsk', a.name) : (a.current ? acctS('rmThis') : acctS('rmOther', a.label));
        const yes = k === 'signout' ? acctS('signOutYes') : k === 'others' ? acctS('othersYes') : k === 'del1' ? acctS('next') : k === 'del2' ? acctS('delYes') : k === 'delcopy' ? acctS('delCopyYes') : acctS('rmYes');
        const yesB = `<button class="pbtn warn acct-yes" disabled>${esc(yes)}</button>`, noB = `<button class="pbtn alt acct-no">${esc(acctS('cancel'))}</button>`;
        // the second delete question puts "Cancel" where the first one's "Continue" was and the confirm button on its own row below: a double tap cannot go through
        return `<div class="acct-ask" role="group" aria-labelledby="acct-askp" tabindex="-1"><p id="acct-askp">${esc(txt)}</p>${k === 'del2' ? `${noB}<span class="acct-askrow">${yesB}</span>` : `${yesB}${noB}`}</div>`;
      })();
      return `<section>${acctH('statusH')}
        <p>${esc(acctS('signedAs', st.email || ''))}${st.daysLeft && st.daysLeft < 7 ? ` ${esc(acctS('daysLeft', st.daysLeft))}` : ''}</p>
        <h4>${esc(acctS('inAcctH'))}</h4>${linked.length ? linked.map(kidRow).join('') : `<p>${esc(acctS('noLinked'))}</p>`}
        ${un.length ? `<h4>${esc(acctS('notInH'))}</h4>${un.map(unRow).join('')}` : ''}
        ${copies.length ? `<h4>${esc(acctS('copiesH'))}</h4><p class="acct-help">${esc(acctS('copiesNote'))}</p>${copies.map(copyRow).join('')}` : ''}
        <div class="acct-btns"><button class="pbtn acct-bk">${esc(acctS('backNow'))}</button><button class="pbtn alt acct-dl">${esc(acctS('download'))}</button>
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
  acctDraw();
}
// the account's children and tablets; the link records are settled against what the server has (acctReconcile)
async function acctLoadStatus(gen) {
  if (ACCT.loadingS) return;
  ACCT.data = null; ACCT.dataErr = ''; ACCT.loadingS = true;
  const k = await cloudChildren();
  if (gen === ACCT.gen && !k.ok) ACCT.loadingS = false;
  if (!acctLive(gen) || ACCT.view !== 'status') return;
  if (!k.ok) { if (k.error === 'signedout') return acctFail('signedout'); ACCT.dataErr = k.error; return acctDraw(); }
  const d = await cloudDevices();
  if (gen === ACCT.gen) ACCT.loadingS = false;
  if (!acctLive(gen) || ACCT.view !== 'status') return;
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
async function acctBackupOne(p, rec, kid) {
  const me = cloudState().device;
  if (kid && Object.values(kid.sections || {}).some(s => s.device_id && s.device_id !== me)) return { newer: true };
  const save = acctSaveOf(p); if (!save) return { error: 'refused', readFail: true };
  const r = await cloudUpload(rec.child, cloudSections(save), CLOUD_SECTIONS_LIST);
  if (!r.ok) return { error: r.error };
  const up = { ...rec.up, ...r.data.stamps };
  linkSet(p.id, { child: rec.child, up, uid: rec.uid });
  return { ok: true, at: acctLast(r.data.stamps) || Date.now() };
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
    const b = await acctBackupOne(p, acctRec(p), { sections: {} });
    if (!acctLive(gen)) return;
    if (b.ok) anyOk = true;
    ACCT.log.push(b.ok ? acctS('backedUp', nick, acctTime(b.at)) : acctS('notBacked', nick, acctErr(b.error)));
    if (b.error === 'signedout') return acctFail('signedout');
  }
  if (anyOk) await cloudDevice(APP_VERSION, true);       // the database stamps this tablet's last backup
  if (!acctLive(gen)) return;
  ACCT.only = null; ACCT.renaming = null; ACCT.ask = null; ACCT.data = null; ACCT.dataErr = '';
  acctGo('status');
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
  const a0 = ACCT.ask;
  if (a0) {
    const syncAsk = ACCT.sync = () => { const y = $('.acct-yes'); if (y) y.disabled = ACCT.busy || Date.now() - a0.at < ACCT_ASK_MS; };
    syncAsk(); const left = a0.at + ACCT_ASK_MS - Date.now(); if (left > 0) setTimeout(() => { if (ACCT.ask === a0 && $('.acct-yes')) acctSyncBusy(); }, left + 30);
  }
  const no = $('.acct-no'); if (no) no.onclick = () => { const o = ACCT.ask && ACCT.ask.opener; ACCT.ask = null; acctDraw(); const x = o && $(o); if (x) x.focus(); };
  const yes = $('.acct-yes'); if (yes) yes.onclick = () => {
    const a = ACCT.ask;
    if (!a || Date.now() - a.at < ACCT_ASK_MS) return;
    if (a.kind === 'del1') { ACCT.ask = { kind: 'del2', at: Date.now(), opener: a.opener }; acctDraw(); const x = $('.acct-ask'); if (x) { x.focus(); x.scrollIntoView({ block: 'center' }); } return; }
    acctRun(yes, async gen => {
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
  for (const p of acctLinked()) {
    const rec = acctRec(p); if (!rec) continue;
    const label = acctLabel(p);
    const kids = await cloudChildren();                 // read just before this child's upload (an answer read before the first upload may be old by the time the last one is sent)
    if (!acctLive(gen)) return;
    if (!kids.ok) { if (kids.error === 'signedout') return acctFail('signedout'); ACCT.log.push(acctErr(kids.error)); show(); return; }
    const kid = kids.data.find(k => k.id === rec.child);
    if (!kid) { linkDrop(p.id); ACCT.log.push(acctS('gone', label)); show(); continue; }     // gone from the server since the status was read: nothing is sent to it
    const nick = kid.nickname;
    ACCT.log.push(acctS('backing', nick)); show();
    const b = await acctBackupOne(p, rec, kid);
    if (!acctLive(gen)) return;
    ACCT.log.pop();
    if (b.error === 'signedout') return acctFail('signedout');
    if (b.ok) anyOk = true;
    ACCT.log.push(b.ok ? acctS('backedUp', nick, acctTime(b.at)) : b.newer ? acctS('newer', nick) : acctS('notBacked', nick, b.readFail ? acctS('readFail') : acctErr(b.error))); show();
  }
  if (anyOk) await cloudDevice(APP_VERSION, true);       // the database stamps this tablet's last backup (the tablets list shows it)
  await acctRefresh(gen);
}
