// Editor tests (Playwright, Chromium): keyboard shortcuts (Ctrl on Windows / Linux, Cmd on a Mac - both are
// accepted), selection (click, Shift/Ctrl-click, box, select all), copy / cut / paste / duplicate / delete / nudge for
// road points, ramps, blockers, stickman cells, buses and whole levels, the right-click menu, queue lanes (2-5), the
// "Add bus" form, buses dragged between lanes and connected across lanes, the exit tunnel placed anywhere on the top
// edge, the level's role and target difficulty, unsaved-changes dot, drafts, inline warnings and empty states.
//   node tests/editor.test.js          (env: CHROMIUM, THREE_MODULE as for tests/browser.test.js)
const fs = require('fs'), http = require('http'), path = require('path');
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP: playwright is not installed (npm i playwright)'); process.exit(0); }
const ROOT = path.join(__dirname, '..');
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json'};
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e){ r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': TYPES[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise(r => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, headless: !process.env.HEADFUL,
    args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await browser.newContext({viewport:{width:1600, height:950}, acceptDownloads:true});
  if (process.env.THREE_MODULE){ const src = fs.readFileSync(process.env.THREE_MODULE);
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({status:200, contentType:'application/javascript', body:src})); }
  const errors = [];
  try {
    const ed = await ctx.newPage(); ed.on('pageerror', e => errors.push(e.message));
    let dialogAnswer = null; ed.on('dialog', d => d.type() === 'prompt' ? d.accept(dialogAnswer || '') : d.accept());
    await ed.goto(base + '/editor.html'); await ed.waitForFunction(() => window.__ed && __ed.level, null, {timeout:60000});
    const E = (fn, a) => ed.evaluate(fn, a), key = k => ed.keyboard.press(k);
    const box = await ed.locator('#view').boundingBox();
    const toScreen = async (x, z) => { const [sx, sy] = await ed.evaluate(([x, z]) => __ed.W2S(x, z), [x, z]); return [box.x + sx, box.y + sy]; };
    await ed.mouse.click(box.x + 20, box.y + box.height - 20);           // focus the view (empty grass)

    console.log('tools and colours');
    await key('2'); const t2 = await E(() => __ed.tool); await key('4'); const t4 = await E(() => __ed.tool); await key('9'); const t9 = await E(() => __ed.tool); await key('1');
    chk(t2 === 'road' && t4 === 'paint' && t9 === 'count' && await E(() => __ed.tool) === 'select', 'number keys switch tools (2 road, 4 paint, 9 count box, 1 select)', [t2, t4, t9].join(' '));
    await key('Shift+Digit3');
    chk(await E(() => __ed.color) === 'yellow', 'Shift+3 picks the third colour');
    chk(await E(() => [...document.querySelectorAll('#palette [data-tool]')].every(b => /\(\d or [A-Z]\)$/.test(b.title) && b.querySelector('kbd')))
      && await E(() => /Ctrl\+Z|⌘Z/.test(document.getElementById('undoBtn').title) && [...document.querySelectorAll('#fileMenu kbd')].length >= 4),
      'tooltips and menus name the shortcuts (Ctrl+... or ⌘ on a Mac)');
    await key('?');
    chk(await E(() => document.getElementById('helpModal').classList.contains('show') && /Ctrl\+Shift\+S|⌘⇧S/.test(document.getElementById('keysList').textContent)), '? shows the shortcut list');
    await key('Escape');

    console.log('ramps: select all, copy / paste, undo / redo, duplicate, delete');
    const nR = await E(() => __ed.level.ramps.length);
    await key('Control+a');
    chk(await E(() => __ed.sel.kind === 'ramp' && __ed.sel.list.length) === nR, 'Ctrl+A with the select tool selects every ramp', nR);
    await key('Control+c'); await key('Control+v');
    chk(await E(() => __ed.level.ramps.length) === 2*nR && await E(() => __ed.sel.list.length) === nR, 'Ctrl+C, Ctrl+V pastes copies of the ramps (and selects them)');
    await key('Control+z'); const u = await E(() => __ed.level.ramps.length);
    await key('Control+Shift+z'); const r1 = await E(() => __ed.level.ramps.length);
    await key('Control+z'); await key('Control+y'); const r2 = await E(() => __ed.level.ramps.length);
    chk(u === nR && r1 === 2*nR && r2 === 2*nR, 'Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo', `${u} ${r1} ${r2}`);
    await key('Delete');
    chk(await E(() => __ed.level.ramps.length) === nR, 'Delete removes the selected ramps');
    await E(() => { __ed.sel = {kind:'ramp', ramp:0}; }); await key('Control+d');
    chk(await E(() => __ed.level.ramps.length === __ed.level.ramps.length && __ed.sel.list && __ed.sel.list[0] === __ed.level.ramps.length - 1) && await E(() => __ed.level.ramps.length) === nR + 1, 'Ctrl+D duplicates the selected ramp');
    await key('Backspace');
    chk(await E(() => __ed.level.ramps.length) === nR, 'Backspace deletes too');
    await E(() => { __ed.sel = {kind:'ramp', ramp:0}; }); await key('Control+x');
    chk(await E(() => __ed.level.ramps.length) === nR - 1 && await E(() => __ed.CLIP && __ed.CLIP.kind === 'ramp'), 'Ctrl+X cuts a ramp');
    await key('Control+z');

    console.log('road points: multi-select, nudge, delete');
    await key('2'); await key('Control+a');
    const nP = await E(() => __ed.level.road.points.length);
    chk(await E(() => __ed.sel.kind === 'point' && __ed.sel.list.length) === nP - 1, 'Ctrl+A with the road tool selects every road point but the fixed first one');
    await E(() => { __ed.sel = {kind:'point', i:3}; });
    const p3 = await E(() => __ed.level.road.points[3].x);
    await key('ArrowRight'); const a1 = await E(() => __ed.level.road.points[3].x); await key('Shift+ArrowRight'); const a2 = await E(() => __ed.level.road.points[3].x);
    chk(Math.abs(a1 - p3 - 0.1) < 1e-6 && Math.abs(a2 - a1 - 0.5) < 1e-6, 'arrow keys nudge a point 0.1, with Shift 0.5', `${p3} ${a1} ${a2}`);
    { const pa = await E(() => __ed.level.road.points[3]), pb = await E(() => __ed.level.road.points[4]);
      const [x1, y1] = await toScreen(pa.x, pa.z), [x2, y2] = await toScreen(pb.x, pb.z);
      await ed.mouse.click(x1, y1); await ed.keyboard.down('Shift'); await ed.mouse.click(x2, y2); await ed.keyboard.up('Shift');
      chk(await E(() => __ed.sel.kind === 'point' && __ed.sel.list.join() === '3,4'), 'click + Shift-click selects two road points', await E(() => JSON.stringify(__ed.sel))); }
    await key('Delete');
    chk(await E(() => __ed.level.road.points.length) === nP - 2, 'Delete removes both');
    await key('Control+z'); await key('Control+z'); await key('Control+z');
    // box select: drag over empty space with the road tool
    { const pts = await E(() => __ed.level.road.points.slice(1, 4).map(p => [p.x, p.z]));
      const sc = await Promise.all(pts.map(p => toScreen(...p))), xs = sc.map(p => p[0]), ys = sc.map(p => p[1]);
      await ed.mouse.move(Math.min(...xs) - 18, Math.min(...ys) - 18); await ed.mouse.down();
      await ed.mouse.move(Math.max(...xs) + 18, Math.max(...ys) + 18, {steps:6}); await ed.mouse.up();
      chk(await E(() => __ed.sel.kind === 'point' && __ed.sel.list.length >= 3), 'dragging a box over empty space selects the road points inside', await E(() => JSON.stringify(__ed.sel))); }
    await key('Escape');
    chk(await E(() => __ed.sel.kind === 'level'), 'Esc deselects');

    console.log('stickman cells and blockers');
    await key('1');
    await E(() => { __ed.sel = {kind:'cells', ramp:0, cells:[[0, 0], [1, 0], [0, 1]]}; });
    const cellsSrc = await E(() => [[0, 0], [1, 0], [0, 1]].map(([c, k]) => __ed.level.ramps[0].columns[c][k]).join());
    await key('Control+c'); await E(() => { __ed.sel = {kind:'ramp', ramp:1}; __ed.edit(n => { n.ramps[1].columns[0][0] = n.ramps[1].columns[1][0] = n.ramps[1].columns[0][1] = null; }); }); await key('Control+v');
    chk(await E(() => [[0, 0], [1, 0], [0, 1]].map(([c, k]) => __ed.level.ramps[1].columns[c][k]).join()) === cellsSrc && await E(() => __ed.sel.kind === 'cells' && __ed.sel.ramp === 1),
      'copied stickman cells paste into another ramp', cellsSrc);
    await key('Delete');
    chk(await E(() => [[0, 0], [1, 0], [0, 1]].every(([c, k]) => __ed.level.ramps[1].columns[c][k] == null)), 'Delete empties the selected cells');
    await key('ArrowRight');
    await E(() => { __ed.edit(n => { n.ramps[0].tunnels = [{col:2, row:2, w:1, h:1, color:'red', count:3}]; n.ramps[0].columns[2][2] = null; }); __ed.sel = {kind:'tunnel', ramp:0, i:0}; });
    await key('ArrowRight');
    chk(await E(() => __ed.level.ramps[0].tunnels[0].col) === 3, 'arrow keys move a tunnel a column');
    await key('Control+d');
    chk(await E(() => __ed.level.ramps[0].tunnels.length === 2 && __ed.level.ramps[0].tunnels[1].col !== 3), 'Ctrl+D duplicates the tunnel into a free column');
    await key('7'); await key('Control+a');
    chk(await E(() => __ed.sel.kind === 'tunnel' && __ed.sel.list.length === 2), 'Ctrl+A with the tunnel tool selects every tunnel');
    await key('Delete');
    chk(await E(() => !(__ed.level.ramps[0].tunnels || []).length), 'Delete removes them');
    await key('1');

    console.log('queue: lanes, Add bus, drag between lanes, connect across lanes, copy / paste');
    await E(() => __ed.setLanes(3));
    await ed.click('#qLanePlus'); await ed.click('#qLanePlus');
    chk(await E(() => __ed.level.lanes.length === 5 && __ed.level.laneCount === 5 && document.getElementById('qLanePlus').disabled), '+ adds lanes up to 5 (then the button is disabled)');
    chk(await E(() => document.querySelectorAll('#queueSvg .qadd').length === 2 && /No buses/.test(document.getElementById('queueSvg').textContent)), 'empty lanes say "No buses yet" with their own + Add');
    await ed.click('#queueSvg .qadd[data-lane="3"]');
    chk(await E(() => document.getElementById('busPop').classList.contains('show') && document.querySelector('#bpLanes .on').dataset.l === '3'), 'an empty lane\'s + Add opens the Add bus form for that lane');
    await ed.click('#bpColors [data-c="purple"]'); await ed.click('#bpCaps [data-cap="6"]'); await ed.click('#bpAdd');
    await ed.click('#bpLanes [data-l="4"]'); await ed.click('#bpColors [data-c="cyan"]'); await ed.click('#bpCaps [data-cap="12"]'); await ed.click('#bpHidden'); await ed.click('#bpAdd'); await ed.click('#bpClose');
    chk(await E(() => JSON.stringify(__ed.level.lanes[3]) === '[{"color":"purple","cap":6}]' && JSON.stringify(__ed.level.lanes[4]) === '[{"color":"cyan","cap":12,"hidden":true}]'),
      'Add bus: lane, colour, seats (4/6/8/12) and hidden', await E(() => JSON.stringify(__ed.level.lanes.slice(3))));
    { const a = await ed.locator('#queueSvg .bus[data-key="2:0"]').boundingBox(), b = await ed.locator('#queueSvg .bus[data-key="3:0"]').boundingBox();
      const n2 = await E(() => __ed.level.lanes[2].length), c = await E(() => JSON.stringify(__ed.level.lanes[2][0]));
      await ed.mouse.move(a.x + a.width/2, a.y + a.height/2); await ed.mouse.down(); await ed.mouse.move(b.x + b.width/2, b.y + b.height + 6, {steps:8}); await ed.mouse.up();
      chk(await E(() => __ed.level.lanes[2].length) === n2 - 1 && await E(() => JSON.stringify(__ed.level.lanes[3][1])) === c, 'dragging a bus from lane 3 drops it into lane 4', c); }
    await ed.click('#queueSvg .bus[data-key="3:1"]'); await ed.click('#queueSvg .bus[data-key="4:0"]', {modifiers:['Shift']}); await key('l');
    chk(await E(() => { const a = __ed.level.lanes[3][1], b = __ed.level.lanes[4][0]; return a.link != null && a.link === b.link; }) && await E(() => !!document.querySelector('#queueSvg rect[fill="url(#bellow)"]')),
      'buses in lanes 4 and 5 connect across the lanes (bellows drawn)');
    await ed.click('#queueSvg .bus[data-key="0:0"]');
    const nb0 = await E(() => __ed.level.lanes[0].length);
    await key('Control+c'); await key('Control+v');
    chk(await E(() => __ed.level.lanes[0].length) === nb0 + 1 && await E(() => JSON.stringify(__ed.level.lanes[0][1]) === JSON.stringify(__ed.level.lanes[0][0]) && __ed.sel.list[0].join() === '0,1'),
      'Ctrl+C, Ctrl+V on a bus inserts a copy right after it');
    await key('Control+x');
    chk(await E(() => __ed.level.lanes[0].length) === nb0, 'Ctrl+X cuts it again');
    await ed.click('#queueSvg .bus[data-key="0:0"]'); await key('ArrowRight');
    chk(await E(() => __ed.sel.list[0].join()) === '1,0', 'arrow right moves the selected bus to the next lane');
    await ed.click('#queueSvg .bus[data-key="1:0"]', {button:'right'});
    chk(await E(() => document.getElementById('ctx').classList.contains('show') && /Move to lane 5/.test(document.getElementById('ctx').textContent)), 'right-clicking a bus opens its menu (move to any lane, connect, hidden...)');
    await ed.locator('#ctx button', {hasText:'Move to lane 5'}).click();
    chk(await E(() => __ed.level.lanes[4].length) === 2, 'the menu moves it to lane 5');
    await E(() => { __ed.focusPane = 'queue'; }); await key('Control+a');
    chk(await E(() => __ed.sel.kind === 'bus' && __ed.sel.list.length === __ed.level.lanes.flat().length), 'Ctrl+A in the queue selects every bus');
    await ed.click('#qLaneMinus');
    chk(await E(() => __ed.level.lanes.length === 4 && __ed.level.lanes[3].length >= 3), '− removes the last lane; its buses move to the lane before');
    await E(() => __ed.setLanes(2));
    chk(await E(() => __ed.level.lanes.length === 2 && document.getElementById('qLaneMinus').disabled), 'at least 2 lanes');
    await E(() => __ed.setLanes(3));

    console.log('exit tunnel');
    for (const w of ['left', 'centre', 'right']){
      await E(w => __ed.exitTo(w), w);
      const st = await E(() => ({x:__ed.level.road.points.slice(-1)[0].x, bad:__ed.check.warnings.some(x => x.kind === 'zone-exit'), sel:__ed.sel.kind, top:__ed.layout.exit.z}));
      chk(!st.bad && st.sel === 'exit' && (w === 'left' ? st.x < -3 : w === 'right' ? st.x > 3 : Math.abs(st.x) < 0.5), `the exit tunnel goes to the top ${w} of the target zone, inside it`, JSON.stringify(st)); }
    { const ex = await E(() => [__ed.layout.exit.x, __ed.layout.exit.z]); await E(() => __ed.fitView()); const [sx, sy] = await toScreen(...ex);
      await ed.mouse.move(sx, sy); await ed.mouse.down(); await ed.mouse.move(sx - 60, sy + 10, {steps:6}); await ed.mouse.up();
      chk(await E(() => __ed.sel.kind === 'exit') && await E(e => __ed.layout.exit.x < e - 1, ex[0]), 'the exit tunnel can be dragged', ex[0].toFixed(2) + ' -> ' + await E(() => __ed.layout.exit.x.toFixed(2)) + ' sel ' + await E(() => __ed.sel.kind)); }
    await ed.mouse.click(box.x + 20, box.y + box.height - 20);

    console.log('inline warnings, level card, unsaved dot, drafts, empty states');
    await E(() => { __ed.edit(n => { delete n.ramps[0].at; delete n.ramps[0].cp; n.ramps[0].front = [-9, 3]; }); __ed.sel = {kind:'ramp', ramp:0}; });
    chk(await E(() => /not connected to the road/.test(document.querySelector('#insp .iwarn') && document.querySelector('#insp .iwarn').textContent)), 'a selected ramp with a problem shows the warning right in its card');
    await key('Control+z');
    await E(() => { __ed.sel = {kind:'level'}; });
    await ed.selectOption('#lvRole', 'Challenge'); await ed.click('#dPlus'); await ed.click('#dPlus');
    chk(await E(() => __ed.level.meta && __ed.level.meta.role === 'Challenge' && __ed.level.meta.diff === 6), 'the level card sets the role and the target difficulty', await E(() => JSON.stringify(__ed.level.meta)));
    await key('Control+s');
    chk(await E(() => !__ed.dirty && !document.getElementById('dirtyDot').classList.contains('on') && !document.title.startsWith('●')), 'Ctrl+S saves: no unsaved dot');
    await E(() => __ed.edit(n => { n.name = 'Dirty now'; }));
    chk(await E(() => __ed.dirty && document.getElementById('dirtyDot').classList.contains('on') && document.title.startsWith('●')), 'an edit shows the unsaved dot (and ● in the tab title)');
    chk(await E(() => JSON.parse(localStorage.getItem('match-express:editor-draft')).name === 'Dirty now'), 'every edit is kept as a draft');
    dialogAnswer = 'saved_as_copy'; await key('Control+Shift+s');
    chk(await E(() => __ed.level.id === 'saved_as_copy' && !!JSON.parse(localStorage.getItem('match-express:level-slots')).saved_as_copy), 'Ctrl+Shift+S saves as a new level id');
    { const dl = ed.waitForEvent('download', {timeout:10000}); await key('Control+e'); const d = await dl;
      chk(/saved_as_copy\.json$/.test(d.suggestedFilename()), 'Ctrl+E exports the level JSON', d.suggestedFilename()); }
    await key('Control+o');
    chk(await E(() => document.getElementById('levelsModal').classList.contains('show') && __ed.lvSelId === 'saved_as_copy'), 'Ctrl+O opens the levels list on the current level');
    await key('Control+d');
    chk(await E(() => !!JSON.parse(localStorage.getItem('match-express:level-slots')).saved_as_copy_copy && __ed.lvSelId === 'saved_as_copy_copy'), 'Ctrl+D in the levels list duplicates the highlighted level');
    await key('ArrowUp'); const up = await E(() => __ed.lvSelId); await key('Escape');
    chk(up !== 'saved_as_copy_copy' && await E(() => !document.querySelector('.modal.show')), 'arrows move through the list; Esc closes it', up);
    await key('Control+n');
    chk(await E(() => /^lvl_\d{3}$/.test(__ed.level.id) && !__ed.level.ramps.length && document.getElementById('emptyView').classList.contains('show') && /No ramps yet/.test(document.getElementById('emptyView').textContent)),
      'Ctrl+N starts a new level; with no ramps the view says so, with an Add ramp button');
    chk(await E(() => /No buses yet – Add bus/.test(document.getElementById('queueSvg').textContent)), 'an empty queue says "No buses yet – Add bus"');
    await ed.click('#evAddRamp');
    chk(await E(() => __ed.level.ramps.length === 1 && !__ed.check.warnings.some(w => w.ramp === 0) && !document.getElementById('emptyView').classList.contains('show')), 'Add ramp puts a ramp on a free stretch of road', await E(() => JSON.stringify(__ed.check.warnings.map(w => w.kind))));

    console.log('view: pan, zoom, fit, context menu');
    await E(() => __ed.fitView());
    const o0 = await E(() => __ed.W2S(0, 0));
    await ed.mouse.move(box.x + 200, box.y + 300); await ed.keyboard.down(' '); await ed.mouse.down(); await ed.mouse.move(box.x + 260, box.y + 340, {steps:5}); await ed.mouse.up(); await ed.keyboard.up(' ');
    const o1 = await E(() => __ed.W2S(0, 0));
    chk(Math.abs(o1[0] - o0[0] - 60) < 2 && Math.abs(o1[1] - o0[1] - 40) < 2, 'Space + drag pans the view', `${o0.map(Math.round)} -> ${o1.map(Math.round)}`);
    await ed.mouse.move(box.x + 300, box.y + 300); await ed.mouse.wheel(0, -400);
    const s1 = await E(() => __ed.W2S(1, 0)[0] - __ed.W2S(0, 0)[0]), s0 = await E(() => (__ed.fitView(), __ed.W2S(1, 0)[0] - __ed.W2S(0, 0)[0]));
    chk(s1 > s0*1.3, 'the wheel zooms', `${s0.toFixed(1)} -> ${s1.toFixed(1)}`);
    await E(() => { __ed.edit(n => { n.name = 'x'; }); }); await ed.mouse.wheel(0, 300); await key('f');
    chk(Math.abs(await E(() => __ed.W2S(1, 0)[0] - __ed.W2S(0, 0)[0]) - s0) < 0.01, 'F fits the view again');
    await ed.mouse.click(box.x + 30, box.y + 30, {button:'right'});
    chk(await E(() => document.getElementById('ctx').classList.contains('show') && /Add a ramp here/.test(document.getElementById('ctx').textContent) && /Ctrl\+A|⌘A/.test(document.getElementById('ctx').textContent)),
      'right-clicking empty ground opens a menu with the same actions and their shortcuts');
    await key('Escape');
    chk(await E(() => !document.getElementById('ctx').classList.contains('show')), 'Esc closes the menu');
    { const s = await E(() => document.getElementById('status').textContent); await key('Control+Enter');
      chk(await E(() => /running/.test(document.getElementById('status').textContent)), 'Ctrl+Enter runs the preview', s); }
    // a level JSON on the system clipboard pastes as a new saved level
    await E(() => { const lv = JSON.parse(JSON.stringify(window.MECore.LEVEL_DATA)); lv.id = 'from_clipboard'; const dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify(lv));
      __ed.CLIP = null; document.dispatchEvent(new ClipboardEvent('paste', {clipboardData:dt, bubbles:true})); });
    chk(await E(() => !!JSON.parse(localStorage.getItem('match-express:level-slots')).from_clipboard_copy), 'Ctrl+V with a level JSON on the clipboard adds it to the saved levels');
    await key('Escape');
  } catch (e) { console.error(e); fail++; }
  chk(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
