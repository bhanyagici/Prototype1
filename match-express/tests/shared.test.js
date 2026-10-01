// Tests for the shared core added with the editor: level format, layout builder, automatic
// placement, editor checks/warnings, linked buses, hidden stickmen, difficulty labels.
// Run: node tests/shared.test.js   (Node only, no dependencies)
const C = require('./core.js')();
const B = require('./baseline.json');
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
const kinds = lv => C.checkLevel(lv).warnings.map(w => w.kind);
const sim = (lv, dt) => C.simulate(lv, C.greedyPick, null, dt || C.SIM_DT);

console.log('format + compatibility');
{ const N = C.normalizeLevel(C.LEVEL_DATA);
  chk(N.format === 2 && N.road.points.length === 23 && N.ramps.length === 5 && N.lanes.length === 3, 'built-in level is format 2 with road, 5 ramps and 3 lanes');
  const g = sim(C.LEVEL_DATA), g60 = sim(C.LEVEL_DATA, 1/60);
  chk(C.ROAD.len === B.roadLen && JSON.stringify(C.RAMPS.map(r => r.s)) === JSON.stringify(B.rampS), 'data-driven layout rebuilds the original road and boarding points bit for bit', C.ROAD.len.toFixed(6));
  chk(g.moves.join(' ') === B.greedy.moves && g.t === B.greedy.t && g60.t === B.greedy60.t, 'greedy replay is identical to the pre-editor baseline (headless and 60 Hz)', g.sends + ' sends, ' + g.t.toFixed(1) + ' s');
  let w = 0; for (let r = 0; r < 200; r++) if (C.simulate(C.LEVEL_DATA, C.randomPick, C.mulberry32(1000 + r)).result === 'win') w++;
  chk(w === B.random, 'random-bot result is identical to the baseline', w + '/200');
  const rt = C.normalizeLevel(JSON.parse(JSON.stringify(N)));
  chk(JSON.stringify(rt) === JSON.stringify(N), 'normalised levels survive a JSON round trip unchanged');
  const v1 = {seed:11, ramps: N.ramps.map(r => ({columns: r.columns})), lanes: N.lanes};
  const g1 = sim(v1);
  chk(g1.result === 'win' && C.buildLayout(v1).ROAD.len === C.ROAD.len, 'format-1 levels (stickmen + buses only) get the default layout and still play', g1.result);
  let threw = false; try { C.normalizeLevel({foo:1}); } catch (e) { threw = true; }
  chk(threw, 'malformed levels are rejected with an error');
}

console.log('layout builder');
{ const L = C.buildLayout(C.LEVEL_DATA), R = L.ROAD, o = {};
  C.pathAt(R, R.portalS, o, 0);
  chk(Math.hypot(L.exit.x - o.x, L.exit.z - o.z) < 1e-9 && L.exit.x === o.x, 'exit tunnel sits at the road end (last control point)');
  const lv = clone(C.LEVEL_DATA); delete lv.road.tail; lv.road.points[22] = {x:1.2, z:-23.2};
  const L2 = C.buildLayout(lv), p = lv.road.points, a = p[21], b = p[22], tl = Math.hypot(b.x - a.x, b.z - a.z);
  const tail = L2.ROAD.cps[L2.ROAD.cps.length - 1];
  chk(Math.abs(tail[0] - (b.x + (b.x - a.x)/tl*2.1)) < 1e-9 && Math.abs(tail[2] - (b.z + (b.z - a.z)/tl*2.1)) < 1e-9, 'without an explicit tail the tunnel continues 2.1 along the last tangent');
  chk(Math.abs(Math.atan2(L2.exit.dx, L2.exit.dz) - Math.atan2(b.x - a.x, b.z - a.z)) < 0.25, 'exit tunnel is oriented along the road\'s last tangent');
  chk(L.TUNNEL.side === 1 && L.TUNNEL.nx < 0, 'exit tunnel straight above the yard -> return tunnel on the right, mouth facing the bays');
  const left = clone(C.LEVEL_DATA); delete left.road.tail; left.road.points.slice(-4).forEach(q => { q.x -= 3.2; });
  const Ll = C.buildLayout(left);
  chk(Ll.TUNNEL.side === -1 && Ll.TUNNEL.nx > 0 && Ll.TUNNEL.x < 0, 'exit tunnel on the left -> return tunnel at the left end, mouth facing the bays', 'x ' + Ll.TUNNEL.x);
  const right = clone(C.LEVEL_DATA); delete right.road.tail; right.road.points.slice(-4).forEach(q => { q.x += 3.2; });
  chk(C.buildLayout(right).TUNNEL.side === 1, 'exit tunnel on the right -> return tunnel on the right');
  // a bus returning through a left tunnel parks normally
  const g = C.createGame(left, {}); C.tapLane(g, 0); let parked = false;
  for (let i = 0; i < 60*90 && !parked; i++){ C.step(g, 1/60); parked = g.events.some(e => e.type === 'park'); g.events.length = 0; }
  chk(parked || g.buses.some(b => b.state === 'jump'), 'a lap through the left return tunnel ends parked in a bay (or filled)');
  const gaps = L.pillars.slice(1).map((q, i) => +(q.s - L.pillars[i].s).toFixed(2));
  chk(L.pillars.length > 10 && gaps.every(d => Math.abs(d % 2.25) < 1e-6 || Math.abs(d % 2.25 - 2.25) < 1e-6), 'pillars sit at even 2.25 spacing along the road', L.pillars.length + ' pillars');
  const sp = R.spirals[0];
  const underOverpass = L.pillars.filter(q => q.s > sp.s0 && q.s < sp.s0 + 1.2);
  chk(R.spirals.length === 1 && underOverpass.length === 0, 'no pillar is placed through the lower road under the spiral overpass');
  // a spiral toggled on a point of a plain road builds a loop with an overpass
  const sv = clone(C.LEVEL_DATA); sv.road = {points:[{x:0,z:-1.3,y:0},{x:0,z:-3.2},{x:0,z:-6.2,spiral:{r:1.4, side:1}},{x:-1.6,z:-10.2},{x:-0.4,z:-14.2},{x:0.6,z:-18.2},{x:0,z:-22.4}]};
  sv.ramps.forEach((r, i) => { delete r.cp; delete r.shape; r.at = 3 + i*4.2; });
  const Ls = C.buildLayout(sv), sp2 = Ls.ROAD.spirals[0];
  const y0 = Ls.ROAD.cps[sp2.cpFrom][1], y1 = Ls.ROAD.cps[sp2.cpTo][1];
  chk(Ls.ROAD.spirals.length === 1 && Math.abs(y1 - y0 - 1.35) < 1e-9, 'a spiral on any point loops back over itself 1.35 higher (overpass)', (y1 - y0).toFixed(2));
  chk(Ls.ROAD.cps.slice(sp2.cpTo + 1).every(c => c[1] >= y1 - 1e-9), 'after a spiral the road stays above the overpass (auto heights)');
  chk(!kinds(sv).includes('road-cross'), 'the crossing inside a spiral is not reported as a self-intersection', kinds(sv).join(',') || 'no warnings');
  const nosp = clone(sv); delete nosp.road.points[2].spiral; nosp.road.points.splice(3, 0, {x:1.4, z:-9.4}, {x:1.6, z:-7.0}, {x:-1.0, z:-7.2});
  chk(kinds(nosp).includes('road-cross'), 'the same crossing drawn by hand (no spiral) is reported');
  // ramps are boarded in road order whatever their order in the file
  const ro = clone(C.LEVEL_DATA); ro.ramps.reverse();
  const Lr = C.buildLayout(ro);
  chk(Lr.RAMPS.map(r => r.src).join('') === '43210' && Lr.RAMPS.every((r, i) => !i || r.s >= Lr.RAMPS[i-1].s), 'ramps are sorted by boarding point along the road');
  chk(sim(ro).moves.join(' ') === B.greedy.moves, 'reordering ramps in the file does not change play');
  // explicit boarding point + rows/cols
  const ex = clone(C.LEVEL_DATA); ex.ramps[0] = {at:5.0, side:1, rows:3, columns:[['red','blue',null],[null,null,null]]};
  const Le = C.buildLayout(ex), r0 = Le.RAMPS.find(r => r.src === 0);
  chk(Math.abs(r0.s - 5.0) < 1e-9 && r0.cols === 2 && r0.rows === 3 && r0.slots.length === 2 && r0.slots[0].length === 3, 'a ramp with "at", custom rows and columns builds its grid');
}

console.log('stickmen cells: empty and hidden');
{ const lv = clone(C.LEVEL_DATA); lv.ramps[0].columns[0] = [null, 'red', null, 'blue', 'red', 'red', null, 'green', 'yellow', null];
  const g = C.createGame(lv, {}), col = g.ramps[g.L.RAMPS.findIndex(r => r.src === 0)].cols[0].map(id => g.men[id].color);
  chk(col.join(',') === 'red,blue,red,red,green,yellow', 'empty cells are skipped: people stand from the front of the column', col.join(','));
  const hid = clone(C.LEVEL_DATA); hid.ramps.forEach(r => r.columns.forEach(c => c.forEach((x, i) => { if (i > 0 && i % 2) c[i] = '?' + x; })));
  const gh = sim(hid);
  chk(gh.moves.join(' ') === B.greedy.moves && gh.t === B.greedy.t, 'hidden stickmen are visual only: identical play', gh.result);
  const g2 = C.createGame(hid, {}); let reveals = 0; let think = 0;
  for (let i = 0; i < 60*60; i++){ think -= 1/60; if (think <= 0){ think += C.BOT_THINK; const a = C.greedyPick(g2); if (a) C.applyAction(g2, a); }
    C.step(g2, 1/60); reveals += g2.events.filter(e => e.type === 'revealMan').length; g2.events.length = 0; }
  chk(reveals > 0 && g2.men.filter(m => m.state === 'ramp').every(m => !m.hidden || m.revealed || g2.ramps[m.ramp].cols[m.col][0] !== m.id), 'a hidden stickman is revealed when it reaches the front row', reveals + ' reveals');
  const ck = C.checkLevel(hid);
  chk(ck.hiddenMen > 0 && ck.balanced, 'checks count hidden stickmen with their real colour');
}

console.log('editor checks and warnings');
{ const ck = C.checkLevel(C.LEVEL_DATA);
  chk(ck.ok && ck.totalMen === 192 && ck.totalSeats === 192 && ck.buses === 26 && ck.sizes[4] === 5 && ck.sizes[12] === 5, 'built-in level: balanced, 192/192, 26 buses, no warnings', JSON.stringify(ck.sizes));
  const ub = clone(C.LEVEL_DATA); ub.lanes[0].push({color:'red', cap:4});
  const cu = C.checkLevel(ub), red = cu.perColor.find(p => p.color === 'red');
  chk(!cu.balanced && !red.ok && red.seats === 28 && red.men === 24 && cu.perColor.filter(p => !p.ok).length === 1, 'an extra bus makes exactly that colour unbalanced');
  const cross = clone(C.LEVEL_DATA); delete cross.road.points[8].spiral; delete cross.road.tail;
  cross.road.points.splice(9, 0, {x:1.6, z:-10.6}, {x:1.8, z:-8.2}, {x:-1.6, z:-8.4});
  chk(kinds(cross).includes('road-cross'), 'a road crossing itself outside a spiral is reported', kinds(cross).join(','));
  const off = clone(C.LEVEL_DATA); delete off.road.tail; off.road.points[14].x = 11;
  const ko = C.checkLevel(off).warnings.filter(w => w.kind === 'road-offscreen');
  chk(ko.length > 0 && ko.every(w => typeof w.x === 'number'), 'a road leaving the screen area is reported with a position');
  const tight = clone(C.LEVEL_DATA); delete tight.road.tail; tight.road.points.splice(5, 0, {x:1.6, z:-6.0}, {x:-1.4, z:-6.3});
  chk(kinds(tight).includes('road-tight'), 'a curve too tight for a 12-seat bus is reported');
  chk(!kinds(C.LEVEL_DATA).some(k => k.startsWith('road')), 'the built-in road has no road warnings (its loop is a spiral)');
  const rr = clone(C.LEVEL_DATA); rr.ramps[1] = Object.assign({}, rr.ramps[1], {cp:3, side:1});
  chk(kinds(rr).includes('ramp-ramp'), 'two ramps on the same spot are reported as overlapping');
  const rd = clone(C.LEVEL_DATA); rd.ramps[0].shape = [[0.9, -5.4], [0.2, -6.8], [-0.6, -8.4]];
  chk(kinds(rd).includes('ramp-road'), 'a ramp laid over the road is reported');
  const L = C.buildLayout(C.LEVEL_DATA), s = L.ROAD.spirals[0];
  const rs = clone(C.LEVEL_DATA); rs.ramps[1] = Object.assign({}, rs.ramps[1], {at:(s.s0 + s.s1)/2}); delete rs.ramps[1].cp;
  chk(kinds(rs).includes('ramp-spiral'), 'a boarding point on a spiral overpass is reported');
  const ln = clone(C.LEVEL_DATA); ln.lanes[0][0].link = 'A'; ln.lanes[0][1].link = 'A';
  chk(kinds(ln).includes('link-lane'), 'linked buses in the same lane are reported (they could never leave together)');
  chk(C.difficulty(0.46) === 'Easy' && C.difficulty(0.45) === 'Medium' && C.difficulty(0.15) === 'Medium' && C.difficulty(0.149) === 'Hard' &&
      C.difficulty(0.05) === 'Hard' && C.difficulty(0.049) === 'Very Hard', 'difficulty labels: Easy >45%, Medium 15-45%, Hard 5-15%, Very Hard <5%');
  const t = C.testLevel(C.LEVEL_DATA, 200);
  chk(t.greedy.result === 'win' && t.greedy.sends === 52 && t.wins === B.random && t.label === 'Medium', 'the editor "Test" (greedy + 200 random) reports WIN, 52 sends, ' + B.random + '/200, Medium');
}

console.log('linked buses');
{ const lv = clone(C.LEVEL_DATA); lv.lanes[0][0].link = 'A'; lv.lanes[1][0].link = 'A';
  const g = C.createGame(lv, {}), a = g.buses[g.lanes[0][0]], b = g.buses[g.lanes[1][0]];
  const r = C.tapLane(g, 0);
  chk(r === 'road' && a.state === 'toRoad' && b.state === 'toRoad' && g.toRoad === 2, 'tapping a linked bus sends every linked bus with it');
  const lv2 = clone(C.LEVEL_DATA); lv2.lanes[0][0].link = 'B'; lv2.lanes[1][2].link = 'B';
  const g2 = C.createGame(lv2, {}), r2 = C.tapLane(g2, 0);
  chk(r2 === 'refused' && g2.toRoad === 0 && g2.events.some(e => e.type === 'refuse'), 'refused (shake) while a linked partner is not at the front of its lane');
  const lv3 = clone(C.LEVEL_DATA); lv3.lanes[1][0].link = 'C'; lv3.lanes[2][0].link = 'C';
  const g3 = C.createGame(lv3, {}); for (let i = 0; i < 9; i++) C.tapLane(g3, 0);
  chk(g3.toRoad + g3.counter === 5 && [0,1,2,3,4].filter(k => g3.bays[k] < 0 && g3.bayRes[k] < 0).length === 1, 'setup: road full, one bay left');
  const r3 = C.tapLane(g3, 1);
  chk(r3 === 'refused' && g3.buses[g3.lanes[1][0]].state === 'lane', 'refused when the pair has nowhere to go (only one bay for two buses)');
  const gb = C.createGame(lv2, {}); const acts = C.legalSends(gb);
  chk(!acts.some(x => x.kind === 'lane' && x.idx === 0), 'bots do not consider a linked bus until its partners are at the front');
  const gr = sim(lv);
  chk(['win', 'fail'].includes(gr.result), 'a level with links still plays to an end with the bots', gr.result);
}

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`);
process.exitCode = fail ? 1 : 0;
