// Places all the ramps of a level together, for levels tools/fix-ramps.js cannot fix one ramp at a time (a crowded board
// where straight ramps only fit in a few places).  Every ramp gets every spot along the road where it alone is clean
// (either side, turned up to 40 degrees from square to the road, its apron at most a row deep), then the cheapest
// combination with no two ramps overlapping: the least distance from each ramp's old boarding point (another side
// counts 3, a turn a little).  Of the best 300 combinations the first that is warning-free and won by the greedy bot
// is taken.
//   node tools/place-ramps.js level.json [--reflow] [--any] [--write]
//     --reflow  a ramp may also take another shape with the same number of cells (its stickmen re-laid row by row,
//               front to back; not for a ramp with a blocker): a little dearer than moving
//     --any     take the first warning-free combination even if the greedy bot loses (then make the content again,
//               e.g. make-funnel.js --search)
//     --write   write it back to the file
const path = require('path'), ROOT = path.join(__dirname, '..'), C = require(path.join(ROOT, 'tests', 'core.js'))(), fs = require('fs'), fmt = require(path.join(ROOT, 'tools', 'level-format.js'));
const clone = o => JSON.parse(JSON.stringify(o)), r2 = v => Math.round(v*100)/100, r3 = v => Math.round(v*1000)/1000;
const file = process.argv[2], lv = JSON.parse(fs.readFileSync(file, 'utf8')), L0 = C.buildLayout(C.normalizeLevel(clone(lv)));
const S = L0.ROAD.portalS, orig = lv.ramps.map((r, k) => L0.RAMPS.find(q => q.src === k));
const place = (rd, s, side, phi) => { const o = {}; C.pathAt(L0.ROAD, s, o, 0); const n = [-o.dz*side, o.dx*side], t = [o.dx, o.dz], a = phi*Math.PI/180;
  const d = [n[0]*Math.cos(a) + t[0]*Math.sin(a), n[1]*Math.cos(a) + t[1]*Math.sin(a)], A = [o.x + n[0]*C.ROAD_HALF, o.z + n[1]*C.ROAD_HALF], len = 0.34 + (rd.rows - 1)*C.RAMP_SP + 0.92;
  const out = clone(rd); out.at = r3(s); out.side = side; delete out.cp; delete out.front; delete out.push; delete out.tilt; delete out.spread;
  if (Math.abs(phi) < 0.05) delete out.shape; else out.shape = [[r2(A[0] + d[0]*len), r2(A[1] + d[1]*len)]]; return out; };
const spotCache = new Map();
const spotsFor = rd => { const key = rd.rows + 'x' + rd.columns.length; if (spotCache.has(key)) return spotCache.get(key); const list = [];
  for (let s = 0.8; s < S - 0.8; s += 0.1) for (const side of [1, -1]) for (let phi = -40; phi <= 40; phi += 4){
    const r1 = place(rd, s, side, phi), R = C.buildRamp(L0.ROAD, r1, 0, L0.Y); if (R.apron > C.RAMP_APRON_MAX || R.frontShort) continue;
    const one = clone(lv); one.ramps = [r1]; const w = C.checkLevel(one).warnings.filter(x => /^ramp-|^zone-ramp$/.test(x.kind)); if (w.length) continue;
    list.push({r1, s, side, phi, poly:R.outline}); }
  spotCache.set(key, list); return list; };
// --reflow: a ramp may also take another shape with the same number of cells (its stickmen re-laid row by row, front to back)
const reflow = (rd, cols) => { const R = rd.rows, n = rd.columns.length, flat = []; for (let r = 0; r < R; r++) for (let c = 0; c < n; c++) flat.push(rd.columns[c][r]);
  const rows = flat.length/cols, out = clone(rd); out.rows = rows; out.columns = Array.from({length:cols}, (_, c) => Array.from({length:rows}, (_, r) => flat[r*cols + c]));
  delete out.tunnels; delete out.boxes; return out; };
const shapesOf = rd => { const n = rd.rows*rd.columns.length, out = [rd];
  if (process.argv.includes('--reflow') && !(rd.tunnels || []).length && !(rd.boxes || []).length)
    for (let c = 3; c <= 16; c++) if (n % c === 0 && c !== rd.columns.length && n/c >= 3 && n/c <= 12) out.push(reflow(rd, c));
  return out; };
const cands = lv.ramps.map((rd0, k) => { const list = [];
  for (const rd of shapesOf(rd0)) for (const c of spotsFor(rd)) list.push({rd:Object.assign(clone(rd), {at:c.r1.at, side:c.r1.side}, c.r1.shape ? {shape:c.r1.shape} : {}), poly:c.poly,
    cost:Math.abs(c.s - orig[k].s) + (c.side !== orig[k].side ? 3 : 0) + Math.abs(c.phi)*0.01 + (rd !== rd0 ? 2 : 0)});
  list.forEach(c => { if (!c.rd.shape || !c.rd.shape.length) delete c.rd.shape; delete c.rd.tilt; delete c.rd.spread; });
  list.sort((a, b) => a.cost - b.cost); console.log('ramp', k + 1, list.length, 'spots; best cost', list.length ? list[0].cost.toFixed(2) : '-'); return list; });
let nodes = 0; const pick = [], memo = new Map(), sols = [], MAXS = 300;
cands.forEach(list => list.forEach(c => { c.poly.__uid = c.poly.__uid || Math.random(); }));
const ok2 = (a, b) => { const key = a.poly.__uid < b.poly.__uid ? a.poly.__uid + ':' + b.poly.__uid : b.poly.__uid + ':' + a.poly.__uid;
  if (!memo.has(key)) memo.set(key, a.poly !== b.poly && !C.polysOverlap(a.poly, b.poly, 0.06)); return memo.get(key); };
const worst = () => sols.length < MAXS ? Infinity : sols[sols.length - 1].cost;
(function go(k, cost){ if (cost >= worst()) return; if (k === cands.length){ sols.push({cost, pick:pick.slice()}); sols.sort((a, b) => a.cost - b.cost); if (sols.length > MAXS) sols.pop(); return; }
  for (const c of cands[k]){ if (cost + c.cost >= worst()) break; if (++nodes > 3e7) return; if (!pick.every(p => ok2(p, c))) continue; pick.push(c); go(k + 1, cost + c.cost); pick.pop(); } })(0, 0);
console.log('searched', nodes, 'nodes,', sols.length, 'arrangements');
let out = null, W = [], win = '', tried = 0;
for (const sol of sols){ tried++; const cand = clone(lv); cand.ramps = sol.pick.map(c => c.rd);
  W = C.checkLevel(clone(cand)).warnings; if (W.length) continue; win = C.simulate(clone(cand), C.greedyPick, null, C.SIM_DT).result; if (win !== 'win' && !process.argv.includes('--any')) continue; out = cand; out.cost = sol.cost; break; }
if (!out){ console.log('NO WINNABLE ARRANGEMENT among', tried); process.exit(1); }
const cost = out.cost; delete out.cost;
console.log('arrangement', tried, 'cost', cost.toFixed(2), out.ramps.map((r, k) => `${k + 1}: ${orig[k].s.toFixed(2)}${orig[k].side > 0 ? 'R' : 'L'} -> ${r.at}${r.side > 0 ? 'R' : 'L'} ${r.columns.length}x${r.rows}`).join(', '), '| warnings none | greedy', win);
// a ramp the core slid on at either end of the road keeps its final boarding point (when that is still clean)
{ const L = C.buildLayout(C.normalizeLevel(clone(out)));
  out.ramps.forEach((rd, k) => { const s = r3(L.RAMPS.find(q => q.src === k).s); if (Math.abs(rd.at - s) < 1e-6) return;
    const t = clone(out); t.ramps[k].at = s; if (!C.checkLevel(clone(t)).warnings.length) rd.at = s; }); }
if (process.argv.includes('--write')) fs.writeFileSync(file, fmt(out) + '\n');
