// 2-5 box lanes: the format, the layout, sending from every lane, connected boxes across lanes.
//   node tests/lanes.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
const B = (color, size, o) => Object.assign({color, size}, o || {});
for (let n = C.LANE_MIN; n <= C.LANE_MAX; n++){
  const lv = clone(C.LEVEL_DATA); lv.lanes = Array.from({length:n}, (_, l) => [B('red', 4), B('blue', 4)].map(b => Object.assign(b, {color:['red', 'blue', 'yellow', 'green'][(l + (b.color === 'blue')) % 4]})));
  const N = C.normalizeLevel(lv), L = C.buildLayout(N), xs = L.laneX;
  chk(N.laneCount === n && N.lanes.length === n && xs.length === n && Math.abs(xs[0] + xs[n - 1]) < 1e-9, `${n} lanes: kept in the level, centred on the screen`, xs.map(x => x.toFixed(2)).join(' '));
  const g = C.createGame(N, {}); const sent = []; for (let l = 0; l < n; l++) if (C.tapLane(g, l) === 'sent') sent.push(l);
  chk(sent.length === Math.min(n, C.SLOT_N) && g.slots.slice(0, sent.length).every((b, i) => g.boxes[b].lane === sent[i]), `${n} lanes: a tap on any lane sends its front box to the leftmost free slot`, g.slots.join()); }
{ const lv = clone(C.LEVEL_DATA); lv.laneCount = 9; lv.lanes = [[B('red', 4)]]; const N = C.normalizeLevel(lv);
  chk(N.laneCount === 5 && N.lanes.length === 5 && N.lanes[4].length === 0, 'a level asks for 2-5 lanes; missing ones are empty'); }
{ // connected boxes across neighbouring lanes in a 5-lane level: side by side, or diagonal
  const lv = clone(C.LEVEL_DATA); lv.laneCount = 5;
  lv.lanes = [[B('red', 4)], [B('red', 4, {link:'A'})], [B('blue', 4, {link:'A'}), B('green', 4, {link:'B'})], [B('yellow', 4), B('yellow', 4, {link:'B'})], [B('pink', 4)]];
  const G = C.linkGroups(C.normalizeLevel(lv));
  chk(G.every(x => x.connected && x.consecutive) && !C.queueDeadlock(C.normalizeLevel(lv)), 'connected boxes across neighbouring lanes (side by side, or one row apart) are valid groups', JSON.stringify(G.map(x => x.members)));
  const g = C.createGame(lv, {}); const r1 = C.tapLane(g, 3); C.tapLane(g, 2); const r2 = C.tapLane(g, 3);
  chk(r1 === 'sent' && g.boxes[1].state === 'fly' && g.boxes[2].state === 'fly' && r2 === 'sent' && g.boxes[3].state === 'fly' && g.boxes[5].state === 'fly',
    'a group goes once all its members are their lanes\' fronts (after the yellow box in lane 4 leaves, B can go)', g.boxes.map(b => b.state[0]).join('')); }
console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
