// Screenshot of the editor with a 5-lane level (levels/funnel/f38.json): the queue pane widened for 5 lanes, a
// connected pair across lanes 4 and 5 selected, its inspector card and the right-click menu of the queue.
//   screenshots/editor-5-lanes.png (1440x900)
//   node tools/shoot-editor.js        (needs playwright; CHROMIUM=/path/to/chrome and THREE_MODULE as for the tests)
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots', 'editor-5-lanes.png');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:1440, height:900}});
  if (process.env.THREE_MODULE){ const src = fs.readFileSync(process.env.THREE_MODULE);
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:src})); }
  const p = await ctx.newPage(); p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p.goto(base + '/editor.html'); await p.waitForFunction(() => window.__ed && __ed.level, null, {timeout:90000});
  const lv = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', 'funnel', 'f38.json'), 'utf8'));
  await p.evaluate(lv => { __ed.setLevel(lv); __ed.saveLevel(false); __ed.fitView(); }, lv);
  // a connected pair that spans two lanes, as near the front as possible
  const pair = await p.evaluate(() => { const by = {}; __ed.level.lanes.forEach((ln, l) => ln.forEach((b, i) => { if (b.link != null) (by[b.link] = by[b.link] || []).push([l, i]); }));
    return Object.values(by).filter(m => new Set(m.map(x => x[0])).size > 1).sort((a, b) => Math.max(...a.map(x => x[1])) - Math.max(...b.map(x => x[1])) || b[0][0] - a[0][0])[0]; });
  await p.evaluate(list => { __ed.sel = {kind:'bus', list}; }, pair);
  await p.click('#runBtn'); await p.waitForTimeout(4000);
  const g = await p.locator(`#queueSvg .bus[data-key="${pair[0][0]}:${pair[0][1]}"]`).boundingBox();
  await p.mouse.click(g.x + g.width/2, g.y + g.height/2, {button:'right'});
  await p.waitForTimeout(400);
  await p.screenshot({path:OUT}); console.log(path.relative(ROOT, OUT));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
