# Yarn Bear — playable prototype

Single self-contained file: **`yarn-bear/index.html`**. three.js 0.160.0 from a
pinned CDN via an import map; no other libraries, no build step. Open it in a
browser (it needs network access for the CDN import).

## Playing

Tap the front spool of any of the four columns and it drops into the leftmost
free slot. A spool in a slot pulls stitches of its own colour off the bear, one
at a time, always the visible matching stitch nearest the last one, so the
strand travels across the surface. Peeling a region reveals the colours
underneath. When a spool hits 0 it pops and frees its slot; with all five slots
full a tap just shakes the spool, which is not a fail.

The bear auto-rotates; drag it to spin it freely, and auto-rotation resumes
`AUTO_RESUME_DELAY` after you let go. A spool whose colour is not currently
facing you simply waits and resumes on its own once rotation or peeling exposes
one.

Keys: **D** highlight the visible voxels of the slot colours, **B** let the bot
play, **R** restart.

## Tuning

Constants at the top of the script: `AUTO_ROTATE_SPEED`, `AUTO_RESUME_DELAY`,
`PULL_RATE`, `VOXEL_RESOLUTION`, `SLOT_COUNT`, plus `VISIBILITY_MS` and the
spool split bounds.

## How a few pieces work

**The bear** is built from spheres, ellipsoids and capsules, voxelized at
`VOXEL_RESOLUTION` cells tall (2,753 voxels), and drawn as one `InstancedMesh`
of rounded cubes with a knitted-V canvas texture and per-voxel colour noise.
Only voxels with an open face are drawn — interior ones collapse to zero scale,
so about 1,000 of the 2,753 instances are live at the start.

**Layering.** A BFS from the surface gives every voxel a depth, the surface
colour is flooded inward, and each voxel takes that colour's layer sequence
shifted by depth. Patches are whole shells of a region, never scattered single
voxels, and all seven colours appear inside.

**Visibility** is not a raycast against triangles. Each voxel is visible when it
has an empty neighbour face pointing at the camera *and* a 3D-DDA walk of the
voxel grid from the voxel toward the camera reaches the outside without hitting
another live voxel. That is exact, costs 0.2ms for the whole model, and runs on
a `VISIBILITY_MS` throttle.

## Verification

On load the page logs the voxel counts, checks the spool split, and runs a
headless solvability bot that treats every exposed voxel as reachable, retrying
with a fresh seed up to 50 times:

```
[bear] grid 23x28x16   voxels 2753
[bear] voxels per colour: brown 1175  cream 621  red 157  yellow 185  green 187  blue 152  purple 276
[level] spool totals match voxel counts: YES   every spool within 5..40: YES   spools 111
[level] solvable: seed 1 passed, 111 sends
```

### Notes on two judgement calls

**Frame rate could not be measured here.** This sandbox has no GPU — Chromium
falls back to swiftshader and renders at a few frames per second, which is a
property of the test environment, not the game. What is measurable is the CPU
work per frame: **0.000ms** for pulling plus the end-state check, and **0.20ms**
for the throttled visibility pass. The draw is a single instanced call of ~1,000
rounded cubes. The 60fps target is unverified on real hardware.

**`BAND = 1`.** Layer colours change every voxel of depth rather than every two.
The model is only ~5 voxels deep, so with wider bands the later entries of each
layer sequence were never reached and the queue came out roughly half brown. A
band is still a whole shell, so patches stay large.
