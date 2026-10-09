// The 40-level funnel: the level files (levels/funnel) against the design table (tools/funnel/specs.js), the bots,
// and the 40-level pack (tools/build-funnel.js -> dist/match-express-funnel-40.html) opened from file:// at 390x844:
// level 1 and level 3 tutorials (the hand, blocked taps), the intro popups (first appearance only, they hold the game),
// the level 17 hint, previous / next and "Level x / 40", a win moving on by itself, the stats panel (completion time,
// fails and their second, Export CSV, Reset stats), 1x / 2x and the front bus outline and size.
//   node tests/funnel.test.js        (the browser part needs playwright; same CHROMIUM env as browser.test.js)
const fs = require('fs'), path = require('path'), {pathToFileURL} = require('url');
const C = require('./core.js')(), SPECS = require('../tools/funnel/specs.js');
const DIR = path.join(__dirname, '..', 'levels', 'funnel');
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const id = n => 'f' + String(n).padStart(2, '0');

/* ---------------------------------------------------------------- the level files */
const orderFile = JSON.parse(fs.readFileSync(path.join(DIR, 'funnel-order.json'), 'utf8')), order = orderFile.levels;
chk(orderFile.type === 'match-express-level-order' && order.join() === SPECS.map(s => id(s.n)).join(), 'funnel-order.json lists f01 ... f40 in order');
const LV = {}; order.forEach(i => { LV[i] = JSON.parse(fs.readFileSync(path.join(DIR, i + '.json'), 'utf8')); });
const probs = [];
for (const s of SPECS){
  const lv = LV[id(s.n)], ck = C.checkLevel(JSON.parse(JSON.stringify(lv))), sizes = new Set(lv.lanes.flat().map(b => b.cap));
  const p = [];
  if (lv.id !== id(s.n)) p.push('id ' + lv.id);
  if (C.normalizeLevel(JSON.parse(JSON.stringify(lv))).lanes.length !== (s.lanes || 3)) p.push(`${lv.lanes.length} lanes (want ${s.lanes || 3})`);
  if (!ck.balanced) p.push('seats != stickmen');
  if (ck.warnings.length) p.push('warnings: ' + ck.warnings.map(w => w.kind).join(','));
  if (ck.totalMen !== s.men) p.push(`stickmen ${ck.totalMen} (want ${s.men})`);
  const cols = ck.perColor.filter(c => c.men);
  if (cols.length !== s.colors) p.push(`${cols.length} colours (want ${s.colors})`);
  cols.forEach(c => { if (c.men !== c.seats || c.men % 2 || c.men < 4) p.push(`${c.color} ${c.men} stickmen / ${c.seats} seats`); });
  if ([...sizes].some(x => !s.sizes.includes(x)) || s.sizes.some(x => !sizes.has(x))) p.push(`sizes ${[...sizes].sort((a, b) => a - b)} (want ${s.sizes})`);
  if (lv.ramps.length !== s.ramps.length) p.push(`${lv.ramps.length} ramps (want ${s.ramps.length})`);
  const B = s.blockers || {}, flat = lv.lanes.flat(), links = {}; flat.forEach(b => { if (b.link) links[b.link] = (links[b.link] || 0) + 1; });
  if (!!B.hidden !== flat.some(b => b.hidden)) p.push('hidden buses');
  if (!!B.link !== Object.keys(links).length > 0) p.push('connected buses');
  if (!!B.tunnel !== lv.ramps.some(r => (r.tunnels || []).length)) p.push('tunnels');
  if (!!B.lock !== lv.ramps.some(r => (r.boxes || []).some(x => x.lock != null))) p.push('lock box');
  if (B.lock && !flat.some(b => b.key)) p.push('no key bus');
  if (p.length) probs.push(`${id(s.n)}: ${p.join('; ')}`);
}
chk(!probs.length, 'every level matches its row of the design table (queue lanes, stickmen, colours, seats per colour, sizes, ramps, blockers) and passes the checker', probs.join(' | '));
{ const n = {}; SPECS.forEach(s => { (n[s.lanes || 3] = n[s.lanes || 3] || []).push(s.n); });
  chk(n[2].join() === '1,2,3,4,5,9,22,31' && n[4].join() === '16,20,23,35' && n[5].join() === '38,40' && SPECS.filter(s => s.n >= 25 && s.n <= 30).every(s => (s.lanes || 3) === 3),
    'lanes: 2 on f01-f05, f09, f22, f31; 4 on f16, f20, f23, f35; 5 on f38, f40; 3 elsewhere (f25-f30 always 3)', JSON.stringify(n)); }
// meta: tutorials, popups and the hint only where the design puts them; combination levels have no popup
const metas = order.map(i => LV[i].meta || {});
const at = k => order.filter((i, n) => metas[n][k]).map(i => +i.slice(1) + ':' + LV[i].meta[k]).join(' ');
chk(at('tutorial') === '1:first-sends 3:bay-resend', 'tutorials on levels 1 and 3', at('tutorial'));
chk(at('popup') === '7:hidden 13:connected 26:tunnel 32:lock', 'intro popups on levels 7, 13, 26 and 32 only', at('popup'));
chk(at('hint') === '17:triple', 'a short hint on level 17 only', at('hint'));
chk(C.normalizeLevel(JSON.parse(JSON.stringify(LV.f07))).meta.popup === 'hidden', 'the core keeps a level\'s meta through normalizeLevel');
// no two consecutive levels look alike: road description or ramp idea changes every level
const same = SPECS.slice(1).filter((s, k) => s.road === SPECS[k].road && s.rampIdea === SPECS[k].rampIdea).map(s => s.n);
chk(!same.length, 'no two consecutive levels share both road and ramp shape', same.join(','));

/* ---------------------------------------------------------------- the bots */
const greedy = order.map(i => [i, C.simulate(LV[i], C.greedyPick, null, C.SIM_DT)]);
const lost = greedy.filter(([, g]) => g.result !== 'win');
chk(!lost.length, 'the greedy bot wins all 40 levels', lost.map(([i, g]) => i + ' ' + g.result).join(', '));
const t1 = greedy.reduce((a, [, g]) => a + g.t, 0);
chk(t1/120 >= 35, 'greedy playtime at 2x is at least 35 minutes', `${(t1/60).toFixed(1)} min at 1x, ${(t1/120).toFixed(1)} min at 2x`);
let early = 0; for (let n = 1; n <= 5; n++) for (let r = 0; r < 120; r++) if (C.simulate(LV[id(n)], C.randomPick, C.mulberry32(9000 + r), C.SIM_DT).result !== 'win') early++;
chk(!early, 'levels 1-5 cannot be lost: 600 random games, no loss', early + ' losses');
{ // level 3 is built so the first bus sent (the tutorial's) comes back not full and parks in a bay
  const g = C.createGame(LV.f03, {headless:true}), b = g.buses[g.lanes[LV.f03.meta.tutorialLane][0]];
  C.tapLane(g, LV.f03.meta.tutorialLane); let parked = false;
  for (let i = 0; i < 60*40 && !parked; i++){ C.step(g, C.SIM_DT); parked = b.state === 'bay'; }
  chk(parked && b.seated > 0 && b.seated < b.cap, 'level 3: the tutorial bus returns not full and parks', `${b.color}${b.cap} ${b.state} ${b.seated}/${b.cap}`);
}
{ // two ramps at the same spot of the road (level 40 has two such pairs): a bus checks both
  const L = C.buildLayout(JSON.parse(JSON.stringify(LV.f40))), s = L.RAMPS.map(r => r.s.toFixed(3));
  chk(s.some((x, k) => k && x === s[k - 1]), 'level 40 has ramps sharing a boarding spot', s.join(' '));
  const lv = JSON.parse(JSON.stringify(LV.f02)), [r0, r1] = lv.ramps;
  r1.at = r0.at; r1.side = -r0.side; delete r1.shape; delete r1.push;               // the second ramp straight across the road
  const paint = (r, c) => { r.columns = r.columns.map(col => col.map(() => c)); };
  const NL = C.normalizeLevel(JSON.parse(JSON.stringify(lv))), Lx = C.buildLayout(NL),   // a copy: normalizeLevel caches by object
    second = Lx.RAMPS[1].src, first = Lx.RAMPS[0].src;
  paint(lv.ramps[first], 'blue'); paint(lv.ramps[second], 'red');
  lv.lanes = [[{color:'red', cap:8}], [], [{color:'blue', cap:8}]];      // (only where the red bus stops matters)
  const g = C.createGame(JSON.parse(JSON.stringify(lv)), {headless:true}); C.tapLane(g, 0);
  for (let i = 0; i < 60*30 && !g.buses[0].board && g.buses[0].state !== 'tunnel'; i++) C.step(g, C.SIM_DT);
  chk(Lx.RAMPS[0].s === Lx.RAMPS[1].s && !!g.buses[0].board && g.buses[0].board.k === 1, 'a bus boards at the second of two ramps on the same spot',
      `s ${Lx.RAMPS[0].s.toFixed(2)} / ${Lx.RAMPS[1].s.toFixed(2)}, ${g.buses[0].state}${g.buses[0].board ? ' boarding ramp ' + g.buses[0].board.k : ''}`);
}

/* ---------------------------------------------------------------- the 40-level pack in a browser */
let chromium;
try { ({chromium} = require('playwright')); } catch (e) { console.log('SKIP browser part: playwright is not installed'); finish(); return; }
require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'build-funnel.js')], {stdio:'inherit'});
const PACK = pathToFileURL(path.join(__dirname, '..', 'dist', 'match-express-funnel-40.html')).href;
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args:['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
  const ctx = await b.newContext({viewport:{width:390, height:844}, acceptDownloads:true}), errs = [], net = [];
  const open = async (n) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('request', r => { if (/^https?:/.test(r.url())) net.push(r.url()); });
    await p.goto(PACK + (n ? '?n=' + n : '')); await p.waitForFunction(() => window.__me && __me.game, null, {timeout:90000}); await p.evaluate(() => __me.freeze(true)); return p; };
  const step = (p, sec) => p.evaluate(s => { __me.advance(s); __me.render(); }, sec || 0.2);
  const clickBus = async (p, busId) => { const [x, y] = await p.evaluate(i => { const [x0, y0, x1, y1] = __me.busScreenBox(__me.game.buses[i]), r = document.getElementById('app').getBoundingClientRect(), k = r.width/900;
      return [r.left + (x0 + x1)/2*k, r.top + (y0 + y1)/2*k]; }, busId); await p.mouse.click(x, y); };
  // a player who follows the hand: the tutorial's bus while the hand shows, otherwise the greedy choice
  const playTo = (p, until, maxSec) => p.evaluate(([until, maxSec]) => {
    const seen = new Set();
    for (let i = 0; i < maxSec/0.4 && !__me.game.result; i++){ const T = __me.tutorial; if (T) seen.add(T.step + ':' + T.tip);
      if (until && T && T.step === until) break;
      let a = null; if (T && T.hand >= 0){ const bb = __me.game.buses[T.hand]; a = bb.state === 'lane' ? {kind:'lane', idx:bb.lane} : {kind:'bay', idx:__me.game.bays.indexOf(bb.id)}; }
      else { a = __me.C.greedyPick(__me.game); if (a && T && a.kind === 'bay' && __me.game.bays[a.idx] === T.bus) a = null; }   // the tutorial's bus waits for the hand
      if (a) __me.tap(a); __me.advance(0.4); }
    __me.render(); return {res:__me.game.result, t:__me.game.t, steps:[...seen], tut:__me.tutorial}; }, [until || 0, maxSec || 600]);

  // ---- level 1: the pack opens on it; the tutorial leads the first sends and blocks other taps
  { const p = await open();
    const s = await p.evaluate(() => ({n:__me.playlist.length, pill:document.getElementById('levelPill').textContent, prev:document.getElementById('btnPrev').classList.contains('dis'),
      next:document.getElementById('btnNextLv').classList.contains('dis'), T:__me.tutorial, hand:document.getElementById('hand').classList.contains('show')}));
    chk(s.n === 40 && s.pill === 'Level 1 / 40' && s.prev && !s.next, 'the pack holds 40 levels, opens on "Level 1 / 40", Previous is off on level 1', JSON.stringify(s).slice(0, 120));
    const red = await p.evaluate(() => __me.game.buses.find(x => x.color === 'red').id), blue = await p.evaluate(() => __me.game.buses.find(x => x.color === 'blue').id);
    chk(s.hand && s.T && s.T.hand === red && /matches the front row/.test(s.T.tip), 'level 1: the hand points at the bus that matches the front row', JSON.stringify(s.T));
    await step(p, 0.4);
    const rg = await p.evaluate(() => __me.game.buses.filter(b => __me.views[b.id].ring.visible && __me.views[b.id].ring.material.opacity > 0.5).map(b => b.id));
    chk(rg.length === 1 && rg[0] === red, 'level 1: only the bus the hand points at wears the outline', JSON.stringify(rg));
    await clickBus(p, blue); await step(p, 0.3);
    chk(await p.evaluate(i => __me.game.buses[i].state === 'lane', blue), 'level 1: a tap on another bus does nothing while the hand shows');
    await clickBus(p, red); await step(p, 0.3);
    const s2 = await p.evaluate(i => ({st:__me.game.buses[i].state, T:__me.tutorial, hand:document.getElementById('hand').classList.contains('show')}), red);
    chk(s2.st !== 'lane' && s2.T.step === 2 && /board/.test(s2.T.tip) && !s2.hand, 'level 1: tapping it sends it; next tip: watch the stickmen board', JSON.stringify(s2));
    await clickBus(p, blue); await step(p, 0.3);
    chk(await p.evaluate(i => __me.game.buses[i].state === 'lane', blue), 'level 1: taps stay blocked while the stickmen board');
    const r = await playTo(p, 0, 120);
    chk(r.res === 'win' && r.steps.some(x => /parachute/.test(x)) && r.steps.some(x => /blue bus/.test(x)), 'level 1: then the parachute tip, the second bus, and a win', JSON.stringify(r.steps));
    // outside a tutorial no bus wears the outline; the front bus is 10% larger than the bus behind it
    await p.evaluate(() => __me.goLevel(1)); await step(p, 0.5);
    const q = await p.evaluate(() => { const g = __me.game, v = __me.views, l = g.lanes.findIndex(x => x.length > 1), f = v[g.lanes[l][0]], bh = v[g.lanes[l][1]];
      return {front:f.root.scale.x, behind:bh.root.scale.x, ring:g.buses.some(b => v[b.id].ring.visible)}; });
    chk(Math.abs(q.front/q.behind - 1.1) < 0.02 && !q.ring, 'no bus has the tap outline outside a tutorial; the front bus is 10% larger than the bus behind it', JSON.stringify(q));
    await p.close(); }
  // ---- level 3: the first bus parks, then the hand points at it once its colour is reachable
  { const p = await open(3);
    const r = await playTo(p, 4, 300), T = r.tut;
    const s = await p.evaluate(() => { const T = __me.tutorial, bb = T && __me.game.buses[T.hand]; return {state:bb && bb.state, seated:bb && bb.seated, cap:bb && bb.cap, hand:document.getElementById('hand').classList.contains('show'),
      front:bb && __me.C.frontColors(__me.game)[bb.color]}; });
    chk(T && T.step === 4 && s.state === 'bay' && s.seated < s.cap && s.front > 0 && s.hand && /parked bus/.test(T.tip),
        'level 3: the parked bus (not full) gets the hand once its colour is at the front again', JSON.stringify([T, s]));
    await step(p, 0.4);
    const rg3 = await p.evaluate(() => __me.game.buses.filter(b => __me.views[b.id].ring.visible && __me.views[b.id].ring.material.opacity > 0.5).map(b => b.id));
    chk(rg3.length === 1 && rg3[0] === T.hand, 'level 3: the parked bus the hand points at wears the outline, nothing else does', JSON.stringify(rg3));
    const other = await p.evaluate(() => { const l = __me.game.lanes.findIndex(x => x.length); return l < 0 ? -1 : __me.game.lanes[l][0]; });
    if (other >= 0){ await clickBus(p, other); await step(p, 0.3); chk(await p.evaluate(i => __me.game.buses[i].state === 'lane', other), 'level 3: other buses wait while the hand points at the parked bus'); }
    const r2 = await playTo(p, 0, 300);
    chk(r2.res === 'win' && r2.steps.some(x => /sent again/.test(x)), 'level 3: sending it again ends the tutorial; the level is won', JSON.stringify(r2.steps.slice(-2)));
    await p.close(); }
  // ---- intro popups: first appearance only, they hold the game; the hint on level 17 does not
  { const p = await open(7);
    const t0 = await p.evaluate(() => __me.game.t); await p.evaluate(() => __me.freeze(false)); await p.waitForTimeout(1200);
    const s = await p.evaluate(() => ({intro:__me.intro, t:__me.game.t, title:document.getElementById('introTitle').textContent, text:document.getElementById('introText').textContent,
      art:!!document.querySelector('#introArt svg'), ok:!!document.getElementById('btnIntroOk')}));
    chk(s.intro === 'hidden' && s.title === 'Hidden Bus' && s.art && s.ok && s.text.split('.').filter(Boolean).length === 1 && s.t === t0,
        'level 7: the Hidden Bus popup (title, one sentence, picture, OK) holds the game', JSON.stringify(s));
    await p.click('#btnIntroOk'); await p.waitForTimeout(800);
    chk(await p.evaluate(t => !__me.intro && __me.game.t > t, t0), 'OK closes it and the level runs');
    await p.evaluate(() => { __me.goLevel(7); __me.goLevel(6); });
    chk(await p.evaluate(() => __me.intro === null), 'it does not come back on level 7');
    const kinds = {};
    for (const n of [13, 16, 21, 26, 32, 40]){ await p.evaluate(n => __me.goLevel(n - 1), n); kinds[n] = await p.evaluate(() => __me.intro); await p.evaluate(() => { if (__me.intro) __me.closeIntro(); }); }
    chk(kinds[13] === 'connected' && kinds[26] === 'tunnel' && kinds[32] === 'lock' && !kinds[16] && !kinds[21] && !kinds[40], 'popups on 13, 26 and 32; none on the combination levels 16, 21 and 40', JSON.stringify(kinds));
    await p.close();
    const p2 = await open(7);
    chk(await p2.evaluate(() => __me.intro === null), 'a popup already seen stays away after a reload (saved)');
    await p2.evaluate(() => { __me.goLevel(16); __me.freeze(false); });
    await p2.waitForFunction(() => document.getElementById('hint').classList.contains('show'), null, {timeout:8000}).catch(() => {});
    const h0 = await p2.evaluate(() => ({on:document.getElementById('hint').classList.contains('show'), text:document.getElementById('hint').textContent, held:__me.held}));
    await p2.waitForFunction(() => __me.game.t > 0.3, null, {timeout:8000}).catch(() => {});
    const h = Object.assign(h0, {t:await p2.evaluate(() => __me.game.t)});
    chk(h.on && /threes/.test(h.text) && !h.held && h.t > 0.3, 'level 17: a short hint about triple connected buses that does not stop the game', JSON.stringify(h));
    await p2.close(); }
  // ---- previous / next, a win moves on, stats (completion time, fails, CSV, reset), 1x / 2x
  { const p = await open(40);
    await p.evaluate(() => { if (__me.intro) __me.closeIntro(); });
    await p.click('#btnPrev'); await p.evaluate(() => { if (__me.intro) __me.closeIntro(); });
    const a = await p.evaluate(() => [__me.playIdx, document.getElementById('levelPill').textContent]);
    await p.click('#btnNextLv'); const c = await p.evaluate(() => [__me.playIdx, document.getElementById('levelPill').textContent, document.getElementById('btnNextLv').classList.contains('dis')]);
    chk(a[1] === 'Level 39 / 40' && c[1] === 'Level 40 / 40' && c[2], 'Previous and Next move one level; Next is off on level 40', JSON.stringify([a, c]));
    await p.click('#btnSpeed'); const sp = await p.evaluate(() => [__me.timeScale, document.getElementById('btnSpeed').textContent]); await p.click('#btnSpeed');
    chk(sp[0] === 2 && sp[1] === '2x' && await p.evaluate(() => __me.timeScale === 1), 'the 1x / 2x button switches the speed');
    // a fail (random play), a retry, then a win (greedy play)
    let r, k = 0;
    do { r = await p.evaluate(seed => { let s = seed; const rng = () => (s = (s*16807) % 2147483647)/2147483647;
      for (let i = 0; i < 4000 && !__me.game.result; i++){ const a = __me.C.randomPick(__me.game, rng); if (a) __me.tap(a); __me.advance(0.4); } __me.advance(4); __me.render(); return {res:__me.game.result, t:__me.game.t}; }, 11 + k++);
      if (r.res !== 'fail') await p.evaluate(() => __me.restart()); } while (r.res !== 'fail' && k < 8);
    chk(r.res === 'fail' && await p.evaluate(() => document.getElementById('failPanel').classList.contains('show')), 'random play on level 40 fails (Out of Space)', JSON.stringify(r));
    await p.click('#btnRetry');
    const w = await playTo(p, 0, 900); await step(p, 5);
    const st = await p.evaluate(() => __me.stats().f40);
    chk(w.res === 'win' && st && st.fails.length === 1 && Math.abs(st.fails[0] - r.t) < 6 && st.time > 0 && st.wins === 1, 'stats: the fail and its second, then the completion time', JSON.stringify(st));
    chk(await p.evaluate(() => document.getElementById('winPanel').classList.contains('show') && document.getElementById('btnNext').classList.contains('auto')), 'a win shows the countdown to the next level');
    await p.waitForTimeout(await p.evaluate(() => __me.AUTO_MS) + 800);
    chk(await p.evaluate(() => document.getElementById('donePanel').classList.contains('show')), 'after the last level the pack ends on "All levels complete"');
    await p.evaluate(() => __me.goLevel(0)); await p.waitForTimeout(300);
    await p.evaluate(() => { const g = __me.game; for (let i = 0; i < 400 && !g.result; i++){ const a = __me.C.greedyPick(g); if (a) __me.tap(a); __me.advance(0.4); } __me.advance(6); __me.render(); });
    await p.waitForTimeout(await p.evaluate(() => __me.AUTO_MS) + 800);
    chk(await p.evaluate(() => __me.playIdx === 1 && document.getElementById('levelPill').textContent === 'Level 2 / 40'), 'winning a level goes on to the next one');
    await p.click('#btnStats'); await p.waitForTimeout(300);
    const pan = await p.evaluate(() => ({show:document.getElementById('statsPanel').classList.contains('show'), held:__me.held, rows:document.querySelectorAll('#statsBody tr').length,
      r40:[...document.querySelectorAll('#statsBody tr')][40].textContent, r1:[...document.querySelectorAll('#statsBody tr')][1].textContent}));
    chk(pan.show && pan.held && pan.rows === 42 && /^40/.test(pan.r40) && /^1\d/.test(pan.r1), 'the Stats panel lists every level (and holds the game)', JSON.stringify(pan));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnCsv')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split('\n');
    chk(dl.suggestedFilename() === 'match-express-stats.csv' && csv[0] === 'level,id,name,completion_s,fails,fail_seconds,wins' && csv.length === 41 && /^40,f40,Level 40,[\d.]+,1,[\d.]+,1$/.test(csv[40]) && /^1,f01,Level 1,[\d.]+,0,,[1-9]\d*$/.test(csv[1]),
        'Export CSV: one row per level with completion time, fails and their seconds', csv[1] + ' | ' + csv[40]);
    await p.click('#btnStatsReset'); const one = await p.evaluate(() => Object.keys(__me.stats()).length);
    await p.click('#btnStatsReset'); const two = await p.evaluate(() => [Object.keys(__me.stats()).length, localStorage.getItem('me-stats:funnel-40')]);
    chk(one >= 2 && two[0] === 0 && two[1] === null, 'Reset stats asks once more, then clears them (also from localStorage)', JSON.stringify([one, two]));
    await p.click('#btnStatsClose');
    chk(await p.evaluate(() => !__me.held), 'Close goes back to the game');
    await p.close(); }
  chk(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
  chk(!net.length, 'the pack loads nothing from the network', net.slice(0, 2).join(' '));
  await b.close();
  finish();
})().catch(e => { console.error(e); process.exit(1); });

function finish(){ console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0; }
