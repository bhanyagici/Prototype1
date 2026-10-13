// The showcase: node tests/showcase.test.js
// The levels (levels/showcase): each in its category, balanced, free of warnings, inside the target zone and won by
// the greedy bot; the Basics at their four difficulties; spirals in at least 70% of them.  Then the single file (tools/build-showcase.js ->
// dist/match-express-showcase.html) opened from file:// at 390 x 844: the start menu (categories, groups, a card per
// level with its picture, name and tags), the settings panel from the menu and in play (theme, Rigid / Jelly, camera, speed,
// sound, remembered after a reload), playing a card, previous / next inside its category, back to the menu (the last
// card marked), restart, the booster bar and the stats panel, with nothing fetched from the network.
//   node tests/showcase.test.js   (the browser part needs playwright; same CHROMIUM env as browser.test.js)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url'), {execFileSync} = require('child_process');
const C = require('./core.js')();
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'showcase');
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
const clone = o => JSON.parse(JSON.stringify(o));

console.log('showcase levels');
const order = JSON.parse(fs.readFileSync(path.join(DIR, 'showcase-order.json'), 'utf8'));
const ids = order.categories.flatMap(c => c.groups.flatMap(g => g.levels));
const levels = Object.fromEntries(ids.map(id => [id, JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'))]));
{ const cats = order.categories.map(c => c.name), lay = order.categories.find(c => c.name === 'Layouts');
  chk(cats.join() === 'Basics,Blockers,Layouts' && lay && lay.groups.map(g => g.name).join() === 'Roads,Ramp shapes,Lane counts',
    'three categories (Basics, Blockers, Layouts with Roads, Ramp shapes and Lane counts)', cats.join(', '));
  const names = id => order.categories.flatMap(c => c.groups).find(g => g.levels.includes(id));
  const want = {Basics:['Easy', 'Medium', 'Hard', 'Very Hard'], Blockers:['Hidden bus', 'Connected pairs', 'Connected triples', 'Colourful tunnel', 'Hidden stickmen', 'Lock & key box', 'Count box', 'All combined'],
    Roads:['S-curve', 'Zigzag', 'Hairpin', 'Single spiral', 'Double spiral', 'Long winding road'], 'Ramp shapes':['Straight', 'Curved arc', 'L-shape', 'Wide fan', 'Long narrow'],
    'Lane counts':['2 lanes', '3 lanes', '4 lanes', '5 lanes']};
  const got = {}; order.categories.forEach(c => c.groups.forEach(g => { got[g.name || c.name] = g.levels.map(id => levels[id].name); }));
  chk(Object.entries(want).every(([k, v]) => JSON.stringify(got[k]) === JSON.stringify(v)), `${ids.length} levels: every one asked for, in its place`, Object.values(got).map(v => v.length).join(' + '));
  void names;
}
{ const bad = [], zone = [];
  for (const id of ids){ const lv = levels[id], ck = C.checkLevel(clone(lv)), g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
    if (!ck.balanced || ck.warnings.length || g.result !== 'win') bad.push(`${id}: ${ck.balanced ? '' : 'unbalanced '}${ck.warnings.map(w => w.kind).join(',')} ${g.result}`);
    // the level climbs through the target zone: its exit tunnel near the top
    const L = C.buildLayout(clone(lv)), top = C.project(L.exit.x, L.exit.y + 1.9, L.exit.z)[1]/C.SCREEN.h;
    if (top > 0.16) zone.push(`${id} ${(top*100).toFixed(0)}%`); }
  chk(!bad.length, 'every showcase level is balanced, free of warnings and won by the greedy bot', bad.join('; '));
  chk(!zone.length, 'every showcase level uses the whole target zone (its exit tunnel near the top edge)', zone.join(', '));
}
{ const d = ['basics-easy', 'basics-medium', 'basics-hard', 'basics-very-hard'].map(id => levels[id].meta.difficulty);
  chk(d.join() === 'Easy,Medium,Hard,Very Hard', 'the Basics measure Easy, Medium, Hard and Very Hard (random-bot win rate)', ['basics-easy', 'basics-medium', 'basics-hard', 'basics-very-hard'].map(id => (levels[id].meta.random*100).toFixed(1) + '%').join(' / '));
  const lanes = ['lanes-2', 'lanes-3', 'lanes-4', 'lanes-5'].map(id => levels[id].lanes.length);
  chk(lanes.join() === '2,3,4,5', 'the lane-count levels have 2, 3, 4 and 5 queue lanes', lanes.join(','));
  const sp = levels['road-spiral'], dsp = levels['road-double-spiral'], ns = lv => lv.road.points.filter(p => p.spiral).length;
  chk(ns(sp) === 1 && ns(dsp) === 2, 'the single spiral has one spiral, the double spiral two');
  // spirals in most levels: at least 70% have one and several have two; a few Layouts keep a road without one
  const withS = ids.filter(id => ns(levels[id]) >= 1), two = ids.filter(id => ns(levels[id]) >= 2), plain = ids.filter(id => !ns(levels[id]));
  chk(withS.length >= 0.7*ids.length && two.length >= 4 && plain.length >= 3 && plain.every(id => levels[id].meta.category === 'Layouts'),
    'at least 70% of the levels have a spiral, several two; the few without are Layouts',
    `${withS.length}/${ids.length} with a spiral (${Math.round(100*withS.length/ids.length)}%), ${two.length} with two; without: ${plain.join(', ')}`); }

(async () => {
  let chromium; try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP browser part: playwright is not installed'); return done(); }
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-showcase.js')], {stdio:'inherit'});
  const file = path.join(ROOT, 'dist', 'match-express-showcase.html');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await browser.newContext({viewport:{width:390, height:844}}), p = await ctx.newPage(), errs = [], net = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  await p.goto(pathToFileURL(file).href); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:120000});
  console.log('the start menu');
  const m = await p.evaluate(() => ({open:document.getElementById('menuPanel').classList.contains('show'),
    cats:[...document.querySelectorAll('#menuList .mcat')].map(e => e.textContent), grps:[...document.querySelectorAll('#menuList .mgrp')].map(e => e.textContent),
    cards:[...document.querySelectorAll('#menuList .mcard')].map(c => ({id:c.dataset.id, img:/^data:image\/jpeg;base64,/.test(c.querySelector('img').src) && c.querySelector('img').naturalWidth > 0,
      name:c.querySelector('b').textContent, tags:[...c.querySelectorAll('.tag')].map(t => t.textContent)}))}));
  chk(m.open && m.cats.join() === 'Basics,Blockers,Layouts' && m.grps.join() === 'Roads,Ramp shapes,Lane counts', 'the showcase opens on its menu: categories and groups', m.cats.join(', ') + ' / ' + m.grps.join(', '));
  chk(m.cards.length === ids.length && m.cards.every(c => c.img && c.name && c.tags.some(t => /^(Easy|Medium|Hard|Very Hard)$/.test(t)) && c.tags.some(t => /^\d lanes$/.test(t))),
    `a card for each of the ${ids.length} levels: its picture, name and tags (difficulty, lanes)`, m.cards.filter(c => !c.img).map(c => c.id).join(','));
  { const t = id => (m.cards.find(c => c.id === id) || {tags:[]}).tags;
    chk(t('blk-hidden-bus').includes('Hidden bus') && t('blk-lock-key').includes('Lock & key') && t('blk-count-box').includes('Count box') && t('blk-connected-triples').includes('Connected triples')
      && t('blk-colourful-tunnel').includes('Colourful tunnel') && t('blk-hidden-stickmen').includes('Hidden stickmen') && t('blk-all').length >= 6 && t('road-s-curve').length === 2,
      'blocker tags name the blockers in each level (a level without blockers has none)', t('blk-all').join(', ')); }
  console.log('settings from the menu, remembered');
  await p.click('#menuSet');
  chk(await p.evaluate(() => document.getElementById('setPanel').classList.contains('show')), 'the menu\'s gear opens the settings panel');
  await p.click('#segTheme button[data-v="desert"]'); await p.click('#segMove button[data-v="jelly"]'); await p.click('#segCam button[data-v="ortho"]'); await p.click('#segSpeed button[data-v="1.5"]'); await p.click('#segSound button[data-v="off"]');
  const s1 = await p.evaluate(() => ({theme:__me.theme, move:__me.move, view:__me.view, speed:__me.timeScale, muted:__me.muted, on:[...document.querySelectorAll('#setPanel .seg button.on')].map(b => b.dataset.v)}));
  chk(s1.theme === 'desert' && s1.move === 'jelly' && s1.view === 'ortho' && s1.speed === 1.5 && s1.muted && s1.on.join() === 'desert,jelly,ortho,1.5,off',
    'theme, bus movement (Rigid / Jelly), camera (Perspective / Orthographic), speed (1x-2x) and sound: set and shown', JSON.stringify(s1));
  await p.click('#btnSetClose');
  await p.reload(); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:120000});
  const s2 = await p.evaluate(() => ({theme:__me.theme, move:__me.move, view:__me.view, speed:__me.timeScale, muted:__me.muted, menu:document.getElementById('menuPanel').classList.contains('show')}));
  chk(s2.theme === 'desert' && s2.move === 'jelly' && s2.view === 'ortho' && s2.speed === 1.5 && s2.muted && s2.menu, 'after a reload the menu comes back with the last settings', JSON.stringify(s2));
  console.log('playing a card');
  await p.click('#menuList .mcard[data-id="road-hairpin"]');
  const g1 = await p.evaluate(() => ({menu:document.getElementById('menuPanel').classList.contains('show'), name:__me.LEVEL.name, pill:document.getElementById('levelPill').textContent,
    bar:document.querySelectorAll('#boosters .boost').length, prev:document.getElementById('btnPrev').classList.contains('dis'), next:document.getElementById('btnNextLv').classList.contains('dis')}));
  chk(!g1.menu && g1.name === 'Hairpin' && g1.pill === 'Hairpin' && g1.bar === 3 && !g1.prev && !g1.next, 'a card starts its level (name in the title pill, the booster bar below)', JSON.stringify(g1));
  await p.click('#btnNextLv'); const n1 = await p.evaluate(() => __me.LEVEL.name);
  await p.click('#btnPrev'); await p.click('#btnPrev'); const n2 = await p.evaluate(() => __me.LEVEL.name);
  chk(n1 === 'Single spiral' && n2 === 'Zigzag', 'previous / next step through the category', `${n1}, ${n2}`);
  await p.evaluate(() => { const r = __me.showcase.categories.find(c => c.name === 'Layouts'); const last = r.groups[r.groups.length - 1].levels.slice(-1)[0];
    __me.goLevel(__me.playlist.findIndex(l => l.id === last)); });
  const e1 = await p.evaluate(() => ({name:__me.LEVEL.name, next:document.getElementById('btnNextLv').classList.contains('dis')}));
  await p.click('#btnNextLv', {force:true}); const e2 = await p.evaluate(() => __me.LEVEL.name);
  chk(e1.name === '5 lanes' && e1.next && e2 === '5 lanes', 'next stops at the end of the category', JSON.stringify(e1));
  { const before = await p.evaluate(() => { __me.tapLane(0); __me.pump(0.5); return __me.game.counter; });
    await p.click('#btnRestart'); const after = await p.evaluate(() => [__me.game.counter, __me.game.t]);
    chk(before === 1 && after[0] === 0 && after[1] < 0.5, 'restart starts the level again', `${before} -> ${after[0]}`); }
  console.log('settings and stats in play, back to the menu');
  await p.click('#btnSettings');
  chk(await p.evaluate(() => document.getElementById('setPanel').classList.contains('show') && !document.getElementById('settings').classList.contains('open')), 'the gear in play opens the same settings panel');
  await p.click('#segMove button[data-v="rigid"]'); await p.click('#segSpeed button[data-v="1"]');
  chk(await p.evaluate(() => __me.move === 'rigid' && __me.timeScale === 1 && document.getElementById('btnSpeed').textContent === '1x'), 'changes apply at once (the speed button shows the speed)');
  await p.click('#btnSetStats');
  const st = await p.evaluate(() => ({show:document.getElementById('statsPanel').classList.contains('show'), rows:document.querySelectorAll('#statsBody tr').length, head:document.querySelector('#statsBody tr').textContent}));
  chk(st.show && st.rows === ids.length + 2 && /Time/.test(st.head) && /Fails/.test(st.head) && /Fail at/.test(st.head), 'the stats panel: completion time, fails and the second of each fail, per level', JSON.stringify(st));
  await p.click('#btnStatsClose');
  // a fail and a win land in the stats
  { const r = await p.evaluate(() => { __me.openMenu(); __me.goLevel(__me.playlist.findIndex(l => l.id === 'basics-easy')); const g = __me.game;   // from the menu: any category
      for (let i = 0; i < 2000 && !g.result; i++){ const a = window.MECore.greedyPick(g); if (a) __me.tap(a); __me.advance(0.4); } __me.advance(4); return {res:g.result, name:__me.LEVEL.name, s:__me.stats()['basics-easy']}; });
    chk(r.res === 'win' && r.s && r.s.time > 0 && r.s.wins === 1 && r.name === 'Easy', 'a win records the completion time', JSON.stringify(r)); }
  await p.click('#btnHome');
  const back = await p.evaluate(() => ({menu:document.getElementById('menuPanel').classList.contains('show'), last:(document.querySelector('#menuList .mcard.last') || {}).dataset}));
  chk(back.menu && back.last && back.last.id === 'road-hairpin', 'home goes back to the menu, the last card picked is marked', JSON.stringify(back));
  chk(!errs.length && !net.length, 'no page errors, nothing fetched from the network', errs.concat(net).slice(0, 3).join(' | '));
  await browser.close(); done();
})().catch(e => { chk(false, 'exception: ' + e.message.split('\n')[0]); done(); });
function done(){ console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; }
