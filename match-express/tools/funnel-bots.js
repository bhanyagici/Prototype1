// Runs the bots on the 40 funnel levels (levels/funnel, in funnel-order.json order) and writes the table behind the
// spreadsheet and the report: levels/funnel/funnel-bots.json
//   greedy bot: result, game time at 1x and 2x (2x = the same game at double speed: half the seconds), sends
//   random bot: 200 games (seeds 1000..1199, as in tools/make-funnel.js): wins, fails (a returning bus found no free
//               bay), unfinished (no result after 1500 game seconds: the bot kept sending buses that could not fill, so
//               the road never had room for the rest - a player who waits can always go on), win rate = wins / 200
//   node tools/funnel-bots.js          (4 levels in parallel; prints a markdown table)
const fs = require('fs'), path = require('path'), {fork} = require('child_process');
const DIR = path.join(__dirname, '..', 'levels', 'funnel');
const RUNS = 200;

if (process.env.BOTS_WORKER){
  const C = require('../tests/core.js')();
  process.on('message', id => {
    const lv = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'));
    const g = C.simulate(lv, C.greedyPick, null, C.SIM_DT), out = {wins:0, fails:0, unfinished:0};
    for (let r = 0; r < RUNS; r++){ const s = C.simulate(lv, C.randomPick, C.mulberry32(1000 + r), C.SIM_DT);
      if (s.result === 'win') out.wins++; else if (s.result === 'fail') out.fails++; else out.unfinished++; }
    const ck = C.checkLevel(JSON.parse(JSON.stringify(lv)));
    process.send({id, greedy:{result:g.result, t1x:+g.t.toFixed(1), t2x:+(g.t/2).toFixed(1), sends:g.sends}, random:Object.assign(out, {runs:RUNS, rate:out.wins/RUNS}),
      men:ck.totalMen, buses:ck.buses});
    process.exit(0);
  });
  return;
}
const order = JSON.parse(fs.readFileSync(path.join(DIR, 'funnel-order.json'), 'utf8')).levels;
const rows = {}, queue = order.slice(); let running = 0;
const next = () => {
  while (running < 4 && queue.length){
    const id = queue.shift(); running++;
    const w = fork(__filename, [], {env:Object.assign({}, process.env, {BOTS_WORKER:'1'})});
    w.on('message', m => { rows[m.id] = m; });
    w.on('exit', () => { running--; if (queue.length) next(); else if (!running) done(); });
    w.send(id);
  }
};
next();
function done(){
  const list = order.map(id => rows[id]);
  const bad = list.filter(r => !r || r.greedy.result !== 'win');
  const t1 = list.reduce((a, r) => a + r.greedy.t1x, 0);
  const out = {generated:new Date().toISOString().slice(0, 10), runs:RUNS, levels:list, totalGreedy1x:+t1.toFixed(1), totalGreedy2x:+(t1/2).toFixed(1)};
  fs.writeFileSync(path.join(DIR, 'funnel-bots.json'), JSON.stringify(out, null, 1) + '\n');
  console.log('| Level | Greedy | Greedy 1x (s) | Greedy 2x (s) | Random wins | Fails | Unfinished | Win rate |');
  console.log('|---|---|---|---|---|---|---|---|');
  list.forEach(r => console.log(`| ${r.id} | ${r.greedy.result} | ${r.greedy.t1x} | ${r.greedy.t2x} | ${r.random.wins} | ${r.random.fails} | ${r.random.unfinished} | ${(r.random.rate*100).toFixed(1)}% |`));
  console.log(`\nGreedy total: ${(t1/60).toFixed(1)} min at 1x, ${(t1/120).toFixed(1)} min at 2x.` + (bad.length ? `  GREEDY DID NOT WIN: ${bad.map(r => r ? r.id : '?').join(', ')}` : '  The greedy bot wins every level.'));
  if (bad.length) process.exitCode = 1;
}
