// Contact sheet of level layouts, top-down (target zone, road, ramps with their stickmen, blockers, exit tunnel,
// queue) with the checker's warnings:  node tools/funnel/sheet.js out.png level1.json level2.json ...
// (needs playwright; CHROMIUM=/path/to/chrome optional)
const fs = require('fs'), path = require('path');
const {chromium} = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const [out, ...files] = process.argv.slice(2);
const levels = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const COLS = Math.min(8, levels.length), TW = 230, TH = 420, rows = Math.ceil(levels.length/COLS);
const page = `<!doctype html><html><body style="margin:0;background:#1d2230"><canvas id="c" width="${COLS*TW}" height="${rows*TH}"></canvas></body></html>`;
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || undefined});
  const p = await b.newPage({viewport:{width:COLS*TW, height:rows*TH}});
  await p.setContent(page); await p.addScriptTag({content: fs.readFileSync(path.join(ROOT, 'shared', 'core.js'), 'utf8')});
  const warn = await p.evaluate(({levels, COLS, TW, TH}) => {
    const C = window.MECore, cv = document.getElementById('c'), x = cv.getContext('2d'), out = [];
    const X0 = -8, X1 = 8, Z0 = -19.5, Z1 = 7.6, k = Math.min((TW - 10)/(X1 - X0), (TH - 46)/(Z1 - Z0));
    // the target zone (at ground height): left/right edges per z
    const zone = []; for (let z = Z0; z <= 0; z += 0.25){ let a = null, bb = null; for (let xx = -9; xx <= 9; xx += 0.05) if (C.inTarget(xx, 0.4, z)){ if (a === null) a = xx; bb = xx; } if (a !== null) zone.push([z, a, bb]); }
    levels.forEach((lv, i) => {
      const ox = (i % COLS)*TW + 5, oy = Math.floor(i/COLS)*TH + 30, P = (wx, wz) => [ox + (wx - X0)*k, oy + (wz - Z0)*k];
      let L, ck; try { L = C.buildLayout(lv); ck = C.checkLevel(lv); } catch (e) { x.fillStyle = '#f66'; x.fillText(lv.id + ': ' + e.message, ox, oy); out.push([lv.id, e.message]); return; }
      x.fillStyle = '#2b3245'; x.fillRect(ox - 3, oy - 28, TW - 4, TH - 4);
      x.beginPath(); zone.forEach(([z, a], j) => { const q = P(a, z); j ? x.lineTo(...q) : x.moveTo(...q); }); for (let j = zone.length - 1; j >= 0; j--) x.lineTo(...P(zone[j][2], zone[j][0]));
      x.closePath(); x.fillStyle = '#3d5236'; x.fill(); x.strokeStyle = '#e8c547'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#4a4f5a'; const y0 = P(-4.4, -0.2), y1 = P(4.4, 7.4); x.fillRect(y0[0], y0[1], y1[0] - y0[0], y1[1] - y0[1]);
      // road ribbon, darker where it is raised
      const R = L.ROAD; x.lineCap = 'round';
      for (let j = 0; j + 2 < R.n; j += 2){ if (R.cum[j] > R.portalS + 0.5) break; const a = P(R.P[j*3], R.P[j*3+2]), c = P(R.P[(j+2)*3], R.P[(j+2)*3+2]);
        x.strokeStyle = `rgb(${120 - R.P[j*3+1]*12},${124 - R.P[j*3+1]*12},${132 - R.P[j*3+1]*10})`; x.lineWidth = C.ROAD_HALF*2*k; x.beginPath(); x.moveTo(...a); x.lineTo(...c); x.stroke(); }
      const E = L.exit, e0 = P(E.x, E.z); x.fillStyle = '#111'; x.beginPath(); x.arc(e0[0], e0[1], 6, 0, 7); x.fill();
      // ramps: outline + stickmen cells
      const N = C.normalizeLevel(lv);
      L.RAMPS.forEach(r => { const poly = C.rampOutline(r); x.beginPath(); poly.forEach((q, j) => j ? x.lineTo(...P(q[0], q[1])) : x.moveTo(...P(q[0], q[1]))); x.closePath();
        x.fillStyle = '#c9ccd2'; x.fill(); x.strokeStyle = '#777'; x.stroke();
        const rd = N.ramps[r.src];
        r.slots.forEach((col, c) => col.forEach((q, rr) => { const cell = C.parseCell(rd.columns[c][rr]); if (!cell) return; const [px, py] = P(q.x, q.z);
          x.fillStyle = cell.hidden ? '#888' : C.HEX[cell.color]; x.beginPath(); x.arc(px, py, Math.max(1.6, 0.15*k), 0, 7); x.fill(); }));
        (rd.tunnels || []).forEach(t => { const q = r.slots[t.col][t.row], [px, py] = P(q.x, q.z); x.fillStyle = C.HEX[t.color]; x.fillRect(px - 5, py - 5, 10, 10); x.fillStyle = '#000'; x.fillText(t.count, px - 4, py + 4); });
        (rd.boxes || []).forEach(bx => { const q = r.slots[bx.col][bx.row], [px, py] = P(q.x, q.z); x.strokeStyle = '#8a5a12'; x.lineWidth = 2; x.strokeRect(px - 6, py - 6, 12, 12); x.lineWidth = 1; });
        const [lx, ly] = P(r.x, r.z); x.fillStyle = '#ffd34d'; x.fillRect(lx - 2, ly - 2, 4, 4); });
      // queue: three lanes of buses
      N.lanes.forEach((ln, l) => ln.slice(0, 14).forEach((bb, j) => { x.fillStyle = bb.hidden ? '#999' : C.HEX[bb.color]; const h = bb.cap*0.9;
        const [qx, qy] = P(-2.3 + l*2.3, 0.4); x.fillRect(qx - 4, qy + j*0 + ln.slice(0, j).reduce((s, o) => s + o.cap*0.9 + 2, 0), 8, h);
        if (bb.link != null){ x.strokeStyle = '#fff'; x.strokeRect(qx - 5, qy + ln.slice(0, j).reduce((s, o) => s + o.cap*0.9 + 2, 0) - 1, 10, h + 2); } }));
      x.fillStyle = '#fff'; x.font = 'bold 12px sans-serif'; x.fillText(`${lv.id || i + 1}  ${lv.name || ''}`.slice(0, 34), ox, oy - 14);
      x.font = '10px sans-serif'; x.fillStyle = ck.warnings.length || !ck.balanced ? '#ff8080' : '#9be7ad';
      x.fillText((ck.balanced ? '' : 'UNBALANCED ') + (ck.warnings.length ? ck.warnings.map(w => w.kind).join(' ') : `ok · ${ck.totalMen} men · road ${R.portalS.toFixed(0)}`).slice(0, 44), ox, oy - 2);
      out.push([lv.id, ck.warnings.map(w => w.kind + (w.ramp != null ? '@' + (w.ramp + 1) : '')).join(' ') + (ck.balanced ? '' : ' UNBALANCED')]);
    });
    return out;
  }, {levels, COLS, TW, TH});
  await p.screenshot({path: out}); await b.close();
  warn.forEach(([id, w]) => { if (w) console.log(id, w); });
})();
