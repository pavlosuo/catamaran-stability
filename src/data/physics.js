import { atVolume, MODEL } from "@/data/hydro";

export const GRAVITY = 9.81;

export const WATER = { Fresh: 1000, Baltic: 1005, Ocean: 1025 };

const radiansToDegrees = (radians) => (radians * 180) / Math.PI;

export function assess(hull, cargo, waterDensity, sea) {
  const deckTopHeight = hull.deckTop ?? hull.H;
  const massPoints = [
    { mass: hull.mass, ...hull.cg },
    ...cargo.map((item) => ({
      mass: item.m,
      x: item.x,
      y: item.y,
      z: deckTopHeight + item.h / 2,
    })),
  ];
  const totalMass = massPoints.reduce((sum, point) => sum + point.mass, 0);
  const [gravityCenterX, gravityCenterY, gravityCenterZ] = ["x", "y", "z"].map(
    (axis) =>
      massPoints.reduce((sum, point) => sum + point.mass * point[axis], 0) /
      totalMass,
  );

  const displacedVolume = totalMass / waterDensity;
  const hydrostatics = atVolume(displacedVolume);
  const draft = hydrostatics.draft;
  const sinks = Boolean(hydrostatics.overflow);
  const spacingInertiaShift =
    hydrostatics.Awp * ((hull.s / 2) ** 2 - (MODEL.dims.s / 2) ** 2);
  const metacentricRadius =
    hydrostatics.BM + spacingInertiaShift / displacedVolume;
  const metacentricHeight =
    hydrostatics.KB + metacentricRadius - gravityCenterZ;

  const isStable = metacentricHeight > 0;
  const heelAngle = isStable
    ? radiansToDegrees(Math.atan(gravityCenterY / metacentricHeight))
    : NaN;
  const rollPeriod = isStable
    ? 2 *
      Math.PI *
      Math.sqrt((0.4 * (hull.s + hull.b)) ** 2 / (GRAVITY * metacentricHeight))
    : NaN;
  const waveLength = (GRAVITY * sea.Tw ** 2) / (2 * Math.PI);
  const waveSlope = radiansToDegrees(
    Math.atan((Math.PI * sea.Hw) / waveLength),
  );
  const periodRatio = rollPeriod / sea.Tw;
  const rollAmplitude = isStable
    ? Math.min(
        30,
        waveSlope / Math.hypot(1 - periodRatio ** 2, 0.2 * periodRatio),
      )
    : NaN;
  const dragForce =
    0.5 * waterDensity * sea.Cd * (2 * hull.b * draft) * sea.v ** 2;
  const freeboard = hull.H - draft;

  const deckLength = hull.deckL ?? hull.L;
  const deckWidth = hull.deckW ?? hull.s + hull.b;
  const deckCenterX = hull.deckCx ?? 0;
  const invalidCargoIds = new Set();
  cargo.forEach((item, index) => {
    const overhangs =
      Math.abs(item.x - deckCenterX) + item.l / 2 > deckLength / 2 ||
      Math.abs(item.y) + item.w / 2 > deckWidth / 2;
    if (overhangs) invalidCargoIds.add(item.id);
    cargo.slice(index + 1).forEach((other) => {
      const overlaps =
        Math.abs(item.x - other.x) < (item.l + other.l) / 2 &&
        Math.abs(item.y - other.y) < (item.w + other.w) / 2;
      if (overlaps) {
        invalidCargoIds.add(item.id);
        invalidCargoIds.add(other.id);
      }
    });
  });

  const alerts = [];
  if (sinks)
    alerts.push(["err", "Load exceeds the hulls' buoyancy: the vessel sinks"]);
  if (!isStable)
    alerts.push(["err", "GM is zero or negative: the vessel is unstable"]);
  if (isStable && Math.abs(heelAngle) > 5)
    alerts.push(["err", `Heel ${heelAngle.toFixed(1)}° is above the 5° limit`]);
  if (freeboard < 0.03)
    alerts.push([
      freeboard < 0 ? "err" : "warn",
      `Freeboard is only ${(freeboard * 1000).toFixed(0)} mm`,
    ]);
  if (isStable && rollAmplitude > 10)
    alerts.push([
      "warn",
      `Simulated roll ${rollAmplitude.toFixed(1)}° is above 10°`,
    ]);
  if (invalidCargoIds.size)
    alerts.push(["err", "Some cargo overlaps or hangs over the deck edge"]);
  if (totalMass - hull.mass > 0.4)
    alerts.push(["warn", "Cargo is above the 400 g test range"]);

  return {
    M: totalMass,
    xCG: gravityCenterX,
    yCG: gravityCenterY,
    zCG: gravityCenterZ,
    V: displacedVolume,
    draft,
    KB: hydrostatics.KB,
    BM: metacentricRadius,
    GM: metacentricHeight,
    heel: heelAngle,
    Tn: rollPeriod,
    roll: rollAmplitude,
    slope: waveSlope,
    drag: dragForce,
    freeboard,
    bad: invalidCargoIds,
    alerts,
  };
}

export const rollSeries = (result, sea, pointCount = 140) =>
  Array.from({ length: pointCount }, (_, index) => {
    const time = (index / (pointCount - 1)) * sea.Tw * 4;
    const heelAngle = Number.isFinite(result.heel) ? result.heel : 0;
    const rollAmplitude = Number.isFinite(result.roll) ? result.roll : 0;
    return [
      time,
      heelAngle + rollAmplitude * Math.sin((2 * Math.PI * time) / sea.Tw),
    ];
  });
