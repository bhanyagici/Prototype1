// Pretty-prints a level as the compact JSON used in levels/: one line per road point / ramp column / bus.
//   const fmt = require('./level-format.js'); fs.writeFileSync(file, fmt(level) + '\n');
const prim = x => x === null || typeof x !== 'object';
const flat = o => !Array.isArray(o) && Object.values(o).every(y => prim(y) || (Array.isArray(y) ? y.every(prim) || y.every(z => Array.isArray(z) && z.every(prim)) : Object.values(y).every(prim)));
const one = v => JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/,(?=[-\d\[n"])/g, ', ');
function fmt(v, ind = ''){
  if (Array.isArray(v)){
    if (v.every(prim)) return one(v);
    if (v.every(x => Array.isArray(x) && x.every(prim)) && JSON.stringify(v).length < 60) return one(v);
    if (v.every(x => x && typeof x === 'object' && flat(x))) return '[\n' + v.map(x => ind + '  ' + one(x)).join(',\n') + '\n' + ind + ']';
    return '[\n' + v.map(x => ind + '  ' + fmt(x, ind + '  ')).join(',\n') + '\n' + ind + ']';
  }
  if (v && typeof v === 'object') return '{\n' + Object.entries(v).map(([k, x]) => ind + '  ' + JSON.stringify(k) + ': ' + fmt(x, ind + '  ')).join(',\n') + '\n' + ind + '}';
  return JSON.stringify(v);
}
module.exports = lv => { const s = fmt(lv); if (JSON.stringify(JSON.parse(s)) !== JSON.stringify(lv)) throw new Error('format round trip'); return s; };
