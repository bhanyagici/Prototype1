// Road and ramp geometry for the funnel levels (tools/make-funnel.js).
// - road(spec): control points with heights: a gentle climb, +1.45 after every spiral (the loop crosses over itself)
// - rampShape(ROAD, s, side, req): a ramp's direction for a shape kind (every ramp is a straight rectangle, so its
//   `shape` is one node it points at):
//     perp   straight out, square to the road (a bleacher)
//     diag   turned by `a` degrees toward the direction of travel (negative: against it)
//     arc, L the design table's bent ramps: now straight, the way they leave the road (as diag(a))
//     tilt   a fixed screen angle (35 degrees, outward and up)
//     fan    the design table's fanned ramps: now straight out, like perp (a fan's spread is gone)
// - place(spec, level): finds a spot for every ramp along the road (side, position, small angle changes) where it
//   stays inside the target zone and keeps clear of the road, the exit tunnel, spirals and the other ramps.
const C = require('../../tests/core.js')();
const RAMP_SP = C.RAMP_SP;
const rampLength = rows => 0.34 + (rows - 1)*RAMP_SP + 0.42;
const halfW0 = cols => cols*RAMP_SP/2 + 0.16;

/* a turtle program -> control points: ['F', length] straight, ['L' | 'R', degrees, radius] a left / right turn on a
   circle (never tighter than its radius), ['S', r, side] a spiral at the current point; starts at the yard entry
   heading up the screen; a control point about every 1.1 units, plus every spiral point and the end */
function turtle(T){
  let x = 0, z = -1.3, h = -Math.PI/2; const pts = [[x, z]], STEP = 0.05, EVERY = 1.1; let since = 0;
  const go = (dl, dh) => { h += dh; x += Math.cos(h)*dl; z += Math.sin(h)*dl; since += dl; if (since >= EVERY - 1e-6){ pts.push([+x.toFixed(2), +z.toFixed(2)]); since = 0; } };
  for (const c of T){
    if (c[0] === 'F'){ const n = Math.max(1, Math.round(c[1]/STEP)); for (let i = 0; i < n; i++) go(c[1]/n, 0); }
    else if (c[0] === 'L' || c[0] === 'R'){ const ang = c[1]*Math.PI/180, len = ang*c[2], n = Math.max(1, Math.round(len/STEP)), sg = c[0] === 'L' ? -1 : 1;
      for (let i = 0; i < n; i++) go(len/n, sg*ang/n); }
    else if (c[0] === 'S'){ if (since > 0.35) pts.push([+x.toFixed(2), +z.toFixed(2)]); else pts[pts.length - 1] = [+x.toFixed(2), +z.toFixed(2)];
      pts[pts.length - 1] = ['S', pts[pts.length - 1][0], pts[pts.length - 1][1], c[1], c[2]]; since = 0;
      h -= (c[2] || 1)*110*Math.PI/180; since = -0.9; }   // the loop lies ahead on its side: the road leaves the other way, a little backward (110 deg)
  }
  if (since > 0.3) pts.push([+x.toFixed(2), +z.toFixed(2)]);
  return pts.slice(1);
}
function road(spec){
  const raw = [[0, -1.3]].concat(spec.T ? turtle(spec.T) : spec.R), pts = [], sps = []; let d = 0;
  // heights: a gentle climb; after a spiral the road stays above the loop's crossing for 2 units, then comes back
  // down to 0.35 above the climb over the next 5 (the overpass needs the height, the target zone does not)
  const bump = dd => dd < 0 ? 0 : dd < 2 ? 1.45 : dd < 7 ? 1.45 - (dd - 2)/5*1.1 : 0.35;
  raw.forEach((q, i) => {
    const sp = q[0] === 'S', x = sp ? q[1] : q[0], z = sp ? q[2] : q[1];
    if (i) d += Math.hypot(x - pts[i - 1].x, z - pts[i - 1].z);
    const y = +(Math.min(spec.climb || 1.0, 0.055*d) + sps.reduce((a, ds) => a + bump(d - ds - 1e-9), 0)).toFixed(2);
    const p = {x, z, y};
    if (sp){ p.spiral = {r:q[3] || 1.15, side:q[4] || 1}; sps.push(d); }
    pts.push(p);
  });
  pts[0].y = 0;
  return {points:pts};
}

/* direction helpers in the ramp's frame: n = outward normal of the road at s, t = direction of travel */
function frame(ROAD, s, side){
  const p = {}; C.pathAt(ROAD, s, p, 0);
  const n = [-p.dz*side, p.dx*side], t = [p.dx, p.dz];
  return {p, n, t};
}
const rot = (n, t, deg) => { const a = deg*Math.PI/180; return [n[0]*Math.cos(a) + t[0]*Math.sin(a), n[1]*Math.cos(a) + t[1]*Math.sin(a)]; };
const r2 = v => Math.round(v*100)/100;

function rampShape(ROAD, s, side, q){
  const {p, n, t} = frame(ROAD, s, side), len = rampLength(q.r) + 0.5, out = {at:+s.toFixed(3), side};
  if (q.kind === 'tilt'){ out.tilt = q.tilt || 35; return out; }
  // the front edge lies flush on the road edge (the core lays it there); the body leaves it at angle a0
  const a0 = q.kind === 'perp' || q.kind === 'fan' ? 0 : (q.a || 0), d0 = rot(n, t, a0);
  const off = C.ROAD_HALF, A = [p.x + n[0]*off, p.z + n[1]*off];
  if (a0) out.shape = [[r2(A[0] + d0[0]*len), r2(A[1] + d0[1]*len)]];       // square to the road needs no node
  return out;
}

/* can ramp k (already in `level`) stay where it is? its own warnings + a little air to the other ramps */
const BAD = new Set(['ramp-road', 'ramp-ramp', 'zone-ramp', 'ramp-spiral', 'ramp-fold', 'ramp-exit', 'ramp-unsnapped', 'ramp-apron']);
function rampProblems(level0, k, gap){
  const level = Object.assign({}, level0, {ramps:level0.ramps.slice()});     // layouts are cached per object: a fresh one
  const L = C.buildLayout(level), ck = C.checkLevel(level), r = L.RAMPS.find(x => x.src === k);
  const own = ck.warnings.filter(w => BAD.has(w.kind) && (w.ramp === k || (w.kind === 'ramp-ramp' && w.msg.includes('ramp ' + (k + 1)))));
  if (own.length) return own.map(w => w.kind);
  const poly = C.rampOutline(r);
  if (poly.some(q => q[1] > -1.25 || !C.inTarget(q[0], r.y, q[1]))) return ['platform-out'];
  for (const o of L.RAMPS) if (o.src !== k && C.polysOverlap(poly, C.rampOutline(o), gap)) return ['close'];
  return [];
}
function emptyRamp(q){ return {rows:q.r, columns:Array.from({length:q.c}, () => new Array(q.r).fill(null))}; }

/* place every ramp: for each request (in order) try positions around its preferred spot, its side (or both),
   and small changes of angle; the first spot without problems wins (nearest the preferred one first) */
function place(spec, level){
  const L0 = C.buildLayout(Object.assign({}, level, {ramps:[]})), S = L0.ROAD.portalS, notes = [], last = {'1':0.9, '-1':0.9};
  // pack mode (crowded levels): ramps in road order, each at the first good spot after the last one on its side
  spec.ramps.forEach((q0, k) => {
    const cells = q0.c*q0.r, alts = [];
    for (let c = 3; c <= 20; c++) if (cells % c === 0 && cells/c >= 3 && cells/c <= 12 && c !== q0.c) alts.push([c, cells/c]);
    alts.sort((a, b) => Math.abs(Math.log(a[0]/a[1]) - Math.log(q0.c/q0.r)) - Math.abs(Math.log(b[0]/b[1]) - Math.log(q0.c/q0.r)));
    const tries = [q0, Object.assign({}, q0, {anySide:true}), Object.assign({}, q0, {kind:'diag', a:15, anySide:true}), Object.assign({}, q0, {kind:'perp', anySide:true}),
                   Object.assign({}, q0, {kind:'diag', a:-20, anySide:true})].concat(alts.map(([c, r]) => Object.assign({}, q0, {c, r, anySide:true})));
    let done = null;
    for (const qt of tries){
      const c = qt.c, r = qt.r, q = qt;
      const sides = q.side ? [q.side, -q.side] : [k % 2 ? -1 : 1, k % 2 ? 1 : -1];
      const pref = q.s != null ? q.s : spec.pack ? last[q.side || 1] : (q.f != null ? q.f : (k + 0.5)/spec.ramps.length)*S, offs = [];
      for (let d = 0; d <= (q.s != null ? 1.2 : S); d += 0.2){ offs.push(d); if (d && !spec.pack) offs.push(-d); }   // s: pinned to that spot
      const angles = q.kind === 'tilt' ? [0] : [...new Set([q.kind === 'perp' || q.kind === 'fan' ? 0 : q.a || 0, 0, -8, 8, -15, 15])];   // straight ramps: near square to the road
      const bends = [q.b];
      search: for (const side of sides.slice(0, q.side && !q.anySide ? 1 : 2)) for (const da of offs){
        if (Math.abs(da) > (q === q0 ? S : S*0.5)) continue;
        const s = pref + da; if (s < 0.9 || s > S - 0.9) continue;
        for (const b of bends) for (const a of angles){
          const rd = Object.assign(emptyRamp(q), rampShape(L0.ROAD, s, side, Object.assign({}, q, {a, b})));
          level.ramps[k] = rd;
          if (!rampProblems(level, k, q.gap != null ? q.gap : 0.22).length){ done = {rd, c, r, side, s, a, b}; break search; }
        }
      }
      if (done && spec.pack) last[done.side] = done.s + 0.6;
      if (done){ if (c !== q0.c || r !== q0.r) notes.push(`ramp ${k + 1}: ${q0.c}x${q0.r} did not fit, built as ${c}x${r}`);
        else if (q.kind !== q0.kind) notes.push(`ramp ${k + 1}: shape ${q0.kind} did not fit, built as ${q.kind}`);
        done.q = q; break; }
    }
    if (!done){ level.ramps[k] = Object.assign(emptyRamp(q0), rampShape(L0.ROAD, (q0.f || 0.5)*S, q0.side || 1, q0)); notes.push(`ramp ${k + 1}: NO PLACE FOUND`); }
  });
  return notes;
}
module.exports = {C, road, turtle, rampShape, place, rampProblems, rampLength, halfW0};
