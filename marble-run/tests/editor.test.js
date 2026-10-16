// Editor tests (Playwright, Chromium): the editor's shell and its preview (the real game, fed by postMessage), keyboard
// shortcuts (Ctrl on Windows / Linux, Cmd on a Mac), selection (click, Shift/Ctrl-click, band, select all), copy / cut /
// paste / duplicate / delete / nudge for slide points, trays, blockers, marble cells, boxes, gaps, toy pieces and whole
// levels, the slide (points, spirals, the slide zone), trays (front node on the slide, back node, size, the tray tool),
// blockers (dispensers, lock crates with their key box, count crates), gaps and the toy piece tool, box lanes (2-5, Add
// box, drag between lanes, connect across lanes), marble size, role and difficulty, drafts and the unsaved dot, level
// ids, the level order, exports (level JSON, playable HTML of a level or the whole order, frozen and offline), the
// background bot test, Watch, the preview camera and zoom.
//   node tests/editor.test.js          (env: CHROMIUM, THREE_MODULE as for tests/browser.test.js)
const fs = require('fs'), http = require('http'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP: playwright is not installed (npm i playwright)'); process.exit(0); }
const ROOT = path.join(__dirname, '..'), C = require('./core.js')();
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms){ try { const v = await fn(); if (v) return v; } catch (e) {} await sleep(step); } return null; };

(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, headless: !process.env.HEADFUL,
    args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const three = process.env.THREE_MODULE ? fs.readFileSync(process.env.THREE_MODULE) : fs.readFileSync(path.join(ROOT, 'vendor', 'three.module.min.js'));
  const ctx = await browser.newContext({viewport:{width:1600, height:950}, acceptDownloads:true});
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:three}));
  const errors = [], watch = p => p.on('pageerror', e => errors.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).map(x => x.trim()).join(' < ')));
  try {
    const ed = await ctx.newPage(); watch(ed);
    let dialogAnswer = null; ed.on('dialog', d => d.type() === 'prompt' ? d.accept(dialogAnswer || '') : d.accept());
    await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => window.__ed && __ed.level, null, {timeout:60000});
    const E = (fn, a) => ed.evaluate(fn, a), key = k => ed.keyboard.press(k);
    const box = await ed.locator('#view').boundingBox();
    const toScreen = async (x, z) => { const [sx, sy] = await E(([x, z]) => __ed.W2S(x, z), [x, z]); return [box.x + sx, box.y + sy]; };
    const cellAt = (src, c, k) => E(([src, c, k]) => { const r = __ed.layout.TRAYS.find(q => q.src === src); return [r.slots[c][k].x, r.slots[c][k].z]; }, [src, c, k]);
    const slideAt = s => E(s => { const o = {}; window.MRCore.pathAt(__ed.layout.SLIDE, s, o, 0); return [o.x, o.z]; }, s);
    const reset = async () => { await E(() => { __ed.setLevel(JSON.parse(JSON.stringify(window.MRCore.LEVEL_DATA))); __ed.fitView(); __ed.setTool('select'); __ed.sel = {kind:'level'}; }); };
    // a free spot on the slide for a gap or a toy piece (no warning there)
    const freeS = (what, kind) => E(([what, kind]) => { const C = window.MRCore, base = JSON.parse(JSON.stringify(__ed.level)), SL = __ed.layout.SLIDE;
      let run = null;                                    // the middle of the first free stretch at least 0.4 long
      for (let s = 3; s < SL.tailS - 2; s += 0.1){ const t = JSON.parse(JSON.stringify(base));
        if (what === 'gap') t.slide.gaps = (t.slide.gaps || []).concat([{at:s, len:1.0, ramp:'flat'}]); else t.slide.toys = (t.slide.toys || []).concat([{kind, at:s, len:C.TOY_KINDS[kind]}]);
        const o = {}; C.pathAt(SL, s, o, 0);
        const clickable = Math.abs(__ed.nearestSlideS(o.x, o.z).s - s) < 0.2 && !base.slide.points.some(p => Math.hypot(p.x - o.x, p.z - o.z) < 0.6);   // (not under an overpass, not on a point)
        if (clickable && !C.checkLevel(t).warnings.length){ if (run == null) run = s; else if (s - run >= 0.39) return run + 0.2; } else run = null; }
      return null; }, [what, kind]);

    /* ---------------- the shell and its preview ---------------- */
    console.log('editor shell and preview');
    const frame = await until(async () => ed.frames().find(f => f.url().includes('index.html')));
    await frame.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
    chk(await until(() => frame.evaluate(() => __mr.levelSource === 'editor' && __mr.embed)), 'the preview iframe runs the real game with the level sent by the editor');
    chk(await E(() => { const r = document.getElementById('preview').getBoundingClientRect(); return r.width > 300 && r.left > 1100; }), 'the preview sits to the right of the work area, in a phone frame');
    { const ui = await E(() => ({
        bar: ['#fileMenu', '#undoBtn', '#redoBtn', '#runBtn', '#testBtn', '#exportMenu', '#helpBtn'].every(q => document.querySelector(q)),
        barTips: [...document.querySelectorAll('#bar > button, #bar .menu > [data-menu]')].every(b => b.title && b.querySelector('svg.i')),
        tools: [...document.querySelectorAll('#palette [data-tool]')].map(b => ({id:b.dataset.tool, tip:/\((\d or )?\w\)$/.test(b.title), icon:!!b.querySelector('svg.i')})),
        insp: !!document.querySelector('#insp .card'), boxes: document.querySelectorAll('#queueSvg .qbox').length,
        status: document.getElementById('status').textContent }));
      chk(ui.bar && ui.barTips, 'top toolbar: file menu, undo/redo, run/test, export, help; every button has an icon and a tooltip');
      chk(ui.tools.map(t => t.id).join(',') === 'select,slide,tray,gap,toy,paint,erase,hide,disp,lock,count,link' && ui.tools.every(t => t.tip && t.icon),
        'left tool panel: slide, trays, cut, toy pieces, marbles, every blocker tool, each with an icon and a tooltip naming its shortcut', ui.tools.map(t => t.id).join(','));
      chk(ui.insp && ui.boxes === 13, 'right inspector and the box lanes (13 boxes of the built-in level)', ui.boxes);
      chk(/72 marbles · 13 boxes/.test(await until(() => E(() => /marbles/.test(document.getElementById('status').textContent) && document.getElementById('status').textContent))), 'the preview reports the level it loaded (72 marbles, 13 boxes)'); }
    await ed.mouse.click(box.x + 8, box.y + box.height - 60);          // focus the view (empty table)

    console.log('tools and colours');
    await key('2'); const t2 = await E(() => __ed.tool); await key('4'); const t4 = await E(() => __ed.tool); await key('9'); const t9 = await E(() => __ed.tool);
    await key('d'); const td = await E(() => __ed.tool); await key('y'); const ty = await E(() => __ed.tool); await key('g'); const tg = await E(() => __ed.tool); await key('1');
    chk(t2 === 'slide' && t4 === 'paint' && t9 === 'count' && td === 'disp' && ty === 'toy' && tg === 'gap' && await E(() => __ed.tool) === 'select',
      'number and letter keys switch tools (2 slide, 4 paint, 9 count crate, D dispenser, Y toy piece, G cut, 1 select)', [t2, t4, t9, td, ty, tg].join(' '));
    await key('Shift+Digit3');
    chk(await E(() => __ed.color) === 'yellow', 'Shift+3 picks the third colour');
    chk(await E(() => /Ctrl\+Z|⌘Z/.test(document.getElementById('undoBtn').title) && [...document.querySelectorAll('#fileMenu kbd')].length >= 4),
      'tooltips and menus name the shortcuts (Ctrl+... or ⌘ on a Mac)');
    await key('?');
    chk(await E(() => document.getElementById('helpModal').classList.contains('show') && document.querySelectorAll('#keysList kbd').length >= 20 && /Ctrl\+Shift\+S|⌘⇧S/.test(document.getElementById('keysList').textContent)), '? shows the shortcut list');
    await key('Escape');
    chk(await E(() => !document.querySelector('.modal.show')), 'Esc closes it');

    console.log('trays: select all, copy / paste, undo / redo, duplicate, delete');
    const nR = await E(() => __ed.level.trays.length);
    await key('Control+a');
    chk(await E(() => __ed.sel.kind === 'tray' && __ed.sel.list.length) === nR, 'Ctrl+A with the select tool selects every tray', nR);
    await key('Control+c'); await key('Control+v');
    chk(await E(() => __ed.level.trays.length) === 2*nR && await E(() => __ed.sel.list.length) === nR, 'Ctrl+C, Ctrl+V pastes copies of the trays (and selects them)');
    await key('Control+z'); const u = await E(() => __ed.level.trays.length);
    await key('Control+Shift+z'); const r1 = await E(() => __ed.level.trays.length);
    await key('Control+z'); await key('Control+y'); const r2 = await E(() => __ed.level.trays.length);
    chk(u === nR && r1 === 2*nR && r2 === 2*nR, 'Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo', `${u} ${r1} ${r2}`);
    await key('Delete');
    chk(await E(() => __ed.level.trays.length) === nR, 'Delete removes the selected trays');
    await E(() => { __ed.sel = {kind:'tray', tray:0}; }); await key('Control+d');
    chk(await E(() => __ed.sel.list && __ed.sel.list[0] === __ed.level.trays.length - 1) && await E(() => __ed.level.trays.length) === nR + 1, 'Ctrl+D duplicates the selected tray');
    await key('Backspace');
    chk(await E(() => __ed.level.trays.length) === nR, 'Backspace deletes too');
    await E(() => { __ed.sel = {kind:'tray', tray:0}; }); await key('Control+x');
    chk(await E(() => __ed.level.trays.length) === nR - 1 && await E(() => __ed.CLIP && __ed.CLIP.kind === 'tray'), 'Ctrl+X cuts a tray');
    await key('Control+z');
    { await E(() => { __ed.sel = {kind:'tray', tray:2}; }); const s0 = await E(() => __ed.layout.TRAYS.find(r => r.src === 2).s);
      await key('ArrowRight'); const s1 = await E(() => __ed.layout.TRAYS.find(r => r.src === 2).s);
      chk(Math.abs(s1 - s0 - 0.2) < 0.02, 'the arrow keys slide a tray along the slide', `${s0.toFixed(2)} -> ${s1.toFixed(2)}`); await key('Control+z'); }

    console.log('slide points: multi-select, nudge, delete, band select');
    await key('2'); await key('Control+a');
    const nP = await E(() => __ed.level.slide.points.length);
    chk(await E(() => __ed.sel.kind === 'point' && __ed.sel.list.length) === nP, 'Ctrl+A with the slide tool selects every slide point');
    await E(() => { __ed.sel = {kind:'point', i:6}; });
    const p6 = await E(() => __ed.level.slide.points[6].x);
    await key('ArrowRight'); const a1 = await E(() => __ed.level.slide.points[6].x); await key('Shift+ArrowRight'); const a2 = await E(() => __ed.level.slide.points[6].x);
    chk(Math.abs(a1 - p6 - 0.1) < 1e-6 && Math.abs(a2 - a1 - 0.5) < 1e-6, 'arrow keys nudge a point 0.1, with Shift 0.5', `${p6} ${a1} ${a2}`);
    await key('Control+z'); await key('Control+z');
    { const pa = await E(() => __ed.level.slide.points[7]), pb = await E(() => __ed.level.slide.points[8]);
      const [x1, y1] = await toScreen(pa.x, pa.z), [x2, y2] = await toScreen(pb.x, pb.z);
      await ed.mouse.click(x1, y1); await ed.keyboard.down('Shift'); await ed.mouse.click(x2, y2); await ed.keyboard.up('Shift');
      chk(await E(() => __ed.sel.kind === 'point' && __ed.sel.list.join() === '7,8'), 'click + Shift-click selects two slide points', await E(() => JSON.stringify(__ed.sel))); }
    await key('Delete');
    chk(await E(() => __ed.level.slide.points.length) === nP - 2, 'Delete removes both');
    await key('Control+z');
    { const pts = await E(() => __ed.level.slide.points.slice(7, 10).map(p => [p.x, p.z]));
      const sc = await Promise.all(pts.map(p => toScreen(...p))), xs = sc.map(p => p[0]), ys = sc.map(p => p[1]);
      await ed.mouse.move(Math.min(...xs) - 14, Math.max(...ys) + 40); await ed.mouse.down();
      await ed.mouse.move(Math.max(...xs) + 14, Math.min(...ys) - 14, {steps:6}); await ed.mouse.up();
      chk(await E(() => __ed.sel.kind === 'point' && __ed.sel.list.length >= 3), 'dragging a band over the table selects the slide points inside', await E(() => JSON.stringify(__ed.sel))); }
    await key('Escape');
    chk(await E(() => __ed.sel.kind === 'level'), 'Esc deselects');

    console.log('the slide with the mouse');
    await reset(); await E(() => __ed.setTool('slide'));
    { const n0 = await E(() => __ed.level.slide.points.length), sMid = await E(() => { const P = __ed.layout.SLIDE.pointS; return (P[7] + P[8])/2; });
      const spot = await slideAt(sMid); let [mx, my] = await toScreen(...spot); await ed.mouse.click(mx, my);
      const pts = await E(() => __ed.level.slide.points.map(p => [p.x, p.z]));
      chk(pts.length === n0 + 1 && Math.hypot(pts[8][0] - spot[0], pts[8][1] - spot[1]) < 0.1 && await E(() => __ed.sel.kind === 'point' && __ed.sel.i === 8),
        'slide tool: clicking the slide inserts a point where it was clicked, in slide order', JSON.stringify(pts[8]));
      [mx, my] = await toScreen(...pts[8]); await ed.mouse.move(mx + 30, my + 30); await ed.mouse.move(mx, my);
      chk(await E(() => __ed.hover && __ed.hover.kind === 'point' && __ed.hover.i === 8), 'hovering a point highlights it');
      await ed.mouse.down(); await ed.mouse.move(mx + 25, my, {steps:5}); await ed.mouse.up();
      const moved = await E(() => __ed.level.slide.points[8].x);
      chk(moved > pts[8][0] + 0.3, 'dragging a point moves it', `${pts[8][0]} -> ${moved}`);
      [mx, my] = await toScreen(moved, pts[8][1]); await ed.mouse.click(mx, my, {button:'right'});
      chk(await E(() => document.getElementById('ctx').classList.contains('show') && /Slide point/.test(document.getElementById('ctx').textContent)), 'right-clicking a point opens its menu');
      await ed.locator('#ctx button', {hasText:'Delete'}).click();
      chk(await E(() => __ed.level.slide.points.length) === n0, 'Delete in that menu deletes the point');
      const p5 = await E(() => { const p = __ed.level.slide.points[5]; return [p.x, p.z]; }), [lx, ly] = await toScreen(...p5);
      await E(([x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent('pointerdown', {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true, button:0})), [lx, ly]);
      await until(() => E(n => __ed.level.slide.points.length === n, n0 - 1), 4000, 100);
      await E(([x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent('pointerup', {clientX:x, clientY:y, pointerId:77, pointerType:'touch', bubbles:true})), [lx, ly]);
      chk(await E(() => __ed.level.slide.points.length) === n0 - 1, 'a touch long-press on a point deletes it');
      await key('Control+z');
      chk(await E(() => __ed.check.warnings.length === 0 && __ed.level.trays.every(r => r.at != null)), 'trays stay on the slide (merge points kept) after slide edits; the level stays warning-free',
        await E(() => __ed.check.warnings.map(w => w.kind).join())); }
    // the start tower is the first point
    { await E(() => { __ed.sel = {kind:'point', i:0}; });
      chk(await E(() => /Start tower/.test(document.querySelector('#insp .card h2').textContent)), 'the first point is the start tower'); }
    // spiral toggle from the inspector
    await E(() => { __ed.sel = {kind:'point', i:7}; });
    await ed.locator('#insp button', {hasText:'Spiral off'}).click();
    chk(await E(() => !!__ed.level.slide.points[7].spiral && __ed.layout.SLIDE.spirals.length === 2), 'the Spiral toggle in the point inspector adds a loop that passes over itself');
    await key('Control+z');
    // the slide zone: a point dragged far out -> warnings; a point added out there lands inside the frame
    await E(() => { __ed.edit(n => { n.slide.points[6].x = 7.5; }); });
    chk(await E(() => __ed.check.warnings.some(w => w.kind === 'zone-slide') && /slide zone/.test(document.getElementById('checks').textContent)), 'a slide leaving the slide zone is listed in the checks');
    { const far = await E(() => { const SL = __ed.layout.SLIDE, o = {}; window.MRCore.pathAt(SL, SL.pointS[6] - 0.6, o, 0); return [o.x, o.z]; });
      const n2 = await E(() => __ed.level.slide.points.length);
      await E(([x, z]) => { const cv = document.getElementById('view'), r = cv.getBoundingClientRect(), [sx, sy] = __ed.W2S(x, z);   // may be off the visible canvas
        const o = {clientX:r.left + sx, clientY:r.top + sy, pointerId:78, pointerType:'mouse', bubbles:true, button:0};
        cv.dispatchEvent(new PointerEvent('pointerdown', o)); cv.dispatchEvent(new PointerEvent('pointerup', o)); }, far);
      const np = await E(n => { const pts = __ed.level.slide.points; if (pts.length !== n + 1) return null; const p = pts[__ed.sel.i]; return [p.x, p.z, window.MRCore.inZoneBoth(p.x, 1.9, p.z) && window.MRCore.inZoneBoth(p.x, 1.2, p.z)]; }, n2);
      chk(np && np[2], 'a slide point added outside the frame is created inside it', JSON.stringify({clicked:far.map(v => +v.toFixed(2)), placed:np})); }

    console.log('marbles: paint, hidden brush, eraser, fill');
    await reset(); await E(() => { __ed.setTool('paint'); __ed.color = 'cyan'; });
    { const [mx, my] = await toScreen(...await cellAt(0, 0, 2)); await ed.mouse.click(mx, my);
      chk(await E(() => __ed.level.trays[0].columns[0][2] === 'cyan'), 'painting a cell with the cyan brush');
      await E(() => __ed.setTool('hide')); await ed.mouse.click(mx, my);
      chk(await E(() => __ed.level.trays[0].columns[0][2] === '?cyan'), 'the hidden brush turns a marble into a grey "?" one');
      await E(() => __ed.setTool('erase')); await ed.mouse.click(mx, my);
      chk(await E(() => __ed.level.trays[0].columns[0][2] === null), 'the eraser leaves the cell empty');
      chk(await E(() => !__ed.check.balanced && document.querySelectorAll('#checks .cc.bad').length === 1), 'the checks panel turns exactly that colour red'); }
    await E(() => { __ed.trayAction('fill', 0); });
    { const used = await E(() => [...new Set(__ed.level.trays.slice(1).flatMap(r => r.columns.flat()).filter(Boolean))]), cols = await E(() => __ed.level.trays[0].columns);
      const runsOk = cols.every(col => { let run = 1; for (let i = 1; i < col.length; i++){ run = col[i] === col[i-1] ? run + 1 : 1; if (run > 3) return false; } return col.every(c => used.includes(c)); });
      chk(runsOk, 'Fill random uses the colours already in the level, in runs of 1-3 per column'); }
    // marble cells: copy into another tray, delete, move
    await E(() => { __ed.setTool('select'); __ed.sel = {kind:'cells', tray:0, cells:[[0, 0], [1, 0], [0, 1]]}; });
    const cellsSrc = await E(() => [[0, 0], [1, 0], [0, 1]].map(([c, k]) => __ed.level.trays[0].columns[c][k]).join());
    await key('Control+c'); await E(() => { __ed.sel = {kind:'tray', tray:1}; __ed.edit(n => { n.trays[1].columns[0][0] = n.trays[1].columns[1][0] = n.trays[1].columns[0][1] = null; }); }); await key('Control+v');
    chk(await E(() => [[0, 0], [1, 0], [0, 1]].map(([c, k]) => __ed.level.trays[1].columns[c][k]).join()) === cellsSrc && await E(() => __ed.sel.kind === 'cells' && __ed.sel.tray === 1),
      'copied marble cells paste into another tray', cellsSrc);
    await key('Delete');
    chk(await E(() => [[0, 0], [1, 0], [0, 1]].every(([c, k]) => __ed.level.trays[1].columns[c][k] == null)), 'Delete empties the selected cells');

    console.log('trays: size, front node on the slide, back node, the tray tool');
    await reset(); await E(() => { __ed.sel = {kind:'tray', tray:1}; });
    const rows1 = await E(() => __ed.layout.TRAYS.find(r => r.src === 1).rows);
    await ed.locator('#insp button[data-a="c+"]').click(); await ed.locator('#insp button[data-a="r-"]').click();
    chk(await E(r0 => { const r = __ed.level.trays[1]; return r.columns.length === 4 && r.rows === r0 - 1; }, rows1), 'column + and row − in the tray inspector resize the tray');
    await key('Control+z'); await key('Control+z');
    { const before = await E(() => __ed.layout.TRAYS.find(r => r.src === 0).s), lip = await E(() => __ed.layout.TRAYS.find(r => r.src === 0).lip);
      const target = await E(() => { const r = __ed.layout.TRAYS.find(q => q.src === 0), o = {}; window.MRCore.pathAt(__ed.layout.SLIDE, r.s + 1.0, o, 0);
        return [o.x - o.dz*r.side*0.6, o.z + o.dx*r.side*0.6]; });
      let [mx, my] = await toScreen(...lip), [tx, ty] = await toScreen(...target);
      await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:8}); await ed.mouse.up();
      const after = await E(() => ({s:__ed.layout.TRAYS.find(r => r.src === 0).s, at:__ed.level.trays[0].at}));
      chk(Math.abs(after.s - before - 1.0) < 0.3 && after.at != null, 'dragging the front node along the slide moves the merge point', `${before.toFixed(2)} -> ${after.s.toFixed(2)}`);
      const away = await E(() => { const r = __ed.layout.TRAYS.find(q => q.src === 0); return [r.lip[0] + r.dir[0]*2.5, r.lip[1] + r.dir[1]*2.5]; });
      const lip2 = await E(() => __ed.layout.TRAYS.find(r => r.src === 0).lip);
      [mx, my] = await toScreen(...lip2); [tx, ty] = await toScreen(...away);
      await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(tx, ty, {steps:8}); await ed.mouse.up();
      const st = await E(() => { const L = __ed.layout, r = L.TRAYS.find(q => q.src === 0), o = {}; window.MRCore.pathAt(L.SLIDE, r.s, o, 0);
        return {edge:Math.abs(Math.hypot(r.lip[0] - o.x, r.lip[1] - o.z) - window.MRCore.EDGE), at:__ed.level.trays[0].at != null}; });
      chk(st.edge < 0.02 && st.at, 'a front node dropped away from the slide still snaps onto it: the tray\'s front edge stays on the slide\'s edge', JSON.stringify(st));
      await reset(); await E(() => { __ed.sel = {kind:'tray', tray:2}; });
      const tip = await E(() => __ed.layout.TRAYS.find(r => r.src === 2).tip), dir0 = await E(() => __ed.layout.TRAYS.find(r => r.src === 2).dir);
      [mx, my] = await toScreen(...tip); await ed.mouse.move(mx, my); await ed.mouse.down(); await ed.mouse.move(mx + 30, my + 40, {steps:6}); await ed.mouse.up();
      const dir1 = await E(() => __ed.layout.TRAYS.find(r => r.src === 2).dir);
      chk(await E(() => !!__ed.level.trays[2].shape && __ed.level.trays[2].tilt == null) && Math.abs(Math.atan2(dir1[1], dir1[0]) - Math.atan2(dir0[1], dir0[0])) > 0.05,
        'dragging the back node turns the tray', JSON.stringify([dir0, dir1].map(d => d.map(v => +v.toFixed(2))))); }
    { await reset(); await E(() => __ed.edit(n => { n.trays = []; n.lanes = [[], [], []]; }));          // (the built-in slide has room for a tray only where its own stand)
      const n = await E(() => __ed.level.trays.length); await E(() => __ed.setTool('tray'));
      const spot = await E(() => { const SL = __ed.layout.SLIDE, o = {}; window.MRCore.pathAt(SL, 15.1, o, 0); return [o.x + o.dz*1.0, o.z - o.dx*1.0]; });
      const [mx, my] = await toScreen(...spot); await ed.mouse.click(mx, my);
      chk(await E(n => { const r = __ed.layout.TRAYS.find(q => q.src === n); return __ed.level.trays.length === n + 1 && __ed.sel.kind === 'tray' && !!r
          && !__ed.check.warnings.length; }, n),
        'the tray tool adds a tray on the slide where it was clicked, free of warnings', await E(() => __ed.check.warnings.map(w => w.kind + ':' + w.tray).join())); }

    console.log('blockers: dispenser, count crate, lock crate + key box');
    await reset(); await E(() => { __ed.setTool('disp'); __ed.color = 'red'; });
    const dragCells = async (src, a, b) => { const [x0, y0] = await toScreen(...await cellAt(src, a[0], a[1])), [x1, y1] = await toScreen(...await cellAt(src, b[0], b[1]));
      await ed.mouse.move(x0, y0); await ed.mouse.down(); await ed.mouse.move(x1, y1, {steps:6}); await ed.mouse.up(); };
    { const red0 = await E(() => __ed.check.perColor.find(p => p.color === 'red').marbles);
      const under = await E(() => [1, 2].flatMap(c => [2, 3].map(k => __ed.level.trays[0].columns[c][k])).filter(x => x && x.replace('?', '') === 'red').length);
      await dragCells(0, [1, 2], [2, 3]);
      const t = await E(() => (__ed.level.trays[0].dispensers || [])[0]), red1 = await E(() => __ed.check.perColor.find(p => p.color === 'red').marbles);
      chk(t && t.col === 1 && t.row === 2 && t.w === 2 && t.h === 2 && t.color === 'red' && t.count >= 2 && await E(() => [1, 2].every(c => [2, 3].every(k => __ed.level.trays[0].columns[c][k] === null))),
        'dispenser tool: dragging across cells places a 2x2 red dispenser over emptied cells', JSON.stringify(t));
      chk(red1 === red0 - under + t.count && await E(() => __ed.sel.kind === 'disp'), 'its marbles count toward the red total; the new dispenser is selected', `${red0} - ${under} + ${t.count} = ${red1}`); }
    await ed.fill('#tCount', '9'); await E(() => document.getElementById('tCount').dispatchEvent(new Event('change')));
    chk(await E(() => __ed.level.trays[0].dispensers[0].count === 9), 'the dispenser inspector edits its count');
    { const n = await E(() => (__ed.level.trays[1].dispensers || []).length); await dragCells(1, [0, 0], [0, 1]);
      chk(await E(n => (__ed.level.trays[1].dispensers || []).length === n, n), 'a dispenser touching the front row is refused (it needs a cell in front)'); }
    await E(() => __ed.setTool('count')); await dragCells(1, [0, 1], [1, 2]);
    chk(await E(() => { const b = (__ed.level.trays[1].crates || [])[0]; return b && b.count >= 1 && b.lock == null && b.w === 2 && b.h === 2 && __ed.sel.kind === 'crate'; }), 'count crate tool: a 2x2 crate with a count');
    await ed.fill('#bCount', '4'); await E(() => document.getElementById('bCount').dispatchEvent(new Event('change')));
    chk(await E(() => __ed.level.trays[1].crates[0].count === 4), 'the crate inspector sets the count');
    await E(() => __ed.setTool('lock')); await dragCells(1, [1, 3], [1, 4]);
    chk(await E(() => __ed.level.trays[1].crates.length === 1), 'a second blocker over the same column is refused (one per column)');
    await dragCells(2, [0, 0], [1, 1]);
    chk(await E(() => { const b = (__ed.level.trays[2].crates || [])[0]; return b && b.lock === 'K1' && __ed.check.warnings.some(w => w.kind === 'lock-no-key'); }), 'lock crate tool: a crate with lock K1, and a warning until a box carries its key');
    await ed.selectOption('#bKey', '1:0');
    chk(await E(() => __ed.level.lanes[1][0].key === 'K1' && !__ed.check.warnings.some(w => /^lock|key/.test(w.kind)) && /K1/.test(document.getElementById('queueSvg').textContent)),
      'the key box picker puts the key on that box (shown in the lanes) and clears the warning', await E(() => __ed.check.warnings.map(w => w.kind).join()));
    await E(() => __ed.setTool('select'));
    { const [mx, my] = await toScreen(...await cellAt(0, 1, 2)); await ed.mouse.click(mx, my);
      chk(await E(() => __ed.sel.kind === 'disp' && __ed.sel.tray === 0), 'clicking a dispenser selects it'); }
    await key('ArrowRight');
    chk(await E(() => __ed.level.trays[0].dispensers[0].col) === 1, 'a dispenser cannot be nudged off the tray (it already reaches the last column)');
    await key('ArrowLeft');
    chk(await E(() => __ed.level.trays[0].dispensers[0].col) === 0, 'arrow keys move a dispenser a column');
    await key('Delete');
    chk(await E(() => !(__ed.level.trays[0].dispensers || []).length), 'Delete removes the selected blocker');
    await key('Control+z');
    await E(() => { __ed.sel = {kind:'disp', tray:0, i:0}; __ed.edit(n => { n.trays[0].dispensers[0].w = 1; n.trays[0].dispensers[0].h = 1; }); });
    await key('Control+d');
    chk(await E(() => __ed.level.trays[0].dispensers.length === 2 && __ed.level.trays[0].dispensers[1].col !== __ed.level.trays[0].dispensers[0].col), 'Ctrl+D duplicates the dispenser into a free column');
    await key('7'); await key('Control+a');
    chk(await E(() => __ed.sel.kind === 'disp' && __ed.sel.list.length === 2), 'Ctrl+A with the dispenser tool selects every dispenser');
    await key('Delete');
    chk(await E(() => !(__ed.level.trays[0].dispensers || []).length), 'Delete removes them');
    await key('1');

    console.log('gaps');
    await reset(); await E(() => __ed.edit(n => { n.trays.splice(3, 1); n.trays.splice(1, 1); }));          // (room on the slide for a gap)
    { const s = await freeS('gap'); await E(() => __ed.setTool('gap'));
      const [mx, my] = await toScreen(...await slideAt(s)); await ed.mouse.click(mx, my);
      const a = await E(() => ({gaps:(__ed.level.slide.gaps || []).length, sel:__ed.sel.kind, insp:document.getElementById('insp').textContent, warn:__ed.check.warnings.length}));
      chk(a.gaps === 1 && a.sel === 'gap' && /Gap 1/.test(a.insp) && !a.warn, 'the cut tool (G) cuts the slide where it is clicked and selects the new gap', JSON.stringify(a).slice(0, 120));
      await ed.locator('#insp button[data-a="len+"]').click(); await ed.locator('#insp button[data-a="updown"]').click();
      const b = await E(() => __ed.level.slide.gaps[0]);
      chk(Math.abs(b.len - 1.2) < 1e-9 && b.ramp === 'updown', 'the inspector sets the gap\'s length and its ends (take-off and landing ramps)', JSON.stringify(b));
      const p0 = await slideAt(b.at), p1 = await slideAt(b.at + 0.6), [x0, y0] = await toScreen(...p0), [x1, y1] = await toScreen(...p1);
      await E(() => __ed.setTool('select')); await ed.mouse.move(x0, y0); await ed.mouse.down(); await ed.mouse.move(x1, y1, {steps:6}); await ed.mouse.up();
      const c = await E(() => __ed.level.slide.gaps[0].at);
      chk(Math.abs(c - b.at - 0.6) < 0.15, 'dragging a gap slides it along the slide', `${b.at} -> ${c}`);
      const g0 = await slideAt(c); await E(() => { __ed.sel = {kind:'point', i:9}; }); await key('ArrowDown');
      const g1 = await E(() => { const o = {}; window.MRCore.pathAt(__ed.layout.SLIDE, __ed.level.slide.gaps[0].at, o, 0); return [o.x, o.z]; });
      chk(Math.hypot(g1[0] - g0[0], g1[1] - g0[1]) < 0.1, 'a slide edit keeps the gap where it is on the table', Math.hypot(g1[0] - g0[0], g1[1] - g0[1]).toFixed(3));
      await E(() => { __ed.sel = {kind:'gap', i:0}; }); await key('Delete');
      chk(await E(() => !(__ed.level.slide.gaps || []).length), 'Delete removes the selected gap'); }

    console.log('toy pieces');
    await reset(); await E(() => __ed.edit(n => { n.trays.splice(3, 1); n.trays.splice(1, 1); }));          // (room on the slide for a toy piece)
    { await E(() => __ed.setTool('toy')); await ed.click('#toyKinds [data-toyk="bells"]');
      const s = await freeS('toy', 'bells'), [mx, my] = await toScreen(...await slideAt(s)); await ed.mouse.click(mx, my);
      const a = await E(() => ({toys:__ed.level.slide.toys || [], sel:__ed.sel.kind, insp:document.getElementById('insp').textContent, warn:__ed.check.warnings.map(w => w.kind)}));
      chk(a.toys.length === 1 && a.toys[0].kind === 'bells' && Math.abs(a.toys[0].len - 1.6) < 1e-9 && a.sel === 'toy' && /Bells/.test(a.insp) && !a.warn.length,
        'the toy tool (Y) puts the chosen piece (bells) on the slide where it is clicked and selects it', JSON.stringify(a).slice(0, 160));
      await ed.locator('#insp button[data-a="xylophone"]').click(); await ed.locator('#insp button[data-a="len+"]').click();
      const t = await E(() => __ed.level.slide.toys[0]);
      chk(t.kind === 'xylophone' && Math.abs(t.len - 2.6) < 1e-9, 'the inspector changes the piece (its default length) and sets its length', JSON.stringify(t));
      const p0 = await slideAt(t.at), p1 = await slideAt(t.at - 0.5), [x0, y0] = await toScreen(...p0), [x1, y1] = await toScreen(...p1);
      await E(() => __ed.setTool('select')); await ed.mouse.move(x0, y0); await ed.mouse.down(); await ed.mouse.move(x1, y1, {steps:6}); await ed.mouse.up();
      const at1 = await E(() => __ed.level.slide.toys[0].at);
      chk(Math.abs(at1 - t.at + 0.5) < 0.15 && await E(() => __ed.sel.kind === 'toy'), 'dragging a toy piece slides it along the slide', `${t.at} -> ${at1}`);
      await E(() => __ed.run());
      chk(await until(() => frame.evaluate(() => __mr.N.slide.toys && __mr.N.slide.toys[0].kind === 'xylophone' && __mr.toys.length >= 1), 30000), 'the preview builds the toy piece');
      const sp = await E(() => { const sp = __ed.layout.SLIDE.spirals[0]; return (sp.s0 + sp.s1)/2; });
      await E(s => __ed.addToyAt(s, 'loop'), sp);
      chk(await E(() => __ed.check.warnings.some(w => w.kind === 'toy-spiral' && w.toy != null)), 'a toy piece on a spiral is flagged by the checker');
      await key('Delete');
      chk(await E(() => (__ed.level.slide.toys || []).length === 1), 'Delete removes the selected toy piece');
      await E(() => { __ed.sel = {kind:'toy', i:0}; }); await key('Control+d');
      chk(await E(() => (__ed.level.slide.toys || []).length === 2 && __ed.sel.kind === 'toy' && __ed.sel.i === 1), 'Ctrl+D duplicates a toy piece a little further along the slide'); }

    console.log('box lanes: lanes, Add box, drag between lanes, connect across lanes, copy / paste');
    await reset(); await E(() => __ed.setLanes(3));
    await ed.click('#qLanePlus'); await ed.click('#qLanePlus');
    chk(await E(() => __ed.level.lanes.length === 5 && __ed.level.laneCount === 5 && document.getElementById('qLanePlus').disabled), '+ adds lanes up to 5 (then the button is disabled)');
    chk(await E(() => document.querySelectorAll('#queueSvg .qadd').length === 2 && /No boxes/.test(document.getElementById('queueSvg').textContent)), 'empty lanes say "No boxes yet" with their own + Add');
    await ed.click('#queueSvg .qadd[data-lane="3"]');
    chk(await E(() => document.getElementById('boxPop').classList.contains('show') && document.querySelector('#bpLanes .on').dataset.l === '3'), 'an empty lane\'s + Add opens the Add box form for that lane');
    await ed.click('#bpColors [data-c="purple"]'); await ed.click('#bpSizes [data-size="8"]'); await ed.click('#bpAdd');
    await ed.click('#bpLanes [data-l="4"]'); await ed.click('#bpColors [data-c="cyan"]'); await ed.click('#bpSizes [data-size="12"]'); await ed.click('#bpHidden'); await ed.click('#bpAdd'); await ed.click('#bpClose');
    chk(await E(() => JSON.stringify(__ed.level.lanes[3]) === '[{"color":"purple","size":8}]' && JSON.stringify(__ed.level.lanes[4]) === '[{"color":"cyan","size":12,"hidden":true}]'),
      'Add box: lane, colour, holes (4/6/8/12) and hidden', await E(() => JSON.stringify(__ed.level.lanes.slice(3))));
    { const a = await ed.locator('#queueSvg .qbox[data-key="2:0"]').boundingBox(), b = await ed.locator('#queueSvg .qbox[data-key="3:0"]').boundingBox();
      const n2 = await E(() => __ed.level.lanes[2].length), c = await E(() => JSON.stringify(__ed.level.lanes[2][0]));
      await ed.mouse.move(a.x + a.width/2, a.y + a.height/2); await ed.mouse.down(); await ed.mouse.move(b.x + b.width/2, b.y + b.height + 6, {steps:8}); await ed.mouse.up();
      chk(await E(() => __ed.level.lanes[2].length) === n2 - 1 && await E(() => JSON.stringify(__ed.level.lanes[3][1])) === c, 'dragging a box from lane 3 drops it into lane 4', c); }
    await ed.click('#queueSvg .qbox[data-key="3:1"]'); await ed.click('#queueSvg .qbox[data-key="4:0"]', {modifiers:['Shift']}); await key('l');
    chk(await E(() => { const a = __ed.level.lanes[3][1], b = __ed.level.lanes[4][0]; return a.link != null && a.link === b.link; }) && await E(() => !!document.querySelector('#queueSvg rect[fill="url(#bellow)"]')),
      'boxes in lanes 4 and 5 connect across the lanes (bellows drawn)');
    await ed.click('#queueSvg .qbox[data-key="0:0"]'); await ed.click('#queueSvg .qbox[data-key="2:3"]', {modifiers:['Shift']});
    chk(await E(() => !__ed.linkSelected() && __ed.level.lanes[0][0].link == null), 'boxes that do not touch cannot be connected');
    await ed.dblclick('#queueSvg .qbox[data-key="1:1"]');
    chk(await E(() => __ed.level.lanes[1][1].hidden === true && /\?/.test(document.querySelector('#queueSvg .qbox[data-key="1:1"]').textContent)), 'double-clicking a box makes it a hidden "?" box');
    await ed.click('#queueSvg .qbox[data-key="0:0"]');
    const nb0 = await E(() => __ed.level.lanes[0].length);
    await key('Control+c'); await key('Control+v');
    chk(await E(() => __ed.level.lanes[0].length) === nb0 + 1 && await E(() => JSON.stringify(__ed.level.lanes[0][1]) === JSON.stringify(__ed.level.lanes[0][0]) && __ed.sel.list[0].join() === '0,1'),
      'Ctrl+C, Ctrl+V on a box inserts a copy right after it');
    await key('Control+x');
    chk(await E(() => __ed.level.lanes[0].length) === nb0, 'Ctrl+X cuts it again');
    { const o0 = await E(() => __ed.level.lanes[0].map(b => b.color + b.size).join(','));
      const c0 = await ed.locator('#queueSvg .qbox[data-key="0:0"]').boundingBox(), c2 = await ed.locator('#queueSvg .qbox[data-key="0:2"]').boundingBox();
      await ed.mouse.move(c0.x + c0.width/2, c0.y + c0.height/2); await ed.mouse.down(); await ed.mouse.move(c2.x + c2.width/2, c2.y + c2.height + 2, {steps:8}); await ed.mouse.up();
      const o1 = (await E(() => __ed.level.lanes[0].map(b => b.color + b.size).join(','))).split(','), a0 = o0.split(',');
      chk(o1[2] === a0[0] && o1[0] === a0[1] && o1[1] === a0[2], 'dragging the front box below the third one reorders the lane', o1.slice(0, 3).join(' ')); }
    await ed.click('#queueSvg .qbox[data-key="0:0"]'); await key('ArrowRight');
    chk(await E(() => __ed.sel.list[0].join()) === '1,0', 'arrow right moves the selected box to the next lane');
    await ed.click('#queueSvg .qbox[data-key="1:0"]', {button:'right'});
    chk(await E(() => document.getElementById('ctx').classList.contains('show') && /Move to lane 5/.test(document.getElementById('ctx').textContent)), 'right-clicking a box opens its menu (move to any lane, connect, hidden...)');
    await ed.locator('#ctx button', {hasText:'Move to lane 5'}).click();
    chk(await E(() => __ed.level.lanes[4].length) === 2, 'the menu moves it to lane 5');
    await E(() => { __ed.focusPane = 'queue'; }); await key('Control+a');
    chk(await E(() => __ed.sel.kind === 'box' && __ed.sel.list.length === __ed.level.lanes.flat().length), 'Ctrl+A in the lanes selects every box');
    await ed.click('#qLaneMinus');
    chk(await E(() => __ed.level.lanes.length === 4 && __ed.level.lanes[3].length >= 3), '− removes the last lane; its boxes move to the lane before');
    await E(() => __ed.setLanes(2));
    chk(await E(() => __ed.level.lanes.length === 2 && document.getElementById('qLaneMinus').disabled), 'at least 2 lanes');

    console.log('level card, inline warnings, unsaved dot, drafts, ids, empty states');
    await reset();
    await E(() => { __ed.edit(n => { n.trays[0].at = n.trays[3].at; n.trays[0].side = n.trays[3].side; delete n.trays[0].shape; delete n.trays[0].tilt; }); __ed.sel = {kind:'tray', tray:0}; });
    chk(await E(() => [...document.querySelectorAll('#insp .iwarn')].some(d => /overlaps tray 4/.test(d.textContent))), 'a selected tray with a problem shows the warning right in its card',
      await E(() => __ed.check.warnings.map(w => w.kind + ':' + w.tray).join(',')));
    await key('Control+z'); await E(() => { __ed.sel = {kind:'level'}; });
    await ed.selectOption('#lvRole', 'Challenge'); await ed.click('#dPlus'); await ed.click('#dPlus');
    chk(await E(() => __ed.level.meta && __ed.level.meta.role === 'Challenge' && __ed.level.meta.diff === 6), 'the level card sets the role and the target difficulty', await E(() => JSON.stringify(__ed.level.meta)));
    { await ed.click('#msPlus'); const k1 = await E(() => __ed.level.marbleScale), auto = await E(() => window.MRCore.autoMarbleScale(JSON.parse(JSON.stringify(__ed.level))));
      await ed.click('#msAuto'); const k2 = await E(() => __ed.level.marbleScale || 1);
      chk(k1 === 1.05 && k2 === auto, 'the level card sets the marble size (− / +) and Auto picks the largest the level has room for', `${k1}, auto ${k2}`); }
    await ed.fill('#levelId', 'lvl_900'); await E(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    await key('Control+s');
    chk(await E(() => !__ed.dirty && !document.getElementById('dirtyDot').classList.contains('on') && !document.title.startsWith('●') && !!JSON.parse(localStorage.getItem('marble-run:level-slots')).lvl_900),
      'Ctrl+S saves (in the editor\'s own slots): no unsaved dot');
    await E(() => __ed.edit(n => { n.name = 'Dirty now'; }));
    chk(await E(() => __ed.dirty && document.getElementById('dirtyDot').classList.contains('on') && document.title.startsWith('●')), 'an edit shows the unsaved dot (and ● in the tab title)');
    chk(await E(() => JSON.parse(localStorage.getItem('marble-run:editor-draft')).name === 'Dirty now'), 'every edit is kept as a draft');
    await ed.fill('#levelId', 'lvl_901'); await E(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    chk(await E(() => __ed.level.id === 'lvl_901' && !!JSON.parse(localStorage.getItem('marble-run:level-slots')).lvl_901 && !JSON.parse(localStorage.getItem('marble-run:level-slots')).lvl_900),
      'editing the id field renames the saved level');
    await ed.fill('#levelId', 'demo_dispenser'); await E(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    await ed.fill('#levelId', 'bad id!'); await E(() => document.getElementById('levelId').dispatchEvent(new Event('change')));
    chk(await E(() => __ed.level.id === 'lvl_901' && document.getElementById('levelId').value === 'lvl_901'), 'an id already in use, or with bad characters, is refused');
    await ed.mouse.click(box.x + 8, box.y + box.height - 60);
    dialogAnswer = 'saved_as_copy'; await key('Control+Shift+s');
    chk(await E(() => __ed.level.id === 'saved_as_copy' && !!JSON.parse(localStorage.getItem('marble-run:level-slots')).saved_as_copy), 'Ctrl+Shift+S saves as a new level id');
    { const dl = ed.waitForEvent('download', {timeout:10000}); await key('Control+e'); const d = await dl; const o = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
      chk(/saved_as_copy\.json$/.test(d.suggestedFilename()) && o.id === 'saved_as_copy' && o.format === 1 && o.type === 'marble-run-level', 'Ctrl+E exports the level JSON (with its id)', d.suggestedFilename()); }
    await key('Control+o');
    chk(await E(() => document.getElementById('levelsModal').classList.contains('show') && __ed.lvSelId === 'saved_as_copy'), 'Ctrl+O opens the levels list on the current level');
    chk(await E(() => { const ids = [...document.querySelectorAll('#levelList .lrow code')].map(c => c.textContent); return ['lvl_901', 'saved_as_copy', 'demo_combo', 'demo_dispenser', 'demo_hidden_box'].every(i => ids.includes(i)); }),
      'the Levels panel lists the saved levels by id (the bundled demos seeded)');
    await key('Control+d');
    chk(await E(() => !!JSON.parse(localStorage.getItem('marble-run:level-slots')).saved_as_copy_copy && __ed.lvSelId === 'saved_as_copy_copy'), 'Ctrl+D in the levels list duplicates the highlighted level');
    await key('ArrowUp'); const up = await E(() => __ed.lvSelId); await key('Escape');
    chk(up !== 'saved_as_copy_copy' && await E(() => !document.querySelector('.modal.show')), 'arrows move through the list; Esc closes it', up);
    await key('Control+n');
    chk(await E(() => /^lvl_\d{3}$/.test(__ed.level.id) && !__ed.level.trays.length && document.getElementById('emptyView').classList.contains('show') && /No trays yet/.test(document.getElementById('emptyView').textContent)),
      'Ctrl+N starts a new level; with no trays the view says so, with an Add tray button');
    chk(await E(() => __ed.level.slide.points.filter(p => p.spiral).length === 1), 'a new level starts with one spiral on its slide');
    chk(await E(() => /No boxes yet – Add box/.test(document.getElementById('queueSvg').textContent)), 'empty lanes say "No boxes yet – Add box"');
    await ed.click('#evAddTray');
    chk(await E(() => __ed.level.trays.length === 1 && !__ed.check.warnings.some(w => w.tray === 0) && !document.getElementById('emptyView').classList.contains('show')), 'Add tray puts a tray on a free stretch of slide', await E(() => JSON.stringify(__ed.check.warnings.map(w => w.kind))));

    console.log('level order');
    await E(() => { localStorage.setItem('marble-run:level-order', '[]'); __ed.openLevels(); });
    for (const id of ['demo_dispenser', 'lvl_901', 'nope', 'demo_dispenser']){ await ed.fill('#orderAdd', id); await ed.press('#orderAdd', 'Enter'); }
    { const st = await E(() => ({ids:__ed.orderState().ids, warns:[...document.querySelectorAll('#orderWarn .owarn')].map(d => d.textContent), bad:[...document.querySelectorAll('#orderList .orow.bad')].map(r => +r.dataset.i)}));
      chk(st.ids.join(',') === 'demo_dispenser,lvl_901,nope,demo_dispenser' && st.warns.some(w => /nope.*not a saved level/.test(w)) && st.warns.some(w => /demo_dispenser.*twice/.test(w)) && st.bad.join() === '2,3',
        'the level order panel adds ids and warns about unknown and duplicate ones', JSON.stringify(st)); }
    chk(await E(async () => (await __ed.exportHtml('order')) === null), 'a level order with warnings cannot be exported');
    await ed.locator('#orderList .orow[data-i="3"] button').click(); await ed.locator('#orderList .orow[data-i="2"] button').click();
    await E(() => __ed.orderAdd('demo_hidden_box'));
    await ed.dragAndDrop('#orderList .orow[data-i="2"]', '#orderList .orow[data-i="0"]');
    chk(await E(() => __ed.orderState().ids.join(',') === 'demo_hidden_box,demo_dispenser,lvl_901' && !__ed.orderState().warns.length), 'removing and dragging rows reorders the level order', await E(() => __ed.orderState().ids.join(',')));
    { const [dl] = await Promise.all([ed.waitForEvent('download', {timeout:10000}).catch(() => null), ed.click('#orderExport')]);
      const o = dl ? JSON.parse(fs.readFileSync(await dl.path(), 'utf8')) : null;
      chk(dl && dl.suggestedFilename() === 'level-order.json' && o.type === 'marble-run-level-order' && o.levels.join(',') === 'demo_hidden_box,demo_dispenser,lvl_901', 'Export order JSON downloads the ids in order', dl && dl.suggestedFilename());
      await E(() => __ed.importOrder(JSON.stringify({type:'marble-run-level-order', version:1, levels:['demo_count_crate', 'demo_hidden_box']})));
      chk(await E(() => __ed.orderState().ids.join(',') === 'demo_count_crate,demo_hidden_box'), 'Import order JSON replaces the order');
      await E(o => __ed.importOrder(JSON.stringify(o)), o); }
    await E(() => __ed.closeModals());

    console.log('exports: playable HTML of a level and of the level order (frozen, offline)');
    // the pack's third level is lvl_901, reset to a clean copy of a demo so the bot can win it
    await E(() => { __ed.openLevel('lvl_901'); __ed.setLevel(Object.assign(JSON.parse(JSON.stringify(window.MRCore.PRESETS.demo_count_crate)), {id:'lvl_901', name:'Pack level 3'})); __ed.saveLevel(false); });
    const htmlOne = await E(() => __ed.exportHtml('level'));
    chk(htmlOne && /window\.MR_SHARE = /.test(htmlOne) && htmlOne.includes('"id":"lvl_901"') && /"three":"data:text\/javascript;base64,/.test(htmlOne) && !/<script src="[^"]*"><\/script>/.test(htmlOne) && !/cdn\.jsdelivr/.test(htmlOne),
      'Playable HTML (one level): one self-contained file with the level frozen inside', htmlOne && (htmlOne.length/1024).toFixed(0) + ' KB');
    const htmlAll = await E(() => __ed.exportHtml('order'));
    const tmp = path.join(require('os').tmpdir(), 'mr-pack-' + process.pid + '.html'); fs.writeFileSync(tmp, htmlAll || '');
    await E(() => { __ed.edit(n => { n.name = 'Edited after export'; }); __ed.saveLevel(false); });
    { const pctx = await browser.newContext({viewport:{width:390, height:844}}), pp = await pctx.newPage(); watch(pp); const net = [];
      pp.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
      await pp.goto(require('url').pathToFileURL(tmp).href); await pp.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
      const st0 = await pp.evaluate(() => ({src:__mr.levelSource, name:__mr.N.name, n:__mr.pack.length, step:document.getElementById('levelStep').textContent}));
      chk(st0.src === 'pack' && st0.name === C.PRESETS.demo_hidden_box.name && st0.n === 3 && st0.step === 'Level 1 / 3', 'the exported pack opens from file:// with level 1 of 3 of the order', JSON.stringify(st0));
      const names = [];
      for (let k = 0; k < 3; k++){
        await pp.evaluate(() => { __mr.setBot(true); for (let i = 0; i < 80 && !__mr.game.result; i++) __mr.advance(5); __mr.setBot(false); __mr.advance(3); __mr.render(); });
        const w = await pp.evaluate(() => ({res:__mr.game.result, name:__mr.N.name, win:document.getElementById('winPanel').classList.contains('show'), next:document.getElementById('btnNext').textContent}));
        names.push(w.name + ':' + w.res + ':' + w.next);
        if (!w.win) break;
        await pp.click('#btnNext', {timeout:90000});
      }
      chk(names.join(' | ') === `${C.PRESETS.demo_hidden_box.name}:win:Next level | ${C.PRESETS.demo_dispenser.name}:win:Next level | Pack level 3:win:Finish`, 'winning offers the next level, in order; the last one offers Finish', names.join(' | '));
      chk(await pp.evaluate(() => document.getElementById('donePanel').classList.contains('show') && /All levels complete/.test(document.getElementById('donePanel').textContent)), 'after the last level: the "All levels complete" screen');
      await pp.reload(); await pp.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
      await pp.evaluate(() => __mr.goPack(2));
      chk(await pp.evaluate(() => __mr.N.name === 'Pack level 3') && !net.length, 'the export is a frozen snapshot (later editor edits do not reach it) and loads nothing from the network', net.slice(0, 2).join(' '));
      await pctx.close(); fs.unlinkSync(tmp); }
    { const g = await ctx.newPage(); watch(g);
      await g.goto(base + '/index.html?nosim'); await g.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
      chk(await g.evaluate(() => __mr.levelSource === 'builtin' && __mr.N.name === 'Marble Run' && !__mr.embed), 'with saved levels and a level order in storage, the game page still opens its built-in level');
      await g.close(); }

    console.log('preview: run, auto-run, undo buttons, camera, zoom, bots');
    await reset();
    await ed.fill('#levelName', 'Run Test'); await E(() => document.getElementById('levelName').dispatchEvent(new Event('change')));
    await frame.evaluate(() => { __mr.tap(0); __mr.advance(3); });
    const s0 = await frame.evaluate(() => __mr.serial);
    await ed.click('#runBtn');
    chk(await until(() => frame.evaluate(s => __mr.serial > s && __mr.N.name === 'Run Test' && __mr.game.t < 1 && __mr.game.sends === 0, s0)), 'RUN restarts the preview fresh with the edited level');
    await ed.click('#autoBtn'); await sleep(1500);                 // switching auto-run on runs the preview once
    const s1 = await frame.evaluate(() => __mr.serial), tEdit = Date.now();
    await E(() => __ed.edit(n => { n.name = 'Auto 1'; })); await sleep(250);
    const early = await frame.evaluate(s => __mr.serial > s, s1);
    const got = await until(() => frame.evaluate(() => __mr.N.name === 'Auto 1'), 15000, 50), dt = Date.now() - tEdit;
    chk(!early && got && dt >= 450, 'with auto-run on, an edit restarts the preview after the 500 ms delay', dt + ' ms');
    await ed.click('#autoBtn');
    { const nm = await E(() => __ed.level.name); await E(() => __ed.edit(n => { n.name = 'Undo me'; }));
      await ed.click('#undoBtn'); const a = await E(() => __ed.level.name); await ed.click('#redoBtn'); const b = await E(() => __ed.level.name);
      chk(a === nm && b === 'Undo me', 'the toolbar buttons undo and redo an edit', `${a} / ${b}`); }
    await ed.click('#camSeg [data-v="ortho"]');
    chk(await until(() => frame.evaluate(() => __mr.prefs.view === 'ortho' && __mr.camera.isOrthographicCamera)), 'the preview\'s camera switch: Orthographic');
    await ed.locator('#edZoom').fill('110'); await E(() => document.getElementById('edZoom').dispatchEvent(new Event('input')));
    chk(await until(() => frame.evaluate(() => Math.abs(__mr.prefs.zoom - 1.1) < 1e-9)) && await E(() => document.getElementById('edZoomVal').textContent === '110%'), 'the camera zoom under it: the preview follows');
    await ed.click('#edZoomReset'); await ed.click('#camSeg [data-v="persp"]');
    chk(await until(() => frame.evaluate(() => __mr.prefs.view === 'persp' && Math.abs(__mr.prefs.zoom - 1) < 1e-9)), 'Reset and Perspective put it back');
    await reset();
    await ed.click('#testBtn');
    const t = await until(() => E(() => __ed.lastTest && !__ed.lastTest.pending && __ed.lastTest), 180000, 300), want = C.testLevel(C.LEVEL_DATA, 200);
    chk(t && t.greedy.result === 'win' && t.greedy.sends === want.greedy.sends && t.wins === want.wins && t.label === want.label,
      'Test runs greedy + 200 random bots in the background worker: the same results as the core run headless', t && `${t.greedy.result} ${t.greedy.sends} sends, ${t.wins}/200 ${t.label} (headless ${want.wins}/200)`);
    chk(await E(l => new RegExp(l).test(document.getElementById('testOut').textContent), want.label), 'the difficulty label is shown in the checks panel');
    await ed.click('#watchBtn');
    chk(await until(() => frame.evaluate(() => document.getElementById('botTag').style.display === 'block' && __mr.game.sends > 0), 30000), '"Watch" plays the greedy bot in the preview');

    console.log('view: pan, zoom, fit, context menu, clipboard');
    await E(() => __ed.fitView());
    const o0 = await E(() => __ed.W2S(0, 0));
    await ed.mouse.move(box.x + 100, box.y + 300); await ed.keyboard.down(' '); await ed.mouse.down(); await ed.mouse.move(box.x + 160, box.y + 340, {steps:5}); await ed.mouse.up(); await ed.keyboard.up(' ');
    const o1 = await E(() => __ed.W2S(0, 0));
    chk(Math.abs(o1[0] - o0[0] - 60) < 2 && Math.abs(o1[1] - o0[1] - 40) < 2, 'Space + drag pans the view', `${o0.map(Math.round)} -> ${o1.map(Math.round)}`);
    await ed.mouse.move(box.x + 200, box.y + 300); await ed.mouse.wheel(0, -400);
    const zs1 = await E(() => __ed.W2S(1, 0)[0] - __ed.W2S(0, 0)[0]), zs0 = await E(() => (__ed.fitView(), __ed.W2S(1, 0)[0] - __ed.W2S(0, 0)[0]));
    chk(zs1 > zs0*1.3, 'the wheel zooms', `${zs0.toFixed(1)} -> ${zs1.toFixed(1)}`);
    await ed.mouse.wheel(0, 300); await ed.mouse.click(box.x + 8, box.y + box.height - 60); await key('f');
    chk(Math.abs(await E(() => __ed.W2S(1, 0)[0] - __ed.W2S(0, 0)[0]) - zs0) < 0.01, 'F fits the view again');
    await ed.mouse.click(box.x + 8, box.y + box.height - 60, {button:'right'});
    chk(await E(() => document.getElementById('ctx').classList.contains('show') && /Add a tray here/.test(document.getElementById('ctx').textContent) && /Ctrl\+A|⌘A/.test(document.getElementById('ctx').textContent)),
      'right-clicking the table opens a menu with the same actions and their shortcuts');
    await key('Escape');
    chk(await E(() => !document.getElementById('ctx').classList.contains('show')), 'Esc closes the menu');
    await key('Control+Enter');
    chk(await E(() => /running/.test(document.getElementById('status').textContent)) || await until(() => frame.evaluate(() => __mr.game.sends === 0)), 'Ctrl+Enter runs the preview');
    await E(() => { const lv = JSON.parse(JSON.stringify(window.MRCore.LEVEL_DATA)); lv.id = 'from_clipboard'; const dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify(lv));
      __ed.CLIP = null; document.dispatchEvent(new ClipboardEvent('paste', {clipboardData:dt, bubbles:true})); });
    chk(await E(() => !!JSON.parse(localStorage.getItem('marble-run:level-slots')).from_clipboard_copy), 'Ctrl+V with a level JSON on the clipboard adds it to the saved levels');
    await key('Escape');
    // a level with every kind of thing on it, for the screenshot
    await E(() => { __ed.openLevel('demo_combo'); __ed.closeModals(); __ed.fitView(); __ed.sel = {kind:'tray', tray:0}; });
    await sleep(1500);
    fs.mkdirSync(path.join(ROOT, 'screenshots'), {recursive:true});
    await ed.screenshot({path:path.join(ROOT, 'screenshots', 'editor.png')});
  } catch (e) { console.error(e); fail++; }
  chk(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
