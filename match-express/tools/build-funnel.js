// Builds the 40-level funnel pack: one self-contained HTML (double-click, no server, no network) that plays
// levels/funnel/f01.json ... f40.json in the order of levels/funnel/funnel-order.json.
//   dist/match-express-funnel-40.html
// The pack turns on the game's level-pack extras (window.ME_SHARE): nav (previous / next buttons, "Level x / 40" in the
// title pill, a won level moves on to the next one) and stats (per level: completion time, fails and the second of each
// fail, kept in localStorage, with Export CSV and Reset stats). Tutorials, intro popups and hints come from each
// level's meta (tutorial, popup, hint), written by tools/make-funnel.js.
//   node tools/build-funnel.js
const fs = require('fs'), path = require('path');
const B = require('../shared/bundle.js'), C = require('../tests/core.js')();
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'funnel'), OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const order = JSON.parse(fs.readFileSync(path.join(DIR, 'funnel-order.json'), 'utf8'));
if (order.type !== 'match-express-level-order' || !Array.isArray(order.levels)) throw new Error('funnel-order.json: not a level order');
const levels = order.levels.map(id => {
  const lv = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'));
  if (lv.id !== id) throw new Error(`${id}.json has id ${lv.id}`);
  const ck = C.checkLevel(JSON.parse(JSON.stringify(lv)));
  if (!ck.balanced) throw new Error(`${id}: seats and stickmen do not match`);
  if (ck.warnings.length) throw new Error(`${id}: ${ck.warnings.map(w => w.msg).join('; ')}`);
  return lv;
});
const game = B.inlineGame(read('index.html'), {core:read('shared/core.js'), sync:read('shared/sync.js'), three:read('vendor/three.module.min.js')});
const title = `Match Express — ${levels.length} levels`;
const html = B.withShare(game, {levels, nosim:true, noSaved:true, nav:true, stats:true, statsKey:'funnel-40', title}, title);
fs.mkdirSync(OUT, {recursive:true});
const file = path.join(OUT, 'match-express-funnel-40.html');
fs.writeFileSync(file, html);
console.log(`dist/match-express-funnel-40.html  ${(fs.statSync(file).size/1024).toFixed(0)} KB, ${levels.length} levels: ${order.levels[0]} ... ${order.levels[order.levels.length - 1]}`);
