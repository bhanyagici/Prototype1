// Gaps: node tests/gaps.test.js
// A road cut by gaps: both ends of a gap stand at the same height; buses speed up before a gap and over it, jump it
// (drawn) and land; nothing overtakes; only one bus (or connected group) is over a gap at a time and the next one waits
// at the edge until the one ahead has landed and cleared the far side; nobody stops over a gap.  The checker keeps gaps
// off spirals, the road's ends, each other and boarding points.  A level without gaps plays exactly as it did: the gap
// code never changes a speed or a limit there.  Every level with gaps (the Jumps showcase category and a fixture) is
// played to the end by the greedy bot, watching every step.
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o)), LV = path.join(__dirname, '..', 'levels');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));

// the levels with gaps
const withGaps = [['fixture gap-s-curve', read(path.join(__dirname, 'fixtures', 'gap-s-curve.json'))]];
for (const f of fs.readdirSync(path.join(LV, 'showcase')).filter(f => f.endsWith('.json') && f !== 'showcase-order.json')){
  const lv = read(path.join(LV, 'showcase', f)); if (lv.road && lv.road.gaps && lv.road.gaps.length) withGaps.push(['showcase ' + f.replace('.json', ''), lv]); }
chk(withGaps.length >= 4, 'the Jumps showcase category has levels with gaps', withGaps.length - 1 + ' showcase levels');

/* ---- the format: gaps are sanitized, sorted, their length clamped ---- */
console.log('format');
{ const lv = clone(C.LEVEL_DATA); lv.road.gaps = [{at:20, len:9, ramp:'updown'}, {at:12, len:0.1}, {at:'x'}];
  const N = C.normalizeLevel(lv), G = N.road.gaps;
  chk(G.length === 2 && G[0].at === 12 && G[1].at === 20, 'gaps are sorted along the road; a gap without a position is dropped', JSON.stringify(G));
  chk(G[0].len === C.GAP_LEN[0] && G[1].len === C.GAP_LEN[1] && G[0].ramp === 'flat' && G[1].ramp === 'updown', 'a gap is ' + C.GAP_LEN.join('-') + ' long, flat or with take-off and landing ramps');
  const lv2 = clone(C.LEVEL_DATA); lv2.road.gaps = [];
  chk(!('gaps' in C.normalizeLevel(lv2).road), 'an empty gap list is dropped'); }

/* ---- geometry: both ends at the same height, the road level across ---- */
console.log('geometry');
for (const [name, lv] of withGaps){ const L = C.buildLayout(C.normalizeLevel(clone(lv))), R = L.ROAD, o = {};
  let worst = 0;
  for (const q of R.gaps){ const ys = []; for (let s = q.s0; s <= q.s1 + 1e-6; s += 0.05){ C.pathAt(R, s, o, 0); ys.push(o.y); }
    worst = Math.max(worst, Math.max(...ys) - Math.min(...ys)); }
  chk(worst < 0.005, name + ': both ends of every gap stand at the same height (the road is level across)', (worst*1000).toFixed(1) + ' mm');
  chk(!L.pillars.some(p => R.gaps.some(q => p.s > q.s0 - 0.3 && p.s < q.s1 + 0.3)), name + ': no pillar stands under a gap');
}

/* ---- the checker ---- */
console.log('checker');
{ const base = withGaps[0][1], kinds = lv => C.checkLevel(clone(lv)).warnings.map(w => w.kind);
  chk(kinds(base).length === 0, 'the fixture has no warnings', kinds(base).join(','));
  const L = C.buildLayout(C.normalizeLevel(clone(base))), sp = L.ROAD.spirals && L.ROAD.spirals[0];
  const near = clone(base); near.road.gaps = [{at:1.5, len:1.2}];
  chk(kinds(near).includes('gap-ends'), 'a gap near the start of the road is flagged');
  const two = clone(base); two.road.gaps = [{at:9, len:1.2}, {at:11, len:1.2}];
  chk(kinds(two).includes('gap-gap'), 'two gaps close together are flagged');
  const onRamp = clone(base), r0 = L.RAMPS[0]; onRamp.road.gaps = [{at:r0.s, len:1.2}];
  chk(kinds(onRamp).includes('gap-ramp'), 'a boarding point on a gap is flagged');
  const lv2 = clone(C.LEVEL_DATA), L2 = C.buildLayout(C.normalizeLevel(clone(lv2))), sp2 = L2.ROAD.spirals[0];
  if (sp2){ lv2.road.gaps = [{at:(sp2.s0 + sp2.s1)/2, len:1}]; chk(kinds(lv2).includes('gap-spiral'), 'a gap on a spiral is flagged'); }
  void sp; }

/* ---- the gap code never touches a level without gaps ---- */
console.log('levels without gaps');
{ const lv = clone(C.LEVEL_DATA), L = C.buildLayout(C.normalizeLevel(lv)), g = C.createGame(clone(lv), {headless:true});
  let think = 0, bad = 0, steps = 0;
  while (!g.result && g.t < 400){ think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = C.greedyPick(g); if (a) C.applyAction(g, a); }
    for (const b of g.road){ steps++; if (C.gapVmax(L.ROAD, [b]) !== C.BUS_SPEED || C.gapHold(L.ROAD, b, b, g.road[0]) !== Infinity) bad++; }
    C.step(g, C.SIM_DT); }
  chk(!L.ROAD.gaps.length && bad === 0 && steps > 100, 'Level 2 (no gaps): every bus keeps the plain road speed and no gap limit, a whole game long', `${steps} bus-steps`); }

/* ---- whole games over gaps, watched step by step ---- */
console.log('jumps');
for (const [name, lv] of withGaps){
  const N = C.normalizeLevel(clone(lv)), L = C.buildLayout(N), G = L.ROAD.gaps, g = C.createGame(clone(lv), {headless:true});
  const over = (b, q) => b.rs + b.len/2 > q.s0 + 1e-6 && b.rs - b.len/2 < q.s1 - 1e-6;
  let think = 0, order = [], overtake = 0, two = 0, wait = 0, stop = 0, jumps = 0, vBoost = 0, vPlain = 0;
  const seen = new Set();
  while (!g.result && g.t < 1500){
    think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = C.greedyPick(g); if (a) C.applyAction(g, a); }
    C.step(g, C.SIM_DT);
    const ids = g.road.map(b => b.id), kept = ids.filter(id => order.includes(id));
    if (kept.join() !== order.filter(id => ids.includes(id)).join()) overtake++;
    for (let k = 1; k < g.road.length; k++) if (g.road[k - 1].rs - g.road[k - 1].len/2 < g.road[k].rs + g.road[k].len/2 - 1e-6) overtake++;
    order = ids;
    for (const q of G){
      const air = g.road.filter(b => over(b, q)), units = new Set(air.map(b => b.group ? 'g' + b.group.id : 'b' + b.id));
      if (units.size > 1) two++;
      air.forEach(b => { if (b.v < 0.05) stop++; const k = b.id + ':' + q.s0; if (!seen.has(k)){ seen.add(k); jumps++; } });
      // a unit in the air (or not yet clear of the far side): nobody else past the near edge
      const busy = g.road.filter(b => b.rs - b.len/2 < q.s1 && b.rs + b.len/2 > q.s0 - 1e-6);
      for (const b of busy) for (const o of g.road) if (o !== b && (o.group == null || o.group !== b.group) && o.rs < b.rs && o.rs + o.len/2 > q.s0 + 1e-6) wait++;
    }
    for (const b of g.road){ const unit = b.group != null ? g.road.filter(o => o.group === b.group) : [b];   // a connected group drives as one
      const near = unit.some(m => G.some(q => m.rs + m.len/2 >= q.s0 - C.GAP_RUNUP && m.rs - m.len/2 <= q.s1));
      if (near) vBoost = Math.max(vBoost, b.v);
      else if (unit.every(m => G.every(q => m.rs + m.len/2 < q.s0 - C.GAP_RUNUP - 0.5))) vPlain = Math.max(vPlain, b.v); }
  }
  chk(g.result === 'win', name + ': the greedy bot wins', g.result + ' in ' + g.t.toFixed(1) + ' s');
  chk(jumps >= 4, name + ': buses jump the gaps', jumps + ' jumps');
  chk(overtake === 0, name + ': nothing overtakes or overlaps on the road');
  chk(two === 0, name + ': only one bus (or connected group) is over a gap at a time', two);
  chk(wait === 0, name + ': the next bus waits at the edge until the one ahead has landed and cleared the gap', wait);
  chk(stop === 0, name + ': no bus ever stops over a gap', stop);
  chk(vBoost > C.BUS_SPEED*1.2 && vPlain <= C.BUS_SPEED + 1e-6, name + ': buses speed up before a gap and over it, and only there',
    `boost ${(vBoost/C.BUS_SPEED).toFixed(2)}x, elsewhere ${(vPlain/C.BUS_SPEED).toFixed(2)}x`);
  chk(C.checkLevel(clone(lv)).warnings.length === 0, name + ': no checker warnings');
}

console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
