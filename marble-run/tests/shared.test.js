// The shared core's level format, checker and helpers.
//   node tests/shared.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const clone = o => JSON.parse(JSON.stringify(o));

console.log('level format');
{ const N = C.normalizeLevel(clone(C.LEVEL_DATA));
  chk(N.format === 1 && N.type === 'marble-run-level' && N.id === 'marble-run' && N.laneCount === 3 && Array.isArray(N.slide.points) && N.trays.length === 4,
    'the built-in level normalizes to format 1, type marble-run-level, with its slide, trays and lanes', `${N.format} ${N.type} ${N.trays.length} trays`);
  chk(JSON.stringify(C.normalizeLevel(clone(N))) === JSON.stringify(N), 'normalizing twice changes nothing'); }
{ const raw = {name:'x', junk:1, slide:{points:[{x:'0', z:'-10', extra:3}, {x:1, z:-6, spiral:{r:9, side:5}}, {x:0, z:-5}], gaps:[{at:3, len:9}], toys:[{kind:'loop', at:4}, {kind:'nope', at:2}]},
    trays:[{at:2, side:-1, columns:[['red', '?blue', 'nope', null]], spread:0.3, crates:[{col:0, row:1, lock:'A'}], dispensers:[{col:0, row:2, color:'pink', count:'3'}]}],
    lanes:[[{color:'red', size:4, hidden:1}, {color:'red', n:6}, {color:'red', size:5}, {color:'mauve', size:4}], [], [], [], [], [], []], marbleScale:7};
  const N = C.normalizeLevel(raw);
  chk(!('junk' in N) && N.slide.points[0].x === 0 && !('extra' in N.slide.points[0]) && N.slide.points[1].spiral.r === 1.6 && N.slide.points[1].spiral.side === 1,
    'unknown fields are dropped, numbers become numbers, a spiral\'s radius is kept in range');
  chk(N.slide.gaps[0].len === C.GAP_LEN[1] && N.slide.toys.length === 1 && N.slide.toys[0].len === C.TOY_KINDS.loop, 'gaps keep their length in range; unknown toy kinds are dropped, a toy without a length gets its kind\'s');
  chk(N.trays[0].columns[0].join() === 'red,?blue,,' && N.trays[0].rows === 4 && !('spread' in N.trays[0]) && N.trays[0].crates[0].lock === 'A' && N.trays[0].dispensers[0].count === 3,
    'cells: "red", "?red" (hidden) or empty; a spread is dropped (regular grids); crates and dispensers are kept', JSON.stringify(N.trays[0].columns[0]));
  chk(N.lanes.length === 5 && N.laneCount === 5 && N.lanes[0].map(b => b.color + b.size + (b.hidden ? '?' : '')).join() === 'red4?,red6' && N.marbleScale === C.MARBLE_SCALE_MAX,
    'lanes: 2-5 of them; boxes of 4, 6, 8 or 12 holes in a known colour (the prototype\'s "n" is read as the size); marbleScale clamped', JSON.stringify(N.lanes[0])); }

console.log('checker');
{ const ck = C.checkLevel(C.LEVEL_DATA);
  chk(ck.ok && ck.balanced && ck.totalMarbles === ck.totalHoles && ck.totalMarbles === 72, 'the built-in level is balanced and free of warnings', `${ck.totalMarbles} marbles, ${ck.boxes} boxes`);
  const lv = clone(C.LEVEL_DATA); lv.lanes[0][0].size = lv.lanes[0][0].size === 4 ? 6 : 4;
  const c2 = C.checkLevel(lv), bad = c2.perColor.filter(p => !p.ok);
  chk(!c2.balanced && bad.length === 1 && bad[0].color === lv.lanes[0][0].color, 'level math: the marbles of each colour must equal the holes of that colour\'s boxes', JSON.stringify(bad)); }
{ const lv = clone(C.LEVEL_DATA); lv.trays = []; chk(C.checkLevel(lv).warnings.some(w => w.kind === 'no-trays'), 'a level without trays is reported'); }
{ const ws = []; for (const lv of [C.LEVEL_DATA, ...Object.values(C.PRESETS)]) for (const w of C.checkLevel(lv).warnings) ws.push(w);
  const lv = clone(C.LEVEL_DATA); lv.trays[1].at = lv.trays[0].at; const w2 = C.checkLevel(lv).warnings;
  chk(!ws.length && w2.some(w => w.kind === 'tray-tray') && w2.every(w => w.x != null && isFinite(w.z)),
    'two trays on one spot are reported, each warning with a world position the editor can mark', w2.map(w => w.kind).join()); }

console.log('helpers');
chk(C.difficulty(0.46) === 'Easy' && C.difficulty(0.45) === 'Medium' && C.difficulty(0.15) === 'Medium' && C.difficulty(0.149) === 'Hard' &&
    C.difficulty(0.05) === 'Hard' && C.difficulty(0.049) === 'Very Hard', 'difficulty labels: Easy >45%, Medium 15-45%, Hard 5-15%, Very Hard <5%');
{ const t = C.testLevel(C.LEVEL_DATA, 40);
  chk(t.greedy.result === 'win' && t.runs === 40 && t.label === C.difficulty(t.rate), 'testLevel: the greedy bot\'s game and the random bots\' win rate, with its label', `${t.greedy.result} ${t.greedy.t.toFixed(1)} s, ${t.wins}/40 ${t.label}`); }
{ const a = C.simulate(C.LEVEL_DATA, C.randomPick, C.mulberry32(9)), b = C.simulate(C.LEVEL_DATA, C.randomPick, C.mulberry32(9));
  chk(JSON.stringify(a) === JSON.stringify(b), 'simulate is deterministic for a seed'); }
{ const s = C.autoMarbleScale(C.LEVEL_DATA); chk(s >= 1 && s <= C.MARBLE_SCALE_MAX, 'autoMarbleScale picks the largest marbles the level\'s room allows', s); }
chk(C.mulberry32(1)() === C.mulberry32(1)() && C.COLORS.length === 8 && C.COLORS.every(c => /^#[0-9A-F]{6}$/.test(C.HEX[c])), '8 colours, each with its hex');

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
