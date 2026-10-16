/* Marble Run — shared core: rules, level format, layout builder, checker, bots.
   Plain script with no DOM or three.js dependency: the game page, the editor, Web Workers and the
   Node tests all run exactly this code.  Loaded with <script src="shared/core.js">.
   The sister game of Match Express (same structure): boxes go from the lanes to 5 slots, marbles of
   their colour leave the trays, roll down the slide in single file and drop into them. */
(function factory(root) {
'use strict';

/* ============================== TUNING ============================== */
const R_M        = 0.2;              // marble radius (world units); a marble is D_M across
const D_M        = 2*R_M;
const V_SLIDE    = 15*D_M;           // slide speed: 15 marble diameters per second at 1x
const GAP        = 1.15*D_M;         // the closest two marbles on the slide ever come (centre to centre, along it)
const ROW_T      = 0.14;             // seconds for a tray column to roll forward one row
const T_CHUTE    = 0.3;              // seconds down the chute from a tray's front row onto the slide
const T_FLY      = 0.42;             // seconds a box takes from its lane to its slot
const T_BOWL     = 0.55;             // seconds a marble circles in the sorter's vortex bowl
const T_GATE     = 0.3;              // seconds from a flip gate into the box's hole
const T_KEY      = 0.9;              // seconds a key flies from its completed box to its lock crate
const T_CRATE    = 0.35;             // seconds a crate takes to lift away
const T_DISP     = 0.25;             // seconds a dispenser's marble takes to drop into the cell in front of it
const T_LEAVE    = 1.9;              // seconds a completed box floats under its balloon before leaving the screen (drawn only)
const WIN_DELAY  = 1.0;              // seconds after the last marble lands before the win panel
const BOT_THINK  = 0.4;              // bots look at the board this often (game seconds)
const SIM_DT     = 1/30;             // the fixed step: the game and every headless run step the rules by exactly this

/* ============================ LEVEL DATA ============================
   The built-in level (format 1, type 'marble-run-level').  Slide: points from the start tower (top) down toward the
   sorter; the engine adds the fixed tail into the vortex bowl, and works out every height itself (the slide always
   descends, and drops enough at a spiral to clear itself).  "spiral" on a point loops the slide once there.  Trays:
   "at" = arc length along the slide of the merge point (or "cp" = control point), "side" +1 / -1 = right / left of
   the direction the marbles travel, "columns" listed FRONT (slide end) to BACK; a cell is "red", "?red" (hidden
   marble) or null (empty).  Lanes: front box first; "hidden" shows a grey "?" box, "link" ties boxes together,
   "key" opens the tray crate with that lock.  The editor (editor.html) writes this same format. */
const LEVEL_DATA = /*LEVEL_BEGIN*/{
  "format": 1,
  "type": "marble-run-level",
  "id": "marble-run",
  "name": "Marble Run",
  "slide": {
    "points": [
      {"x": -0.5, "z": -12},
      {"x": -0.4, "z": -11.1},
      {"x": 0.2, "z": -10.1},
      {
        "x": 0.3,
        "z": -9,
        "spiral": {
          "r": 0.9,
          "side": 1
        }
      },
      {"x": 1.7, "z": -8.5},
      {"x": 2.5, "z": -7.3},
      {"x": 1.9, "z": -6.1},
      {"x": 0.3, "z": -5.6},
      {"x": -1.4, "z": -5.9},
      {"x": -2.8, "z": -5.8}
    ]
  },
  "trays": [
    {
      "at": 1.891,
      "side": -1,
      "rows": 6,
      "columns": [
        ["yellow", "yellow", "blue", "green", "green", "green"],
        ["blue", "blue", "blue", "red", "red", "yellow"],
        ["blue", "blue", "blue", "blue", "red", "red"]
      ]
    },
    {
      "at": 12.781,
      "side": -1,
      "tilt": 55,
      "rows": 6,
      "columns": [
        ["yellow", "yellow", "yellow", "yellow", "red", "red"],
        ["yellow", "yellow", "yellow", "green", "green", "green"],
        ["yellow", "blue", "blue", "green", "green", "green"]
      ]
    },
    {
      "at": 19.435,
      "side": 1,
      "shape": [
        [
          -3.09,
          -9.59
        ]
      ],
      "rows": 6,
      "columns": [
        ["yellow", "yellow", "yellow", "green", "green", "green"],
        ["blue", "blue", "red", "red", "red", "red"],
        ["yellow", "yellow", "green", "green", "green", "red"]
      ]
    },
    {
      "at": 15.089,
      "side": -1,
      "shape": [
        [
          3.95,
          -2.98
        ]
      ],
      "rows": 6,
      "columns": [
        ["yellow", "yellow", "yellow", "green", "yellow", "red"],
        ["blue", "blue", "blue", "blue", "yellow", "yellow"],
        ["blue", "blue", "red", "red", "red", "red"]
      ]
    }
  ],
  "lanes": [
    [
      {"color": "blue", "size": 4},
      {"color": "red", "size": 6},
      {"color": "green", "size": 6},
      {"color": "red", "size": 6}
    ],
    [
      {"color": "yellow", "size": 6},
      {"color": "yellow", "size": 6},
      {"color": "blue", "size": 8},
      {"color": "red", "size": 4}
    ],
    [
      {"color": "yellow", "size": 6},
      {"color": "blue", "size": 6},
      {"color": "green", "size": 6},
      {"color": "green", "size": 4},
      {"color": "yellow", "size": 4}
    ]
  ]
}/*LEVEL_END*/;
/* bundled levels by id (tools/sync-presets.js copies levels/*.json in here: the game and the editor run from file://) */
const PRESETS = /*PRESETS_BEGIN*/{
  "demo_hidden_box": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_hidden_box",
    "name": "Demo: Hidden Boxes",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {"at": 1.891, "side": -1, "rows": 6, "columns": [["yellow", "yellow", "yellow", "yellow", "yellow", "red"], ["yellow", "yellow", "yellow", "blue", "blue", "yellow"], ["yellow", "yellow", "red", "red", "red", "yellow"]]},
      {"at": 12.781, "side": -1, "tilt": 55, "rows": 6, "columns": [["yellow", "yellow", "blue", "blue", "yellow", "yellow"], ["green", "green", "green", "green", "blue", "blue"], ["green", "green", "green", "red", "blue", "blue"]]},
      {"at": 19.435, "side": 1, "shape": [[-3.09, -9.59]], "rows": 6, "columns": [["yellow", "yellow", "red", "red", "red", "yellow"], ["green", "green", "red", "red", "red", "red"], ["green", "green", "blue", "blue", "red", "red"]]},
      {"at": 15.089, "side": -1, "shape": [[3.95, -2.98]], "rows": 6, "columns": [["red", "red", "red", "red", "red", "yellow"], ["green", "green", "green", "red", "red", "red"], ["yellow", "yellow", "blue", "blue", "blue", "blue"]]}
    ],
    "lanes": [
      [
        {"color": "yellow", "size": 8},
        {"color": "yellow", "size": 4},
        {"color": "yellow", "size": 4},
        {"color": "green", "size": 8},
        {"color": "green", "size": 6, "hidden": true}
      ],
      [
        {"color": "red", "size": 4},
        {"color": "blue", "size": 6, "hidden": true},
        {"color": "blue", "size": 4},
        {"color": "yellow", "size": 6, "hidden": true}
      ],
      [
        {"color": "red", "size": 6},
        {"color": "blue", "size": 4},
        {"color": "red", "size": 8},
        {"color": "red", "size": 4, "hidden": true}
      ]
    ]
  },
  "demo_connected": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_connected",
    "name": "Demo: Connected Boxes",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {"at": 1.891, "side": -1, "rows": 6, "columns": [["blue", "blue", "blue", "blue", "red", "red"], ["green", "green", "green", "green", "blue", "blue"], ["blue", "blue", "yellow", "red", "red", "red"]]},
      {"at": 12.781, "side": -1, "tilt": 55, "rows": 6, "columns": [["green", "green", "green", "red", "red", "red"], ["yellow", "yellow", "yellow", "yellow", "red", "red"], ["blue", "blue", "yellow", "yellow", "red", "blue"]]},
      {"at": 19.435, "side": 1, "shape": [[-3.09, -9.59]], "rows": 6, "columns": [["blue", "blue", "red", "red", "red", "blue"], ["green", "green", "green", "yellow", "yellow", "yellow"], ["yellow", "yellow", "yellow", "yellow", "green", "blue"]]},
      {"at": 15.089, "side": -1, "shape": [[3.95, -2.98]], "rows": 6, "columns": [["green", "yellow", "yellow", "yellow", "yellow", "blue"], ["blue", "blue", "blue", "blue", "red", "red"], ["green", "green", "green", "green", "green", "green"]]}
    ],
    "lanes": [
      [
        {"color": "blue", "size": 4, "link": "G1"},
        {"color": "green", "size": 4, "link": "G4"},
        {"color": "red", "size": 6, "link": "G4"},
        {"color": "blue", "size": 6}
      ],
      [
        {"color": "blue", "size": 6, "link": "G1"},
        {"color": "blue", "size": 4, "link": "G3"},
        {"color": "yellow", "size": 8, "link": "G2"},
        {"color": "yellow", "size": 4, "link": "G2"},
        {"color": "yellow", "size": 6, "link": "G2"}
      ],
      [
        {"color": "green", "size": 8, "link": "G1"},
        {"color": "green", "size": 6, "link": "G3"},
        {"color": "red", "size": 6},
        {"color": "red", "size": 4}
      ]
    ]
  },
  "demo_dispenser": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_dispenser",
    "name": "Demo: Marble Dispensers",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {
        "at": 1.891,
        "side": -1,
        "rows": 6,
        "columns": [
          ["green", "green", "green", "yellow", "yellow", null],
          ["red", "red", "red", "yellow", null, null],
          ["green", "green", "green", "green", "blue", null]
        ]
      },
      {
        "at": 12.781,
        "side": -1,
        "tilt": 55,
        "rows": 6,
        "columns": [
          ["red", "red", "red", "red", "yellow", "yellow"],
          ["red", "red", "yellow", "yellow", "yellow", "yellow"],
          ["red", "red", null, null, "green", "green"]
        ],
        "dispensers": [
          {"col": 2, "row": 2, "w": 1, "h": 2, "color": "blue", "count": 6}
        ]
      },
      {
        "at": 19.435,
        "side": 1,
        "shape": [[-3.09, -9.59]],
        "rows": 6,
        "columns": [
          ["red", "red", "red", "red", "yellow", null],
          ["green", "green", "green", "yellow", "yellow", null],
          ["green", "green", "green", "green", "blue", "blue"]
        ]
      },
      {
        "at": 15.089,
        "side": -1,
        "shape": [[3.95, -2.98]],
        "rows": 6,
        "columns": [
          ["green", "green", "red", "red", "blue", null],
          ["blue", "blue", "blue", "blue", "green", null],
          ["red", null, null, "green", "green", "green"]
        ],
        "dispensers": [
          {"col": 2, "row": 1, "w": 1, "h": 2, "color": "yellow", "count": 6}
        ]
      }
    ],
    "lanes": [
      [
        {"color": "blue", "size": 4},
        {"color": "green", "size": 4},
        {"color": "green", "size": 8},
        {"color": "red", "size": 8},
        {"color": "red", "size": 6}
      ],
      [
        {"color": "yellow", "size": 6},
        {"color": "blue", "size": 6},
        {"color": "yellow", "size": 4},
        {"color": "green", "size": 6}
      ],
      [
        {"color": "green", "size": 4},
        {"color": "red", "size": 4},
        {"color": "yellow", "size": 8},
        {"color": "blue", "size": 4}
      ]
    ]
  },
  "demo_hidden_marbles": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_hidden_marbles",
    "name": "Demo: Hidden Marbles",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {"at": 1.891, "side": -1, "rows": 6, "columns": [["blue", "blue", "?blue", "green", "?green", "yellow"], ["green", "green", "green", "green", "yellow", "yellow"], ["blue", "blue", "?blue", "green", "?green", "green"]]},
      {"at": 12.781, "side": -1, "tilt": 55, "rows": 6, "columns": [["blue", "blue", "yellow", "?yellow", "yellow", "yellow"], ["red", "red", "red", "red", "red", "?yellow"], ["red", "red", "red", "?green", "?yellow", "yellow"]]},
      {"at": 19.435, "side": 1, "shape": [[-3.09, -9.59]], "rows": 6, "columns": [["blue", "blue", "yellow", "?yellow", "yellow", "yellow"], ["blue", "blue", "blue", "?yellow", "?yellow", "red"], ["blue", "blue", "blue", "?blue", "?yellow", "yellow"]]},
      {"at": 15.089, "side": -1, "shape": [[3.95, -2.98]], "rows": 6, "columns": [["blue", "green", "?green", "green", "green", "green"], ["red", "red", "?red", "?green", "green", "green"], ["red", "green", "?green", "?red", "red", "red"]]}
    ],
    "lanes": [
      [
        {"color": "red", "size": 4},
        {"color": "yellow", "size": 4},
        {"color": "green", "size": 6},
        {"color": "yellow", "size": 4}
      ],
      [
        {"color": "red", "size": 6},
        {"color": "blue", "size": 4},
        {"color": "blue", "size": 8},
        {"color": "blue", "size": 6},
        {"color": "green", "size": 8}
      ],
      [
        {"color": "green", "size": 6},
        {"color": "yellow", "size": 6},
        {"color": "red", "size": 6},
        {"color": "yellow", "size": 4}
      ]
    ]
  },
  "demo_lock_crate": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_lock_crate",
    "name": "Demo: Lock & Key",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {
        "at": 1.891,
        "side": -1,
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "yellow", "yellow", "yellow", "red"],
          ["yellow", "yellow", "yellow", "blue", "blue", "yellow"],
          ["yellow", "yellow", "red", "red", "red", "yellow"]
        ]
      },
      {
        "at": 12.781,
        "side": -1,
        "tilt": 55,
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "blue", "blue", "yellow", "yellow"],
          ["green", "green", "green", "green", "blue", "blue"],
          ["green", "green", "green", "red", "blue", "blue"]
        ],
        "crates": [
          {"col": 0, "row": 4, "w": 2, "h": 2, "lock": "K1"}
        ]
      },
      {
        "at": 19.435,
        "side": 1,
        "shape": [[-3.09, -9.59]],
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "red", "red", "red", "yellow"],
          ["green", "green", "red", "red", "red", "red"],
          ["green", "green", "blue", "blue", "red", "red"]
        ]
      },
      {
        "at": 15.089,
        "side": -1,
        "shape": [[3.95, -2.98]],
        "rows": 6,
        "columns": [
          ["red", "red", "red", "red", "red", "yellow"],
          ["green", "green", "green", "red", "red", "red"],
          ["yellow", "yellow", "blue", "blue", "blue", "blue"]
        ]
      }
    ],
    "lanes": [
      [
        {"color": "yellow", "size": 8},
        {"color": "yellow", "size": 4},
        {"color": "yellow", "size": 4},
        {"color": "green", "size": 8},
        {"color": "green", "size": 6}
      ],
      [
        {"color": "red", "size": 4, "key": "K1"},
        {"color": "blue", "size": 6},
        {"color": "blue", "size": 4},
        {"color": "yellow", "size": 6}
      ],
      [
        {"color": "red", "size": 6},
        {"color": "blue", "size": 4},
        {"color": "red", "size": 8},
        {"color": "red", "size": 4}
      ]
    ]
  },
  "demo_count_crate": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_count_crate",
    "name": "Demo: Count Crate",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {
        "at": 1.891,
        "side": -1,
        "rows": 6,
        "columns": [
          ["yellow", "yellow", "yellow", "yellow", "green", "green"],
          ["blue", "blue", "blue", "blue", "green", "green"],
          ["red", "red", "red", "yellow", "yellow", "green"]
        ]
      },
      {
        "at": 12.781,
        "side": -1,
        "tilt": 55,
        "rows": 6,
        "columns": [
          ["red", "red", "red", "yellow", "yellow", "green"],
          ["red", "red", "red", "red", "green", "green"],
          ["blue", "blue", "blue", "blue", "green", "green"]
        ]
      },
      {
        "at": 19.435,
        "side": 1,
        "shape": [[-3.09, -9.59]],
        "rows": 6,
        "columns": [
          ["red", "red", "red", "red", "green", "green"],
          ["blue", "blue", "blue", "blue", "blue", "green"],
          ["red", "red", "yellow", "yellow", "yellow", "green"]
        ]
      },
      {
        "at": 15.089,
        "side": -1,
        "shape": [[3.95, -2.98]],
        "rows": 6,
        "columns": [
          ["blue", "blue", "blue", "yellow", "green", "green"],
          ["red", "red", "blue", "blue", "yellow", "yellow"],
          ["red", "red", "blue", "blue", "yellow", "yellow"]
        ],
        "crates": [
          {"col": 0, "row": 4, "w": 3, "h": 2, "count": 2}
        ]
      }
    ],
    "lanes": [
      [
        {"color": "yellow", "size": 4},
        {"color": "yellow", "size": 4},
        {"color": "green", "size": 4},
        {"color": "green", "size": 8}
      ],
      [
        {"color": "red", "size": 6},
        {"color": "red", "size": 6},
        {"color": "blue", "size": 8},
        {"color": "blue", "size": 8},
        {"color": "yellow", "size": 4}
      ],
      [
        {"color": "red", "size": 8},
        {"color": "blue", "size": 4},
        {"color": "yellow", "size": 4},
        {"color": "green", "size": 4}
      ]
    ]
  },
  "demo_combo": {
    "format": 1,
    "type": "marble-run-level",
    "id": "demo_combo",
    "name": "Demo: All Together",
    "slide": {
      "points": [
        {"x": -0.5, "z": -12},
        {"x": -0.4, "z": -11.1},
        {"x": 0.2, "z": -10.1},
        {"x": 0.3, "z": -9, "spiral": {"r": 0.9, "side": 1}},
        {"x": 1.7, "z": -8.5},
        {"x": 2.5, "z": -7.3},
        {"x": 1.9, "z": -6.1},
        {"x": 0.3, "z": -5.6},
        {"x": -1.4, "z": -5.9},
        {"x": -2.8, "z": -5.8}
      ]
    },
    "trays": [
      {
        "at": 1.891,
        "side": -1,
        "rows": 6,
        "columns": [
          ["purple", "purple", "purple", "purple", "purple", null],
          ["purple", "green", "green", "?green", "green", "green"],
          ["red", "green", "?green", "green", "green", null]
        ]
      },
      {
        "at": 12.781,
        "side": -1,
        "tilt": 55,
        "rows": 6,
        "columns": [
          ["blue", "blue", "yellow", "yellow", "yellow", null],
          ["red", "red", "yellow", "purple", "purple", null],
          ["blue", "blue", "yellow", "?yellow", "yellow", "yellow"]
        ],
        "crates": [
          {"col": 1, "row": 2, "w": 1, "h": 2, "lock": "K1"}
        ]
      },
      {
        "at": 19.435,
        "side": 1,
        "shape": [[-3.09, -9.59]],
        "rows": 6,
        "columns": [
          ["red", "red", "?red", "red", "yellow", "yellow"],
          ["red", null, null, "?green", "green", "green"],
          ["blue", "blue", "blue", "blue", "purple", "purple"]
        ],
        "dispensers": [
          {"col": 1, "row": 1, "w": 1, "h": 2, "color": "yellow", "count": 6}
        ]
      },
      {
        "at": 15.089,
        "side": -1,
        "shape": [[3.95, -2.98]],
        "rows": 6,
        "columns": [
          ["purple", "purple", "purple", "blue", "blue", "blue"],
          ["purple", "blue", "blue", "blue", "blue", "blue"],
          ["red", "red", "red", "red", "green", "green"]
        ],
        "crates": [
          {"col": 1, "row": 1, "w": 1, "h": 2, "count": 4}
        ]
      }
    ],
    "lanes": [
      [
        {"color": "purple", "size": 4, "key": "K1"},
        {"color": "red", "size": 6},
        {"color": "yellow", "size": 6},
        {"color": "yellow", "size": 6}
      ],
      [
        {"color": "blue", "size": 4},
        {"color": "yellow", "size": 4, "link": "G1"},
        {"color": "purple", "size": 6, "link": "G1", "hidden": true},
        {"color": "green", "size": 6}
      ],
      [
        {"color": "blue", "size": 4},
        {"color": "purple", "size": 4},
        {"color": "red", "size": 6},
        {"color": "green", "size": 8, "link": "G2", "hidden": true},
        {"color": "blue", "size": 8, "link": "G2"}
      ]
    ]
  }
}/*PRESETS_END*/;

/* ============================== WORLD =============================== */
const COLORS = ["red","orange","yellow","green","cyan","blue","purple","pink"];
const HEX = {red:"#EC2B2B",orange:"#FF7A1C",yellow:"#FFC21A",green:"#33C240",cyan:"#1FC7E8",blue:"#2A6BFF",purple:"#8E3FF0",pink:"#FF5FAE"};
const SIZES = [4, 6, 8, 12];                                    // a box's holes: 2 columns x 2 / 3 / 4 / 6 rows
const HOLE = 0.46, BOX_W = 2*HOLE + 0.28;                       // hole pitch, box width
const boxLen = n => n/2*HOLE + 0.28;
/* hole i of a box of `size` in box space ([x, z], z toward the viewer): the far row first, left then right */
const holeLocal = (size, i) => [((i % 2) - 0.5)*HOLE, (Math.floor(i/2) - (size/2 - 1)/2)*HOLE];
const RI = 0.27, RO = 0.35;                                     // the slide's half-pipe: inner and outer radius
const EDGE = RO + 0.14;                                         // a tray's front edge, from the slide's centre line
const TRAY_SP = 0.42;                                           // marble pitch on a tray (times the level's marbleScale)
const TRAY_TILT = 35;                                           // default tray: square-ish to the screen, this many degrees outward and up
const TRAY_LEAN = 10;                                           // a tray's floor rises this many degrees toward its back
const MARBLE_SCALE_MAX = 1.3;
const SLOT_N = 5, SLOT_DX = 1.62, SLOT_L = boxLen(12) + 0.2, SLOT_W = BOX_W + 0.18, Z_SLOT = 0, SLOT_Y = 0.16, SLOT_X0 = 0.24;
const slotX = i => (i - (SLOT_N - 1)/2)*SLOT_DX + SLOT_X0;   // (the slot tray sits a little right of centre: the bowl is on its left)
/* the sorter: the slide's tail drops into a spinning vortex bowl behind slot 1; the bowl feeds a rail along the back of
   the slot tray, with a flip gate over each slot: a marble rolls along the rail until its own gate flips it into its box */
const RAIL = {z:-SLOT_L/2 - 0.3, y:1.0, x0:slotX(0) - 0.4, x1:slotX(SLOT_N - 1) + 0.5};
const BOWL = {x:slotX(0) - 1.0, z:RAIL.z - 0.16, y:0.95, r:0.56};
const TAIL = [[BOWL.x + 0.1, BOWL.z - 2.3], [BOWL.x, BOWL.z - 0.3]];  // the slide's fixed last stretch, straight into the bowl
const Y_END = BOWL.y + 0.55;                                    // the slide's height where it drops into the bowl
const SLOPE = 0.05, CLEAR = 0.8;                               // the slide's normal descent, its drop where it passes over itself
const gateX = i => slotX(i);
const railTime = k => (gateX(k) - RAIL.x0)/V_SLIDE;             // bowl outlet -> slot k's gate (the rail runs at slide speed)
/* the lanes: the queue's boxes are drawn at QS of their size (they grow to full size as they fly to their slot), so
   about 2.5 boxes of each lane show in front of the toy chest they slide out from */
const LANE_MIN = 2, LANE_MAX = 5, QS = 0.64, LANE_GAP = 0.26*QS, LANE_Z0 = SLOT_L/2 + 0.55;
function laneXs(n){ const dx = n <= 3 ? 2.55 : n === 4 ? 2.0 : 1.62; return Array.from({length:n}, (_, i) => (i - (n - 1)/2)*dx); }
const laneSlotZ = (lens, i) => { let z = LANE_Z0; for (let k = 0; k < i; k++) z += lens[k]*QS + LANE_GAP; return z + lens[i]*QS/2; };
const CHEST_Z = LANE_Z0 + 2.5*(boxLen(8)*QS + LANE_GAP);        // the toy chest's lid
const GAP_LEN = [0.6, 2.4];
const TOY_KINDS = {xylophone:2.4, bells:1.6, wheel:1.0, stairs:2.0, vortex:2.2, loop:1.8};   // decorative track pieces and their default lengths
const MIN_TURN_R = 0.7;                                         // the tightest bend outside a spiral

/* ============================== SCREEN ==============================
   One fixed portrait screen (900 x 1950 design pixels, 9:19.5) and one camera for every level: perspective, 30 degrees
   field of view, looking down 53 degrees, the slot tray (and the bowl beside it) filling the width.  Rows: the slide
   zone (6.5-55.5%), the sorter's bowl and rail and the slot tray (55.5-76%), the lanes and the toy chest (76-100%). */
const SCREEN = {w:900, h:1950, TOP:0.065, SLIDE_BOT:0.555, SLOT_BOT:0.76, MARGIN:12*900/390};
const CAM_PITCH = 53, CAM_DIST = 40.2, CAM_LOOK = [0, 0, -4.58];
const SCREEN_CAM = (() => { const a = CAM_PITCH*Math.PI/180;
  return {fov:30, pos:[0, CAM_DIST*Math.sin(a), CAM_LOOK[2] + CAM_DIST*Math.cos(a)], look:CAM_LOOK.slice(), w:SCREEN.w, h:SCREEN.h}; })();
function norm3(v){ const l = Math.hypot(v[0],v[1],v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; }
function project(x, y, z, cam){                    // world -> screen pixels (900 x 1950 design space)
  const C = cam || SCREEN_CAM, P = C.pos, f = norm3([C.look[0]-P[0], C.look[1]-P[1], C.look[2]-P[2]]);
  const r = norm3([-f[2], 0, f[0]]), u = [r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
  if (C.ortho){ const d = [x-C.look[0], y-C.look[1], z-C.look[2]];
    return [C.w/2 + (d[0]*r[0]+d[1]*r[1]+d[2]*r[2])*C.k, C.h/2 - (d[0]*u[0]+d[1]*u[1]+d[2]*u[2])*C.k]; }
  const d = [x-P[0], y-P[1], z-P[2]], zc = d[0]*f[0]+d[1]*f[1]+d[2]*f[2];
  const t = Math.tan(C.fov*Math.PI/360), xs = (d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/(zc*t*C.w/C.h), ys = (d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/(zc*t);
  return [(xs+1)/2*C.w, (1-ys)/2*C.h];
}
/* the orthographic camera: the same view direction, scaled and centred so that the slide zone keeps its rows (its top
   edge at the height of a tray, and the slot tray's back edge): the two cameras share almost the same slide zone, and
   the slot tray is a little narrower than the screen */
const ORTHO_CAM = (() => {
  const P = SCREEN_CAM, b = [0, SLOT_Y, -SLOT_L/2]; let za = -1;
  while (project(0, 3, za, P)[1] > SCREEN.TOP*SCREEN.h) za -= 0.01;
  const a = [0, 3, za], pa = project(...a, P), pb = project(...b, P), O = {ortho:true, pos:P.pos.slice(), look:P.look.slice(), w:SCREEN.w, h:SCREEN.h, k:1};
  const qa = project(...a, O), qb = project(...b, O); O.k = (pb[1] - pa[1])/(qb[1] - qa[1]);
  const q = project(...b, O), f = norm3([P.look[0]-P.pos[0], P.look[1]-P.pos[1], P.look[2]-P.pos[2]]);
  const u = norm3([0, -f[2], f[1]]), dv = (pb[1] - q[1])/O.k;                        // screen-up; move the view so `b` lands on its row
  O.look = O.look.map((v, i) => v + u[i]*dv); O.pos = O.pos.map((v, i) => v + u[i]*dv);
  return O; })();
let VIEW = 'persp';
function setView(m){ VIEW = m === 'ortho' ? 'ortho' : 'persp'; return VIEW; }
function viewCam(){ return VIEW === 'ortho' ? ORTHO_CAM : SCREEN_CAM; }
function inSlideZone(x, y, z, cam){ const [u, v] = project(x, y, z, cam || SCREEN_CAM);
  return u >= SCREEN.MARGIN && u <= SCREEN.w - SCREEN.MARGIN && v >= SCREEN.TOP*SCREEN.h && v <= SCREEN.SLIDE_BOT*SCREEN.h; }
const inZoneBoth = (x, y, z) => inSlideZone(x, y, z, SCREEN_CAM) && inSlideZone(x, y, z, ORTHO_CAM);

/* ============================= HELPERS ============================== */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function shuffle(a, rng){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };
const clone = o => JSON.parse(JSON.stringify(o));

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

/* ============================ LEVEL FORMAT ============================ */
/* "red" | "?red" (hidden) | null (empty)  ->  {color, hidden} | null */
function parseCell(c){
  if (!c) return null;
  if (typeof c === 'object') return c.color ? {color:c.color, hidden:!!c.hidden} : null;
  const hidden = c[0] === '?', color = hidden ? c.slice(1) : c;
  return COLORS.includes(color) ? {color, hidden} : null;
}
const cellStr = c => c ? (c.hidden ? '?' : '') + c.color : null;
const normCache = new WeakMap();
/* any accepted level -> canonical format 1 (unknown fields dropped, numbers made numbers, defaults filled in) */
function normalizeLevel(lv){
  if (!lv || typeof lv !== 'object') throw new Error('level must be an object');
  if (normCache.has(lv)) return normCache.get(lv);
  if (!Array.isArray(lv.trays) || !Array.isArray(lv.lanes)) throw new Error('level needs "trays" and "lanes"');
  const src = lv.slide && Array.isArray(lv.slide.points) && lv.slide.points.length >= 2 ? lv.slide : LEVEL_DATA.slide;
  const slide = {points:src.points.map(p => { const q = {x:+p.x, z:+p.z}; if (p.y != null && isFinite(+p.y)) q.y = +p.y;
    if (p.spiral) q.spiral = {r:clamp(+p.spiral.r || 1.0, 0.75, 1.6), side:p.spiral.side === -1 ? -1 : 1}; return q; })};
  // gaps: the slide cut at arc length `at` for `len`, flat or with a take-off ramp and a landing ramp
  const gaps = (Array.isArray(src.gaps) ? src.gaps : []).filter(q => q && isFinite(+q.at)).map(q => ({at:+q.at, len:clamp(+q.len || 1.0, GAP_LEN[0], GAP_LEN[1]), ramp:q.ramp === 'updown' ? 'updown' : 'flat'}))
    .sort((a, b) => a.at - b.at);
  if (gaps.length) slide.gaps = gaps;
  const toys = (Array.isArray(src.toys) ? src.toys : []).filter(q => q && TOY_KINDS[q.kind] && isFinite(+q.at))
    .map(q => ({kind:q.kind, at:+q.at, len:clamp(+q.len || TOY_KINDS[q.kind], 0.8, 4)})).sort((a, b) => a.at - b.at);
  if (toys.length) slide.toys = toys;
  const out = {format:1, type:'marble-run-level', name:lv.name || 'Untitled level', slide, trays:[], lanes:[]};
  if (lv.id != null && String(lv.id).trim()) out.id = String(lv.id).trim();
  if (lv.meta && typeof lv.meta === 'object' && !Array.isArray(lv.meta)) out.meta = clone(lv.meta);   // design notes: role, tutorial, popup, hint
  const int = v => Math.round(+v || 0);
  const rect = o => ({col:int(o.col), row:int(o.row), w:Math.max(1, int(o.w || 1)), h:Math.max(1, int(o.h || 1))});
  lv.trays.forEach((r, k) => {
    const cols = (r.columns || []).map(col => (col || []).map(c => cellStr(parseCell(c))));
    if (!cols.length) return;
    const rows = Math.max(1, r.rows || 0, ...cols.map(c => c.length));
    cols.forEach(c => { while (c.length < rows) c.push(null); });
    const nr = {side:r.side === -1 ? -1 : r.side === 1 ? 1 : (k % 2 ? -1 : 1), rows, columns:cols};
    if (r.at != null && isFinite(+r.at)) nr.at = +r.at; else if (r.cp != null) nr.cp = r.cp | 0; else nr.at = 3 + 5*k;
    if (r.tilt != null && isFinite(+r.tilt)) nr.tilt = +r.tilt;
    if (r.push != null && isFinite(+r.push) && +r.push > 0) nr.push = +r.push;      // front node this much further from the slide
    // (a `spread` - columns fanning out or drawing together - is dropped: every tray is a regular grid, as in Match Express)
    if (Array.isArray(r.shape) && r.shape.length) nr.shape = r.shape.map(p => [+p[0], +p[1]]);
    const disp = (r.dispensers || []).filter(t => t && COLORS.includes(t.color)).map(t => Object.assign(rect(t), {color:t.color, count:Math.max(0, int(t.count))}));
    const crate = (r.crates || []).filter(b => b && (b.lock != null || b.count != null)).map(b => Object.assign(rect(b), b.lock != null ? {lock:String(b.lock)} : {count:int(b.count)}));
    if (disp.length) nr.dispensers = disp;
    if (crate.length) nr.crates = crate;
    out.trays.push(nr);
  });
  const nl = clamp(Math.round(+lv.laneCount) || lv.lanes.length || 3, LANE_MIN, LANE_MAX);
  out.laneCount = nl;
  if (lv.marbleScale != null && isFinite(+lv.marbleScale) && Math.abs(+lv.marbleScale - 1) > 1e-9) out.marbleScale = clamp(Math.round(+lv.marbleScale*100)/100, 0.8, MARBLE_SCALE_MAX);
  for (let l=0;l<nl;l++) out.lanes.push(((lv.lanes[l]) || []).filter(b => b && COLORS.includes(b.color) && SIZES.includes(+(b.size || b.n)))
    .map(b => { const o = {color:b.color, size:+(b.size || b.n)}; if (b.hidden) o.hidden = true; if (b.link != null && b.link !== '') o.link = String(b.link);
      if (b.key != null && b.key !== '') o.key = String(b.key); return o; }));
  normCache.set(lv, out); normCache.set(out, out);
  return out;
}

/* ============================ LAYOUT BUILDER ============================
   Everything positional is derived from the level: the slide spline (with spirals and its fixed tail into the sorter),
   its heights, the pillars, the trays, the toy pieces and the gaps. */
const SPIRAL_ANG = [180,225,270,315,0,45,90];
function spiralDir(pts, i){ const q = pts[i-1], p = pts[i], l = Math.hypot(p.x-q.x, p.z-q.z) || 1; return [(p.x-q.x)/l, (p.z-q.z)/l]; }
/* heights along a horizontal polyline (S = its horizontal arc length): falling SLOPE per unit toward the end, steeper
   wherever the slide passes over an earlier... later stretch of itself so the upper deck clears the lower one by CLEAR;
   `fixed` = [{i, y}] heights the level pins */
function slideHeights(xz, S, fixed){
  const n = xz.length, k = new Float64Array(n).fill(SLOPE), y = new Float64Array(n), pairs = [];
  for (let i = 0; i < n; i += 2) for (let j = i + 2; j < n; j += 2){ if (S[j] - S[i] < 1.6) continue;
    if (Math.hypot(xz[i][0] - xz[j][0], xz[i][1] - xz[j][1]) < 2*RO + 0.08) pairs.push([i, j]); }   // the two half-pipes would touch
  const fill = () => { y[n-1] = Y_END; for (let i = n - 2; i >= 0; i--) y[i] = y[i+1] + k[i]*(S[i+1] - S[i]); };
  fill();
  for (let it = 0; it < 400; it++){                // the worst crossing first (most crossings share a stretch: fixing one fixes its neighbours)
    let worst = null, wn = 1e-4;
    for (const pr of pairs){ const need = CLEAR - (y[pr[0]] - y[pr[1]]); if (need > wn){ wn = need; worst = pr; } }
    if (!worst) break;
    const [i, j] = worst, add = wn/(S[j] - S[i]); for (let q = i; q < j; q++) k[q] += add*1.001;
    fill();
  }
  // pinned heights: a straight descent between them where the level asks for it (never below the automatic profile)
  if (fixed && fixed.length) for (const f of fixed) y[f.i] = Math.max(y[f.i], f.y);
  for (let i = n - 2; i >= 0; i--) if (y[i] < y[i+1] + 0.02*(S[i+1] - S[i])) y[i] = y[i+1] + 0.02*(S[i+1] - S[i]);
  return {y, pairs};
}
function buildSlide(slide){
  const pts = slide.points, cps = [], map = [], spirals = [];
  pts.forEach((p, i) => {
    map.push(cps.length); cps.push([p.x, 0, p.z]);
    if (p.spiral && i > 0 && i < pts.length - 1){
      const sp = p.spiral, R = sp.r || 1.0, side = sp.side || 1, d = spiralDir(pts, i), r = [-d[1], d[0]];
      const cx = p.x + d[0]*R + r[0]*R*side, cz = p.z + d[1]*R + r[1]*R*side;
      SPIRAL_ANG.forEach(a => { const t = a*Math.PI/180;
        cps.push([cx + r[0]*R*side*Math.cos(t) + d[0]*R*Math.sin(t), 0, cz + r[1]*R*side*Math.cos(t) + d[1]*R*Math.sin(t)]); });
      cps.push([p.x, 0, p.z]);
      spirals.push({point:i, cpFrom:map[i], cpTo:cps.length-1, cx, cz, R});
    }
  });
  const nUser = cps.length;
  TAIL.forEach(t => cps.push([t[0], 0, t[1]]));
  const {pts: dense, cpIdx} = catmullRom(cps, 24);
  const xz = dense.map(q => [q[0], q[2]]), S = [0];
  for (let i = 1; i < xz.length; i++) S.push(S[i-1] + Math.hypot(xz[i][0] - xz[i-1][0], xz[i][1] - xz[i-1][1]));
  const fixed = pts.map((p, i) => p.y != null ? {i:cpIdx[map[i]], y:p.y} : null).filter(Boolean);
  const {y, pairs} = slideHeights(xz, S, fixed);
  const path = makePath(dense.map((q, i) => [q[0], y[i], q[2]]));
  path.cpS = cpIdx.map(i => path.cum[i]);
  path.pointS = map.map(m => path.cpS[m]);            // arc length at each editable control point
  path.tailS = path.cpS[nUser];                       // the fixed tail into the sorter starts here
  path.end = path.len;                                // a marble reaching this drops into the vortex bowl
  path.spirals = spirals.map(sp => Object.assign(sp, {s0: path.cpS[sp.cpFrom], s1: path.cpS[sp.cpTo]}));
  path.cross = pairs.map(([i, j]) => ({s0:path.cum[i], s1:path.cum[j], x:dense[i][0], z:dense[i][2]}));
  path.gaps = (slide.gaps || []).map(q => ({at:q.at, len:q.len, ramp:q.ramp, s0:q.at - q.len/2, s1:q.at + q.len/2}));
  path.toys = (slide.toys || []).map(q => ({kind:q.kind, at:q.at, len:q.len, s0:q.at - q.len/2, s1:q.at + q.len/2}));
  path.cps = cps;
  return path;
}
const inSpiral = (SL, s, pad) => SL.spirals.some(sp => s > sp.s0 - pad && s < sp.s1 + pad);
/* where a marble's centre is at arc length s: inside the half-pipe, on an arc over a gap, and through the toy pieces
   that bend its way (a loop-the-loop, the vortex bowl, the zig-zag staircase).  Progress along the slide is always s,
   at V_SLIDE: a toy never changes a marble's speed, spacing or order, only where it is drawn. */
function slidePos(SL, s, o, hint){
  const i = pathAt(SL, s, o, hint), sink = RI - R_M + 0.004;
  o.y -= sink;
  for (const G of SL.gaps) if (s > G.s0 && s < G.s1){ const u = (s - G.s0)/(G.s1 - G.s0), H = G.ramp === 'updown' ? 0.22 + 0.16*G.len : 0.06 + 0.07*G.len;
    o.y += 4*H*u*(1 - u); }
  for (const T of SL.toys) if (s > T.s0 && s < T.s1){ const u = (s - T.s0)/(T.s1 - T.s0), off = toyOffset(T, u);
    if (T.fx == null){ const c = {}; pathAt(SL, T.at, c, 0); T.fx = c.dx; T.fz = c.dz; }        // in the toy's own frame (at its centre)
    o.x += T.fx*off[0] - T.fz*off[1]; o.z += T.fz*off[0] + T.fx*off[1]; o.y += off[2]; }
  return i;
}
/* a toy piece's bend at u (0..1 across it): [forward, sideways, up].  The loop is a prolate cycloid (radius >= len/pi,
   so a marble never moves slower through it than along the plain slide); the vortex goes once round a bowl (the same
   curve, lying flat, dipping a little); the staircase
   zig-zags from rail to rail, a step down at each turn */
function toyOffset(T, u){
  const L = T.len;
  if (T.kind === 'loop'){ const r = Math.max(L/Math.PI + 0.12, 0.6), a = 2*Math.PI*u; return [r*Math.sin(a), 0, r*(1 - Math.cos(a))]; }
  if (T.kind === 'vortex'){ const r = Math.max(L/Math.PI + 0.12, 0.6), a = 2*Math.PI*u; return [r*Math.sin(a), r*(1 - Math.cos(a)), -0.12*Math.sin(Math.PI*u)]; }   // once round the bowl, as a level loop
  if (T.kind === 'stairs'){ const n = 4, h = 0.09, q = Math.min(u*n, n - 1e-9), k = Math.floor(q), f = q - k;
    return [0, 0.2*Math.sin(Math.PI*q)*Math.sin(Math.PI*u), -h*(k + smooth01(0.72, 1, f)) + h*n*u]; }
  return [0, 0, 0];
}
/* the slide's edge on one side around s, as a curve measured by its own arc length (Match Express's roadEdge): E(u) is
   the edge point u along it, E.sAt(u) the slide's arc length beside it */
const lerpN = (a, b, t) => a + (b - a)*t;
function slideEdge(SL, s, side, reach){
  const o = {}, step = 0.04, n = Math.ceil(reach*1.8/step) + 2, at = t => {
    if (t < 0){ pathAt(SL, 0, o, 0); return [o.x + o.dx*t - o.dz*side*EDGE, o.z + o.dz*t + o.dx*side*EDGE]; }
    if (t > SL.len){ pathAt(SL, SL.len, o, 0); const e = t - SL.len; return [o.x + o.dx*e - o.dz*side*EDGE, o.z + o.dz*e + o.dx*side*EDGE]; }
    pathAt(SL, t, o, 0); return [o.x - o.dz*side*EDGE, o.z + o.dx*side*EDGE]; };
  const fwd = [[0, at(s), s]], back = [];
  for (let k = 1; k <= n; k++){ const q = at(s + k*step), w = fwd[fwd.length - 1]; fwd.push([w[0] + Math.hypot(q[0] - w[1][0], q[1] - w[1][1]), q, s + k*step]); }
  for (let k = 1; k <= n; k++){ const q = at(s - k*step), w = back.length ? back[back.length - 1] : fwd[0]; back.push([w[0] - Math.hypot(q[0] - w[1][0], q[1] - w[1][1]), q, s - k*step]); }
  const list = back.reverse().concat(fwd);
  const find = a => { let lo = 0, hi = list.length - 1;
    if (a <= list[0][0]) return [0, 0, 0]; if (a >= list[hi][0]) return [hi, hi, 0];
    while (hi - lo > 1){ const m = (lo + hi) >> 1; if (list[m][0] <= a) lo = m; else hi = m; }
    return [lo, hi, (a - list[lo][0])/((list[hi][0] - list[lo][0]) || 1)]; };
  const E = u => { const [lo, hi, f] = find(u*side); return [lerpN(list[lo][1][0], list[hi][1][0], f), lerpN(list[lo][1][1], list[hi][1][1], f)]; };
  E.sAt = u => { const [lo, hi, f] = find(u*side); return lerpN(list[lo][2], list[hi][2], f); };
  return E;
}
/* A tray: a straight rectangular wooden tray on stilts beside the slide, holding a regular grid of marbles - columns x
   rows, TRAY_SP apart (times the level's marbleScale), never bent or fanned.  It points one way from the middle of its
   front edge (its lip, beside the merge point): `tilt` (a fixed screen angle), else the way its `shape` path leaves the
   slide, else straight out.  Its front edge follows the slide's edge and a small apron fills the gap to the straight
   first row (Match Express's ramp builder); the floor rises TRAY_LEAN toward the back so the marbles lean on the front.
   A short chute runs from the lip down onto the slide at the merge point. */
function buildTray(SL, rd, src, K){
  K = K || 1; const SP = TRAY_SP*K;
  let s = rd.at != null ? rd.at : rd.cp != null ? SL.pointS[clamp(rd.cp, 0, SL.pointS.length-1)] : SL.tailS*(0.2 + 0.15*src);
  const side = rd.side || 1;
  s = clamp(s, 0.8, SL.tailS - 0.6);
  const rows = rd.rows, cols = rd.columns.length, length = 0.3*K + (rows-1)*SP + 0.36*K, halfW = cols*SP/2 + 0.12*K;
  let E = slideEdge(SL, s, side, halfW + 0.3);
  for (let it = 0; it < 4; it++){
    const a = E.sAt(-halfW), b = E.sAt(halfW), lo = Math.min(a, b), hi = Math.max(a, b);
    const ds = lo < 0.3 ? 0.3 - lo : hi > SL.tailS - 0.3 ? SL.tailS - 0.3 - hi : 0;
    if (Math.abs(ds) < 1e-4) break;
    s = clamp(s + ds, 0.8, SL.tailS - 0.6); E = slideEdge(SL, s, side, halfW + 0.3);
  }
  const A0 = E(0), p = {}; pathAt(SL, s, p, 0);
  const nx = -p.dz*side, nz = p.dx*side;           // outward horizontal normal
  const push = rd.push || 0, A = [A0[0] + nx*push, A0[1] + nz*push];
  const y = p.y + 0.12;                            // the tray's front edge: just above the slide's rim
  let n0 = [nx, nz];
  if (rd.tilt != null){ const t = rd.tilt*Math.PI/180; n0 = [(nx >= 0 ? 1 : -1)*Math.cos(t), -Math.sin(t)]; }
  else if (rd.shape && rd.shape.length){ const o = {}, c = [[A[0], y, A[1]]].concat(rd.shape.map(q => [q[0], y, q[1]]));
    pathAt(makePath(catmullRom(c, 24).pts), 0, o, 0); const l = Math.hypot(o.dx, o.dz); if (l > 1e-9) n0 = [o.dx/l, o.dz/l]; }
  else { const t = TRAY_TILT*Math.PI/180; n0 = [(nx >= 0 ? 1 : -1)*Math.cos(t), -Math.sin(t)]; }
  const t0 = (() => { const a = E(0.05), b = E(-0.05), d = [a[0] - b[0], a[1] - b[1]], k = d[0]*n0[0] + d[1]*n0[1], v = [d[0] - n0[0]*k, d[1] - n0[1]*k], l = Math.hypot(v[0], v[1]) || 1; return [v[0]/l, v[1]/l]; })();
  const FR = [[0, 0]];
  if (!push){ const at = t => { const e = E(t), dx = e[0] - A[0], dz = e[1] - A[1]; return [dx*t0[0] + dz*t0[1], dx*n0[0] + dz*n0[1]]; }, reach = halfW + 0.6;
    for (const sg of [1, -1]) for (let t = 0.02, last = 0; t < reach*2; t += 0.02){ const q = at(sg*t); if (q[0]*sg <= last + 1e-6) break; last = q[0]*sg;
      if (sg > 0) FR.push(q); else FR.unshift(q); if (last > reach) break; } }
  else { FR.unshift([-halfW - 1, 0]); FR.push([halfW + 1, 0]); }
  const frontShort = FR[0][0] > -halfW + 1e-6 || FR[FR.length - 1][0] < halfW - 1e-6;
  const fr = u => { let lo = 0, hi = FR.length - 1;
    if (u <= FR[0][0]) return FR[0][1]; if (u >= FR[hi][0]) return FR[hi][1];
    while (hi - lo > 1){ const m = (lo + hi) >> 1; if (FR[m][0] <= u) lo = m; else hi = m; }
    const f = (u - FR[lo][0])/((FR[hi][0] - FR[lo][0]) || 1); return FR[lo][1] + (FR[hi][1] - FR[lo][1])*f; };
  let vF = Math.max(fr(-halfW), fr(halfW)), vMin = Math.min(fr(-halfW), fr(halfW));
  for (const q of FR) if (q[0] > -halfW && q[0] < halfW){ vF = Math.max(vF, q[1]); vMin = Math.min(vMin, q[1]); }
  const apron = vF - vMin, O = [A[0] + n0[0]*vF, A[1] + n0[1]*vF];
  const lean = Math.tan(TRAY_LEAN*Math.PI/180), yAt = d => y + Math.max(0, d)*lean;
  const across = (sv, u) => ({x:O[0] + t0[0]*u + n0[0]*sv, z:O[1] + t0[1]*u + n0[1]*sv});
  const frontAt = u => fr(u) - vF;
  const slots = [];
  for (let col=0; col<cols; col++){
    const colSlots = [];
    for (let r=0; r<rows; r++){ const d = 0.3*K + r*SP, q = across(d, (col - (cols-1)/2)*SP); colSlots.push({x:q.x, y:yAt(d + vF) + R_M*K, z:q.z}); }
    slots.push(colSlots);
  }
  const front = [], right = [], back = [], left = [], NU = Math.max(4, Math.ceil(halfW*2/0.12)), NS = Math.max(4, Math.ceil(length/0.15));
  for (let k = 0; k <= NU; k++){ const u = -halfW + 2*halfW*k/NU, q = across(frontAt(u), u); front.push([q.x, q.z]); }
  { const s0 = frontAt(halfW); for (let k = 1; k <= NS; k++){ const q = across(s0 + (length - s0)*k/NS, halfW); right.push([q.x, q.z]); } }
  for (let k = 1; k < NU; k++){ const u = halfW - 2*halfW*k/NU, q = across(length, u); back.push([q.x, q.z]); }
  { const s0 = frontAt(-halfW); for (let k = NS; k >= 1; k--){ const q = across(s0 + (length - s0)*k/NS, -halfW); left.push([q.x, q.z]); } }
  const outline = front.concat(right, back, left);
  const tip = across(length, 0);
  const mp = {}; slidePos(SL, s, mp, 0);
  return {src, s, side, x:p.x, y, z:p.z, dir:n0, across:t0, length, rows, cols, halfW, sp:SP, marbleK:K, slots, front, outline, frontShort, apron,
          lip:[A[0], A[1]], merge:{x:mp.x, y:mp.y, z:mp.z}, tip:[tip.x, tip.z], yBack:yAt(length + vF), lean, frontAt, edge:E, push};
}
function pillarSpots(SL){
  const o = {}, out = [], P = SL.P;
  for (let s = 1.0; s < SL.len - 0.5; s += 2.0){
    pathAt(SL, s, o, 0);
    let blocked = false;                            // never through a lower part of the slide (spiral overpass)
    for (let i=0;i<SL.n;i+=2) if (Math.abs(SL.cum[i] - s) > 1.5 && P[i*3+1] < o.y - 0.3 && Math.hypot(P[i*3]-o.x, P[i*3+2]-o.z) < RO*2 + 0.15){ blocked = true; break; }
    if (SL.gaps.some(q => s > q.s0 - 0.3 && s < q.s1 + 0.3)) blocked = true;     // nothing under a gap
    if (!blocked) out.push({s, x:o.x, y:o.y, z:o.z});
  }
  return out;
}
const layoutCache = new WeakMap();
function buildLayout(level){
  const N = normalizeLevel(level);
  if (layoutCache.has(N)) return layoutCache.get(N);
  const SL = buildSlide(N.slide), K = N.marbleScale || 1;
  const TRAYS = N.trays.map((r, i) => buildTray(SL, r, i, K)).sort((a, b) => (a.s === b.s ? 0 : a.s - b.s) || a.src - b.src);
  TRAYS.forEach((r, k) => r.k = k);
  const st = {}; pathAt(SL, 0, st, 0);
  const L = {SLIDE:SL, TRAYS, laneX:laneXs(N.laneCount), start:{x:st.x, y:st.y, z:st.z, dx:st.dx, dz:st.dz}, pillars:pillarSpots(SL), level:N, marbleScale:K, CAM:SCREEN_CAM};
  layoutCache.set(N, L); layoutCache.set(level, L);
  return L;
}

/* ============================ GAME STATE ============================
   A tray in play: each column is a queue of marbles (front first, `cols`); the reserved ones are always a prefix of it
   (`nres`).  At most one blocker further back in a column (`obst`): a DISPENSER that drops its own marbles into the
   empty cell in front of it, or a closed CRATE (lock or count) holding the marbles under it.  The marbles behind a
   blocker (`rest`) wait until it is gone. */
function buildTrayState(g, N, R, k){
  const src = N.trays[R.src], rows = src.rows, ncol = src.columns.length;
  const T = {k, cols:[], rest:[], nres:new Array(ncol).fill(0), ready:new Array(ncol).fill(0), obst:new Array(ncol).fill(null), disps:[], crates:[], rr:0};
  const okRect = (o, minRow) => o.col >= 0 && o.w >= 1 && o.col + o.w <= ncol && o.row >= minRow && o.h >= 1 && o.row + o.h <= rows;
  const blockers = [];
  (src.dispensers || []).forEach((t, i) => { if (okRect(t, 1)) blockers.push({t:'disp', i, o:t}); });
  (src.crates || []).forEach((b, i) => { if (okRect(b, 0)) blockers.push({t:'crate', i, o:b}); });
  blockers.sort((a, b) => a.o.row - b.o.row);       // one blocker per column (the checker reports any other): the nearest to the slide wins
  const used = new Set(), keep = [];
  blockers.forEach(B => { let free = true; for (let c = B.o.col; c < B.o.col + B.o.w; c++) if (used.has(c)) free = false;
    if (!free) return; for (let c = B.o.col; c < B.o.col + B.o.w; c++) used.add(c); keep.push(B); });
  const mk = (cell, c, r, extra) => { const m = parseCell(cell); if (!m) return -1; const id = g.marbles.length;
    g.marbles.push(Object.assign({id, color:m.color, hidden:m.hidden, revealed:!m.hidden, tray:k, col:c, row:r, state:'tray', box:-1, hole:-1,
      phase:0, tDep:0, tEnd:0, tLand:0, tRes:0}, extra || {})); return id; };
  keep.filter(B => B.t === 'crate').forEach(B => { const b = B.o;
    T.crates.push({i:T.crates.length, src:B.i, col:b.col, w:b.w, row:b.row, h:b.h, kind:b.lock != null ? 'lock' : 'count',
      lock:b.lock != null ? String(b.lock) : null, n:b.count != null ? b.count|0 : 0, left:b.count != null ? b.count|0 : 0, open:false, opening:false, marbles:{}}); });
  keep.filter(B => B.t === 'disp').forEach(B => { const t = B.o;
    T.disps.push({i:T.disps.length, src:B.i, col:t.col, w:t.w, row:t.row, h:t.h, color:t.color, count:t.count|0, left:t.count|0, marbles:[], gone:false}); });
  T.crates.forEach(b => { for (let c = b.col; c < b.col + b.w; c++) T.obst[c] = {t:'crate', i:b.i}; });
  T.disps.forEach(t => { for (let c = t.col; c < t.col + t.w; c++) T.obst[c] = {t:'disp', i:t.i}; });
  src.columns.forEach((col, c) => {
    const o = T.obst[c], O = o ? (o.t === 'crate' ? T.crates[o.i] : T.disps[o.i]) : null, front = [], rest = [], under = [];
    col.forEach((cell, r) => {
      const id = mk(cell, c, r); if (id < 0) return;
      if (!O || r < O.row) front.push(id); else if (o.t === 'crate' && r < O.row + O.h) under.push(id); else rest.push(id);
    });
    T.cols.push(front); T.rest.push(rest);
    if (o && o.t === 'crate') O.marbles[c] = under;
  });
  T.disps.forEach(t => { for (let n = 0; n < t.count; n++) t.marbles.push(mk(t.color, -1, -1, {state:'disp', disp:t.i})); });
  T.disps.forEach(t => feedDisp(g, T, t, true));
  T.cols.forEach(col => { if (col.length) g.marbles[col[0]].revealed = true; });
  return T;
}
/* a dispenser drops one of its marbles into each empty cell directly in front of it; empty, it pops away and the
   marbles behind it join their columns */
function feedDisp(g, T, D, quiet){
  if (D.gone) return;
  for (let c = D.col; c < D.col + D.w; c++)
    while (D.left > 0 && T.cols[c].length < D.row){
      const id = D.marbles[D.count - D.left]; D.left--; const m = g.marbles[id], at = T.cols[c].length;
      T.cols[c].push(id); m.state = 'tray'; m.col = c; m.row = D.row - 1;
      if (at === 0 && !quiet) T.ready[c] = Math.max(T.ready[c], g.t + T_DISP + (D.row - 1)*ROW_T);
      if (!quiet) emit(g, 'dispense', {tray:T.k, disp:D.i, col:c, marble:id, left:D.left});
    }
  if (D.left === 0){
    D.gone = true;
    for (let c = D.col; c < D.col + D.w; c++){ T.obst[c] = null; for (const id of T.rest[c]) T.cols[c].push(id); T.rest[c] = []; }
    if (!quiet) emit(g, 'dispGone', {tray:T.k, disp:D.i});
  }
}
function openCrate(g, T, B){
  if (B.open) return; B.open = true; B.opening = false;
  for (let c = B.col; c < B.col + B.w; c++){
    if (!T.obst[c] || T.obst[c].t !== 'crate' || T.obst[c].i !== B.i) continue;
    T.obst[c] = null;
    const was = T.cols[c].length;
    for (const id of (B.marbles[c] || [])) T.cols[c].push(id);
    for (const id of T.rest[c]) T.cols[c].push(id);
    T.rest[c] = [];
    if (!was && T.cols[c].length) T.ready[c] = Math.max(T.ready[c], g.t + B.row*ROW_T);
  }
  emit(g, 'open', {tray:T.k, crate:B.i, kind:B.kind});
  T.cols.forEach((col, c) => { const m = col.length ? g.marbles[col[0]] : null;
    if (m && !m.revealed){ if (T.ready[c] > g.t + 1e-9) g.timers.push({t:T.ready[c], kind:'reveal', marble:m.id}); else { m.revealed = true; emit(g, 'reveal', {marble:m.id}); } } });
}

function createGame(level, opts){
  opts = opts || {};
  const N = normalizeLevel(level), L = buildLayout(N);
  const g = {t:0, n:0, emit:!opts.headless, events:[], result:null, resultT:0, why:null, L, level:N,
    marbles:[], boxes:[], trays:[], lanes:N.lanes.map(() => []), slots:new Array(SLOT_N).fill(-1),
    flow:[], arrivals:[], timers:[], seq:0, landed:0, completed:0, sends:0, moves:[], groups:[], locks:{}, refused:0};
  L.TRAYS.forEach((R, k) => g.trays.push(buildTrayState(g, N, R, k)));   // trays in merge order down the slide
  g.trays.forEach(T => T.crates.forEach(b => { if (b.kind === 'lock') g.locks[b.lock] = {tray:T.k, crate:b.i}; }));
  N.lanes.forEach((lane, l) => lane.forEach((d, i) => {
    const b = {id:g.boxes.length, color:d.color, size:d.size, hidden:!!d.hidden, revealed:!d.hidden || i === 0, link:d.link, key:d.key != null ? String(d.key) : null,
      len:boxLen(d.size), state:'lane', lane:l, slot:-1, seq:0, res:0, got:0, full:false, tSend:0, tLand:0, tDone:0, group:null};
    g.boxes.push(b); g.lanes[l].push(b.id); }));
  g.total = g.marbles.length;
  /* connected boxes: one group per link id, members in order leftmost lane first, front to back within a lane */
  const byLink = {};
  g.boxes.forEach(b => { if (b.link != null) (byLink[b.link] = byLink[b.link] || []).push(b); });
  Object.keys(byLink).forEach(id => { const ms = byLink[id];
    if (ms.length < 2) return;
    ms.sort((a, c) => a.lane - c.lane || g.lanes[a.lane].indexOf(a.id) - g.lanes[c.lane].indexOf(c.id));
    const grp = {id, members:ms.map(b => b.id), done:false};
    ms.forEach(b => { b.group = grp; }); g.groups.push(grp); });
  return g;
}
const emit = (g, type, data) => { if (g.emit) g.events.push(Object.assign({type, t:g.t}, data)); };
function freeSlots(g){ const out = []; for (let k = 0; k < SLOT_N; k++) if (g.slots[k] < 0) out.push(k); return out; }
function frontColors(g){ const n = {}; COLORS.forEach(c => n[c] = 0);
  for (const T of g.trays) T.cols.forEach((col, c) => { const i = T.nres[c]; if (i < col.length && g.marbles[col[i]].revealed) n[g.marbles[col[i]].color]++; }); return n; }

/* --------------------------- player actions -------------------------- */
function groupReady(g, grp){
  const lanes = {};
  for (const id of grp.members){ const b = g.boxes[id]; if (b.state !== 'lane') return false; (lanes[b.lane] = lanes[b.lane] || []).push(id); }
  return Object.keys(lanes).every(l => { const ids = lanes[l], q = g.lanes[l];
    return ids.every((id, i) => q[i] === id || ids.includes(q[i])) && ids.every(id => q.indexOf(id) < ids.length); });
}
function sendBox(g, b, k){
  const q = g.lanes[b.lane]; q.splice(q.indexOf(b.id), 1);
  b.state = 'fly'; b.slot = k; b.tSend = g.t; b.tLand = g.t + T_FLY; g.slots[k] = b.id; g.sends++;
  g.timers.push({t:b.tLand, kind:'land', box:b.id});
  emit(g, 'send', {box:b.id, lane:b.lane, slot:k});
}
function afterLaneShift(g, l){
  const q = g.lanes[l]; if (!q.length) return;
  const f = g.boxes[q[0]]; if (!f.revealed){ f.revealed = true; emit(g, 'revealBox', {box:f.id}); }
}
/* tapping any box in a lane sends that lane's front box (or its whole connected group) to the leftmost free slot(s) */
function tapLane(g, l){
  if (g.result) return 'over';
  const q = g.lanes[l]; if (!q || !q.length) return 'empty';
  const b = g.boxes[q[0]], free = freeSlots(g);
  if (b.group){
    if (!groupReady(g, b.group)){ g.refused++; emit(g, 'refuse', {box:b.id, lane:l, why:'group'}); return 'refused'; }
    if (free.length < b.group.members.length){ g.refused++; emit(g, 'refuse', {box:b.id, lane:l, why:'slots'}); return 'refused'; }
    const lanes = new Set();
    b.group.members.forEach((id, i) => { const m = g.boxes[id]; lanes.add(m.lane); sendBox(g, m, free[i]); });
    g.moves.push('L' + l + ':' + b.group.members.map(id => g.boxes[id].color + g.boxes[id].size).join('+'));
    lanes.forEach(x => afterLaneShift(g, x));
    return 'sent';
  }
  if (!free.length){ g.refused++; emit(g, 'refuse', {box:b.id, lane:l, why:'slots'}); return 'refused'; }
  sendBox(g, b, free[0]); g.moves.push('L' + l + ':' + b.color + b.size); afterLaneShift(g, l);
  return 'sent';
}

/* ---------------------------- reservations ---------------------------
   Each tray column's front marble (its first unreserved one, once it shows its colour) looks at the boxes in the
   slots: a box of its colour with an unreserved hole takes it - the box that reached its slot first is served first -
   and the one behind it looks next.  One fixed order: round-robin over the trays down the slide and their columns, so
   the game and every headless run reserve the same marbles.  The marbles reserved together are the "cheering" set:
   exactly the marbles that will drop into that box. */
function boxFor(boxes, color){
  let best = null;
  for (const b of boxes) if (b.state === 'slot' && b.color === color && b.res < b.size && (!best || b.seq < best.seq)) best = b;
  return best;
}
function resolveIn(trays, marbles, boxes){
  const got = []; let changed = true;
  while (changed){ changed = false;
    for (const T of trays) for (let c = 0; c < T.cols.length; c++){
      const q = T.cols[c], i = T.nres[c]; if (i >= q.length) continue;
      const m = marbles[q[i]]; if (!m.revealed) continue;
      const b = boxFor(boxes, m.color); if (!b) continue;
      m.box = b.id; b.res++; T.nres[c]++; got.push(m.id); changed = true;
    }
  }
  return got;
}
function resolve(g){
  const got = resolveIn(g.trays, g.marbles, g.boxes);
  if (got.length){ const by = {}; for (const id of got){ const m = g.marbles[id]; m.tRes = g.t; (by[m.box] = by[m.box] || []).push(id); }
    Object.keys(by).forEach(b => emit(g, 'reserve', {box:+b, marbles:by[b]})); }
  return got;
}

/* ------------------------------ movement ----------------------------- */
const phaseFree = (g, ph) => g.flow.every(f => Math.abs(f.phase - ph) >= GAP - 1e-9);
function stepTrays(g){
  const SL = g.L.SLIDE;
  for (const T of g.trays){
    const R = g.L.TRAYS[T.k], n = T.cols.length;
    for (let k = 0; k < n; k++){
      const c = (T.rr + k) % n, q = T.cols[c];
      if (!q.length || T.nres[c] === 0 || g.t < T.ready[c] - 1e-9) continue;
      const m = g.marbles[q[0]], ph = R.s - V_SLIDE*(g.t + T_CHUTE);
      if (!phaseFree(g, ph)) continue;            // the slide has priority: wait for a gap at the merge point
      q.shift(); T.nres[c]--; T.ready[c] = g.t + ROW_T; T.rr = (c + 1) % n;
      const b = g.boxes[m.box];
      m.state = 'chute'; m.phase = ph; m.tDep = g.t; m.tEnd = (SL.end - ph)/V_SLIDE;
      m.tLand = m.tEnd + T_BOWL + railTime(b.slot) + T_GATE;
      g.flow.push({id:m.id, phase:ph}); g.arrivals.push(m.id);
      emit(g, 'depart', {marble:m.id, tray:T.k, col:c, box:b.id});
      let front = false; const o = T.obst[c];
      if (o && o.t === 'disp'){ const D = T.disps[o.i], was = D.left; feedDisp(g, T, D); front = D.left !== was || D.gone; }
      if (q.length && !g.marbles[q[0]].revealed) g.timers.push({t:T.ready[c], kind:'reveal', marble:q[0]});   // once it has rolled into the front row
      if (front) resolve(g);                       // a front marble changed: it looks at the boxes
    }
  }
}
function land(g, m){
  const b = g.boxes[m.box];
  m.state = 'box'; m.hole = b.got; b.got++; g.landed++;
  emit(g, 'drop', {marble:m.id, box:b.id, hole:m.hole});
  if (b.got === b.size){
    b.full = true; emit(g, 'full', {box:b.id});
    const ms = b.group ? b.group.members.map(id => g.boxes[id]) : [b];
    if (ms.every(x => x.full)) complete(g, ms);
  }
}
function complete(g, ms){
  for (const b of ms){
    b.state = 'gone'; b.tDone = g.t; g.slots[b.slot] = -1; g.completed++;
    if (b.key != null && g.locks[b.key]){ const lk = g.locks[b.key], C = g.trays[lk.tray].crates[lk.crate];
      if (!C.open && !C.opening){ C.opening = true; g.timers.push({t:g.t + T_KEY, kind:'open', tray:lk.tray, crate:lk.crate}); emit(g, 'key', {box:b.id, lock:b.key, tray:lk.tray, crate:lk.crate}); } }
  }
  if (ms[0].group) ms[0].group.done = true;
  emit(g, 'complete', {boxes:ms.map(b => b.id), slots:ms.map(b => b.slot)});
  for (const T of g.trays) for (const C of T.crates) if (C.kind === 'count' && !C.open && !C.opening){
    C.left = Math.max(0, C.n - g.completed); emit(g, 'count', {tray:T.k, crate:C.i, left:C.left});
    if (C.left === 0){ C.opening = true; g.timers.push({t:g.t + T_CRATE, kind:'open', tray:T.k, crate:C.i}); } }
}
function stepTimers(g){
  g.timers.sort((a, b) => a.t - b.t);
  while (g.timers.length && g.timers[0].t <= g.t + 1e-9){
    const e = g.timers.shift();
    if (e.kind === 'land'){ const b = g.boxes[e.box]; b.state = 'slot'; b.seq = ++g.seq;
      if (!b.revealed){ b.revealed = true; emit(g, 'revealBox', {box:b.id}); }
      emit(g, 'land', {box:b.id, slot:b.slot}); resolve(g); }
    else if (e.kind === 'open'){ const T = g.trays[e.tray]; openCrate(g, T, T.crates[e.crate]); resolve(g); }
    else if (e.kind === 'reveal'){ const m = g.marbles[e.marble]; if (!m.revealed){ m.revealed = true; emit(g, 'reveal', {marble:m.id}); resolve(g); } }
  }
}
function stepArrivals(g){
  if (!g.arrivals.length) return;
  g.arrivals.sort((a, b) => g.marbles[a].tLand - g.marbles[b].tLand || a - b);
  while (g.arrivals.length && g.marbles[g.arrivals[0]].tLand <= g.t + 1e-9) land(g, g.marbles[g.arrivals.shift()]);
  for (let i = g.flow.length - 1; i >= 0; i--) if (g.marbles[g.flow[i].id].tEnd < g.t - 0.2) g.flow.splice(i, 1);
}
/* moving = anything still on its way or pending: a box in flight, a reserved marble, a marble on the slide or the rail,
   a key in flight, a crate lifting */
function busy(g){
  if (g.arrivals.length || g.timers.length) return true;
  for (const T of g.trays) if (T.nres.some(n => n > 0)) return true;
  return false;
}
function legalSends(g){
  const a = [], seen = new Set(), free = freeSlots(g).length;
  if (!free) return a;
  for (let l = 0; l < g.lanes.length; l++) if (g.lanes[l].length){
    const b = g.boxes[g.lanes[l][0]];
    if (b.group){ if (seen.has(b.group) || !groupReady(g, b.group) || free < b.group.members.length) continue; seen.add(b.group); }
    a.push({kind:'lane', idx:l, box:b.id});
  }
  return a;
}
/* Out of space: nothing is moving or pending, and no send is possible - all 5 slots hold boxes that no tray front can
   feed (or the slots left are too few for any connected group at a lane front) */
function stepEnd(g){
  if (g.result) return;
  if (g.landed === g.total){ g.result = 'win'; g.resultT = g.t; emit(g, 'win', {}); return; }
  if (busy(g) || legalSends(g).length) return;
  g.result = 'fail'; g.resultT = g.t; g.why = freeSlots(g).length ? (g.lanes.some(q => q.length) ? 'groups' : 'stuck') : 'slots';
  emit(g, 'fail', {why:g.why});
}
function step(g, dt){
  if (g.result === 'fail') return;
  g.t = Math.round((g.t + (dt || SIM_DT))*1e9)/1e9; g.n++;
  stepTimers(g);
  stepArrivals(g);
  stepTrays(g);
  stepEnd(g);
}

/* =============================== BOTS ================================
   The greedy bot: the send whose box would get the most marbles right away (a what-if on DEEP copies of the trays'
   columns, the marbles and the boxes, the new box landing last - nothing in the real game changes, not even a hidden
   colour), a box it would fill outright first; with nothing to gain it waits while marbles are still moving, else digs
   for the box whose colour sits nearest the tray fronts.  The random bot sends any legal box. */
function whatIf(g, act){
  const b0 = g.boxes[act.box], ms = b0.group ? b0.group.members : [b0.id];
  const trays = g.trays.map(T => ({cols:T.cols.map(q => q.slice()), nres:T.nres.slice()}));
  const marbles = g.marbles.map(m => ({color:m.color, revealed:m.revealed, box:m.box}));
  const boxes = g.boxes.map(b => ({id:b.id, color:b.color, size:b.size, res:b.res, seq:b.seq, state:b.state}));
  let seq = g.seq + 1;
  for (const id of ms){ const b = boxes[id]; b.state = 'slot'; b.seq = seq++; if (!g.boxes[id].revealed) b.color = '?'; }
  // boxes already flying in land first
  for (const b of boxes) if (b.state === 'fly'){ b.state = 'slot'; b.seq = g.seq + 0.5; }
  resolveIn(trays, marbles, boxes);
  let now = 0, fills = 0;
  for (const id of ms){ now += boxes[id].res; if (boxes[id].res >= boxes[id].size) fills++; }
  return {now, fills, n:ms.length};
}
function depthScore(g, color){                      // how near the tray fronts this colour sits (more, nearer = better)
  let s = 0;
  for (const T of g.trays) T.cols.forEach((q, c) => { for (let i = T.nres[c]; i < q.length && i < T.nres[c] + 6; i++){ const m = g.marbles[q[i]];
    if (m.revealed && m.color === color) s += 1/(1 + i - T.nres[c]); } });
  return s;
}
function greedyPick(g){
  const acts = legalSends(g); if (!acts.length) return null;
  let best = null, bs = -1;
  for (const a of acts){ const w = whatIf(g, a), b = g.boxes[a.box];
    const sc = w.now*10 + w.fills*25 - (w.n - 1)*2 + depthScore(g, b.color)*0.01;
    if (sc > bs){ best = a; bs = sc; a.now = w.now; } }
  if (best.now === 0){
    if (busy(g) || g.boxes.some(b => b.state === 'fly')) return null;   // nothing to gain yet: let the marbles that are moving land first
    let dig = null, ds = -1;
    for (const a of acts){ const b = g.boxes[a.box], d = (b.group ? b.group.members : [b.id]).reduce((s, id) => s + depthScore(g, g.boxes[id].color), 0) - (b.group ? 0.5 : 0);
      if (d > ds){ ds = d; dig = a; } }
    return dig;
  }
  return best;
}
function randomPick(g, rng){ const acts = legalSends(g); return acts.length ? acts[Math.floor(rng()*acts.length)] : null; }
/* the adversary (fail-free proofs): always the send that gets the fewest marbles right away */
function adversePick(g, rng){ const acts = legalSends(g); if (!acts.length) return null;
  let worst = null, ws = Infinity; for (const a of acts){ const w = whatIf(g, a), sc = w.now + (rng ? rng()*0.5 : 0); if (sc < ws){ ws = sc; worst = a; } } return worst; }
function applyAction(g, a){ return tapLane(g, a.idx); }
function simulate(level, policy, rng, dt, maxT){
  dt = dt || SIM_DT; maxT = maxT || 1500;
  const g = createGame(level, {headless:true});
  let think = 0;
  while (!g.result && g.t < maxT){
    think -= dt;
    if (think <= 0){ think += BOT_THINK; const a = policy(g, rng); if (a) applyAction(g, a); }
    step(g, dt);
  }
  return {result:g.result || 'timeout', why:g.why, t:g.t, sends:g.sends, moves:g.moves, landed:g.landed, total:g.total, refused:g.refused};
}

/* ========================== EDITOR CHECKS ===========================
   checkLevel() feeds the editor's checks panel: colour balance, totals and geometry warnings.
   Every warning carries a world position (x,z) where it can, so the editor can highlight it in red. */
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
const trayOutline = r => r.outline.map(q => q.slice());
/* the sorter on the ground (the bowl and the rail behind the slot tray) and the start tower */
function sorterFootprint(){ return [[BOWL.x - BOWL.r - 0.15, BOWL.z - BOWL.r - 0.2], [RAIL.x1 + 0.2, BOWL.z - BOWL.r - 0.2], [RAIL.x1 + 0.2, SLOT_L/2 + 0.2], [BOWL.x - BOWL.r - 0.15, SLOT_L/2 + 0.2]]; }
function towerFootprint(L){ const s = L.start, r = 0.62; return [[s.x - r, s.z - r], [s.x + r, s.z - r], [s.x + r, s.z + r], [s.x - r, s.z + r]]; }
function slideWarnings(L){
  const W = [], SL = L.SLIDE, P = SL.P, n = SL.n, pts = [];
  for (let i=0;i<n;i+=3) pts.push({x:P[i*3], y:P[i*3+1], z:P[i*3+2], s:SL.cum[i]});
  const near = (list, x, z) => list.some(w => Math.hypot(w.x - x, w.z - z) < 2.0);
  // where the slide passes over itself the upper deck must clear the lower one (pinned heights can break that)
  const low = [];
  for (const c of SL.cross){ const a = {}, b = {}; pathAt(SL, c.s0, a, 0); pathAt(SL, c.s1, b, 0);
    if (a.y - b.y < CLEAR - 0.05 && !near(low, a.x, a.z)) low.push({x:a.x, z:a.z}); }
  low.forEach(h => W.push({kind:'slide-clear', msg:'The slide passes too low over itself (the pinned heights leave no room)', x:h.x, z:h.z}));
  // the slide, the start tower and its flag stay inside the slide zone (in both cameras)
  const off = [];
  for (const p of pts) if (p.s < SL.tailS && (!inZoneBoth(p.x, p.y + 0.3, p.z) || !inZoneBoth(p.x, p.y - RO, p.z))){ if (!near(off, p.x, p.z)) off.push(p); }
  off.forEach(p => W.push({kind:'zone-slide', msg:'The slide leaves the slide zone', x:p.x, z:p.z}));
  const st = L.start; if (!inZoneBoth(st.x, st.y + 1.3, st.z)) W.push({kind:'zone-start', msg:'The start tower reaches outside the slide zone', x:st.x, z:st.z});
  // bends too tight for a marble at speed (outside the spirals)
  const tight = [], o1 = {}, o2 = {};
  for (let s = 0.5; s < SL.len - 0.5; s += 0.12){
    if (inSpiral(SL, s, 0.3)) continue;
    pathAt(SL, s - 0.25, o1, 0); pathAt(SL, s + 0.25, o2, 0);
    const da = Math.abs(Math.atan2(o1.dx*o2.dz - o1.dz*o2.dx, o1.dx*o2.dx + o1.dz*o2.dz));
    if (da > 1e-6 && 0.5/da < MIN_TURN_R){ pathAt(SL, s, o1, 0); if (!near(tight, o1.x, o1.z)) tight.push({x:o1.x, z:o1.z}); }
  }
  tight.forEach(p => W.push({kind:'slide-tight', msg:'Bend too tight for the slide', x:p.x, z:p.z}));
  // the slide must not run over the sorter or the slot tray before its tail
  const sorter = sorterFootprint(); let hit = null;
  for (const p of pts){ if (p.s >= SL.tailS - 0.5) break; if (polyDist(sorter, p.x, p.z) < RO){ hit = p; break; } }
  if (hit) W.push({kind:'slide-sorter', msg:'The slide runs over the sorter', x:hit.x, z:hit.z});
  return W;
}
function trayWarnings(L){
  const W = [], SL = L.SLIDE, polys = L.TRAYS.map(trayOutline), deck = [];
  for (let i=0;i<SL.n;i+=2) deck.push({x:SL.P[i*3], y:SL.P[i*3+1], z:SL.P[i*3+2], s:SL.cum[i]});
  const sorter = sorterFootprint(), tower = towerFootprint(L);
  L.TRAYS.forEach((r, k) => {
    const label = 'Tray ' + (r.src + 1);
    let hit = null;
    for (const p of deck){ const own = Math.abs(p.s - r.s) < 0.3 + r.halfW;    // beside its own merge point the front edge may touch the rim
      if (polyDist(polys[k], p.x, p.z) < (own ? RO - 0.12 : RO + 0.05)){ hit = p; break; } }
    if (hit) W.push({kind:'tray-slide', msg: label + ' overlaps the slide', x:hit.x, z:hit.z, tray:r.src});
    else if (r.frontShort) W.push({kind:'tray-slide', msg: label + '\'s front edge does not fit the slide (turned too far against a bend)', x:r.x, z:r.z, tray:r.src});
    if (r.apron > TRAY_SP*r.marbleK + 1e-6){
      W.push({kind:'tray-apron', msg: label + ': the slide bends too much here for its width (its apron would be ' + (r.apron/r.sp).toFixed(1) + ' rows deep): move it along the slide or make it narrower', x:r.x, z:r.z, tray:r.src}); }
    for (let j=k+1;j<L.TRAYS.length;j++){ const o = L.TRAYS[j], h2 = polysOverlap(polys[k], polys[j], 0.05);
      if (h2) W.push({kind:'tray-tray', msg: label + ' overlaps tray ' + (o.src + 1), x:h2[0], z:h2[1], tray:r.src}); }
    const hs = polysOverlap(polys[k], sorter, 0.1); if (hs) W.push({kind:'tray-sorter', msg: label + ' runs into the sorter or the slot tray', x:hs[0], z:hs[1], tray:r.src});
    const ht = polysOverlap(polys[k], tower, 0.05); if (ht) W.push({kind:'tray-start', msg: label + ' runs into the start tower', x:ht[0], z:ht[1], tray:r.src});
    let out = null;
    for (const cs of r.slots){ for (const q of cs) if (!inSlideZone(q.x, q.y + 0.25, q.z) || !inSlideZone(q.x, q.y, q.z)){ out = q; break; } if (out) break; }
    if (!out) for (const q of r.outline) if (!inZoneBoth(q[0], r.y, q[1])){ out = {x:q[0], z:q[1]}; break; }
    if (out) W.push({kind:'zone-tray', msg: label + ' leaves the slide zone', x:out.x, z:out.z, tray:r.src});
    if (inSpiral(SL, r.s, 0.8)) W.push({kind:'tray-spiral', msg: label + ': its merge point is on a spiral overpass', x:r.x, z:r.z, tray:r.src});
  });
  return W;
}
/* gaps and toy pieces: clear of the slide's ends, the spirals, each other and the merge points */
function gapWarnings(L){
  const W = [], SL = L.SLIDE, G = SL.gaps, merges = L.TRAYS.map(r => r.s);
  G.forEach((q, i) => { const o = {}; pathAt(SL, q.at, o, 0); const at = {x:o.x, z:o.z, gap:i}, label = 'Gap ' + (i + 1);
    if (q.s0 < 2.0 || q.s1 > SL.tailS - 1.5) W.push(Object.assign({kind:'gap-ends', msg:label + ' is too near the start or the end of the slide'}, at));
    if (inSpiral(SL, q.at, q.len/2 + 0.8)) W.push(Object.assign({kind:'gap-spiral', msg:label + ' is on a spiral'}, at));
    if (i && q.s0 - G[i - 1].s1 < 2.5) W.push(Object.assign({kind:'gap-gap', msg:label + ' is too close to gap ' + i}, at));
    for (const r of L.TRAYS){ const a = r.edge.sAt(-r.halfW), b = r.edge.sAt(r.halfW), lo = Math.min(a, b), hi = Math.max(a, b);
      if ((r.s > q.s0 - 1.2 && r.s < q.s1 + 0.4) || (hi > q.s0 - 0.2 && lo < q.s1 + 0.2))
        W.push({kind:'gap-merge', msg:'Tray ' + (r.src + 1) + '\'s merge point is on gap ' + (i + 1) + ' or just after it: move it along the slide', x:r.x, z:r.z, tray:r.src, gap:i}); }
    void merges; });
  SL.toys.forEach((T, i) => { const o = {}; pathAt(SL, T.at, o, 0); const at = {x:o.x, z:o.z, toy:i}, label = 'Toy ' + (i + 1) + ' (' + T.kind + ')';
    if (T.s0 < 0.8 || T.s1 > SL.tailS - 0.8) W.push(Object.assign({kind:'toy-ends', msg:label + ' is too near the start or the end of the slide'}, at));
    if (inSpiral(SL, T.at, T.len/2 + 0.4)) W.push(Object.assign({kind:'toy-spiral', msg:label + ' is on a spiral'}, at));
    if (SL.cross.some(c => (c.s0 > T.s0 - 0.8 && c.s0 < T.s1 + 0.8) || (c.s1 > T.s0 - 0.8 && c.s1 < T.s1 + 0.8)))
      W.push(Object.assign({kind:'toy-overpass', msg:label + ' sits where the slide passes over itself'}, at));
    if (i && T.s0 - SL.toys[i - 1].s1 < 0.6) W.push(Object.assign({kind:'toy-toy', msg:label + ' is too close to the toy before it'}, at));
    if (G.some(q => T.s1 > q.s0 - 0.8 && T.s0 < q.s1 + 0.8)) W.push(Object.assign({kind:'toy-gap', msg:label + ' runs into a gap'}, at));
    for (const r of L.TRAYS) if (r.s > T.s0 - 1.0 && r.s < T.s1 + 1.0)
      W.push({kind:'toy-merge', msg:label + ' is too close to tray ' + (r.src + 1) + '\'s merge point', x:o.x, z:o.z, tray:r.src, toy:i});
  });
  return W;
}
/* connected boxes: queue positions of every link group, and whether each group has a valid shape (2-3 boxes touching:
   one after another in a lane, side by side in neighbouring lanes, or diagonally - one row apart) */
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
/* can the queue be emptied at all? (sending fronts in any order; slot room ignored, groups hold <= 3) */
function queueDeadlock(N){
  const groups = {}; linkGroups(N).forEach(G => { if (G.members.length >= 2) groups[G.id] = G; });
  const q = N.lanes.map(l => l.map(b => ({link:b.link != null && groups[b.link] ? b.link : null})));
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
/* locks: a lock crate opens once its key box is complete, so the key box's colour must have enough marbles that no
   unopened lock crate holds or hides (the crate's own marbles and every marble behind it in its columns).  Opening
   one lock can free the marbles another key needs: the check repeats until nothing more opens. */
function lockDeadlocks(N){
  const keys = {}; N.lanes.forEach(l => l.forEach(b => { if (b.key != null) keys[b.key] = b; }));
  const locks = []; N.trays.forEach((r, ri) => (r.crates || []).forEach(c => { if (c.lock != null) locks.push({ri, c, open:false}); }));
  const hidden = (ri, col, row) => locks.some(L => !L.open && L.ri === ri && col >= L.c.col && col < L.c.col + L.c.w && row >= L.c.row);
  let changed = true;
  while (changed){ changed = false;
    for (const L of locks){ if (L.open) continue; const kb = keys[L.c.lock]; if (!kb) continue;
      let n = 0; N.trays.forEach((r, ri) => { r.columns.forEach((col, c) => col.forEach((cell, row) => { const m = parseCell(cell); if (m && m.color === kb.color && !hidden(ri, c, row)) n++; }));
        (r.dispensers || []).forEach(d => { if (d.color === kb.color && !hidden(ri, d.col, d.row)) n += d.count; }); });
      if (n >= kb.size){ L.open = true; changed = true; } } }
  return locks.filter(L => !L.open && keys[L.c.lock]).map(L => ({lock:L.c.lock, tray:L.ri}));
}
function checkLevel(level){
  const N = normalizeLevel(level), L = buildLayout(N);
  const marbles = {}, holes = {}, hidden = {n:0}, sizes = {4:0, 6:0, 8:0, 12:0};
  COLORS.forEach(c => { marbles[c] = 0; holes[c] = 0; });
  N.trays.forEach(r => r.columns.forEach(col => col.forEach(c => { const m = parseCell(c); if (m){ marbles[m.color]++; if (m.hidden) hidden.n++; } })));
  N.trays.forEach(r => (r.dispensers || []).forEach(t => { marbles[t.color] += t.count; }));      // a dispenser's marbles count too
  let boxes = 0; N.lanes.forEach(l => l.forEach(b => { holes[b.color] += b.size; boxes++; sizes[b.size]++; }));
  const perColor = COLORS.map(c => ({color:c, marbles:marbles[c], holes:holes[c], ok:marbles[c] === holes[c]}));
  const warnings = [...slideWarnings(L), ...trayWarnings(L), ...gapWarnings(L)];
  const locks = {};
  N.trays.forEach((r, ri) => {
    const label = 'Tray ' + (ri + 1), cols = r.columns.length, used = {}, R = L.TRAYS.find(x => x.src === ri), at = R ? {x:R.x, z:R.z} : {};
    const all = (r.dispensers || []).map(t => ['Dispenser', t]).concat((r.crates || []).map(b => [b.lock != null ? 'Lock crate' : 'Count crate', b]));
    all.forEach(([kind, o]) => {
      if (o.col < 0 || o.col + o.w > cols || o.row < 0 || o.row + o.h > r.rows)
        warnings.push(Object.assign({kind:'blocker-bounds', msg:`${label}: ${kind.toLowerCase()} reaches outside the tray`, tray:ri}, at));
      for (let c = o.col; c < o.col + o.w; c++){ if (used[c]) warnings.push(Object.assign({kind:'blocker-overlap', msg:`${label}: two blockers in column ${c + 1} (one per column)`, tray:ri}, at)); used[c] = true; }
    });
    (r.dispensers || []).forEach(t => {
      if (t.row < 1) warnings.push(Object.assign({kind:'disp-front', msg:`${label}: a dispenser needs at least one cell in front of it`, tray:ri}, at));
      if (t.count < 1) warnings.push(Object.assign({kind:'disp-count', msg:`${label}: a dispenser needs at least 1 marble`, tray:ri}, at));
      for (let c = Math.max(0, t.col); c < Math.min(cols, t.col + t.w); c++) for (let y = t.row; y < Math.min(r.rows, t.row + t.h); y++)
        if (r.columns[c][y]) { warnings.push(Object.assign({kind:'disp-cells', msg:`${label}: the dispenser sits on marbles (its cells must be empty)`, tray:ri}, at)); return; }
    });
    (r.crates || []).forEach(b => {
      if (b.lock != null){ if (locks[b.lock]) warnings.push({kind:'lock-dup', msg:`Lock ${b.lock} is used by two crates`, tray:ri}); locks[b.lock] = {tray:ri, keys:0}; }
      else if (b.count < 1 || b.count > boxes) warnings.push(Object.assign({kind:'count-range', msg:`${label}: a count crate needs 1-${boxes} completed boxes (has ${b.count})`, tray:ri}, at));
    });
  });
  N.lanes.forEach((l, li) => l.forEach((b, bi) => { if (b.key == null) return;
    if (locks[b.key]) locks[b.key].keys++; else warnings.push({kind:'key-no-lock', msg:`Lane ${li + 1} box ${bi + 1} carries key ${b.key}, but no crate has that lock`}); }));
  Object.keys(locks).forEach(id => { const k = locks[id].keys;
    if (k !== 1) warnings.push({kind:k ? 'lock-keys' : 'lock-no-key', msg:k ? `Lock ${id} has ${k} key boxes (needs exactly one)` : `Lock ${id} has no key box`, tray:locks[id].tray}); });
  lockDeadlocks(N).forEach(d => warnings.push({kind:'lock-deadlock', msg:`Lock ${d.lock}: its key box's colour cannot be reached without opening its own crate`, tray:d.tray}));
  linkGroups(N).forEach(G => {
    const n = G.members.length;
    if (n < 2) warnings.push({kind:'link-single', msg:`Link ${G.id} has only one box`});
    else if (n > 3) warnings.push({kind:'link-size', msg:`Link ${G.id} connects ${n} boxes (at most 3)`});
    else if (!G.connected || !G.consecutive) warnings.push({kind:'link-shape', msg:`Link ${G.id}: connected boxes must touch (one after another in a lane, or neighbouring lanes at most one row apart)`});
  });
  if (queueDeadlock(N)) warnings.push({kind:'link-deadlock', msg:'Connected boxes block each other: the queue can never be emptied'});
  if (!N.trays.length) warnings.push({kind:'no-trays', msg:'The level has no trays'});
  const totalMarbles = perColor.reduce((a, p) => a + p.marbles, 0), totalHoles = perColor.reduce((a, p) => a + p.holes, 0);
  return {perColor, totalMarbles, totalHoles, boxes, sizes, hiddenMarbles:hidden.n, warnings,
          balanced: perColor.every(p => p.ok) && totalMarbles > 0, ok: perColor.every(p => p.ok) && totalMarbles > 0 && !warnings.length};
}
/* the marble size a level's free space allows: the largest step up to MARBLE_SCALE_MAX at which its (grown) trays still
   raise no warning the level does not have at the normal size; a crowded level keeps 1 */
function autoMarbleScale(level){
  const base = clone(level); delete base.marbleScale;
  const kinds = new Set(checkLevel(clone(base)).warnings.map(w => w.kind + ':' + (w.tray != null ? w.tray : '')));
  for (let s = MARBLE_SCALE_MAX; s > 1.001; s = Math.round((s - 0.05)*100)/100){ const t = clone(base); t.marbleScale = s;
    if (checkLevel(t).warnings.every(w => kinds.has(w.kind + ':' + (w.tray != null ? w.tray : '')))) return s; }
  return 1;
}
function difficulty(rate){
  return rate > 0.45 ? 'Easy' : rate >= 0.15 ? 'Medium' : rate >= 0.05 ? 'Hard' : 'Very Hard';
}
/* the background "Test" run used by the editor (and the game's startup log) */
function testLevel(level, runs){
  runs = runs || 200;
  const gr = simulate(level, greedyPick, null, SIM_DT);
  let wins = 0, fails = 0;
  for (let r=0;r<runs;r++){ const s = simulate(level, randomPick, mulberry32(1000 + r), SIM_DT); if (s.result === 'win') wins++; else if (s.result === 'fail') fails++; }
  return {greedy:{result:gr.result, sends:gr.sends, landed:gr.landed, t:gr.t, moves:gr.moves}, wins, fails, runs,
          rate: wins/runs, label: difficulty(wins/runs), warnings:[]};
}

const DEFAULT_LAYOUT = buildLayout(LEVEL_DATA);
root.MRCore = {
  R_M, D_M, V_SLIDE, GAP, ROW_T, T_CHUTE, T_FLY, T_BOWL, T_GATE, T_KEY, T_CRATE, T_DISP, T_LEAVE, WIN_DELAY, BOT_THINK, SIM_DT,
  LEVEL_DATA, PRESETS, COLORS, HEX, SIZES, HOLE, BOX_W, boxLen, holeLocal, RI, RO, EDGE, TRAY_SP, TRAY_TILT, TRAY_LEAN, MARBLE_SCALE_MAX,
  SLOT_N, SLOT_DX, SLOT_L, SLOT_W, Z_SLOT, SLOT_Y, SLOT_X0, slotX, RAIL, BOWL, TAIL, Y_END, SLOPE, CLEAR, gateX, railTime,
  LANE_MIN, LANE_MAX, QS, LANE_GAP, LANE_Z0, laneXs, laneSlotZ, CHEST_Z, GAP_LEN, TOY_KINDS, MIN_TURN_R,
  SCREEN, SCREEN_CAM, ORTHO_CAM, project, setView, viewCam, get VIEW(){ return VIEW; }, inSlideZone, inZoneBoth,
  mulberry32, shuffle, catmullRom, makePath, pathAt, parseCell, cellStr, normalizeLevel,
  buildSlide, slidePos, toyOffset, slideEdge, buildTray, buildLayout, inSpiral, trayOutline, sorterFootprint, polyDist, inPoly, polysOverlap,
  createGame, step, tapLane, freeSlots, frontColors, groupReady, legalSends, busy, resolveIn, whatIf,
  greedyPick, randomPick, adversePick, applyAction, simulate, feedDisp, openCrate,
  checkLevel, linkGroups, queueDeadlock, lockDeadlocks, autoMarbleScale, difficulty, testLevel, DEFAULT_LAYOUT
};
root.MRCoreFactory = factory;
})(typeof window !== 'undefined' ? window : globalThis);
