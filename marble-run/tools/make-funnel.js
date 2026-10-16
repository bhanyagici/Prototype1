// Builds the 40-level funnel: levels/funnel/f01.json ... f40.json, levels/funnel/funnel-order.json and
// levels/funnel/funnel-report.json (the measured data behind the spreadsheet and the report).
//   node tools/make-funnel.js            all levels, FUNNEL_JOBS (default 3) in parallel
//   node tools/make-funnel.js 7 13 26    only these (the others' results are kept in the report)
//   node tools/make-funnel.js --refine [ids]   a second pass from the saved levels: more (h, seed, group count)
//                                        candidates; one replaces the saved level only when it is nearer the band, or as
//                                        near with a longer greedy game.  FUNNEL_PASS=2, 3... draw other candidates
//   node tools/make-funnel.js --measure [ids]  the saved levels unchanged: their meta from the specs, 200 games again
// Per level: the slide and the trays (tools/funnel/geometry.js; a saved level keeps its own), then content at a
// hardness h (tools/funnel/content.js).  The search: many (h, seed, group count) candidates with a quick 50-game estimate
// of the random bot's win rate, the nearest to the band checked with 200 games, the greedy bot winning.  Challenge,
// Practice, Milestone and Finale levels must land in their band; the others may be easier than it.  Levels 1-5 must
// not be losable: their content is built so (tools/funnel/content.js) and proved by play (failFree).
const fs = require('fs'), path = require('path'), {fork} = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'levels', 'funnel');
const SPECS = require('./funnel/specs.js');
const BANDS = {1:[0.70, 1], 2:[0.70, 1], 3:[0.55, 0.75], 4:[0.45, 0.60], 5:[0.35, 0.50], 6:[0.25, 0.40], 7:[0.18, 0.30], 8:[0.12, 0.22], 9:[0.08, 0.15]};
const id = n => 'f' + String(n).padStart(2, '0');
const MUST = role => /^(Challenge|Milestone|Finale|Practice)/.test(role);
// how many marbles the generator may bury behind other colours (its trapMax), by target difficulty: the main lever
const TRAPS = {1:0, 2:0, 3:4, 4:5, 5:8, 6:10, 7:12, 8:13, 9:14};

if (process.env.FUNNEL_WORKER){ worker(); return; }
const REFINE = process.argv.includes('--refine'), MEASURE = process.argv.includes('--measure');
const want = process.argv.slice(2).map(Number).filter(Boolean);
const todo = SPECS.filter(s => (!want.length || want.includes(s.n)) && !(REFINE && s.n <= 5)).map(s => s.n);
fs.mkdirSync(OUT, {recursive:true});
const reportFile = path.join(OUT, 'funnel-report.json');
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : {levels:{}};
let running = 0; const queue = todo.slice(), t0 = Date.now(), JOBS = +process.env.FUNNEL_JOBS || 3;
const next = () => {
  while (running < JOBS && queue.length){
    const n = queue.shift(); running++;
    const w = fork(__filename, [], {env:Object.assign({}, process.env, {FUNNEL_WORKER:'1'})});
    w.send({n, refine:REFINE, measure:MEASURE, prev:report.levels[id(n)] || null});
    w.on('message', m => { if (m.log) console.log(m.log); if (m.result){ report.levels[id(n)] = m.result; save(); } });
    w.on('exit', () => { running--; if (!queue.length && !running) finish(); else next(); });
  }
};
next();
function save(){
  const ids = SPECS.map(s => id(s.n)).filter(i => report.levels[i]);
  report.generated = new Date().toISOString().slice(0, 10);
  report.totalGreedy1x = +ids.reduce((a, i) => a + report.levels[i].greedyT, 0).toFixed(1);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 1) + '\n');
}
function finish(){
  save();
  fs.writeFileSync(path.join(OUT, 'funnel-order.json'), JSON.stringify({type:'marble-run-level-order', version:1, levels:SPECS.map(s => id(s.n))}, null, 2) + '\n');
  const L = Object.values(report.levels), must = L.filter(r => MUST(r.role)), inB = must.filter(r => r.inBand);
  console.log(`\n${L.length} levels in the report; greedy total ${(report.totalGreedy1x/60).toFixed(1)} min at 1x, ${(report.totalGreedy1x/120).toFixed(1)} min at 2x;` +
    ` must-land levels in their band: ${inB.length}/${must.length}; ${((Date.now() - t0)/60000).toFixed(1)} min`);
}

/* ------------------------------------------------------------------ worker ------------------------------------------ */
function worker(){
  const G = require('./funnel/geometry.js'), CT = require('./funnel/content.js'), C = G.C, fmt = require('./level-format.js');
  const {SLIDES} = require('./showcase/specs.js');
  const clone = o => JSON.parse(JSON.stringify(o)), log = s => process.send({log:s});
  let PREV = null;
  process.on('message', m => { const spec = SPECS.find(s => s.n === m.n); PREV = m.prev;
    let result = null;
    try { result = m.measure ? measureLevel(spec) : m.refine ? searchLevel(spec, true) : spec.n === 1 || spec.n === 3 ? tutorialLevel(spec) : searchLevel(spec, false); }
    catch (e){ log(`${id(spec.n)}: ${e.stack}`); }
    process.send({result}); process.exit(0); });

  const lanesOf = spec => Array.from({length:spec.lanes || 3}, () => []);
  function slideOf(spec){
    if (spec.slide && spec.slide.design){ const d = G.designSlide(Object.assign({pool:6}, spec.slide.design)); if (!d) throw new Error('no slide designed'); return d.slide; }
    const S = SLIDES[spec.slide]; return G.slide({R:S.T ? G.turtle(S.T, S.start).concat(S.end || []) : S.R});
  }
  /* the slide and the trays: a saved level keeps its own exactly (only its content is made again) */
  function base(spec){
    const file = path.join(OUT, id(spec.n) + '.json');
    if (fs.existsSync(file)){
      const old = JSON.parse(fs.readFileSync(file, 'utf8'));
      const trays = old.trays.map(r => { const o = Object.assign({}, r); o.columns = r.columns.map(c => c.map(() => null)); delete o.dispensers; delete o.crates; return o; });
      const lv = {format:1, type:'marble-run-level', id:old.id, name:old.name, slide:old.slide, trays, lanes:lanesOf(spec)};
      if (old.marbleScale && old.marbleScale < 1) lv.marbleScale = old.marbleScale;
      if ((spec.lanes || 3) !== 3) lv.laneCount = spec.lanes;
      return {lv, notes:(PREV && PREV.notes) || []};
    }
    // a designed meander: the next seeds until every tray finds a place beside it (the longest meanders fill the zone)
    const design = spec.slide && spec.slide.design;
    for (let k = 0; k < (design ? 16 : 1); k++){
      const sp = design ? Object.assign({}, spec, {slide:{design:Object.assign({}, design, {seed:design.seed + k*101})}}) : spec;
      const lv = {format:1, type:'marble-run-level', id:id(spec.n), name:'Level ' + spec.n, slide:slideOf(sp), trays:[], lanes:lanesOf(spec)};
      if (spec.K && spec.K < 1) lv.marbleScale = spec.K;
      if ((spec.lanes || 3) !== 3) lv.laneCount = spec.lanes;
      const notes = G.place(spec, lv);
      if (!design || !notes.some(x => /NO PLACE/.test(x)) || k === 15){ if (design && k) notes.push(`meander seed ${design.seed + k*101}`); return {lv, notes}; }
    }
  }
  function candidate(spec, b, h, seed, gk){
    const rng = C.mulberry32(seed*7919 + spec.n*104729);
    const gen = CT.generate(Object.assign({trapMax:TRAPS[spec.diff]}, spec), b.lv, h, rng); if (!gen) return null;
    if (!CT.queueBlockers(spec, gen, rng, gk)) return null;
    if (spec.blockers && spec.blockers.lock && !CT.lockCrate(spec, gen, rng)) return null;
    if (spec.blockers && spec.blockers.count && !CT.countCrate(spec, gen, rng)) return null;
    const lv = CT.strip(gen.level);
    lv.meta = meta(spec);
    const ck = C.checkLevel(clone(lv));
    if (!ck.balanced || ck.warnings.length) return null;
    // 4-5 box lanes with connected boxes: several groups, some of them across lanes (tests/lanes.test.js)
    if ((spec.lanes || 3) >= 4 && spec.blockers && spec.blockers.link){ const Gs = C.linkGroups(C.normalizeLevel(clone(lv)));
      if (Gs.length < 3 || Gs.filter(x => new Set(x.members.map(m => m.l)).size > 1).length < 2) return null; }
    return lv;
  }
  function evaluate(lv, runs){
    const g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    if (g.result !== 'win') return {greedy:g, ok:false};
    let wins = 0;
    for (let r = 0; r < runs; r++) if (C.simulate(clone(lv), C.randomPick, C.mulberry32(1000 + r), C.SIM_DT).result === 'win') wins++;
    return {greedy:g, ok:true, rate:wins/runs, wins, runs};
  }
  const bandDist = (r, band) => r < band[0] ? band[0] - r : r > band[1] ? r - band[1] : 0;
  /* candidates over hardness h, seeds and (with connected boxes) the number of groups; each gets a quick 50-game estimate;
     the nearest to the band (a longer greedy game breaks ties) get the 200-game check */
  function searchLevel(spec, refine){
    const t0 = Date.now(), b = base(spec), band = BANDS[spec.diff], must = MUST(spec.role), early = spec.n <= 5;
    if (b.notes.some(x => /NO PLACE/.test(x))){ log(`${id(spec.n)} geometry failed: ${b.notes.join('; ')}`); return PREV; }
    const pass = +(process.env.FUNNEL_PASS || 1) + (refine ? 1 : 0), saved = refine ? savedLevel(spec) : null;
    const link = spec.blockers && spec.blockers.link, rng = C.mulberry32(spec.n*977 + 13 + (pass - 1)*7919);
    const dist = r => early ? 0 : must ? bandDist(r, band) : (r < band[0] ? band[0] - r : 0);
    // the hardness range: easy levels low, the bands from 5 up reaching the top (h above 1 is the generator's hardest).
    // The random bot's rate varies a lot between seeds at one h, so the must-land levels first sample the whole range,
    // then search near the h of the best candidate so far
    const hLo = early ? 0.05 : must ? 0.5 : 0.1, hHi = early ? 0.5 : must ? (spec.diff >= 8 ? 1.16 : spec.diff >= 7 ? 1.12 : 1.08) : 0.75;
    const budget = early ? 12 : refine ? 110 : must ? 80 : 40, pool = []; let tries = 0, near = 0;
    for (let k = 0; k < budget && near < 6; k++){
      const top = must && k >= 20 && pool.length ? pool.reduce((x, y) => y.d < x.d || (y.d === x.d && y.gt > x.gt) ? y : x) : null;
      const h = top ? Math.max(hLo, Math.min(hHi, top.h + (rng() - 0.5)*0.24)) : hLo + (hHi - hLo)*rng(), gk = link ? [0.8, 1, 1.4, 1.9, 2.5][Math.floor(rng()*5)] : 1;
      const lv = candidate(spec, b, h, 2000 + k*13 + (pass - 1)*100003, gk); if (!lv) continue; tries++;
      const e = evaluate(lv, early ? 20 : 50); if (!e.ok) continue;
      const d = dist(e.rate); if (d === 0) near++;
      pool.push({lv, h, gk, q:e.rate, d, gt:e.greedy.t});
      if (early && pool.length >= 3) break;
    }
    if (!pool.length){ log(`${id(spec.n)} search: nothing playable`); return PREV; }
    pool.sort((x, y) => x.d - y.d || y.gt - x.gt);
    let best = null;
    for (const c of pool.slice(0, early ? 1 : 5)){
      const full = evaluate(c.lv, 200); if (!full.ok) continue;
      const d = dist(full.rate), gt = full.greedy.t;
      if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && gt > best.gt)) best = {lv:c.lv, h:c.h, gk:c.gk, d, gt, full};
    }
    if (saved){                                       // the saved level stays unless the new one is nearer the band
      const full = evaluate(saved, 200), d = dist(full.rate);
      if (full.ok && (!best || d < best.d - 0.02 || (Math.abs(d - best.d) <= 0.02 && full.greedy.t >= best.gt)))
        return finish(spec, b, saved, PREV ? PREV.h : 0, full, t0, tries, `refine pass ${pass}: saved level kept, ${pool.length} candidates`);
    }
    if (!best){ log(`${id(spec.n)} search: no candidate passed the full check`); return PREV; }
    return finish(spec, b, best.lv, best.h, best.full, t0, tries, `${refine ? 'refine pass ' + pass : 'search'}, groups x${best.gk}, ${pool.length} candidates`);
  }
  function savedLevel(spec){
    const file = path.join(OUT, id(spec.n) + '.json'); if (!fs.existsSync(file)) return null;
    const lv = JSON.parse(fs.readFileSync(file, 'utf8')); lv.meta = Object.assign({}, lv.meta, meta(spec));
    if ((spec.lanes || 3) !== 3) lv.laneCount = spec.lanes; else delete lv.laneCount;
    return lv;
  }
  /* the saved level unchanged (its meta from the spec): 200 games again for the report */
  function measureLevel(spec){
    const t0 = Date.now(), lv = savedLevel(spec);
    if (!lv || lv.lanes.length !== (spec.lanes || 3)){ log(`${id(spec.n)} measure: the saved level does not match the spec`); return PREV; }
    const full = evaluate(lv, 200);
    if (!full.ok) log(`${id(spec.n)} measure: greedy ${full.greedy.result}`);
    return finish(spec, {notes:(PREV && PREV.notes) || []}, lv, PREV ? PREV.h : 0, full, t0, 0, 'measured');
  }
  /* levels 1 and 3: hand-made content for their tutorials */
  function tutorialLevel(spec){
    const t0 = Date.now(), b = base(spec);
    if (b.notes.some(x => /NO PLACE/.test(x))){ log(`${id(spec.n)} geometry failed: ${b.notes.join('; ')}`); return PREV; }
    const lv = spec.n === 1 ? tutorial1(b.lv) : tutorial3(b.lv); lv.meta = meta(spec);
    const ck = C.checkLevel(clone(lv)); if (!ck.balanced || ck.warnings.length){ log(`${id(spec.n)} tutorial content: ${ck.warnings.map(w => w.kind).join(',')} ${ck.balanced}`); return PREV; }
    const full = evaluate(lv, 200); if (!full.ok){ log(`${id(spec.n)} tutorial content: greedy ${full.greedy.result}`); return PREV; }
    return finish(spec, b, lv, 0, full, t0, 1, 'tutorial');
  }
  function finish(spec, b, lv, h, full, t0, tries, tag){
    const band = BANDS[spec.diff], early = spec.n <= 5;
    const ff = early ? failFree(lv) : null;
    if (!(lv.marbleScale && lv.marbleScale < 1)){ const ms = C.autoMarbleScale(clone(lv)); if (ms > 1) lv.marbleScale = ms; else delete lv.marbleScale; }   // marbles as large as there is room for
    fs.writeFileSync(path.join(OUT, id(spec.n) + '.json'), fmt(lv) + '\n');
    const ck = C.checkLevel(clone(lv)), N = C.normalizeLevel(clone(lv)), Lz = C.buildLayout(clone(lv));
    const res = {id:id(spec.n), n:spec.n, role:spec.role, diff:spec.diff, band, lanes:lv.lanes.length, h:+h.toFixed(3), rate:full.rate, wins:full.wins, runs:full.runs,
      inBand:full.rate >= band[0] && full.rate <= band[1], greedyT:+full.greedy.t.toFixed(1), greedySends:full.greedy.sends, notes:b.notes, failFree:ff,
      trays:N.trays.map(r => ({cols:r.columns.length, rows:r.rows, kind:shapeName(r)})), colors:ck.perColor.filter(p => p.marbles).map(p => ({color:p.color, marbles:p.marbles})),
      boxes:ck.sizes, nBoxes:ck.boxes, marbles:ck.totalMarbles, marbleScale:N.marbleScale || 1, slide:spec.slideIdea, trayIdea:spec.trayIdea,
      blockers:blockerText(N), tutorial:spec.tutorial || null, popup:spec.popup || null, hint:spec.hint || null,
      slideLen:+Lz.SLIDE.tailS.toFixed(1), spirals:Lz.SLIDE.spirals.length};
    log(`${res.id} ${spec.role.padEnd(28)} diff ${spec.diff} band ${band.map(v => Math.round(v*100)).join('-')}%  random ${(full.rate*100).toFixed(1)}% ${res.inBand ? 'IN ' : MUST(spec.role) ? 'OUT' : 'out'}` +
      `  h ${res.h}  greedy ${res.greedyT}s ${res.greedySends} sends  ${res.marbles} marbles  ${ff ? 'fail-free ' + ff : ''} ${b.notes.length ? '[' + b.notes.join('; ') + ']' : ''} (${((Date.now() - t0)/1000).toFixed(0)}s, ${tries} tries${tag ? ', ' + tag : ''})`);
    return res;
  }
  /* levels 1-5: no fail possible. Proof by play: 1000 random games and an adversarial bot that sends the box with the
     fewest matching marbles at the tray fronts (several mixes with random play) - none may lose */
  function failFree(lv){
    let fails = 0, games = 0;
    for (let r = 0; r < 1000; r++){ games++; if (C.simulate(clone(lv), C.randomPick, C.mulberry32(5000 + r), C.SIM_DT).result !== 'win') fails++; }
    for (let k = 0; k < 6; k++){ games++; const rng = C.mulberry32(77 + k), pol = g => rng() < 0.3 + k*0.14 ? C.adversePick(g, rng) : C.randomPick(g, rng);
      if (C.simulate(clone(lv), pol, null, C.SIM_DT).result !== 'win') fails++; }
    return fails ? `NO (${fails} losses in ${games} games)` : `yes (${games} games, no loss)`;
  }
  function meta(spec){
    const m = {role:spec.role, diff:spec.diff, slide:spec.slideIdea, trays:spec.trayIdea};
    if (spec.tutorial) m.tutorial = spec.tutorial; if (spec.popup) m.popup = spec.popup; if (spec.hint) m.hint = spec.hint;
    if (spec.tutorialLane != null) m.tutorialLane = spec.tutorialLane;      // the lane whose front box the tutorial's hand points at first
    return m;
  }
  function shapeName(r){ return r.tilt != null ? 'tilted ' + r.tilt + ' deg' : r.shape ? 'turned' : 'default (35 deg)'; }
  function blockerText(N){
    const out = [], boxes = N.lanes.flat(), hid = boxes.filter(b => b.hidden).length, groups = {};
    boxes.forEach(b => { if (b.link) groups[b.link] = (groups[b.link] || 0) + 1; });
    if (hid) out.push(`${hid} hidden box${hid > 1 ? 'es' : ''}`);
    const g2 = Object.values(groups).filter(v => v === 2).length, g3 = Object.values(groups).filter(v => v === 3).length;
    if (g2) out.push(`${g2} connected pair${g2 > 1 ? 's' : ''}`); if (g3) out.push(`${g3} connected triple${g3 > 1 ? 's' : ''}`);
    const hm = N.trays.reduce((a, r) => a + r.columns.flat().filter(c => typeof c === 'string' && c[0] === '?').length, 0);
    if (hm) out.push(`${hm} hidden marbles`);
    const disp = N.trays.flatMap(r => r.dispensers || []), locks = N.trays.flatMap(r => (r.crates || []).filter(c => c.lock != null)), counts = N.trays.flatMap(r => (r.crates || []).filter(c => c.count != null));
    if (disp.length) out.push(disp.map(t => `dispenser (${t.color}, ${t.count})`).join(', '));
    if (locks.length) out.push(locks.length > 1 ? `${locks.length} lock crates & keys` : 'lock crate & key');
    if (counts.length) out.push(counts.map(c => `count crate (${c.count})`).join(', '));
    return out.join(', ') || '-';
  }
  /* level 1: one tray, the front two rows red, the back two blue; the red box first (the tutorial points at it) */
  function tutorial1(base){
    const lv = clone(base), r = lv.trays[0];
    r.columns = r.columns.map(col => col.map((_, i) => i < 2 ? 'red' : 'blue'));
    lv.lanes = [[{color:'blue', size:8}], [{color:'red', size:8}]];
    return lv;
  }
  /* level 3: the red box can fill only 4 holes from the front row of the first tray - its other 4 marbles wait at the
     back of the second tray - so it waits in its slot; once blue and yellow boxes have taken the marbles in front of
     them, the reds roll to the front and the waiting box is filled */
  function tutorial3(base){
    const lv = clone(base), L = C.buildLayout(clone(lv)), [first, second] = L.TRAYS.map(r => lv.trays[r.src]);
    const by = ['blue', 'yellow', 'yellow', 'blue', 'yellow', 'yellow', 'yellow', 'blue', 'yellow', 'blue', 'yellow', 'yellow', 'yellow', 'blue', 'yellow', 'blue', 'yellow', 'yellow',
                'blue', 'yellow', 'blue', 'yellow', 'yellow', 'yellow'];
    let k = 0;
    first.columns = first.columns.map(col => col.map((_, i) => i === 0 ? 'red' : by[k++]));
    second.columns = second.columns.map(col => col.map((_, i) => i === col.length - 1 ? 'red' : by[k++]));
    lv.lanes = [[{color:'blue', size:8}, {color:'yellow', size:8}], [{color:'red', size:8}, {color:'yellow', size:8}]];
    return lv;
  }
}
