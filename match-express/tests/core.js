// Loads the game core (<script id="core"> in ../index.html) into Node — no browser, no three.js.
const fs = require('fs'), path = require('path');
module.exports = function loadCore(file){
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
  const ctx = {}; new Function('window', src)(ctx); return ctx.MECore;
};
