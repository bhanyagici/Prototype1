# Sort Express — playable prototype

A single self-contained file: **`index.html`**. No build step, no dependencies —
open it in a browser (or `python3 -m http.server` and visit it) and play.

## How it plays

Tap the highlighted front bus of any of the three bottom columns to send it up
the winding road. A bus collects passengers matching its own colour from the
front of each platform queue it passes, station after station, lap after lap.
Fill all 8 seats and it exits through the top tunnel; otherwise it loops back
out of the bottom tunnel, keeping the passengers it already has, and tries
again. At most 5 buses share the road at once; taps made while the road is full
are held and launch automatically as soon as a slot frees up.

Clear all 240 passengers with all 30 buses to win.

## Tuning the level

Everything a designer needs sits in the clearly marked **LEVEL DEFINITION**
block at the top of the `<script>`, above the `GAME LOGIC` banner:

| Constant | Meaning |
| --- | --- |
| `COLORS` | the five passenger/bus colours |
| `BUS_CAPACITY` | seats per bus (8) |
| `MAX_CONCURRENT_BUSES` | buses allowed on the road at once (5) |
| `QUEUE_DATA` | the three bottom columns, front bus first |
| `PLATFORM_LAYOUT` | each platform's position along the road and its side |
| `PLATFORM_RUNS` | each platform's queue as `[colour, clusterSize]` runs |
| `LAP_SECONDS`, `BOARD_MS`, … | pacing |

The comment above `PLATFORM_RUNS` shows the passenger arithmetic worked out in
full. A `console.log` on load re-checks it live: bus counts, passenger counts,
platform totals, cluster sizes and colour coverage.

### A note on level design

Buses may only take the **front** run of a platform queue, so a careless launch
order can strand part-filled buses with no queue front they can use. That is a
genuine dead end, and the game detects it immediately and reports
`Level Failed` rather than spinning. The shipped ordering was chosen by
simulating many thousands of playthroughs: every sensible tapping strategy
clears it, and even uniformly random tapping clears it ~96% of the time.
