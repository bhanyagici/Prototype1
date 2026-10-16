// The fixed portrait screen: the slide zone at the top (about 55-60%), the sorter and the slot tray (about 15%), the
// lanes and the toy chest at the bottom (about 25%, about 2.5 boxes of each lane showing); the slot tray fills the width.
//   node tests/layout.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const H = C.SCREEN.h, W = C.SCREEN.w, row = (x, y, z, cam) => C.project(x, y, z, cam)[1]/H, col = (x, y, z, cam) => C.project(x, y, z, cam)[0];
const P = C.SCREEN_CAM, pc = v => (v*100).toFixed(1) + '%';
{ const a = P.pos, l = P.look, pitch = Math.atan2(a[1] - l[1], a[2] - l[2])*180/Math.PI;
  chk(P.fov === 30 && Math.abs(pitch - 53) < 0.01 && Math.abs(W/H - 9/19.5) < 1e-9, 'portrait 9:19.5, one fixed perspective camera: 30 degrees field of view, looking down 53 degrees', `fov ${P.fov}, pitch ${pitch.toFixed(2)}`); }
{ const slotBack = row(0, C.SLOT_Y, -C.SLOT_L/2 - 0.2, P), slotFront = row(0, C.SLOT_Y, C.SLOT_L/2 + 0.2, P), bowlBack = row(C.BOWL.x, C.BOWL.y, C.BOWL.z - C.BOWL.r, P);
  const chest = row(0, 0.3, C.CHEST_Z, P), slide = C.SCREEN.SLIDE_BOT - C.SCREEN.TOP;
  chk(slide >= 0.48 && bowlBack >= C.SCREEN.SLIDE_BOT - 0.01, 'the slide zone takes the top of the screen (below the HUD), down to the sorter\'s bowl', `${pc(C.SCREEN.TOP)}-${pc(C.SCREEN.SLIDE_BOT)} (${pc(slide)}), bowl back ${pc(bowlBack)}`);
  chk(slotFront - slotBack > 0.12 && slotFront - slotBack < 0.17, 'the slot tray takes about an eighth of the height (it fills the width, so the 53 degree view sets its depth)', `${pc(slotBack)}-${pc(slotFront)} (${pc(slotFront - slotBack)})`);
  chk(1 - slotFront > 0.22 && 1 - slotFront < 0.27 && chest > 0.9 && chest < 0.98, 'the lanes and the toy chest take the bottom quarter', `${pc(slotFront)}-100% (${pc(1 - slotFront)}), chest lid at ${pc(chest)}`);
  const xl = col(C.BOWL.x - C.BOWL.r, C.BOWL.y, C.BOWL.z, P), xr = col(C.slotX(4) + C.SLOT_W/2 + 0.2, C.SLOT_Y, C.SLOT_L/2, P);
  chk(xl > 4 && xl < 40 && W - xr > 4 && W - xr < 40, 'the bowl and the slot tray fill the width (a small margin each side)', `${xl.toFixed(0)} .. ${xr.toFixed(0)} px of ${W}`); }
{ const per = (C.CHEST_Z - C.LANE_Z0)/(C.boxLen(8)*C.QS + C.LANE_GAP);
  chk(Math.abs(per - 2.5) < 0.05, 'about 2.5 boxes of each lane show in front of the toy chest (queue boxes are drawn at ' + C.QS + ' of their size)', per.toFixed(2)); }
for (let n = C.LANE_MIN; n <= C.LANE_MAX; n++){ const xs = C.laneXs(n), w = C.BOX_W*C.QS;
  const gapMin = Math.min(...xs.slice(1).map((x, i) => x - xs[i])) - w, l = col(xs[0] - w/2, 0.3, C.CHEST_Z, P), r = col(xs[n - 1] + w/2, 0.3, C.CHEST_Z, P);
  chk(gapMin > 0.3 && l > 0 && r < W, `${n} lanes: their boxes never touch and all show on screen`, `gap ${gapMin.toFixed(2)}, ${l.toFixed(0)}..${r.toFixed(0)} px`); }
{ const levels = [C.LEVEL_DATA, ...Object.values(C.PRESETS)], out = [];
  for (const lv of levels){ const ws = C.checkLevel(lv).warnings.filter(w => w.kind.startsWith('zone')); if (ws.length) out.push(lv.name + ': ' + ws.map(w => w.kind).join()); }
  chk(!out.length, 'the built-in and bundled levels keep their slide, start tower and trays inside the slide zone (in both cameras)', out.join('; ')); }
console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
