// Browser tests for the game and the editor (Playwright, Chromium): the game on its own (sending, speed,
// sound, it never loads editor levels), its visuals, and the editor: toolbar / tools / inspector / help,
// its own preview, road and ramp-node editing with snapping, blocker tools, queue links with bellows, level
// ids, the level order panel, JSON and playable-HTML exports (a pack played level after level to the
// "All levels complete" screen), and the background bot test.
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
  const errors = []; const watch = p => p.on('pageerror', e => errors.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).map(x => x.trim()).join(' < ')));
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
      // the game never loads editor levels: old "current level", saved slots and a level order are all ignored
      await p.evaluate(() => { const lv = JSON.parse(JSON.stringify(__me.C.LEVEL_DATA)); lv.name = 'Saved Test'; localStorage.setItem('match-express:current-level', JSON.stringify(lv));
        localStorage.setItem('match-express:level-slots', JSON.stringify({x:{name:'Saved Test', level:Object.assign(lv, {id:'x'})}})); localStorage.setItem('match-express:level-order', '["x"]'); });
      await p.reload(); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.levelSource === 'builtin' && __me.LEVEL.name === 'Level 2'), 'the game ignores levels saved by the editor and opens its built-in level');
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
      chk(m.bay8 >= 35, 'an 8-seat bus in a bay is drawn at least 35 px long (bays at road size)', m.bay8.toFixed(1) + ' px');
      // the front bus of each lane: 10% larger than the buses behind; no tap outline outside a tutorial; a sent bus never shrinks
      { const q = await p.evaluate(() => { __me.freeze(false); __me.pump(0.5); const g = __me.game, V = __me.views;
          return g.lanes.map((ln, l) => ln.slice(0, 3).map(id => ({s:V[id].root.scale.x, ring:V[id].ring.visible && V[id].ring.material.opacity > 0.05}))); });
        chk(q.every(ln => !ln[0].ring && Math.abs(ln[0].s - 1) < 1e-6 && ln.slice(1).every(b => !b.ring && Math.abs(b.s*1.1 - 1) < 1e-3)),
          'each lane\'s front bus is 10% larger than the buses behind; no bus wears the tap outline outside a tutorial', JSON.stringify(q[0]));
        const tr = await p.evaluate(() => { const g = __me.game, id = g.lanes[0][0], next = g.lanes[0][1], v = __me.views[id]; let minS = 9, maxS = 0, onRoad = false;
          __me.tapLane(0);
          for (let i = 0; i < 600 && !onRoad; i++){ __me.pump(1/60); minS = Math.min(minS, v.root.scale.x); maxS = Math.max(maxS, v.root.scale.x); onRoad = g.buses[id].state === 'road'; }
          for (let i = 0; i < 60; i++) __me.pump(1/60);
          const nv = __me.views[next]; return {minS, maxS, onRoad, next:{front:g.lanes[0][0] === next, s:nv.root.scale.x, ring:nv.ring.visible}}; });
        chk(tr.onRoad && tr.minS === 1 && tr.maxS === 1, 'a sent bus keeps its front-bus size (road size) every frame from the lane to the road',
          `scale ${tr.minS}-${tr.maxS}, on the road ${tr.onRoad}`);
        chk(tr.next.front && Math.abs(tr.next.s - 1) < 1e-6 && !tr.next.ring, 'the bus behind moves up and grows to front size (no outline)', JSON.stringify(tr.next));
        await p.evaluate(() => { __me.restart(); __me.freeze(true); __me.render(); }); }
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

    /* ---------------- editor: layout, preview, independence ---------------- */
    console.log('editor');
    const ctx = await newCtx({width:1440, height:900});
    const ed = await ctx.newPage(); watch(ed);
    let promptAnswer = '';
    ed.on('dialog', d => d.accept(d.type() === 'prompt' ? promptAnswer : undefined));
    await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => !!window.__ed, null, {timeout:60000});
    const frame = await until(async () => ed.frames().find(f => f.url().includes('index.html')));
    await frame.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    chk(await until(() => frame.evaluate(() => __me.levelSource === 'editor' && __me.embed)), 'the preview iframe runs the real game with the level sent by the editor');
    chk(await ed.evaluate(() => { const r = document.getElementById('preview').getBoundingClientRect(); return r.width > 300 && r.left > 1000; }), 'the preview sits to the right of the work area, in a phone frame');
    { const ui = await ed.evaluate(() => ({
        bar: ['#fileMenu', '#undoBtn', '#redoBtn', '#runBtn', '#testBtn', '#exportMenu', '#helpBtn'].every(q => document.querySelector(q)),
        barTips: [...document.querySelectorAll('#bar > button, #bar .menu > [data-menu]')].every(b => b.title && b.querySelector('svg.i')),
        tools: [...document.querySelectorAll('#palette [data-tool]')].map(b => ({id:b.dataset.tool, tip:/\(\d or \w\)$/.test(b.title), icon:!!b.querySelector('svg.i')})),
        insp: !!document.querySelector('#insp .card'), queue: document.querySelectorAll('#queueSvg .bus').length }));
      chk(ui.bar && ui.barTips, 'top toolbar: file menu, undo/redo, run/test, export, help; every button has an icon and a tooltip');
      chk(ui.tools.map(t => t.id).join(',') === 'select,road,ramp,paint,erase,hide,tunnel,lock,count,link' && ui.tools.every(t => t.tip && t.icon),
        'left tool panel with every blocker tool, each with an icon and a tooltip naming its shortcut', ui.tools.map(t => t.id).join(','));
      chk(ui.insp && ui.queue === 26, 'right inspector and the queue pane (26 buses of Level 2)'); }
    await ed.keyboard.press('?');
    chk(await ed.evaluate(() => document.getElementById('helpModal').classList.contains('show') && document.querySelectorAll('#keysList kbd').length >= 20), 'pressing ? opens the keyboard shortcut overlay');
    await ed.keyboard.press('Escape');
    chk(await ed.evaluate(() => !document.querySelector('.modal.show')), 'Esc closes it');
    await ed.keyboard.press('t');
    chk(await ed.evaluate(() => __ed.tool === 'tunnel' && document.querySelector('#palette [data-tool="tunnel"]').classList.contains('on')), 'a tool shortcut (T) picks the tool and highlights it');
    await ed.keyboard.press('v');
    // RUN restarts the level fresh in the preview
    await ed.fill('#levelName', 'Run Test'); await ed.press('#levelName', 'Enter'); await ed.evaluate(() => document.getElementById('levelName').dispatchEvent(new Event('change')));
    await frame.evaluate(() => { __me.tapLane(0); __me.advance(3); });
    const s0 = await frame.evaluate(() => __me.serial);
    await ed.click('#runBtn');
    chk(await until(() => frame.evaluate(s => __me.serial > s && __me.LEVEL.name === 'Run Test' && __me.game.t < 1 && __me.game.sends === 0, s0)), 'RUN restarts the preview fresh with the edited level');
    // independence: the game page never shows editor levels
    await ed.keyboard.press('Control+s');
    chk(await ed.evaluate(() => localStorage.getItem('match-express:current-level') === null && !!JSON.parse(localStorage.getItem('match-express:level-slots'))[__ed.level.id]),
      'saving keeps the level in the editor\'s own slots only (no "current level" for the game)');
    const tab = await ctx.newPage(); watch(tab);
    await tab.goto(base + '/index.html?nosim'); await tab.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
    await ed.evaluate(() => __ed.edit(n => { n.name = 'Synced'; })); await ed.click('#runBtn'); await sleep(1500);
    chk(await tab.evaluate(() => __me.levelSource === 'builtin' && __me.LEVEL.name === 'Level 2' && !__me.embed), 'a game page opened next to the editor keeps its own built-in level, also after RUN in the editor');
    await tab.close();
    // auto-run: edits restart the preview after ~500 ms
    await ed.click('#autoBtn'); await sleep(1500);                 // switching auto-run on runs the preview once
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
    await ed.click('#undoBtn'); const afterBtn = await ed.evaluate(() => __ed.level.name); await ed.click('#redoBtn');
    chk(afterUndo === nm && afterRedo === 'Undo me' && afterBtn === nm, 'Ctrl+Z / Ctrl+Shift+Z and the toolbar buttons undo and redo an edit', `${afterUndo} / ${afterRedo} / ${afterBtn}`);
    // road editing with the mouse: click on the road adds a point, right-click deletes, drag moves
    await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))); __ed.fitView(); __ed.setTool('road'); });
    const box = await ed.locator('#view').boundingBox();
    const toScreen = async (x, z) => { const [sx, sy] = await ed.evaluate(([x, z]) => __ed.W2S(x, z), [x, z]); return [box.x + sx, box.y + sy]; };
    const roadPt = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, (R.pointS[9] + R.pointS[10])/2, o, 0); return [o.x, o.z]; });
    const before0 = await ed.evaluate(() => __ed.level.road.points.map(p => p.x + ',' + p.z)), n0 = before0.length;
    let [mx, my] = await toScreen(...roadPt); await ed.mouse.click(mx, my);
    const after0 = await ed.evaluate(() => __ed.level.road.points.map(p => p.x + ',' + p.z)), n1 = after0.length;
    chk(n1 === n0 + 1, 'road tool: clicking on the road inserts a control point', `${n0} -> ${n1}`);
    const ins = after0.findIndex((p, i) => p !== before0[i]), pt = after0[ins].split(',').map(Number);
    chk(ins > 0 && Math.hypot(pt[0] - roadPt[0], pt[1] - roadPt[1]) < 0.1, 'the new point lands where the road was clicked, in road order', 'index ' + ins);
    [mx, my] = await toScreen(...pt);
    await ed.mouse.move(mx + 30, my + 30); await ed.mouse.move(mx, my);
    chk(await ed.evaluate(i => __ed.hover && __ed.hover.kind === 'point' && __ed.hover.i === i, ins), 'hovering a point highlights it');
    await ed.mouse.down(); await ed.mouse.move(mx + 30, my, {steps:5}); await ed.mouse.up();
    const moved = await ed.evaluate(i => __ed.level.road.points[i].x, ins);
    chk(moved > pt[0] + 0.5 && await ed.evaluate(i => __ed.sel.kind === 'point' && __ed.sel.i === i, ins), 'dragging a control point moves it and selects it', `${pt[0]} -> ${moved}`);
    [mx, my] = await toScreen(moved, pt[1]); await ed.mouse.click(mx, my, {button:'right'});
    chk(await ed.evaluate(() => document.getElementById('ctx').classList.contains('show') && /Road point/.test(document.getElementById('ctx').textContent)), 'right-clicking a control point opens its menu');
    await ed.locator('#ctx button', {hasText:'Delete'}).click();
    chk(await ed.evaluate(() => __ed.level.road.points.length) === n0, 'Delete in that menu deletes the point');
    { const p5 = await ed.evaluate(() => { const p = __ed.level.road.points[5]; return [p.x, p.z]; }); const [lx, ly] = await toScreen(...p5);
      await ed.evaluate(([x, y]) => { const cv = document.getElementById('view'); const o = {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true, button:0};
        cv.dispatchEvent(new PointerEvent('pointerdown', o)); }, [lx, ly]);
      await until(() => ed.evaluate(n => __ed.level.road.points.length === n, n0 - 1), 4000, 100);   // hold until it goes
      await ed.evaluate(([x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent('pointerup', {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true})), [lx, ly]);
      chk(await ed.evaluate(() => __ed.level.road.points.length) === n0 - 1, 'a touch long-press on a control point deletes it');
      await ed.keyboard.press('Control+z'); }
    chk(await ed.evaluate(() => __ed.check.warnings.length === 0 && __ed.level.ramps.every(r => r.at != null)), 'ramps stay attached (re-snapped) after road edits and the level stays warning-free');
    // the target zone: the wide classic road leaves it -> warnings in the list; a point added out there lands inside the frame
    await ed.evaluate(lv => { __ed.setLevel(lv); __ed.fitView(); __ed.setTool('road'); }, CLASSIC);
    chk(await ed.evaluate(() => __ed.check.warnings.some(w => w.kind === 'zone-road') && /target zone/.test(document.getElementById('checks').textContent)), 'a road outside the target zone is listed in the checks');
    { const far = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; const n = R.pointS.length; window.MECore.pathAt(R, (R.pointS[n-2] + R.pointS[n-1])/2, o, 0); return [o.x, o.z]; });
      const n2 = await ed.evaluate(() => __ed.level.road.points.length);
      await ed.evaluate(([x, z]) => { const cv = document.getElementById('view'), r = cv.getBoundingClientRect(), [sx, sy] = __ed.W2S(x, z);   // may be off the visible canvas
        const o = {clientX:r.left + sx, clientY:r.top + sy, pointerId:78, pointerType:'mouse', bubbles:true, button:0};
        cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); }, far);
      const np = await ed.evaluate(n => { const pts = __ed.level.road.points; if (pts.length !== n + 1) return null; const p = pts[__ed.sel.i]; return [p.x, p.z, window.MECore.inTarget(p.x, 0.9, p.z)]; }, n2);
      chk(np && np[2], 'a road point added outside the frame is created inside it', JSON.stringify({clicked:far.map(v => +v.toFixed(2)), placed:np})); }
    // spiral toggle from the inspector
    await ed.evaluate(() => { __ed.sel = {kind:'point', i:13}; });
    await ed.locator('#insp button', {hasText:'Spiral off'}).click();
    chk(await ed.evaluate(() => !!__ed.level.road.points[13].spiral && __ed.layout.ROAD.spirals.length === 2), 'the Spiral toggle in the point inspector adds a loop');
    await ed.keyboard.press('Control+z');
    // stickmen: paint, hidden brush, eraser
    await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))); __ed.fitView(); __ed.setTool('paint'); __ed.color = 'cyan'; });
    const cellAt = (src, c, k) => ed.evaluate(([src, c, k]) => { const r = __ed.layout.RAMPS.find(q => q.src === src); return [r.slots[c][k].x, r.slots[c][k].z]; }, [src, c, k]);
    [mx, my] = await toScreen(...await cellAt(0, 0, 2)); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.level.ramps[0].columns[0][2] === 'cyan'), 'painting a cell with the cyan brush');
    await ed.evaluate(() => __ed.setTool('hide')); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.level.ramps[0].columns[0][2] === '?cyan'), 'the hidden brush turns a stickman into a grey "?" one');
    await ed.evaluate(() => __ed.setTool('erase')); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.level.ramps[0].columns[0][2] === null), 'the eraser leaves the cell empty');
    chk(await ed.evaluate(() => !__ed.check.balanced && document.querySelectorAll('#checks .cc.bad').length === 1), 'the checks panel turns exactly that colour red');
    await ed.evaluate(() => { __ed.rampAction('fill', 0); });
    { const used = await ed.evaluate(() => [...new Set(__ed.level.ramps.slice(1).flatMap(r => r.columns.flat()).filter(Boolean))]);
      const fill = await ed.evaluate(() => __ed.level.ramps[0].columns);
      const runsOk = fill.every(col => { let run = 1; for (let i=1;i<col.length;i++){ run = col[i] === col[i-1] ? run + 1 : 1; if (run > 3) return false; } return col.every(c => used.includes(c)); });
      chk(runsOk, 'Fill random uses the colours already in the level, in runs of 1-3 per column'); }
    await ed.evaluate(() => __ed.undo());
    // ramps: size steppers in the inspector, the front node snaps to the road, unsnapped ramps warn
    await ed.evaluate(() => { __ed.setTool('select'); __ed.sel = {kind:'ramp', ramp:1}; });
    const rows1 = await ed.evaluate(() => __ed.layout.RAMPS.find(r => r.src === 1).rows);
    await ed.locator('#insp button[data-a="c+"]').click(); await ed.locator('#insp button[data-a="r-"]').click();
    chk(await ed.evaluate(r0 => { const r = __ed.level.ramps[1]; return r.columns.length === 5 && r.rows === r0 - 1; }, rows1), 'column + and row − in the ramp inspector resize the ramp');
    const before = await ed.evaluate(() => __ed.layout.RAMPS.find(r => r.src === 1).s);
    const fp = await ed.evaluate(() => __ed.layout.RAMPS.find(q => q.src === 1).ctrl[0]);
    const target = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, R.pointS[6] - 1.0, o, 0); return [o.x, o.z]; });
    [mx, my] = await toScreen(...fp); let [tx, ty] = await toScreen(...target);
    await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:8});
    await ed.mouse.up();
    const after = await ed.evaluate(() => { const r = __ed.layout.RAMPS.find(r => r.src === 1); return {s:r.s, snapped:r.snapped}; });
    chk(Math.abs(after.s - before) > 0.6 && after.snapped, 'dragging the front node along the road moves the boarding point; it stays snapped', `${before.toFixed(2)} -> ${after.s.toFixed(2)}`);
    { const off = await ed.evaluate(() => { const r = __ed.layout.RAMPS.find(q => q.src === 1), [x0, z0] = r.ctrl[0], dx = r.ctrl[1][0] - x0, dz = r.ctrl[1][1] - z0, d = Math.hypot(dx, dz);
        for (let t = 1.5; t < 8; t += 0.25){ const x = x0 + dx/d*t, z = z0 + dz/d*t; if (!__ed.snapFront(x, z)) return [x, z]; } return null; });   // outwards, clear of the road
      const fp2 = await ed.evaluate(() => __ed.layout.RAMPS.find(q => q.src === 1).ctrl[0]);
      [mx, my] = await toScreen(...fp2); [tx, ty] = await toScreen(...off);
      await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:8}); await ed.mouse.up();
      const st = await ed.evaluate(() => ({snapped:__ed.layout.RAMPS.find(r => r.src === 1).snapped, warn:__ed.check.warnings.some(w => w.kind === 'ramp-unsnapped' && w.ramp === 1),
        pill:/not on the road/.test(document.getElementById('insp').textContent), listed:/not connected|not on the road|unsnapped/i.test(document.getElementById('warnList').textContent)}));
      chk(!st.snapped && st.warn && st.pill && st.listed, 'a front node dropped away from the road leaves the ramp unsnapped, with a warning', JSON.stringify(st));
      await ed.locator('#insp button[data-a="snap"]').click();
      chk(await ed.evaluate(() => __ed.layout.RAMPS.find(r => r.src === 1).snapped && !__ed.check.warnings.some(w => w.kind === 'ramp-unsnapped')), '"Snap to road" puts it back on the road'); }
    // the ramp tool adds a ramp at the clicked road side
    { const n = await ed.evaluate(() => __ed.level.ramps.length); await ed.evaluate(() => __ed.setTool('ramp'));
      const spot = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, R.pointS[3], o, 0); return [o.x - o.dz*1.2, o.z + o.dx*1.2]; });
      [mx, my] = await toScreen(...spot); await ed.mouse.click(mx, my);
      chk(await ed.evaluate(n => __ed.level.ramps.length === n + 1 && __ed.sel.kind === 'ramp' && __ed.layout.RAMPS.find(r => r.src === n).snapped && __ed.level.ramps[n].tilt >= 30, n),
        'the ramp tool adds a snapped, tilted ramp where the road was clicked'); }
    // blockers with the mouse: tunnel, count box, lock box + key bus
    await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))); __ed.fitView(); __ed.setTool('tunnel'); __ed.color = 'red'; });
    const dragCells = async (src, a, b) => { const [x0, y0] = await toScreen(...await cellAt(src, a[0], a[1])), [x1, y1] = await toScreen(...await cellAt(src, b[0], b[1]));
      await ed.mouse.move(x0, y0); await ed.mouse.down(); await ed.mouse.move(x1, y1, {steps:6}); await ed.mouse.up(); };
    const red0 = await ed.evaluate(() => __ed.check.perColor.find(p => p.color === 'red').men);
    const under = await ed.evaluate(() => [1, 2].flatMap(c => [2, 3].map(k => __ed.level.ramps[0].columns[c][k])).filter(x => x && x.replace('?', '') === 'red').length);
    await dragCells(0, [1, 2], [2, 3]);
    { const t = await ed.evaluate(() => (__ed.level.ramps[0].tunnels || [])[0]), red1 = await ed.evaluate(() => __ed.check.perColor.find(p => p.color === 'red').men);
      chk(t && t.col === 1 && t.row === 2 && t.w === 2 && t.h === 2 && t.color === 'red' && t.count >= 2 && await ed.evaluate(() => [1, 2].every(c => [2, 3].every(k => __ed.level.ramps[0].columns[c][k] === null))),
        'tunnel tool: dragging across cells places a 2x2 red tunnel over empty cells', JSON.stringify(t));
      chk(red1 === red0 - under + t.count && await ed.evaluate(() => __ed.sel.kind === 'tunnel'), 'its stickmen count toward the red total; the new tunnel is selected', `${red0} - ${under} + ${t.count} = ${red1}`); }
    await ed.fill('#tCount', '9'); await ed.press('#tCount', 'Enter'); await ed.evaluate(() => document.getElementById('tCount') && document.getElementById('tCount').dispatchEvent(new Event('change')));
    chk(await ed.evaluate(() => __ed.level.ramps[0].tunnels[0].count === 9), 'the tunnel inspector edits its count');
    { const nT = await ed.evaluate(() => __ed.level.ramps[1].tunnels ? __ed.level.ramps[1].tunnels.length : 0); await dragCells(1, [0, 0], [0, 1]);
      chk(await ed.evaluate(n => (__ed.level.ramps[1].tunnels || []).length === n, nT), 'a tunnel touching the front row is refused (it needs a cell in front)'); }
    await ed.evaluate(() => __ed.setTool('count')); await dragCells(1, [0, 1], [1, 2]);
    chk(await ed.evaluate(() => { const b = (__ed.level.ramps[1].boxes || [])[0]; return b && b.count >= 1 && b.lock == null && b.w === 2 && b.h === 2 && __ed.sel.kind === 'box'; }), 'count box tool: a 2x2 crate with a count');
    await ed.fill('#bCount', '4'); await ed.evaluate(() => document.getElementById('bCount').dispatchEvent(new Event('change')));
    chk(await ed.evaluate(() => __ed.level.ramps[1].boxes[0].count === 4), 'the box inspector sets the count');
    await ed.evaluate(() => __ed.setTool('lock')); await dragCells(1, [1, 3], [1, 4]);
    chk(await ed.evaluate(() => __ed.level.ramps[1].boxes.length === 1), 'a second blocker over the same column is refused (one per column)');
    await dragCells(2, [0, 0], [1, 1]);
    chk(await ed.evaluate(() => { const b = (__ed.level.ramps[2].boxes || [])[0]; return b && b.lock === 'K1' && __ed.check.warnings.some(w => w.kind === 'lock-no-key'); }), 'lock box tool: a crate with lock K1, and a warning until a bus carries its key');
    await ed.selectOption('#bKey', '1:0');
    chk(await ed.evaluate(() => __ed.level.lanes[1][0].key === 'K1' && !__ed.check.warnings.some(w => /^lock|key/.test(w.kind)) && /K1/.test(document.getElementById('queueSvg').textContent)),
      'the key bus picker puts the key on that bus (shown in the queue) and clears the warning');
    // select a blocker by clicking it, delete it with the Delete key
    await ed.evaluate(() => __ed.setTool('select'));
    [mx, my] = await toScreen(...await cellAt(0, 1, 2)); await ed.mouse.click(mx, my);
    chk(await ed.evaluate(() => __ed.sel.kind === 'tunnel' && __ed.sel.ramp === 0), 'clicking a tunnel selects it');
    await ed.keyboard.press('Delete');
    chk(await ed.evaluate(() => !(__ed.level.ramps[0].tunnels || []).length), 'Delete removes the selected blocker');
    await ed.keyboard.press('Control+z');
    // queue: add, hide, connect (with bellows), refuse a non-touching group, reorder
    await ed.click('#addBusBtn'); await ed.click('#bpLanes [data-l="2"]'); await ed.click('#bpColors [data-c="green"]'); await ed.click('#bpCaps [data-cap="4"]'); await ed.click('#bpAdd'); await ed.click('#bpClose');
    chk(await ed.evaluate(() => { const l = __ed.level.lanes[2]; return l[l.length-1].color === 'green' && l[l.length-1].cap === 4; }), '"Add bus" (lane 3, green, 4 seats) adds that bus to the end of lane 3');
    await ed.dblclick('#queueSvg .bus[data-key="2:1"]');
    chk(await ed.evaluate(() => __ed.level.lanes[2][1].hidden === true && /\?/.test(document.querySelector('#queueSvg .bus[data-key="2:1"]').textContent)), 'double-clicking a bus makes it a hidden "?" bus');
    await ed.click('#queueSvg .bus[data-key="0:2"]'); await ed.click('#queueSvg .bus[data-key="1:2"]', {modifiers:['Shift']});
    await ed.keyboard.press('l');
    chk(await ed.evaluate(() => { const a = __ed.level.lanes[0][2], b = __ed.level.lanes[1][2]; return a.link != null && a.link === b.link; }) && await ed.evaluate(() => !!document.querySelector('#queueSvg rect[fill="url(#bellow)"]')),
      'Shift-click two neighbouring buses + L connects them, drawn with bellows');
    await ed.click('#queueSvg .bus[data-key="0:5"]'); await ed.click('#queueSvg .bus[data-key="2:0"]', {modifiers:['Shift']});
    chk(await ed.evaluate(() => !__ed.linkSelected() && __ed.level.lanes[0][5].link == null), 'buses that do not touch cannot be connected');
    const order0 = await ed.evaluate(() => __ed.level.lanes[0].map(b => b.color + b.cap).join(','));
    { const c0 = await ed.locator('#queueSvg .bus[data-key="0:0"]').boundingBox(), c2 = await ed.locator('#queueSvg .bus[data-key="0:2"]').boundingBox();
      await ed.mouse.move(c0.x + c0.width/2, c0.y + c0.height/2); await ed.mouse.down(); await ed.mouse.move(c2.x + c2.width/2, c2.y + c2.height + 2, {steps:8}); await ed.mouse.up(); }
    const order1 = await ed.evaluate(() => __ed.level.lanes[0].map(b => b.color + b.cap).join(','));
    { const o0 = order0.split(','), o1 = order1.split(',');
      chk(o1[2] === o0[0] && o1[0] === o0[1] && o1[1] === o0[2], 'dragging the front bus below the third one reorders the lane', o1.slice(0, 3).join(' ')); }
    // level ids: unique and editable
    await ed.evaluate(() => { __ed.saveLevel(false); });
    const idNow = await ed.evaluate(() => __ed.level.id);
    await ed.fill('#levelId', 'lvl_900'); await ed.evaluate(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    chk(await ed.evaluate(id => __ed.level.id === 'lvl_900' && !!JSON.parse(localStorage.getItem('match-express:level-slots')).lvl_900 && !JSON.parse(localStorage.getItem('match-express:level-slots'))[id], idNow),
      'editing the id field renames the saved level', idNow + ' -> lvl_900');
    await ed.fill('#levelId', 'demo_tunnel'); await ed.evaluate(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    await ed.fill('#levelId', 'bad id!'); await ed.evaluate(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    chk(await ed.evaluate(() => __ed.level.id === 'lvl_900' && document.getElementById('levelId').value === 'lvl_900'), 'an id already in use, or with bad characters, is refused');
    await ed.evaluate(() => __ed.newLevel());
    chk(await ed.evaluate(() => /^lvl_\d{3}$/.test(__ed.level.id) && __ed.level.id !== 'lvl_900' && __ed.level.ramps.length === 0), 'New level gets the next free "lvl_###" id', await ed.evaluate(() => __ed.level.id));
    await ed.evaluate(() => { __ed.openLevel('lvl_900'); document.activeElement.blur(); });    // shortcuts don't fire while typing in a field
    await ed.keyboard.press('Control+o');
    chk(await ed.evaluate(() => { const ids = [...document.querySelectorAll('#levelList .lrow code')].map(c => c.textContent); return ids.includes('lvl_900') && ids.includes('demo_combo') && ids.includes('crowded-rush'); }),
      'the Levels panel lists the saved levels by id (bundled demos seeded)');
    // level order: add, warn on unknown / duplicate ids, reorder by drag, remove, export / import
    await ed.evaluate(() => localStorage.setItem('match-express:level-order', '[]'));
    for (const id of ['demo_tunnel', 'lvl_900', 'nope', 'demo_tunnel']){ await ed.fill('#orderAdd', id); await ed.press('#orderAdd', 'Enter'); }
    { const st = await ed.evaluate(() => ({ids:__ed.orderState().ids, warns:[...document.querySelectorAll('#orderWarn .owarn')].map(d => d.textContent), bad:[...document.querySelectorAll('#orderList .orow.bad')].map(r => +r.dataset.i)}));
      chk(st.ids.join(',') === 'demo_tunnel,lvl_900,nope,demo_tunnel' && st.warns.some(w => /nope.*not a saved level/.test(w)) && st.warns.some(w => /demo_tunnel.*twice/.test(w)) && st.bad.join() === '2,3',
        'the Level Order panel adds ids and warns about unknown and duplicate ones', JSON.stringify(st)); }
    chk(await ed.evaluate(async () => (await __ed.exportHtml('order')) === null), 'a level order with warnings cannot be exported');
    await ed.locator('#orderList .orow[data-i="3"] button').click(); await ed.locator('#orderList .orow[data-i="2"] button').click();
    await ed.evaluate(() => __ed.orderAdd('demo_hidden_bus'));
    await ed.dragAndDrop('#orderList .orow[data-i="2"]', '#orderList .orow[data-i="0"]');
    chk(await ed.evaluate(() => __ed.orderState().ids.join(',') === 'demo_hidden_bus,demo_tunnel,lvl_900' && !__ed.orderState().warns.length), 'removing and dragging rows reorders the level order', await ed.evaluate(() => __ed.orderState().ids.join(',')));
    { const [dl] = await Promise.all([ed.waitForEvent('download', {timeout:10000}).catch(() => null), ed.click('#orderExport')]);
      const o = dl ? JSON.parse(fs.readFileSync(await dl.path(), 'utf8')) : null;
      chk(dl && dl.suggestedFilename() === 'level-order.json' && o.type === 'match-express-level-order' && o.levels.join(',') === 'demo_hidden_bus,demo_tunnel,lvl_900', 'Export order JSON downloads the ids in order', dl && dl.suggestedFilename());
      await ed.evaluate(() => __ed.importOrder(JSON.stringify({type:'match-express-level-order', version:1, levels:['demo_count_box', 'demo_hidden_bus']})));
      chk(await ed.evaluate(() => __ed.orderState().ids.join(',') === 'demo_count_box,demo_hidden_bus'), 'Import order JSON replaces the order');
      await ed.evaluate(o => __ed.importOrder(JSON.stringify(o)), o); }
    await ed.evaluate(() => __ed.closeModals());
    // exports: level JSON with its id, playable HTML (one level, or the whole order), frozen snapshots
    { const [dl] = await Promise.all([ed.waitForEvent('download', {timeout:10000}).catch(() => null), ed.evaluate(() => __ed.exportLevelJSON())]);
      const o = dl ? JSON.parse(fs.readFileSync(await dl.path(), 'utf8')) : null;
      chk(dl && dl.suggestedFilename() === 'lvl_900.json' && o.id === 'lvl_900' && o.format === 2, 'Export level JSON downloads the level with its id', dl && dl.suggestedFilename()); }
    const htmlOne = await ed.evaluate(() => __ed.exportHtml('level'));
    chk(htmlOne && /window\.ME_SHARE = /.test(htmlOne) && htmlOne.includes('"id":"lvl_900"') && /"three":"data:text\/javascript;base64,/.test(htmlOne) && !/<script src="[^"]*"><\/script>/.test(htmlOne) && !/cdn\.jsdelivr/.test(htmlOne),
      'Playable HTML (one level): one self-contained file with the level frozen inside', htmlOne && (htmlOne.length/1024).toFixed(0) + ' KB');
    // the pack's third level is lvl_900, reset to a clean copy of a demo so the bot can win it
    await ed.evaluate(() => { __ed.setLevel(Object.assign(JSON.parse(JSON.stringify(window.MECore.PRESETS.demo_count_box)), {id:'lvl_900', name:'Pack level 3'})); __ed.saveLevel(false); });
    const htmlAll = await ed.evaluate(() => __ed.exportHtml('order'));
    const tmp = path.join(require('os').tmpdir(), 'me-pack-' + process.pid + '.html'); fs.writeFileSync(tmp, htmlAll || '');
    const lvl900 = await ed.evaluate(() => __ed.level.name);
    await ed.evaluate(() => { __ed.edit(n => { n.name = 'Edited after export'; }); __ed.saveLevel(false); });
    { const pctx = await browser.newContext({viewport:{width:390, height:844}}), pp = await pctx.newPage(); watch(pp); const net = [];
      pp.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) net.push(r.url()); });
      await pp.goto(require('url').pathToFileURL(tmp).href); await pp.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const st0 = await pp.evaluate(() => ({src:__me.levelSource, name:__me.LEVEL.name, n:__me.playlist.length, step:document.getElementById('levelStep').textContent}));
      chk(st0.src === 'export' && st0.name === 'Demo: Hidden Buses' && st0.n === 3 && st0.step === 'Level 1 / 3', 'the exported pack opens from file:// with level 1 of 3 of the order', JSON.stringify(st0));
      const names = [];
      for (let k = 0; k < 3; k++){
        await pp.evaluate(() => { __me.setBot(true); for (let i = 0; i < 60 && !__me.game.result; i++) __me.advance(5); __me.setBot(false); __me.advance(3); __me.render(); });
        const w = await pp.evaluate(() => ({res:__me.game.result, name:__me.LEVEL.name, win:document.getElementById('winPanel').classList.contains('show'), next:document.getElementById('btnNext').textContent}));
        names.push(w.name + ':' + w.res + ':' + w.next);
        if (!w.win) break;
        await pp.click('#btnNext');
      }
      chk(names.join(' | ') === `Demo: Hidden Buses:win:Next level | Demo: Colourful Tunnels:win:Next level | ${lvl900}:win:Finish`, 'winning offers the next level, in order; the last one offers Finish', names.join(' | '));
      chk(await pp.evaluate(() => document.getElementById('donePanel').classList.contains('show') && /All levels complete/.test(document.getElementById('donePanel').textContent)), 'after the last level: the "All levels complete" screen');
      await pp.reload(); await pp.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      await pp.evaluate(() => __me.loadLevel(__me.playlist[2], 'export'));
      chk(await pp.evaluate(n => __me.LEVEL.name === n, lvl900) && !net.length, 'the export is a frozen snapshot (later editor edits do not reach it) and loads nothing from the network', net.slice(0, 2).join(' '));
      await pctx.close(); fs.unlinkSync(tmp); }
    { const g = await ctx.newPage(); watch(g);
      await g.goto(base + '/index.html?nosim'); await g.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await g.evaluate(() => __me.levelSource === 'builtin' && __me.LEVEL.name === 'Level 2'), 'with saved levels and a level order in storage, the game page still opens its built-in level');
      await g.close(); }
    // Test + Watch greedy
    await ed.evaluate(lv => __ed.setLevel(lv), CLASSIC);
    await ed.click('#testBtn');
    const t = await until(() => ed.evaluate(() => __ed.lastTest && !__ed.lastTest.pending && __ed.lastTest), 120000, 300);
    chk(t && t.greedy.result === 'win' && t.greedy.sends === 52 && t.wins === 31 && t.label === 'Medium', 'Test runs greedy + 200 random bots in the background worker (classic layout: the baseline numbers)', t && `${t.greedy.result} ${t.greedy.sends} sends, ${t.wins}/200 ${t.label}`);
    chk(await ed.evaluate(() => /Medium/.test(document.getElementById('testOut').textContent)), 'the difficulty label is shown in the checks panel');
    await ed.click('#watchBtn');
    chk(await until(() => frame.evaluate(() => document.getElementById('botTag').style.display === 'block' && __me.game.sends > 0), 30000), '"Watch" plays the greedy bot in the preview');
    // a blocker demo: Test reports its key-fallback warning list (none) and a win; leave it playing for the screenshot
    await ed.evaluate(() => { __ed.openLevel('demo_combo'); });
    await ed.click('#testBtn');
    const t2 = await until(() => ed.evaluate(() => __ed.lastTest && !__ed.lastTest.pending && __ed.lastTest.greedy.sends !== 52 && __ed.lastTest), 120000, 300);
    chk(t2 && t2.greedy.result === 'win' && !(t2.warnings || []).length, 'Test on the combined blocker demo: greedy WIN, no warnings', t2 && `${t2.greedy.sends} sends, ${t2.wins}/200 ${t2.label}`);
    await ed.click('#watchBtn');
    await until(() => frame.evaluate(() => __me.LEVEL.name === 'Demo: All Together' && __me.game.t > 9), 30000);
    await ed.evaluate(() => { __ed.sel = {kind:'box', ramp:1, i:0}; });
    await ed.screenshot({path: path.join(ROOT, 'screenshot-editor.png')});
    await ctx.close();
  } catch (e) { fail++; console.log('  FAIL  exception: ' + (e.stack || e)); }
  chk(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`);
  process.exitCode = fail ? 1 : 0;
})();
