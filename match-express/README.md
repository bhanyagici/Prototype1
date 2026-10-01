# Match Express — playable prototype + level editor

- **`index.html`** — the game. three.js 0.160.0 from a pinned CDN through an import map;
  no other libraries, no build step. Portrait 9:19.5, scales to fit, mouse and touch.
- **`editor.html`** — the level editor, with the real game running live beside it.
- **`shared/core.js`** — the rules, the level format, validation, the layout builder
  (road, ramps, tunnels, pillars), the bots and the difficulty test. Plain script, no
  three.js; the game, the editor, the Web Worker and the Node tests all load this file.
- **`shared/sync.js`** — level storage (`localStorage`) and the `BroadcastChannel`
  `"match-express-levels"` that keeps the editor and every open game tab in step.

![390x844 screenshot](screenshot-390.png)

## Opening the editor next to the game

Serve the folder and open the editor (a plain `file://` open works too, but browsers
limit `BroadcastChannel` and `localStorage` between `file://` pages):

```
cd match-express
python3 -m http.server 8000
# open http://localhost:8000/editor.html
```

![editor at 1440x900](screenshot-editor.png)

- **Left:** tool tabs (Road, Ramps, Queue, File) and the **Checks** panel, which is
  always visible.
- **Centre:** a top-down view you edit with mouse or touch. The dashed trapezoid is
  what the game camera sees. Wheel zooms, dragging empty space pans.
- **Right:** the real `index.html` in a 390×844 phone frame. **Open in new tab**
  opens the game full size. That tab follows the editor through the channel, so you
  can keep it on a second screen or a phone-sized window.

**RUN** saves the level and restarts it fresh, in the preview and in every open game
tab. **Auto-run** does the same thing by itself 500 ms after each edit (the timer
restarts on every change, so a drag only restarts once you let go). When the game
starts, it loads the first level it finds from this list:
1. a level the editor sends;
2. the last level saved in `localStorage`;
3. the built-in `LEVEL_DATA`.

Settings → *Built-in level* clears the saved level. `index.html?builtin` ignores it
for one load.

### Road
- Drag a control point to move it. Click the road to insert a point there.
- Right-click (or long-press on touch) deletes a point.
- **Spiral** (selected point) turns the point into a loop that crosses over itself,
  with an overpass and pillars. You can set its radius and side.
- These parts are placed automatically:
  - the road start, at the entry road;
  - the exit tunnel, at the road end along the last tangent;
  - the return tunnel, at the collector end on the side nearer the exit tunnel,
    facing the bays;
  - the pillars, evenly spaced.
- Warnings in Checks, also circled in red:
  - the road crosses itself outside a spiral;
  - a point is off screen;
  - a curve is too tight for a 12-seat bus.

### Ramps
- Add or delete ramps. Each ramp is a spline platform with draggable shape points
  and railings.
- The boarding point (diamond) snaps to the road and can be dragged along it. The
  front row always faces the road.
- Columns and rows have +/− buttons.
- To place stickmen:
  - paint with the 8-colour palette;
  - use the **eraser** to empty a cell;
  - **Fill random** fills runs of 1–4 per column from the colours you picked;
  - the **hidden** brush shows a stickman as "?" until it reaches the front row.
- Warnings: a ramp overlaps another ramp or the road; a boarding point sits on a
  spiral overpass.

### Queue
- The queue has three lane lists. Add a bus with a colour and a capacity (4/6/8/12).
- Toggle **hidden**, drag to reorder within a lane or between lanes, or delete.
- Select two or more buses and **Link** them. Tapping one linked bus sends the whole
  group. That works only when every bus in the group is at the front of its lane and
  there is room for all of them (road slots plus free bays). Otherwise the tap is
  refused.

### Checks
Checks shows:
- stickmen against seats for each colour, green when they match and red when they
  don't;
- totals and the number of buses of each size;
- every layout warning.

**Test** runs the greedy bot plus 200 random games in a background worker. It
reports:
- whether the greedy bot wins or fails;
- how many sends it took and the game time;
- the random bot's win rate;
- a difficulty label: Easy >45%, Medium 15–45%, Hard 5–15%, Very Hard <5%.

**Watch greedy** plays the greedy bot in the preview.

### File: slots, export, import, undo
- **Slots:** save, load, rename, duplicate and delete named levels, all stored in
  `localStorage`.
- **Export** copies the level JSON to the clipboard and downloads it as `.json`.
- **Import** reads pasted JSON or a file. It accepts format 2 levels and old format 1
  levels (format 1 gets the default layout).
- **Undo / redo:** Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) work for every edit.

The editor also keeps an autosaved draft, so a reload doesn't lose work.

Level format 2:

```js
{ format: 2, name, seed,
  road:  { points: [{x, z, spiral?: {r, side}}], tail? },
  ramps: [{ cp | at, side, shape?: [[x, z], ...], rows, columns: [["red", "?blue", null, ...], ...] }],
  lanes: [[{ color, cap, hidden?, link? }, ...], [...], [...]] }
```

In `columns`, each list is one column, front cell first. `"?colour"` is a hidden
stickman and `null` is an empty cell. Each lane lists its front bus first.

## Single-file versions (double-click, no server)

```
node tools/build-standalone.js
```

This writes two files to `dist/`. Each one works when you open it straight from disk:
- **`match-express-game.html`** is the game with `shared/core.js` and
  `shared/sync.js` inlined.
- **`match-express-editor.html`** is the editor with everything inlined. The game
  preview is embedded through `iframe srcdoc`, so it needs no second file. RUN and
  Auto-run work as usual. *Open in new tab* opens the same embedded game in a new
  tab. That tab gets every later RUN through `window.opener`.

Both still load three.js from the pinned CDN, so they need an internet connection.
Opened from disk, a separately opened game file may not sync with the editor, because
browsers isolate `file://` pages.

## Speed, sound, animation

- **1x / 2x** (top right, next to settings) sets one global time scale for the
  simulation, the animations, the particles and the timers. "2x" is highlighted when
  it is on. Sounds keep their pitch. The headless bots and the tests always run at
  1x.
- **Sound** is synthesised with WebAudio:
  - pops rise in pitch along a boarding chain and reset after it;
  - each bus has an engine hum that follows its speed;
  - also: a soft brake squeak, a horn when a bus fills, a whoosh when the parachute
    opens, an echo in the tunnel and a soft warning thud;
  - a forest ambience of wind and birds plays underneath;
  - every sound is layered and its pitch varies a little.

  Settings → *Sound* mutes it, and the choice is remembered.
- **Animation:** nothing snaps.
  - Buses ease in and out, and sit on spring suspension.
  - They lean in curves, their wheels turn, and they pitch forward on hard brakes.
  - The queue rolls forward smoothly.
  - Stickmen hop on an arc with squash and stretch, and sway once seated. Columns
    step forward in a staggered wave. Idle stickmen move a little differently from
    each other.
  - The parachute pops with a squash, unfolds with an overshoot and swings like a
    pendulum.
  - Tunnels fade the bus into darkness, and the tunnel lamps pulse.
  - The ramp check badge pops with an overshoot and a sparkle.
  - A crash plays in slow motion, then the dominoes fall and the stickmen tumble.
  - Buttons and panels spring.

## Playing

Tap the front bus of a queue lane. If *buses on the main road + buses heading to it +
buses returning through the tunnel* is under 5 it drives to the main road (collector
road, nearer side lane, entry road); otherwise it parks in the leftmost free bay;
with no free bay it shakes and stays (not a fail). Tap a parked bus to send it to
the main road, or it does a handbrake lurch when the road check fails.

On the main road a bus stops at a ramp only if a front-row stickman matches its
colour. Matching front-row stickmen board nearest-the-road first, the columns step
forward, and the new front row is checked again until the bus is full or nothing
matches. A full bus hops, honks and parachutes off the road. An unfilled bus goes
through the top tunnel, comes out of the return tunnel `RETURN_TUNNEL_TIME` later
and parks in the leftmost free bay with its passengers. If every bay is taken when
it comes out, it crashes into the parked row (dominoes) and the level is lost.

Keys: **D** debug (front rows, boarding points, road-capacity maths), **B** greedy bot
plays live, **R** restart.

## Tuning

At the top of `shared/core.js`: `BUS_SPEED`, `BOARD_RATE`, `COLUMN_SHIFT_TIME`,
`ROAD_CAPACITY` (5), `STATIC_SLOTS` (5), `PARACHUTE_DURATION`, `RETURN_TUNNEL_TIME`,
`WIN_PANEL_DELAY` (1 s).

## Level data and the generator

`LEVEL_DATA` in `shared/core.js` is the built-in level, in format 2 (see above):
5 ramps of 4 columns and 3 lanes. The game never runs the generator. The editor is
now the usual way to make a level. The generator still works: run this in the
console and import the result into the editor, or paste it over `LEVEL_DATA`:

```js
MECore.searchSeed(1, 400, console.log).level
```

`generateLevel(seed)` gives 24 stickmen per colour on ramps of 40/36/40/36/40, with
runs of 1–4 in every column, at least 6 colours per ramp, at least 5 colours across
the front rows, the fixed bus plan in lanes of 9/9/8, and 2 hidden buses outside
the first two places. `searchSeed` keeps the first seed where the greedy bot wins
(at both the 1/30 s headless step and the 1/60 s live step) and the random bot wins
15–45% of 200 runs.

On startup the page re-validates `LEVEL_DATA` and logs seats against stickmen per
colour. A Web Worker then replays both bots on the frozen level:

```
[level] seed 11 — the game loads the frozen LEVEL_DATA
[level] seats vs stickmen per colour: red 24/24 ... pink 24/24 -> ALL MATCH (24 each, 192 total)
[sim] greedy bot: WIN — 52 sends, 192/192 boarded, 251.8 s of game time
[sim] greedy moves: L0:red4>road L0:pink12>road L0:orange6>road ...
[sim] random bot: 31/200 wins (15.5%) — target 15-45%: OK
```

**Bots.** Both bots tap only when the bus would go to the main road; neither ever
parks a lane bus on purpose. The **greedy bot** sends the available bus whose colour
has the most stickmen in the front rows. It waits while that score is 0 and traffic
is still moving. On a tie at 0 it takes a lane front, to dig into the queue; on a
positive tie it takes a parked bus, to free a bay. Without that tie-break it could
cycle the same parked buses forever. The **random bot** picks uniformly among the
available buses.

## How a few pieces work

**Yard traffic** never collides or deadlocks. When a bus is sent, its route is
rasterised once into the grid cells its footprint sweeps (0.3-unit cells with a
0.1 margin). Each cell stores when the bus enters it and when it leaves. A later
trip may not enter a cell that an earlier trip still has to cross. Waiting only ever
points at earlier trips, so there can be no cycle, and with merge order equal to
send order the buses also join the main road in the order they were sent. Each
check is O(1) per pair of trips per step.

**Main road.** Catmull-Rom (the same centripetal formulation as
`THREE.CatmullRomCurve3`) through control points with S-curves and one loop. The
loop crosses its own entry 1.35 units higher, on white pillars. Buses keep a fixed
bumper gap, so a stop for boarding cascades into hard brakes behind it, with brake
lights.

**Rendering.** All stickmen are two instanced meshes (body, arms). Their shadows come
from a 40-triangle proxy that shares the same instance matrices. Each bus is one
merged vertex-coloured mesh plus its two light meshes. The yard paint is one canvas
texture.

## Verification

```
node tests/rules.test.js      # 28 rule checks (unchanged)
node tests/layout.test.js     # yard clearance sweep (unchanged)
node tests/shared.test.js     # 45 checks: level format, layout builder, warnings, difficulty, links
node tests/browser.test.js    # 46 checks: game + editor in Chromium (needs `npm i playwright`)
node tests/standalone.test.js # 10 checks: builds dist/ and opens both single files from file://
```

The first three need only Node and no dependencies; they load `shared/core.js`.
`browser.test.js` serves the folder itself. It takes these optional settings:
- `CHROMIUM=/path/to/chrome`;
- `THREE_MODULE=/path/to/three.module.js`, to serve three.js locally when offline;
- `HEADFUL=1`, to watch the run.

It ends by saving the editor screenshot.

**The rules did not change.** Moving the core into `shared/core.js` was checked
against `tests/baseline.json`, which was recorded before the move. The road length,
the greedy bot's move list and times (at 30 Hz and 60 Hz) and the random bot's
31/200 are identical. The default level's ramp 3 has a new outline, because the new
check found it overlapping the spiral. Its columns were reordered so that play is
unchanged.

- The shared suite covers:
  - format 1 → 2 compatibility;
  - the tunnel side choice;
  - pillars and spirals;
  - ramp ordering and custom grids;
  - empty and hidden cells;
  - every warning kind;
  - the difficulty labels and `testLevel`;
  - linked buses.
- The browser suite covers:
  - the game's load order, 2x speed and mute;
  - RUN, Auto-run timing and new-tab sync;
  - undo/redo;
  - road insert, drag and delete, mouse and touch, and spirals;
  - painting, hidden cells, eraser and Fill random;
  - ramp resize and boarding drag;
  - queue add, link and reorder;
  - export/import and slots;
  - Test and Watch greedy.

- Headless rule suite (28 checks), all passing:
  - sending destinations and refusal;
  - the counter, including an invariant checked at every step of 120 bot games;
  - merge order and no overtaking;
  - boarding order and chains, and the instant jump on the last seat;
  - tunnel timing, leftmost-bay parking and keeping passengers;
  - fail on tunnel exit, hidden reveal, and the greedy win at 60 Hz;
  - no yard overlap (separating-axis test) and no deadlock across 120 bot games.
- The layout check sweeps every yard route at the maximum bus length against parked
  and queued buses. The minimum clearance is +0.03.
- In the browser, a live bot game:
  - wins at 238–252 s of game time;
  - shows the Level Complete panel ≈1.55 s after the last fill (parachute opens,
    then `WIN_PANEL_DELAY`);
  - shows all 5 ramp check badges;
  - resets cleanly on Replay.
- A forced fail plays the crash, the dominoes and the Out of Space panel.

**Frame rate could not be measured here.** The sandbox has no GPU. What I could
measure (the draw-call and triangle counts are from before the animation and sound
pass, which adds per-bus wheels and some small meshes):
- **164 draw calls, ~330k triangles per frame**, shadow pass included.
- 0.38 ms of CPU per 60 Hz logic tick, including the scene update.
- The canvas renders at native device resolution, capped at 2× DPR.

The 60 fps target is unverified on real hardware.

## Judgement calls

- **Environment.** The brief asks for a cozy forest on a grassy hill; the mockup is
  a red-rock canyon. I followed the brief, with muted greens so buses and stickmen
  stay the most saturated things on screen. I matched the mockup's layout, camera
  angle, UI and mood.
- **Return tunnel.** Its mouth faces left but is turned ~37° toward the camera. Fully
  side-on, the arch was invisible from this camera angle.
- **Level length.** The chosen level takes the greedy bot about 4 minutes. The random
  bot's 15.5% is inside the band but near its bottom edge. A later seed with a more
  central rate is one `searchSeed` call away.
