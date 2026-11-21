import { LIMITS } from "@/data/physics";

export const rhoFromSalinity = (S) => 999.8 + 0.78 * S;

const P = (name, lat, lon, S) => ({
  name,
  lat,
  lon,
  S,
  rho: rhoFromSalinity(S),
});

export const ROUTES = [
  {
    id: "hel",
    name: "Turku → Helsinki",
    pts: [
      P("Turku", 60.45, 22.27, 5.5),
      P("Hanko", 59.8, 22.9, 5.8),
      P("Helsinki", 60.17, 24.94, 4.6),
    ],
  },
  {
    id: "sto",
    name: "Turku → Stockholm",
    pts: [
      P("Turku", 60.45, 22.27, 5.5),
      P("Åland Sea", 59.9, 20.0, 5.8),
      P("Stockholm", 59.33, 18.07, 5.0),
    ],
  },
  {
    id: "gda",
    name: "Turku → Gdańsk",
    pts: [
      P("Turku", 60.45, 22.27, 5.5),
      P("Åland Sea", 59.8, 21.2, 5.8),
      P("Northern Baltic Proper", 58.0, 19.8, 6.7),
      P("Southern Baltic Proper", 55.8, 19.2, 7.1),
      P("Gdańsk", 54.4, 18.7, 7.0),
    ],
  },
  {
    id: "cph",
    name: "Turku → Copenhagen",
    pts: [
      P("Turku", 60.45, 22.27, 5.5),
      P("Baltic Proper", 58.5, 20.2, 6.5),
      P("Baltic Proper South", 56.0, 17.3, 7.2),
      P("Bornholm", 55.2, 14.6, 7.8),
      P("Copenhagen", 55.68, 12.6, 9.5),
    ],
  },
  {
    id: "got",
    name: "Turku → Gothenburg",
    pts: [
      P("Turku", 60.45, 22.27, 5.5),
      P("Baltic Proper", 58.5, 20.2, 6.5),
      P("Baltic Proper South", 56.0, 17.3, 7.2),
      P("Bornholm", 55.2, 14.6, 7.8),
      P("Øresund", 55.9, 12.7, 10.5),
      P("Kattegat", 57.2, 11.8, 20),
      P("Gothenburg", 57.7, 11.9, 22),
    ],
  },
];

const rad = (d) => (d * Math.PI) / 180;

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const routeKm = (route) =>
  route.pts
    .slice(1)
    .reduce((sum, p, i) => sum + distanceKm(route.pts[i], p), 0);

export function evalRoute(route, run) {
  const rhos = route.pts.map((p) => p.rho);
  const rhoMin = Math.min(...rhos);
  const rhoMax = Math.max(...rhos);
  const worst = run(rhoMin);
  const best = run(rhoMax);

  let status = "GO";
  if (worst.sinks || worst.freeboard < 0) status = "NO-GO";
  else if (worst.freeboard < LIMITS.freeboard) status = "CAUTION";

  return {
    km: routeKm(route),
    rhoMin,
    rhoMax,
    draftMax: worst.draft,
    draftMin: best.draft,
    freeboardMin: worst.freeboard,
    margin: worst.loadMargin,
    status,
  };
}

export function densityColor(rho) {
  const t = Math.min(1, Math.max(0, (rho - 1003) / 24));
  return `hsl(${Math.round(50 + t * 170)}, 85%, 45%)`;
}
