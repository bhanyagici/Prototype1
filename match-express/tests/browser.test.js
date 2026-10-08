// Browser tests for the editor + game pages (Playwright, Chromium).
//   npm i playwright            (or point NODE_PATH at an install that has it)
//   node tests/browser.test.js
// Optional env: CHROMIUM=/path/to/chrome, THREE_MODULE=/path/to/three.module.js (serves the pinned
// three.js locally instead of the CDN, for offline runs), HEADFUL=1.
const fs = require('fs'), http = require('http'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP: playwright is not installed (npm i playwright)'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
// the original wide layout of the built-in level: the road-editing checks below address its control points by index
const CLASSIC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'level2-classic.json'), 'utf8'));
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
      // sending by real taps: every queue tap goes to the road and counts at once; at 5/5 the bus shakes and stays
      { const tapFront = async l => { const xy = await p.evaluate(l => { const g = __me.game, b = g.buses[g.lanes[l][0]], [x0, y0, x1, y1] = __me.busScreenBox(b),
            r = document.getElementById('app').getBoundingClientRect(); return [r.left + (x0 + x1)/2/900*r.width, r.top + (y0 + y1)/2/1950*r.height]; }, l);
          await p.mouse.click(xy[0], xy[1]); };
        const seen = [];
        for (let i = 0; i < 5; i++){ await tapFront(i % 3); seen.push(await p.evaluate(() => { __me.pump(1/60); return document.getElementById('cnt').textContent; })); }
        const front = await p.evaluate(() => __me.game.lanes[0][0]); await tapFront(0);
        const st6 = await p.evaluate(f => { __me.pump(1/60); const g = __me.game; return {cnt:document.getElementById('cnt').textContent, front:g.lanes[0][0] === f,
          shook:g.t - __me.views[f].shakeT < 0.5, parked:g.bayRes.some(x => x >= 0) || g.bays.some(x => x >= 0), result:g.result}; }, front);
        chk(seen.join(' ') === '1/5 2/5 3/5 4/5 5/5', 'each tap on a queue bus sends it to the road; the counter sign counts it at once', seen.join(' '));
        chk(st6.cnt === '5/5' && st6.front && st6.shook && !st6.parked && !st6.result, 'at 5/5 a tapped queue bus shakes and stays: no bay, no fail', JSON.stringify(st6));
        await p.evaluate(() => __me.restart()); }
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
      await p.goto(base + '/index.html?level=crowded-rush&nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.levelSource === 'preset' && __me.LEVEL.name === 'Crowded Rush' && __me.layout.RAMPS.length === 4), '?level=crowded-rush loads the bundled Crowded Rush level');
      await ctx.close(); }
    /* ---------------- proportions, cheering, full-bus exit ---------------- */
    console.log('game visuals');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?builtin&nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const m = await p.evaluate(() => { __me.freeze(true); __me.render(); return __me.measure(); });
      chk(m.men.n === 192 && m.men.min >= 16, 'on 390 x 844 (fixed camera) every standing stickman is at least 16 px tall', `min ${m.men.min.toFixed(1)} px, avg ${m.men.avg.toFixed(1)} px`);
      chk(m.bay8 >= 35, 'an 8-seat bus in a bay is drawn at least 35 px long (bays at 0.8)', m.bay8.toFixed(1) + ' px');
      // cheering from the moment a bus is sent: exactly the stickmen the core predicts, who then board it on that lap
      const ch = await p.evaluate(() => { __me.setBot(true); const g = __me.game, open = new Map(), laps = []; let warmUp = 0;
        for (let i = 0; i < 9000 && laps.length < 12; i++){ __me.advance(1/30);
          for (const b of g.buses) if (b.state === 'toRoad' && !open.has(b.id) && !laps.some(l => l.id === b.id && l.t === b.trip.seq)){
            const pred = g.men.filter(m => m.cheerBus === b.id).map(m => m.id).sort((x, y) => x - y);
            const shown = __me.cheerSet().filter(id => g.men[id].cheerBus === b.id).sort((x, y) => x - y);
            open.set(b.id, {id:b.id, t:b.trip.seq, pred, shown, free:b.cap - b.seated, before:new Set(g.men.filter(m => m.bus === b.id).map(m => m.id)), sentAt:g.t}); }
          for (const [id, o] of open){ const b = g.buses[id];
            if (o.pred.length && o.liveAt == null && g.t - o.sentAt > 0.7){ const live = __me.cheerSet().filter(x => g.men[x].cheerBus === id);   // cheering while still in the yard
              o.liveAt = b.state === 'toRoad' ? live.length : -1; }
            if (['jump', 'tunnel', 'return', 'bay', 'crash'].includes(b.state)){
              o.boarded = g.men.filter(m => m.bus === id && !o.before.has(m.id)).map(m => m.id).sort((x, y) => x - y); laps.push(o); open.delete(id); } } }
        const bad = laps.filter(l => JSON.stringify(l.pred) !== JSON.stringify(l.boarded) || JSON.stringify(l.shown) !== JSON.stringify(l.pred) || l.pred.length > l.free);
        const early = laps.filter(l => l.pred.length && l.liveAt > 0).length;
        return {laps:laps.length, bad:bad.length, early, cheered:laps.reduce((a, l) => a + l.pred.length, 0), boarded:laps.reduce((a, l) => a + l.boarded.length, 0)}; });
      chk(ch && ch.laps >= 10 && ch.bad === 0 && ch.early > 0,
          'a bus sent to the road makes exactly the stickmen it will take cheer, at once (still in the yard), and exactly those then board it',
          ch && `${ch.laps} laps, ${ch.cheered} cheered = ${ch.boarded} boarded, ${ch.early} already cheering before the bus reached the road, ${ch.bad} mismatches`);
      // full bus: straight sideways off the road, away from its ramp; the hop starts only once it is clear of the road
      const ex = await p.evaluate(() => { const g = __me.game; let v = null;
        for (let i = 0; i < 6000 && !v; i++){ __me.advance(1/30); v = __me.views.find(w => w.b.state === 'jump' && w.jump && g.t - w.jump.t0 < 0.05); }
        if (!v) return null;
        const J = v.jump, L = __me.layout, r = L.RAMPS[v.boardRamp], samples = [];
        for (let i = 0; i < 40; i++){ __me.advance(1/30); samples.push({u:g.t - J.t0, x:v.root.position.x, y:v.root.position.y, z:v.root.position.z}); }
        const hx = Math.sin(J.h), hz = Math.cos(J.h), out = s => (s.x - J.x)*J.ex + (s.z - J.z)*J.ez, along = s => (s.x - J.x)*hx + (s.z - J.z)*hz;
        const side = samples.filter(s => s.u <= J.t1), atEdge = side[side.length - 1], firstUp = samples.find(s => s.y > J.y + 0.02);
        const rampSide = (r.x - J.x)*J.ex + (r.z - J.z)*J.ez;                  // the ramp's boarding point relative to the exit direction
        const awayFromRamp = (() => { const o = {}; window.MECore.pathAt(L.ROAD, r.s, o, 0); const nx = -o.dz*r.side, nz = o.dx*r.side; return nx*J.ex + nz*J.ez; })();
        return {maxAlong:Math.max(...side.map(s => Math.abs(along(s)))), flat:Math.max(...side.map(s => Math.abs(s.y - J.y))), outAtEdge:out(atEdge),
                outAtHop:firstUp ? out(firstUp) : null, awayFromRamp, need:__me.ROAD_HALF + window.MECore.BUS_W/2}; });
      chk(ex && ex.maxAlong < 0.02 && ex.flat < 0.01, 'a full bus first drives straight sideways (perpendicular to the road) without lifting', ex && `drift along road ${ex.maxAlong.toFixed(3)}`);
      chk(ex && ex.awayFromRamp < -0.99, 'it leaves on the side away from the ramp it boarded at');
      chk(ex && ex.outAtEdge >= ex.need && ex.outAtHop !== null && ex.outAtHop >= ex.need, 'the hop and parachute start only after the bus is completely off the road',
          ex && `clear at ${ex.need.toFixed(2)}, hop starts at ${ex.outAtHop && ex.outAtHop.toFixed(2)}`);
      // a bus that fills under an overpass (ramp 5, below the U-turn after the spiral) slides further before it hops:
      // during the hop and the first second under the parachute no raised road is overhead
      const ov = await p.evaluate(() => { const g = __me.game, L = __me.layout, R = L.ROAD; let v = null;
        for (let i = 0; i < 30*120 && !v; i++){ __me.advance(1/30); v = __me.views.find(w => w.b.state === 'jump' && w.jump && w.jump.out > 1.5 && g.t - w.jump.t0 < 0.05); }
        if (!v) return null;
        const J = v.jump; let worst = Infinity;
        while (g.t - J.t0 < J.t3 + 1.0){ __me.advance(1/30); if (g.t - J.t0 < J.t2) continue;
          const c = v.root.position; for (let i = 0; i < R.n; i += 2){ const py = R.P[i*3+1]; if (py < J.y + 0.35 || py - 0.24 > c.y + 3.2) continue;
            worst = Math.min(worst, Math.hypot(R.P[i*3] - c.x, R.P[i*3+2] - c.z)); } }
        return {ramp:v.boardRamp + 1, out:J.out, clear:worst}; });
      chk(ov && ov.clear > 1.5, 'a bus filled under an overpass slides out from under it before hopping (no road above the hop or the parachute)',
          ov && `ramp ${ov.ramp}: slides ${ov.out.toFixed(2)}, nearest raised road ${ov.clear.toFixed(2)} away`);
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
    await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))); __ed.setTab('road'); });
    const box = await ed.locator('#view').boundingBox();
    const toScreen = async (x, z) => { const [sx, sy] = await ed.evaluate(([x, z]) => __ed.W2S(x, z), [x, z]); return [box.x + sx, box.y + sy]; };
    const roadPt = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, (R.pointS[9] + R.pointS[10])/2, o, 0); return [o.x, o.z]; });
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
      await until(() => ed.evaluate(n => __ed.level.road.points.length === n, n0 - 1), 4000, 100);   // hold until it goes
      await ed.evaluate(([x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent('pointerup', {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true})), [lx, ly]);
      chk(await ed.evaluate(() => __ed.level.road.points.length) === n0 - 1, 'a touch long-press on a control point deletes it');
      await ed.keyboard.press('Control+z'); }
    chk(await ed.evaluate(() => __ed.check.warnings.length === 0 && __ed.level.ramps.every(r => r.at != null)), 'ramps stay attached (re-snapped) after road edits and the level stays warning-free');
    // the target zone: the wide classic road leaves it -> warnings in the list; a point added out there lands inside the frame
    await ed.evaluate(lv => { __ed.setLevel(lv); __ed.setTab('road'); }, CLASSIC);
    chk(await ed.evaluate(() => __ed.check.warnings.some(w => w.kind === 'zone-road') && /target zone/.test(document.body.textContent)), 'a road outside the target zone is listed in the checks');
    { const far = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; const n = R.pointS.length; window.MECore.pathAt(R, (R.pointS[n-2] + R.pointS[n-1])/2, o, 0); return [o.x, o.z]; });
      const n2 = await ed.evaluate(() => __ed.level.road.points.length);
      await ed.evaluate(([x, z]) => { const cv = document.getElementById('view'), r = cv.getBoundingClientRect(), [sx, sy] = __ed.W2S(x, z);   // may be off the visible canvas
        const o = {clientX:r.left + sx, clientY:r.top + sy, pointerId:78, pointerType:'mouse', bubbles:true, button:0};
        cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); }, far);
      const np = await ed.evaluate(n => { const pts = __ed.level.road.points; if (pts.length !== n + 1) return null; const p = pts[__ed.sel.point]; return [p.x, p.z, window.MECore.inTarget(p.x, 0.9, p.z)]; }, n2);
      chk(np && np[2], 'a road point added outside the frame is created inside it', JSON.stringify({clicked:far.map(v => +v.toFixed(2)), placed:np})); }
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
    const slots0 = await ed.evaluate(() => JSON.parse(localStorage.getItem('match-express:level-slots')));
    chk(slots0['preset-crowded-rush'] && slots0['preset-crowded-rush'].name === 'Crowded Rush' && slots0['preset-crowded-rush'].level.ramps.every(r => r.tilt), 'the bundled Crowded Rush level is seeded as a level slot');
    await ed.evaluate(() => __ed.saveSlot(null));
    const slots1 = await ed.evaluate(() => JSON.parse(localStorage.getItem('match-express:level-slots')));
    const id = Object.keys(slots1).find(k => !slots0[k]);
    await ed.evaluate(id => { __ed.slotAction('dup', id); __ed.slotAction('ren', id); }, id);
    const slots2 = await ed.evaluate(() => JSON.parse(localStorage.getItem('match-express:level-slots')));
    chk(Object.keys(slots2).length === Object.keys(slots0).length + 2 && slots2[id].name === 'Renamed level', 'level slots: save, duplicate and rename');
    await ed.evaluate(id => { __ed.edit(n => { n.name = 'Changed'; }); __ed.slotAction('load', id); }, id);
    chk(await ed.evaluate(() => __ed.level.name === 'Renamed level'), 'level slots: load');
    await ed.evaluate(id => __ed.slotAction('del', id), id);
    const nSlots = Object.keys(slots0).length;
    chk(await ed.evaluate(nSlots => Object.keys(JSON.parse(localStorage.getItem('match-express:level-slots'))).length === nSlots + 1, nSlots), 'level slots: delete');
    // new and flipped ramps get the default tilted platform
    const rt = await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(__ed.level))); __ed.edit(n => { n.ramps[0].shape = [[3, -3], [5, -6]]; delete n.ramps[0].tilt; });
      __ed.addRamp(); const a = __ed.level.ramps[__ed.level.ramps.length-1]; __ed.sel.ramp = 0; __ed.rampAction('flip'); const f = __ed.level.ramps[0];
      return {added: a.tilt, addedShape: !!a.shape, flipped: f.tilt, flippedShape: !!f.shape}; });
    chk(rt.added >= 30 && rt.added <= 35 && !rt.addedShape && rt.flipped === rt.added && !rt.flippedShape, 'added and flipped ramps get the tilted platform shape', JSON.stringify(rt));
    // Test + Watch greedy
    await ed.evaluate(lv => __ed.setLevel(lv), CLASSIC);
    await ed.click('#testBtn');
    const t = await until(() => ed.evaluate(() => __ed.lastTest && !__ed.lastTest.pending && __ed.lastTest), 120000, 300);
    chk(t && t.greedy.result === 'win' && t.greedy.sends === 52 && t.wins === 31 && t.label === 'Medium', 'Test runs greedy + 200 random bots in the background worker (classic layout: the baseline numbers)', t && `${t.greedy.result} ${t.greedy.sends} sends, ${t.wins}/200 ${t.label}`);
    chk(await ed.evaluate(() => /Medium/.test(document.getElementById('testOut').textContent)), 'the difficulty label is shown in the checks panel');
    await ed.click('#watchBtn');
    chk(await until(() => frame.evaluate(() => document.getElementById('botTag').style.display === 'block' && __me.game.sends > 0), 30000), '"Watch greedy" plays the greedy bot in the preview');
    // the built-in (compact) level: Test reports a win and Medium; leave it playing in the preview for the screenshot
    await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))); __ed.setTab('ramps'); });
    await ed.click('#testBtn');
    const t2 = await until(() => ed.evaluate(() => __ed.lastTest && !__ed.lastTest.pending && __ed.lastTest.greedy.sends !== 52 && __ed.lastTest), 120000, 300);
    chk(t2 && t2.greedy.result === 'win' && t2.label === 'Medium', 'Test on the built-in compact level: greedy WIN, random bot Medium', t2 && `${t2.greedy.sends} sends, ${t2.greedy.t.toFixed(1)} s, ${t2.wins}/200`);
    await ed.click('#watchBtn');
    await until(() => frame.evaluate(() => __me.LEVEL.name === 'Level 2' && __me.game.t > 9), 30000);
    await ed.screenshot({path: path.join(ROOT, 'screenshot-editor.png')});
    await ctx.close();
  } catch (e) { fail++; console.log('  FAIL  exception: ' + (e.stack || e)); }
  chk(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`);
  process.exitCode = fail ? 1 : 0;
})();
