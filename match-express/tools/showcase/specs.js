// The showcase levels (tools/make-showcase.js): one level per thing to try, in three categories.
// Roads are turtle paths as in tools/funnel/specs.js (F straight, L / R turns, S a spiral; they start at the yard entry
// heading up) drawn to climb through the whole target zone, with the exit tunnel at its top.  Ramp requests as there:
// c columns x r rows, a shape kind (perp, diag a, arc a/b, L b, tilt, fan sp), the side of the road and the spot f along it.
//   from: a demo level whose stickmen, blockers and buses are kept (only the road and the ramps' places are new)
//   target: the difficulty label the content is tuned to (random-bot win rate: Easy > 45%, Medium 15-45%, Hard 5-15%,
//           Very Hard < 5%); levels without one aim at Medium
const F = l => ['F', l], L = (d, r) => ['L', d, r], R = (d, r) => ['R', d, r], S = (r, side) => ['S', r, side];
const ROADS = {
  scurve:  [F(1.2), L(60,2.6), F(0.4), R(120,2.6), F(3.8), L(120,2.6), F(0.4), R(60,2.6), F(1.0)],
  zigzag:  [F(1.0), L(60,1.6), F(2.2), R(120,1.6), F(2.5), L(120,1.6), F(2.5), R(120,1.6), F(2.2), L(60,1.6), F(1.4)],
  hairpin: [F(1.0), R(90,1.8), F(1.2), L(180,2.2), F(5.2), R(180,2.2), F(3.8), L(90,1.8), F(2.6)],
  spiral:  [F(5.6), S(1.25,1), R(110,2.0), F(1.0), R(20,3), F(1.2), L(20,3), F(4.8)],
  dspiral: [F(2.6), S(1.1,1), R(110,1.8), F(2.4), S(1.1,-1), L(110,1.8), F(1.0), R(20,3), F(5.0)],
  winding: [F(0.8), R(40,2.1), F(0.8), L(110,2.1), F(0.6), R(140,2.1), F(0.6), L(140,2.1), F(0.6), R(70,2.1), F(0.8)],
  gentle:  [F(1.8), R(20,6), F(2.8), L(40,6), F(2.8), R(20,6), F(2.6)],
  // more spiral roads: the loop low, high, after a bend; two loops on one side or on both
  spiralHi:  [F(1.0), R(30,3), F(2.0), L(30,3), F(5.4), S(1.2,1), R(110,2.0), F(1.0), L(20,3), F(2.2)],
  spiralLow: [F(2.0), S(1.2,-1), L(110,2.0), F(1.6), R(30,4), F(2.4), L(30,4), F(5.0)],
  gspiral:   [F(1.8), R(20,6), F(1.0), S(1.15,1), R(110,1.8), F(1.0), L(40,6), F(1.8), R(20,6), F(1.4)],
  sspiral:   [F(1.2), L(50,2.6), F(0.4), R(100,2.6), F(1.4), S(1.15,1), R(110,1.8), F(0.6), L(50,2.6), F(3.0)],
  zspiral:   [F(1.0), L(60,1.6), F(2.2), R(120,1.6), F(1.2), S(1.1,-1), L(110,1.8), F(0.6), L(60,1.6), F(6.4)],
  dspiral2:  [F(1.6), S(1.1,-1), L(110,1.8), F(2.6), S(1.1,1), R(110,1.8), F(1.2), L(20,3), F(6.6)],
  dspiralW:  [F(2.0), S(1.1,1), R(110,1.8), F(3.4), S(1.1,1), R(110,1.8), F(6.2)],
};
// the roads with a spiral (most levels use one; a few Layouts keep a road without)
const SPIRAL_ROADS = ['spiral', 'gspiral', 'sspiral', 'spiralLow', 'spiralHi', 'zspiral', 'dspiral', 'dspiral2', 'dspiralW'];
const P = (side, f, c, r, kind = 'perp', o = {}) => Object.assign({c, r, kind, side, f}, o);
module.exports = {ROADS, SPIRAL_ROADS, SPECS:[
  // ---------------- Basics: the same idea at four difficulties ----------------
  {id:'basics-easy', cat:'Basics', name:'Easy', target:'Easy', lanes:3, colors:3, sizes:[8], road:'gspiral',
   ramps:[P(-1, 0.18, 4, 5), P(1, 0.38, 4, 5), P(-1, 0.62, 4, 5), P(1, 0.84, 4, 5)]},
  {id:'basics-medium', cat:'Basics', name:'Medium', target:'Medium', lanes:3, colors:6, sizes:[4, 6, 8, 12], road:'sspiral', trapMax:7,
   ramps:[P(1, 0.12, 6, 6), P(-1, 0.32, 6, 6, 'diag', {a:10}), P(1, 0.56, 6, 6, 'diag', {a:-10}), P(-1, 0.78, 6, 6), P(1, 0.94, 6, 4)]},
  {id:'basics-hard', cat:'Basics', name:'Hard', target:'Hard', lanes:4, colors:7, sizes:[4, 6, 8, 12], road:'spiralHi', trapMax:7, blockers:{hidden:2},
   ramps:[P(1, 0.12, 6, 6), P(-1, 0.32, 6, 6), P(1, 0.54, 6, 6), P(-1, 0.76, 6, 6), P(1, 0.92, 6, 4)]},
  {id:'basics-very-hard', cat:'Basics', name:'Very Hard', target:'Very Hard', lanes:3, colors:8, sizes:[4, 6, 8, 12], road:'zspiral', trapMax:9, blockers:{hidden:3, link:'pairs'},
   ramps:[P(1, 0.1, 6, 8), P(-1, 0.28, 6, 8), P(1, 0.48, 6, 8), P(-1, 0.68, 6, 8), P(1, 0.88, 4, 8)]},   // (narrower and deeper: ramps are straight now)
  // ---------------- Blockers: one at a time, then all together ----------------
  {id:'blk-hidden-bus', cat:'Blockers', name:'Hidden bus', from:'demo_hidden_bus', road:'sspiral', kind:'perp'},
  {id:'blk-connected-pairs', cat:'Blockers', name:'Connected pairs', from:'demo_connected', road:'gspiral', kind:'perp'},
  {id:'blk-connected-triples', cat:'Blockers', name:'Connected triples', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'zspiral', blockers:{link:'triples'},
   ramps:[P(1, 0.14, 6, 5), P(-1, 0.36, 6, 5), P(1, 0.6, 6, 5), P(-1, 0.84, 6, 5)]},
  {id:'blk-colourful-tunnel', cat:'Blockers', name:'Colourful tunnel', from:'demo_tunnel', road:'spiralLow', kind:'perp'},
  {id:'blk-hidden-stickmen', cat:'Blockers', name:'Hidden stickmen', from:'demo_hidden_men', road:'spiral', kind:'perp'},
  {id:'blk-lock-key', cat:'Blockers', name:'Lock & key box', from:'demo_lock_box', road:'spiralHi', kind:'perp'},
  {id:'blk-count-box', cat:'Blockers', name:'Count box', from:'demo_count_box', road:'dspiralW', kind:'diag'},
  {id:'blk-all', cat:'Blockers', name:'All combined', from:'demo_combo', road:'dspiral', kind:'perp'},
  // ---------------- Layouts: roads ----------------
  {id:'road-s-curve', cat:'Layouts', group:'Roads', name:'S-curve', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'scurve',
   ramps:[P(1, 0.12, 6, 5), P(-1, 0.34, 6, 5), P(1, 0.62, 6, 5), P(-1, 0.86, 6, 5)]},
  {id:'road-zigzag', cat:'Layouts', group:'Roads', name:'Zigzag', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'zigzag',
   ramps:[P(1, 0.14, 6, 4), P(-1, 0.36, 6, 4), P(1, 0.58, 6, 4), P(-1, 0.8, 6, 4)]},
  {id:'road-hairpin', cat:'Layouts', group:'Roads', name:'Hairpin', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'hairpin',
   ramps:[P(-1, 0.1, 6, 4), P(1, 0.4, 6, 4), P(-1, 0.66, 6, 4), P(1, 0.9, 6, 4)]},
  {id:'road-spiral', cat:'Layouts', group:'Roads', name:'Single spiral', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'spiral',
   ramps:[P(-1, 0.12, 6, 5), P(1, 0.28, 6, 5), P(-1, 0.74, 6, 5), P(1, 0.9, 6, 4)]},
  {id:'road-double-spiral', cat:'Layouts', group:'Roads', name:'Double spiral', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'dspiral',
   ramps:[P(-1, 0.06, 6, 4), P(1, 0.42, 6, 4), P(-1, 0.82, 6, 4), P(1, 0.94, 6, 4)]},
  {id:'road-winding', cat:'Layouts', group:'Roads', name:'Long winding road', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'winding',
   ramps:[P(1, 0.1, 6, 4), P(-1, 0.28, 6, 4), P(1, 0.46, 6, 4), P(-1, 0.64, 6, 4), P(1, 0.82, 6, 4)]},
  // ---------------- Layouts: ramp shapes ----------------
  {id:'ramp-straight', cat:'Layouts', group:'Ramp shapes', name:'Straight', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'gentle',
   ramps:[P(-1, 0.16, 6, 5), P(1, 0.36, 6, 5), P(-1, 0.62, 6, 5), P(1, 0.84, 6, 5)]},
  {id:'ramp-arc', cat:'Layouts', group:'Ramp shapes', name:'On curves', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'gspiral',
   ramps:[P(-1, 0.16, 6, 5, 'diag', {a:-6}), P(1, 0.36, 6, 5, 'diag', {a:6}), P(-1, 0.64, 6, 5, 'diag', {a:-6}), P(1, 0.86, 6, 5, 'diag', {a:6})]},
  {id:'ramp-l-shape', cat:'Layouts', group:'Ramp shapes', name:'Deep', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'sspiral',
   ramps:[P(-1, 0.16, 4, 8), P(1, 0.38, 4, 8), P(-1, 0.66, 4, 8), P(1, 0.88, 4, 6)]},
  {id:'ramp-wide-fan', cat:'Layouts', group:'Ramp shapes', name:'Around spirals', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'dspiral',
   ramps:[P(-1, 0.16, 6, 5), P(1, 0.38, 6, 5), P(-1, 0.64, 6, 5), P(1, 0.86, 6, 5)]},
  {id:'ramp-long-narrow', cat:'Layouts', group:'Ramp shapes', name:'Long narrow', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'spiralLow',
   ramps:[P(-1, 0.14, 3, 10, 'diag', {a:25}), P(1, 0.34, 3, 10, 'diag', {a:25}), P(-1, 0.6, 3, 10, 'diag', {a:25}), P(1, 0.82, 3, 10, 'diag', {a:25})]},
  // ---------------- Layouts: lane counts ----------------
  {id:'lanes-2', cat:'Layouts', group:'Lane counts', name:'2 lanes', lanes:2, colors:4, sizes:[4, 6, 8, 12], road:'spiral',
   ramps:[P(1, 0.14, 4, 5), P(-1, 0.4, 4, 5), P(1, 0.66, 4, 5), P(-1, 0.88, 4, 4)]},
  {id:'lanes-3', cat:'Layouts', group:'Lane counts', name:'3 lanes', lanes:3, colors:5, sizes:[4, 6, 8, 12], road:'sspiral',
   ramps:[P(1, 0.14, 6, 5), P(-1, 0.4, 6, 5), P(1, 0.66, 6, 5), P(-1, 0.88, 6, 4)]},
  {id:'lanes-4', cat:'Layouts', group:'Lane counts', name:'4 lanes', lanes:4, colors:6, sizes:[4, 6, 8, 12], road:'dspiral2',
   ramps:[P(1, 0.1, 6, 5), P(-1, 0.3, 6, 5), P(1, 0.5, 6, 5), P(-1, 0.7, 6, 5), P(1, 0.9, 6, 4)]},
  {id:'lanes-5', cat:'Layouts', group:'Lane counts', name:'5 lanes', lanes:5, colors:7, sizes:[4, 6, 8, 12], road:'spiralHi',
   ramps:[P(1, 0.1, 6, 6), P(-1, 0.3, 6, 6), P(1, 0.5, 6, 6), P(-1, 0.7, 6, 6), P(1, 0.9, 6, 4)]},
]};
