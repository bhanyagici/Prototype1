// Each level's stickman size from its free space (MECore.autoManScale): the largest step up to 1.3 at which its ramps,
// grown with their stickmen, still fit without a new warning; a crowded level keeps 1.  Written as `manScale` (left out
// at 1).
//   node tools/set-man-scale.js          every level in levels/, levels/funnel/ and levels/showcase/ (then sync-presets.js)
//   node tools/set-man-scale.js a.json   only these files
const fs = require('fs'), path = require('path');
const C = require('../tests/core.js')(), fmt = require('./level-format.js'), ROOT = path.join(__dirname, '..');
const list = d => fs.readdirSync(path.join(ROOT, ...d)).filter(f => /\.json$/.test(f) && !/order|report|bots/.test(f)).sort().map(f => path.join(ROOT, ...d, f));
const files = process.argv.slice(2).length ? process.argv.slice(2) : list(['levels']).concat(list(['levels', 'funnel']), list(['levels', 'showcase']));
const hist = {};
for (const f of files){
  const lv = JSON.parse(fs.readFileSync(f, 'utf8')); if (!Array.isArray(lv.ramps)) continue;
  const s = C.autoManScale(JSON.parse(JSON.stringify(lv))), was = lv.manScale || 1; hist[s] = (hist[s] || 0) + 1;
  if (s > 1) lv.manScale = s; else delete lv.manScale;
  if (Math.abs(s - was) > 1e-9){ fs.writeFileSync(f, fmt(lv) + '\n'); console.log(path.relative(ROOT, f) + ': ' + was + ' -> ' + s); }
}
console.log('sizes:', Object.keys(hist).sort().map(k => `x${k}: ${hist[k]}`).join(', '));
