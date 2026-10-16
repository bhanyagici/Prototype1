// Marble Run rules, headless: sending, slots, reservations (the cheering set), the slide, the sorter, completion,
// win and fail, bots.
//   node tests/rules.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
/* a level on the built-in slide and tray spots: trays = [[column, ...] per tray] (columns front to back), lanes */
function mk(trays, lanes, extra){
  const base = clone(C.LEVEL_DATA), lv = {format:1, type:'marble-run-level', name:'test', slide:base.slide, trays:[], lanes};
  trays.forEach((cols, k) => { const spot = base.trays[k], rows = Math.max(...cols.map(c => c.length));
    lv.trays.push(Object.assign({}, spot, {rows, columns:cols.map(c => c.concat(new Array(rows - c.length).fill(null)))}, (extra || {})[k] || {})); });
  return lv;
}
const B = (color, size, o) => Object.assign({color, size}, o || {});
const run = (g, sec, f) => { const n = Math.round(sec/C.SIM_DT); for (let i = 0; i < n && !g.result; i++){ C.step(g); if (f) f(g); } };
const take = g => { const e = g.events.slice(); g.events.length = 0; return e; };

console.log('the world');
chk(Math.abs(C.V_SLIDE/C.D_M - 15) < 1e-9 && Math.abs(C.GAP/C.D_M - 1.15) < 1e-9, 'marbles roll down the slide at 15 diameters a second and never closer than 1.15 diameters', `${C.V_SLIDE} u/s, gap ${C.GAP}`);
chk(C.SLOT_N === 5 && C.SIZES.join() === '4,6,8,12' && C.SLOT_L >= C.boxLen(12) && C.SLOT_W > C.BOX_W, '5 slots, each fits a 2 x 6 box; boxes have 4, 6, 8 or 12 holes in 2 columns',
  `slot ${C.SLOT_W.toFixed(2)} x ${C.SLOT_L.toFixed(2)}, box 12: ${C.BOX_W.toFixed(2)} x ${C.boxLen(12).toFixed(2)}`);
{ const h = [0, 1, 2, 3].map(i => C.holeLocal(8, i));
  chk(h[0][1] < h[2][1] && h[0][0] < h[1][0] && h[0][1] === h[1][1], 'a box fills its holes far row first, left then right', JSON.stringify(h)); }

console.log('sending');
{ const lv = mk([[['red', 'red', 'red', 'red']]], [[B('red', 4), B('blue', 4)], [B('yellow', 4)], [B('green', 4)]]);
  const g = C.createGame(lv, {});
  const r1 = C.tapLane(g, 1), r2 = C.tapLane(g, 0);
  chk(r1 === 'sent' && r2 === 'sent' && g.slots[0] === 2 && g.slots[1] === 0 && g.lanes[0][0] === 1, 'a tap sends that lane\'s front box to the leftmost free slot', JSON.stringify(g.slots));
  take(g); run(g, C.T_FLY - 0.1);
  chk(!take(g).some(e => e.type === 'reserve'), 'nothing is reserved while the box is in the air');
  run(g, 0.2); const ev = take(g), res = ev.find(e => e.type === 'reserve');
  chk(ev.some(e => e.type === 'land' && e.box === 0) && res && res.box === 0 && res.marbles.length === 4, 'the moment it lands in its slot, the tray fronts of its colour are reserved for it (and the ones behind, while they match)', res && JSON.stringify(res)); }
{ // 5 slots full: the 6th tap is refused (shake, red flash, toast) and nothing else happens; not a fail while marbles move
  const lv = mk([[['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red'], ['red', 'red', 'red', 'red']]], [[B('red', 12), B('blue', 4), B('blue', 4)], [B('yellow', 4), B('green', 4)], [B('pink', 4)]]);
  const g = C.createGame(lv, {});
  ['0', '1', '2', '0', '1'].forEach(l => C.tapLane(g, +l)); take(g);
  const r = C.tapLane(g, 0), ev = take(g);
  chk(r === 'refused' && ev.length === 1 && ev[0].type === 'refuse' && ev[0].why === 'slots' && g.lanes[0].length === 1 && !g.result, 'with all 5 slots taken a tap is refused (the box shakes, the slots flash, a toast) - not a fail', JSON.stringify(ev));
  run(g, 1.0); chk(!g.result && C.busy(g), 'not a fail while marbles are reserved and rolling'); }

console.log('reservations');
{ // two red boxes: the one that reached its slot first is served first; a reservation never exceeds a box's free holes
  const lv = mk([[['red', 'red', 'red', 'red', 'red', 'red'], ['red', 'red', 'red', 'red', 'red', 'red']]], [[B('red', 8)], [B('blue', 4), B('red', 4)], [B('blue', 4)]]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); run(g, 0.2); C.tapLane(g, 1); C.tapLane(g, 1); take(g);
  let res = {}; run(g, 0.6, g => { for (const e of take(g)) if (e.type === 'reserve') res[e.box] = (res[e.box] || 0) + e.marbles.length; });
  chk(res[0] === 8 && res[2] === 4 && g.boxes[0].seq < g.boxes[2].seq, 'the box that reached its slot first is served first, and no box is promised more marbles than its free holes', JSON.stringify(res)); }
{ // round-robin over trays and columns: one marble per column per pass, in tray order down the slide
  const lv = mk([[['red', 'red'], ['red', 'red']], [['red', 'red']]], [[B('red', 6)], [B('blue', 4)], [B('blue', 4)]]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); take(g); run(g, 0.5);
  const res = take(g).find(e => e.type === 'reserve'), at = id => { const m = g.marbles[id]; return m.tray + ':' + m.col + ':' + m.row; };
  chk(res && res.marbles.map(at).join(' ') === '0:0:0 0:1:0 1:0:0 0:0:1 0:1:1 1:0:1', 'reservations go round-robin: tray by tray down the slide, column by column, one marble each pass', res && res.marbles.map(at).join(' ')); }
{ // columns flow independently: a red marble behind a blue front waits; once the blue front leaves it looks again
  const lv = mk([[['blue', 'red', 'red', 'red'], ['red']]], [[B('red', 4)], [B('blue', 4)], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); take(g); run(g, 0.5);
  const r1 = take(g).filter(e => e.type === 'reserve').flatMap(e => e.marbles);
  C.tapLane(g, 1); run(g, 0.8); const r2 = take(g).filter(e => e.type === 'reserve').map(e => e.box + ':' + e.marbles.join(','));
  chk(r1.join() === '4' && r2.sort().join(' ') === '0:1,2,3 1:0', 'columns flow independently: the red box takes the free column\'s red; the reds behind the blue front wait until the blue box takes it, then go', `${r1} | ${r2.join(' ')}`); }
{ // the logic is a pure function of the taps: the same taps at the same steps give the same events
  const lv = clone(C.LEVEL_DATA), taps = [[0, 0], [3, 1], [6, 2], [40, 0], [90, 1], [130, 2], [170, 0], [220, 1], [260, 2], [330, 0], [380, 1], [420, 2], [470, 0], [520, 1]];
  const play = () => { const g = C.createGame(lv, {}), log = []; for (let n = 0; n < 2400 && !g.result; n++){ for (const [s, l] of taps) if (s === n) C.tapLane(g, l); C.step(g); for (const e of take(g)) log.push(e.type + ':' + (e.box != null ? e.box : '') + ':' + (e.marbles || [e.marble]).join(',') + '@' + e.t.toFixed(3)); } return log.join('|'); };
  chk(play() === play(), 'the same taps at the same steps give exactly the same reservations, drops and completions (one fixed order)'); }

console.log('bot games: the cheering set, the slide, the sorter');
{ const levels = [clone(C.LEVEL_DATA), ...Object.values(C.PRESETS).map(clone)];
  let games = 0, boxes = 0, badSet = 0, over = 0, overtakes = 0, close = 0, badMerge = 0, railOrder = 0, holeOrder = 0, slotLate = 0, laps = 0, minGap = 1e9;
  for (const lv of levels) for (let r = 0; r < 12; r++){
    const g = C.createGame(lv, {}), rng = C.mulberry32(77 + r), resv = {}, got = {}, lastHole = {}, rail = [];
    let think = 0; games++;
    while (!g.result && g.t < 900){
      think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = r % 3 === 0 ? C.greedyPick(g) : C.randomPick(g, rng); if (a) C.applyAction(g, a); }
      C.step(g);
      for (const e of take(g)){
        if (e.type === 'reserve') for (const id of e.marbles) (resv[e.box] = resv[e.box] || new Set()).add(id);
        if (e.type === 'depart'){ const m = g.marbles[e.marble];
          for (const id of g.flow.map(f => f.id)) if (id !== m.id && Math.abs(g.marbles[id].phase - m.phase) < C.GAP - 1e-9) badMerge++; }
        if (e.type === 'drop'){ (got[e.box] = got[e.box] || new Set()).add(e.marble); if (e.hole !== (lastHole[e.box] != null ? lastHole[e.box] + 1 : 0)) holeOrder++; lastHole[e.box] = e.hole; }
        if (e.type === 'complete') for (const id of e.boxes){ boxes++; const a = [...(resv[id] || [])].sort().join(), b = [...(got[id] || [])].sort().join(); if (a !== b) badSet++; if (g.slots[g.boxes[id].slot] !== -1) slotLate++; }
      }
      for (const b of g.boxes) if (b.res > b.size || b.got > b.size) over++;
      // every marble past the chute, by arc length along the slide: none ever passes another, none closer than GAP
      const on = g.marbles.filter(m => (m.state === 'chute' || m.state === 'tray') && m.box >= 0 && m.tDep > 0 && g.t >= m.tDep + C.T_CHUTE && g.t <= m.tEnd)
        .map(m => ({id:m.id, s:m.phase + C.V_SLIDE*g.t})).sort((a, b) => a.s - b.s);
      for (let i = 1; i < on.length; i++){ const d = on[i].s - on[i - 1].s; minGap = Math.min(minGap, d); if (d < C.GAP - 1e-6) close++; }
      laps += on.length;
    }
    // the rail: marbles reach the bowl in slide order and keep it (all at the same speed)
    const ends = g.marbles.filter(m => m.tEnd > 0).sort((a, b) => a.tEnd - b.tEnd);
    for (let i = 1; i < ends.length; i++) if (ends[i].phase > ends[i - 1].phase + 1e-9) overtakes++;
    void rail; void railOrder;
  }
  chk(boxes > 100 && !badSet, `in every lap of every game the marbles reserved for a box are exactly the marbles that land in it (${games} games, ${boxes} boxes)`, badSet + ' mismatches');
  chk(!over, 'no box is ever promised or given more marbles than it has holes', over);
  chk(laps > 1000 && !overtakes && !close && !badMerge, 'on the slide no marble ever overtakes another, the spacing never drops below 1.15 diameters, and a marble merges only into a free gap',
    `${overtakes} overtakes, ${close} too close (closest ${minGap.toFixed(3)} >= ${C.GAP.toFixed(3)}), ${badMerge} bad merges`);
  chk(!holeOrder, 'each box fills hole 0, 1, 2 ... in landing order (far row first, left then right)', holeOrder);
  chk(!slotLate, 'a box completes when its last marble lands, and its slot frees in that same step', slotLate); }

console.log('win and fail');
{ const lv = mk([[['red', 'red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4)], [B('blue', 4)], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); C.tapLane(g, 1); run(g, 20);
  chk(g.result === 'win' && g.landed === 8, 'win: every marble is in a box', g.result + ' ' + g.landed); }
{ // rule 9: 5 boxes in the slots, nothing moving or reserved, no front marble for any of them -> fail (and not a moment earlier)
  const lv = mk([[['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue']]], [[B('green', 4)], [B('yellow', 4), B('pink', 4)], [B('orange', 4), B('purple', 4)]]);
  const g = C.createGame(lv, {}); [0, 1, 2, 1, 2].forEach(l => C.tapLane(g, l));
  let failAt = -1, lastMove = -1; run(g, 3, g => { if (C.busy(g)) lastMove = g.t; if (g.result === 'fail' && failAt < 0) failAt = g.t; });
  chk(g.result === 'fail' && g.why === 'slots' && Math.abs(failAt - lastMove - C.SIM_DT) < 1e-6 && failAt >= C.T_FLY,
    'rule 9: all 5 slots hold boxes, nothing is moving or reserved and no tray front can go to any of them: a fail - in the first step after the last box landed', `${g.result} (${g.why}) at ${failAt.toFixed(3)}, last move ${lastMove.toFixed(3)}`); }
{ // ... but while a box is being fed, and after it is done (its slot free again), it is not
  const lv = mk([[['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue']]], [[B('red', 4), B('blue', 4)], [B('yellow', 4), B('pink', 4)], [B('orange', 4), B('purple', 4)]]);
  const g = C.createGame(lv, {}); [1, 2, 1, 2, 0].forEach(l => C.tapLane(g, l));
  let fed = false; run(g, 8, g => { if (C.busy(g) && g.boxes[0].res) fed = true; });
  chk(fed && !g.result && g.boxes[0].state === 'gone' && C.legalSends(g).length === 1, 'four stuck boxes and one being fed: no fail while its marbles roll; once it is done its slot is free again (a send is possible: still no fail)', `${g.result}, red ${g.boxes[0].state}`); }
{ // a pending lock event is a possible move: no fail while the key flies to its crate
  const lv = mk([[['red', 'red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4, {key:'K1'}), B('green', 4)], [B('yellow', 4), B('pink', 4)], [B('orange', 4), B('blue', 4)]],
    {0:{crates:[{col:1, row:0, w:1, h:4, lock:'K1'}]}});
  const g = C.createGame(lv, {}); [0, 0, 1, 1, 2].forEach(l => C.tapLane(g, l));   // red (the key), green, yellow, pink, orange
  let keyT = -1, openT = -1, failT = -1;
  run(g, 12, g => { for (const e of g.events){ if (e.type === 'key') keyT = e.t; if (e.type === 'open') openT = e.t; } g.events.length = 0; if (g.result === 'fail' && failT < 0) failT = g.t; if (g.slots.filter(x => x >= 0).length === 4 && g.lanes[2].length === 1 && !g.result && openT > 0) C.tapLane(g, 2); });
  chk(keyT > 0 && openT > keyT && (failT < 0 || failT > openT), 'a key in flight to its lock counts as a possible move: no fail before the crate opens', `key ${keyT.toFixed(2)}, open ${openT.toFixed(2)}, fail ${failT.toFixed(2)}, ${g.result}`); }

console.log('bots');
{ const lv = mk([[['red', 'red', 'red', '?blue'], ['blue', '?red', 'red', 'red']]], [[B('red', 4), B('blue', 4, {hidden:true})], [B('blue', 4, {link:'P'}), B('red', 4)], [B('red', 4, {link:'P', hidden:true})]]);
  const g = C.createGame(lv, {}); C.step(g);
  const snap = JSON.stringify({m:g.marbles, b:g.boxes, t:g.trays, s:g.slots, l:g.lanes});
  C.greedyPick(g); C.whatIf(g, {kind:'lane', idx:1, box:g.lanes[1][0]}); C.adversePick(g, C.mulberry32(1));
  chk(JSON.stringify({m:g.marbles, b:g.boxes, t:g.trays, s:g.slots, l:g.lanes}) === snap && g.boxes.filter(b => b.hidden && !b.revealed).length === 1 && g.marbles.filter(m => m.hidden && !m.revealed).length === 2,
    'the bots\' lookahead works on deep copies: no reservation, no hidden colour reveal leaks into the real game');
  const w = C.whatIf(g, {kind:'lane', idx:1, box:g.lanes[1][0]});
  chk(w.n === 2, 'a hidden member\'s colour is unknown to the lookahead (only the shown colours count)', JSON.stringify(w)); }
{ const levels = [C.LEVEL_DATA, ...Object.values(C.PRESETS)];
  const lost = levels.filter(lv => C.simulate(lv, C.greedyPick, null).result !== 'win').map(lv => lv.name);
  chk(!lost.length, `the greedy bot wins the built-in level${levels.length > 1 ? ' and every bundled level' : ''}`, lost.join(', '));
  const s = C.simulate(C.LEVEL_DATA, C.randomPick, C.mulberry32(5));
  chk(['win', 'fail'].includes(s.result) && s.sends > 0, 'the random bot plays to a result', JSON.stringify({r:s.result, t:s.t.toFixed(1), sends:s.sends})); }

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
