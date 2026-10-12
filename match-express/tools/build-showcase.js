// Builds the showcase: one self-contained HTML file (double-click, no server, no network) to try everything.
//   dist/match-express-showcase.html
// It opens on a start menu of level cards in categories (levels/showcase/showcase-order.json): Basics, Blockers and
// Layouts (roads, ramp shapes, lane counts); each card shows the level's picture (levels/showcase/thumbs, made by
// tools/shoot-showcase-thumbs.js), its name and tags (difficulty, lanes, blockers).  The game's showcase mode
// (window.ME_SHARE.showcase) adds: the settings panel (theme, Rigid / Articulated buses, speed 1x-2x, sound) from the menu
// and in play, back to the menu, previous / next inside the category, restart, the booster bar and the stats panel.
// Settings are kept in localStorage.
//   node tools/build-showcase.js
const fs = require('fs'), path = require('path');
const B = require('../shared/bundle.js'), C = require('../tests/core.js')();
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'showcase'), OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), clone = o => JSON.parse(JSON.stringify(o));

const order = JSON.parse(fs.readFileSync(path.join(DIR, 'showcase-order.json'), 'utf8'));
if (order.type !== 'match-express-showcase' || !Array.isArray(order.categories)) throw new Error('showcase-order.json: not a showcase order');
const ids = order.categories.flatMap(c => c.groups.flatMap(g => g.levels));
const cards = {}, thumbs = {};
const levels = ids.map(id => {
  const lv = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8'));
  if (lv.id !== id) throw new Error(`${id}.json has id ${lv.id}`);
  const ck = C.checkLevel(clone(lv));
  if (!ck.balanced) throw new Error(`${id}: seats and stickmen do not match`);
  if (ck.warnings.length) throw new Error(`${id}: ${ck.warnings.map(w => w.msg).join('; ')}`);
  const g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
  if (g.result !== 'win') throw new Error(`${id}: the greedy bot does not win`);
  cards[id] = {diff:(lv.meta && lv.meta.difficulty) || null, blockers:blockersOf(lv)};
  const tf = path.join(DIR, 'thumbs', id + '.jpg');
  if (fs.existsSync(tf)) thumbs[id] = 'data:image/jpeg;base64,' + fs.readFileSync(tf).toString('base64');
  else console.warn(`${id}: no picture (run tools/shoot-showcase-thumbs.js)`);
  return lv;
});
function blockersOf(lv){
  const N = C.normalizeLevel(clone(lv)), out = [], buses = N.lanes.flat();
  if (buses.some(b => b.hidden)) out.push('Hidden bus');
  const groups = C.linkGroups(N);
  if (groups.some(G => G.members.length === 2)) out.push('Connected pairs');
  if (groups.some(G => G.members.length === 3)) out.push('Connected triples');
  if (N.ramps.some(r => (r.tunnels || []).length)) out.push('Colourful tunnel');
  if (N.ramps.some(r => r.columns.some(c => c.some(x => typeof x === 'string' && x[0] === '?')))) out.push('Hidden stickmen');
  if (N.ramps.some(r => (r.boxes || []).some(x => x.lock))) out.push('Lock & key');
  if (N.ramps.some(r => (r.boxes || []).some(x => x.count != null && !x.lock))) out.push('Count box');
  return out;
}
const game = B.inlineGame(read('index.html'), {core:read('shared/core.js'), sync:read('shared/sync.js'), three:read('vendor/three.module.min.js')});
const title = 'Match Express — Showcase';
const html = B.withShare(game, {levels, nosim:true, noSaved:true, nav:true, stats:true, statsKey:'showcase', title,
  showcase:{categories:order.categories, cards, thumbs}}, title);
fs.mkdirSync(OUT, {recursive:true});
const file = path.join(OUT, 'match-express-showcase.html');
fs.writeFileSync(file, html);
console.log(`dist/match-express-showcase.html  ${(fs.statSync(file).size/1024).toFixed(0)} KB, ${levels.length} levels in ${order.categories.length} categories`);
