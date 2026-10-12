// Builds the showcase levels from tools/showcase/specs.js: levels/showcase/<id>.json and levels/showcase/showcase-order.json
// (the menu's categories and the order of the cards).
//   node tools/make-showcase.js              every level, 3 in parallel
//   node tools/make-showcase.js road-zigzag  only these (the others stay as saved)
// Per level: the road (a turtle path, tools/funnel/geometry.js), the ramps placed along it (G.place: inside the target
// zone, clear of the road, the spirals, the exit tunnel and each other, front edges flush on the road), then the content:
//  - "from": a demo level's ramps (stickmen, tunnels, boxes) and buses are kept as they are;
//  - otherwise new content (tools/funnel/content.js) at a hardness h, searched until the random bot's win rate gives the
//    target label (Easy > 45%, Medium 15-45%, Hard 5-15%, Very Hard < 5%) and the greedy bot wins.
// Every level must be balanced, free of warnings and won by the greedy bot.
const fs = require('fs'), path = require('path'), {fork} = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'levels', 'showcase');
const {ROADS, SPIRAL_ROADS, SPECS} = require('./showcase/specs.js');
const LABEL_BAND = {'Easy':[0.46, 1], 'Medium':[0.15, 0.45], 'Hard':[0.05, 0.149], 'Very Hard':[0, 0.049]};

if (process.env.SHOWCASE_WORKER){ worker(); return; }
const want = process.argv.slice(2), todo = SPECS.filter(s => !want.length || want.includes(s.id)).map(s => s.id);
fs.mkdirSync(OUT, {recursive:true});
const t0 = Date.now(); let running = 0, failed = [];
const next = () => {
  if (!todo.length){ if (!running) done(); return; }
  const id = todo.shift(); running++;
  const w = fork(__filename, [], {env:Object.assign({}, process.env, {SHOWCASE_WORKER:'1'})});
  w.on('message', m => { if (m.log) console.log(m.log); if (m.fail) failed.push(id); });
  w.on('exit', () => { running--; next(); });
  w.send({id});
};
for (let k = 0; k < (+process.env.SHOWCASE_JOBS || 3); k++) next();
function done(){
  const cats = [];
  for (const s of SPECS){ let c = cats.find(x => x.name === s.cat); if (!c) cats.push(c = {name:s.cat, groups:[]});
    let g = c.groups.find(x => x.name === (s.group || null)); if (!g) c.groups.push(g = {name:s.group || null, levels:[]}); g.levels.push(s.id); }
  fs.writeFileSync(path.join(OUT, 'showcase-order.json'), JSON.stringify({type:'match-express-showcase', version:1, categories:cats}, null, 2) + '\n');
  console.log(`\n${failed.length ? 'FAILED: ' + failed.join(', ') : 'all levels made'} in ${((Date.now() - t0)/1000).toFixed(0)} s`);
  if (failed.length) process.exitCode = 1;
}

function worker(){
  const G = require('./funnel/geometry.js'), CT = require('./funnel/content.js'), C = G.C, fmt = require('./level-format.js');
  const clone = o => JSON.parse(JSON.stringify(o)), log = s => process.send({log:s});
  process.on('message', m => { const spec = SPECS.find(s => s.id === m.id); let ok = false;
    try { ok = make(spec); } catch (e){ log(`${spec.id}: ${e.stack}`); }
    if (!ok) process.send({fail:true}); process.exit(0); });

  const C_ = C, PRESETS = C_.PRESETS;
  function warnings(lv){ return C.checkLevel(clone(lv)).warnings; }
  function evaluate(lv, runs){
    const g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    if (g.result !== 'win' || g.cheerMiss) return {greedy:g, ok:false};
    let wins = 0, fb = g.keyFallbacks ? 1 : 0;
    for (let r = 0; r < runs; r++){ const s = C.simulate(clone(lv), C.randomPick, C.mulberry32(1000 + r), C.SIM_DT, Math.max(600, 3*g.t)); if (s.result === 'win') wins++; if (s.keyFallbacks) fb++; }
    return {greedy:g, ok:!fb, rate:wins/runs, wins, runs};
  }
  // the road and the ramps' places: the spec's requests, or one request per ramp of the demo level (same size)
  function geometry(spec, seed){
    const road = G.road({T:ROADS[spec.road]}), lanes = Array.from({length:spec.lanes || 3}, () => []);
    const lv = {format:2, id:spec.id, name:spec.name, road, ramps:[], lanes};
    if ((spec.lanes || 3) !== 3) lv.laneCount = spec.lanes;
    let req = spec.ramps;
    if (spec.from){ const D = PRESETS[spec.from], n = D.ramps.length;
      req = D.ramps.map((r, k) => ({c:r.columns.length, r:r.rows || r.columns[0].length, kind:spec.kind || 'perp', a:spec.kind === 'diag' ? 12*(k % 2 ? -1 : 1) : 0,
        side:k % 2 ? 1 : -1, f:(k + 0.6)/(n + 0.2)})); }
    // a little jitter between attempts (the first is the spec as written)
    const rnd = C.mulberry32(seed*7919 + 17);
    const reqs = req.map(q => Object.assign({}, q, seed ? {f:Math.min(0.95, Math.max(0.05, q.f + (rnd() - 0.5)*0.12))} : {}));
    const notes = G.place({ramps:reqs}, lv);
    if (notes.some(x => /NO PLACE/.test(x))) return null;
    return lv;
  }
  function withDemoContent(spec, lv){
    const D = clone(PRESETS[spec.from]), out = clone(lv);
    out.ramps = out.ramps.map((r, k) => { const d = D.ramps[k], o = Object.assign({}, r);
      o.columns = d.columns; o.rows = d.rows || d.columns[0].length; if (d.tunnels) o.tunnels = d.tunnels; if (d.boxes) o.boxes = d.boxes; return o; });
    out.lanes = D.lanes; if (D.laneCount) out.laneCount = D.laneCount; else delete out.laneCount;
    return out;
  }
  function contentSpec(spec, men){
    return {n:99, role:'Practice', diff:spec.target === 'Very Hard' ? 8 : spec.target === 'Hard' ? 7 : 5, colors:spec.colors, men, sizes:spec.sizes,
      lanes:spec.lanes || 3, blockers:spec.blockers || null, trapMax:spec.trapMax || 4};
  }
  function make(spec){
    const t0 = Date.now(), target = spec.target || 'Medium', band = LABEL_BAND[target];
    // demo content keeps its stickmen and buses: if no placement on the spec's road lets the greedy bot win, other roads
    // (a spiral road falls back on the other spiral roads only)
    const others = SPIRAL_ROADS.includes(spec.road) ? SPIRAL_ROADS : ['gentle', 'scurve', 'zigzag', 'hairpin', 'winding'];
    const roads = spec.from ? [spec.road].concat(others.filter(r => r !== spec.road)) : [spec.road];
    for (let gs = 0; gs < 8*roads.length; gs++){
      const geo = geometry(Object.assign({}, spec, {road:roads[Math.floor(gs/8)]}), gs % 8); if (!geo){ log(`${spec.id}: geometry attempt ${gs + 1}: a ramp found no place`); continue; }
      const w0 = warnings(Object.assign(clone(geo), {lanes:[[{color:'red', cap:4}], [], []]})).filter(w => /^(road|zone|ramp|exit)-/.test(w.kind));
      if (w0.length){ log(`${spec.id}: geometry attempt ${gs + 1}: ${w0.map(w => w.kind).join(',')}`); continue; }
      if (spec.from){
        const lv = withDemoContent(spec, geo); lv.meta = meta(spec, null, roads[Math.floor(gs/8)]);
        const ck = C.checkLevel(clone(lv)); if (!ck.balanced || ck.warnings.length){ log(`${spec.id}: ${ck.warnings.map(w => w.kind).join(',')}`); continue; }
        const e = evaluate(lv, 100); if (!e.ok){ log(`${spec.id}: geometry attempt ${gs + 1}: greedy ${e.greedy.result}`); continue; }
        return save(spec, lv, e, t0, 'demo content');
      }
      // new content: search h (and seeds) for the target label
      const men = geo.ramps.reduce((a, r) => a + r.columns.length*r.columns[0].length, 0), cs = contentSpec(spec, men);
      let lo = 0, hi = 1, h = target === 'Easy' ? 0.15 : target === 'Medium' ? 0.4 : target === 'Hard' ? 0.65 : 0.85, best = null;
      for (let it = 0; it < 14; it++){
        let ev = null, lv = null;
        for (let seed = 1; seed <= 10 && !ev; seed++){
          const rng = C.mulberry32(seed*7919 + it*104729 + gs*31);
          const gen = CT.generate(cs, geo, h, rng); if (!gen) continue;
          if (!CT.queueBlockers(cs, gen, rng, 1)) continue;
          if (cs.blockers && cs.blockers.lock && !CT.lockBox(cs, gen, rng)) continue;
          lv = CT.strip(gen.level); const ck = C.checkLevel(clone(lv)); if (!ck.balanced || ck.warnings.length) continue;
          const e = evaluate(lv, 60); if (e.ok) ev = e;
        }
        if (!ev){ hi = h; h = (lo + h)/2; if (hi - lo < 0.02) break; continue; }
        const d = ev.rate < band[0] ? band[0] - ev.rate : ev.rate > band[1] ? ev.rate - band[1] : 0;
        if (d === 0){ const full = evaluate(lv, 200), d2 = full.rate < band[0] ? band[0] - full.rate : full.rate > band[1] ? full.rate - band[1] : 0;
          if (full.ok && (!best || d2 < best.d)) best = {lv, e:full, d:d2, h};
          if (full.ok && d2 === 0) break; }
        else if (!best || d < best.d) best = {lv, e:ev, d, h};
        if (ev.rate > band[1]){ lo = h; h = (h + hi)/2; } else { hi = h; h = (lo + h)/2; }
        if (hi - lo < 0.01) break;
      }
      if (best){ best.lv.meta = meta(spec, best.h); const e = best.e.runs === 200 ? best.e : evaluate(best.lv, 200); return save(spec, best.lv, e, t0, 'h ' + best.h.toFixed(2)); }
      log(`${spec.id}: geometry attempt ${gs + 1}: no playable content`);
    }
    log(`${spec.id}: FAILED`); return false;
  }
  function meta(spec, h, road){ const m = {category:spec.cat, title:spec.name}; if (spec.group) m.group = spec.group; m.road = road || spec.road; if (h != null) m.h = +h.toFixed(3); return m; }
  function save(spec, lv, e, t0, tag){
    lv.meta.difficulty = C.difficulty(e.rate); lv.meta.random = +e.rate.toFixed(3); lv.meta.greedyT = +e.greedy.t.toFixed(1);
    const out = {format:2, id:spec.id, name:spec.name}; Object.assign(out, lv, {id:spec.id, name:spec.name});
    fs.writeFileSync(path.join(OUT, spec.id + '.json'), fmt(out) + '\n');
    const want = spec.target ? ` (target ${spec.target})` : '';
    log(`${spec.id.padEnd(24)} ${lv.meta.difficulty.padEnd(9)}${want.padEnd(20)} random ${(e.rate*100).toFixed(1).padStart(5)}%  greedy ${e.greedy.t.toFixed(0)} s  ${tag}  ${((Date.now() - t0)/1000).toFixed(0)} s`);
    return true;
  }
}
