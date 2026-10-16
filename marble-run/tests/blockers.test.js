// Marble Run blockers, headless: hidden boxes, connected boxes, hidden marbles, marble dispensers, lock & key crates,
// count crates; the checker's rules for them; the demo levels (bots, the cheering set).
//   node tests/blockers.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
function mk(trays, lanes, extra){
  const base = clone(C.LEVEL_DATA), lv = {format:1, type:'marble-run-level', name:'test', slide:base.slide, trays:[], lanes};
  trays.forEach((cols, k) => { const spot = base.trays[k], rows = Math.max(...cols.map(c => c.length), (extra && extra[k] && extra[k].rows) || 0);
    lv.trays.push(Object.assign({}, spot, {rows, columns:cols.map(c => c.concat(new Array(rows - c.length).fill(null)))}, (extra || {})[k] || {})); });
  return lv;
}
const B = (color, size, o) => Object.assign({color, size}, o || {});
const run = (g, sec, f) => { const n = Math.round(sec/C.SIM_DT); for (let i = 0; i < n && !g.result; i++){ C.step(g); if (f) f(g); } };
const take = g => { const e = g.events.slice(); g.events.length = 0; return e; };
const R4 = ['red', 'red', 'red', 'red'];

console.log('hidden box');
{ const lv = mk([[R4, ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4), B('blue', 4, {hidden:true})], [B('green', 4, {hidden:true})], []]);
  const g = C.createGame(lv, {});
  chk(!g.boxes[1].revealed && g.boxes[2].revealed, 'a hidden box is grey with a "?" (its size shows) until it is its lane\'s front box; a hidden front box shows at once');
  C.tapLane(g, 0); const ev = take(g);
  chk(g.boxes[1].revealed && ev.some(e => e.type === 'revealBox' && e.box === 1), 'it reveals its colour the moment it becomes the front box', JSON.stringify(ev.map(e => e.type))); }
{ const lv = mk([[R4, ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4, {link:'P'}), B('blue', 4, {link:'P', hidden:true})], [], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); const ev = take(g);
  chk(!g.boxes[1].revealed && !ev.some(e => e.type === 'revealBox'), 'a connected member sent from behind stays hidden in the air ...');
  run(g, C.T_FLY + 0.05); const ev2 = take(g), rv = ev2.findIndex(e => e.type === 'revealBox' && e.box === 1), ld = ev2.findIndex(e => e.type === 'land' && e.box === 1);
  chk(g.boxes[1].revealed && rv >= 0 && rv < ld, '... and reveals as it lands in its slot (before it takes any marble)'); }

console.log('connected boxes');
{ const lv = mk([[R4, ['blue', 'blue', 'blue', 'blue'], ['yellow', 'yellow', 'yellow', 'yellow']]],
    [[B('green', 4), B('red', 4, {link:'P'})], [B('blue', 4, {link:'P'})], [B('yellow', 4)]]);
  const g = C.createGame(lv, {});
  const r1 = C.tapLane(g, 1), e1 = take(g);
  chk(r1 === 'refused' && e1[0].why === 'group' && g.boxes[2].state === 'lane', 'a group can go only when, in every lane it uses, its topmost member is the front box (otherwise the tap is refused)', JSON.stringify(e1));
  C.tapLane(g, 2); C.tapLane(g, 0); take(g);       // yellow to slot 0, green to slot 1
  const r2 = C.tapLane(g, 1);
  chk(r2 === 'sent' && g.boxes[1].state === 'fly' && g.boxes[2].state === 'fly' && g.boxes[1].slot === 2 && g.boxes[2].slot === 3, 'tapping any member sends the whole group; the members take the leftmost free slots', `slots ${g.slots}`); }
{ const lv = mk([[R4, ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4, {link:'P'}), B('green', 4)], [B('blue', 4, {link:'P'}), B('pink', 4)], [B('yellow', 4), B('orange', 4), B('purple', 4)]]);
  const g = C.createGame(lv, {}); [2, 2, 2].forEach(l => C.tapLane(g, l)); C.tapLane(g, 0); take(g);   // 3 slots taken: wait, 0 tapped sends the pair? (needs 2)
  chk(g.slots.filter(x => x >= 0).length === 5 && g.boxes[0].slot === 3 && g.boxes[2].slot === 4, 'with two free slots the pair goes into them', `slots ${g.slots}`); }
{ const lv = mk([[R4, ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4, {link:'P'}), B('green', 4)], [B('blue', 4, {link:'P'})], [B('yellow', 4), B('orange', 4), B('purple', 4), B('pink', 4)]]);
  const g = C.createGame(lv, {}); [2, 2, 2, 2].forEach(l => C.tapLane(g, l)); take(g);
  const r = C.tapLane(g, 0), ev = take(g);
  chk(r === 'refused' && ev[0].why === 'slots' && g.boxes[0].state === 'lane', 'the group needs as many free slots as it has members, otherwise the tap is refused', JSON.stringify(ev)); }
{ // each member fills with its own colour; a full member keeps its slot until all are full; then they leave together
  const lv = mk([[R4, ['blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue']]], [[B('red', 4, {link:'P'})], [B('blue', 8, {link:'P'})], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0);
  let redFull = -1, done = null, slotHeld = true;
  run(g, 15, g => { for (const e of take(g)){ if (e.type === 'full' && e.box === 0) redFull = e.t; if (e.type === 'complete') done = e; }
    if (redFull >= 0 && !done && g.slots[g.boxes[0].slot] !== 0) slotHeld = false; });
  chk(redFull > 0 && done && done.boxes.length === 2 && done.t > redFull && slotHeld && g.result === 'win', 'each member fills with its own colour; the full red member keeps its slot until the blue one is full, then both leave together',
    `red full ${redFull.toFixed(2)}, complete ${done && done.t.toFixed(2)} [${done && done.boxes}]`); }
{ const N = C.normalizeLevel(mk([[R4]], [[B('red', 4, {link:'A'}), B('red', 4, {link:'B'})], [B('red', 4, {link:'B'}), B('red', 4, {link:'A'})], []]));
  chk(C.queueDeadlock(N) && C.checkLevel(N).warnings.some(w => w.kind === 'link-deadlock'), 'link-deadlock: groups that block each other are reported'); }

console.log('hidden marbles');
{ const lv = mk([[['red', '?red', 'red', 'red']]], [[B('red', 4)], [], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); take(g); run(g, C.T_FLY + 0.05);
  const r1 = take(g).filter(e => e.type === 'reserve').flatMap(e => e.marbles);
  chk(r1.join() === '0' && !g.marbles[1].revealed, 'a hidden marble stays grey with a "?" until it reaches the front row - and is not reserved until then', r1.join());
  let rv = -1, res2 = -1; run(g, 1.5, g => { for (const e of take(g)){ if (e.type === 'reveal' && e.marble === 1) rv = e.t; if (e.type === 'reserve' && e.marbles.includes(1)) res2 = e.t; } });
  chk(rv > 0 && Math.abs(res2 - rv) < 1e-9 && g.marbles[1].box === 0, 'when the marble in front of it leaves it reveals, and is reserved in that same moment', `reveal ${rv.toFixed(2)}, reserve ${res2.toFixed(2)}`); }

console.log('marble dispenser');
{ const lv = mk([[['red', null, null, 'blue', 'blue', 'blue', 'blue']]], [[B('red', 4), B('blue', 4)], [], []], {0:{dispensers:[{col:0, row:1, w:1, h:2, color:'red', count:3}]}});
  const ck = C.checkLevel(lv);
  chk(ck.perColor.find(p => p.color === 'red').marbles === 4 && !ck.warnings.some(w => /disp/.test(w.kind)), 'a dispenser\'s marbles count toward its colour (level math), and it sits on empty cells with one in front', JSON.stringify(ck.warnings.map(w => w.kind)));
  const g = C.createGame(lv, {}), T = g.trays[0];
  chk(T.cols[0].length === 1 && T.disps[0].left === 3 && T.rest[0].length === 4, 'the marbles behind it wait (blue at the back), its own wait inside it');
  C.tapLane(g, 0); let drops = [], gone = -1, blueRes = -1;
  run(g, 20, g => { for (const e of take(g)){ if (e.type === 'dispense') drops.push(e.left); if (e.type === 'dispGone') gone = e.t; if (e.type === 'reserve' && g.marbles[e.marbles[0]].color === 'blue') blueRes = e.t; }
    if (gone > 0 && g.lanes[0].length && g.boxes[0].state === 'gone') C.tapLane(g, 0); });
  chk(drops.join() === '2,1,0' && gone > 0, 'whenever the cell directly in front of it empties it drops one marble of its colour into it; at 0 it pops away', drops.join());
  chk(g.result === 'win' && blueRes > gone, 'then the marbles behind it join their column and roll on', g.result); }
{ const lv = mk([[['red', 'red', null, null], ['red', 'red', null, null]]], [[B('red', 8), B('red', 4)], [], []], {0:{dispensers:[{col:0, row:2, w:2, h:2, color:'red', count:4}]}});
  const g = C.createGame(lv, {}); C.tapLane(g, 0); const cols = new Set(); run(g, 5, g => { for (const e of take(g)) if (e.type === 'dispense') cols.add(e.col); });
  chk(cols.size === 2, 'a dispenser two columns wide drops into every column it spans', [...cols].join()); }
{ const bad = mk([[['red', 'red', 'red', 'red']]], [[B('red', 4)], [], []], {0:{dispensers:[{col:0, row:0, w:1, h:2, color:'red', count:0}]}});
  const k = C.checkLevel(bad).warnings.map(w => w.kind);
  chk(k.includes('disp-front') && k.includes('disp-count') && k.includes('disp-cells'), 'checker: a dispenser needs a cell in front, at least one marble and empty cells under it', k.join()); }

console.log('lock & key crate');
{ const lv = mk([[['red', 'red', 'red', 'red'], ['blue', 'blue', 'blue', 'blue', 'green', 'green']]], [[B('red', 4, {key:'K1'}), B('green', 2*2)], [B('blue', 4)], []],
    {0:{crates:[{col:1, row:0, w:1, h:2, lock:'K1'}]}});
  chk(!C.checkLevel(lv).warnings.length, 'a lock crate over a block of cells, its key on one queue box: no warnings', C.checkLevel(lv).warnings.map(w => w.kind).join());
  const g = C.createGame(lv, {}); C.tapLane(g, 1); take(g); run(g, 2);
  chk(g.boxes[2].res === 0, 'the crate\'s marbles cannot leave, and they block the marbles behind them (the blue box gets nothing)', g.boxes[2].res);
  C.tapLane(g, 0); let key = null, open = -1, done = -1;
  run(g, 8, g => { for (const e of take(g)){ if (e.type === 'complete' && e.boxes.includes(0)) done = e.t; if (e.type === 'key') key = e; if (e.type === 'open') open = e.t; } });
  chk(key && Math.abs(key.t - done) < 1e-9 && Math.abs(open - done - C.T_KEY) < 0.04 && g.boxes[2].res === 4, 'when the key box is COMPLETED its key flies to the lock and the crate lifts away; the blue marbles then go',
    `done ${done.toFixed(2)}, key ${key && key.t.toFixed(2)}, open ${open.toFixed(2)}`); }
{ const two = mk([[R4, ['blue', 'blue']]], [[B('red', 4, {key:'K1'}), B('blue', 2*2, {key:'K1'})], [], []], {0:{crates:[{col:1, row:0, w:1, h:2, lock:'K1'}]}});
  const none = mk([[R4]], [[B('red', 4, {key:'K9'})], [], []]), dead = mk([[['blue', 'blue', 'blue', 'blue'], ['red', 'red', 'red', 'red']]], [[B('red', 4, {key:'K1'})], [B('blue', 4)], []], {0:{crates:[{col:1, row:0, w:1, h:2, lock:'K1'}]}});
  const k2 = C.checkLevel(two).warnings.map(w => w.kind), k3 = C.checkLevel(none).warnings.map(w => w.kind), k4 = C.checkLevel(dead).warnings.map(w => w.kind);
  chk(k2.includes('lock-keys') && k3.includes('key-no-lock') && k4.includes('lock-deadlock'), 'checker: exactly one key per lock, no key without a lock, and the key box\'s colour reachable without opening its own crate (lock-deadlock)',
    `${k2.join()} | ${k3.join()} | ${k4.join()}`); }

console.log('count crate');
{ const lv = mk([[R4, ['green', 'green', 'green', 'green'], ['blue', 'blue', 'blue', 'blue']]], [[B('red', 4), B('green', 4)], [B('blue', 4)], []],
    {0:{crates:[{col:1, row:0, w:1, h:4, count:2}]}});
  chk(!C.checkLevel(lv).warnings.length, 'a count crate over a block of cells: no warnings');
  const g = C.createGame(lv, {}); C.tapLane(g, 0); C.tapLane(g, 1); take(g); let counts = [], open = -1;
  run(g, 25, g => { for (const e of take(g)){ if (e.type === 'count') counts.push(e.left); if (e.type === 'open') open = e.t; }
    if (g.lanes[0].length && g.boxes[0].state === 'gone') C.tapLane(g, 0); });
  chk(counts.join() === '1,0', 'a count crate shows how many more boxes must be completed', counts.join());
  chk(open > 0 && g.result === 'win', 'it opens at 0, and its marbles roll on', `${open.toFixed(2)} ${g.result}`);
  const k = C.checkLevel(mk([[R4]], [[B('red', 4)], [], []], {0:{crates:[{col:0, row:0, w:1, h:2, count:5}]}})).warnings.map(w => w.kind);
  chk(k.includes('count-range'), 'checker: a count crate cannot ask for more boxes than the level has', k.join()); }

console.log('demo levels');
{ const demos = Object.entries(C.PRESETS);
  const kinds = demos.map(([id, lv]) => { const fl = lv.lanes.flat(); return id + ':' + [fl.some(b => b.hidden) && 'hidden', fl.some(b => b.link) && 'link', lv.trays.some(t => (t.dispensers || []).length) && 'disp',
    lv.trays.some(t => t.columns.flat().some(c => c && c[0] === '?')) && 'hm', lv.trays.some(t => (t.crates || []).some(c => c.lock)) && 'lock', lv.trays.some(t => (t.crates || []).some(c => c.count != null)) && 'count'].filter(Boolean).join('+'); });
  chk(demos.length === 7 && kinds.find(k => k.startsWith('demo_combo')).split('+').length === 6, 'seven demo levels: one per blocker and one with all of them', kinds.join(' '));
  const bad = demos.filter(([, lv]) => !C.checkLevel(lv).ok).map(([id]) => id);
  chk(!bad.length, 'every demo level is balanced and free of warnings', bad.join());
  let games = 0, mism = 0, lost = [];
  for (const [id, lv] of demos){ if (C.simulate(lv, C.greedyPick, null).result !== 'win') lost.push(id);
    for (let r = 0; r < 10; r++){ const g = C.createGame(lv, {}), rng = C.mulberry32(300 + r), resv = {}, got = {}; let think = 0; games++;
      while (!g.result && g.t < 600){ think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = C.randomPick(g, rng); if (a) C.applyAction(g, a); } C.step(g);
        for (const e of take(g)){ if (e.type === 'reserve') for (const m of e.marbles) (resv[e.box] = resv[e.box] || []).push(m); if (e.type === 'drop') (got[e.box] = got[e.box] || []).push(e.marble); } }
      for (const b of Object.keys(got)) if (g.boxes[b].state === 'gone' && (resv[b] || []).sort().join() !== got[b].sort().join()) mism++; } }
  chk(!lost.length, 'the greedy bot wins every demo level', lost.join());
  chk(!mism, `with every blocker the marbles reserved for a box are the ones that land in it (${games} random games)`, mism); }

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
