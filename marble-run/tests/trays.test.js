// Trays: regular grids beside the slide, the front row facing it, a short apron and chute down onto it; the shapes
// (straight out, diagonal, a fixed screen angle), the push, marbleScale; never overlapping each other or the slide.
//   node tests/trays.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const clone = o => JSON.parse(JSON.stringify(o));
const levels = [C.LEVEL_DATA, ...Object.values(C.PRESETS)];
{ let worst = 0, lean = Infinity, near = 0;
  for (const lv of levels) for (const r of C.buildLayout(lv).TRAYS){
    for (let c = 0; c < r.cols; c++) for (let k = 0; k < r.rows; k++){ const q = r.slots[c][k];
      if (k){ const p = r.slots[c][k - 1]; worst = Math.max(worst, Math.abs(Math.hypot(q.x - p.x, q.z - p.z) - r.sp)); lean = Math.min(lean, q.y - p.y); }
      if (c){ const p = r.slots[c - 1][k]; worst = Math.max(worst, Math.abs(Math.hypot(q.x - p.x, q.z - p.z) - r.sp)); } }
    const f = r.slots.map(col => col[0]), d = f.map(q => C.polyDist([[r.merge.x - 0.01, r.merge.z - 0.01], [r.merge.x + 0.01, r.merge.z - 0.01], [r.merge.x + 0.01, r.merge.z + 0.01], [r.merge.x - 0.01, r.merge.z + 0.01]], q.x, q.z));
    near = Math.max(near, Math.max(...d) - Math.min(...d)); }
  chk(worst < 1e-6, 'every tray is a regular grid: marbles exactly one pitch apart along and across', worst.toExponential(1));
  chk(lean > 0, 'a tray\'s floor rises toward its back (its marbles lean on the front row)', lean.toFixed(3)); void near; }
{ let apron = 0, lip = 1e9; for (const lv of levels) for (const r of C.buildLayout(lv).TRAYS){ apron = Math.max(apron, r.apron/r.sp); lip = Math.min(lip, r.y - r.merge.y); }
  chk(apron <= 1 + 1e-6 && lip > 0, 'the front row faces the slide: at most one row of apron, the lip above the slide so the chute runs down onto it', `apron ${apron.toFixed(2)} rows, lip ${lip.toFixed(2)} above`); }
{ const lv = clone(C.LEVEL_DATA), L1 = C.buildLayout(lv), l2 = clone(lv); l2.marbleScale = 1.2; const L2 = C.buildLayout(l2);   // (layouts are cached per level object)
  chk(Math.abs(L2.TRAYS[0].sp/L1.TRAYS[0].sp - 1.2) < 1e-9 && L2.TRAYS[0].length > L1.TRAYS[0].length, 'marbleScale grows the marbles and the trays\' grid with them', `${L1.TRAYS[0].sp.toFixed(3)} -> ${L2.TRAYS[0].sp.toFixed(3)}`); }
{ const lv = clone(C.LEVEL_DATA), t = lv.trays[0], base = C.buildLayout(clone(lv)).TRAYS.find(r => r.src === 0);
  const a = Object.assign(clone(lv), {trays:[Object.assign({}, t, {tilt:70})]}), b = Object.assign(clone(lv), {trays:[Object.assign({}, t, {push:0.4})]});
  const ra = C.buildLayout(a).TRAYS[0], rb = C.buildLayout(b).TRAYS[0];
  chk(Math.abs(Math.atan2(-ra.dir[1], Math.abs(ra.dir[0]))*180/Math.PI - 70) < 1e-6, 'tilt: a tray points at a fixed screen angle, outward and up', (Math.atan2(-ra.dir[1], Math.abs(ra.dir[0]))*180/Math.PI).toFixed(1));
  chk(Math.hypot(rb.lip[0] - base.lip[0], rb.lip[1] - base.lip[1]) > 0.39, 'push: the tray stands further from the slide (its chute grows)', Math.hypot(rb.lip[0] - base.lip[0], rb.lip[1] - base.lip[1]).toFixed(2)); }
{ const lv = clone(C.LEVEL_DATA); Object.assign(lv.trays[2], {at:lv.trays[3].at + 0.4, side:lv.trays[3].side, tilt:lv.trays[3].tilt, shape:lv.trays[3].shape}); const k = C.checkLevel(lv).warnings.map(w => w.kind);
  chk(k.includes('tray-tray'), 'two trays that overlap are reported', k.join());
  const bad = levels.filter(l => C.checkLevel(l).warnings.some(w => w.kind.startsWith('tray'))).map(l => l.name);
  chk(!bad.length, 'no tray of the built-in and bundled levels overlaps another, the slide, the sorter or the start tower', bad.join()); }
console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
