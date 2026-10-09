// Builds the 40-level funnel: levels/funnel/f01.json ... f40.json, levels/funnel/funnel-order.json and
// levels/funnel/funnel-report.json (the measured data behind the spreadsheet).
//   node tools/make-funnel.js            all levels, 4 in parallel
//   node tools/make-funnel.js 7 13 26    only these (the others' results are kept in the report)
//   FUNNEL_PASS=2 node tools/make-funnel.js --refine ...   (each pass number draws other candidates)
//   node tools/make-funnel.js --refine [7 13 ...]   a second pass from the saved levels: many more (h, seed) candidates
//                                        around the tuned h; a candidate replaces the saved level when it is closer to the
//                                        band, or as close and with a longer greedy game (playtime)
// Per level: the road and ramps (tools/funnel/geometry.js), then content at a hardness h (tools/funnel/content.js),
// tuned by bisection on h (and a few seeds per h) until the random bot's win rate over 200 games lands in the
// level's difficulty band, with the greedy bot winning. Levels 1-5 must not be losable: they get no tuning against
// a band (their random-bot rate is 100% by construction) but a fail-free proof (see failFree).
const fs = require('fs'), path = require('path'), {fork} = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'levels', 'funnel');
const SPECS = require('./funnel/specs.js');
const BANDS = {1:[0.70, 1], 2:[0.70, 1], 3:[0.55, 0.75], 4:[0.45, 0.60], 5:[0.35, 0.50], 6:[0.25, 0.40], 7:[0.18, 0.30], 8:[0.12, 0.22], 9:[0.08, 0.15]};
const id = n => 'f' + String(n).padStart(2, '0');

if (process.env.FUNNEL_WORKER){ worker(); return; }
const REFINE = process.argv.includes('--refine');
const want = process.argv.slice(2).map(Number).filter(Boolean);
const todo = SPECS.filter(s => (!want.length || want.includes(s.n)) && !(REFINE && s.n <= 5)).map(s => s.n);
fs.mkdirSync(OUT, {recursive:true});
const reportFile = path.join(OUT, 'funnel-report.json');
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : {levels:{}};
let running = 0; const queue = todo.slice(), t0 = Date.now();
const next = () => {
  while (running < 4 && queue.length){
    const n = queue.shift(); running++;
    const w = fork(__filename, [], {env:Object.assign({}, process.env, {FUNNEL_WORKER:'1'})});
    w.send({n, refine:REFINE, prev:report.levels[id(n)] || null});
    w.on('message', m => { if (m.log) console.log(m.log); if (m.result){ report.levels[id(n)] = m.result; } });
    w.on('exit', () => { running--; if (!queue.length && !running) finish(); else next(); });
  }
};
next();
function finish(){
  const ids = SPECS.map(s => id(s.n)).filter(i => report.levels[i]);
  report.generated = new Date().toISOString().slice(0, 10);
  report.totalGreedy1x = ids.reduce((a, i) => a + report.levels[i].greedyT, 0);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'funnel-order.json'), JSON.stringify({type:'match-express-level-order', version:1, levels:SPECS.map(s => id(s.n))}, null, 2) + '\n');
  console.log(`\n${ids.length} levels in the report; greedy total ${(report.totalGreedy1x/60).toFixed(1)} min at 1x, ${(report.totalGreedy1x/120).toFixed(1)} min at 2x; ${((Date.now() - t0)/60000).toFixed(1)} min`);
}

/* ------------------------------------------------------------------ worker ------------------------------------------ */
function worker(){
  const G = require('./funnel/geometry.js'), CT = require('./funnel/content.js'), C = G.C, fmt = require('./level-format.js');
  process.on('message', m => { const spec = SPECS.find(s => s.n === m.n); const result = m.refine ? refineLevel(spec, m.prev) : tuneLevel(spec); process.send({result}); process.exit(0); });
  const log = s => process.send({log:s});

  function base(spec){
    const lv = {format:2, id:id(spec.n), name:'Level ' + spec.n, road:G.road(spec), ramps:[], lanes:[[], [], []]};
    const notes = G.place(spec, lv);
    return {lv, notes};
  }
  function candidate(spec, b, h, seed){
    const rng = C.mulberry32(seed*7919 + spec.n*104729);
    let gen;
    if (spec.n === 1) gen = tutorial1(b.lv); else if (spec.n === 3) gen = tutorial3(b.lv);
    else { gen = CT.generate(spec, b.lv, h, rng); if (!gen) return null;
      if (!CT.queueBlockers(spec, gen, rng)) return null;
      if (spec.blockers && spec.blockers.lock && !CT.lockBox(spec, gen, rng)) return null; }
    const lv = CT.strip(gen.level);
    lv.meta = meta(spec);
    const ck = C.checkLevel(JSON.parse(JSON.stringify(lv)));
    if (!ck.balanced || ck.warnings.length) return null;
    return lv;
  }
  function evaluate(lv, runs){
    const g = C.simulate(lv, C.greedyPick, null, C.SIM_DT);
    if (g.result !== 'win' || g.cheerMiss) return {greedy:g, ok:false};
    let wins = 0, fb = g.keyFallbacks ? 1 : 0, miss = 0;
    for (let r = 0; r < runs; r++){ const s = C.simulate(lv, C.randomPick, C.mulberry32(1000 + r), C.SIM_DT); if (s.result === 'win') wins++; if (s.keyFallbacks) fb++; miss += s.cheerMiss; }
    return {greedy:g, ok:!miss && !fb, rate:wins/runs, wins, runs, fb, miss};
  }
  function tuneLevel(spec){
    const t0 = Date.now(), b = base(spec), band = BANDS[spec.diff], early = spec.n <= 5;
    if (b.notes.some(x => /NO PLACE/.test(x))) { log(`${id(spec.n)} geometry failed: ${b.notes.join('; ')}`); return null; }
    let lo = 0, hi = 1, h = early ? 0.15 : Math.min(0.85, Math.max(0.1, (spec.diff - 1)/9)), best = null, tries = 0;
    for (let it = 0; it < 16; it++){
      let ev = null, lv = null, seed = 0;
      for (seed = 1; seed <= 12 && !ev; seed++){ lv = candidate(spec, b, h, seed + it*31); if (!lv) continue; tries++;
        const e = evaluate(lv, 60); if (e.ok) ev = e; }
      if (!ev){ hi = h; h = (lo + h)/2; if (hi - lo < 0.02) break; continue; }       // nothing playable this hard: ease off
      const dist = ev.rate < band[0] ? band[0] - ev.rate : ev.rate > band[1] ? ev.rate - band[1] : 0;
      if (!best || dist < best.dist){ best = {lv, h, dist, rate:ev.rate}; }
      if (dist === 0 || early){
        const full = evaluate(lv, 200);
        if (full.ok && (early || (full.rate >= band[0] && full.rate <= band[1]))){ best = {lv, h, dist:0, rate:full.rate, full}; break; }
        if (full.ok){ const d2 = full.rate < band[0] ? band[0] - full.rate : full.rate - band[1]; if (d2 < best.dist || best.dist === 0) best = {lv, h, dist:d2, rate:full.rate, full}; }
      }
      if (ev.rate > band[1]){ lo = h; h = (h + hi)/2; } else { hi = h; h = (lo + h)/2; }
      if (hi - lo < 0.01) break;
    }
    if (!best){ log(`${id(spec.n)} NOTHING PLAYABLE`); return null; }
    return finish(spec, b, best.lv, best.h, best.full || evaluate(best.lv, 200), t0, tries);
  }
  const bandDist = (r, band) => r < band[0] ? band[0] - r : r > band[1] ? r - band[1] : 0;
  /* refine: candidates around the tuned h (more seeds), a quick 40-game estimate each; the nearest to the band get the
     full 200 games; the saved level stays unless a candidate is closer to the band, or as close with a longer greedy game */
  function refineLevel(spec, prev){   // (the pool is sorted nearest the band first, the longer greedy game breaking ties)
    const t0 = Date.now(), b = base(spec), band = BANDS[spec.diff];
    if (!prev || !fs.existsSync(path.join(OUT, id(spec.n) + '.json'))) return tuneLevel(spec);
    const pass = +(process.env.FUNNEL_PASS || 1);      // another pass draws other candidates
    const rng = C.mulberry32(spec.n*31337 + 7 + pass*7919), budget = spec.men > 200 ? 34 : spec.men > 130 ? 56 : 90, pool = [];
    let tries = 0;
    for (let k = 0; k < budget; k++){
      const h = Math.max(0.05, Math.min(1, prev.h + rng()*0.4 - 0.28)), lv = candidate(spec, b, h, 1000*pass + k*17);
      if (!lv) continue; tries++;
      const e = evaluate(lv, 40); if (!e.ok) continue;
      pool.push({lv, h, q:e.rate, gt:e.greedy.t});
    }
    pool.sort((x, y) => bandDist(x.q, band) - bandDist(y.q, band) || y.gt - x.gt);
    let best = {lv:null, h:prev.h, d:bandDist(prev.rate, band), gt:prev.greedyT};
    for (const c of pool.slice(0, 6)){
      const full = evaluate(c.lv, 200); if (!full.ok) continue;
      const d = bandDist(full.rate, band), gt = full.greedy.t;
      // in band beats out of band; out of band, 2 points nearer counts (less is noise in 200 games), else the longer game
      const better = best.d === 0 ? d === 0 && gt > best.gt + 0.5 : d === 0 || d < best.d - 0.02 || (d <= best.d + 0.02 && gt > best.gt + 0.5);
      if (better) best = {lv:c.lv, h:c.h, d, gt, full};
    }
    if (!best.lv){ log(`${id(spec.n)} refine: kept (random ${(prev.rate*100).toFixed(1)}%, greedy ${prev.greedyT}s; ${pool.length} candidates, ${((Date.now() - t0)/1000).toFixed(0)}s)`); return prev; }
    return finish(spec, b, best.lv, best.h, best.full, t0, tries, 'refined');
  }
  function finish(spec, b, lv, h, full, t0, tries, tag){
    const band = BANDS[spec.diff], early = spec.n <= 5;
    const ff = early ? failFree(lv) : null;
    fs.writeFileSync(path.join(OUT, id(spec.n) + '.json'), fmt(lv) + '\n');
    const ck = C.checkLevel(JSON.parse(JSON.stringify(lv))), N = C.normalizeLevel(JSON.parse(JSON.stringify(lv)));
    const res = {id:id(spec.n), n:spec.n, role:spec.role, diff:spec.diff, band, h:+h.toFixed(3), rate:full.rate, wins:full.wins, runs:full.runs,
      inBand:full.rate >= band[0] && full.rate <= band[1], greedyT:+full.greedy.t.toFixed(1), greedySends:full.greedy.sends, notes:b.notes, failFree:ff,
      ramps:N.ramps.map(r => ({cols:r.columns.length, rows:r.rows, kind:shapeName(spec, r)})), colors:ck.perColor.filter(p => p.men).map(p => ({color:p.color, men:p.men})),
      buses:ck.sizes, nBuses:ck.buses, men:ck.totalMen, road:spec.road, rampIdea:spec.rampIdea,
      blockers:blockerText(lv), tutorial:spec.tutorial || null, popup:spec.popup || null, hint:spec.hint || null, roadLen:+C.buildLayout(JSON.parse(JSON.stringify(lv))).ROAD.portalS.toFixed(1)};
    log(`${res.id} ${spec.role.padEnd(28)} diff ${spec.diff} band ${band.map(v => Math.round(v*100)).join('-')}%  random ${(full.rate*100).toFixed(1)}% ${res.inBand ? 'IN' : 'OUT'}  h ${res.h}  greedy ${res.greedyT}s ${res.greedySends} sends  ${ff ? 'fail-free ' + ff : ''} ${b.notes.length ? '[' + b.notes.join('; ') + ']' : ''} (${((Date.now() - t0)/1000).toFixed(0)}s, ${tries} tries${tag ? ', ' + tag : ''})`);
    return res;
  }
  /* levels 1-5: no fail possible. Proof by play: 1000 random games and an adversarial bot that always sends the bus
     with the fewest matching stickmen at the fronts (several think speeds) - none may lose */
  function failFree(lv){
    let fails = 0, games = 0;
    for (let r = 0; r < 1000; r++){ games++; if (C.simulate(lv, C.randomPick, C.mulberry32(5000 + r), C.SIM_DT).result !== 'win') fails++; }
    const worst = g => { const acts = C.legalSends(g); if (!acts.length) return null; const fc = C.frontColors(g);
      return acts.reduce((a, x) => (fc[g.buses[x.bus].color] < fc[g.buses[a.bus].color] ? x : a)); };
    for (let k = 0; k < 6; k++){ games++; const rng = C.mulberry32(77 + k); const pol = (g) => rng() < 0.3 + k*0.1 ? worst(g) : C.randomPick(g, rng);
      if (C.simulate(lv, pol, null, C.SIM_DT).result !== 'win') fails++; }
    return fails ? `NO (${fails} losses in ${games} games)` : `yes (${games} games, no loss)`;
  }
  function meta(spec){
    const m = {role:spec.role, diff:spec.diff, road:spec.road, ramps:spec.rampIdea};
    if (spec.tutorial) m.tutorial = spec.tutorial; if (spec.popup) m.popup = spec.popup; if (spec.hint) m.hint = spec.hint;
    if (spec.tutorialLane != null) m.tutorialLane = spec.tutorialLane;      // the lane whose front bus the tutorial's hand points at first
    return m;
  }
  function shapeName(spec, r){ return r.spread > 0 ? 'fan' : r.spread < 0 ? 'wedge' : r.tilt != null ? 'diagonal (35 deg)' : (r.shape && r.shape.length > 2 ? 'curved' : 'straight'); }
  function blockerText(lv){
    const out = [], lanes = lv.lanes.flat(), hid = lanes.filter(b => b.hidden).length, groups = {};
    lanes.forEach(b => { if (b.link) groups[b.link] = (groups[b.link] || 0) + 1; });
    if (hid) out.push(`${hid} hidden bus${hid > 1 ? 'es' : ''}`);
    const g2 = Object.values(groups).filter(v => v === 2).length, g3 = Object.values(groups).filter(v => v === 3).length;
    if (g2) out.push(`${g2} connected pair${g2 > 1 ? 's' : ''}`); if (g3) out.push(`${g3} connected triple${g3 > 1 ? 's' : ''}`);
    const tun = lv.ramps.flatMap(r => r.tunnels || []), box = lv.ramps.flatMap(r => r.boxes || []);
    if (tun.length) out.push(tun.map(t => `tunnel (${t.color}, ${t.count})`).join(', '));
    if (box.length) out.push(`lock & key`);
    return out.join(', ') || '-';
  }
  /* level 1: one ramp, the front two rows red, the back two blue; the red bus first (the tutorial points at it) */
  function tutorial1(base){
    const lv = JSON.parse(JSON.stringify(base)), r = lv.ramps[0];
    r.columns = r.columns.map(col => col.map((_, i) => i < 2 ? 'red' : 'blue'));
    lv.lanes = [[{color:'blue', cap:8}], [], [{color:'red', cap:8}]];
    return {level:lv};
  }
  /* level 3: the first bus (red) can take only the 4 red stickmen at the front of the first ramp - the other 4 wait at
     the back of the second ramp - so it comes back and parks; once blue and yellow buses have cleared the second
     ramp, the reds are at its front and the parked red bus can be sent again */
  function tutorial3(base){
    const lv = JSON.parse(JSON.stringify(base)), L = C.buildLayout(JSON.parse(JSON.stringify(lv)));
    const [first, second] = L.RAMPS.map(r => lv.ramps[r.src]);
    const by = ['blue', 'yellow', 'blue', 'yellow', 'yellow', 'blue', 'blue', 'yellow', 'yellow', 'blue', 'blue', 'yellow', 'blue', 'yellow', 'yellow', 'blue'];
    let k = 0;
    first.columns = first.columns.map((col, c) => col.map((_, i) => i === 0 ? (c < 4 ? 'red' : 'blue') : by[k++ % by.length]));
    k = 3; second.columns = second.columns.map((col, c) => col.map((_, i) => i === 3 ? (c < 4 ? 'red' : 'yellow') : by[k++ % by.length]));
    // balance blue / yellow to 16 each by recolouring a few back cells if needed
    const cnt = x => lv.ramps.flat().length && lv.ramps.reduce((a, r) => a + r.columns.flat().filter(v => v === x).length, 0);
    for (const r of [first, second]) for (const col of r.columns) for (let i = 1; i < col.length; i++){
      if (cnt('blue') > 16 && col[i] === 'blue') col[i] = 'yellow'; else if (cnt('yellow') > 16 && col[i] === 'yellow') col[i] = 'blue'; }
    lv.lanes = [[{color:'blue', cap:8}, {color:'yellow', cap:8}], [{color:'red', cap:8}, {color:'blue', cap:8}], [{color:'yellow', cap:8}]];
    return {level:lv};
  }
}
