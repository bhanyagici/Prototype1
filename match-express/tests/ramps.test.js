// Ramps lie flush on the road: node tests/ramps.test.js
// For every level (the built-in Level 2, the presets, the 40 funnel levels and the showcase levels) and every ramp,
// the whole front edge of the platform lies on the road's edge: sampled every few centimetres from one front corner
// to the other, each point is exactly half a road width from the road's centre line (zero gap, no overlap) - straight
// along a straight road, bent with a curved one.  Moving the road (a control point) or the ramp (its boarding point)
// keeps it so, and a ramp placed by a loose point snaps onto the road.  Only the front edge follows the road: the back
// edge is a straight line with square corners, and the rows straighten from the front curve toward the back.
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o)), LV = path.join(__dirname, '..', 'levels');
const TOL = 0.005;                                    // world units (half a centimetre of a 1.48-wide road; about 0.15 px)

/* distance from a point to the road's centre line (the dense polyline), searched near arc length s */
function centreDist(R, x, z, s){
  let best = 1e9;
  for (let i = 0; i < R.n - 1; i++){
    if (Math.abs(R.cum[i] - s) > 4) continue;
    const ax = R.P[i*3], az = R.P[i*3 + 2], bx = R.P[i*3 + 3], bz = R.P[i*3 + 5], dx = bx - ax, dz = bz - az, l2 = dx*dx + dz*dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((x - ax)*dx + (z - az)*dz)/l2));
    best = Math.min(best, Math.hypot(x - ax - t*dx, z - az - t*dz));
  }
  return best;
}
/* the worst gap (+) or overlap (-) along a ramp's front edge, sampled every 2 cm; and how far its ends are from the corners */
function frontGap(L, r){
  let worst = 0, n = 0;
  const w = r.halfW0, N = Math.max(8, Math.ceil(2*w/0.02));
  for (let k = 0; k <= N; k++){ const u = -w + 2*w*k/N, e = r.across(0, u), d = centreDist(L.ROAD, e.x, e.z, r.s) - C.ROAD_HALF;
    if (Math.abs(d) > Math.abs(worst)) worst = d; n++; }
  // the drawn outline starts with the same front edge, corner to corner
  const f0 = r.outline[0], f1 = r.outline[r.front.length - 1], e0 = r.across(0, -w), e1 = r.across(0, w);
  const ends = Math.max(Math.hypot(f0[0] - e0.x, f0[1] - e0.z), Math.hypot(f1[0] - e1.x, f1[1] - e1.z));
  return {worst, n, ends};
}
/* the back edge: how far its points stray from the straight line between its corners, and how far the corners are
   from square (the cosine between the back edge and the last stretch of each side) */
function backShape(r){
  const B = r.backEdge, a = B[0], b = B[B.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  let off = 0; for (const q of B) off = Math.max(off, Math.abs(((q[0] - a[0])*dz - (q[1] - a[1])*dx)/l));
  // each side's direction at the back, from the ramp's own shape a millimetre before the back edge
  const side = sg => { const u = sg*r.halfWAt(r.length), p = r.across(r.length - 0.001, u), q = r.across(r.length, u), ux = q.x - p.x, uz = q.z - p.z, ul = Math.hypot(ux, uz) || 1;
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

console.log('every ramp of every level: the front edge on the road edge');
{ let ramps = 0, worst = 0, at = '', samples = 0, bent = 0; const bad = [];
  for (const [id, lv] of levels()){
    const L = C.buildLayout(clone(lv));
    for (const r of L.RAMPS){
      const g = frontGap(L, r); ramps++; samples += g.n;
      if (Math.abs(g.worst) > Math.abs(worst)){ worst = g.worst; at = `${id} ramp ${r.src + 1}`; }
      if (Math.abs(g.worst) > TOL || g.ends > 1e-6 || !r.snapped) bad.push(`${id} ramp ${r.src + 1}: ${g.worst.toFixed(4)}`);
      // a front edge on a curve is bent with it: its ends turn away from the straight line between them
      const a = r.edge(-r.halfW0), b = r.edge(r.halfW0), m = r.edge(0), mid = [(a[0] + b[0])/2, (a[1] + b[1])/2];
      if (Math.hypot(m[0] - mid[0], m[1] - mid[1]) > 0.02) bent++;
    }
    const lvBad = bad.filter(x => x.startsWith(id + ' ')).length;
    if (lvBad) chk(false, `${id}: every front edge flush`, bad.filter(x => x.startsWith(id + ' ')).join('; '));
  }
  chk(!bad.length, `${ramps} ramps in ${levels().length} levels: the whole front edge lies on the road edge (zero gap, no overlap)`,
    `${samples} points every 2 cm, worst ${worst >= 0 ? 'gap' : 'overlap'} ${Math.abs(worst).toFixed(4)} (${at}), tolerance ${TOL}`);
  chk(bent >= 10, 'front edges along a curved stretch of road are bent with it (not a straight chord)', `${bent} curved front edges`);
}

console.log('every ramp of every level: a straight back edge with square corners');
{ let ramps = 0, worstOff = 0, worstSq = 0, at = ''; const bad = [];
  for (const [id, lv] of levels()){ const L = C.buildLayout(clone(lv));
    for (const r of L.RAMPS){ const b = backShape(r); ramps++;
      if (b.off > worstOff){ worstOff = b.off; at = `${id} ramp ${r.src + 1}`; }
      if (!r.spread) worstSq = Math.max(worstSq, b.square);
      if (b.off > 1e-3 || (!r.spread && b.square > 0.02)) bad.push(`${id} ramp ${r.src + 1}: ${b.off.toFixed(4)} off, corner cos ${b.square.toFixed(3)}`); } }
  chk(!bad.length, `${ramps} ramps: the back edge is a straight line (only the front edge follows the road)`, bad.length ? bad.slice(0, 5).join('; ') : `worst ${worstOff.toFixed(5)} off the line (${at})`);
  chk(!bad.length, 'its corners are square (the sides meet the back edge at right angles; a fan ramp widens by design)', `worst cosine ${worstSq.toFixed(4)}`);
}
{ // a ramp on a curved stretch: its rows follow the front curve near the road and straighten toward the back
  let n = 0, ok = 0;
  for (const [, lv] of levels()){ const L = C.buildLayout(clone(lv));
    for (const r of L.RAMPS){ const bend = sv => { const a = r.across(sv, -r.halfW0*0.9), b = r.across(sv, r.halfW0*0.9), m = r.across(sv, 0);
        const ux = b.x - a.x, uz = b.z - a.z, l = Math.hypot(ux, uz) || 1; return Math.abs(((m.x - a.x)*uz - (m.z - a.z)*ux)/l); };
      const f = bend(0); if (f < 0.05) continue; n++;
      const rows = Array.from({length:r.rows}, (_, k) => bend(0.34 + k*C.RAMP_SP)); if (rows.every((v, k) => k === 0 || v <= rows[k - 1] + 1e-9) && bend(r.length) < 1e-3) ok++; } }
  chk(n >= 10 && ok === n, 'on a curve the rows follow the front edge near the road and straighten gradually toward the back', `${ok}/${n} curved ramps`);
}

console.log('the front stays flush when the road or the ramp moves');
{ const lv = clone(C.LEVEL_DATA), base = C.buildLayout(clone(lv));
  // move a road control point beside ramp 1 sideways, and the next one: the road bends there, the ramp follows
  const moved = clone(lv); moved.road.points[1].x += 0.6; moved.road.points[2].x += 0.35;
  const L = C.buildLayout(clone(moved)), r = L.RAMPS.find(q => q.src === 0), r0 = base.RAMPS.find(q => q.src === 0), g = frontGap(L, r);
  chk(Math.hypot(r.ctrl[0][0] - r0.ctrl[0][0], r.ctrl[0][1] - r0.ctrl[0][1]) > 0.2 && Math.abs(g.worst) <= TOL,
    'moving the road under a ramp carries the ramp with it, its front edge flush on the new road edge', `front moved ${Math.hypot(r.ctrl[0][0] - r0.ctrl[0][0], r.ctrl[0][1] - r0.ctrl[0][1]).toFixed(2)}, worst ${g.worst.toFixed(4)}`);
  // slide a ramp along the road (its boarding point), on to a bend of the road after the spiral
  const slid = clone(lv); slid.ramps[4].at = 24.5;
  const L2 = C.buildLayout(clone(slid)), r2 = L2.RAMPS.find(q => q.src === 4), g2 = frontGap(L2, r2);
  chk(Math.abs(r2.s - 24.5) < 1e-9 && Math.abs(g2.worst) <= TOL, 'a ramp slid along the road to a bend lies flush there', `worst ${g2.worst.toFixed(4)}`);
  // a ramp given by a loose point (an old level's "front") snaps onto the nearest road point, flush
  const loose = clone(lv); delete loose.ramps[2].at; delete loose.ramps[2].cp; loose.ramps[2].front = [-3.5, -6.0]; loose.ramps[2].push = 0.8;
  const L3 = C.buildLayout(clone(loose)), r3 = L3.RAMPS.find(q => q.src === 2), g3 = frontGap(L3, r3);
  chk(r3.snapped && r3.side === -1 && Math.abs(g3.worst) <= TOL, 'a ramp placed by a point off the road (and an old push offset) snaps flush onto the road', `s ${r3.s.toFixed(2)}, worst ${g3.worst.toFixed(4)}`);
  // every row behind the front keeps its distance: the first row of stickmen stands just off the road edge
  const fr = r.slots.map(cs => centreDist(L.ROAD, cs[0].x, cs[0].z, r.s) - C.ROAD_HALF);
  chk(fr.every(d => d > 0.25 && d < 0.45), 'the front row of stickmen stands just behind the road edge', fr.map(d => d.toFixed(2)).join(' '));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
