// The single-file editor (editor.html with its shared scripts inlined and the packed game, base64, as
// #me-game-template for its preview and its exports). tools/build-standalone.js writes it as
// dist/match-express-editor.html; tools/build-showcase.js carries it inside the showcase.
const fs = require('fs'), path = require('path'), B = require('../shared/bundle.js');
const ROOT = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function replaceOnce(html, from, to){
  if (!html.includes(from)) throw new Error('missing: ' + from);
  return html.replace(from, () => to);
}
function editorFile(game){
  game = game || B.inlineGame(read('index.html'), {core:read('shared/core.js'), sync:read('shared/sync.js'), three:read('vendor/three.module.min.js')});
  let editor = read('editor.html');
  // the packed game goes before the editor's scripts: the editor looks for it while it starts
  editor = replaceOnce(editor, '<script src="shared/core.js"></script>', `<script type="text/plain" id="me-game-template">\n${B.b64(game)}\n</script>\n<script src="shared/core.js"></script>`);
  for (const f of ['shared/core.js', 'shared/sync.js', 'shared/bundle.js'])
    editor = replaceOnce(editor, `<script src="${f}"></script>`, `<script>/* ${f} (inlined) */\n${B.safe(read(f))}</script>`);
  return editor;
}
module.exports = {editorFile, replaceOnce};
