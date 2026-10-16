// Browser tests for the game page (Playwright, Chromium): taps, the fixed step (the game reserves exactly what the
// headless core does for the same taps), refusals, the drawn marbles (slide spacing, hidden "?"), the box exit, win
// and fail, the settings (theme, supports, box motion, camera and zoom, speed, sound), pause and the timer, boosters.
//   npm i playwright            (or point NODE_PATH at an install that has it)
//   node tests/browser.test.js
// Optional env: CHROMIUM=/path/to/chrome, THREE_MODULE=/path/to/three.module.js (serves the pinned three.js locally
// instead of the CDN, for offline runs), HEADFUL=1.
const fs = require('fs'), http = require('http'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP: playwright is not installed (npm i playwright)'); process.exit(0); }
const ROOT = path.join(__dirname, '..'), C = require('./core.js')();
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png'};
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, headless: !process.env.HEADFUL,
    args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
  const three = process.env.THREE_MODULE ? fs.readFileSync(process.env.THREE_MODULE) : fs.readFileSync(path.join(ROOT, 'vendor', 'three.module.min.js'));
  const newCtx = async (vp) => { const ctx = await browser.newContext({viewport: vp || {width:390, height:844}, acceptDownloads:true});
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:three})); return ctx; };
  const errors = []; const watch = p => p.on('pageerror', e => errors.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).map(x => x.trim()).join(' < ')));
  const open = async (ctx, q) => { const p = await ctx.newPage(); watch(p); await p.goto(base + '/index.html?test&nosim' + (q ? '&' + q : ''));
    await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000}); return p; };
  try {
    console.log('game page');
    const ctx = await newCtx();
    { const p = await open(ctx);
      const st = await p.evaluate(() => ({name:__mr.N.name, src:__mr.N.id, count:document.getElementById('count').textContent, timer:document.querySelector('#timer b').textContent, speed:document.getElementById('btnSpeed').textContent}));
      chk(st.name === C.LEVEL_DATA.name && st.count === '0/' + C.checkLevel(C.LEVEL_DATA).totalMarbles && st.timer === '0:00' && st.speed === '1x', 'the game opens the built-in level: progress 0/N, timer 0:00, speed 1x', JSON.stringify(st));
      // a real tap on a lane's box sends that lane's front box to the leftmost free slot
      const xy = await p.evaluate(() => __mr.laneScreen(1)), box = await p.locator('#gl').boundingBox();
      await p.mouse.click(box.x + xy[0]/900*box.width, box.y + xy[1]/1950*box.height);
      const s1 = await p.evaluate(() => { const g = __mr.game; return {slot0:g.slots[0], lane:g.boxes[g.slots[0]] && g.boxes[g.slots[0]].lane, state:g.boxes[g.slots[0]] && g.boxes[g.slots[0]].state}; });
      chk(s1.lane === 1 && s1.state === 'fly', 'a tap on a box in a lane sends that lane\'s front box to the leftmost free slot', JSON.stringify(s1));
      await p.evaluate(() => { __mr.tap(0); __mr.tap(2); const g = __mr.game; while (!g.boxes.some(b => b.state === 'slot') && g.t < 3) __mr.advance(__mr.C.SIM_DT); });
      const glow = await p.evaluate(() => { const g = __mr.game, res = g.marbles.filter(m => m.box >= 0 && m.state === 'tray'); let n = 0; __mr.scene.traverse(o => { if (o.isSprite && o.visible && o.material.blending === __mr.THREE.AdditiveBlending) n++; }); return {res:res.length, glow:n}; });
      chk(glow.res > 0 && glow.glow >= glow.res, 'the marbles reserved when it lands hop and glow (a glow on each one waiting on its tray)', JSON.stringify(glow));
      // the drawn marbles on the slide keep the core's spacing (never closer than a marble, never passing each other)
      await p.evaluate(() => __mr.advance(0.8));
      const sp = await p.evaluate(() => { const g = __mr.game, out = [];
        for (const m of g.marbles) if (m.state === 'chute' && g.t >= m.tDep + __mr.C.T_CHUTE && g.t < m.tEnd){ const w = __mr.marbleWorld(m.id); out.push({s:m.phase + __mr.C.V_SLIDE*g.t, w}); }
        out.sort((a, b) => a.s - b.s); let min = 9; for (let i = 1; i < out.length; i++){ const a = out[i - 1].w, b = out[i].w; min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
        return {n:out.length, min}; });
      chk(sp.n >= 2 && sp.min >= C.D_M*0.98, 'on the slide the drawn marbles are never closer than a marble diameter', JSON.stringify(sp));
      await p.close(); }
    // the fixed step: the game reserves, drops and completes exactly what the headless core does for the same taps
    { const p = await open(ctx, 'level=demo_combo');
      const log = await p.evaluate(() => { const taps = [[0, 0], [12, 1], [30, 2], [200, 0], [320, 1], [460, 2], [600, 0], [760, 1], [900, 2], [1100, 0], [1300, 1], [1500, 2]];
        const g = __mr.game, C = __mr.C, out = []; __mr.setSpeed(2.25);
        for (let n = 0; n < 1800 && !g.result; n++){ for (const [s, l] of taps) if (s === n) __mr.tap(l);
          const before = g.n; __mr.advance(C.SIM_DT); void before; }
        return {r:g.result, landed:g.landed, sends:g.sends, res:g.marbles.map(m => m.box).join(',')}; });
      const g = C.createGame(C.PRESETS.demo_combo, {headless:true}), taps = [[0, 0], [12, 1], [30, 2], [200, 0], [320, 1], [460, 2], [600, 0], [760, 1], [900, 2], [1100, 0], [1300, 1], [1500, 2]];
      for (let n = 0; n < 1800 && !g.result; n++){ for (const [s, l] of taps) if (s === n) C.tapLane(g, l); C.step(g); }
      chk(log.res === g.marbles.map(m => m.box).join(',') && log.landed === g.landed && log.r === g.result, 'the game (at 2.25x) and a headless run give the same reservations for the same taps', `${log.r} ${log.landed} | ${g.result} ${g.landed}`);
      await p.close(); }
    // refusals: all 5 slots taken -> the box shakes, the slot tray flashes red, a toast; not a fail
    { const p = await open(ctx, 'level=demo_count_crate');
      const r = await p.evaluate(() => { const g = __mr.game; for (let i = 0; i < 6; i++) __mr.tap(i % 3); __mr.advance(0.05);
        return {res:g.result, toast:document.getElementById('toast').classList.contains('show') && document.getElementById('toast').textContent, flash:__mr.V.flash > 0, refused:g.refused}; });
      chk(r.refused >= 1 && r.toast === 'All slots are full!' && r.flash && !r.res, 'with all 5 slots taken a tap is refused: a toast "All slots are full!", the slot tray flashes red; not a fail', JSON.stringify(r));
      await p.close(); }
    // hidden things: a hidden box is grey with a "?", a hidden marble too, until revealed
    { const p = await open(ctx, 'level=demo_combo');
      const h = await p.evaluate(() => { const g = __mr.game, hb = g.boxes.find(b => b.hidden && !b.revealed), hm = g.marbles.find(m => m.hidden && !m.revealed), V = __mr.V;
        __mr.advance(0.05); return {box:hb && !!V.boxes[hb.id].q, boxGrey:hb && V.boxes[hb.id].rim.material.color.getHexString(), marble:hm && !!V.marbles[hm.id].q}; });
      chk(h.box && h.boxGrey === 'b9b7c0' && h.marble, 'a hidden box shows grey with a "?", and so does a hidden marble', JSON.stringify(h));
      await p.close(); }
    // the bot plays a whole level: a completed box closes, ties its bow, rises under its balloon and floats off the
    // left or right edge of the screen; then the win panel
    { const p = await open(ctx, 'level=demo_hidden_box&bot');
      const w = await p.evaluate(async () => { const g = __mr.game, seen = {}, exits = []; let t = 0;
        while (t < 200 && !document.getElementById('winPanel').classList.contains('show')){ __mr.advance(0.25); t += 0.25;
          for (const b of g.boxes) if (b.state === 'gone'){ const V = __mr.V.boxes[b.id], u = g.t - b.tDone;
            if (!seen[b.id]) seen[b.id] = {lid:false, balloon:false, out:false, gone:false};
            const S = seen[b.id]; if (V.lid.visible && u > 0.25) S.lid = true; if (V.balloon.visible && V.bow.visible) S.balloon = true;
            const [x] = __mr.screenOf(V.g.position.x, V.g.position.y, V.g.position.z); if (x < -40 || x > 940) S.out = true;
            if (!V.g.visible && !S.out) S.early = true; } }
        return {win:document.getElementById('winPanel').classList.contains('show'), result:g.result, boxes:Object.values(seen)}; });
      chk(w.win && w.result === 'win', 'the greedy bot wins the level; the win panel shows', JSON.stringify({win:w.win, r:w.result}));
      chk(w.boxes.length > 5 && w.boxes.every(b => b.lid && b.balloon && b.out && !b.early), 'every completed box snaps its lid shut, ties a bow, rises under a balloon and floats off the side of the screen (never vanishing before)',
        `${w.boxes.filter(b => b.lid && b.balloon && b.out && !b.early).length}/${w.boxes.length}`);
      await p.close(); }
    // fail: the 5 boxes wobble like dominoes, then the fail panel; Try Again restarts
    { const p = await open(ctx, 'level=demo_connected');
      const f = await p.evaluate(async () => { const g = __mr.game, C = __mr.C; let rng = 7; const r = () => (rng = (rng*16807) % 2147483647)/2147483647;
        for (let i = 0; i < 4000 && !g.result; i++){ const a = C.adversePick(g, r); if (a) __mr.tap(a.idx); __mr.advance(0.1); }
        const res = g.result, early = document.getElementById('failPanel').classList.contains('show');
        let wob = 0; for (let k = 0; k < 10; k++){ __mr.advance(0.1); for (const b of g.boxes) if (b.state === 'slot' && Math.abs(__mr.V.boxes[b.id].g.rotation.x) > 0.05) wob++; }
        __mr.advance(1.5); return {res, early, wob, panel:document.getElementById('failPanel').classList.contains('show')}; });
      chk(f.res === 'fail' && !f.early && f.wob > 0 && f.panel, 'a fail: the slot boxes wobble like dominoes first, then the fail panel', JSON.stringify(f));
      await p.click('#btnRetry'); const again = await p.evaluate(() => !__mr.game.result && __mr.game.landed === 0 && __mr.game.sends === 0 && !document.getElementById('failPanel').classList.contains('show'));
      chk(again, 'Try Again restarts the level');
      await p.close(); }
    // settings, pause, timer, speed, boosters
    { const p = await open(ctx);
      await p.evaluate(() => { __mr.tap(0); __mr.advance(1.0); });
      await p.click('#btnPause'); const t0 = await p.evaluate(() => __mr.game.t); await sleep(400); const t1 = await p.evaluate(() => __mr.game.t);
      chk(await p.evaluate(() => __mr.paused && document.getElementById('pausePanel').classList.contains('show')) && t0 === t1, 'pause holds the game (its clock too) and opens the pause menu: Resume, Restart, Settings', `${t0} -> ${t1}`);
      await p.click('#pmSettings'); chk(await p.evaluate(() => document.getElementById('setPanel').classList.contains('show')), 'Settings opens from the pause menu');
      const themes = []; for (const th of ['walnut', 'playmat', 'picnic', 'maple']){ await p.evaluate(th => __mr.setTheme(th), th); themes.push(await p.evaluate(() => __mr.scene.background.getHexString())); }
      chk(new Set(themes).size === 4, 'four themes: Maple, Walnut, Playmat, Picnic', themes.join(' '));
      const sup = await p.evaluate(() => { __mr.setSupports('blocks'); const n1 = __mr.scene.children.length; let boxes = 0; __mr.scene.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry') boxes++; }); __mr.setSupports('pillars'); return boxes; });
      chk(sup > 50, 'supports: Pillars or Toy blocks (stacked wooden blocks under the slide and the trays)', sup);
      const cams = await p.evaluate(() => { __mr.setView('ortho'); const o = __mr.camera.isOrthographicCamera; __mr.setZoom(1.2); const z = __mr.camera.right; __mr.setView('persp'); __mr.setZoom(1.2); const f = __mr.camera.fov; __mr.setZoom(1); return {o, z, f}; });
      chk(cams.o && cams.f < 30, 'camera: Perspective or Orthographic, and the zoom', JSON.stringify(cams));
      await p.click('#setClose'); await p.click('#pmResume');
      chk(await p.evaluate(() => !__mr.paused), 'Resume');
      await p.keyboard.press('p'); const kp = await p.evaluate(() => __mr.paused); await p.keyboard.press('p');
      chk(kp && await p.evaluate(() => !__mr.paused), 'the P key toggles the pause menu');
      await p.evaluate(() => __mr.setSpeed(1)); const sp = []; for (let k = 0; k < 9; k++){ await p.click('#btnSpeed'); sp.push(await p.evaluate(() => __mr.timeScale)); }
      chk(sp.join() === '1.25,1.5,1.75,2,2.25,2.5,2.75,3,1', 'the speed button steps 1x to 3x in quarters and back', sp.join());
      const tm = await p.evaluate(() => { __mr.advance(65); return document.querySelector('#timer b').textContent; });
      chk(/^1:0\d$/.test(tm) || /^\d:\d\d$/.test(tm), 'the level timer counts game time (m:ss)', tm);
      const before = await p.evaluate(() => JSON.stringify(__mr.game.slots)); await p.click('.boost'); const after = await p.evaluate(() => JSON.stringify(__mr.game.slots));
      chk(before === after && await p.evaluate(() => document.querySelector('.boost').classList.contains('wob')), 'the three round boosters are placeholders: a wobble, no effect');
      await p.close(); }
    chk(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  } catch (e){ console.log('ERROR', e); fail++; }
  await browser.close(); srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
})();
