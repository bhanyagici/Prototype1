// Builds the showcase: one self-contained HTML file (double-click, no server, no network) to try everything.
//   dist/marble-run-showcase.html
// It opens on a start menu of level cards in categories (levels/showcase/showcase-order.json): Basics, Blockers,
// Layouts (slides, tray shapes, lane counts), Jumps and Toy pieces, then the 40-level funnel as numbered tiles played in
// order (when levels/funnel has been built) and My Levels.  Each card shows the level's picture (levels/showcase/thumbs,
// made by tools/shoot-showcase-thumbs.js), its name and tags (difficulty, lanes, blockers, toy pieces).  The game's
// showcase mode (window.MR_SHARE.showcase) adds: the settings panel (theme, supports, box motion, camera and zoom, speed,
// sound) from the menu and in play, back to the menu, previous / next inside the category, the stats panel, and the level
// editor (carried inside) whose saved copies go to My Levels.  Settings and stats are kept in localStorage.
//   node tools/build-showcase.js
const fs = require('fs'), path = require('path');
const B = require('../shared/bundle.js'), C = require('../tests/core.js')(), {editorFile} = require('./editor-file.js');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'levels', 'showcase'), OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), clone = o => JSON.parse(JSON.stringify(o));

const order = JSON.parse(fs.readFileSync(path.join(DIR, 'showcase-order.json'), 'utf8'));
if (order.type !== 'marble-run-showcase' || !Array.isArray(order.categories)) throw new Error('showcase-order.json: not a showcase order');
const cards = {}, thumbs = {}, TOY_NAME = {xylophone:'Xylophone', bells:'Bells', wheel:'Paddle wheel', stairs:'Stairs', vortex:'Vortex', loop:'Loop'};
function blockersOf(lv){
  const N = C.normalizeLevel(clone(lv)), out = [], boxes = N.lanes.flat();
  if (boxes.some(b => b.hidden)) out.push('Hidden box');
  const groups = C.linkGroups(N);
  if (groups.some(G => G.members.length === 2)) out.push('Connected pairs');
  if (groups.some(G => G.members.length === 3)) out.push('Connected triples');
  if (N.trays.some(r => (r.dispensers || []).length)) out.push('Dispenser');
  if (N.trays.some(r => r.columns.some(c => c.some(x => typeof x === 'string' && x[0] === '?')))) out.push('Hidden marbles');
  if (N.trays.some(r => (r.crates || []).some(x => x.lock != null))) out.push('Lock & key');
  if (N.trays.some(r => (r.crates || []).some(x => x.count != null))) out.push('Count crate');
  if ((N.slide.gaps || []).length) out.push((N.slide.gaps.length > 1 ? N.slide.gaps.length + ' gaps' : 'Gap'));
  return out;
}
const toysOf = lv => [...new Set((lv.slide.toys || []).map(t => TOY_NAME[t.kind] || t.kind))];
function check(lv, id){
  const ck = C.checkLevel(clone(lv));
  if (!ck.balanced) throw new Error(`${id}: holes and marbles do not match`);
  if (ck.warnings.length) throw new Error(`${id}: ${ck.warnings.map(w => w.msg).join('; ')}`);
  const g = C.simulate(clone(lv), C.greedyPick, null, C.SIM_DT);
  if (g.result !== 'win') throw new Error(`${id}: the greedy bot does not win`);
}
const levels = [];
for (const cat of order.categories) for (const grp of cat.groups) for (const id of grp.levels){
  const lv = JSON.parse(fs.readFileSync(path.join(DIR, cat.dir, id + '.json'), 'utf8'));
  if (lv.id !== id) throw new Error(`${id}.json has id ${lv.id}`);
  check(lv, id);
  cards[id] = {diff:(lv.meta && lv.meta.difficulty) || null, blockers:blockersOf(lv), toys:toysOf(lv)};
  const tf = path.join(DIR, 'thumbs', id + '.jpg');
  if (fs.existsSync(tf)) thumbs[id] = 'data:image/jpeg;base64,' + fs.readFileSync(tf).toString('base64');
  else console.warn(`${id}: no picture (run tools/shoot-showcase-thumbs.js)`);
  levels.push(lv);
}
// the 40-level funnel as a category of its own, played in order (numbered tiles; its tutorials, popups and hint come
// from each level's meta, as in the 40-level file)
const categories = order.categories.map(c => ({name:c.name, groups:c.groups}));
let funnel = [];
const FDIR = path.join(ROOT, 'levels', 'funnel'), FORDER = path.join(FDIR, 'funnel-order.json');
if (fs.existsSync(FORDER)){
  const forder = JSON.parse(fs.readFileSync(FORDER, 'utf8')), rp = path.join(FDIR, 'funnel-report.json');
  const freport = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')).levels || {} : {};
  funnel = forder.levels.map((id, k) => {
    const lv = JSON.parse(fs.readFileSync(path.join(FDIR, id + '.json'), 'utf8'));
    if (lv.id !== id) throw new Error(`${id}.json has id ${lv.id}`);
    check(lv, id);
    cards[id] = {num:k + 1, role:((lv.meta && lv.meta.role) || '').split(/[ (]/)[0] || null, diff:freport[id] ? C.difficulty(freport[id].rate) : null, blockers:blockersOf(lv), toys:toysOf(lv)};
    return Object.assign(lv, {name:'Level ' + (k + 1)});
  });
  categories.push({name:'Funnel: 40 levels in order', ordered:true, groups:[{name:null, levels:forder.levels}]});
} else console.warn('no funnel yet (levels/funnel/funnel-order.json): the showcase is built without it');
const game = B.inlineGame(read('index.html'), {core:read('shared/core.js'), sync:read('shared/sync.js'), three:read('vendor/three.module.min.js')});
const title = 'Marble Run — Showcase';
let html = B.withShare(game, {levels:levels.concat(funnel), nosim:true, noSaved:true, nav:true, stats:true, statsKey:'showcase', title,
  showcase:{categories, cards, thumbs}}, title);
// the level editor rides along (base64): the menu's pencil opens it over the showcase
html = html.replace('</body>', () => `<script type="text/plain" id="mr-editor">\n${B.b64(editorFile(game))}\n</script>\n</body>`);
fs.mkdirSync(OUT, {recursive:true});
const file = path.join(OUT, 'marble-run-showcase.html');
fs.writeFileSync(file, html);
console.log(`dist/marble-run-showcase.html  ${(fs.statSync(file).size/1024).toFixed(0)} KB, ${levels.length} showcase levels in ${order.categories.length} categories` +
  `${funnel.length ? ', the ' + funnel.length + '-level funnel' : ''}, the editor`);
