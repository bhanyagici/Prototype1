// node tools/sync-presets.js : copies levels/<id>.json into the PRESETS block of shared/core.js
// (the game and editor run from file:// and cannot fetch the JSON files, so the core carries a copy).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), corePath = path.join(root, 'shared', 'core.js');
const ORDER = ['crowded-rush', 'crowded-rush-curve'];          // menu order after the built-in Level 2; then the demos
const demos = fs.readdirSync(path.join(root, 'levels')).filter(f => /^demo_.*\.json$/.test(f)).map(f => f.slice(0, -5));
const DEMO_ORDER = ['demo_hidden_bus', 'demo_connected', 'demo_tunnel', 'demo_hidden_men', 'demo_lock_box', 'demo_count_box', 'demo_combo'];
demos.sort((a, b) => (DEMO_ORDER.indexOf(a) + 1 || 99) - (DEMO_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
const ids = ORDER.filter(id => fs.existsSync(path.join(root, 'levels', id + '.json'))).concat(demos);
const body = ids.map(id => { const txt = fs.readFileSync(path.join(root, 'levels', id + '.json'), 'utf8').trim();
  JSON.parse(txt); return '  ' + JSON.stringify(id) + ': ' + txt.split('\n').join('\n  '); }).join(',\n');
const core = fs.readFileSync(corePath, 'utf8'), a = core.indexOf('/*PRESETS_BEGIN*/'), b = core.indexOf('/*PRESETS_END*/');
if (a < 0 || b < 0) throw new Error('PRESETS markers not found in shared/core.js');
fs.writeFileSync(corePath, core.slice(0, a) + '/*PRESETS_BEGIN*/{\n' + body + '\n}' + core.slice(b));
console.log('PRESETS: ' + ids.join(', '));
