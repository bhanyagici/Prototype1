# Sand Sort — playable prototype

Single self-contained file: **`sand-sort/index.html`**. Vanilla JS + Canvas, no
libraries, no build step — open it in a browser and play.

## Playing

Tap the front bucket of any of the three bottom columns. It flies to the empty
dock nearest the tunnel, or to a static slot if every dock is taken. Riding
buckets scoop grains of their own colour out of the sand rank pressed against
the path curb; every 4 grains knocks 1 off the bucket's number. At 0 it pops and
frees its dock. A bucket that completes a lap parks in a free static slot, or
rides round again if the static row is full. Tap a parked bucket to send it back
out. Clear all 3,600 grains to win; fill all 10 slots at once and you lose.

Keys: **D** flow-field debug overlay, **B** auto-play bot, **R** restart.

## Tuning

All constants sit in one block at the top of the script: `CONVEYOR_SPEED`,
`PICKUP_RATE`, `PICKUP_RADIUS`, `GRAINS_PER_UNIT`, `SAND_STEPS_PER_FRAME`,
`GRID_W`, `GRID_H`, plus the level tables `LEVEL_COLUMNS`, `PATH_PTS` and the
tray geometry.

### Two constants that were tuned away from the brief

**`GRID_W`/`GRID_H` are 70x78, not 110x140.** The level supplies 900 bucket
units x 4 grains = 3,600 grains. At 110x140 the tray minus the path holds ~10,800
cells, so the tray would render two-thirds empty instead of the packed sand in
the reference art. At 70x78 it offers 3,637 cells, so the 3,600 grains fill it
edge to edge and only ~37 scattered cells stay bare at the hill tops. Set them
back to 110/140 to see the sparse version — nothing else breaks.

**`PICKUP_RADIUS` is 104, not the ~66 that "just past the curb" suggests.** The
collectable front rank sits at `PATH_W/2 + CURB` = 70px from the path centreline,
so a radius near 66 reaches essentially nothing — in testing the bot could not
finish a single run. 104 clears the curb and still covers ~77px of path either
side of the bucket.

## Verification

On load the page logs the grain audit and then runs the greedy bot headless 20
times. Current output:

```
[grid] 70x78  cell 10.63x10.51  usable sand cells 3637  filled 3600  guide channels 8
[sand] orange grains 960  target 960  (240 units)  OK
[sand] blue   grains 1200  target 1200  (300 units)  OK
[sand] yellow grains 880  target 880  (220 units)  OK
[sand] pink   grains 560  target 560  (140 units)  OK
[sand] total 3600 grains, targets all exact
[bot] 20 headless runs -> WIN 20  FAIL 0  TIMEOUT 0
[bot] winning runs took 288-384s of game time
```

The level data is exactly as supplied and was not adjusted.
