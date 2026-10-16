// Builds the small blocker demo levels into levels/demo_*.json (one per blocker, plus one with all of them):
//   node tools/make-demos.js            then  node tools/sync-presets.js
// Each demo uses the built-in level's slide and its tray places (3 columns), content from the plan method
// (tools/funnel/content.js) with the blocker below.  Seeds are searched until the level has no checker warnings, the
// greedy bot wins and the random bots win 15-90% of 120 games.
const fs = require('fs'), path = require('path');
const C = require('../tests/core.js')(), fmt = require('./level-format.js'), CT = require('./funnel/content.js');
const OUT = path.join(__dirname, '..', 'levels');
const ROWS = 6;
const DEMOS = [
  {id:'demo_hidden_box', name:'Demo: Hidden Boxes', blockers:{hidden:4}, colors:4},
  {id:'demo_connected', name:'Demo: Connected Boxes', blockers:{link:'pairs+triples'}, colors:4},
  {id:'demo_dispenser', name:'Demo: Marble Dispensers', blockers:{disp:2, easy:true}, colors:4},
  {id:'demo_hidden_marbles', name:'Demo: Hidden Marbles', blockers:{hiddenMarbles:0.3}, colors:4},
  {id:'demo_lock_crate', name:'Demo: Lock & Key', blockers:{lock:1}, colors:4},
  {id:'demo_count_crate', name:'Demo: Count Crate', blockers:{count:1}, colors:4},
  {id:'demo_combo', name:'Demo: All Together', blockers:{hidden:2, link:'pairs', disp:1, easy:true, hiddenMarbles:0.15, lock:1, count:1}, colors:5},
];
function base(){
  const L = C.LEVEL_DATA;
  return {format:1, type:'marble-run-level', name:'', slide:JSON.parse(JSON.stringify(L.slide)),
    trays:L.trays.map(t => Object.assign({}, t, {rows:ROWS, columns:Array.from({length:3}, () => new Array(ROWS).fill(null))})), lanes:[[], [], []]};
}
for (const d of DEMOS){
  let best = null;
  for (let seed = 1; seed <= 300 && !best; seed++){
    const rng = C.mulberry32(seed*7919 + d.id.length), spec = {n:12, diff:5, role:'Teach', colors:d.colors, sizes:[4, 6, 8], lanes:3, blockers:d.blockers};
    const gen = CT.generate(spec, base(), 0.35, rng); if (!gen) continue;
    if ((d.blockers.link || d.blockers.hidden) && !CT.queueBlockers(spec, gen, rng)) continue;
    if (d.blockers.lock && !CT.lockCrate(spec, gen, rng)) continue;
    if (d.blockers.count && !CT.countCrate(spec, gen, rng)) continue;
    const lv = CT.strip(gen.level); lv.id = d.id; lv.name = d.name;
    const ck = C.checkLevel(lv); if (!ck.ok) continue;
    const gr = C.simulate(lv, C.greedyPick, null); if (gr.result !== 'win') continue;
    let w = 0; for (let r = 0; r < 120; r++) if (C.simulate(lv, C.randomPick, C.mulberry32(1000 + r)).result === 'win') w++;
    if (w < 18 || w > 108) continue;
    best = {lv, w, gr, seed};
  }
  if (!best){ console.log(d.id + ': NOTHING FOUND'); continue; }
  const out = {format:1, type:'marble-run-level', id:best.lv.id, name:best.lv.name, slide:best.lv.slide, trays:best.lv.trays, lanes:best.lv.lanes};
  fs.writeFileSync(path.join(OUT, d.id + '.json'), fmt(out) + '\n');
  console.log(`${d.id}: seed ${best.seed}, greedy ${best.gr.t.toFixed(1)} s, random ${best.w}/120`);
}
