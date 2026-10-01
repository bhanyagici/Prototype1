// Builds the two single-file versions that open by double-click (file://, no server):
//   dist/match-express-game.html    index.html with shared/core.js and shared/sync.js inlined
//   dist/match-express-editor.html  editor.html with the shared scripts inlined and the game
//                                   embedded in the preview iframe through srcdoc
// three.js still comes from the pinned CDN through the import map, exactly as in index.html.
//   node tools/build-standalone.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// a script body must not close its own <script> element or open an HTML comment
const safe = js => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
function inlineShared(html){
  for (const f of ['shared/core.js', 'shared/sync.js']){
    const tag = `<script src="${f}"></script>`;
    if (!html.includes(tag)) throw new Error('missing ' + tag);
    html = html.replace(tag, () => `<script>/* ${f} (inlined) */\n${safe(read(f))}</script>`);
  }
  return html;
}
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
function replaceOnce(html, from, to){
  if (!html.includes(from)) throw new Error('missing: ' + from);
  return html.replace(from, () => to);
}

const game = inlineShared(read('index.html'));

let editor = inlineShared(read('editor.html'));
editor = replaceOnce(editor, '<iframe id="preview" src="index.html?embed=1"', `<iframe id="preview" srcdoc="${attr(game)}"`);
// "Open in new tab": there is no index.html next to a lone file, so open the same embedded game
// from a blob URL. It boots with the level the editor just saved to localStorage.
editor = replaceOnce(editor, "window.open('index.html', '_blank');",
  "window.open(URL.createObjectURL(new Blob([preview.getAttribute('srcdoc')], {type:'text/html'})), '_blank');");

fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, 'match-express-game.html'), game);
fs.writeFileSync(path.join(OUT, 'match-express-editor.html'), editor);
for (const f of ['match-express-game.html', 'match-express-editor.html'])
  console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size/1024).toFixed(0)} KB`);
