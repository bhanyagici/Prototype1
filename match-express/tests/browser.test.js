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
      // speeds 1x to 3x in steps of 0.25 through one global time scale: the button steps through them and shows the current one
      const r1 = await p.evaluate(() => { __me.setSpeed(1); const t0 = __me.game.t; for (let i=0;i<30;i++) __me.pump(1/60); return __me.game.t - t0; });
      const steps = [];
      for (let k = 0; k < 9; k++){
        await p.click('#btnSpeed');
        steps.push(await p.evaluate(() => { const b = document.getElementById('btnSpeed'), t0 = __me.game.t; for (let i=0;i<30;i++) __me.pump(1/60);
          return {txt:b.textContent, on:b.classList.contains('on'), ts:__me.timeScale, dt:__me.game.t - t0, saved:window.MESync.loadPrefs().speed}; }));
      }
      chk(steps.map(x => x.txt).join(' ') === '1.25x 1.5x 1.75x 2x 2.25x 2.5x 2.75x 3x 1x' && steps.every(x => x.on === (x.ts > 1) && x.saved === x.ts),
        'the speed button steps 1x -> 1.25x -> ... -> 2.75x -> 3x -> 1x, shows the current speed (highlighted above 1x) and remembers it', steps.map(x => x.txt).join(' '));
      // the camera setting: Perspective / Orthographic from the settings, remembered; the level is redrawn in place
      const cam = await p.evaluate(() => { const g = __me.game, t0 = g.t; document.getElementById('btnCam').click(); __me.pump(1/60); __me.render();
        const a = {ortho:__me.camera.isOrthographicCamera, view:__me.view, txt:document.getElementById('btnCam').textContent, saved:window.MESync.loadPrefs().view, same:__me.game === g};
        document.getElementById('btnCam').click(); __me.pump(1/60); __me.render();
        return Object.assign(a, {back:!__me.camera.isOrthographicCamera && __me.view === 'persp' && window.MESync.loadPrefs().view === 'persp', t:g.t >= t0}); });
      chk(cam.ortho && cam.view === 'ortho' && cam.txt === 'Camera: Orthographic' && cam.saved === 'ortho' && cam.same && cam.back,
        'the camera setting switches Perspective <-> Orthographic in place (the same game) and remembers it', JSON.stringify(cam));
      chk(steps.every(x => Math.abs(x.dt - x.ts*r1) < 0.02), 'at each speed the whole game advances that much faster for the same real time',
        steps.map(x => `${x.txt} ${x.dt.toFixed(3)}s`).join(', ') + ` (1x ${r1.toFixed(3)}s)`);
      // 2x also speeds animation timers (a parachute's flight is keyed to game time)
      const anim = await p.evaluate(() => { __me.setSpeed(2); const v = __me.views[0], t0 = __me.game.t; for (let i=0;i<60;i++) __me.pump(1/60); const d = __me.game.t - t0; __me.setSpeed(1); return d; });
      chk(Math.abs(anim - 2) < 0.05, 'one real second at 2x is two seconds of game and animation time', anim.toFixed(2));
      // mute from the settings (in the pause menu), remembered
      await p.click('#btnPause'); await p.click('#pmSettings'); await sleep(400);
      chk(await p.evaluate(() => document.getElementById('settings').classList.contains('open')), 'Settings in the pause menu opens the settings panel');
      await p.click('#btnMute');
      chk(await p.evaluate(() => __me.muted === true && document.getElementById('btnMute').textContent === 'Sound: Off'), 'the mute toggle in settings mutes the game');
      chk(await p.evaluate(() => JSON.parse(localStorage.getItem('match-express:prefs')).muted === true), 'mute is remembered');
      await p.click('#btnMute'); await p.evaluate(() => { document.getElementById('settings').classList.remove('open'); __me.closePause(); });
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
      chk(m.bay8 >= 35, 'an 8-seat bus in a bay is drawn at least 35 px long', m.bay8.toFixed(1) + ' px');
      // the booster bar: at the very bottom, three chunky rounded-square buttons; the queue's third buses fully above it
      { const bb = await p.evaluate(() => { const app = document.getElementById('app').getBoundingClientRect(), k = app.height/1950, bar = document.getElementById('boosters').getBoundingClientRect();
          const btns = [...document.querySelectorAll('#boosters .boost')].map(b => b.getBoundingClientRect()), g = __me.game;
          const third = g.lanes.map(ln => ln[2]).filter(id => id != null).map(id => __me.busScreenBox(g.buses[id])[3]);
          return {top:(bar.top - app.top)/k, bottom:(bar.bottom - app.top)/k, n:btns.length, inBar:btns.every(r => r.top >= bar.top - 1 && r.bottom <= bar.bottom + 1),
            square:btns.every(r => Math.abs(r.width - r.height) < r.width*0.15 && r.width >= 40), third:Math.max(...third), queueBot:window.MECore.SCREEN.QUEUE_BOT*1950,
            boostTop:window.MECore.SCREEN.BOOST_TOP*1950}; });
        chk(Math.abs(bb.bottom - 1950) < 2 && Math.abs(bb.top - bb.boostTop) < 3 && bb.n === 3 && bb.inBar && bb.square,
          'the booster bar sits at the very bottom with three chunky rounded-square buttons', JSON.stringify(bb));
        chk(bb.third <= bb.queueBot + 1, 'every lane\'s third bus is drawn fully above the queue tunnel and the bar', `third bus bottom ${bb.third.toFixed(0)} px, tunnel arch at ${bb.queueBot.toFixed(0)} px (design px)`);
        const before = await p.evaluate(() => JSON.stringify([__me.game.counter, __me.game.lanes, __me.game.bays]));
        const bx = await p.locator('#boost2').boundingBox(); await p.mouse.click(bx.x + bx.width/2, bx.y + bx.height/2);
        const after = await p.evaluate(() => { __me.pump(0.3); return JSON.stringify([__me.game.counter, __me.game.lanes, __me.game.bays]); });
        chk(before === after, 'the boosters are inactive: a tap sends no bus and changes nothing'); }
      // the front bus of each lane: 10% larger than the buses behind; no tap outline outside a tutorial; a sent bus never shrinks
      { const q = await p.evaluate(() => { __me.freeze(false); __me.pump(0.5); const g = __me.game, V = __me.views;
          return g.lanes.map((ln, l) => ln.slice(0, 3).map(id => ({s:V[id].root.scale.x, ring:V[id].ring.visible && V[id].ring.material.opacity > 0.05}))); });
        chk(q.every(ln => !ln[0].ring && Math.abs(ln[0].s - 0.9) < 1e-6 && ln.slice(1).every(b => !b.ring && Math.abs(b.s*1.1 - 0.9) < 1e-3)),
          'each lane\'s front bus is drawn at 90% (all buses 10% smaller), 10% larger than the buses behind; no bus wears the tap outline outside a tutorial', JSON.stringify(q[0]));
        const tr = await p.evaluate(() => { const g = __me.game, id = g.lanes[0][0], next = g.lanes[0][1], v = __me.views[id]; let minS = 9, maxS = 0, onRoad = false;
          __me.tapLane(0);
          for (let i = 0; i < 600 && !onRoad; i++){ __me.pump(1/60); minS = Math.min(minS, v.root.scale.x); maxS = Math.max(maxS, v.root.scale.x); onRoad = g.buses[id].state === 'road'; }
          for (let i = 0; i < 60; i++) __me.pump(1/60);
          const nv = __me.views[next]; return {minS, maxS, onRoad, next:{front:g.lanes[0][0] === next, s:nv.root.scale.x, ring:nv.ring.visible}}; });
        chk(tr.onRoad && Math.abs(tr.minS - 0.9) < 1e-9 && Math.abs(tr.maxS - 0.9) < 1e-9, 'a sent bus keeps its front-bus size (90%, as on the road) every frame from the lane to the road',
          `scale ${tr.minS}-${tr.maxS}, on the road ${tr.onRoad}`);
        chk(tr.next.front && Math.abs(tr.next.s - 0.9) < 1e-6 && !tr.next.ring, 'the bus behind moves up and grows to front size (no outline)', JSON.stringify(tr.next));
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
        const side = samples.filter(s => s.u <= J.t1), atEdge = side[side.length - 1], firstUp = samples.find(s => s.u > J.t1 && s.y > atEdge.y + 0.02);
        const rampSide = (r.x - J.x)*J.ex + (r.z - J.z)*J.ez;                  // the ramp's boarding point relative to the exit direction
        const awayFromRamp = (() => { const o = {}; window.MECore.pathAt(L.ROAD, r.s, o, 0); const nx = -o.dz*r.side, nz = o.dx*r.side; return nx*J.ex + nz*J.ez; })();
        return {maxAlong:Math.max(...side.map(s => Math.abs(along(s)))), flat:Math.max(...side.map(s => Math.abs(s.y - J.y))) - J.lift - Math.max(0, __me.GD - J.y), outAtEdge:out(atEdge),
                outAtHop:firstUp ? out(firstUp) : null, awayFromRamp, need:__me.ROAD_HALF + window.MECore.BUS_W/2}; });
      chk(ex && ex.maxAlong < 0.02 && ex.flat < 0.01, 'a full bus first drives straight sideways (perpendicular to the road), only rising out of the road\'s groove (or over a crowd)',
          ex && `drift along road ${ex.maxAlong.toFixed(3)}, other lift ${ex.flat.toFixed(3)}`);
      chk(ex && ex.awayFromRamp < -0.99, 'it leaves on the side away from the ramp it boarded at');
      chk(ex && ex.outAtEdge >= ex.need && ex.outAtHop !== null && ex.outAtHop >= ex.need, 'the hop and parachute start only after the bus is completely off the road',
          ex && `clear at ${ex.need.toFixed(2)}, hop starts at ${ex.outAtHop && ex.outAtHop.toFixed(2)}`);
      // a bus that fills under an overpass (the old level 2: ramp 5, below the U-turn after the spiral) slides further
      // before it hops: during the hop and the first second under the parachute no raised road is overhead
      await p.evaluate(lv => { __me.loadLevel(lv, 'export'); if (__me.intro) __me.closeIntro(); __me.setBot(true); }, JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'level2-overpass.json'), 'utf8')));
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

    /* ---------------- Jelly bus movement ---------------- */
    console.log('bus movement: Rigid / Jelly');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.move === 'rigid'), 'buses are Rigid by default');
      await p.click('#btnPause'); await p.click('#pmSettings'); await p.click('#btnMove'); await p.evaluate(() => { document.getElementById('settings').classList.remove('open'); __me.closePause(); });
      chk(await p.evaluate(() => __me.move === 'jelly' && window.MESync.loadPrefs().move === 'jelly' && /Jelly/.test(document.getElementById('btnMove').textContent)),
        'the settings switch them to Jelly (remembered)');
      // a 12-seat bus driven along the whole road (nobody boards it), through the spiral, out of the exit tunnel and back
      // to a bay: a single body; once its wobble has settled every frame of it lies on the road; on a straight stretch it is
      // perfectly straight; entering and leaving curves it wobbles (overshoots its bend) and settles
      const r = await p.evaluate(() => {
        const C = window.MECore, lv = JSON.parse(JSON.stringify(C.LEVEL_DATA));
        lv.lanes = [[{color:'red', cap:12}], [], []]; lv.ramps.forEach(r => r.columns = r.columns.map(c => c.map(() => 'blue')));
        __me.loadLevel(lv, 'export'); __me.freeze(false);
        const g = __me.game, R = __me.layout.ROAD, sp = R.spirals[0], id = g.lanes[0][0];
        const dRoad = (x, z, s) => { let m = 1e9; for (let i = 0; i < R.n - 1; i++){ if (Math.abs(R.cum[i] - s) > 3) continue;
            const ax = R.P[i*3], az = R.P[i*3+2], dx = R.P[i*3+3] - ax, dz = R.P[i*3+5] - az, l2 = dx*dx + dz*dz || 1e-9, t = Math.max(0, Math.min(1, ((x - ax)*dx + (z - az)*dz)/l2));
            m = Math.min(m, Math.hypot(ax + dx*t - x, az + dz*t - z)); } return m; };
        const curv = s => { const a = {}, b = {}; C.pathAt(R, s - 0.3, a, 0); C.pathAt(R, s + 0.3, b, 0); return Math.abs(Math.atan2(a.dx*b.dz - a.dz*b.dx, a.dx*b.dx + a.dz*b.dz))/0.6; };
        __me.tapLane(0); let worstRoad = 0, spiralWorst = 0, nRoad = 0, maxBend = 0, spiral = 0, straightN = 0, straightWorst = 0, flips = 0, lastSign = 0, maxLag = 0, settled = 1e9,
          straightBay = null, straightQueue = true, chuteStraight = null;
        for (let i = 0; i < 60*60; i++){
          __me.pump(1/60); const bb = g.buses[id], F = __me.jellyFrames(id);
          if (bb.state === 'road' && bb.rs > bb.len && bb.rs < R.portalS - 1 && F.off){
            const mid = (F.off.length - 1) >> 1, err = F.off[0][0] - F.tgt[0][0], lag = Math.max(...F.off.map((o, k) => Math.abs(o[0] - F.tgt[k][0]) + Math.abs(o[3] - F.tgt[k][3])));
            maxLag = Math.max(maxLag, Math.abs(err));
            if (Math.abs(err) > 0.004){ const sg = Math.sign(err); if (lastSign && sg !== lastSign) flips++; lastSign = sg; }
            const inSp = bb.rs > sp.s0 && bb.rs < sp.s1;
            if (lag < 0.03 || inSp){                                  // settled (or in the spiral, wobbling or not): the whole body on the road
              F.pts.forEach(q => { const d = dRoad(q[0], q[2], bb.rs); if (inSp) spiralWorst = Math.max(spiralWorst, d); else worstRoad = Math.max(worstRoad, d); nRoad++; });
              if (inSp) spiral++; }
            const a = F.pts[0], m = F.pts[mid], z = F.pts[F.pts.length - 1];
            const off = Math.abs(((m[0] - a[0])*(z[2] - a[2]) - (m[2] - a[2])*(z[0] - a[0]))/(Math.hypot(z[0] - a[0], z[2] - a[2]) || 1));
            maxBend = Math.max(maxBend, off);
            // a straight stretch under the whole bus, a second after the last curve: perfectly straight
            let flat = true; for (let s = bb.rs - bb.len - 1.4; s <= bb.rs + bb.len; s += 0.1) if (curv(s) > 0.02) flat = false;
            if (flat){ straightN++; straightWorst = Math.max(straightWorst, off, ...F.off.map(o => Math.abs(o[0]) + Math.abs(o[3]))); }
          }
          g.lanes.flat().forEach(q => { if (__me.jellyFrames(q).bent) straightQueue = false; });
          if (bb.state === 'bay'){ for (let k = 0; k < 90; k++) __me.pump(1/60); straightBay = !__me.jellyFrames(id).bent; break; }
        }
        // a full bus on its parachute: straight a second after it leaves the road
        const lv2 = JSON.parse(JSON.stringify(C.LEVEL_DATA)); __me.loadLevel(lv2, 'export'); __me.freeze(false);
        for (let i = 0; i < 60*400 && chuteStraight === null; i++){ if (i % 20 === 0){ const a = C.greedyPick(__me.game); if (a) __me.tap(a); } __me.pump(1/60);
          const v = __me.views.find(w => w.b.state === 'jump' && w.jump && __me.game.t - w.jump.t0 > w.jump.t3 + 1.0); if (v) chuteStraight = !__me.jellyFrames(v.b.id).bent; }
        return {worstRoad, spiralWorst, nRoad, maxBend, spiral, straightN, straightWorst, flips, maxLag, straightBay, straightQueue, chuteStraight};
      });
      chk(r.nRoad > 300 && r.worstRoad < 0.1 && r.spiral > 20 && r.spiralWorst < 0.25, 'Jelly: in curves and through the spiral the body bends along the road (every frame on it)',
        `${r.nRoad} frame samples, worst ${r.worstRoad.toFixed(3)} off the centre line once settled, ${r.spiralWorst.toFixed(3)} in the spiral (${r.spiral} frames)`);
      chk(r.maxBend > 0.3, 'Jelly: one continuous body bending smoothly (its middle off the line between its ends)', r.maxBend.toFixed(2));
      chk(r.straightN > 20 && r.straightWorst < 0.01, 'Jelly: on straight road the bus is perfectly straight and rigid', `${r.straightN} frames, worst ${r.straightWorst.toFixed(4)}`);
      chk(r.flips >= 4 && r.maxLag > 0.02 && r.maxLag <= 0.121, 'Jelly: entering and leaving curves it wobbles softly (overshoots its bend, back and forth) and settles',
        `${r.flips} swings, largest ${r.maxLag.toFixed(3)}`);
      chk(r.straightBay === true && r.straightQueue && r.chuteStraight === true, 'Jelly: straight in the queue, in a bay and on the parachute', JSON.stringify({bay:r.straightBay, queue:r.straightQueue, chute:r.chuteStraight}));
      // purely visual: the same level plays the same in both modes
      const same = await p.evaluate(() => { const C = window.MECore, run = m => { __me.setMove(m); __me.loadLevel(JSON.parse(JSON.stringify(C.LEVEL_DATA)), 'export'); __me.freeze(true);
          const g = __me.game; for (let i = 0; i < 400 && !g.result; i++){ if (i % 5 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); } __me.advance(0.25); }
          return JSON.stringify([g.t.toFixed(2), g.result, g.buses.map(b => [b.state, b.x.toFixed(3), b.z.toFixed(3), b.seated])]); };
        const a = run('rigid'), b = run('jelly'); __me.setMove('rigid', true); return a === b; });
      chk(same, 'Jelly is purely visual: the same taps give the same game (times, places, boarding) as Rigid');
      // the exit and the return tunnel: a 12-seat bus driven into the one and out of the other, Rigid and Jelly. The route
      // runs straight on inside each opening; inside the stone, every part of the bus stays within the opening; nothing
      // of it beyond the depth where it stops being drawn lies outside that cut; it is dark when it vanishes and appears
      const tun = await p.evaluate(() => { const C = window.MECore, res = {};
        for (const mode of ['rigid', 'jelly']){
          const lv = JSON.parse(JSON.stringify(C.LEVEL_DATA)); lv.lanes = [[{color:'red', cap:12}], [], []]; lv.ramps.forEach(r => r.columns = r.columns.map(c => c.map(() => 'blue')));
          __me.setMove(mode); __me.loadLevel(lv, 'export'); __me.freeze(false);
          const g = __me.game, R = __me.layout.ROAD, id = g.lanes[0][0], TN = __me.tunnels(), o = {side:-9, route:0, shows:0, n:0, darkIn:null, darkOut:null};
          const rel = (T, q) => { const dx = q[0] - T.x, dz = q[2] - T.z; return [dx*T.dx + dz*T.dz, Math.abs(dx*T.dz - dz*T.dx), q[1] - T.y]; };
          __me.tapLane(0); let was = null;
          for (let i = 0; i < 60*60; i++){
            __me.pump(1/60); const bb = g.buses[id], v = __me.views[id];
            if (was === 'road' && bb.state === 'tunnel') o.darkIn = v.dark;
            if (was !== 'return' && bb.state === 'return'){ o.darkOut = v.dark; const P = bb.trip.path, q = {};
              for (let s = 0; s <= P.len; s += 0.05){ C.pathAt(P, s, q, 0); const [x, z] = C.dispPoint(q.x, q.z), [al, ac] = rel(TN[1], [x, 0, z]); if (al > 0 && al < TN[1].depth) o.route = Math.max(o.route, ac); } }
            was = bb.state;
            const k = bb.state === 'road' && bb.rs > R.portalS - 4 ? 0 : bb.state === 'return' ? 1 : -1;
            if (k >= 0 && v.root.visible){ const F = __me.jellyFrames(id), T = TN[k];
              F.pts.concat(F.wheels).forEach((q, j) => { const [al, ac, h] = rel(T, q), hw = j < F.pts.length ? 0.505*F.k : 0.1; if (h < -0.6 || h > 1.6) return; o.n++;
                if (al > 0.05) o.side = Math.max(o.side, ac + hw - T.half);
                if (al > T.depth && ac + hw > T.cut) o.shows++; }); }
            if (bb.state === 'bay') break;
          }
          for (let s = R.portalS; s <= R.end; s += 0.05){ const q = {}; C.pathAt(R, s, q, 0); const [al, ac] = rel(TN[0], [q.x, 0, q.z]); if (al > 0) o.route = Math.max(o.route, ac); }
          res[mode] = o; }
        __me.setMove('rigid'); return res; });
      for (const m of ['rigid', 'jelly']){ const o = tun[m], M = m[0].toUpperCase() + m.slice(1);
        chk(o.n > 300 && o.route < 0.06 && o.side < 0 && o.shows === 0, `tunnels (${M}): the road runs straight on inside each opening, and no part of a bus inside shows through or over the stone`,
          `route ${o.route.toFixed(3)} off the axis; closest to the wall ${(-o.side).toFixed(3)} inside the opening; ${o.shows} points beyond the cut (${o.n} samples)`);
        chk(o.darkIn > 0.95 && o.darkOut > 0.95, `tunnels (${M}): a bus is dark when it vanishes into the exit tunnel and when it appears in the return tunnel`, JSON.stringify([o.darkIn, o.darkOut])); }
      await ctx.close(); }

    /* ---------------- stickmen size per level ---------------- */
    console.log('stickmen size');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const F01 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'funnel', 'f01.json'), 'utf8'));
      // the drawn size of the stickmen standing on the ramps: the mean scale of their instances
      const drawn = lv => p.evaluate(lv => { __me.loadLevel(lv, 'export'); __me.freeze(true); __me.advance(0.2);
        const g = __me.game, M = __me.camera.matrix.clone(); let s = 0, n = 0;
        g.men.forEach((m, i) => { if (m.state !== 'ramp') return; __me.menIM.getMatrixAt(i, M); const e = M.elements; s += Math.hypot(e[0], e[1], e[2]); n++; });
        return {k:__me.layout.manScale, s:s/n, n}; }, lv);
      const a = await drawn(JSON.parse(JSON.stringify(await p.evaluate(() => window.MECore.LEVEL_DATA)))), b = await drawn(F01);
      chk(a.k === 1 && b.k === F01.manScale && b.k >= 1.25 && Math.abs(b.s/a.s - b.k) < 0.04, 'the stickmen are drawn at their level\'s size (Level 2 x1, level 1 of the funnel larger)',
        `x${a.k} ${a.s.toFixed(3)} / x${b.k} ${b.s.toFixed(3)} = ${(b.s/a.s).toFixed(3)}`);
      await ctx.close(); }
    { const ctx = await newCtx({width:1440, height:900}), ed = await ctx.newPage(); watch(ed);
      await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => window.__ed, null, {timeout:60000});
      await ed.evaluate(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA))); __ed.sel = {kind:'level'}; });
      await ed.evaluate(() => document.getElementById('msPlus').click()); const k1 = await ed.evaluate(() => __ed.level.manScale);
      await ed.evaluate(() => document.getElementById('msAuto').click()); const k2 = await ed.evaluate(() => __ed.level.manScale || 1);
      const auto = await ed.evaluate(() => window.MECore.autoManScale(JSON.parse(JSON.stringify(__ed.level))));
      chk(k1 === 1.05 && k2 === auto, 'the editor\'s level card sets the stickmen size (− / +) and Auto picks the largest the level has room for', `${k1}, auto ${k2}`);
      await ctx.close(); }

    /* ---------------- connected buses in the queue and the bays; parachutes ---------------- */
    console.log('connected buses and parachutes');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const play = id => p.evaluate(id => {
        const C = window.MECore; __me.loadLevel(JSON.parse(JSON.stringify(C.PRESETS[id])), 'export'); __me.freeze(true);
        const g = __me.game, res = {pairs:0, overlap:0, side:0, ahead:0, groups:0, spread:0, dir:0, jumps:0, gone:0, vanished:0, offAtGone:0};
        // a bus as drawn: the rectangle of its view (centre, heading, scale)
        const box = v => { const k = v.root.scale.x, hx = Math.sin(v.h), hz = Math.cos(v.h), L2 = v.b.len*k/2, W2 = C.BUS_W*k/2;
          return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [v.p.x + hz*a*W2 + hx*b*L2, v.p.z - hx*a*W2 + hz*b*L2]); };
        const meet = (A, B) => { for (const P of [A, B]) for (let i = 0; i < 4; i++){ const a = P[i], b = P[(i + 1) % 4], nx = b[1] - a[1], nz = a[0] - b[0];
            const pa = A.map(q => q[0]*nx + q[1]*nz), pb = B.map(q => q[0]*nx + q[1]*nz); if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false; } return true; };
        const cam = __me.camera, V = new cam.position.constructor(), onScreen = (x, y, z) => { V.set(x, y, z).project(cam); return Math.abs(V.x) < 1 && Math.abs(V.y) < 1; };
        const seen = new Map(), start = new Map();
        // (on for 15 s after the game ends: the last parachutes glide off the screen too)
        for (let step = 0, after = 0; step < 60*600 && after < 60*15; step++){ if (g.result) after++;
          if (step % 12 === 0 && !g.result){ const a = C.greedyPick(g); if (a) __me.tap(a); }
          __me.advance(1/60);
          for (const G of g.groups){
            const vs = G.members.map(id => __me.views[id]);
            // in the queue and the bays: never overlapping; side by side, the leading one stands ahead
            const qb = vs.filter(v => v.root.visible && v.init && ['lane', 'bay'].includes(v.b.state));
            for (let i = 0; i < qb.length; i++) for (let j = i + 1; j < qb.length; j++){ res.pairs++; if (meet(box(qb[i]), box(qb[j]))) res.overlap++;
              // (standing level and still: a bus still driving up its lane is not side by side yet)
              const a = qb[i].b, b = qb[j].b, sideBySide = a.state === b.state && Math.abs(a.z - b.z) < 0.05 && qb[i].spd < 0.02 && qb[j].spd < 0.02 &&
                (a.state === 'lane' ? Math.abs(a.lane - b.lane) === 1 && g.lanes[a.lane].indexOf(a.id) === g.lanes[b.lane].indexOf(b.id) : Math.abs(a.bay - b.bay) === 1);
              if (sideBySide){ res.side++; const hx = Math.sin(qb[i].h), hz = Math.cos(qb[i].h); if ((qb[i].p.x - qb[j].p.x)*hx + (qb[i].p.z - qb[j].p.z)*hz > 0.08) res.ahead++; } }
            // a completed group parachutes as one: one direction, the members keeping their places in the group
            const js = vs.filter(v => v.b.state === 'jump' && v.jump && !v.jump.gone);
            if (js.length === vs.length){
              if (!start.has(G.id)){ start.set(G.id, vs.map(v => [v.root.position.x - vs[0].root.position.x, v.root.position.z - vs[0].root.position.z])); res.groups++;
                res.dir = Math.max(res.dir, ...vs.map(v => Math.hypot(v.jump.ex - vs[0].jump.ex, v.jump.ez - vs[0].jump.ez))); }
              const s0 = start.get(G.id); vs.forEach((v, k) => { res.spread = Math.max(res.spread, Math.hypot(v.root.position.x - vs[0].root.position.x - s0[k][0], v.root.position.z - vs[0].root.position.z - s0[k][1])); }); }
          }
          // no bus disappears while it is still on the screen: a parachuting bus is hidden only once it has glided off
          for (const v of __me.views){ if (v.b.state !== 'jump' || !v.jump) continue;
            if (!seen.has(v.b.id)){ seen.set(v.b.id, true); res.jumps++; }
            const vis = v.root.visible, was = seen.get(v.b.id);
            if (was && !vis){ if (v.jump.gone){ res.gone++; const q = v.root.position; if (!onScreen(q.x, q.y + 0.5, q.z)) res.offAtGone++; } else res.vanished++; }
            seen.set(v.b.id, vis); }
        }
        res.result = g.result; return res; }, id);
      const a = await play('demo_connected'), b = await play('demo_combo');
      const r = Object.fromEntries(Object.keys(a).map(k => [k, typeof a[k] === 'number' ? (k === 'spread' || k === 'dir' ? Math.max(a[k], b[k]) : a[k] + b[k]) : a[k] + '/' + b[k]]));
      chk(r.pairs > 200 && r.overlap === 0, 'connected buses never overlap each other in the queue or the bays', `${r.pairs} pairs checked, ${r.overlap} overlapping`);
      chk(r.side > 20 && r.ahead === r.side, 'side by side (neighbouring lanes or bays), the leading bus stands a little ahead of the following one', `${r.ahead} of ${r.side} side-by-side frames staggered`);
      chk(r.groups >= 2 && r.dir < 1e-9 && r.spread < 0.02, 'a completed connected group parachutes as one: one direction, every bus keeping its place in the group',
        `${r.groups} groups, direction spread ${r.dir.toExponential(1)}, places kept within ${r.spread.toFixed(3)}`);
      chk(r.jumps > 10 && r.vanished === 0 && r.gone === r.jumps && r.offAtGone === r.gone, 'no parachuting bus disappears mid-air: each glides on until it has left the screen',
        `${r.jumps} parachutes, ${r.gone} left the screen, ${r.vanished} vanished on screen (games: ${r.result})`);
      await ctx.close(); }

    /* ---------------- connected trains, hidden members, full-bus exits ---------------- */
    console.log('connected trains, hidden members, full-bus exits');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const SC = id => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'showcase', id + '.json'), 'utf8'));
      // a hidden member of a pair or a triple: one game, every frame from the moment it is sent until it leaves the road
      const hidRun = (lv, hide, move, seed) => p.evaluate(([lv, hide, move, seed]) => {
        const C = window.MECore; __me.setMove(move); __me.loadLevel(lv, 'export'); __me.freeze(true);
        const g = __me.game, rng = seed ? C.mulberry32(seed) : null, ids = hide.map(([l, i]) => g.lanes[l][i]);
        const res = {sends:{lane:0, bay:0}, bad:[], hiddenSent:0, reveals:[], drawnOff:0, drawnN:0, roles:{}};
        const st = new Map(), trains = [];
        for (let k = 0; k < 30*900 && !g.result; k++){
          if (k % 6 === 0){ const a = rng ? C.randomPick(g, rng) : C.greedyPick(g); if (a) __me.tap(a); }
          __me.advance(1/30);
          for (const id of ids){ const b = g.buses[id], v = __me.views[id], s = st.get(id) || {state:b.state, rev:b.revealed}; st.set(id, s);
            if (b.state === 'toRoad' && s.state !== 'toRoad'){ const from = s.state === 'bay' ? 'bay' : 'lane'; res.sends[from]++;
              res.roles[b.group.members.indexOf(id) + '/' + b.group.members.length] = 1;
              if (!b.revealed){ res.hiddenSent++; s.watchReveal = true; } }
            if (s.watchReveal && b.revealed){ s.watchReveal = false;
              const sp = __me.sparkles.filter(q => Math.abs(q.t - g.t) < 0.05 && Math.hypot(q.x - v.p.x, q.z - v.p.z) < 1.0).length;
              res.reveals.push({onRoad:b.state === 'road' && s.state === 'toRoad', q:!!v.q, sparkle:sp > 0}); }
            if (['toRoad', 'road'].includes(b.state)){
              v.root.updateMatrixWorld(true);
              const q = v.root.position, fin = [q.x, q.y, q.z].every(Number.isFinite) && v.body.matrixWorld.elements.every(Number.isFinite);
              const sk = v.U.uSk.value.every(f => [f.x, f.y, f.z, f.w].every(Number.isFinite)) && v.U.uSkP.value.every(Number.isFinite);
              const near = b.state === 'road' && b.rs > g.L.ROAD.portalS - 1.5;           // going into the exit tunnel's darkness
              if (!near && !(v.root.visible && v.body.visible && v.mesh.visible && fin && sk && v.body.scale.y > 0.3 && v.dark < 0.9))
                res.bad.push(`${g.t.toFixed(2)} ${b.state} vis=${v.root.visible} fin=${fin} sk=${sk} sy=${v.body.scale.y.toFixed(2)} dark=${v.dark.toFixed(2)}`); }
            s.state = b.state; s.rev = b.revealed; }
          // the train as drawn: once on the leader's route, a follower drives along the leader's route as drawn
          for (const G of g.groups){ const lead = g.buses[G.members[0]];
            if (lead.state === 'toRoad' && lead.trip && !trains.some(T => T.trip === lead.trip)){ const P = lead.trip.path, o = {}, pts = [];
              for (let s = 0; s <= P.len; s += 0.05){ C.pathAt(P, s, o, 0); pts.push(C.dispPoint(o.x, o.z)); } trains.push({trip:lead.trip, G, P, pts}); }
          }
          for (const T of trains) for (const id of T.G.members.slice(1)){ const b = g.buses[id], v = __me.views[id]; if (b.state !== 'toRoad' || !v.init) continue;
            let dc = 9, o = {}; for (let s = 0; s <= T.P.len; s += 0.05){ C.pathAt(T.P, s, o, 0); dc = Math.min(dc, Math.hypot(o.x - b.x, o.z - b.z)); }
            if (dc > 1e-3) continue;                                   // not on the leader's route yet
            let dd = 9; for (const [x, z] of T.pts) dd = Math.min(dd, Math.hypot(x - v.p.x, z - v.p.z));
            res.drawnN++; if (dd > 0.25) res.drawnOff++; }
        }
        res.result = g.result; res.bad = res.bad.slice(0, 3).concat(res.bad.length > 3 ? [`(+${res.bad.length - 3})`] : []); return res; }, [lv, hide, move, seed]);
      // every member of every group in the pairs and the triples levels hidden in turn (leader, middle, last), both bus modes
      const H = {sends:{lane:0, bay:0}, bad:[], hidden:0, reveals:[], drawnOff:0, drawnN:0, roles:new Set(), games:0};
      const add = (r, tag) => { H.games++; H.sends.lane += r.sends.lane; H.sends.bay += r.sends.bay; H.hidden += r.hiddenSent; H.reveals.push(...r.reveals);
        H.drawnOff += r.drawnOff; H.drawnN += r.drawnN; Object.keys(r.roles).forEach(k => H.roles.add(k)); if (r.bad.length) H.bad.push(tag + ': ' + r.bad.join(', ')); };
      for (const id of ['blk-connected-pairs', 'blk-connected-triples']){ const lv = SC(id);
        const spots = {}; lv.lanes.forEach((ln, l) => ln.forEach((x, i) => { if (x.link) (spots[x.link] = spots[x.link] || []).push([l, i]); }));
        for (const move of ['rigid', 'jelly']) for (const sp of Object.values(spots)) for (const s of sp){
          const v = JSON.parse(JSON.stringify(lv)); v.lanes[s[0]][s[1]].hidden = true; add(await hidRun(v, [s], move, 0), `${id} ${move} ${s}`); }
        // random play with every member hidden: the groups also park and leave the bays again
        const all = Object.values(spots).flat(), v = JSON.parse(JSON.stringify(lv)); all.forEach(([l, i]) => { v.lanes[l][i].hidden = true; });
        for (const seed of [11, 12, 13]) add(await hidRun(v, all, 'jelly', seed), `${id} random ${seed}`); }
      chk(H.sends.lane >= 26 && H.sends.bay >= 4 && ['0/2', '1/2', '0/3', '1/3', '2/3'].every(k => H.roles.has(k)) && H.hidden >= 8,
        'hidden members of pairs and triples (as leader, middle and last member) are sent from the queue and from the bays, in Rigid and Jelly',
        `${H.games} games: ${H.sends.lane} sends from the queue, ${H.sends.bay} from the bays, ${H.hidden} still hidden when sent; roles ${[...H.roles].sort().join(' ')}`);
      chk(!H.bad.length, 'a hidden member stays visible every frame on its way to the road and with its group on the road (Rigid and Jelly)', H.bad.slice(0, 2).join(' | '));
      chk(H.reveals.length === H.hidden && H.reveals.every(r => r.onRoad && !r.q && r.sparkle), 'a member still hidden when sent shows its colour the moment it joins the main road, with the sparkle',
        `${H.reveals.filter(r => r.onRoad && !r.q && r.sparkle).length}/${H.reveals.length} revealed on joining, ${H.hidden} sent hidden`);
      chk(H.drawnN > 500 && H.drawnOff === 0, 'as drawn, every follower drives along the leader\'s route once it has moved into it', `${H.drawnN} frames, ${H.drawnOff} off the route`);

      // full buses: off the road on a free side, the parachute only once off the road, then straight across and out
      // through the left or right edge of the screen on the side it jumped; groups together
      const exitRun = (lv, move, terr) => p.evaluate(([lv, move, terr]) => {
        const C = window.MECore; __me.setMove(move); __me.setTerrain(terr); __me.loadLevel(lv, 'export'); __me.freeze(true);
        const g = __me.game, cam = __me.camera, V = new cam.position.constructor(), T = new Map(), R = __me.layout.ROAD, o = {};
        const res = {jumps:0, freeSide:0, noFree:0, wrongPick:0, stripHit:0, early:0, vanish:0, offEarly:0, wrongEdge:0, edgeTB:0, maxDy:0, maxBack:0, sideRule:0, groups:0, groupApart:0, L:0, R:0};
        const ndc = (x, y, z) => { V.set(x, y, z).project(cam); return [V.x, V.y]; };
        for (let k = 0; k < 60*700; k++){
          if (k % 12 === 0 && !g.result){ const a = C.greedyPick(g); if (a) __me.tap(a); }
          __me.advance(1/60);
          for (const v of __me.views){ const J = v.jump; if (!J || v.b.state !== 'jump') continue; let s = T.get(v.b.id);
            if (!s){ s = {J}; T.set(v.b.id, s); res.jumps++; res[J.gx < 0 ? 'L' : 'R']++;
              const sides = __me.exitSides(v);                     // (for a group: both sides, for all its members)
              if (sides.some(x => !x.why)){ res.freeSide++; if (J.why || !sides.some(x => !x.why && x.ex === J.ex && x.ez === J.ez)) res.wrongPick++; } else res.noFree++;
              if (Math.abs(J.ex) >= 0.3 && Math.sign(J.ex) !== J.gx) res.sideRule++;
              // independently: on a free side the strip it slides across holds no ramp and no other stretch of road
              if (!J.why){ const hx = Math.sin(J.h), hz = Math.cos(J.h), hl = v.b.len/2*v.root.scale.x;
                for (let d = C.ROAD_HALF; d <= J.out + 0.5 && !s.hit; d += 0.1) for (let a = -hl; a <= hl && !s.hit; a += 0.2){
                  const px = J.x + J.ex*d + hx*a, pz = J.z + J.ez*d + hz*a;
                  if (__me.layout.RAMPS.some(r => C.polyDist(r.outline, px, pz) < 0.05)) s.hit = 'ramp';
                  for (let i = 0; i < R.n && !s.hit; i++){ if (Math.abs(R.cum[i] - v.b.rs) < hl + C.ROAD_HALF + 0.8) continue;
                    if (Math.hypot(R.P[i*3] - px, R.P[i*3+2] - pz) < C.ROAD_HALF - 0.05) s.hit = 'road'; } }
                if (s.hit) res.stripHit++; } }
            if (s.done) continue;
            const q = v.root.position;
            if (!s.chute && v.chute && v.chute.visible){ s.chute = true; let dmin = 9;
              for (let a = v.b.rs - 3; a <= v.b.rs + 3; a += 0.05){ C.pathAt(R, Math.max(0, Math.min(R.len, a)), o, 0); dmin = Math.min(dmin, Math.hypot(o.x - q.x, o.z - q.z)); }
              if (dmin < C.ROAD_HALF + C.BUS_W/2*v.root.scale.x - 0.02) res.early++; }
            if (J.gone){ s.done = true; const n = s.last;
              if (!n || Math.sign(n[0]) !== J.gx || Math.abs(n[0]) < 0.8) res.wrongEdge++; if (n && Math.abs(n[1]) > 0.98) res.edgeTB++;
              if (!J.goneAt || !__me.offScreen(...J.goneAt, v.b.len)) res.offEarly++; continue; }
            if (!v.root.visible){ res.vanish++; s.done = true; continue; }
            const n = ndc(q.x, q.y + 0.4, q.z); s.last = n;
            if (g.t - J.t0 > J.t3 + 0.3){ s.y0 = s.y0 == null ? n[1] : s.y0; res.maxDy = Math.max(res.maxDy, Math.abs(n[1] - s.y0));
              if (s.px != null) res.maxBack = Math.max(res.maxBack, -(n[0] - s.px)*J.gx); s.px = n[0]; } }
          if (g.result && k > 60*4 && [...T.values()].every(s => s.done)) break; }
        for (const G of g.groups){ const Js = G.members.map(id => (T.get(id) || {}).J).filter(Boolean); if (Js.length < 2) continue; res.groups++;
          if (Js.some(J => J.gx !== Js[0].gx || J.ex !== Js[0].ex || J.ez !== Js[0].ez || J.t0 !== Js[0].t0)) res.groupApart++; }
        res.unfinished = [...T.values()].filter(s => !s.done).length; res.result = g.result; __me.setTerrain('plateau'); return res; }, [lv, move, terr]);
      const X = {}; const tot = r => Object.keys(r).forEach(k => { if (typeof r[k] === 'number') X[k] = k.startsWith('max') ? Math.max(X[k] || 0, r[k]) : (X[k] || 0) + r[k]; });
      for (const [id, move, terr] of [['road-spiral', 'rigid', 'plateau'], ['road-hairpin', 'rigid', 'plateau'], ['road-double-spiral', 'jelly', 'plateau'], ['ramp-straight', 'rigid', 'plateau'],
          ['blk-connected-triples', 'jelly', 'plateau'], ['blk-all', 'rigid', 'plateau'], ['lanes-5', 'rigid', 'plateau'], ['jump-spiral', 'rigid', 'plateau'], ['road-s-curve', 'rigid', 'bridge'], ['blk-connected-pairs', 'rigid', 'bridge']])
        tot(await exitRun(SC(id), move, terr));
      chk(X.jumps > 120 && X.L > 20 && X.R > 20 && X.groups >= 6 && !X.unfinished, 'full buses and connected groups leave in Rigid and Jelly, on the Plateau and a Bridge, toward both edges',
        `${X.jumps} exits (${X.L} left, ${X.R} right), ${X.groups} groups`);
      chk(!X.wrongPick && !X.stripHit, 'a full bus drives sideways off the road on a free side whenever it has one: no ramp, rail, overpass, other road or tunnel there',
        `${X.freeSide} with a free side, ${X.wrongPick} took a blocked one, ${X.stripHit} free strips not clear; ${X.noFree} with nothing free on either side (ramps facing each other, a group in the tunnel mouth: the milder way)`);
      chk(!X.early, 'its parachute opens only once the bus has left the road', `${X.early} opened over the road`);
      chk(!X.vanish && !X.offEarly && !X.wrongEdge && !X.edgeTB && !X.sideRule,
        'every parachute glides out through the left or right edge of the screen on the side it jumped (never the top or bottom), visible until it has fully left the screen',
        `${X.wrongEdge} out the other way, ${X.edgeTB} through the top or bottom, ${X.vanish} vanished on screen, ${X.offEarly} hidden still on screen`);
      chk(X.maxDy < 0.2 && X.maxBack < 0.005, 'the glide goes straight across: no turning back, hardly any drift up or down', `up/down drift ${X.maxDy.toFixed(3)} of the screen half-height, largest step back ${X.maxBack.toFixed(4)}`);
      chk(!X.groupApart, 'a completed connected group leaves on one side together and glides off the screen on that side', `${X.groups} groups, ${X.groupApart} apart`);
      await ctx.close(); }

    /* ---------------- terrain: Plateau or Bridge ---------------- */
    console.log('terrain');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      // the same greedy game for 25 s, then what stands on the plateau and where the pillars stand
      const run = terr => p.evaluate(terr => {
        const C = window.MECore; __me.setTerrain(terr); __me.loadLevel(JSON.parse(JSON.stringify(C.LEVEL_DATA)), 'export'); __me.freeze(true);
        const g = __me.game; for (let i = 0; i < 25/0.2 && !g.result; i++){ if (i % 2 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); } __me.advance(0.2); }
        const game = JSON.stringify({t:g.t.toFixed(3), sends:g.sends, buses:g.buses.map(b => [b.state, b.x.toFixed(3), b.z.toFixed(3)])});
        const L = __me.layout, R = L.ROAD, BM = __me.boardMask, o = {}, on = (x, z) => BM.at(x, z) < 0;
        let road = 0, n = 0; for (let s = 2; s < R.portalS - 1; s += 0.5){ C.pathAt(R, s, o, 0); n++; if (on(o.x, o.z)) road++; }
        const Y = L.Y, bays = Y.BAY_X.every(bx => on(...C.dispPoint(bx, (C.Z_BAY_TOP + C.Z_BAY_BOT)/2)));
        const lanes = Y.LANE_X.every(lx => on(...C.dispPoint(lx, C.Z_LANE_TOP + 1.5))), T = L.TUNNEL, tunnel = on(...C.dispPoint(T.x - T.nx*0.6, T.z - T.nz*0.6));
        const rampsOn = L.RAMPS.filter(r => { const q = r.across(r.length/2, 0); return on(q.x, q.z); }).length;
        const pil = []; __me.scene.traverse(m => { if (!m.isInstancedMesh || !m.geometry.parameters || m.geometry.parameters.radiusBottom !== 1.12) return;
          const M = m.matrix.clone(); for (let i = 0; i < m.count; i++){ m.getMatrixAt(i, M); const e = M.elements; pil.push([e[12], e[13], e[14], e[13] + e[5]]); } });
        const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++){ const a = P[i], b = P[j];
          if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0])*(z - a[1])/(b[1] - a[1]) + a[0]) c = !c; } return c; };
        return {game, road:road/n, bays, lanes, tunnel, rampsOn, ramps:L.RAMPS.length, pillars:pil.length, low:pil.filter(q => q[1] < __me.GD - 3).length,
          rampPillars:L.RAMPS.map(r => pil.filter(q => inPoly(r.outline, q[0], q[2]) && q[1] < __me.GD - 3).length), terrain:__me.terrain};
      }, terr);
      const a = await run('plateau'), b = await run('bridge'), info = o => JSON.stringify(Object.assign({}, o, {game:undefined}));
      chk(a.terrain === 'plateau' && a.road > 0.9 && a.rampsOn === a.ramps && a.low === 0, 'Plateau: the road and the ramps are on the plateau, no pillar reaches down to the ground far below', info(a));
      chk(b.terrain === 'bridge' && b.bays && b.lanes && b.tunnel && b.road < 0.15 && b.rampsOn === 0,
        'Bridge: the plateau only under the bottom part (bays, queue, return tunnel); the road and the ramps are up in the air', info(b));
      chk(b.pillars > 6 && b.low === b.pillars && b.rampPillars.every(k => k >= 4), 'Bridge: tall slim pillars from the ground far below carry the road, and every ramp hangs on four pillars of its own', b.rampPillars.join(','));
      chk(a.game === b.game, 'Bridge is drawn only: the same game plays out exactly as on the Plateau');
      await p.evaluate(() => __me.setTerrain('bridge', true)); await p.reload(); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      chk(await p.evaluate(() => __me.terrain) === 'bridge', 'the terrain setting is remembered');
      await ctx.close(); }

    /* ---------------- road gaps: buses jump them; the editor's cut tool ---------------- */
    console.log('jumps');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      const JL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'showcase', 'jump-ramps.json'), 'utf8'));
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const play = (lv, move, terr) => p.evaluate(([lv, move, terr]) => {
        const C = window.MECore; __me.setMove(move); __me.setTerrain(terr); __me.loadLevel(lv, 'export'); __me.freeze(true);
        const g = __me.game, R = __me.layout.ROAD, G = R.gaps, o = {}, res = {lift:0, below:0, takeoffs:0, landings:0, squash:0, ravine:[], GD:__me.GD};
        // looking straight down into the middle of each gap: nothing of the road there, only the ravine or the ground far below
        for (const q of G){ C.pathAt(R, q.at, o, 0); res.ravine.push(__me.groundAt(o.x, o.z)); }
        const was = new Map(), dip = new Map();
        for (let step = 0; step < 60*240 && !g.result; step++){
          if (step % 24 === 0){ const a = C.greedyPick(g); if (a) __me.tap(a); }
          __me.advance(1/60);
          for (const v of __me.views){ const b = v.b; if (b.state !== 'road' || !v.root.visible) continue;
            C.pathAt(R, b.rs, o, 0); const over = G.some(q => b.rs > q.s0 && b.rs < q.s1), lift = v.root.position.y - o.y;
            if (over){ res.lift = Math.max(res.lift, lift); if (lift < 0.05) res.below++; }
            const inJ = !!v.inJump, w = was.get(b.id) || false;
            if (inJ && !w) res.takeoffs++; if (!inJ && w){ res.landings++; dip.set(b.id, {n:30, min:0}); }
            was.set(b.id, inJ); }
          // a landing: the body dips (squashes) within half a second
          for (const [id, d] of dip){ d.min = Math.min(d.min, __me.views[id].bob); if (--d.n <= 0){ if (d.min < -0.015) res.squash++; dip.delete(id); } } }
        res.result = g.result; return res; }, [lv, move, terr]);
      for (const [move, terr] of [['rigid', 'plateau'], ['jelly', 'bridge']]){
        const r = await play(JL, move, terr);
        chk(r.takeoffs >= 6 && r.landings >= 6 && r.below === 0 && r.lift > 0.3, `jumps (${move}, ${terr}): every bus over a gap is in the air above it, high in the middle of its arc`,
          `${r.takeoffs} take-offs, ${r.landings} landings, highest ${r.lift.toFixed(2)}, ${r.below} frames low over a gap`);
        chk(r.squash === r.landings, `jumps (${move}, ${terr}): every landing squashes the bus`, `${r.squash} of ${r.landings}`);
        chk(r.ravine.length && r.ravine.every(y => y != null && y < r.GD - 1), `jumps (${move}, ${terr}): the road is cut at the gap (looking down, the ravine or the ground far below)`, JSON.stringify(r.ravine));
      }
      await ctx.close(); }
    { const ctx = await newCtx({width:1440, height:900}), ed = await ctx.newPage(); watch(ed);
      await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => window.__ed, null, {timeout:60000});
      const JL = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', 'showcase', 'jump-ramps.json'), 'utf8'));
      const toScreen = s => ed.evaluate(s => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, s, o, 0); const r = document.getElementById('view').getBoundingClientRect(), [x, y] = __ed.W2S(o.x, o.z); return [r.left + x, r.top + y]; }, s);
      await ed.evaluate(lv => { delete lv.road.gaps; __ed.setLevel(lv); __ed.fitView(); __ed.setTool('gap'); }, JL);
      const at = JL.road.gaps ? JL.road.gaps[0].at : 11.5; let [mx, my] = await toScreen(at); await ed.mouse.click(mx, my);
      const a = await ed.evaluate(() => ({gaps:(__ed.level.road.gaps || []).length, sel:__ed.sel.kind, warn:__ed.check.warnings.length, insp:document.getElementById('insp').innerText}));
      chk(a.gaps === 1 && a.sel === 'gap' && /Gap 1/.test(a.insp), 'editor: the cut tool (G) cuts the road where it is clicked and selects the new gap', JSON.stringify(a).slice(0, 120));
      await ed.evaluate(() => document.querySelector('#insp [data-a="len+"]').click()); await ed.evaluate(() => document.querySelector('#insp [data-a="updown"]').click());
      const b = await ed.evaluate(() => __ed.level.road.gaps[0]);
      chk(Math.abs(b.len - 1.4) < 1e-9 && b.ramp === 'updown', 'editor: the inspector sets the gap\'s length and its ends (take-off and landing ramps)', JSON.stringify(b));
      [mx, my] = await toScreen(b.at); const [tx, ty] = await toScreen(b.at + 0.6);
      await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:6}); await ed.mouse.up();
      const c = await ed.evaluate(() => __ed.level.road.gaps[0].at);
      chk(Math.abs(c - b.at - 0.6) < 0.15, 'editor: dragging a gap slides it along the road', `${b.at} -> ${c}`);
      // a road edit keeps the gap where it is on the ground
      const d = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}, g = __ed.level.road.gaps[0]; window.MECore.pathAt(R, g.at, o, 0); const before = [o.x, o.z];
        __ed.roadEdit(n => { n.road.points[1].x += 0.3; }); const R2 = __ed.layout.ROAD, o2 = {}; window.MECore.pathAt(R2, __ed.level.road.gaps[0].at, o2, 0);
        return Math.hypot(o2.x - before[0], o2.z - before[1]); });
      chk(d < 0.1, 'editor: a road edit keeps the gap where it is on the ground', d.toFixed(3));
      await ed.keyboard.press('Escape'); [mx, my] = await toScreen(await ed.evaluate(() => __ed.level.road.gaps[0].at)); await ed.mouse.click(mx, my); await ed.keyboard.press('Delete');
      chk(await ed.evaluate(() => !(__ed.level.road.gaps || []).length), 'editor: Delete removes the selected gap');
      await ctx.close(); }

    /* ---------------- pause menu, level timer, round boosters ---------------- */
    console.log('pause, timer, boosters');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const secs = txt => { const m = /^(\d+):(\d\d)$/.exec(txt || ''); return m ? +m[1]*60 + +m[2] : -1; };
      const a = await p.evaluate(() => { if (__me.intro) __me.closeIntro(); __me.freeze(false); __me.tapLane(0); for (let i = 0; i < 150; i++) __me.pump(1/60);
        return {t:__me.game.t, txt:__me.timerText}; });
      await p.click('#btnPause');
      const b = await p.evaluate(() => { const t0 = __me.game.t, txt0 = __me.timerText, s0 = JSON.stringify(__me.views.map(v => [v.p.x, v.p.z, v.bob])); for (let i = 0; i < 120; i++) __me.pump(1/60);
        return {paused:__me.paused, panel:document.getElementById('pausePanel').classList.contains('show'), dt:__me.game.t - t0, still:JSON.stringify(__me.views.map(v => [v.p.x, v.p.z, v.bob])) === s0,
          txt:__me.timerText, txt0, items:[...document.querySelectorAll('#pausePanel button')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent)}; });
      chk(b.paused && b.panel && b.dt === 0 && b.still && b.txt === b.txt0, 'the pause button stops the game, every animation and the level timer, and opens the pause menu', JSON.stringify(b));
      chk(b.items.join(',') === 'Resume,Restart,Settings', 'the pause menu: Resume, Restart, Settings (and Back to menu in the showcase)', b.items.join(','));
      await p.click('#pmResume');
      const c = await p.evaluate(() => { const t0 = __me.game.t; for (let i = 0; i < 60; i++) __me.pump(1/60); return {paused:__me.paused, dt:__me.game.t - t0, t:__me.game.t, txt:__me.timerText}; });
      chk(!c.paused && Math.abs(c.dt - 1) < 0.05, 'Resume carries on where it stopped', JSON.stringify(c));
      chk(secs(a.txt) === Math.floor(a.t) && secs(c.txt) === Math.floor(c.t) && secs(c.txt) > secs(a.txt), 'the level timer counts the level\'s seconds (m:ss)', `${a.txt} -> ${c.txt}`);
      await p.keyboard.press('p'); const k1 = await p.evaluate(() => __me.paused); await p.keyboard.press('p'); const k2 = await p.evaluate(() => __me.paused);
      chk(k1 && !k2, 'P pauses and resumes');
      await p.click('#btnPause'); await p.click('#pmRestart');
      const d = await p.evaluate(() => ({paused:__me.paused, t:__me.game.t, counter:__me.game.counter, txt:__me.timerText}));
      chk(!d.paused && d.t < 1 && d.counter === 0 && d.txt === '0:00', 'Restart in the pause menu starts the level again (the timer at 0:00)', JSON.stringify(d));
      // the end of a level stops the timer; no pause once the level is over
      const e = await p.evaluate(() => { const g = __me.game; for (let i = 0; i < 3000 && !g.result; i++){ const a = window.MECore.greedyPick(g); if (a) __me.tap(a); __me.advance(0.2); }
        const t1 = __me.timerText; for (let i = 0; i < 180; i++) __me.pump(1/60); return {res:g.result, t1, t2:__me.timerText, end:Math.floor(g.t)}; });
      await p.click('#btnPause', {force:true}); const ep = await p.evaluate(() => __me.paused);
      chk(e.res === 'win' && e.t1 === e.t2 && !ep, 'at the end of the level the timer stops, and the game can no longer be paused', JSON.stringify(e));
      // the top bar: the timer between the level name and the speed and pause buttons; round booster buttons
      const lay = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(), T = r('timer'), P = r('levelPill'), Sp = r('btnSpeed'), Pa = r('btnPause');
        const B = [...document.querySelectorAll('.boost')].map(b => { const cs = getComputedStyle(b); return [b.offsetWidth, b.offsetHeight, cs.borderTopLeftRadius]; });
        return {row:T.top < P.bottom && T.bottom > P.top, order:P.right <= T.left && T.right <= Sp.left && Sp.right <= Pa.left + 3, B, x:[P.left, P.right, T.left, T.right, Sp.left, Sp.right, Pa.left, Pa.right].map(Math.round)}; });
      chk(lay.row && lay.order, 'the level timer sits in the top bar: level name, timer, speed, pause', JSON.stringify(lay));
      chk(lay.B.length === 3 && lay.B.every(([w, h, br]) => w === h && br === '50%'), 'the booster buttons are round', JSON.stringify(lay.B));
      await ctx.close(); }

    /* ---------------- camera zoom ---------------- */
    console.log('camera zoom');
    { const ctx = await newCtx(), p = await ctx.newPage(); watch(p);
      await p.goto(base + '/index.html?nosim'); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000});
      const st = () => p.evaluate(() => { const c = __me.camera, rect = id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(','); };
        const E = __me.layout.exit, sp = __me.screenOf(E.x, E.y, E.z), off = Math.hypot(sp[0] - 450, sp[1] - 975);
        return {fov:__me.camFov, pfov:+__me.perspCam.fov.toFixed(3), otop:+__me.orthoCam.top.toFixed(4), pos:c.position.toArray().map(v => +v.toFixed(3)).join(','),
          q:c.quaternion.toArray().map(v => +v.toFixed(4)).join(','), val:document.getElementById('zoomVal').textContent, range:+document.getElementById('zoomRange').value,
          ui:['levelPill', 'boosters', 'btnPause', 'timer'].map(rect).join('|'), off:+off.toFixed(1), saved:window.MESync.loadPrefs().camFov}; });
      const slide = v => p.evaluate(v => { const r = document.getElementById('zoomRange'); r.value = v; r.dispatchEvent(new Event('input')); }, v);
      const a = await st(); await slide(45); const b = await st(); await slide(25); const c = await st();
      chk(a.fov === 30 && a.pfov === 30 && a.val === 'FOV 30°' && a.range === 30, 'the camera zoom starts at the default: a 30° field of view, shown next to the slider', JSON.stringify(a));
      chk(b.pfov === 45 && b.val === 'FOV 45°' && c.pfov === 25 && c.val === 'FOV 25°' && b.pos === a.pos && c.pos === a.pos && b.q === a.q && c.q === a.q,
        'Perspective: the slider sets the field of view (25° to 60°); the camera keeps its place and its angle', `${a.pfov} -> ${b.pfov}, ${c.pfov}`);
      chk(b.off < a.off && c.off > a.off && b.ui === a.ui && c.ui === a.ui, 'only the 3D scene zooms (out at 45°, in at 25°); the top bar and the booster bar stay as they are', `${a.off} / ${b.off} / ${c.off}`);
      await p.evaluate(() => __me.setView('ortho'));
      const d = await st(), want = (fov => 16.5588*Math.tan(fov*Math.PI/360)/Math.tan(Math.PI/12))(25);
      chk(Math.abs(d.otop - want) < 0.01 && d.val === 'Size ' + want.toFixed(2) && d.ui === a.ui, 'Orthographic: the same slider sets the orthographic size over the same zoom range, shown next to it', `${d.otop} (${d.val})`);
      await p.evaluate(() => document.getElementById('zoomReset').click()); const e = await st();
      chk(e.fov === 30 && Math.abs(e.otop - 16.5588) < 0.001 && e.val === 'Size 16.56' && e.saved === 30, 'Reset returns to the default (30°, orthographic size 16.56)', JSON.stringify(e));
      await slide(50); await p.evaluate(() => { __me.setView('persp'); __me.loadLevel(JSON.parse(JSON.stringify(window.MECore.PRESETS['crowded-rush'])), 'export'); });
      const f = await st(); await p.reload(); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000}); const g = await st();
      chk(f.pfov === 50 && g.fov === 50 && g.pfov === 50 && g.saved === 50, 'the zoom applies to every level and is remembered with the settings', `${f.pfov}, after a reload ${g.pfov}`);
      // zoomed all the way out, in both cameras: the ground fills the view, and no queued bus shows past the queue tunnel
      const far = await p.evaluate(() => ['persp', 'ortho'].map(m => { __me.setView(m); __me.setZoom(60); for (let i = 0; i < 6; i++) __me.pump(1/60);
        const lanes = __me.views.filter(v => v.b.state === 'lane' && v.root.visible), past = lanes.filter(v => v.p.z - v.b.len*v.root.scale.x/2 > __me.queueTunnelZ + 0.06).length;
        return {m, miss:__me.viewMisses(9), lanes:lanes.length, past}; }));
      chk(far.every(r => r.miss === 0), 'zoomed out to 60° (or the same orthographic size) the ground fills the view: no edge of the world in sight', JSON.stringify(far));
      chk(far.every(r => r.lanes > 0 && r.past === 0), 'zoomed out, no queued bus shows past the queue tunnel', JSON.stringify(far));
      await p.evaluate(() => { __me.setView('persp'); __me.setZoom(30, true); });
      await ctx.close(); }
    { const ctx = await newCtx({width:1440, height:900}), ed = await ctx.newPage(); watch(ed);
      await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => window.__ed, null, {timeout:60000});
      await ed.waitForFunction(() => { const f = document.getElementById('preview'); return f && f.contentWindow && f.contentWindow.__me && f.contentWindow.__me.game; }, null, {timeout:120000});
      const v0 = await ed.evaluate(() => ({val:document.getElementById('edZoomVal').textContent, under:document.getElementById('zoomRow').getBoundingClientRect().top >= document.getElementById('camSeg').getBoundingClientRect().bottom - 1}));
      await ed.evaluate(() => { const r = document.getElementById('edZoom'); r.value = 40; r.dispatchEvent(new Event('input')); });
      await ed.waitForFunction(() => document.getElementById('preview').contentWindow.__me.camFov === 40, null, {timeout:10000}).catch(() => {});
      const v1 = await ed.evaluate(() => ({val:document.getElementById('edZoomVal').textContent, fov:document.getElementById('preview').contentWindow.__me.perspCam.fov}));
      chk(v0.under && v0.val === 'FOV 30°' && v1.val === 'FOV 40°' && Math.abs(v1.fov - 40) < 1e-6, 'the editor\'s preview has the camera zoom under its camera switch, and the preview follows it', JSON.stringify([v0, v1]));
      await ed.evaluate(() => document.getElementById('edZoomReset').click());
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
        tools: [...document.querySelectorAll('#palette [data-tool]')].map(b => ({id:b.dataset.tool, tip:/\((\d or )?\w\)$/.test(b.title), icon:!!b.querySelector('svg.i')})),
        insp: !!document.querySelector('#insp .card'), queue: document.querySelectorAll('#queueSvg .bus').length }));
      chk(ui.bar && ui.barTips, 'top toolbar: file menu, undo/redo, run/test, export, help; every button has an icon and a tooltip');
      chk(ui.tools.map(t => t.id).join(',') === 'select,road,ramp,gap,paint,erase,hide,tunnel,lock,count,link' && ui.tools.every(t => t.tip && t.icon),
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
        return [x0 + dx/d*3, z0 + dz/d*3]; });   // outwards, well clear of the road
      const fp2 = await ed.evaluate(() => __ed.layout.RAMPS.find(q => q.src === 1).ctrl[0]);
      [mx, my] = await toScreen(...fp2); [tx, ty] = await toScreen(...off);
      await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:8}); await ed.mouse.up();
      const st = await ed.evaluate(() => { const L = __ed.layout, r = L.RAMPS.find(q => q.src === 1), o = {}; window.MECore.pathAt(L.ROAD, r.s, o, 0);
        return {snapped:r.snapped, edge:Math.abs(Math.hypot(r.ctrl[0][0] - o.x, r.ctrl[0][1] - o.z) - window.MECore.ROAD_HALF), at:__ed.level.ramps[1].at != null && !__ed.level.ramps[1].front,
          warn:__ed.check.warnings.some(w => w.kind === 'ramp-unsnapped')}; });
      chk(st.snapped && st.edge < 1e-6 && st.at && !st.warn, 'a front node dropped away from the road snaps back onto the road: the front edge stays on the road edge', JSON.stringify(st)); }
    // the ramp tool adds a ramp at the clicked road side
    { const n = await ed.evaluate(() => __ed.level.ramps.length); await ed.evaluate(() => __ed.setTool('ramp'));
      const spot = await ed.evaluate(() => { const R = __ed.layout.ROAD, o = {}; window.MECore.pathAt(R, R.pointS[3], o, 0); return [o.x - o.dz*1.2, o.z + o.dx*1.2]; });
      [mx, my] = await toScreen(...spot); await ed.mouse.click(mx, my);
      chk(await ed.evaluate(n => { const r = __ed.layout.RAMPS.find(q => q.src === n), o = {}; if (!r) return false; window.MECore.pathAt(__ed.layout.ROAD, r.s, o, 0);
          const nx = -o.dz*r.side, nz = o.dx*r.side;
          return __ed.level.ramps.length === n + 1 && __ed.sel.kind === 'ramp' && r.snapped && __ed.level.ramps[n].tilt == null && nx*r.dir[0] + nz*r.dir[1] > Math.cos(Math.PI/180); }, n),
        'the ramp tool adds a snapped ramp, square to the road, where the road was clicked'); }
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
        await pp.click('#btnNext', {timeout:90000});           // software rendering (swiftshader) draws a frame in about 1.5 s
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
    chk(t && t.greedy.result === 'win' && t.greedy.sends === 52 && t.wins === require('./baseline.json').random && t.label === 'Medium', 'Test runs greedy + 200 random bots in the background worker (classic layout: the baseline numbers)', t && `${t.greedy.result} ${t.greedy.sends} sends, ${t.wins}/200 ${t.label}`);
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
