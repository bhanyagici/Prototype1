// Ramps lie flush on the road: the whole front edge of a ramp is the road's edge (straight on a straight road, bent
// with a curve).  A level saved before that can now warn where a ramp sat beside a bend or close to the road, another
// ramp or the exit tunnel.  This slides each such ramp along the road to the nearest spot where the level is clean;
// its shape moves with its front, so the platform keeps its form.  Content, lanes and the road stay as they are, and
// the greedy bot must still win.  Old "push" offsets (front node off the road) are dropped.  An exit tunnel standing on
// another stretch of the road moves its mouth (the road's last point) the smallest step that clears it.
//   node tools/fix-ramps.js            every level in levels/ and levels/funnel/ (written back only when changed)
//   node tools/fix-ramps.js a.json ... only these files
const fs = require('fs'), path = require('path');
const C = require('../tests/core.js')(), fmt = require('./level-format.js');
const ROOT = path.join(__dirname, '..'), clone = o => JSON.parse(JSON.stringify(o)), r3 = v => Math.round(v*1000)/1000, r2 = v => Math.round(v*100)/100;
const files = process.argv.slice(2).length ? process.argv.slice(2) :
  fs.readdirSync(path.join(ROOT, 'levels')).filter(f => /\.json$/.test(f) && !/order/.test(f)).map(f => path.join(ROOT, 'levels', f))
    .concat(fs.readdirSync(path.join(ROOT, 'levels', 'funnel')).filter(f => /^f\d+\.json$/.test(f)).sort().map(f => path.join(ROOT, 'levels', 'funnel', f)));
const warns = lv => C.checkLevel(clone(lv)).warnings;
const rampWarn = w => /^ramp-|^zone-ramp$/.test(w.kind);
const greedy = lv => C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT).result;

// the level with ramp k's front at arc length s (its shape carried along with the front node)
function moved(lv, k, s){
  const L = C.buildLayout(clone(lv)), R = L.RAMPS.find(q => q.src === k), out = clone(lv), r = out.ramps[k];
  const o = {}; C.pathAt(L.ROAD, s, o, 0);
  const side = R.side, F = [R.ctrl[0][0], R.ctrl[0][1]], G = [o.x - o.dz*side*C.ROAD_HALF, o.z + o.dx*side*C.ROAD_HALF];
  r.at = r3(s); r.side = side; delete r.cp; delete r.front; delete r.push;
  if (r.shape) r.shape = r.shape.map(q => [r2(q[0] + G[0] - F[0]), r2(q[1] + G[1] - F[1])]);
  return out;
}
function fix(lv){
  const win = greedy(lv) === 'win', notes = [];
  let cur = clone(lv), changed = false;
  cur.ramps.forEach(r => { if (r.push != null){ delete r.push; changed = true; } });
  for (let pass = 0; pass < 4; pass++){
    // a ramp overlapping another may also be fixed by moving the other one
    const W = warns(cur).filter(rampWarn), bad = [...new Set(W.map(w => w.ramp).concat(W.filter(w => w.kind === 'ramp-ramp').map(w => +/ramp (\d+)$/.exec(w.msg)[1] - 1)))];
    if (!bad.length) break;
    for (const k of bad){
      const L = C.buildLayout(clone(cur)), R = L.RAMPS.find(q => q.src === k), n0 = warns(cur).length;
      let best = null;
      for (let step = 1; step <= 40 && !best; step++) for (const sg of [1, -1]){
        const s = R.s + sg*step*0.1; if (s < 0.7 || s > L.ROAD.portalS - 0.7) continue;
        const cand = moved(cur, k, s), w = warns(cand);
        if (w.some(x => x.ramp === k) || w.length >= n0) continue;
        if (win && greedy(cand) !== 'win') continue;
        best = cand; notes.push(`ramp ${k + 1}: ${R.s.toFixed(2)} -> ${s.toFixed(2)}`); break;
      }
      // a wobbly shape whose platform folds wherever it sits: a smoother shape to the same far end (or a straight one
      // through it), then a plain straight ramp tilted toward the top of the screen, each with small slides
      const r0 = cur.ramps[k], sh = r0.shape || [], last = sh[sh.length - 1], mid = sh[Math.floor((sh.length - 1)/2)];
      const shapes = last ? [[mid, last], [last]] : [];
      for (const v of shapes.concat([null])){ if (best) break;
        for (const tilt of v ? [undefined] : [35, 20, 50, 0, 65]){ if (best) break;
          for (const d of [0, 0.3, -0.3, 0.6, -0.6, 1, -1, 1.5, -1.5, 2, -2]){
            const s = R.s + d; if (s < 0.7 || s > L.ROAD.portalS - 0.7) continue;
            const base = clone(cur); if (v) base.ramps[k].shape = v.map(q => q.slice()); else { delete base.ramps[k].shape; base.ramps[k].tilt = tilt; }
            const cand = moved(base, k, s), w = warns(cand);
            if (w.some(x => x.ramp === k) || w.length >= n0) continue;
            if (win && greedy(cand) !== 'win') continue;
            best = cand; notes.push(`ramp ${k + 1}: ${v ? (v.length > 1 ? 'smoother' : 'straight') + ' shape' : 'tilted ' + tilt + ' deg'}${d ? ', ' + R.s.toFixed(2) + ' -> ' + s.toFixed(2) : ''}`); break;
          }
        }
      }
      // two ramps meeting on the outside of a bend: both slide apart
      for (const w of warns(cur).filter(x => x.kind === 'ramp-ramp' && x.ramp === k)){ if (best) break;
        const j = +/ramp (\d+)$/.exec(w.msg)[1] - 1, Rj = L.RAMPS.find(q => q.src === j), dir = Rj.s > R.s ? 1 : -1;
        for (let step = 1; step <= 25 && !best; step++){
          const a = R.s - dir*step*0.1, b = Rj.s + dir*step*0.1;
          if (Math.min(a, b) < 0.7 || Math.max(a, b) > L.ROAD.portalS - 0.7) break;
          const cand = moved(moved(cur, k, a), j, b), ww = warns(cand);
          if (ww.some(x => x.ramp === k || x.ramp === j) || ww.length >= n0) continue;
          if (win && greedy(cand) !== 'win') continue;
          best = cand; notes.push(`ramps ${k + 1} and ${j + 1} apart: ${R.s.toFixed(2)} -> ${a.toFixed(2)}, ${Rj.s.toFixed(2)} -> ${b.toFixed(2)}`);
        }
      }
      // no room near its old spot (its front edge needs as much road edge as the ramp is wide): the nearest free stretch
      // of road, on either side, as a straight ramp tilted toward the top of the screen
      if (!best){
        const spots = [];
        for (let s = 0.8; s < L.ROAD.portalS - 0.8; s += 0.2) for (const side of [R.side, -R.side]) spots.push({s, side, d: Math.abs(s - R.s) + (side !== R.side ? 2 : 0)});
        spots.sort((a, b) => a.d - b.d);
        for (const sp of spots){
          const base = clone(cur), r = base.ramps[k]; delete r.shape; r.tilt = 35; r.side = sp.side; delete r.cp; delete r.front; delete r.push; r.at = r3(sp.s);
          const w = warns(base);
          if (w.some(x => x.ramp === k) || w.length >= n0) continue;
          if (win && greedy(base) !== 'win') continue;
          best = base; notes.push(`ramp ${k + 1}: moved to ${sp.s.toFixed(2)}${sp.side !== R.side ? ' (other side)' : ''}, tilted 35 deg`); break;
        }
      }
      if (best){ cur = best; changed = true; }
    }
  }
  // the exit tunnel stands clear of every other stretch of road (the road's edge outside its stone base): the road's
  // last point (the tunnel mouth) moves by the smallest step that clears it
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
  return {lv: cur, changed, notes, left: warns(cur).filter(w => rampWarn(w) || w.kind === 'exit-road').map(w => w.kind + (w.ramp != null ? ' (ramp ' + (w.ramp + 1) + ')' : ''))};
}
if (require.main === module){
  for (const f of files){
    const txt = fs.readFileSync(f, 'utf8'), lv = JSON.parse(txt);
    if (!Array.isArray(lv.ramps)) continue;
    const res = fix(lv), name = path.relative(ROOT, f);
    if (res.changed){ fs.writeFileSync(f, fmt(res.lv) + '\n'); console.log(name + ': ' + (res.notes.join(', ') || 'push dropped')); }
    if (res.left.length) console.log(name + ': STILL ' + res.left.join(', '));
  }
}
module.exports = {fix};
