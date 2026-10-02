// Builds the two single-file versions that open by double-click (file://, no server):
//   dist/match-express-game.html    index.html with shared/core.js and shared/sync.js inlined
//   dist/match-express-editor.html  editor.html with the shared scripts inlined and the game
//                                   embedded in the preview iframe through srcdoc
//   dist/match-express-play.html                 share file: opens with Level 2
//   dist/match-express-crowded-rush-curve.html   share file: opens with Crowded Rush Curve
// The share files never load a saved (or sent) editor level and run no background bot test;
// their settings menu switches between the bundled levels.
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

const share = level => replaceOnce(game, '<script>/* shared/core.js (inlined) */',
  `<script>window.ME_SHARE = ${JSON.stringify({level, nosim:true, noSaved:true})};</script>\n<script>/* shared/core.js (inlined) */`);
const FILES = {'match-express-game.html': game, 'match-express-editor.html': editor,
               'match-express-play.html': share(null), 'match-express-crowded-rush-curve.html': share('crowded-rush-curve')};

fs.mkdirSync(OUT, {recursive: true});
for (const [f, html] of Object.entries(FILES)) fs.writeFileSync(path.join(OUT, f), html);
for (const f of Object.keys(FILES))
  console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size/1024).toFixed(0)} KB`);
