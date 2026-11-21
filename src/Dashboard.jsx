import { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/data/physics";
import { f, avg } from "@/utils";

const KEEP = 200;

function TiltChart({ data }) {
  if (data.length < 2) return <p className="hint">Waiting for data…</p>;
  const W = 640,
    H = 180,
    L = 40,
    R = 10,
    T = 10,
    B = 20;
  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;
  const m = Math.max(
    LIMITS.roll * 1.5,
    ...data.map((d) => Math.abs(d.roll)),
    ...data.map((d) => Math.abs(d.pitch)),
  );
  const X = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
  const Y = (a) => T + (1 - (a + m) / (2 * m)) * (H - T - B);
  const path = (k) =>
    data
      .map(
        (d, i) => `${i ? "L" : "M"}${X(d.t).toFixed(1)},${Y(d[k]).toFixed(1)}`,
      )
      .join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Live roll and pitch">
      {[-LIMITS.roll, 0, LIMITS.roll].map((v) => (
        <g key={v}>
          <line
            x1={L}
            x2={W - R}
            y1={Y(v)}
            y2={Y(v)}
            stroke="currentColor"
            opacity={v === 0 ? 0.3 : 0.25}
            strokeDasharray={v === 0 ? "" : "4 4"}
          />
          <text
            x={L - 6}
            y={Y(v) + 4}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
          >
            {v > 0 ? "+" : ""}
            {v}°
          </text>
        </g>
      ))}
      <path d={path("roll")} fill="none" stroke="#0a6cff" strokeWidth="1.6" />
      <path d={path("pitch")} fill="none" stroke="#ff9500" strokeWidth="1.6" />
      <text x={L + 4} y={H - 4} fontSize="11" fill="#0a6cff">
        roll
      </text>
      <text x={L + 44} y={H - 4} fontSize="11" fill="#ff9500">
        pitch
      </text>
    </svg>
  );
}

export function Dashboard({ r, env, cargo }) {
  const [source, setSource] = useState("sim");
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("");
  const t0 = useRef(performance.now());
  const model = useRef({ r, env });
  model.current = { r, env };
  const serial = useRef(null);
  const push = (s) => setData((d) => [...d.slice(-(KEEP - 1)), s]);

  useEffect(() => {
    if (source !== "sim") return;
    const id = setInterval(() => {
      const { r, env } = model.current;
      const t = (performance.now() - t0.current) / 1000;
      const n = () => (Math.random() - 0.5) * 0.3;
      const ok = (v) => (Number.isFinite(v) ? v : 0);
      const w = (2 * Math.PI * t) / env.Tw;
      push({
        t,
        roll: ok(r.heel) + ok(r.roll) * Math.sin(w) + n(),
        pitch: ok(r.trim) + ok(r.pitch) * Math.sin(w + 1) + n(),
      });
    }, 50);
    return () => clearInterval(id);
  }, [source]);

  const connect = async () => {
    if (!("serial" in navigator)) {
      setStatus("Web Serial is not available. Use Chrome or Edge.");
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      const decoder = new TextDecoderStream();
      const closed = port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      serial.current = { port, reader, closed };
      setData([]);
      setSource("live");
      setStatus("Connected");
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach((line) => {
          const nums = line.trim().split(",").map(Number);
          const [roll, pitch] = nums.slice(-2);
          if (
            nums.length >= 2 &&
            Number.isFinite(roll) &&
            Number.isFinite(pitch)
          )
            push({ t: (performance.now() - t0.current) / 1000, roll, pitch });
        });
      }
    } catch (e) {
      setStatus(`Serial error: ${e.message}`);
    }
  };

  const disconnect = async () => {
    const s = serial.current;
    if (!s) return;
    serial.current = null;
    try {
      await s.reader.cancel();
      await s.closed.catch(() => {});
      await s.port.close();
    } catch {}
    setStatus("Disconnected");
  };

  const useSim = async () => {
    await disconnect();
    setData([]);
    setSource("sim");
  };

  useEffect(() => () => disconnect(), []);

  const last = data[data.length - 1];
  const win = last ? data.filter((d) => d.t > last.t - 5) : [];
  const heel = avg(win.map((d) => d.roll));
  const trimNow = avg(win.map((d) => d.pitch));
  const amp = (k, mean) =>
    win.length ? Math.max(...win.map((d) => Math.abs(d[k] - mean))) : NaN;
  const rollAmp = amp("roll", heel);
  const pitchAmp = amp("pitch", trimNow);

  const alerts = [];
  if (Math.abs(heel) > LIMITS.heel)
    alerts.push(["err", `Steady heel ${f(heel)}° is above ${LIMITS.heel}°`]);
  if (rollAmp > LIMITS.roll)
    alerts.push([
      "warn",
      `Roll amplitude ${f(rollAmp)}° is above ${LIMITS.roll}°`,
    ]);
  if (pitchAmp > LIMITS.pitch)
    alerts.push([
      "warn",
      `Pitch amplitude ${f(pitchAmp)}° is above ${LIMITS.pitch}°`,
    ]);
  if (Math.abs(trimNow) > LIMITS.trim)
    alerts.push(["warn", `Trim ${f(trimNow)}° is above ${LIMITS.trim}°`]);

  const advice = [];
  const heaviest = [...cargo].sort((a, b) => b.m - a.m)[0];
  if (heaviest && Math.abs(r.yCG) > 0.001) {
    const d = (-r.yCG * r.M) / heaviest.m;
    advice.push(
      `Move box ${cargo.indexOf(heaviest) + 1} (${f(heaviest.m * 1000, 0)} g) ${f(Math.abs(d) * 1000, 0)} mm towards ${d > 0 ? "starboard (+y)" : "port (−y)"} to remove the heel.`,
    );
  }
  const ratio = r.Tn / env.Tw;
  if (ratio > 0.8 && ratio < 1.25)
    advice.push(
      `Roll period (${f(r.Tn, 2)} s) is close to the wave period (${f(env.Tw, 2)} s). Resonance risk: change the hull spacing or the wave encounter period.`,
    );
  if (r.freeboard < LIMITS.freeboard)
    advice.push(
      `Freeboard is only ${f(r.freeboard * 1000, 0)} mm. Remove about ${f(-r.loadMargin * 1000, 0)} g of cargo.`,
    );
  if (!advice.length) advice.push("No correction needed for the current load.");

  const live = source === "live";

  return (
    <>
      <section className="card">
        <h2>Live tilt dashboard</h2>
        <p>
          <button className={`pill ${!live ? "on" : ""}`} onClick={useSim}>
            Simulated
          </button>{" "}
          {live ? (
            <button className="pill on" onClick={useSim}>
              Disconnect MPU-6050
            </button>
          ) : (
            <button className="pill" onClick={connect}>
              Connect MPU-6050
            </button>
          )}
        </p>
        <TiltChart data={data} />
        <p className="hint">
          {live
            ? "Measured: MPU-6050 over USB serial."
            : "Simulated from the hydrostatic model with small random noise."}{" "}
          {status} Serial format: one line per sample, roll_deg,pitch_deg at
          115200 baud.
        </p>
      </section>
      <section className="stats">
        {[
          ["Steady heel", f(heel, 2), "°"],
          ["Roll amplitude", f(rollAmp), "°"],
          ["Trim", f(trimNow, 2), "°"],
          ["Pitch amplitude", f(pitchAmp), "°"],
        ].map(([l, v, u]) => (
          <div className="card stat" key={l}>
            <span>{l}</span>
            <strong>
              {v}
              <small>{u}</small>
            </strong>
            <em className={live ? "measured" : "simulated"}>
              {live ? "measured" : "simulated"}
            </em>
          </div>
        ))}
      </section>
      <ul className="alerts">
        {alerts.length ? (
          alerts.map(([lv, t]) => (
            <li key={t} className={lv}>
              {t}
            </li>
          ))
        ) : (
          <li className="ok">Tilt is within limits</li>
        )}
      </ul>
      <section className="card">
        <h2>Suggested corrections</h2>
        <ul>
          {advice.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
