/* Match Express — shared core: rules, level format, layout builder, validation, bots, generator.
   Plain script with no DOM or three.js dependency: the game page, the editor, Web Workers and the
   Node tests all run exactly this code.  Loaded with <script src="shared/core.js">. */
(function factory(root) {
'use strict';

/* ============================== TUNING ============================== */
const BUS_SPEED          = 3.4;   // main-road cruise speed (world units / s)
const BOARD_RATE         = 8;     // stickmen leaving a front row per second (chains speed up)
const COLUMN_SHIFT_TIME  = 0.22;  // seconds for a column to step forward one place
const ROAD_CAPACITY      = 5;     // road counter: +1 when a bus is sent to the road, -1 when a full bus jumps off or a returning bus parks
const STATIC_SLOTS       = 5;     // parking bays in the static row
const PARACHUTE_DURATION = 2.6;   // seconds a full bus glides before leaving the screen
const RETURN_TUNNEL_TIME = 2.0;   // seconds between the top tunnel and the return tunnel
const WIN_PANEL_DELAY    = 1.0;   // seconds after the last parachute opens

/* ============================ LEVEL DATA ============================
   The built-in level (format 2).  Its stickmen and buses were produced once by
   generateLevel(11) + searchSeed() and frozen; the road and ramp placement are the
   hand-made compact layout (tests/fixtures/level2-classic.json keeps the original, wider one).  Ramps: "cp" = road control point the boarding point sits at
   (or "at" = arc length along the road), "side" +1 right / -1 left, optional
   "shape" = spline points [x,z] after the attach point, "columns" listed FRONT
   (road end) to BACK; a cell is "red", "?red" (hidden stickman) or null (empty).
   Lanes: front bus first; "hidden" shows a grey "?" bus, "link" ties buses together.
   The editor (editor.html) writes this same format. */
const LEVEL_DATA = /*LEVEL_BEGIN*/{
  "format": 2,
  "name": "Level 2",
  "seed": 11,
  "road": {
    "points": [
      {"x": 0, "z": -1.3, "y": 0},
      {"x": 0, "z": -3.3, "y": 0.05},
      {"x": 0, "z": -5.3, "y": 0.1},
      {"x": 0, "z": -7.3, "y": 0.15},
      {"x": 0, "z": -9.3, "y": 0.2},
      {"x": 0, "z": -11, "y": 0.25},
      {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
      {"x": 0.66, "z": -11.98, "y": 1.58},
      {"x": 1.55, "z": -11.93, "y": 1.6},
      {"x": 2.28, "z": -12.47, "y": 1.62},
      {"x": 2.6, "z": -13.8, "y": 1.62},
      {"x": 2.6, "z": -15.6, "y": 1.35},
      {"x": 2, "z": -17.4, "y": 1.05},
      {"x": 0.75, "z": -18.7, "y": 0.85},
      {"x": -0.2, "z": -19.75, "y": 0.7}
    ]
  },
  "ramps": [
    {"side": -1, "columns": [["red", "red", "orange", "orange", "pink", "pink", "green", "green", "yellow", "purple"], ["purple", "purple", "cyan", "cyan", "cyan", "blue", "blue", "purple", "blue", "blue"], ["red", "red", "pink", "pink", "pink", "orange", "orange", "red", "red", "red"], ["orange", "orange", "orange", "orange", "green", "green", "green", "orange", "orange", "yellow"]], "at": 2.2},
    {"side": 1, "columns": [["pink", "pink", "pink", "pink", "red", "red", "purple", "red", "red"], ["red", "red", "green", "green", "yellow", "yellow", "purple", "purple", "purple"], ["orange", "blue", "blue", "blue", "cyan", "cyan", "yellow", "yellow", "green"], ["green", "orange", "orange", "pink", "pink", "pink", "green", "red", "red"]], "at": 3.96},
    {"side": -1, "columns": [["green", "green", "yellow", "yellow", "purple", "purple", "yellow", "green", "green", "blue"], ["orange", "orange", "orange", "orange", "purple", "purple", "yellow", "green", "green", "orange"], ["yellow", "yellow", "cyan", "red", "red", "purple", "orange", "orange", "orange", "cyan"], ["purple", "purple", "pink", "pink", "pink", "cyan", "cyan", "cyan", "purple", "yellow"]], "at": 6.54},
    {"side": 1, "columns": [["yellow", "pink", "pink", "pink", "pink", "yellow", "yellow", "yellow", "cyan"], ["pink", "pink", "pink", "pink", "yellow", "yellow", "red", "red", "cyan"], ["cyan", "cyan", "cyan", "blue", "green", "yellow", "yellow", "yellow", "yellow"], ["green", "red", "red", "red", "red", "purple", "purple", "orange", "orange"]], "at": 7.81},
    {"side": -1, "columns": [["purple", "purple", "blue", "cyan", "cyan", "cyan", "cyan", "blue", "yellow", "green"], ["green", "green", "green", "blue", "red", "orange", "purple", "purple", "blue", "blue"], ["blue", "green", "cyan", "cyan", "purple", "purple", "blue", "cyan", "cyan", "blue"], ["pink", "blue", "blue", "blue", "green", "blue", "cyan", "blue", "blue", "blue"]], "at": 29.73, "shape": [[-3.27, -15.39]]}
  ],
  "lanes": [
    [
      {"color": "red", "cap": 4},
      {"color": "pink", "cap": 12},
      {"color": "orange", "cap": 6},
      {"color": "green", "cap": 12, "hidden": true},
      {"color": "purple", "cap": 8},
      {"color": "pink", "cap": 6},
      {"color": "yellow", "cap": 6},
      {"color": "blue", "cap": 4},
      {"color": "cyan", "cap": 8}
    ],
    [
      {"color": "blue", "cap": 4},
      {"color": "cyan", "cap": 8},
      {"color": "purple", "cap": 6},
      {"color": "yellow", "cap": 6},
      {"color": "pink", "cap": 6},
      {"color": "blue", "cap": 8},
      {"color": "orange", "cap": 8},
      {"color": "orange", "cap": 6},
      {"color": "green", "cap": 12}
    ],
    [
      {"color": "purple", "cap": 4},
      {"color": "yellow", "cap": 12},
      {"color": "red", "cap": 8},
      {"color": "cyan", "cap": 8},
      {"color": "blue", "cap": 8},
      {"color": "red", "cap": 12},
      {"color": "orange", "cap": 4},
      {"color": "purple", "cap": 6, "hidden": true}
    ]
  ]
}/*LEVEL_END*/;
/* bundled levels (the editor seeds a slot for each; the game loads one with ?level=<id> or from its
   settings menu).  Each is a copy of levels/<id>.json written by tools/sync-presets.js;
   tests/shared.test.js checks they match. */
const PRESETS = /*PRESETS_BEGIN*/{
  "crowded-rush": {
    "format": 2,
    "name": "Crowded Rush",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -2, "y": 0},
        {"x": -0.18, "z": -3.1, "y": 0.04},
        {"x": -0.12, "z": -4.2, "y": 0.08},
        {"x": -0.03, "z": -5.2, "y": 0.12},
        {"x": 0.08, "z": -6.1, "y": 0.16},
        {"x": 0.8, "z": -7.04, "y": 0.25, "spiral": {"r": 0.92, "side": 1, "yCross": 1.55}},
        {"x": -0.94, "z": -7.7, "y": 1.58},
        {"x": -1.4, "z": -8.54, "y": 1.62},
        {"x": -1.2, "z": -9.5, "y": 1.66},
        {"x": -0.03, "z": -11.03, "y": 1.7},
        {"x": 0.49, "z": -11.83, "y": 1.74},
        {"x": 0.48, "z": -12.74, "y": 1.78},
        {"x": 0.2, "z": -14.2, "y": 1.82},
        {"x": 0, "z": -15, "y": 1.85}
      ],
      "tail": [0, 1.85, -17.1]
    },
    "ramps": [
      {"side": 1, "rows": 15, "columns": [["cyan", "cyan", "blue", "blue", "orange", "orange", "orange", "red", "red", "blue", "blue", "blue", "cyan", "cyan", "cyan"], ["green", "orange", "orange", "orange", "green", "red", "red", "yellow", "yellow", "pink", "pink", "pink", "green", "red", "red"], ["purple", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "purple", "purple", "purple", "orange", "orange", "orange", "yellow"], ["yellow", "pink", "pink", "green", "pink", "cyan", "yellow", "yellow", "purple", "purple", "cyan", "cyan", "cyan", "purple", "purple"], ["orange", "orange", "blue", "cyan", "cyan", "blue", "blue", "blue", "green", "green", "green", "purple", "pink", "pink", "red"], ["red", "pink", "pink", "pink", "red", "red", "blue", "blue", "green", "green", "green", "yellow", "yellow", "yellow", "green"]], "at": 2.6, "shape": [[6.89, -3.68]]},
      {"side": -1, "rows": 10, "columns": [["green", "red", "red", "red", "green", "blue", "orange", "yellow", "green", "pink"], ["red", "purple", "pink", "cyan", "purple", "blue", "cyan", "yellow", "blue", "cyan"], ["orange", "pink", "purple", "yellow", "yellow", "green", "green", "pink", "orange", "cyan"], ["yellow", "red", "red", "green", "blue", "orange", "orange", "green", "pink", "red"], ["purple", "purple", "cyan", "purple", "blue", "cyan", "yellow", "red", "cyan", "blue"], ["pink", "orange", "yellow", "purple", "green", "green", "pink", "orange", "cyan", "yellow"], ["green", "pink", "red", "red", "orange", "blue", "green", "yellow", "purple", "pink"], ["red", "purple", "pink", "cyan", "blue", "blue", "red", "cyan", "blue", "blue"], ["orange", "yellow", "purple", "green", "yellow", "pink", "purple", "cyan", "orange", "orange"]], "at": 3.5},
      {"side": 1, "rows": 15, "columns": [["yellow", "yellow", "pink", "pink", "cyan", "yellow", "yellow", "cyan", "cyan", "red", "cyan", "cyan", "yellow", "yellow", "yellow"], ["green", "green", "blue", "blue", "pink", "yellow", "cyan", "cyan", "green", "green", "red", "green", "green", "cyan", "purple"], ["purple", "cyan", "red", "red", "red", "purple", "purple", "purple", "green", "green", "blue", "blue", "blue", "orange", "orange"], ["purple", "purple", "red", "red", "red", "orange", "orange", "orange", "pink", "pink", "yellow", "red", "red", "orange", "orange"], ["cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "purple", "purple", "orange", "orange", "green", "green", "pink", "pink"], ["red", "purple", "purple", "blue", "blue", "blue", "green", "green", "pink", "blue", "blue", "blue", "orange", "orange", "blue"]], "at": 20, "shape": [[6.73, -8.58]]},
      {"side": -1, "rows": 15, "columns": [["red", "red", "blue", "blue", "cyan", "cyan", "orange", "orange", "orange", "blue", "purple", "yellow", "yellow", "yellow", "pink"], ["pink", "yellow", "orange", "orange", "red", "blue", "blue", "blue", "green", "green", "green", "purple", "purple", "blue", "blue"], ["blue", "green", "green", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "red", "purple", "purple", "pink", "pink"], ["purple", "cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "green", "green", "green", "cyan", "cyan", "cyan", "orange"], ["orange", "orange", "red", "red", "orange", "orange", "orange", "purple", "purple", "purple", "pink", "pink", "pink", "cyan", "cyan"], ["cyan", "yellow", "yellow", "yellow", "red", "red", "cyan", "red", "blue", "blue", "blue", "green", "green", "green", "pink"]], "at": 19.2, "shape": [[-5.93, -14.88]]}
    ],
    "lanes": [
      [
        {"color": "purple", "cap": 6},
        {"color": "red", "cap": 6},
        {"color": "pink", "cap": 8},
        {"color": "red", "cap": 12},
        {"color": "orange", "cap": 4, "hidden": true},
        {"color": "green", "cap": 8},
        {"color": "green", "cap": 6},
        {"color": "cyan", "cap": 6},
        {"color": "yellow", "cap": 8},
        {"color": "cyan", "cap": 8},
        {"color": "orange", "cap": 12},
        {"color": "cyan", "cap": 8},
        {"color": "blue", "cap": 6},
        {"color": "green", "cap": 6},
        {"color": "orange", "cap": 8},
        {"color": "pink", "cap": 6}
      ],
      [
        {"color": "cyan", "cap": 12},
        {"color": "pink", "cap": 8},
        {"color": "yellow", "cap": 4},
        {"color": "purple", "cap": 4},
        {"color": "purple", "cap": 12},
        {"color": "blue", "cap": 12},
        {"color": "blue", "cap": 6},
        {"color": "red", "cap": 12, "hidden": true},
        {"color": "blue", "cap": 12},
        {"color": "green", "cap": 4},
        {"color": "pink", "cap": 8},
        {"color": "purple", "cap": 12},
        {"color": "red", "cap": 4},
        {"color": "pink", "cap": 6},
        {"color": "cyan", "cap": 6},
        {"color": "blue", "cap": 6}
      ],
      [
        {"color": "purple", "cap": 4},
        {"color": "yellow", "cap": 6},
        {"color": "yellow", "cap": 12},
        {"color": "green", "cap": 6},
        {"color": "orange", "cap": 12},
        {"color": "red", "cap": 4},
        {"color": "pink", "cap": 8},
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 8},
        {"color": "orange", "cap": 8},
        {"color": "green", "cap": 8, "hidden": true},
        {"color": "yellow", "cap": 8},
        {"color": "yellow", "cap": 8},
        {"color": "red", "cap": 8},
        {"color": "purple", "cap": 6},
        {"color": "cyan", "cap": 4}
      ]
    ]
  },
  "crowded-rush-curve": {
    "format": 2,
    "name": "Crowded Rush Curve",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -2, "y": 0},
        {"x": -0.18, "z": -3.1, "y": 0.04},
        {"x": -0.12, "z": -4.2, "y": 0.08},
        {"x": -0.03, "z": -5.2, "y": 0.12},
        {"x": 0.08, "z": -6.1, "y": 0.16},
        {"x": 0.8, "z": -7.04, "y": 0.25, "spiral": {"r": 0.92, "side": 1, "yCross": 1.55}},
        {"x": -0.94, "z": -7.7, "y": 1.58},
        {"x": -1.4, "z": -8.54, "y": 1.62},
        {"x": -1.2, "z": -9.5, "y": 1.66},
        {"x": -0.03, "z": -11.03, "y": 1.7},
        {"x": 0.49, "z": -11.83, "y": 1.74},
        {"x": 0.48, "z": -12.74, "y": 1.78},
        {"x": 0.2, "z": -14.2, "y": 1.82},
        {"x": 0, "z": -15, "y": 1.85}
      ],
      "tail": [0, 1.85, -17.1]
    },
    "ramps": [
      {"at": 2.7, "side": 1, "shape": [[6.9, -3.79]], "rows": 15, "columns": [["cyan", "cyan", "blue", "blue", "orange", "orange", "orange", "red", "red", "blue", "blue", "blue", "cyan", "cyan", "cyan"], ["green", "orange", "orange", "orange", "green", "red", "red", "yellow", "yellow", "pink", "pink", "pink", "green", "red", "red"], ["purple", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "purple", "purple", "purple", "orange", "orange", "orange", "yellow"], ["yellow", "pink", "pink", "green", "pink", "cyan", "yellow", "yellow", "purple", "purple", "cyan", "cyan", "cyan", "purple", "purple"], ["orange", "orange", "blue", "cyan", "cyan", "blue", "blue", "blue", "green", "green", "green", "purple", "pink", "pink", "red"], ["red", "pink", "pink", "pink", "red", "red", "blue", "blue", "green", "green", "green", "yellow", "yellow", "yellow", "green"]]},
      {"at": 3.4, "side": -1, "shape": [[-5.32, -4.83]], "rows": 10, "columns": [["green", "red", "red", "red", "green", "blue", "orange", "yellow", "green", "pink"], ["red", "purple", "pink", "cyan", "purple", "blue", "cyan", "yellow", "blue", "cyan"], ["orange", "pink", "purple", "yellow", "yellow", "green", "green", "pink", "orange", "cyan"], ["yellow", "red", "red", "green", "blue", "orange", "orange", "green", "pink", "red"], ["purple", "purple", "cyan", "purple", "blue", "cyan", "yellow", "red", "cyan", "blue"], ["pink", "orange", "yellow", "purple", "green", "green", "pink", "orange", "cyan", "yellow"], ["green", "pink", "red", "red", "orange", "blue", "green", "yellow", "purple", "pink"], ["red", "purple", "pink", "cyan", "blue", "blue", "red", "cyan", "blue", "blue"], ["orange", "yellow", "purple", "green", "yellow", "pink", "purple", "cyan", "orange", "orange"]]},
      {"at": 20, "side": 1, "shape": [[6.73, -8.58]], "rows": 15, "columns": [["yellow", "yellow", "pink", "pink", "cyan", "yellow", "yellow", "cyan", "cyan", "red", "cyan", "cyan", "yellow", "yellow", "yellow"], ["green", "green", "blue", "blue", "pink", "yellow", "cyan", "cyan", "green", "green", "red", "green", "green", "cyan", "purple"], ["purple", "cyan", "red", "red", "red", "purple", "purple", "purple", "green", "green", "blue", "blue", "blue", "orange", "orange"], ["purple", "purple", "red", "red", "red", "orange", "orange", "orange", "pink", "pink", "yellow", "red", "red", "orange", "orange"], ["cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "purple", "purple", "orange", "orange", "green", "green", "pink", "pink"], ["red", "purple", "purple", "blue", "blue", "blue", "green", "green", "pink", "blue", "blue", "blue", "orange", "orange", "blue"]]},
      {"at": 21.4, "side": -1, "shape": [[-6.58, -12.82]], "rows": 15, "columns": [["red", "red", "blue", "blue", "cyan", "cyan", "orange", "orange", "orange", "blue", "purple", "yellow", "yellow", "yellow", "pink"], ["pink", "yellow", "orange", "orange", "red", "blue", "blue", "blue", "green", "green", "green", "purple", "purple", "blue", "blue"], ["blue", "green", "green", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "red", "purple", "purple", "pink", "pink"], ["purple", "cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "green", "green", "green", "cyan", "cyan", "cyan", "orange"], ["orange", "orange", "red", "red", "orange", "orange", "orange", "purple", "purple", "purple", "pink", "pink", "pink", "cyan", "cyan"], ["cyan", "yellow", "yellow", "yellow", "red", "red", "cyan", "red", "blue", "blue", "blue", "green", "green", "green", "pink"]]}
    ],
    "lanes": [
      [
        {"color": "purple", "cap": 6},
        {"color": "red", "cap": 6},
        {"color": "pink", "cap": 8},
        {"color": "red", "cap": 12},
        {"color": "orange", "cap": 4, "hidden": true},
        {"color": "green", "cap": 8},
        {"color": "green", "cap": 6},
        {"color": "cyan", "cap": 6},
        {"color": "yellow", "cap": 8},
        {"color": "cyan", "cap": 8},
        {"color": "orange", "cap": 12},
        {"color": "cyan", "cap": 8},
        {"color": "blue", "cap": 6},
        {"color": "green", "cap": 6},
        {"color": "orange", "cap": 8},
        {"color": "pink", "cap": 6}
      ],
      [
        {"color": "cyan", "cap": 12},
        {"color": "pink", "cap": 8},
        {"color": "yellow", "cap": 4},
        {"color": "purple", "cap": 4},
        {"color": "purple", "cap": 12},
        {"color": "blue", "cap": 12},
        {"color": "blue", "cap": 6},
        {"color": "red", "cap": 12, "hidden": true},
        {"color": "blue", "cap": 12},
        {"color": "green", "cap": 4},
        {"color": "pink", "cap": 8},
        {"color": "purple", "cap": 12},
        {"color": "red", "cap": 4},
        {"color": "pink", "cap": 6},
        {"color": "cyan", "cap": 6},
        {"color": "blue", "cap": 6}
      ],
      [
        {"color": "purple", "cap": 4},
        {"color": "yellow", "cap": 6},
        {"color": "yellow", "cap": 12},
        {"color": "green", "cap": 6},
        {"color": "orange", "cap": 12},
        {"color": "red", "cap": 4},
        {"color": "pink", "cap": 8},
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 8},
        {"color": "orange", "cap": 8},
        {"color": "green", "cap": 8, "hidden": true},
        {"color": "yellow", "cap": 8},
        {"color": "yellow", "cap": 8},
        {"color": "red", "cap": 8},
        {"color": "purple", "cap": 6},
        {"color": "cyan", "cap": 4}
      ]
    ]
  },
  "demo_hidden_bus": {
    "format": 2,
    "id": "demo_hidden_bus",
    "name": "Demo: Hidden Buses",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {"side": -1, "rows": 6, "columns": [["yellow", "red", "yellow", "blue", "yellow", "yellow"], ["yellow", "yellow", "yellow", "red", "red", "red"], ["green", "green", "green", "yellow", "red", "red"], ["blue", "yellow", "yellow", "red", "red", "red"]], "cp": 1},
      {"side": 1, "rows": 6, "columns": [["blue", "blue", "red", "blue", "blue", "blue"], ["yellow", "red", "red", "red", "blue", "red"], ["yellow", "red", "red", "blue", "blue", "yellow"], ["yellow", "yellow", "yellow", "blue", "red", "red"]], "cp": 2},
      {"side": 1, "rows": 6, "columns": [["blue", "blue", "green", "green", "green", "red"], ["green", "yellow", "red", "red", "yellow", "green"], ["yellow", "yellow", "yellow", "green", "green", "green"], ["red", "blue", "blue", "red", "red", "yellow"]], "cp": 4},
      {"side": -1, "rows": 6, "columns": [["yellow", "yellow", "blue", "blue", "green", "blue"], ["blue", "blue", "green", "green", "green", "blue"], ["blue", "green", "green", "blue", "green", "green"], ["green", "green", "green", "blue", "green", "green"]], "at": 28.897, "shape": [[-1.32, -15.45]]}
    ],
    "lanes": [
      [
        {"color": "red", "cap": 6},
        {"color": "green", "cap": 6, "hidden": true},
        {"color": "green", "cap": 6},
        {"color": "blue", "cap": 4, "hidden": true},
        {"color": "red", "cap": 6}
      ],
      [
        {"color": "red", "cap": 6},
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 6, "hidden": true},
        {"color": "yellow", "cap": 12},
        {"color": "yellow", "cap": 12}
      ],
      [
        {"color": "blue", "cap": 12},
        {"color": "blue", "cap": 4, "hidden": true},
        {"color": "green", "cap": 6},
        {"color": "red", "cap": 6}
      ]
    ]
  },
  "demo_connected": {
    "format": 2,
    "id": "demo_connected",
    "name": "Demo: Connected Buses",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {"side": -1, "rows": 6, "columns": [["green", "blue", "blue", "blue", "green", "red"], ["blue", "blue", "yellow", "yellow", "red", "red"], ["green", "green", "yellow", "yellow", "yellow", "red"], ["blue", "blue", "yellow", "yellow", "yellow", "blue"]], "at": 3.06},
      {"side": 1, "rows": 6, "columns": [["green", "yellow", "yellow", "yellow", "green", "green"], ["red", "green", "blue", "blue", "blue", "red"], ["green", "green", "green", "red", "red", "red"], ["yellow", "yellow", "yellow", "green", "green", "blue"]], "at": 3},
      {"side": 1, "rows": 6, "columns": [["green", "red", "red", "red", "green", "red"], ["blue", "blue", "yellow", "yellow", "yellow", "blue"], ["green", "green", "green", "yellow", "red", "red"], ["blue", "blue", "red", "red", "green", "blue"]], "at": 7.66},
      {"side": -1, "rows": 6, "columns": [["red", "red", "blue", "blue", "yellow", "red"], ["yellow", "blue", "blue", "yellow", "yellow", "red"], ["yellow", "blue", "green", "green", "green", "red"], ["green", "green", "blue", "yellow", "red", "red"]], "at": 28.93}
    ],
    "lanes": [
      [
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 4, "link": "A"},
        {"color": "red", "cap": 4},
        {"color": "green", "cap": 8, "link": "C"},
        {"color": "blue", "cap": 8},
        {"color": "yellow", "cap": 6}
      ],
      [
        {"color": "red", "cap": 6},
        {"color": "red", "cap": 6, "link": "A"},
        {"color": "blue", "cap": 4},
        {"color": "red", "cap": 8, "link": "C"},
        {"color": "yellow", "cap": 6},
        {"color": "yellow", "cap": 6}
      ],
      [
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 4, "link": "B"},
        {"color": "yellow", "cap": 6, "link": "B"},
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 8, "link": "C"}
      ]
    ]
  },
  "demo_tunnel": {
    "format": 2,
    "id": "demo_tunnel",
    "name": "Demo: Colourful Tunnels",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["red", "red", "blue", "blue", "yellow", "yellow"],
          ["green", "green", "green", "red", "red", "red"],
          ["red", "red", "yellow", "yellow", "yellow", "green"],
          ["red", "red", "red", "yellow", "red", "yellow"]
        ],
        "cp": 1
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["yellow", "blue", "red", "red", "red", "green"],
          ["blue", "yellow", null, null, "yellow", "yellow"],
          ["yellow", "yellow", "red", "red", "red", "green"],
          ["yellow", "yellow", "green", "green", "blue", "blue"]
        ],
        "tunnels": [
          {"col": 1, "row": 2, "w": 1, "h": 2, "color": "red", "count": 6}
        ],
        "cp": 2
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["blue", "blue", "blue", "red", "red", "yellow"],
          ["yellow", null, "red", "red", "blue", "yellow"],
          ["red", null, "green", "yellow", "green", "green"],
          ["yellow", "yellow", "green", "green", "blue", "blue"]
        ],
        "tunnels": [
          {"col": 1, "row": 1, "w": 2, "h": 1, "color": "blue", "count": 8}
        ],
        "cp": 4
      },
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["green", "blue", "blue", "green", "green", "green"],
          ["yellow", "blue", "blue", "green", "green", "green"],
          ["blue", "blue", "yellow", "yellow", "yellow", "green"],
          ["green", "green", "yellow", "green", "green", "green"]
        ],
        "at": 28.897,
        "shape": [[-1.32, -15.45]]
      }
    ],
    "lanes": [
      [
        {"color": "green", "cap": 4},
        {"color": "red", "cap": 6},
        {"color": "yellow", "cap": 4},
        {"color": "yellow", "cap": 4},
        {"color": "green", "cap": 8},
        {"color": "green", "cap": 4},
        {"color": "yellow", "cap": 6}
      ],
      [
        {"color": "blue", "cap": 6},
        {"color": "green", "cap": 6},
        {"color": "red", "cap": 6},
        {"color": "blue", "cap": 6},
        {"color": "red", "cap": 4},
        {"color": "yellow", "cap": 4}
      ],
      [
        {"color": "blue", "cap": 6},
        {"color": "blue", "cap": 8},
        {"color": "green", "cap": 4},
        {"color": "red", "cap": 4},
        {"color": "red", "cap": 8},
        {"color": "yellow", "cap": 8}
      ]
    ]
  },
  "demo_hidden_men": {
    "format": 2,
    "id": "demo_hidden_men",
    "name": "Demo: Hidden Stickmen",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {"side": -1, "rows": 6, "columns": [["red", "red", "?red", "?blue", "?blue", "?blue"], ["red", "?red", "red", "?green", "?green", "yellow"], ["red", "?blue", "?yellow", "?yellow", "?blue", "green"], ["yellow", "?yellow", "?yellow", "?blue", "?blue", "?yellow"]], "cp": 1},
      {"side": 1, "rows": 6, "columns": [["yellow", "?yellow", "yellow", "red", "?yellow", "?yellow"], ["yellow", "yellow", "yellow", "?blue", "?blue", "green"], ["green", "green", "green", "?yellow", "?green", "?green"], ["blue", "?red", "red", "?red", "green", "yellow"]], "cp": 2},
      {"side": 1, "rows": 6, "columns": [["red", "?blue", "?blue", "?red", "?yellow", "yellow"], ["red", "?green", "?green", "red", "yellow", "?green"], ["red", "?red", "?blue", "?yellow", "blue", "blue"], ["green", "?red", "red", "?yellow", "?yellow", "yellow"]], "cp": 4},
      {"side": -1, "rows": 6, "columns": [["blue", "?blue", "?green", "?red", "?red", "?blue"], ["red", "?green", "?green", "?green", "?blue", "?blue"], ["blue", "?blue", "blue", "green", "?green", "green"], ["green", "green", "green", "?blue", "?red", "?red"]], "at": 28.897, "shape": [[-1.32, -15.45]]}
    ],
    "lanes": [
      [
        {"color": "green", "cap": 6},
        {"color": "blue", "cap": 8},
        {"color": "yellow", "cap": 4},
        {"color": "blue", "cap": 8},
        {"color": "red", "cap": 12}
      ],
      [
        {"color": "green", "cap": 6},
        {"color": "yellow", "cap": 4},
        {"color": "green", "cap": 6},
        {"color": "red", "cap": 8},
        {"color": "red", "cap": 4}
      ],
      [
        {"color": "green", "cap": 6},
        {"color": "yellow", "cap": 8},
        {"color": "yellow", "cap": 8},
        {"color": "blue", "cap": 8}
      ]
    ]
  },
  "demo_lock_box": {
    "format": 2,
    "id": "demo_lock_box",
    "name": "Demo: Lock & Key",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["blue", "blue", "yellow", "blue", "blue", "blue"],
          ["red", "red", "yellow", "red", "red", "yellow"],
          ["red", "red", "red", "yellow", "green", "yellow"],
          ["yellow", "yellow", "blue", "blue", "blue", "yellow"]
        ],
        "cp": 1
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["green", "green", "yellow", "yellow", "yellow", "red"],
          ["blue", "blue", "blue", "red", "red", "red"],
          ["yellow", "blue", "blue", "yellow", "red", "red"],
          ["yellow", "blue", "green", "green", "red", "red"]
        ],
        "cp": 2
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["yellow", "green", "green", "red", "red", "green"],
          ["green", "green", "blue", "red", "green", "green"],
          ["red", "blue", "red", "red", "red", "green"],
          ["blue", "blue", "red", "red", "yellow", "yellow"]
        ],
        "boxes": [
          {"col": 0, "row": 0, "w": 2, "h": 2, "lock": "K1"}
        ],
        "cp": 4
      },
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "yellow", "green", "green", "green"],
          ["yellow", "green", "green", "yellow", "yellow", "blue"],
          ["green", "green", "yellow", "blue", "blue", "blue"],
          ["green", "green", "green", "blue", "blue", "green"]
        ],
        "at": 28.897,
        "shape": [[-1.32, -15.45]]
      }
    ],
    "lanes": [
      [
        {"color": "yellow", "cap": 6},
        {"color": "blue", "cap": 4},
        {"color": "yellow", "cap": 12, "key": "K1"},
        {"color": "red", "cap": 4},
        {"color": "red", "cap": 6},
        {"color": "blue", "cap": 4}
      ],
      [
        {"color": "green", "cap": 4},
        {"color": "green", "cap": 4},
        {"color": "green", "cap": 4},
        {"color": "green", "cap": 8},
        {"color": "blue", "cap": 4},
        {"color": "blue", "cap": 12}
      ],
      [
        {"color": "yellow", "cap": 6},
        {"color": "red", "cap": 4},
        {"color": "red", "cap": 4},
        {"color": "red", "cap": 6},
        {"color": "green", "cap": 4}
      ]
    ]
  },
  "demo_count_box": {
    "format": 2,
    "id": "demo_count_box",
    "name": "Demo: Count Box",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["green", "yellow", "yellow", "yellow", "blue", "blue"],
          ["red", "red", "yellow", "blue", "blue", "red"],
          ["red", "red", "red", "blue", "green", "green"],
          ["green", "green", "blue", "blue", "blue", "red"]
        ],
        "cp": 1
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "red", "red", "green", "green"],
          ["red", "red", "yellow", "yellow", "yellow", "green"],
          ["green", "green", "green", "blue", "green", "red"],
          ["green", "yellow", "green", "red", "blue", "blue"]
        ],
        "boxes": [
          {"col": 2, "row": 1, "w": 2, "h": 2, "count": 3}
        ],
        "cp": 2
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "red", "red", "red", "green"],
          ["green", "green", "green", "blue", "blue", "blue"],
          ["yellow", "yellow", "green", "blue", "yellow", "yellow"],
          ["green", "blue", "blue", "red", "red", "red"]
        ],
        "cp": 4
      },
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["red", "red", "red", "yellow", "blue", "blue"],
          ["green", "red", "blue", "blue", "green", "green"],
          ["green", "yellow", "yellow", "yellow", "blue", "blue"],
          ["yellow", "yellow", "yellow", "red", "yellow", "blue"]
        ],
        "at": 28.897,
        "shape": [[-1.32, -15.45]]
      }
    ],
    "lanes": [
      [
        {"color": "yellow", "cap": 4},
        {"color": "yellow", "cap": 4},
        {"color": "green", "cap": 4},
        {"color": "red", "cap": 6},
        {"color": "blue", "cap": 4},
        {"color": "green", "cap": 8}
      ],
      [
        {"color": "yellow", "cap": 4},
        {"color": "blue", "cap": 8},
        {"color": "green", "cap": 4},
        {"color": "blue", "cap": 4},
        {"color": "red", "cap": 6},
        {"color": "green", "cap": 8}
      ],
      [
        {"color": "blue", "cap": 4},
        {"color": "red", "cap": 6},
        {"color": "yellow", "cap": 12},
        {"color": "red", "cap": 6},
        {"color": "blue", "cap": 4}
      ]
    ]
  },
  "demo_combo": {
    "format": 2,
    "id": "demo_combo",
    "name": "Demo: All Together",
    "road": {
      "points": [
        {"x": 0, "z": -1.3, "y": 0},
        {"x": 0, "z": -3.3, "y": 0.05},
        {"x": 0, "z": -5.3, "y": 0.1},
        {"x": 0, "z": -7.3, "y": 0.15},
        {"x": 0, "z": -9.3, "y": 0.2},
        {"x": 0, "z": -11, "y": 0.25},
        {"x": 0, "z": -12.6, "y": 0.3, "spiral": {"r": 1.1, "side": -1, "yCross": 1.55}},
        {"x": 0.66, "z": -11.98, "y": 1.58},
        {"x": 1.55, "z": -11.93, "y": 1.6},
        {"x": 2.28, "z": -12.47, "y": 1.62},
        {"x": 2.6, "z": -13.8, "y": 1.62},
        {"x": 2.6, "z": -15.6, "y": 1.35},
        {"x": 2, "z": -17.4, "y": 1.05},
        {"x": 0.75, "z": -18.7, "y": 0.85},
        {"x": -0.2, "z": -19.75, "y": 0.7}
      ]
    },
    "ramps": [
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["green", "green", "green", "red", "red", "green"],
          ["yellow", "yellow", "red", "red", "red", "purple"],
          ["green", "green", "purple", "purple", "red", "red"],
          ["blue", "purple", "red", "purple", "green", "red"]
        ],
        "cp": 1
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["green", "red", "red", "red", "blue", "blue"],
          ["yellow", "yellow", "yellow", "purple", "purple", "purple"],
          ["blue", "blue", "yellow", "yellow", "blue", "blue"],
          ["red", "red", "red", "yellow", "green", "green"]
        ],
        "boxes": [
          {"col": 0, "row": 1, "w": 2, "h": 2, "lock": "K"}
        ],
        "cp": 2
      },
      {
        "side": 1,
        "rows": 6,
        "columns": [
          ["blue", "?red", "red", "red", "?green", "green"],
          ["yellow", "?yellow", "red", "blue", "?blue", "green"],
          ["purple", "?purple", "red", "yellow", "?blue", "?blue"],
          ["green", "?purple", "blue", "?blue", "?blue", "yellow"]
        ],
        "cp": 4
      },
      {
        "side": -1,
        "rows": 6,
        "columns": [
          ["purple", "purple", "purple", "yellow", "yellow", "yellow"],
          ["purple", "purple", "blue", "blue", "blue", "yellow"],
          ["purple", "purple", null, null, "purple", "purple"],
          ["yellow", "blue", "yellow", "yellow", "blue", "yellow"]
        ],
        "tunnels": [
          {"col": 2, "row": 2, "w": 1, "h": 2, "color": "green", "count": 6}
        ],
        "at": 28.897,
        "shape": [[-1.32, -15.45]]
      }
    ],
    "lanes": [
      [
        {"color": "red", "cap": 4},
        {"color": "purple", "cap": 4},
        {"color": "yellow", "cap": 4, "link": "G", "key": "K"},
        {"color": "purple", "cap": 4},
        {"color": "yellow", "cap": 4},
        {"color": "green", "cap": 8}
      ],
      [
        {"color": "red", "cap": 4},
        {"color": "red", "cap": 12},
        {"color": "blue", "cap": 8, "hidden": true},
        {"color": "yellow", "cap": 6, "link": "G"},
        {"color": "purple", "cap": 12}
      ],
      [
        {"color": "green", "cap": 4},
        {"color": "green", "cap": 4},
        {"color": "blue", "cap": 12},
        {"color": "yellow", "cap": 6, "hidden": true},
        {"color": "green", "cap": 4}
      ]
    ]
  }
}/*PRESETS_END*/;
const RAMP_TILT = 35;                               // default ramp: a straight platform at this angle (degrees) outward and up

/* ====================== RULE / LAYOUT CONSTANTS ===================== */
const COLORS = ["red","orange","yellow","green","cyan","blue","purple","pink"];
const HEX = {red:"#E53935",orange:"#FB8C00",yellow:"#FDD835",green:"#43A047",
             cyan:"#00ACC1",blue:"#1E88E5",purple:"#8E24AA",pink:"#EC407A"};
const BUS_PLAN = {red:[12,8,4],orange:[6,6,8,4],yellow:[6,6,12],green:[12,12],
                  cyan:[8,8,8],blue:[8,8,4,4],purple:[8,6,6,4],pink:[12,6,6]};
const PER_COLOR = 24, RAMP_ROWS = [10,9,10,9,10], RAMP_COLS = 4, LANE_SIZES = [9,9,8];

const YARD_SPEED = 4.2, ACCEL = 3.6, SOFT_BRAKE = 3.0, HARD_BRAKE = 11;
const ROAD_GAP = 0.32, FOLLOW_GAP = 0.26, LANE_GAP = 0.3;
const CELL = 0.3, CELL_M = 0.1;   // yard traffic: swept-footprint grid (cell size, safety margin)
const RUN_TIME = 0.5;          // a boarding stickman's run + hop into the seat
const BOT_THINK = 0.4;         // bots look at the board this often (game seconds)
const SIM_DT = 1/30;           // headless simulation step

/* world layout (x right, z toward the camera / south, y up) */
const BUS_W = 0.98, ROW_PITCH = 0.34, ROAD_HALF = 0.74;
const busLen = cap => cap/2*ROW_PITCH + 0.52;
const Z_ENTRY = 0, Z_ROAD0 = -1.3;
const Z_BAY_TOP = 1.18, Z_BAY_BOT = 4.0, Z_COLL = 5.2, Z_LANE_TOP = 6.28;
/* Yard presets: the horizontal yard geometry (bays, queue lanes, side lanes, return tunnel) and the
   game camera that frames it, and how far the ramp platforms sit below the road deck (a full bus
   drives sideways off the road above the neighbouring crowds).  "compact" is the default.  "classic" is the original, wider layout; a
   level with "yard": "classic" plays exactly as before the compaction (the regression baseline). */
const YARDS = {
  compact: {name:'compact', BAY_X:[-2.72,-1.36,0,1.36,2.72], LANE_X:[-1.64,0,1.64], LANE_SP:1.64, X_SIDE:3.8, TUNNEL_X:4.85, RAMP_DROP:0.85},
  classic: {name:'classic', BAY_X:[-2.72,-1.36,0,1.36,2.72], LANE_X:[-1.72,0,1.72], LANE_SP:1.72, X_SIDE:4.32, TUNNEL_X:5.45, RAMP_DROP:0}
};
/* queue lanes: a level has 2-5 (laneCount, 3 when omitted), centred under the bays; five lanes sit a little closer
   (the outer buses keep clear of the side lanes and stay on screen) */
const LANE_MIN = 2, LANE_MAX = 5;
const laneXs = (n, Y) => { const sp = n >= 5 ? Math.min(Y.LANE_SP, 1.52) : Y.LANE_SP; return Array.from({length:n}, (_, i) => +((i - (n - 1)/2)*sp).toFixed(4)); };
Object.values(YARDS).forEach(Y => {
  Y.TUNNEL_R = {x:Y.TUNNEL_X, z:Z_COLL, nx:-0.8, nz:0.6, depth:1.6, side:1};    // return tunnel on the right, mouth to the bays
  Y.TUNNEL_L = {x:-Y.TUNNEL_X, z:Z_COLL, nx:0.8, nz:0.6, depth:1.6, side:-1};   // mirrored on the left
});
const YARD = YARDS.compact;
const {BAY_X, LANE_X, X_SIDE, TUNNEL_X, TUNNEL_R, TUNNEL_L} = YARD;   // defaults (compact yard)
const parkZ = len => Z_BAY_TOP + 0.08 + len/2;
const laneSlotZ = len => Z_LANE_TOP + 0.12 + len/2;

/* ========================= FIXED SCREEN LAYOUT ========================= */
/* Every level uses the same screen (900 x 1950 design space = 390 x 844 at 2.3x), split into zones
   (fractions of the height): top bar, TARGET zone (road, spiral, ramps, exit tunnel), STATIC row
   (bays), QUEUE (its lanes come out of a wide stone tunnel) and the BOOSTER bar at the very bottom.
   One camera for every level: the largest bundled level (Crowded Rush Curve) fills the target zone with
   stickmen about 17 px tall.  QUEUE_BOT is where the queue tunnel's arch begins: every lane shows at least
   three 8-seat buses fully above it. */
const SCREEN = {w:900, h:1950, BAR:0.07, TARGET_TOP:0.07, TARGET_BOT:0.61, STATIC_BOT:0.72, QUEUE_BOT:0.905, BOOST_TOP:0.93, MARGIN:12*900/390};
const SCREEN_CAM = {fov:30, pos:[0, 41.769, 28.354], look:[0, 0, -4.28], w:SCREEN.w, h:SCREEN.h};
/* Every bus is drawn 10% smaller than its simulated footprint (its seats, wheels and passengers with it); the
   simulation's sizes and distances are untouched. */
const BUS_DRAW = 0.9;
/* The yard and queue are DRAWN in a squeezed form of the simulation's layout (the simulation is untouched): a
   sim point (x, z) is shown at (x*dispSx(z), dispZ(z)) and a bus there at BUS_DRAW*dispScale(z).
   - The yard and the queue are 15% narrower (KX) and the bay row 15% shorter (KB) than simulated: the bay area is
     15% smaller and a 12-seat bus (drawn 10% smaller) still fits its bay.
   - The strips above the bays (entry, KE) and below them (collector, KC) and the margin to the queue are squeezed
     further, and the gaps between queued buses (QZ).
   - Every bus is drawn at the same size (dispScale 1) from the front of its queue lane, through the yard, onto the
     road and in the bays, so a sent bus never shrinks; only the buses waiting behind a lane's front bus are drawn at
     QS = 1/1.1 (the front bus is 10% larger). */
const DISP = {K:0.85, KX:0.85, KB:0.84, KE:0.25, KC:0.32, QS:1/1.1, QZ:0.76, MARGIN:0.06, T:0.25, zA:Z_ROAD0, zB:-0.7, zE:Z_BAY_TOP - 0.25, zF:Z_BAY_BOT + 0.25,
  zC:Z_COLL + 0.55, zL:Z_LANE_TOP + 0.12, qA:1.3, qB:1.85, pA:1.4, pB:1.9};
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
function baseSlope(z){                              // d(shown z)/d(sim z), perspective view
  const D = DISP;
  if (z <= D.zA) return 1;
  if (z <= D.zE - D.T) return 1 + (D.KE - 1)*smooth01(D.zA, D.zB, z);     // main road end -> entry strip
  if (z <= D.zE) return D.KE + (D.KB - D.KE)*smooth01(D.zE - D.T, D.zE, z);
  if (z <= D.zF) return D.KB;                                             // the bay row
  if (z <= D.zF + D.T) return D.KB + (D.KC - D.KB)*smooth01(D.zF, D.zF + D.T, z);
  if (z <= D.zC) return D.KC;                                             // collector strip
  if (z < D.zL) return D.MARGIN;
  return 1 + (D.QZ - 1)*smooth01(D.pA, D.pB, z - D.zL);                   // queue: tighter gaps behind the front
}
const DISP_STEP = 0.005, DISP_TAB = (() => { const t = [DISP.zA], n = Math.ceil((60 - DISP.zA)/DISP_STEP);
  for (let i = 0; i < n; i++) t.push(t[i] + baseSlope(DISP.zA + (i + 0.5)*DISP_STEP)*DISP_STEP); return t; })();
function baseZ(z){
  if (z <= DISP.zA) return z;
  const f = (z - DISP.zA)/DISP_STEP, i = Math.floor(f);
  if (i >= DISP_TAB.length - 1) return DISP_TAB[DISP_TAB.length - 1] + (z - DISP.zA - (DISP_TAB.length - 1)*DISP_STEP)*DISP.QZ;
  return DISP_TAB[i] + (DISP_TAB[i+1] - DISP_TAB[i])*(f - i);
}
function baseSx(z){ return 1 + (DISP.KX - 1)*smooth01(DISP.zA, DISP.zB, z); }   // the road keeps its width, the yard is narrower
function baseScale(z){
  const D = DISP;
  if (z < D.zL) return 1;
  return 1 + (D.QS - 1)*smooth01(D.qA, D.qB, z - D.zL);
}

/* ======================= THE ORTHOGRAPHIC VIEW =======================
   A game setting (camera: Perspective, the default, or Orthographic).  It is purely visual.  The orthographic camera
   looks in the same direction as SCREEN_CAM; its size and centre put the target zone's ground (y = 0) on the same
   screen rows (TARGET_TOP to TARGET_BOT), so the road, the spirals and the ramps of every level fit the target zone in
   both views (the zone's perspective trapezoid lies inside the orthographic rectangle).
   Below the target zone (the yard, the bays, the queue) the orthographic view draws the yard so it covers the same
   screen rows as in perspective: every drawn ground row is moved to the row it has in perspective (orthoRowZ) and
   the yard is widened, with its buses, by ORTHO_M (the perspective view's magnification there), blending in over the
   entry strip (DISP.zA to DISP.zE).  Bays, buses and lanes so stay as wide on screen as in perspective. */
const ORTHO_CAM = (() => {
  const P = SCREEN_CAM.pos, Lk = SCREEN_CAM.look, f = norm3([Lk[0]-P[0], Lk[1]-P[1], Lk[2]-P[2]]);
  const r = norm3([-f[2], 0, f[0]]), u = [r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  const rowZ = v => { let lo = -80, hi = 40; for (let i = 0; i < 80; i++){ const m = (lo + hi)/2; if (project(0, 0, m, SCREEN_CAM)[1] < v) lo = m; else hi = m; } return (lo + hi)/2; };
  const vT = SCREEN.TARGET_TOP*SCREEN.h, vB = SCREEN.TARGET_BOT*SCREEN.h, zT = rowZ(vT), zB = rowZ(vB);
  const k = (vB - vT)/((zT - zB)*u[2]);                       // screen pixels per world unit
  const zc = zT - (SCREEN.h/2 - vT)/(u[2]*k), D = Math.hypot(P[0]-Lk[0], P[1]-Lk[1], P[2]-Lk[2]);
  const look = [0, 0, zc], pos = [look[0] - f[0]*D, look[1] - f[1]*D, look[2] - f[2]*D];
  return {ortho:true, pos, look, k, halfW:SCREEN.w/2/k, halfH:SCREEN.h/2/k, w:SCREEN.w, h:SCREEN.h, f, r, u, fov:SCREEN_CAM.fov,
          pitch:Math.asin(-f[1])*180/Math.PI, zTop:zT, zBot:zB};
})();
let VIEW = 'persp';
function setView(m){ VIEW = m === 'ortho' ? 'ortho' : 'persp'; return VIEW; }
function viewCam(){ return VIEW === 'ortho' ? ORTHO_CAM : SCREEN_CAM; }
/* the ground z that the orthographic view shows on the same screen row as ground z0 in perspective */
function orthoRowZ(z0){ const v = project(0, 0, z0, SCREEN_CAM)[1], O = ORTHO_CAM; return O.look[2] + (O.h/2 - v)/(O.k*O.u[2]); }
const ORTHO_M = (() => { const z = baseZ(Z_BAY_TOP + 1.4); return (project(1, 0, z, SCREEN_CAM)[0] - project(0, 0, z, SCREEN_CAM)[0])/ORTHO_CAM.k; })();
const orthoBlend = z => VIEW === 'ortho' ? smooth01(DISP.zA, DISP.zE, z) : 0;
const orthoGrow = z => 1 + orthoBlend(z)*(ORTHO_M - 1);

/* the display mapping as used by the game: the perspective one above, or its orthographic form */
function dispZ(z){ const z0 = baseZ(z), b = orthoBlend(z); return b ? z0 + b*(orthoRowZ(z0) - z0) : z0; }
function dispSlope(z){ return VIEW === 'ortho' && z > DISP.zA ? (dispZ(z + 1e-3) - dispZ(z - 1e-3))/2e-3 : baseSlope(z); }
function dispSx(z){ return baseSx(z)*orthoGrow(z); }
function dispScale(z){ return baseScale(z)*orthoGrow(z); }   // relative size a bus is drawn at (times BUS_DRAW)
function dispPoint(x, z){ return [x*dispSx(z), dispZ(z)]; }
/* a bay as drawn: the outline of a parked 12-seat bus (drawn BUS_DRAW of its size) with a small even margin */
function drawnBay(bx){ const L12 = busLen(12), z0 = parkZ(L12), [x, z] = dispPoint(bx, z0), g = orthoGrow(z0); return {x, z, hl:BUS_DRAW*L12/2*g + 0.06, hw:BUS_DRAW*BUS_W/2*g + 0.07}; }
function dispDir(dx, dz, z){ const a = dx*dispSx(z), b = dz*dispSlope(z), l = Math.hypot(a, b) || 1; return [a/l, b/l]; }

const RAMP_SP = 0.36;                               // stickman spacing along and across a ramp
const RAMP_APRON_MAX = RAMP_SP;                     // the deepest apron between the road edge and a ramp's first row: one row
const MAN_W = 0.31;                                 // a stickman's width (its head; two never come closer)
/* a level's stickman size (`manScale`, 1 when omitted): its ramps' grid spacing, margins and apron grow with it, so
   larger stickmen never overlap; seated in a bus they stay at most SEAT_SCALE_MAX (two seat rows are ROW_PITCH apart) */
const MAN_SCALE_MAX = 1.3, SEAT_SCALE_MAX = 1.08;
/* road gaps: a bus speeds up (GAP_BOOST) over the last GAP_RUNUP before a gap and across it, and jumps it (drawn); it takes
   off only when the bus ahead has cleared the landing side by its own length, so it never has to stop in the air */
const GAP_LEN = [0.6, 2.4], GAP_EASE = 0.9, GAP_BOOST = 1.35, GAP_RUNUP = 1.6;

/* ============================= HELPERS ============================== */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function shuffle(a, rng){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const clamp = (v,a,b) => v<a?a:v>b?b:v;

/* centripetal Catmull-Rom, the same formulation as THREE.CatmullRomCurve3('centripetal') */
function catmullRom(cps, perSeg){
  const n = cps.length, pts = [], cpIdx = [];
  const at = i => i < 0 ? cps[0].map((v,k)=>2*v-cps[1][k]) : i >= n ? cps[n-1].map((v,k)=>2*v-cps[n-2][k]) : cps[i];
  const d = (a,b) => Math.pow((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2, 0.25);
  for (let i=0;i<n-1;i++){
    const p0=at(i-1), p1=at(i), p2=at(i+1), p3=at(i+2);
    let dt0=d(p0,p1), dt1=d(p1,p2), dt2=d(p2,p3);
    if (dt1<1e-4) dt1=1; if (dt0<1e-4) dt0=dt1; if (dt2<1e-4) dt2=dt1;
    const co = [0,1,2].map(k => {
      let t1=(p1[k]-p0[k])/dt0-(p2[k]-p0[k])/(dt0+dt1)+(p2[k]-p1[k])/dt1;
      let t2=(p2[k]-p1[k])/dt1-(p3[k]-p1[k])/(dt1+dt2)+(p3[k]-p2[k])/dt2;
      t1*=dt1; t2*=dt1;
      return [p1[k], t1, -3*p1[k]+3*p2[k]-2*t1-t2, 2*p1[k]-2*p2[k]+t1+t2];
    });
    cpIdx.push(pts.length);
    for (let j=0;j<perSeg;j++){ const t=j/perSeg; pts.push(co.map(c=>c[0]+c[1]*t+c[2]*t*t+c[3]*t*t*t)); }
  }
  cpIdx.push(pts.length); pts.push(cps[n-1].slice());
  return {pts, cpIdx};
}
/* polyline with arc length; lookups return position, unit horizontal heading and slope */
function makePath(pts){
  const n = pts.length, P = new Float64Array(n*3), cum = new Float64Array(n);
  for (let i=0;i<n;i++){ P[i*3]=pts[i][0]; P[i*3+1]=pts[i][1]; P[i*3+2]=pts[i][2];
    if (i) cum[i] = cum[i-1] + Math.hypot(P[i*3]-P[i*3-3], P[i*3+1]-P[i*3-2], P[i*3+2]-P[i*3-1]); }
  return {P, cum, n, len: cum[n-1]};
}
function pathAt(path, s, o, hint){
  const {P, cum, n} = path; s = clamp(s, 0, path.len);
  let i = clamp(hint|0, 0, n-2);
  while (i < n-2 && cum[i+1] < s) i++;
  while (i > 0 && cum[i] > s) i--;
  const L = cum[i+1]-cum[i], f = L > 0 ? (s-cum[i])/L : 0, a = i*3, b = a+3;
  o.x = P[a]+(P[b]-P[a])*f; o.y = P[a+1]+(P[b+1]-P[a+1])*f; o.z = P[a+2]+(P[b+2]-P[a+2])*f;
  const hx = P[b]-P[a], hz = P[b+2]-P[a+2], h = Math.hypot(hx,hz) || 1;
  o.dx = hx/h; o.dz = hz/h; o.slope = (P[b+1]-P[a+1])/h;
  return i;
}
/* yard routes: corner points [x,z] joined with rounded (quadratic) corners */
function filletPath(raw, r){
  const P = [];
  for (const p of raw) if (!P.length || Math.hypot(p[0]-P[P.length-1][0], p[1]-P[P.length-1][1]) > 1e-6) P.push(p);
  for (let i=1;i<P.length-1;i++){       // drop collinear corners
    const a=P[i-1], b=P[i], c=P[i+1];
    if (Math.abs((b[0]-a[0])*(c[1]-b[1]) - (b[1]-a[1])*(c[0]-b[0])) < 1e-9 &&
        (b[0]-a[0])*(c[0]-b[0]) + (b[1]-a[1])*(c[1]-b[1]) > 0){ P.splice(i,1); i--; }
  }
  const out = [[P[0][0],0,P[0][1]]];
  for (let i=1;i<P.length-1;i++){
    const a=P[i-1], b=P[i], c=P[i+1], l1=Math.hypot(a[0]-b[0],a[1]-b[1]), l2=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const t = Math.min(r, l1*0.5, l2*0.5);
    const t1=[b[0]+(a[0]-b[0])/l1*t, b[1]+(a[1]-b[1])/l1*t], t2=[b[0]+(c[0]-b[0])/l2*t, b[1]+(c[1]-b[1])/l2*t];
    for (let k=0;k<=10;k++){ const u=k/10, w0=(1-u)*(1-u), w1=2*u*(1-u), w2=u*u;
      out.push([w0*t1[0]+w1*b[0]+w2*t2[0], 0, w0*t1[1]+w1*b[1]+w2*t2[1]]); }
  }
  out.push([P[P.length-1][0],0,P[P.length-1][1]]);
  return makePath(out);
}

/* ============================ LEVEL FORMAT ============================ */
const DEFAULT_RAMP_PLACE = LEVEL_DATA.ramps.map(r => Object.assign(r.at != null ? {at:r.at} : {cp:r.cp}, {side:r.side}, r.shape ? {shape:r.shape} : {}));
const clone = o => JSON.parse(JSON.stringify(o));
/* "red" | "?red" (hidden) | null (empty)  ->  {color, hidden} | null */
function parseCell(c){
  if (!c) return null;
  if (typeof c === 'object') return c.color ? {color:c.color, hidden:!!c.hidden} : null;
  const hidden = c[0] === '?', color = hidden ? c.slice(1) : c;
  return COLORS.includes(color) ? {color, hidden} : null;
}
const cellStr = c => c ? (c.hidden ? '?' : '') + c.color : null;
const normCache = new WeakMap();
/* any accepted level (format 1 = stickmen + buses only, format 2 = full layout) -> canonical format 2 */
function normalizeLevel(lv){
  if (!lv || typeof lv !== 'object') throw new Error('level must be an object');
  if (normCache.has(lv)) return normCache.get(lv);
  if (!Array.isArray(lv.ramps) || !Array.isArray(lv.lanes)) throw new Error('level needs "ramps" and "lanes"');
  const road = lv.road && Array.isArray(lv.road.points) && lv.road.points.length >= 3 ? clone(lv.road) : clone(LEVEL_DATA.road);
  road.points.forEach(p => { p.x = +p.x; p.z = +p.z; });
  // gaps: the road cut at arc length `at` for `len` (GAP_LEN), flat or with a take-off ramp and a landing ramp
  const gaps = (Array.isArray(road.gaps) ? road.gaps : []).filter(q => q && isFinite(+q.at)).map(q => ({at:+q.at, len:clamp(+q.len || 1.2, GAP_LEN[0], GAP_LEN[1]), ramp:q.ramp === 'updown' ? 'updown' : 'flat'}))
    .sort((a, b) => a.at - b.at);
  if (gaps.length) road.gaps = gaps; else delete road.gaps;
  const out = {format:2, name: lv.name || 'Untitled level', seed: lv.seed, road, ramps:[], lanes:[]};
  if (lv.id != null && String(lv.id).trim()) out.id = String(lv.id).trim();
  if (lv.yard === 'classic') out.yard = 'classic';     // omitted = the default compact yard
  if (lv.meta && typeof lv.meta === 'object' && !Array.isArray(lv.meta)) out.meta = clone(lv.meta);   // design notes: role, tutorial, popup, hint
  lv.ramps.forEach((r, k) => {
    const cols = (r.columns || []).map(col => (col || []).map(c => cellStr(parseCell(c))));
    if (!cols.length) return;
    const rows = Math.max(1, r.rows || 0, ...cols.map(c => c.length));
    cols.forEach(c => { while (c.length < rows) c.push(null); });
    const loose = r.at == null && r.cp == null && Array.isArray(r.front) && r.front.length === 2;   // front node not snapped to the road
    const place = (r.at != null || r.cp != null || loose) ? {} : (DEFAULT_RAMP_PLACE[k] || {at: null});
    const nr = {side: r.side || place.side || (k % 2 ? -1 : 1), rows, columns: cols};
    if (loose) nr.front = [+r.front[0], +r.front[1]];
    else if (r.at != null) nr.at = +r.at; else if (r.cp != null) nr.cp = r.cp | 0; else if (place.cp != null) nr.cp = place.cp; else if (place.at != null) nr.at = place.at; else nr.at = null;
    if (r.tilt != null && isFinite(+r.tilt)) nr.tilt = +r.tilt;
    // (an old `spread` - columns fanning out or drawing together - is dropped: every ramp is a regular rectangle)
    if (r.push != null && isFinite(+r.push) && +r.push > 0) nr.push = +r.push;      // front node this much further from the road
    const shp = Array.isArray(r.shape) && r.shape.length ? r.shape : place.shape;
    if (shp) nr.shape = shp.map(p => [+p[0], +p[1]]);
    const int = v => Math.round(+v || 0);
    const rect = o => ({col:int(o.col), row:int(o.row), w:Math.max(1, int(o.w || 1)), h:Math.max(1, int(o.h || 1))});
    const tun = (r.tunnels || []).filter(t => t && COLORS.includes(t.color)).map(t => Object.assign(rect(t), {color:t.color, count:Math.max(0, int(t.count))}));
    const box = (r.boxes || []).filter(b => b && (b.lock != null || b.count != null)).map(b => Object.assign(rect(b), b.lock != null ? {lock:String(b.lock)} : {count:int(b.count)}));
    if (tun.length) nr.tunnels = tun;
    if (box.length) nr.boxes = box;
    out.ramps.push(nr);
  });
  const nl = clamp(Math.round(+lv.laneCount) || lv.lanes.length || 3, LANE_MIN, LANE_MAX);
  out.laneCount = nl;
  if (lv.manScale != null && isFinite(+lv.manScale) && Math.abs(+lv.manScale - 1) > 1e-9) out.manScale = clamp(Math.round(+lv.manScale*100)/100, 1, MAN_SCALE_MAX);
  for (let l=0;l<nl;l++) out.lanes.push(((lv.lanes[l]) || []).filter(b => b && COLORS.includes(b.color) && [4,6,8,12].includes(+b.cap))
    .map(b => { const o = {color:b.color, cap:+b.cap}; if (b.hidden) o.hidden = true; if (b.link != null && b.link !== '') o.link = String(b.link);
      if (b.key != null && b.key !== '') o.key = String(b.key); return o; }));
  normCache.set(lv, out); normCache.set(out, out);
  return out;
}

/* ============================ LAYOUT BUILDER ============================
   Everything positional is derived from the level: the road spline (with spirals), the
   exit tunnel at its end, the return tunnel on the nearer side, pillars and the ramps. */
const SPIRAL_ANG = [180,225,270,315,0,45,90];
function roadHeights(pts){
  const ys = pts.map(p => (typeof p.y === 'number' ? p.y : null)), n = pts.length;
  if (ys[0] === null) ys[0] = 0;
  if (ys[n-1] === null) ys[n-1] = Math.max(3.8, ...ys.filter(v => v !== null));
  const d = [0]; for (let i=1;i<n;i++) d.push(d[i-1] + Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z));
  for (let i=1;i<n-1;i++) if (ys[i] === null){
    let a = i-1; while (ys[a] === null) a--; let b = i+1; while (ys[b] === null) b++;
    ys[i] = ys[a] + (ys[b]-ys[a]) * (d[i]-d[a]) / Math.max(1e-6, d[b]-d[a]);
  }
  // after a spiral the road must stay above the overpass
  let floor = -Infinity;
  for (let i=0;i<n;i++){ if (typeof pts[i].y !== 'number') ys[i] = Math.max(ys[i], floor);
    if (pts[i].spiral) floor = Math.max(floor, ys[i] + 1.45); }
  return ys;
}
function spiralDir(pts, i){
  const sp = pts[i].spiral; if (sp && Array.isArray(sp.dir)) return sp.dir;
  const q = pts[i-1], p = pts[i], l = Math.hypot(p.x-q.x, p.z-q.z) || 1; return [(p.x-q.x)/l, (p.z-q.z)/l];
}
function buildRoad(road){
  const pts = road.points, ys = roadHeights(pts), cps = [], map = [], spirals = [];
  pts.forEach((p, i) => {
    map.push(cps.length); cps.push([p.x, ys[i], p.z]);
    if (p.spiral && i > 0 && i < pts.length - 1){
      const sp = p.spiral, R = sp.r || 1.4, side = sp.side || 1, d = spiralDir(pts, i), r = [-d[1], d[0]];
      const cx = p.x + d[0]*R + r[0]*R*side, cz = p.z + d[1]*R + r[1]*R*side;
      const y0 = sp.y0 != null ? sp.y0 : ys[i] + 0.17, dy = sp.dy != null ? sp.dy : 0.18;
      SPIRAL_ANG.forEach((a, k) => { const t = a*Math.PI/180;
        cps.push([cx + r[0]*R*side*Math.cos(t) + d[0]*R*Math.sin(t), y0 + k*dy, cz + r[1]*R*side*Math.cos(t) + d[1]*R*Math.sin(t)]); });
      cps.push([p.x, sp.yCross != null ? sp.yCross : ys[i] + 1.35, p.z]);
      spirals.push({point:i, cpFrom:map[i], cpTo:cps.length-1, cx, cz, R});
    }
  });
  const last = cps[cps.length-1];
  if (Array.isArray(road.tail)) cps.push(road.tail.slice());
  else { const q = cps[cps.length-2], l = Math.hypot(last[0]-q[0], last[2]-q[2]) || 1;
    cps.push([last[0] + (last[0]-q[0])/l*2.1, last[1], last[2] + (last[2]-q[2])/l*2.1]); }
  const {pts: dense, cpIdx} = catmullRom(cps, 28); let path = makePath(dense);
  // a gap's two ends stand at the same height: across it the road is level, easing in and out over GAP_EASE
  const gaps = (road.gaps || []).map(q => ({at:q.at, len:q.len, ramp:q.ramp, s0:q.at - q.len/2, s1:q.at + q.len/2}));
  if (gaps.length){ const yAt = sv => { const o = {}; pathAt(path, sv, o, 0); return o.y; };
    const Y = gaps.map(G => { const y0 = yAt(G.s0 - GAP_EASE), y1 = yAt(G.s1 + GAP_EASE); return {G, y0, y1, yc:(y0 + y1)/2}; });
    dense.forEach((q, i) => { const sv = path.cum[i];
      for (const {G, y0, y1, yc} of Y){
        if (sv >= G.s0 && sv <= G.s1) q[1] = yc;
        else if (sv > G.s0 - GAP_EASE && sv < G.s0) q[1] = y0 + (yc - y0)*smooth01(G.s0 - GAP_EASE, G.s0, sv);
        else if (sv > G.s1 && sv < G.s1 + GAP_EASE) q[1] = yc + (y1 - yc)*smooth01(G.s1, G.s1 + GAP_EASE, sv); } });
    path = makePath(dense); }
  path.gaps = gaps;
  path.cpS = cpIdx.map(i => path.cum[i]);
  path.pointS = map.map(m => path.cpS[m]);          // arc length at each editable control point
  path.portalS = path.pointS[pts.length - 1];
  path.end = path.len - 0.6;                        // centre this far in = fully inside the tunnel
  path.spirals = spirals.map(sp => Object.assign(sp, {s0: path.cpS[sp.cpFrom], s1: path.cpS[sp.cpTo]}));
  path.cps = cps;
  return path;
}
/* the road's edge on one side of the road around s, as a curve measured by its own arc length: E(u) is the edge
   point u along it (u > 0 toward side x direction of travel, so a ramp's columns run the same way as before) */
const lerpN = (a, b, t) => a + (b - a)*t;
function roadEdge(ROAD, s, side, reach){
  const o = {}, step = 0.04, n = Math.ceil(reach*1.8/step) + 2, pts = [], at = t => {
    if (t < 0){ pathAt(ROAD, 0, o, 0); return [o.x + o.dx*t - o.dz*side*ROAD_HALF, o.z + o.dz*t + o.dx*side*ROAD_HALF]; }
    if (t > ROAD.len){ pathAt(ROAD, ROAD.len, o, 0); const e = t - ROAD.len; return [o.x + o.dx*e - o.dz*side*ROAD_HALF, o.z + o.dz*e + o.dx*side*ROAD_HALF]; }
    pathAt(ROAD, t, o, 0); return [o.x - o.dz*side*ROAD_HALF, o.z + o.dx*side*ROAD_HALF]; };
  const fwd = [[0, at(s), s]], back = [];
  for (let k = 1; k <= n; k++){ const q = at(s + k*step), w = fwd[fwd.length - 1]; fwd.push([w[0] + Math.hypot(q[0] - w[1][0], q[1] - w[1][1]), q, s + k*step]); }
  for (let k = 1; k <= n; k++){ const q = at(s - k*step), w = back.length ? back[back.length - 1] : fwd[0]; back.push([w[0] - Math.hypot(q[0] - w[1][0], q[1] - w[1][1]), q, s - k*step]); }
  const list = back.reverse().concat(fwd);                      // ascending signed arc length along the direction of travel
  const find = a => { let lo = 0, hi = list.length - 1;
    if (a <= list[0][0]) return [0, 0, 0]; if (a >= list[hi][0]) return [hi, hi, 0];
    while (hi - lo > 1){ const m = (lo + hi) >> 1; if (list[m][0] <= a) lo = m; else hi = m; }
    return [lo, hi, (a - list[lo][0])/((list[hi][0] - list[lo][0]) || 1)]; };
  const E = u => { const [lo, hi, f] = find(u*side); return [lerpN(list[lo][1][0], list[hi][1][0], f), lerpN(list[lo][1][1], list[hi][1][1], f)]; };
  E.sAt = u => { const [lo, hi, f] = find(u*side); return lerpN(list[lo][2], list[hi][2], f); };   // the road's arc length beside edge point u
  return E;
}
/* A ramp: a straight rectangular platform beside the road holding a regular grid of stickmen - columns x rows, evenly
   spaced RAMP_SP apart, never bent, squeezed or fanned, however the road bends.  It points in one direction from the
   middle of its front edge (its boarding point, on the road's edge): `tilt` (a fixed screen angle), else the way its
   `shape` path leaves the road (only that first direction counts: an old bent or fanned ramp is straightened along
   it), else straight out, square to the road.  Only the platform's outline adapts to the road: its front edge lies
   exactly on the road's edge, following its curve, and a small apron fills the gap between that curved edge and the
   straight first row, which sits as close to the road as the apron allows.  The back and side edges are straight with
   square corners.  A ramp whose front node is off the road (an old level's "front") snaps to the nearest road point. */
function buildRamp(ROAD, rd, src, Y, K){
  K = K || 1; const SP = RAMP_SP*K;                 // the level's stickman size: the grid's spacing and margins grow with it
  let s = rd.at != null ? rd.at : rd.cp != null ? ROAD.pointS[clamp(rd.cp, 0, ROAD.pointS.length-1)] : ROAD.portalS*(0.2 + 0.15*src);
  let side = rd.side || 1;
  if (rd.front){
    let best = 1e9, bi = 0; for (let i = 0; i < ROAD.n; i++){ if (ROAD.cum[i] > ROAD.portalS) break;
      const d = Math.hypot(ROAD.P[i*3] - rd.front[0], ROAD.P[i*3+2] - rd.front[1]); if (d < best){ best = d; bi = i; } }
    s = ROAD.cum[bi]; const q = {}; pathAt(ROAD, s, q, 0);
    side = ((rd.front[0] - q.x)*(-q.dz) + (rd.front[1] - q.z)*q.dx) >= 0 ? 1 : -1;
  }
  s = clamp(s, 0.6, ROAD.portalS - 0.6);
  const rows = rd.rows, cols = rd.columns.length, length = 0.34*K + (rows-1)*SP + 0.42*K;
  const halfW = cols*SP/2 + 0.16*K;
  // the whole front edge lies along the road, from just after its start to just before the exit tunnel: a ramp too
  // close to either end slides along the road until it fits
  let E = roadEdge(ROAD, s, side, halfW + 0.3);
  for (let it = 0; it < 4; it++){
    const a = E.sAt(-halfW), b = E.sAt(halfW), lo = Math.min(a, b), hi = Math.max(a, b);
    const ds = lo < 0.15 ? 0.15 - lo : hi > ROAD.portalS - 0.3 ? ROAD.portalS - 0.3 - hi : 0;
    if (Math.abs(ds) < 1e-4) break;
    s = clamp(s + ds, 0.6, ROAD.portalS - 0.6); E = roadEdge(ROAD, s, side, halfW + 0.3);
  }
  const A = E(0), p = {}; pathAt(ROAD, s, p, 0);
  const nx = -p.dz*side, nz = p.dx*side;           // outward horizontal normal
  const y = p.y - ((Y || YARD).RAMP_DROP || 0);
  // its direction n0: a tilted ramp points at a fixed screen angle, outward (to its side of the screen) and up by `tilt`
  // degrees; a shaped one the way its path leaves the road; otherwise square to the road
  let n0 = [nx, nz];
  if (rd.tilt != null){ const t = rd.tilt*Math.PI/180; n0 = [(nx >= 0 ? 1 : -1)*Math.cos(t), -Math.sin(t)]; }
  else if (rd.shape && rd.shape.length){ const o = {}, c = [[A[0], y, A[1]]].concat(rd.shape.map(q => [q[0], y, q[1]]));
    pathAt(makePath(catmullRom(c, 24).pts), 0, o, 0); const l = Math.hypot(o.dx, o.dz); if (l > 1e-9) n0 = [o.dx/l, o.dz/l]; }
  // across the ramp: u along t0, square to n0 and the same way round as the road edge (so the columns run as before)
  const t0 = (() => { const a = E(0.05), b = E(-0.05), d = [a[0] - b[0], a[1] - b[1]], k = d[0]*n0[0] + d[1]*n0[1], v = [d[0] - n0[0]*k, d[1] - n0[1]*k], l = Math.hypot(v[0], v[1]) || 1; return [v[0]/l, v[1]/l]; })();
  // the road edge in the ramp's frame, [u, depth] by ascending u: walked out from the middle of the front edge each
  // way only while it keeps moving across the ramp (never on to another stretch of the road)
  const FR = [[0, 0]];
  { const at = t => { const e = E(t), dx = e[0] - A[0], dz = e[1] - A[1]; return [dx*t0[0] + dz*t0[1], dx*n0[0] + dz*n0[1]]; }, reach = halfW + 0.6;
    for (const sg of [1, -1]) for (let t = 0.02, last = 0; t < reach*2; t += 0.02){ const q = at(sg*t); if (q[0]*sg <= last + 1e-6) break; last = q[0]*sg;
      if (sg > 0) FR.push(q); else FR.unshift(q); if (last > reach) break; } }
  // the road edge must run across the whole front (a ramp turned too far against a bend would hang off it)
  const frontShort = FR[0][0] > -halfW + 1e-6 || FR[FR.length - 1][0] < halfW - 1e-6;
  const fr = u => { let lo = 0, hi = FR.length - 1;
    if (u <= FR[0][0]) return FR[0][1]; if (u >= FR[hi][0]) return FR[hi][1];
    while (hi - lo > 1){ const m = (lo + hi) >> 1; if (FR[m][0] <= u) lo = m; else hi = m; }
    const f = (u - FR[lo][0])/((FR[hi][0] - FR[lo][0]) || 1); return FR[lo][1] + (FR[hi][1] - FR[lo][1])*f; };
  // the rectangle starts where the road edge reaches farthest out across the ramp's width; in front of it the apron
  // reaches down to the road edge, `apron` deep at most
  let vF = Math.max(fr(-halfW), fr(halfW)), vMin = Math.min(fr(-halfW), fr(halfW));      // (fr is piecewise linear: its corners and ends)
  for (const q of FR) if (q[0] > -halfW && q[0] < halfW){ vF = Math.max(vF, q[1]); vMin = Math.min(vMin, q[1]); }
  const apron = vF - vMin, O = [A[0] + n0[0]*vF, A[1] + n0[1]*vF];
  const across = (sv, u) => ({x:O[0] + t0[0]*u + n0[0]*sv, z:O[1] + t0[1]*u + n0[1]*sv});   // sv: depth behind the rectangle's front line
  const frontAt = u => fr(u) - vF;                  // the front edge's depth there (<= 0: the apron in front of the rectangle)
  const slots = [];
  for (let col=0; col<cols; col++){
    const colSlots = [];
    for (let r=0; r<rows; r++){ const q = across(0.34*K + r*SP, (col - (cols-1)/2)*SP); colSlots.push({x:q.x, y, z:q.z, fx:-n0[0], fz:-n0[1]}); }
    slots.push(colSlots);
  }
  // the outline: the front edge along the road edge, then the straight right side, back and left side
  const front = [], right = [], back = [], left = [], NU = Math.max(4, Math.ceil(halfW*2/0.12)), NS = Math.max(4, Math.ceil(length/0.15));
  for (let k = 0; k <= NU; k++){ const u = -halfW + 2*halfW*k/NU, q = across(frontAt(u), u); front.push([q.x, q.z]); }
  { const s0 = frontAt(halfW); for (let k = 1; k <= NS; k++){ const q = across(s0 + (length - s0)*k/NS, halfW); right.push([q.x, q.z]); } }
  for (let k = 1; k < NU; k++){ const u = halfW - 2*halfW*k/NU, q = across(length, u); back.push([q.x, q.z]); }
  { const s0 = frontAt(-halfW); for (let k = NS; k >= 1; k--){ const q = across(s0 + (length - s0)*k/NS, -halfW); left.push([q.x, q.z]); } }
  const outline = front.concat(right, back, left);
  const backEdge = [right[right.length - 1]].concat(back, [left[0]]);      // corner to corner (a straight line)
  const tip = across(length, 0), spline = makePath([[O[0], y, O[1]], [tip.x + n0[0]*0.6, y, tip.z + n0[1]*0.6]]);   // its middle line, from the rectangle's front
  // columns nearest the boarding point first: from the middle of the front row out; of two as near as each other the
  // one the bus passes first
  const mid = (cols - 1)/2, colOrder = slots.map((_, i) => i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || (a - b)*side);
  return {src, s, side, x:p.x, y, z:p.z, spline, ctrl:[[A[0], A[1]], [tip.x, tip.z]], dir:n0, length,
          rows, cols, halfW, sp:SP, manK:K, slots, colOrder, snapped:true, front, outline, backEdge, frontShort, apron, across, frontAt, edge:E};
}
function pillarSpots(ROAD){
  const o = {}, out = [], P = ROAD.P;
  for (let s = 1.6; s < ROAD.portalS - 0.8; s += 2.25){
    pathAt(ROAD, s, o, 0);
    let blocked = false;                            // never through a lower part of the road (spiral overpass)
    for (let i=0;i<ROAD.n;i+=2) if (Math.abs(ROAD.cum[i] - s) > 3 && P[i*3+1] < o.y - 0.4 && Math.hypot(P[i*3]-o.x, P[i*3+2]-o.z) < 1.05){ blocked = true; break; }
    if ((ROAD.gaps || []).some(q => s > q.s0 - 0.4 && s < q.s1 + 0.4)) blocked = true;   // nothing under a gap
    if (!blocked) out.push({s, x:o.x, y:o.y, z:o.z});
  }
  return out;
}
/* the camera: the yard preset's camera if the whole level fits under it (top bar excluded); otherwise the
   same view direction pulled back just enough, with the queue's front buses kept at the bottom edge */
const layoutCache = new WeakMap();
function buildLayout(level){
  const N = normalizeLevel(level);
  if (layoutCache.has(N)) return layoutCache.get(N);
  const ROAD = buildRoad(N.road), base = YARDS[N.yard] || YARD;
  const Y = N.laneCount === 3 ? base : Object.assign({}, base, {LANE_X:laneXs(N.laneCount, base)});   // the level's queue lanes
  const K = N.manScale || 1, RAMPS = N.ramps.map((r, i) => buildRamp(ROAD, r, i, Y, K)).sort((a, b) => (a.s === b.s ? 0 : a.s - b.s) || a.src - b.src);
  RAMPS.forEach((r, k) => r.k = k);
  const ex = {}; pathAt(ROAD, ROAD.portalS, ex, 0);
  const dR = Math.hypot(ex.x - Y.TUNNEL_R.x, ex.z - Y.TUNNEL_R.z), dL = Math.hypot(ex.x - Y.TUNNEL_L.x, ex.z - Y.TUNNEL_L.z);
  const L = {ROAD, RAMPS, Y, TUNNEL: dL < dR - 1e-9 ? Y.TUNNEL_L : Y.TUNNEL_R, exit:{x:ex.x, y:ex.y, z:ex.z, dx:ex.dx, dz:ex.dz},
             pillars: pillarSpots(ROAD), level:N, manScale:K};
  L.CAM = SCREEN_CAM;                               // one camera for every level
  layoutCache.set(N, L); layoutCache.set(level, L);
  return L;
}

function routeToRoad(x, z, side, Y){              // from a lane, via the nearer side lane
  const sx = side*(Y || YARD).X_SIDE;
  return filletPath([[x,z],[x,Z_COLL],[sx,Z_COLL],[sx,Z_ENTRY],[0,Z_ENTRY],[0,Z_ROAD0]], 0.6);
}
function routeBayToRoad(x, z){ return filletPath([[x,z],[x,Z_ENTRY],[0,Z_ENTRY],[0,Z_ROAD0]], 0.6); }
function routeLaneToBay(x, z, k, len, Y){ const bx = (Y || YARD).BAY_X[k];
  return filletPath([[x,z],[x,Z_COLL],[bx,Z_COLL],[bx,parkZ(len)]], 0.6); }
function routeReturn(k, len, T, Y){ Y = Y || YARD; T = T || Y.TUNNEL_R; const bx = Y.BAY_X[k];
  return filletPath([[T.x - T.nx*T.depth, T.z - T.nz*T.depth],[T.x, T.z],[bx,Z_COLL],[bx,parkZ(len)]], 0.8); }
function seatLocal(i, len){                        // seat i (front row first) in bus space, +z forward
  const row = Math.floor(i/2);
  return {x: (i%2 ? 0.21 : -0.21), y: 0.52, z: len/2 - 0.31 - row*ROW_PITCH};
}

/* ============================ GAME STATE ============================ */
/* A ramp in play: each column is a queue of stickmen that can board (front first, `cols`), and at most
   one blocker further back in that column (`obst`): a colourful TUNNEL that feeds its own stickmen into
   the empty cells in front of it, or a closed BOX (lock or count) holding the stickmen under it.  The
   stickmen behind a blocker (`rest`) wait until it is gone.  The same structure is cloned for the
   cheering prediction, and takeFront / openBox below run on either. */
function buildRampState(g, N, R, k){
  const src = N.ramps[R.src], rows = src.rows, ncol = src.columns.length;
  const ramp = {k, cols:[], rest:[], obst:new Array(ncol).fill(null), tunnels:[], boxes:[], empty:false};
  const covered = (list, c, r) => list.findIndex(o => c >= o.col && c < o.col + o.w && r >= o.row && r < o.row + o.h);
  const okRect = (o, minRow) => o.col >= 0 && o.w >= 1 && o.col + o.w <= ncol && o.row >= minRow && o.h >= 1 && o.row + o.h <= rows;
  const blockers = [];
  (src.tunnels || []).forEach((t, i) => { if (okRect(t, 1)) blockers.push({t:'tunnel', i, o:t}); });
  (src.boxes || []).forEach((b, i) => { if (okRect(b, 0)) blockers.push({t:'box', i, o:b}); });
  // one blocker per column (the checker reports any other): the nearest to the road wins
  blockers.sort((a, b) => a.o.row - b.o.row);
  const used = new Set(), keep = [];
  blockers.forEach(B => { let free = true; for (let c = B.o.col; c < B.o.col + B.o.w; c++) if (used.has(c)) free = false;
    if (!free) return; for (let c = B.o.col; c < B.o.col + B.o.w; c++) used.add(c); keep.push(B); });
  const mk = (cell, c, r, extra) => { const m = parseCell(cell); if (!m) return -1; const id = g.men.length;
    g.men.push(Object.assign({id, color:m.color, hidden:m.hidden, revealed:!m.hidden, ramp:k, col:c, row:r, state:'ramp', bus:-1, seat:-1, tLand:0,
      cheerBus:-1, cheerT:0, cheerI:0}, extra || {})); return id; };
  keep.filter(B => B.t === 'box').forEach(B => { const b = B.o;
    ramp.boxes.push({i:ramp.boxes.length, src:B.i, col:b.col, w:b.w, row:b.row, h:b.h, kind:b.lock != null ? 'lock' : 'count',
      lock:b.lock != null ? String(b.lock) : null, n:b.count != null ? b.count|0 : 0, open:false, men:{}}); });
  keep.filter(B => B.t === 'tunnel').forEach(B => { const t = B.o;
    ramp.tunnels.push({i:ramp.tunnels.length, src:B.i, col:t.col, w:t.w, row:t.row, h:t.h, color:t.color, count:t.count|0, left:t.count|0, men:[], gone:false}); });
  ramp.boxes.forEach(b => { for (let c = b.col; c < b.col + b.w; c++) ramp.obst[c] = {t:'box', i:b.i}; });
  ramp.tunnels.forEach(t => { for (let c = t.col; c < t.col + t.w; c++) ramp.obst[c] = {t:'tunnel', i:t.i}; });
  src.columns.forEach((col, c) => {
    const o = ramp.obst[c], O = o ? (o.t === 'box' ? ramp.boxes[o.i] : ramp.tunnels[o.i]) : null, front = [], rest = [], under = [];
    col.forEach((cell, r) => {                   // empty cells: people stand from the front
      const id = mk(cell, c, r); if (id < 0) return;
      if (!O || r < O.row) front.push(id); else if (o.t === 'box' && r < O.row + O.h) under.push(id); else rest.push(id);
    });
    ramp.cols.push(front); ramp.rest.push(rest);
    if (o && o.t === 'box') O.men[c] = under;
  });
  ramp.tunnels.forEach(t => { for (let n = 0; n < t.count; n++)
    t.men.push(mk(t.color, -1, -1, {state:'tunnel', tunnel:t.i})); });
  ramp.tunnels.forEach(t => feedTunnel(g, ramp, t, true, true));
  ramp.cols.forEach(col => { if (col.length) g.men[col[0]].revealed = true; });
  ramp.empty = rampEmpty(ramp);
  return ramp;
}
const rampEmpty = ramp => ramp.cols.every(x => !x.length) && ramp.rest.every(x => !x.length) &&
  ramp.tunnels.every(t => t.gone || t.left === 0) && ramp.boxes.every(b => b.open || Object.values(b.men).every(x => !x.length));
function cloneRamp(r){
  return {k:r.k, cols:r.cols.map(x => x.slice()), rest:r.rest.map(x => x.slice()), obst:r.obst.slice(),
          tunnels:r.tunnels.map(t => Object.assign({}, t)), boxes:r.boxes.map(b => Object.assign({}, b)), empty:r.empty};
}
/* a tunnel releases one of its stickmen into each empty cell directly in front of it; empty, it is gone
   and the stickmen behind it join their columns.  real = the game (men move, events), else a prediction copy */
function feedTunnel(g, ramp, T, real, quiet){
  if (T.gone) return;
  for (let c = T.col; c < T.col + T.w; c++)
    while (T.left > 0 && ramp.cols[c].length < T.row){
      const id = T.men[T.count - T.left]; T.left--; ramp.cols[c].push(id);
      if (real){ const m = g.men[id]; m.state = 'ramp'; m.col = c; m.row = T.row - 1;
        if (!quiet) emit(g, 'release', {ramp:ramp.k, tunnel:T.i, col:c, man:id, left:T.left}); }
    }
  if (T.left === 0){
    T.gone = true;
    for (let c = T.col; c < T.col + T.w; c++){ ramp.obst[c] = null; for (const id of ramp.rest[c]) ramp.cols[c].push(id); ramp.rest[c] = []; }
    if (real && !quiet) emit(g, 'tunnelGone', {ramp:ramp.k, tunnel:T.i});
  }
}
function takeFront(g, ramp, c, real){
  const id = ramp.cols[c].shift(), o = ramp.obst[c];
  if (o && o.t === 'tunnel') feedTunnel(g, ramp, ramp.tunnels[o.i], real);
  return id;
}
function openBoxIn(g, ramp, B, real){
  if (B.open) return; B.open = true;
  for (let c = B.col; c < B.col + B.w; c++){
    if (!ramp.obst[c] || ramp.obst[c].t !== 'box' || ramp.obst[c].i !== B.i) continue;
    ramp.obst[c] = null;
    for (const id of (B.men[c] || [])) ramp.cols[c].push(id);
    for (const id of ramp.rest[c]) ramp.cols[c].push(id);
    ramp.rest[c] = [];
  }
  if (real) revealFronts(g, ramp);
}
function revealFronts(g, ramp){
  ramp.cols.forEach(col => { const m = col.length ? g.men[col[0]] : null;
    if (m && !m.revealed){ m.revealed = true; emit(g, 'revealMan', {man:m.id}); } });
}

function createGame(level, opts){
  opts = opts || {};
  const N = normalizeLevel(level), L = buildLayout(N);
  const g = {t:0, emit:!opts.headless, events:[], result:null, resultT:0, L, level:N,
    men:[], buses:[], ramps:[], lanes:N.lanes.map(() => []), laneLeft:N.lanes.map(() => -1),
    bays:new Array(STATIC_SLOTS).fill(-1), bayRes:new Array(STATIC_SLOTS).fill(-1),
    road:[], trips:[], tunnel:[], running:[], counter:0, toRoad:0, landed:0,
    sends:0, moves:[], tripSeq:0, sideUse:[0,0], cheerMiss:0, completed:0, timers:[], locks:{}, groups:[], keyFallbacks:0};
  L.RAMPS.forEach((R, k) => g.ramps.push(buildRampState(g, N, R, k)));   // ramps in boarding order along the road
  g.ramps.forEach(r => r.boxes.forEach(b => { if (b.kind === 'lock') g.locks[b.lock] = {ramp:r.k, box:b.i}; }));
  N.lanes.forEach((lane, l) => {
    let z = Z_LANE_TOP + 0.12;
    lane.forEach((d, i) => {
      const len = busLen(d.cap);
      const b = {id:g.buses.length, color:d.color, cap:d.cap, hidden:!!d.hidden, revealed:!d.hidden || i===0, link:d.link, key:d.key != null ? String(d.key) : null,
        len, state:'lane', lane:l, bay:-1, x:L.Y.LANE_X[l], y:0, z:z+len/2, dx:0, dz:-1, slope:0, v:0,
        rs:0, seg:0, nextRamp:0, seated:0, transit:0, trip:null, board:null, side:1, tJump:0, tExit:0, cheer:new Set(), group:null, retBay:-1};
      z += len + LANE_GAP;
      g.buses.push(b); g.lanes[l].push(b.id);
    });
  });
  /* connected buses: one group per link id; order on the road = leftmost lane first, then left to right,
     front to back within a lane */
  const byLink = {};
  g.buses.forEach(b => { if (b.link != null) (byLink[b.link] = byLink[b.link] || []).push(b); });
  Object.keys(byLink).forEach(id => { const ms = byLink[id];
    if (ms.length < 2) return;
    ms.sort((a, c) => a.lane - c.lane || g.lanes[a.lane].indexOf(a.id) - g.lanes[c.lane].indexOf(c.id));
    const grp = {id, members:ms.map(b => b.id), jumped:false};
    ms.forEach(b => { b.group = grp; }); g.groups.push(grp); });
  return g;
}
const emit = (g, type, data) => { if (g.emit) g.events.push(Object.assign({type, t:g.t}, data)); };
const canRoad = g => g.counter < ROAD_CAPACITY;
function freeBay(g){ for (let k=0;k<STATIC_SLOTS;k++) if (g.bays[k] < 0 && g.bayRes[k] < 0) return k; return -1; }
function freeBays(g){ const out = []; for (let k=0;k<STATIC_SLOTS;k++) if (g.bays[k] < 0 && g.bayRes[k] < 0) out.push(k); return out; }
function frontColors(g){ const n = {}; COLORS.forEach(c => n[c]=0);
  for (const r of g.ramps) for (const col of r.cols) if (col.length) n[g.men[col[0]].color]++; return n; }
function frontMatch(g, k, color){
  for (const col of g.ramps[k].cols) if (col.length && g.men[col[0]].color === color) return true;
  return false;
}
const isFull = b => b.seated + b.transit >= b.cap;
const groupSize = b => b.group ? b.group.members.length : 1;
const reachable = (g, k) => g.L.RAMPS[k].s < g.L.ROAD.portalS;

/* --------------------------- player actions -------------------------- */
/* Every yard route rasterises the footprint it sweeps (bus rectangle + margin) into grid cells,
   remembering the first and last path position at which each cell is touched. */
function sweepCells(path, len){
  const cells = new Map(), o = {}, hl = len/2 + CELL_M, hw = BUS_W/2 + CELL_M, h = CELL/2;
  let seg = 0;
  for (let s = 0, done = false; !done; s += 0.1){
    if (s >= path.len){ s = path.len; done = true; }
    seg = pathAt(path, s, o, seg);
    const ax = Math.abs(o.dx), az = Math.abs(o.dz), ex = ax*hl + az*hw, ez = az*hl + ax*hw;
    for (let ix = Math.floor((o.x-ex)/CELL); ix <= Math.floor((o.x+ex)/CELL); ix++)
      for (let iz = Math.floor((o.z-ez)/CELL); iz <= Math.floor((o.z+ez)/CELL); iz++){
        const cx = (ix+0.5)*CELL - o.x, cz = (iz+0.5)*CELL - o.z;
        if (Math.abs(cx*o.dx + cz*o.dz) > hl + h*(ax+az)) continue;      // separating axis: bus length
        if (Math.abs(cz*o.dx - cx*o.dz) > hw + h*(ax+az)) continue;      // separating axis: bus width
        const key = (ix+512)*4096 + (iz+2048), c = cells.get(key);
        if (c) c.o = s; else cells.set(key, {i:s, o:s});
      }
  }
  return cells;
}
/* conflict list of a new trip b against an earlier trip e: shared cells sorted by when e leaves them,
   with the suffix-minimum of when b would enter them -> O(1) per step */
function pairConflict(b, e){
  const list = [];
  for (const [k, c] of b.trip.cells){ const ec = e.trip.cells.get(k); if (ec) list.push([ec.o, c.i]); }
  if (!list.length) return null;
  list.sort((p, q) => p[0] - q[0]);
  const suf = new Float64Array(list.length); let m = Infinity;
  for (let i=list.length-1;i>=0;i--){ m = Math.min(m, list[i][1]); suf[i] = m; }
  return {e, etrip:e.trip, list, suf, p:0};
}
function startTrip(g, b, kind, path){
  b.trip = {kind, path, s:0, seg:0, seq:++g.tripSeq, cells:sweepCells(path, b.len), conf:[]};
  for (const e of g.trips){ const c = pairConflict(b, e); if (c) b.trip.conf.push(c); }
  b.v = 0; g.trips.push(b);
}
function sendToRoad(g, b, from, idx){
  let path;
  if (from === 'lane'){
    const mid = (g.lanes.length - 1)/2;             // lanes left of the middle use the left side lane, right of it the right one
    const side = idx < mid ? -1 : idx > mid ? 1 : (g.sideUse[1] < g.sideUse[0] ? 1 : -1);
    b.side = side; g.sideUse[side > 0 ? 1 : 0]++;
    path = routeToRoad(b.x, b.z, side, g.L.Y);
  } else path = routeBayToRoad(b.x, b.z);
  b.state = 'toRoad'; g.toRoad++; g.counter++; g.sends++;
  startTrip(g, b, 'toRoad', path);
  g.moves.push((from === 'lane' ? 'L' : 'B') + idx + ':' + b.color + b.cap + '>road');
  const cheer = reserveCheer(g, b);
  emit(g, 'send', {bus:b.id, from, idx, dest:'road', cheer, group:b.group ? b.group.id : undefined});
}
/* ------------------------- cheering at send time -------------------------
   Who will board each bus during this lap.  Buses never overtake, so at every ramp they board in
   road order: the ones on the main road (front first), then the ones heading to it in the order
   they were sent (they merge in that order).  Replaying the boarding rounds of stepBoarding /
   startRound on copies of the ramps (tunnels feeding, boxes a key bus is sure to open on its way)
   gives exactly the stickmen each bus will take.  A box opened any other way (a key bus that filled
   up first, or a count box) is a new event: then every bus on its lap is planned again (replanCheer). */
function lapBoarders(g){
  const order = g.road.slice().concat(g.trips.filter(b => b.trip.kind === 'toRoad').sort((a, c) => a.trip.seq - c.trip.seq));
  const st = g.ramps.map(cloneRamp), out = new Map();
  for (const b of order){
    const got = [], B = b.board;
    let free = b.cap - b.seated - b.transit;
    for (let k = B ? B.k : b.state === 'road' ? b.nextRamp : 0; k < st.length && free > 0; k++){
      if (!reachable(g, k)) break;
      const rs = st[k], cs = rs.cols, ord = g.L.RAMPS[k].colOrder;
      if (b.key && !(B && k === B.k)){ const lk = g.locks[b.key]; if (lk && lk.ramp === k) openBoxIn(g, rs, rs.boxes[lk.box], false); }
      if (B && k === B.k){                          // stopped here: the columns already called this round, then maybe more rounds
        for (const c of B.queue){ got.push(takeFront(g, rs, c, false)); free--; }
        if (B.done) continue;
      }
      while (free > 0){                             // one round: every matching front row, nearest the road first
        const q = ord.filter(c => cs[c].length && g.men[cs[c][0]].color === b.color);
        if (!q.length) break;
        for (const c of q.slice(0, free)){ got.push(takeFront(g, rs, c, false)); free--; }
      }
    }
    out.set(b.id, got);
  }
  return out;
}
/* the stickmen bus b will take cheer from the moment it is sent until they board; a bus never takes
   over stickmen already promised to a bus ahead (the replay gives those to the bus ahead) */
function reserveCheer(g, b){
  const ids = lapBoarders(g).get(b.id) || [], clash = [];
  b.cheer = new Set();
  ids.forEach((id, i) => { const m = g.men[id];
    if (m.cheerBus >= 0 && m.cheerBus !== b.id){ clash.push(id); return; }
    m.cheerBus = b.id; m.cheerT = g.t; m.cheerI = i; b.cheer.add(id); });
  if (clash.length){ g.cheerMiss += clash.length; emit(g, 'cheerMiss', {bus:b.id, men:clash, why:'already promised to a bus ahead'}); }
  return [...b.cheer];
}
/* a box opened: everybody on a lap is planned again from here (buses ahead may now reach stickmen
   that were locked away) - stickmen keep cheering if they stay with the same bus */
function replanCheer(g){
  const plan = lapBoarders(g), next = new Map();
  plan.forEach((ids, bid) => ids.forEach((id, i) => next.set(id, [bid, i])));
  g.buses.forEach(b => {
    if (!plan.has(b.id)) return;
    b.cheer = new Set(plan.get(b.id));
  });
  g.men.forEach(m => {
    if (m.state !== 'ramp' && m.state !== 'tunnel') return;
    const nx = next.get(m.id);
    if (!nx){ if (m.cheerBus >= 0 && plan.has(m.cheerBus)) m.cheerBus = -1; return; }
    if (m.cheerBus !== nx[0]){ m.cheerBus = nx[0]; m.cheerT = g.t; m.cheerI = nx[1]; }
  });
  emit(g, 'cheerReplan', {});
}
/* safety net (the prediction is exact, so this should never fire): a bus leaving a ramp, jumping off
   or entering the tunnel stops the cheering of anyone it was going to take and did not */
function dropCheer(g, b, keep, why){
  const left = [...b.cheer].filter(id => g.men[id].state === 'ramp' && !keep(g.men[id]));
  if (!left.length) return;
  left.forEach(id => { b.cheer.delete(id); if (g.men[id].cheerBus === b.id) g.men[id].cheerBus = -1; });
  g.cheerMiss += left.length; emit(g, 'cheerMiss', {bus:b.id, men:left, why});
}
function afterLaneShift(g, l, departed){
  g.laneLeft[l] = departed;
  const nb = g.lanes[l][0];
  if (nb !== undefined && !g.buses[nb].revealed){ g.buses[nb].revealed = true; emit(g, 'reveal', {bus:nb}); }
}
/* Connected buses leave together: a group can go only when, in every lane it uses, its topmost member
   is the front bus of that lane (members in one lane follow each other), and the road has room for
   all of them.  A member at the front waiting for its partners blocks its lane. */
function groupReady(g, grp){
  const lanes = {};
  for (const id of grp.members){ const b = g.buses[id]; if (b.state !== 'lane') return false; (lanes[b.lane] = lanes[b.lane] || []).push(id); }
  return Object.keys(lanes).every(l => { const ids = lanes[l], q = g.lanes[l];
    return ids.every((id, i) => q[i] === id || ids.includes(q[i])) && ids.every(id => q.indexOf(id) < ids.length); });
}
const groupParked = (g, grp) => grp.members.every(id => g.buses[id].state === 'bay');
function sendGroup(g, grp, from){
  const lastInLane = {};
  for (const id of grp.members){ const b = g.buses[id];
    if (from === 'lane'){ const q = g.lanes[b.lane]; q.splice(q.indexOf(id), 1); lastInLane[b.lane] = id; sendToRoad(g, b, 'lane', b.lane); }
    else { const k = b.bay; g.bays[k] = -1; b.bay = -1; sendToRoad(g, b, 'bay', k); } }
  Object.keys(lastInLane).forEach(l => afterLaneShift(g, +l, lastInLane[l]));
}
function tapLane(g, l){
  if (g.result) return 'over';
  const lane = g.lanes[l]; if (!lane.length) return 'empty';
  const b = g.buses[lane[0]];
  if (b.group){
    if (!groupReady(g, b.group) || g.counter + b.group.members.length > ROAD_CAPACITY){
      emit(g, 'refuse', {bus:b.id, lane:l, linked:true}); return 'refused'; }
    sendGroup(g, b.group, 'lane'); return 'road';
  }
  return tapSingle(g, l);
}
function tapSingle(g, l){                          // a queue bus only ever goes to the main road
  const lane = g.lanes[l], b = g.buses[lane[0]];
  if (canRoad(g)){ lane.shift(); sendToRoad(g, b, 'lane', l); afterLaneShift(g, l, b.id); return 'road'; }
  emit(g, 'refuse', {bus:b.id, lane:l}); return 'refused';      // road counter 5/5: the bus shakes, nothing else
}
function tapBay(g, k){
  if (g.result) return 'over';
  const id = g.bays[k]; if (id < 0) return 'none';
  const b = g.buses[id];
  if (b.group){                                     // the whole group goes back, if it is all parked and fits
    if (!groupParked(g, b.group) || g.counter + b.group.members.length > ROAD_CAPACITY){ emit(g, 'lurch', {bus:id, bay:k}); return 'lurch'; }
    sendGroup(g, b.group, 'bay'); return 'road';
  }
  if (!canRoad(g)){ emit(g, 'lurch', {bus:id, bay:k}); return 'lurch'; }
  g.bays[k] = -1; b.bay = -1;
  sendToRoad(g, b, 'bay', k); return 'road';
}

/* ------------------------------ movement ----------------------------- */
const tmp = {};
function placeOnPath(b){ const tr = b.trip; tr.seg = pathAt(tr.path, tr.s, tmp, tr.seg);
  b.x=tmp.x; b.y=0; b.z=tmp.z; b.dx=tmp.dx; b.dz=tmp.dz; b.slope=0; }
function placeOnRoad(g, b){ b.seg = pathAt(g.L.ROAD, b.rs, tmp, b.seg);
  b.x=tmp.x; b.y=tmp.y; b.z=tmp.z; b.dx=tmp.dx; b.dz=tmp.dz; b.slope=tmp.slope; }
/* how far bus b may advance before touching obstacle o (oriented-box test along b's heading) */
function clearAhead(b, o){
  const dx = o.x-b.x, dz = o.z-b.z, fwd = dx*b.dx + dz*b.dz;
  if (fwd <= 0) return Infinity;
  const lat = Math.abs(dx*b.dz - dz*b.dx);
  const c = Math.abs(o.dx*b.dx + o.dz*b.dz), s = Math.abs(o.dx*b.dz - o.dz*b.dx);
  if (lat > BUS_W/2 + s*o.len/2 + c*BUS_W/2 + 0.04) return Infinity;
  return fwd - b.len/2 - (c*o.len/2 + s*BUS_W/2) - FOLLOW_GAP;
}
function roadEntryFree(g, b){
  const last = g.road[g.road.length-1];
  return !last || last.rs - last.len/2 - b.len/2 - ROAD_GAP >= 0;
}
function stepLanes(g, dt){
  for (let l=0;l<g.lanes.length;l++){
    let limit = -Infinity;                       // nothing may pass the tail of the bus that just left
    const dep = g.laneLeft[l] >= 0 ? g.buses[g.laneLeft[l]] : null;
    if (dep && dep.trip){
      const rx = dep.x - dep.dx*dep.len/2, rz = dep.z - dep.dz*dep.len/2;
      if (Math.abs(rx - g.L.Y.LANE_X[l]) < 0.8 && rz > Z_LANE_TOP - 0.7) limit = rz + LANE_GAP;
    }
    let slot = Z_LANE_TOP + 0.12;
    for (const id of g.lanes[l]){
      const b = g.buses[id], target = Math.max(slot + b.len/2, limit + b.len/2);
      slot += b.len + LANE_GAP;
      const nz = b.z > target ? Math.max(target, b.z - YARD_SPEED*dt) : b.z;
      b.v = (b.z - nz)/dt; b.z = nz;
      limit = b.z + b.len/2 + LANE_GAP;
    }
  }
}
function stepTrips(g, dt){
  const T = g.trips;
  for (let i=0;i<T.length;i++){
    const b = T[i], tr = b.trip, P = tr.path;
    let sMax = P.len;
    /* ordering: a trip never enters a cell that an earlier trip still has to sweep through.
       Waiting only ever points at earlier trips, so the yard cannot deadlock. */
    for (const cf of tr.conf){
      if (cf.e.trip !== cf.etrip) continue;                       // that trip is finished
      const es = cf.etrip.s;
      while (cf.p < cf.list.length && es > cf.list[cf.p][0] + 0.12) cf.p++;
      if (cf.p < cf.list.length) sMax = Math.min(sMax, Math.max(tr.s, cf.suf[cf.p] - 0.12));
    }
    /* physical spacing to anything ahead (other trips, buses just merged onto the road) */
    let room = Infinity;
    for (let j=0;j<i;j++) room = Math.min(room, clearAhead(b, T[j]));   // later trips always yield to us
    for (let j=g.road.length-1;j>=0;j--){ const r = g.road[j]; if (r.rs > 5) break;
      if (b.group && r.group === b.group) continue;   // its own group waits for it at the merge gap (along the road)
      room = Math.min(room, clearAhead(b, r)); }
    sMax = Math.min(sMax, tr.s + room);
    if (tr.kind === 'toRoad'){                    // the route continues as the main road: keep the gap to its last bus
      const last = g.road[g.road.length-1];
      if (last && last.rs < 8) sMax = Math.min(sMax, P.len + last.rs - last.len/2 - b.len/2 - ROAD_GAP);
    }
    let vt = YARD_SPEED;
    if (tr.kind !== 'toRoad' || !roadEntryFree(g, b)) vt = Math.min(vt, Math.sqrt(2*SOFT_BRAKE*Math.max(0, P.len - tr.s)));
    vt = Math.min(vt, Math.sqrt(2*HARD_BRAKE*Math.max(0, sMax - tr.s)));
    b.v = vt > b.v ? Math.min(vt, b.v + ACCEL*dt) : vt;
    tr.s = Math.min(tr.s + b.v*dt, Math.max(tr.s, sMax));
    placeOnPath(b);
    if (tr.s >= P.len - 1e-6){
      if (tr.kind === 'toRoad'){
        if (roadEntryFree(g, b)){
          T.splice(i, 1); i--; b.trip = null;
          b.state = 'road'; b.rs = 0; b.seg = 0; b.nextRamp = 0; g.toRoad--;          // already counted when sent
          g.road.push(b); placeOnRoad(g, b);
          if (!b.revealed){ b.revealed = true; emit(g, 'reveal', {bus:b.id}); }   // a hidden group member sent from behind
          emit(g, 'merge', {bus:b.id});
        } else b.v = 0;
      } else {
        T.splice(i, 1); i--; b.trip = null; b.v = 0;
        const k = b.bay; g.bays[k] = b.id; g.bayRes[k] = -1; b.retBay = -1;
        if (b.state === 'return') g.counter--;
        b.state = 'bay';
        emit(g, 'park', {bus:b.id, bay:k});
      }
    }
  }
}
function startRound(g, b){
  const B = b.board, free = b.cap - b.seated - b.transit;
  if (free <= 0){ B.done = true; return; }
  const ramp = g.ramps[B.k], q = [];
  for (const c of g.L.RAMPS[B.k].colOrder){ const col = ramp.cols[c];
    if (col.length && g.men[col[0]].color === b.color) q.push(c); }
  if (!q.length){ B.done = true; return; }
  B.queue = q.slice(0, free); B.next = Math.max(B.next, g.t);
}
function boardInterval(chain){ return Math.max(0.42, 1 - 0.07*chain) / BOARD_RATE; }
function stepBoarding(g, b){
  const B = b.board, ramp = g.ramps[B.k];
  while (B.queue.length && g.t >= B.next - 1e-9){
    const c = B.queue.shift(), id = takeFront(g, ramp, c, true), m = g.men[id];
    revealFronts(g, ramp);
    if (m.cheerBus !== b.id){ g.cheerMiss++; emit(g, 'cheerMiss', {bus:b.id, men:[id], why:'boarded without being predicted'});
      if (m.cheerBus >= 0) g.buses[m.cheerBus].cheer.delete(id); }
    m.cheerBus = -1; b.cheer.delete(id);
    m.state = 'run'; m.bus = b.id; m.seat = b.seated + b.transit; m.tLand = g.t + RUN_TIME;
    b.transit++; g.running.push(id);
    emit(g, 'board', {man:id, bus:b.id, ramp:B.k, col:c, seat:m.seat, chain:B.chain});
    B.chain++; B.next += boardInterval(B.chain);
    if (!ramp.empty && rampEmpty(ramp)){ ramp.empty = true; emit(g, 'rampEmpty', {ramp:B.k}); }
    if (!B.queue.length) B.roundAt = g.t + COLUMN_SHIFT_TIME;
  }
  if (!B.queue.length && !B.done && g.t >= B.roundAt - 1e-9) startRound(g, b);
  if (B.done && b.transit === 0){
    b.board = null;
    if (b.group){                                   // a full member stops boarding but stays in the group
      if (b.group.members.every(id => { const m = g.buses[id]; return m.state === 'road' && !m.board && m.seated >= m.cap; })){ jumpGroup(g, b.group); return; }
      b.nextRamp = B.k + 1;
      if (b.seated < b.cap) dropCheer(g, b, m => m.ramp !== B.k, 'left a ramp without them');
      emit(g, 'depart', {bus:b.id}); return;
    }
    if (b.seated >= b.cap){ jump(g, b); return; }
    b.nextRamp = B.k + 1;
    dropCheer(g, b, m => m.ramp !== B.k, 'left a ramp without them');
    emit(g, 'depart', {bus:b.id});
  }
}
/* key bus at a ramp's boarding point: its key flies to the lock and the box opens */
function keyPass(g, b, k){
  if (!b.key) return;
  const lk = g.locks[b.key]; if (!lk || lk.ramp !== k) return;
  const ramp = g.ramps[k], B = ramp.boxes[lk.box], key = b.key; b.key = null;
  if (B.open) return;
  openBoxIn(g, ramp, B, true);
  emit(g, 'unlock', {ramp:k, box:B.i, how:'key', bus:b.id, lock:key});
  boxOpened(g, ramp);
}
function boxOpened(g, ramp){
  if (!ramp.empty && rampEmpty(ramp)){ ramp.empty = true; emit(g, 'rampEmpty', {ramp:ramp.k}); }
  replanCheer(g);
}
function openCountBoxes(g){
  g.ramps.forEach(r => r.boxes.forEach(B => {
    if (B.kind !== 'count' || B.open || g.completed < B.n) return;
    openBoxIn(g, r, B, true);
    emit(g, 'unlock', {ramp:r.k, box:B.i, how:'count', n:B.n});
    boxOpened(g, r);
  }));
}
const KEY_FALLBACK_DELAY = 0.9;    // a key bus that filled before its lock's ramp: the key flies when its parachute opens
function jump(g, b){
  g.road.splice(g.road.indexOf(b), 1);
  dropCheer(g, b, () => false, 'filled up before reaching them');
  b.state = 'jump'; b.v = 0; g.counter--; b.tJump = g.t; b.side = b.x >= 0 ? 1 : -1;
  g.completed++;
  emit(g, 'jump', {bus:b.id, side:b.side, group:b.group ? b.group.id : undefined});
  if (b.key){ const lk = g.locks[b.key];
    if (lk && !g.ramps[lk.ramp].boxes[lk.box].open){ g.keyFallbacks++; g.timers.push({t:g.t + KEY_FALLBACK_DELAY, kind:'key', bus:b.id, lock:b.key});
      emit(g, 'keyFallback', {bus:b.id, lock:b.key, ramp:lk.ramp}); }
    b.key = null; }
  // (once: the buses of a connected group all jump in the same step, the last of them completing the level)
  if (g.landed === g.men.length && g.result !== 'win'){ g.result = 'win'; g.resultT = g.t; emit(g, 'win', {bus:b.id}); }
  openCountBoxes(g);
}
function jumpGroup(g, grp){
  grp.jumped = true;
  for (const id of grp.members){ const m = g.buses[id]; if (m.state === 'road') jump(g, m); }
}
function stepTimers(g){
  for (let i = 0; i < g.timers.length; i++){
    const T = g.timers[i]; if (g.t < T.t - 1e-9) continue;
    g.timers.splice(i, 1); i--;
    if (T.kind === 'key'){ const lk = g.locks[T.lock], ramp = g.ramps[lk.ramp], B = ramp.boxes[lk.box];
      if (!B.open){ openBoxIn(g, ramp, B, true); emit(g, 'unlock', {ramp:lk.ramp, box:B.i, how:'fallback', bus:T.bus, lock:T.lock}); boxOpened(g, ramp); } }
  }
}
/* gaps: the top speed of buses (a group: any member) running up to a gap or over it */
function gapVmax(ROAD, ms){
  for (const G of ROAD.gaps || []) for (const m of ms) if (m.rs + m.len/2 >= G.s0 - GAP_RUNUP && m.rs - m.len/2 <= G.s1) return BUS_SPEED*GAP_BOOST;
  return BUS_SPEED;
}
/* the furthest a bus (or a group, head to tail) may go before the next gap it has not reached: up to its edge, unless the
   bus ahead has cleared the landing side by the whole length behind (its rear past the gap's end by that much) */
function gapHold(ROAD, head, tail, lead){
  const front = head.rs + head.len/2, G = (ROAD.gaps || []).find(q => front <= q.s0 + 1e-6); if (!G || !lead) return Infinity;
  const extent = head.rs + head.len/2 - (tail.rs - tail.len/2);
  return lead.rs - lead.len/2 >= G.s1 + extent + ROAD_GAP ? Infinity : G.s0 - head.len/2;
}
function stepRoad(g, dt){
  const R = g.road;
  for (let i=0;i<R.length;i++){
    const b = R[i];
    if (b.group){ i = stepGroup(g, b.group, i, dt); continue; }
    if (b.board){
      stepBoarding(g, b);
      if (b.state !== 'road'){ i--; continue; }
      if (b.board){ b.v = 0; continue; }
    }
    const lead = i > 0 ? R[i-1] : null;
    let sLimit = lead ? lead.rs - lead.len/2 - b.len/2 - ROAD_GAP : Infinity;
    sLimit = Math.min(sLimit, gapHold(g.L.ROAD, b, b, lead));
    const RAMPS = g.L.RAMPS, k0 = b.nextRamp, bk0 = k0 < RAMPS.length ? RAMPS[k0].s : Infinity;
    let stopS = Infinity;
    for (let k = k0; k < RAMPS.length && RAMPS[k].s <= bk0 + 1e-6; k++)    // the next boarding point (two ramps can share it)
      if (bk0 - b.rs < 4 && bk0 >= b.rs - 1e-6 && frontMatch(g, k, b.color)){ stopS = bk0; break; }
    let vt = Math.min(gapVmax(g.L.ROAD, [b]), Math.sqrt(2*SOFT_BRAKE*Math.max(0, stopS - b.rs)),
                      Math.sqrt(2*HARD_BRAKE*Math.max(0, sLimit - b.rs)));
    b.v = vt > b.v ? Math.min(vt, b.v + ACCEL*dt) : vt;
    let ns = Math.min(b.rs + b.v*dt, Math.max(b.rs, sLimit), stopS), boarded = false;
    while (b.nextRamp < RAMPS.length && ns >= RAMPS[b.nextRamp].s - 1e-6){   // reached a boarding point: a key opens its box, then check the front row
      const k = b.nextRamp, bk = RAMPS[k].s;
      keyPass(g, b, k);
      if (frontMatch(g, k, b.color)){
        b.rs = Math.max(b.rs, bk); b.v = 0; placeOnRoad(g, b);
        b.board = {k, queue:[], next:g.t, roundAt:g.t, chain:0, done:false};
        emit(g, 'boardStart', {bus:b.id, ramp:k});
        startRound(g, b);
        boarded = true; break;
      }
      dropCheer(g, b, m => m.ramp !== k, 'drove past their ramp');
      b.nextRamp++;
    }
    if (boarded) continue;
    b.rs = ns;
    if (b.rs >= g.L.ROAD.end){
      R.splice(i, 1); i--;
      dropCheer(g, b, () => false, 'finished the lap without them');
      b.state = 'tunnel'; b.tExit = g.t + RETURN_TUNNEL_TIME; g.tunnel.push(b);
      emit(g, 'tunnelIn', {bus:b.id});
      continue;
    }
    placeOnRoad(g, b);
  }
}
/* A connected group on the main road moves as one articulated bus: every member keeps the same speed
   and a fixed bellows gap, and the whole group stops while any member boards.  It waits on the road
   for members still on their way to it, and enters the top tunnel only when its last member gets there
   (the members ahead of it go on into the tunnel, out of sight).  Returns the index of its last member. */
function stepGroup(g, grp, i, dt){
  const R = g.road, RAMPS = g.L.RAMPS, END = g.L.ROAD.end;
  let j = i; while (j + 1 < R.length && R[j+1].group === grp) j++;
  const ms = R.slice(i, j + 1), lead = i > 0 ? R[i-1] : null;
  let busy = false;
  for (const m of ms) if (m.board){ stepBoarding(g, m); if (grp.jumped) return i - 1; if (m.board) busy = true; }
  if (busy){ ms.forEach(m => { m.v = 0; }); return j; }
  const head = ms[0], tail = ms[ms.length - 1];
  let allow = Infinity, vt = gapVmax(g.L.ROAD, ms);
  const limit = (d, brake) => { allow = Math.min(allow, Math.max(0, d)); vt = Math.min(vt, Math.sqrt(2*brake*Math.max(0, d))); };
  if (lead) limit(lead.rs - lead.len/2 - head.len/2 - ROAD_GAP - head.rs, HARD_BRAKE);
  { const h = gapHold(g.L.ROAD, head, tail, lead); if (h < Infinity) limit(h - head.rs, SOFT_BRAKE); }
  const nextId = grp.members[grp.members.indexOf(tail.id) + 1];
  if (nextId != null && g.buses[nextId].state === 'toRoad'){ const nb = g.buses[nextId]; limit(tail.len/2 + nb.len/2 + ROAD_GAP + 1e-6 - tail.rs, SOFT_BRAKE); }   // just past the merge gap
  for (const m of ms){ if (isFull(m) || m.rs >= END) continue;
    const bk = m.nextRamp < RAMPS.length ? RAMPS[m.nextRamp].s : Infinity;
    for (let k = m.nextRamp; k < RAMPS.length && RAMPS[k].s <= bk + 1e-6; k++)
      if (bk - m.rs < 4 && bk >= m.rs - 1e-6 && frontMatch(g, k, m.color)){ limit(bk - m.rs, SOFT_BRAKE); break; } }
  const v0 = head.v, v = vt > v0 ? Math.min(vt, v0 + ACCEL*dt) : vt, d = Math.min(v*dt, allow);
  for (const m of ms){
    m.v = v;
    const ns = m.rs + d; let boarded = false;
    while (m.nextRamp < RAMPS.length && ns >= RAMPS[m.nextRamp].s - 1e-6){   // two ramps can share a spot: check each
      const k = m.nextRamp, bk = RAMPS[k].s;
      keyPass(g, m, k);
      if (!isFull(m) && frontMatch(g, k, m.color)){
        m.rs = Math.max(m.rs, bk); placeOnRoad(g, m);
        m.board = {k, queue:[], next:g.t, roundAt:g.t, chain:0, done:false};
        emit(g, 'boardStart', {bus:m.id, ramp:k});
        startRound(g, m);
        boarded = true; break;
      }
      if (!isFull(m)) dropCheer(g, m, x => x.ramp !== k, 'drove past their ramp');
      m.nextRamp++;
    }
    if (boarded) continue;
    m.rs = ns; placeOnRoad(g, m);
  }
  if (ms.some(m => m.board)) ms.forEach(m => { m.v = 0; });
  // the lap ends for the whole group when its last member reaches the tunnel
  if (tail.rs >= END && grp.members.every(id => g.buses[id].state === 'road')){
    R.splice(i, ms.length);
    for (const m of ms){
      dropCheer(g, m, () => false, 'finished the lap without them');
      m.state = 'tunnel'; m.tExit = g.t + RETURN_TUNNEL_TIME; g.tunnel.push(m);
      emit(g, 'tunnelIn', {bus:m.id});
    }
    return i - 1;
  }
  return j;
}
function stepTunnel(g){
  while (g.tunnel.length && g.t >= g.tunnel[0].tExit - 1e-9){
    const lr = g.lastReturn;                     // give the previous returning bus room to clear the mouth
    if (lr && lr.trip && lr.trip.s < lr.len/2 + g.tunnel[0].len/2 + 0.4) return;
    const b = g.tunnel[0];
    if (b.group && b.retBay < 0){                 // a group comes out: it needs a free bay for every member
      const free = freeBays(g), ms = b.group.members.map(id => g.buses[id]);
      if (free.length < ms.length){ g.tunnel.shift(); b.state = 'crash'; g.result = 'fail'; g.resultT = g.t;
        emit(g, 'crash', {bus:b.id, group:b.group.id}); return; }
      ms.forEach((m, n) => { m.retBay = free[n]; g.bayRes[free[n]] = m.id; });
    }
    g.tunnel.shift();
    const k = b.group ? b.retBay : freeBay(g);
    if (k < 0){                                   // the fail check happens on leaving the tunnel
      b.state = 'crash'; g.result = 'fail'; g.resultT = g.t;
      emit(g, 'crash', {bus:b.id}); return;
    }
    g.bayRes[k] = b.id; b.bay = k; b.state = 'return';
    startTrip(g, b, 'return', routeReturn(k, b.len, g.L.TUNNEL, g.L.Y)); b.v = YARD_SPEED*0.8; placeOnPath(b); g.lastReturn = b;
    emit(g, 'tunnelOut', {bus:b.id, bay:k});
  }
}
function stepLandings(g){
  const R = g.running;
  for (let i=0;i<R.length;i++){
    const m = g.men[R[i]];
    if (g.t < m.tLand - 1e-9) continue;
    R.splice(i, 1); i--;
    const b = g.buses[m.bus];
    m.state = 'seated'; b.seated++; b.transit--; g.landed++;
    emit(g, 'land', {man:m.id, bus:b.id, chain:b.board ? b.board.chain : 0});
  }
}
function step(g, dt){
  g.t += dt;
  if (g.result) return;
  if (g.timers.length) stepTimers(g);
  stepLanes(g, dt);
  stepTrips(g, dt);
  stepLandings(g);
  stepRoad(g, dt);
  stepTunnel(g);
}

/* ================================ BOTS =============================== */
/* Both bots send buses to the main road only (that is all a tap can do): the front bus of a queue
   lane (a whole connected group once it is ready) or a bus parked in a bay (its whole group), and only
   while the road has room for all of them.
   Greedy: the available bus (group) whose colours have the most stickmen in the ramps' front rows.
   Random: a uniformly random available bus (group). */
function legalSends(g){
  if (!canRoad(g)) return [];
  const a = [], seen = new Set();
  for (let k=0;k<STATIC_SLOTS;k++) if (g.bays[k] >= 0){ const b = g.buses[g.bays[k]];
    if (b.group){ if (seen.has(b.group) || !groupParked(g, b.group) || g.counter + b.group.members.length > ROAD_CAPACITY) continue; seen.add(b.group); }
    a.push({kind:'bay', idx:k, bus:b.id}); }
  for (let l=0;l<g.lanes.length;l++) if (g.lanes[l].length){
    const b = g.buses[g.lanes[l][0]];
    if (b.group){ if (seen.has(b.group) || !groupReady(g, b.group) || g.counter + b.group.members.length > ROAD_CAPACITY) continue; seen.add(b.group); }
    a.push({kind:'lane', idx:l, bus:b.id});
  }
  return a;
}
function greedyPick(g){
  const acts = legalSends(g); if (!acts.length) return null;
  const fc = frontColors(g); let best = null, bestScore = -1;
  const score = b => b.group ? b.group.members.reduce((s, id) => s + fc[g.buses[id].color], 0) : fc[b.color];
  for (const a of acts){                         // ties: free a bay when something matches, dig into the queue when nothing does
    const sc = score(g.buses[a.bus]);
    if (sc > bestScore || (sc === bestScore && sc === 0 && a.kind === 'lane' && best.kind === 'bay')){ best = a; bestScore = sc; }
  }
  if (bestScore === 0 && g.counter > 0) return null;   // nothing matches yet: let traffic clear first
  return best;
}
function randomPick(g, rng){ const acts = legalSends(g); return acts.length ? acts[Math.floor(rng()*acts.length)] : null; }
function applyAction(g, a){ return a.kind === 'lane' ? tapLane(g, a.idx) : tapBay(g, a.idx); }
function simulate(level, policy, rng, dt, maxT){
  dt = dt || SIM_DT; maxT = maxT || 1500;
  const g = createGame(level, {headless:true});
  let think = 0;
  while (!g.result && g.t < maxT){
    think -= dt;
    if (think <= 0){ think += BOT_THINK; const a = policy(g, rng); if (a) applyAction(g, a); }
    step(g, dt);
  }
  return {result: g.result || 'timeout', t: g.t, sends: g.sends, moves: g.moves, landed: g.landed, keyFallbacks: g.keyFallbacks, cheerMiss: g.cheerMiss};
}

/* ============================== VALIDATION ========================== */
function validateLevel(level){
  const men = {}, seats = {}, problems = [];
  COLORS.forEach(c => { men[c]=0; seats[c]=0; });
  level.ramps.forEach((r, k) => {
    if (r.columns.length !== RAMP_COLS) problems.push(`ramp ${k+1}: ${r.columns.length} columns`);
    r.columns.forEach((col, c) => {
      if (col.length !== RAMP_ROWS[k]) problems.push(`ramp ${k+1} col ${c+1}: ${col.length} rows (want ${RAMP_ROWS[k]})`);
      let run = 0; col.forEach((x, i) => { x = (parseCell(x) || {}).color; men[x]++; run = i && (parseCell(col[i-1]) || {}).color === x ? run+1 : 1;
        if (run > 4) problems.push(`ramp ${k+1} col ${c+1}: run longer than 4`); });
    });
    const kinds = new Set(r.columns.flat().map(c => (parseCell(c) || {}).color)).size;
    if (kinds < 6) problems.push(`ramp ${k+1}: only ${kinds} colours`);
  });
  const front = new Set(); level.ramps.forEach(r => r.columns.forEach(col => col.length && front.add((parseCell(col[0]) || {}).color)));
  if (front.size < 5) problems.push(`front rows show only ${front.size} colours`);
  let buses = 0; const sizes = new Set();
  level.lanes.forEach((lane, l) => lane.forEach((b, i) => { seats[b.color] += b.cap; buses++; sizes.add(b.cap);
    if (b.hidden && i < 2) problems.push(`lane ${l+1}: hidden bus in position ${i+1}`); }));
  const hidden = level.lanes.flat().filter(b => b.hidden).length;
  if (hidden !== 2) problems.push(`${hidden} hidden buses (want 2)`);
  if (buses !== 26) problems.push(`${buses} buses (want 26)`);
  if (sizes.size !== 4) problems.push(`bus sizes used: ${[...sizes]}`);
  const perColor = COLORS.map(c => ({color:c, seats:seats[c], men:men[c], ok:seats[c] === men[c] && men[c] === PER_COLOR}));
  perColor.forEach(p => { if (!p.ok) problems.push(`${p.color}: ${p.seats} seats vs ${p.men} stickmen`); });
  return {perColor, problems, ok: !problems.length};
}

/* ========================== EDITOR CHECKS ===========================
   checkLevel() feeds the editor's checks panel: colour balance, totals and geometry warnings.
   Every warning carries a world position (x,z) so the editor can highlight it in red. */
const CAM = SCREEN_CAM;
function project(x, y, z, cam){                    // world -> game screen pixels (900 x 1950 design space)
  const CAM = cam || SCREEN_CAM, P = CAM.pos, f = norm3([CAM.look[0]-P[0], CAM.look[1]-P[1], CAM.look[2]-P[2]]);
  const r = norm3([-f[2], 0, f[0]]), u = [r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  if (CAM.ortho){ const d = [x-CAM.look[0], y-CAM.look[1], z-CAM.look[2]];
    return [CAM.w/2 + (d[0]*r[0]+d[1]*r[1]+d[2]*r[2])*CAM.k, CAM.h/2 - (d[0]*u[0]+d[1]*u[1]+d[2]*u[2])*CAM.k]; }
  const d = [x-P[0], y-P[1], z-P[2]], zc = d[0]*f[0]+d[1]*f[1]+d[2]*f[2];
  const t = Math.tan(CAM.fov*Math.PI/360), xs = (d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(zc*t*CAM.w/CAM.h), ys = (d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(zc*t);
  return [(xs+1)/2*CAM.w, (1-ys)/2*CAM.h];
}
function norm3(v){ const l = Math.hypot(v[0],v[1],v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; }
const MIN_TURN_R = 1.0;                            // tightest curve a 12-seat bus can take
function inTarget(x, y, z){                        // inside the target zone of the fixed screen
  const [u, v] = project(x, y, z, SCREEN_CAM);
  return u >= SCREEN.MARGIN && u <= SCREEN.w - SCREEN.MARGIN && v >= SCREEN.TARGET_TOP*SCREEN.h && v <= SCREEN.TARGET_BOT*SCREEN.h;
}
function inZoneBoth(x, y, z){                      // on screen within the target zone's rows in both cameras (a pixel to spare)
  for (const cam of [SCREEN_CAM, ORTHO_CAM]){ const [u, v] = project(x, y, z, cam);
    if (u < -1 || u > SCREEN.w + 1 || v < SCREEN.TARGET_TOP*SCREEN.h - 1 || v > SCREEN.TARGET_BOT*SCREEN.h + 1) return false; }
  return true;
}
function inSpiral(ROAD, s, pad){ return ROAD.spirals.some(sp => s > sp.s0 - pad && s < sp.s1 + pad); }
function roadWarnings(L){
  const W = [], R = L.ROAD, P = R.P, n = R.n, pts = [];
  for (let i=0;i<n;i+=3) if (R.cum[i] <= R.portalS) pts.push({x:P[i*3], y:P[i*3+1], z:P[i*3+2], s:R.cum[i]});
  const near = (list, x, z) => list.some(w => Math.hypot(w.x - x, w.z - z) < 2.5);
  // self-intersection outside a spiral (ribbons closer than a road width)
  const hits = [];
  for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++){
    const a = pts[i], b = pts[j]; if (b.s - a.s < 2.6) continue;
    if (Math.hypot(a.x-b.x, a.z-b.z) > ROAD_HALF*2 - 0.05) continue;
    // allowed: both pieces belong to a spiral, or one does and they pass on an overpass (vertical clearance)
    const sp = R.spirals.some(q => (a.s > q.s0 - 2.2 && a.s < q.s1 + 2.2 && b.s > q.s0 - 2.2 && b.s < q.s1 + 2.2) ||
      ((a.s > q.s0 - 2.2 && a.s < q.s1 + 4) || (b.s > q.s0 - 2.2 && b.s < q.s1 + 4)) && Math.abs(a.y - b.y) >= 1.1);
    if (sp || near(hits, a.x, a.z)) continue;
    hits.push({x:(a.x+b.x)/2, z:(a.z+b.z)/2});
  }
  hits.forEach(h => W.push({kind:'road-cross', msg:'Road crosses itself outside a spiral', x:h.x, z:h.z}));
  // the road and the exit tunnel stay inside the target zone
  const off = [];
  for (const p of pts) if (!inTarget(p.x, p.y + 0.9, p.z) || !inTarget(p.x, p.y, p.z)){ if (!near(off, p.x, p.z)) off.push(p); }
  off.forEach(p => W.push({kind:'zone-road', msg:'Road leaves the target zone', x:p.x, z:p.z}));
  // the whole exit tunnel (its arch, both shoulders and feet) is on screen, wherever it is along the edge of the zone
  // (its top inside the zone, its shoulders and feet on screen within the zone's height)
  const E = L.exit, la = [-E.dz, E.dx], onZone = (x, y, z) => { const [u, v] = project(x, y, z, SCREEN_CAM);
    return u >= 0 && u <= SCREEN.w && v >= SCREEN.TARGET_TOP*SCREEN.h && v <= SCREEN.TARGET_BOT*SCREEN.h; };
  if (!inTarget(E.x, E.y + 1.9, E.z) || [[1.35, 1.25], [-1.35, 1.25], [1.35, 0], [-1.35, 0]].some(([u, h]) => !onZone(E.x + la[0]*u, E.y + h, E.z + la[1]*u)))
    W.push({kind:'zone-exit', msg:'Exit tunnel reaches outside the target zone', x:E.x, z:E.z});
  // curves too tight for a 12-seat bus (heading change over a 0.6-unit window)
  const tight = [], o1 = {}, o2 = {};
  for (let s = 0.6; s < R.portalS - 0.6; s += 0.15){
    if (inSpiral(R, s, 0.3)) continue;
    pathAt(R, s - 0.3, o1, 0); pathAt(R, s + 0.3, o2, 0);
    const da = Math.abs(Math.atan2(o1.dx*o2.dz - o1.dz*o2.dx, o1.dx*o2.dx + o1.dz*o2.dz));
    if (da > 1e-6 && 0.6/da < MIN_TURN_R){ pathAt(R, s, o1, 0); if (!near(tight, o1.x, o1.z)) tight.push({x:o1.x, z:o1.z}); }
  }
  tight.forEach(p => W.push({kind:'road-tight', msg:'Curve too tight for a 12-seat bus', x:p.x, z:p.z}));
  return W;
}
function rampSamples(r){ const out = [], o = {}; for (let s = 0.35; s <= r.length + 0.1; s += 0.25){ pathAt(r.spline, s, o, 0); out.push({x:o.x, z:o.z}); } return out; }
/* a ramp's platform as drawn: the polygon between its left and right edges (its width follows halfWAt) */
function rampOutline(r){ return r.outline.map(q => q.slice()); }
function inPoly(P, x, z){ let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++){ const a = P[i], b = P[j];
  if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0])*(z - a[1])/(b[1] - a[1]) + a[0]) c = !c; } return c; }
function segDist(px, pz, a, b){ const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx*dx + dz*dz || 1e-9, t = clamp(((px - a[0])*dx + (pz - a[1])*dz)/l2, 0, 1);
  return Math.hypot(px - a[0] - t*dx, pz - a[1] - t*dz); }
function polyDist(P, x, z){ if (inPoly(P, x, z)) return 0; let d = 1e9; for (let i = 0; i < P.length; i++) d = Math.min(d, segDist(x, z, P[i], P[(i + 1) % P.length])); return d; }
function segCross(a, b, c, d){ const o = (p, q, r) => (q[0] - p[0])*(r[1] - p[1]) - (q[1] - p[1])*(r[0] - p[0]);
  return o(a, b, c)*o(a, b, d) < 0 && o(c, d, a)*o(c, d, b) < 0; }
function polysOverlap(A, B, gap){
  for (const p of A) if (polyDist(B, p[0], p[1]) < gap) return p;
  for (const p of B) if (polyDist(A, p[0], p[1]) < gap) return p;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return A[i];
  return null;
}
/* the exit tunnel's arch and hill on the ground: 2.9 wide, from just before the road's end to 2.7 beyond it */
function exitFootprint(E){ const l = Math.hypot(E.dx, E.dz) || 1, dx = E.dx/l, dz = E.dz/l, nx = -dz, nz = dx, w = 1.45;
  return [[-0.4, -w], [2.7, -w], [2.7, w], [-0.4, w]].map(([f, u]) => [E.x + dx*f + nx*u, E.z + dz*f + nz*u]); }
function rampWarnings(L){
  const W = [], R = L.ROAD, polys = L.RAMPS.map(rampOutline), road = [];
  for (let i=0;i<R.n;i+=2) if (R.cum[i] <= R.portalS + 1) road.push({x:R.P[i*3], y:R.P[i*3+1], z:R.P[i*3+2], s:R.cum[i]});
  L.RAMPS.forEach((r, k) => {
    const label = 'Ramp ' + (r.src + 1);
    // the platform (its real outline) must keep clear of the road deck everywhere but its own boarding point
    let hit = null;
    for (const p of road){ if (Math.abs(p.s - r.s) < 0.3) continue;
      if (polyDist(polys[k], p.x, p.z) < ROAD_HALF - 0.1){ hit = p; break; } }
    if (hit) W.push({kind:'ramp-road', msg: label + ' overlaps the road', x:hit.x, z:hit.z, ramp:r.src});
    else if (r.frontShort) W.push({kind:'ramp-road', msg: label + '\'s front edge does not fit the road (turned too far against a bend)', x:r.x, z:r.z, ramp:r.src});
    // the apron between the road edge and the straight first row may be about one row deep at most
    if (r.apron > RAMP_APRON_MAX*r.manK + 1e-6){ const o = {}; pathAt(R, r.s, o, 0); const turned = Math.abs(r.dir[0]*o.dx + r.dir[1]*o.dz) > 0.09;
      W.push({kind:'ramp-apron', msg: label + ': the road bends too much here for its width (its apron would be ' + (r.apron/r.sp).toFixed(1) + ' rows deep): move it along the road' + (turned ? ', turn it square to the road' : '') + ' or make it narrower', x:r.x, z:r.z, ramp:r.src}); }
    for (let j=k+1;j<L.RAMPS.length;j++){
      const o = L.RAMPS[j], h2 = polysOverlap(polys[k], polys[j], 0.05);
      if (h2) W.push({kind:'ramp-ramp', msg: label + ' overlaps ramp ' + (o.src + 1), x:h2[0], z:h2[1], ramp:r.src});
    }
    const ex = exitFootprint(L.exit), he = polysOverlap(polys[k], ex, 0.1);
    if (he) W.push({kind:'ramp-exit', msg: label + ' runs into the exit tunnel', x:he[0], z:he[1], ramp:r.src});
    let out = null;
    for (const cs of r.slots){ for (const q of cs) if (!inTarget(q.x, q.y + 0.8, q.z) || !inTarget(q.x, q.y, q.z)){ out = q; break; } if (out) break; }
    // its platform too, in either camera (perspective or orthographic): the whole outline on screen within the zone's rows
    if (!out) for (const q of r.outline) if (!inZoneBoth(q[0], r.y, q[1])){ out = {x:q[0], z:q[1]}; break; }
    if (out) W.push({kind:'zone-ramp', msg: label + ' leaves the target zone', x:out.x, z:out.z, ramp:r.src});
    if (!r.snapped) W.push({kind:'ramp-unsnapped', msg: label + ': its front node is not on the road (no bus can reach it)', x:r.x, z:r.z, ramp:r.src});
    else if (inSpiral(R, r.s, 0.8)) W.push({kind:'ramp-spiral', msg: label + ': boarding point is on a spiral overpass', x:r.x, z:r.z, ramp:r.src});
  });
  // the exit tunnel stands on a stone base down to the ground: no earlier stretch of road may run through or under it
  // (only one passing well above it, as a spiral's overpass, is fine)
  { const ex = exitFootprint(L.exit); let hit = null;
    for (const p of road){ if (p.s > R.portalS - 2.6) break; if (p.y > L.exit.y + 2.4) continue;
      if (polyDist(ex, p.x, p.z) < ROAD_HALF + 0.15){ hit = p; break; } }
    if (hit) W.push({kind:'exit-road', msg:'The exit tunnel sits on another stretch of the road', x:hit.x, z:hit.z}); }
  return W;
}
/* connected buses: queue positions of every link group, and whether each group has a valid shape
   (2-3 buses; in one lane they follow each other; across lanes only neighbouring lanes, at most one row apart) */
/* the stickman size a level's free space allows: the largest step up to MAN_SCALE_MAX at which its (grown) ramps still
   raise no warning the level does not have at the normal size; a crowded level keeps 1 */
function autoManScale(level){
  const base = clone(level); delete base.manScale;
  const kinds = new Set(checkLevel(clone(base)).warnings.map(w => w.kind + ':' + (w.ramp != null ? w.ramp : '')));
  for (let s = MAN_SCALE_MAX; s > 1.001; s = Math.round((s - 0.05)*100)/100){ const t = clone(base); t.manScale = s;
    if (checkLevel(t).warnings.every(w => kinds.has(w.kind + ':' + (w.ramp != null ? w.ramp : '')))) return s; }
  return 1;
}
function linkGroups(N){
  const by = {};
  N.lanes.forEach((lane, l) => lane.forEach((b, i) => { if (b.link != null) (by[b.link] = by[b.link] || []).push({l, i}); }));
  return Object.keys(by).map(id => { const ms = by[id];
    const adj = (a, b) => (a.l === b.l && Math.abs(a.i - b.i) === 1) || (Math.abs(a.l - b.l) === 1 && Math.abs(a.i - b.i) <= 1);
    const seen = new Set([0]), stack = [0];
    while (stack.length){ const x = stack.pop(); ms.forEach((m, y) => { if (!seen.has(y) && adj(ms[x], m)){ seen.add(y); stack.push(y); } }); }
    const lanes = {}; ms.forEach(m => (lanes[m.l] = lanes[m.l] || []).push(m.i));
    const consecutive = Object.values(lanes).every(is => { is.sort((a, b) => a - b); return is.every((v, k) => v === is[0] + k); });
    return {id, members:ms, connected:seen.size === ms.length, consecutive}; });
}
/* can the queue be emptied at all? (sending fronts in any order; road room ignored, groups hold <= 3) */
function queueDeadlock(N){
  const groups = {}; linkGroups(N).forEach(G => { if (G.members.length >= 2) groups[G.id] = G; });
  const q = N.lanes.map(l => l.map((b, i) => ({link:b.link != null && groups[b.link] ? b.link : null})));
  let left = q.reduce((a, l) => a + l.length, 0);
  for (let guard = 0; guard < 400 && left; guard++){
    let moved = false;
    for (let l = 0; l < q.length && !moved; l++){
      if (!q[l].length) continue;
      const f = q[l][0];
      if (!f.link){ q[l].shift(); left--; moved = true; continue; }
      const G = groups[f.link], per = {};
      G.members.forEach(m => { per[m.l] = (per[m.l] || 0) + 1; });
      if (Object.keys(per).every(L => q[L].slice(0, per[L]).every(x => x.link === f.link))){
        Object.keys(per).forEach(L => { q[L].splice(0, per[L]); left -= per[L]; }); moved = true; }
    }
    if (!moved) break;
  }
  return left > 0;
}
/* road gaps: clear of the road's ends, of spirals and of each other; no boarding point on a gap, nor where a bus (or the
   longest connected group) landing after it would still be over it when it stops; no ramp beside a gap */
function gapWarnings(L, N){
  const W = [], R = L.ROAD, G = R.gaps || []; if (!G.length) return W;
  let ext = busLen(12);                             // the longest thing that may land: a 12-seat bus, or a connected group
  for (const grp of linkGroups(N)) ext = Math.max(ext, grp.members.reduce((a, m) => a + busLen(N.lanes[m.l][m.i].cap), 0) + (grp.members.length - 1)*ROAD_GAP);
  G.forEach((q, i) => { const o = {}; pathAt(R, q.at, o, 0); const at = {x:o.x, z:o.z, gap:i}, label = 'Gap ' + (i + 1);
    if (q.s0 < 2.5 || q.s1 > R.portalS - 2) W.push(Object.assign({kind:'gap-ends', msg:label + ' is too near the start or the end of the road'}, at));
    if (inSpiral(R, q.at, q.len/2 + 1)) W.push(Object.assign({kind:'gap-spiral', msg:label + ' is on a spiral'}, at));
    if (i && q.s0 - G[i - 1].s1 < 3) W.push(Object.assign({kind:'gap-gap', msg:label + ' is too close to gap ' + i}, at));
    for (const r of L.RAMPS){ const a = r.edge.sAt(-r.halfW), b = r.edge.sAt(r.halfW), lo = Math.min(a, b), hi = Math.max(a, b);
      if ((r.s > q.s0 - busLen(12)/2 - 0.2 && r.s < q.s1 + ext + 0.3) || (hi > q.s0 - 0.2 && lo < q.s1 + 0.2))
        W.push({kind:'gap-ramp', msg:'Ramp ' + (r.src + 1) + ' is on gap ' + (i + 1) + ' (or too close after it for a bus to land and stop): move it along the road', x:r.x, z:r.z, ramp:r.src, gap:i}); } });
  return W;
}
function checkLevel(level){
  const N = normalizeLevel(level), L = buildLayout(N);
  const men = {}, seats = {}, hiddenMen = {n:0}, sizes = {4:0, 6:0, 8:0, 12:0};
  COLORS.forEach(c => { men[c] = 0; seats[c] = 0; });
  N.ramps.forEach(r => r.columns.forEach(col => col.forEach(c => { const m = parseCell(c); if (m){ men[m.color]++; if (m.hidden) hiddenMen.n++; } })));
  N.ramps.forEach(r => (r.tunnels || []).forEach(t => { men[t.color] += t.count; }));      // a tunnel's stickmen count too
  let buses = 0; N.lanes.forEach(l => l.forEach(b => { seats[b.color] += b.cap; buses++; sizes[b.cap]++; }));
  const perColor = COLORS.map(c => ({color:c, men:men[c], seats:seats[c], ok:men[c] === seats[c]}));
  const warnings = [...roadWarnings(L), ...rampWarnings(L), ...gapWarnings(L, N)];
  // ramp blockers: inside the ramp, one per column, tunnels on empty cells with a cell in front
  const locks = {};
  N.ramps.forEach((r, ri) => {
    const label = 'Ramp ' + (ri + 1), cols = r.columns.length, used = {}, R = L.RAMPS.find(x => x.src === ri), at = R ? {x:R.x, z:R.z} : {};
    const all = (r.tunnels || []).map(t => ['Tunnel', t]).concat((r.boxes || []).map(b => [b.lock != null ? 'Lock box' : 'Count box', b]));
    all.forEach(([kind, o]) => {
      if (o.col < 0 || o.col + o.w > cols || o.row < 0 || o.row + o.h > r.rows)
        warnings.push(Object.assign({kind:'blocker-bounds', msg:`${label}: ${kind.toLowerCase()} reaches outside the ramp`, ramp:ri}, at));
      for (let c = o.col; c < o.col + o.w; c++){ if (used[c]) warnings.push(Object.assign({kind:'blocker-overlap', msg:`${label}: two blockers in column ${c + 1} (one per column)`, ramp:ri}, at)); used[c] = true; }
    });
    (r.tunnels || []).forEach(t => {
      if (t.row < 1) warnings.push(Object.assign({kind:'tunnel-front', msg:`${label}: a tunnel needs at least one cell in front of it`, ramp:ri}, at));
      if (t.count < 1) warnings.push(Object.assign({kind:'tunnel-count', msg:`${label}: a tunnel needs at least 1 stickman`, ramp:ri}, at));
      for (let c = Math.max(0, t.col); c < Math.min(cols, t.col + t.w); c++) for (let y = t.row; y < Math.min(r.rows, t.row + t.h); y++)
        if (r.columns[c][y]) { warnings.push(Object.assign({kind:'tunnel-cells', msg:`${label}: the tunnel sits on stickmen (its cells must be empty)`, ramp:ri}, at)); return; }
    });
    (r.boxes || []).forEach(b => {
      if (b.lock != null){ if (locks[b.lock]) warnings.push({kind:'lock-dup', msg:`Lock ${b.lock} is used by two boxes`, ramp:ri}); locks[b.lock] = {ramp:ri, keys:0}; }
      else if (b.count < 1 || b.count > buses) warnings.push(Object.assign({kind:'count-range', msg:`${label}: count box needs 1-${buses} completed buses (has ${b.count})`, ramp:ri}, at));
    });
  });
  N.lanes.forEach((l, li) => l.forEach((b, bi) => { if (b.key == null) return;
    if (locks[b.key]) locks[b.key].keys++; else warnings.push({kind:'key-no-lock', msg:`Lane ${li + 1} bus ${bi + 1} carries key ${b.key}, but no box has that lock`}); }));
  Object.keys(locks).forEach(id => { const k = locks[id].keys;
    if (k !== 1) warnings.push({kind:k ? 'lock-keys' : 'lock-no-key', msg:k ? `Lock ${id} has ${k} key buses (needs exactly one)` : `Lock ${id} has no key bus`, ramp:locks[id].ramp}); });
  // connected buses
  linkGroups(N).forEach(G => {
    const n = G.members.length;
    if (n < 2) warnings.push({kind:'link-single', msg:`Link ${G.id} has only one bus`});
    else if (n > 3) warnings.push({kind:'link-size', msg:`Link ${G.id} connects ${n} buses (at most 3)`});
    else if (!G.connected || !G.consecutive) warnings.push({kind:'link-shape', msg:`Link ${G.id}: connected buses must touch (one after another in a lane, or neighbouring lanes at most one row apart)`});
  });
  if (queueDeadlock(N)) warnings.push({kind:'link-deadlock', msg:'Connected buses block each other: the queue can never be emptied'});
  if (!N.ramps.length) warnings.push({kind:'no-ramps', msg:'The level has no ramps'});
  const totalMen = perColor.reduce((a, p) => a + p.men, 0), totalSeats = perColor.reduce((a, p) => a + p.seats, 0);
  return {perColor, totalMen, totalSeats, buses, sizes, hiddenMen:hiddenMen.n, warnings,
          balanced: perColor.every(p => p.ok) && totalMen > 0, ok: perColor.every(p => p.ok) && totalMen > 0 && !warnings.length};
}
function difficulty(rate){
  return rate > 0.45 ? 'Easy' : rate >= 0.15 ? 'Medium' : rate >= 0.05 ? 'Hard' : 'Very Hard';
}
/* the background "Test" run used by the editor (and the game's startup log) */
function testLevel(level, runs){
  runs = runs || 200;
  const gr = simulate(level, greedyPick, null, SIM_DT);
  let wins = 0, fallbacks = gr.keyFallbacks ? 1 : 0;
  for (let r=0;r<runs;r++){ const s = simulate(level, randomPick, mulberry32(1000 + r), SIM_DT); if (s.result === 'win') wins++; if (s.keyFallbacks) fallbacks++; }
  const warnings = [];
  if (fallbacks) warnings.push({kind:'key-fallback', msg:`A key bus filled up before reaching its lock's ramp in ${fallbacks} of ${runs + 1} bot games `
    + `(the key then flies over when its parachute opens - meant to be rare)`});
  return {greedy:{result:gr.result, sends:gr.sends, landed:gr.landed, t:gr.t, moves:gr.moves}, wins, runs,
          rate: wins/runs, label: difficulty(wins/runs), keyFallbackGames: fallbacks, warnings};
}

/* ============================== GENERATOR =========================== */
function generateLevel(seed){
  const rng = mulberry32(seed*7919 + 17);
  const runW = [0.22, 0.36, 0.27, 0.15];
  for (let attempt=0; attempt<2000; attempt++){
    const budget = {}; COLORS.forEach(c => budget[c] = PER_COLOR);
    const ramps = []; let ok = true;
    for (let k=0;k<5 && ok;k++){
      const columns = [], seen = new Set();
      for (let c=0;c<RAMP_COLS && ok;c++){
        const col = []; let prev = null;
        while (col.length < RAMP_ROWS[k]){
          const cand = COLORS.filter(x => x !== prev && budget[x] > 0);
          if (!cand.length){ ok = false; break; }
          const w = cand.map(x => budget[x] * (seen.has(x) ? 1 : 1.8)), tot = w.reduce((a,b)=>a+b,0);
          let r = rng()*tot, ci = 0; while (ci < cand.length-1 && r > w[ci]){ r -= w[ci]; ci++; }
          const color = cand[ci], maxL = Math.min(4, RAMP_ROWS[k]-col.length, budget[color]);
          let wt = 0; for (let L=1;L<=maxL;L++) wt += runW[L-1];
          let q = rng()*wt, L = 1; while (L < maxL && q > runW[L-1]){ q -= runW[L-1]; L++; }
          for (let i=0;i<L;i++) col.push(color);
          budget[color] -= L; prev = color; seen.add(color);
        }
        columns.push(col);
      }
      ramps.push({columns});
    }
    if (!ok || COLORS.some(c => budget[c] !== 0)) continue;
    const buses = []; COLORS.forEach(c => BUS_PLAN[c].forEach(cap => buses.push({color:c, cap})));
    shuffle(buses, rng);
    const lanes = []; let o = 0; LANE_SIZES.forEach(n => { lanes.push(buses.slice(o, o+n)); o += n; });
    const pool = []; lanes.forEach(ln => ln.forEach((b, i) => { if (i >= 2) pool.push(b); }));
    shuffle(pool, rng); pool[0].hidden = true; pool[1].hidden = true;
    const level = {seed, ramps, lanes};
    if (validateLevel(level).ok) return level;
  }
  return null;
}
/* greedy must win (at both the headless and the live step) and random must win 15–45% of 200 runs */
function evaluateLevel(level, runs){
  runs = runs || 200;
  const greedy = simulate(level, greedyPick, null, SIM_DT);
  const res = {greedy, greedyLive:null, randomWins:0, runs:0};
  if (greedy.result !== 'win') return res;
  res.greedyLive = simulate(level, greedyPick, null, 1/60);
  if (res.greedyLive.result !== 'win') return res;
  for (let r=0;r<runs;r++){
    const s = simulate(level, randomPick, mulberry32(1000 + r), SIM_DT);
    res.runs++; if (s.result === 'win') res.randomWins++;
    if (res.randomWins > 0.45*runs) break;
    if (res.randomWins + (runs - res.runs) < 0.15*runs) break;
  }
  return res;
}
function searchSeed(from, to, log){
  for (let seed=from; seed<=to; seed++){
    const level = generateLevel(seed); if (!level) continue;
    const ev = evaluateLevel(level);
    const rate = ev.runs ? ev.randomWins/ev.runs : 0;
    if (log) log(`seed ${seed}: greedy ${ev.greedy.result}` + (ev.runs ? `, random ${ev.randomWins}/${ev.runs}` : ''));
    if (ev.greedy.result === 'win' && ev.greedyLive && ev.greedyLive.result === 'win' && ev.runs === 200 && rate >= 0.15 && rate <= 0.45)
      return {seed, level, ev};
  }
  return null;
}

const DEFAULT_LAYOUT = buildLayout(LEVEL_DATA);
const ROAD = DEFAULT_LAYOUT.ROAD, RAMPS = DEFAULT_LAYOUT.RAMPS, TUNNEL = DEFAULT_LAYOUT.TUNNEL;   // built-in level, for tests
root.MECore = {
  BUS_SPEED, BOARD_RATE, COLUMN_SHIFT_TIME, ROAD_CAPACITY, STATIC_SLOTS, PARACHUTE_DURATION,
  rampOutline, polyDist, inPoly, polysOverlap,
  RETURN_TUNNEL_TIME, WIN_PANEL_DELAY, RUN_TIME, BOT_THINK, SIM_DT, RAMP_SP, RAMP_APRON_MAX, MAN_W, MAN_SCALE_MAX, SEAT_SCALE_MAX, autoManScale, GAP_LEN, GAP_EASE, GAP_BOOST, GAP_RUNUP, gapVmax, gapHold, LANE_GAP, CAM, SCREEN, SCREEN_CAM, DISP, BUS_DRAW, drawnBay, dispZ, dispSx, dispSlope, dispScale, dispPoint, dispDir, inTarget, ORTHO_CAM, ORTHO_M, setView, viewCam, orthoRowZ,
  get VIEW(){ return VIEW; }, MIN_TURN_R,
  LEVEL_DATA, PRESETS, RAMP_TILT, COLORS, HEX, BUS_PLAN, RAMP_ROWS, BUS_W, ROW_PITCH, ROAD_HALF, busLen,
  Z_ENTRY, Z_ROAD0, BAY_X, Z_BAY_TOP, Z_BAY_BOT, Z_COLL, Z_LANE_TOP, LANE_X, LANE_MIN, LANE_MAX, laneXs, X_SIDE, TUNNEL_X, TUNNEL, TUNNEL_L, TUNNEL_R, YARDS, YARD,
  parkZ, laneSlotZ, ROAD, RAMPS, seatLocal, pathAt, makePath, catmullRom, project,
  routeToRoad, routeBayToRoad, routeLaneToBay, routeReturn,
  normalizeLevel, buildLayout, buildRamp, parseCell, cellStr, checkLevel, difficulty, testLevel,
  createGame, step, tapLane, tapBay, canRoad, freeBay, frontColors, legalSends,
  greedyPick, randomPick, applyAction, simulate, lapBoarders, groupReady, linkGroups, queueDeadlock, rampEmpty, KEY_FALLBACK_DELAY, validateLevel, generateLevel, evaluateLevel, searchSeed, mulberry32
};
root.MECoreFactory = factory;
})(typeof window !== 'undefined' ? window : globalThis);
