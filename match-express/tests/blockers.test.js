// Blocker rule suite for Match Express: node tests/blockers.test.js
// hidden buses, connected buses, colourful tunnels, hidden stickmen, lock & count boxes, the checker
// rules for them, the bots and the cheering prediction on the demo levels.
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const dt = 1/60, clone = o => JSON.parse(JSON.stringify(o));
const run = (g, sec, fn) => { for (let i = 0; i < Math.round(sec/dt); i++){ C.step(g, dt); if (fn) fn(g); if (g.result) break; } };
const take = (g, types) => { const out = g.events.filter(e => !types || types.includes(e.type)); g.events.length = 0; return out; };
const filler = n => [0,1,2,3].map(c => Array.from({length:n}, (_, i) => ['orange','yellow','cyan','purple','pink','green'][(i*2 + c) % 6]));
const level = (r0, lanes, more) => Object.assign({seed:0, ramps:[r0, {columns:filler(9)}, {columns:filler(10)}, {columns:filler(9)}, {columns:filler(10)}], lanes}, more || {});
const rampOf = (g, src) => g.ramps.find(r => g.L.RAMPS[r.k].src === src);
const kinds = lv => C.checkLevel(lv).warnings.map(w => w.kind);

console.log('hidden buses');
{ const lv = level({columns:filler(10)}, [[{color:'red', cap:4}, {color:'blue', cap:8, hidden:true}, {color:'red', cap:6, hidden:true}], [{color:'red', cap:4}], []]);
  const g = C.createGame(lv, {}), hb = g.buses[1];
  chk(!hb.revealed && hb.len === C.busLen(8), 'a hidden bus shows no colour, but its length (capacity) is real', 'len ' + hb.len.toFixed(2));
  C.tapLane(g, 0); const ev = take(g, ['reveal']);
  chk(hb.revealed && ev.length === 1 && ev[0].bus === hb.id && !g.buses[2].revealed, 'it reveals its colour when it becomes the front of its lane (the one behind stays hidden)');
}
{ const lv = level({columns:filler(10)}, [[{color:'red', cap:4, link:'V'}, {color:'blue', cap:4, link:'V', hidden:true}], [{color:'red', cap:4}], []]);
  const g = C.createGame(lv, {}), hb = g.buses[1];
  C.tapLane(g, 0); let revealT = null, mergeT = null;
  run(g, 6, g => { for (const e of take(g)){ if (e.type === 'reveal' && e.bus === hb.id) revealT = e.t; if (e.type === 'merge' && e.bus === hb.id) mergeT = e.t; } });
  chk(revealT !== null && revealT === mergeT, 'a hidden group member sent from behind reveals the moment it joins the main road', revealT && revealT.toFixed(2) + ' s');
}

console.log('connected buses');
const R0 = {columns:[['red','red','red','red','red','red'], ['blue','blue','blue','blue','blue','blue'], ['red','red','orange','orange','orange','orange'], ['blue','blue','yellow','yellow','yellow','yellow']]};
{ const lv = level({columns:filler(10)}, [[{color:'red', cap:4}, {color:'red', cap:4, link:'D'}], [{color:'blue', cap:4, link:'D'}, {color:'cyan', cap:4}], [{color:'yellow', cap:4}]]);
  const g = C.createGame(lv, {}), r1 = C.tapLane(g, 1), ev = take(g);
  chk(r1 === 'refused' && g.lanes[1][0] === 2 && ev.some(e => e.type === 'refuse'), 'a member at the front waiting for its partner cannot go: it shakes and blocks its lane');
  C.tapLane(g, 0); take(g); const r2 = C.tapLane(g, 1);
  chk(r2 === 'road' && g.buses[1].state === 'toRoad' && g.buses[2].state === 'toRoad', 'once every lane it uses has it at the front, tapping any member sends the whole group');
}
{ const lv = level({columns:filler(10)}, [[{color:'red', cap:4, link:'V'}, {color:'blue', cap:4, link:'V'}, {color:'green', cap:4}], [], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0);
  chk(g.buses[0].state === 'toRoad' && g.buses[1].state === 'toRoad' && g.lanes[0][0] === 2 && g.counter === 2, 'vertical link: tapping the front bus sends the whole chain, each member counts on the road', 'counter ' + g.counter);
}
{ const lv = level({columns:filler(10)}, [[{color:'red', cap:4}, {color:'red', cap:4}, {color:'red', cap:4}, {color:'red', cap:4, link:'T'}], [{color:'blue', cap:4, link:'T'}], [{color:'yellow', cap:4, link:'T'}]]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); C.tapLane(g, 0); C.tapLane(g, 0); take(g);
  const r = C.tapLane(g, 1);
  chk(r === 'refused' && g.counter === 3, 'a group of 3 is refused while the road has room for only 2 more', 'counter ' + g.counter);
}
{ // order on the road, the articulated bus, boarding, jumping together
  const lv = level(R0, [[{color:'red', cap:4, link:'G'}, {color:'green', cap:4}], [{color:'blue', cap:4, link:'G'}, {color:'cyan', cap:6}], [{color:'yellow', cap:4}]]);
  const g = C.createGame(lv, {}); C.tapLane(g, 1);
  let merges = [], gaps = [], both = 0, jumps = [], boards = {0:new Set(), 2:new Set()};
  run(g, 15, g => { const a = g.buses[0], b = g.buses[2];
    if (a.state === 'road' && b.state === 'road'){ gaps.push((a.rs - a.len/2) - (b.rs + b.len/2)); if ((a.board || b.board) && (a.v > 1e-9 || b.v > 1e-9)) both++; }
    for (const e of take(g)){ if (e.type === 'merge') merges.push(e.bus); if (e.type === 'jump') jumps.push([e.bus, e.t]); if (e.type === 'board') boards[e.bus].add(g.men[e.man].color); } });
  chk(JSON.stringify(merges) === '[0,2]', 'on the road the leftmost lane\'s bus leads, the others follow', merges.join(','));
  chk(gaps.length > 50 && Math.max(...gaps) - Math.min(...gaps) < 1e-6 && both === 0, 'they move as one articulated bus: a fixed bellows gap, and both stop while either boards',
      'gap ' + Math.min(...gaps).toFixed(4) + '-' + Math.max(...gaps).toFixed(4));
  chk([...boards[0]].join() === 'red' && [...boards[2]].join() === 'blue', 'each member boards stickmen of its own colour');
  chk(jumps.length === 2 && jumps[0][1] === jumps[1][1], 'when every member is full the whole group jumps off together', jumps.map(j => j[0] + '@' + j[1].toFixed(2)).join(' '));
}
{ // a member that fills keeps riding with its group until the others are full too
  const r = {columns:[['red','red','red','red','orange','orange'], ['orange','orange','orange','orange','orange','orange'], ['orange','orange','orange','orange','orange','orange'], ['orange','orange','orange','orange','orange','orange']]};
  const lv = level(r, [[{color:'red', cap:4, link:'F'}], [{color:'blue', cap:4, link:'F'}], []]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); let fullRiding = false, jumped = false;
  run(g, 25, g => { const a = g.buses[0]; if (a.state === 'road' && a.seated === 4 && g.buses[1].state === 'road') fullRiding = true; if (take(g, ['jump']).length) jumped = true; });
  chk(fullRiding && !jumped && g.buses[0].seated === 4 && ['tunnel', 'return', 'bay'].includes(g.buses[0].state), 'a full member stops boarding but stays in the group; with a member unfilled the whole group goes round', g.buses[0].state);
}
{ // return: the whole group parks in the leftmost free bays (not necessarily next to each other)
  const lv = level({columns:filler(10)}, [[{color:'red', cap:4}, {color:'red', cap:4, link:'P'}], [{color:'red', cap:4}, {color:'red', cap:4, link:'P'}], [{color:'red', cap:4}]]);
  const g = C.createGame(lv, {}); C.tapLane(g, 0); C.tapLane(g, 1); C.tapLane(g, 2);
  let parks = 0; run(g, 40, g => { parks += take(g, ['park']).length; });
  const gone = g.bays[1]; g.bays[1] = -1; g.buses[gone].state = 'jump'; g.buses[gone].bay = -1; g.counter++;   // test set-up: bay 1 empties (that bus left)
  C.tapLane(g, 0); const occupied = g.bays.map(x => x >= 0);
  let parkedAt = []; run(g, 40, g => { for (const e of take(g, ['park'])) if (e.bus === 4 || e.bus === 3 || e.bus === 1) parkedAt.push([e.bus, e.bay]); });
  const free = []; occupied.forEach((o, k) => { if (!o) free.push(k); });
  const grp = parkedAt.filter(p => p[0] === 1 || p[0] === 3);
  chk(grp.length === 2 && grp[0][1] === free[0] && grp[1][1] === free[1], 'a returning group parks in the leftmost free bays, in group order', JSON.stringify({free, parked:grp}));
  const before = g.counter, rs = C.tapBay(g, g.bays.indexOf(1));
  chk(rs === 'road' && g.counter === before + 2 && g.buses[1].state === 'toRoad' && g.buses[3].state === 'toRoad', 'tapping a parked member sends the whole group back (if the road has room for all)', before + ' -> ' + g.counter);
}
{ // fail: fewer free bays than members
  const lv = level({columns:filler(10)}, [[{color:'red', cap:4}, {color:'red', cap:4}, {color:'red', cap:4, link:'Q'}], [{color:'red', cap:4}, {color:'red', cap:4}, {color:'red', cap:4, link:'Q'}], []]);
  const g = C.createGame(lv, {}); for (let i = 0; i < 4; i++) C.tapLane(g, i % 2);
  run(g, 40); take(g);
  const freeBays = g.bays.filter(x => x < 0).length; C.tapLane(g, 0); let crash = null;
  run(g, 40, g => { for (const e of take(g, ['crash'])) crash = e; });
  chk(freeBays === 1 && crash && crash.group === 'Q' && g.result === 'fail', 'a group returning with fewer free bays than members fails', 'free bays ' + freeBays);
}

console.log('colourful tunnels');
{ const r0 = {columns:[['red', null, 'blue', 'blue'], ['green','green','green','green'], ['green','green','green','green'], ['green','green','green','green']], tunnels:[{col:0, row:1, w:1, h:1, color:'red', count:3}]};
  const lv = level(r0, [[{color:'red', cap:4}], [{color:'blue', cap:4}], []]);
  const g = C.createGame(lv, {}), R = rampOf(g, 0);
  chk(R.cols[0].length === 1 && R.rest[0].length === 2 && R.tunnels[0].left === 3, 'a tunnel blocks the stickmen behind it; the stickmen in front can board');
  C.tapLane(g, 0); const ev = []; run(g, 15, g => ev.push(...take(g, ['board', 'release', 'tunnelGone'])));
  const seq = ev.map(e => e.type[0]).join('');
  chk(seq === 'rbrbrtbb' && ev.filter(e => e.type === 'board').every(e => g.men[e.man].color === 'red'),
      'each time the cell in front empties it releases one stickman into it; at 0 it is gone', seq + ' (r=release, b=board, t=gone)');
  chk(!R.tunnels[0] || R.tunnels[0].gone, 'tunnel gone');
  chk(R.cols[0].map(id => g.men[id].color).join() === 'blue,blue', 'then the stickmen behind it flow forward', R.cols[0].map(id => g.men[id].color).join());
  const ck = C.checkLevel(lv), red = ck.perColor.find(p => p.color === 'red');
  chk(red.men === 4, "a tunnel's stickmen count toward the level's colour totals", red.men + ' red stickmen (1 + tunnel 3)');
  const r2 = {columns:[['red', null, null, 'blue'], ['red', null, null, 'blue'], ['green','green','green','green'], ['green','green','green','green']], tunnels:[{col:0, row:1, w:2, h:2, color:'red', count:5}]};
  const g2 = C.createGame(level(r2, [[{color:'red', cap:8}], [], []]), {}); C.tapLane(g2, 0);
  const rel = []; run(g2, 15, g => rel.push(...take(g, ['release'])));
  chk(rel.length === 5 && new Set(rel.map(e => e.col)).size === 2 && g2.buses[0].seated === 7, 'a two-column tunnel releases into each column it spans', rel.map(e => 'c' + e.col).join(' '));
}

console.log('hidden stickmen');
{ const r0 = {columns:[['red', '?red', '?blue', 'red'], ['blue','blue','blue','blue'], ['green','green','green','green'], ['green','green','green','green']]};
  const g = C.createGame(level(r0, [[{color:'red', cap:4}], [], []]), {}), R = rampOf(g, 0), h1 = R.cols[0][1], h2 = R.cols[0][2];
  chk(!g.men[h1].revealed && !g.men[h2].revealed, 'many stickmen can start hidden (grey, "?")');
  C.tapLane(g, 0); let revealed = [];
  run(g, 15, g => { for (const e of take(g, ['revealMan'])) revealed.push([e.man, R.cols[0].indexOf(e.man)]); });
  chk(revealed.length === 2 && revealed.every(r => r[1] <= 0), 'each one reveals its colour the moment it reaches the front row', JSON.stringify(revealed));
}

console.log('lock & key, count boxes');
const lockRamp = {columns:[['red','red','red','red'], ['red','orange','orange','orange'], ['orange','orange','orange','orange'], ['yellow','yellow','yellow','yellow']], boxes:[{col:0, row:0, w:1, h:2, lock:'K'}]};
{ const lv = level(lockRamp, [[{color:'red', cap:4}, {color:'red', cap:4}], [{color:'blue', cap:4, key:'K'}], []]);
  const g = C.createGame(lv, {}), R = rampOf(g, 0);
  C.tapLane(g, 0); const b1 = []; run(g, 12, g => b1.push(...take(g, ['board'])));
  chk(b1.length === 1 && b1[0].col === 1 && R.cols[0].length === 0 && R.obst[0], 'while the box is closed its stickmen cannot board, and they block the ones behind', b1.length + ' boarded (col ' + (b1[0] && b1[0].col) + ')');
  C.tapLane(g, 1); const ul = []; run(g, 10, g => ul.push(...take(g, ['unlock'])));
  chk(ul.length === 1 && ul[0].how === 'key' && ul[0].bus === 2 && R.boxes[0].open, 'the key bus opens the lock as it passes the ramp\'s boarding point');
  C.tapLane(g, 0); const b2 = []; run(g, 12, g => b2.push(...take(g, ['board'])));
  chk(b2.length === 4 && g.cheerMiss === 0, 'then the stickmen under it behave as normal stickmen', b2.length + ' boarded');
}
{ const r0 = {columns:[['blue','blue','blue','blue'], filler(4)[1], filler(4)[2], filler(4)[3]]};
  const r2 = clone(lockRamp);
  const lv = {seed:0, ramps:[r0, {columns:filler(9)}, r2, {columns:filler(9)}, {columns:filler(10)}], lanes:[[{color:'red', cap:4}], [{color:'blue', cap:4, key:'K'}], []]};
  const g = C.createGame(lv, {}); C.tapLane(g, 1); const ev = [];
  run(g, 12, g => ev.push(...take(g, ['jump', 'unlock', 'keyFallback'])));
  const j = ev.find(e => e.type === 'jump'), u = ev.find(e => e.type === 'unlock');
  chk(j && u && u.how === 'fallback' && Math.abs(u.t - j.t - C.KEY_FALLBACK_DELAY) < 0.02 && g.keyFallbacks === 1,
      'fallback: a key bus that fills before its lock\'s ramp sends the key when its parachute opens', j && u && `jump ${j.t.toFixed(2)} s, unlock ${u.t.toFixed(2)} s`);
  const t = C.testLevel(lv, 10);
  chk(t.warnings.some(w => w.kind === 'key-fallback'), 'the bot test warns the designer when a key bus can fill before reaching its lock', t.warnings.map(w => w.msg).join(' | '));
}
{ const r0 = {columns:[['blue','blue','blue','blue'], ['orange','orange','orange','orange'], ['red','red','orange','orange'], ['yellow','yellow','yellow','yellow']], boxes:[{col:2, row:0, w:1, h:2, count:1}]};
  const g = C.createGame(level(r0, [[{color:'blue', cap:4}], [{color:'red', cap:4}], []]), {}); C.tapLane(g, 0); C.tapLane(g, 1);
  const ev = []; run(g, 20, g => ev.push(...take(g, ['jump', 'unlock', 'board'])));
  const j = ev.findIndex(e => e.type === 'jump'), u = ev.findIndex(e => e.type === 'unlock'), reds = ev.filter(e => e.type === 'board' && e.bus === 1);
  chk(j >= 0 && u === j + 1 && ev[u].how === 'count' && reds.length === 2 && g.cheerMiss === 0, 'a count box opens when the number of completed buses reaches its number', `${reds.length} red boarded after it opened`);
}

console.log('level checker');
{ const base = level(lockRamp, [[{color:'red', cap:4}], [{color:'blue', cap:4, key:'K'}], []]);
  const noKey = clone(base); delete noKey.lanes[1][0].key;
  const twoKeys = clone(base); twoKeys.lanes[0][0].key = 'K';
  const badKey = clone(base); badKey.lanes[0][0].key = 'Z';
  chk(!kinds(base).some(k => k.startsWith('lock') || k.startsWith('key')) && kinds(noKey).includes('lock-no-key') && kinds(twoKeys).includes('lock-keys') && kinds(badKey).includes('key-no-lock'),
      'every lock needs exactly one key bus (and every key a lock)');
  const cnt = clone(base); cnt.ramps[0].boxes = [{col:0, row:0, w:1, h:2, count:9}];
  chk(kinds(cnt).includes('count-range'), 'a count box larger than the number of buses is reported');
  const big = level({columns:filler(10)}, [[{color:'red', cap:4, link:'X'}, {color:'red', cap:4, link:'X'}], [{color:'red', cap:4, link:'X'}, {color:'red', cap:4, link:'X'}], []]);
  const apart = level({columns:filler(10)}, [[{color:'red', cap:4, link:'Y'}], [], [{color:'red', cap:4, link:'Y'}]]);
  const lock = level({columns:filler(10)}, [[{color:'red', cap:4, link:'A'}, {color:'red', cap:4, link:'B'}], [{color:'red', cap:4, link:'B'}, {color:'red', cap:4, link:'A'}], []]);
  chk(kinds(big).includes('link-size') && kinds(apart).includes('link-shape') && kinds(lock).includes('link-deadlock'),
      'connected groups: at most 3, touching (neighbouring lanes), and no two groups waiting on each other');
  const ok3 = level({columns:filler(10)}, [[{color:'red', cap:4, link:'Z'}], [{color:'red', cap:4}, {color:'red', cap:4, link:'Z'}], [{color:'red', cap:4, link:'Z'}]]);
  chk(!kinds(ok3).some(k => k.startsWith('link')), 'a diagonal + horizontal group of 3 across all lanes is valid');
  const ov = level(Object.assign(clone(lockRamp), {tunnels:[{col:0, row:2, w:1, h:1, color:'red', count:2}]}), [[{color:'red', cap:4}], [{color:'blue', cap:4, key:'K'}], []]);
  const cells = level({columns:[['red','red','red','red'], ['blue','blue','blue','blue'], ['blue','blue','blue','blue'], ['blue','blue','blue','blue']], tunnels:[{col:0, row:1, w:1, h:1, color:'red', count:2}]}, [[], [], []]);
  const front = level({columns:[[null,'red','red','red'], ['blue','blue','blue','blue'], ['blue','blue','blue','blue'], ['blue','blue','blue','blue']], tunnels:[{col:0, row:0, w:1, h:1, color:'red', count:2}]}, [[], [], []]);
  chk(kinds(ov).includes('blocker-overlap') && kinds(cells).includes('tunnel-cells') && kinds(front).includes('tunnel-front'), 'blockers: one per column, a tunnel on empty cells with a cell in front of it');
  const loose = clone(C.LEVEL_DATA); delete loose.ramps[0].cp; loose.ramps[0].front = [-4, -3];
  chk(kinds(loose).includes('ramp-unsnapped') && C.buildLayout(loose).RAMPS.find(r => r.src === 0).s === Infinity, 'a ramp whose front node is not on the road is reported (no bus reaches it)');
}

console.log('demo levels: checker, bots and cheering');
{ const dir = path.join(__dirname, '..', 'levels'), demos = fs.readdirSync(dir).filter(f => f.startsWith('demo_')).sort();
  chk(demos.length >= 7, 'one demo level per blocker and one with several', demos.join(', '));
  for (const f of demos){
    const lv = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), ck = C.checkLevel(lv), gr = C.simulate(lv, C.greedyPick, null, C.SIM_DT);
    let miss = gr.cheerMiss, laps = 0, lapBad = 0;
    for (let r = 0; r < 12; r++){
      const g = C.createGame(lv, {}), rng = C.mulberry32(300 + r), lap = new Map(); let think = 0;
      while (!g.result && g.t < 1500){ think -= 1/30; if (think <= 0){ think += C.BOT_THINK; const a = r % 3 ? C.randomPick(g, rng) : C.greedyPick(g); if (a) C.applyAction(g, a); }
        C.step(g, 1/30);
        // the predicted set of a lap (cheering now + already on board this lap) vs who is on board when the lap ends
        const onBoard = b => g.men.filter(m => m.bus === b.id).map(m => m.id);
        for (const e of g.events){
          if (e.type === 'send' && !lap.has(e.bus)){ const b = g.buses[e.bus]; lap.set(e.bus, {before:new Set(onBoard(b).filter(id => g.men[id].state === 'seated' && !b.cheer.has(id)))}); }
          if (e.type === 'send' || e.type === 'cheerReplan') lap.forEach((q, id) => { const b = g.buses[id];
            q.pred = [...new Set([...b.cheer, ...onBoard(b).filter(x => !q.before.has(x))])].sort((x, y) => x - y); });
          if (e.type === 'jump' || e.type === 'tunnelIn'){ const q = lap.get(e.bus), b = g.buses[e.bus]; laps++;
            const got = onBoard(b).filter(x => !q.before.has(x)).sort((x, y) => x - y);
            if (!q || JSON.stringify(q.pred) !== JSON.stringify(got)) lapBad++; lap.delete(e.bus); }
        }
        g.events.length = 0; }
      miss += g.cheerMiss;
    }
    chk(!ck.warnings.length && ck.balanced && gr.result === 'win' && miss === 0 && lapBad === 0,
        `${lv.id}: clean checker, greedy wins, cheering = boarders in every lap of 12 bot games`, `greedy ${gr.sends} sends, ${laps} laps, ${miss + lapBad} mismatches`);
  }
}
console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
