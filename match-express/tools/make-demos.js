// Builds the small blocker demo levels into levels/demo_*.json (one per blocker, plus one with several):
//   node tools/make-demos.js            then  node tools/sync-presets.js
// Each demo uses the Level 2 road and its first four ramp places (4 columns x 6 rows), random colour runs,
// buses that exactly match every colour, and the blockers below. Seeds are searched until the level has no
// checker warnings, the greedy bot wins, the random bots win 10-90% of 120 games, and (lock) the key bus
// never has to use the parachute fallback in those games.
const fs = require('fs'), path = require('path');
const C = require('../tests/core.js')(), fmt = require('./level-format.js');
const OUT = path.join(__dirname, '..', 'levels');
const PALETTE = ['red', 'blue', 'yellow', 'green', 'purple'];
const PLACE = C.LEVEL_DATA.ramps.slice(0, 4).map(r => ({cp:r.cp, side:r.side, shape:r.shape}));
const ROWS = 6, COLS = 4, CAPS = [4, 6, 8, 12];

function splitCaps(n, rng, caps){                    // n seats as 2-4 buses of 4/6/8/12 (or the given sizes)
  const opts = [], CAPS_ = caps || CAPS;
  const rec = (left, acc) => { if (left === 0){ if (acc.length >= 2 && acc.length <= 5) opts.push(acc.slice()); return; }
    for (const c of CAPS_) if (c <= left && (!acc.length || c <= acc[acc.length - 1])) { acc.push(c); rec(left - c, acc); acc.pop(); } };
  rec(n, []);
  return opts.length ? opts[Math.floor(rng()*opts.length)] : null;
}
function build(spec, seed){
  const rng = C.mulberry32(seed*104729 + spec.salt);
  const colors = PALETTE.slice(0, spec.colors || 4);
  const ramps = PLACE.map(p => ({cp:p.cp, side:p.side, shape:p.shape, rows:ROWS, columns:[]}));
  (spec.tunnels || []).forEach(t => { ramps[t.ramp].tunnels = (ramps[t.ramp].tunnels || []).concat([{col:t.col, row:t.row, w:t.w, h:t.h, color:t.color, count:t.count}]); });
  (spec.boxes || []).forEach(b => { const o = {col:b.col, row:b.row, w:b.w, h:b.h}; if (b.lock) o.lock = b.lock; else o.count = b.count;
    ramps[b.ramp].boxes = (ramps[b.ramp].boxes || []).concat([o]); });
  const blocked = (k, c, r) => (ramps[k].tunnels || []).some(t => c >= t.col && c < t.col + t.w && r >= t.row && r < t.row + t.h);
  // colour budget: equal, even shares of the free cells + tunnel stickmen
  let cells = 0; ramps.forEach((rp, k) => { for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (!blocked(k, c, r)) cells++; });
  const tunMen = {}; colors.forEach(c => tunMen[c] = 0); (spec.tunnels || []).forEach(t => { tunMen[t.color] += t.count; });
  const total = cells + Object.values(tunMen).reduce((a, b) => a + b, 0), share = Math.floor(total/colors.length/2)*2;
  const target = {}; colors.forEach(c => target[c] = share); target[colors[0]] += total - share*colors.length;
  if (target[colors[0]] % 2) return null;
  const budget = {}; for (const c of colors){ budget[c] = target[c] - tunMen[c]; if (budget[c] < 0) return null; }
  for (let k = 0; k < ramps.length; k++) for (let c = 0; c < COLS; c++){
    const col = []; let prev = null;
    for (let r = 0; r < ROWS; ){
      if (blocked(k, c, r)){ col.push(null); r++; prev = null; continue; }
      const cand = colors.filter(x => x !== prev && budget[x] > 0); if (!cand.length) return null;
      const color = cand[Math.floor(rng()*cand.length)];
      let L = 1 + Math.floor(rng()*3);
      while (L > 0){ if (r >= ROWS || blocked(k, c, r) || !budget[color]) break; col.push(color); budget[color]--; r++; L--; }
      prev = color;
    }
    ramps[k].columns.push(col);
  }
  if (colors.some(c => budget[c] !== 0)) return null;
  if (spec.hiddenMen) ramps.forEach((rp, k) => { if (spec.hiddenMen.ramps && !spec.hiddenMen.ramps.includes(k)) return;
    rp.columns.forEach(col => col.forEach((x, r) => { if (x && r > 0 && rng() < spec.hiddenMen.share) col[r] = '?' + x; })); });
  // buses
  const buses = []; for (const c of colors){ const caps = splitCaps(target[c], rng, spec.caps); if (!caps) return null; caps.forEach(cap => buses.push({color:c, cap})); }
  for (let i = buses.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [buses[i], buses[j]] = [buses[j], buses[i]]; }
  const lanes = [[], [], []]; buses.forEach((b, i) => lanes[i % 3].push(b));
  if (spec.queue && !spec.queue(lanes, rng)) return null;
  const lv = {format:2, id:spec.id, name:spec.name, road:JSON.parse(JSON.stringify(C.LEVEL_DATA.road)), ramps, lanes};
  return lv;
}
function judge(lv, spec){
  const ck = C.checkLevel(lv);
  if (ck.warnings.length || !ck.balanced) return null;
  const g = C.simulate(lv, C.greedyPick, null, C.SIM_DT); if (g.result !== 'win') return null;
  let wins = 0, fb = g.keyFallbacks ? 1 : 0, miss = g.cheerMiss;
  for (let r = 0; r < 120; r++){ const s = C.simulate(lv, C.randomPick, C.mulberry32(1000 + r), C.SIM_DT); if (s.result === 'win') wins++; if (s.keyFallbacks) fb++; miss += s.cheerMiss; }
  const rate = wins/120;
  if (rate < (spec.minRate || 0.1) || rate > 0.9 || fb || miss) return null;
  return {sends:g.sends, rate};
}
const hide = (lanes, picks) => picks.forEach(([l, i]) => { if (lanes[l][i]) lanes[l][i].hidden = true; else throw 0; });
const link = (lanes, id, picks) => picks.forEach(([l, i]) => { if (lanes[l][i]) lanes[l][i].link = id; else throw 0; });
const tryQ = f => (lanes, rng) => { try { f(lanes, rng); return true; } catch (e) { return false; } };
const SPECS = [
  {id:'demo_hidden_bus', name:'Demo: Hidden Buses', salt:11, queue:tryQ(l => hide(l, [[0,1],[1,2],[2,1],[0,3]]))},
  {id:'demo_connected', name:'Demo: Connected Buses', salt:23, caps:[4, 6, 8], queue:tryQ(l => { link(l, 'A', [[0,1],[1,1]]); link(l, 'B', [[2,1],[2,2]]); link(l, 'C', [[0,3],[1,3],[2,4]]); })},
  {id:'demo_tunnel', name:'Demo: Colourful Tunnels', salt:37,
   tunnels:[{ramp:1, col:1, row:2, w:1, h:2, color:'red', count:6}, {ramp:2, col:1, row:1, w:2, h:1, color:'blue', count:8}]},
  {id:'demo_hidden_men', name:'Demo: Hidden Stickmen', salt:41, hiddenMen:{share:0.6}},
  {id:'demo_lock_box', name:'Demo: Lock & Key', salt:53, boxes:[{ramp:2, col:0, row:0, w:2, h:2, lock:'K1'}], key:'K1'},
  {id:'demo_count_box', name:'Demo: Count Box', salt:67, boxes:[{ramp:1, col:2, row:1, w:2, h:2, count:3}]},
  {id:'demo_combo', name:'Demo: All Together', salt:79, colors:5, minRate:0.05,
   tunnels:[{ramp:3, col:2, row:2, w:1, h:2, color:'green', count:6}], boxes:[{ramp:1, col:0, row:1, w:2, h:2, lock:'K'}], key:'K',
   hiddenMen:{share:0.5, ramps:[2]}, queue:tryQ(l => { hide(l, [[1,2],[2,3]]); link(l, 'G', [[0,2],[1,3]]); })},
];
const ONLY = process.argv.slice(2);
for (const spec of SPECS.filter(s => !ONLY.length || ONLY.includes(s.id))){
  let done = null;
  for (let seed = 1; seed < 4000 && !done; seed++){
    const lv = build(spec, seed); if (!lv) continue;
    if (spec.key){                                   // the key goes on the bus that never needs the fallback
      const cands = []; lv.lanes.forEach((ln, l) => ln.forEach((b, i) => cands.push([l, i])));
      for (const [l, i] of cands){ const t = JSON.parse(JSON.stringify(lv)); t.lanes[l][i].key = spec.key; const j = judge(t, spec); if (j){ done = {lv:t, j, seed}; break; } }
    } else { const j = judge(lv, spec); if (j) done = {lv, j, seed}; }
  }
  if (!done){ console.log(spec.id + ': no seed found'); process.exitCode = 1; continue; }
  fs.writeFileSync(path.join(OUT, spec.id + '.json'), fmt(done.lv) + '\n');
  console.log(`${spec.id}: seed ${done.seed}, greedy ${done.j.sends} sends, random ${(done.j.rate*100).toFixed(0)}%`);
}
