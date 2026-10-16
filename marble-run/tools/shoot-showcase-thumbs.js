// The showcase menu's pictures: each showcase level in the game (the slide zone: slide, trays and the sorter, without
// the buttons), as levels/showcase/thumbs/<id>.jpg (250 x 300).
//   node tools/shoot-showcase-thumbs.js [id ...]        (env: CHROMIUM as for the tests)
const fs = require('fs'), http = require('http'), path = require('path'), {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'showcase'), OUT = path.join(DIR, 'thumbs');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
(async () => {
  const order = JSON.parse(fs.readFileSync(path.join(DIR, 'showcase-order.json'), 'utf8')), want = process.argv.slice(2);
  const todo = order.categories.flatMap(c => c.groups.flatMap(g => g.levels.map(id => [c.dir, id]))).filter(([, id]) => !want.length || want.includes(id));
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:250/390*1.0});
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:fs.readFileSync(path.join(ROOT, 'vendor', 'three.module.min.js'))}));
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${srv.address().port}/index.html?test&nosim&shot`); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
  await p.addStyleTag({content:'.ui{display:none!important}'});
  fs.mkdirSync(OUT, {recursive:true});
  for (const [dir, id] of todo){
    const lv = JSON.parse(fs.readFileSync(path.join(DIR, dir, id + '.json'), 'utf8'));
    await p.evaluate(lv => { __mr.loadLevel(lv, 'thumb'); __mr.advance(0.4); __mr.render(); }, lv);
    await p.waitForTimeout(300);
    // the slide zone and the slot tray: 390 x 468 css px (5:6) from the top of the screen
    await p.screenshot({path:path.join(OUT, id + '.jpg'), type:'jpeg', quality:72, clip:{x:0, y:20, width:390, height:468}});
    console.log('thumbs/' + id + '.jpg');
  }
  await browser.close(); srv.close();
})();
