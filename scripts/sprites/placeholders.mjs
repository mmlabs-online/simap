// Code-drawn placeholder art for every registry key, from simple shapes in the style guide section 3 palette.
// Rules: 1 px outline on object sprites (not floors or walls, section 4), no baked shadow, avatar layers in greys.
// Canvas and anchor follow the export rule (section 8), so a real export later moves nothing.
import { create, fillRect, outline } from "./raster.mjs";

/** @typedef {import("./raster.mjs").Img} Img */

const OUTLINE = "#2a3140";
const HEADROOM = 16;
const TALL = new Set([
  "desk",
  "chair",
  "plant",
  "cabinet",
  "shelf",
  "rack",
  "lamp",
  "whiteboard",
  "cooler",
  "chart",
]);

/** Sub-tile canvases by key without direction: [w, h, width of the e/w views]. */
const SUB = {
  "device.monitor": [22, 20, 12],
  "device.monitor.dual": [32, 20, 32],
  "device.laptop": [22, 16, 16],
  "device.pc": [12, 20, 12],
  "device.phone": [8, 12, 8],
  "device.other": [14, 12, 14],
  "clock.wall": [20, 12, 6],
  "lamp.desk": [12, 16, 12],
  "prop.keyboard": [18, 8, 18],
  "prop.mouse": [8, 10, 8],
  "prop.mug": [10, 11, 10],
  "prop.papers": [16, 12, 16],
  "state.cannot": [16, 16, 16],
  "state.pending": [18, 18, 18],
  "state.mine.tint": [30, 22, 30],
  "avatar.body": [32, 32, 32],
  "avatar.hair": [32, 32, 32],
  "avatar.shirt": [32, 32, 32],
};

const FLOORS = {
  "floor.carpet": ["#d9dee5", "#c6cdd7"],
  "floor.carpet.alt": ["#d2d8e0", "#c6cdd7"],
  "floor.lavender": ["#d3cdea", "#bcb3db"],
  "floor.wood": ["#eadfca", "#d8c9ae"],
};

/** @param {Img} img @param {Array<[number, number, number, number, string]>} rects */
function rects(img, rects) {
  for (const [x, y, w, h, c] of rects) {
    fillRect(img, Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h), c);
  }
}

/** Table-like top with a face on the side that points at the viewer. */
function table(/** @type {Img} */ img, w, h, top, dir, topC, faceC, legC) {
  const faceW = dir === "e" || dir === "w" ? 6 : 8;
  const x0 = 1;
  const x1 = w - 1;
  const y0 = top + 1;
  const y1 = h - 1;
  rects(img, [[x0, y0, x1 - x0, y1 - y0, topC]]);
  if (dir === "s") rects(img, [[x0, y1 - faceW, x1 - x0, faceW, faceC]]);
  if (dir === "n") rects(img, [[x0, y0, x1 - x0, 4, faceC]]);
  if (dir === "e") rects(img, [[x1 - faceW, y0, faceW, y1 - y0, faceC]]);
  if (dir === "w") rects(img, [[x0, y0, faceW, y1 - y0, faceC]]);
  rects(img, [
    [x0 + 1, y1 - 3, 2, 3, legC],
    [x1 - 3, y1 - 3, 2, 3, legC],
  ]);
}

/**
 * Standing, walking avatar rects for `avatar.<layer>[.<style>].walk.<dir>.<step>` (greys only). South and north are
 * front and back views, east a side profile and west its mirror; the step swaps the legs and the swinging arm.
 * @returns {Array<[number, number, number, number, string]>}
 */
function walkRects(key) {
  const [, layer, ...rest] = key.split(".");
  const style = layer === "hair" ? Number(rest[0]) : 0;
  const [dir, stepText] = key.split(".walk.")[1].split(".");
  const step = Number(stepText);
  const side = dir === "e" || dir === "w";
  /** @type {Array<[number, number, number, number, string]>} */
  let r = [];
  if (layer === "body") {
    const near = step === 0 ? 4 : 2;
    if (side) {
      r = [
        [12, 4, 9, 10, "#e6e6e6"],
        [14, 14, 5, 3, "#e6e6e6"],
        [step === 0 ? 13 : 17, 17, 3, 8, "#e6e6e6"],
        [13, 25, 3, near + 3, "#e6e6e6"],
        [17, 25, 3, 9 - near, "#e6e6e6"],
        [18, 8, 2, 2, "#8f8f8f"],
      ];
    } else {
      r = [
        [11, 4, 10, 10, "#e6e6e6"],
        [13, 14, 6, 3, "#e6e6e6"],
        [7, step === 0 ? 17 : 18, 3, 8, "#e6e6e6"],
        [22, step === 0 ? 18 : 17, 3, 8, "#e6e6e6"],
        [12, 25, 3, near + 3, "#e6e6e6"],
        [17, 25, 3, 9 - near, "#e6e6e6"],
      ];
      if (dir === "s") r.push([13, 8, 2, 2, "#8f8f8f"], [17, 8, 2, 2, "#8f8f8f"]);
    }
  } else if (layer === "hair") {
    if (side) {
      r = [
        [11, 3, 10, 4 + style, "#8f8f8f"],
        [11, 3, 5, 11, "#8f8f8f"],
      ];
      if (style === 3) r.push([11, 5, 4, 12, "#8f8f8f"]);
    } else {
      r = [[10, 3, 12, 4 + style, "#8f8f8f"]];
      if (dir === "n") r.push([10, 3, 12, 11, "#8f8f8f"]);
      if (style === 3) r.push([9, 5, 2, 9, "#8f8f8f"], [21, 5, 2, 9, "#8f8f8f"]);
    }
  } else if (side) {
    r = [
      [12, 15, 9, 10, "#bdbdbd"],
      [step === 0 ? 13 : 17, 17, 3, 6, "#bdbdbd"],
    ];
  } else {
    r = [
      [8, 15, 16, 10, "#bdbdbd"],
      [7, step === 0 ? 17 : 18, 4, 6, "#bdbdbd"],
      [21, step === 0 ? 18 : 17, 4, 6, "#bdbdbd"],
    ];
  }
  return dir === "w" ? r.map(([x, y, w, h, c]) => [32 - x - w, y, w, h, c]) : r;
}

/** @type {Record<string, (img: Img, w: number, h: number, dir: string | null, top: number, key: string) => void>} */
const DRAW = {
  floor: (img, w, h, _d, _t, key) => {
    const [base, line] = FLOORS[/** @type {keyof typeof FLOORS} */ (key)];
    rects(img, [
      [0, 0, w, h, base],
      [0, h - 1, w, 1, line],
      [w - 1, 0, 1, h, line],
    ]);
  },
  wall: (img, w, h, _d, _t, key) => {
    if (/face|front|base/.test(key)) {
      rects(img, [
        [0, 0, w, h, key === "wall.face.shade" ? "#dfe3ea" : "#eef1f5"],
        [0, h - 4, w, 4, "#98a1b0"],
      ]);
    } else {
      rects(img, [
        [0, 0, w, h, "#8b95a7"],
        [0, 0, w, 2, "#a2acbc"],
      ]);
    }
  },
  window: (img, w, h) =>
    rects(img, [
      [0, 0, w, h, "#7d8896"],
      [3, 3, w - 6, h - 6, "#bfe3f5"],
      [4, 4, Math.max(2, (w - 8) >> 2), h - 8, "#eaf7ff"],
    ]),
  partition: (img, w, h) =>
    rects(img, [
      [0, 0, w, h, "#bfe3f5"],
      [0, 0, 2, h, "#7d8896"],
      [w - 2, 0, 2, h, "#7d8896"],
      [4, 4, 3, h - 8, "#eaf7ff"],
    ]),
  door: (img, w, h, dir) => {
    rects(img, [
      [1, 1, w - 2, h - 2, "#bcc4ce"],
      [3, 3, w - 6, h - 6, "#9ea7b2"],
    ]);
    const hx = dir === "w" || dir === "s" ? 4 : w - 7;
    const hy = dir === "e" || dir === "n" ? 4 : h - 7;
    rects(img, [[hx, hy, 3, 3, "#eef1f4"]]);
  },
  desk: (img, w, h, dir, top, key) => {
    table(img, w, h, top, dir, "#f6f5f2", "#d8d3ca", "#8c95a3");
    if (key.startsWith("desk.pair")) {
      const horizontal = dir === "n" || dir === "s";
      rects(img, [
        horizontal
          ? [2, top + (h - top) / 2 - 1, w - 4, 2, "#262b33"]
          : [w / 2 - 1, top + 2, 2, h - top - 4, "#262b33"],
      ]);
    }
  },
  table: (img, w, h, dir, top) => table(img, w, h, top, dir, "#ead9c0", "#cdb995", "#cdb995"),
  chair: (img, w, h, dir) => {
    const seat = [4, h - 18, w - 8, 14];
    const back = {
      s: [5, 1, w - 10, 13],
      n: [5, h - 14, w - 10, 13],
      e: [3, 3, 6, h - 12],
      w: [w - 9, 3, 6, h - 12],
    }[/** @type {"n" | "e" | "s" | "w"} */ (dir ?? "s")];
    rects(img, [
      [w / 2 - 2, h - 5, 4, 4, "#3a4250"],
      [seat[0], seat[1], seat[2], seat[3], "#4fb3ac"],
      [back[0], back[1], back[2], back[3], "#2f8f8a"],
      [back[0] + 1, back[1] + 1, back[2] - 2, 2, "#236e6b"],
    ]);
  },
  cabinet: (img, w, h, dir) => {
    const narrow = dir === "e" || dir === "w";
    const x = narrow ? 6 : 3;
    rects(img, [
      [x, 1, w - x - 3, h - 2, "#bcc4ce"],
      [x, 1, w - x - 3, 2, "#eef1f4"],
    ]);
    for (const y of [h * 0.3, h * 0.55, h * 0.8]) {
      rects(img, [
        [x + 1, Math.floor(y), w - x - 5, 1, "#9ea7b2"],
        [w / 2 - 2, Math.floor(y) + 3, 4, 1, "#eef1f4"],
      ]);
    }
  },
  shelf: (img, w, h) => {
    rects(img, [[2, 1, w - 4, h - 2, "#c9a27a"]]);
    for (const y of [h * 0.35, h * 0.65]) rects(img, [[3, Math.floor(y), w - 6, 2, "#a5805c"]]);
    rects(img, [
      [5, 6, 4, 10, "#e86a5a"],
      [10, 8, 4, 8, "#f2c14e"],
      [w - 14, 22, 5, 10, "#3b7dd4"],
    ]);
  },
  rack: (img, w, h) => {
    rects(img, [[4, 1, w - 8, h - 2, "#353b45"]]);
    for (let y = 6; y < h - 6; y += 8) {
      rects(img, [
        [6, y, w - 12, 5, "#4a515d"],
        [8, y + 2, 2, 2, "#5ee08f"],
        [12, y + 2, 2, 2, "#38bdf8"],
      ]);
    }
  },
  sofa: (img, w, h) =>
    rects(img, [
      [1, h - 26, w - 2, 12, "#4462b5"],
      [1, h - 16, w - 2, 14, "#5a7bd6"],
      [1, h - 20, 6, 18, "#4462b5"],
      [w - 7, h - 20, 6, 18, "#4462b5"],
      [9, h - 14, w - 18, 8, "#7d98e3"],
    ]),
  whiteboard: (img, w, h) =>
    rects(img, [
      [2, 1, w - 4, h - 12, "#8c95a3"],
      [4, 3, w - 8, h - 16, "#f6f5f2"],
      [8, 8, 20, 2, "#3b7dd4"],
      [8, 14, 14, 2, "#e86a5a"],
      [w / 2 - 6, h - 11, 12, 3, "#8c95a3"],
    ]),
  lamp: (img, w, h) =>
    rects(img, [
      [w / 2 - 6, 1, 12, 10, "#f2c14e"],
      [w / 2 - 1, 11, 2, h - 15, "#8c95a3"],
      [w / 2 - 6, h - 4, 12, 3, "#3a4250"],
    ]),
  bin: (img, w, h) =>
    rects(img, [
      [w / 2 - 9, h - 22, 18, 20, "#8c95a3"],
      [w / 2 - 10, h - 24, 20, 3, "#3a4250"],
    ]),
  chart: (img, w, h) =>
    rects(img, [
      [w / 2 - 11, 3, 22, h - 14, "#f6f5f2"],
      [w / 2 - 8, 8, 16, 2, "#3b7dd4"],
      [w / 2 - 1, h - 11, 2, 10, "#8c95a3"],
    ]),
  clock: (img, w, h) =>
    rects(img, [
      [1, 1, w - 2, h - 2, "#f6f5f2"],
      [w / 2 - 1, 2, 2, h / 2 - 1, "#3a4250"],
    ]),
  cooler: (img, w, h) =>
    rects(img, [
      [w / 2 - 8, 2, 16, 12, "#9fd3ee"],
      [w / 2 - 9, 14, 18, h - 16, "#e3e6ea"],
    ]),
  screen: (img, w, h) =>
    rects(img, [
      [1, 1, w - 2, h - 2, "#8c95a3"],
      [2, 2, w - 4, h - 4, "#f6f5f2"],
    ]),
  plant: (img, w, h, _d, _t, key) => {
    const leaf = key === "plant.large" ? 32 : 20;
    rects(img, [
      [8, h - 12, w - 16, 11, "#f2efe9"],
      [8, h - 4, w - 16, 3, "#d6d1c6"],
      [w / 2 - 7, h - 12 - leaf, 14, leaf, "#4ea56b"],
      [w / 2 - 3, h - 10 - leaf, 6, leaf - 4, "#7cc893"],
      [w / 2 - 10, h - 20, 20, 8, "#337a4d"],
    ]);
  },
  circulation: (img, w, h, _d, _t, key) => {
    if (key === "stairs") {
      for (let i = 0; i < 8; i++)
        rects(img, [[1, 1 + i * 8, w - 2, 7, i % 2 ? "#c6cdd7" : "#d9dee5"]]);
    } else {
      rects(img, [
        [1, 1, w - 2, h - 2, "#bcc4ce"],
        [w / 2 - 1, 4, 2, h - 8, "#262b33"],
        [6, 6, w / 2 - 8, h - 12, "#9ea7b2"],
        [w / 2 + 2, 6, w / 2 - 8, h - 12, "#9ea7b2"],
      ]);
    }
  },
  label: (img, w, h) =>
    rects(img, [
      [4, 4, w - 8, 14, "#c9a27a"],
      [6, 8, w - 12, 2, "#f6f5f2"],
      [6, 12, w - 18, 2, "#f6f5f2"],
      [w / 2 - 1, 18, 2, h - 20, "#a5805c"],
    ]),
  marker: (img, w, h) => {
    for (let i = 2; i < w + h - 2; i += 6) {
      for (let k = 0; k < 2; k++) {
        const x = i - k;
        const y = i - x;
        if (x > 0 && y > 0 && x < w - 1 && y < h - 1) rects(img, [[x, y, 1, 1, "#ef4444"]]);
      }
    }
    rects(img, [
      [1, 1, w - 2, 1, "#ef4444"],
      [1, h - 2, w - 2, 1, "#ef4444"],
      [1, 1, 1, h - 2, "#ef4444"],
      [w - 2, 1, 1, h - 2, "#ef4444"],
    ]);
  },
  device: (img, w, h, dir, _t, key) => {
    const side = dir === "e" || dir === "w";
    if (key.startsWith("device.monitor")) {
      const body = dir === "n" ? "#4a515d" : "#262b33";
      rects(img, [
        [1, 1, w - 2, h - 6, body],
        [w / 2 - 2, h - 5, 4, 3, "#3a4250"],
        [w / 2 - 5, h - 2, 10, 1, "#3a4250"],
      ]);
      if (dir !== "n" && !side)
        rects(img, [
          [2, 2, w - 4, h - 9, "#3b7dd4"],
          [3, 3, w - 8, 1, "#d6e8ff"],
        ]);
      if (key.endsWith(".dual")) rects(img, [[w / 2 - 1, 1, 2, h - 6, "#4a515d"]]);
    } else if (key.startsWith("device.laptop")) {
      rects(img, [
        [1, h - 6, w - 2, 5, "#b9c0ca"],
        [1, h - 3, w - 2, 2, "#9aa2ad"],
      ]);
      rects(img, [[3, 1, w - 6, h - 8, "#262b33"]]);
      if (dir !== "n" && !side) rects(img, [[4, 2, w - 8, h - 10, "#6aa3ee"]]);
    } else if (key === "device.pc") {
      rects(img, [
        [1, 1, w - 2, h - 2, "#353b45"],
        [3, 3, w - 6, 3, "#4a515d"],
        [4, h - 5, 2, 2, "#5ee08f"],
      ]);
    } else if (key === "device.phone") {
      rects(img, [
        [1, 1, w - 2, h - 2, "#353b45"],
        [2, 2, w - 4, h - 6, "#6aa3ee"],
      ]);
    } else {
      rects(img, [
        [1, 1, w - 2, h - 2, "#9aa2ad"],
        [3, 3, w - 6, h - 6, "#b9c0ca"],
      ]);
    }
  },
  prop: (img, w, h, _d, _t, key) => {
    if (key === "prop.keyboard")
      rects(img, [
        [1, 1, w - 2, h - 2, "#e3e6ea"],
        [2, 2, w - 4, h - 5, "#c6ccd4"],
      ]);
    else if (key === "prop.mouse")
      rects(img, [
        [1, 1, w - 2, h - 2, "#e3e6ea"],
        [w / 2, 2, 1, 3, "#c6ccd4"],
      ]);
    else if (key === "prop.mug")
      rects(img, [
        [1, 2, w - 4, h - 3, "#e86a5a"],
        [w - 3, 4, 2, 4, "#e86a5a"],
      ]);
    else
      rects(img, [
        [1, 1, w - 2, h - 2, "#f6f5f2"],
        [3, 4, w - 6, 1, "#c3bdb2"],
        [3, 7, w - 8, 1, "#c3bdb2"],
      ]);
  },
  state: (img, w, h, _d, _t, key) => {
    if (key === "state.cannot") {
      rects(img, [
        [1, 1, w - 2, h - 2, "#ef4444"],
        [3, h / 2 - 1, w - 6, 3, "#ffffff"],
      ]);
    } else if (key === "state.pending") {
      rects(img, [
        [1, 1, w - 2, h - 5, "#f59e0b"],
        [4, h - 5, 4, 4, "#f59e0b"],
        [w / 2 - 1, 4, 2, 6, "#ffffff"],
        [w / 2 - 1, 12, 2, 2, "#ffffff"],
      ]);
    } else {
      rects(img, [[1, 1, w - 2, h - 2, "#14b8a6"]]);
    }
  },
  avatar: (img, w, h, _d, _t, key) => {
    if (key.includes(".walk.")) {
      rects(img, walkRects(key));
      return;
    }
    const back = key.endsWith(".back");
    if (key.startsWith("avatar.body")) {
      rects(img, [
        [11, 4, 10, 10, "#e6e6e6"],
        [13, 14, 6, 3, "#e6e6e6"],
        [7, 17, 3, 8, "#e6e6e6"],
        [22, 17, 3, 8, "#e6e6e6"],
      ]);
      if (!back)
        rects(img, [
          [13, 8, 2, 2, "#8f8f8f"],
          [17, 8, 2, 2, "#8f8f8f"],
        ]);
    } else if (key.startsWith("avatar.hair")) {
      const style = Number(key.split(".")[2]);
      rects(img, [[10, 3, 12, 4 + style, "#8f8f8f"]]);
      if (back) rects(img, [[10, 3, 12, 11, "#8f8f8f"]]);
      if (style === 3)
        rects(img, [
          [9, 5, 2, 9, "#8f8f8f"],
          [21, 5, 2, 9, "#8f8f8f"],
        ]);
    } else {
      rects(img, [
        [8, 15, 16, 12, "#bdbdbd"],
        [7, 17, 4, 8, "#bdbdbd"],
        [21, 17, 4, 8, "#bdbdbd"],
      ]);
    }
  },
};

/**
 * @param {string} key frame key
 * @param {{ group: string, dir: string | null, layer: string, tiles: [number, number] | null }} entry
 * @returns {{ img: Img, anchor: [number, number] }}
 */
export function drawPlaceholder(key, entry) {
  const { group, dir, layer, tiles } = entry;
  let img;
  /** @type {[number, number]} */
  let anchor;
  let top = 0;
  if (tiles) {
    const head = TALL.has(group) ? HEADROOM : 0;
    img = create(tiles[0] * 32, tiles[1] * 32 + head);
    anchor = [0, -head];
    top = head;
  } else {
    let base = dir ? key.slice(0, -2) : key;
    while (!Object.hasOwn(SUB, base) && base.includes("."))
      base = base.slice(0, base.lastIndexOf("."));
    const [w, h, sideW] = SUB[/** @type {keyof typeof SUB} */ (base)];
    const cw = dir === "e" || dir === "w" ? sideW : w;
    img = create(cw, h);
    anchor = layer === "avatar" ? [0, 0] : [Math.floor((32 - cw) / 2), 32 - h];
  }
  const draw = DRAW[group] ?? DRAW[key.split(".")[0]];
  if (!draw) throw new Error(`No placeholder drawer for ${key}`);
  draw(img, img.w, img.h, dir, top, key);
  if (layer !== "floor" && layer !== "wall" && key !== "state.mine.tint") outline(img, OUTLINE);
  return { img, anchor };
}
