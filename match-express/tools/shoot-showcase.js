// Screenshots of the showcase at 390 x 844 (device pixel ratio 2), from dist/match-express-showcase.html opened from
// file:// (run tools/build-showcase.js first):
//   screenshots/showcase-menu-390.png        the start menu
//   screenshots/showcase-settings-390.png    the settings panel over the menu
//   screenshots/theme-<id>-390.png           one level per theme (meadow, desert, blossom, town), a few seconds in
//   screenshots/spiral-persp-390.png         a spiral level in the Perspective camera
//   screenshots/spiral-ortho-390.png         the same moment in the Orthographic camera
//   screenshots/parachute-edge-390.png       a full bus's parachute carrying it down past the board's edge
//   screenshots/articulated-spiral-390.png   a 12-seat articulated bus bending in a spiral
//   screenshots/five-lanes-bar-390.png       a 5-lane level with the queue tunnel and the booster bar
//   node tools/shoot-showcase.js             (needs playwright; CHROMIUM=/path/to/chrome as for the tests)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url'), {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'screenshots'), FILE = path.join(ROOT, 'dist', 'match-express-showcase.html');
(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2}), p = await ctx.newPage();
  p.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  const shot = async name => { await p.waitForTimeout(400); await p.screenshot({path:path.join(OUT, name)}); console.log('screenshots/' + name); };
  await p.goto(pathToFileURL(FILE).href); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:120000});
  await p.evaluate(() => { __me.setTheme('meadow'); __me.setMove('rigid', true); __me.setView('persp', true); __me.setSpeed(1, true); });
  await p.waitForTimeout(800); await shot('showcase-menu-390.png');
  await p.click('#menuSet'); await shot('showcase-settings-390.png'); await p.click('#btnSetClose');
  // one level per theme, played a few seconds by the greedy bot (buses on the road, stickmen boarding)
  const play = async (id, theme, move, sec, cam = 'persp') => p.evaluate(([id, theme, move, sec, cam]) => {
    __me.setTheme(theme); __me.setMove(move); __me.setView(cam); __me.openMenu(); __me.goLevel(__me.playlist.findIndex(l => l.id === id)); __me.closeMenu(); __me.freeze(false);
    const g = __me.game; for (let i = 0; i < sec/0.2 && !g.result; i++){ if (i % 3 === 0){ const a = window.MECore.greedyPick(g); if (a) __me.tap(a); } __me.advance(0.2); }
    __me.freeze(true); __me.render(); }, [id, theme, move, sec, cam]);
  for (const [id, theme] of [['road-s-curve', 'meadow'], ['road-hairpin', 'desert'], ['blk-all', 'blossom'], ['road-double-spiral', 'town']]){
    await play(id, theme, 'rigid', 14); await shot(`theme-${theme}-390.png`); }
  // a spiral level in both cameras (the same moment: the play is deterministic)
  for (const cam of ['persp', 'ortho']){ await play('road-double-spiral', 'meadow', 'rigid', 12, cam); await shot(`spiral-${cam}-390.png`); }
  // a full bus's parachute over the board's edge: a first run finds an exit whose bus, 1.9 s under its parachute, is
  // below the board's edge and in view (not hidden behind the board); the play is deterministic, so a second run stops there
  const chute = await p.evaluate(() => { const C = window.MECore;
    const run = (id, stopAt) => { const i = __me.playlist.findIndex(l => l.id === id);
      __me.setTheme('meadow'); __me.setView('persp'); __me.setMove('rigid'); __me.openMenu(); __me.goLevel(i); __me.closeMenu(); __me.freeze(true);
      const g = __me.game;
      for (let k = 0; k < 30*600 && !g.result; k++){
        if (k % 6 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); } __me.advance(1/30);
        if (stopAt != null){ if (k >= stopAt) return k; continue; }
        for (const v of __me.views){ const J = v.jump; if (!J || v.b.state !== 'jump') continue; const u = g.t - J.t0;
          if (u < J.t3 + 1.9 || u > J.t3 + 1.9 + 1/30) continue;
          const p = v.root.position; if (p.y < 0.12 - 1.2 && __me.inView(p.x, p.y + 0.4, p.z) && __me.inView(p.x, p.y + 2.0, p.z)) return k; } }
      return null; };
    for (const id of ['basics-easy', 'road-spiral', 'ramp-straight', 'road-s-curve', 'lanes-2', 'road-hairpin']){
      const k = run(id); if (k == null) continue;
      run(id, k); __me.render(); return {id, k}; }
    return null; });
  if (chute) await shot('parachute-edge-390.png'); else { console.error('no parachute exit in view'); process.exitCode = 1; }
  // a 12-seat articulated bus in a spiral: driven into the single spiral's loop
  await p.evaluate(() => { const C = window.MECore, i = __me.playlist.findIndex(l => l.id === 'road-spiral'), lv = JSON.parse(JSON.stringify(__me.playlist[i]));
    __me.setTheme('meadow'); __me.setMove('articulated'); __me.openMenu(); __me.goLevel(i); __me.closeMenu();
    // the same level with a 12-seat bus put at the front of the middle lane (for the picture), sent straight away
    lv.lanes[1].unshift({color:lv.lanes[1][0].color, cap:12}); __me.loadLevel(lv, 'export'); __me.freeze(false);
    const g = __me.game, R = __me.layout.ROAD, sp = R.spirals[0], id = g.lanes[1][0];
    __me.tapLane(1);
    for (let k = 0; k < 60*60; k++){ __me.pump(1/60); const bb = g.buses[id]; if (bb.state === 'road' && bb.rs >= sp.s0 + (sp.s1 - sp.s0)*0.45) break; }
    __me.freeze(true); __me.render(); });
  await shot('articulated-spiral-390.png');
  await play('lanes-5', 'town', 'rigid', 10); await shot('five-lanes-bar-390.png');
  await p.evaluate(() => { __me.setTheme('meadow'); __me.setMove('rigid', true); __me.setView('persp', true); });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
