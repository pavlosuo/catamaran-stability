export const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");

export const val = (r, k) =>
  k === "heel" || k === "trim" ? Math.abs(r[k]) : r[k];

export const num = (x) => (x === "" || x == null ? NaN : +x);

export const pct = (calc, measured) =>
  measured > 0 ? ((calc - measured) / measured) * 100 : NaN;

export const avg = (a) =>
  a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;

export const rad = (d) => (d * Math.PI) / 180;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const DECK_Y = 0.01;

export function getZone(hull) {
  const base = hull.zone ?? {
    cx: hull.deckCx ?? 0,
    cy: 0,
    L: hull.deckL ?? hull.L,
    W: hull.deckW ?? hull.s + hull.b,
  };
  return { ...base, L: base.L, W: base.W - 2 * DECK_Y };
}

export function zoneLimits(zone, item) {
  const hx = Math.max(0, zone.L / 2 - item.l / 2);
  const hy = Math.max(0, zone.W / 2 - item.w / 2);
  return {
    xMin: zone.cx - hx,
    xMax: zone.cx + hx,
    yMin: zone.cy - hy,
    yMax: zone.cy + hy,
  };
}

export function overhangs(item, zone) {
  return (
    Math.abs(item.x - zone.cx) + item.l / 2 > zone.L / 2 + 1e-9 ||
    Math.abs(item.y - zone.cy) + item.w / 2 > zone.W / 2 + 1e-9
  );
}

export function overlaps(a, b, gap = 0) {
  return (
    Math.abs(a.x - b.x) < (a.l + b.l) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.w + b.w) / 2 + gap
  );
}

export function getInvalidIds(cargo, zone) {
  const bad = new Set();
  cargo.forEach((item, index) => {
    if (overhangs(item, zone)) bad.add(item.id);
    cargo.slice(index + 1).forEach((other) => {
      if (overlaps(item, other)) {
        bad.add(item.id);
        bad.add(other.id);
      }
    });
  });
  return bad;
}

export function constrainMove(cargo, id, x, y, zone, gap = 0.002) {
  const item = cargo.find((c) => c.id === id);
  if (!item) return { x, y };
  const lim = zoneLimits(zone, item);
  const nx = clamp(x, lim.xMin, lim.xMax);
  const ny = clamp(y, lim.yMin, lim.yMax);
  const others = cargo.filter((c) => c.id !== id);
  const free = (px, py) =>
    !others.some((o) => overlaps({ ...item, x: px, y: py }, o, gap));
  if (free(nx, ny)) return { x: nx, y: ny };
  if (free(nx, item.y)) return { x: nx, y: item.y };
  if (free(item.x, ny)) return { x: item.x, y: ny };
  return { x: item.x, y: item.y };
}

export function freeSpot(zone, cargo, box, gap = 0.002, step = 0.005) {
  const lim = zoneLimits(zone, box);
  let best = null;
  for (let x = lim.xMin; x < lim.xMax + step; x += step) {
    for (let y = lim.yMin; y < lim.yMax + step; y += step) {
      const cx = Math.min(x, lim.xMax);
      const cy = Math.min(y, lim.yMax);
      const cand = { ...box, x: cx, y: cy };
      if (cargo.some((o) => overlaps(cand, o, gap))) continue;
      const d = Math.hypot(cx - zone.cx, cy - zone.cy);
      if (!best || d < best.d) best = { x: cx, y: cy, d };
    }
  }
  return best
    ? {
        x: Math.round(best.x * 1e4) / 1e4,
        y: Math.round(best.y * 1e4) / 1e4,
      }
    : null;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round4 = (v) => Math.round(v * 1e4) / 1e4;

function gridCells(zone, cargo, gap) {
  const EDGE = 1e-4;
  const maxL = Math.max(...cargo.map((c) => c.l));
  const maxW = Math.max(...cargo.map((c) => c.w));
  const L = zone.L - 2 * EDGE - 0.02;
  const W = zone.W - 2 * EDGE;
  const cols = Math.floor((L + gap) / (maxL + gap));
  const rows = Math.floor((W + gap) / (maxW + gap));
  const cells = [];
  if (cols < 1 || rows < 1) return { cols: 0, rows: 0, cells };
  const px = cols > 1 ? (L - maxL) / (cols - 1) : 0;
  const py = rows > 1 ? (W - maxW) / (rows - 1) : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: cols > 1 ? zone.cx - L / 2 + maxL / 2 + c * px : zone.cx,
        y: rows > 1 ? zone.cy - W / 2 + maxW / 2 + r * py : zone.cy,
      });
    }
  }
  return { cols, rows, cells };
}

export function deckCapacity(zone, cargo, gap = 0.002) {
  if (!cargo.length) return 0;
  return gridCells(zone, cargo, gap).cells.length;
}

function gridLayout(hull, cargo, zone, gap, target) {
  const n = cargo.length;
  const { cells } = gridCells(zone, cargo, gap);
  if (cells.length < n) return null;
  const rnd = mulberry32(2007);
  let best = null;
  for (let t = 0; t < 4000; t++) {
    const order = cells.map((_, i) => i);
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    let M = hull.mass;
    let mx = hull.mass * hull.cg.x;
    let my = hull.mass * hull.cg.y;
    for (let i = 0; i < n; i++) {
      const cell = cells[order[i]];
      M += cargo[i].m;
      mx += cargo[i].m * cell.x;
      my += cargo[i].m * cell.y;
    }
    const score = 2 * Math.abs(my / M - target.y) + Math.abs(mx / M - target.x);
    if (!best || score < best.score) best = { order, score };
  }
  return cargo.map((c, i) => {
    const cell = cells[best.order[i]];
    return { ...c, x: round4(cell.x), y: round4(cell.y), placed: true };
  });
}

function cgScoreOf(hull, list, target) {
  let M = hull.mass;
  let mx = hull.mass * hull.cg.x;
  let my = hull.mass * hull.cg.y;
  for (const c of list) {
    M += c.m;
    mx += c.m * c.x;
    my += c.m * c.y;
  }
  return 2 * Math.abs(my / M - target.y) + Math.abs(mx / M - target.x);
}

function randomLayout(hull, cargo, zone, gap, target, tries = 20000) {
  const EDGE = 1e-4;
  const grid = 0.0005;
  const rnd = mulberry32(4242);
  const lims = cargo.map((c) => zoneLimits(zone, c));
  if (
    lims.some((l) => l.xMax - l.xMin < 2 * EDGE || l.yMax - l.yMin < 2 * EDGE)
  )
    return null;
  const pick = (a, b) => a + Math.floor((rnd() * (b - a)) / grid) * grid;
  let best = null;
  for (let t = 0; t < tries; t++) {
    const pos = [];
    let ok = true;
    for (let i = 0; i < cargo.length && ok; i++) {
      const c = cargo[i];
      const l = lims[i];
      const x = pick(l.xMin + EDGE, l.xMax - EDGE);
      const y = pick(l.yMin + EDGE, l.yMax - EDGE);
      ok = !pos.some((p, j) =>
        overlaps(
          { x, y, l: c.l, w: c.w },
          { x: p.x, y: p.y, l: cargo[j].l, w: cargo[j].w },
          gap,
        ),
      );
      if (ok) pos.push({ x, y });
    }
    if (!ok) continue;
    const score = cgScoreOf(
      hull,
      cargo.map((c, i) => ({ m: c.m, x: pos[i].x, y: pos[i].y })),
      target,
    );
    if (!best || score < best.score) best = { pos, score };
  }
  return (
    best &&
    cargo.map((c, i) => ({
      ...c,
      x: round4(best.pos[i].x),
      y: round4(best.pos[i].y),
      placed: true,
    }))
  );
}

export function suggestLayout(hull, cargo, opts = {}) {
  const zone = opts.zone ?? getZone(hull);
  const {
    gap = 0.001,
    step = 0.005,
    target = { x: 0, y: 0 },
    tries = 200,
  } = opts;
  const EDGE = 1e-4;
  const n = cargo.length;
  const cgScore = (cgx, cgy) =>
    2 * Math.abs(cgy - target.y) + Math.abs(cgx - target.x);

  function tryOrder(order) {
    const placed = [];
    const pos = new Array(n).fill(null);
    let M = hull.mass;
    let mx = hull.mass * hull.cg.x;
    let my = hull.mass * hull.cg.y;

    for (const i of order) {
      const c = cargo[i];
      const lim = zoneLimits(zone, c);
      const xLo = lim.xMin + EDGE,
        xHi = lim.xMax - EDGE;
      const yLo = lim.yMin + EDGE,
        yHi = lim.yMax - EDGE;
      if (xHi < xLo || yHi < yLo) continue;
      const xs = new Set([xLo, xHi, zone.cx]);
      const ys = new Set([yLo, yHi, zone.cy]);
      for (let x = xLo; x <= xHi; x += step) xs.add(x);
      for (let y = yLo; y <= yHi; y += step) ys.add(y);
      for (const p of placed) {
        const dx = (c.l + p.l) / 2 + gap + EDGE;
        const dy = (c.w + p.w) / 2 + gap + EDGE;
        xs.add(p.x - dx);
        xs.add(p.x + dx);
        ys.add(p.y - dy);
        ys.add(p.y + dy);
        xs.add(p.x - p.l / 2 + c.l / 2);
        xs.add(p.x + p.l / 2 - c.l / 2);
        ys.add(p.y - p.w / 2 + c.w / 2);
        ys.add(p.y + p.w / 2 - c.w / 2);
      }
      const X = [...xs].filter((x) => x >= xLo && x <= xHi);
      const Y = [...ys].filter((y) => y >= yLo && y <= yHi);

      let best = null;
      for (const x of X) {
        for (const y of Y) {
          const cand = { x, y, l: c.l, w: c.w };
          if (placed.some((p) => overlaps(cand, p, gap))) continue;
          const score = cgScore(
            (mx + c.m * x) / (M + c.m),
            (my + c.m * y) / (M + c.m),
          );
          if (!best || score < best.score) best = { x, y, score };
        }
      }
      if (!best) continue;

      const fin = {
        x: Math.round(best.x * 1e4) / 1e4,
        y: Math.round(best.y * 1e4) / 1e4,
      };
      placed.push({ i, ...fin, l: c.l, w: c.w });
      pos[i] = fin;
      M += c.m;
      mx += c.m * fin.x;
      my += c.m * fin.y;
    }
    return { pos, count: placed.length, score: cgScore(mx / M, my / M) };
  }

  const idx = cargo.map((_, i) => i);
  const area = (i) => cargo[i].l * cargo[i].w;
  const orders = [
    [...idx].sort((a, b) => area(b) - area(a) || cargo[b].m - cargo[a].m),
    [...idx].sort((a, b) => cargo[b].m - cargo[a].m || area(b) - area(a)),
    [...idx].sort((a, b) => area(a) - area(b)),
  ];

  const rnd = mulberry32(1101202);

  for (let t = 0; t < tries; t++) {
    const o = [...idx];
    for (let k = o.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [o[k], o[j]] = [o[j], o[k]];
    }
    orders.push(o);
  }

  let best = null;
  for (const o of orders) {
    const r = tryOrder(o);
    if (
      !best ||
      r.count > best.count ||
      (r.count === best.count && r.score < best.score)
    ) {
      best = r;
    }
    if (best.count === n && best.score < 1e-4) break;
  }

  let px = zone.cx - zone.L / 2;
  const outY = zone.cy + zone.W / 2 + 0.2;
  const greedyOut = cargo.map((c, i) => {
    if (best.pos[i]) return { ...c, ...best.pos[i], placed: true };
    const out = { ...c, x: px + c.l / 2, y: outY + c.w / 2, placed: false };
    px += c.l + 0.02;
    return out;
  });

  const candidates = [
    greedyOut,
    randomLayout(hull, cargo, zone, gap, target),
    gridLayout(hull, cargo, zone, gap, target),
  ].filter(Boolean);
  const rank = (out) => {
    const placed = out.filter((c) => c.placed);
    return { count: placed.length, score: cgScoreOf(hull, placed, target) };
  };
  return candidates
    .map((out) => ({ out, ...rank(out) }))
    .sort((a, b) => b.count - a.count || a.score - b.score)[0].out;
}
