# Catamaran stability desk

Run: `npm install && npm run dev` (Node 18+). Build: `npm run build`.

- `src/physics.js` holds all calculations (no UI code). Units: kg, m, s, N, kg/m³, degrees.
- Model: two box-like hulls (block coefficient Cb), V = M/rho, draft = V/(Cb·2·L·b), GM = KB + BM − KG with parallel-axis waterplane inertia, heel = atan(yCG/GM), drag = 0.5·rho·Cd·A·v².
- Labels: calculated (hydrostatics), simulated (roll in waves, damping ratio 0.1 assumed), estimated (drag, roll period with k = 0.4·beam).
- Test data: hulls A (200 mm spacing) and B (120 mm), 3 cargo boxes (400 g), all made up; replace with team measurements.
- To validate: float the printed model, measure draft with a ruler, compare with the app and record the mismatch.
