// Slide and tray geometry for the showcase and funnel levels (tools/make-showcase.js, tools/make-funnel.js).
// - turtle(T, start): a turtle program -> slide control points, starting at the start tower near the top of the slide
//   zone, heading down the screen: ['F', length] straight, ['L' | 'R', degrees, radius] a left / right turn on a circle
//   (never tighter than its radius), ['S', r, side] a spiral at the current point
// - slide(spec): {points} for a level (heights are the core's: it always descends, and drops at a spiral)
// - trayShape(SL, s, side, q): a tray's direction for a shape kind (every tray is a straight rectangle):
//     perp   straight out, square to the slide
//     diag   turned by `a` degrees toward the direction of travel (negative: against it)
//     tilt   a fixed screen angle (35 degrees, outward and up) - the default
//     fan    the design table's fanned trays: straight out, like perp (a regular grid, as in Match Express)
// - place(spec, level): finds a spot for every tray along the slide (side, position, small angle changes) where it
//   stays inside the slide zone and keeps clear of the slide, the sorter, the start tower, spirals, toys, gaps and the
//   other trays.
const C = require('../../tests/core.js')();
const trayLength = (rows, K) => (0.3 + (rows - 1)*C.TRAY_SP + 0.36)*(K || 1);
const halfW0 = (cols, K) => (cols*C.TRAY_SP/2 + 0.12)*(K || 1);

function turtle(T, start){
  start = start || {};
  let x = start.x != null ? start.x : 0.6, z = start.z != null ? start.z : -11.6, h = start.h != null ? start.h*Math.PI/180 : Math.PI/2;
  const pts = [[x, z]], STEP = 0.05, EVERY = 0.75; let since = 0;
  const go = (dl, dh) => { h += dh; x += Math.cos(h)*dl; z += Math.sin(h)*dl; since += dl; if (since >= EVERY - 1e-6){ pts.push([+x.toFixed(2), +z.toFixed(2)]); since = 0; } };
  for (const c of T){
    if (c[0] === 'F'){ const n = Math.max(1, Math.round(c[1]/STEP)); for (let i = 0; i < n; i++) go(c[1]/n, 0); }
    else if (c[0] === 'L' || c[0] === 'R'){ const ang = c[1]*Math.PI/180, len = ang*c[2], n = Math.max(1, Math.round(len/STEP)), sg = c[0] === 'L' ? -1 : 1;
      for (let i = 0; i < n; i++) go(len/n, sg*ang/n); }
    else if (c[0] === 'S'){ if (since > 0.35) pts.push([+x.toFixed(2), +z.toFixed(2)]); else pts[pts.length - 1] = [+x.toFixed(2), +z.toFixed(2)];
      const q = pts[pts.length - 1]; pts[pts.length - 1] = ['S', q[0], q[1], c[1], c[2]];
      h -= (c[2] || 1)*110*Math.PI/180; since = -0.9; }   // the loop lies ahead on its side: the slide leaves the other way, a little backward (110 deg)
  }
  if (since > 0.3) pts.push([+x.toFixed(2), +z.toFixed(2)]);
  return pts;
}
function slide(spec){
  const raw = spec.T ? turtle(spec.T, spec.start) : spec.R;
  return {points:raw.map(q => { const sp = q[0] === 'S', p = {x:sp ? q[1] : q[0], z:sp ? q[2] : q[1]}; if (sp) p.spiral = {r:q[3] || 0.95, side:q[4] || 1}; return p; })};
}
/* direction helpers in the tray's frame: n = outward normal of the slide at s, t = direction of travel */
function frame(SL, s, side){ const p = {}; C.pathAt(SL, s, p, 0); return {p, n:[-p.dz*side, p.dx*side], t:[p.dx, p.dz]}; }
const rot = (n, t, deg) => { const a = deg*Math.PI/180; return [n[0]*Math.cos(a) + t[0]*Math.sin(a), n[1]*Math.cos(a) + t[1]*Math.sin(a)]; };
const r2 = v => Math.round(v*100)/100;
function trayShape(SL, s, side, q){
  const {p, n, t} = frame(SL, s, side), len = trayLength(q.r, q.K) + 0.5, out = {at:+s.toFixed(3), side};
  if (q.kind === 'tilt' || !q.kind){ if (q.tilt != null && q.tilt !== 35) out.tilt = q.tilt; return out; }   // (the core's default is 35 degrees)
  const a0 = q.kind === 'perp' || q.kind === 'fan' ? 0 : (q.a || 0), d0 = rot(n, t, a0), A = [p.x + n[0]*C.EDGE, p.z + n[1]*C.EDGE];
  out.shape = [[r2(A[0] + d0[0]*len), r2(A[1] + d0[1]*len)]];
  return out;
}
/* can tray k (already in `level`) stay where it is? its own warnings + a little air to the other trays */
const BAD = new Set(['tray-slide', 'tray-tray', 'zone-tray', 'tray-spiral', 'tray-sorter', 'tray-start', 'tray-apron', 'toy-merge', 'gap-merge']);
function trayProblems(level0, k, gap){
  const level = Object.assign({}, level0, {trays:level0.trays.slice()});      // layouts are cached per object: a fresh one
  const L = C.buildLayout(level), ck = C.checkLevel(level), r = L.TRAYS.find(x => x.src === k);
  const own = ck.warnings.filter(w => BAD.has(w.kind) && (w.tray === k || (w.kind === 'tray-tray' && w.msg.includes('tray ' + (k + 1)))));
  if (own.length) return own.map(w => w.kind);
  const poly = C.trayOutline(r);
  for (const o of L.TRAYS) if (o.src !== k && C.polysOverlap(poly, C.trayOutline(o), gap)) return ['close'];
  return [];
}
function emptyTray(q){ return {rows:q.r, columns:Array.from({length:q.c}, () => new Array(q.r).fill(null))}; }
/* place every tray: for each request (in order) try positions around its preferred spot, its side (or both), and small
   changes of angle; the first spot without problems wins (nearest the preferred one first) */
function place(spec, level){
  const L0 = C.buildLayout(Object.assign({}, level, {trays:[]})), S = L0.SLIDE.tailS, notes = [], K = level.marbleScale || 1;
  spec.trays.forEach((q0, k) => {
    const cells = q0.c*q0.r, alts = [];
    for (let c = 2; c <= 6; c++) if (cells % c === 0 && cells/c >= 3 && cells/c <= 12 && c !== q0.c) alts.push([c, cells/c]);
    alts.sort((a, b) => Math.abs(Math.log(a[0]/a[1]) - Math.log(q0.c/q0.r)) - Math.abs(Math.log(b[0]/b[1]) - Math.log(q0.c/q0.r)));
    const tries = [q0, Object.assign({}, q0, {anySide:true}), Object.assign({}, q0, {kind:'tilt', tilt:55, anySide:true}), Object.assign({}, q0, {kind:'diag', a:-20, anySide:true}),
                   Object.assign({}, q0, {kind:'perp', anySide:true}), Object.assign({}, q0, {kind:'tilt', tilt:15, anySide:true})].concat(alts.map(([c, r]) => Object.assign({}, q0, {c, r, anySide:true})));
    let done = null;
    for (const q of tries){
      const sides = q.side ? [q.side, -q.side] : [k % 2 ? -1 : 1, k % 2 ? 1 : -1];
      const pref = q.s != null ? q.s : (q.f != null ? q.f : (k + 0.5)/spec.trays.length)*S, offs = [];
      for (let d = 0; d <= (q.s != null ? 1.2 : S); d += 0.2){ offs.push(d); if (d) offs.push(-d); }
      const angles = q.kind === 'tilt' || !q.kind ? [q.tilt != null ? q.tilt : 35] : [...new Set([q.kind === 'perp' || q.kind === 'fan' ? 0 : q.a || 0, 0, -10, 10, -20])];
      search: for (const side of sides.slice(0, q.side && !q.anySide ? 1 : 2)) for (const da of offs){
        const s = pref + da; if (s < 0.9 || s > S - 0.7) continue;
        for (const a of angles){
          const rd = Object.assign(emptyTray(q), trayShape(L0.SLIDE, s, side, Object.assign({}, q, q.kind === 'tilt' || !q.kind ? {tilt:a} : {a}, {K})));
          level.trays[k] = rd;
          if (!trayProblems(level, k, q.gap != null ? q.gap : 0.2).length){ done = {rd, c:q.c, r:q.r, side, s, a}; break search; }
        }
      }
      if (done){ if (q.c !== q0.c || q.r !== q0.r) notes.push(`tray ${k + 1}: ${q0.c}x${q0.r} did not fit, built as ${q.c}x${q.r}`);
        else if ((q.kind || 'tilt') !== (q0.kind || 'tilt') || q.tilt !== q0.tilt) notes.push(`tray ${k + 1}: shape ${q0.kind || 'tilt'} did not fit, built as ${q.kind}${q.tilt != null ? ' ' + q.tilt : ''}`);
        break; }
    }
    if (!done){ level.trays[k] = Object.assign(emptyTray(q0), trayShape(L0.SLIDE, (q0.f || 0.5)*S, q0.side || 1, q0)); notes.push(`tray ${k + 1}: NO PLACE FOUND`); }
  });
  return notes;
}
/* a slide that meanders down a central band of the slide zone (the trays stand on both sides of it): runs across the
   band joined by U-turns; at a run's end a spiral may loop out and up past the band's edge (its way out heads back
   down, so it doubles as the U-turn).  From a start near the top down to just above the sorter, then along to the
   tail into the bowl.  Of the random meanders that raise no slide warning, the longest of `pool` wins.
   opts: seed, spirals (0-2), band (how far the runs reach either side), pool, minLen */
const SLIDE_BAD = new Set(['zone-slide', 'zone-start', 'slide-tight', 'slide-clear', 'slide-sorter']);
function designSlide(opts){
  opts = opts || {}; const rng = C.mulberry32((opts.seed || 1)*7919 + 3), nsp = opts.spirals || 0, pool = opts.pool || 8, tail = C.TAIL[0];
  let best = null, found = 0, tries = 0;
  const end = T => { const P = turtle(T, start); const q = P[P.length - 1]; return q[0] === 'S' ? [q[1], q[2]] : q; };
  let start = null;
  for (; tries < 3000 && found < pool; tries++){
    const band = (opts.band || 0.8) + rng()*0.5, r = 0.82 + rng()*0.2;
    start = {x:(rng()*2 - 1)*0.5, z:-(12.0 + rng()*0.5)};
    let dir = rng() < 0.5 ? 1 : -1, sp = 0;
    const T = [['F', 0.3 + rng()*0.3], [dir > 0 ? 'L' : 'R', 90, r]];
    for (let leg = 0; leg < 9; leg++){
      const [x, z] = end(T); if (z > -6.6) break;
      const target = dir*band*(0.7 + rng()*0.3), F = Math.max(0.2, (target - x)*dir); T.push(['F', F]);
      const wantSp = sp < nsp && leg >= 1 && rng() < 0.55;
      if (wantSp){                                   // loop out and up past the band's edge; the way out heads back down
        T.push(['S', 0.8 + rng()*0.1, -dir]); T.push(['F', 0.25]); sp++;
        const h = dir > 0 ? 0 : 180, hOut = h + (-dir)*(-110)*(dir > 0 ? 1 : 1);   // the turtle turned by -side*110
        void hOut; T.push([dir > 0 ? 'R' : 'L', 60, r]);
      } else { T.push([dir > 0 ? 'R' : 'L', 90, r]); T.push(['F', rng()*0.35]); T.push([dir > 0 ? 'R' : 'L', 90, r]); }
      dir = -dir;
    }
    const pts = turtle(T, start), zOf = q => q[0] === 'S' ? q[2] : q[1], xOf = q => q[0] === 'S' ? q[1] : q[0];
    let cut = pts.findIndex(q => zOf(q) > -5.8); if (cut < 0) cut = pts.length; if (cut < 4) continue;
    const R = pts.slice(0, cut), last = R[R.length - 1], lx = xOf(last), lz = zOf(last);
    if (Math.hypot(lx - tail[0], lz - tail[1]) < 1.8) continue;
    if (lx > -1.6) R.push([Math.max(-2.4, Math.min(lx - 1.2, (lx + tail[0])/2)), Math.max(lz + 0.4, -5.9)]);
    const lv = {format:1, type:'marble-run-level', name:'x', slide:slide({R}), trays:[], lanes:[[], [], []]};
    if (lv.slide.points.filter(p => p.spiral).length < nsp) continue;
    if (C.checkLevel(lv).warnings.some(w => SLIDE_BAD.has(w.kind))) continue;
    const len = C.buildLayout(lv).SLIDE.tailS; found++;
    if (opts.minLen && len < opts.minLen) continue;
    if (!best || len > best.len) best = {slide:lv.slide, len};
  }
  return best ? {slide:best.slide, len:best.len, tries} : null;
}
module.exports = {C, slide, turtle, trayShape, place, trayProblems, trayLength, halfW0, designSlide};
