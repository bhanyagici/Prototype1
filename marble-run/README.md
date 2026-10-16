# Marble Run — the sister game of Match Express

Tap a box in a lane: it flies to a free slot under the slide. Marbles of its colour leave the wooden trays, roll
down the orange half-pipe in single file and drop into it. A full box closes and floats away. Fill every box
before all 5 slots are blocked.

The game is built on the Match Express template (`../match-express/`): the same architecture, tools, tests,
level files and builds, retargeted.

| Match Express | Marble Run |
|---|---|
| bus | box (holes in 2 columns: 4 / 6 / 8 / 12 = 2×2, 2×3, 2×4, 2×6) |
| stickman | marble |
| ramp | tray (the same column grid; the front row faces the slide) |
| road | slide (a wooden half-pipe spline) |
| static bays | 5 slots (the slot tray under the slide's end; each fits a 2×6 box) |
| queue lanes | box lanes (2–5) |
| `manScale` | `marbleScale` |

- **`index.html`**: the game. It loads three.js 0.160.0 from a pinned CDN through an import map, with no other
  libraries and no build step. Portrait 9:19.5, scaled to fit, mouse and touch.
- **`editor.html`**: the level editor (see *The editor*). It previews the real game in a phone frame.
- **`shared/sync.js`**: stored settings, the editor's saved levels and level order, and the background bot worker. **`shared/bundle.js`**: packs the game into
  one self-contained HTML file.
- **`shared/core.js`**: the rules, the level format, the layout builder (slide, trays, sorter, pillars), the
  checker, the bots and the difficulty test.
  - It is a plain script with no three.js.
  - The game, the editor, the Web Worker and the Node tests all load this file.
  - It runs on a fixed step (`SIM_DT` = 1/30 s), so the game and every headless run reserve exactly the same marbles
    for the same taps.
- **`tools/`**:
  - the slide and tray geometry (`funnel/geometry.js`);
  - the plan-method content generator (`funnel/content.js`);
  - the demo levels (`make-demos.js`);
  - the presets copy (`sync-presets.js`);
  - the single-file editor (`editor-file.js`), the editor and play files (`build-standalone.js`) and the level packs
    and zip (`export-levels.js`);
  - the showcase levels (`make-showcase.js` from `showcase/specs.js`), their pictures (`shoot-showcase-thumbs.js`) and the
    single file (`build-showcase.js`);
  - the funnel (`make-funnel.js` from `funnel/specs.js`, `funnel-bots.js`, `funnel-table.js`, `make-funnel-xlsx.py`,
    `build-funnel.js`, `shoot-funnel.js`), and the showcase screenshots (`shoot-showcase.js`).
- **`levels/`**: one JSON per level: the blocker demos, and `showcase/<category>/<id>.json` with `showcase-order.json`
  and the card pictures (`showcase/thumbs/`).
- **`levels/funnel/`**: the 40 funnel levels, their order, `funnel-report.json` and `funnel-bots.json`.
- **`dist/`**: the single-file builds, the level packs, the zip and `funnel.xlsx` (see *Downloads*).
- **`screenshots/`**: the game, `showcase/` and `funnel/` (see *Screenshots*).
- **`tests/`**: the headless suites (see *Verification*).
- **`vendor/three.module.min.js`**: three.js r160 (MIT), for the offline single-file builds.

## Downloads (single files, double-click, no server, no network)

| File | What it is |
|---|---|
| [marble-run-showcase.html](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/marble-run-showcase.html) | Everything to try: the 38 showcase levels by category, the 40-level funnel, settings, stats, the editor inside and My Levels |
| [marble-run-funnel-40.html](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/marble-run-funnel-40.html) | The 40-level funnel in order: tutorials, popups, previous / next, "Level x / 40", stats with CSV |
| [marble-run-editor.html](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/marble-run-editor.html) | The level editor, with the game inside for its preview and its exports |
| [marble-run-play.html](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/marble-run-play.html) | The game with the built-in level |
| [funnel.xlsx](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/funnel.xlsx) | The funnel sheet, the curves and the summary |
| [funnel-40.json](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/funnel-40.json) · [all-levels.json](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/all-levels.json) | The funnel, and every level, as one JSON pack each |
| [marble-run-levels.zip](https://github.com/bhanyagici/Prototype1/raw/claude/sweet-einstein-si64t3/marble-run/dist/marble-run-levels.zip) | One file per level: `funnel/f01.json` … `f40.json` and `showcase/<category>/<id>.json`, with both orders |

```
node tools/build-showcase.js      # -> dist/marble-run-showcase.html (with the funnel once it is built)
node tools/build-funnel.js        # -> dist/marble-run-funnel-40.html
node tools/build-standalone.js    # -> dist/marble-run-editor.html, dist/marble-run-play.html
node tools/export-levels.js       # -> dist/funnel-40.json, dist/all-levels.json, dist/marble-run-levels.zip
python3 tools/make-funnel-xlsx.py # -> dist/funnel.xlsx (then recalculate, e.g. LibreOffice, so it opens with values)
```

### Screenshots

- the game (`node tools/shoot-game.js`): [start](screenshots/game-start-390.png), [in play](screenshots/game-play-390.png),
  [every blocker](screenshots/game-blockers-390.png), [a box leaving](screenshots/game-complete-390.png),
  [all slots full](screenshots/game-full-390.png), [the fail panel](screenshots/game-fail-390.png);
- the showcase (`node tools/shoot-showcase.js`): [the menu](screenshots/showcase/menu.png),
  [Layouts](screenshots/showcase/menu-layouts.png), [the funnel's tiles](screenshots/showcase/menu-funnel.png),
  [settings](screenshots/showcase/settings.png), [a level in play](screenshots/showcase/play.png),
  [the editor inside](screenshots/showcase/editor.png);
- the funnel (`node tools/shoot-funnel.js`): levels [1](screenshots/funnel/level-01.png) (tutorial hand),
  [3](screenshots/funnel/level-03-box-waits.png) (the box waits), [7](screenshots/funnel/level-07.png),
  [13](screenshots/funnel/level-13.png), [17](screenshots/funnel/level-17.png), [20](screenshots/funnel/level-20.png),
  [22](screenshots/funnel/level-22.png), [26](screenshots/funnel/level-26.png), [30](screenshots/funnel/level-30.png),
  [32](screenshots/funnel/level-32.png), [40](screenshots/funnel/level-40.png); the popups
  [hidden box](screenshots/funnel/popup-hidden-box.png), [connected](screenshots/funnel/popup-connected.png),
  [hidden marbles](screenshots/funnel/popup-hidden-marbles.png), [dispenser](screenshots/funnel/popup-dispenser.png),
  [lock & key](screenshots/funnel/popup-lock.png); lane counts [2](screenshots/funnel/lanes-2.png),
  [4](screenshots/funnel/lanes-4.png), [5](screenshots/funnel/lanes-5.png); [the stats panel](screenshots/funnel/stats-panel.png);
- the editor (`tests/editor.test.js`): [editor.png](screenshots/editor.png).

## Status

Built in phases, each committed and pushed:

1. **Core**: the rules, the level format, the layout, the checker, the bots, every blocker, gaps and toy pieces, the
   demo levels and the headless tests.
2. **The game page**: the look, the juice and the settings.
3. **The editor**.
4. **The showcase**: its 38 levels, the menu, My Levels and the editor inside.
5. **The 40-level funnel**: the design table, the levels, tutorials and popups, the report, the bots and the
   spreadsheet.
6. **Every test suite, the screenshots and the dist builds** (this phase): the single-file editor and play file, the
   level packs and the zip, all screenshots, and all 13 suites passing (see *Verification*).

## The rules

1. **Sending.** Tapping any box in a lane sends that lane's front box to the leftmost free slot.
   - If no slot is free, the tap is refused: the box shakes, the slot tray flashes red and a toast says "All slots
     are full!". This is not a fail.
   - Boxes never ride the slide. There is no road counter, no lap, no return and no tunnel.
2. **Reservation.**
   - The moment a box lands in its slot, each tray column's front marble checks the boxes in the slots.
   - If a box of its colour has an unreserved hole, the marble is reserved for that box, and the marble behind it
     checks next.
   - The box that reached its slot first is served first. A box is never promised more marbles than it has free
     holes.
   - It all happens in one fixed order: round-robin over the trays down the slide and their columns, one marble per
     column per pass.
   - The marbles reserved at that moment hop and glow. They are exactly the marbles that will drop into that box
     (Match Express's cheering rule).
   - Reservation runs again whenever a column's front changes: a hidden marble reveals, a dispenser drops, a crate
     opens.
3. **The slide.**
   - A reserved front marble rolls down a short chute (0.3 s) from its tray's lip onto the slide at the merge point.
   - It merges only into a free gap. Marbles already on the slide have priority, so trays lower down wait.
   - On the slide every marble rolls at 15 marble diameters a second. No marble overtakes another, and none comes
     closer than 1.15 diameters to the next.
   - A column releases at most one marble each time it rolls forward a row (0.14 s).
4. **The sorter.**
   - The slide drops into a vortex bowl on the left of the slot tray (0.55 s).
   - The bowl feeds a rail along the back of the slot tray, which runs at slide speed, so the order on the rail is
     the order on the slide.
   - Each marble's own flip gate drops it into its box, filling the holes far row first, left then right.
5. **Completion.** A box is complete when its last marble lands. It closes and floats away, and its slot frees in
   that same step.
6. **Win:** every marble is in a box.
7. **Fail ("Out of Space").** All 5 slots hold boxes, nothing is moving or pending, and no tray front can go to any
   slotted box.
   - "Moving or pending" covers a box in the air, a reserved marble, a marble on the slide or the rail, a key in
     flight, a crate lifting, or a hidden marble about to reveal.
   - The fail is called in the first step after the last marble in motion has landed.
   - It also applies when one slot is free but every lane front is a connected group that needs more slots. Nothing
     could ever be sent then either.
8. **Level math.** The marbles of each colour equal the holes of that colour's boxes, dispenser marbles included.
   The checker enforces it.

## The game page

![the game](screenshots/game-play-390.png)

**Open it:**
- `index.html` plays the built-in level;
- `index.html?level=demo_combo` plays a bundled level;
- `?bot` lets the greedy bot play;
- `?debug` shows the core's state.

**How it draws.**
- The page draws the core's state and nothing else.
- The core steps on its fixed `SIM_DT`. The speed setting only feeds it faster, so at any speed the game reserves
  exactly what a headless run does for the same taps; a browser test checks this at 2.25x.
- Between two steps everything is placed from the core's own timing:
  - a marble on the slide sits at `phase + V·t`;
  - in the bowl it is so far round its turn;
  - on the rail it is so far along;
  - a box in the air is so far along its arc.

**The look** (after the target image, with the prototype's proportions):
- **Table:** light wood (or another theme).
- **Slide:** a warm orange-wood half-pipe swept along the core's slide, on slim white pillars (or stacked toy blocks).
- **Start:** a wooden start tower with a blue funnel cup and a little flag.
- **Trays:** wooden trays on stilts. Their floors rise toward the back, and a short chute runs from each lip onto the
  slide.
- **The sorter:**
  - a blue vortex bowl with spinning grooves;
  - the rail along the back of the slot tray;
  - a yellow flip gate over each slot, which flips as a marble drops.
- **The slot tray:** 5 recessed slots.
- **The lanes:** they slide out from a wooden toy chest, whose lid carries the three round booster placeholders.
- **Marbles:** glossy, with clearcoat and environment reflections, drawn as one instanced mesh.
- **Boxes:** a coloured rim and a grey perforated plate; marbles sit half sunk in the holes.
- **Gaps:** yellow-striped deck ends, and red kickers for take-off and landing.
- **Toy pieces:**
  - xylophone bars that light and play a note per marble;
  - an arch of bells that swing and ring;
  - a paddle wheel turned by the marbles;
  - a loop-the-loop and a zig-zag staircase on rails;
  - a vortex bowl.

**Blockers as drawn:**
- a grey "?" on a hidden box or marble;
- cream bellows between connected boxes;
- a gumball dispenser (a red base, a glass globe with its waiting marbles, a count);
- a wooden crate with a padlock (lock), or with a number (count);
- a key on the key box, which flies to its lock.

**Juice:**
- **A box to its slot:** it lifts, arcs, grows from its queue size, and lands with a squash and a dust puff.
- **Reservation:** reserved marbles hop and glow, and keep a soft glow while they wait.
- **Reveals:** a pop and a sparkle.
- **Marbles:** they spin as they roll; a click and a little punch on the box for each one that lands.
- **A completed box:**
  - its lid snaps shut and a ribbon bow ties on;
  - a balloon in its colour pops up;
  - it floats off past the left or right edge of the screen (the nearer one; a connected group goes together);
  - confetti.
- **Slots full:** the box shakes, the slot tray flashes red, and a toast says "All slots are full!".
- **Fail:**
  - the slot boxes wobble like dominoes, then the fail panel;
  - its text says why: all 5 slots full, or the connected boxes at the lane fronts need more free slots than there
    are.
- **Sounds:** synthesised with WebAudio, starting only after the first tap: a soft roll under the marbles on the
  slide, clicks, pops, chimes, notes and bells.

**Settings** (remembered):
- theme: Maple, Walnut, Playmat, Picnic;
- supports: Pillars or Toy blocks;
- box motion: Rigid, or Jelly (boxes squash and wobble as they land and while they fill);
- camera: Perspective or Orthographic, with zoom;
- speed: 1x–3x in 0.25 steps;
- sound.

**In play:**
- a pause menu (Resume, Restart, Settings); the P key toggles it;
- a level timer counting game time;
- the progress bar (marbles in boxes);
- three round booster placeholders, which wobble and do nothing yet;
- a level pack (`window.MR_SHARE.levels`) adds previous / next, "Level x / n" and a stats panel (completion time,
  fail count and the second of each fail, per level; CSV export and reset).

Screenshots (390 × 844, `node tools/shoot-game.js`):
- [the start](screenshots/game-start-390.png);
- [in play](screenshots/game-play-390.png);
- [every blocker](screenshots/game-blockers-390.png);
- [a completed box leaving](screenshots/game-complete-390.png);
- [all slots full](screenshots/game-full-390.png);
- [the fail panel](screenshots/game-fail-390.png).

## The editor

`editor.html` is Match Express's editor, retargeted. Everything it has carries over: the file menu, undo and redo, unique
level ids, drafts, the unsaved dot, the levels list and the level order, exports, the right-click menu, copy / cut /
paste / duplicate / delete / nudge on whatever is selected, band selection, keyboard shortcuts for every tool and the
`?` help sheet.

![The editor](screenshots/editor.png)

- **The view** is the table from above: the slide (overpasses drawn over the stretch below them), the trays with their
  marbles, the start tower, the sorter's bowl and rail, the 5 slots, the box lanes and the toy chest. The game's slide
  zone is the yellow frame; whatever leaves it turns red.
- **The slide** (tool `P`, or `2`): click it to add a point (pulled into the zone if it lands outside), drag points,
  right-click or long-press to delete. The first point is the start tower; after the last one the slide runs on along
  its fixed tail into the sorter. A point's inspector turns its stretch into a spiral (left or right, its radius) and
  pins its height. Trays, gaps and toy pieces stay where they are on the table when the slide changes.
- **Trays** (`R`, or `3`): click beside the slide; the tool finds the nearest spot free of warnings. The front node
  (the green diamond) always snaps to the slide's edge and sets the merge point; drag it along the slide. The back node
  turns the tray. The inspector sets columns, rows, side, tilt (or square to the slide, or the default 35°), push and
  fills it at random.
- **Marbles**: paint (`B`), erase (`E`) and the hidden brush (`H`) in 8 colours (`Shift 1-8`).
- **Blockers**: drag across tray cells with the marble dispenser (`D`), the lock crate (`K`, with a key-box picker) or
  the count crate (`N`). One blocker per column; a dispenser needs a cell in front of it.
- **Gaps**: the cut tool (`G`) cuts the slide where it is clicked; drag a gap along the slide; the inspector sets its
  length and its ends (flat, or take-off and landing ramps).
- **Toy pieces** (new, `Y`): pick xylophone, bells, paddle wheel, zig-zag stairs, vortex or loop and click the slide;
  drag them along it; the inspector changes the piece and its length. They are decorative: the checker keeps them off
  spirals, overpasses, gaps and merge points.
- **Box lanes**: 2–5 lanes; *Add box* picks lane, colour, holes (4/6/8/12) and hidden; drag boxes within and between
  lanes; double-click toggles hidden; Shift-click 2-3 touching boxes (also across neighbouring lanes) and press `L` to
  connect them.
- **The level card**: id, name, role, target difficulty, lane count, `marbleScale` (− / + / Auto: the largest the level
  has room for).
- **Checks**: marbles against holes per colour, every checker warning (click one to see it), and **Test**: the greedy
  bot and 200 random bots in a background Web Worker running the same core, with the difficulty label.
- **The preview** is the real game page in an iframe, fed by `postMessage`: *Run* restarts it, *Auto* restarts it
  500 ms after each edit, *Watch* lets the greedy bot play, and its camera switch and zoom are the game's own settings.
- **Exports** are frozen copies: the level JSON (with its id), a playable single-file HTML of the level or of the whole
  level order (three.js inside, no network), the order JSON. The game page never reads the editor's storage.

## The showcase

`dist/marble-run-showcase.html` is one file to try everything (double-click, no server, no network), like Match
Express's. It opens on a start menu of level cards in categories:

- **Basics**: the same idea at four difficulties, Easy to Very Hard.
- **Blockers**: hidden box, connected pairs, connected triples, marble dispenser, hidden marbles, lock & key crate,
  count crate, all combined.
- **Layouts**: *Slides* (spiral, S-curve, hairpin, zig-zag, winding), *Tray shapes* (tilted, square to the slide,
  steep, deep and narrow, wide and shallow) and *Lane counts* (2-5).
- **Jumps**: a first gap, take-off ramps, two gaps, a long jump, a spiral and a gap.
- **Toy pieces**: one level per piece (xylophone, bells, paddle wheel, zig-zag stairs, vortex, loop-the-loop) and a
  parade of three.
- **Funnel**: the 40 levels as numbered tiles, played in order (the won ones ticked, the next one to play
  highlighted).
- **My Levels**: levels saved from the editor inside the showcase (below).

Each card has the level's picture, its name and tags: difficulty (the random bot's win rate), lanes, blockers, gaps,
toy pieces. In play: home, previous / next inside the category, the timer, pause (`P`) with Resume, Restart,
Settings and Back to menu, the three booster placeholders, and the stats panel (completion time, fails and the second
of each fail per level, CSV export, reset). Settings (theme, supports, box motion, camera and zoom, speed 1x-3x in
quarters, sound) open from the menu and in play and are remembered.

The menu's pencil opens the level editor over the showcase with any level. Saving never changes that level: the
showcase keeps a copy under the next free suffix of its id (`slide-hairpin_1`, `_2`, ...) in My Levels, where each
card can be played, edited again, exported as JSON or deleted, and *Export all* saves them together.

The levels are made by `tools/make-showcase.js` from `tools/showcase/specs.js` (slides as point lists or turtle
programs, tray requests, gaps and toy pieces on clean stretches, content from the plan method tuned to a target
label) into `levels/showcase/<category>/<id>.json`; `tools/shoot-showcase-thumbs.js` takes the card pictures and
`tools/build-showcase.js` packs the single file.


The labels are measured, not chosen (`meta.difficulty`, from 100 random-bot games; `meta.random` holds the rate):

| Category | Levels (label, random-bot win rate) |
|---|---|
| Basics | Easy 100%, Medium 25%, Hard 9%, Very Hard 0% |
| Blockers | hidden box Easy 59%, pairs Medium 42%, triples Medium 40%, dispenser Easy 54%, hidden marbles Easy 75%, lock & key Easy 66%, count crate Easy 95%, all combined Easy 86% |
| Layouts | every slide, tray shape and lane count Medium (18-42%) |
| Jumps | first jump Easy 100%, ramps Medium 35%, two gaps Medium 37%, long jump Easy 55%, spiral and gap Easy 52% |
| Toy pieces | each piece Medium (32-44%), the parade Easy 61% |

The blocker levels keep the demo levels' content (the point is to see the blocker, not to fight it), so most of them
are Easy. Two levels the search aimed at Medium came out Easy, at the closest it found: the long jump and the spiral
with a gap (55% and 52%), and the toy parade (61%).

## The 40-level funnel

Forty levels for a first-session funnel, built with Match Express's method: a design table (role, target
difficulty 1–10, box lanes, colours, box sizes, blockers, slide and tray idea per level), then geometry, content and
tuning by the tools.
- `levels/funnel/f01.json` … `f40.json`, the order `levels/funnel/funnel-order.json`, and the measured data
  `funnel-report.json` (tuning) and `funnel-bots.json` (the bot table);
- **`dist/marble-run-funnel-40.html`**: all 40 levels in one file (double-click, no server, no network), with
  previous / next, "Level x / 40", the stats panel (completion time, fails and the second of each fail, Export CSV,
  Reset), the tutorials, popups and the hint;
- **`dist/funnel.xlsx`**: the funnel sheet (one row per level), the curves (target vs measured difficulty, marbles per
  level) and a summary (playtime, first session, blocker introductions, levels per role and per lane count).

```
node tools/make-funnel.js                 # slides, trays, content, tuning -> levels/funnel (about 25 minutes on 2 cores)
node tools/make-funnel.js --refine 6 8    # more candidates for these; the saved level stays unless beaten
node tools/make-funnel.js --measure 7     # saved levels unchanged, measured again (meta from the design table)
node tools/funnel-bots.js                 # the bot table -> levels/funnel/funnel-bots.json
node tools/funnel-table.js                # the table below, as markdown
python3 tools/make-funnel-xlsx.py         # -> dist/funnel.xlsx
node tools/build-funnel.js                # -> dist/marble-run-funnel-40.html
node tools/shoot-funnel.js                # -> screenshots/funnel/
```

### How a level is made

- **The design table** (`tools/funnel/specs.js`): per level its role (Tutorial, Teach, Practice, Fun, Relax,
  Challenge, Milestone, Finale), the target difficulty and its band, the box lanes, colours, box sizes, blockers,
  the slide (a named shape from the showcase, or a designed meander with a spiral) and tray requests (columns x
  rows, shape, side, the spot along the slide), and the marbles' size where deeper trays need it.
- **Box lanes**: 2 on levels 1–5, 9, 22 and 31; 4 on 16, 20, 23 and 35; 5 on 38 and 40; 3 on all others.
- **Geometry** (`tools/funnel/geometry.js`): the slide from its points or turtle program; each tray placed along it
  inside the slide zone, clear of the slide, the spirals, the sorter, the start tower and the other trays. A tray
  that does not fit as asked is built in another shape with the same cells (the report lists each one); a designed
  meander tries further seeds until every tray finds a place.
- **Content** (`tools/funnel/content.js`): the boxes, an intended send order (the plan), the tray columns filled
  front to back following the plan (so the plan always wins), the lanes dealt from the plan. One knob, hardness
  `h`, sets how forgiving the level is to out-of-order play (run lengths, lane drift, and "trap" marbles buried
  behind other colours, up to a ceiling that rises with the target difficulty). Hidden boxes, connected pairs and
  triples, dispensers, hidden marbles, lock crates with their key boxes and count crates are placed against the plan.
- **Tuning** (`tools/make-funnel.js`): many (h, seed, group count) candidates, each with a quick 50-game estimate of
  the random bot's win rate; the must-land levels first sample the whole hardness range, then search around the best
  candidate so far; the nearest few are checked with 200 games and the greedy bot must win. Among equally good
  candidates the longer greedy game wins (playtime).
- **Levels 1–5 cannot be lost**: their content leaves no losing order. Each was played 1000 times by the random bot
  and 6 times by an adversarial bot (it sends the box with the fewest matching marbles at the tray fronts, mixed
  with random play) without a loss. That puts levels 3 and 4 above their bands.
- **Level 1** (tutorial): one tray, the front rows red, the back rows blue; the hand points at the red box, then the
  tips walk through the marbles rolling in, the full box floating away and the blue box.
- **Level 3** (tutorial, "a box waits"): the red box can fill only 4 of its 8 holes from the first tray's front row;
  its other 4 marbles sit in the back row of the second tray, so it waits in its slot until the boxes in front of
  them have taken theirs. The tips explain both moments.
- **Introductions**: level 7 hidden box (popup), 13 connected pairs (popup), 17 connected triples (a short hint, no
  popup), 21 the first combination (hidden boxes and pairs, no popup), 22 hidden marbles (popup), 26 the marble
  dispenser (popup), 32 lock & key (popup); 33 brings the count crate and 40 every blocker. A popup shows the first
  time its blocker appears (remembered per player), holds the game until "Got it", and has a small animated picture.
  The intro levels lean on their blocker and stay easy.

### Difficulty, measured

Random-bot win rate over 200 games (seeds 1000–1199; the target bands: 1–2 ≥ 70%, 3: 55–75%, 4: 45–60%, 5: 35–50%,
6: 25–40%, 7: 18–30%, 8: 12–22%, 9: 8–15%). Challenge, Milestone, Finale and Practice levels must land in their
band, and **all 18 do**; Relax, Fun and Teach levels may be easier, and most of them are (the random bot wins
them all). Measured diff places the win rate on the same scale (band centres, a straight line between them). The
greedy bot wins all 40; levels 1–5 cannot be lost.

| Lv | Role | Lanes | Blockers | Target diff | Band | Random wins / fails / unfinished | Win rate | Measured diff | In band | Greedy 1x | Greedy 2x |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tutorial | 2 | - | 1 | ≥ 70% | 200 / 0 / 0 | 100.0% | 1.0 | yes | 5.3 s | 2.6 s |
| 2 | Teach | 2 | - | 2 | ≥ 70% | 200 / 0 / 0 | 100.0% | 1.0 | yes | 7.4 s | 3.7 s |
| 3 | Tutorial (box waits) | 2 | - | 2 | ≥ 70% | 200 / 0 / 0 | 100.0% | 1.0 | yes | 7.5 s | 3.8 s |
| 4 | Teach (box sizes) | 2 | - | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 8.6 s | 4.3 s |
| 5 | Fun | 2 | - | 2 | ≥ 70% | 200 / 0 / 0 | 100.0% | 1.0 | yes | 9.5 s | 4.8 s |
| 6 | Challenge | 3 | - | 5 | 35–50% | 72 / 128 / 0 | 36.0% | 5.7 | yes | 27.2 s | 13.6 s |
| 7 | Teach + POPUP | 3 | 5 hidden boxes | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 14.6 s | 7.3 s |
| 8 | Practice | 3 | 2 hidden boxes | 5 | 35–50% | 98 / 102 / 0 | 49.0% | 4.4 | yes | 23.8 s | 11.9 s |
| 9 | Relax | 2 | - | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 12.7 s | 6.3 s |
| 10 | Milestone | 3 | 3 hidden boxes | 6 | 25–40% | 76 / 124 / 0 | 38.0% | 5.5 | yes | 31.9 s | 15.9 s |
| 11 | Relax | 3 | - | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 13.1 s | 6.5 s |
| 12 | Challenge | 3 | 2 hidden boxes | 6 | 25–40% | 67 / 133 / 0 | 33.5% | 5.9 | yes | 29.9 s | 14.9 s |
| 13 | Teach + POPUP | 3 | 4 connected pairs | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 21.4 s | 10.7 s |
| 14 | Practice | 3 | 5 connected pairs | 6 | 25–40% | 80 / 120 / 0 | 40.0% | 5.3 | yes | 31.8 s | 15.9 s |
| 15 | Fun | 3 | - | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 14.7 s | 7.3 s |
| 16 | Challenge | 4 | 2 hidden boxes, 5 connected pairs | 7 | 18–30% | 46 / 154 / 0 | 23.0% | 7.1 | yes | 32.5 s | 16.2 s |
| 17 | Teach (no popup, short hint) | 3 | 3 connected triples | 4 | 45–60% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 24 s | 12 s |
| 18 | Relax | 3 | - | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 13.6 s | 6.8 s |
| 19 | Practice | 3 | 1 connected pair, 3 connected triples | 6 | 25–40% | 80 / 120 / 0 | 40.0% | 5.3 | yes | 28.5 s | 14.3 s |
| 20 | Milestone | 4 | 2 hidden boxes, 2 connected pairs, 3 connected triples | 8 | 12–22% | 28 / 172 / 0 | 14.0% | 8.5 | yes | 25 s | 12.5 s |
| 21 | Teach (combo, no popup) | 3 | 3 hidden boxes, 3 connected pairs | 5 | 35–50% | 133 / 67 / 0 | 66.5% | 2.9 | easier (allowed) | 17.8 s | 8.9 s |
| 22 | Relax + POPUP | 2 | 10 hidden marbles | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 11.7 s | 5.8 s |
| 23 | Challenge | 4 | 3 hidden boxes, 4 connected pairs, 5 hidden marbles | 7 | 18–30% | 44 / 156 / 0 | 22.0% | 7.3 | yes | 29.6 s | 14.8 s |
| 24 | Fun | 3 | 2 connected pairs | 4 | 45–60% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 18.5 s | 9.2 s |
| 25 | Challenge | 3 | 3 hidden boxes, 2 connected triples, 12 hidden marbles | 8 | 12–22% | 27 / 173 / 0 | 13.5% | 8.6 | yes | 33.6 s | 16.8 s |
| 26 | Teach + POPUP | 3 | dispenser (red, 6), dispenser (purple, 6), dispenser (yellow, 6) | 3 | 55–75% | 193 / 7 / 0 | 96.5% | 1.2 | easier (allowed) | 16.1 s | 8 s |
| 27 | Practice | 3 | 2 hidden boxes, dispenser (purple, 8), dispenser (red, 8) | 6 | 25–40% | 62 / 138 / 0 | 31.0% | 6.2 | yes | 30.8 s | 15.4 s |
| 28 | Relax | 3 | dispenser (red, 6), dispenser (blue, 6) | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 13.6 s | 6.8 s |
| 29 | Challenge | 3 | 2 hidden boxes, 4 connected pairs, dispenser (green, 8), dispenser (blue, 8) | 7 | 18–30% | 41 / 159 / 0 | 20.5% | 7.5 | yes | 35.6 s | 17.8 s |
| 30 | Milestone | 3 | 3 hidden boxes, 3 connected triples, dispenser (green, 8), dispenser (red, 8) | 9 | 8–15% | 19 / 181 / 0 | 9.5% | 9.2 | yes | 27.9 s | 13.9 s |
| 31 | Relax | 2 | 2 hidden boxes | 3 | 55–75% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 13.8 s | 6.9 s |
| 32 | Teach + POPUP | 3 | 2 lock crates & keys | 4 | 45–60% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 18 s | 9 s |
| 33 | Practice | 3 | 2 hidden boxes, 2 lock crates & keys, count crate (3) | 6 | 25–40% | 57 / 143 / 0 | 28.5% | 6.5 | yes | 28.9 s | 14.4 s |
| 34 | Fun | 3 | 4 connected pairs, dispenser (green, 6), dispenser (purple, 6) | 4 | 45–60% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 16.2 s | 8.1 s |
| 35 | Challenge | 4 | 2 hidden boxes, 6 connected pairs, 2 lock crates & keys | 8 | 12–22% | 28 / 172 / 0 | 14.0% | 8.5 | yes | 48.8 s | 24.4 s |
| 36 | Relax | 3 | 1 hidden box, lock crate & key, count crate (2) | 4 | 45–60% | 200 / 0 / 0 | 100.0% | 1.0 | easier (allowed) | 15.2 s | 7.6 s |
| 37 | Practice | 3 | 3 hidden boxes, 3 connected pairs, 8 hidden marbles, dispenser (blue, 8), dispenser (red, 8) | 7 | 18–30% | 49 / 151 / 0 | 24.5% | 6.9 | yes | 27.5 s | 13.7 s |
| 38 | Challenge | 5 | 2 hidden boxes, 3 connected pairs, dispenser (cyan, 8), 2 lock crates & keys | 8 | 12–22% | 27 / 173 / 0 | 13.5% | 8.6 | yes | 36.1 s | 18 s |
| 39 | Fun | 3 | 4 connected pairs, dispenser (orange, 6), dispenser (orange, 6) | 5 | 35–50% | 151 / 49 / 0 | 75.5% | 2.5 | easier (allowed) | 20.9 s | 10.4 s |
| 40 | Finale | 5 | 3 hidden boxes, 3 connected pairs, 3 connected triples, dispenser (blue, 8), dispenser (yellow, 8), lock crate & key, count crate (3) | 9 | 8–15% | 18 / 182 / 0 | 9.0% | 9.2 | yes | 25.3 s | 12.7 s |

### Playtime: the 35-minute target is not met

The greedy bot plays all 40 levels in **14.5 minutes at 1x, 7.2 minutes at 2x**. The target was at least 35 minutes
at 2x; this funnel reaches about a fifth of it, and the levels cannot get there under the current rules and screen:

- a level holds at most 96 marbles (four 3×8 trays at marble size 0.8 fill the slide zone), and the marbles roll in
  single file at the slide's pace, so the greedy bot finishes a full level in 25–50 seconds of game time;
- 35 minutes at 2x would need about 105 seconds of game time per level on average, roughly three to four times the
  marbles a level can hold.

A real player takes longer than the greedy bot (reading the popups, thinking, failing and retrying: the hard levels
lose 80–90% of random games); the Summary sheet multiplies the greedy time by an editable factor for a first-time
player (1.5 by default). Ways to get closer, none of them applied: more levels, a slower marble flow, or more marbles
per level (a taller slide zone or more trays).

## Blockers (all of Match Express's, with the same data and checker spirit)

- **Hidden box** (`hidden` on a lane box):
  - It is grey with a "?"; its size shows.
  - It reveals when it becomes its lane's front box.
  - A connected member sent from behind reveals as it lands in its slot.
- **Connected boxes** (the same `link` on 2–3 touching boxes: one after another in a lane, or neighbouring lanes at
  most one row apart):
  - A group can go only when, in every lane it uses, its topmost member is the front box.
  - Tapping any member sends the whole group. It needs as many free slots as it has members, and the members take
    the leftmost free slots.
  - Each member fills with its own colour. A full member keeps its slot until all members are full; then they leave
    together.
  - The checker reports `link-single`, `link-size`, `link-shape` and `link-deadlock`.
- **Hidden marbles** (`"?red"` cells): grey with a "?" until the marble has rolled into the front row. It is not
  reserved until then.
- **Marble dispenser** (a tray's `dispensers: [{col, row, w, h, color, count}]`; it replaces the colourful tunnel):
  - It sits over empty cells.
  - Whenever the cell directly in front of it empties, it drops one marble of its colour there, in every column it
    spans.
  - The marbles behind it wait. At 0 it pops away.
  - The checker reports `disp-front`, `disp-count` and `disp-cells`.
- **Lock & key crate** (a tray's `crates: [{col, row, w, h, lock}]` and one lane box with the same `key`):
  - The crate's marbles cannot leave, and they block the marbles behind them.
  - When the key box is complete, its key flies to the lock (0.9 s) and the crate lifts away.
  - The checker requires exactly one key per lock (`lock-keys`, `lock-no-key`, `key-no-lock`).
  - It also requires that the key box's colour is reachable without opening its own crate (`lock-deadlock`).
- **Count crate** (`crates: [{..., count}]`): it shows how many more boxes must be completed and opens at 0
  (`count-range`).

## Level format

One JSON per level:

```
{format:1, type:'marble-run-level', id, name,
 slide:{points:[{x, z, y?, spiral?:{r, side}}], gaps:[{at, len, ramp:'flat'|'updown'}], toys:[{kind, at, len?}]},
 trays:[{side, rows, columns:[[colours front→back]], at|cp, tilt?, shape?, push?, crates?:[], dispensers?:[]}],
 lanes:[[{color, size, hidden?, link?, key?}]], laneCount?, marbleScale?, meta?}
```

- **Slide points** run from the start tower (top) down. The engine adds the fixed tail into the sorter's bowl.
- **Heights** are worked out by the core: the slide always descends, at 0.05 per unit. Wherever it passes over itself
  (a spiral's loop), it drops enough before the crossing for the upper deck to clear the lower one by 0.8. A point's
  `y` pins a height.
- **Trays.**
  - `at` is the merge point's arc length along the slide (or `cp`, a control point).
  - `side` is +1 / −1: right / left of the way the marbles travel.
  - By default a tray points 35° outward and up the screen. `tilt` sets another screen angle, `shape` points it at a
    node, and `push` stands it further from the slide.
  - Every tray is a regular grid (a `spread` is dropped, as in Match Express). Its floor rises 10° toward the back.
- **Toy pieces** (`slide.toys`) are decoration: xylophone bridge, bells, paddle wheel, zig-zag staircase, vortex
  bowl, loop-the-loop.
  - They never change a marble's progress, speed, spacing or order; a test plays the same game with and without them.
  - The loop and the vortex bend a marble's path as a prolate cycloid whose radius is at least `len/π`. It never
    moves slower than on the plain slide, and two marbles 1.15 diameters apart stay at least a marble apart.
  - The checker keeps toys off the spirals and their overpasses, and away from merge points, gaps, the ends and each
    other.
- **Gaps** are ported from Match Express. Marbles fly an arc over them at the same progress speed. The checker keeps
  gaps off the spirals and away from the ends, other gaps and merge points.

## The screen and the camera

- **Screen:** a fixed portrait screen (900 × 1950 design pixels, 9:19.5) and one camera for every level:
  perspective, 30° field of view, looking down 53°.
- **The slot tray fills the width**, as in the prototype. That sets the camera, and at 53° the 5 slots take a little
  more height than asked (about 15%).
- **Rows:**

  | zone | rows |
  |---|---|
  | slide zone | 6.5–55.5% |
  | sorter bowl, rail and slot tray | 55.5–76% |
  | lanes and toy chest | 76–100% |

- **Queue boxes** are drawn at 0.64 of their size and grow to full size as they fly to their slot. About 2.5 boxes
  of each lane show in front of the toy chest they slide out from.
- **The orthographic camera** looks the same way. It keeps the slide zone's top edge and the slot tray's back edge on
  the same rows, so both cameras share almost the same slide zone. In orthographic view the slot tray is a little
  narrower than the screen.

## Bots

- **Greedy:** it sends the box that would get the most marbles right away, and a box it would fill outright first.
  - It works this out on a what-if over **deep copies** of the trays' columns, the marbles and the boxes, with the
    new box landing last.
  - Nothing in the real game changes, not even a hidden colour. A test snapshots the state around it. The prototype
    leaked reveals here.
  - With nothing to gain it waits while marbles are still moving; otherwise it digs for the box whose colour sits
    nearest the tray fronts.
- **Random:** it sends any legal box every 0.4 s of game time.
- **Adversary** (for the fail-free proofs of levels 1–5): it always sends the box that gets the fewest marbles.

Built-in and demo levels (100 random games each, seeds 1000+; the greedy bot wins all):

| level | greedy | random wins |
|---|---|---|
| Marble Run (built-in) | 17.2 s | 89/100 (Easy) |
| Demo: Hidden Boxes | 20.7 s | 51/100 (Easy) |
| Demo: Connected Boxes | 19.6 s | 23/100 (Medium) |
| Demo: Marble Dispensers | 16.4 s | 50/100 (Easy) |
| Demo: Hidden Marbles | 17.6 s | 80/100 (Easy) |
| Demo: Lock & Key | 18.0 s | 51/100 (Easy) |
| Demo: Count Crate | 18.7 s | 84/100 (Easy) |
| Demo: All Together | 16.5 s | 82/100 (Easy) |

**Pace.** Marbles flow much faster than Match Express's buses ride their laps: 72 marbles take the greedy bot about
17 s. The funnel's "at least 35 minutes at 2x" will need bigger levels later in the funnel; that is measured and
reported in the funnel phase.

## Verification

```
node tests/rules.test.js      # 25 checks: sending, refusals, reservations (order, first-landed first, holes),
                              # the cheering set = the marbles that land (every lap of every game), the slide (no
                              # overtaking, spacing, merges only into gaps), hole order, completion, win, rule 9's
                              # fail and its timing, pending events, the bots' deep-copied lookahead
node tests/blockers.test.js   # 30 checks: every blocker, the checker rules for them, the demo levels
node tests/shared.test.js     # 15 checks: the level format, the checker, labels, testLevel, determinism
node tests/gaps.test.js       # 8 checks: gaps (flight, pillars, warnings), toy pieces (spacing in space through each,
                              # the same game with and without them, warnings)
node tests/layout.test.js     # 11 checks: the screen zones, the slot tray across the width, 2.5 boxes per lane, 2-5 lanes
node tests/camera.test.js     # 5 checks: perspective and orthographic, the shared slide zone
node tests/lanes.test.js      # 11 checks: 2-5 lanes, sending from each, connected boxes across lanes
node tests/trays.test.js      # 8 checks: regular grids, the lean, apron and chute, tilt and push, marbleScale, overlaps
node tests/browser.test.js    # 22 checks (Playwright): a real tap, the glow, the drawn spacing on the slide, the game
                              # at 2.25x = a headless run for the same taps, refusals, hidden "?", every box leaving
                              # off the side of the screen, win, the dominoes fail, pause, settings, speed, timer, boosters
node tests/editor.test.js     # 139 checks (Playwright): the shell and its preview, shortcuts, selection and the clipboard
                              # for every kind of thing, the slide, trays, blockers, gaps, toy pieces, box lanes, the
                              # level card, drafts and ids, the level order, exports opened from file:// and won level
                              # by level, the bot worker (the same numbers as the core headless), Watch, camera and zoom
node tests/showcase.test.js   # 37 checks (Playwright): the 38 levels (each in its place, balanced, won by the greedy bot,
                              # the Basics from Easy to Very Hard, lanes, toys, jumps, tray shapes), then the single file
                              # from file://: the menu, cards and tags, settings (remembered), playing a card, previous /
                              # next inside a category, pause, restart, boosters, stats and CSV, back to the menu, the
                              # funnel's numbered tiles, the editor inside and My Levels, nothing from the network
node tests/funnel.test.js     # 39 checks (Playwright): the 40 levels against the design table, lanes, tutorials, popups
                              # and the hint where the design puts them, the intro levels easy and full of their blocker,
                              # more blockers after level 20, the greedy bot wins all 40, levels 1-5 cannot be lost, the
                              # level 3 box waits; then the pack: both tutorials (the hand, blocked taps), the popups
                              # (first time only, they hold the game), the hint, previous / next, speeds, a fail then a
                              # win in the stats, Finish, the stats panel, CSV and Reset
node tests/standalone.test.js # 15 checks (Playwright): the packs and the zip hold every level byte for byte; the play
                              # file from file:// (built-in level, saved editor levels ignored, a win); the single-file
                              # editor (its srcdoc preview, Run, Play in a new tab, the playable HTML export)
```

All 365 checks pass.
