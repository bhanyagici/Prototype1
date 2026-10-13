// Ramps: node tests/ramps.test.js
// For every level (the built-in Level 2, the presets and demos, the 40 funnel levels and the showcase levels) and every
// ramp: the stickmen stand in a regular rectangle of columns x rows, evenly spaced RAMP_SP apart, however the road
// bends; the platform is a rectangle around them whose front edge lies exactly on the road's edge (sampled every 2 cm:
// half a road width from the road's centre line, zero gap, no overlap) - straight along a straight road, bent with a
// curved one - with an apron at most one row deep between that edge and the straight first row, which stands as close
// to the road as the apron allows; the back edge is a straight line with square corners; the boarding point is where
// the level puts it and the columns board from the middle of the front row out.  No two stickmen ever come closer
// than a stickman's width: at the start, and through every column shift of a whole game (the game's own animation:
// a staggered step forward with an overshoot).  Moving the road or the ramp keeps the front flush.
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o)), LV = path.join(__dirname, '..', 'levels');
const TOL = 0.005;                                    // world units (half a centimetre of a 1.48-wide road; about 0.15 px)
const SP = C.RAMP_SP;

/* distance from a point to the road's centre line (the dense polyline), searched near arc length s */
function centreDist(R, x, z, s, win = 4){
  let best = 1e9;
  for (let i = 0; i < R.n - 1; i++){
    if (Math.abs(R.cum[i] - s) > win) continue;
    const ax = R.P[i*3], az = R.P[i*3 + 2], bx = R.P[i*3 + 3], bz = R.P[i*3 + 5], dx = bx - ax, dz = bz - az, l2 = dx*dx + dz*dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - ax)*dx + (z - az)*dz)/l2));
    best = Math.min(best, Math.hypot(x - ax - t*dx, z - az - t*dz));
  }
  return best;
}
/* the worst gap (+) or overlap (-) along a ramp's front edge, sampled every 2 cm; and how far its ends are from the corners */
function frontGap(L, r){
  let worst = 0, n = 0;
  const w = r.halfW, N = Math.max(8, Math.ceil(2*w/0.02)), at = u => r.across(r.frontAt(u), u);
  for (let k = 0; k <= N; k++){ const u = -w + 2*w*k/N, e = at(u), d = centreDist(L.ROAD, e.x, e.z, r.s, w + 2) - C.ROAD_HALF;
    if (Math.abs(d) > Math.abs(worst)) worst = d; n++; }
  // the drawn outline starts with the same front edge, corner to corner
  const f0 = r.outline[0], f1 = r.outline[r.front.length - 1], e0 = at(-w), e1 = at(w);
  const ends = Math.max(Math.hypot(f0[0] - e0.x, f0[1] - e0.z), Math.hypot(f1[0] - e1.x, f1[1] - e1.z));
  return {worst, n, ends};
}
/* how far a ramp's stickmen are from a regular grid: every cell c, k at first + c*SP*t + k*SP*n, t square to n */
function gridError(r){
  const s0 = r.slots[0][0], n = r.dir, t = [-n[1], n[0]], sg = r.cols > 1 ? Math.sign((r.slots[1][0].x - s0.x)*t[0] + (r.slots[1][0].z - s0.z)*t[1]) || 1 : 1;
  let e = 0; for (let c = 0; c < r.cols; c++) for (let k = 0; k < r.rows; k++){ const q = r.slots[c][k];
    e = Math.max(e, Math.hypot(q.x - (s0.x + sg*t[0]*c*r.sp + n[0]*k*r.sp), q.z - (s0.z + sg*t[1]*c*r.sp + n[1]*k*r.sp))); }
  return e;
}
/* the back edge: how far its points stray from the straight line between its corners, and how far the corners are
   from square (the cosine between the back edge and each side) */
function backShape(r){
  const B = r.backEdge, a = B[0], b = B[B.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  let off = 0; for (const q of B) off = Math.max(off, Math.abs(((q[0] - a[0])*dz - (q[1] - a[1])*dx)/l));
  const side = sg => { const p = r.across(r.length - 0.5, sg*r.halfW), q = r.across(r.length, sg*r.halfW), ux = q.x - p.x, uz = q.z - p.z, ul = Math.hypot(ux, uz) || 1;
    return Math.abs((ux*dx + uz*dz)/(ul*l)); };
  return {off, square:Math.max(side(1), side(-1)), len:l};
}
function levels(){
  const out = [['Level 2', C.LEVEL_DATA]].concat(Object.entries(C.PRESETS));
  for (const f of fs.readdirSync(path.join(LV, 'funnel')).filter(f => /^f\d+\.json$/.test(f)).sort()) out.push([f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(LV, 'funnel', f), 'utf8'))]);
  const SC = path.join(LV, 'showcase');
  if (fs.existsSync(SC)) for (const f of fs.readdirSync(SC).filter(f => /\.json$/.test(f) && !/order/.test(f)).sort()) out.push([f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(SC, f), 'utf8'))]);
  return out;
}
const ALL = levels().map(([id, lv]) => ({id, lv, L:C.buildLayout(clone(lv))}));
const nRamps = ALL.reduce((a, x) => a + x.L.RAMPS.length, 0);

console.log('every ramp of every level: a regular grid of stickmen');
{ let worst = 0, at = ''; const bad = [];
  for (const {id, L} of ALL) for (const r of L.RAMPS){ const e = gridError(r); if (e > worst){ worst = e; at = `${id} ramp ${r.src + 1}`; } if (e > 1e-9) bad.push(`${id} ramp ${r.src + 1}: ${e.toExponential(1)}`); }
  chk(!bad.length, `${nRamps} ramps in ${ALL.length} levels: the stickmen stand in a regular rectangle of columns x rows, ${SP} apart times the level's stickman size (never bent, squeezed or fanned)`,
    bad.length ? bad.slice(0, 5).join('; ') : `worst ${worst.toExponential(1)} off the grid (${at})`);
  let curved = 0; for (const {L} of ALL) for (const r of L.RAMPS) if (r.apron > 0.05 && gridError(r) < 1e-9) curved++;
  chk(curved >= 10, 'ramps beside a curve keep the same regular grid', `${curved} ramps with an apron`);
}

console.log('every ramp of every level: the front edge on the road edge, an apron of at most one row');
{ let ramps = 0, worst = 0, at = '', samples = 0, bent = 0; const bad = [];
  for (const {id, L} of ALL){
    for (const r of L.RAMPS){
      const g = frontGap(L, r); ramps++; samples += g.n;
      if (Math.abs(g.worst) > Math.abs(worst)){ worst = g.worst; at = `${id} ramp ${r.src + 1}`; }
      if (Math.abs(g.worst) > TOL || g.ends > 1e-6 || !r.snapped) bad.push(`${id} ramp ${r.src + 1}: ${g.worst.toFixed(4)}`);
      // a front edge on a curve is bent with it: its ends turn away from the straight line between them
      const a = r.edge(-r.halfW), b = r.edge(r.halfW), m = r.edge(0), mid = [(a[0] + b[0])/2, (a[1] + b[1])/2];
      if (Math.hypot(m[0] - mid[0], m[1] - mid[1]) > 0.02) bent++;
    }
  }
  chk(!bad.length, `${ramps} ramps: the whole front edge lies on the road edge (zero gap, no overlap)`,
    bad.length ? bad.slice(0, 5).join('; ') : `${samples} points every 2 cm, worst ${worst >= 0 ? 'gap' : 'overlap'} ${Math.abs(worst).toFixed(4)} (${at}), tolerance ${TOL}`);
  chk(bent >= 10, 'front edges along a curved stretch of road are bent with it (not a straight chord)', `${bent} curved front edges`);
  let deep = 0, worstA = 0, atA = ''; const far = [];
  for (const {id, L} of ALL) for (const r of L.RAMPS){
    if (r.apron/r.manK > worstA){ worstA = r.apron/r.manK; atA = `${id} ramp ${r.src + 1}`; } if (r.apron > C.RAMP_APRON_MAX*r.manK + 1e-9) deep++;
    // the rectangle's front line touches the road edge somewhere (the apron is nil there) and the first row stands
    // 0.34 behind that line: as close to the road as the apron allows
    let top = -1e9; for (let k = 0; k <= 200; k++) top = Math.max(top, r.frontAt(-r.halfW + 2*r.halfW*k/200));
    const s0 = r.slots[0][0], O = r.across(0, 0), sv = (s0.x - O.x)*r.dir[0] + (s0.z - O.z)*r.dir[1];
    if (Math.abs(top) > 1e-3 || Math.abs(sv - 0.34*r.manK) > 1e-9) far.push(`${id} ramp ${r.src + 1}: ${top.toFixed(4)}, first row ${sv.toFixed(3)}`); }
  chk(!deep, `the apron between the curved road edge and the straight first row is at most one row deep (${C.RAMP_APRON_MAX}, times the stickman size)`, `deepest ${worstA.toFixed(3)} (${atA}, in normal-size units)`);
  chk(!far.length, 'the first row stands as close to the road as the apron allows (0.34 behind the point where the road edge reaches furthest, times the stickman size)', far.slice(0, 3).join('; '));
  // the checker: a ramp on a bend too tight for its width warns, and says what to do
  const lv = clone(C.LEVEL_DATA); lv.ramps[0].columns = Array.from({length:14}, () => lv.ramps[0].columns[0].slice()); lv.ramps[0].at = 24.5; delete lv.ramps[0].shape; delete lv.ramps[0].tilt;
  const w = C.checkLevel(clone(lv)).warnings.find(x => x.kind === 'ramp-apron' && x.ramp === 0);
  chk(!!w && /move it along the road/.test(w.msg) && /narrower/.test(w.msg), 'a ramp too wide for a tight bend gets a warning suggesting to move it along the road or make it narrower', w ? w.msg : 'no warning');
}

console.log('every ramp of every level: a straight back edge with square corners, the boarding point where the level puts it');
{ let worstOff = 0, worstSq = 0, at = ''; const bad = [], moved = [], order = [];
  for (const {id, lv, L} of ALL){ const N = C.normalizeLevel(clone(lv));
    for (const r of L.RAMPS){ const b = backShape(r);
      if (b.off > worstOff){ worstOff = b.off; at = `${id} ramp ${r.src + 1}`; } worstSq = Math.max(worstSq, b.square);
      if (b.off > 1e-6 || b.square > 1e-6) bad.push(`${id} ramp ${r.src + 1}: ${b.off.toFixed(4)} off, corner cos ${b.square.toFixed(3)}`);
      // the boarding point: the level's own spot on the road (a ramp too near either end of the road slides on to it),
      // the middle of the front edge on the road edge there
      const rd = N.ramps[r.src], o = {}; C.pathAt(L.ROAD, r.s, o, 0);
      const A = [o.x - o.dz*r.side*C.ROAD_HALF, o.z + o.dx*r.side*C.ROAD_HALF];
      const lo = Math.min(r.edge.sAt(-r.halfW), r.edge.sAt(r.halfW)), hi = Math.max(r.edge.sAt(-r.halfW), r.edge.sAt(r.halfW)), atEnd = Math.abs(lo - 0.15) < 0.01 || Math.abs(hi - (L.ROAD.portalS - 0.3)) < 0.01;
      if ((rd.at != null && Math.abs(Math.max(0.6, Math.min(L.ROAD.portalS - 0.6, rd.at)) - r.s) > 1e-9 && !atEnd) || Math.hypot(r.ctrl[0][0] - A[0], r.ctrl[0][1] - A[1]) > 1e-3) moved.push(`${id} ramp ${r.src + 1}`);
      const mid = (r.cols - 1)/2; if (!r.colOrder.every((c, i) => i === 0 || Math.abs(c - mid) >= Math.abs(r.colOrder[i - 1] - mid))) order.push(`${id} ramp ${r.src + 1}`); } }
  chk(!bad.length, `${nRamps} ramps: the back edge is a straight line, its corners square, the sides straight`, bad.length ? bad.slice(0, 5).join('; ') : `worst ${worstOff.toExponential(1)} off the line (${at}), corner cosine ${worstSq.toExponential(1)}`);
  chk(!moved.length, 'the boarding point is the level\'s own spot on the road (or slid on just enough to fit at either end), the middle of the front edge on the road edge', moved.slice(0, 5).join('; '));
  chk(!order.length, 'the columns board from the middle of the front row out', order.slice(0, 5).join('; '));
}

console.log('stickmen never overlap: at the start and during column shifts');
{ // the game's column shift (index.html, shiftCols): each man of a changed column eases from where he is drawn to his
  // new place, easeOutBack(1.4) over 1.15 x COLUMN_SHIFT_TIME, the front one first and each next one 0.045 s later,
  // never closer to the man in front of him than a stickman's width; a man let out of a colourful tunnel starts at the
  // tunnel's front row, the men waiting behind a blocker at their own rows.  A man who boards steps straight off the
  // grid and runs on to his seat (runPoint: easeInOut over the first half of RUN_TIME), crouches and hops in; until then
  // the man stepping up behind him keeps a stickman's width back.  He must not brush the men still standing (two runners
  // meeting at the bus door are past the ramp).  Checked every 1/60 s while anyone moves.
  const ease = (t, s) => 1 + (s + 1)*Math.pow(t - 1, 3) + s*Math.pow(t - 1, 2), DUR = C.COLUMN_SHIFT_TIME*1.15;
  const inOut = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
  const slotPos = (r, c, f) => { const cs = r.slots[c], i0 = Math.max(0, Math.min(cs.length - 1, Math.floor(f))), i1 = Math.min(cs.length - 1, i0 + 1), k = Math.max(0, Math.min(1, f - i0));
    return [cs[i0].x + (cs[i1].x - cs[i0].x)*k, cs[i0].z + (cs[i1].z - cs[i0].z)*k]; };
  let worstStart = 1e9, atStart = '', worstShift = 1e9, atShift = '', shifts = 0, checks = 0, games = 0, runs = 0; const bad = [];
  for (const {id, lv, L} of ALL){
    const K = L.manScale || 1, W = C.MAN_W*K, GAP = (C.MAN_W + 0.005)/SP;     // a stickman's width at this level's size (in rows: the same)
    // at the start: every cell of every ramp, all ramps together
    const cells = L.RAMPS.flatMap(r => r.slots.flat());
    for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++){ const d = Math.hypot(cells[a].x - cells[b].x, cells[a].z - cells[b].z);
      if (d/K < worstStart){ worstStart = d/K; atStart = id; } }
    // a whole game (greedy play)
    const g = C.createGame(clone(lv), {}), RS = g.L.RAMPS, MV = new Map(), RUN = new Map(), COLRUN = new Map();
    g.men.forEach((m, i) => { if (m.state !== 'ramp') return; const at = g.ramps[m.ramp].cols[m.col].indexOf(i), d = at >= 0 ? at : m.row; MV.set(i, {disp:d, from:d, to:d, t0:-1}); });
    let think = 0, worst = 1e9, worstInfo = null;
    // a runner's place: the run (off the grid, then on), a crouch at E, the hop from E into his seat T
    const runAt = (q, t) => { const u = (t - q.t)/C.RUN_TIME;
      if (u >= 0.62) return [q.E[0] + (q.T[0] - q.E[0])*Math.min(1, (u - 0.62)/0.38), q.E[1] + (q.T[1] - q.E[1])*Math.min(1, (u - 0.62)/0.38)];
      if (u >= 0.5) return q.E;
      const l1 = Math.hypot(q.G[0] - q.F[0], q.G[1] - q.F[1]), l2 = Math.hypot(q.E[0] - q.G[0], q.E[1] - q.G[1]), a = inOut(Math.max(0, u)/0.5)*(l1 + l2);
      return a <= l1 ? [q.F[0] + (q.G[0] - q.F[0])*a/l1, q.F[1] + (q.G[1] - q.F[1])*a/l1] : [q.G[0] + (q.E[0] - q.G[0])*(a - l1)/l2, q.G[1] + (q.E[1] - q.G[1])*(a - l1)/l2]; };
    const sample = t => { let moving = RUN.size > 0;
      g.ramps.forEach((R, k) => R.cols.forEach((col, c) => { let prev = -Infinity;
        const rq = COLRUN.get(k*1000 + c); if (rq && t - rq.t < C.RUN_TIME){ const p = runAt(rq, t); prev = rq.row - ((p[0] - rq.F[0])*rq.dir[0] + (p[1] - rq.F[1])*rq.dir[1])/RS[k].sp; }
        for (const i of col){ const mv = MV.get(i); if (!mv) continue;
          if (mv.t0 >= 0 && t >= mv.t0){ const u = Math.min(1, (t - mv.t0)/DUR); mv.disp = mv.from + (mv.to - mv.from)*ease(u, 1.4); if (u >= 1){ mv.t0 = -1; mv.disp = mv.to; } }
          if (mv.t0 >= 0) moving = true;
          if (mv.disp < prev + GAP) mv.disp = prev + GAP; prev = Math.max(0, mv.disp); } }));
      if (!moving) return;
      g.ramps.forEach((R, k) => { const r = RS[k], P = [];
        R.cols.forEach((col, c) => col.forEach(i => { const mv = MV.get(i); if (mv) P.push([c, slotPos(r, c, mv.disp), mv.t0 >= 0]); }));
        for (const [i, q] of RUN){ if (q.k !== k) continue; if (t - q.t > C.RUN_TIME){ RUN.delete(i); continue; } P.push([-9, runAt(q, t), true]); }
        for (let a = 0; a < P.length; a++) if (P[a][2]) for (let b = 0; b < P.length; b++){ if (b === a || (P[a][0] < 0 && P[b][0] < 0) || (P[a][0] >= 0 && P[b][0] >= 0 && Math.abs(P[a][0] - P[b][0]) > 1)) continue;
          const d = Math.hypot(P[a][1][0] - P[b][1][0], P[a][1][1] - P[b][1][1])/K; checks++; if (d < worst){ worst = d; if (process.env.DBG) worstInfo = {t, a:P[a], b:P[b], runs:[...RUN.values()].filter(q => q.k === k).map(q => ({dt:+(t - q.t).toFixed(3), F:q.F.map(v => +v.toFixed(2)), G:q.G.map(v => +v.toFixed(2)), E:q.E.map(v => +v.toFixed(2))})), dir:RS[k].dir.map(v => +v.toFixed(2))}; } } }); };
    while (!g.result && g.t < 1500){
      think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = C.greedyPick(g); if (a) C.applyAction(g, a); }
      C.step(g, C.SIM_DT);
      for (const e of g.events.splice(0)){
        if (e.type === 'release'){ const T = g.ramps[e.ramp].tunnels[e.tunnel], i = g.ramps[e.ramp].cols[e.col].indexOf(e.man); MV.set(e.man, {disp:T.row, from:T.row, to:Math.max(0, i), t0:e.t + 0.04}); }
        if (e.type === 'board'){ const mv = MV.get(e.man), r = RS[e.ramp], F = slotPos(r, e.col, mv ? Math.max(0, mv.disp) : 0), b = g.buses[e.bus];
          // his seat on the bus (drawn BUS_DRAW of its size), and the point 0.6 short of it where the run ends
          const q = C.seatLocal(e.seat, b.len), k = C.BUS_DRAW, T = [b.x + (q.x*b.dz + q.z*b.dx)*k, b.z + (-q.x*b.dx + q.z*b.dz)*k], dl = Math.hypot(F[0] - T[0], F[1] - T[1]) || 1;
          const f = r.slots[e.col][0], G = [F[0] + f.fx*0.38*K, F[1] + f.fz*0.38*K];    // off the grid first (index.html runPoint)
          const run = {k:e.ramp, t:e.t, F, G, T, E:[T[0] + (F[0] - T[0])/dl*0.6, T[1] + (F[1] - T[1])/dl*0.6], row:mv ? Math.max(0, mv.disp) : 0, dir:[f.fx, f.fz]};
          RUN.set(e.man, run); COLRUN.set(e.ramp*1000 + e.col, run); MV.delete(e.man); runs++; } }
      g.ramps.forEach(R => R.cols.forEach(col => col.forEach((m, i) => { let mv = MV.get(m);
        if (!mv){ mv = {disp:g.men[m].row, from:g.men[m].row, to:g.men[m].row, t0:-1}; MV.set(m, mv); }
        if (mv.to !== i){ mv.from = mv.disp; mv.to = i; mv.t0 = g.t + 0.05 + i*0.045; shifts++; } })));
      sample(g.t); sample(g.t + C.SIM_DT/2);
    }
    games++;
    if (worst < worstShift){ worstShift = worst; atShift = id; }
    if (worst < C.MAN_W) bad.push(`${id}: ${worst.toFixed(3)}` + (process.env.DBG ? JSON.stringify(worstInfo) : ''));
  }
  chk(worstStart >= C.MAN_W, `at the start no two stickmen of ${ALL.length} levels are closer than a stickman's width (${C.MAN_W} times the level's stickman size)`, `closest ${worstStart.toFixed(3)} (${atStart}, in stickman sizes)`);
  chk(!bad.length && shifts > 1000, `through every column shift of a whole game in each of ${games} levels (and every run off it), no two stickmen on a ramp come closer than a stickman's width`,
    bad.length ? bad.slice(0, 5).join('; ') : `${shifts} shifts, ${runs} runs, ${checks} distances while moving, closest ${worstShift.toFixed(3)} (${atShift})`);
}

console.log('stickmen size per level');
{ const sizes = ALL.map(({id, lv, L}) => [id, L.manScale || 1, C.autoManScale(clone(lv))]);
  const off = sizes.filter(([, k, a]) => Math.abs(k - a) > 1e-9);
  chk(!off.length, 'every level\'s stickman size is the largest its free space allows (its grown ramps raise no warning), up to ' + C.MAN_SCALE_MAX, off.slice(0, 4).map(x => x.join(' ')).join('; '));
  const big = sizes.filter(([, k]) => k >= 1.2).map(x => x[0]), crowded = ['crowded-rush', 'crowded-rush-curve'].map(id => sizes.find(x => x[0] === id));
  chk(big.length >= 3 && crowded.every(x => x && x[1] === 1), 'levels with few or short ramps get larger stickmen (up to 1.3x); crowded levels keep the normal size',
    `${big.length} levels at 1.2x or more (${big.slice(0, 4).join(', ')}...), Crowded Rush ${crowded.map(x => x[1]).join(' / ')}`);
  chk(C.MAN_W*C.SEAT_SCALE_MAX <= C.ROW_PITCH && C.MAN_W*C.SEAT_SCALE_MAX <= 0.42, 'seated, stickmen stay at most ' + C.SEAT_SCALE_MAX + 'x, so their heads still fit between two seat rows (' + C.ROW_PITCH + ' apart)', (C.MAN_W*C.SEAT_SCALE_MAX).toFixed(3));
  const lv = clone(C.LEVEL_DATA); lv.manScale = 1.3; const r1 = C.buildLayout(clone(C.LEVEL_DATA)).RAMPS[0], r2 = C.buildLayout(lv).RAMPS[0];
  chk(Math.abs(r2.sp - 1.3*r1.sp) < 1e-9 && Math.abs(r2.halfW - 1.3*r1.halfW) < 1e-9 && gridError(r2) < 1e-9, 'a level\'s stickman size grows its ramps with it: spacing, width and margins (the grid stays regular)', `spacing ${r1.sp.toFixed(3)} -> ${r2.sp.toFixed(3)}`);
}

console.log('the front stays flush when the road or the ramp moves');
{ const lv = clone(C.LEVEL_DATA), base = C.buildLayout(clone(lv));
  // move a road control point beside ramp 1 sideways, and the next one: the road bends there, the ramp follows
  const moved = clone(lv); moved.road.points[1].x += 0.6; moved.road.points[2].x += 0.35;
  const L = C.buildLayout(clone(moved)), r = L.RAMPS.find(q => q.src === 0), r0 = base.RAMPS.find(q => q.src === 0), g = frontGap(L, r);
  chk(Math.hypot(r.ctrl[0][0] - r0.ctrl[0][0], r.ctrl[0][1] - r0.ctrl[0][1]) > 0.2 && Math.abs(g.worst) <= TOL && gridError(r) < 1e-9,
    'moving the road under a ramp carries the ramp with it, its front edge flush on the new road edge, its grid regular', `front moved ${Math.hypot(r.ctrl[0][0] - r0.ctrl[0][0], r.ctrl[0][1] - r0.ctrl[0][1]).toFixed(2)}, worst ${g.worst.toFixed(4)}`);
  // slide a ramp along the road (its boarding point), on to a bend of the road after the spiral
  const slid = clone(lv); slid.ramps[4].at = 24.5;
  const L2 = C.buildLayout(clone(slid)), r2 = L2.RAMPS.find(q => q.src === 4), g2 = frontGap(L2, r2);
  chk(Math.abs(r2.s - 24.5) < 1e-9 && Math.abs(g2.worst) <= TOL && r2.apron > 0.01 && gridError(r2) < 1e-9, 'a ramp slid along the road to a bend lies flush there, with an apron and the same regular grid', `worst ${g2.worst.toFixed(4)}, apron ${r2.apron.toFixed(3)}`);
  // a ramp given by a loose point (an old level's "front") snaps onto the nearest road point, flush
  const loose = clone(lv); delete loose.ramps[2].at; delete loose.ramps[2].cp; loose.ramps[2].front = [-3.5, -6.0]; loose.ramps[2].push = 0.8;
  const L3 = C.buildLayout(clone(loose)), r3 = L3.RAMPS.find(q => q.src === 2), g3 = frontGap(L3, r3);
  chk(r3.snapped && r3.side === -1 && Math.abs(g3.worst) <= TOL, 'a ramp placed by a point off the road (and an old push offset) snaps flush onto the road', `s ${r3.s.toFixed(2)}, worst ${g3.worst.toFixed(4)}`);
  // an old bent or fanned ramp is straightened along the way it leaves the road
  const old = clone(lv), o = {}; C.pathAt(base.ROAD, base.RAMPS.find(q => q.src === 1).s, o, 0); const A = base.RAMPS.find(q => q.src === 1).ctrl[0];
  old.ramps[1].shape = [[A[0] - o.dz*base.RAMPS.find(q => q.src === 1).side*1.0, A[1] + o.dx*base.RAMPS.find(q => q.src === 1).side*1.0], [A[0] + 2, A[1] - 2], [A[0] + 4, A[1] - 1]]; old.ramps[1].spread = 0.6;
  const L4 = C.buildLayout(clone(old)), r4 = L4.RAMPS.find(q => q.src === 1);
  chk(gridError(r4) < 1e-9 && backShape(r4).square < 1e-6, 'an old bent and fanned ramp is drawn as a straight rectangle with a regular grid', `grid ${gridError(r4).toExponential(1)}`);
  // the front row stands just behind the road edge: 0.34 where the apron is nil, never further than the apron allows
  const fr = r2.slots.map(cs => centreDist(L2.ROAD, cs[0].x, cs[0].z, r2.s) - C.ROAD_HALF);
  chk(fr.every(d => d > 0.25 && d < 0.34 + r2.apron + 0.03), 'the front row of stickmen stands just behind the road edge (the apron between)', fr.map(d => d.toFixed(2)).join(' '));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
