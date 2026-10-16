// The 40 funnel levels: the design table (Match Express's method). Per level: lanes, role, target difficulty (the band of
// the random bot's win rate, see make-funnel.js), colours, box sizes, blockers, the slide (a named shape from
// tools/showcase/specs.js, or a designed meander: {design:{seed, spirals}}), tray requests (c columns x r rows, a shape
// kind - see geometry.js -, the side of the slide, the spot f along it) and the marbles' size K (marbleScale: below 1
// lets bigger trays fit the slide zone).  make-funnel.js places, fills and tunes them.
// blockers: hidden = hidden boxes; link = 'pairs' | 'triple' | 'pairs+triples' | 'triples' (linkN: exactly that many
// groups); disp = how many marble dispensers (easy: shorter ones); hiddenMarbles = the share of hidden marbles behind the
// front row; lock = how many lock crates (each with its key box); count = a count crate.
// Introductions: 7 hidden box (popup), 13 connected pairs (popup), 17 triples (a short hint, no popup), 21 the first
// combination (no popup), 22 hidden marbles (popup), 26 the marble dispenser (popup), 32 lock & key (popup).  The intro
// levels use their blocker a lot and stay easy; from level 21 on, levels carry more.
const P = (side, f, c, r, kind = 'tilt', o = {}) => Object.assign({c, r, kind, side, f}, o);
const four = (c, r, kind = 'tilt') => [P(-1, 0.12, c, r, kind), P(1, 0.4, c, r, kind), P(-1, 0.62, c, r, kind), P(1, 0.86, c, r, kind)];
const three = (c, r, kind = 'tilt') => [P(-1, 0.15, c, r, kind), P(1, 0.5, c, r, kind), P(-1, 0.82, c, r, kind)];
const M = (seed, spirals = 0) => ({design:{seed, spirals}});
module.exports = [
  {n:1, lanes:2, role:'Tutorial', diff:1, colors:2, sizes:[8], slide:'scurve', slideIdea:'a short S-curve', trays:[P(-1, 0.45, 4, 4)], trayIdea:'one tray',
   tutorial:'first-sends', tutorialLane:1},
  {n:2, lanes:2, role:'Teach', diff:2, colors:3, sizes:[8], slide:'classic', slideIdea:'the spiral early', trays:[P(-1, 0.15, 3, 4), P(1, 0.85, 3, 4)], trayIdea:'two small trays'},
  {n:3, lanes:2, role:'Tutorial (box waits)', diff:2, colors:3, sizes:[8], slide:'winding', slideIdea:'winding', trays:[P(-1, 0.25, 4, 4), P(1, 0.7, 4, 4)], trayIdea:'two trays, one each side',
   tutorial:'slot-wait', tutorialLane:1},
  {n:4, lanes:2, role:'Teach (box sizes)', diff:3, colors:4, sizes:[4, 8, 12], slide:'scurve', slideIdea:'S-curve', trays:[P(-1, 0.2, 3, 6), P(1, 0.7, 3, 6)], trayIdea:'two deep trays'},
  {n:5, lanes:2, role:'Fun', diff:2, colors:4, sizes:[8, 12], slide:'spiral', slideIdea:'the first big spiral', trays:three(3, 6), trayIdea:'three trays around the spiral'},
  {n:6, lanes:3, role:'Challenge', diff:5, colors:5, sizes:[4, 6, 8, 12], slide:'hairpin', slideIdea:'hairpin', trays:four(3, 5), trayIdea:'four trays, two each side'},
  {n:7, lanes:3, role:'Teach + POPUP', diff:3, colors:4, sizes:[4, 8, 12], blockers:{hidden:5}, slide:'classic', slideIdea:'the spiral early', trays:three(3, 6), trayIdea:'three trays', popup:'hidden'},
  {n:8, lanes:3, role:'Practice', diff:5, colors:5, sizes:[4, 6, 8, 12], blockers:{hidden:2}, slide:'zigzag', slideIdea:'zig-zag', trays:four(3, 5), trayIdea:'four trays at the turns'},
  {n:9, lanes:2, role:'Relax', diff:3, colors:4, sizes:[6, 8, 12], slide:'winding', slideIdea:'winding', trays:three(3, 6), trayIdea:'three trays'},
  {n:10, lanes:3, role:'Milestone', diff:6, colors:6, sizes:[4, 6, 8, 12], blockers:{hidden:3}, slide:M(3, 1), K:0.85, slideIdea:'a meander with a spiral', trays:four(3, 6), trayIdea:'four trays'},
  {n:11, lanes:3, role:'Relax', diff:3, colors:4, sizes:[6, 8, 12], slide:'spiral', slideIdea:'spiral', trays:three(3, 6, 'perp'), trayIdea:'three trays square to the slide'},
  {n:12, lanes:3, role:'Challenge', diff:6, colors:6, sizes:[4, 6, 8, 12], blockers:{hidden:2}, slide:'classic', K:0.85, slideIdea:'the spiral early', trays:four(3, 7), trayIdea:'four deeper trays'},
  {n:13, lanes:3, role:'Teach + POPUP', diff:3, colors:5, sizes:[4, 6, 8, 12], blockers:{link:'pairs', linkN:4}, slide:'scurve', slideIdea:'S-curve', trays:four(3, 5), trayIdea:'four trays', popup:'connected'},
  {n:14, lanes:3, role:'Practice', diff:6, colors:6, sizes:[4, 6, 8, 12], blockers:{link:'pairs'}, slide:M(5, 1), slideIdea:'a meander with a spiral', trays:four(3, 6), trayIdea:'four trays'},
  {n:15, lanes:3, role:'Fun', diff:3, colors:5, sizes:[8, 12], slide:'hairpin', slideIdea:'hairpin', trays:four(3, 6), trayIdea:'four trays, big boxes'},
  {n:16, lanes:4, role:'Challenge', diff:7, colors:7, sizes:[4, 6, 8, 12], blockers:{link:'pairs', hidden:2}, slide:'spiral', K:0.85, slideIdea:'spiral', trays:four(3, 7), trayIdea:'four deeper trays'},
  {n:17, lanes:3, role:'Teach (no popup, short hint)', diff:4, colors:5, sizes:[4, 6, 8, 12], blockers:{link:'triples', linkN:3}, slide:'winding', slideIdea:'winding', trays:four(3, 6), trayIdea:'four trays', hint:'triple'},
  {n:18, lanes:3, role:'Relax', diff:3, colors:5, sizes:[6, 8, 12], slide:'zigzag', slideIdea:'zig-zag', trays:four(3, 5, 'perp'), trayIdea:'square trays at the turns'},
  {n:19, lanes:3, role:'Practice', diff:6, colors:6, sizes:[4, 6, 8, 12], blockers:{link:'pairs+triples'}, slide:M(7, 1), K:0.85, slideIdea:'a meander with a spiral', trays:four(3, 7), trayIdea:'four deeper trays'},
  {n:20, lanes:4, role:'Milestone', diff:8, colors:7, sizes:[4, 6, 8, 12], blockers:{link:'triples', hidden:2}, slide:'classic', K:0.8, slideIdea:'the spiral early', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:21, lanes:3, role:'Teach (combo, no popup)', diff:5, colors:6, sizes:[4, 6, 8, 12], blockers:{hidden:3, link:'pairs'}, slide:'scurve', slideIdea:'S-curve', trays:four(3, 6), trayIdea:'four trays'},
  {n:22, lanes:2, role:'Relax + POPUP', diff:3, colors:5, sizes:[8, 12], blockers:{hiddenMarbles:0.3}, slide:'spiral', slideIdea:'spiral', trays:three(3, 6), trayIdea:'three trays', popup:'hiddenMarbles'},
  {n:23, lanes:4, role:'Challenge', diff:7, colors:7, sizes:[4, 6, 8, 12], blockers:{hidden:3, link:'pairs', hiddenMarbles:0.15}, slide:'hairpin', K:0.85, slideIdea:'hairpin', trays:four(3, 7), trayIdea:'four deeper trays'},
  {n:24, lanes:3, role:'Fun', diff:4, colors:6, sizes:[8, 12], blockers:{link:'pairs'}, slide:M(9, 1), K:0.85, slideIdea:'a meander with a spiral', trays:four(3, 7), trayIdea:'four trays, big boxes'},
  {n:25, lanes:3, role:'Challenge', diff:8, colors:7, sizes:[4, 6, 8, 12], blockers:{link:'triples', hidden:3, hiddenMarbles:0.15}, slide:'winding', K:0.8, slideIdea:'winding', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:26, lanes:3, role:'Teach + POPUP', diff:3, colors:6, sizes:[6, 8, 12], blockers:{disp:3, easy:true}, slide:'classic', K:0.85, slideIdea:'the spiral early', trays:four(3, 6), trayIdea:'four trays', popup:'dispenser'},
  {n:27, lanes:3, role:'Practice', diff:6, colors:6, sizes:[4, 6, 8, 12], blockers:{disp:2, hidden:2}, slide:'zigzag', K:0.85, slideIdea:'zig-zag', trays:four(3, 7), trayIdea:'four deeper trays'},
  {n:28, lanes:3, role:'Relax', diff:3, colors:5, sizes:[8, 12], blockers:{disp:2, easy:true}, slide:'scurve', slideIdea:'S-curve', trays:four(3, 6), trayIdea:'four trays'},
  {n:29, lanes:3, role:'Challenge', diff:7, colors:7, sizes:[4, 6, 8, 12], blockers:{disp:2, link:'pairs', hidden:2}, slide:M(11, 1), K:0.8, slideIdea:'a meander with a spiral', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:30, lanes:3, role:'Milestone', diff:9, colors:8, sizes:[4, 6, 8, 12], blockers:{disp:2, link:'triples', hidden:3}, slide:'spiral', K:0.8, slideIdea:'spiral', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:31, lanes:2, role:'Relax', diff:3, colors:5, sizes:[8, 12], blockers:{hidden:2}, slide:'hairpin', slideIdea:'hairpin', trays:four(3, 6, 'perp'), trayIdea:'square trays'},
  {n:32, lanes:3, role:'Teach + POPUP', diff:4, colors:6, sizes:[6, 8, 12], blockers:{lock:2}, slide:'winding', slideIdea:'winding', trays:four(3, 6), trayIdea:'four trays', popup:'lock'},
  {n:33, lanes:3, role:'Practice', diff:6, colors:7, sizes:[4, 6, 8, 12], blockers:{lock:2, hidden:2, count:1}, slide:'classic', K:0.85, slideIdea:'the spiral early', trays:four(3, 7), trayIdea:'four deeper trays'},
  {n:34, lanes:3, role:'Fun', diff:4, colors:6, sizes:[8, 12], blockers:{disp:2, easy:true, link:'pairs'}, slide:'zigzag', K:0.85, slideIdea:'zig-zag', trays:four(3, 7), trayIdea:'four trays, big boxes'},
  {n:35, lanes:4, role:'Challenge', diff:8, colors:7, sizes:[4, 6, 8, 12], blockers:{lock:2, link:'pairs', hidden:2}, slide:M(13, 1), K:0.8, slideIdea:'a meander with a spiral', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:36, lanes:3, role:'Relax', diff:4, colors:6, sizes:[6, 8, 12], blockers:{lock:1, hidden:1, count:1}, slide:'scurve', slideIdea:'S-curve', trays:four(3, 6), trayIdea:'four trays'},
  {n:37, lanes:3, role:'Practice', diff:7, colors:7, sizes:[4, 6, 8, 12], blockers:{disp:2, hidden:3, link:'pairs', hiddenMarbles:0.1}, slide:'hairpin', K:0.8, slideIdea:'hairpin', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:38, lanes:5, role:'Challenge', diff:8, colors:8, sizes:[4, 6, 8, 12], blockers:{lock:2, disp:1, link:'pairs', hidden:2}, slide:'winding', K:0.8, slideIdea:'winding', trays:four(3, 8), trayIdea:'four deep trays'},
  {n:39, lanes:3, role:'Fun', diff:5, colors:7, sizes:[8, 12], blockers:{disp:2, easy:true, link:'pairs'}, slide:'spiral', K:0.8, slideIdea:'spiral', trays:four(3, 8), trayIdea:'four deep trays, big boxes'},
  {n:40, lanes:5, role:'Finale', diff:9, colors:8, sizes:[4, 6, 8, 12], blockers:{hidden:3, link:'pairs+triples', disp:2, lock:2, count:1}, slide:'classic', K:0.8, slideIdea:'the spiral early',
   trays:four(3, 8), trayIdea:'four deep trays, every blocker'},
];
