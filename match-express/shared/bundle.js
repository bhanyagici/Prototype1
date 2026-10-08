/* Match Express — packs the game into ONE self-contained HTML file.  Used by tools/build-standalone.js
   (Node) and by the editor's "Export playable HTML" (browser), so both produce exactly the same thing.
   inlineGame: index.html + core.js + sync.js (+ the three.js module, embedded as a data: URL) -> one file.
   playable:   that file + a frozen copy of one or more levels -> a game that plays them in order. */
(function (root) {
  'use strict';
  const safe = js => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
  const MAP_RE = /<script type="importmap">[\s\S]*?<\/script>/, MARK = '<script>/* shared/core.js (inlined) */';
  function b64(str){
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    const bytes = new TextEncoder().encode(str); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function inlineGame(html, files){
    for (const [tag, src, name] of [['<script src="shared/core.js"></script>', files.core, 'shared/core.js'], ['<script src="shared/sync.js"></script>', files.sync, 'shared/sync.js']]){
      if (!html.includes(tag)) throw new Error('missing ' + tag);
      html = html.replace(tag, () => `<script>/* ${name} (inlined) */\n${safe(src)}</script>`);
    }
    if (files.three){
      if (!MAP_RE.test(html)) throw new Error('missing the three.js import map');
      html = html.replace(MAP_RE, () => `<script type="importmap">{"imports":{"three":"data:text/javascript;base64,${b64(files.three)}"}}</script>`);
    }
    return html;
  }
  /* inject window.ME_SHARE before the inlined core: {levels} (a frozen list), or {level} (a bundled id) */
  function withShare(template, share, title){
    if (!template.includes(MARK)) throw new Error('not a game template (run inlineGame first)');
    let out = template.replace(MARK, () => `<script>window.ME_SHARE = ${safe(JSON.stringify(share))};</script>\n` + MARK);
    if (title) out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)} — Match Express</title>`);
    return out;
  }
  function playable(template, opts){
    const levels = (opts.levels || []).map(l => JSON.parse(JSON.stringify(l)));
    if (!levels.length) throw new Error('no levels to export');
    return withShare(template, {levels, nosim:true, noSaved:true, title:opts.title || null}, opts.title || (levels.length === 1 ? levels[0].name : null));
  }
  const api = {inlineGame, withShare, playable, safe, b64};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MEBundle = api;
})(typeof window !== 'undefined' ? window : globalThis);
