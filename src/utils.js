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

export function suggestLayout(hull, cargo) {
  const deckL = hull.deckL ?? hull.L;
  const deckW = hull.deckW ?? hull.s + hull.b;
  const deckCx = hull.deckCx ?? 0;
  const step = 0.005;
  const gap = 0.002;
  const placed = [];
  let mTotal = hull.mass;
  let mx = hull.mass * hull.cg.x;
  let my = hull.mass * hull.cg.y;
  const order = [...cargo].sort((a, b) => b.m - a.m);

  for (const c of order) {
    let best = null;
    const xMin = deckCx - deckL / 2 + c.l / 2 + 1e-6;
    const xMax = deckCx + deckL / 2 - c.l / 2 - 1e-6;
    const yMin = -deckW / 2 + c.w / 2 + 1e-6;
    const yMax = deckW / 2 - c.w / 2 - 1e-6;

    for (let x = xMin; x <= xMax; x += step) {
      for (let y = yMin; y <= yMax; y += step) {
        const clash = placed.some(
          (p) =>
            Math.abs(x - p.x) < (c.l + p.l) / 2 + gap &&
            Math.abs(y - p.y) < (c.w + p.w) / 2 + gap,
        );
        if (clash) continue;
        const cgx = (mx + c.m * x) / (mTotal + c.m);
        const cgy = (my + c.m * y) / (mTotal + c.m);
        const score = 2 * Math.abs(cgy) + Math.abs(cgx);
        if (!best || score < best.score) best = { x, y, score };
      }
    }

    const pos = best
      ? {
          x: Math.round(best.x * 1e4) / 1e4,
          y: Math.round(best.y * 1e4) / 1e4,
        }
      : { x: c.x, y: c.y };
    placed.push({ ...c, ...pos });
    mTotal += c.m;
    mx += c.m * pos.x;
    my += c.m * pos.y;
  }

  return cargo.map((c) => placed.find((p) => p.id === c.id));
}
