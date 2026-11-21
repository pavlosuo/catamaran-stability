export function parseSensor(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",").map(Number))
    .filter(([t, roll]) => Number.isFinite(t) && Number.isFinite(roll))
    .map(([t, roll, pitch]) => ({ t: t / 1000, roll, pitch }));
}

export function analyze(rows) {
  if (rows.length < 10) return null;
  const mean = rows.reduce((s, r) => s + r.roll, 0) / rows.length;
  const x = rows.map((r) => r.roll - mean);
  const crossings = [];
  for (let i = 1; i < x.length; i++) {
    if (x[i - 1] < 0 && x[i] >= 0) {
      const k = -x[i - 1] / (x[i] - x[i - 1]);
      crossings.push(rows[i - 1].t + k * (rows[i].t - rows[i - 1].t));
    }
  }
  const periods = crossings
    .slice(1)
    .map((c, i) => c - crossings[i])
    .sort((a, b) => a - b);
  const Tn = periods.length ? periods[Math.floor(periods.length / 2)] : NaN;
  const sorted = [...x].sort((a, b) => a - b);
  const amp =
    (sorted[Math.floor(sorted.length * 0.95)] -
      sorted[Math.floor(sorted.length * 0.05)]) /
    2;
  return { mean, Tn, amp };
}
