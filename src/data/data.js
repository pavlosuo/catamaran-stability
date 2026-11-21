import { MODEL } from "@/data/hydro";

const D = MODEL.dims;

const hull = (name, s, mass = MODEL.empty.mass_kg, cgZ = MODEL.empty.cg.z) => ({
  name,
  L: D.Ltotal,
  b: D.b,
  H: D.H,
  s,
  deckTop: D.deckTop,
  deckL: D.deckL,
  deckW: D.deckW,
  deckCx: D.deckCenter.x,
  Cb: 0.7,
  mass,
  cg: { ...MODEL.empty.cg, z: cgZ },
});

export const HULLS = {
  A: hull("A Main", D.s, 0.81, 0.09),
  B: hull("B Wider", 0.3, 0.79, 0.085),
};

export const CARGO = [
  { id: 1, m: 0.15, l: 0.05, w: 0.05, h: 0.04, x: -0.035, y: 0.04 },
  { id: 2, m: 0.1, l: 0.04, w: 0.04, h: 0.04, x: 0.035, y: 0.04 },
  { id: 3, m: 0.15, l: 0.05, w: 0.05, h: 0.05, x: 0.0, y: -0.04 },
];
