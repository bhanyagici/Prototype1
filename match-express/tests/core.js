// Loads the shared game core (../shared/core.js) into Node — no browser, no three.js.
const fs = require('fs'), path = require('path');
module.exports = function loadCore(file){
  const src = fs.readFileSync(file || path.join(__dirname, '..', 'shared', 'core.js'), 'utf8');
  const ctx = {}; new Function('window', src)(ctx); return ctx.MECore;
};
