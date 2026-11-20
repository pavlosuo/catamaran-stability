export const G = 9.81;
export const WATER = { Fresh: 1000, Baltic: 1005, Ocean: 1025 };

const deg = (r) => (r * 180) / Math.PI;

export function assess(h, cargo, rho, env) {
  const items = [
    { m: h.mass, ...h.cg },
    ...cargo.map((c) => ({ m: c.m, x: c.x, y: c.y, z: h.H + c.h / 2 })),
  ];
  const M = items.reduce((a, i) => a + i.m, 0);
  const [xCG, yCG, zCG] = ["x", "y", "z"].map(
    (k) => items.reduce((a, i) => a + i.m * i[k], 0) / M,
  );
  const V = M / rho;
  const draft = V / (h.Cb * 2 * h.L * h.b);
  const It = 2 * ((h.L * h.b ** 3) / 12 + h.L * h.b * (h.s / 2) ** 2);
  const GM = draft / 2 + It / V - zCG;
  const ok = GM > 0;
  const heel = ok ? deg(Math.atan(yCG / GM)) : NaN;
  const Tn = ok
    ? 2 * Math.PI * Math.sqrt((0.4 * (h.s + h.b)) ** 2 / (G * GM))
    : NaN;
  const lam = (G * env.Tw ** 2) / (2 * Math.PI);
  const slope = deg(Math.atan((Math.PI * env.Hw) / lam));
  const r = Tn / env.Tw;
  const roll = ok ? Math.min(30, slope / Math.hypot(1 - r * r, 0.2 * r)) : NaN;
  const drag = 0.5 * rho * env.Cd * (2 * h.b * draft) * env.v ** 2;
  const freeboard = h.H - draft;
  const W = h.s + h.b;
  const bad = new Set();
  cargo.forEach((c, i) => {
    if (Math.abs(c.x) + c.l / 2 > h.L / 2 || Math.abs(c.y) + c.w / 2 > W / 2)
      bad.add(c.id);
    cargo.slice(i + 1).forEach((d) => {
      if (
        Math.abs(c.x - d.x) < (c.l + d.l) / 2 &&
        Math.abs(c.y - d.y) < (c.w + d.w) / 2
      ) {
        bad.add(c.id);
        bad.add(d.id);
      }
    });
  });
  const alerts = [];
  if (!ok)
    alerts.push(["err", "GM is zero or negative: the vessel is unstable"]);
  if (ok && Math.abs(heel) > 5)
    alerts.push(["err", `Heel ${heel.toFixed(1)}° is above the 5° limit`]);
  if (freeboard < 0.03)
    alerts.push([
      freeboard < 0 ? "err" : "warn",
      `Freeboard is only ${(freeboard * 1000).toFixed(0)} mm`,
    ]);
  if (ok && roll > 10)
    alerts.push(["warn", `Simulated roll ${roll.toFixed(1)}° is above 10°`]);
  if (bad.size)
    alerts.push(["err", "Some cargo overlaps or hangs over the deck edge"]);
  if (M - h.mass > 0.4)
    alerts.push(["warn", "Cargo is above the 400 g test range"]);
  return {
    M,
    xCG,
    yCG,
    zCG,
    V,
    draft,
    GM,
    heel,
    Tn,
    roll,
    slope,
    drag,
    freeboard,
    bad,
    alerts,
  };
}

export const rollSeries = (r, env, n = 140) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * env.Tw * 4;
    return [
      t,
      (Number.isFinite(r.heel) ? r.heel : 0) +
        (Number.isFinite(r.roll) ? r.roll : 0) *
          Math.sin((2 * Math.PI * t) / env.Tw),
    ];
  });
