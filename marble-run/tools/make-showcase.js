// Builds the showcase levels from tools/showcase/specs.js: levels/showcase/<category>/<id>.json and
// levels/showcase/showcase-order.json (the menu's categories and the order of the cards).
//   node tools/make-showcase.js              every level, SHOWCASE_JOBS (default 3) in parallel
//   node tools/make-showcase.js slide-zigzag only these (the others stay as saved)
// Per level: the slide (tools/funnel/geometry.js), its gaps and toy pieces on clean stretches, the trays placed along it
// (G.place: inside the slide zone, clear of the slide, the spirals, the sorter, the start tower, the gaps, the toys and
// each other), then the content:
//  - "from": a demo level's trays (marbles, dispensers, crates) and boxes are kept as they are;
//  - otherwise new content (tools/funnel/content.js) at a hardness h, searched until the random bot's win rate gives the
//    target label (Easy > 45%, Medium 15-45%, Hard 5-15%, Very Hard < 5%) and the greedy bot wins.
// Every level must be balanced, free of warnings and won by the greedy bot.
const fs = require('fs'), path = require('path'), {fork} = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'levels', 'showcase');
const {SLIDES, SPECS} = require('./showcase/specs.js');
const LABEL_BAND = {'Easy':[0.46, 1], 'Medium':[0.15, 0.45], 'Hard':[0.05, 0.149], 'Very Hard':[0, 0.049]};
const catDir = cat => cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');

if (process.env.SHOWCASE_WORKER){ worker(); return; }
const want = process.argv.slice(2), todo = SPECS.filter(s => !want.length || want.includes(s.id)).map(s => s.id);
fs.mkdirSync(OUT, {recursive:true});
const t0 = Date.now(); let running = 0; const failed = [];
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
  for (const s of SPECS){ let c = cats.find(x => x.name === s.cat); if (!c) cats.push(c = {name:s.cat, dir:catDir(s.cat), groups:[]});
    let g = c.groups.find(x => x.name === (s.group || null)); if (!g) c.groups.push(g = {name:s.group || null, levels:[]}); g.levels.push(s.id); }
  fs.writeFileSync(path.join(OUT, 'showcase-order.json'), JSON.stringify({type:'marble-run-showcase', version:1, categories:cats}, null, 2) + '\n');
  console.log(`\n${failed.length ? 'FAILED: ' + failed.join(', ') : 'all levels made'} in ${((Date.now() - t0)/1000).toFixed(0)} s`);
  if (failed.length) process.exitCode = 1;
}

function worker(){
  const G = require('./funnel/geometry.js'), CT = require('./funnel/content.js'), C = G.C, fmt = require('./level-format.js');
  const clone = o => JSON.parse(JSON.stringify(o)), log = s => process.send({log:s});
  process.on('message', m => { const spec = SPECS.find(s => s.id === m.id); let ok = false;
    try { ok = make(spec); } catch (e){ log(`${spec.id}: ${e.stack}`); }
    if (!ok) process.send({fail:true}); process.exit(0); });

  const warnings = lv => C.checkLevel(clone(lv)).warnings;
  const idHash = t => [...t].reduce((a, ch) => (a*31 + ch.charCodeAt(0)) % 1000003, 7);
  const GEO = /^(slide|zone|tray|gap|toy)-/;
  function evaluate(lv, runs){
    const g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    if (g.result !== 'win') return {greedy:g, ok:false};
    let wins = 0;
    for (let r = 0; r < runs; r++) if (C.simulate(clone(lv), C.randomPick, C.mulberry32(1000 + r), C.SIM_DT).result === 'win') wins++;
    return {greedy:g, ok:true, rate:wins/runs, wins, runs};
  }
  function slidePoints(name){ const S = SLIDES[name];
    const raw = S.T ? G.turtle(S.T, S.start).concat(S.end || []) : S.R;
    return G.slide({R:raw}); }
  // gaps and toy pieces, one after the other, on a level without trays: every clean spot (no warning at all, with the
  // ones already placed), then the middle of the clean stretch nearest to the spec's spot
  function addAlong(spec, lv, key){
    const S = C.buildLayout(clone(lv)).SLIDE.tailS; lv.slide[key] = [];
    for (const q of spec[key]){ const ok = [], len = key === 'gaps' ? q.len : C.TOY_KINDS[q.kind];
      for (let at = 1.5; at < S - 1.5; at += 0.1){ const t = clone(lv), it = key === 'gaps' ? {at:+at.toFixed(2), len, ramp:q.ramp} : {kind:q.kind, at:+at.toFixed(2), len};
        t.slide[key].push(it); if (!warnings(t).some(w => GEO.test(w.kind))) ok.push(at); }
      const runs = []; let run = [];
      ok.forEach((a, i) => { if (i && a - ok[i - 1] > 0.15){ runs.push(run); run = []; } run.push(a); }); if (run.length) runs.push(run);
      const best = runs.filter(r => r[r.length - 1] - r[0] >= 0.6).map(r => (r[0] + r[r.length - 1])/2).sort((a, b) => Math.abs(a - q.near*S) - Math.abs(b - q.near*S))[0];
      if (best == null){ log(`${spec.id}: no clean spot for ${key === 'gaps' ? 'a gap' : 'a ' + q.kind}`); return false; }
      lv.slide[key].push(key === 'gaps' ? {at:+best.toFixed(2), len, ramp:q.ramp} : {kind:q.kind, at:+best.toFixed(2), len}); lv.slide[key].sort((a, b) => a.at - b.at); }
    return true;
  }
  // the slide, its gaps and toys, and the trays' places: the spec's requests, or one request per tray of the demo level
  function geometry(spec, seed){
    const lanes = Array.from({length:spec.lanes || 3}, () => []);
    const lv = {format:1, type:'marble-run-level', id:spec.id, name:spec.name, slide:slidePoints(spec.slide), trays:[], lanes};
    if ((spec.lanes || 3) !== 3) lv.laneCount = spec.lanes;
    if (spec.gaps && !addAlong(spec, lv, 'gaps')) return null;
    if (spec.toys && !addAlong(spec, lv, 'toys')) return null;
    let req = spec.trays;
    if (spec.from){ const D = C.PRESETS[spec.from], n = D.trays.length;
      req = D.trays.map((r, k) => ({c:r.columns.length, r:r.rows || r.columns[0].length, kind:'tilt', side:k % 2 ? 1 : -1, f:(k + 0.6)/(n + 0.2)})); }
    // a little jitter between attempts (the first is the spec as written)
    const rnd = C.mulberry32(seed*7919 + 17);
    const reqs = req.map(q => Object.assign({}, q, seed ? {f:Math.min(0.95, Math.max(0.05, q.f + (rnd() - 0.5)*0.16))} : {}));
    const notes = G.place({trays:reqs}, lv);
    // (a tray that does not fit may be built with the same cells in another shape, except where the shape is the point)
    if (notes.some(x => /NO PLACE/.test(x) || (spec.group === 'Tray shapes' && /did not fit, built as \d+x/.test(x)))) return null;
    return lv;
  }
  function withDemoContent(spec, lv){
    const D = clone(C.PRESETS[spec.from]), out = clone(lv);
    out.trays = out.trays.map((r, k) => { const d = D.trays[k], o = Object.assign({}, r);
      o.columns = d.columns; o.rows = d.rows || d.columns[0].length; delete o.dispensers; delete o.crates;
      if (d.dispensers) o.dispensers = d.dispensers; if (d.crates) o.crates = d.crates; return o; });
    out.lanes = D.lanes; if (D.laneCount && D.laneCount !== 3) out.laneCount = D.laneCount; else delete out.laneCount;
    return out;
  }
  function contentSpec(spec){
    return {n:99, role:'Practice', diff:spec.target === 'Very Hard' ? 8 : spec.target === 'Hard' ? 7 : 5, colors:spec.colors, sizes:spec.sizes,
      lanes:spec.lanes || 3, blockers:spec.blockers || null, trapMax:spec.trapMax || 10};
  }
  function make(spec){
    const t0 = Date.now(), target = spec.target || 'Medium', band = LABEL_BAND[target];
    for (let gs = 0; gs < 10; gs++){
      const geo = geometry(spec, gs); if (!geo){ log(`${spec.id}: geometry attempt ${gs + 1}: a tray found no place`); continue; }
      const w0 = warnings(geo).filter(w => GEO.test(w.kind));
      if (w0.length){ log(`${spec.id}: geometry attempt ${gs + 1}: ${w0.map(w => w.kind).join(',')}`); continue; }
      if (spec.from){
        const lv = withDemoContent(spec, geo); lv.meta = meta(spec, null);
        const ck = C.checkLevel(clone(lv)); if (!ck.balanced || ck.warnings.length){ log(`${spec.id}: geometry attempt ${gs + 1}: ${ck.warnings.map(w => w.kind).join(',')}`); continue; }
        const e = evaluate(lv, 100); if (!e.ok){ log(`${spec.id}: geometry attempt ${gs + 1}: greedy ${e.greedy.result}`); continue; }
        return save(spec, lv, evaluate(lv, 200), t0, 'demo content');
      }
      // new content: a few hardness steps from the target's usual one, several seeds each (the random bot's rate varies a
      // lot from seed to seed at the same h); a quick 40-game screen, then 200 games for one inside the band
      const cs = contentSpec(spec), dist = r => r < band[0] ? band[0] - r : r > band[1] ? r - band[1] : 0;
      const HS = {'Easy':[0.15, 0.3, 0.45, 0.6], 'Medium':[0.85, 0.95, 1.0, 1.05, 0.7, 1.1], 'Hard':[1.0, 1.05, 0.95, 1.1, 0.9], 'Very Hard':[1.05, 1.1, 1.0, 1.15]}[target];
      let best = null;
      search: for (const h of HS) for (let seed = 1; seed <= 8; seed++){
        const rng = C.mulberry32(seed*7919 + Math.round(h*1000)*104729 + gs*31 + idHash(spec.id));      // (each level its own content)
        const gen = CT.generate(cs, geo, h, rng); if (!gen) continue;
        if (!CT.queueBlockers(cs, gen, rng, 1)) continue;
        if (cs.blockers && cs.blockers.lock && !CT.lockCrate(cs, gen, rng)) continue;
        if (cs.blockers && cs.blockers.count && !CT.countCrate(cs, gen, rng)) continue;
        const lv = CT.strip(gen.level), ck = C.checkLevel(clone(lv)); if (!ck.balanced || ck.warnings.length) continue;
        const e = evaluate(lv, 40); if (!e.ok) continue;
        if (best && dist(e.rate) > best.d + 0.12) continue;
        const full = evaluate(lv, 200), d = dist(full.rate);
        if (full.ok && (!best || d < best.d)) best = {lv, e:full, d, h};
        if (best && best.d === 0) break search;
      }
      if (best){ best.lv.meta = meta(spec, best.h); return save(spec, best.lv, best.e, t0, 'h ' + best.h.toFixed(2) + (best.d ? ' (closest)' : '')); }
      log(`${spec.id}: geometry attempt ${gs + 1}: no playable content`);
    }
    log(`${spec.id}: FAILED`); return false;
  }
  function meta(spec, h){ const m = {category:spec.cat, title:spec.name}; if (spec.group) m.group = spec.group; m.slide = spec.slide; if (h != null) m.h = +h.toFixed(3); return m; }
  function save(spec, lv, e, t0, tag){
    lv.meta.difficulty = C.difficulty(e.rate); lv.meta.random = +e.rate.toFixed(3); lv.meta.greedyT = +e.greedy.t.toFixed(1);
    const out = {format:1, type:'marble-run-level', id:spec.id, name:spec.name}; Object.assign(out, lv, {id:spec.id, name:spec.name});
    { const ms = C.autoMarbleScale(clone(out)); if (ms > 1) out.marbleScale = ms; else delete out.marbleScale; }   // marbles as large as it has room for
    const dir = path.join(OUT, catDir(spec.cat)); fs.mkdirSync(dir, {recursive:true});
    fs.writeFileSync(path.join(dir, spec.id + '.json'), fmt(out) + '\n');
    const want = spec.target ? ` (target ${spec.target})` : '';
    log(`${spec.id.padEnd(22)} ${lv.meta.difficulty.padEnd(9)}${want.padEnd(20)} random ${(e.rate*100).toFixed(1).padStart(5)}%  greedy ${e.greedy.t.toFixed(0)} s  ${tag}  ${((Date.now() - t0)/1000).toFixed(0)} s`);
    return true;
  }
}
