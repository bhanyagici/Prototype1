// Screenshots of the showcase at 390 x 844 (device pixel ratio 2), from dist/match-express-showcase.html opened from
// file:// (run tools/build-showcase.js first):
//   screenshots/showcase-menu-390.png        the start menu
//   screenshots/showcase-settings-390.png    the settings panel over the menu
//   screenshots/theme-<id>-390.png           one level per theme (meadow, desert, blossom, town), a few seconds in
//   screenshots/spiral-persp-390.png         a spiral level in the Perspective camera
//   screenshots/spiral-ortho-390.png         the same moment in the Orthographic camera
//   screenshots/parachute-edge-390.png       a full bus under its parachute, out past the board's edge
//   screenshots/jelly-spiral-390.png         a 12-seat bus in Jelly mode bending in a spiral
//   screenshots/tunnel-exit-390.png          close-up: a bus driving into the exit tunnel's darkness, front first
//   screenshots/tunnel-return-390.png        close-up: a bus coming out of the return tunnel's darkness
//   screenshots/ramp-curve-390.png           close-up: a ramp on a tight curve (a regular grid, an apron to the curved road edge)
//   screenshots/five-lanes-bar-390.png       a 5-lane level with the queue tunnel and the booster bar
//   screenshots/stickmen-1.3-390.png         a level drawn with its stickmen at 1.3x, and close up (stickmen-1.3-close-390.png)
//   screenshots/connected-queue-390.png      close-up: connected buses side by side in the queue, the leading one a little ahead
//   screenshots/connected-parachute-390.png  a connected group parachuting down together (and close up, connected-parachute-close-390.png)
//   screenshots/bridge-390.png               the Bridge terrain (and bridge-spiral-390.png)
//   screenshots/gap-jump-390.png             close-up: a bus in the air over a gap between its ramps (and gap-jump-wide-390.png)
//   screenshots/pause-menu-390.png           the pause menu over a level
//   screenshots/camera-zoom-45-390.png       the camera zoomed out to a 45 degree field of view
//   screenshots/showcase-funnel-390.png      the funnel's numbered tiles in the menu
//   screenshots/editor-picker-390.png        the editor inside the showcase: its level picker, the editor on level 30 after a
//   screenshots/editor-in-showcase-390.png     save (and at 1440 x 900, editor-in-showcase.png), My Levels in the menu
//   screenshots/my-levels-390.png              (my-levels-390.png); the saved copy is removed again at the end
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
  // a full bus's parachute over the board's edge: a first run finds an exit whose bus, under its open parachute, has
  // glided out past the board's edge and is still in view; the play is deterministic, so a second run stops there
  const chute = await p.evaluate(() => { const C = window.MECore;
    const run = (id, stopAt) => { const i = __me.playlist.findIndex(l => l.id === id);
      __me.setTheme('meadow'); __me.setView('persp'); __me.setMove('rigid'); __me.openMenu(); __me.goLevel(i); __me.closeMenu(); __me.freeze(true);
      const g = __me.game;
      for (let k = 0; k < 30*600 && !g.result; k++){
        if (k % 6 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); } __me.advance(1/30);
        if (stopAt != null){ if (k >= stopAt) return k; continue; }
        for (const v of __me.views){ const J = v.jump; if (!J || v.b.state !== 'jump') continue; const u = g.t - J.t0;
          if (u < J.t3 + 0.5 || u > J.t3 + 3.5) continue;                  // (gliding under its parachute)
          const p = v.root.position; if (__me.boardMask.at(p.x, p.z) > 0.6 && __me.inView(p.x, p.y + 0.4, p.z) && __me.inView(p.x, p.y + 2.0, p.z)) return k; } }
      return null; };
    for (const id of ['basics-easy', 'road-spiral', 'ramp-straight', 'road-s-curve', 'lanes-2', 'road-hairpin']){
      const k = run(id); if (k == null) continue;
      run(id, k); __me.render(); return {id, k}; }
    return null; });
  if (chute) await shot('parachute-edge-390.png'); else { console.error('no parachute exit in view'); process.exitCode = 1; }
  // a 12-seat bus in Jelly mode in a spiral: driven into the single spiral's loop
  await p.evaluate(() => { const C = window.MECore, i = __me.playlist.findIndex(l => l.id === 'road-spiral'), lv = JSON.parse(JSON.stringify(__me.playlist[i]));
    __me.setTheme('meadow'); __me.setMove('jelly'); __me.openMenu(); __me.goLevel(i); __me.closeMenu();
    // the same level with a 12-seat bus put at the front of the middle lane (for the picture), sent straight away
    lv.lanes[1].unshift({color:lv.lanes[1][0].color, cap:12}); __me.loadLevel(lv, 'export'); __me.freeze(false);
    const g = __me.game, R = __me.layout.ROAD, sp = R.spirals[0], id = g.lanes[1][0];
    __me.tapLane(1);
    for (let k = 0; k < 60*60; k++){ __me.pump(1/60); const bb = g.buses[id]; if (bb.state === 'road' && bb.rs >= sp.s0 + (sp.s1 - sp.s0)*0.45) break; }
    __me.freeze(true); __me.render(); });
  await shot('jelly-spiral-390.png');
  // close-ups: the camera zoomed in on a point (a view offset), then back
  const zoomAt = async (pt, f) => p.evaluate(([pt, f]) => { const c = __me.camera, v = new c.position.constructor(...pt).project(c);
    const cx = (v.x + 1)/2*900, cy = (1 - v.y)/2*1950, w = 900/f, h = 1950/f; c.setViewOffset(900, 1950, cx - w/2, cy - h/2, w, h); __me.render(); }, [pt, f]);
  const unzoom = () => p.evaluate(() => { __me.camera.clearViewOffset(); __me.render(); });
  // the tunnels: a 12-seat bus in a colour nobody waits for drives the whole road into the exit tunnel and comes back out
  // of the return tunnel
  const tun = await p.evaluate(() => { const C = window.MECore, i = __me.playlist.findIndex(l => l.id === 'road-spiral'), lv = JSON.parse(JSON.stringify(__me.playlist[i]));
    __me.setTheme('meadow'); __me.setMove('rigid'); __me.setView('persp'); __me.openMenu(); __me.goLevel(i); __me.closeMenu();
    const used = new Set(JSON.stringify(lv).match(/"\??([a-z]+)"/g).map(x => x.replace(/["?]/g, ''))), color = C.COLORS.find(c => !used.has(c));
    lv.lanes[0].unshift({color, cap:12}); __me.loadLevel(lv, 'export'); __me.freeze(true); __me.tapLane(0);
    const g = __me.game, b = g.buses.find(x => x.color === color), R = __me.layout.ROAD;
    for (let k = 0; k < 60*120 && !(b.state === 'road' && b.rs >= R.portalS + 0.5); k++) __me.advance(1/60);
    __me.render(); const E = __me.layout.exit; return {exit:[E.x, E.y + 0.5, E.z], color}; });
  await zoomAt(tun.exit, 2.5); await shot('tunnel-exit-390.png'); await unzoom();
  const ret = await p.evaluate(color => { const g = __me.game, b = g.buses.find(x => x.color === color);
    for (let k = 0; k < 60*120 && !(b.state === 'return' && b.trip && b.trip.s >= 1.4); k++) __me.advance(1/60);
    __me.render(); const T = __me.layout.TUNNEL, [x, z] = window.MECore.dispPoint(T.x, T.z); return [x, 0.5, z]; }, tun.color);
  await zoomAt(ret, 2.5); await shot('tunnel-return-390.png'); await unzoom();
  // a ramp on a tight curve: of all the showcase's ramps, the one with the deepest apron (its regular grid of stickmen
  // beside a road edge that bends the most a ramp of its width may)
  const ramp = await p.evaluate(() => { const C = window.MECore; let best = null;
    __me.playlist.forEach((lv, i) => { if (!Array.isArray(lv.ramps)) return; const L = C.buildLayout(C.normalizeLevel(JSON.parse(JSON.stringify(lv))));
      for (const r of L.RAMPS) if (!best || r.apron > best.apron) best = {apron:r.apron, i, src:r.src}; });
    __me.setTheme('meadow'); __me.openMenu(); __me.goLevel(best.i); __me.closeMenu(); __me.freeze(true); __me.render();
    const r = __me.layout.RAMPS.find(q => q.src === best.src), c = r.across(r.length*0.3, 0); return [c.x, r.y, c.z]; });
  await zoomAt(ramp, 2); await shot('ramp-curve-390.png'); await unzoom();
  await play('lanes-5', 'town', 'rigid', 10); await shot('five-lanes-bar-390.png');
  // larger stickmen: a level drawn with its stickmen at 1.3x (the level's manScale), close up on its biggest ramp
  const big = await p.evaluate(() => { const i = __me.playlist.findIndex(l => l.id === 'ramp-straight');
    __me.setTheme('meadow'); __me.setMove('rigid'); __me.setView('persp'); __me.openMenu(); __me.goLevel(i); __me.closeMenu(); __me.freeze(true); __me.render();
    const r = __me.layout.RAMPS.reduce((a, q) => q.slots.length > a.slots.length ? q : a), c = r.across(r.length*0.5, 0);
    return {scale:__me.layout.manScale || __me.LEVEL.manScale, at:[c.x, r.y, c.z]}; });
  await shot('stickmen-1.3-390.png'); await zoomAt(big.at, 2.2); await shot('stickmen-1.3-close-390.png'); await unzoom();
  // connected buses side by side in the queue: the leading bus stands a little ahead of the one it pulls (close up)
  const pair = await p.evaluate(() => { const i = __me.playlist.findIndex(l => l.id === 'blk-connected-pairs');
    __me.setTheme('meadow'); __me.setMove('rigid'); __me.setView('persp'); __me.openMenu(); __me.goLevel(i); __me.closeMenu(); __me.freeze(true); __me.render();
    const g = __me.game, G = g.groups.find(G => new Set(G.members.map(id => g.buses[id].lane)).size > 1 && G.members.every(id => g.buses[id].state === 'lane'))
      || g.groups[0], vs = G.members.map(id => __me.views[id]);
    return [vs.reduce((s, v) => s + v.p.x, 0)/vs.length, 0.3, vs.reduce((s, v) => s + v.p.z, 0)/vs.length]; });
  await zoomAt(pair, 2.4); await shot('connected-queue-390.png'); await unzoom();
  // a connected group parachuting together: a first run finds the moment every bus of a group hangs under its parachute,
  // in view below the board's edge; the play is deterministic, so a second run stops there
  const group = await p.evaluate(() => { const C = window.MECore;
    const run = (id, stopAt) => { const i = __me.playlist.findIndex(l => l.id === id);
      __me.setTheme('meadow'); __me.setView('persp'); __me.setMove('rigid'); __me.openMenu(); __me.goLevel(i); __me.closeMenu(); __me.freeze(true);
      const g = __me.game;
      for (let k = 0; k < 30*600 && !g.result; k++){
        if (k % 6 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); } __me.advance(1/30);
        if (stopAt != null){ if (k >= stopAt) return k; continue; }
        for (const G of g.groups){ const vs = G.members.map(m => __me.views[m]);
          if (!vs.every(v => v.b.state === 'jump' && v.jump && !v.jump.gone)) continue;
          const J = vs[0].jump, u = g.t - J.t0; if (u < J.t3 + 1.2 || u > J.t3 + 1.2 + 1/30) continue;
          if (vs.every(v => { const q = v.root.position; return __me.inView(q.x, q.y + 0.4, q.z) && __me.inView(q.x, q.y + 2.0, q.z); })) return k; } }
      return null; };
    for (const id of ['blk-connected-pairs', 'blk-connected-triples', 'blk-all']){ const k = run(id); if (k == null) continue; run(id, k); __me.render();
      const G = __me.game.groups.find(G => G.members.every(m => __me.views[m].b.state === 'jump' && __me.views[m].jump && !__me.views[m].jump.gone));
      const ps = G.members.map(m => __me.views[m].root.position), at = ['x', 'y', 'z'].map(c => ps.reduce((s, q) => s + q[c], 0)/ps.length);
      return {id, k, at:[at[0], at[1] + 1, at[2]]}; }
    return null; });
  if (group){ await shot('connected-parachute-390.png'); await zoomAt(group.at, 2.2); await shot('connected-parachute-close-390.png'); await unzoom(); }
  else { console.error('no connected group parachuting in view'); process.exitCode = 1; }
  // the Bridge terrain: the road on its own deck and pillars over the ground far below
  await p.evaluate(() => __me.setTerrain('bridge')); await play('road-s-curve', 'meadow', 'rigid', 10); await shot('bridge-390.png');
  await play('road-double-spiral', 'town', 'rigid', 10); await shot('bridge-spiral-390.png');
  await p.evaluate(() => __me.setTerrain('plateau'));
  // a jump: a bus high over a gap between its take-off and landing ramps (close up)
  const jump = await p.evaluate(() => { const C = window.MECore, i = __me.playlist.findIndex(l => l.id === 'jump-ramps');
    __me.setTheme('meadow'); __me.setMove('rigid'); __me.setView('persp'); __me.openMenu(); __me.goLevel(i); __me.closeMenu(); __me.freeze(true);
    const g = __me.game, R = __me.layout.ROAD, o = {};
    for (let k = 0; k < 60*240 && !g.result; k++){
      if (k % 24 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); } __me.advance(1/60);
      for (const v of __me.views){ const b = v.b; if (b.state !== 'road' || !v.inJump) continue; const q = R.gaps.find(q => b.rs > q.s0 && b.rs < q.s1);
        if (q && Math.abs(b.rs - (q.s0 + q.s1)/2) < 0.06){ __me.render(); C.pathAt(R, b.rs, o, 0); return [o.x, o.y + 0.4, o.z]; } } }
    return null; });
  if (jump){ await zoomAt(jump, 2.2); await shot('gap-jump-390.png'); await unzoom(); await shot('gap-jump-wide-390.png'); }
  else { console.error('no jump found'); process.exitCode = 1; }
  // the pause menu over a level being played
  await play('road-s-curve', 'meadow', 'rigid', 8); await p.evaluate(() => __me.freeze(false)); await p.click('#btnPause'); await shot('pause-menu-390.png');
  await p.click('#pmResume');
  // the camera zoom: the same moment zoomed out (a 45° field of view), then back to the default
  await play('road-s-curve', 'meadow', 'rigid', 8); await p.evaluate(() => { __me.setZoom(45); __me.render(); }); await shot('camera-zoom-45-390.png');
  await p.evaluate(() => { __me.setZoom(__me.ZOOM.def); __me.render(); });
  // the funnel in the menu: numbered tiles in order, the next one to play highlighted
  await p.evaluate(() => { __me.openMenu(); const h = [...document.querySelectorAll('#menuList .mcat')].find(x => /Funnel/.test(x.textContent)); h.scrollIntoView(); });
  await shot('showcase-funnel-390.png');
  // the editor inside the showcase: the level picker, the editor on f30, a save into My Levels, then My Levels in the menu
  await p.evaluate(() => { document.getElementById('menuList').scrollTop = 0; }); await p.click('#menuEdit'); await shot('editor-picker-390.png');
  await p.evaluate(() => [...document.querySelectorAll('#edPick .lv')].find(b => b.querySelector('code').textContent === 'f30').click());
  const ed = await (await p.waitForSelector('#edFrame')).contentFrame();
  await ed.waitForFunction(() => window.__ed && __ed.level && __ed.level.id === 'f30', null, {timeout:120000});
  await ed.evaluate(() => { __ed.edit(n => { n.name = 'My level 30'; }); __ed.saveLevel(false); });
  await ed.waitForFunction(() => __ed.level.id === 'f30_1', null, {timeout:20000}); await p.waitForTimeout(2500); await shot('editor-in-showcase-390.png');
  await p.setViewportSize({width:1440, height:900}); await p.waitForTimeout(2500); await shot('editor-in-showcase.png'); await p.setViewportSize({width:390, height:844});
  await ed.evaluate(() => document.getElementById('hostClose').click());
  await p.evaluate(() => document.querySelector('#menuList .mcard[data-id="f30_1"]').scrollIntoView({block:'center'})); await shot('my-levels-390.png');
  await p.evaluate(() => { localStorage.removeItem('match-express:my-levels'); localStorage.removeItem('match-express:showcase-editor-draft'); __me.closeMenu(); });
  await p.evaluate(() => { __me.setTheme('meadow'); __me.setMove('rigid', true); __me.setView('persp', true); });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
