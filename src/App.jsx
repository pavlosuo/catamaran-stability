import { useMemo, useState } from "react";
import { assess, rollSeries, WATER } from "./physics";
import Scene from "./Scene";
import "./styles.scss";

const hull = (name, s) => ({
  name,
  L: 0.4,
  b: 0.08,
  H: 0.1,
  s,
  Cb: 0.7,
  mass: 0.3,
  cg: { x: 0, y: 0, z: 0.07 },
});

const HULLS = { A: hull("Baseline", 0.2), B: hull("Revised", 0.12) };

const CARGO = [
  { id: 1, m: 0.15, l: 0.06, w: 0.06, h: 0.04, x: -0.08, y: 0.05 },
  { id: 2, m: 0.1, l: 0.05, w: 0.05, h: 0.04, x: 0.05, y: -0.04 },
  { id: 3, m: 0.15, l: 0.06, w: 0.06, h: 0.05, x: 0.12, y: 0.06 },
];

const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");

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

function Num({ label, unit, value, scale = 1000, onChange }) {
  return (
    <label className="num">
      <span>{label}</span>
      <input
        type="number"
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

export default function App() {
  const [hulls, setHulls] = useState(HULLS);
  const [sel, setSel] = useState("A");
  const [cargo, setCargo] = useState(CARGO);
  const [water, setWater] = useState("Baltic");
  const [env, setEnv] = useState({ Hw: 0.03, Tw: 1, v: 0.3, Cd: 0.8 });
  const [animate, setAnimate] = useState(true);
  const rho = WATER[water];
  const res = useMemo(
    () => ({
      A: assess(hulls.A, cargo, rho, env),
      B: assess(hulls.B, cargo, rho, env),
    }),
    [hulls, cargo, rho, env],
  );
  const h = hulls[sel],
    r = res[sel];
  const setH = (k, v) => setHulls({ ...hulls, [sel]: { ...h, [k]: v } });
  const setC = (id, k, v) =>
    setCargo(cargo.map((c) => (c.id === id ? { ...c, [k]: v } : c)));
  const moveCargo = (id, x, y) =>
    setCargo((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)));

  const rows = [
    ["Total mass", "M", 1000, 0, "g"],
    ["Draft", "draft", 1000, 1, "mm"],
    ["Freeboard", "freeboard", 1000, 1, "mm"],
    ["Metacentric height GM", "GM", 1000, 0, "mm"],
    ["Heel", "heel", 1, 2, "°"],
    ["Roll amplitude", "roll", 1, 1, "°"],
    ["Roll period", "Tn", 1, 2, "s"],
    ["Drag", "drag", 1, 3, "N"],
  ];
  const stats = [
    ["Draft", f(r.draft * 1000), "mm", "calculated"],
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
          <h1>Catamaran stability</h1>
        </div>
        <p className="lead">
          Load the hulls, pick the water, compare two designs under the same
          conditions.
        </p>
      </header>
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
                options={Object.keys(hulls).map((k) => [
                  k,
                  `${k} · ${hulls[k].name}`,
                ])}
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

        <section className="card">
          <h2>Roll in waves</h2>
          <RollChart r={r} env={env} />
          <p className="hint">Simulated · damping ratio 0.1 assumed</p>
        </section>

        <section className="card compare">
          <h2>Version A against version B</h2>
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
              {rows.map(([l, k, s, d, u]) => {
                const a = res.A[k] * s,
                  b = res.B[k] * s;
                return (
                  <tr key={k}>
                    <td>{l}</td>
                    <td>
                      {f(a, d)} {u}
                    </td>
                    <td>
                      {f(b, d)} {u}
                    </td>
                    <td>
                      {b - a >= 0 ? "+" : ""}
                      {f(b - a, d)} {u}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">
            Same cargo, water and waves for both versions. Replace the model
            numbers with your own measurements and validate against a tank test.
          </p>
        </section>
      </main>

      <aside>
        <section className="card">
          <h2>Hull design</h2>
          <Num
            label="Hull spacing"
            unit="mm"
            value={h.s}
            onChange={(v) => setH("s", v)}
          />
          <Num
            label="Hull width"
            unit="mm"
            value={h.b}
            onChange={(v) => setH("b", v)}
          />
          <Num
            label="Hull length"
            unit="mm"
            value={h.L}
            onChange={(v) => setH("L", v)}
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
        </section>

        <section className="card">
          <h2>Water and waves</h2>
          <Segmented
            label="Water"
            value={water}
            onChange={setWater}
            options={Object.keys(WATER).map((w) => [w, w])}
          />
          <p className="hint">{rho} kg/m³</p>
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
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="add"
            onClick={() =>
              setCargo([
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
              ])
            }
          >
            Add a box
          </button>
          <p className="hint">
            Boxes sit on the deck. y is measured from the centreline.
          </p>
        </section>
      </aside>
    </div>
  );
}
