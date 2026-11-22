import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { assess, LIMITS } from "@/data/physics";
import { ROUTES, evalRoute, densityColor } from "@/data/routes";
import { f } from "@/utils";

function RouteMap({ selected, onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const pick = useRef(onSelect);
  pick.current = onSelect;

  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 10,
      attribution: "© OpenStreetMap contributors",
    }).addTo(m);
    const all = ROUTES.flatMap((r) => r.pts.map((p) => [p.lat, p.lon]));
    m.fitBounds(L.latLngBounds(all), { padding: [20, 20] });
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    const g = layer.current;
    g.clearLayers();
    ROUTES.forEach((r) => {
      const on = r.id === selected;
      r.pts.slice(1).forEach((p, i) => {
        const a = r.pts[i];
        L.polyline(
          [
            [a.lat, a.lon],
            [p.lat, p.lon],
          ],
          {
            color: densityColor((a.rho + p.rho) / 2),
            weight: on ? 7 : 3,
            opacity: on ? 1 : 0.55,
          },
        )
          .on("click", () => pick.current(r.id))
          .addTo(g);
      });
      r.pts.forEach((p) => {
        L.circleMarker([p.lat, p.lon], {
          radius: on ? 5 : 3,
          color: "#0b1b33",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(
            `${p.name}: ${p.S} PSU, ${p.rho.toFixed(1)} kg/m³ (estimated)`,
          )
          .addTo(g);
      });
    });
  }, [selected]);

  return (
    <div
      ref={el}
      role="img"
      aria-label="Map of routes coloured by water density"
      style={{ height: 380, borderRadius: 12, overflow: "hidden" }}
    />
  );
}

export function RoutePlanner({ hull, cargo, env }) {
  const [sel, setSel] = useState("got");
  const rows = useMemo(
    () =>
      ROUTES.map((r) => ({
        r,
        ...evalRoute(r, (rho) => assess(hull, cargo, rho, env)),
      })),
    [hull, cargo, env],
  );
  const cur = rows.find((x) => x.r.id === sel);
  const best = rows
    .filter((x) => x.status === "GO")
    .sort((a, b) => a.km - b.km)[0];

  return (
    <>
      <section className="card">
        <h2>Route planner</h2>
        <RouteMap selected={sel} onSelect={setSel} />
        <p className="hint">
          Click a route to select it. Salinity and density are estimated typical
          values; waypoints are schematic, not for navigation.
        </p>
      </section>
      <section className="card compare">
        <h2>Compare routes for the current load</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Distance</th>
                <th>Density</th>
                <th>Draft</th>
                <th>Min freeboard</th>
                <th>Load margin</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr
                  key={x.r.id}
                  className={x.r.id === sel ? "sel" : ""}
                  onClick={() => setSel(x.r.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{x.r.name}</td>
                  <td>{f(x.km, 0)} km</td>
                  <td>
                    {f(x.rhoMin, 1)}–{f(x.rhoMax, 1)} kg/m³
                  </td>
                  <td>
                    {f(x.draftMin * 1000, 2)}–{f(x.draftMax * 1000, 2)} mm
                  </td>
                  <td>{f(x.freeboardMin * 1000, 1)} mm</td>
                  <td className={x.margin >= 0 ? "good" : "worse"}>
                    {x.margin > 0 ? "+" : ""}
                    {f(x.margin * 1000, 0)} g
                  </td>
                  <td>
                    <span
                      className={`badge ${x.status.toLowerCase().replace("-", "")}`}
                    >
                      {x.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Draft is for the model vessel (calculated), using the lightest water
          on each route because it gives the deepest draft. Load margin is how
          much more cargo fits before freeboard drops to{" "}
          {LIMITS.freeboard * 1000} mm.
        </p>
      </section>
      <section className="card">
        <h2>Decision support</h2>
        {cur && (
          <p>
            <strong>{cur.r.name}:</strong> {f(cur.km, 0)} km. Draft changes by{" "}
            {f((cur.draftMax - cur.draftMin) * 1000, 2)} mm between the densest
            and the lightest water on this route.{" "}
            {cur.status === "GO" &&
              `Safe with this load. You can add about ${f(cur.margin * 1000, 0)} g more.`}
            {cur.status === "CAUTION" &&
              `Freeboard drops below ${LIMITS.freeboard * 1000} mm. Remove about ${f(-cur.margin * 1000, 0)} g.`}
            {cur.status === "NO-GO" &&
              "The vessel would sink in the lightest water on this route. Reduce the load."}
          </p>
        )}
        <p>
          {best
            ? `Recommended: ${best.r.name}, the shortest route that keeps the freeboard limit in the lightest water.`
            : "No route keeps the freeboard limit with this cargo. Reduce the load."}
        </p>
      </section>
    </>
  );
}
