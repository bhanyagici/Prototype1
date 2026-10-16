// Builds the single-file versions that open by double-click (file://, no server, no network):
//   dist/marble-run-editor.html  editor.html with its shared scripts inlined; it carries the packed game
//                                (base64, #mr-game-template) for its own preview and for its exports
//   dist/marble-run-play.html    share file: the game with the built-in level (no saved editor levels, no background
//                                bot test)
// Packing is done by shared/bundle.js, the same code the editor's "Export playable HTML" runs.
//   node tools/build-standalone.js
const fs = require('fs'), path = require('path');
const B = require('../shared/bundle.js'), {editorFile} = require('./editor-file.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const game = B.inlineGame(read('index.html'), {core:read('shared/core.js'), sync:read('shared/sync.js'), three:read('vendor/three.module.min.js')});
const FILES = {'marble-run-editor.html': editorFile(game), 'marble-run-play.html': B.withShare(game, {level:null, nosim:true, noSaved:true})};
fs.mkdirSync(OUT, {recursive:true});
for (const [f, html] of Object.entries(FILES)){ fs.writeFileSync(path.join(OUT, f), html); console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size/1024).toFixed(0)} KB`); }
