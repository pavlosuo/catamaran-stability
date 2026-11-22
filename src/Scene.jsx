import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox, useGLTF } from "@react-three/drei";
import { ThreeDots } from "react-loader-spinner";
import { Ocean } from "@/Ocean";
import { getZone, zoneLimits, clamp, rad } from "@/utils";
import * as THREE from "three";

export const C = {
  hull: "#ffffff",
  deck: "#cfdcf1",
  cargo: "#0a6cff",
  bad: "#ff3b30",
  cg: "#0b1b33",
  water: "#7fb2ff",
  sun: "#fffcb1",
};

const MODEL_URL = "/models/boat.glb";
const MODEL_ROTATION = [0, 0, 0];
const WORLD_SCALE = 50;
const DECK_T = 0.006;

function PlaceholderHulls({ h, keel }) {
  const y = keel + h.H / 2;
  return (
    <>
      {[-1, 1].map((s) => (
        <RoundedBox
          key={s}
          args={[h.L, h.H, h.b]}
          radius={Math.min(h.b, h.H) / 2.2}
          smoothness={4}
          position={[0, y, (s * h.s) / 2]}
          castShadow
        >
          <meshStandardMaterial color={C.hull} roughness={0.35} />
        </RoundedBox>
      ))}
    </>
  );
}

function CustomModel({ url, h, keel }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const material = new THREE.MeshPhysicalMaterial({
      roughness: 1,
      transmission: 0,
      thickness: 1,
      color: C.cg,
    });
    const o = scene.clone(true);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.material = material;
      }
    });
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = h.L / size.x;
    o.scale.setScalar(k);
    o.position.set(-center.x * k, keel - box.min.y * k, -center.z * k);
    return o;
  }, [scene, h.L, keel]);
  return <primitive object={obj} rotation={MODEL_ROTATION} />;
}

function Boat({ h, cargo, r, env, animate, drag, setDrag, onMove }) {
  const g = useRef();
  const draft = Number.isFinite(r.draft) ? r.draft : 0.03;
  const keel = -draft;
  const deckY = keel + h.H;
  const top = keel + (MODEL_URL ? (h.deckTop ?? h.H) : h.H + DECK_T);
  const heel = Number.isFinite(r.heel) ? r.heel : 0;
  const roll = Number.isFinite(r.roll) ? clamp(r.roll, 0, 25) : 0;
  const deckW = h.s + h.b;

  useFrame(({ clock }) => {
    if (!g.current) return;
    const osc = animate
      ? roll * Math.sin((2 * Math.PI * clock.elapsedTime) / env.Tw)
      : 0;
    g.current.rotation.x = rad(heel + osc);
  });

  const move = (e) => {
    if (drag == null) return;
    e.stopPropagation();
    const item = cargo.find((c) => c.id === drag);
    if (!item) return;
    const p = g.current.worldToLocal(e.point.clone());
    const { xMin, xMax, yMin, yMax } = zoneLimits(getZone(h), item);
    onMove(drag, clamp(p.x, xMin, xMax), clamp(p.z, yMin, yMax));
  };

  return (
    <group ref={g}>
      {MODEL_URL ? (
        <Suspense fallback={null}>
          <CustomModel url={MODEL_URL} h={h} keel={keel} />
        </Suspense>
      ) : (
        <PlaceholderHulls h={h} keel={keel} />
      )}
      {!MODEL_URL && (
        <RoundedBox
          args={[h.L, DECK_T, deckW]}
          radius={0.002}
          position={[0, deckY + DECK_T / 2, 0]}
          receiveShadow
        >
          <meshStandardMaterial color={C.deck} roughness={0.6} />
        </RoundedBox>
      )}
      <mesh
        position={[0, top, 0]}
        rotation-x={-Math.PI / 2}
        onPointerMove={move}
      >
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {cargo.map(
        (c) =>
           (
            <mesh
              key={c.id}
              position={[c.x, top + c.h / 2, c.y]}
              castShadow
              onPointerDown={(e) => {
                e.stopPropagation();
                setDrag(c.id);
              }}
              onPointerOver={() => (document.body.style.cursor = "grab")}
              onPointerOut={() => (document.body.style.cursor = "")}
            >
              <boxGeometry args={[c.l, c.h, c.w]} />
              <meshStandardMaterial
                color={r.bad.has(c.id) ? C.bad : C.cargo}
                roughness={0.45}
              />
            </mesh>
          ),
      )}
      <mesh
        position={[r.xCG || 0, keel + (r.zCG || 0), r.yCG || 0]}
        renderOrder={10}
      >
        <sphereGeometry args={[0.006, 24, 24]} />
        <meshBasicMaterial color={C.hull} depthTest={false} />
      </mesh>
    </group>
  );
}

function Exposure({ value }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

export function Scene({ h, cargo, r, env, animate, onMove }) {
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    const up = () => setDrag(null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  return (
    <Suspense
      fallback={
        <ThreeDots
          height="80"
          width="80"
          radius="9"
          wrapperClass="custom-loader"
          visible={true}
        />
      }
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [34, 20, 58], fov: 45, near: 1, far: 20000 }}
        onPointerMissed={() => setDrag(null)}
      >
        <Exposure value={0.45} />
        <directionalLight position={[-40, 90, 60]} intensity={1.7} />
        <Ocean env={env} animate={animate} elevation={25} azimuth={180} />
        <group scale={WORLD_SCALE}>
          <Boat
            h={h}
            cargo={cargo}
            r={r}
            env={env}
            animate={animate}
            drag={drag}
            setDrag={setDrag}
            onMove={onMove}
          />
        </group>
        <OrbitControls
          makeDefault
          enabled={drag == null}
          target={[0, 3, 0]}
          enablePan={false}
          minDistance={18}
          maxDistance={140}
          maxPolarAngle={Math.PI * 0.495}
        />
      </Canvas>
    </Suspense>
  );
}
