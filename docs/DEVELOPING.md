# Tiko – developer guide

Read this before adding a feature. It describes how the app is put together, the rules that must not be broken, and how to test and ship.

Tiko is an offline, installable web app (PWA) that teaches a young child to read in English and French, plus early maths, drawing and thinking games. It runs in Chrome on an Android tablet and is hosted on GitHub Pages from the root of the `main` branch.

## 1. Ground rules

These come from the parent and from hard-won bugs. Treat them as requirements.

**Learning rules**

- **No repetition.** An item answered right the first time is known for ever and is never shown again. Only items she got wrong come back, at random, until she gets them right. This applies to every new activity that draws on letters, words or magic (sight) words.
- **Discovery path.** She tends to replay easy things, so the app steers her forward. A mastered activity, or one played twice today, "rests" and cannot be replayed. New activities she is ready for sparkle, and one per menu is suggested. Conquered journey places do not replay.
- **Difficulty ladders start very easy.** Harder variants belong higher up the ladder, never at level 1.
- **No time pressure.** Thinking games let her look as long as she wants. Tracing waits for the full trace; nothing finishes on a timer.
- **Maths is concrete.** Put together, take away, tick and count objects before symbols.
- **Answers wait until Tiko has asked (listen first, v48).** In a multiple-choice question the options are drawn at once but are soft and cannot be touched or dragged until Tiko has finished saying the question (plus 250 ms); the same after a wrong answer, until the retry or help sentence is finished. An early tap is ignored silently and never counted: no sound, no wobble, no attempt, no diary entry, and it is not remembered. Nothing is timed once the answers are alive. Parent setting `listenFirst`, on by default; off means the old behaviour.
- **Never shame.** A wrong answer gets a soft sound, a second try, then Tiko shows how. Anything that sends a word back to practice does so silently.

**Look, sound and feel**

- The app is a world of its own, in soft pastels that are easy on the eye. There are three themes (see "Themes"): the default **unicorn** (pink first, with lavender, mint and warm gold), **dragon** (blue, green, orange) and **owl** (soft and natural). Tiko is the mascot of the chosen theme.
- Sounds are soft and bell-like. Relaxing music plays on calm screens only and goes silent whenever Tiko speaks.
- While she is working, the scenery steps back (`body.work`).
- Honour `body.calm` (parent's "calm mode"): every new animation needs an entry in the calm rules in `styles.css`.

**Privacy**

- The repository is public. **Never put the child's name, photo, voice or any personal detail in the code, tests, commit messages or docs.** Her name is typed on the tablet and stored only there (`S.settings.name`).
- Recordings and photos stay in IndexedDB on the device.
- **Protecting the child's privacy and data is the top priority; it outranks any feature.** The app contacts no other website: fonts, sounds and scripts all ship with it, and the `Content-Security-Policy` in `index.html` enforces this. No analytics, adverts or trackers, ever.
- A child's voice, photos, name or words never leave the device. The browser's speech recognition is not used (it sends audio to an outside service; it was removed in v40). AI services may be used at build time on the app's own text only.
- Anything that would send any data off the device must be off by default, behind a parent setting that says plainly what it does, and must be described in `privacy.html` first.
- `privacy.html` (English and French, linked from the parent corner) says what the app stores and what leaves the device. Keep it true: update it in the same change as anything that alters those facts. Run `privacy-check.js` before shipping.

**Technical**

- Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies. Keep it that way.
- It must work fully offline after the first load.
- Target small tablets in both orientations. Test at 601x962 (device scale 2) and 1280x800.
- Use real touch events when testing anything touch-driven. Synthetic pointer events have passed while the real tablet failed.

## 2. Files

| File | What it holds |
|---|---|
| `index.html` | The page shell and the animated background (`.world`: stars, sun, rainbow, clouds, castle, sparkles, hills). |
| `data.js` | All learning content and all interface text (`DATA`, `SENTENCES`, `SENTENCES2`, `STORIES`, `SOUND_CLIPS`, `FR_SAY`, `T`). Loaded first. |
| `app.js` | All behaviour, about 3,700 lines, in one file with `// =====` section headers. |
| `science.js` | The science track: space explorer, rocket launch, star pictures (constellations), zoom out, "I wonder" cards. Loaded after `app.js`. |
| `sheets.js` | The worksheet library for parents (catalogue, preview, print, download). Loaded last. A new file must also be added to `ASSETS` in `sw.js`, or it will not work offline. |
| `styles.css` | All styling. Theme colours are CSS variables on `:root`. |
| `sw.js` | Service worker: caching and offline. |
| `manifest.webmanifest`, `icons/` | Install metadata and icons. |
| `sounds/<lang>-<unit>.wav` | Pure phonics clips (60 files). |

Scripts are ordinary globals in one scope, so a function in `app.js` can be called from the browser console or a test.

### Sections of `app.js`, in order

helpers → state → IndexedDB → sound effects → relaxing music → speech → her name → intro jingle → combos → confetti and flying stars → mascot → spaced repetition → the literacy journey → achievements → nudges → maths levels → activities (`ACTS`) → discovery path → question makers (`mk…`) → more maths → thinking games → creative arts → question runner (`ask…`) → Read it to Tiko → Chat with Tiko → intro → screens (home, menu, daily path, journey, sticker book) → parents → printable worksheet → boot.

## 3. State

One object, `S`, saved to `localStorage` under `tiko.v1` by `save()`. `DEFAULTS` lists the base shape; `load()` merges saved data over it, so new fields need a default or a `S.x = S.x || …` guard.

| Field | Meaning |
|---|---|
| `lang` | `'en'` or `'fr'`. `L()` returns the text table for it. |
| `boxes`, `due` | Learning state per item, key `lang:set:id`. Box 0 = never met, 1 = missed (in practice), 5 = known. `due` is `'never'` for known items. |
| `levels`, `streak` | Level and right/wrong run per maths or thinking activity. |
| `counts[lang]` | Sentences and stories read (used by the journey). |
| `seenStage[lang]` | Furthest journey place reached. Also the floor for `stageOf()`. |
| `days[yyyy-mm-dd]` | `{ q, ok, t }` questions, first-try successes and seconds played that day. |
| `diary` | The last 800 graded answers: `[date, lang, 'ok' | 'miss' | 'caught', set, id, wrongChoice]`. Feeds the parent report. |
| `books[lang:id]` | Date a library book was last read. |
| `lastBackup` | Date of the last backup file. |
| `totals`, `badges`, `goals`, `stars`, `stickers` | Rewards. `tally(k)` / `tot(k)` read and write `totals`. |
| `plays[lang:act]` | `{ total, day, n }` for the discovery path. |
| `used[lang:key]` | Items already handed out by `pickFresh`. |
| `chat` | What Tiko remembers from chats (`colour`, `animal`, `food`). |
| `readings` | Metadata for her latest 12 read-aloud recordings. |
| `settings` | Parent settings. Checkboxes in the parent corner bind by `data-s="<key>"`. Reading comfort (v45), per child: `font` (`andika` / `hyper` / `lexend` / `dys`), `spacing` (0, 1, 2), `textSize` (0, 1, 2), `simpleHome` (boolean); the defaults change nothing. `listenFirst` (boolean, default `true`, old saves included): answers wait until Tiko has finished asking (see section 1). |

**Save sections (v43 groundwork, completed in the backend piece 1).** Every key of `S` has exactly one home: a section in `SAVE_SECTIONS` or the list `SAVE_LOCAL` (`app.js`). `sections-check.js` scans the source for `S.<key>` and fails if a key is in neither, in both, or listed but unused, so a new key must be classified when it is added.

| Section | Keys |
|---|---|
| `boxes` | `boxes`, `due` |
| `levels` | `levels`, `streak`, `simonLen` |
| `journey` | `seenStage`, `counts`, `placed`, `books`, `used` |
| `days` | `days`, `diary`, `plays` |
| `rewards` | `stars`, `stickers`, `badges`, `goals`, `totals` |
| `science` | `sci` |
| `settings` | `settings`, `lang` |
| `meta` | `knownV22`, `memV23`, `newChild`: one-off flags, so a restored save does not re-run old fixes or the starting game |

`SAVE_LOCAL` means **never uploaded, never part of a section**, but kept in the backup file on this tablet: `chat`, `readings`, `lastBackup`, `dayStart`, `demoDay`, `endedDay`, `extra`, `wsLang`, `stamp`, `levelUps` (the queue of level-up announcements still to show). Old saves: `lastSnap` is taken from the loaded save, so the first `save()` after an update stamps nothing; a section that never changed has no stamp (it counts as 0) until it really changes.

Two pure functions (not called by the app yet, no network, no storage):

- `cloudSections(s)` returns one object per section holding that section's keys, deep-copied, in the **cloud form** `CLOUD_FORMAT = 2` (the server's `format` column). Nothing from `SAVE_LOCAL`. Settings: only `SAVE_SYNCED_SETTINGS` (stops, perStop, sessionMin, theme, calm, breaks, nudge, artInPath, discovery, review, hide, font, spacing, textSize, simpleHome, listenFirst, sfx, music, ambient, ambientWork, voicePack) are included; `SAVE_PRIVATE_SETTINGS` (name, nameSay, voice_en, voice_fr, rate, pitch, pitch_fr, pitchV17, frBoy) never leave the tablet, and a new setting is private until it is added to the synced list (`sections-check.js` fails if a setting is in neither list). **Boxes are packed**: the `boxes` section holds one key, `boxes`, as `{ en: { blend: { cat: 5, dog: [3, "2026-12-01"] } } }`; a plain number is a box whose `due` is `'never'`, `[box]` has no due, `[box, due]` a date, `[null, due]` a due with no box, and a key that is not `lang:set:id` goes under `"~"` by its whole name. Format 1 (two flat maps) was never shipped but `fromCloudSections` still accepts it. The local save, `mergeSaves` and the backup file keep the unpacked shape. Reason: the unpacked `boxes` section of a worst-case child is about 130 KB, the server limit is 131072 bytes of jsonb text (which prints `": "` and `", "`); packed, it is about a quarter of that.
- `fromCloudSections(sections, stamps?, format?)` returns `{ save, missing, rejected }`. `save` is a complete, loadable save for a new profile: defaults, then every value that passes a type, **range** and shape check; anything malformed is dropped (not clamped), never thrown on; unknown sections, keys and settings are ignored; the private settings keep their defaults; the old one-off fixes are marked done. What is checked: levels are whole numbers from 1 to the activity's own maximum (`THINK_MAX` / `MATH_MAX` / 3, only for activities in `ACTS`); `seenStage` 0 to `STAGES.length`; stars, totals, counts, streak, plays and day numbers whole and not negative with a generous cap; goal cost whole and at least 1, text up to 80 characters; boxes whole 0 to 5; a diary row is exactly six strings of at most 200 characters with language `en` or `fr`; a day needs whole `q` and `ok` (`t` optional); strings and keys are length-capped; synced settings accept only what the parent corner offers (stops 3 to 8, perStop 3, 4, 5, 6, 8, sessionMin 0, 10, 15, 20, 30, 45, comfort 0 to 2, booleans only, `hide` only known tracks and never every one of `AREAS`, which is exactly what the parent corner's guard allows). The cloud form also keeps only the newest `CLOUD_MAX_GOALS = 200` goals (the parent corner has no limit). `sections-check.js` fact 10 proves that nothing the app can produce is rejected: new children, the starting game, play in every activity at its highest level in both languages, every parent-corner control and every `hide` combination, and old saves. Input whose JSON text is over 8 x 131072 characters is refused whole (everything `missing` and `rejected`, nothing taken). `missing` lists sections that were absent or not an object: they are not stamped (a missing stamp counts as 0 and never wins a merge). `rejected` lists sections where something was dropped, **or where a key whose absence silently changes behaviour is absent** (`CLOUD_REQUIRED`: `settings` needs `settings`, `lang` and a valid `review`, otherwise a gentle child would become a discovery child; `rewards` needs `stars` and the rest, `levels` needs `streak`, `boxes` needs `boxes`; format 1 without `due` would bring every known item back for review), or whose stamp is invalid; an incomplete section is not stamped. **The caller must refuse a restore when `missing` or `rejected` is not empty**, and **must always pass `format`** (from the server's `format` column): when it is given the shape is not sniffed (guessing is only for old tests; a format-2 section that also carries a `due` key is otherwise read as format 1). Only the sections taken and complete are stamped, from `stamps` (whole numbers from 0 to now plus one day, else that section is rejected and unstamped) or now. **A restore must write `save` to storage as a profile's save and reload the app** (as `sections-check.js` fact 5 does); assigning it to `S` and calling `save()` would restamp every section against a stale `lastSnap`.
- **Bounded cloud copy (M5, settled this way for step 1):** the cloud form keeps the newest `CLOUD_MAX_DAYS = 730` entries of `days` (two years of day history) and the last `CLOUD_MAX_DIARY = 800` diary rows, and `fromCloudSections` applies the same caps; older history stays only on the tablet and in backup files (the local save and `mergeSaves` are unchanged).
- `mergeSaves(a, b)`: `a` is always this tablet's save. The private settings of `a` are never replaced by `b`'s (provisional, to settle with the owner before sync). Every key is written with `putKey`, so a key such as `__proto__` stays an ordinary key.

The **link record** `localStorage['tiko.link']` = `{ [profileId]: { child, up: { <section>: <stamp last uploaded> } } }` is tablet-wide, outside every child's save. `linkGet/linkSet/linkDrop` are tolerant of missing or corrupt JSON. `removeProfile` drops the child's link; the record is not in `backupText()`, not restored by `restoreBackup()` and not cleared by "Reset all progress". Nothing writes it yet.

**Backend (in preparation): never upload** the child's name or spoken name (`settings.name`, `nameSay`), the tablet's voice choice and speed, `frBoy` (stays on the tablet until the owner decides), chat memory (`chat`), recordings and readings (`readings`, IndexedDB `rec`) or photos (IndexedDB `photos`). Settings are classified by an allow-list (see above). **What would be uploaded, by design:** the parent's goal text and emoji (`goals`, typed by the parent, accepted by the owner), and the diary, the last 800 answers (`days` section: item ids, what was right or wrong; the "wrong choice" is an option the app offered, not free text). Nothing in the app sends data anywhere today; `privacy.html` must change in the same release that turns sync on. The link helpers use own-property checks, so any profile id is safe.

One-off migrations sit just under `load()`, each guarded by a flag such as `S.memV23`. Add new ones there, never by editing saved data in place elsewhere.

IndexedDB (`idb.get/set/del/keys`) has two stores: `rec` (parent sound recordings keyed `lang:unit`, the name recording `name`, and her readings `read:<timestamp>`) and `photos`.

## 4. Content (`data.js`)

### Words

```js
['cake', 'c a:ay k _e', '🎂']        // word, units, picture
['red',  'r e d',       '🔴', 1]     // 4th value: not "a thing"
```

- **Units** are sounds in English and syllables in French, separated by spaces.
- `text:sound` shows `text` on the tile and plays `sound` (`a:ay`, `ph:f`, `se:ze`).
- `_x` is a silent letter: shown grey, never spoken.
- The unit texts joined together must spell the word.
- English sounds must exist in `SOUND_CLIPS.en`. French syllables are spoken by the device voice; if a syllable would be misread on its own, add its spoken spelling to `FR_SAY`.
- The 4th value marks words that do not fit "I see a …" (adjectives, verbs, plurals, uncountables). They are used for blending but kept out of sentences, stories and drawing prompts.
- Words are listed in teaching order. `tiers` holds the index where each difficulty level ends. Append new words at the end of a level and update `tiers`.
- Pictures should be unique within a language where possible.
- New feminine French nouns go in `FR_FEM`; words with an aspirated h go in `FR_HASP`.

Run `node tools/content-check.js` after any content change. It checks spelling of units, clips, duplicates, tiers and every sentence and story pattern.

### Sentences and stories

`SENTENCES[lang]` are functions of one word, `SENTENCES2[lang]` of two, `STORIES[lang]` return `{ lines, q, answer: 'A' | 'B' }`. Use only magic words and simple grammar. Avoid adjectives that change with French gender.

### Interface text

`T.en` and `T.fr` hold every string. Add both languages together. French text addressed to the child uses the feminine.

## 5. How learning works

- `chooseItem(set, items)` applies the no-repetition rule: a missed item 40% of the time when one is waiting, otherwise the first item never met.
- `gradeItem(set, id, first)` sets box 5 for a first-try success, box 1 otherwise.
- `WORD_SETS = ['blend', 'oral', 'spell', 'fam']` share knowledge: a word known in one is known in all (`isKnown`).
- `wordLevel()` follows the journey and moves up early if she knows every word of a level. `wordQueue()` orders new words so her current level comes first.
- `forgetWord(id)` sends a "known" word back to practice when she cannot read it inside a sentence.
- `pickFresh(key, list)` hands out each item once before any repeats. Use it for anything that is not graded item by item.
- `gradeLevel(act, first)` moves maths and thinking levels: up after 3 first-try successes in a row, down after 3 misses. `MATH_MAX` and `THINK_MAX` give the top level of each.

### Library, report and backup

- `BOOKS` holds the library: per language a title, six `[picture, sentence]` pages and one question. `stage` is the journey place that unlocks the book. A book read today rests until tomorrow.
- `gradeItem` writes each answer to `S.diary`, with the wrong choice she tapped (`lastWrong`, set by `askChoice`). `weekReport()` builds the parent report from the diary, `S.days` and `S.plays`; `weekReportText()` is the shareable version and never includes her name.
- `backupText()` and `restoreBackup(text)` export and import `S`. The backup file does contain the parent settings, including the name typed on the tablet, so it must stay a local file.

### Session shape

- The daily path shows a "now / then" strip so she always knows what comes next.
- `S.settings.sessionMin` (0 = no limit) is the parent-set play time per day. `sessionOver()` compares it with `S.days[today].t`. The check runs only at natural stops (`home`, `menu`, `showPath`, `journey`), never inside an activity. New top-level screens should make the same check.
- `calmEnding()` runs the goodbye: three slow breaths, the stars won today, then Tiko rests. Reopening the app the same day goes straight to the resting screen. A parent can add ten minutes from the parent corner (`S.extra`).

### Bigger maths

- Adding and taking away have five levels: objects to 5, 10 and 20, the number line to 30, then two-digit numbers with tens rods and ones cubes (`mkBig`, no carrying).
- `tapTotal(root, selector, valueOf)` gives any set of tappable things a spoken running total (rods, cubes, coins).
- `money` and `groups` are ordinary activities with three levels each.

### The journey

`STAGES` is eight places. Word places are won by knowing a fixed number of words of that level, not a share of the list, so adding words never slows her down. `stageOf()` never returns less than `S.seenStage`, so a place reached is never lost.

### Discovery path

`actState(a)` returns `new`, `open`, `rest` or `mastered`. `READ_UNLOCK` gives the journey place from which each reading activity makes sense. `recordPlay(a)` runs when an activity is completed. `freshen(stops)` swaps mastered stops out of the daily path.

## 6. Adding an activity

1. Write a maker, `mkThing()`, returning a question object.
2. Register it: `ACTS.thing = { icon, area: 'read' | 'math' | 'art' | 'think', make: mkThing, per: <questions per visit> }`.
3. Name it in both languages: `T.en.acts.thing`, `T.fr.acts.thing`.
4. Reading activities need a `READ_UNLOCK` entry. Levelled activities need `MATH_MAX` or `THINK_MAX`.
5. Decide whether it belongs in the daily path (`PLANS`, `MATH_A`, `MATH_B` in `buildPath`).
6. Teach the regression script to play it (see section 9).

A plain multiple-choice question needs no new runner:

```js
{ title, speak: [...], visual: '<html>', options: [{ html, val }], answer,
  correctSpeak: [...], grade: first => gradeItem(set, id, first),
  optClass, gate, setup(root, unlock), explain(root), retrySpeak, onCorrect }
```

`askChoice` handles two tries, the hint, stars and praise. `q.wrong` lists the wrong values she tapped. For a different interaction, give the question a `kind` and add an `askKind(q, meta)` branch in `ask()`. A runner returns a promise that resolves `true`/`false` (first try or not) or `null` if she went home; it must call `wire(meta, finish, replay, nudgeParts)` so the home and repeat buttons and the idle nudge work.

**Listen first (v48).** `askChoice` holds its answers with `listenFirst(box, promise)` (`app.js`, just after `speak`): the container gets class `wait` (soft, `pointer-events: none`, `aria-disabled` on the options, never the `disabled` attribute, which `choose()` uses for "already tried") until the promise settles plus 250 ms, or 8 s after the sentence being said started (every part Tiko starts re-arms the cap through `lfTick`), or 3 s after a sentence was asked for if nothing has started sounding (`lfStarted`: a clip's `playing` event, the device voice's `start` event; once a start is seen only the end or the cap releases), whichever comes first; a finger put down while waiting never answers, even if lifted after the wake (`_downWait`); a newer call for the same box replaces the older one, `lfStop(box)` clears it, and an outside `stopSpeech()` releases it. Click handlers and `dragOpt` also test `box.classList.contains('wait')`. A runner that draws its own choices should say the question with `lfSay(box, ...parts)` (speaks and holds) or call `listenFirst(box, speak(...))` itself, and make its handlers return early while `box` has class `wait`; it must not lock anything else, and nothing may be timed once the answers are alive. A gate (`q.gate`) needs nothing: `unlock()` waits for the sounds still playing and for a sentence said right after it (`lfAfterGate`). `askChoice` with a `container` waits only if Tiko is already speaking (so say the question before calling it). Not used on purpose: science, memory pairs, jigsaw, tracing, building tiles, the art studios, counting taps. In a check script, wait for `.options:not(.wait)` before clicking (see `drive.js`).

Full-screen tools such as painting use `studio: () => promise` instead of `make`.

A feature that is not an activity (for example Chat with Tiko) is a screen function. Call `zone(...)` and `musicMode(...)` at the top, set `exitCurrent`, and guard every `await` with a token so leaving the screen stops the flow.

## 7. Speech and sound

- `speak(...parts)` is the only way Tiko talks. Parts: a string, `{ unit }`, `{ seq, gap }`, `{ pause }`, `{ name: true }`, `{ text, lang }`. It cancels whatever was playing; one sound at a time.
- `playUnit(unit)` plays a phonics sound: parent recording, then clip, then voice.
- `sfx('good' | 'oops' | 'tap' | 'pop' | 'win')` are synthesised. Keep them soft.
- `musicMode('calm' | 'work' | 'off')` sets the background music. Calm screens use `calm`; activities use `work` (silent unless the parent opted in). The music ducks itself during `speak`.
- Voices differ between devices and can fail to report the end of speech; `say()` has safety timers. Do not rely on exact speech timing.

### Recorded voice

Tiko speaks with pre-generated clips wherever one exists, and with the device voice otherwise (offline, free, nothing sent anywhere when it plays).

- **Clip key:** `id = cyrb53(lang + '|' + text).toString(36)`, where `text` is the string after the normalisation at the top of `say()` and `lang` is `en` or `fr` (`cyrb53` is in `app.js`).
- **Files:** `sounds/voice/<lang>/<id>.aac`, so the service worker's long-lived `tiko-sounds` cache handles them. After the phonics clips, the launch calls `voiceFetch()` (see "Packs" below), which downloads what the parent's choices want one clip at a time and stops when offline.
- **Manifest:** `voice.js`, written by the generator and loaded before `app.js`: `const VOICE = { v: 2, ext: 'aac', en: 'id1 id2 …', fr: '…', en_math: '…', fr_math: '…', size: {…} };` (v1 had only `en` and `fr`). The committed stub has empty lists; a missing or empty `VOICE` leaves the app exactly as before.
- **Playing:** `say(text, lang, rate, pitch, opts)` plays the clip through `playClip(url)` when `S.settings.voicePack` is on (parent corner, "Session and voice"), the id is listed **and the clip is already in the `tiko-sounds` cache** (`clipCached`: a clip is never streamed while Tiko speaks, so only the background prefetch downloads clips); otherwise, or if the clip cannot play, the device voice speaks. `playClip` always plays at the recorded speed, is paused before it resolves, and is silenced by `stopSpeech()`. All `say()` calls go through one queue (`sayChain`, dropped by `stopSpeech()` through `speakToken`), so un-awaited calls such as counting taps never sound together. `sw.js` serves `/sounds/voice/` cache-first with no revalidation (an id is a hash of the text, not of the audio, so a clip that must be redone needs a new name) and caches only 200 responses. The download reads the cache keys once and gives up after 3 clips in a row that did not land in the cache (its other guards are listed under "Packs"). The parent corner's voice auditions, voice-style demos and speed/pitch previews pass `noPack`.
- **Never the pack:** phonics (`playUnitNow`'s device-voice fallback passes `opts.noPack`) and the child's name (`sayName`). Do not add anything typed on the tablet to the corpus.
- **Regenerating:** `tools/voice-harvest.js <chrome>` writes `tmp/voice/corpus.json` (the app's own text, no names); `tools/voice-gen.js` creates the missing clips with the text-to-speech service and rewrites `voice.js`. It needs the owner's key outside the repository and is run by the owner only. New or changed spoken text has no clip until it is regenerated; the device voice covers it meanwhile.
- **Packs (v47):** the manifest is `{ v: 2, ext, en, fr, en_math, fr_math, size: { en, fr, en_math, fr_math } }` (bytes per pack). `en` / `fr` are the **everyday** packs (and are all an older `app.js` reads); `en_math` / `fr_math` hold the texts of `tmp/voice/corpus-extra.json` (harder sums, number sentences). `voice-gen.js` `writeManifest()` splits them (all everyday if the file is missing). A v1 manifest or none still works. `say()` plays any cached clip of the union of a language's packs.
- **Download choices** are tablet-wide, not part of any child's save, backup or `mergeSaves`: `localStorage['tiko.voicepacks']` = `{ auto, wifi, langs, math, off }`, read by `voicePrefs()` (defaults: automatic, any network, the language in use plus languages the child has used). A language's maths pack becomes wanted when the child plays at level 3 of `add`, `sub`, `next` or `missing` (`vpNoteWanted`) or on "Download now". `off` holds packs the parent removed; they are never fetched automatically again.
- **`voiceFetch(force)`** (app.js) is the only downloader: launch, a language switch (home or chat) and the parent corner call it. One run at a time (a call during a run makes it re-read what is wanted). Order: asked-for pack, everyday of the language in use, everyday of the others, maths packs. Guards: worker in control, online, not data saver / 2g, 200 MB free, one clip at a time, stop after 3 clips that did not land in the cache, and with `wifi` on, skip when `navigator.connection.type` exists and is not wifi/ethernet/unknown. "Download now" ignores `auto`, the level rule, the Wi-Fi rule and data saver for that pack.
- **Panel** (`vpPanel()`, class `vpacks`, parent corner "Session and voice"): a row per pack with size, clips on the tablet, state, "Download now" and "Remove from this tablet" (two taps). `vpRemove(p)` deletes only that pack's entries from `tiko-sounds`, adds it to `off`; `say()` falls back to the tablet voice at once because it asks the cache for each clip.
- **Check:** `voice-check.js`.

## 8. Look and feel

- Theme variables are at the top of `styles.css`. Use them instead of new colours.
- `zone('home' | 'read' | 'math' | 'art' | 'think')` switches the sky colours through `body[data-zone]`.
- The mascot is drawn by `owl(cls)` (the name is historical). Classes: `big`, `mini`, `happy`, `think`, `dance`, `spin`, `wave`, `talk`.
- Shared building blocks: `.btn` (+ `primary`, `teal`, `sun`, `grape`, `huge`, `card`), `.ic`, `.bubble`, `.opt`, `.unit`, `.reader`, `.topline`.
- Size text and tiles with `clamp()` and `vmin`/`vh` so both orientations fit. The home screen must not scroll at 601x962.
- App icons are generated from the mascot: `node tools/make-icons.js <chrome> tiko/icons`.

### Themes

The child picks the theme herself with the 🎨 button on the home screen (`themePicker()`); a parent can also set it in the parent corner. It is stored in `S.settings.theme`: `unicorn`, `dino` (the dragon), `rex` (the dinosaur) or `owl`. A new theme also needs its name in `T.en.theme` and `T.fr.theme`. Activities, progress and rewards are the same in every theme. A theme is three things:

1. **Colours.** `applySettings()` sets `body[data-theme]`. The default variables on `:root` are the unicorn theme; the "themes" block at the end of `styles.css` overrides them per theme, plus one rule per zone for the sky. Never hard-code a theme colour in a rule: use `--coral` (main), `--coral-d`, `--coral-dd`, `--coral-l`, `--coral-g` (glow), `--coral-s` (soft), `--grape` (accent), `--teal`, `--sun`, `--t1`…`--t6` (card tints), `--shade`, `--line`, `--ink`.
2. **Mascot.** `MASCOTS[theme](cls)` returns the SVG. Every mascot uses a 120×120 box and the class names `owl-body`, `wing l`, `wing r`, `eyes`, `mouth`, so all animations work. `owl(cls)` draws the current one; `owl(cls, theme)` a specific one.
3. **Scenery.** In `index.html`, the unicorn theme shows `.rainbow` and `.castle`; other themes hide those and show their own `.scene.sc-<theme>` SVG.

To add a theme: add an entry to `THEMES` (name, description, browser-bar colour), a mascot, a CSS block (copy an existing one), a scene, and a `CHAT_ME` entry (the words that fill `{hug}` and `{home}` in chat lines). Keep chat lines and other text free of mascot-specific details, or put the detail behind a `{word}`. Run `themes-check.js` and look at its screenshots.

### Reading comfort

Four per-child settings (parent corner → Child tab → "Reading comfort"; `S.settings.font`, `spacing`, `textSize`, `simpleHome`). `applySettings()` turns them into `body[data-font]`, `body[data-sp]` and `body[data-tz]`; an unknown value falls back to the usual one.

- **Font:** `andika` (default), `hyper` (Atkinson Hyperlegible), `lexend`, `dys` (OpenDyslexic). `body[data-font="…"]` redefines `--font`, with Andika behind it. The woff2 files and their licences are in `fonts/` and in `ASSETS` in `sw.js`.
- **Spacing and size:** `body[data-sp]` sets `--ls`, `--ws`, `--lhx` and `body[data-tz]` sets `--tz` (1.15 or 1.3). They are applied only to text the child reads: `.reader p` (all variants), `.bubble` (incl. `.bubble.me`, `.tikosay`), `.opt.word`, `.wordbig`, `.scicard`, `.scih` and `.menu .card span`. The **home** card labels (`.home .card span`) are not scaled: they keep their usual size, are drawn smaller in the wider fonts, and the language pills and chat button stay in Andika in OpenDyslexic, so the home never scrolls and no two buttons overlap.
- **`comfortFit()`** (end of `app.js`): on `.screen.act`, `.chat` and `.path` screens, if the content is taller than the tablet it sets inline `--tz`, `--lhx`, `--ls`, `--ws` on `body`, stepping down in this order: size to 1.0x, extra line height, size below 1.0x (floor 0.8x), and the extra letter and word spacing last. It fits from scratch only on a new screen, a window resize or a font load; for changes inside a screen it does nothing if the screen still fits, else only shrinks further, never grows back. It gates on `body.dataset`, not on the raw settings, and does nothing with the default look. The parent corner tells the parent about it. **When you add a new piece of reading text, give its `font-size` as `calc(clamp(…) * var(--tz, 1))` and add it to the `:is(…)` list of the spacing rule** at the end of `styles.css`.
- **Never changed by these settings:** the parent corner (it keeps `system-ui`; only the `.cfprev` preview follows the child's choice), worksheets (`sheets.js`; `.wslib` and `.ws` name Andika), canvas drawings (tracing and the art studio name `Andika`), the logo, number answers (`.opt.num`) and the size of phonics tiles (`.unit`; their font may follow).
- **Simpler home:** with `simpleHome` on, `home()` calls `homeSimple()` (Tiko, Start, one "More" button, the parents' corner, and the "who is playing" button with several children). The guards at the top of `home()` (session over, starting game) still win. "More" calls `home(false, true)`, which draws the full home for that visit; every other screen's home button returns to the simple one.
- Check: `comfort-check.js`.

French text addressed to the child is written in the feminine. `S.settings.frBoy` switches it to the masculine at start-up through `frenchForBoy()`; when you add French text with a gendered word, add the pair to its `MAP`.

## 9. Testing

Tests are Node scripts that drive headless Chrome through the DevTools protocol. They live in `tools/`, next to the repository folder, and are not published.

Start the local server first (it serves the working folder on port 8765):

```
node tools/serve.js        (run with the repository folder as the working directory)
```

| Script | Arguments | What it proves |
|---|---|---|
| `content-check.js` | none | Content in `data.js` is consistent. No browser needed. |
| `drive.js` | `<chrome> <outDir>` | Full play-through of every activity in both languages. About 10 minutes; ends with `ERRORS none`. Run it in the background. |
| `rule-check.js` | `<chrome> <outDir>` | No repeats; only mistakes come back. |
| `discovery-check.js` | `<chrome> <outDir>` | Rest, mastered, suggestions, conquered places. |
| `listen-check.js` | `<chrome> <outDir>` | Listen first (v48) with real touch and `say` stubbed to take 1.5 s: answers wait while Tiko asks, an early touch leaves no trace and is never replayed, waiting again after a wrong answer, a gated question (blending slider), the repeat button, speech that never ends (8 s cap), `stopSpeech()`, no drag while waiting, setting off, old saves, the starting game, science and memory untouched, calm mode, layout unchanged. Every line ends OK or FAIL. |
| `memory-check.js` | `<chrome> <outDir>` | Memory pairs ladder and layout. |
| `kim-check.js` | `<chrome> <outDir>` | "What's missing?" with real touch: drag to the gap, wrong drop, drop elsewhere, plain tap. |
| `tracks-check.js` | `<chrome> <outDir>` | Hiding tracks: home screen, daily path, the "one must stay" guard, old saves. |
| `science-check.js` | `<chrome> <outDir>` | The science track played through with clicks at two screen sizes in both languages: content, layout, the rocket waits at the tank, a "wrong" guess costs nothing, path treats, hiding. |
| `firstsound-check.js` | `<chrome> <outDir>` | "Same sound": 300 questions per level and language, the sound table, one question played for real. |
| `review-check.js` | `<chrome> <outDir>` | Practice style: discovery unchanged for an old save; the gentle ladder (3, 7, 21 days), no promotion when not due, the cap on reviews, word level and report thresholds, review stops on the daily path. Every line ends OK or FAIL. |
| `placement-check.js` | `<chrome> <outDir>` | The starting game: who gets it, the four rungs, nothing graded, leaving half-way, parent placement, choices that never sound alike, checked-later placement, layout in both languages. |
| `merge-check.js` | `<chrome> <outDir>` | Save stamps and every rule of `mergeSaves`, purity, old save shapes, backup round trip. |
| `sections-check.js` | `<chrome> <outDir>` | Save sections: every key has one home (source scan), the round trip through `cloudSections` / `fromCloudSections` of a rich save built by playing, no name, voice, chat or other local value in the sections, purity (no storage, no network), a restored child plays with no migration and no starting game, old saves, hostile input, the link record, the new merge keys; prints each section's size for a rich and a worst-case save in jsonb text form (the server limit is 131072 bytes; the check fails above 50% so growth is noticed early), the packed boxes round trip over every box/due combination, missing sections not stamped, the settings allow-list, nested hostile input followed by a tour of home, parent corner, weekly report and a question. About 8 minutes. |
| `a11y-audit.js` | `<chrome> <outDir>` | Accessibility measurements on 13 screens: text contrast, touch targets under 44px, controls with no accessible name, things that move without end. Should report no low contrast (the four logo letters are exempt), no small targets and no unnamed controls. |
| `profiles-check.js` | `<chrome> <outDir>` | Several children on one tablet: an old single save carries over untouched, a new child starts fresh, each keeps their own progress, the picker, removing a child erases only theirs. |
| `comfort-check.js` | `<chrome> <outDir>` | Reading comfort (v45): the defaults leave the v44 look untouched; each font loads from the app; spacing and size change the computed values by the planned amounts; the parent corner, tracing, number answers, phonics tiles and logo do not change; a layout tour (home, menu, sentence, story, word choice, every library page, chat, science, daily path, parent corner) in both languages at 601x962 and 1280x800 with the heaviest combination; settings belong to the child; the simpler home and its guards; the parent-corner preview; the fonts are in the service-worker cache. About 10 minutes. |
| `privacy-check.js` | `<chrome> [url]` | A tour of the whole app with the network watched: every request goes to the app's own site, nothing is blocked by the content policy, the font comes from the app, chat offers no microphone, the privacy page is there. |
| `voice-check.js` | `<chrome>` | The recorded voice: a clip plays instead of the device voice, a text without a clip, a broken clip, the switch off, phonics fallback and names never use it, `stopSpeech()` releases the waiter, empty or missing `voice.js`. v47 packs: manifest v2 from `voice-gen.js --dry`, which packs the real network requests fetch (fresh tablet, language switch, level 3, automatic off, removed), Wi-Fi / data saver / space / offline guards, "Download now", "Remove", one download at a time, the panel, preferences kept out of backups. Copies test clips under `sounds/voice/` and deletes them; runs `voice-gen.js --dry` (rewrites `voice.js` from the clips on disk) before and after. |
| `sheets-check.js` | `<chrome> <outDir>` | Worksheets at every reading place and maths level, both languages: content, exactly one PDF page, the download file. |
| `pairs-drag-check.js` | `<chrome> <outDir>` | Memory pairs with real touch: drag a picture onto its cards, wrong card, mixing drag and tap, layout at levels 1, 3 and 6. |
| `cues-check.js` | `<chrome> <outDir>` | Every v31 cue with real touch: drag into the "?" place, and the help shown after a miss or a stall. Screenshots. |
| `v24-check.js` | `<chrome>` | Journey pace with big word lists, word order, lucky-guess catch, sentences and families. |
| `chat-check.js` | `<chrome> <outDir>` | Every chat topic in both languages with real touch; read-aloud with a fake microphone. |
| `v27-check.js` | `<chrome> <outDir>` | Every library book in both languages with real touch; the weekly report; backup round trip. |
| `v28-check.js` | `<chrome> <outDir>` | Level 5 sums, coins and groups with real touch; first/then strip; session limit and calm ending. |
| `themes-check.js` | `<chrome> <outDir>` | Each theme's colours, mascot, scenery and chat words; the picker; French for a boy. Screenshots of every theme. |
| `music-check.js` | `<chrome>` | Music on calm screens, silent during speech and work. |
| `audio-check.js` | `<chrome> <outDir>` | Phonics sounds never overlap. |
| `touch-trace.js`, `slider-touch.js` | `<chrome> <outDir>` | Tracing and the blending slider with real touch at odd tablet sizes. |
| `menu-shot.js` | `<chrome> <outDir>` | Menu labels fit at three sizes. |
| `tour-shot.js` | `<chrome> <outDir> [w h dpr] [screens]` | Screenshots of the main screens; reports screens that scroll. Look at the pictures. |
| `check-live.js` | `<chrome> <url> <screenshot.png>` | The deployed site: cache version, offline, clips. |

When you add a question `kind`, add a branch for it in `drive.js` (`answer` function) or the play-through will hang. When you add a feature, add a check script for it in the same style: clear storage, stub `say` to record what Tiko says, drive with `Input.dispatchTouchEvent`, print one line per fact, end with `JS errors:`.

The local service worker can reload the page once after a fresh load. A check script should wait until `typeof S !== 'undefined'` holds steadily before it starts (see `v28-check.js`); an occasional `S is not defined` in an older script is this race, not an app fault, and goes away on a second run.

Useful test hooks: `startJourneyAt(lang, stage)`, `runStop(act, n)`, `runAct(act)`, `menu(area)`, `home()`, `journey()`, `exitCurrent()`.

## 10. Shipping

1. Bump `APP_VERSION` in `app.js` and `VERSION` in `sw.js` to the same number. The service worker only refreshes tablets when `VERSION` changes.
2. Run the checks that cover what you touched, plus `drive.js`.
3. Commit and push to `main`. GitHub Pages publishes in about a minute.
4. Run `check-live.js` against the live URL and confirm the new cache name, offline `true`, and no errors. If it still shows the old version, wait and run it again.

The tablet picks up a new version the next time the app is opened online, and shows the version number at the bottom corner of the home screen.

**Editing on Windows:** never rewrite source files through PowerShell `Get-Content`/`Set-Content` pipelines. PowerShell 5.1 reads UTF-8 without a byte-order mark as ANSI and corrupts every emoji and accent. Use an editor or tool that preserves UTF-8.

## 11. Known limits

- The device voice cannot be tested headlessly. French syllable pronunciation and voice/music interplay need a listen on the real tablet. Parents can check and re-record any sound in the parent corner.
- Progress lives in `localStorage` on one device.
- Emoji are the pictures. Some newer emoji may not exist on old Android versions.

## 12. Version history

| Version | Change |
|---|---|
| v22 | "Known once, never again" rule. |
| v23 | Gentler Memory pairs ladder; discovery path. |
| v24 | Word lists grown to 370 (English) and 280 (French); more sentences and stories; journey won by word counts; lucky-guess catch. |
| v25 | Unicorn universe: new mascot, pastel theme, living sky, relaxing music, softer sounds. |
| v26 | Chat with Tiko (English and French); Read it to Tiko with recordings for parents. |
| v27 | Little library (six books per language); weekly parent report with mix-ups and play time; backup and restore. |
| v28 | Maths to 99 with tens and ones (adding and taking away level 5), coins, groups of; first/then strip on the daily path; parent-set session length with a calm ending. |
| v29 | Themes: unicorn, dragon, owl (colours, mascot, scenery); French for a boy. |
| v30 | "What's missing?": she drags the missing picture back into its gap. Any multiple-choice question can do this by setting `drop` (a selector for the place) on the question; `dragOpt` in `app.js` handles the finger. A tap still answers, and letting go away from the place is never a mistake. |
| v50 | Restore checks made strict (still no network): `fromCloudSections` accepts only whole numbers in the ranges the app can produce, diary rows of six short strings, settings values the parent corner offers, complete sections (`CLOUD_REQUIRED`), sane stamps and a bounded input size; anything else is dropped and the section is listed in `rejected`. `mergeSaves` is safe for any key name. A save the app itself wrote is never rejected (fact 10 of `sections-check.js`). |
| v49 | **Save sections ready for backup (no network yet).** Every key of a save belongs to a section (`SAVE_SECTIONS`) or stays on the tablet (`SAVE_LOCAL`); settings are uploaded only from an allow-list (`SAVE_SYNCED_SETTINGS`; the name, voice and "speaks to a boy" stay on the tablet). `cloudSections` / `fromCloudSections` build and check the uploaded form (`CLOUD_FORMAT = 2`: packed boxes, two years of days, 800 diary rows); `mergeSaves` keeps this tablet's private settings. Nothing calls them yet and the app still contacts no server. Checks: `sections-check.js`, `merge-check.js`. |
| v48 | **Listen first.** In every multiple-choice question and in the starting game the answers are drawn at once but wait (class `wait`, softer, not tappable or draggable) until Tiko has finished asking, and again after a wrong answer until she has finished helping. An early tap leaves no trace. Never stuck: 8 s per sentence at most, 3 s if nothing starts sounding. `S.settings.listenFirst` (on by default; parent corner, "Session and voice"). See "Answers wait" in section 1 and the runner note in section 6. Check: `listen-check.js`. |
| v46 | Star pictures: a finger put down on the shining star and dragged now joins the stars (the press itself counts, and the slide works from the first star). A press that moves never becomes a `click`, so anything a child may drag must listen to `pointerdown`. |
| v47 | **Voice packs the parent controls.** The recorded voice is four packs (everyday and maths sentences, English and French; manifest v2 with sizes) and is no longer all downloaded by default: the tablet-wide `tiko.voicepacks` choices (automatic download, Wi-Fi only, languages, maths packs, removed packs) drive `voiceFetch()`, and a panel in the parent corner shows each pack's size and state and offers "Download now" and "Remove from this tablet". See "Recorded voice". Check: `voice-check.js`. |
| v45 | **Reading comfort.** Four per-child settings in the parent corner: font (Andika, Atkinson Hyperlegible, Lexend, OpenDyslexic; all shipped in `fonts/`), letter and word spacing (usual, wider, widest), text size where the child plays (usual, x1.15, x1.3), and a simpler home screen (Tiko, Start, "More"). A live preview sits in the section. The defaults change nothing. See "Reading comfort" in section 8. Check: `comfort-check.js`. |
| v44 | **Recorded voice.** Tiko speaks with clips made in advance (see "Recorded voice"): about 2,500 per language under `sounds/voice/`, listed in `voice.js`. `say()` plays a clip when the text has one **and it is already in the tablet's cache**, otherwise the tablet's voice speaks as before; all `say()` calls go through one queue so nothing overlaps. Clips are downloaded quietly in the background (not in data-saver mode, not when storage is short) and served cache-first by the service worker. Never recorded: letter sounds and syllables, anything typed on the tablet (names), sentences built from too many parts (reading sentences, harder sums). A parent can switch it off under "Session and voice". The clips were checked by transcribing them back; single words could not be checked that way. Check: `voice-check.js`. |
| v43 | **Setting up a new child.** (1) **Practice style**, per child: `S.settings.review` is `'discovery'` (the rule since v22: right first time = box 5, due `'never'`, never shown again; a save without the setting is discovery) or `'gentle'` (spaced review: right first time → box 3 due in 3 days, then box 4 (+7), box 5 (+21), then `'never'`; a miss → box 1, due today). `reviewMode()` reads it; `addProfile` gives new children `'gentle'`; the control is in the parent corner under Difficulty. In gentle mode: `gradeItem` promotes only an item that is new or due (a right answer on a resting item changes nothing); `chooseItem` offers a due item one time in four, at most 2 in any 10 picks while something new or missed is available, and prefers due items once a set is exhausted; `knownBox()` (3 in gentle, 5 in discovery) is what `frac`, `wordLevel` and the weekly report count as known; `mastered()` does not rest Letters or Magic words while one of their reviews is due, and `buildPath` puts that activity first on the daily path (one review stop a day, in place of the last regular stop). (2) **Starting game** (`placement.js`, loaded after `science.js`): for a child added on the tablet (`S.newChild`), `home()` runs `placement()` once per language while `needsPlacement(lg)` is true. Four rungs of three questions (hear a sound → letter; read a word → picture; hear a magic word → written word; read a harder word → picture); a rung is passed with three right at the first tap; `k` rungs passed calls `startJourneyAt(lg, k, true)`. Nothing is graded, timed or recorded; choices never sound alike (`soundGroup`). `startJourneyAt(lg, target, check)`: with `check` and gentle mode the skipped items are box 5 with a review date 3 to 9 days ahead, so a lucky pass is caught once; a parent's manual choice stays `'never'` and sets `S.placed[lg]`, which cancels the game. (3) **Save sections** (groundwork for sync, nothing is sent anywhere): `SAVE_SECTIONS` groups the keys of `S`; `save()` stamps `S.stamp[section]` when that section changed; `mergeSaves(a, b)` is a pure function that merges two saves forward-only. **It is not called anywhere yet, and its rules have known gaps to settle before sync is built** (a given or deleted reward comes back; a later miss or a parent lowering a level is undone; device clocks decide ties). Checks: `review-check.js`, `placement-check.js`, `merge-check.js`. |
| v42 | **Accessibility and calm**, from an audit against WCAG 2.1 AA and a design critique (re-run them with `a11y-audit.js`). **Contrast:** white text now sits on the darker shade of each theme colour (`.btn.primary` uses `--coral-d` → `--coral-dd`; chat, teal and parent-corner buttons are darkened with `color-mix`, with a plain fallback first); `--soft` is darker in every theme. Rule: white text needs 3:1 at 24px+ (or 19px bold) and 4.5:1 below that. **Motion:** `isCalm()` is the parent's calm setting OR the device's "reduce motion"; under `body.calm` every endless animation plays once and stops and the scenery is still. During activities (`body.work`) the scenery is hidden and still for everyone, and the star counter in the bar only shows while a star is being earned. **Names:** picture-only buttons get an `aria-label` from `ICON_NAMES` (a MutationObserver at boot); picture answers pass `name` on the option. **Focus ring** via `:focus-visible`. **Zoom:** `zoomable(true)` in the parent corner (pinch-zoom allowed there), locked where the child plays. **Home:** the friend/world chooser shows the current mascot (it was a palette, the same picture as Art); with several children their button shows picture and name; a music button (`.soundb`) lets the child switch the music off. **Menus:** a track with more than 8 activities shows six (the suggestion, then what is playable) and a "More" card; the others carry class `xtra` and stay in the DOM. **Parent corner:** sections sit behind five tabs (`TABS` in `parents()`, matched on the section heading; `parentTab` remembers the last one) and its wording no longer assumes a girl. **Icons:** one meaning per picture across the activity menus. Not changed: tracing still needs the finger on the letter (taps along it count, and the "Done" backup appears part-way). |
| v41 | **Profiles: several children on one tablet.** `PROFILES` (`tiko.profiles` in localStorage) is `{ list: [{ id, avatar }], current }`. Each child has their own save: the first child keeps the original key `tiko.v1` (id `main`, so an updating tablet needs no migration), the others use `tiko.v1.<id>`; `storeKey()` gives the key and `load()` / `save()` use it. Everything in `S`, including the name and all settings, belongs to the child who is playing. `switchProfile(id)` sets `current` and **reloads the app**, so no state of one child's session can leak into another's. With more than one child, `profilePicker(then)` asks "Who is playing?" once per app opening (flag in `sessionStorage`), and a small avatar button on the home screen opens it again. Parent corner → "Children on this tablet": add (`addProfile(name)`: a fresh save, only the tablet's sound choices carried over), choose a picture, switch, remove (`removeProfile(id)`: never the child who is playing; also deletes their name recording, readings and photos). In IndexedDB, per-child keys go through `pkey(k)` (`name` → `name@<id>`); photos carry `pid`; the parent's own letter-sound recordings are shared by all children. Check with `profiles-check.js`. Still to come in this phase: neutral wording in the parent corner, a save format with sections for sync, a placement check and gentle review for new children. |
| v40 | **Privacy hardening.** The Andika font ships with the app (`fonts/`, SIL OFL licence alongside) instead of being fetched from Google Fonts; the service worker no longer handles any outside host and deletes the old `tiko-fonts` cache. A `Content-Security-Policy` meta tag in `index.html` allows only the app's own origin (plus `data:` / `blob:` for its own pictures, sounds and downloads). Voice answers in "Chat with Tiko" are removed (the browser's speech recognition sent audio to an outside service). New `privacy.html` (EN/FR), precached, linked from a new "Privacy" section in the parent corner. New check `privacy-check.js`. |
| v39 | **More science.** Fourteen more "I wonder" cards (30 in `WONDER`). A fifth science studio, `constel` (**Star pictures**, `starPictures()`): seven constellations in `SKIES`, each with its stars `p` (`[x, y, size, colour]` in a 100×100 sky, in joining order), its lines `l` (index pairs; a line is drawn as soon as both its stars are lit) and two facts. Only the shining star answers a tap (a tap near it or a finger sliding over it also counts), so nothing can go wrong and nothing is timed; the name stays "? ? ?" on the deck until she has joined it. Marked as `st:<id>` in `S.sci`; badge `skies`. **Science worksheets**: a fourth track `sci` in `SHEETS` / `WS_TRACKS` with eight sheets (planets to colour and name, riddles, rocket and countdown, join the stars, a week-long Moon diary, "my address in space", a float-or-sink experiment, an open "I wonder" page). They do not follow a level; drawings are black outlines to colour (`wsBody`, `wsRocket`, `wsSky`). `science-check.js` and `sheets-check.js` cover all of it. |
| v38 | **Science track** (`science.js`, loaded after `app.js`; area `sci`, night-sky zone). Pure curiosity: nothing is graded, there is no "oops", and nothing comes back to practise. Four studios, registered in `ACTS`: `space` (the Sun, the Moon and the eight planets, each drawn by `bodySVG(id)`, three spoken facts each, from `SPACE`), `rocket` (choose a destination, count down, lift off, drop the empty tank by tapping it — the rocket waits for her — and arrive; `RK_DEST`, `RK_TRIP`), `zoom` (seven steps from her to the galaxies, `ZOOM`) and `wonder` (question cards in `WONDER`: two guesses, `g[0]` is the real one, then the answer, then often a "try it for real" mission `y`). What she has discovered is in `S.sci` (`<lang>:<id>` → day): new things are suggested first and something seen today rests, like the little library. The daily path's end treat now rotates art → thinking → science (`treats` in `buildPath`). The track can be hidden like the others (`sci` in `TRACKS`). To add content, add an entry to `SPACE` / `WONDER` in both languages and run `science-check.js`. Facts must be true and said in one or two short sentences. |
| v37 | Letter and phonics clips always play exactly as recorded. Until now English clips were played 8% faster (24% in fast runs) with pitch correction off "to sound brighter", which came out as a squeaky baby voice on the tablet. `playUrl(url)` no longer takes a rate; never change a clip's `playbackRate`. |
| v36 | **Robot talk is gone**: single-sound clips could not be made clear on the tablet. In its place (same activity key `robot`, so play history carries over) is **Same sound** (`mkFirstSound`): Tiko says a whole word, names three pictures one by one (each lights up as it is named), and she picks the one that starts with the same sound. Only whole words are spoken, by the normal voice. `firstSound(word, lang)` gives the starting sound (English from the first unit, with c/k merged; French from the spelling, h-words skipped, vowel-initial words used only as wrong choices); `sndGroup` keeps sounds that are close by ear (s/z, m/n, b/p, d/t, g/k, f/v/th) from being offered against each other. The two words are written, first letters lit, only after the right answer. Progress is in its own set `first` and does not mark a word as readable. `speak` accepts `{ run: fn }` to do something at that point of the talk. Check with `firstsound-check.js`. |
| v35 | Robot talk: the v34 slow-down was undone. Never play a phonics clip slower than recorded: the tablet time-stretches it and a short sound comes out garbled. `rate: 'clear'` now means "exactly as recorded" (rate 1, no pitch change); the sounds are said once, with a dot per sound. |
| v34 | **Hiding tracks**: parent corner → "What she sees". `S.settings.hide` is a map of hidden track ids (`read`, `math`, `art`, `think`, `journey`, `stickers`, `chat`); `hid(k)` tests one. A hidden track is left off the home screen and off the daily path (`buildPath` filters it and tops the path up from the visible tracks); progress is kept. At least one of the four learning tracks must stay. **Worksheet library** (`sheets.js`, loaded after `app.js`): `SHEETS` is a catalogue of one-page sheets in three tracks (`read`, `write`, `math`). Each entry has `id`, `track`, `icon`, `en`/`fr` titles, optional `ahead(stage)` / `done(stage)` flags for the library card, and `make()`, which runs with `S.lang` set to the sheet's language and returns `{ secs: [[instruction, html], …], answers?, level? }`. Items she is still learning come first (`wsRank`); number ranges mirror the app's levels. `worksheetLibrary(lang)` shows the catalogue in `#sheet`; `worksheetShow(ids, lang, pack?)` previews one sheet or a whole track (one sheet per page) and offers print, download (one self-contained HTML file) and "another one". The sheet is rendered inside a shadow root with only `WS_CSS`, so preview, print and file look identical and no app style leaks in. To add a sheet, add an entry to `SHEETS` and run `sheets-check.js`: it makes every sheet at four levels in both languages, prints real PDFs and fails anything that is not exactly one clean A4 page. Also in v34: the robot in "Robot talk" says each sound slower and at natural pitch (`rate: 'clear'` in `playUnit`), lights a dot per sound, then says the sounds again closer together; the dinosaur mascot became a triceratops so it no longer resembles the dragon. |
| v33 | Dinosaur theme (`rex`): jungle green and orange, a wingless dinosaur mascot, ferns and an egg as scenery. |
| v32 | Memory pairs: once the cards are hidden, a row shows each picture once and she drags a picture onto the card where it hides (right: the card stays up; wrong: the card shows itself, then hides). Tapping two cards still works and the two ways mix. Fixed: the sky's `.sun` rule also hit yellow `.btn.sun` buttons and squeezed them to 90 px; it is now `.world > .sun`. Scenery classes must be scoped to `.world`. |
| v31 | Cues. Rule: a cue appears only after a miss or a stall, never before the first try, so it cannot turn a guess into a "known" item. A question can set `onMiss(root, attempts)` (runs on every wrong answer), `retrySpeak` (what Tiko says after the first miss) and `explain(root)` (second miss). Added: drag into the "?" place for patterns, next number, frog jumps and missing number; number line, jump sizes and rhythm bounce; clock short hand; tens and ones for "which is bigger"; tappable sides on shapes; the key word (sentences) or the answer line (stories — each story template carries `cue`, the index of that line) lights up; Copy me shows progress dots and pulses the first pad after a miss; jigsaw pieces drag, and a piece and its home glow after three unhelpful swaps; Memory pairs glows on big boards after three misses; tracing has a start dot (approximate, from the letter shape) and the untraced part glows after a 6 s pause. |
