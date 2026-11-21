import data from "@/data/hullData.json";

const T = data.hydro;

function lerp(a, b, k) {
  const o = {};
  for (const key of Object.keys(a)) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
}

export function atVolume(V) {
  if (!(V > 0)) return { ...T[0] };
  const last = T[T.length - 1];
  if (V >= last.V) return { ...last, overflow: true };
  let i = 1;
  while (T[i].V < V) i++;
  const k = (V - T[i - 1].V) / (T[i].V - T[i - 1].V);
  return lerp(T[i - 1], T[i], k);
}

export const atMass = (M, rho) => atVolume(M / rho);

export function GM(M, rho, KG) {
  const h = atMass(M, rho);
  return h.KB + h.BM - KG;
}

export const MODEL = data;
