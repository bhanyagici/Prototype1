// Connected groups leave in single file, like a train: the leading bus (the group's first member) takes its own route,
// and every other member first moves into that route behind it, then follows it exactly - from the queue onto the
// collector road, up the same side lane, onto the entry road and into the main road; from the bays up onto the entry
// road and into the main road.  Every level with connected buses (showcase, funnel, demos) and a 2-lane pair are
// played by the greedy bot and the random bot; every group sent from the queue or the bays is watched step by step.
//   node tests/groups.test.js
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const R = path.join(__dirname, '..', 'levels');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const levels = [...fs.readdirSync(path.join(R, 'showcase')).filter(f => f.endsWith('.json') && f !== 'showcase-order.json').map(f => read(path.join(R, 'showcase', f))),
  ...fs.readdirSync(path.join(R, 'funnel')).filter(f => /^f\d\d\.json$/.test(f)).map(f => read(path.join(R, 'funnel', f))),
  ...fs.readdirSync(R).filter(f => /^demo_.*\.json$/.test(f)).map(f => read(path.join(R, f)))].filter(lv => lv.lanes && lv.lanes.flat().some(b => b.link));
{ const lv = read(path.join(R, 'funnel', 'f22.json')); lv.id = 'two-lane-pair';      // a 2-lane level with a pair across its lanes
  lv.lanes[0][1].link = 'P'; lv.lanes[1][1].link = 'P'; levels.push(lv); }

// distance from a point to a route (a path made by makePath) and the arc length of its nearest point
function nearest(P, x, z){ let best = Infinity, s = 0;
  for (let i = 0; i < P.n - 1; i++){ const ax = P.P[i*3], az = P.P[i*3+2], bx = P.P[i*3+3], bz = P.P[i*3+5], L = P.cum[i+1] - P.cum[i]; if (L <= 0) continue;
    const u = Math.max(0, Math.min(1, ((x - ax)*(bx - ax) + (z - az)*(bz - az))/(L*L))), d = Math.hypot(ax + (bx - ax)*u - x, az + (bz - az)*u - z);
    if (d < best){ best = d; s = P.cum[i] + u*L; } }
  return {d:best, s}; }
const ON = 1e-6;
// a bus as a rectangle (centre, heading, length, width) and whether two of them overlap (separating axes)
const box = b => { const L2 = b.len/2, W2 = C.BUS_W/2; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [b.x + b.dz*u*W2 + b.dx*v*L2, b.z - b.dx*u*W2 + b.dz*v*L2]); };
const meet = (A, B) => { for (const P of [A, B]) for (let i = 0; i < 4; i++){ const a = P[i], c = P[(i + 1) % 4], nx = c[1] - a[1], nz = a[0] - c[0];
  const pa = A.map(q => q[0]*nx + q[1]*nz), pb = B.map(q => q[0]*nx + q[1]*nz); if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false; } return true; };

console.log('connected groups follow one route');
const cov = {lane:0, bay:0, cross:0, same:0, tri:0, lanes:new Set()}, bad = {route:[], late:[], offPath:[], order:[], pass:[], side:[]};
let games = 0, wins = 0, greedyLevels = 0, greedyWins = 0;
for (const lv of levels){
  for (let r = 0; r < 5; r++){
    const g = C.createGame(JSON.parse(JSON.stringify(lv)), {}), rng = C.mulberry32(91 + r); let think = 0; games++;
    const watch = [];                                 // groups on their way: {grp, lead, route, from, zr, members:[{b, route, joined}]}
    while (!g.result && g.t < 1500){
      think -= C.SIM_DT; if (think <= 0){ think += C.BOT_THINK; const a = r ? C.randomPick(g, rng) : C.greedyPick(g); if (a) C.applyAction(g, a); }
      C.step(g, C.SIM_DT);
      for (const e of g.events){
        if (e.type === 'send' && e.group != null){
          const grp = g.groups.find(G => G.id === e.group);
          if (grp.members[0] === e.bus){             // the leader goes first: the whole group was sent in this step
            const lead = g.buses[e.bus], zr = e.from === 'lane' ? C.Z_COLL : C.Z_ENTRY;
            const W = {grp, lead, route:lead.trip.path, from:e.from, zr, merged:[], members:grp.members.slice(1).map(id => ({b:g.buses[id], route:g.buses[id].trip.path, joined:false}))};
            cov[e.from]++; cov.lanes.add(g.lanes.length); if (grp.members.length === 3) cov.tri++;
            // each follower's route: off the leader's route only before it reaches the row (its own column, then along
            // the row), on it from there to the end - the leader's very points
            for (const m of W.members){ const P = m.route; let on = false;
              for (let i = 0; i < P.n; i++){ const x = P.P[i*3], z = P.P[i*3+2], d = nearest(W.route, x, z).d;
                if (d < ON) on = true; else if (on || z < zr - 0.61) bad.route.push(`${lv.id} ${grp.id} bus ${m.b.id} (${x.toFixed(2)}, ${z.toFixed(2)}) ${d.toFixed(3)} off`); }
              if (!on) bad.route.push(`${lv.id} ${grp.id} bus ${m.b.id} never joins`);
              const ex = P.P[(P.n - 1)*3], ez = P.P[(P.n - 1)*3 + 2], lx = W.route.P[(W.route.n - 1)*3], lz = W.route.P[(W.route.n - 1)*3 + 2];
              if (Math.hypot(ex - lx, ez - lz) > ON) bad.route.push(`${lv.id} bus ${m.b.id} ends elsewhere`); }
            if (e.from === 'lane'){ const ls = grp.members.map(id => g.buses[id].lane);
              if (new Set(ls).size > 1) cov.cross++; if (new Set(ls).size < ls.length) cov.same++;
              if (grp.members.some(id => g.buses[id].side !== lead.side)) bad.side.push(`${lv.id} ${grp.id}`); }
            watch.push(W); }
        }
        if (e.type === 'merge'){ const W = watch.find(W => W.grp.members.includes(e.bus)); if (W) W.merged.push(e.bus); }
      }
      g.events.length = 0;
      // step by step: once a follower is on the leader's route it stays on it, behind the bus ahead of it (no passing)
      for (const W of watch){ const ms = [W.lead, ...W.members.map(m => m.b)];
        W.members.forEach((m, k) => { const b = m.b; if (b.state !== 'toRoad') return;
          const q = nearest(W.route, b.x, b.z);
          if (q.d < 1e-4) m.joined = true; else if (m.joined) bad.offPath.push(`${lv.id} bus ${b.id} t=${g.t.toFixed(2)} ${q.d.toFixed(4)}`);
          const ahead = ms[k];                      // the member it follows
          if (m.joined && ahead.state === 'toRoad'){ const qa = nearest(W.route, ahead.x, ahead.z);
            if ((qa.d < 1e-4 && q.s >= qa.s) || meet(box(ahead), box(b))) bad.pass.push(`${lv.id} bus ${b.id} t=${g.t.toFixed(2)} ${(qa.s - q.s).toFixed(3)}`); } });
        if (ms.every(b => b.state !== 'toRoad')){ W.done = true;
          if (W.merged.join() !== W.grp.members.join()) bad.order.push(`${lv.id} ${W.grp.id}: ${W.merged.join()} vs ${W.grp.members.join()}`);
          W.members.forEach(m => { if (!m.joined) bad.late.push(`${lv.id} bus ${m.b.id} reached the road without joining`); }); } }
      for (let i = watch.length - 1; i >= 0; i--) if (watch[i].done) watch.splice(i, 1);
    }
    if (g.result === 'win') wins++;
    if (r === 0){ greedyLevels++; if (g.result === 'win') greedyWins++; }
  }
}
const list = a => a.length ? a.slice(0, 3).join(' | ') + (a.length > 3 ? ` (+${a.length - 3})` : '') : '';
chk(cov.lane > 200 && cov.bay > 50 && cov.cross > 100 && cov.same > 50 && cov.tri > 50 && [2, 3, 4, 5].every(n => cov.lanes.has(n)),
  `${games} games on ${levels.length} levels send connected groups from the queue and from the bays (2-5 lanes, pairs and triples, across lanes and within one lane)`,
  `${cov.lane} from the queue (${cov.cross} across lanes, ${cov.same} with members in one lane, ${cov.tri} triples), ${cov.bay} from the bays; lanes ${[...cov.lanes].sort().join(',')}`);
chk(!bad.route.length, 'each follower\'s route leaves the leader\'s only before the row (its own column, then along the collector or entry road) and is then the leader\'s route to its end', list(bad.route));
chk(!bad.side.length, 'all the members of a group sent from the queue use the leader\'s side lane', list(bad.side));
chk(!bad.offPath.length && !bad.late.length, 'every follower moves into the leader\'s path and stays on it, step by step, until it joins the main road', list(bad.offPath.concat(bad.late)));
chk(!bad.pass.length, 'single file: once on the leader\'s path, every member stays behind the one it follows, never overlapping or passing it', list(bad.pass));
chk(!bad.order.length, 'the members join the main road in order: the leader first, then each follower', list(bad.order));
chk(greedyWins === greedyLevels, 'the greedy bot still wins every level with connected buses', `${greedyWins}/${greedyLevels} (all games: ${wins}/${games} won)`);
// the routes themselves, in every kind of place
{ const Y = C.YARDS.compact, lane = (x, side) => C.routeToRoad(x, C.Z_LANE_TOP + 0.9, side, Y), probs = [];
  const check = (lead, f, zr, what) => { const P = C.followRoute(lead, f[0], f[1], zr); let on = false;
    for (let i = 0; i < P.n; i++){ const d = nearest(lead, P.P[i*3], P.P[i*3+2]).d; if (d < ON) on = true; else if (on) { probs.push(what); break; } }
    if (!on) probs.push(what + ' never joins'); };
  for (const n of [2, 3, 4, 5]){ const xs = C.laneXs(n, Y);
    xs.forEach((x1, i) => [-1, 1].forEach(side => xs.forEach((xf, j) => { if (j !== i) check(lane(x1, side), [xf, C.Z_LANE_TOP + 0.9], C.Z_COLL, `${n} lanes: leader ${i}, follower ${j}, side ${side}`); })));
    xs.forEach((x1, i) => check(lane(x1, -1), [x1, C.Z_LANE_TOP + 3], C.Z_COLL, `${n} lanes: same lane ${i}`)); }
  Y.BAY_X.forEach((x1, i) => Y.BAY_X.forEach((xf, j) => { if (j !== i) check(C.routeBayToRoad(x1, 2.6), [xf, 2.6], C.Z_ENTRY, `bays ${i} -> ${j}`); }));
  chk(!probs.length, 'followRoute joins the leader\'s route and stays on it for every pair of lanes (2-5 lanes, either side lane), the same lane and every pair of bays', list(probs)); }

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
