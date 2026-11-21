import { atVolume, atDraft, MODEL } from "@/data/hydro";
import { getZone, getInvalidIds } from "@/utils.js";

export const GRAVITY = 9.81;

export const WATER = { Fresh: 1000, Baltic: 1005, Ocean: 1025 };

export const LIMITS = {
  heel: 5,
  roll: 10,
  pitch: 10,
  trim: 3,
  freeboard: 0.03,
  cargoMin: 0.15,
  cargoMax: 0.4,
};

const radiansToDegrees = (radians) => (radians * 180) / Math.PI;

export function assess(hull, cargo, waterDensity, sea) {
  const deckTopHeight = hull.deckTop ?? hull.H;
  const cargoMass = cargo.reduce((sum, item) => sum + item.m, 0);
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

  const GML = hydrostatics.KB + hydrostatics.BML - gravityCenterZ;
  const trim =
    GML > 0
      ? radiansToDegrees(Math.atan((gravityCenterX - hydrostatics.LCB) / GML))
      : NaN;
  const pitchPeriod =
    GML > 0
      ? 2 * Math.PI * Math.sqrt((0.25 * hull.L) ** 2 / (GRAVITY * GML))
      : NaN;
  const pitchRatio = pitchPeriod / sea.Tw;
  const pitchAmplitude =
    GML > 0
      ? Math.min(
          20,
          waveSlope / Math.hypot(1 - pitchRatio ** 2, 0.2 * pitchRatio),
        )
      : NaN;
  const heavePeriod =
    2 *
    Math.PI *
    Math.sqrt((2 * totalMass) / (waterDensity * GRAVITY * hydrostatics.Awp));
  const heaveRatio = heavePeriod / sea.Tw;
  const heaveAmplitude =
    sea.Hw / 2 / Math.hypot(1 - heaveRatio ** 2, 0.6 * heaveRatio);

  const maxMass = atDraft(hull.H - LIMITS.freeboard).V * waterDensity;
  const maxCargo = Math.max(0, maxMass - hull.mass);
  const loadMargin = maxMass - hull.mass - cargoMass;
  const invalidCargoIds = getInvalidIds(cargo, getZone(hull));

  const alerts = [];
  if (sinks)
    alerts.push(["err", "Load exceeds the hulls' buoyancy: the vessel sinks"]);
  if (!isStable)
    alerts.push(["err", "GM is zero or negative: the vessel is unstable"]);
  if (hull.s - hull.b < 0.01)
    alerts.push([
      "err",
      "The hulls touch: the spacing must be larger than the hull width",
    ]);
  if (isStable && Math.abs(heelAngle) > LIMITS.heel)
    alerts.push([
      "err",
      `Heel ${heelAngle.toFixed(1)}° is above the ${LIMITS.heel}° limit`,
    ]);
  if (freeboard < LIMITS.freeboard)
    alerts.push([
      freeboard < 0 ? "err" : "warn",
      `Freeboard is only ${(freeboard * 1000).toFixed(0)} mm (limit ${LIMITS.freeboard * 1000} mm)`,
    ]);
  if (isStable && rollAmplitude > LIMITS.roll)
    alerts.push([
      "warn",
      `Simulated roll ${rollAmplitude.toFixed(1)}° is above ${LIMITS.roll}°`,
    ]);
  if (Number.isFinite(trim) && Math.abs(trim) > LIMITS.trim)
    alerts.push([
      "warn",
      `Trim ${trim.toFixed(1)}° is above the ${LIMITS.trim}° limit`,
    ]);
  if (invalidCargoIds.size)
    alerts.push(["err", "Some cargo overlaps or hangs over the deck edge"]);
  if (cargoMass > LIMITS.cargoMax + 1e-9)
    alerts.push(["warn", "Cargo is above the 400 g test range"]);
  if (cargo.length && cargoMass < LIMITS.cargoMin - 1e-9)
    alerts.push(["warn", "Cargo is below the 150 g test range"]);

  return {
    M: totalMass,
    cargoMass,
    xCG: gravityCenterX,
    yCG: gravityCenterY,
    zCG: gravityCenterZ,
    V: displacedVolume,
    draft,
    sinks,
    KB: hydrostatics.KB,
    BM: metacentricRadius,
    GM: metacentricHeight,
    heel: heelAngle,
    Tn: rollPeriod,
    roll: rollAmplitude,
    slope: waveSlope,
    drag: dragForce,
    freeboard,
    trim,
    GML,
    Tp: pitchPeriod,
    pitch: pitchAmplitude,
    Th: heavePeriod,
    heave: heaveAmplitude,
    maxCargo,
    loadMargin,
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
