// Fills a placed funnel level (geometry.js) with stickmen, buses and blockers.
// The idea: decide the buses, then an intended send order (the PLAN), then fill the ramp columns front-to-back
// following the plan - each bus's stickmen go to the front-most free cells, in runs - so the plan always works.
// The queue is dealt from the plan (each lane keeps plan order, so the plan stays playable without bays).
// One knob, hardness h in [0, 1], sets how forgiving the level is for a player who sends buses out of plan:
//   - shorter same-colour runs (fewer stickmen of a colour at the fronts at once),
//   - lanes dealt less in step with the plan (the fronts offer buses that are not ready yet),
//   - a few swaps against the plan inside lanes (some buses must take a lap or wait in a bay).
// Tunnels are a run in a column's queue on 2 cells (a few back cells stay empty to keep the total), lock boxes go over cells
// whose stickmen the plan needs only after the key bus has passed, connected groups join buses that the plan
// sends close together, and hidden buses sit where they are revealed early.
const C = require('../../tests/core.js')();
const BASE = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'cyan', 'pink'];

function makeValid(sizes, max){
  const ok = new Array(max + 1).fill(false); ok[0] = true;
  for (let n = 1; n <= max; n++) ok[n] = sizes.some(s => s <= n && ok[n - s]);
  return ok;
}
function decompose(n, sizes, ok, rng, prefer){       // random split of n seats into buses of the allowed sizes
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
function colorCounts(men, k, sizes, ok, rng, spread){
  const g = sizes.reduce((a, b) => { while (b){ [a, b] = [b, a % b]; } return a; }), minC = Math.max(4, Math.min(...sizes));
  for (let tries = 0; tries < 500; tries++){
    const w = Array.from({length:k}, () => 1 + (rng()*2 - 1)*spread), sw = w.reduce((a, b) => a + b, 0);
    const c = w.map(x => Math.max(minC, Math.round(men*x/sw/g)*g));
    let diff = men - c.reduce((a, b) => a + b, 0), guard = 0;
    while (diff !== 0 && guard++ < 200){ const i = Math.floor(rng()*k), d = Math.sign(diff)*g; if (c[i] + d >= minC){ c[i] += d; diff -= d; } }
    if (diff === 0 && c.every(n => n % 2 === 0 && ok[n])) return c;
  }
  return null;
}
const pickW = (rng, items, wf) => { const w = items.map(wf), t = w.reduce((a, b) => a + b, 0); let r = rng()*t;
  for (let i = 0; i < items.length; i++){ r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };

/* columns of every ramp, in road order of the ramps; cap = cells that hold stickmen */
function columnsOf(level){
  const L = C.buildLayout(JSON.parse(JSON.stringify(level))), cols = [];
  L.RAMPS.forEach((r, order) => level.ramps[r.src].columns.forEach((col, c) => cols.push({ramp:r.src, order, c, cap:col.length})));
  return {L, cols};
}

/* params: h, role, colors, men, sizes, blockers, rng, nofail, minRun */
function generate(spec, base, h, rng){
  const level = JSON.parse(JSON.stringify(base)), sizes = spec.sizes.slice().sort((a, b) => a - b), ok = makeValid(sizes, 400);
  const role = spec.role.split(' ')[0], fun = role === 'Fun', relax = role === 'Relax';
  const palette = BASE.slice(0, spec.colors);
  for (let i = palette.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [palette[i], palette[j]] = [palette[j], palette[i]]; }
  const {cols} = columnsOf(level);
  const nTun = (spec.blockers && spec.blockers.tunnel) || 0;
  // a tunnel takes a run of stickmen inside (its count) on 2 cells: its column closes up and ends that many cells short
  const tunCount = nTun ? (spec.blockers.easy ? 6 : 8) : 0, tunH = 2;
  const men = spec.men;
  const counts = colorCounts(men, spec.colors, sizes, ok, rng, fun ? 0.15 : 0.3);
  if (!counts) return null;
  // buses: Fun and Relax levels lean to big buses; the others mix; every listed size appears
  const prefer = {}; sizes.forEach(s => prefer[s] = fun ? (s >= 8 ? 3 : 1) : relax ? (s >= 8 ? 2 : 1) : 1 + h*(s === 12 ? 1.5 : 0));
  let buses = null;
  for (let t = 0; t < 60 && !buses; t++){
    const b = []; palette.forEach((col, i) => decompose(counts[i], sizes, ok, rng, prefer).forEach(cap => b.push({color:col, cap})));
    if (sizes.every(s => b.some(x => x.cap === s))) buses = b;
  }
  if (!buses) return null;
  // levels before 6 must not be losable: with more than 5 buses, enough colours sit in whole columns of their own
  // (such a bus always fills on its first lap) that at most 5 buses could ever come back unfilled
  const pure = new Set(), pureCols = new Set(), pureOf = {};
  if (spec.n <= 5 && buses.length > 5){
    const byColor = palette.map((col, i) => ({col, n:counts[i], buses:buses.filter(b => b.color === col).length})).sort((a, b) => b.buses - a.buses);
    let risky = buses.length;
    for (const pc of byColor){
      if (risky <= 5) break;
      // whole columns (not yet used) whose sizes add up to this colour's count
      const free = cols.map((c, i) => i).filter(i => !pureCols.has(i)), pick = subsetSum(free.map(i => cols[i].cap), pc.n, rng);
      if (!pick) continue;
      pick.forEach(j => pureCols.add(free[j])); pureOf[pc.col] = pick.map(j => free[j]); pure.add(pc.col); risky -= pc.buses;
    }
    if (risky > 5) return null;
  }
  // the plan: an order of buses. Harder levels send a colour's buses in blocks, so fewer colours are open at the
  // fronts at any time (a bus sent out of turn finds little of its colour and must take another lap)
  const left = buses.map((b, i) => i).filter(i => !pure.has(buses[i].color)), P = [], block = 0.1 + 0.75*h;
  for (let i = left.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
  while (left.length){ const prev = P.length ? buses[P[P.length - 1]].color : null;
    let k = prev && rng() < block ? left.findIndex(i => buses[i].color === prev) : -1;
    if (k < 0){ k = left.findIndex(i => buses[i].color !== prev); if (k < 0) k = 0; }
    P.push(left.splice(k, 1)[0]); }
  buses.forEach((b, i) => { if (pure.has(b.color)) P.push(i); });
  // tunnels, chosen before the fill: one column, depth d, 2 cells, holding tunCount stickmen of one colour - in that
  // column's queue they come right after the d cells in front of it. To keep the level's total exact, tunCount - 2
  // cells stay empty at the backs of other columns.
  const tun = [];
  for (let t = 0; t < nTun; t++){
    const teach = spec.popup === 'tunnel';
    const cands = cols.map((c, i) => i).filter(i => !pureCols.has(i) && cols[i].cap >= 3 && !tun.some(x => cols[x.i].ramp === cols[i].ramp));
    if (!cands.length) return null;
    const nOn = r => cols.filter(c => c.ramp === r).length;
    const i = teach ? cands.sort((x, y) => cols[x].order - cols[y].order || Math.abs(cols[x].c - (nOn(cols[x].ramp) - 1)/2) - Math.abs(cols[y].c - (nOn(cols[y].ramp) - 1)/2))[0]
                    : cands[Math.floor(rng()*cands.length)];
    tun.push({i, d:teach ? 1 : 1 + Math.floor(rng()*Math.min(2, cols[i].cap - 2))});
  }
  const seqCap = cols.map(c => c.cap);
  tun.forEach(t => { seqCap[t.i] = cols[t.i].cap - tunH + tunCount; });
  for (let e = 0; e < nTun*(tunCount - tunH); e++){
    const cand = cols.map((c, i) => i).filter(i => !pureCols.has(i) && !tun.some(t => t.i === i) && seqCap[i] > 2).sort((x, y) => seqCap[y] - seqCap[x] || x - y);
    if (!cand.length) return null; seqCap[cand[Math.floor(rng()*Math.min(6, cand.length))]]--; }
  // fill: each bus in plan order takes the front-most free places of the column queues, in runs
  const content = seqCap.map(n => new Array(n).fill(null)), owner = seqCap.map(n => new Array(n).fill(-1)), ptr = cols.map(() => 0);
  for (const pc of pure){ for (const i of pureOf[pc]){ content[i].fill(pc); ptr[i] = seqCap[i]; } }
  const runMean = Math.max(1.2, (fun ? 6.5 : relax ? 5 : 4.6) - (fun ? 2.5 : 3.0)*h), beta = 0.6 + 3.4*h;
  const later = {}; P.forEach(bi => { const c = buses[bi].color; later[c] = (later[c] || 0) + buses[bi].cap; });
  const debt = {};                                   // tunnel stickmen already placed for this colour's later buses
  for (const bi of P){ const b = buses[bi]; if (pure.has(b.color)) continue; let left = b.cap; later[b.color] -= b.cap;
    const owed = Math.min(left, debt[b.color] || 0); debt[b.color] = (debt[b.color] || 0) - owed; left -= owed;
    while (left > 0){
      const atTun = i => tun.find(t => t.i === i && ptr[i] === t.d);
      const free = cols.map((c, i) => i).filter(i => ptr[i] < seqCap[i] && !pureCols.has(i) && (!atTun(i) || left + later[b.color] - (debt[b.color] || 0) >= tunCount));
      if (!free.length) return null;
      const i = pickW(rng, free, j => Math.exp(-beta*ptr[j]) * (ptr[j] && content[j][ptr[j] - 1] === b.color ? 0.4 : 1));
      if (atTun(i)){                                 // the tunnel: all its stickmen in this colour
        content[i].fill(b.color, ptr[i], ptr[i] + tunCount); owner[i].fill(P.indexOf(bi), ptr[i], ptr[i] + tunCount); ptr[i] += tunCount;
        const used = Math.min(left, tunCount); left -= used; debt[b.color] = (debt[b.color] || 0) + tunCount - used; continue; }
      const t = tun.find(x => x.i === i && ptr[i] < x.d), room = t ? t.d - ptr[i] : seqCap[i] - ptr[i];
      const put = Math.min(Math.max(1, Math.round(runMean*(0.6 + 0.8*rng()))), left, room);
      content[i].fill(b.color, ptr[i], ptr[i] + put); owner[i].fill(P.indexOf(bi), ptr[i], ptr[i] + put); ptr[i] += put; left -= put;
    }
  }
  if (ptr.some((p, i) => p !== seqCap[i]) || Object.values(debt).some(v => v)) return null;
  // write the columns into the ramps (a tunnel's column: the cells in front, the tunnel's 2 cells, the rest)
  const ownerAt = {};
  cols.forEach((c, i) => { const t = tun.find(x => x.i === i), phys = t ? content[i].slice(0, t.d).concat([null, null], content[i].slice(t.d + tunCount)) : content[i].slice();
    while (phys.length < c.cap) phys.push(null);
    level.ramps[c.ramp].columns[c.c] = phys;
    if (t) level.ramps[c.ramp].tunnels = (level.ramps[c.ramp].tunnels || []).concat([{col:c.c, row:t.d, w:1, h:tunH, color:content[i][t.d], count:tunCount}]);
    else { const o = owner[i].slice(); while (o.length < c.cap) o.push(-1); ownerAt[c.ramp + ':' + c.c] = o; } });
  // the queue: deal the plan into three lanes (in step with the plan for easy levels), then a few swaps against it
  const lanes = [[], [], []]; let rr = 0;
  P.forEach((bi, k) => { const l = rng() < 0.1 + 0.9*h ? Math.floor(rng()*3) : rr % 3; rr++; lanes[l].push(Object.assign({}, buses[bi], {plan:k})); });
  // keep the lanes about even
  for (let g = 0; g < 50; g++){ const lens = lanes.map(l => l.length), mx = lens.indexOf(Math.max(...lens)), mn = lens.indexOf(Math.min(...lens));
    if (lens[mx] - lens[mn] <= 2) break; const b = lanes[mx].pop(); lanes[mn].push(b); lanes[mn].sort((a, c) => a.plan - c.plan); }
  // out of plan order inside lanes: a bus planned a little later may stand in front of one planned earlier, so the
  // player has to pick which lane to dig into (a bus sent before its stickmen are open takes a lap or waits in a bay)
  const win = 6*h*h;
  lanes.forEach(ln => { ln.forEach(b => { b.key = b.plan + rng()*win; }); ln.sort((a, c) => a.key - c.key); ln.forEach(b => { delete b.key; }); });
  // traps: buses whose colour is nowhere at the fronts when the level starts, moved up to the heads of two lanes. Sent
  // early, such a bus takes an empty lap and then a bay; the plan digs one out only when nothing else matches
  const nTrap = spec.n <= 5 ? 0 : Math.floor(h*h*(Math.min(spec.trapMax || 4, Math.floor(buses.length/4)) + 0.99));
  if (nTrap > 0){
    const open = new Set(content.map(c => c[0]).filter(Boolean));
    const firstLane = lanes.findIndex(ln => ln.some(b => b.plan === 0)), trapLanes = [0, 1, 2].filter(l => l !== firstLane);
    const cand = lanes.flatMap((ln, l) => ln.map((b, i) => ({b, l, i}))).filter(x => !open.has(x.b.color) && x.i >= 2 && x.b.plan >= P.length*0.3)
      .sort((x, y) => y.b.plan - x.b.plan);
    for (let t = 0; t < nTrap && cand.length; t++){
      const x = cand.splice(Math.floor(rng()*Math.min(3, cand.length)), 1)[0], ln = lanes[x.l];
      ln.splice(ln.indexOf(x.b), 1); lanes[trapLanes[t % trapLanes.length]].splice(Math.floor(t/2), 0, x.b);
    }
  }
  level.lanes = lanes;
  return {level, buses, P, palette, counts, pure:[...pure], ownerAt};
}
function subsetSum(caps, target, rng){                 // indices of caps adding up to target (randomised)
  const order = caps.map((c, i) => i); for (let i = order.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const res = []; const go = (k, left) => { if (!left) return true; if (k >= order.length || left < 0) return false;
    res.push(order[k]); if (go(k + 1, left - caps[order[k]])) return true; res.pop(); return go(k + 1, left); };
  return go(0, target) ? res.slice() : null;
}

/* blockers that sit on the queue: hidden buses, connected groups, the key bus; boxes over plan-late cells */
function queueBlockers(spec, gen, rng){
  const {level} = gen, B = spec.blockers || {}, lanes = level.lanes, hard = spec.diff >= 7;
  // connected groups: buses the plan sends close together (pairs, or triples), checked by the core's link rules
  const want = B.link === 'pairs' ? {2:Math.max(2, Math.round(lanes.flat().length/9)), 3:0} : B.link === 'triple' ? {2:0, 3:1}
             : B.link === 'triples' ? {2:0, 3:Math.max(2, Math.round(lanes.flat().length/14))} : B.link === 'pairs+triples' ? {2:2, 3:2} : {2:0, 3:0};
  let gid = 0;
  const shapes = {2:[[[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 1]], [[0, 1], [1, 0]]], 3:[[[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1]]]};
  const teachLink = spec.popup === 'connected' || spec.hint === 'triple';
  for (const size of [3, 2]) for (let k = 0; k < want[size]; k++){
    let best = null;
    for (let t = 0; t < 400; t++){
      const sh = shapes[size][Math.floor(rng()*shapes[size].length)], l0 = Math.floor(rng()*3), i0 = teachLink && gid === 0 ? 0 : Math.floor(rng()*6);
      const cells = sh.map(([dl, di]) => [l0 + dl, i0 + di]);
      if (cells.some(([l, i]) => l > 2 || !lanes[l][i] || lanes[l][i].link)) continue;
      const plans = cells.map(([l, i]) => lanes[l][i].plan), spreadP = Math.max(...plans) - Math.min(...plans);
      const trial = JSON.parse(JSON.stringify(level)); cells.forEach(([l, i]) => { trial.lanes[l][i].link = 'G' + (gid + 1); });
      if (C.checkLevel(trial).warnings.some(w => /^link/.test(w.kind))) continue;
      const score = -spreadP - (teachLink && gid === 0 ? cells.reduce((a, [, i]) => a + i, 0)*3 : 0) + rng()*0.5;
      if (!best || score > best.score) best = {cells, score};
    }
    if (!best) return false;
    gid++; best.cells.forEach(([l, i]) => { lanes[l][i].link = 'G' + gid; });
  }
  // hidden buses: revealed early (second in a lane); in hard levels only in the first two places of a lane, where
  // the bays are still empty - never at a decisive moment late in the level
  const nHid = B.hidden || 0, teachHid = spec.popup === 'hidden';
  for (let k = 0; k < nHid; k++){
    const opts = []; lanes.forEach((ln, l) => ln.forEach((b, i) => { if (!b.hidden && i >= 1 && (teachHid ? i === 1 : hard ? i <= 1 : i <= 4)) opts.push([l, i]); }));
    if (!opts.length) return false;
    const [l, i] = opts[Math.floor(rng()*opts.length)]; lanes[l][i].hidden = true;
  }
  return true;
}
/* a lock box over cells the plan needs late, its key on an earlier bus near a lane front */
function lockBox(spec, gen, rng){
  const {level} = gen, L = C.buildLayout(JSON.parse(JSON.stringify(level))), teach = spec.popup === 'lock';
  const ramps = L.RAMPS.slice(0, teach ? 1 : 2);
  let best = null;
  for (const r of ramps){ const rd = level.ramps[r.src]; if ((rd.tunnels || []).length) continue;
    for (let w = 2; w <= 3; w++) for (let c0 = 0; c0 + w <= rd.columns.length; c0++) for (let row = 1; row <= rd.rows - 2; row++){
      const h = Math.min(2, rd.rows - row); let minP = 99, men = 0;
      for (let c = c0; c < c0 + w; c++){ const own = gen.ownerAt[r.src + ':' + c]; if (!own){ minP = -1; break; }
        for (let k = row; k < rd.rows; k++){ if (rd.columns[c][k]){ men++; minP = Math.min(minP, own[k]); } } }
      if (men < 4) continue;
      const score = minP*2 - row - (teach ? 0 : rng()*2) + men*0.05;
      if (!best || score > best.score) best = {src:r.src, c0, w, row, h, minP, score};
    } }
  if (!best || best.minP < 2) return false;
  // the key: on a bus planned before the box's stickmen are needed, as near a lane front as possible
  const cand = []; level.lanes.forEach((ln, l) => ln.forEach((b, i) => { if (b.plan < best.minP && !b.link) cand.push({b, l, i}); }));
  if (!cand.length) return false;
  cand.sort((a, b) => a.i - b.i || b.b.plan - a.b.plan);
  const kb = teach ? cand[0] : cand[Math.floor(rng()*Math.min(3, cand.length))];
  kb.b.key = 'K1';
  const rd = level.ramps[best.src]; rd.boxes = [{col:best.c0, row:best.row, w:best.w, h:best.h, lock:'K1'}];
  return true;
}
function strip(level){ level.lanes.forEach(ln => ln.forEach(b => { delete b.plan; })); return level; }
module.exports = {generate, queueBlockers, lockBox, strip, BASE};
