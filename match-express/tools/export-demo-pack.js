// Exports the blocker demos as one playable pack, through the editor's own UI (Levels & level order panel):
//   dist/match-express-blocker-demos.html   the playable HTML (all seven demos, in order)
//   levels/demo-level-order.json            the level order it was made from
//   screenshots/editor-level-order.png      the editor's Levels & level order panel with that order
// It types the ids into the Level Order panel, then clicks "Export order JSON" and "Playable HTML". Then it
// opens the pack from file:// at 390x844 and lets the greedy bot win every level, checking the order, that a
// win offers the next level, the "All levels complete" end and that nothing loads from the network:
//   screenshots/pack-level-1.png, pack-level-complete.png, pack-all-complete.png
//   node tools/export-demo-pack.js     (needs playwright; same CHROMIUM / THREE_MODULE env as tests/browser.test.js)
const fs = require('fs'), http = require('http'), path = require('path'), {pathToFileURL} = require('url');
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
  await p.screenshot({path: path.join(ROOT, 'screenshots', 'editor-level-order.png')});
  console.log('screenshots/editor-level-order.png');
  await save('#orderExport', path.join(ROOT, 'levels', 'demo-level-order.json'));
  const PACK = path.join(ROOT, 'dist', 'match-express-blocker-demos.html');
  await save('#orderHtml', PACK);
  // play the pack from disk
  const c2 = await browser.newContext({viewport:{width:390, height:844}}), g = await c2.newPage(), net = [];
  g.on('request', r => { if (/^https?:/.test(r.url())) net.push(r.url()); }); g.on('pageerror', e => { console.error('pack page error:', e.message); process.exitCode = 1; });
  await g.goto(pathToFileURL(PACK).href); await g.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
  const ids = await g.evaluate(() => __me.playlist.map(l => l.id));
  if (ids.join() !== ORDER.join()) throw new Error('the pack holds ' + ids.join());
  await g.evaluate(() => { __me.freeze(true); __me.advance(1); __me.render(); });
  await g.screenshot({path: path.join(ROOT, 'screenshots', 'pack-level-1.png')});
  for (let k = 0; k < ORDER.length; k++){
    const w = await g.evaluate(() => { __me.setBot(true); for (let i = 0; i < 80 && !__me.game.result; i++) __me.advance(5); __me.setBot(false); __me.advance(3); __me.render();
      return {name:__me.LEVEL.name, res:__me.game.result, step:document.getElementById('levelStep').textContent, next:document.getElementById('btnNext').textContent,
        win:document.getElementById('winPanel').classList.contains('show')}; });
    console.log(`  ${w.step}: ${w.name}: ${w.res}, offers "${w.next}"`);
    if (!w.win || w.next !== (k + 1 < ORDER.length ? 'Next level' : 'Finish')) throw new Error('the pack did not offer the next level');
    if (k === 0) await g.screenshot({path: path.join(ROOT, 'screenshots', 'pack-level-complete.png')});
    await g.click('#btnNext');
  }
  await g.evaluate(() => { __me.advance(0.5); __me.render(); }); await g.waitForTimeout(600);
  if (!await g.evaluate(() => document.getElementById('donePanel').classList.contains('show') && /All levels complete/.test(document.getElementById('donePanel').textContent)))
    throw new Error('no "All levels complete" screen');
  await g.screenshot({path: path.join(ROOT, 'screenshots', 'pack-all-complete.png')});
  if (net.length) throw new Error('the pack loaded ' + net[0]);
  console.log('  All levels complete; no network requests. screenshots/pack-level-1.png, pack-level-complete.png, pack-all-complete.png');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
