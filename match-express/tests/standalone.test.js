// Builds the single-file versions (tools/build-standalone.js) and opens them from file:// in Chromium:
// the game plays, the editor's RUN / Auto-run update its srcdoc preview, "Play in a new tab" and the
// playable HTML export work without a server, and the two share files open with their level and ignore
// saved editor levels. Nothing is fetched from the network: three.js is inlined as well.
//   node tests/standalone.test.js   (needs playwright; same CHROMIUM env as browser.test.js)
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP: playwright is not installed (npm i playwright)'); process.exit(0); }
require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-standalone.js')], {stdio:'inherit'});
const D = pathToFileURL(path.join(__dirname, '..', 'dist')).href + '/';
let pass = 0, fail = 0; const chk = (ok, n, i='') => { ok ? pass++ : fail++; console.log((ok?'  PASS  ':'  FAIL  ') + n + (i!==''?'  -> '+i:'')); };
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const mk = vp => b.newContext({viewport:vp, acceptDownloads:true});
  const errs = [], net = []; const watch = p => { p.on('pageerror', e => errs.push(p.url().slice(-40)+': '+e.message)); p.on('requestfailed', r => errs.push('reqfail '+r.url()));
    p.on('request', r => { if (/^https?:/.test(r.url())) net.push(r.url()); }); };
  // ---- game
  { const c = await mk({width:390,height:844}), p = await c.newPage(); watch(p);
    await p.goto(D + 'match-express-game.html'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    chk(await p.evaluate(() => typeof MECore === 'object' && typeof MESync === 'object' && __me.LEVEL.name === 'Level 2'), 'game opens from file:// with the inlined core and sync');
    // play: real click on the front bus of lane 0 via projected screen pos
    const n0 = await p.evaluate(() => __me.game.trips.length + __me.game.road.length);
    await p.evaluate(() => __me.tapLane(0));
    await p.evaluate(() => { for (let i=0;i<120;i++) __me.pump(1/60); });
    chk(await p.evaluate(n0 => __me.game.trips.length + __me.game.road.length > n0, n0), 'tapping a lane sends a bus');
    await p.evaluate(() => { __me.freeze(true); __me.setBot(true); __me.advance(400); __me.render(); });
    const r = await p.evaluate(() => ({res: __me.game.result, landed: __me.game.landed, men: __me.game.men.length, t: __me.game.t.toFixed(1)}));
    chk(r.res === 'win' && r.landed === r.men, 'the greedy bot plays the level to a win', JSON.stringify(r));
    await c.close(); }
  // ---- editor: its preview is its own srcdoc copy of the packed game; exports work from file:// too
  { const c = await mk({width:1440,height:900}), p = await c.newPage(); watch(p);
    await p.goto(D + 'match-express-editor.html'); await p.waitForFunction(() => window.__ed, null, {timeout:60000});
    const fr = () => p.frames().find(f => f !== p.mainFrame());
    await p.waitForFunction(() => { const w = document.getElementById('preview').contentWindow; return w.__me && w.__me.game; }, null, {timeout:90000});
    chk(!!fr() && fr().url() === 'about:srcdoc', 'the preview is the embedded srcdoc game', fr() && fr().url());
    chk(await p.waitForFunction(() => document.getElementById('preview').contentWindow.__me.levelSource === 'editor', null, {timeout:20000}).then(()=>true, ()=>false), 'the preview boots with the editor level');
    const pv = () => p.evaluate(() => { const m = document.getElementById('preview').contentWindow.__me; return {serial: m.serial, name: m.LEVEL.name, src: m.levelSource, men: m.game.men.length, buses: m.game.buses.length}; });
    const s0 = await pv();
    // edit: rename + remove a bus, then RUN
    await p.fill('#levelName', 'Standalone check'); await p.press('#levelName', 'Enter');
    await p.evaluate(() => __ed.edit(n => { n.lanes[0].pop(); }));
    await p.click('#runBtn');
    await p.waitForFunction(s => document.getElementById('preview').contentWindow.__me.serial > s, s0.serial, {timeout:20000}).catch(()=>{});
    const s1 = await pv();
    chk(s1.serial > s0.serial && s1.name === 'Standalone check' && s1.buses === s0.buses - 1, 'RUN restarts the preview with the edited level', JSON.stringify([s0, s1]));
    // auto-run
    await p.click('#autoBtn');
    await p.waitForTimeout(1500); const s2a = await pv();
    await p.evaluate(() => __ed.edit(n => { n.name = 'Auto edited'; }));
    const t0 = Date.now();
    await p.waitForFunction(s => document.getElementById('preview').contentWindow.__me.serial > s, s2a.serial, {timeout:10000}).catch(()=>{});
    const s2 = await pv();
    chk(s2.name === 'Auto edited', 'Auto-run restarts the preview after an edit', `${Date.now()-t0} ms`);
    await p.click('#autoBtn');
    // the preview game plays
    await p.evaluate(() => { const m = document.getElementById('preview').contentWindow.__me; m.tapLane(1); for (let i=0;i<60;i++) m.pump(1/60); });
    chk(await p.evaluate(() => { const g = document.getElementById('preview').contentWindow.__me.game; return g.trips.length + g.road.length > 0; }), 'the embedded game responds to play');
    // Export > Play this level in a new tab: a packed copy from a blob URL
    await p.click('#exportMenu [data-menu]');
    const [tab] = await Promise.all([c.waitForEvent('page'), p.click('#exportMenu [data-act="playTab"]')]); watch(tab);
    const ok = await tab.waitForFunction(() => window.__me && __me.game && __me.LEVEL.name === 'Auto edited', null, {timeout:90000}).then(()=>true, ()=>false);
    chk(ok && (await tab.evaluate(() => __me.levelSource)) === 'export', '"Play this level in a new tab" opens a packed copy of the current level', tab.url().slice(0, 30));
    // Export > Playable HTML (level order) from the single-file editor: no server needed
    await p.evaluate(() => { localStorage.setItem('match-express:level-order', JSON.stringify(['demo_hidden_bus', 'demo_lock_box'])); });
    const html = await p.evaluate(() => __ed.exportHtml('order'));
    const tmp = path.join(require('os').tmpdir(), 'me-sa-' + process.pid + '.html'); fs.writeFileSync(tmp, html || '');
    const q = await c.newPage(); watch(q); await q.goto(pathToFileURL(tmp).href); await q.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    chk(await q.evaluate(() => __me.levelSource === 'export' && __me.playlist.length === 2 && __me.LEVEL.name === 'Demo: Hidden Buses'), 'the single-file editor exports a playable pack of the level order (opens from file://)');
    fs.unlinkSync(tmp);
    await c.close(); }
  // ---- share files: a saved editor level is ignored, no background bot test, a menu of the bundled levels
  for (const [file, name] of [['match-express-play.html', 'Level 2'], ['match-express-crowded-rush-curve.html', 'Crowded Rush Curve']]){
    const c = await mk({width:390,height:844}), p = await c.newPage(); watch(p); const logs = []; p.on('console', m => logs.push(m.text()));
    await p.goto(D + file); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    await p.evaluate(() => { const lv = JSON.parse(JSON.stringify(MECore.LEVEL_DATA)); lv.name = 'Old editor level'; localStorage.setItem('match-express:current-level', JSON.stringify(lv));
      localStorage.setItem('match-express:level-slots', JSON.stringify({x:{name:lv.name, level:Object.assign(lv, {id:'x'})}})); localStorage.setItem('match-express:level-order', '["x"]'); });
    await p.reload(); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000}); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({name: __me.LEVEL.name, menu: [...document.querySelectorAll('#settings > button, #presetBtns button')].map(b => b.textContent).filter(t => /^Play /.test(t)),
      demos: document.querySelectorAll('#demoBtns button').length}));
    chk(st.name === name && !logs.some(l => /^\[sim\]/.test(l)), file + ' opens with ' + name + ' (not the saved editor level) and runs no bot test', st.name);
    chk(JSON.stringify(st.menu) === JSON.stringify(['Play Level 2', 'Play Crowded Rush', 'Play Crowded Rush Curve']) && st.demos >= 7, file + ': the settings menu plays each bundled level (blocker demos folded away)', st.menu.join(', ') + ' + ' + st.demos + ' demos');
    await p.click('#btnSettings'); await p.click('#settings button[data-level="crowded-rush"]');
    chk(await p.evaluate(() => __me.LEVEL.name === 'Crowded Rush' && __me.layout.CAM === MECore.SCREEN_CAM), file + ': switching level keeps the one fixed camera');
    await c.close(); }
  chk(errs.length === 0, 'no page errors or failed loads', errs.join(' | '));
  chk(net.length === 0, 'nothing is loaded from the network (three.js is inlined too)', net.slice(0, 3).join(' '));
  console.log(fail ? `\n${fail} FAILED` : `\nALL ${pass} CHECKS PASS`); await b.close(); process.exit(fail ? 1 : 0);
})();
