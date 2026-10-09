// Screenshots of the 40-level pack (dist/match-express-funnel-40.html, from file://) at 390x844:
//   screenshots/funnel/level-01.png ... (levels 1, 7, 13, 15, 20, 26, 30, 32, 40, a few seconds into greedy play;
//   level 1 shows its tutorial hand), popup-hidden-bus.png (the level 7 intro popup) and stats-panel.png (after
//   levels 1-3 were won and level 40 was lost once, all by play).
//   node tools/shoot-funnel.js        (needs playwright; CHROMIUM=/path/to/chrome optional)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots', 'funnel');
const PACK = pathToFileURL(path.join(ROOT, 'dist', 'match-express-funnel-40.html')).href;
const LEVELS = [1, 7, 13, 15, 20, 26, 30, 32, 40];
(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2}), p = await ctx.newPage();
  p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await p.goto(PACK + '?n=7'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
  await p.evaluate(() => __me.freeze(true));
  const shot = async name => { await p.evaluate(() => __me.render()); await p.waitForTimeout(700); await p.screenshot({path: path.join(OUT, name)}); console.log('screenshots/funnel/' + name); };
  // the level 7 popup: its picture a little way into the loop
  await p.waitForTimeout(1300); await shot('popup-hidden-bus.png');
  await p.evaluate(() => __me.closeIntro());
  // greedy play for a few seconds (a player who follows a tutorial's hand)
  const play = sec => p.evaluate(sec => { for (let i = 0; i < sec/0.4 && !__me.game.result; i++){ const T = __me.tutorial; let a = null;
      if (T && T.hand >= 0){ const bb = __me.game.buses[T.hand]; a = bb.state === 'lane' ? {kind:'lane', idx:bb.lane} : {kind:'bay', idx:__me.game.bays.indexOf(bb.id)}; }
      else a = __me.C.greedyPick(__me.game);
      if (a) __me.tap(a); __me.advance(0.4); } return __me.game.result; }, sec);
  for (const n of LEVELS){
    await p.evaluate(n => { __me.goLevel(n - 1); if (__me.intro) __me.closeIntro(); __me.advance(0.3); }, n);
    if (n !== 1) await play(n >= 20 ? 9 : 6);
    await shot(`level-${String(n).padStart(2, '0')}.png`);
  }
  // stats from play: levels 1-3 won, level 40 lost once
  for (const n of [1, 2, 3]){ await p.evaluate(n => __me.goLevel(n - 1), n); await play(400); }
  await p.evaluate(() => __me.goLevel(39));
  for (let k = 0; k < 8; k++){
    const r = await p.evaluate(seed => { let s = seed; const rng = () => (s = (s*16807) % 2147483647)/2147483647;
      for (let i = 0; i < 4000 && !__me.game.result; i++){ const a = __me.C.randomPick(__me.game, rng); if (a) __me.tap(a); __me.advance(0.4); } return __me.game.result; }, 11 + k);
    if (r === 'fail') break; await p.evaluate(() => __me.restart());
  }
  await p.evaluate(() => { __me.goLevel(2); __me.openStats(); });
  await p.evaluate(() => document.querySelector('#statsBody').scrollTop = 0);
  await shot('stats-panel.png');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
