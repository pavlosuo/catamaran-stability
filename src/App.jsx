import { useMemo, useState } from "react";
import { assess, rollSeries, WATER } from "./physics";

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
const K = 700; // px per metre in drawings
const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");

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

function TopView({ h, cargo, r }) {
  return (
    <svg viewBox="-190 -140 380 280" role="img" aria-label="Deck plan">
      {[-1, 1].map((s) => (
        <rect
          key={s}
          className="hull"
          x={(-h.L * K) / 2}
          y={(s * h.s * K) / 2 - (h.b * K) / 2}
          width={h.L * K}
          height={h.b * K}
          rx={(h.b * K) / 2}
        />
      ))}
      <rect
        className="deck"
        x={(-h.L * K) / 2}
        y={(-h.s * K) / 2}
        width={h.L * K}
        height={h.s * K}
      />
      {cargo.map((c) => (
        <rect
          key={c.id}
          className={r.bad.has(c.id) ? "box bad" : "box"}
          x={(c.x - c.l / 2) * K}
          y={(c.y - c.w / 2) * K}
          width={c.l * K}
          height={c.w * K}
          rx="3"
        />
      ))}
      <g className="cg">
        <circle cx={r.xCG * K} cy={r.yCG * K} r="6" />
        <path
          d={`M${r.xCG * K - 10} ${r.yCG * K}h20M${r.xCG * K} ${r.yCG * K - 10}v20`}
        />
      </g>
      <text x="150" y="-120">
        bow
      </text>
    </svg>
  );
}

function FrontView({ h, r }) {
  const d = r.draft * K,
    hh = h.H * K,
    W = (h.s + h.b) * K;
  const heel = Number.isFinite(r.heel) ? r.heel : 0;
  return (
    <svg
      viewBox="-190 -150 380 260"
      role="img"
      aria-label="Front view with heel"
    >
      <g transform={`rotate(${heel})`}>
        {[-1, 1].map((s) => (
          <rect
            key={s}
            className="hull"
            x={(s * h.s * K) / 2 - (h.b * K) / 2}
            y={d - hh}
            width={h.b * K}
            height={hh}
            rx="10"
          />
        ))}
        <rect className="deck" x={-W / 2} y={d - hh - 7} width={W} height="7" />
        <g className="cg">
          <circle cx={r.yCG * K} cy={d - r.zCG * K} r="6" />
        </g>
      </g>
      <rect className="water" x="-190" y="0" width="380" height="110" />
      <line className="wl" x1="-190" x2="190" y1="0" y2="0" />
    </svg>
  );
}

function RollChart({ r, env }) {
  const pts = rollSeries(r, env);
  const m = Math.max(5, ...pts.map((p) => Math.abs(p[1])));
  const path = pts
    .map(
      ([t, a], i) =>
        `${i ? "L" : "M"}${(t / (env.Tw * 4)) * 360 + 20},${70 - (a / m) * 60}`,
    )
    .join("");
  return (
    <svg viewBox="0 0 400 140" role="img" aria-label="Simulated roll">
      <line className="axis" x1="20" x2="380" y1="70" y2="70" />
      <path className="trace" d={path} />
      <text x="22" y="14">
        ±{f(m, 0)}°
      </text>
      <text x="300" y="134">
        {f(env.Tw * 4, 0)} s of waves
      </text>
    </svg>
  );
}

export default function App() {
  const [hulls, setHulls] = useState(HULLS);
  const [sel, setSel] = useState("A");
  const [cargo, setCargo] = useState(CARGO);
  const [water, setWater] = useState("Baltic");
  const [env, setEnv] = useState({ Hw: 0.03, Tw: 1, v: 0.3, Cd: 0.8 });
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

  return (
    <div className="app">
      <header>
        <h1>Catamaran stability desk</h1>
        <p>
          Load the hulls, pick the water, compare two designs under the same
          conditions.
        </p>
      </header>

      <aside>
        <section>
          <h2>Hull design</h2>
          <div className="tabs">
            {Object.keys(hulls).map((k) => (
              <button
                key={k}
                className={k === sel ? "on" : ""}
                onClick={() => setSel(k)}
              >
                {k} · {hulls[k].name}
              </button>
            ))}
          </div>
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
            label="Centre of gravity height"
            unit="mm"
            value={h.cg.z}
            onChange={(v) => setH("cg", { ...h.cg, z: v })}
          />
        </section>
        <section>
          <h2>Water and waves</h2>
          <div className="tabs">
            {Object.keys(WATER).map((w) => (
              <button
                key={w}
                className={w === water ? "on" : ""}
                onClick={() => setWater(w)}
              >
                {w}
              </button>
            ))}
          </div>
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
            label="Drag coefficient Cd"
            unit=""
            scale={1}
            value={env.Cd}
            onChange={(v) => setEnv({ ...env, Cd: v })}
          />
        </section>
        <section>
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

      <main>
        <div className="stats">
          {[
            ["Draft", f(r.draft * 1000), "mm", "calculated"],
            ["Heel", f(r.heel, 2), "°", "calculated"],
            ["GM", f(r.GM * 1000, 0), "mm", "calculated"],
            ["Roll", f(r.roll), "°", "simulated"],
            ["Drag", f(r.drag, 3), "N", "estimated"],
          ].map(([l, v, u, t]) => (
            <div className="stat" key={l}>
              <span>{l}</span>
              <strong>
                {v}
                <small>{u}</small>
              </strong>
              <em className={t}>{t}</em>
            </div>
          ))}
        </div>
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
        <div className="views">
          <figure>
            <TopView h={h} cargo={cargo} r={r} />
            <figcaption>Deck plan with centre of gravity</figcaption>
          </figure>
          <figure>
            <FrontView h={h} r={r} />
            <figcaption>Front view at {f(r.heel, 2)}° heel</figcaption>
          </figure>
          <figure className="wide">
            <RollChart r={r} env={env} />
            <figcaption>
              Roll in waves (simulated, damping ratio 0.1 assumed)
            </figcaption>
          </figure>
        </div>
        <section className="compare">
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
    </div>
  );
}
