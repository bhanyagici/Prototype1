# Bird Farm — playable prototype

Single self-contained file: **`bird-farm/index.html`**. Vanilla JS + Canvas, no
libraries, no build step — open it in a browser and play.

## Playing

Tap the front corn cob of any of the three columns. It arcs into the nearer
grinder, the crank spins and the kernels pour into the pool as a heap of that
colour with a count tag. The pool holds **5 heaps** whatever their counts; tap a
cob with the pool full and it just shakes — that is not a fail.

A bird is **exposed** if it sits on the grid's outer border, or if any of its 4
orthogonal neighbours is an empty spot. While a heap has kernels left and a
matching exposed bird exists, that bird takes off and flies to the heap, pecks
once and is gone, taking 1 off the count. Birds nearest the outer border go
first, ties going to the one nearest the pool; a bird's spot empties the moment
it takes off, which can expose its neighbours. Heaps of the same colour are fed
oldest first, and a heap with no matching exposed bird simply waits.

Feed all 144 birds to win. Lose if the pool holds 5 heaps, nothing is in the
air, and none of the heaps has an exposed bird of its colour.

Keys: **D** outline the exposed birds, **B** auto-play bot, **R** restart.

## Tuning

Constants at the top of the script: `MAX_FLYING`, `FLIGHT_TIME`, `PECK_TIME`,
`SEND_TIME`, `POOL_CAPACITY`, plus the level tables `BIRD_ROWS` and
`CORN_QUEUE`.

## Verification

On load the page audits the level data and runs the greedy bot headless,
simulating the rules instantly:

```
[data] B  birds 66   corn 66   OK
[data] R  birds 56   corn 56   OK
[data] G  birds 14   corn 14   OK
[data] Y  birds 8   corn 8   OK
[data] totals: birds 144, corn 144  -> corn matches birds exactly
[bot] headless greedy run: WIN   fed 144/144   13 sends
[bot] moves: c1:B20  c2:B16  c2:R20  c2:B12  c1:G8  c1:R15  c1:B10  c1:Y3
             c3:G6  c3:R12  c3:B8  c3:R9  c2:Y5
```

The level data is exactly as supplied and was not adjusted. Alongside the
greedy policy, a leftmost-first and a feedable-first policy were also checked
offline; all three clear the level, so it is not knife-edge.

One rule beyond the brief: the brief's fail condition only covers a **full**
pool. If every cob has been sent and the remaining heaps have no exposed bird,
the board is equally dead with fewer than 5 heaps, so that state also ends the
level (the overlay says which case it was). With matching totals it should not
arise.
