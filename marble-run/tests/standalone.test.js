// The single-file builds and the level packs: tools/build-standalone.js and tools/export-levels.js, then the files opened
// from file:// in Chromium: the play file plays to a win and ignores saved editor levels; the single-file editor's
// preview is its own srcdoc copy of the packed game, Run restarts it with the edited level, "Play this level in a new
// tab" and the playable HTML export work without a server. The packs (funnel-40.json, all-levels.json) and the zip
// hold every level exactly as its file in levels/. Nothing is fetched from the network: three.js is inlined too.
//   node tests/standalone.test.js   (needs playwright; same CHROMIUM env as browser.test.js)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url'), {execFileSync} = require('child_process');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-standalone.js')], {stdio:'inherit'});
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'export-levels.js')], {stdio:'inherit'});

console.log('the level packs and the zip');
{ const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')), forder = read('levels/funnel/funnel-order.json').levels;
  const sorder = read('levels/showcase/showcase-order.json').categories, dirOf = {};
  sorder.forEach(c => c.groups.forEach(g => g.levels.forEach(id => { dirOf[id] = c.dir; })));
  const sids = sorder.flatMap(c => c.groups.flatMap(g => g.levels));
  const f40 = read('dist/funnel-40.json'), all = read('dist/all-levels.json');
  chk(f40.type === 'marble-run-levels' && f40.levels.length === 40 && f40.levels.every((lv, k) => lv.id === forder[k] && JSON.stringify(lv) === JSON.stringify(read(`levels/funnel/${forder[k]}.json`))),
    'funnel-40.json: the 40 funnel levels in their order, each the same JSON as its file');
  chk(all.levels.length === sids.length + 40 && all.categories.slice(-1)[0].name === 'Funnel' && sids.every(id => JSON.stringify(all.levels.find(l => l.id === id)) === JSON.stringify(read(`levels/showcase/${dirOf[id]}/${id}.json`))),
    'all-levels.json: every showcase level by category, then the funnel', `${all.levels.length} levels, ${all.categories.length} categories`);
  const list = execFileSync('unzip', ['-Z1', path.join(DIST, 'marble-run-levels.zip')], {encoding:'utf8'}).trim().split('\n');
  const want = ['funnel/funnel-order.json', ...forder.map(id => `funnel/${id}.json`), 'showcase/showcase-order.json', ...sids.map(id => `showcase/${dirOf[id]}/${id}.json`)];
  const same = list.length === want.length && want.every(f => list.includes(f)) &&
    ['funnel/f01.json', 'funnel/f40.json', `showcase/${dirOf[sids[0]]}/${sids[0]}.json`].every(f => execFileSync('unzip', ['-p', path.join(DIST, 'marble-run-levels.zip'), f], {encoding:'utf8'}) === fs.readFileSync(path.join(ROOT, 'levels', f), 'utf8'));
  chk(same, 'marble-run-levels.zip: levels/funnel/f01..f40.json and levels/showcase/<category>/<id>.json with both orders, byte for byte', `${list.length} files`); }

let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP browser part: playwright is not installed'); finish(); return; }
const D = pathToFileURL(DIST).href + '/';
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const mk = vp => b.newContext({viewport:vp, acceptDownloads:true});
  const errs = [], net = []; const watch = p => { p.on('pageerror', e => errs.push(p.url().slice(-40) + ': ' + e.message)); p.on('requestfailed', r => errs.push('reqfail ' + r.url()));
    p.on('request', r => { if (/^https?:/.test(r.url())) net.push(r.url()); }); };
  // ---- the play file: the built-in level, a win by the greedy bot, saved editor levels ignored, no bot test
  console.log('marble-run-play.html');
  { const c = await mk({width:390, height:844}), p = await c.newPage(); watch(p); const logs = []; p.on('console', m => logs.push(m.text()));
    await p.goto(D + 'marble-run-play.html'); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000});
    const name0 = await p.evaluate(() => __mr.N.name);
    chk(await p.evaluate(() => typeof MRCore === 'object' && typeof MRSync === 'object' && __mr.N.name === MRCore.LEVEL_DATA.name), 'it opens from file:// with the inlined core and sync, on the built-in level', name0);
    await p.evaluate(() => { localStorage.setItem('marble-run:level-slots', JSON.stringify({x:{name:'Old editor level', level:Object.assign(JSON.parse(JSON.stringify(MRCore.LEVEL_DATA)), {id:'x', name:'Old editor level'})}}));
      localStorage.setItem('marble-run:level-order', '["x"]'); localStorage.setItem('marble-run:current-level', JSON.stringify({name:'Old editor level'})); });
    await p.reload(); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000}); await p.waitForTimeout(1500);
    chk(await p.evaluate(n => __mr.N.name === n, name0) && !logs.some(l => /^\[sim\]/.test(l)), 'after a reload it still opens the built-in level (not a saved editor level) and runs no bot test');
    const t0 = await p.evaluate(() => { __mr.tap(0); __mr.advance(0.5); return __mr.game.sends; });
    chk(t0 === 1, 'a tap sends a box');
    await p.evaluate(() => { __mr.resetGame(); __mr.setBot(true); for (let i = 0; i < 6000 && !__mr.game.result; i++) __mr.advance(0.1); __mr.render(); });
    const r = await p.evaluate(() => ({res:__mr.game.result, landed:__mr.game.landed, total:__mr.game.total, t:__mr.game.t.toFixed(1)}));
    chk(r.res === 'win' && r.landed === r.total, 'the greedy bot plays the level to a win', JSON.stringify(r));
    await c.close(); }
  // ---- the single-file editor
  console.log('marble-run-editor.html');
  { const c = await mk({width:1440, height:900}), p = await c.newPage(); watch(p);
    await p.goto(D + 'marble-run-editor.html'); await p.waitForFunction(() => window.__ed, null, {timeout:60000});
    await p.waitForFunction(() => { const w = document.getElementById('preview').contentWindow; return w.__mr && w.__mr.game; }, null, {timeout:90000});
    const fr = p.frames().find(f => f !== p.mainFrame());
    chk(!!fr && fr.url() === 'about:srcdoc', 'the preview is the embedded srcdoc game', fr && fr.url());
    chk(await p.waitForFunction(() => document.getElementById('preview').contentWindow.__mr.levelSource === 'editor', null, {timeout:30000}).then(() => true, () => false), 'the preview boots with the editor level');
    const pv = () => p.evaluate(() => { const m = document.getElementById('preview').contentWindow.__mr; return {serial:m.serial, name:m.N.name, src:m.levelSource, boxes:m.game.boxes.length}; });
    const s0 = await pv();
    await p.fill('#levelName', 'Standalone check'); await p.press('#levelName', 'Enter');
    await p.evaluate(() => __ed.edit(n => { const l = n.lanes.find(x => x.length > 1); l.pop(); }));
    await p.click('#runBtn');
    await p.waitForFunction(s => document.getElementById('preview').contentWindow.__mr.serial > s, s0.serial, {timeout:30000}).catch(() => {});
    const s1 = await pv();
    chk(s1.serial > s0.serial && s1.name === 'Standalone check' && s1.boxes === s0.boxes - 1, 'Run restarts the preview with the edited level', JSON.stringify([s0, s1]));
    await p.evaluate(() => { const m = document.getElementById('preview').contentWindow.__mr; m.tap(0); m.advance(0.5); });
    chk(await p.evaluate(() => document.getElementById('preview').contentWindow.__mr.game.sends > 0), 'the embedded game responds to play');
    // Export > Play this level in a new tab: a packed copy from a blob URL
    await p.click('#exportMenu [data-menu]');
    const [tab] = await Promise.all([c.waitForEvent('page'), p.click('#exportMenu [data-act="playTab"]')]); watch(tab);
    const ok = await tab.waitForFunction(() => window.__mr && __mr.game && __mr.N.name === 'Standalone check', null, {timeout:90000}).then(() => true, () => false);
    chk(ok, '"Play this level in a new tab" opens a packed copy of the current level', tab.url().slice(0, 30));
    await tab.close();
    // Export > Playable HTML from the single-file editor: no server needed
    const html = await p.evaluate(() => __ed.exportHtml('level'));
    const tmp = path.join(require('os').tmpdir(), 'mr-sa-' + process.pid + '.html'); fs.writeFileSync(tmp, html || '');
    const q = await c.newPage(); watch(q); await q.goto(pathToFileURL(tmp).href);
    const ok2 = await q.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000}).then(() => true, () => false);
    chk(ok2 && await q.evaluate(() => __mr.N.name === 'Standalone check' && __mr.game.boxes.length > 0), 'the single-file editor exports a playable HTML of the level (opens from file://)');
    fs.unlinkSync(tmp);
    await c.close(); }
  chk(errs.length === 0, 'no page errors or failed loads', errs.join(' | '));
  chk(net.length === 0, 'nothing is loaded from the network (three.js is inlined too)', net.slice(0, 3).join(' '));
  await b.close(); finish();
})().catch(e => { console.error(e); process.exit(1); });

function finish(){ console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0; }
