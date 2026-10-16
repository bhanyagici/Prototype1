// The funnel's difficulty table as markdown (for the README), from levels/funnel/funnel-report.json and funnel-bots.json:
//   node tools/funnel-table.js
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'levels', 'funnel'), read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const rep = read('funnel-report.json').levels, bots = read('funnel-bots.json'), order = read('funnel-order.json').levels;
const B = Object.fromEntries(bots.levels.map(r => [r.id, r]));
// the Summary sheet's scale: random-bot win rate at each band's centre -> difficulty, a straight line between
const SCALE = [[0, 10], [0.115, 9], [0.17, 8], [0.24, 7], [0.325, 6], [0.425, 5], [0.525, 4], [0.65, 3], [0.85, 2], [1, 1]];
const measured = r => { if (r >= 1) return 1; for (let k = 0; k < SCALE.length - 1; k++){ const [r0, d0] = SCALE[k], [r1, d1] = SCALE[k + 1];
  if (r >= r0 && r <= r1) return d0 + (r - r0)*(d1 - d0)/(r1 - r0); } return 10; };
const MUST = role => /^(Challenge|Milestone|Finale|Practice)/.test(role), pct = v => (v*100).toFixed(1) + '%';
const band = b => b[1] >= 1 ? `≥ ${Math.round(b[0]*100)}%` : `${Math.round(b[0]*100)}–${Math.round(b[1]*100)}%`;
console.log('| Lv | Role | Lanes | Blockers | Target diff | Band | Random wins / fails / unfinished | Win rate | Measured diff | In band | Greedy 1x | Greedy 2x |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
let t1 = 0, must = 0, inMust = 0;
for (const id of order){ const r = rep[id], b = B[id], rate = b.random.rate, inB = rate >= r.band[0] && rate <= r.band[1]; t1 += b.greedy.t1x;
  if (MUST(r.role)){ must++; if (inB) inMust++; }
  const verdict = inB ? 'yes' : rate > r.band[1] && !MUST(r.role) ? 'easier (allowed)' : '**no**';
  console.log(`| ${r.n} | ${r.role} | ${r.lanes} | ${r.blockers} | ${r.diff} | ${band(r.band)} | ${b.random.wins} / ${b.random.fails} / ${b.random.unfinished} | ${pct(rate)} | ${measured(rate).toFixed(1)} | ${verdict} | ${b.greedy.t1x} s | ${b.greedy.t2x} s |`); }
console.log(`\nMust-land levels in their band: ${inMust} / ${must}. Greedy playtime: ${(t1/60).toFixed(1)} min at 1x, ${(t1/120).toFixed(1)} min at 2x.`);
