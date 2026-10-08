// Screenshots of every blocker in the game at 390x844 (screenshots/blocker-*.png): each demo level once at the
// start and once in action, played by the greedy bot until the moment that shows the blocker working.
//   node tools/shoot-blockers.js      (needs playwright; same CHROMIUM / THREE_MODULE env as tests/browser.test.js)
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
// [demo id, file name, what the action shot waits for (evaluated in the page with g = the game), seconds after it]
const SHOTS = [
  ['demo_hidden_bus', 'hidden-bus', 'g.buses.some(b => b.hidden && b.revealed && b.state === "lane") && g.buses.some(b => b.hidden && !b.revealed)'],
  ['demo_connected', 'connected', 'g.groups.some(G => G.members.every(m => g.buses[m].state === "road"))'],
  ['demo_tunnel', 'tunnel', 'g.ramps.some(r => r.tunnels.some(T => T.left < T.count && T.left > 0))'],
  ['demo_hidden_men', 'hidden-men', 'g.sends >= 4'],
  ['demo_lock_box', 'lock-box', 'g.ramps.some(r => r.boxes.some(b => b.open))', 0.15],
  ['demo_count_box', 'count-box', 'g.ramps.some(r => r.boxes.some(b => b.open))', 0.15],
  ['demo_combo', 'combo', 'g.sends >= 6'],
];
(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await browser.newContext({viewport:{width:390, height:844}});
  if (process.env.THREE_MODULE){ const src = fs.readFileSync(process.env.THREE_MODULE);
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:src})); }
  fs.mkdirSync(OUT, {recursive:true});
  for (const [id, name, cond, after = 0.35] of SHOTS){
    const p = await ctx.newPage(); p.on('pageerror', e => console.log(id, 'page error:', e.message));
    await p.goto(`${base}/index.html?level=${id}&nosim`); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    await p.evaluate(() => { __me.freeze(true); __me.advance(1.2); __me.render(); });
    await p.screenshot({path: path.join(OUT, `blocker-${name}.png`)});
    const t = await p.evaluate(([cond, after]) => { const test = new Function('g', 'return ' + cond);
      __me.setBot(true); for (let i = 0; i < 1200 && !__me.game.result; i++){ __me.advance(0.1); if (test(__me.game)) break; }
      __me.setBot(false); __me.advance(after); __me.render(); return __me.game.t; }, [cond, after]);
    await p.screenshot({path: path.join(OUT, `blocker-${name}-play.png`)});
    console.log(`screenshots/blocker-${name}.png, blocker-${name}-play.png (t = ${t.toFixed(1)} s)`);
    await p.close();
  }
  await browser.close(); srv.close();
})();
