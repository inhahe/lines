/* Headless checks for the arrangement math in lines.html.
 * Run: node test_geometry.js
 * The functions below are copied verbatim from lines.html; if that file
 * changes, keep these in sync (they are small and self-contained). */

function clipHalf(poly, ox, oy, nx, ny, s) {
  const m = poly.length >> 1;
  const out = [];
  if (m === 0) return out;
  let ax = poly[(m - 1) * 2], ay = poly[(m - 1) * 2 + 1];
  let da = ((ax - ox) * nx + (ay - oy) * ny) * s;
  for (let i = 0; i < m; i++) {
    const bx = poly[i * 2], by = poly[i * 2 + 1];
    const db = ((bx - ox) * nx + (by - oy) * ny) * s;
    if (db >= 0) {
      if (da < 0) { const t = da / (da - db); out.push(ax + (bx - ax) * t, ay + (by - ay) * t); }
      out.push(bx, by);
    } else if (da >= 0) {
      const t = da / (da - db); out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
    ax = bx; ay = by; da = db;
  }
  return out;
}

function polyArea(poly) {
  const m = poly.length >> 1;
  if (m < 3) return 0;
  let a = 0;
  let px = poly[(m - 1) * 2], py = poly[(m - 1) * 2 + 1];
  for (let i = 0; i < m; i++) {
    const x = poly[i * 2], y = poly[i * 2 + 1];
    a += px * y - x * py;
    px = x; py = y;
  }
  return Math.abs(a) * 0.5;
}

const AREA_EPS = 1e-4;
const BOX = { x0: 0, y0: 0, x1: 1000, y1: 700 };

function computeCells(lines) {
  let cells = [{ poly: [BOX.x0, BOX.y0, BOX.x1, BOX.y0, BOX.x1, BOX.y1, BOX.x0, BOX.y1], key: "" }];
  for (const L of lines) {
    const nx = -Math.sin(L.th), ny = Math.cos(L.th);
    const next = [];
    for (const c of cells) {
      const pos = clipHalf(c.poly, L.x, L.y, nx, ny, 1);
      if (pos.length >= 6 && polyArea(pos) > AREA_EPS) next.push({ poly: pos, key: c.key + "+" });
      const neg = clipHalf(c.poly, L.x, L.y, nx, ny, -1);
      if (neg.length >= 6 && polyArea(neg) > AREA_EPS) next.push({ poly: neg, key: c.key + "-" });
    }
    cells = next;
  }
  return cells;
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) { console.log("  ok   " + name); }
  else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  -> " + extra : "")); }
}

/* -- 1. Clipping a box in half gives two equal halves ------------- */
console.log("clipHalf");
{
  const box = [0, 0, 100, 0, 100, 100, 0, 100];
  const a = clipHalf(box, 50, 50, 1, 0, 1);
  const b = clipHalf(box, 50, 50, 1, 0, -1);
  check("half areas equal", Math.abs(polyArea(a) - 5000) < 1e-9 && Math.abs(polyArea(b) - 5000) < 1e-9,
        polyArea(a) + " / " + polyArea(b));
  const miss = clipHalf(box, 500, 500, 1, 0, 1);
  check("fully-outside half is empty", polyArea(miss) === 0);
}

/* -- 2. Face count matches Euler: 1 + n + (interior intersections)  */
console.log("arrangement face count");
{
  for (const n of [1, 2, 3, 5, 8, 12]) {
    // deterministic pseudo-random general-position lines
    let seed = 12345 + n;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const lines = [];
    for (let i = 0; i < n; i++) {
      lines.push({ x: 100 + rnd() * 800, y: 100 + rnd() * 500, th: rnd() * Math.PI * 2 });
    }
    // count pairwise intersections strictly inside the box
    let inter = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = lines[i], B = lines[j];
      const ax = Math.cos(A.th), ay = Math.sin(A.th);
      const bx = Math.cos(B.th), by = Math.sin(B.th);
      const den = ax * by - ay * bx;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((B.x - A.x) * by - (B.y - A.y) * bx) / den;
      const px = A.x + ax * t, py = A.y + ay * t;
      if (px > BOX.x0 && px < BOX.x1 && py > BOX.y0 && py < BOX.y1) inter++;
    }
    const cells = computeCells(lines);
    const expect = 1 + n + inter;
    check("n=" + n + " faces = 1+n+intersections = " + expect, cells.length === expect, cells.length);

    // areas must sum to the box area (partition, no overlap/gap)
    const total = cells.reduce((s, c) => s + polyArea(c.poly), 0);
    const boxArea = (BOX.x1 - BOX.x0) * (BOX.y1 - BOX.y0);
    check("n=" + n + " areas partition the box", Math.abs(total - boxArea) < 1e-6, total + " vs " + boxArea);

    // keys must be unique
    const keys = new Set(cells.map(c => c.key));
    check("n=" + n + " sign vectors unique", keys.size === cells.length);
  }
}

/* -- 3. Triple point: collapsing triangle dies, opposite one is born */
console.log("triple-point event");
{
  // Three lines through nearly one point; sweep one across the crossing.
  const mk = (t) => ([
    { x: 500, y: 350, th: 0 },
    { x: 500, y: 350, th: Math.PI / 3 },
    { x: 500 + t, y: 350, th: 2 * Math.PI / 3 }
  ]);
  const before = new Set(computeCells(mk(-40)).map(c => c.key));
  const after  = new Set(computeCells(mk(+40)).map(c => c.key));
  const born = [...after].filter(k => !before.has(k));
  const died = [...before].filter(k => !after.has(k));
  check("exactly one face dies", died.length === 1, JSON.stringify(died));
  check("exactly one face is born", born.length === 1, JSON.stringify(born));
  if (born.length === 1 && died.length === 1) {
    // the new triangle is the sign-flip of the old one in all 3 coordinates
    const flipped = died[0].split("").map(c => (c === "+" ? "-" : "+")).join("");
    check("newborn triangle is the old one's sign-flip", flipped === born[0], died[0] + " -> " + born[0]);
  }
  // and the triangle really does shrink to nothing at the crossing
  const area = (t) => {
    const cs = computeCells(mk(t));
    const c = cs.find(c => c.key === died[0]);
    return c ? polyArea(c.poly) : 0;
  };
  check("triangle area shrinks toward the crossing", area(-40) > area(-10) && area(-10) > area(-1));
  check("triangle is gone past the crossing", area(+10) === 0);
}

/* -- 4. Colour lifecycle: stable while alive, new after rebirth --- */
console.log("colour lifecycle");
{
  const colors = new Map();
  let gen = 0;
  let invented = 0;
  const step = (lines) => {
    gen++;
    const cells = computeCells(lines);
    for (const c of cells) {
      let e = colors.get(c.key);
      if (!e) { e = { css: "c" + (invented++), gen }; colors.set(c.key, e); }
      else e.gen = gen;
      c.css = e.css;
    }
    for (const [k, e] of colors) if (e.gen !== gen) colors.delete(k);
    return cells;
  };
  const mk = (t) => ([
    { x: 500, y: 350, th: 0 },
    { x: 500, y: 350, th: Math.PI / 3 },
    { x: 500 + t, y: 350, th: 2 * Math.PI / 3 }
  ]);
  const first = step(mk(-40));
  const keyOf = first.map(c => [c.key, c.css]);
  const second = step(mk(-30));                        // same topology, drifted
  const stable = keyOf.every(([k, css]) => {
    const c = second.find(c => c.key === k);
    return c && c.css === css;
  });
  check("colours persist while the area lives", stable);
  const nBefore = invented;
  const doomed = second.find(c => !computeCells(mk(+30)).some(d => d.key === c.key)).key;
  step(mk(+30));                                       // past the triple point
  check("crossing invents exactly one new colour", invented === nBefore + 1, invented - nBefore);
  check("dead face's colour is released", !colors.has(doomed), doomed);
}

/* -- 5. Gaussian sampler is actually a bell curve ----------------- */
console.log("gauss()");
{
  function gauss(sigma) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const N = 200000, s = 3;
  let sum = 0, sum2 = 0, within1 = 0, within2 = 0;
  for (let i = 0; i < N; i++) {
    const g = gauss(s);
    sum += g; sum2 += g * g;
    if (Math.abs(g) < s) within1++;
    if (Math.abs(g) < 2 * s) within2++;
  }
  const mean = sum / N, sd = Math.sqrt(sum2 / N - mean * mean);
  check("mean ~ 0", Math.abs(mean) < 0.05, mean);
  check("sd ~ sigma", Math.abs(sd - s) < 0.05, sd);
  check("68% within 1 sigma", Math.abs(within1 / N - 0.6827) < 0.01, within1 / N);
  check("95% within 2 sigma", Math.abs(within2 / N - 0.9545) < 0.01, within2 / N);
}

/* -- 6. Stat readout: fps must not flicker ------------------------ *
 * Mirrors the readout block in lines.html. Regression test for a bug
 * where the "first frame" primer was keyed on statFrames === 1; since
 * the refresh timer resets statFrames to 0, the primer re-fired on the
 * very next frame and blanked the fps after a single frame on screen. */
console.log("stat readout");
{
  const STAT_PERIOD = 0.4;
  function runReadout(frames, dt) {
    let statAcc = 0, statFrames = 0, statPrimed = false, statFps = 0;
    let text = "";
    const log = [];
    for (let i = 0; i < frames; i++) {
      statAcc += dt;
      statFrames++;
      if (!statPrimed) { statPrimed = true; text = "areas: 500"; }
      if (statAcc >= STAT_PERIOD) {
        statFps = statFrames / statAcc;
        text = "areas: 500   " + statFps.toFixed(0) + " fps";
        statAcc = 0; statFrames = 0;
      }
      log.push(text);
    }
    return log;
  }

  const dt = 1 / 60;
  const log = runReadout(600, dt);           // 10 seconds at 60 fps
  const firstFps = log.findIndex(t => t.includes("fps"));
  check("fps appears within the first second", firstFps > 0 && firstFps < 60, firstFps);

  // once shown, it must never disappear again
  const droppedAt = log.findIndex((t, i) => i > firstFps && !t.includes("fps"));
  check("fps never disappears once shown", droppedAt === -1, "dropped at frame " + droppedAt);

  // it should be readable: each displayed value must persist ~STAT_PERIOD
  let runs = [], cur = 1;
  for (let i = firstFps + 1; i < log.length; i++) {
    if (log[i] === log[i - 1]) cur++;
    else { runs.push(cur); cur = 1; }
  }
  const shortest = Math.min(...runs);
  check("each reading stays on screen >= 0.3s",
        shortest * dt >= 0.3, (shortest * dt).toFixed(3) + "s");

  // the measured fps should be right
  const val = parseInt(log[log.length - 1].match(/(\d+) fps/)[1], 10);
  check("reports ~60 fps for 60 fps frames", Math.abs(val - 60) <= 1, val);

  // and at a low frame rate it must still not flicker
  const slow = runReadout(200, 1 / 12);
  const slowFirst = slow.findIndex(t => t.includes("fps"));
  const slowDrop = slow.findIndex((t, i) => i > slowFirst && !t.includes("fps"));
  check("no flicker at 12 fps either", slowDrop === -1, "dropped at frame " + slowDrop);

  // demonstrate the OLD logic really did flicker (guards the test itself)
  function runOld(frames, dt) {
    let statAcc = 0, statFrames = 0;
    const log = [];
    let text = "";
    for (let i = 0; i < frames; i++) {
      statAcc += dt; statFrames++;
      if (statFrames === 1) text = "areas: 500";
      else if (statAcc > 0.5) {
        text = "areas: 500   " + (statFrames / statAcc).toFixed(0) + " fps";
        statAcc = 0; statFrames = 0;
      }
      log.push(text);
    }
    return log;
  }
  const old = runOld(600, dt);
  const oldFirst = old.findIndex(t => t.includes("fps"));
  const oldFpsFrames = old.filter(t => t.includes("fps")).length;
  check("old logic showed fps on only ~1 frame per cycle (bug reproduced)",
        oldFirst > 0 && oldFpsFrames <= old.length / 20, oldFpsFrames + "/" + old.length + " frames");
}

/* -- 7. Colour conversion (shared by both renderers) -------------- *
 * Both renderers consume the same 8-bit RGB, so hslToRgb must be right
 * or every colour shifts. Copied from lines.html. */
console.log("hslToRgb");
{
  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (h / 60) % 6;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1)      { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else             { r = c; b = x; }
    const m = l - c / 2;
    return [r + m, g + m, b + m];
  }
  const rgb255 = (h, s, l) => hslToRgb(h, s, l).map(v => Math.round(v * 255));
  const eq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 1);

  check("red",     eq(rgb255(0,   1,   0.5), [255, 0, 0]),     rgb255(0, 1, 0.5));
  check("green",   eq(rgb255(120, 1,   0.5), [0, 255, 0]),     rgb255(120, 1, 0.5));
  check("blue",    eq(rgb255(240, 1,   0.5), [0, 0, 255]),     rgb255(240, 1, 0.5));
  check("cyan",    eq(rgb255(180, 1,   0.5), [0, 255, 255]),   rgb255(180, 1, 0.5));
  check("white",   eq(rgb255(0,   0,   1.0), [255, 255, 255]), rgb255(0, 0, 1));
  check("black",   eq(rgb255(0,   0,   0.0), [0, 0, 0]),       rgb255(0, 0, 0));
  check("mid grey",eq(rgb255(0,   0,   0.5), [128, 128, 128]), rgb255(0, 0, 0.5));
  check("orange",  eq(rgb255(30,  1,   0.5), [255, 128, 0]),   rgb255(30, 1, 0.5));
  check("h=360 wraps to h=0", eq(rgb255(360, 1, 0.5), rgb255(0, 1, 0.5)), rgb255(360, 1, 0.5));

  // every channel must stay in range across the palette actually used
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const v = hslToRgb(Math.random() * 360,
                       (45 + Math.random() * 45) / 100,
                       (32 + Math.random() * 40) / 100);
    if (v.some(c => !(c >= 0 && c <= 1))) bad++;
  }
  check("palette always in [0,1]", bad === 0, bad + " out of range");
}

/* -- 8. Seeded RNG is deterministic and uniform ------------------- */
console.log("rnd() (mulberry32)");
{
  function makeRnd(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const a = makeRnd(12345), b = makeRnd(12345), c = makeRnd(999);
  const seqA = Array.from({ length: 500 }, a);
  const seqB = Array.from({ length: 500 }, b);
  const seqC = Array.from({ length: 500 }, c);
  check("same seed -> same sequence", seqA.every((v, i) => v === seqB[i]));
  check("different seed -> different sequence", seqA.some((v, i) => v !== seqC[i]));
  check("all values in [0,1)", seqA.every(v => v >= 0 && v < 1));

  const r = makeRnd(4242);
  const N = 100000;
  const bins = new Array(10).fill(0);
  let sum = 0;
  for (let i = 0; i < N; i++) { const v = r(); sum += v; bins[Math.floor(v * 10)]++; }
  check("mean ~ 0.5", Math.abs(sum / N - 0.5) < 0.01, sum / N);
  const worst = Math.max(...bins.map(b => Math.abs(b / N - 0.1)));
  check("uniform across 10 bins", worst < 0.01, worst.toFixed(4));
}

console.log(failures === 0 ? "\nAll checks passed." : "\n" + failures + " FAILED");
process.exit(failures === 0 ? 0 : 1);
