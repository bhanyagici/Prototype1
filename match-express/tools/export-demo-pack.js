// Exports the blocker demos as one playable pack, through the editor's own UI (Levels & level order panel):
//   dist/match-express-blocker-demos.html   the playable HTML (all seven demos, in order)
//   levels/demo-level-order.json            the level order it was made from
// It types the ids into the Level Order panel, then clicks "Export order JSON" and "Playable HTML".
//   node tools/export-demo-pack.js     (needs playwright; same CHROMIUM / THREE_MODULE env as tests/browser.test.js)
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..');
const ORDER = ['demo_hidden_bus', 'demo_connected', 'demo_tunnel', 'demo_hidden_men', 'demo_lock_box', 'demo_count_box', 'demo_combo'];
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await browser.newContext({viewport:{width:1440, height:900}, acceptDownloads:true});
  if (process.env.THREE_MODULE){ const src = fs.readFileSync(process.env.THREE_MODULE);
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:src})); }
  const p = await ctx.newPage(); p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p.goto(base + '/editor.html'); await p.waitForFunction(() => window.__ed, null, {timeout:60000});
  await p.keyboard.press('o');
  for (const id of ORDER){ await p.fill('#orderAdd', id); await p.press('#orderAdd', 'Enter'); }
  const warns = await p.evaluate(() => __ed.orderState().warns);
  if (warns.length) throw new Error('level order warnings: ' + warns.join('; '));
  const save = async (button, file) => {
    const [dl] = await Promise.all([p.waitForEvent('download', {timeout:60000}), p.click(button)]);
    fs.mkdirSync(path.dirname(file), {recursive:true}); await dl.saveAs(file);
    console.log(`${path.relative(ROOT, file)}  ${(fs.statSync(file).size/1024).toFixed(0)} KB  (downloaded as ${dl.suggestedFilename()})`);
  };
  await save('#orderExport', path.join(ROOT, 'levels', 'demo-level-order.json'));
  await save('#orderHtml', path.join(ROOT, 'dist', 'match-express-blocker-demos.html'));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
