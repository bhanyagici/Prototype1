// Browser tests for the editor + game pages (Playwright, Chromium).
//   npm i playwright            (or point NODE_PATH at an install that has it)
//   node tests/browser.test.js
// Optional env: CHROMIUM=/path/to/chrome, THREE_MODULE=/path/to/three.module.js (serves the pinned
// three.js locally instead of the CDN, for offline runs), HEADFUL=1.
const fs = require('fs'), http = require('http'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP: playwright is not installed (npm i playwright)'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 20000, step = 150){ const t0 = Date.now(); let v; while (Date.now() - t0 < ms){ try { v = await fn(); if (v) return v; } catch (e) {} await sleep(step); } return v; }

(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, headless: !process.env.HEADFUL,
    args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
  const newCtx = async (vp) => { const ctx = await browser.newContext({viewport: vp || {width:390, height:844}, acceptDownloads:true});
    if (process.env.THREE_MODULE){ const src = fs.readFileSync(process.env.THREE_MODULE);
      await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:src})); }
    return ctx; };
  const errors = []; const watch = p => p.on('pageerror', e => errors.push(e.message));
  try {
    /* ---------------- game page on its own ---------------- */
    console.log('game page');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.levelSource === 'builtin' && __me.LEVEL.name === 'Level 2'), 'with nothing saved the game loads the built-in level');
      // 2x speed through one global time scale
      const r1 = await p.evaluate(() => { __me.setSpeed(1); const t0 = __me.game.t; for (let i=0;i<30;i++) __me.pump(1/60); return __me.game.t - t0; });
      await p.click('#btnSpeed');
      const st = await p.evaluate(() => ({txt: document.getElementById('btnSpeed').textContent, on: document.getElementById('btnSpeed').classList.contains('on'), ts: __me.timeScale}));
      const r2 = await p.evaluate(() => { const t0 = __me.game.t; for (let i=0;i<30;i++) __me.pump(1/60); return __me.game.t - t0; });
      chk(st.txt === '2x' && st.on && st.ts === 2, 'the 2x button toggles to a highlighted "2x"');
      chk(Math.abs(r2 - 2*r1) < 0.02, 'at 2x the whole game advances twice as fast for the same real time', `${r1.toFixed(3)}s -> ${r2.toFixed(3)}s`);
      await p.click('#btnSpeed');
      chk(await p.evaluate(() => document.getElementById('btnSpeed').textContent === '1x' && __me.timeScale === 1), 'pressing again shows "1x" and returns to normal speed');
      // 2x also speeds animation timers (a parachute's flight is keyed to game time)
      const anim = await p.evaluate(() => { __me.setSpeed(2); const v = __me.views[0], t0 = __me.game.t; for (let i=0;i<60;i++) __me.pump(1/60); const d = __me.game.t - t0; __me.setSpeed(1); return d; });
      chk(Math.abs(anim - 2) < 0.05, 'one real second at 2x is two seconds of game and animation time', anim.toFixed(2));
      // mute from the settings button, remembered
      await p.click('#btnSettings'); await sleep(400);
      chk(await p.evaluate(() => document.getElementById('settings').classList.contains('open')), 'the settings button opens the settings panel');
      await p.click('#btnMute');
      chk(await p.evaluate(() => __me.muted === true && document.getElementById('btnMute').textContent === 'Sound: Off'), 'the mute toggle in settings mutes the game');
      chk(await p.evaluate(() => JSON.parse(localStorage.getItem('match-express:prefs')).muted === true), 'mute is remembered');
      await p.click('#btnMute');
      // saved level takes priority over the built-in one
      await p.evaluate(() => { const lv = JSON.parse(JSON.stringify(__me.C.LEVEL_DATA)); lv.name = 'Saved Test'; localStorage.setItem('match-express:current-level', JSON.stringify(lv)); });
      await p.reload(); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.levelSource === 'saved' && __me.LEVEL.name === 'Saved Test'), 'with a saved level the game loads it instead of the built-in one');
      await p.goto(base + '/index.html?builtin&nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.levelSource === 'builtin'), '?builtin forces the built-in level');
      await ctx.close(); }

    /* ---------------- editor + preview + second tab ---------------- */
    console.log('editor');
    const ctx = await newCtx({width:1440, height:900});
    const ed = await ctx.newPage(); watch(ed);
    await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => !!window.__ed, null, {timeout:60000});
    const frame = await until(async () => ed.frames().find(f => f.url().includes('index.html')));
    await frame.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    chk(await until(() => frame.evaluate(() => __me.levelSource === 'editor')), 'the preview iframe runs the real game with the level sent by the editor');
    chk(await ed.evaluate(() => { const r = document.getElementById('preview').getBoundingClientRect(); return r.width > 300 && r.left > 900; }), 'the preview sits to the right of the editing view, in a phone frame');
    // RUN: saves and restarts the level fresh in the preview
    await ed.fill('#levelName', 'Run Test'); await ed.press('#levelName', 'Enter'); await ed.evaluate(() => document.getElementById('levelName').dispatchEvent(new Event('change')));
    await frame.evaluate(() => { __me.tapLane(0); __me.advance(3); });
    const s0 = await frame.evaluate(() => __me.serial);
    await ed.click('#runBtn');
    chk(await until(() => frame.evaluate(s => __me.serial > s && __me.LEVEL.name === 'Run Test' && __me.game.t < 1 && __me.game.sends === 0, s0)), 'RUN restarts the preview fresh with the edited level');
    chk(await ed.evaluate(() => JSON.parse(localStorage.getItem('match-express:current-level')).name === 'Run Test'), 'RUN saves the level to localStorage');
    // a game opened in a new tab picks up the editor's level and stays in sync
    const tab = await ctx.newPage(); watch(tab);
    await tab.goto(base + '/index.html?nosim'); await tab.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    chk(await until(() => tab.evaluate(() => __me.LEVEL.name === 'Run Test')), 'a game tab opened next to the editor gets the editor\'s level');
    await ed.evaluate(() => __ed.edit(n => { n.name = 'Synced'; })); await ed.click('#runBtn');
    chk(await until(() => tab.evaluate(() => __me.LEVEL.name === 'Synced' && __me.levelSource === 'editor')), 'RUN also restarts the separate tab through the BroadcastChannel');
    // auto-run: edits restart the preview after ~500 ms
    await ed.click('#autoBtn');
    const s1 = await frame.evaluate(() => __me.serial);
    const tEdit = Date.now(); await ed.evaluate(() => __ed.edit(n => { n.name = 'Auto 1'; }));
    await sleep(250);
    const early = await frame.evaluate(s => __me.serial > s, s1);
    const got = await until(() => frame.evaluate(() => __me.LEVEL.name === 'Auto 1'), 15000, 50), dt = Date.now() - tEdit;
    chk(!early && got && dt >= 450, 'with auto-run on, an edit restarts the preview after the 500 ms delay', dt + ' ms');
    await ed.click('#autoBtn');
    // undo / redo
    const nm = await ed.evaluate(() => __ed.level.name);
    await ed.evaluate(() => __ed.edit(n => { n.name = 'Undo me'; }));
    await ed.keyboard.press('Control+z');
    const afterUndo = await ed.evaluate(() => __ed.level.name);
    await ed.keyboard.press('Control+Shift+z');
    const afterRedo = await ed.evaluate(() => __ed.level.name);
    chk(afterUndo === nm && afterRedo === 'Undo me', 'Ctrl+Z / Ctrl+Shift+Z undo and redo an edit', `${afterUndo} / ${afterRedo}`);
    // road editing with the mouse: click on the road adds a point, right-click deletes, drag moves
    await ed.evaluate(() => { __ed.setLevel(__me_builtin()); function __me_builtin(){ return JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA)); } __ed.setTab('road'); });
    const box = await ed.locator('#view').boundingBox();
    const toScreen = async (x, z) => { const [sx, sy] = await ed.evaluate(([x, z]) => __ed.W2S(x, z), [x, z]); return [box.x + sx, box.y + sy]; };
    const roadPt = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, (R.pointS[11] + R.pointS[12])/2, o, 0); return [o.x, o.z]; });
    const before0 = await ed.evaluate(() => __ed.level.road.points.map(p => p.x + ',' + p.z)), n0 = before0.length;
    let [mx, my] = await toScreen(...roadPt); await ed.mouse.click(mx, my);
    const after0 = await ed.evaluate(() => __ed.level.road.points.map(p => p.x + ',' + p.z)), n1 = after0.length;
    chk(n1 === n0 + 1, 'clicking on the road inserts a control point', `${n0} -> ${n1}`);
    const ins = after0.findIndex((p, i) => p !== before0[i]), pt = after0[ins].split(',').map(Number);
    chk(ins > 0 && Math.hypot(pt[0] - roadPt[0], pt[1] - roadPt[1]) < 0.1, 'the new point lands where the road was clicked, in road order', 'index ' + ins);
    [mx, my] = await toScreen(...pt);
    await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(mx + 30, my, {steps:5}); await ed.mouse.up();
    const moved = await ed.evaluate(i => __ed.level.road.points[i].x, ins);
    chk(moved > pt[0] + 0.5, 'dragging a control point moves it', `${pt[0]} -> ${moved}`);
    [mx, my] = await toScreen(moved, pt[1]); await ed.mouse.click(mx, my, {button:'right'});
    chk(await ed.evaluate(() => __ed.level.road.points.length) === n0, 'right-clicking a control point deletes it');
    { const p5 = await ed.evaluate(() => { const p = __ed.level.road.points[5]; return [p.x, p.z]; }); const [lx, ly] = await toScreen(...p5);
      await ed.evaluate(([x, y]) => { const cv = document.getElementById('view'); const o = {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true, button:0};
        cv.dispatchEvent(new PointerEvent('pointerdown', o)); }, [lx, ly]);
      await sleep(800);
      await ed.evaluate(([x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent('pointerup', {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true})), [lx, ly]);
      chk(await ed.evaluate(() => __ed.level.road.points.length) === n0 - 1, 'a touch long-press on a control point deletes it');
      await ed.keyboard.press('Control+z'); }
    chk(await ed.evaluate(() => __ed.check.warnings.length === 0 && __ed.level.ramps.every(r => r.at != null)), 'ramps stay attached (re-snapped) after road edits and the level stays warning-free');
    // spiral toggle from the panel
    await ed.evaluate(() => { __ed.sel.point = 13; __ed.setTab('road'); });
    await ed.locator('button', {hasText:'Spiral off'}).click();
    chk(await ed.evaluate(() => !!__ed.level.road.points[13].spiral && __ed.layout.ROAD.spirals.length === 2), 'the Spiral toggle on a control point adds a loop');
    await ed.keyboard.press('Control+z');
    // ramp painting
    await ed.evaluate(() => { __ed.setTab('ramps'); __ed.sel.ramp = 0; __ed.brush.mode = 'paint'; __ed.brush.color = 'cyan'; });
    const cell = await ed.evaluate(() => { const r = __ed.layout.RAMPS.find(q => q.src === 0); return [r.slots[0][2].x, r.slots[0][2].z]; });
    [mx, my] = await toScreen(...cell); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.level.ramps[0].columns[0][2] === 'cyan'), 'painting a cell with the cyan brush');
    await ed.evaluate(() => { __ed.brush.mode = 'hidden'; }); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.level.ramps[0].columns[0][2] === '?cyan'), 'the hidden brush marks a painted stickman as hidden');
    await ed.evaluate(() => { __ed.brush.mode = 'erase'; }); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.level.ramps[0].columns[0][2] === null), 'the eraser leaves the cell empty');
    chk(await ed.evaluate(() => !__ed.check.balanced && __ed.check.perColor.find(p => p.color !== 'cyan' && !p.ok)), 'the checks panel turns that colour red when stickmen and seats differ');
    const red = await ed.evaluate(() => document.querySelectorAll('#checks .cc.bad').length);
    chk(red === 1, 'exactly one colour is shown red in the checks panel', red);
    await ed.evaluate(() => { __ed.brush.use.clear(); ['red', 'blue'].forEach(c => __ed.brush.use.add(c)); __ed.fillRandom(); });
    const fill = await ed.evaluate(() => __ed.level.ramps[0].columns);
    const runsOk = fill.every(col => { let run = 1; for (let i=1;i<col.length;i++){ run = col[i] === col[i-1] ? run + 1 : 1; if (run > 4) return false; } return col.every(c => c === 'red' || c === 'blue'); });
    chk(runsOk, 'Fill random uses only the chosen colours, in runs of 1-4 per column');
    await ed.evaluate(() => __ed.undo());
    // ramp + / - and boarding point drag
    await ed.evaluate(() => { __ed.setTab('ramps'); __ed.sel.ramp = 1; __ed.setTab('ramps'); });
    await ed.locator('button[data-a="c+"]').click(); await ed.locator('button[data-a="r-"]').click();
    chk(await ed.evaluate(() => { const r = __ed.level.ramps[1]; return r.columns.length === 5 && r.rows === 8; }), 'column + and row − buttons resize the ramp');
    const before = await ed.evaluate(() => __ed.layout.RAMPS.find(r => r.src === 1).s);
    const bp = await ed.evaluate(() => { const r = __ed.layout.RAMPS.find(q => q.src === 1); return [r.x, r.z]; });
    const target = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, R.pointS[6] - 1.0, o, 0); return [o.x, o.z]; });
    await ed.evaluate(() => { __ed.brush.mode = 'move'; });
    [mx, my] = await toScreen(...bp); const [tx, ty] = await toScreen(...target);
    await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:6}); await ed.mouse.up();
    const after = await ed.evaluate(() => __ed.layout.RAMPS.find(r => r.src === 1).s);
    chk(Math.abs(after - before) > 0.6, 'dragging the boarding point slides the ramp along the road', `${before.toFixed(2)} -> ${after.toFixed(2)}`);
    // queue: add, link, hidden
    await ed.evaluate(() => __ed.setTab('queue'));
    await ed.selectOption('#qColor', 'green'); await ed.selectOption('#qCap', '4'); await ed.selectOption('#qLane', '2'); await ed.click('#qAdd');
    chk(await ed.evaluate(() => { const l = __ed.level.lanes[2]; return l[l.length-1].color === 'green' && l[l.length-1].cap === 4; }), 'a bus can be added to a lane with a colour and capacity');
    await ed.locator('.lane[data-lane="0"] .bus').first().click(); await ed.locator('.lane[data-lane="1"] .bus').first().click();
    await ed.click('#qLink');
    chk(await ed.evaluate(() => __ed.level.lanes[0][0].link && __ed.level.lanes[0][0].link === __ed.level.lanes[1][0].link), 'two selected buses can be linked');
    const order0 = await ed.evaluate(() => __ed.level.lanes[0].map(b => b.color + b.cap).join(','));
    const chips = ed.locator('.lane[data-lane="0"] .bus'); const c0 = await chips.nth(0).boundingBox(), c2 = await chips.nth(2).boundingBox();
    await ed.mouse.move(c0.x + 40, c0.y + c0.height/2); await ed.mouse.down(); await ed.mouse.move(c2.x + 40, c2.y + c2.height - 2, {steps:8}); await ed.mouse.up();
    const order1 = await ed.evaluate(() => __ed.level.lanes[0].map(b => b.color + b.cap).join(','));
    const o0 = order0.split(','), o1 = order1.split(',');
    chk(o1[2] === o0[0] && o1[0] === o0[1] && o1[1] === o0[2], 'dragging the front bus below the third one reorders the lane', o1.slice(0, 3).join(' '));
    // export / import / slots
    const [dl] = await Promise.all([ed.waitForEvent('download', {timeout:10000}).catch(() => null), ed.evaluate(() => __ed.exportLevel())]);
    chk(!!dl && /\.json$/.test(dl.suggestedFilename()), 'Export downloads the level as a .json file', dl && dl.suggestedFilename());
    const ok = await ed.evaluate(() => { const txt = __ed.levelJSON(); const o = JSON.parse(txt); o.name = 'Imported'; return __ed.importText(JSON.stringify(o)) && __ed.level.name === 'Imported'; });
    chk(ok, 'Import accepts pasted JSON');
    chk(await ed.evaluate(() => !__ed.importText('{not json')), 'Import rejects broken JSON without touching the level');
    ed.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Renamed level' : undefined));
    await ed.evaluate(() => __ed.saveSlot(null));
    const slots1 = await ed.evaluate(() => JSON.parse(localStorage.getItem('match-express:level-slots')));
    const id = Object.keys(slots1)[0];
    await ed.evaluate(id => { __ed.slotAction('dup', id); __ed.slotAction('ren', id); }, id);
    const slots2 = await ed.evaluate(() => JSON.parse(localStorage.getItem('match-express:level-slots')));
    chk(Object.keys(slots2).length === 2 && slots2[id].name === 'Renamed level', 'level slots: save, duplicate and rename');
    await ed.evaluate(id => { __ed.edit(n => { n.name = 'Changed'; }); __ed.slotAction('load', id); }, id);
    chk(await ed.evaluate(() => __ed.level.name === 'Renamed level'), 'level slots: load');
    await ed.evaluate(id => __ed.slotAction('del', id), id);
    chk(await ed.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('match-express:level-slots'))).length === 1), 'level slots: delete');
    // Test + Watch greedy
    await ed.evaluate(() => __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))));
    await ed.click('#testBtn');
    const t = await until(() => ed.evaluate(() => __ed.lastTest && !__ed.lastTest.pending && __ed.lastTest), 120000, 300);
    chk(t && t.greedy.result === 'win' && t.greedy.sends === 52 && t.wins === 31 && t.label === 'Medium', 'Test runs greedy + 200 random bots in the background worker', t && `${t.greedy.result} ${t.greedy.sends} sends, ${t.wins}/200 ${t.label}`);
    chk(await ed.evaluate(() => /Medium/.test(document.getElementById('testOut').textContent)), 'the difficulty label is shown in the checks panel');
    await ed.click('#watchBtn');
    chk(await until(() => frame.evaluate(() => document.getElementById('botTag').style.display === 'block' && __me.game.sends > 0), 30000), '"Watch greedy" plays the greedy bot in the preview');
    await ed.screenshot({path: path.join(ROOT, 'screenshot-editor.png')});
    await ctx.close();
  } catch (e) { fail++; console.log('  FAIL  exception: ' + (e.stack || e)); }
  chk(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`);
  process.exitCode = fail ? 1 : 0;
})();
