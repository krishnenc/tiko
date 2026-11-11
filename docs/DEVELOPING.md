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
- **Never shame.** A wrong answer gets a soft sound, a second try, then Tiko shows how. Anything that sends a word back to practice does so silently.

**Look, sound and feel**

- The app is a world of its own, in soft pastels that are easy on the eye. There are three themes (see "Themes"): the default **unicorn** (pink first, with lavender, mint and warm gold), **dragon** (blue, green, orange) and **owl** (soft and natural). Tiko is the mascot of the chosen theme.
- Sounds are soft and bell-like. Relaxing music plays on calm screens only and goes silent whenever Tiko speaks.
- While she is working, the scenery steps back (`body.work`).
- Honour `body.calm` (parent's "calm mode"): every new animation needs an entry in the calm rules in `styles.css`.

**Privacy**

- The repository is public. **Never put the child's name, photo, voice or any personal detail in the code, tests, commit messages or docs.** Her name is typed on the tablet and stored only there (`S.settings.name`).
- Recordings and photos stay in IndexedDB on the device.
- Anything that would send her data off the device (for example speech recognition) must be off by default, behind a parent setting that says plainly what it does.

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
| `settings` | Parent settings. Checkboxes in the parent corner bind by `data-s="<key>"`. |

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

Full-screen tools such as painting use `studio: () => promise` instead of `make`.

A feature that is not an activity (for example Chat with Tiko) is a screen function. Call `zone(...)` and `musicMode(...)` at the top, set `exitCurrent`, and guard every `await` with a token so leaving the screen stops the flow.

## 7. Speech and sound

- `speak(...parts)` is the only way Tiko talks. Parts: a string, `{ unit }`, `{ seq, gap }`, `{ pause }`, `{ name: true }`, `{ text, lang }`. It cancels whatever was playing; one sound at a time.
- `playUnit(unit)` plays a phonics sound: parent recording, then clip, then voice.
- `sfx('good' | 'oops' | 'tap' | 'pop' | 'win')` are synthesised. Keep them soft.
- `musicMode('calm' | 'work' | 'off')` sets the background music. Calm screens use `calm`; activities use `work` (silent unless the parent opted in). The music ducks itself during `speak`.
- Voices differ between devices and can fail to report the end of speech; `say()` has safety timers. Do not rely on exact speech timing.

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
| `memory-check.js` | `<chrome> <outDir>` | Memory pairs ladder and layout. |
| `kim-check.js` | `<chrome> <outDir>` | "What's missing?" with real touch: drag to the gap, wrong drop, drop elsewhere, plain tap. |
| `tracks-check.js` | `<chrome> <outDir>` | Hiding tracks: home screen, daily path, the "one must stay" guard, old saves. |
| `science-check.js` | `<chrome> <outDir>` | The science track played through with clicks at two screen sizes in both languages: content, layout, the rocket waits at the tank, a "wrong" guess costs nothing, path treats, hiding. |
| `firstsound-check.js` | `<chrome> <outDir>` | "Same sound": 300 questions per level and language, the sound table, one question played for real. |
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
- Voice answers in chat rely on the browser's online speech recognition and are untested on the tablet.
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
| v39 | **More science.** Fourteen more "I wonder" cards (30 in `WONDER`). A fifth science studio, `constel` (**Star pictures**, `starPictures()`): seven constellations in `SKIES`, each with its stars `p` (`[x, y, size, colour]` in a 100×100 sky, in joining order), its lines `l` (index pairs; a line is drawn as soon as both its stars are lit) and two facts. Only the shining star answers a tap (a tap near it or a finger sliding over it also counts), so nothing can go wrong and nothing is timed; the name stays "? ? ?" on the deck until she has joined it. Marked as `st:<id>` in `S.sci`; badge `skies`. **Science worksheets**: a fourth track `sci` in `SHEETS` / `WS_TRACKS` with eight sheets (planets to colour and name, riddles, rocket and countdown, join the stars, a week-long Moon diary, "my address in space", a float-or-sink experiment, an open "I wonder" page). They do not follow a level; drawings are black outlines to colour (`wsBody`, `wsRocket`, `wsSky`). `science-check.js` and `sheets-check.js` cover all of it. |
| v38 | **Science track** (`science.js`, loaded after `app.js`; area `sci`, night-sky zone). Pure curiosity: nothing is graded, there is no "oops", and nothing comes back to practise. Four studios, registered in `ACTS`: `space` (the Sun, the Moon and the eight planets, each drawn by `bodySVG(id)`, three spoken facts each, from `SPACE`), `rocket` (choose a destination, count down, lift off, drop the empty tank by tapping it — the rocket waits for her — and arrive; `RK_DEST`, `RK_TRIP`), `zoom` (seven steps from her to the galaxies, `ZOOM`) and `wonder` (question cards in `WONDER`: two guesses, `g[0]` is the real one, then the answer, then often a "try it for real" mission `y`). What she has discovered is in `S.sci` (`<lang>:<id>` → day): new things are suggested first and something seen today rests, like the little library. The daily path's end treat now rotates art → thinking → science (`treats` in `buildPath`). The track can be hidden like the others (`sci` in `TRACKS`). To add content, add an entry to `SPACE` / `WONDER` in both languages and run `science-check.js`. Facts must be true and said in one or two short sentences. |
| v37 | Letter and phonics clips always play exactly as recorded. Until now English clips were played 8% faster (24% in fast runs) with pitch correction off "to sound brighter", which came out as a squeaky baby voice on the tablet. `playUrl(url)` no longer takes a rate; never change a clip's `playbackRate`. |
| v36 | **Robot talk is gone**: single-sound clips could not be made clear on the tablet. In its place (same activity key `robot`, so play history carries over) is **Same sound** (`mkFirstSound`): Tiko says a whole word, names three pictures one by one (each lights up as it is named), and she picks the one that starts with the same sound. Only whole words are spoken, by the normal voice. `firstSound(word, lang)` gives the starting sound (English from the first unit, with c/k merged; French from the spelling, h-words skipped, vowel-initial words used only as wrong choices); `sndGroup` keeps sounds that are close by ear (s/z, m/n, b/p, d/t, g/k, f/v/th) from being offered against each other. The two words are written, first letters lit, only after the right answer. Progress is in its own set `first` and does not mark a word as readable. `speak` accepts `{ run: fn }` to do something at that point of the talk. Check with `firstsound-check.js`. |
| v35 | Robot talk: the v34 slow-down was undone. Never play a phonics clip slower than recorded: the tablet time-stretches it and a short sound comes out garbled. `rate: 'clear'` now means "exactly as recorded" (rate 1, no pitch change); the sounds are said once, with a dot per sound. |
| v34 | **Hiding tracks**: parent corner → "What she sees". `S.settings.hide` is a map of hidden track ids (`read`, `math`, `art`, `think`, `journey`, `stickers`, `chat`); `hid(k)` tests one. A hidden track is left off the home screen and off the daily path (`buildPath` filters it and tops the path up from the visible tracks); progress is kept. At least one of the four learning tracks must stay. **Worksheet library** (`sheets.js`, loaded after `app.js`): `SHEETS` is a catalogue of one-page sheets in three tracks (`read`, `write`, `math`). Each entry has `id`, `track`, `icon`, `en`/`fr` titles, optional `ahead(stage)` / `done(stage)` flags for the library card, and `make()`, which runs with `S.lang` set to the sheet's language and returns `{ secs: [[instruction, html], …], answers?, level? }`. Items she is still learning come first (`wsRank`); number ranges mirror the app's levels. `worksheetLibrary(lang)` shows the catalogue in `#sheet`; `worksheetShow(ids, lang, pack?)` previews one sheet or a whole track (one sheet per page) and offers print, download (one self-contained HTML file) and "another one". The sheet is rendered inside a shadow root with only `WS_CSS`, so preview, print and file look identical and no app style leaks in. To add a sheet, add an entry to `SHEETS` and run `sheets-check.js`: it makes every sheet at four levels in both languages, prints real PDFs and fails anything that is not exactly one clean A4 page. Also in v34: the robot in "Robot talk" says each sound slower and at natural pitch (`rate: 'clear'` in `playUnit`), lights a dot per sound, then says the sounds again closer together; the dinosaur mascot became a triceratops so it no longer resembles the dragon. |
| v33 | Dinosaur theme (`rex`): jungle green and orange, a wingless dinosaur mascot, ferns and an egg as scenery. |
| v32 | Memory pairs: once the cards are hidden, a row shows each picture once and she drags a picture onto the card where it hides (right: the card stays up; wrong: the card shows itself, then hides). Tapping two cards still works and the two ways mix. Fixed: the sky's `.sun` rule also hit yellow `.btn.sun` buttons and squeezed them to 90 px; it is now `.world > .sun`. Scenery classes must be scoped to `.world`. |
| v31 | Cues. Rule: a cue appears only after a miss or a stall, never before the first try, so it cannot turn a guess into a "known" item. A question can set `onMiss(root, attempts)` (runs on every wrong answer), `retrySpeak` (what Tiko says after the first miss) and `explain(root)` (second miss). Added: drag into the "?" place for patterns, next number, frog jumps and missing number; number line, jump sizes and rhythm bounce; clock short hand; tens and ones for "which is bigger"; tappable sides on shapes; the key word (sentences) or the answer line (stories — each story template carries `cue`, the index of that line) lights up; Copy me shows progress dots and pulses the first pad after a miss; jigsaw pieces drag, and a piece and its home glow after three unhelpful swaps; Memory pairs glows on big boards after three misses; tracing has a start dot (approximate, from the letter shape) and the untraced part glows after a 6 s pause. |
