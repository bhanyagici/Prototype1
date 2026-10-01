/* Match Express — browser-side sharing between the editor and the game.
   Levels travel three ways: postMessage into the editor's preview iframe, a BroadcastChannel
   named "match-express-levels" for any other open game tab, and localStorage (last run level
   + the editor's level slots).  Also builds the background bot worker from the shared core. */
(function (root) {
  'use strict';
  const CHANNEL = 'match-express-levels';
  const KEY_CURRENT = 'match-express:current-level';
  const KEY_SLOTS = 'match-express:level-slots';
  const KEY_PREFS = 'match-express:prefs';

  function channel(){ try { return new BroadcastChannel(CHANNEL); } catch (e) { return null; } }
  function readJSON(key, fallback){
    try { const s = root.localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; }
  }
  function writeJSON(key, value){
    try { root.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  const saveCurrent = level => writeJSON(KEY_CURRENT, level);
  const loadCurrent = () => readJSON(KEY_CURRENT, null);
  const clearCurrent = () => { try { root.localStorage.removeItem(KEY_CURRENT); } catch (e) {} };
  const loadSlots = () => readJSON(KEY_SLOTS, {});
  const saveSlots = slots => writeJSON(KEY_SLOTS, slots);
  const loadPrefs = () => readJSON(KEY_PREFS, {});
  const savePrefs = p => writeJSON(KEY_PREFS, Object.assign(loadPrefs(), p));

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
          else resolve({greedy:{result:gr.result, sends:gr.sends, landed:gr.landed, t:gr.t, moves:gr.moves}, wins, runs, rate:wins/runs, label:C.difficulty(wins/runs)}); };
        setTimeout(slice, 0);
      }
    });
  }
  root.MESync = {CHANNEL, KEY_CURRENT, KEY_SLOTS, channel, saveCurrent, loadCurrent, clearCurrent,
                 loadSlots, saveSlots, loadPrefs, savePrefs, testInBackground};
})(window);
