// Every ramp is a straight rectangle holding a regular grid of stickmen (see buildRamp in shared/core.js): only its
// front edge follows the road, with an apron of at most one row (RAMP_APRON_MAX) between a curved road edge and the
// straight first row.  This brings saved levels up to date:
//  1. a ramp's `shape` becomes the single node it points at - the way its old path left the road, so an old bent
//     (arc, L) ramp is straightened along its first direction - and an old `spread` (fan / wedge) goes;
//  2. a ramp that then warns (its apron deeper than a row; it overlaps the road, another ramp or the exit tunnel; it
//     leaves the target zone) first turns toward square to the road where it stands, which changes nothing in play,
//     and only when that is not enough slides along the road (either side) as little as it can, nearly square to the
//     road there.  Its stickmen, the lanes and the road stay as they are, and the greedy bot must still win.
// An exit tunnel standing on another stretch of the road moves its mouth (the road's last point) the smallest step
// that clears it.
//   node tools/fix-ramps.js            every level in levels/, levels/funnel/ and levels/showcase/ (written back when changed)
//   node tools/fix-ramps.js a.json ... only these files
const fs = require('fs'), path = require('path');
const C = require('../tests/core.js')(), fmt = require('./level-format.js');
const ROOT = path.join(__dirname, '..'), clone = o => JSON.parse(JSON.stringify(o)), r3 = v => Math.round(v*1000)/1000, r2 = v => Math.round(v*100)/100;
const list = d => fs.readdirSync(path.join(ROOT, ...d)).filter(f => /\.json$/.test(f) && !/order|report|bots/.test(f)).sort().map(f => path.join(ROOT, ...d, f));
const files = process.argv.slice(2).length ? process.argv.slice(2) : list(['levels']).concat(list(['levels', 'funnel']), list(['levels', 'showcase']));
const warns = lv => C.checkLevel(clone(lv)).warnings;
const rampWarn = w => /^ramp-|^zone-ramp$/.test(w.kind);
const greedy = lv => C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT).result;
const rad = d => d*Math.PI/180;

// the road's frame beside ramp spot s on `side`: the road-edge point, the outward normal and the direction of travel
function frameAt(ROAD, s, side){ const o = {}; C.pathAt(ROAD, s, o, 0); const n = [-o.dz*side, o.dx*side];
  return {A:[o.x + n[0]*C.ROAD_HALF, o.z + n[1]*C.ROAD_HALF], n, t:[o.dx, o.dz]}; }
// ramp k's angle to the road (degrees from square, + toward the direction of travel)
function angleOf(L, R){ const f = frameAt(L.ROAD, R.s, R.side); return Math.atan2(R.dir[0]*f.t[0] + R.dir[1]*f.t[1], R.dir[0]*f.n[0] + R.dir[1]*f.n[1])*180/Math.PI; }
// the level with ramp k at s on `side`, `phi` degrees from square to the road (square: no shape node at all)
function placed(lv, L, k, s, side, phi){
  const out = clone(lv), r = out.ramps[k], R = L.RAMPS.find(q => q.src === k), f = frameAt(L.ROAD, s, side);
  r.at = r3(s); r.side = side; delete r.cp; delete r.front; delete r.push; delete r.tilt; delete r.spread;
  if (Math.abs(phi) < 0.05) delete r.shape;
  else { const a = rad(phi), d = [f.n[0]*Math.cos(a) + f.t[0]*Math.sin(a), f.n[1]*Math.cos(a) + f.t[1]*Math.sin(a)], l = R.length + 0.5;
    r.shape = [[r2(f.A[0] + d[0]*l), r2(f.A[1] + d[1]*l)]]; }
  return out;
}
// step 1: one direction node per shaped ramp, no spread
function normalize(lv){
  const out = clone(lv), L = C.buildLayout(clone(lv)); let changed = false;
  out.ramps.forEach((r, k) => { const R = L.RAMPS.find(q => q.src === k);
    if (r.spread != null){ delete r.spread; changed = true; }
    if (r.shape && r.tilt == null && R && (r.shape.length > 1 || r.push != null)){ r.shape = [[r2(R.ctrl[1][0]), r2(R.ctrl[1][1])]]; changed = true; } });
  return {lv: out, changed};
}
// a quick look at ramp k alone before the whole level's check: its apron and front edge
function quickOk(cand, L, k){ const rd = cand.ramps[k], R = C.buildRamp(L.ROAD, Object.assign({}, rd, {rows: rd.rows || Math.max(...rd.columns.map(c => c.length))}), k, L.Y);
  return R.apron <= C.RAMP_APRON_MAX + 1e-6 && !R.frontShort; }
function fix(lv){
  const win = greedy(lv) === 'win', notes = [];
  let {lv: cur, changed} = normalize(lv);
  for (let pass = 0; pass < 4; pass++){
    // a ramp overlapping another may also be fixed by moving the other one
    const W = warns(cur).filter(rampWarn), bad = [...new Set(W.map(w => w.ramp).concat(W.filter(w => w.kind === 'ramp-ramp').map(w => +/ramp (\d+)$/.exec(w.msg)[1] - 1)))];
    if (!bad.length) break;
    for (const k of bad){
      const L = C.buildLayout(clone(cur)), R = L.RAMPS.find(q => q.src === k), n0 = warns(cur).length, phi0 = angleOf(L, R);
      const mine = w => w.ramp === k || (w.kind === 'ramp-ramp' && +/ramp (\d+)$/.exec(w.msg)[1] - 1 === k);
      if (!warns(cur).some(w => rampWarn(w) && mine(w))) continue;                 // fixed meanwhile by moving its neighbour
      const phis = [...new Set([phi0, phi0*0.75, phi0*0.5, phi0*0.25, 0, -5, 5, -10, 10, -15, 15, -20, 20, -25, 25].map(v => Math.round(v*10)/10))]
        .sort((a, b) => Math.abs(a - phi0) - Math.abs(b - phi0));
      let best = null;
      const tryAt = (s, side, why) => { if (s < 0.7 || s > L.ROAD.portalS - 0.7) return false;
        for (const phi of side === R.side ? phis : [0, -5, 5, -10, 10, -15, 15]){
          const cand = placed(cur, L, k, s, side, phi); if (!quickOk(cand, L, k)) continue;
          const w = warns(cand); if (w.some(mine) || w.length >= n0) continue;
          if ((Math.abs(s - R.s) > 1e-6 || side !== R.side) && win && greedy(cand) !== 'win') continue;
          best = cand; const turn = Math.abs(phi - phi0) > 0.5 ? `turned ${phi0.toFixed(0)} -> ${phi.toFixed(0)} deg` : '';
          notes.push(`ramp ${k + 1}: ` + [turn, Math.abs(s - R.s) > 1e-6 ? `${R.s.toFixed(2)} -> ${s.toFixed(2)}` : '', side !== R.side ? 'other side' : '', why || ''].filter(Boolean).join(', '));
          return true; }
        return false; };
      // turn where it stands, then slide a little either way
      for (let step = 0; step <= 40 && !best; step++) for (const sg of step ? [1, -1] : [1]) if (tryAt(R.s + sg*step*0.1, R.side)) break;
      // two ramps meeting: both slide apart
      for (const w of warns(cur).filter(x => x.kind === 'ramp-ramp' && x.ramp === k)){ if (best) break;
        const j = +/ramp (\d+)$/.exec(w.msg)[1] - 1, Rj = L.RAMPS.find(q => q.src === j), dir = Rj.s > R.s ? 1 : -1;
        for (let step = 1; step <= 25 && !best; step++){
          const a = R.s - dir*step*0.1, b = Rj.s + dir*step*0.1; if (Math.min(a, b) < 0.7 || Math.max(a, b) > L.ROAD.portalS - 0.7) break;
          const c1 = placed(cur, L, k, a, R.side, 0), L1 = C.buildLayout(clone(c1)), cand = placed(c1, L1, j, b, Rj.side, 0), ww = warns(cand);
          if (ww.some(x => mine(x) || x.ramp === j) || ww.length >= n0) continue;
          if (win && greedy(cand) !== 'win') continue;
          best = cand; notes.push(`ramps ${k + 1} and ${j + 1} apart, square: ${R.s.toFixed(2)} -> ${a.toFixed(2)}, ${Rj.s.toFixed(2)} -> ${b.toFixed(2)}`); }
      }
      // no room near its old spot: the nearest free stretch of road, on either side
      if (!best){ const spots = [];
        for (let s = 0.8; s < L.ROAD.portalS - 0.8; s += 0.2) for (const side of [R.side, -R.side]) spots.push({s, side, d: Math.abs(s - R.s) + (side !== R.side ? 2 : 0)});
        spots.sort((a, b) => a.d - b.d);
        for (const sp of spots) if (Math.abs(sp.s - R.s) > 4 - 1e-6 || sp.side !== R.side){ if (tryAt(sp.s, sp.side, 'the nearest free stretch')) break; } }
      if (best){ cur = best; changed = true; }
    }
  }
  // the exit tunnel stands clear of every other stretch of road: the road's last point (the tunnel mouth) moves by the
  // smallest step that clears it
  if (warns(cur).some(w => w.kind === 'exit-road')){
    const n0 = warns(cur).length, steps = [];
    for (let d = 0.1; d <= 1.6; d += 0.1) for (let a = 0; a < 16; a++) steps.push([d*Math.cos(a*Math.PI/8), d*Math.sin(a*Math.PI/8)]);
    for (const [dx, dz] of steps){
      const cand = clone(cur), pts = cand.road.points, q = pts[pts.length - 1]; q.x = r2(q.x + dx); q.z = r2(q.z + dz);
      if (cand.road.tail) cand.road.tail = [r2(cand.road.tail[0] + dx), cand.road.tail[1], r2(cand.road.tail[2] + dz)];
      const w = warns(cand); if (w.length >= n0 || w.some(x => x.kind === 'exit-road')) continue;
      if (win && greedy(cand) !== 'win') continue;
      cur = cand; changed = true; notes.push(`exit tunnel moved by ${dx.toFixed(2)}, ${dz.toFixed(2)}`); break;
    }
  }
  // a ramp the core slid on at either end of the road keeps its final boarding point (when that is still clean)
  { const L = C.buildLayout(clone(cur));
    cur.ramps.forEach((rd, k) => { const s = r3(L.RAMPS.find(q => q.src === k).s); if (rd.at == null || Math.abs(rd.at - s) < 1e-6) return;
      const t = clone(cur); t.ramps[k].at = s; if (warns(t).length <= warns(cur).length){ rd.at = s; changed = true; } }); }
  return {lv: cur, changed, notes, left: warns(cur).filter(w => rampWarn(w) || w.kind === 'exit-road').map(w => w.kind + (w.ramp != null ? ' (ramp ' + (w.ramp + 1) + ')' : ''))};
}
if (require.main === module){
  for (const f of files){
    const lv = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!Array.isArray(lv.ramps)) continue;
    const res = fix(lv), name = path.relative(ROOT, f);
    if (res.changed){ fs.writeFileSync(f, fmt(res.lv) + '\n'); console.log(name + ': ' + (res.notes.join('; ') || 'one direction node per ramp')); }
    if (res.left.length) console.log(name + ': STILL ' + res.left.join(', '));
  }
}
module.exports = {fix, normalize};
