import { useMemo, useState } from "react";
import { assess, rollSeries, WATER } from "@/data/physics";
import { Scene } from "@/Scene";
import { parseSensor, analyze } from "@/data/motion";
import { HULLS, CARGO } from "@/data/data";
import { suggestLayout, f, val, pct, num, getInvalidIds, getZone } from "@/utils";
import { Dashboard } from "@/Dashboard";
import { RoutePlanner } from "@/RoutePlanner";
import { clsx } from "clsx";

const ROWS = [
  ["Total mass", "M", 1000, 0, "g", null],
  ["Draft", "draft", 1000, 1, "mm", "lower"],
  ["Freeboard", "freeboard", 1000, 1, "mm", "higher"],
  ["Load margin", "loadMargin", 1000, 0, "g", "higher"],
  ["Metacentric height GM", "GM", 1000, 0, "mm", "higher"],
  ["Heel", "heel", 1, 2, "°", "lower"],
  ["Roll amplitude", "roll", 1, 1, "°", "lower"],
  ["Roll period", "Tn", 1, 2, "s", null],
  ["Trim", "trim", 1, 2, "°", "lower"],
  ["Pitch amplitude", "pitch", 1, 1, "°", "lower"],
  ["Heave amplitude", "heave", 1000, 1, "mm", "lower"],
  ["Drag", "drag", 1, 3, "N", "lower"],
];

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map(([k, text]) => (
        <button
          key={k}
          role="tab"
          aria-selected={k === value}
          className={k === value ? "on" : ""}
          onClick={() => onChange(k)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Num({
  label,
  unit,
  value,
  scale = 1000,
  onChange,
  disabled,
  className,
}) {
  return (
    <label className={clsx("num", className)}>
      <span>{label}</span>
      <input
        type="number"
        disabled={disabled}
        value={+(value * scale).toFixed(3)}
        onChange={(e) => onChange(+e.target.value / scale)}
      />
      <em>{unit}</em>
    </label>
  );
}

function RollChart({ r, env }) {
  const pts = rollSeries(r, env);
  const W = 640,
    H = 200,
    L = 44,
    R = 12,
    T = 14,
    B = 28;
  const m = Math.max(5, ...pts.map((p) => Math.abs(p[1])));
  const tMax = env.Tw * 4;
  const X = (t) => L + (t / tMax) * (W - L - R);
  const Y = (a) => T + (H - T - B) / 2 - (a / m) * ((H - T - B) / 2);
  const line = pts
    .map(([t, a], i) => `${i ? "L" : "M"}${X(t).toFixed(1)},${Y(a).toFixed(1)}`)
    .join("");
  const mid = Y(0);
  const area = `${line}L${X(pts[pts.length - 1]?.[0] ?? tMax)},${mid}L${X(0)},${mid}Z`;
  const ticks = [-m, 0, m];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Simulated roll">
      {ticks.map((v) => (
        <g key={v}>
          <line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
          <text className="tick" x={L - 8} y={Y(v) + 4} textAnchor="end">
            {v > 0 ? "+" : ""}
            {f(v, 0)}°
          </text>
        </g>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <text
          key={i}
          className="tick"
          x={X((tMax / 4) * i)}
          y={H - 8}
          textAnchor="middle"
        >
          {f((tMax / 4) * i, 0)} s
        </text>
      ))}
      <path className="area" d={area} />
      <path className="trace" d={line} />
    </svg>
  );
}

function LineChart({ pts, marks = [], xLabel, yLabel }) {
  const W = 320,
    H = 170,
    L = 46,
    R = 12,
    T = 14,
    B = 30;
  const good = pts.filter((p) => Number.isFinite(p[1]));
  if (good.length < 2) return <p className="hint">No stable points to plot.</p>;
  const x0 = good[0][0],
    x1 = good[good.length - 1][0];
  const ys = good.map((p) => p[1]);
  const y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
  const line = good
    .map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`)
    .join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={yLabel}>
      <path d={line} fill="none" stroke="#0a6cff" strokeWidth="2" />
      <text
        x={L - 6}
        y={Y(y1) + 4}
        textAnchor="end"
        fontSize="11"
        fill="currentColor"
      >
        {f(y1, 2)}
      </text>
      <text
        x={L - 6}
        y={Y(y0) + 4}
        textAnchor="end"
        fontSize="11"
        fill="currentColor"
      >
        {f(y0, 2)}
      </text>
      <text x={L} y={H - 14} fontSize="11" fill="currentColor">
        {f(x0, 0)}
      </text>
      <text
        x={W - R}
        y={H - 14}
        textAnchor="end"
        fontSize="11"
        fill="currentColor"
      >
        {f(x1, 0)}
      </text>
      <text
        x={(L + W - R) / 2}
        y={H - 2}
        textAnchor="middle"
        fontSize="11"
        fill="currentColor"
      >
        {xLabel}
      </text>
      <text x={L + 4} y={10} fontSize="11" fill="currentColor">
        {yLabel}
      </text>
      {marks.map((m) => (
        <g key={m.label}>
          <circle
            cx={X(m.x)}
            cy={Y(m.y)}
            r="5"
            fill="#fff"
            stroke="#0b1b33"
            strokeWidth="2"
          />
          <text
            x={X(m.x)}
            y={Y(m.y) - 9}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="currentColor"
          >
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function SensorChart({ rows }) {
  const W = 640,
    H = 160,
    P = 28;
  const t0 = rows[0].t;
  const tMax = rows[rows.length - 1].t - t0 || 1;
  const m = Math.max(1, ...rows.map((r) => Math.abs(r.roll)));
  const pts = rows
    .map(
      (r) =>
        `${P + ((r.t - t0) / tMax) * (W - P - 8)},${H / 2 - (r.roll / m) * (H / 2 - 12)}`,
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Measured roll">
      <line
        x1={P}
        x2={W - 8}
        y1={H / 2}
        y2={H / 2}
        stroke="currentColor"
        opacity=".2"
      />
      <polyline points={pts} fill="none" stroke="#0a6cff" strokeWidth="1.5" />
      <text x={4} y={14} fontSize="11" fill="currentColor">
        ±{m.toFixed(1)}°
      </text>
    </svg>
  );
}

function parseTests(text) {
  const out = { A: {}, B: {} };
  text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .forEach((line) => {
      const [v, fb, h, t, ...note] = line.split(",");
      const key = v?.trim();
      if (out[key]) {
        out[key] = {
          freeboard: fb?.trim(),
          heel: h?.trim(),
          Tn: t?.trim(),
          note: note.join(",").trim(),
        };
      }
    });
  return out;
}

export default function App() {
  const [hulls, setHulls] = useState(HULLS);
  const [sel, setSel] = useState("A");
  const [view, setView] = useState("stability");
  const [cargo, setCargo] = useState(CARGO);
  const [water, setWater] = useState("Baltic");
  const [customRho, setCustomRho] = useState(1010);
  const [env, setEnv] = useState({ Hw: 0.03, Tw: 1, v: 0.3, Cd: 0.8 });
  const [animate, setAnimate] = useState(true);
  const [meas, setMeas] = useState({ A: {}, B: {} });
  const [sensor, setSensor] = useState({ A: null, B: null });
  const rho = water === "Custom" ? customRho : WATER[water];
  const res = useMemo(
    () => ({
      A: assess(hulls.A, cargo, rho, env),
      B: assess(hulls.B, cargo, rho, env),
    }),
    [hulls, cargo, rho, env],
  );
  const h = hulls[sel];
  const r = res[sel];

  const setH = (k, v) => setHulls({ ...hulls, [sel]: { ...h, [k]: v } });

  const setC = (id, k, v) =>
    setCargo(cargo.map((c) => (c.id === id ? { ...c, [k]: v } : c)));

  const moveCargo = (id, x, y) =>
    setCargo((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));

  const sweep = useMemo(() => {
    const out = [];
    for (let s = 0.2; s <= 0.4001; s += 0.01) {
      const a = assess({ ...h, s }, cargo, rho, env);
      out.push({ s: s * 1000, GM: a.GM * 1000, Tn: a.Tn });
    }
    return out;
  }, [h, cargo, rho, env]);

  const m = meas[sel];
  const setM = (k, v) => setMeas({ ...meas, [sel]: { ...meas[sel], [k]: v } });
  const checks = [
    ["Freeboard", "freeboard", r.freeboard * 1000, 1, "mm"],
    ["Heel", "heel", Math.abs(r.heel), 2, "°"],
    ["Roll period", "Tn", r.Tn, 2, "s"],
  ];

  const loadTests = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMeas(parseTests(String(reader.result)));
    reader.readAsText(file);
    ev.target.value = "";
  };

  const loadSensor = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseSensor(String(reader.result));
      const stats = analyze(rows);
      setSensor((s) => ({ ...s, [sel]: { rows, stats } }));
      if (stats)
        setMeas((mm) => ({
          ...mm,
          [sel]: {
            ...mm[sel],
            heel: Math.abs(stats.mean).toFixed(2),
            Tn: Number.isFinite(stats.Tn) ? stats.Tn.toFixed(2) : "",
          },
        }));
    };
    reader.readAsText(file);
    ev.target.value = "";
  };
  const sens = sensor[sel];

  const exportAll = () => {
    const data = {
      exported: new Date().toISOString(),
      water,
      density: rho,
      waves: env,
      cargo,
      hulls,
      measured: meas,
      results: res,
    };
    const text = JSON.stringify(
      data,
      (k, v) => (v instanceof Set ? [...v] : v),
      2,
    );
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "catamaran-stability.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    ["Draft", f(r.draft * 1000), "mm", "calculated"],
    ["Freeboard", f(r.freeboard * 1000), "mm", "calculated"],
    ["Heel", f(r.heel, 2), "°", "calculated"],
    ["GM", f(r.GM * 1000, 0), "mm", "calculated"],
    ["Roll", f(r.roll), "°", "simulated"],
    ["Drag", f(r.drag, 3), "N", "estimated"],
  ];

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Arova Engineering Challenge</p>
          <h1>Ballast-free catamaran</h1>
        </div>
        <p className="lead">
          Load the hulls, pick the water, compare two designs under the same
          conditions and check the model against tank tests.
        </p>
      </header>
      <aside>
        <section className="card">
          <h2>Hull design (version {sel})</h2>
          <Num
            label="Hull spacing"
            unit="mm"
            value={h.s}
            onChange={(v) => setH("s", v)}
          />
          <Num
            label="Empty mass"
            unit="g"
            value={h.mass}
            onChange={(v) => setH("mass", v)}
          />
          <Num
            label="CG height"
            unit="mm"
            value={h.cg.z}
            onChange={(v) => setH("cg", { ...h.cg, z: v })}
          />
          <Num label="Hull width (CAD)" unit="mm" value={h.b} disabled />
          <Num label="Hull length (CAD)" unit="mm" value={h.L} disabled />
          <p className="hint">
            Width and length come from the CAD hydrostatic table. Spacing, mass
            and CG height change the calculation. The 3D view always shows the
            base model.
          </p>
          <button className="add" onClick={exportAll}>
            Save data to file
          </button>
        </section>
        <section className="card">
          <h2>Water and waves</h2>
          <Segmented
            label="Water"
            value={water}
            onChange={setWater}
            options={[...Object.keys(WATER), "Custom"].map((w) => [w, w])}
          />
          {water === "Custom" ? (
            <Num
              label="Density"
              unit="kg/m³"
              scale={1}
              value={customRho}
              onChange={setCustomRho}
              className="custom-input"
            />
          ) : (
            <p className="hint">{rho} kg/m³</p>
          )}
          <Num
            label="Wave height"
            unit="mm"
            value={env.Hw}
            onChange={(v) => setEnv({ ...env, Hw: v })}
          />
          <Num
            label="Wave period"
            unit="s"
            scale={1}
            value={env.Tw}
            onChange={(v) => setEnv({ ...env, Tw: Math.max(0.3, v) })}
          />
          <Num
            label="Speed"
            unit="m/s"
            scale={1}
            value={env.v}
            onChange={(v) => setEnv({ ...env, v })}
          />
          <Num
            label="Drag Cd"
            unit=""
            scale={1}
            value={env.Cd}
            onChange={(v) => setEnv({ ...env, Cd: v })}
          />
        </section>
        <section className="card">
          <h2>Cargo</h2>
          <table className="cargo">
            <thead>
              <tr>
                <th>Mass g</th>
                <th>x mm</th>
                <th>y mm</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cargo.map((c) => (
                <tr key={c.id} className={r.bad.has(c.id) ? "bad" : ""}>
                  {["m", "x", "y"].map((k) => (
                    <td key={k}>
                      <input
                        type="number"
                        value={+(c[k] * 1000).toFixed(1)}
                        onChange={(e) => setC(c.id, k, +e.target.value / 1000)}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      aria-label="Remove cargo"
                      onClick={() =>
                        setCargo(cargo.filter((x) => x.id !== c.id))
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="add"
            onClick={() =>
              setCargo(
                suggestLayout(
                  h,
                  [
                    ...cargo,
                    {
                      id: Date.now(),
                      m: 0.05,
                      l: 0.05,
                      w: 0.05,
                      h: 0.04,
                      x: 0,
                      y: 0,
                    },
                  ],
                  {
                    deckLength: h.deckL ?? h.L,
                    deckWidth: h.deckW ?? deckW,
                    deckCenterX: h.deckCx ?? 0,
                  },
                ).filter((c, _, arr) => {
                  const invalidCargoIds = getInvalidIds(arr, getZone(h));
                  return !invalidCargoIds.has(c.id)
                }),
              )
            }
          >
            Add a box
          </button>{" "}
          <button
            className="add"
            onClick={() =>
              setCargo(
                suggestLayout(h, cargo, {
                  deckLength: h.deckL ?? h.L,
                  deckWidth: h.deckW ?? deckW,
                  deckCenterX: h.deckCx ?? 0,
                }),
              )
            }
          >
            Suggest layout
          </button>
          <p className="hint">
            Boxes sit on the deck. y is measured from the centreline. Suggest
            layout places the boxes inside the deck, without overlap, with the
            centre of gravity as close to the centreline as possible.
          </p>
        </section>
      </aside>
      <main>
        <section className="card hero">
          <div className="stage">
            <Scene
              h={h}
              cargo={cargo}
              r={r}
              env={env}
              animate={animate}
              onMove={moveCargo}
            />
            <div className="overlay tl">
              <Segmented
                label="Hull version"
                value={sel}
                onChange={setSel}
                options={Object.keys(hulls).map((k) => [k, hulls[k].name])}
              />
            </div>
            <div className="overlay br">
              <button
                className={`pill ${animate ? "on" : ""}`}
                onClick={() => setAnimate(!animate)}
              >
                {animate ? "Waves on" : "Waves off"}
              </button>
            </div>
            <p className="hint absolute">
              The waves and the motion in the 3D view illustrate the calculated
              values. They are not a fluid simulation.
            </p>
          </div>
        </section>
        <section className="stats">
          {stats.map(([l, v, u, t]) => (
            <div className="card stat" key={l}>
              <span>{l}</span>
              <strong>
                {v}
                <small>{u}</small>
              </strong>
              <em className={t}>{t}</em>
            </div>
          ))}
        </section>
        <ul className="alerts">
          {r.alerts.length ? (
            r.alerts.map(([lv, t]) => (
              <li key={t} className={lv}>
                {t}
              </li>
            ))
          ) : (
            <li className="ok">All checks passed for version {sel}</li>
          )}
        </ul>
        <Segmented
          label="Section"
          value={view}
          onChange={setView}
          options={[
            ["stability", "Stability"],
            ["validation", "Validation"],
            ["dashboard", "Dashboard"],
            ["routes", "Routes"],
          ]}
        />
        {view === "stability" && (
          <>
            <section className="card">
              <h2>Roll in waves</h2>
              <RollChart r={r} env={env} />
              <p className="hint">
                Simulated. One degree of freedom, damping ratio 0.1 assumed.
              </p>
            </section>
            <section className="card compare">
              <h2>Version A against version B</h2>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th>A · {hulls.A.name}</th>
                      <th>B · {hulls.B.name}</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map(([l, k, s, d, u, better]) => {
                      const a = val(res.A, k) * s;
                      const b = val(res.B, k) * s;
                      const diff = b - a;
                      let cls = "";
                      if (
                        better &&
                        Number.isFinite(diff) &&
                        Math.abs(diff) > 1e-9
                      ) {
                        cls =
                          (better === "lower") === diff < 0 ? "good" : "worse";
                      }
                      return (
                        <tr key={k}>
                          <td>{l}</td>
                          <td>
                            {f(a, d)} {u}
                          </td>
                          <td>
                            {f(b, d)} {u}
                          </td>
                          <td className={cls}>
                            {diff > 0 ? "+" : ""}
                            {f(diff, d)} {u}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="hint">
                Same cargo, water and waves for both versions. Green is better,
                red is worse.
              </p>
            </section>
            <section className="card">
              <h2>Cargo and buoyancy</h2>
              <table>
                <tbody>
                  <tr>
                    <td>Water density</td>
                    <td>{f(rho, 0)} kg/m³</td>
                  </tr>
                  <tr>
                    <td>Total mass</td>
                    <td>{f(r.M * 1000, 0)} g</td>
                  </tr>
                  <tr>
                    <td>Displaced volume V = M / ρ</td>
                    <td>{f(r.V * 1e6, 0)} cm³</td>
                  </tr>
                  <tr>
                    <td>Draft</td>
                    <td>{f(r.draft * 1000, 1)} mm</td>
                  </tr>
                  <tr>
                    <td>Cargo on deck</td>
                    <td>{f(r.cargoMass * 1000, 0)} g</td>
                  </tr>
                  <tr>
                    <td>Cargo limit (freeboard 30 mm)</td>
                    <td>{f(r.maxCargo * 1000, 0)} g</td>
                  </tr>
                  <tr>
                    <td>Load margin</td>
                    <td className={r.loadMargin >= 0 ? "good" : "worse"}>
                      {f(r.loadMargin * 1000, 0)} g
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="hint">
                Calculated from the hull table (draft against submerged volume).
                The limit changes with the water density.
              </p>
            </section>
            <section className="card">
              <h2>Why no ballast is needed</h2>
              <p>
                Stability comes from the hull shape and the weight placement,
                not from water ballast. Wider spacing raises the metacentric
                height GM, and a balanced cargo layout keeps the centre of
                gravity on the centreline. The charts show how the spacing
                changes GM and the roll period for the current load.
              </p>
              <div className="grid2">
                <LineChart
                  pts={sweep.map((p) => [p.s, p.GM])}
                  marks={["A", "B"].map((k) => ({
                    label: k,
                    x: hulls[k].s * 1000,
                    y: res[k].GM * 1000,
                  }))}
                  xLabel="hull spacing (mm)"
                  yLabel="GM (mm)"
                />
                <LineChart
                  pts={sweep.map((p) => [p.s, p.Tn])}
                  marks={["A", "B"].map((k) => ({
                    label: k,
                    x: hulls[k].s * 1000,
                    y: res[k].Tn,
                  }))}
                  xLabel="hull spacing (mm)"
                  yLabel="roll period (s)"
                />
              </div>
              <p className="hint">Calculated. A and B mark the two versions.</p>
            </section>
          </>
        )}
        {view === "validation" && (
          <>
            <section className="card validation">
              <h2>
                Validation: calculation against measurement (version {sel})
              </h2>
              <p className="hint">
                Load tests (CSV: version,freeboard_mm,heel_deg,period_s,note):{" "}
                <label className="file-label" htmlFor="file-csv-2">
                  <input
                    id="file-csv-2"
                    type="file"
                    accept=".csv"
                    onChange={loadTests}
                  />
                  Load tests
                </label>
              </p>
              <table className="vtable">
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Calculated</th>
                    <th>Measured</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map(([l, k, calc, d, u]) => {
                    const diff = pct(calc, num(m[k]));
                    const ok = Number.isFinite(diff);
                    return (
                      <tr key={k}>
                        <td>{l}</td>
                        <td>
                          {f(calc, d)} {u}
                        </td>
                        <td>
                          <div className="meas">
                            <input
                              type="number"
                              step="any"
                              value={m[k] ?? ""}
                              onChange={(ev) => setM(k, ev.target.value)}
                            />
                            <span>{u}</span>
                          </div>
                        </td>
                        <td
                          className={
                            ok ? (Math.abs(diff) <= 10 ? "good" : "worse") : ""
                          }
                        >
                          {ok
                            ? `${diff > 0 ? "+" : ""}${diff.toFixed(0)} %`
                            : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <textarea
                className="note"
                placeholder="Test conditions and reasons for the difference (mass, water, cargo position...)"
                value={m.note ?? ""}
                onChange={(ev) => setM("note", ev.target.value)}
                rows={3}
              />
              <p className="hint">
                Set the same cargo and water in the app as in the test before
                you read the difference. Green means within 10 %.
              </p>
            </section>
            <section className="card">
              <h2>Recorded MPU-6050 data (version {sel})</h2>
              <p className="hint">
                CSV (t_ms,roll_deg,pitch_deg):{" "}
                <label className="file-label" htmlFor="file-csv">
                  <input
                    id="file-csv"
                    type="file"
                    accept=".csv"
                    onChange={loadSensor}
                  />
                  Load sensor
                </label>
              </p>
              {sens && sens.stats ? (
                <>
                  <SensorChart rows={sens.rows} />
                  <p className="hint">
                    Measured: heel {f(Math.abs(sens.stats.mean), 2)}°, period{" "}
                    {f(sens.stats.Tn, 2)} s, amplitude {f(sens.stats.amp, 1)}°.
                    Calculated period {f(r.Tn, 2)} s. Heel and period were
                    copied into the table above.
                  </p>
                </>
              ) : (
                <p className="hint">
                  No file loaded, or the file has too few samples.
                </p>
              )}
            </section>
          </>
        )}
        {view === "dashboard" && <Dashboard r={r} env={env} cargo={cargo} />}
        {view === "routes" && <RoutePlanner hull={h} cargo={cargo} env={env} />}
      </main>
    </div>
  );
}
