# Match Express — playable prototype

Single self-contained file: **`match-express/index.html`**. three.js 0.160.0 from a
pinned CDN through an import map; no other libraries, no build step. Open it in a
browser (it needs network access for the CDN import). Portrait 9:19.5, scales to fit
the window, mouse and touch.

![390x844 screenshot](screenshot-390.png)

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

## Files inside `index.html`

- **`<script id="core">`** is the whole game logic as a plain script with no three.js:
  the tuning constants and `LEVEL_DATA` at the top, then layout, rules, bots,
  validation and the level generator. The same code runs headless in Node and in a
  Web Worker.
- **`<script type="module">`** is the three.js rendering, animation, sound and UI.

## Tuning

At the top of the core script: `BUS_SPEED`, `BOARD_RATE`, `COLUMN_SHIFT_TIME`,
`ROAD_CAPACITY` (5), `STATIC_SLOTS` (5), `PARACHUTE_DURATION`, `RETURN_TUNNEL_TIME`,
`WIN_PANEL_DELAY` (1 s).

## Level data and the generator

`LEVEL_DATA` is a hand-editable object: 5 ramps of 4 columns listed front to back,
and 3 lanes listed front bus first (`{"color","cap","hidden"}`). The game loads it
and never runs the generator. To make a new one, run this in the console and paste
the result over `LEVEL_DATA`:

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

Run `node tests/rules.test.js` and `node tests/layout.test.js` (Node only, no
dependencies; they load the core straight out of `index.html`).

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
measure:
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
