# Bird Bites — feed pit update

Single self-contained file: **`bird-bites/bird-bites.html`**. Open it in a browser. Three.js r170 is
inlined as a base64 ES module on line 108 and is untouched.

The first commit on this folder is the prototype as received, so `git diff` shows exactly what changed.

## What changed

This is a visual and feel change only. Lines 1–108 are byte-for-byte the original. That covers
`SharedPool`, `TrayPool`, `Game`, the amounts, the 15-portion capacity and the win/blocked rules.
The new code sits in a `FEED-CORE` block after line 108 and in `setup3D()`.

- **Shared mode ("Ortak havuz")**: the tray is now a shallow **pit** dug into the ground.
  - The pit has a gentle floor that darkens toward the middle, a short steep wall, a raised irregular
    rim, and a soft shade under the rim on the side facing the light.
  - The grinder turns to aim at the heap it is filling. Kernels pour out with gravity, spin, a little
    random spread and small bounces, slide down the wall and roll into place.
  - Each corn's 45 kernels (15 per portion) form **their own heap** on a random free spot, at least
    `KER.gap` away from every other heap.
  - Heaps pile up naturally: a little higher in the middle, no two kernels ever intersect, and every
    raised kernel rests on at least two others.
  - Birds fly to a heap of their colour, stand on its free side, face it and peck the edge facing them,
    so the heap shrinks from that side. When the last kernel is eaten, the heap's spot is free again.
- **Trays mode ("5 tepsi")**: the five trays stay. Each tray gets the same physical pour and a natural
  heap. Birds keep their seats but face the heap and eat it from the edge.
- **Whole mode ("Bütün mısırlar")**: unchanged. Cobs land whole, so no kernels pour.
- The shared capacity bar moved beside the pit so it no longer covers the rim.

## Guarantees

- **No kernel leaves the pit or rests on the rim.**
  - Pour arcs are planned to clear the rim.
  - Once a kernel is inside, its centre is clamped to `PIT.wall`, which is on the wall below the rim.
  - Heaps only rest inside `PIT.rest`, on the floor.
- **Heaps never overlap.** Every heap reserves its full disc plus the gap until its last kernel is eaten.
- **There is always room.**
  - The empty pit holds 14 full-size heaps.
  - Every placement records a set of free full-size spots for all heaps that may still arrive. Eaten
    heaps only free space, so a new heap always finds a full-size spot while fewer than
    `KER.maxHeaps` (12) are down.
  - Why 12 and not 5: the pool's capacity is 5 corns, but birds eat one portion at a time. Half-eaten
    heaps let more corns in, and adversarial testing peaked at 10 heaps at once.
  - A "Pit capacity check" line is logged to the console on load.
- **Phone friendly.**
  - All kernels are one `InstancedMesh`.
  - Settled kernels sleep: they are not simulated and their matrices are not rewritten.
  - At most `KER.maxAwake` kernels are simulated at once (peak in tests: 88 shared, 182 trays).

## Testing done

- **In the browser (headless Chromium, every mode)**, with invariants checked every frame:
  - all 20 corns sent back to back, then a level played to the end (won, 60/60);
  - the pool filled to capacity: 5 heaps × 45 kernels in shared mode, 5 full trays in trays mode.
  - Result: 0 kernels outside the wall, 0 overlapping heaps, 0 birds at a wrong heap, 0 mismatches
    with the pool, no console errors.
- **Headless, using the real `Game` code** (400 random games, random levels, 1–6 lanes, random tempo
  sliders, three sending strategies, plus a 3000-game adversarial search): no invariant failures, and no
  placement ever needed the fallback.

## Tuning

`PIT` (pit size and shape) and `KER` (kernel size, kernels per portion, heap radius, gap, gravity and
caps) sit at the top of the `FEED-CORE` block. The block is plain JavaScript with no Three.js, so it can
be tested without a browser.
