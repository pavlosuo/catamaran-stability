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
  {
    id: 1795297104738,
    m: 0.05,
    l: 0.05,
    w: 0.05,
    h: 0.04,
    x: 0.0325,
    y: -0.0291,
    placed: true,
  },
  {
    id: 1795297105184,
    m: 0.05,
    l: 0.05,
    w: 0.05,
    h: 0.04,
    x: -0.0365,
    y: -0.0026,
    placed: true,
  },
];
