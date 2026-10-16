// The two cameras: perspective (the default) and orthographic, sharing the slide zone's rows.
//   node tests/camera.test.js
const C = require('./core.js')();
let pass = 0, fail = 0; const chk = (ok, n, i = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + n + (i !== '' ? '  -> ' + i : '')); };
const P = C.SCREEN_CAM, O = C.ORTHO_CAM, H = C.SCREEN.h;
{ const f = c => { const d = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]], l = Math.hypot(...d); return d.map(v => (v/l).toFixed(6)).join(); };
  chk(O.ortho && f(O) === f(P), 'the orthographic camera looks the same way as the perspective one', f(O)); }
{ const b = [0, C.SLOT_Y, -C.SLOT_L/2]; let za = -1; while (C.project(0, 3, za, P)[1] > C.SCREEN.TOP*H) za -= 0.01;
  const d1 = Math.abs(C.project(...b, P)[1] - C.project(...b, O)[1]), d2 = Math.abs(C.project(0, 3, za, P)[1] - C.project(0, 3, za, O)[1]);
  chk(d1 < 1 && d2 < 1.5, 'both cameras put the slide zone\'s top edge and the slot tray\'s back edge on the same rows', `${d1.toFixed(2)} px, ${d2.toFixed(2)} px`);
  const wO = C.project(C.slotX(4) + C.SLOT_W/2, C.SLOT_Y, 0, O)[0] - C.project(C.slotX(0) - C.SLOT_W/2, C.SLOT_Y, 0, O)[0];
  chk(wO > 0.7*C.SCREEN.w && wO < C.SCREEN.w, 'in orthographic view the slot tray is a little narrower than the screen', (wO/C.SCREEN.w*100).toFixed(0) + '%'); }
{ chk(C.setView('ortho') === 'ortho' && C.viewCam() === O && C.VIEW === 'ortho' && C.setView('persp') === 'persp' && C.viewCam() === P, 'setView switches the camera the game draws with (the checker always uses both)'); }
{ let both = 0, one = 0; for (let x = -6; x <= 6; x += 0.5) for (let z = -16; z <= -2; z += 0.5){ const a = C.inSlideZone(x, 2.5, z, P), b = C.inSlideZone(x, 2.5, z, O); if (a && b) both++; else if (a || b) one++; }
  chk(both > 200 && one < both*0.25, 'the two cameras\' slide zones nearly coincide', `${both} points in both, ${one} in only one`); }
console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nALL ${pass} CHECKS PASS`); process.exitCode = fail ? 1 : 0;
