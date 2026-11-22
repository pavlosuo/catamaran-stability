# Ballast-free catamaran: stability app

Arova Engineering Challenge 2026, combined path (mechanical + ICT + integration).

One app to load a model catamaran, assess it, compare two hull versions and
check the model against tank tests. No ballast water: stability comes from the
hull spacing and the cargo placement.

## Run

npm install
npm install leaflet
npm run dev

The route map needs internet for the map tiles. Without it the routes are
still drawn on a blank background.

## What it does

- **Stability tab:** draft, freeboard, GM, heel, roll, trim, pitch, heave and
  drag. Version A against version B under the same cargo, water and waves.
  Cargo limit and load margin. Hull spacing sweep (GM and roll period).
- **Cargo editor:** drag boxes in 3D or type positions. Overlap and deck-edge
  checks. "Suggest layout" finds a valid layout with the centre of gravity on
  the centreline.
- **Validation tab:** calculated against measured values with the difference
  in percent. Load tests from CSV, load MPU-6050 recordings from CSV.
- **Dashboard tab:** live roll and pitch, simulated from the model or measured
  from an MPU-6050 over USB serial (Chrome or Edge). Alerts against the limits
  and suggested corrections.
- **Routes tab:** five Baltic routes from Turku coloured by water density.
  Draft, freeboard, load margin and a go / caution / no-go decision for the
  current load. An extra-cargo field lets you test what-if cases.

All results are labelled calculated, simulated, estimated or measured.

## Methods

- Buoyancy: V = M / rho. Draft from the hull table (submerged volume against
  draft, exported from CAD).
- Stability: GM = KB + BM - KG. BM is corrected for the hull spacing with the
  parallel axis theorem.
- Heel = atan(yCG / GM). Trim = atan((xCG - LCB) / GML).
- Roll and pitch: one degree of freedom, resonance response to the wave slope.
- Heave: natural period from the waterplane area, added mass equal to the mass.
- Drag: 0.5 _ rho _ Cd _ A _ v^2 with A = 2 _ b _ draft.
- Water density from salinity: rho = 999.8 + 0.78 \* S (about 10 °C).

## Assumptions and limits

- Roll inertia radius 0.4 _ (spacing + hull width), pitch inertia radius
  0.25 _ length. Damping ratio 0.1 (roll), 0.2 (pitch), 0.3 (heave).
- Cd = 0.8 is a conservative placeholder, not a measured value.
- The hull table comes from the base CAD model. Changing the spacing changes
  the calculation only. The 3D view always shows the base model.
- Route salinity values are typical surface values, rounded. Waypoints are
  schematic and not for navigation.
- The waves in the 3D view illustrate the calculation. They are not a fluid
  simulation.

## Data files

- `src/data/hullData.json`: hydrostatic table from CAD.
- `src/data/data.js`: hull versions A and B, default cargo. Put the measured
  masses, spacings and CG heights here.
- Tests CSV: `version,freeboard_mm,heel_deg,period_s,note`
- Sensor CSV: `t_ms,roll_deg,pitch_deg`
- Serial lines for live mode: `roll_deg,pitch_deg` at 115200 baud.
