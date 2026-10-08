// Tests for the shared core added with the editor: level format, layout builder, automatic
// placement, editor checks/warnings, linked buses, hidden stickmen, difficulty labels.
// Run: node tests/shared.test.js   (Node only, no dependencies)
const C = require('./core.js')();
const B = require('./baseline.json');
// The original (pre-compaction) layout of the built-in level: same stickmen and buses, the wide road
// and the "classic" yard.  It must still replay bit for bit against the pre-editor baseline, which shows
// the rules did not change; the geometry tests below that edit road points by index also use it.
const CL = require('./fixtures/level2-classic.json');
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
const kinds = lv => C.checkLevel(lv).warnings.map(w => w.kind);
const sim = (lv, dt) => C.simulate(lv, C.greedyPick, null, dt || C.SIM_DT);

console.log('format + compatibility');
{ const N = C.normalizeLevel(C.LEVEL_DATA);
  chk(N.format === 2 && N.road.points.length >= 3 && N.ramps.length === 5 && N.lanes.length === 3, 'built-in level is format 2 with road, 5 ramps and 3 lanes');
  const LC = C.buildLayout(CL), g = sim(CL), g60 = sim(CL, 1/60);
  chk(LC.Y.name === 'classic' && LC.ROAD.len === B.roadLen && JSON.stringify(LC.RAMPS.map(r => r.s)) === JSON.stringify(B.rampS), 'classic layout rebuilds the original road and boarding points bit for bit', LC.ROAD.len.toFixed(6));
  chk(g.moves.join(' ') === B.greedy.moves && g.t === B.greedy.t && g60.t === B.greedy60.t, 'classic layout: greedy replay is identical to the pre-editor baseline (headless and 60 Hz)', g.sends + ' sends, ' + g.t.toFixed(1) + ' s');
  let w = 0; for (let r = 0; r < 200; r++) if (C.simulate(CL, C.randomPick, C.mulberry32(1000 + r)).result === 'win') w++;
  chk(w === B.random, 'classic layout: random-bot result is identical to the baseline', w + '/200');
  const rt = C.normalizeLevel(JSON.parse(JSON.stringify(N)));
  chk(JSON.stringify(rt) === JSON.stringify(N), 'normalised levels survive a JSON round trip unchanged');
  const v1 = {seed:11, ramps: N.ramps.map(r => ({columns: r.columns})), lanes: N.lanes};
  const g1 = sim(v1);
  chk(g1.result === 'win' && C.buildLayout(v1).ROAD.len === C.ROAD.len, 'format-1 levels (stickmen + buses only) get the default layout and still play', g1.result);
  let threw = false; try { C.normalizeLevel({foo:1}); } catch (e) { threw = true; }
  chk(threw, 'malformed levels are rejected with an error');
}

console.log('layout builder');
{ const L = C.buildLayout(CL), R = L.ROAD, o = {};
  C.pathAt(R, R.portalS, o, 0);
  chk(Math.hypot(L.exit.x - o.x, L.exit.z - o.z) < 1e-9 && L.exit.x === o.x, 'exit tunnel sits at the road end (last control point)');
  const lv = clone(CL); delete lv.road.tail; lv.road.points[22] = {x:1.2, z:-23.2};
  const L2 = C.buildLayout(lv), p = lv.road.points, a = p[21], b = p[22], tl = Math.hypot(b.x - a.x, b.z - a.z);
  const tail = L2.ROAD.cps[L2.ROAD.cps.length - 1];
  chk(Math.abs(tail[0] - (b.x + (b.x - a.x)/tl*2.1)) < 1e-9 && Math.abs(tail[2] - (b.z + (b.z - a.z)/tl*2.1)) < 1e-9, 'without an explicit tail the tunnel continues 2.1 along the last tangent');
  chk(Math.abs(Math.atan2(L2.exit.dx, L2.exit.dz) - Math.atan2(b.x - a.x, b.z - a.z)) < 0.25, 'exit tunnel is oriented along the road\'s last tangent');
  chk(L.TUNNEL.side === 1 && L.TUNNEL.nx < 0, 'exit tunnel straight above the yard -> return tunnel on the right, mouth facing the bays');
  const left = clone(CL); delete left.road.tail; left.road.points.slice(-4).forEach(q => { q.x -= 3.2; });
  const Ll = C.buildLayout(left);
  chk(Ll.TUNNEL.side === -1 && Ll.TUNNEL.nx > 0 && Ll.TUNNEL.x < 0, 'exit tunnel on the left -> return tunnel at the left end, mouth facing the bays', 'x ' + Ll.TUNNEL.x);
  const right = clone(CL); delete right.road.tail; right.road.points.slice(-4).forEach(q => { q.x += 3.2; });
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
  const sv = clone(CL); sv.road = {points:[{x:0,z:-1.3,y:0},{x:0,z:-3.2},{x:0,z:-6.2,spiral:{r:1.4, side:1}},{x:-1.6,z:-10.2},{x:-0.4,z:-14.2},{x:0.6,z:-18.2},{x:0,z:-22.4}]};
  sv.ramps.forEach((r, i) => { delete r.cp; delete r.shape; r.at = 3 + i*4.2; });
  const Ls = C.buildLayout(sv), sp2 = Ls.ROAD.spirals[0];
  const y0 = Ls.ROAD.cps[sp2.cpFrom][1], y1 = Ls.ROAD.cps[sp2.cpTo][1];
  chk(Ls.ROAD.spirals.length === 1 && Math.abs(y1 - y0 - 1.35) < 1e-9, 'a spiral on any point loops back over itself 1.35 higher (overpass)', (y1 - y0).toFixed(2));
  chk(Ls.ROAD.cps.slice(sp2.cpTo + 1).every(c => c[1] >= y1 - 1e-9), 'after a spiral the road stays above the overpass (auto heights)');
  chk(!kinds(sv).includes('road-cross'), 'the crossing inside a spiral is not reported as a self-intersection', kinds(sv).join(',') || 'no warnings');
  const nosp = clone(sv); delete nosp.road.points[2].spiral; nosp.road.points.splice(3, 0, {x:1.4, z:-9.4}, {x:1.6, z:-7.0}, {x:-1.0, z:-7.2});
  chk(kinds(nosp).includes('road-cross'), 'the same crossing drawn by hand (no spiral) is reported');
  // ramps are boarded in road order whatever their order in the file
  const ro = clone(CL); ro.ramps.reverse();
  const Lr = C.buildLayout(ro);
  chk(Lr.RAMPS.map(r => r.src).join('') === '43210' && Lr.RAMPS.every((r, i) => !i || r.s >= Lr.RAMPS[i-1].s), 'ramps are sorted by boarding point along the road');
  chk(sim(ro).moves.join(' ') === B.greedy.moves, 'reordering ramps in the file does not change play');
  // explicit boarding point + rows/cols
  const ex = clone(CL); ex.ramps[0] = {at:5.0, side:1, rows:3, columns:[['red','blue',null],[null,null,null]]};
  const Le = C.buildLayout(ex), r0 = Le.RAMPS.find(r => r.src === 0);
  chk(Math.abs(r0.s - 5.0) < 1e-9 && r0.cols === 2 && r0.rows === 3 && r0.slots.length === 2 && r0.slots[0].length === 3, 'a ramp with "at", custom rows and columns builds its grid');
}

console.log('stickmen cells: empty and hidden');
{ const lv = clone(CL); lv.ramps[0].columns[0] = [null, 'red', null, 'blue', 'red', 'red', null, 'green', 'yellow', null];
  const g = C.createGame(lv, {}), col = g.ramps[g.L.RAMPS.findIndex(r => r.src === 0)].cols[0].map(id => g.men[id].color);
  chk(col.join(',') === 'red,blue,red,red,green,yellow', 'empty cells are skipped: people stand from the front of the column', col.join(','));
  const hid = clone(CL); hid.ramps.forEach(r => r.columns.forEach(c => c.forEach((x, i) => { if (i > 0 && i % 2) c[i] = '?' + x; })));
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
  const cross = clone(CL); delete cross.road.points[8].spiral; delete cross.road.tail;
  cross.road.points.splice(9, 0, {x:1.6, z:-10.6}, {x:1.8, z:-8.2}, {x:-1.6, z:-8.4});
  chk(kinds(cross).includes('road-cross'), 'a road crossing itself outside a spiral is reported', kinds(cross).join(','));
  const wideR = clone(C.LEVEL_DATA); wideR.road.points[10].x = 7.5;
  const kw = C.checkLevel(wideR).warnings.filter(w => w.kind === 'zone-road');
  chk(C.buildLayout(wideR).CAM === C.SCREEN_CAM && kw.length > 0 && kw.every(w => typeof w.x === 'number'), 'a road leaving the target zone is reported with a position (the camera never moves)');
  const off = clone(C.LEVEL_DATA); off.road.points[off.road.points.length - 1].z = -30; delete off.road.tail;
  chk(kinds(off).includes('zone-exit'), 'an exit tunnel beyond the top of the target zone is reported');
  const wr = clone(C.PRESETS['crowded-rush']); wr.ramps[0].tilt = 0;           // the same ramp, laid flat: its far end leaves the screen
  chk(kinds(wr).includes('zone-ramp'), 'a ramp reaching out of the target zone is reported');
  const tight = clone(CL); delete tight.road.tail; tight.road.points.splice(5, 0, {x:1.6, z:-6.0}, {x:-1.4, z:-6.3});
  chk(kinds(tight).includes('road-tight'), 'a curve too tight for a 12-seat bus is reported');
  chk(!kinds(C.LEVEL_DATA).some(k => k.startsWith('road')), 'the built-in road has no road warnings (its loop is a spiral)');
  const rr = clone(CL); rr.ramps[1] = Object.assign({}, rr.ramps[1], {cp:3, side:1});
  chk(kinds(rr).includes('ramp-ramp'), 'two ramps on the same spot are reported as overlapping');
  const rd = clone(CL); rd.ramps[0].shape = [[0.9, -5.4], [0.2, -6.8], [-0.6, -8.4]];
  chk(kinds(rd).includes('ramp-road'), 'a ramp laid over the road is reported');
  const L = C.buildLayout(CL), s = L.ROAD.spirals[0];
  const rs = clone(CL); rs.ramps[1] = Object.assign({}, rs.ramps[1], {at:(s.s0 + s.s1)/2}); delete rs.ramps[1].cp;
  chk(kinds(rs).includes('ramp-spiral'), 'a boarding point on a spiral overpass is reported');
  const ln = clone(C.LEVEL_DATA); ln.lanes[0][0].link = 'A'; ln.lanes[0][2].link = 'A';
  const lv_ = clone(C.LEVEL_DATA); lv_.lanes[0][0].link = 'V'; lv_.lanes[0][1].link = 'V';
  chk(kinds(ln).includes('link-shape') && !kinds(lv_).some(k => k.startsWith('link')), 'connected buses in one lane must follow each other (a vertical pair is fine, a gap is reported)');
  chk(C.difficulty(0.46) === 'Easy' && C.difficulty(0.45) === 'Medium' && C.difficulty(0.15) === 'Medium' && C.difficulty(0.149) === 'Hard' &&
      C.difficulty(0.05) === 'Hard' && C.difficulty(0.049) === 'Very Hard', 'difficulty labels: Easy >45%, Medium 15-45%, Hard 5-15%, Very Hard <5%');
  const t = C.testLevel(CL, 200);
  chk(t.greedy.result === 'win' && t.greedy.sends === 52 && t.wins === B.random && t.label === 'Medium', 'the editor "Test" (greedy + 200 random) reports WIN, 52 sends, ' + B.random + '/200, Medium (classic layout)');
}

console.log('compact layout (built-in level)');
{ const L = C.buildLayout(C.LEVEL_DATA), LC = C.buildLayout(CL), N = C.normalizeLevel(C.LEVEL_DATA), NC = C.normalizeLevel(CL);
  chk(L.Y.name === 'compact' && LC.Y.name === 'classic' && C.normalizeLevel({ramps:[], lanes:[]}).yard === undefined, 'levels default to the compact yard; "yard": "classic" selects the original one');
  // columns in the order a bus takes them (nearest the road first): identical in both layouts
  const prio = (Lx, Nx) => JSON.stringify(Lx.RAMPS.map(r => r.colOrder.map(c => Nx.ramps[r.src].columns[c])));
  chk(prio(L, N) === prio(LC, NC) && JSON.stringify(N.lanes) === JSON.stringify(NC.lanes) && L.RAMPS.map(r => r.src).join('') === '01234',
      'same stickmen, same buses, same ramp order and the same column priority as the classic layout');
  chk(L.ROAD.len < LC.ROAD.len*0.6, 'the compact road is much shorter', L.ROAD.len.toFixed(1) + ' vs ' + LC.ROAD.len.toFixed(1));
  const g = sim(C.LEVEL_DATA), g60 = sim(C.LEVEL_DATA, 1/60), t = C.testLevel(C.LEVEL_DATA, 200);
  chk(g.result === 'win' && g60.result === 'win' && t.label === 'Medium', 'greedy wins at 30 and 60 Hz; random bot stays Medium', `${g.sends} sends, ${g.t.toFixed(1)} s; random ${t.wins}/200`);
  // framing: everything fits the 900x1950 design screen (390x844 phone), below the top bar
  const cam = L.CAM, pr = (x, y, z) => C.project(x, y, z, cam), k = 390/900, inX = u => u >= 0 && u <= 900;
  const yardOk = [0, 1.18, 2.6, 4, 4.6].every(z => inX(pr(-(L.Y.X_SIDE + 0.49), 0, z)[0]) && inX(pr(L.Y.X_SIDE + 0.49, 0, z)[0]));
  const laneOk = L.Y.LANE_X.every(x => { const [u, v] = pr(x + 0.49, 0, C.laneSlotZ(C.busLen(12)) + C.busLen(12)/2); return inX(u) && v <= 1950; });
  let roadOk = true; for (let i = 0; i < L.ROAD.n; i += 4) if (L.ROAD.cum[i] <= L.ROAD.portalS){ const [u, v] = pr(L.ROAD.P[i*3], L.ROAD.P[i*3+1], L.ROAD.P[i*3+2]); if (!inX(u) || v < 120) roadOk = false; }
  let rampOk = true; L.RAMPS.forEach(r => r.slots.forEach(cs => cs.forEach(q => { const [u, v] = pr(q.x, q.y + 0.8, q.z); if (u < 10 || u > 890 || v < 120) rampOk = false; })));
  chk(yardOk && laneOk && roadOk && rampOk, 'camera framing: side lanes, front queue buses, road and every ramp stickman are on screen');
  // the drawn yard: bays inside the static row, an 8-seat bus there at 0.8 of its front-of-queue size
  const H = 1950, len8 = C.busLen(8), shown = (x, z, len) => { const s = C.dispScale(z), [a, b] = [C.dispPoint(x, z - s*len/2), C.dispPoint(x, z + s*len/2)];
    return (pr(b[0], 0, b[1])[1] - pr(a[0], 0, a[1])[1])*k; };
  const bayTop = pr(0, 0, C.dispZ(C.Z_BAY_TOP))[1]/H, bayBot = pr(0, 0, C.dispZ(C.Z_BAY_BOT))[1]/H;
  chk(bayTop > C.SCREEN.TARGET_BOT && bayBot < C.SCREEN.STATIC_BOT, 'bays are drawn inside the static row', (bayTop*100).toFixed(1) + '% - ' + (bayBot*100).toFixed(1) + '%');
  const inBay = Math.min(...L.Y.BAY_X.map(x => shown(x, C.parkZ(len8), len8))), front = shown(0, C.laneSlotZ(len8), len8);
  chk(Math.abs(C.dispScale(C.parkZ(len8)) - 0.8) < 1e-9 && C.dispScale(C.laneSlotZ(len8)) === 1 && inBay > 30, 'parked buses are drawn at 0.8 (front of the queue at full size)', inBay.toFixed(1) + ' px vs ' + front.toFixed(1) + ' px');
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
  const g3 = C.createGame(lv3, {}); for (let i = 0; i < 4; i++) C.tapLane(g3, 0);
  chk(g3.counter === 4, 'setup: road 4/5', g3.counter + '/5');
  const r3 = C.tapLane(g3, 1);
  chk(r3 === 'refused' && g3.buses[g3.lanes[1][0]].state === 'lane' && g3.counter === 4, 'refused when the road has room for only one of the pair (queue buses never park)');
  const gb = C.createGame(lv2, {}); const acts = C.legalSends(gb);
  chk(!acts.some(x => x.kind === 'lane' && x.idx === 0), 'bots do not consider a linked bus until its partners are at the front');
  const gr = sim(lv);
  chk(['win', 'fail'].includes(gr.result), 'a level with links still plays to an end with the bots', gr.result);
}

console.log('\nbundled levels');
{
  const fs = require('fs'), files = fs.readdirSync(__dirname + '/../levels').filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  chk(files.length >= 2 && files.every(id => JSON.stringify(C.PRESETS[id]) === JSON.stringify(require('../levels/' + id + '.json'))) && Object.keys(C.PRESETS).length === files.length,
      'every levels/<id>.json is bundled in core unchanged (tools/sync-presets.js)', files.join(', '));
  // every bundled level (and Level 2) fits the target zone of the one fixed camera
  const hr = 0.156, hy = 0.78 - hr, body = [[0.07,0,0.07], [-0.07,0,-0.07], [0,hy+hr,0], [0,hy,hr], [0,hy,-hr], [0,hy+hr*0.7,-hr*0.7]];
  const manPx = q => { const ys = body.map(b => C.project(q.x + b[0], q.y + b[1], q.z + b[2], C.SCREEN_CAM)[1]); return (Math.max(...ys) - Math.min(...ys))*390/900; };
  for (const [id, lv] of [['Level 2', C.LEVEL_DATA]].concat(Object.entries(C.PRESETS))){
    const ck = C.checkLevel(lv), Lx = C.buildLayout(lv); let mn = 1e9; Lx.RAMPS.forEach(r => r.slots.forEach(cs => cs.forEach(q => { mn = Math.min(mn, manPx(q)); })));
    chk(!ck.warnings.length && ck.balanced && Lx.CAM === C.SCREEN_CAM && mn >= 16, id + ': inside the target zone, no warnings, stickmen >= 16 px', (ck.warnings.map(w => w.kind).join(',') || 'clean') + ', smallest stickman ' + mn.toFixed(1) + ' px');
  }
  const CR = require('../levels/crowded-rush.json');
  const ck = C.checkLevel(CR), L = C.buildLayout(CR);
  chk(!ck.warnings.length && ck.balanced, 'Crowded Rush: no layout warnings, seats match stickmen', ck.warnings.map(w => w.kind).join(',') || 'clean');
  chk(CR.ramps.length === 4 && CR.ramps.every(r => r.columns.length === 6 && r.rows === 15 && r.tilt >= 30 && r.tilt <= 35), 'Crowded Rush: 4 ramps of 6 x 15, tilted 30-35 degrees');
  // every ramp points outward and up; left ramps sit left of the road, right ramps right
  const outward = L.RAMPS.every(r => { const a = r.ctrl[0], b = r.ctrl[r.ctrl.length-1], dx = b[0]-a[0], dz = b[1]-a[1];
    return dz < 0 && Math.sign(dx) === Math.sign(a[0] - L.ROAD.P[0]) && Math.abs(Math.atan2(-dz, Math.abs(dx))*180/Math.PI - CR.ramps[r.src].tilt) < 0.5; });
  chk(outward, 'Crowded Rush: each ramp runs diagonally outward and up at its tilt');
  // the whole layout is on screen, stickmen stay readable
  const cam = L.CAM, k = 390/cam.w; let off = 0, minPx = 1e9;
  L.RAMPS.forEach(r => r.slots.forEach(cs => cs.forEach(q => {      // on-screen height of a stickman (feet to the top of the head)
    const ys = body.map(b => C.project(q.x + b[0], q.y + b[1], q.z + b[2], cam)), f = ys[0];
    if (f[0] < 0 || f[0] > cam.w || Math.min(...ys.map(v => v[1])) < 0) off++;
    minPx = Math.min(minPx, (Math.max(...ys.map(v => v[1])) - Math.min(...ys.map(v => v[1])))*k); })));
  chk(off === 0 && cam === C.SCREEN_CAM && minPx >= 16, 'Crowded Rush: the fixed camera shows every stickman on a 390 x 844 screen, stickmen >= 16 px tall', 'smallest stickman ' + minPx.toFixed(1) + ' px');
  const g = sim(CR);
  chk(g.result === 'win', 'Crowded Rush: the greedy bot wins', g.sends + ' sends, ' + g.t.toFixed(1) + ' s');
  // editor default ramp: a tilted platform with no shape gets its length from rows and columns
  const lv = clone(CR); delete lv.ramps[0].cp; lv.ramps[0].at = 3; lv.ramps[0].rows = 8; lv.ramps[0].columns = lv.ramps[0].columns.map(c => c.slice(0, 8)).slice(0, 4);
  const r0 = C.buildLayout(lv).RAMPS[0];
  chk(r0.length < L.RAMPS[0].length && r0.halfW < L.RAMPS[0].halfW && r0.slots.length === 4 && r0.slots[0].length === 8, 'a tilted ramp resizes itself to its columns and rows');
}

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`);
process.exitCode = fail ? 1 : 0;
