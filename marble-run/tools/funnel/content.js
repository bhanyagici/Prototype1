// Fills a placed level (geometry.js) with marbles, boxes and blockers (Match Express's plan method).
// The idea: decide the boxes, then an intended send order (the PLAN), then fill the tray columns front-to-back
// following the plan - each box's marbles go to the front-most free cells, in runs - so the plan always works.
// The queue is dealt from the plan (each lane keeps plan order, so the plan stays playable with the slots).
// One knob, hardness h in [0, 1], sets how forgiving the level is for a player who sends boxes out of plan:
//   - shorter same-colour runs and a colour's boxes planned in blocks (fewer colours open at the fronts at once),
//   - lanes dealt less in step with the plan (the fronts offer boxes that are not ready yet),
//   - a few swaps against the plan inside lanes, and traps (a box whose colour is nowhere near the fronts, early in a
//     lane): sent early, such a box holds a slot for a long time - slot pressure is what makes a level hard.
// Dispensers sit in a column's queue on 2 cells (a few back cells stay empty to keep the total), lock crates go over
// cells whose marbles the plan needs only after the key box is complete, connected groups join boxes that the plan
// sends close together, and hidden boxes sit where they are revealed early.
const C = require('../../tests/core.js')();
const BASE = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'cyan', 'pink'];

function makeValid(sizes, max){
  const ok = new Array(max + 1).fill(false); ok[0] = true;
  for (let n = 1; n <= max; n++) ok[n] = sizes.some(s => s <= n && ok[n - s]);
  return ok;
}
function decompose(n, sizes, ok, rng, prefer){       // random split of n holes into boxes of the allowed sizes
  const out = [];
  while (n > 0){
    const cand = sizes.filter(s => s <= n && ok[n - s]);
    const w = cand.map(s => (prefer[s] || 1));
    let r = rng()*w.reduce((a, b) => a + b, 0), pick = cand[0];
    for (let i = 0; i < cand.length; i++){ r -= w[i]; if (r <= 0){ pick = cand[i]; break; } }
    out.push(pick); n -= pick;
  }
  return out;
}
function colorCounts(n, k, sizes, ok, rng, spread){
  const g = sizes.reduce((a, b) => { while (b){ [a, b] = [b, a % b]; } return a; }), minC = Math.max(4, Math.min(...sizes));
  for (let tries = 0; tries < 500; tries++){
    const w = Array.from({length:k}, () => 1 + (rng()*2 - 1)*spread), sw = w.reduce((a, b) => a + b, 0);
    const c = w.map(x => Math.max(minC, Math.round(n*x/sw/g)*g));
    let diff = n - c.reduce((a, b) => a + b, 0), guard = 0;
    while (diff !== 0 && guard++ < 200){ const i = Math.floor(rng()*k), d = Math.sign(diff)*g; if (c[i] + d >= minC){ c[i] += d; diff -= d; } }
    if (diff === 0 && c.every(m => m % 2 === 0 && ok[m])) return c;
  }
  return null;
}
const pickW = (rng, items, wf) => { const w = items.map(wf), t = w.reduce((a, b) => a + b, 0); let r = rng()*t;
  for (let i = 0; i < items.length; i++){ r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };

/* columns of every tray, in slide order of the trays; cap = cells that hold marbles */
function columnsOf(level){
  const L = C.buildLayout(JSON.parse(JSON.stringify(level))), cols = [];
  L.TRAYS.forEach((r, order) => level.trays[r.src].columns.forEach((col, c) => cols.push({tray:r.src, order, c, cap:col.length})));
  return {L, cols};
}

/* spec: n, role, colors, marbles (= the cells), sizes, lanes, blockers, popup, hint, trapMax */
function generate(spec, base, h, rng){
  const level = JSON.parse(JSON.stringify(base)), sizes = spec.sizes.slice().sort((a, b) => a - b), ok = makeValid(sizes, 400);
  const role = (spec.role || 'Challenge').split(' ')[0], fun = role === 'Fun', relax = role === 'Relax';
  const palette = BASE.slice(0, spec.colors);
  for (let i = palette.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [palette[i], palette[j]] = [palette[j], palette[i]]; }
  const {cols} = columnsOf(level);
  const nDisp = (spec.blockers && spec.blockers.disp) || 0;
  // a dispenser holds a run of marbles (its count) on 2 cells: its column closes up and ends that many cells short
  const dispCount = nDisp ? (spec.blockers.easy ? 6 : 8) : 0, dispH = 2;
  // the marbles: one per cell (a dispenser's extra marbles leave as many cells empty); every box size is even, so an
  // odd number of cells leaves one back cell empty
  const gcd = sizes.reduce((a, b) => { while (b){ [a, b] = [b, a % b]; } return a; }), cells = cols.reduce((a, c) => a + c.cap, 0), spare = cells % gcd, total = cells - spare;
  const counts = colorCounts(total, spec.colors, sizes, ok, rng, fun ? 0.15 : 0.3);
  if (!counts) return null;
  // boxes: Fun and Relax levels lean to big boxes; the others mix; every listed size appears
  const prefer = {}; sizes.forEach(s => prefer[s] = fun ? (s >= 8 ? 3 : 1) : relax ? (s >= 8 ? 2 : 1) : 1 + h*(s === 12 ? 1.5 : 0));
  let boxes = null;
  for (let t = 0; t < 60 && !boxes; t++){
    const b = []; palette.forEach((col, i) => decompose(counts[i], sizes, ok, rng, prefer).forEach(size => b.push({color:col, size})));
    if (sizes.every(s => b.some(x => x.size === s))) boxes = b;
  }
  if (!boxes) return null;
  // levels 1-5 must not be losable: a colour whose marbles sit in whole columns of their own always feeds its boxes,
  // so with at most 4 boxes of the other colours the 5 slots can never all hold boxes nothing can feed
  const pure = new Set(), pureCols = new Set(), pureOf = {};
  if (spec.n <= 5 && boxes.length > 4){
    const byColor = palette.map((col, i) => ({col, n:counts[i], boxes:boxes.filter(b => b.color === col).length})).sort((a, b) => b.boxes - a.boxes);
    let risky = boxes.length;
    for (const pc of byColor){
      if (risky <= 4) break;
      const free = cols.map((c, i) => i).filter(i => !pureCols.has(i)), pick = subsetSum(free.map(i => cols[i].cap), pc.n, rng);
      if (!pick) continue;
      pick.forEach(j => pureCols.add(free[j])); pureOf[pc.col] = pick.map(j => free[j]); pure.add(pc.col); risky -= pc.boxes;
    }
    if (risky > 4) return null;
  }
  // the plan: an order of boxes. Harder levels send a colour's boxes in blocks, so fewer colours are open at the fronts
  // at any time (a box sent out of turn finds little of its colour and holds its slot)
  const left = boxes.map((b, i) => i).filter(i => !pure.has(boxes[i].color)), P = [], block = 0.1 + 0.75*h;
  for (let i = left.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
  while (left.length){ const prev = P.length ? boxes[P[P.length - 1]].color : null;
    let k = prev && rng() < block ? left.findIndex(i => boxes[i].color === prev) : -1;
    if (k < 0){ k = left.findIndex(i => boxes[i].color !== prev); if (k < 0) k = 0; }
    P.push(left.splice(k, 1)[0]); }
  boxes.forEach((b, i) => { if (pure.has(b.color)) P.push(i); });
  // dispensers, chosen before the fill: one column, depth d, 2 cells, holding dispCount marbles of one colour - in
  // that column's queue they come right after the d cells in front of it.  To keep the level's total exact,
  // dispCount - 2 cells stay empty at the backs of other columns.
  const disp = [];
  for (let t = 0; t < nDisp; t++){
    const teach = spec.popup === 'dispenser';
    const cands = cols.map((c, i) => i).filter(i => !pureCols.has(i) && cols[i].cap >= 3 && !disp.some(x => cols[x.i].tray === cols[i].tray));
    if (!cands.length) return null;
    const nOn = r => cols.filter(c => c.tray === r).length;
    const i = teach ? cands.sort((x, y) => cols[x].order - cols[y].order || Math.abs(cols[x].c - (nOn(cols[x].tray) - 1)/2) - Math.abs(cols[y].c - (nOn(cols[y].tray) - 1)/2))[0]
                    : cands[Math.floor(rng()*cands.length)];
    disp.push({i, d:teach ? 1 : 1 + Math.floor(rng()*Math.min(2, cols[i].cap - 2))});
  }
  const seqCap = cols.map(c => c.cap);
  for (let e = 0; e < spare; e++){ const i = seqCap.map((c, k) => k).filter(k => !pureCols.has(k)).sort((x, y) => seqCap[y] - seqCap[x] || y - x)[0]; seqCap[i]--; }
  disp.forEach(t => { seqCap[t.i] = cols[t.i].cap - dispH + dispCount; });
  for (let e = 0; e < nDisp*(dispCount - dispH); e++){
    const cand = cols.map((c, i) => i).filter(i => !pureCols.has(i) && !disp.some(t => t.i === i) && seqCap[i] > 2).sort((x, y) => seqCap[y] - seqCap[x] || x - y);
    if (!cand.length) return null; seqCap[cand[Math.floor(rng()*Math.min(6, cand.length))]]--; }
  // fill: each box in plan order takes the front-most free places of the column queues, in runs
  const content = seqCap.map(n => new Array(n).fill(null)), owner = seqCap.map(n => new Array(n).fill(-1)), ptr = cols.map(() => 0);
  for (const pc of pure){ for (const i of pureOf[pc]){ content[i].fill(pc); ptr[i] = seqCap[i]; } }
  const runMean = Math.max(1.2, (fun ? 6.5 : relax ? 5 : 4.6) - (fun ? 2.5 : 3.0)*h), beta = 0.6 + 3.4*h;
  const later = {}; P.forEach(bi => { const c = boxes[bi].color; later[c] = (later[c] || 0) + boxes[bi].size; });
  const debt = {};                                   // dispenser marbles already placed for this colour's later boxes
  for (const bi of P){ const b = boxes[bi]; if (pure.has(b.color)) continue; let need = b.size; later[b.color] -= b.size;
    const owed = Math.min(need, debt[b.color] || 0); debt[b.color] = (debt[b.color] || 0) - owed; need -= owed;
    while (need > 0){
      const atDisp = i => disp.find(t => t.i === i && ptr[i] === t.d);
      const free = cols.map((c, i) => i).filter(i => ptr[i] < seqCap[i] && !pureCols.has(i) && (!atDisp(i) || need + later[b.color] - (debt[b.color] || 0) >= dispCount));
      if (!free.length) return null;
      const i = pickW(rng, free, j => Math.exp(-beta*ptr[j]) * (ptr[j] && content[j][ptr[j] - 1] === b.color ? 0.4 : 1));
      if (atDisp(i)){                                // the dispenser: all its marbles in this colour
        content[i].fill(b.color, ptr[i], ptr[i] + dispCount); owner[i].fill(P.indexOf(bi), ptr[i], ptr[i] + dispCount); ptr[i] += dispCount;
        const used = Math.min(need, dispCount); need -= used; debt[b.color] = (debt[b.color] || 0) + dispCount - used; continue; }
      const t = disp.find(x => x.i === i && ptr[i] < x.d), room = t ? t.d - ptr[i] : seqCap[i] - ptr[i];
      const put = Math.min(Math.max(1, Math.round(runMean*(0.6 + 0.8*rng()))), need, room);
      content[i].fill(b.color, ptr[i], ptr[i] + put); owner[i].fill(P.indexOf(bi), ptr[i], ptr[i] + put); ptr[i] += put; need -= put;
    }
  }
  if (ptr.some((p, i) => p !== seqCap[i]) || Object.values(debt).some(v => v)) return null;
  // write the columns into the trays (a dispenser's column: the cells in front, the dispenser's 2 cells, the rest)
  const ownerAt = {};
  cols.forEach((c, i) => { const t = disp.find(x => x.i === i), phys = t ? content[i].slice(0, t.d).concat([null, null], content[i].slice(t.d + dispCount)) : content[i].slice();
    while (phys.length < c.cap) phys.push(null);
    level.trays[c.tray].columns[c.c] = phys;
    if (t) level.trays[c.tray].dispensers = (level.trays[c.tray].dispensers || []).concat([{col:c.c, row:t.d, w:1, h:dispH, color:content[i][t.d], count:dispCount}]);
    else { const o = owner[i].slice(); while (o.length < c.cap) o.push(-1); ownerAt[c.tray + ':' + c.c] = o; } });
  // hidden marbles: a share of the cells behind the front row (never the first two rows of a teaching level)
  const hm = (spec.blockers && spec.blockers.hiddenMarbles) || 0;
  if (hm){ const teach = spec.popup === 'hiddenMarbles';
    level.trays.forEach(r => r.columns.forEach(col => col.forEach((cell, row) => { if (cell && row >= (teach ? 1 : 2) && cell[0] !== '?' && rng() < hm) col[row] = '?' + cell; }))); }
  // the queue: deal the plan into the level's lanes (2-5; in step with the plan for easy levels), then a few swaps against it
  const NL = spec.lanes || 3, lanes = Array.from({length:NL}, () => []); let rr = 0;
  P.forEach((bi, k) => { const l = rng() < 0.1 + 0.9*h ? Math.floor(rng()*NL) : rr % NL; rr++; lanes[l].push(Object.assign({}, boxes[bi], {plan:k})); });
  for (let g = 0; g < 50; g++){ const lens = lanes.map(l => l.length), mx = lens.indexOf(Math.max(...lens)), mn = lens.indexOf(Math.min(...lens));
    if (lens[mx] - lens[mn] <= 2) break; const b = lanes[mx].pop(); lanes[mn].push(b); lanes[mn].sort((a, c) => a.plan - c.plan); }
  const win = 6*h*h;
  lanes.forEach(ln => { ln.forEach(b => { b.k = b.plan + rng()*win; }); ln.sort((a, c) => a.k - c.k); ln.forEach(b => { delete b.k; }); });
  // traps: boxes whose colour is nowhere at the fronts when the level starts, moved up to the heads of two lanes.  Sent
  // early, such a box holds its slot until its marbles are dug out; the plan sends it only when nothing else matches
  // (h above 1 is for the hardest targets: up to 40% of the boxes may be traps)
  const nTrap = spec.n <= 5 ? 0 : Math.floor(Math.min(1, h*h)*(Math.min(spec.trapMax || 4, Math.floor(boxes.length/(h > 1 ? 2.5 : 4))) + 0.99));
  if (nTrap > 0){
    const open = new Set(content.map(c => c[0]).filter(Boolean));
    const firstLane = lanes.findIndex(ln => ln.some(b => b.plan === 0)), trapLanes = lanes.map((_, l) => l).filter(l => l !== firstLane);
    const cand = lanes.flatMap((ln, l) => ln.map((b, i) => ({b, l, i}))).filter(x => !open.has(x.b.color) && x.i >= 2 && x.b.plan >= P.length*0.3)
      .sort((x, y) => y.b.plan - x.b.plan);
    for (let t = 0; t < nTrap && cand.length; t++){
      const x = cand.splice(Math.floor(rng()*Math.min(3, cand.length)), 1)[0], ln = lanes[x.l];
      ln.splice(ln.indexOf(x.b), 1); lanes[trapLanes[t % trapLanes.length]].splice(Math.floor(t/2), 0, x.b);
    }
  }
  level.lanes = lanes; if (NL !== 3) level.laneCount = NL; else delete level.laneCount;
  return {level, boxes, P, palette, counts, pure:[...pure], ownerAt};
}
function subsetSum(caps, target, rng){                 // indices of caps adding up to target (randomised)
  const order = caps.map((c, i) => i); for (let i = order.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const res = []; const go = (k, left) => { if (!left) return true; if (k >= order.length || left < 0) return false;
    res.push(order[k]); if (go(k + 1, left - caps[order[k]])) return true; res.pop(); return go(k + 1, left); };
  return go(0, target) ? res.slice() : null;
}

/* blockers that sit on the queue: hidden boxes, connected groups, the key box */
function queueBlockers(spec, gen, rng, gk){
  const {level} = gen, B = spec.blockers || {}, lanes = level.lanes, hard = spec.diff >= 7, NL = lanes.length;
  gk = gk || 1;                                    // the tuner may ask for more (or fewer) connected groups
  const nb = lanes.flat().length, wide = NL >= 4 ? 1.8 : 1, k = n => Math.max(1, Math.round(n*gk*wide));
  const want = B.link === 'pairs' ? {2:k(Math.max(2, nb/9)), 3:0} : B.link === 'triple' ? {2:NL >= 4 ? k(nb/12) : 0, 3:1}
             : B.link === 'triples' ? {2:NL >= 4 ? k(nb/14) : 0, 3:k(Math.max(2, nb/14))} : B.link === 'pairs+triples' ? {2:k(2), 3:k(2)} : {2:0, 3:0};
  if (B.linkN){ if (B.link === 'pairs') want[2] = B.linkN; else if (B.link === 'triple' || B.link === 'triples') want[3] = B.linkN; }
  let gid = 0;
  const shapes = {2:[[[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 1]], [[0, 1], [1, 0]]], 3:[[[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]]]};
  const teachLink = spec.popup === 'connected' || spec.hint === 'triple';
  for (const size of [3, 2]) for (let q = 0; q < want[size]; q++){
    let best = null;
    for (let t = 0; t < 400; t++){
      const across = shapes[size].filter(s => s.some(([dl]) => dl > 0)), pool = NL >= 4 && rng() < 0.8 ? across : shapes[size];
      const sh = pool[Math.floor(rng()*pool.length)], l0 = Math.floor(rng()*NL), i0 = teachLink && gid === 0 ? 0 : Math.floor(rng()*(NL >= 4 ? 8 : 6));
      const cells = sh.map(([dl, di]) => [l0 + dl, i0 + di]);
      if (cells.some(([l, i]) => l > NL - 1 || !lanes[l][i] || lanes[l][i].link)) continue;
      const plans = cells.map(([l, i]) => lanes[l][i].plan), spreadP = Math.max(...plans) - Math.min(...plans);
      const trial = {lanes:lanes.map(ln => ln.map(b => ({link:b.link})))}; cells.forEach(([l, i]) => { trial.lanes[l][i].link = 'G' + (gid + 1); });
      if (!linksOk(trial)) continue;
      const score = -spreadP - (teachLink && gid === 0 ? cells.reduce((a, [, i]) => a + i, 0)*3 : 0) + rng()*0.5;
      if (!best || score > best.score) best = {cells, score};
    }
    if (!best){ if (q === 0) return false; break; }      // the first group of a size is the design; more are best effort
    gid++; best.cells.forEach(([l, i]) => { lanes[l][i].link = 'G' + gid; });
  }
  // hidden boxes: revealed early (second in a lane); in hard levels only in the first two places of a lane
  const nHid = B.hidden || 0, teachHid = spec.popup === 'hidden';
  for (let q = 0; q < nHid; q++){
    const opts = []; lanes.forEach((ln, l) => ln.forEach((b, i) => { if (!b.hidden && i >= 1 && (teachHid && q === 0 ? i === 1 : hard ? i <= 1 : i <= 4)) opts.push([l, i]); }));
    if (!opts.length) return false;
    const [l, i] = opts[Math.floor(rng()*opts.length)]; lanes[l][i].hidden = true;
  }
  return true;
}
/* lock crates (blockers.lock of them, each on a tray of its own) over cells the plan needs late, each key on an earlier
   box near a lane front; the popup's level puts its first crate on the first tray */
function lockCrate(spec, gen, rng){
  const {level} = gen, L = C.buildLayout(JSON.parse(JSON.stringify(level))), teach = spec.popup === 'lock', n = Math.max(1, +spec.blockers.lock || 1), used = new Set();
  for (let q = 0; q < n; q++){
    const trays = L.TRAYS.filter(r => !used.has(r.src)).slice(0, teach && q === 0 ? 1 : 2 + q);
    let best = null;
    for (const r of trays){ const rd = level.trays[r.src]; if ((rd.dispensers || []).length) continue;
      for (let w = 1; w <= 3; w++) for (let c0 = 0; c0 + w <= rd.columns.length; c0++) for (let row = 1; row <= rd.rows - 2; row++){
        const h = Math.min(2, rd.rows - row); let minP = 99, cnt = 0;
        for (let c = c0; c < c0 + w; c++){ const own = gen.ownerAt[r.src + ':' + c]; if (!own){ minP = -1; break; }
          for (let k = row; k < rd.rows; k++){ if (rd.columns[c][k]){ cnt++; minP = Math.min(minP, own[k]); } } }
        if (cnt < 3) continue;
        const score = minP*2 - row - (teach && q === 0 ? 0 : rng()*2) + cnt*0.05;
        if (!best || score > best.score) best = {src:r.src, c0, w, row, h, minP, score};
      } }
    if (!best || best.minP < 2){ if (q === 0) return false; break; }
    // the key: on a box planned before the crate's marbles are needed, as near a lane front as possible
    const cand = []; level.lanes.forEach((ln, l) => ln.forEach((b, i) => { if (b.plan < best.minP - 1 && !b.link && !b.key) cand.push({b, l, i}); }));
    if (!cand.length){ if (q === 0) return false; break; }
    cand.sort((a, b) => a.i - b.i || b.b.plan - a.b.plan);
    const kb = teach && q === 0 ? cand[0] : cand[Math.floor(rng()*Math.min(3, cand.length))], lock = 'K' + (q + 1);
    kb.b.key = lock; used.add(best.src);
    const rd = level.trays[best.src]; rd.crates = (rd.crates || []).concat([{col:best.c0, row:best.row, w:best.w, h:best.h, lock}]);
  }
  return true;
}
/* a count crate over cells the plan needs late: it opens once that many boxes are complete (fewer than the plan
   completes before it needs them) */
function countCrate(spec, gen, rng){
  const {level} = gen, L = C.buildLayout(JSON.parse(JSON.stringify(level))); let best = null;
  for (const r of L.TRAYS){ const rd = level.trays[r.src]; if ((rd.dispensers || []).length || (rd.crates || []).length) continue;
    for (let w = 1; w <= 3; w++) for (let c0 = 0; c0 + w <= rd.columns.length; c0++) for (let row = 1; row <= rd.rows - 2; row++){
      let minP = 99, cnt = 0;
      for (let c = c0; c < c0 + w; c++){ const own = gen.ownerAt[r.src + ':' + c]; if (!own){ minP = -1; break; }
        for (let k = row; k < rd.rows; k++){ if (rd.columns[c][k]){ cnt++; minP = Math.min(minP, own[k]); } } }
      if (cnt < 3 || minP < 3) continue;
      const score = minP - row*0.5 + rng();
      if (!best || score > best.score) best = {src:r.src, c0, w, row, h:Math.min(2, rd.rows - row), minP, score};
    } }
  if (!best) return false;
  const rd = level.trays[best.src]; rd.crates = (rd.crates || []).concat([{col:best.c0, row:best.row, w:best.w, h:best.h, count:Math.max(1, Math.min(best.minP - 1, 2 + Math.floor(rng()*3)))}]);
  return true;
}
/* the core's rules for connected boxes (as checkLevel reports them), on the queue alone: 2-3 boxes that touch, and the
   queue can still be emptied */
function linksOk(N){
  return C.linkGroups(N).every(G => G.members.length >= 2 && G.members.length <= 3 && G.connected && G.consecutive) && !C.queueDeadlock(N);
}
function strip(level){ level.lanes.forEach(ln => ln.forEach(b => { delete b.plan; })); return level; }
module.exports = {generate, queueBlockers, lockCrate, countCrate, strip, BASE};
