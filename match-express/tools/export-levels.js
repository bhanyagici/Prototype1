// The levels as plain JSON packs, next to the single files in dist/:
//   dist/funnel-40.json    the 40 funnel levels in their order (levels/funnel/funnel-order.json)
//   dist/all-levels.json   every showcase level by category (levels/showcase/showcase-order.json) and the funnel
// A pack: {type:'match-express-levels', version:1, name, categories:[{name, group?, levels:[ids]}], levels:[level, ...]};
// each level is the same JSON as its file in levels/ (an editor imports it as it is).
//   node tools/export-levels.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist'), read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const forder = read('levels/funnel/funnel-order.json').levels, funnel = forder.map(id => read(`levels/funnel/${id}.json`));
const sorder = read('levels/showcase/showcase-order.json').categories;
const cats = sorder.flatMap(c => c.groups.map(g => Object.assign({name:c.name}, g.name ? {group:g.name} : {}, {levels:g.levels})));
const showcase = cats.flatMap(c => c.levels).map(id => read(`levels/showcase/${id}.json`));
const pack = (name, categories, levels) => JSON.stringify({type:'match-express-levels', version:1, name, categories, levels}, null, 1) + '\n';
fs.mkdirSync(OUT, {recursive:true});
fs.writeFileSync(path.join(OUT, 'funnel-40.json'), pack('Match Express funnel: 40 levels', [{name:'Funnel', levels:forder}], funnel));
fs.writeFileSync(path.join(OUT, 'all-levels.json'), pack('Match Express: every level', cats.concat([{name:'Funnel', levels:forder}]), showcase.concat(funnel)));
for (const f of ['funnel-40.json', 'all-levels.json']){ const o = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size/1024).toFixed(0)} KB, ${o.levels.length} levels in ${o.categories.length} categories`); }
