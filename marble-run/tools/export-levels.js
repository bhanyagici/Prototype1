// The levels as plain JSON, next to the single files in dist/:
//   dist/funnel-40.json          the 40 funnel levels in their order (levels/funnel/funnel-order.json)
//   dist/all-levels.json         every showcase level by category (levels/showcase/showcase-order.json) and the funnel
//   dist/marble-run-levels.zip   one file per level: funnel/f01.json ... f40.json with funnel-order.json, and
//                                showcase/<category>/<id>.json with showcase-order.json
// A pack: {type:'marble-run-levels', version:1, name, categories:[{name, group?, levels:[ids]}], levels:[level, ...]};
// each level is the same JSON as its file in levels/ (the editor imports it as it is).
//   node tools/export-levels.js      (the zip needs the zip command)
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist'), read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const forder = read('levels/funnel/funnel-order.json').levels, funnel = forder.map(id => read(`levels/funnel/${id}.json`));
const sorder = read('levels/showcase/showcase-order.json').categories;
const cats = sorder.flatMap(c => c.groups.map(g => Object.assign({name:c.name}, g.name ? {group:g.name} : {}, {levels:g.levels})));
const dirOf = Object.fromEntries(sorder.flatMap(c => c.groups.flatMap(g => g.levels.map(id => [id, c.dir]))));
const showcase = cats.flatMap(c => c.levels).map(id => read(`levels/showcase/${dirOf[id]}/${id}.json`));
const pack = (name, categories, levels) => JSON.stringify({type:'marble-run-levels', version:1, name, categories, levels}, null, 1) + '\n';
fs.mkdirSync(OUT, {recursive:true});
fs.writeFileSync(path.join(OUT, 'funnel-40.json'), pack('Marble Run funnel: 40 levels', [{name:'Funnel', levels:forder}], funnel));
fs.writeFileSync(path.join(OUT, 'all-levels.json'), pack('Marble Run: every level', cats.concat([{name:'Funnel', levels:forder}]), showcase.concat(funnel)));
for (const f of ['funnel-40.json', 'all-levels.json']){ const o = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size/1024).toFixed(0)} KB, ${o.levels.length} levels in ${o.categories.length} categories`); }
// the zip: the level files exactly as they are in levels/ (the pictures stay out)
const zip = path.join(OUT, 'marble-run-levels.zip'); if (fs.existsSync(zip)) fs.unlinkSync(zip);
const files = ['funnel/funnel-order.json', ...forder.map(id => `funnel/${id}.json`), 'showcase/showcase-order.json', ...cats.flatMap(c => c.levels).map(id => `showcase/${dirOf[id]}/${id}.json`)];
execFileSync('zip', ['-q', '-X', zip, ...files], {cwd:path.join(ROOT, 'levels')});
console.log(`dist/marble-run-levels.zip  ${(fs.statSync(zip).size/1024).toFixed(0)} KB, ${files.length} files (${forder.length} funnel levels, ${showcase.length} showcase levels, 2 orders)`);
