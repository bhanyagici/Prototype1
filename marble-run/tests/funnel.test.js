// The 40-level funnel: the level files (levels/funnel) against the design table (tools/funnel/specs.js), the bots,
// and the 40-level pack (tools/build-funnel.js -> dist/marble-run-funnel-40.html) opened from file:// at 390x844:
// the level 1 and level 3 tutorials (the hand, blocked taps), the intro popups (first appearance only, they hold the
// game), the level 17 hint, previous / next and "Level x / 40", the stats panel (completion time, fails and their
// second, Export CSV, Reset) and the speeds 1x-3x.
//   node tests/funnel.test.js        (the browser part needs playwright; same CHROMIUM env as browser.test.js)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url');
const C = require('./core.js')(), SPECS = require('../tools/funnel/specs.js');
const DIR = path.join(__dirname, '..', 'levels', 'funnel');
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const id = n => 'f' + String(n).padStart(2, '0'), clone = o => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------- the level files */
console.log('the level files');
const orderFile = JSON.parse(fs.readFileSync(path.join(DIR, 'funnel-order.json'), 'utf8')), order = orderFile.levels;
chk(orderFile.type === 'marble-run-level-order' && order.join() === SPECS.map(s => id(s.n)).join(), 'funnel-order.json lists f01 ... f40 in order');
const LV = {}; order.forEach(i => { LV[i] = JSON.parse(fs.readFileSync(path.join(DIR, i + '.json'), 'utf8')); });
const crates = lv => lv.trays.flatMap(r => r.crates || []);
const count = lv => { const fl = lv.lanes.flat(), g = {}; fl.forEach(b => { if (b.link) g[b.link] = (g[b.link] || 0) + 1; });
  return {hidden:fl.filter(b => b.hidden).length, pairs:Object.values(g).filter(n => n === 2).length, triples:Object.values(g).filter(n => n === 3).length,
    disp:lv.trays.reduce((a, r) => a + (r.dispensers || []).length, 0), hiddenMarbles:lv.trays.reduce((a, r) => a + r.columns.flat().filter(c => typeof c === 'string' && c[0] === '?').length, 0),
    locks:crates(lv).filter(c => c.lock != null).length, counts:crates(lv).filter(c => c.count != null).length}; };
const K = Object.fromEntries(order.map(i => [i, count(LV[i])]));
{ const probs = [];
  for (const s of SPECS){
    const lv = LV[id(s.n)], ck = C.checkLevel(clone(lv)), sizes = new Set(lv.lanes.flat().map(b => b.size)), k = K[id(s.n)], B = s.blockers || {}, p = [];
    if (lv.id !== id(s.n)) p.push('id ' + lv.id);
    if (C.normalizeLevel(clone(lv)).lanes.length !== (s.lanes || 3)) p.push(`${lv.lanes.length} lanes (want ${s.lanes || 3})`);
    if (!ck.balanced) p.push('holes != marbles');
    if (ck.warnings.length) p.push('warnings: ' + ck.warnings.map(w => w.kind).join(','));
    const cols = ck.perColor.filter(c => c.marbles);
    if (cols.length !== s.colors) p.push(`${cols.length} colours (want ${s.colors})`);
    if ([...sizes].some(x => !s.sizes.includes(x))) p.push(`sizes ${[...sizes].sort((a, b) => a - b)} (want from ${s.sizes})`);
    if (lv.trays.length !== s.trays.length) p.push(`${lv.trays.length} trays (want ${s.trays.length})`);
    if (!!B.hidden !== k.hidden > 0) p.push('hidden boxes');
    if (!!B.link !== (k.pairs + k.triples) > 0) p.push('connected boxes');
    if (B.link === 'triples' && !k.triples) p.push('no triples');
    if (!!B.disp !== k.disp > 0) p.push('dispensers');
    if (!!B.hiddenMarbles !== k.hiddenMarbles > 0) p.push('hidden marbles');
    if (!!B.lock !== k.locks > 0) p.push('lock crates');
    if (B.lock && !lv.lanes.flat().some(b => b.key != null)) p.push('no key box');
    if (!!B.count !== k.counts > 0) p.push('count crate');
    if (p.length) probs.push(`${id(s.n)}: ${p.join('; ')}`);
  }
  chk(!probs.length, 'every level matches its row of the design table (lanes, colours, box sizes, trays, blockers), is balanced and free of warnings', probs.join(' | ')); }
{ const n = {}; SPECS.forEach(s => { (n[s.lanes || 3] = n[s.lanes || 3] || []).push(s.n); });
  chk(n[2].join() === '1,2,3,4,5,9,22,31' && n[4].join() === '16,20,23,35' && n[5].join() === '38,40', 'box lanes: 2 on f01-f05, f09, f22, f31; 4 on f16, f20, f23, f35; 5 on f38, f40; 3 elsewhere', JSON.stringify(n)); }
const metas = order.map(i => LV[i].meta || {});
const at = k => order.filter((i, n) => metas[n][k]).map(i => +i.slice(1) + ':' + LV[i].meta[k]).join(' ');
chk(at('tutorial') === '1:first-sends 3:slot-wait', 'tutorials on levels 1 and 3', at('tutorial'));
chk(at('popup') === '7:hidden 13:connected 22:hiddenMarbles 26:dispenser 32:lock', 'intro popups on levels 7, 13, 22, 26 and 32 only', at('popup'));
chk(at('hint') === '17:triple', 'a short hint on level 17 only', at('hint'));
chk(C.normalizeLevel(clone(LV.f07)).meta.popup === 'hidden', 'the core keeps a level\'s meta through normalizeLevel');
// the intro levels lean on their blocker and stay easy; from level 21 on the levels carry more blockers
{ const total = c => c.hidden + c.pairs + c.triples + c.disp + (c.hiddenMarbles ? 1 : 0) + c.locks + c.counts;
  const rate = i => { let w = 0; for (let r = 0; r < 100; r++) if (C.simulate(clone(LV[i]), C.randomPick, C.mulberry32(1000 + r), C.SIM_DT).result === 'win') w++; return w/100; };
  const intro = [['f07', 'hidden', 4], ['f13', 'pairs', 3], ['f17', 'triples', 2], ['f22', 'hiddenMarbles', 6], ['f26', 'disp', 2], ['f32', 'locks', 2]].map(([i, k, n]) => ({i, k, n, has:K[i][k], rate:rate(i)}));
  chk(intro.every(o => o.has >= o.n && o.rate >= 0.6), 'the blocker intro levels (7, 13, 17, 22, 26, 32) use their blocker a lot and stay easy (the random bot wins 60% or more)',
    intro.map(o => `${o.i}: ${o.has} ${o.k}, ${Math.round(o.rate*100)}%`).join('; '));
  const avg = (a, b) => order.slice(a - 1, b).reduce((s, i) => s + total(K[i]), 0)/(b - a + 1);
  chk(avg(21, 40) >= 2*avg(1, 20) && order.slice(20).filter(i => !/^Relax|^Fun/.test(LV[i].meta.role)).every(i => total(K[i]) >= 1),
    'more blockers after level 20: twice as many per level as levels 1-20, and every level from 21 on but the Relax / Fun breathers has some',
    `${avg(21, 40).toFixed(1)} per level from 21, ${avg(1, 20).toFixed(1)} before`); }
{ const same = SPECS.slice(1).filter((s, k) => s.slideIdea === SPECS[k].slideIdea && s.trayIdea === SPECS[k].trayIdea).map(s => s.n);
  chk(!same.length, 'no two consecutive levels share both slide and tray shape', same.join(',')); }

/* ---------------------------------------------------------------- the bots */
console.log('the bots');
const greedy = order.map(i => [i, C.simulate(clone(LV[i]), C.greedyPick, null, C.SIM_DT)]);
const lost = greedy.filter(([, g]) => g.result !== 'win');
chk(!lost.length, 'the greedy bot wins all 40 levels', lost.map(([i, g]) => i + ' ' + g.result).join(', '));
{ const t1 = greedy.reduce((a, [, g]) => a + g.t, 0);
  console.log(`  NOTE  greedy playtime: ${(t1/60).toFixed(1)} min at 1x, ${(t1/120).toFixed(1)} min at 2x (the 35-minute target at 2x is reported in the README, not checked)`); }
{ let early = 0; for (let n = 1; n <= 5; n++) for (let r = 0; r < 120; r++) if (C.simulate(clone(LV[id(n)]), C.randomPick, C.mulberry32(9000 + r), C.SIM_DT).result !== 'win') early++;
  const ff = JSON.parse(fs.readFileSync(path.join(DIR, 'funnel-report.json'), 'utf8')).levels, proof = [1, 2, 3, 4, 5].map(n => ff[id(n)] && ff[id(n)].failFree);
  chk(!early && proof.every(p => /^yes/.test(p || '')), 'levels 1-5 cannot be lost: 600 more random games here, and the report\'s proof (1000 random games and an adversarial bot each)', `${early} losses; ${proof.join(' | ')}`); }
{ // level 3: the first box sent (the tutorial's) can fill only part of its holes, so it waits in its slot; the level is won
  const lv = clone(LV.f03), g = C.createGame(lv, {headless:true}), l = lv.meta.tutorialLane, b = g.boxes[g.lanes[l][0]];
  C.tapLane(g, l); let waited = false;
  for (let i = 0; i < 30*20 && !waited; i++){ C.step(g, C.SIM_DT); waited = b.state === 'slot' && b.got > 0 && b.got < b.size && !C.frontColors(g)[b.color] && !g.flow.length; }
  chk(waited, 'level 3: the tutorial\'s box gets some of its marbles, then waits in its slot', `${b.color}${b.size} ${b.state} ${b.got}/${b.size}`); }

/* ---------------------------------------------------------------- the 40-level pack in a browser */
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP browser part: playwright is not installed'); finish(); return; }
require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-funnel.js')], {stdio:'inherit'});
const PACK = pathToFileURL(path.join(__dirname, '..', 'dist', 'marble-run-funnel-40.html')).href;
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, acceptDownloads:true}), errs = [], net = [];
  const open = async (n) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('request', r => { if (/^https?:/.test(r.url())) net.push(r.url()); });
    await p.goto(PACK + (n ? '?n=' + n : '')); await p.waitForFunction(() => window.__mr && __mr.game, null, {timeout:90000}); return p; };
  const step = (p, sec) => p.evaluate(s => { __mr.advance(s); __mr.render(); }, sec || 0.2);
  const tapBox = async (p, boxId) => { const [x, y] = await p.evaluate(i => { const g = __mr.game, l = g.boxes[i].lane, [sx, sy] = __mr.laneScreen(l), r = document.getElementById('app').getBoundingClientRect(), k = r.width/900;
      return [r.left + sx*k, r.top + sy*k]; }, boxId); await p.mouse.click(x, y); };
  // a player who follows the hand: the box it points at while it shows, otherwise the greedy choice (where taps are allowed)
  const playTo = (p, untilStep, maxSec) => p.evaluate(([until, maxSec]) => {
    const seen = new Set(); let tut = null;
    for (let i = 0; i < maxSec/0.4 && !__mr.game.result; i++){ const T = __mr.tutorial; if (T) seen.add(T.step + ':' + document.getElementById('tip').dataset.text); tut = T && Object.assign({}, T);
      if (until && T && T.step === until) break;
      let l = -1; if (T && T.hand >= 0) l = __mr.game.boxes[T.hand].lane;
      else { const a = __mr.C.greedyPick(__mr.game); if (a && __mr.tapAllowed(a.idx)) l = a.idx; }
      if (l >= 0) __mr.tap(l); __mr.advance(0.4); }
    __mr.render(); return {res:__mr.game.result, t:__mr.game.t, steps:[...seen], tut}; }, [untilStep || 0, maxSec || 600]);

  // ---- level 1: the pack opens on it; the tutorial leads the first sends and blocks other taps
  console.log('level 1 tutorial');
  { const p = await open();
    await step(p, 0.2);
    const s = await p.evaluate(() => ({n:__mr.pack.length, step:document.getElementById('levelStep').textContent, prev:document.getElementById('btnPrev').classList.contains('dis'),
      T:__mr.tutorial && Object.assign({}, __mr.tutorial), hand:getComputedStyle(document.getElementById('hand')).display !== 'none', tip:document.getElementById('tip').textContent}));
    chk(s.n === 40 && s.step === 'Level 1 / 40', 'the pack holds 40 levels and opens on "Level 1 / 40"', JSON.stringify(s).slice(0, 140));
    const red = await p.evaluate(() => __mr.game.boxes.find(x => x.color === 'red').id), blue = await p.evaluate(() => __mr.game.boxes.find(x => x.color === 'blue').id);
    chk(s.hand && s.T && s.T.hand === red && /Tap the red box/.test(s.tip), 'level 1: the hand points at the box whose marbles are at the front', JSON.stringify([s.T, s.tip]));
    await tapBox(p, blue); await step(p, 0.3);
    chk(await p.evaluate(i => __mr.game.boxes[i].state === 'lane', blue), 'level 1: a tap on the other box does nothing while the hand shows');
    await tapBox(p, red); await step(p, 0.3);
    const s2 = await p.evaluate(i => ({st:__mr.game.boxes[i].state, step:__mr.tutorial && __mr.tutorial.step, tip:document.getElementById('tip').textContent,
      hand:getComputedStyle(document.getElementById('hand')).display !== 'none'}), red);
    chk(s2.st !== 'lane' && s2.step === 2 && /roll/.test(s2.tip) && !s2.hand, 'level 1: tapping it sends it; next tip: watch the marbles roll', JSON.stringify(s2));
    await tapBox(p, blue); await step(p, 0.3);
    chk(await p.evaluate(i => __mr.game.boxes[i].state === 'lane', blue), 'level 1: taps stay blocked while the marbles roll');
    const r = await playTo(p, 0, 120);
    chk(r.res === 'win' && r.steps.some(x => /floats away/.test(x)) && r.steps.some(x => /blue box/.test(x)), 'level 1: then "a full box floats away", the blue box, and a win', JSON.stringify(r.steps));
    await p.close(); }
  // ---- level 3: the box sent first waits in its slot until its last marbles come from the back of the other tray
  console.log('level 3 tutorial');
  { const p = await open(3);
    const r = await playTo(p, 3, 300);
    const s = await p.evaluate(() => { const T = __mr.tutorial, bx = T && __mr.game.boxes[T.box]; return {step:T && T.step, state:bx && bx.state, got:bx && bx.got, size:bx && bx.size, tip:document.getElementById('tip').textContent}; });
    chk(s.step === 3 && s.state === 'slot' && s.got > 0 && s.got < s.size && /waits in its slot/.test(s.tip), 'level 3: the first box, not full, waits in its slot (tip)', JSON.stringify(s));
    const r2 = await playTo(p, 0, 300);
    chk(r2.res === 'win' && r2.steps.some(x => /back of the other tray/.test(x)), 'level 3: it fills up from the other tray\'s back row; the level is won', JSON.stringify(r2.steps.slice(-3)));
    void r; await p.close(); }
  // ---- intro popups: first appearance only, they hold the game; the hint on level 17 does not
  console.log('intro popups and the hint');
  { const p = await open(7);
    const t0 = await p.evaluate(() => __mr.game.t); await p.waitForTimeout(1200);
    const s = await p.evaluate(() => ({open:__mr.introOpen, kind:document.getElementById('introPanel').dataset.kind, t:__mr.game.t, title:document.getElementById('introTitle').textContent,
      text:document.getElementById('introText').textContent, art:!!document.querySelector('#introArt svg'), shown:document.getElementById('introPanel').classList.contains('show')}));
    chk(s.open && s.shown && s.kind === 'hidden' && s.title === 'Hidden Box' && s.art && s.text.split('.').filter(x => x.trim()).length === 1 && s.t === t0,
      'level 7: the Hidden Box popup (title, one sentence, picture, Got it) holds the game', JSON.stringify(s));
    await p.click('#btnIntroOk'); await p.waitForTimeout(800);
    chk(await p.evaluate(t => !__mr.introOpen && __mr.game.t > t, t0), '"Got it" closes it and the level runs');
    await p.evaluate(() => { __mr.goPack(7); __mr.goPack(6); });
    chk(await p.evaluate(() => !__mr.introOpen), 'it does not come back on level 7');
    const kinds = {};
    for (const n of [13, 21, 22, 26, 32, 40]){ await p.evaluate(n => __mr.goPack(n - 1), n);
      kinds[n] = await p.evaluate(() => __mr.introOpen ? document.getElementById('introPanel').dataset.kind : null); await p.evaluate(() => { if (__mr.introOpen) __mr.closeIntro(); }); }
    chk(kinds[13] === 'connected' && kinds[22] === 'hiddenMarbles' && kinds[26] === 'dispenser' && kinds[32] === 'lock' && !kinds[21] && !kinds[40],
      'popups on 13, 22, 26 and 32; none on the combination levels 21 and 40', JSON.stringify(kinds));
    await p.close();
    const p2 = await open(7);
    chk(await p2.evaluate(() => !__mr.introOpen), 'a popup already seen stays away after a reload (saved)');
    await p2.evaluate(() => __mr.goPack(16));
    await p2.waitForFunction(() => getComputedStyle(document.getElementById('hint')).display !== 'none', null, {timeout:8000}).catch(() => {});
    const h = await p2.evaluate(() => ({on:getComputedStyle(document.getElementById('hint')).display !== 'none', text:document.getElementById('hint').textContent, held:__mr.introOpen}));
    await p2.waitForFunction(() => __mr.game.t > 0.3, null, {timeout:8000}).catch(() => {});
    chk(h.on && /threes/.test(h.text) && !h.held && await p2.evaluate(() => __mr.game.t > 0.3), 'level 17: a short hint about connected triples that does not stop the game', JSON.stringify(h));
    await p2.close(); }
  // ---- previous / next, speeds, a fail then a win (stats), the stats panel, CSV, reset
  console.log('navigation, speeds, stats');
  { const p = await open(40);
    await p.evaluate(() => { if (__mr.introOpen) __mr.closeIntro(); });
    await p.click('#btnPrev'); await p.evaluate(() => { if (__mr.introOpen) __mr.closeIntro(); });
    const a = await p.evaluate(() => [__mr.packIdx, document.getElementById('levelStep').textContent]);
    await p.click('#btnNextLv'); const c = await p.evaluate(() => [__mr.packIdx, document.getElementById('levelStep').textContent]);
    chk(a[1] === 'Level 39 / 40' && c[1] === 'Level 40 / 40', 'Previous and Next move one level', JSON.stringify([a, c]));
    const sp = []; for (let k = 0; k < 9; k++){ await p.click('#btnSpeed'); sp.push(await p.evaluate(() => __mr.timeScale + ':' + document.getElementById('btnSpeed').textContent)); }
    chk(sp.join(' ') === '1.25:1.25x 1.5:1.5x 1.75:1.75x 2:2x 2.25:2.25x 2.5:2.5x 2.75:2.75x 3:3x 1:1x', 'the speed button steps 1x, 1.25x, ... 3x and back to 1x', sp.join(' '));
    let r, k = 0, rw = 0;
    do { r = await p.evaluate(seed => { let s = seed; const rng = () => (s = (s*16807) % 2147483647)/2147483647;
      for (let i = 0; i < 4000 && !__mr.game.result; i++){ const a = __mr.C.randomPick(__mr.game, rng); if (a) __mr.tap(a.idx); __mr.advance(0.4); } __mr.advance(4); __mr.render(); return {res:__mr.game.result, t:__mr.game.resultT}; }, 11 + k++);
      if (r.res === 'win') rw++;
      if (r.res !== 'fail') await p.evaluate(() => __mr.resetGame()); } while (r.res !== 'fail' && k < 8);
    chk(r.res === 'fail' && await p.evaluate(() => document.getElementById('failPanel').classList.contains('show')), 'random play on level 40 fails (Out of Space)', JSON.stringify(r));
    await p.click('#btnRetry');
    const w = await playTo(p, 0, 900); await step(p, 5);
    const st = await p.evaluate(() => __mr.stats().f40);
    chk(w.res === 'win' && st && st.fails.length === 1 && Math.abs(st.fails[0] - r.t) < 1 && st.time > 0 && st.wins === 1 + rw, 'stats: the fail and its second, then the completion time', JSON.stringify(st));
    chk(await p.evaluate(() => document.getElementById('winPanel').classList.contains('show') && document.getElementById('btnNext').textContent === 'Finish'), 'a win on the last level offers Finish');
    await p.click('#btnNext');
    chk(await p.evaluate(() => document.getElementById('donePanel').classList.contains('show')), 'after the last level the pack ends on its done panel');
    await p.evaluate(() => __mr.goPack(0)); await step(p, 0.2);
    await p.evaluate(() => { const g = __mr.game; for (let i = 0; i < 400 && !g.result; i++){ const T = __mr.tutorial; let l = -1;
      if (T && T.hand >= 0) l = g.boxes[T.hand].lane; else { const a = __mr.C.greedyPick(g); if (a && __mr.tapAllowed(a.idx)) l = a.idx; } if (l >= 0) __mr.tap(l); __mr.advance(0.4); } __mr.advance(6); __mr.render(); });
    await p.click('#btnNext');
    chk(await p.evaluate(() => __mr.packIdx === 1 && document.getElementById('levelStep').textContent === 'Level 2 / 40'), '"Next level" after a win goes on to the next one');
    await p.click('#btnStats'); await p.waitForTimeout(300);
    const pan = await p.evaluate(() => { const rows = [...document.querySelectorAll('#statsBody tr')]; return {show:document.getElementById('statsPanel').classList.contains('show'), rows:rows.length,
      r40:rows[40] && rows[40].textContent, r1:rows[1] && rows[1].textContent}; });
    chk(pan.show && pan.rows === 41 && /Level 40/.test(pan.r40) && /\d s/.test(pan.r40) && /Level 1/.test(pan.r1), 'the Stats panel lists every level', JSON.stringify(pan));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnCsv')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split('\n');
    chk(dl.suggestedFilename() === 'marble-run-stats.csv' && csv[0] === 'level,name,completion_s,fails,fail_seconds' && csv.length === 41 && /^40,"Level 40",[\d.]+,1,"[\d.]+"$/.test(csv[40]) && /^1,"Level 1",[\d.]+,0,""$/.test(csv[1]),
      'Export CSV: one row per level with completion time, fails and their seconds', csv[1] + ' | ' + csv[40]);
    await p.click('#btnStatsReset');
    chk(await p.evaluate(() => Object.keys(__mr.stats()).length === 0), 'Reset clears the stats');
    await p.click('#btnStatsClose');
    await p.close(); }
  chk(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
  chk(!net.length, 'the pack loads nothing from the network', net.slice(0, 2).join(' '));
  await b.close();
  finish();
})().catch(e => { console.error(e); process.exit(1); });

function finish(){ console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0; }
