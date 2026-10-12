// The showcase menu's card pictures: every showcase level drawn by the game at 390 x 844 (meadow theme, nothing
// played yet), its target zone cut out (5:6) and saved small as levels/showcase/thumbs/<id>.jpg.
//   node tools/shoot-showcase-thumbs.js [ids]     (needs playwright; CHROMIUM=/path/to/chrome as for the tests)
const fs = require('fs'), http = require('http'), path = require('path'), {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'showcase'), OUT = path.join(DIR, 'thumbs');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
const want = process.argv.slice(2);
(async () => {
  const ids = fs.readdirSync(DIR).filter(f => /\.json$/.test(f) && !/order/.test(f)).map(f => f.slice(0, -5)).filter(id => !want.length || want.includes(id)).sort();
  fs.mkdirSync(OUT, {recursive:true});
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2});
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:fs.readFileSync(path.join(ROOT, 'vendor', 'three.module.min.js'))}));
  const p = await ctx.newPage(); p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p.goto(base + '/index.html?nosim&theme=meadow&move=rigid'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
  const cv = await b.newPage();
  for (const id of ids){
    const lv = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'));
    await p.evaluate(lv => { __me.loadLevel(lv, 'export'); if (__me.intro) __me.closeIntro(); __me.freeze(true); __me.render(); }, lv);
    await p.waitForTimeout(150);
    const png = await p.screenshot({clip:{x:0, y:56, width:390, height:468}});   // the target zone, below the top bar
    // 300 x 360 JPEG through a canvas (small enough to sit inside the showcase file)
    const jpg = await cv.evaluate(async src => { const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = 300; c.height = 360; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(im, 0, 0, 300, 360); return c.toDataURL('image/jpeg', 0.78); }, 'data:image/png;base64,' + png.toString('base64'));
    fs.writeFileSync(path.join(OUT, id + '.jpg'), Buffer.from(jpg.split(',')[1], 'base64'));
    console.log(id, (fs.statSync(path.join(OUT, id + '.jpg')).size/1024).toFixed(0) + ' KB');
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
