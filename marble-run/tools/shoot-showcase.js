// Screenshots of the showcase (dist/marble-run-showcase.html, from file://) at 390x844 (2x):
//   screenshots/showcase/menu.png          the start menu (Basics and Blockers cards)
//   screenshots/showcase/menu-layouts.png  the Layouts category (slides, tray shapes, lane counts)
//   screenshots/showcase/menu-funnel.png   the funnel's numbered tiles
//   screenshots/showcase/settings.png      the settings panel from the menu
//   screenshots/showcase/play.png          a card in play (Toy parade, a few seconds of greedy play)
//   screenshots/showcase/editor.png        the editor inside the showcase (Hairpin), at 1440 x 900
//   node tools/shoot-showcase.js        (needs playwright; CHROMIUM=/path/to/chrome optional)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url'), {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots', 'showcase');
(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const p = await (await b.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2})).newPage();
  p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p.goto(pathToFileURL(path.join(ROOT, 'dist', 'marble-run-showcase.html')).href); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
  const shot = async name => { await p.waitForTimeout(500); await p.screenshot({path:path.join(OUT, name)}); console.log('screenshots/showcase/' + name); };
  const scrollTo = txt => p.evaluate(t => { const h = [...document.querySelectorAll('#menuList .mcat')].find(e => e.textContent.startsWith(t)); if (h) h.scrollIntoView({block:'start'}); }, txt);
  await shot('menu.png');
  await scrollTo('Layouts'); await shot('menu-layouts.png');
  await scrollTo('Funnel'); await shot('menu-funnel.png');
  await p.evaluate(() => document.getElementById('menuList').scrollTop = 0);
  await p.click('#menuSet'); await shot('settings.png'); await p.click('#setClose');
  await p.click('#menuList .mcard[data-id="toy-parade"]');
  await p.evaluate(() => { const g = __mr.game; for (let i = 0; i < 12 && !g.result; i++){ const a = __mr.C.greedyPick(g); if (a) __mr.tap(a.idx); __mr.advance(0.4); } __mr.render(); });
  await shot('play.png');
  // the editor is a desktop tool: its picture at 1440 x 900
  const d = await (await b.newContext({viewport:{width:1440, height:900}})).newPage();
  await d.goto(pathToFileURL(path.join(ROOT, 'dist', 'marble-run-showcase.html')).href); await d.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
  await d.evaluate(() => __mr.openEditor(__mr.pack.find(l => l.id === 'slide-hairpin')));
  await d.waitForFunction(() => { const f = document.querySelector('#edHost iframe'); return f && f.contentWindow.__ed; }, null, {timeout:60000});
  await d.waitForTimeout(3000); await d.screenshot({path:path.join(OUT, 'editor.png')}); console.log('screenshots/showcase/editor.png');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
