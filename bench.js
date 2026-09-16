/* Frame-cost benchmark for computeCells() at various line counts.
 * Run: node bench.js   (geometry copied from lines.html) */

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
  let a = 0, px = poly[(m - 1) * 2], py = poly[(m - 1) * 2 + 1];
  for (let i = 0; i < m; i++) {
    const x = poly[i * 2], y = poly[i * 2 + 1];
    a += px * y - x * py; px = x; py = y;
  }
  return Math.abs(a) * 0.5;
}

const AREA_EPS = 1e-4;
// window 1920x1080 + 45% universe padding on each side
const W = 1920, H = 1080, PX = W * 0.45, PY = H * 0.45;
const B = { x0: -PX, y0: -PY, x1: W + PX, y1: H + PY };

function computeCells(lines) {
  let cells = [{ poly: [B.x0, B.y0, B.x1, B.y0, B.x1, B.y1, B.x0, B.y1], key: "" }];
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

function makeLines(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: -W * 0.1 + Math.random() * W * 1.2,
      y: -H * 0.1 + Math.random() * H * 1.2,
      th: Math.random() * Math.PI * 2
    });
  }
  return out;
}

console.log("universe " + (B.x1 - B.x0).toFixed(0) + "x" + (B.y1 - B.y0).toFixed(0) +
            " (1920x1080 window)\n");
console.log(" lines   faces   ms/frame   budget@60fps");
for (const n of [14, 40, 60, 80, 100, 120]) {
  const sets = [];
  for (let i = 0; i < 20; i++) sets.push(makeLines(n));
  computeCells(sets[0]);                       // warm up
  let faces = 0;
  const t0 = process.hrtime.bigint();
  const REPS = 20;
  for (let r = 0; r < REPS; r++) faces = computeCells(sets[r % sets.length]).length;
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6 / REPS;
  console.log(
    String(n).padStart(6) +
    String(faces).padStart(8) +
    ms.toFixed(2).padStart(11) +
    (" " + (ms / 16.67 * 100).toFixed(0) + "%").padStart(15)
  );
}
