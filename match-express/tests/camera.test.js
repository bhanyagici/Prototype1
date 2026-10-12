// The two cameras (a game setting): Perspective (SCREEN_CAM) and Orthographic (ORTHO_CAM, the same direction).
// For every level (the built-in Level 2, the presets, the 40 funnel levels and the showcase levels) and both views:
// the road, the ramps and the exit tunnel lie inside the target zone; the bays inside the static row; the queue's
// lanes start in the queue zone with three 8-seat buses fully visible above the queue tunnel; and the buses and
// stickmen are drawn at about the same size on screen in both views.
//   node tests/camera.test.js
const fs = require('fs'), path = require('path');
const C = require('./core.js')();
const clone = o => JSON.parse(JSON.stringify(o)), LV = path.join(__dirname, '..', 'levels');
let pass = 0, fail = 0;
const chk = (ok, name, info = '') => { ok ? pass++ : fail++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (info !== '' ? '  -> ' + info : '')); };
function levels(){
  const out = [['level-2', clone(C.LEVEL_DATA)]].concat(Object.entries(C.PRESETS).map(([id, lv]) => [id, clone(lv)]));
  for (const f of fs.readdirSync(path.join(LV, 'funnel')).filter(f => /^f\d+\.json$/.test(f)).sort()) out.push([f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(LV, 'funnel', f), 'utf8'))]);
  const SC = path.join(LV, 'showcase');
  for (const f of fs.readdirSync(SC).filter(f => /\.json$/.test(f) && !/order/.test(f)).sort()) out.push([f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(SC, f), 'utf8'))]);
  return out;
}
const S = C.SCREEN, H = S.h, W = S.w, O = C.ORTHO_CAM;
console.log('camera values');
{ const P = C.SCREEN_CAM, f = [P.look[0] - P.pos[0], P.look[1] - P.pos[1], P.look[2] - P.pos[2]], pitch = Math.atan2(-f[1], Math.hypot(f[0], f[2]))*180/Math.PI;
  chk(Math.abs(pitch - O.pitch) < 1e-6 && O.ortho && O.halfH > 0 && Math.abs(O.halfW/O.halfH - W/H) < 1e-9,
    'the orthographic camera looks in the perspective camera\'s direction, with the screen\'s aspect',
    `pitch ${pitch.toFixed(2)} deg; perspective fov ${P.fov} at (${P.pos.join(', ')}); orthographic half height ${O.halfH.toFixed(3)} at (${O.pos.map(v => v.toFixed(3)).join(', ')})`);
  const rows = [O.zTop, O.zBot].map(z => [C.project(0, 0, z, C.SCREEN_CAM)[1]/H, C.project(0, 0, z, O)[1]/H]);
  chk(rows.every(([a, b]) => Math.abs(a - b) < 1e-4), 'the target zone\'s ground spans the same screen rows in both views', rows.map(r => r.map(v => v.toFixed(4)).join(' = ')).join(', ')); }

const all = levels(), report = {};
for (const view of ['persp', 'ortho']){
  C.setView(view); const cam = C.viewCam(), bad = {target:[], bays:[], queue:[]};
  const rowOf = (x, y, z) => C.project(x, y, z, cam), inZone = ([u, v], top, bot, tol = 0) => u >= -tol && u <= W + tol && v >= top*H - tol && v <= bot*H + tol;
  for (const [id, lv] of all){
    const L = C.buildLayout(clone(lv)), R = L.ROAD, drop = L.Y.RAMP_DROP || 0;
    // the target zone: the road (and a bus's height over it), every ramp's platform (as drawn, level with the road) and
    // its front row of stickmen, the exit tunnel's top
    const pts = [];
    for (let i = 0; i < R.n; i += 3){ if (R.cum[i] > R.portalS) break; pts.push([R.P[i*3], R.P[i*3+1], R.P[i*3+2]], [R.P[i*3], R.P[i*3+1] + 0.9, R.P[i*3+2]]); }
    L.RAMPS.forEach(r => r.outline.forEach(q => pts.push([q[0], r.y, q[1]])));
    pts.push([L.exit.x, L.exit.y + 1.9, L.exit.z]);
    const out = pts.filter(p => !inZone(rowOf(...p), S.TARGET_TOP, S.TARGET_BOT, 1));
    if (out.length) bad.target.push(`${id} (${out.length})`);
    // the bays (drawn, with a parked 12-seat bus's height) inside the static row
    for (const bx of L.Y.BAY_X){ const b = C.drawnBay(bx);
      for (const [x, z] of [[b.x - b.hw, b.z - b.hl], [b.x + b.hw, b.z + b.hl]]) for (const y of [0, 0.9])
        if (!inZone(rowOf(x, y, z), S.TARGET_BOT - 0.02, S.STATIC_BOT + 0.01)){ bad.bays.push(id); break; } }
    // the queue: three 8-seat buses per lane fully on screen above the queue tunnel, the first starting below the bays
    const len = C.busLen(8);
    for (const x of L.Y.LANE_X){ let z = C.Z_LANE_TOP + 0.12, n = 0;
      for (let k = 0; k < 3; k++){ const zc = z + len/2, s = C.BUS_DRAW*C.dispScale(zc), [dx, dz] = C.dispPoint(x, zc), hw = s*C.BUS_W/2, hl = s*len/2;
        let ok = true; for (const ex of [-hw, hw]) for (const ez of [-hl, hl]) for (const y of [0, 1.05*s]) if (!inZone(rowOf(dx + ex, y, dz + ez), 0, S.QUEUE_BOT)) ok = false;
        if (k === 0 && rowOf(dx, 0, dz - hl)[1] < (S.STATIC_BOT - 0.01)*H) ok = false;
        if (ok) n++; z += len + C.LANE_GAP; }
      if (n < 3){ bad.queue.push(id); break; } }
  }
  report[view] = bad;
  const name = view === 'ortho' ? 'orthographic' : 'perspective';
  chk(!bad.target.length, `${name}: in all ${all.length} levels the road, the ramps and the exit tunnel lie inside the target zone`, bad.target.slice(0, 6).join(', '));
  chk(!bad.bays.length, `${name}: the bays lie inside the static row`, bad.bays.slice(0, 6).join(', '));
  chk(!bad.queue.length, `${name}: every queue lane shows three 8-seat buses fully above the queue tunnel`, bad.queue.slice(0, 6).join(', '));
}
// the same readable size: a parked bus and a queued bus are as wide on screen in both views; stickmen on the ramps
// within 20% (the orthographic view has one scale for the whole target zone, the perspective one shrinks with distance)
{ const zb = C.parkZ(C.busLen(12)), zq = C.Z_LANE_TOP + 1;
  const bus = [[0, zb], [0, zq]].map(([x, z]) => { C.setView('persp'); const p = C.BUS_DRAW*C.dispScale(z)*C.BUS_W*(C.project(1, 0, C.dispZ(z))[0] - C.project(0, 0, C.dispZ(z))[0]);
    C.setView('ortho'); const o = C.BUS_DRAW*C.dispScale(z)*C.BUS_W*(C.project(1, 0, C.dispZ(z), O)[0] - C.project(0, 0, C.dispZ(z), O)[0]); C.setView('persp'); return o/p; });
  chk(bus.every(k => Math.abs(k - 1) < 0.06), 'a bus in a bay and in the queue is drawn as wide on screen in both views', bus.map(k => (k*100).toFixed(1) + '%').join(', '));
  let lo = 9, hi = 0;
  for (const [, lv] of all){ const L = C.buildLayout(clone(lv));
    for (const rp of L.RAMPS) for (const cs of rp.slots) for (const q of cs){ const p = C.project(q.x + 0.5, q.y, q.z)[0] - C.project(q.x, q.y, q.z)[0], o = C.project(q.x + 0.5, q.y, q.z, O)[0] - C.project(q.x, q.y, q.z, O)[0];
      lo = Math.min(lo, o/p); hi = Math.max(hi, o/p); } }
  chk(lo > 0.8 && hi < 1.2, 'stickmen on the ramps are drawn within 20% of their perspective size in the orthographic view', `${(lo*100).toFixed(0)}% to ${(hi*100).toFixed(0)}%`); }
C.setView('persp');
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
