// The showcase levels (tools/make-showcase.js): one level per thing to try, in five categories.
// Slides: lists of points on the table (x right, z down the screen; ['S', x, z, r, side] a spiral there), or turtle
// programs (tools/funnel/geometry.js: F straight, L / R turns of a radius, S a spiral) with points added at the end.
// Each starts at the start tower near the top of the slide zone and ends where the fixed tail drops into the sorter.
// Tray requests as in the funnel: c columns x r rows, a shape kind (tilt: the game's default 35 degrees, or `tilt`
// degrees on screen; perp: square to the slide; diag a: turned a degrees), the side of the slide and the spot f along it.
//   from:   a demo level whose marbles, blockers and boxes are kept (only the slide and the trays' places are new)
//   gaps:   cuts in the slide [len, ends, near]: each put on the clean stretch nearest the spot `near` along the slide
//   toys:   toy pieces [kind, near], placed the same way (before the trays, which then keep clear of them)
//   target: the difficulty label the content is tuned to (random-bot win rate: Easy > 45%, Medium 15-45%, Hard 5-15%,
//           Very Hard < 5%); levels without one aim at Medium
const F = l => ['F', l], L = (d, r) => ['L', d, r], R = (d, r) => ['R', d, r];
const SLIDES = {
  spiral:  {R:[[-0.6,-12.2],[-0.5,-11.3],[-0.2,-10.5],['S',0.2,-9.6,1.0,1],[1.6,-9.0],[2.4,-7.8],[1.8,-6.5],[0.3,-5.9],[-1.4,-5.9],[-2.8,-5.8]]},
  scurve:  {R:[[1.6,-13.0],[0.4,-12.8],[-0.9,-12.4],[-1.7,-11.6],[-1.6,-10.6],[-0.7,-9.9],[0.6,-9.6],[1.8,-9.1],[2.4,-8.1],[2.0,-7.0],[0.8,-6.4],[-0.6,-6.0],[-1.8,-5.8],[-2.8,-5.8]]},
  hairpin: {R:[[-2.2,-13.0],[-2.3,-12.0],[-2.3,-10.8],[-2.0,-9.8],[-1.3,-9.3],[-0.5,-9.6],[-0.2,-10.6],[-0.2,-11.8],[0.2,-12.8],[1.0,-13.2],[1.8,-12.8],[2.1,-11.8],
            [2.2,-10.4],[2.2,-8.8],[1.7,-7.2],[0.3,-6.3],[-1.4,-5.9],[-2.8,-5.8]]},
  zigzag:  {start:{x:-1.6, z:-13.2, h:12}, T:[F(2.2), R(152,0.92), F(2.6), L(152,0.92), F(2.6), R(152,0.92), F(0.5)], end:[[-1.5,-5.6],[-2.8,-5.7]]},
  winding: {start:{x:1.8, z:-12.8, h:180}, T:[F(2.2), L(180,1.0), F(3.0), R(180,1.0), F(2.6), L(90,1.0), F(0.4)], end:[[-1.3,-6.2],[-2.0,-5.8],[-2.9,-5.7]]},
  // the built-in level's slide (its spiral early, then a long sweep right and back)
  classic: {R:[[-0.5,-12],[-0.4,-11.1],[0.2,-10.1],['S',0.3,-9,0.9,1],[1.7,-8.5],[2.5,-7.3],[1.9,-6.1],[0.3,-5.6],[-1.4,-5.9],[-2.8,-5.8]]},
};
const P = (side, f, c, r, kind = 'tilt', o = {}) => Object.assign({c, r, kind, side, f}, o);
const G = (len, ramp, near) => ({len, ramp, near}), T = (kind, near) => ({kind, near});
// four trays of 3 x 6 at the default angle, two each side (the built-in level's arrangement)
const four = (c = 3, r = 6) => [P(-1, 0.12, c, r), P(1, 0.4, c, r), P(-1, 0.62, c, r), P(1, 0.86, c, r)];
module.exports = {SLIDES, SPECS:[
  // ---------------- Basics: the same idea at four difficulties ----------------
  {id:'basics-easy', cat:'Basics', name:'Easy', target:'Easy', lanes:3, colors:3, sizes:[6, 8], slide:'classic', trays:four(3, 5)},
  {id:'basics-medium', cat:'Basics', name:'Medium', target:'Medium', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'scurve', trays:four()},
  {id:'basics-hard', cat:'Basics', name:'Hard', target:'Hard', lanes:3, colors:7, sizes:[6, 8, 12], slide:'spiral', trapMax:12, blockers:{hidden:2}, trays:four()},
  {id:'basics-very-hard', cat:'Basics', name:'Very Hard', target:'Very Hard', lanes:3, colors:8, sizes:[8, 12], slide:'hairpin', trapMax:14, blockers:{hidden:3, link:'pairs'}, trays:four()},
  // ---------------- Blockers: one at a time, then all together ----------------
  {id:'blk-hidden-box', cat:'Blockers', name:'Hidden box', from:'demo_hidden_box', slide:'scurve'},
  {id:'blk-connected-pairs', cat:'Blockers', name:'Connected pairs', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'classic', blockers:{link:'pairs'}, trays:four()},
  {id:'blk-connected-triples', cat:'Blockers', name:'Connected triples', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'spiral', blockers:{link:'triples'}, trays:four()},
  {id:'blk-dispenser', cat:'Blockers', name:'Marble dispenser', from:'demo_dispenser', slide:'hairpin'},
  {id:'blk-hidden-marbles', cat:'Blockers', name:'Hidden marbles', from:'demo_hidden_marbles', slide:'zigzag'},
  {id:'blk-lock-key', cat:'Blockers', name:'Lock & key crate', from:'demo_lock_crate', slide:'winding'},
  {id:'blk-count-crate', cat:'Blockers', name:'Count crate', from:'demo_count_crate', slide:'spiral'},
  {id:'blk-all', cat:'Blockers', name:'All combined', from:'demo_combo', slide:'scurve'},
  // ---------------- Layouts: slides ----------------
  {id:'slide-spiral', cat:'Layouts', group:'Slides', name:'Spiral', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'spiral', trays:four()},
  {id:'slide-s-curve', cat:'Layouts', group:'Slides', name:'S-curve', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'scurve', trays:four()},
  {id:'slide-hairpin', cat:'Layouts', group:'Slides', name:'Hairpin', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'hairpin', trays:four()},
  {id:'slide-zigzag', cat:'Layouts', group:'Slides', name:'Zig-zag', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'zigzag', trays:four(3, 5)},
  {id:'slide-winding', cat:'Layouts', group:'Slides', name:'Winding', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'winding', trays:four()},
  // ---------------- Layouts: tray shapes ----------------
  {id:'tray-default', cat:'Layouts', group:'Tray shapes', name:'Tilted (default)', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'classic', trays:four()},
  {id:'tray-square', cat:'Layouts', group:'Tray shapes', name:'Square to the slide', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'scurve',
   trays:[P(-1, 0.12, 3, 6, 'perp'), P(1, 0.4, 3, 6, 'perp'), P(-1, 0.62, 3, 6, 'perp'), P(1, 0.86, 3, 6, 'perp')]},
  {id:'tray-steep', cat:'Layouts', group:'Tray shapes', name:'Steep', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'scurve',
   trays:[P(-1, 0.12, 3, 6, 'tilt', {tilt:60}), P(1, 0.4, 3, 6, 'tilt', {tilt:60}), P(-1, 0.62, 3, 6, 'tilt', {tilt:60}), P(1, 0.86, 3, 6, 'tilt', {tilt:60})]},
  {id:'tray-deep', cat:'Layouts', group:'Tray shapes', name:'Deep and narrow', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'winding', trays:[P(-1, 0.15, 2, 9), P(1, 0.5, 2, 9), P(-1, 0.82, 2, 9)]},
  {id:'tray-wide', cat:'Layouts', group:'Tray shapes', name:'Wide and shallow', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'spiral', trays:four(5, 3)},
  // ---------------- Layouts: lane counts ----------------
  {id:'lanes-2', cat:'Layouts', group:'Lane counts', name:'2 lanes', lanes:2, colors:5, sizes:[4, 6, 8, 12], slide:'classic', trays:four(3, 5)},
  {id:'lanes-3', cat:'Layouts', group:'Lane counts', name:'3 lanes', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'scurve', trays:four()},
  {id:'lanes-4', cat:'Layouts', group:'Lane counts', name:'4 lanes', lanes:4, colors:6, sizes:[4, 6, 8, 12], slide:'scurve', trays:four()},
  {id:'lanes-5', cat:'Layouts', group:'Lane counts', name:'5 lanes', lanes:5, colors:7, sizes:[4, 6, 8, 12], slide:'winding', trays:four()},
  // ---------------- Jumps: the slide cut by gaps ----------------
  {id:'jump-first', cat:'Jumps', name:'First jump', target:'Easy', lanes:3, colors:4, sizes:[6, 8], slide:'scurve', gaps:[G(1.0, 'flat', 0.5)], trays:four(3, 5)},
  {id:'jump-ramps', cat:'Jumps', name:'Take-off ramps', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'winding', gaps:[G(1.6, 'updown', 0.45)], trays:four()},
  {id:'jump-double', cat:'Jumps', name:'Two gaps', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'winding', gaps:[G(1.2, 'flat', 0.3), G(1.6, 'updown', 0.72)], trays:four(3, 5)},
  {id:'jump-long', cat:'Jumps', name:'Long jump', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'zigzag', gaps:[G(2.4, 'updown', 0.5)], trays:four(3, 5)},
  {id:'jump-spiral', cat:'Jumps', name:'Spiral and gap', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'spiral', gaps:[G(1.2, 'updown', 0.8)], trays:four(3, 5)},
  // ---------------- Toy pieces: one each, then a parade (decorative: they never change the rules) ----------------
  {id:'toy-xylophone', cat:'Toy pieces', name:'Xylophone', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'scurve', toys:[T('xylophone', 0.5)], trays:four(3, 5)},
  {id:'toy-bells', cat:'Toy pieces', name:'Bells', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'winding', toys:[T('bells', 0.5)], trays:four(3, 5)},
  {id:'toy-wheel', cat:'Toy pieces', name:'Paddle wheel', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'hairpin', toys:[T('wheel', 0.45)], trays:four(3, 5)},
  {id:'toy-stairs', cat:'Toy pieces', name:'Zig-zag stairs', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'zigzag', toys:[T('stairs', 0.5)], trays:four(3, 5)},
  {id:'toy-vortex', cat:'Toy pieces', name:'Vortex', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'winding', toys:[T('vortex', 0.55)], trays:four(3, 5)},
  {id:'toy-loop', cat:'Toy pieces', name:'Loop-the-loop', lanes:3, colors:5, sizes:[4, 6, 8, 12], slide:'scurve', toys:[T('loop', 0.45)], trays:four(3, 5)},
  {id:'toy-parade', cat:'Toy pieces', name:'Toy parade', lanes:3, colors:6, sizes:[4, 6, 8, 12], slide:'winding', toys:[T('xylophone', 0.25), T('bells', 0.55), T('loop', 0.85)], trays:[P(-1, 0.15, 3, 6), P(1, 0.5, 3, 6), P(-1, 0.82, 3, 6)]},
]};
