/* Match Express — browser-side storage for the editor (level slots by id, the level order, prefs) and the
   background bot worker built from the shared core.  The game itself never reads the editor's levels:
   the editor's preview gets its level by postMessage, exports carry a frozen copy. */
(function (root) {
  'use strict';
  const KEY_SLOTS = 'match-express:level-slots';
  const KEY_ORDER = 'match-express:level-order';
  const KEY_PREFS = 'match-express:prefs';
  const KEY_OLD_CURRENT = 'match-express:current-level';      // written by older editors; no longer used

  function readJSON(key, fallback){
    try { const s = root.localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, value){
    try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  const loadSlots = () => readJSON(KEY_SLOTS, {});
  const saveSlots = slots => writeJSON(KEY_SLOTS, slots);
  const loadOrder = () => { const o = readJSON(KEY_ORDER, []); return Array.isArray(o) ? o.map(String) : []; };
  const saveOrder = ids => writeJSON(KEY_ORDER, ids);
  const loadPrefs = () => readJSON(KEY_PREFS, {});
  const savePrefs = p => writeJSON(KEY_PREFS, Object.assign(loadPrefs(), p));
  const forgetOldCurrent = () => { try { root.localStorage.removeItem(KEY_OLD_CURRENT); } catch (e) {} };

  /* a Web Worker running the very same core (serialised from its factory) */
  function botWorker(){
    const src = '(' + root.MECoreFactory.toString() + ')(self);\n' +
      'self.onmessage = e => { const C = self.MECore, d = e.data;\n' +
      '  try { const r = C.testLevel(d.level, d.runs || 200); self.postMessage({id:d.id, ok:true, result:r}); }\n' +
      '  catch (err) { self.postMessage({id:d.id, ok:false, error:String(err && err.message || err)}); } };';
    return new Worker(URL.createObjectURL(new Blob([src], {type:'text/javascript'})));
  }
  /* run the greedy bot + N random bots off the main thread; falls back to slices if workers are blocked */
  function testInBackground(level, runs){
    return new Promise((resolve, reject) => {
      let w;
      try { w = botWorker(); } catch (e) { w = null; }
      if (w){
        w.onmessage = e => { w.terminate(); e.data.ok ? resolve(e.data.result) : reject(new Error(e.data.error)); };
        w.onerror = err => { w.terminate(); fallback(); err.preventDefault && err.preventDefault(); };
        w.postMessage({id:1, level, runs:runs || 200});
      } else fallback();
      function fallback(){
        const C = root.MECore; runs = runs || 200;
        const gr = C.simulate(level, C.greedyPick, null, C.SIM_DT);
        let r = 0, wins = 0;
        const slice = () => { const t0 = performance.now();
          while (r < runs && performance.now() - t0 < 8){ if (C.simulate(level, C.randomPick, C.mulberry32(1000 + r), C.SIM_DT).result === 'win') wins++; r++; }
          if (r < runs) setTimeout(slice, 0);
          else resolve({greedy:{result:gr.result, sends:gr.sends, landed:gr.landed, t:gr.t, moves:gr.moves}, wins, runs, rate:wins/runs, label:C.difficulty(wins/runs), warnings:[]}); };
        setTimeout(slice, 0);
      }
    });
  }
  root.MESync = {KEY_SLOTS, KEY_ORDER, loadSlots, saveSlots, loadOrder, saveOrder, loadPrefs, savePrefs, forgetOldCurrent, testInBackground};
})(window);
