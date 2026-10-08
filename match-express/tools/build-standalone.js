// Builds the single-file versions that open by double-click (file://, no server, no network):
//   dist/match-express-game.html    index.html with shared/core.js, shared/sync.js and three.js inlined
//   dist/match-express-editor.html  editor.html with its shared scripts inlined; it carries the packed game
//                                   (base64, #me-game-template) for its own preview and for its exports
//   dist/match-express-play.html                 share file: opens with Level 2
//   dist/match-express-crowded-rush-curve.html   share file: opens with Crowded Rush Curve
// The share files never load editor levels and run no background bot test; their settings menu switches
// between the bundled levels. Packing is done by shared/bundle.js, the same code the editor's
// "Export playable HTML" runs, so both produce the same kind of file.
//   node tools/build-standalone.js
const fs = require('fs'), path = require('path');
const B = require('../shared/bundle.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function replaceOnce(html, from, to){
  if (!html.includes(from)) throw new Error('missing: ' + from);
  return html.replace(from, () => to);
}

const files = {core:read('shared/core.js'), sync:read('shared/sync.js'), three:read('vendor/three.module.min.js')};
const game = B.inlineGame(read('index.html'), files);

let editor = read('editor.html');
// the packed game goes before the editor's scripts: the editor looks for it while it starts
editor = replaceOnce(editor, '<script src="shared/core.js"></script>', `<script type="text/plain" id="me-game-template">\n${B.b64(game)}\n</script>\n<script src="shared/core.js"></script>`);
for (const f of ['shared/core.js', 'shared/sync.js', 'shared/bundle.js'])
  editor = replaceOnce(editor, `<script src="${f}"></script>`, `<script>/* ${f} (inlined) */\n${B.safe(read(f))}</script>`);

const share = level => B.withShare(game, {level, nosim:true, noSaved:true});
const FILES = {'match-express-game.html': game, 'match-express-editor.html': editor,
               'match-express-play.html': share(null), 'match-express-crowded-rush-curve.html': share('crowded-rush-curve')};

fs.mkdirSync(OUT, {recursive: true});
for (const [f, html] of Object.entries(FILES)) fs.writeFileSync(path.join(OUT, f), html);
for (const f of Object.keys(FILES))
  console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size/1024).toFixed(0)} KB`);
