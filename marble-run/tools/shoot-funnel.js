// Screenshots of the 40-level pack (dist/marble-run-funnel-40.html, from file://) at 390x844:
//   screenshots/funnel/level-01.png ... (levels 1, 7, 13, 17, 20, 22, 26, 30, 32, 40, a few seconds into greedy play;
//   level 1 shows its tutorial hand, level 3 its box waiting in a slot), the intro popups (popup-hidden-box.png,
//   popup-connected.png, popup-hidden-marbles.png, popup-dispenser.png, popup-lock.png), stats-panel.png (after levels
//   1-3 were won and level 40 was lost once, all by play), and one level per lane count: lanes-2.png (level 9),
//   lanes-4.png (level 35) and lanes-5.png (level 38).
//   node tools/shoot-funnel.js        (needs playwright; CHROMIUM=/path/to/chrome optional)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots', 'funnel');
const PACK = pathToFileURL(path.join(ROOT, 'dist', 'marble-run-funnel-40.html')).href;
const LEVELS = [1, 7, 13, 17, 20, 22, 26, 30, 32, 40], LANES = {2:9, 4:35, 5:38};
const POPUPS = [[7, 'popup-hidden-box'], [13, 'popup-connected'], [22, 'popup-hidden-marbles'], [26, 'popup-dispenser'], [32, 'popup-lock']];
(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2}), p = await ctx.newPage();
  p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p.goto(PACK); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
  const shot = async name => { await p.evaluate(() => __mr.render()); await p.waitForTimeout(500); await p.screenshot({path: path.join(OUT, name)}); console.log('screenshots/funnel/' + name); };
  // the popups, each a little way into its animation (the first time a level brings it)
  for (const [n, name] of POPUPS){ await p.evaluate(n => __mr.goPack(n - 1), n); await p.waitForTimeout(1300); await shot(name + '.png'); await p.evaluate(() => __mr.closeIntro()); }
  // greedy play for a few seconds (a player who follows a tutorial's hand)
  const play = sec => p.evaluate(sec => { const g = __mr.game; for (let i = 0; i < sec/0.4 && !g.result; i++){ const T = __mr.tutorial; let l = -1;
      if (T && T.hand >= 0) l = g.boxes[T.hand].lane; else { const a = __mr.C.greedyPick(g); if (a && __mr.tapAllowed(a.idx)) l = a.idx; }
      if (l >= 0) __mr.tap(l); __mr.advance(0.4); } return g.result; }, sec);
  for (const n of LEVELS){
    await p.evaluate(n => { __mr.goPack(n - 1); if (__mr.introOpen) __mr.closeIntro(); __mr.advance(0.3); }, n);
    if (n !== 1) await play(n >= 20 ? 9 : 6);
    await shot(`level-${String(n).padStart(2, '0')}.png`);
  }
  // level 3: the first box waits in its slot (the tutorial's tip)
  await p.evaluate(() => __mr.goPack(2));
  await p.evaluate(() => { const g = __mr.game; for (let i = 0; i < 300 && !(__mr.tutorial && __mr.tutorial.step >= 3); i++){ const T = __mr.tutorial; let l = -1;
    if (T && T.hand >= 0) l = g.boxes[T.hand].lane; else { const a = __mr.C.greedyPick(g); if (a && __mr.tapAllowed(a.idx)) l = a.idx; } if (l >= 0) __mr.tap(l); __mr.advance(0.4); } });
  await shot('level-03-box-waits.png');
  for (const [nl, n] of Object.entries(LANES)){
    await p.evaluate(n => { __mr.goPack(n - 1); if (__mr.introOpen) __mr.closeIntro(); __mr.advance(0.3); }, n);
    const lanes = await p.evaluate(() => __mr.game.lanes.length); if (lanes !== +nl) throw new Error(`level ${n} has ${lanes} lanes, not ${nl}`);
    await play(4); await shot(`lanes-${nl}.png`);
  }
  // stats from play: levels 1-3 won, level 40 lost once
  for (const n of [1, 2, 3]){ await p.evaluate(n => __mr.goPack(n - 1), n); await play(400); await p.evaluate(() => __mr.advance(4)); }
  await p.evaluate(() => __mr.goPack(39));
  for (let k = 0; k < 8; k++){
    const r = await p.evaluate(seed => { let s = seed; const rng = () => (s = (s*16807) % 2147483647)/2147483647;
      for (let i = 0; i < 4000 && !__mr.game.result; i++){ const a = __mr.C.randomPick(__mr.game, rng); if (a) __mr.tap(a.idx); __mr.advance(0.4); } __mr.advance(3); return __mr.game.result; }, 11 + k);
    if (r === 'fail') break; await p.evaluate(() => __mr.resetGame());
  }
  await p.evaluate(() => { document.getElementById('failPanel').classList.remove('show'); __mr.goPack(2); document.getElementById('btnStats').click(); });
  await shot('stats-panel.png');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
