// Screenshots of the game page at 390 x 844 (2x): node tools/shoot-game.js
//   screenshots/game-start-390.png       the built-in level at the start
//   screenshots/game-play-390.png        marbles on the slide, in the bowl, on the rail and in the boxes
//   screenshots/game-blockers-390.png    every blocker at once (Demo: All Together)
//   screenshots/game-complete-390.png    a completed box: lid, bow, balloon, confetti
//   screenshots/game-full-390.png        all 5 slots taken: the refusal (toast, red flash)
//   screenshots/game-fail-390.png        the fail panel after the dominoes
// Needs playwright (NODE_PATH) and CHROMIUM; three.js is served from vendor/.
const fs = require('fs'), http = require('http'), path = require('path'), {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots'), TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
const SHOTS = [
  ['game-start-390', '', ''],
  ['game-play-390', '', '__mr.tap(0); __mr.tap(1); __mr.tap(2); __mr.advance(1.2); __mr.tap(1); __mr.advance(1.6);'],
  ['game-blockers-390', 'level=demo_combo', '__mr.tap(0); __mr.tap(2); __mr.advance(0.55);'],
  ['game-complete-390', 'level=demo_hidden_box&bot', 'const g = __mr.game; for (let i = 0; i < 400 && !g.boxes.some(b => b.state === "gone" && g.t - b.tDone > 0.42); i++) __mr.advance(0.05);'],
  ['game-full-390', 'level=demo_count_crate', 'for (let i = 0; i < 6; i++) __mr.tap(i % 3); __mr.advance(0.15);'],
  ['game-fail-390', 'level=demo_connected', 'const g = __mr.game, C = __mr.C; let s = 7; const r = () => (s = (s*16807) % 2147483647)/2147483647; for (let i = 0; i < 4000 && !g.result; i++){ const a = C.adversePick(g, r); if (a) __mr.tap(a.idx); __mr.advance(0.1); } __mr.advance(2);'],
];
(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type':TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r));
  const b = await chromium.launch({executablePath:process.env.CHROMIUM, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2});
  const three = fs.readFileSync(path.join(ROOT, 'vendor', 'three.module.min.js')); await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:three}));
  fs.mkdirSync(OUT, {recursive:true});
  for (const [name, q, js] of SHOTS){
    const p = await ctx.newPage(); await p.goto(`http://localhost:${srv.address().port}/index.html?test&nosim${q ? '&' + q : ''}`);
    await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:60000});
    if (js) await p.evaluate(js); await p.evaluate(() => __mr.render());
    await p.screenshot({path:path.join(OUT, name + '.png')}); console.log('screenshots/' + name + '.png'); await p.close();
  }
  await b.close(); srv.close();
})();
