import { useEffect, useRef, useState } from "react";

const KEEP = 500;
const ACC_SCALE = 16384;
const GYRO_SCALE = 131;
const ALPHA = 0.98;
const CALIB_SAMPLES = 100;
const FLUSH_MS = 66;
const WATCH_CODE = `Bangle.on('accel',function(a){Bluetooth.println([Math.round(a.x*1000),Math.round(a.y*1000),Math.round(a.z*1000)].join(","));});`;
const WATCH_X_SIGN = -1;
const WATCH_Y_SIGN = -1;
const WATCH_Z_SIGN = -1;
const WATCH_SMOOTH = 0.8;

const freshFilter = () => ({
  roll: 0,
  pitch: 0,
  lastT: null,
  calib: { n: 0, gx: 0, gy: 0 },
  bias: { gx: 0, gy: 0 },
  ready: false,
});

export function useSensor() {
  const [connected, setConnected] = useState(false);
  const [source, setSource] = useState(null);
  const [status, setStatus] = useState("");
  const [data, setData] = useState([]);
  const serial = useRef(null);
  const filter = useRef(freshFilter());
  const zero = useRef({ roll: 0, pitch: 0 });
  const raw = useRef({ roll: 0, pitch: 0 });
  const buffer = useRef([]);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const id = setInterval(() => {
      if (!buffer.current.length) return;
      const add = buffer.current;
      buffer.current = [];
      setData((d) => [...d, ...add].slice(-KEEP));
    }, FLUSH_MS);
    return () => clearInterval(id);
  }, []);

  const resetState = () => {
    filter.current = freshFilter();
    zero.current = { roll: 0, pitch: 0 };
    buffer.current = [];
    t0.current = performance.now();
    setData([]);
  };

  const pushAngles = (angles, now) => {
    raw.current = angles;
    buffer.current.push({
      t: (now - t0.current) / 1000,
      roll: angles.roll - zero.current.roll,
      pitch: angles.pitch - zero.current.pitch,
    });
  };

  const processSample = (nums, now) => {
    const st = filter.current;
    const [axr, ayr, azr, gxr, gyr] = nums;
    const ax = axr / ACC_SCALE;
    const ay = ayr / ACC_SCALE;
    const az = azr / ACC_SCALE;
    const accRoll = (Math.atan2(ay, az) * 180) / Math.PI;
    const accPitch = (Math.atan2(-ax, Math.hypot(ay, az)) * 180) / Math.PI;

    if (!st.ready) {
      st.calib.n++;
      st.calib.gx += gxr;
      st.calib.gy += gyr;
      if (st.calib.n >= CALIB_SAMPLES) {
        st.bias.gx = st.calib.gx / st.calib.n;
        st.bias.gy = st.calib.gy / st.calib.n;
        st.roll = accRoll;
        st.pitch = accPitch;
        st.lastT = now;
        st.ready = true;
        setStatus("Connected");
      }
      return null;
    }

    const dt = (now - st.lastT) / 1000;
    st.lastT = now;
    if (dt <= 0 || dt > 0.5) return null;
    const gx = (gxr - st.bias.gx) / GYRO_SCALE;
    const gy = (gyr - st.bias.gy) / GYRO_SCALE;
    st.roll = ALPHA * (st.roll + gx * dt) + (1 - ALPHA) * accRoll;
    st.pitch = ALPHA * (st.pitch + gy * dt) + (1 - ALPHA) * accPitch;
    return { roll: st.roll, pitch: st.pitch };
  };

  const processWatch = (nums) => {
    const st = filter.current;

    const x = (nums[0] / 1000) * WATCH_X_SIGN;
    const y = (nums[1] / 1000) * WATCH_Y_SIGN;
    const z = (nums[2] / 1000) * WATCH_Z_SIGN;

    const roll = (Math.atan2(y, z) * 180) / Math.PI;
    const pitch = (Math.atan2(-x, Math.hypot(y, z)) * 180) / Math.PI;

    if (!st.ready) {
      st.roll = roll;
      st.pitch = pitch;
      st.ready = true;
      setStatus("Connected (watch, accelerometer only)");
    } else {
      st.roll = WATCH_SMOOTH * st.roll + (1 - WATCH_SMOOTH) * roll;
      st.pitch = WATCH_SMOOTH * st.pitch + (1 - WATCH_SMOOTH) * pitch;
    }

    return { roll: st.roll, pitch: st.pitch };
  };

  const handleLine = (line) => {
    const parts = line.trim().split(",");
    if (parts.length !== 6) return;
    const nums = parts.map(Number);
    if (!nums.every(Number.isFinite)) return;
    const now = performance.now();
    const angles = processSample(nums, now);
    if (angles) pushAngles(angles, now);
  };

  const handleWatchLine = (line) => {
    const parts = line.trim().split(",");
    if (parts.length !== 3) return;
    const nums = parts.map(Number);
    if (!nums.every(Number.isFinite)) return;
    const now = performance.now();
    pushAngles(processWatch(nums), now);
  };

  const connectSerial = async () => {
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
      resetState();
      setConnected(true);
      setSource("serial");
      setStatus("Calibrating… keep the sensor still for 2 s");
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(handleLine);
      }
      if (serial.current) {
        serial.current = null;
        setConnected(false);
        setSource(null);
        setStatus("Connection closed");
      }
    } catch (e) {
      setStatus(`Serial error: ${e.message}`);
      serial.current = null;
      setConnected(false);
      setSource(null);
    }
  };

  const connectWatch = () => {
    if (!navigator.bluetooth) {
      setStatus("Web Bluetooth is not available. Use Chrome or Edge.");
      return;
    }
    if (typeof Puck === "undefined") {
      setStatus("puck.js is not loaded. Add its script tag to index.html.");
      return;
    }
    setStatus("Connecting to the watch…");
    Puck.connect((c) => {
      if (!c) {
        setStatus("Could not connect to the watch");
        return;
      }
      serial.current = { ble: c };
      resetState();
      setConnected(true);
      setSource("watch");
      setStatus("Uploading code to the watch…");
      let buf = "";
      c.on("data", (d) => {
        buf += d;
        const lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(handleWatchLine);
      });
      c.on("close", () => {
        if (serial.current) {
          serial.current = null;
          setConnected(false);
          setSource(null);
          setStatus("Watch disconnected");
        }
      });
      c.write("reset();\n", () =>
        setTimeout(() => c.write("\x03\x10" + WATCH_CODE + "\n"), 1500),
      );
    });
  };

  const connect = (kind = "serial") => {
    if (serial.current) return;
    if (kind === "watch") connectWatch();
    else connectSerial();
  };

  const disconnect = async () => {
    const s = serial.current;
    if (!s) return;
    serial.current = null;
    setConnected(false);
    setSource(null);
    try {
      if (s.ble) {
        s.ble.close();
      } else {
        await s.reader.cancel();
        await s.closed.catch(() => {});
        await s.port.close();
      }
    } catch {}
    buffer.current = [];
    setData([]);
    setStatus("Disconnected");
  };

  const setZero = () => {
    zero.current = { ...raw.current };
    buffer.current = [];
    setData([]);
  };

  useEffect(() => () => disconnect(), []);

  return {
    connected,
    source,
    status,
    data,
    connect,
    disconnect,
    setZero,
  };
}

export function measureMotion(data, windowSec = 10) {
  const last = data[data.length - 1];
  if (!last) return null;
  const win = data.filter((d) => d.t > last.t - windowSec);
  if (win.length < 10) return null;
  const mean = (k) => win.reduce((s, d) => s + d[k], 0) / win.length;
  const heel = mean("roll");
  const trim = mean("pitch");
  const amp = (k, m) => Math.max(...win.map((d) => Math.abs(d[k] - m)));
  const rollAmp = amp("roll", heel);
  const pitchAmp = amp("pitch", trim);
  const crossings = [];
  for (let i = 1; i < win.length; i++) {
    const a = win[i - 1].roll - heel;
    const b = win[i].roll - heel;
    if (a < 0 && b >= 0) {
      crossings.push(win[i - 1].t + (win[i].t - win[i - 1].t) * (-a / (b - a)));
    }
  }
  let Tn = NaN;
  if (crossings.length >= 3 && rollAmp > 0.5) {
    Tn =
      (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
  }
  return { heel, trim, rollAmp, pitchAmp, Tn };
}
