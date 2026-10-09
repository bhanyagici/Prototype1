// Queue lanes and the free exit tunnel: node tests/lanes.test.js
// 2-5 queue lanes (format, layout, sending from every lane, the side each lane's buses take), connected buses across
// any two neighbouring lanes of a 4- or 5-lane queue, and the exit tunnel anywhere in the target zone (any spot along
// the top edge). The screen fit of every lane count is in tests/layout.test.js.
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const dt = 1/60, clone = o => JSON.parse(JSON.stringify(o));
const run = (g, sec) => { for (let i = 0; i < Math.round(sec/dt); i++){ C.step(g, dt); if (g.result) break; } };
const kinds = lv => C.checkLevel(clone(lv)).warnings.map(w => w.kind);
// four ramps of one colour each (8 stickmen per colour per ramp column set) and the matching buses
const COLS = ['red', 'blue', 'yellow', 'green', 'purple'];
const base = n => ({seed:0, ramps:[0, 1, 2, 3].map(k => ({columns:[0, 1, 2, 3].map(c => Array.from({length:8}, (_, i) => COLS[(k + (i >> 2)) % n])), rows:8})), lanes:[]});
function laneLevel(NL){
  const lv = base(4); lv.laneCount = NL; lv.lanes = Array.from({length:NL}, () => []);
  // 128 stickmen, 32 of each of 4 colours: 16 eight-seat buses dealt over the lanes
  for (let k = 0; k < 16; k++) lv.lanes[k % NL].push({color:COLS[k % 4], cap:8});
  return lv;
}

console.log('lane counts 2-5');
for (let NL = C.LANE_MIN; NL <= C.LANE_MAX; NL++){
  const lv = laneLevel(NL), N = C.normalizeLevel(clone(lv)), L = C.buildLayout(clone(lv));
  chk(N.laneCount === NL && N.lanes.length === NL, `${NL} lanes: the level keeps its lane count`);
  const X = L.Y.LANE_X, sym = X.every((x, i) => Math.abs(x + X[NL - 1 - i]) < 1e-6), gap = Math.min(...X.slice(1).map((x, i) => x - X[i]));
  chk(X.length === NL && sym && gap > 1.4, `${NL} lanes: lane centres symmetric about the entry road, ${gap.toFixed(2)} apart (a bus is 1.18 wide)`, X.join(' '));
  chk(!kinds(lv).length && C.checkLevel(clone(lv)).balanced, `${NL} lanes: a balanced level with no warnings`, kinds(lv).join(','));
  const g = C.createGame(clone(lv), {}), fronts = C.legalSends(g).filter(a => a.kind === 'lane').map(a => a.idx);
  chk(g.lanes.length === NL && fronts.length === NL, `${NL} lanes: every lane's front bus can be sent`, fronts.join(','));
  const sim = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
  chk(sim.result === 'win', `${NL} lanes: the greedy bot wins`, sim.result + ' in ' + sim.t.toFixed(0) + ' s');
  let rw = 0; for (let r = 0; r < 20; r++) if (C.simulate(clone(lv), C.randomPick, C.mulberry32(1000 + r), C.SIM_DT).result === 'win') rw++;
  chk(rw > 0, `${NL} lanes: random play finishes too`, rw + '/20');
  // the side of the yard a sent bus takes: lanes left of the middle go left, right of it go right, a middle lane alternates
  { const sides = [];
    for (let l = 0; l < NL; l++){ const gg = C.createGame(clone(lv), {}), id = gg.lanes[l][0]; C.tapLane(gg, l); sides.push(gg.buses[id].side); }
    const mid = (NL - 1)/2, ok = sides.every((s, l) => l < mid ? s === -1 : l > mid ? s === 1 : s === -1 || s === 1);
    chk(ok, `${NL} lanes: buses leave by the side of their lane (left lanes left, right lanes right)`, sides.join(' ')); }
}
{ const lv = laneLevel(3); lv.laneCount = 5;
  const N = C.normalizeLevel(clone(lv));
  chk(N.lanes.length === 5 && N.lanes[3].length === 0 && N.lanes[4].length === 0, 'a laneCount above the lanes given pads empty lanes');
  lv.laneCount = 9; chk(C.normalizeLevel(clone(lv)).lanes.length === 5, 'laneCount is clamped to 5');
  lv.laneCount = 1; chk(C.normalizeLevel(clone(lv)).lanes.length === 2, '... and to at least 2');
  delete lv.laneCount; lv.lanes = [[{color:'red', cap:8}], [], [], []];
  chk(C.normalizeLevel(clone(lv)).laneCount === 4, 'without laneCount the number of lanes given counts'); }

console.log('connected buses across 4 and 5 lanes');
{ const groupOf = (lv, id) => C.linkGroups(C.normalizeLevel(clone(lv))).find(G => G.id === id);
  const five = () => { const lv = laneLevel(5); lv.lanes.forEach(ln => ln.forEach(b => delete b.link)); return lv; };
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4]]){
    const lv = five(); lv.lanes[a][0].link = 'X'; lv.lanes[b][0].link = 'X';
    const G = groupOf(lv, 'X');
    chk(G.connected && G.consecutive && !kinds(lv).some(k => /^link/.test(k)), `lanes ${a + 1} and ${b + 1} of 5: two front buses connect`); }
  { const lv = five(); lv.lanes[3][0].link = 'Y'; lv.lanes[4][1].link = 'Y';
    chk(groupOf(lv, 'Y').connected && !kinds(lv).some(k => /^link/.test(k)), 'lanes 4 and 5, one row apart: connected'); }
  { const lv = five(); lv.lanes[2][0].link = 'T'; lv.lanes[3][0].link = 'T'; lv.lanes[4][0].link = 'T';
    chk(groupOf(lv, 'T').connected && !kinds(lv).some(k => /^link/.test(k)), 'a triple across lanes 3, 4 and 5'); }
  { const lv = five(); lv.lanes[1][0].link = 'Z'; lv.lanes[3][0].link = 'Z';
    chk(!groupOf(lv, 'Z').connected && kinds(lv).includes('link-shape'), 'lanes 2 and 4 are not neighbours: refused (link-shape warning)'); }
  { const lv = five(); lv.lanes[3][0].link = 'W'; lv.lanes[4][2].link = 'W';
    chk(kinds(lv).includes('link-shape'), 'two rows apart: refused'); }
  // playing it: tapping one front member sends the whole group, from lanes 4 and 5 of a 5-lane queue
  { const lv = five(); lv.lanes[3][0].link = 'G'; lv.lanes[4][0].link = 'G';
    const g = C.createGame(clone(lv), {}), m = [g.lanes[3][0], g.lanes[4][0]];
    C.tapLane(g, 4); run(g, 0.2);
    chk(m.every(id => !g.lanes[3].includes(id) && !g.lanes[4].includes(id)) && g.counter === 2, 'tapping lane 5 sends the connected pair from lanes 4 and 5 together', 'counter ' + g.counter);
    const sim = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    chk(sim.result === 'win', 'the greedy bot wins the 5-lane level with the cross-lane pair'); }
  { const lv = laneLevel(4); lv.lanes[0][0].link = 'P'; lv.lanes[1][0].link = 'P'; lv.lanes[1][1].link = 'Q'; lv.lanes[2][1].link = 'Q'; lv.lanes[2][0].link = 'R'; lv.lanes[3][0].link = 'R';
    const sim = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    chk(!kinds(lv).some(k => /^link/.test(k)) && sim.result === 'win', 'a 4-lane queue with three cross-lane pairs: valid, and the greedy bot wins', sim.result); }
  // the 4- and 5-lane funnel levels: plenty of groups, most across lanes, all valid
  const DIR = path.join(__dirname, '..', 'levels', 'funnel');
  for (const id of ['f16', 'f20', 'f23', 'f35', 'f38', 'f40']){
    const lv = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8')), G = C.linkGroups(C.normalizeLevel(clone(lv)));
    const across = G.filter(x => new Set(x.members.map(m => m.l)).size > 1).length;
    chk(G.length >= 6 && across >= 3 && G.every(x => x.connected && x.consecutive) && !kinds(lv).some(k => /^link/.test(k)),
      `${id} (${lv.lanes.length} lanes): ${G.length} connected groups, ${across} across lanes, all valid`); }
}

console.log('the exit tunnel anywhere in the target zone');
{ const lv0 = laneLevel(3); lv0.road = clone(C.LEVEL_DATA.road);      // the built-in road, simple content
  const withExit = (x, z) => { const lv = clone(lv0); delete lv.road.tail; const p = lv.road.points[lv.road.points.length - 1]; p.x = x; p.z = z; return lv; };
  const topFit = x => { for (let z = -21; z <= -8; z += 0.25) if (!kinds(withExit(x, z)).includes('zone-exit')) return z; return null; };
  const xs = [-4.6, -3, -1.5, 0, 1.5, 3, 4.6], tops = xs.map(topFit);
  chk(tops.every(z => z != null), 'along the whole top edge (x -4.6 … 4.6) there is a spot where the exit tunnel fits the zone', tops.join(' '));
  chk(Math.max(...tops) - Math.min(...tops) < 2.5, 'those spots are all near the top of the zone (the zone\'s top edge, not lower)', tops.map(z => z.toFixed(2)).join(' '));
  for (const x of [-4.6, 0, 4.6]){ const lv = withExit(x, topFit(x) + 0.3), L = C.buildLayout(clone(lv)), last = lv.road.points[lv.road.points.length - 1];
    chk(Math.abs(L.exit.x - last.x) < 1.5 && !kinds(lv).includes('zone-exit') && C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT).result === 'win',
      `exit at the top ${x < 0 ? 'left' : x > 0 ? 'right' : 'centre'}: the road ends in it, inside the zone, and the level plays`, `exit ${L.exit.x.toFixed(2)}, ${L.exit.z.toFixed(2)}`); }
  { const lv = withExit(-2, -30); chk(kinds(lv).includes('zone-exit'), 'an exit tunnel above the screen is flagged (zone-exit)'); }
  { // the earlier level 25: its road came back down over its own climb, and the exit tunnel sat on it
    const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'exit-on-road.json'), 'utf8')), now = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'funnel', 'f25.json'), 'utf8'));
    chk(kinds(old).join() === 'exit-road', 'an exit tunnel sitting on another stretch of the road is flagged (exit-road)', kinds(old).join(','));
    chk(!kinds(now).length, '... level 25 now ends in the side hillside instead: no warnings'); }
  { const lv = withExit(3.2, -12.5); chk(!kinds(lv).includes('zone-exit'), 'an exit tunnel lower down, inside the zone, is fine too'); }
  // the funnel's exits are spread over the top edge
  const DIR = path.join(__dirname, '..', 'levels', 'funnel'), ex = [];
  for (let n = 1; n <= 40; n++){ const lv = JSON.parse(fs.readFileSync(path.join(DIR, 'f' + String(n).padStart(2, '0') + '.json'), 'utf8')); ex.push(C.buildLayout(lv).exit.x);
    if (kinds(lv).includes('zone-exit')) chk(false, `f${n}: exit inside the zone`); }
  chk(Math.min(...ex) < -1.5 && Math.max(...ex) > 1.5, 'the 40 funnel levels put their exit tunnels at different spots along the top', `x from ${Math.min(...ex).toFixed(1)} to ${Math.max(...ex).toFixed(1)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
