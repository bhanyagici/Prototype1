/* Match Express — shared core: rules, level format, layout builder, validation, bots, generator.
   Plain script with no DOM or three.js dependency: the game page, the editor, Web Workers and the
   Node tests all run exactly this code.  Loaded with <script src="shared/core.js">. */
(function factory(root) {
'use strict';

/* ============================== TUNING ============================== */
const BUS_SPEED          = 3.4;   // main-road cruise speed (world units / s)
const BOARD_RATE         = 8;     // stickmen leaving a front row per second (chains speed up)
const COLUMN_SHIFT_TIME  = 0.22;  // seconds for a column to step forward one place
const ROAD_CAPACITY      = 5;     // buses on + heading to + returning from the main road
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
    // control points from the entry road up to the top tunnel (the last point is the tunnel mouth).
    // "spiral" turns the next stretch into a loop that crosses over itself; "tail" is the point
    // inside the tunnel (optional, otherwise 2.1 units along the last tangent).
    "points": [
      {"x": 0, "z": -1.3, "y": 0}, {"x": 0, "z": -2, "y": 0}, {"x": 0, "z": -3.05, "y": 0.05},
      {"x": 0, "z": -4.1, "y": 0.1}, {"x": 0, "z": -5.15, "y": 0.15}, {"x": 0, "z": -6.2, "y": 0.2},
      {"x": 0, "z": -8, "y": 0.3, "spiral": {"r": 1, "side": -1, "yCross": 1.55}},
      {"x": 0.6, "z": -7.44, "y": 1.58}, {"x": 1.41, "z": -7.39, "y": 1.61}, {"x": 2.07, "z": -7.88, "y": 1.64},
      {"x": 2.27, "z": -9.14, "y": 1.65}, {"x": 1.8, "z": -10.04, "y": 1.67}
    ]
  },
  "ramps": [
    {"cp": 1, "side": -1, "shape": [[-2.74, -2.27], [-5.11, -2.61]], "columns": [   // ramp 1 (bottom left), front -> back
      ["red", "red", "orange", "orange", "pink", "pink", "green", "green", "yellow", "purple"],
      ["purple", "purple", "cyan", "cyan", "cyan", "blue", "blue", "purple", "blue", "blue"],
      ["red", "red", "pink", "pink", "pink", "orange", "orange", "red", "red", "red"],
      ["orange", "orange", "orange", "orange", "green", "green", "green", "orange", "orange", "yellow"]
    ]},
    {"cp": 2, "side": 1, "shape": [[2.58, -3.3], [4.76, -3.61]], "columns": [   // ramp 2 (lower right), front -> back
      ["pink", "pink", "pink", "pink", "red", "red", "purple", "red", "red"],
      ["red", "red", "green", "green", "yellow", "yellow", "purple", "purple", "purple"],
      ["orange", "blue", "blue", "blue", "cyan", "cyan", "yellow", "yellow", "green"],
      ["green", "orange", "orange", "pink", "pink", "pink", "green", "red", "red"]
    ]},
    {"cp": 3, "side": -1, "shape": [[-2.74, -4.37], [-5.11, -4.71]], "columns": [   // ramp 3 (middle left), front -> back
      ["green", "green", "yellow", "yellow", "purple", "purple", "yellow", "green", "green", "blue"],
      ["orange", "orange", "orange", "orange", "purple", "purple", "yellow", "green", "green", "orange"],
      ["yellow", "yellow", "cyan", "red", "red", "purple", "orange", "orange", "orange", "cyan"],
      ["purple", "purple", "pink", "pink", "pink", "cyan", "cyan", "cyan", "purple", "yellow"]
    ]},
    {"cp": 4, "side": 1, "shape": [[2.58, -5.4], [4.76, -5.71]], "columns": [   // ramp 4 (upper right), front -> back
      ["yellow", "pink", "pink", "pink", "pink", "yellow", "yellow", "yellow", "cyan"],
      ["pink", "pink", "pink", "pink", "yellow", "yellow", "red", "red", "cyan"],
      ["cyan", "cyan", "cyan", "blue", "green", "yellow", "yellow", "yellow", "yellow"],
      ["green", "red", "red", "red", "red", "purple", "purple", "orange", "orange"]
    ]},
    {"cp": 5, "side": -1, "shape": [[-2.74, -6.47], [-5.11, -6.81]], "columns": [   // ramp 5 (top left), front -> back
      ["purple", "purple", "blue", "cyan", "cyan", "cyan", "cyan", "blue", "yellow", "green"],
      ["green", "green", "green", "blue", "red", "orange", "purple", "purple", "blue", "blue"],
      ["blue", "green", "cyan", "cyan", "purple", "purple", "blue", "cyan", "cyan", "blue"],
      ["pink", "blue", "blue", "blue", "green", "blue", "cyan", "blue", "blue", "blue"]
    ]}
  ],
  "lanes": [
    [   // lane 1, front first
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
    [   // lane 2, front first
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
    [   // lane 3, front first
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
      {
        "cp": 2,
        "side": 1,
        "tilt": 35,
        "rows": 15,
        "columns": [
          ["cyan", "cyan", "blue", "blue", "orange", "orange", "orange", "red", "red", "blue", "blue", "blue", "cyan", "cyan", "cyan"],
          ["green", "orange", "orange", "orange", "green", "red", "red", "yellow", "yellow", "pink", "pink", "pink", "green", "red", "red"],
          ["purple", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "purple", "purple", "purple", "orange", "orange", "orange", "yellow"],
          ["yellow", "pink", "pink", "green", "pink", "cyan", "yellow", "yellow", "purple", "purple", "cyan", "cyan", "cyan", "purple", "purple"],
          ["orange", "orange", "blue", "cyan", "cyan", "blue", "blue", "blue", "green", "green", "green", "purple", "pink", "pink", "red"],
          ["red", "pink", "pink", "pink", "red", "red", "blue", "blue", "green", "green", "green", "yellow", "yellow", "yellow", "green"]
        ]
      },
      {
        "cp": 4,
        "side": -1,
        "tilt": 35,
        "rows": 15,
        "columns": [
          ["green", "green", "red", "red", "red", "green", "green", "orange", "orange", "orange", "green", "green", "green", "purple", "red"],
          ["red", "red", "purple", "pink", "pink", "purple", "purple", "blue", "cyan", "cyan", "red", "red", "blue", "blue", "blue"],
          ["orange", "orange", "orange", "purple", "purple", "purple", "yellow", "yellow", "green", "green", "purple", "orange", "orange", "orange", "yellow"],
          ["yellow", "red", "pink", "red", "red", "red", "blue", "blue", "blue", "orange", "yellow", "yellow", "pink", "pink", "pink"],
          ["purple", "purple", "purple", "cyan", "cyan", "cyan", "blue", "blue", "blue", "yellow", "yellow", "cyan", "cyan", "cyan", "blue"],
          ["pink", "pink", "yellow", "yellow", "yellow", "green", "green", "green", "pink", "pink", "pink", "cyan", "cyan", "cyan", "orange"]
        ]
      },
      {
        "cp": 10,
        "side": 1,
        "tilt": 35,
        "rows": 15,
        "columns": [
          ["yellow", "yellow", "pink", "pink", "cyan", "yellow", "yellow", "cyan", "cyan", "red", "cyan", "cyan", "yellow", "yellow", "yellow"],
          ["green", "green", "blue", "blue", "pink", "yellow", "cyan", "cyan", "green", "green", "red", "green", "green", "cyan", "purple"],
          ["purple", "cyan", "red", "red", "red", "purple", "purple", "purple", "green", "green", "blue", "blue", "blue", "orange", "orange"],
          ["purple", "purple", "red", "red", "red", "orange", "orange", "orange", "pink", "pink", "yellow", "red", "red", "orange", "orange"],
          ["cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "purple", "purple", "orange", "orange", "green", "green", "pink", "pink"],
          ["red", "purple", "purple", "blue", "blue", "blue", "green", "green", "pink", "blue", "blue", "blue", "orange", "orange", "blue"]
        ]
      },
      {
        "cp": 12,
        "side": -1,
        "tilt": 35,
        "rows": 15,
        "columns": [
          ["red", "red", "blue", "blue", "cyan", "cyan", "orange", "orange", "orange", "blue", "purple", "yellow", "yellow", "yellow", "pink"],
          ["pink", "yellow", "orange", "orange", "red", "blue", "blue", "blue", "green", "green", "green", "purple", "purple", "blue", "blue"],
          ["blue", "green", "green", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "red", "purple", "purple", "pink", "pink"],
          ["purple", "cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "green", "green", "green", "cyan", "cyan", "cyan", "orange"],
          ["orange", "orange", "red", "red", "orange", "orange", "orange", "purple", "purple", "purple", "pink", "pink", "pink", "cyan", "cyan"],
          ["cyan", "yellow", "yellow", "yellow", "red", "red", "cyan", "red", "blue", "blue", "blue", "green", "green", "green", "pink"]
        ]
      }
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
      {
        "at": 1.856,
        "side": 1,
        "tilt": 35,
        "shape": [[4.55, -4.81], [5.84, -7.11]],
        "rows": 15,
        "columns": [
          ["cyan", "cyan", "blue", "blue", "orange", "orange", "orange", "red", "red", "blue", "blue", "blue", "cyan", "cyan", "cyan"],
          ["green", "orange", "orange", "orange", "green", "red", "red", "yellow", "yellow", "pink", "pink", "pink", "green", "red", "red"],
          ["purple", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "purple", "purple", "purple", "orange", "orange", "orange", "yellow"],
          ["yellow", "pink", "pink", "green", "pink", "cyan", "yellow", "yellow", "purple", "purple", "cyan", "cyan", "cyan", "purple", "purple"],
          ["orange", "orange", "blue", "cyan", "cyan", "blue", "blue", "blue", "green", "green", "green", "purple", "pink", "pink", "red"],
          ["red", "pink", "pink", "pink", "red", "red", "blue", "blue", "green", "green", "green", "yellow", "yellow", "yellow", "green"]
        ]
      },
      {
        "at": 3.9248845776089056,
        "side": -1,
        "tilt": 35,
        "shape": [[-3.7, -6.72], [-5.71, -9.51]],
        "rows": 15,
        "columns": [
          ["green", "green", "red", "red", "red", "green", "green", "orange", "orange", "orange", "green", "green", "green", "purple", "red"],
          ["red", "red", "purple", "pink", "pink", "purple", "purple", "blue", "cyan", "cyan", "red", "red", "blue", "blue", "blue"],
          ["orange", "orange", "orange", "purple", "purple", "purple", "yellow", "yellow", "green", "green", "purple", "orange", "orange", "orange", "yellow"],
          ["yellow", "red", "pink", "red", "red", "red", "blue", "blue", "blue", "orange", "yellow", "yellow", "pink", "pink", "pink"],
          ["purple", "purple", "purple", "cyan", "cyan", "cyan", "blue", "blue", "blue", "yellow", "yellow", "cyan", "cyan", "cyan", "blue"],
          ["pink", "pink", "yellow", "yellow", "yellow", "green", "green", "green", "pink", "pink", "pink", "cyan", "cyan", "cyan", "orange"]
        ]
      },
      {
        "at": 19.332386640671782,
        "side": 1,
        "tilt": 35,
        "shape": [[4.67, -11.11], [6.26, -13.81]],
        "rows": 15,
        "columns": [
          ["yellow", "yellow", "pink", "pink", "cyan", "yellow", "yellow", "cyan", "cyan", "red", "cyan", "cyan", "yellow", "yellow", "yellow"],
          ["green", "green", "blue", "blue", "pink", "yellow", "cyan", "cyan", "green", "green", "red", "green", "green", "cyan", "purple"],
          ["purple", "cyan", "red", "red", "red", "purple", "purple", "purple", "green", "green", "blue", "blue", "blue", "orange", "orange"],
          ["purple", "purple", "red", "red", "red", "orange", "orange", "orange", "pink", "pink", "yellow", "red", "red", "orange", "orange"],
          ["cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "purple", "purple", "orange", "orange", "green", "green", "pink", "pink"],
          ["red", "purple", "purple", "blue", "blue", "blue", "green", "green", "pink", "blue", "blue", "blue", "orange", "orange", "blue"]
        ]
      },
      {
        "at": 21.210127635680642,
        "side": -1,
        "tilt": 35,
        "shape": [[-3.77, -13.6], [-6.24, -16.16]],
        "rows": 15,
        "columns": [
          ["red", "red", "blue", "blue", "cyan", "cyan", "orange", "orange", "orange", "blue", "purple", "yellow", "yellow", "yellow", "pink"],
          ["pink", "yellow", "orange", "orange", "red", "blue", "blue", "blue", "green", "green", "green", "purple", "purple", "blue", "blue"],
          ["blue", "green", "green", "purple", "purple", "yellow", "yellow", "yellow", "red", "red", "red", "purple", "purple", "pink", "pink"],
          ["purple", "cyan", "cyan", "pink", "pink", "pink", "yellow", "yellow", "green", "green", "green", "cyan", "cyan", "cyan", "orange"],
          ["orange", "orange", "red", "red", "orange", "orange", "orange", "purple", "purple", "purple", "pink", "pink", "pink", "cyan", "cyan"],
          ["cyan", "yellow", "yellow", "yellow", "red", "red", "cyan", "red", "blue", "blue", "blue", "green", "green", "green", "pink"]
        ]
      }
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
  compact: {name:'compact', BAY_X:[-2.72,-1.36,0,1.36,2.72], LANE_X:[-1.64,0,1.64], X_SIDE:3.8, TUNNEL_X:4.85, RAMP_DROP:0.85},
  classic: {name:'classic', BAY_X:[-2.72,-1.36,0,1.36,2.72], LANE_X:[-1.72,0,1.72], X_SIDE:4.32, TUNNEL_X:5.45, RAMP_DROP:0}
};
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
   (bays) and QUEUE.  One camera for every level: the largest bundled level (Crowded Rush Curve)
   fills the target zone with stickmen about 17 px tall. */
const SCREEN = {w:900, h:1950, BAR:0.07, TARGET_TOP:0.07, TARGET_BOT:0.61, STATIC_BOT:0.77, MARGIN:12*900/390};
const SCREEN_CAM = {fov:30, pos:[0, 41.769, 28.354], look:[0, 0, -4.28], w:SCREEN.w, h:SCREEN.h};
/* The yard and queue are DRAWN smaller than the simulation lays them out (the simulation is untouched):
   a sim point (x, z) is shown at (x*dispSx(z), dispZ(z)) and a bus there at dispScale(z).
   - main road above the yard: unchanged; it eases into the yard scale over its last stretch;
   - yard (entry road, bays, collector road): uniformly K = 0.8;
   - collector road -> queue: the margin is squeezed (no curb strip);
   - queue: the front slot at full size, the buses behind at QS = 0.85 with tighter gaps. */
const DISP = {K:0.8, QS:0.85, QZ:0.8, MARGIN:0.3, zA:Z_ROAD0, zB:-0.7, zC:Z_COLL + 0.55, zL:Z_LANE_TOP + 0.12, qA:1.4, qB:2.0, pA:2.4, pB:3.0};
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
function dispSlope(z){                              // d(shown z)/d(sim z)
  const D = DISP;
  if (z <= D.zA) return 1;
  if (z < D.zB) return 1 + (D.K - 1)*smooth01(D.zA, D.zB, z);
  if (z <= D.zC) return D.K;
  if (z < D.zL) return D.MARGIN;
  return 1 + (D.QZ - 1)*smooth01(D.pA, D.pB, z - D.zL);
}
const DISP_STEP = 0.005, DISP_TAB = (() => { const t = [DISP.zA], n = Math.ceil((60 - DISP.zA)/DISP_STEP);
  for (let i = 0; i < n; i++) t.push(t[i] + dispSlope(DISP.zA + (i + 0.5)*DISP_STEP)*DISP_STEP); return t; })();
function dispZ(z){
  if (z <= DISP.zA) return z;
  const f = (z - DISP.zA)/DISP_STEP, i = Math.floor(f);
  if (i >= DISP_TAB.length - 1) return DISP_TAB[DISP_TAB.length - 1] + (z - DISP.zA - (DISP_TAB.length - 1)*DISP_STEP)*DISP.QZ;
  return DISP_TAB[i] + (DISP_TAB[i+1] - DISP_TAB[i])*(f - i);
}
function dispSx(z){ return z <= DISP.zA ? 1 : 1 + (DISP.K - 1)*smooth01(DISP.zA, DISP.zB, z); }
function dispScale(z){                              // size a bus (or anything) is drawn at
  const D = DISP;
  if (z <= D.zB) return dispSx(z);
  if (z <= D.zC) return D.K;
  if (z < D.zL) return D.K + (1 - D.K)*smooth01(D.zC, D.zL, z);
  return 1 + (D.QS - 1)*smooth01(D.qA, D.qB, z - D.zL);
}
function dispPoint(x, z){ return [x*dispSx(z), dispZ(z)]; }
function dispDir(dx, dz, z){ const a = dx*dispSx(z), b = dz*dispSlope(z), l = Math.hypot(a, b) || 1; return [a/l, b/l]; }

const RAMP_SP = 0.36;                               // stickman spacing along and across a ramp

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
const DEFAULT_RAMP_PLACE = LEVEL_DATA.ramps.map(r => r.shape ? {cp:r.cp, side:r.side, shape:r.shape} : {cp:r.cp, side:r.side});
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
  const out = {format:2, name: lv.name || 'Untitled level', seed: lv.seed, road, ramps:[], lanes:[]};
  if (lv.yard === 'classic') out.yard = 'classic';     // omitted = the default compact yard
  lv.ramps.forEach((r, k) => {
    const cols = (r.columns || []).map(col => (col || []).map(c => cellStr(parseCell(c))));
    if (!cols.length) return;
    const rows = Math.max(1, r.rows || 0, ...cols.map(c => c.length));
    cols.forEach(c => { while (c.length < rows) c.push(null); });
    const place = (r.at != null || r.cp != null) ? {} : (DEFAULT_RAMP_PLACE[k] || {at: null});
    const nr = {side: r.side || place.side || (k % 2 ? -1 : 1), rows, columns: cols};
    if (r.at != null) nr.at = +r.at; else if (r.cp != null) nr.cp = r.cp | 0; else if (place.cp != null) nr.cp = place.cp; else nr.at = null;
    if (r.tilt != null && isFinite(+r.tilt)) nr.tilt = +r.tilt;
    const shp = Array.isArray(r.shape) && r.shape.length ? r.shape : place.shape;
    if (shp) nr.shape = shp.map(p => [+p[0], +p[1]]);
    out.ramps.push(nr);
  });
  for (let l=0;l<3;l++) out.lanes.push(((lv.lanes[l]) || []).filter(b => b && COLORS.includes(b.color) && [4,6,8,12].includes(+b.cap))
    .map(b => { const o = {color:b.color, cap:+b.cap}; if (b.hidden) o.hidden = true; if (b.link != null && b.link !== '') o.link = String(b.link); return o; }));
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
  const {pts: dense, cpIdx} = catmullRom(cps, 28), path = makePath(dense);
  path.cpS = cpIdx.map(i => path.cum[i]);
  path.pointS = map.map(m => path.cpS[m]);          // arc length at each editable control point
  path.portalS = path.pointS[pts.length - 1];
  path.end = path.len - 0.6;                        // centre this far in = fully inside the tunnel
  path.spirals = spirals.map(sp => Object.assign(sp, {s0: path.cpS[sp.cpFrom], s1: path.cpS[sp.cpTo]}));
  path.cps = cps;
  return path;
}
function buildRamp(ROAD, rd, src, Y){
  let s = rd.at != null ? rd.at : rd.cp != null ? ROAD.pointS[clamp(rd.cp, 0, ROAD.pointS.length-1)] : ROAD.portalS*(0.2 + 0.15*src);
  s = clamp(s, 0.6, ROAD.portalS - 0.6);
  const p = {}; pathAt(ROAD, s, p, 0); const side = rd.side || 1;
  const nx = -p.dz*side, nz = p.dx*side;           // outward horizontal normal
  const rows = rd.rows, cols = rd.columns.length, length = 0.34 + (rows-1)*RAMP_SP + 0.42, halfW = cols*RAMP_SP/2 + 0.16;
  // a tilted ramp points at a fixed screen angle: outward (to its side of the screen) and up by `tilt` degrees,
  // pushed out so its lower corner just meets the road edge
  const tilt = rd.tilt != null ? rd.tilt*Math.PI/180 : null, wx = nx >= 0 ? 1 : -1;
  const tdx = tilt != null ? wx*Math.cos(tilt) : 0, tdz = tilt != null ? -Math.sin(tilt) : 0;
  const off = ROAD_HALF + 0.06 + (tilt != null ? halfW*Math.abs(tdx*nz - tdz*nx) : 0);
  const ax = p.x + nx*off, az = p.z + nz*off, y = p.y - ((Y || YARD).RAMP_DROP || 0);
  const c = [[ax,y,az]];
  if (rd.shape && rd.shape.length) rd.shape.forEach(q => c.push([q[0], y, q[1]]));
  else if (tilt != null)                            // straight platform
    c.push([ax + tdx*length*0.5, y, az + tdz*length*0.5], [ax + tdx*(length + 0.45), y, az + tdz*(length + 0.45)]);
  else {                                            // default shape: leave the road square-on, bend toward "up"
    const dir = a => [side*Math.cos(a), -Math.sin(a)];
    const a0 = Math.atan2(-nz, nx*side), a1 = 0.86;
    for (const [a,l] of [[a0,1.3],[(a0+a1)/2,1.3],[a1,2.0]]){ const q=c[c.length-1], v=dir(a); c.push([q[0]+v[0]*l, y, q[2]+v[1]*l]); }
  }
  let spl = makePath(catmullRom(c, 24).pts);
  if (spl.len < length + 0.3){                      // stretch the last point so every row fits
    const q = c[c.length-1], w = c[c.length-2], l = Math.hypot(q[0]-w[0], q[2]-w[2]) || 1, ext = length + 0.4 - spl.len;
    c[c.length-1] = [q[0] + (q[0]-w[0])/l*ext, y, q[2] + (q[2]-w[2])/l*ext]; spl = makePath(catmullRom(c, 24).pts);
  }
  const slots = [];
  for (let col=0; col<cols; col++){
    const colSlots = [];
    for (let r=0; r<rows; r++){
      const o = {}; pathAt(spl, 0.34 + r*RAMP_SP, o, 0);
      const lat = (col - (cols-1)/2)*RAMP_SP;       // left normal of the ramp heading
      colSlots.push({x:o.x + o.dz*lat, y, z:o.z - o.dx*lat, fx:-o.dx, fz:-o.dz});
    }
    slots.push(colSlots);
  }
  const colOrder = slots.map((_, i) => i).sort((a,b) =>
    Math.hypot(slots[a][0].x-p.x, slots[a][0].z-p.z) - Math.hypot(slots[b][0].x-p.x, slots[b][0].z-p.z));
  return {src, s, side, x:p.x, y, z:p.z, spline:spl, ctrl:c.map(q => [q[0], q[2]]), length,
          rows, cols, halfW, slots, colOrder};
}
function pillarSpots(ROAD){
  const o = {}, out = [], P = ROAD.P;
  for (let s = 1.6; s < ROAD.portalS - 0.8; s += 2.25){
    pathAt(ROAD, s, o, 0);
    let blocked = false;                            // never through a lower part of the road (spiral overpass)
    for (let i=0;i<ROAD.n;i+=2) if (Math.abs(ROAD.cum[i] - s) > 3 && P[i*3+1] < o.y - 0.4 && Math.hypot(P[i*3]-o.x, P[i*3+2]-o.z) < 1.05){ blocked = true; break; }
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
  const ROAD = buildRoad(N.road), Y = YARDS[N.yard] || YARD;
  const RAMPS = N.ramps.map((r, i) => buildRamp(ROAD, r, i, Y)).sort((a, b) => a.s - b.s || a.src - b.src);
  RAMPS.forEach((r, k) => r.k = k);
  const ex = {}; pathAt(ROAD, ROAD.portalS, ex, 0);
  const dR = Math.hypot(ex.x - Y.TUNNEL_R.x, ex.z - Y.TUNNEL_R.z), dL = Math.hypot(ex.x - Y.TUNNEL_L.x, ex.z - Y.TUNNEL_L.z);
  const L = {ROAD, RAMPS, Y, TUNNEL: dL < dR - 1e-9 ? Y.TUNNEL_L : Y.TUNNEL_R, exit:{x:ex.x, y:ex.y, z:ex.z, dx:ex.dx, dz:ex.dz},
             pillars: pillarSpots(ROAD), level:N};
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
function createGame(level, opts){
  opts = opts || {};
  const N = normalizeLevel(level), L = buildLayout(N);
  const g = {t:0, emit:!opts.headless, events:[], result:null, resultT:0, L, level:N,
    men:[], buses:[], ramps:[], lanes:[[],[],[]], laneLeft:[-1,-1,-1],
    bays:new Array(STATIC_SLOTS).fill(-1), bayRes:new Array(STATIC_SLOTS).fill(-1),
    road:[], trips:[], tunnel:[], running:[], counter:0, toRoad:0, landed:0,
    sends:0, moves:[], tripSeq:0, sideUse:[0,0]};
  L.RAMPS.forEach((R, k) => {                       // ramps in boarding order along the road
    const ramp = {k, cols:[], empty:false};
    N.ramps[R.src].columns.forEach((col, c) => { const ids = [];
      col.forEach(cell => { const m = parseCell(cell); if (!m) return;   // empty cells: people stand from the front
        const id = g.men.length;
        g.men.push({id, color:m.color, hidden:m.hidden, revealed:!m.hidden || !ids.length, ramp:k, col:c, state:'ramp', bus:-1, seat:-1, tLand:0});
        ids.push(id); });
      ramp.cols.push(ids); });
    ramp.empty = ramp.cols.every(x => !x.length);
    g.ramps.push(ramp);
  });
  N.lanes.forEach((lane, l) => {
    let z = Z_LANE_TOP + 0.12;
    lane.forEach((d, i) => {
      const len = busLen(d.cap);
      const b = {id:g.buses.length, color:d.color, cap:d.cap, hidden:!!d.hidden, revealed:!d.hidden || i===0, link:d.link,
        len, state:'lane', lane:l, bay:-1, x:L.Y.LANE_X[l], y:0, z:z+len/2, dx:0, dz:-1, slope:0, v:0,
        rs:0, seg:0, nextRamp:0, seated:0, transit:0, trip:null, board:null, side:1, tJump:0, tExit:0};
      z += len + LANE_GAP;
      g.buses.push(b); g.lanes[l].push(b.id);
    });
  });
  return g;
}
const emit = (g, type, data) => { if (g.emit) g.events.push(Object.assign({type, t:g.t}, data)); };
const canRoad = g => g.counter + g.toRoad < ROAD_CAPACITY;
function freeBay(g){ for (let k=0;k<STATIC_SLOTS;k++) if (g.bays[k] < 0 && g.bayRes[k] < 0) return k; return -1; }
function frontColors(g){ const n = {}; COLORS.forEach(c => n[c]=0);
  for (const r of g.ramps) for (const col of r.cols) if (col.length) n[g.men[col[0]].color]++; return n; }
function frontMatch(g, k, color){
  for (const col of g.ramps[k].cols) if (col.length && g.men[col[0]].color === color) return true;
  return false;
}

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
    const side = idx === 0 ? -1 : idx === 2 ? 1 : (g.sideUse[1] < g.sideUse[0] ? 1 : -1);
    b.side = side; g.sideUse[side > 0 ? 1 : 0]++;
    path = routeToRoad(b.x, b.z, side, g.L.Y);
  } else path = routeBayToRoad(b.x, b.z);
  b.state = 'toRoad'; g.toRoad++; g.sends++;
  startTrip(g, b, 'toRoad', path);
  g.moves.push((from === 'lane' ? 'L' : 'B') + idx + ':' + b.color + b.cap + '>road');
  emit(g, 'send', {bus:b.id, from, idx, dest:'road'});
}
function afterLaneShift(g, l, departed){
  g.laneLeft[l] = departed;
  const nb = g.lanes[l][0];
  if (nb !== undefined && !g.buses[nb].revealed){ g.buses[nb].revealed = true; emit(g, 'reveal', {bus:nb}); }
}
/* Linked buses leave the queue together: tapping one sends all of them, and only when every
   linked bus is at the front of its lane and each of them has somewhere to go (road or bay).
   Levels without links behave exactly as before. */
function linkGroup(g, b){
  if (b.link == null) return null;
  return g.buses.filter(o => o.link === b.link && (o.state === 'lane' || o === b));
}
function linkedReady(g, group){
  if (!group.every(o => o.state === 'lane' && g.lanes[o.lane][0] === o.id)) return false;
  let road = ROAD_CAPACITY - g.counter - g.toRoad, bays = 0;
  for (let k=0;k<STATIC_SLOTS;k++) if (g.bays[k] < 0 && g.bayRes[k] < 0) bays++;
  return group.length <= road + bays;
}
function tapLane(g, l){
  if (g.result) return 'over';
  const lane = g.lanes[l]; if (!lane.length) return 'empty';
  const b = g.buses[lane[0]];
  const group = linkGroup(g, b);
  if (group && group.length > 1){
    if (!linkedReady(g, group)){ emit(g, 'refuse', {bus:b.id, lane:l, linked:true}); return 'refused'; }
    const order = [b, ...group.filter(o => o !== b)];
    order.forEach(o => { o.linkSent = true; });
    const res = order.map(o => tapSingle(g, o.lane));
    return res[0];
  }
  return tapSingle(g, l);
}
function tapSingle(g, l){
  const lane = g.lanes[l], b = g.buses[lane[0]];
  if (canRoad(g)){ lane.shift(); sendToRoad(g, b, 'lane', l); afterLaneShift(g, l, b.id); return 'road'; }
  const k = freeBay(g);
  if (k >= 0){
    lane.shift(); g.bayRes[k] = b.id; b.bay = k; b.state = 'toBay'; g.sends++;
    startTrip(g, b, 'toBay', routeLaneToBay(b.x, b.z, k, b.len, g.L.Y));
    g.moves.push('L' + l + ':' + b.color + b.cap + '>bay' + k);
    emit(g, 'send', {bus:b.id, from:'lane', idx:l, dest:'bay', bay:k});
    afterLaneShift(g, l, b.id); return 'bay';
  }
  emit(g, 'refuse', {bus:b.id, lane:l}); return 'refused';
}
function tapBay(g, k){
  if (g.result) return 'over';
  const id = g.bays[k]; if (id < 0) return 'none';
  const b = g.buses[id];
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
  for (let l=0;l<3;l++){
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
    for (let j=g.road.length-1;j>=0;j--){ const r = g.road[j]; if (r.rs > 5) break; room = Math.min(room, clearAhead(b, r)); }
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
          b.state = 'road'; b.rs = 0; b.seg = 0; b.nextRamp = 0; g.toRoad--; g.counter++;
          g.road.push(b); placeOnRoad(g, b);
          emit(g, 'merge', {bus:b.id});
        } else b.v = 0;
      } else {
        T.splice(i, 1); i--; b.trip = null; b.v = 0;
        const k = b.bay; g.bays[k] = b.id; g.bayRes[k] = -1;
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
    const c = B.queue.shift(), id = ramp.cols[c].shift(), m = g.men[id], nf = ramp.cols[c][0];
    if (nf !== undefined && !g.men[nf].revealed){ g.men[nf].revealed = true; emit(g, 'revealMan', {man:nf}); }
    m.state = 'run'; m.bus = b.id; m.seat = b.seated + b.transit; m.tLand = g.t + RUN_TIME;
    b.transit++; g.running.push(id);
    emit(g, 'board', {man:id, bus:b.id, ramp:B.k, col:c, seat:m.seat, chain:B.chain});
    B.chain++; B.next += boardInterval(B.chain);
    if (!ramp.empty && ramp.cols.every(x => !x.length)){ ramp.empty = true; emit(g, 'rampEmpty', {ramp:B.k}); }
    if (!B.queue.length) B.roundAt = g.t + COLUMN_SHIFT_TIME;
  }
  if (!B.queue.length && !B.done && g.t >= B.roundAt - 1e-9) startRound(g, b);
  if (B.done && b.transit === 0){
    b.board = null;
    if (b.seated >= b.cap){ jump(g, b); return; }
    b.nextRamp = B.k + 1;
    emit(g, 'depart', {bus:b.id});
  }
}
function jump(g, b){
  g.road.splice(g.road.indexOf(b), 1);
  b.state = 'jump'; b.v = 0; g.counter--; b.tJump = g.t; b.side = b.x >= 0 ? 1 : -1;
  emit(g, 'jump', {bus:b.id, side:b.side});
  if (g.landed === g.men.length){ g.result = 'win'; g.resultT = g.t; emit(g, 'win', {bus:b.id}); }
}
function stepRoad(g, dt){
  const R = g.road;
  for (let i=0;i<R.length;i++){
    const b = R[i];
    if (b.board){
      stepBoarding(g, b);
      if (b.state !== 'road'){ i--; continue; }
      if (b.board){ b.v = 0; continue; }
    }
    const lead = i > 0 ? R[i-1] : null;
    const sLimit = lead ? lead.rs - lead.len/2 - b.len/2 - ROAD_GAP : Infinity;
    const RAMPS = g.L.RAMPS, k = b.nextRamp, bk = k < RAMPS.length ? RAMPS[k].s : Infinity;
    let stopS = Infinity;
    if (bk - b.rs < 4 && bk >= b.rs - 1e-6 && frontMatch(g, k, b.color)) stopS = bk;
    let vt = Math.min(BUS_SPEED, Math.sqrt(2*SOFT_BRAKE*Math.max(0, stopS - b.rs)),
                      Math.sqrt(2*HARD_BRAKE*Math.max(0, sLimit - b.rs)));
    b.v = vt > b.v ? Math.min(vt, b.v + ACCEL*dt) : vt;
    let ns = Math.min(b.rs + b.v*dt, Math.max(b.rs, sLimit), stopS);
    if (ns >= bk - 1e-6 && b.rs <= bk + 1e-6){         // reached a boarding point: check the front row
      if (frontMatch(g, k, b.color)){
        b.rs = bk; b.v = 0; placeOnRoad(g, b);
        b.board = {k, queue:[], next:g.t, roundAt:g.t, chain:0, done:false};
        emit(g, 'boardStart', {bus:b.id, ramp:k});
        startRound(g, b);
        continue;
      }
      b.nextRamp++;
    }
    b.rs = ns;
    if (b.rs >= g.L.ROAD.end){
      R.splice(i, 1); i--;
      b.state = 'tunnel'; b.tExit = g.t + RETURN_TUNNEL_TIME; g.tunnel.push(b);
      emit(g, 'tunnelIn', {bus:b.id});
      continue;
    }
    placeOnRoad(g, b);
  }
}
function stepTunnel(g){
  while (g.tunnel.length && g.t >= g.tunnel[0].tExit - 1e-9){
    const lr = g.lastReturn;                     // give the previous returning bus room to clear the mouth
    if (lr && lr.trip && lr.trip.s < lr.len/2 + g.tunnel[0].len/2 + 0.4) return;
    const b = g.tunnel.shift(), k = freeBay(g);
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
  stepLanes(g, dt);
  stepTrips(g, dt);
  stepLandings(g);
  stepRoad(g, dt);
  stepTunnel(g);
}

/* ================================ BOTS =============================== */
/* Both bots tap only when the bus would go to the main road (road check passes).
   Greedy: the available bus whose colour has the most stickmen in the ramps' front rows.
   Random: a uniformly random available bus. */
function legalSends(g){
  if (!canRoad(g)) return [];
  const a = [];
  for (let k=0;k<STATIC_SLOTS;k++) if (g.bays[k] >= 0) a.push({kind:'bay', idx:k, bus:g.bays[k]});
  for (let l=0;l<3;l++) if (g.lanes[l].length){
    const b = g.buses[g.lanes[l][0]], grp = linkGroup(g, b);
    if (grp && grp.length > 1 && !(linkedReady(g, grp) && grp.length <= ROAD_CAPACITY - g.counter - g.toRoad)) continue;
    a.push({kind:'lane', idx:l, bus:b.id});
  }
  return a;
}
function greedyPick(g){
  const acts = legalSends(g); if (!acts.length) return null;
  const fc = frontColors(g); let best = null, bestScore = -1;
  for (const a of acts){                         // ties: free a bay when something matches, dig into the queue when nothing does
    const sc = fc[g.buses[a.bus].color];
    if (sc > bestScore || (sc === bestScore && sc === 0 && a.kind === 'lane' && best.kind === 'bay')){ best = a; bestScore = sc; }
  }
  if (bestScore === 0 && g.counter + g.toRoad > 0) return null;   // nothing matches yet: let traffic clear first
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
  return {result: g.result || 'timeout', t: g.t, sends: g.sends, moves: g.moves, landed: g.landed};
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
  const E = L.exit; if (!inTarget(E.x, E.y + 1.9, E.z)) W.push({kind:'zone-exit', msg:'Exit tunnel is outside the target zone', x:E.x, z:E.z});
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
function rampWarnings(L){
  const W = [], R = L.ROAD, rs = L.RAMPS.map(rampSamples), road = [];
  for (let i=0;i<R.n;i+=3) if (R.cum[i] <= R.portalS + 1) road.push({x:R.P[i*3], y:R.P[i*3+1], z:R.P[i*3+2], s:R.cum[i]});
  L.RAMPS.forEach((r, k) => {
    const label = 'Ramp ' + (r.src + 1);
    let hit = null;
    for (const q of rs[k]){ for (const p of road){
      if (Math.abs(p.s - r.s) < 1.2) continue;      // the boarding point itself touches the road
      if (Math.hypot(q.x-p.x, q.z-p.z) < r.halfW + ROAD_HALF - 0.1){ hit = q; break; } } if (hit) break; }
    if (hit) W.push({kind:'ramp-road', msg: label + ' overlaps the road', x:hit.x, z:hit.z, ramp:r.src});
    for (let j=k+1;j<L.RAMPS.length;j++){
      const o = L.RAMPS[j]; let h2 = null;
      for (const q of rs[k]){ for (const p of rs[j]) if (Math.hypot(q.x-p.x, q.z-p.z) < r.halfW + o.halfW - 0.05){ h2 = q; break; } if (h2) break; }
      if (h2) W.push({kind:'ramp-ramp', msg: label + ' overlaps ramp ' + (o.src + 1), x:h2.x, z:h2.z, ramp:r.src});
    }
    let out = null;
    for (const cs of r.slots){ for (const q of cs) if (!inTarget(q.x, q.y + 0.8, q.z) || !inTarget(q.x, q.y, q.z)){ out = q; break; } if (out) break; }
    if (out) W.push({kind:'zone-ramp', msg: label + ' leaves the target zone', x:out.x, z:out.z, ramp:r.src});
    if (inSpiral(R, r.s, 0.8)) W.push({kind:'ramp-spiral', msg: label + ': boarding point is on a spiral overpass', x:r.x, z:r.z, ramp:r.src});
  });
  return W;
}
function checkLevel(level){
  const N = normalizeLevel(level), L = buildLayout(N);
  const men = {}, seats = {}, hiddenMen = {n:0}, sizes = {4:0, 6:0, 8:0, 12:0};
  COLORS.forEach(c => { men[c] = 0; seats[c] = 0; });
  N.ramps.forEach(r => r.columns.forEach(col => col.forEach(c => { const m = parseCell(c); if (m){ men[m.color]++; if (m.hidden) hiddenMen.n++; } })));
  let buses = 0; N.lanes.forEach(l => l.forEach(b => { seats[b.color] += b.cap; buses++; sizes[b.cap]++; }));
  const perColor = COLORS.map(c => ({color:c, men:men[c], seats:seats[c], ok:men[c] === seats[c]}));
  const warnings = [...roadWarnings(L), ...rampWarnings(L)];
  const links = {};
  N.lanes.forEach((l, li) => l.forEach(b => { if (b.link != null) (links[b.link] = links[b.link] || []).push(li); }));
  Object.keys(links).forEach(k => { const ls = links[k];
    if (ls.length < 2) warnings.push({kind:'link-single', msg:`Link ${k} has only one bus`});
    else if (new Set(ls).size < ls.length) warnings.push({kind:'link-lane', msg:`Linked buses (${k}) share a lane and can never leave together`}); });
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
  let wins = 0; for (let r=0;r<runs;r++) if (simulate(level, randomPick, mulberry32(1000 + r), SIM_DT).result === 'win') wins++;
  return {greedy:{result:gr.result, sends:gr.sends, landed:gr.landed, t:gr.t, moves:gr.moves}, wins, runs,
          rate: wins/runs, label: difficulty(wins/runs)};
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
  RETURN_TUNNEL_TIME, WIN_PANEL_DELAY, RUN_TIME, BOT_THINK, SIM_DT, RAMP_SP, LANE_GAP, CAM, SCREEN, SCREEN_CAM, DISP, dispZ, dispSx, dispSlope, dispScale, dispPoint, dispDir, inTarget, MIN_TURN_R,
  LEVEL_DATA, PRESETS, RAMP_TILT, COLORS, HEX, BUS_PLAN, RAMP_ROWS, BUS_W, ROW_PITCH, ROAD_HALF, busLen,
  Z_ENTRY, Z_ROAD0, BAY_X, Z_BAY_TOP, Z_BAY_BOT, Z_COLL, Z_LANE_TOP, LANE_X, X_SIDE, TUNNEL_X, TUNNEL, TUNNEL_L, TUNNEL_R, YARDS, YARD,
  parkZ, laneSlotZ, ROAD, RAMPS, seatLocal, pathAt, makePath, catmullRom, project,
  routeToRoad, routeBayToRoad, routeLaneToBay, routeReturn,
  normalizeLevel, buildLayout, parseCell, cellStr, checkLevel, difficulty, testLevel,
  createGame, step, tapLane, tapBay, canRoad, freeBay, frontColors, legalSends,
  greedyPick, randomPick, applyAction, simulate, validateLevel, generateLevel, evaluateLevel, searchSeed, mulberry32
};
root.MECoreFactory = factory;
})(typeof window !== 'undefined' ? window : globalThis);
