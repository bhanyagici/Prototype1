// Gaps (jumps) and toy track pieces: their format, the flight over a gap, the checker's rules, and that neither ever
// changes a marble's progress, speed, spacing or order.
//   node tests/gaps.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
// a test level: a designed S-slide with one spiral (tools/funnel/geometry.js) and two trays, so it has a clear stretch
const G = require('../tools/funnel/geometry.js');
const BASE = (() => { const lv = {format:1, type:'marble-run-level', name:'gaps', slide:G.designSlide({seed:2, spirals:1}).slide, trays:[], lanes:[[{color:'red', size:4}], [], []]};
  G.place({trays:[{c:2, r:2, f:0.05}, {c:2, r:2, f:0.9}]}, lv); lv.trays[0].columns[0] = ['red', 'red']; lv.trays[0].columns[1] = ['red', 'red']; return lv; })();
const withSlide = (f) => { const lv = clone(BASE); f(lv.slide, lv); return lv; };
const kinds = lv => C.checkLevel(lv).warnings.map(w => w.kind);
const SL0 = C.buildLayout(clone(BASE)).SLIDE, merges = C.buildLayout(clone(BASE)).TRAYS.map(r => r.s).sort((a, b) => a - b);
const free = (() => { for (let s = 2; s < SL0.tailS - 2; s += 0.1){ const a = clone(BASE), b = clone(BASE); a.slide.gaps = [{at:s, len:1.2}]; b.slide.toys = [{kind:'loop', at:s}];
  if (!kinds(a).some(k => k.startsWith('gap')) && !kinds(b).some(k => k.startsWith('toy'))) return +s.toFixed(2); } return null; })();   // a clear stretch for a gap or a toy

console.log('gaps');
{ const lv = withSlide(sl => { sl.gaps = [{at:free, len:1.2, ramp:'updown'}]; }), L = C.buildLayout(lv), G = L.SLIDE.gaps[0];
  const o = {}, d = {}; C.slidePos(L.SLIDE, G.at, o, 0); C.pathAt(L.SLIDE, G.at, d, 0);
  chk(G.s0 === free - 0.6 && G.s1 === free + 0.6 && o.y > d.y - C.RI + C.R_M + 0.15, 'a marble flies an arc over a gap (above where the deck would be), at the same progress speed', `${(o.y - (d.y - C.RI + C.R_M)).toFixed(2)} above`);
  chk(!L.pillars.some(p => p.s > G.s0 - 0.3 && p.s < G.s1 + 0.3), 'no pillar stands under a gap');
  chk(free != null && !kinds(lv).some(k => k.startsWith('gap')), 'a gap on a clear stretch raises no warning', free + ': ' + kinds(lv).join()); }
{ const ends = withSlide(sl => { sl.gaps = [{at:1.0, len:1}]; }), sp = withSlide(sl => { const s = SL0.spirals[0]; sl.gaps = [{at:(s.s0 + s.s1)/2, len:1}]; });
  const two = withSlide(sl => { sl.gaps = [{at:free, len:1}, {at:free + 1.6, len:1}]; }), mrg = withSlide(sl => { sl.gaps = [{at:merges[1] - 0.6, len:1}]; });
  chk(kinds(ends).includes('gap-ends') && kinds(sp).includes('gap-spiral') && kinds(two).includes('gap-gap') && kinds(mrg).includes('gap-merge'),
    'checker: no gap near the ends, on a spiral, near another gap, or at or just after a merge point', [kinds(ends), kinds(sp), kinds(two), kinds(mrg)].map(k => k.filter(x => x.startsWith('gap')).join('+')).join(' | ')); }

console.log('toy pieces');
{ const all = Object.keys(C.TOY_KINDS);
  chk(all.join() === 'xylophone,bells,wheel,stairs,vortex,loop', 'six toy pieces: xylophone bridge, bells, paddle wheel, zig-zag staircase, vortex bowl, loop-the-loop', all.join());
  // spacing through every toy: two marbles GAP apart along the slide are never closer than a marble diameter in space
  let worst = 1e9, at = '';
  for (const kind of all){ const lv = withSlide(sl => { sl.toys = [{kind, at:free}]; }), SL = C.buildLayout(lv).SLIDE, T = SL.toys[0], a = {}, b = {};
    for (let s = T.s0 - C.GAP; s <= T.s1; s += 0.01){ C.slidePos(SL, s, a, 0); C.slidePos(SL, s + C.GAP, b, 0); const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); if (d < worst){ worst = d; at = kind + '@' + (s - T.s0).toFixed(2); } } }
  chk(worst >= C.D_M - 1e-6, 'through every toy piece two marbles 1.15 diameters apart along the slide stay at least a marble apart in space (a loop is never slower than the plain slide)', `closest ${worst.toFixed(3)} (${at})`);
  const plain = (() => { const l = clone(C.LEVEL_DATA); delete l.slide.toys; return l; })(), toyed = (() => { const l = clone(C.LEVEL_DATA); l.slide.toys = [{kind:'loop', at:13.9}, {kind:'bells', at:17.2}]; return l; })();
  const play = lv => { const g = C.createGame(lv, {}), rng = C.mulberry32(4), log = []; let think = 0;
    while (!g.result && g.t < 400){ think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = C.randomPick(g, rng); if (a) C.applyAction(g, a); } C.step(g);
      for (const e of g.events) log.push(e.type + (e.marble != null ? e.marble : '') + '@' + e.t.toFixed(4)); g.events.length = 0; } return log.join(); };
  chk(play(plain) === play(toyed), 'toy pieces are decoration: the same game with and without them gives exactly the same events (progress, speed, spacing and order unchanged)'); }
{ const sp = SL0.spirals[0], cross = SL0.cross[0];
  const onSp = withSlide(sl => { sl.toys = [{kind:'bells', at:(sp.s0 + sp.s1)/2}]; }), over = withSlide(sl => { sl.toys = [{kind:'bells', at:cross.s0}]; });
  const nearM = withSlide(sl => { sl.toys = [{kind:'wheel', at:merges[1] + 0.3}]; }), ends = withSlide(sl => { sl.toys = [{kind:'wheel', at:0.3}]; });
  const onGap = withSlide(sl => { sl.gaps = [{at:free, len:1}]; sl.toys = [{kind:'wheel', at:free + 0.9}]; }), close = withSlide(sl => { sl.toys = [{kind:'wheel', at:free}, {kind:'bells', at:free + 1.3}]; });
  const k = lv => kinds(lv).filter(x => x.startsWith('toy'));
  chk(k(onSp).includes('toy-spiral') && k(over).includes('toy-overpass') && k(nearM).includes('toy-merge') && k(ends).includes('toy-ends') && k(onGap).includes('toy-gap') && k(close).includes('toy-toy'),
    'checker: toy pieces stay off the spirals and their overpasses, away from merge points, gaps, the ends and each other', [onSp, over, nearM, ends, onGap, close].map(l => k(l).join('+')).join(' | ')); }

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
