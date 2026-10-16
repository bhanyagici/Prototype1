// The showcase: node tests/showcase.test.js
// The levels (levels/showcase/<category>/<id>.json): each in its category, balanced, free of warnings and won by the greedy
// bot; the Basics from Easy to Very Hard; the lane, tray-shape, jump and toy-piece levels have what their names say.
// Then the single file (tools/build-showcase.js -> dist/marble-run-showcase.html) opened from file:// at 390 x 844: the
// start menu (categories, groups, a card per level with its picture, name and tags), the settings panel from the menu and
// in play (theme, supports, box motion, camera, speed, sound, remembered after a reload), playing a card, previous / next
// inside its category, the pause menu and restart, the booster bar, the stats panel (a win records its time), back to
// the menu (the last card marked), the funnel's numbered tiles (when it is built), the editor inside the showcase and My
// Levels, with nothing fetched from the network.
//   node tests/showcase.test.js   (the browser part needs playwright; same CHROMIUM env as browser.test.js)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url'), {execFileSync} = require('child_process');
const C = require('./core.js')();
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'showcase');
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o));

console.log('showcase levels');
const order = JSON.parse(fs.readFileSync(path.join(DIR, 'showcase-order.json'), 'utf8'));
const ids = order.categories.flatMap(c => c.groups.flatMap(g => g.levels)), dirOf = {};
order.categories.forEach(c => c.groups.forEach(g => g.levels.forEach(id => { dirOf[id] = c.dir; })));
const levels = Object.fromEntries(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(DIR, dirOf[id], id + '.json'), 'utf8'))]));
const FPATH = path.join(ROOT, 'levels', 'funnel', 'funnel-order.json'), FUNNEL = fs.existsSync(FPATH) ? JSON.parse(fs.readFileSync(FPATH, 'utf8')).levels : [];
{ const cats = order.categories.map(c => c.name), lay = order.categories.find(c => c.name === 'Layouts');
  chk(cats.join() === 'Basics,Blockers,Layouts,Jumps,Toy pieces' && lay && lay.groups.map(g => g.name).join() === 'Slides,Tray shapes,Lane counts',
    'five categories (Basics, Blockers, Layouts with Slides, Tray shapes and Lane counts, Jumps, Toy pieces)', cats.join(', '));
  const want = {Basics:['Easy', 'Medium', 'Hard', 'Very Hard'], Blockers:['Hidden box', 'Connected pairs', 'Connected triples', 'Marble dispenser', 'Hidden marbles', 'Lock & key crate', 'Count crate', 'All combined'],
    Slides:['Spiral', 'S-curve', 'Hairpin', 'Zig-zag', 'Winding'], 'Tray shapes':['Tilted (default)', 'Square to the slide', 'Steep', 'Deep and narrow', 'Wide and shallow'],
    'Lane counts':['2 lanes', '3 lanes', '4 lanes', '5 lanes'], Jumps:['First jump', 'Take-off ramps', 'Two gaps', 'Long jump', 'Spiral and gap'],
    'Toy pieces':['Xylophone', 'Bells', 'Paddle wheel', 'Zig-zag stairs', 'Vortex', 'Loop-the-loop', 'Toy parade']};
  const got = {}; order.categories.forEach(c => c.groups.forEach(g => { got[g.name || c.name] = g.levels.map(id => levels[id].name); }));
  chk(Object.entries(want).every(([k, v]) => JSON.stringify(got[k]) === JSON.stringify(v)), `${ids.length} levels: every one asked for, in its place`, Object.values(got).map(v => v.length).join(' + '));
  chk(ids.every(id => fs.existsSync(path.join(DIR, dirOf[id], id + '.json')) && levels[id].id === id && levels[id].type === 'marble-run-level'), 'one file per level, levels/showcase/<category>/<id>.json, with its id');
}
{ const bad = [];
  for (const id of ids){ const lv = levels[id], ck = C.checkLevel(clone(lv)), g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    if (!ck.balanced || ck.warnings.length || g.result !== 'win') bad.push(`${id}: ${ck.balanced ? '' : 'unbalanced '}${ck.warnings.map(w => w.kind).join(',')} ${g.result}`); }
  chk(!bad.length, 'every showcase level is balanced, free of warnings and won by the greedy bot', bad.join('; ')); }
{ const B = ['basics-easy', 'basics-medium', 'basics-hard', 'basics-very-hard'].map(id => levels[id].meta);
  chk(B[0].difficulty === 'Easy' && B.every((m, i) => !i || m.random < B[i - 1].random) && B.every(m => C.difficulty(m.random) === m.difficulty),
    'the Basics go from Easy up, each harder than the one before (random-bot win rate, label stored with it)', B.map(m => `${m.difficulty} ${(m.random*100).toFixed(1)}%`).join(' / '));
  const lanes = ['lanes-2', 'lanes-3', 'lanes-4', 'lanes-5'].map(id => levels[id].lanes.length);
  chk(lanes.join() === '2,3,4,5', 'the lane-count levels have 2, 3, 4 and 5 box lanes', lanes.join(','));
  const toys = ['toy-xylophone', 'toy-bells', 'toy-wheel', 'toy-stairs', 'toy-vortex', 'toy-loop'].map(id => (levels[id].slide.toys || []).map(t => t.kind).join('+'));
  chk(toys.join() === 'xylophone,bells,wheel,stairs,vortex,loop' && (levels['toy-parade'].slide.toys || []).length === 3, 'each toy-piece level has its piece; the parade has three', toys.join(', '));
  const gaps = ['jump-first', 'jump-ramps', 'jump-double', 'jump-long', 'jump-spiral'].map(id => (levels[id].slide.gaps || []).map(g => g.ramp + ' ' + g.len).join('+'));
  chk(gaps[0] === 'flat 1' && /updown/.test(gaps[1]) && gaps[2].split('+').length === 2 && gaps[3] === 'updown 2.4' && levels['jump-spiral'].slide.points.some(p => p.spiral),
    'the jump levels: a first flat gap, take-off ramps, two gaps, a long jump, a spiral and a gap', gaps.join(' | '));
  const sq = levels['tray-square'].trays.every(r => r.shape && r.tilt == null), st = levels['tray-steep'].trays.every(r => r.tilt === 60 || r.shape);
  const deep = levels['tray-deep'].trays.every(r => r.columns.length === 2 && r.rows === 9), wide = levels['tray-wide'].trays.every(r => r.columns.length === 5 && r.rows === 3);
  chk(sq && st && deep && wide, 'the tray-shape levels: square to the slide, steep, deep and narrow (2 x 9), wide and shallow (5 x 3)'); }

(async () => {
  let chromium; try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP browser part: playwright is not installed'); return done(); }
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-showcase.js')], {stdio:'inherit'});
  const file = path.join(ROOT, 'dist', 'marble-run-showcase.html');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await browser.newContext({viewport:{width:390, height:844}, acceptDownloads:true}), p = await ctx.newPage(), errs = [], net = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  await p.goto(pathToFileURL(file).href); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:120000});
  const total = ids.length + FUNNEL.length;
  console.log('the start menu');
  const m = await p.evaluate(() => ({open:document.getElementById('menuPanel').classList.contains('show'),
    cats:[...document.querySelectorAll('#menuList .mcat')].map(e => e.textContent), grps:[...document.querySelectorAll('#menuList .mgrp')].map(e => e.textContent),
    tiles:[...document.querySelectorAll('#menuList .mcard .mnum')].map(n => ({id:n.parentNode.dataset.id, num:n.textContent, next:n.parentNode.classList.contains('nextup')})),
    cards:[...document.querySelectorAll('#menuList .mcard')].filter(c => c.querySelector('img')).map(c => ({id:c.dataset.id, img:/^data:image\/jpeg;base64,/.test(c.querySelector('img').src) && c.querySelector('img').naturalWidth > 0,
      name:c.querySelector('b').textContent, tags:[...c.querySelectorAll('.tag')].map(t => t.textContent)}))}));
  chk(m.open && m.cats.join() === 'Basics,Blockers,Layouts,Jumps,Toy pieces' + (FUNNEL.length ? ',Funnel: 40 levels in order' : '') && m.grps.join() === 'Slides,Tray shapes,Lane counts',
    'the showcase opens on its menu: categories and groups', m.cats.join(', ') + ' / ' + m.grps.join(', '));
  if (FUNNEL.length) chk(m.tiles.length === FUNNEL.length && m.tiles.every((t, k) => t.id === FUNNEL[k] && t.num === String(k + 1)) && m.tiles[0].next && m.tiles.filter(t => t.next).length === 1,
    'the funnel is a category of its own: numbered tiles in order, the first one to play next', m.tiles.length);
  chk(m.cards.length === ids.length && m.cards.every(c => c.img && c.name && c.tags.some(t => /^(Easy|Medium|Hard|Very Hard)$/.test(t)) && c.tags.some(t => /^\d lanes$/.test(t))),
    `a card for each of the ${ids.length} levels: its picture, name and tags (difficulty, lanes)`, m.cards.filter(c => !c.img).map(c => c.id).join(',') || m.cards.length);
  { const t = id => (m.cards.find(c => c.id === id) || {tags:[]}).tags;
    chk(t('blk-hidden-box').includes('Hidden box') && t('blk-lock-key').includes('Lock & key') && t('blk-count-crate').includes('Count crate') && t('blk-connected-triples').includes('Connected triples')
      && t('blk-dispenser').includes('Dispenser') && t('blk-hidden-marbles').includes('Hidden marbles') && t('blk-all').length >= 6 && t('slide-hairpin').length === 2
      && t('toy-vortex').includes('Vortex') && t('jump-double').includes('2 gaps'),
      'tags name the blockers, gaps and toy pieces in each level (a plain level has none)', t('blk-all').join(', ')); }
  console.log('settings from the menu, remembered');
  await p.click('#menuSet');
  chk(await p.evaluate(() => document.getElementById('setPanel').classList.contains('show')), 'the menu\'s gear opens the settings panel');
  const pick = async (id, text) => p.locator(`#${id} .chip`, {hasText:text}).first().click();
  await pick('setTheme', 'Walnut'); await pick('setSupports', 'Toy blocks'); await pick('setMotion', 'Jelly'); await pick('setView', 'Orthographic'); await pick('setSpeed', '1.5x'); await pick('setSound', 'Off');
  const s1 = await p.evaluate(() => ({theme:__mr.prefs.theme, sup:__mr.prefs.supports, motion:__mr.prefs.motion, view:__mr.prefs.view, speed:__mr.timeScale, sound:__mr.prefs.sound,
    on:[...document.querySelectorAll('#setPanel .chip.on')].map(b => b.textContent)}));
  chk(s1.theme === 'walnut' && s1.sup === 'blocks' && s1.motion === 'jelly' && s1.view === 'ortho' && s1.speed === 1.5 && s1.sound === false && s1.on.join() === 'Walnut,Toy blocks,Jelly,Orthographic,1.5x,Off',
    'theme, supports, box motion, camera, speed and sound: set and shown', JSON.stringify(s1));
  await p.click('#setClose');
  await p.reload(); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:120000});
  const s2 = await p.evaluate(() => ({theme:__mr.prefs.theme, motion:__mr.prefs.motion, view:__mr.prefs.view, speed:__mr.timeScale, sound:__mr.prefs.sound, menu:document.getElementById('menuPanel').classList.contains('show')}));
  chk(s2.theme === 'walnut' && s2.motion === 'jelly' && s2.view === 'ortho' && s2.speed === 1.5 && s2.sound === false && s2.menu, 'after a reload the menu comes back with the last settings', JSON.stringify(s2));
  console.log('playing a card');
  await p.click('#menuList .mcard[data-id="slide-hairpin"]');
  const g1 = await p.evaluate(() => ({menu:document.getElementById('menuPanel').classList.contains('show'), name:__mr.N.name, pill:document.getElementById('levelPill').textContent,
    bar:document.querySelectorAll('#boosters .boost').length, home:getComputedStyle(document.getElementById('btnHome')).display !== 'none',
    prev:document.getElementById('btnPrev').classList.contains('dis'), next:document.getElementById('btnNextLv').classList.contains('dis')}));
  chk(!g1.menu && g1.name === 'Hairpin' && g1.pill === 'Hairpin' && g1.bar === 3 && g1.home && !g1.prev && !g1.next, 'a card starts its level (name in the title pill, home button, the booster bar below)', JSON.stringify(g1));
  await p.click('#btnNextLv'); const n1 = await p.evaluate(() => __mr.N.name);
  await p.click('#btnPrev'); await p.click('#btnPrev'); const n2 = await p.evaluate(() => __mr.N.name);
  chk(n1 === 'Zig-zag' && n2 === 'S-curve', 'previous / next step through the category', `${n1}, ${n2}`);
  await p.evaluate(() => { const r = __mr.showcase.categories.find(c => c.name === 'Layouts'); const last = r.groups[r.groups.length - 1].levels.slice(-1)[0];
    __mr.goPack(__mr.pack.findIndex(l => l.id === last)); });
  const e1 = await p.evaluate(() => ({name:__mr.N.name, next:document.getElementById('btnNextLv').classList.contains('dis')}));
  await p.click('#btnNextLv', {force:true}); const e2 = await p.evaluate(() => __mr.N.name);
  chk(e1.name === '5 lanes' && e1.next && e2 === '5 lanes', 'next stops at the end of the category', JSON.stringify(e1));
  { const before = await p.evaluate(() => { __mr.tap(0); __mr.advance(0.5); return __mr.game.sends; });
    await p.click('#btnPause'); await p.click('#pmRestart'); const after = await p.evaluate(() => [__mr.game.sends, __mr.game.t]);
    chk(before === 1 && after[0] === 0 && after[1] < 0.5, 'Restart in the pause menu starts the level again', `${before} -> ${after[0]}`); }
  { await p.click('#btnPause');
    const pm = await p.evaluate(() => ({paused:__mr.paused, items:[...document.querySelectorAll('#pausePanel button')].filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent)}));
    chk(pm.paused && pm.items.join(',') === 'Resume,Restart,Settings,Back to menu', 'the pause menu in the showcase: Resume, Restart, Settings, Back to menu', pm.items.join(','));
    await p.click('#pmSettings');
    chk(await p.evaluate(() => document.getElementById('setPanel').classList.contains('show')), 'Settings in the pause menu opens the same settings panel');
    await pick('setMotion', 'Rigid'); await pick('setSpeed', '1x');
    chk(await p.evaluate(() => __mr.prefs.motion === 'rigid' && __mr.timeScale === 1 && document.getElementById('btnSpeed').textContent === '1x'), 'changes apply at once (the speed button shows the speed)');
    await p.click('#setClose'); await p.click('#pmResume'); }
  console.log('stats, back to the menu');
  { const r = await p.evaluate(() => { __mr.openMenu(); __mr.goPack(__mr.pack.findIndex(l => l.id === 'basics-easy')); const g = __mr.game;   // from the menu: any category
      for (let i = 0; i < 3000 && !g.result; i++){ const a = window.MRCore.greedyPick(g); if (a) __mr.tap(a.idx); __mr.advance(0.4); } __mr.advance(4); return {res:g.result, name:__mr.N.name, s:__mr.stats()['basics-easy']}; });
    chk(r.res === 'win' && r.s && r.s.time > 0 && r.s.wins === 1 && r.name === 'Easy', 'a win records the completion time', JSON.stringify(r)); }
  await p.evaluate(() => document.getElementById('winPanel').classList.remove('show'));
  await p.click('#btnStats');
  const st = await p.evaluate(() => ({show:document.getElementById('statsPanel').classList.contains('show'), rows:document.querySelectorAll('#statsBody tr').length, head:document.querySelector('#statsBody tr').textContent,
    easy:[...document.querySelectorAll('#statsBody tr')].find(r => /\bEasy\b/.test(r.textContent)).textContent}));
  chk(st.show && st.rows === total + 1 && /Time/.test(st.head) && /Fails/.test(st.head) && /Fail at/.test(st.head) && /\d+(\.\d)? s/.test(st.easy),
    'the stats panel: completion time, fails and the second of each fail, per level', JSON.stringify(st).slice(0, 160));
  const [dl] = await Promise.all([p.waitForEvent('download', {timeout:10000}).catch(() => null), p.click('#btnCsv')]);
  const csv = dl ? fs.readFileSync(await dl.path(), 'utf8') : '';
  chk(dl && /^level,name,completion_s,fails,fail_seconds/.test(csv) && csv.trim().split('\n').length === total + 1, 'Export CSV: one row per level', dl && dl.suggestedFilename());
  await p.click('#btnStatsClose');
  await p.evaluate(() => { __mr.openMenu(); __mr.goPack(__mr.pack.findIndex(l => l.id === 'slide-hairpin')); });
  await p.click('#btnPause'); await p.click('#pmMenu');
  const back = await p.evaluate(() => ({menu:document.getElementById('menuPanel').classList.contains('show')}));
  await p.click('#menuList .mcard[data-id="toy-vortex"]'); await p.click('#btnHome');
  const back2 = await p.evaluate(() => ({menu:document.getElementById('menuPanel').classList.contains('show'), last:(document.querySelector('#menuList .mcard.last') || {}).dataset}));
  chk(back.menu && back2.menu && back2.last && back2.last.id === 'toy-vortex', 'Back to menu (pause menu) and the home button go back to the menu, the last card picked is marked', JSON.stringify(back2));
  if (FUNNEL.length){ console.log('the funnel inside the showcase');
    await p.evaluate(id => document.querySelector(`#menuList .mcard[data-id="${id}"]`).click(), FUNNEL[0]);
    const t1 = await p.evaluate(() => ({id:__mr.N.id, name:__mr.N.name}));
    chk(t1.id === FUNNEL[0] && t1.name === 'Level 1', 'its first tile plays level 1', JSON.stringify(t1)); await p.evaluate(() => __mr.openMenu()); }
  console.log('the editor inside the showcase, My Levels');
  { const orig = await p.evaluate(() => JSON.stringify(__mr.pack.find(l => l.id === 'slide-hairpin')));
    await p.click('#menuEdit');
    const rows = await p.evaluate(() => document.querySelectorAll('#edPick .lv').length);
    chk(rows === total, 'the pencil opens a picker of every level', rows);
    await p.evaluate(() => [...document.querySelectorAll('#edPick .lv')].find(b => b.querySelector('code').textContent === 'slide-hairpin').click());
    const ed = await (await p.waitForSelector('#edFrame')).contentFrame();
    await ed.waitForFunction(() => window.__ed && __ed.level && __ed.level.id === 'slide-hairpin', null, {timeout:120000});
    const tools = await ed.evaluate(() => ({toy:!!document.querySelector('[data-tool="toy"]'), gap:!!document.querySelector('[data-tool="gap"]'), size:/Marble size/.test(document.getElementById('insp').innerText), back:!!document.getElementById('hostClose')}));
    chk(tools.toy && tools.gap && tools.size && tools.back, 'the editor opens over the showcase with the level, its cut and toy tools and the marble size', JSON.stringify(tools));
    await ed.evaluate(() => { __ed.edit(n => { n.name = 'My hairpin'; n.slide.toys = [{kind:'bells', at:9, len:1.6}]; }); __ed.saveLevel(false); });
    await ed.waitForFunction(() => __ed.level.id === 'slide-hairpin_1', null, {timeout:20000});
    await ed.evaluate(() => { __ed.edit(n => { n.marbleScale = 1.1; }); __ed.saveLevel(false); });
    await ed.waitForFunction(() => __ed.level.id === 'slide-hairpin_2', null, {timeout:20000});
    const mine = await p.evaluate(() => JSON.parse(localStorage.getItem('marble-run:my-levels')).levels.map(l => [l.id, l.name]));
    chk(JSON.stringify(mine) === JSON.stringify([['slide-hairpin_1', 'My hairpin'], ['slide-hairpin_2', 'My hairpin']]), 'each save keeps a new copy: <id>_1, <id>_2, ...', JSON.stringify(mine));
    await ed.evaluate(() => document.getElementById('hostClose').click());
    const bk = await p.evaluate(() => ({host:document.getElementById('edHost').classList.contains('show'), cats:[...document.querySelectorAll('#menuList .mcat')].map(x => x.firstChild.textContent),
      mine:[...document.querySelectorAll('#menuList .mcard')].filter(c => c.querySelector('.mtools')).map(c => c.dataset.id), same:JSON.stringify(__mr.pack.find(l => l.id === 'slide-hairpin'))}));
    chk(!bk.host && bk.cats[bk.cats.length - 1] === 'My Levels' && bk.mine.join() === 'slide-hairpin_1,slide-hairpin_2', 'back in the menu: a My Levels category with the saved copies', JSON.stringify(bk.mine));
    chk(bk.same === orig, 'the original level never changes');
    const [d1] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.querySelector('#menuList .mcard[data-id="slide-hairpin_2"] [data-a="export"]').click())]);
    const one = JSON.parse(fs.readFileSync(await d1.path(), 'utf8'));
    const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#myExportAll')]);
    const all = JSON.parse(fs.readFileSync(await d2.path(), 'utf8'));
    chk(d1.suggestedFilename() === 'slide-hairpin_2.json' && one.id === 'slide-hairpin_2' && one.marbleScale === 1.1 && d2.suggestedFilename() === 'my-levels.json' && all.levels.map(l => l.id).join() === 'slide-hairpin_1,slide-hairpin_2',
      'My Levels export one by one (<id>.json) or all together (my-levels.json)');
    await p.evaluate(() => document.querySelector('#menuList .mcard[data-id="slide-hairpin_1"]').click());
    const pl = await p.evaluate(() => ({id:__mr.N.id, toys:(__mr.L.SLIDE.toys || []).length, menu:__mr.menuOpen}));
    chk(pl.id === 'slide-hairpin_1' && pl.toys === 1 && !pl.menu, 'a level from My Levels plays (with its edits)', JSON.stringify(pl));
    await p.evaluate(() => { __mr.openMenu(); document.querySelector('#menuList .mcard[data-id="slide-hairpin_2"] [data-a="del"]').click(); });
    chk(await p.evaluate(() => JSON.parse(localStorage.getItem('marble-run:my-levels')).levels.map(l => l.id).join()) === 'slide-hairpin_1', 'a level can be deleted from My Levels'); }
  await p.evaluate(() => __mr.openMenu());
  fs.mkdirSync(path.join(ROOT, 'screenshots'), {recursive:true});
  await p.screenshot({path:path.join(ROOT, 'screenshots', 'showcase-menu.png')});
  chk(!errs.length && !net.length, 'no page errors, nothing fetched from the network', errs.concat(net).slice(0, 3).join(' | '));
  await browser.close(); done();
})().catch(e => { chk(false, 'exception: ' + e.message.split('\n')[0]); done(); });
function done(){ console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; }
