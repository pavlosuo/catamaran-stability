import { useEffect, useMemo } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Water } from "three/addons/objects/Water.js";
import { Sky } from "three/addons/objects/Sky.js";
import * as THREE from "three";
import { C } from "./Scene";

function configureSky(sky, sun) {
  const u = sky.material.uniforms;
  u.turbidity.value = 0;
  u.rayleigh.value = 1.9;
  u.mieCoefficient.value = 0.01;
  u.mieDirectionalG.value = 0.9;
  if (u.cloudCoverage) {
    u.cloudCoverage.value = 0.4;
    u.cloudDensity.value = 0.5;
    u.cloudElevation.value = 0.5;
  }
  u.sunPosition.value.copy(sun);
}

export function Ocean({ env, animate = true, elevation, azimuth }) {
  const { gl, scene } = useThree();
  const normals = useLoader(THREE.TextureLoader, `/textures/waternormals.jpg`);
  const sun = useMemo(
    () =>
      new THREE.Vector3().setFromSphericalCoords(
        1,
        THREE.MathUtils.degToRad(90 - elevation),
        THREE.MathUtils.degToRad(azimuth),
      ),
    [elevation, azimuth],
  );

  const { water, sky } = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const water = new Water(new THREE.PlaneGeometry(10000, 10000), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(),
      sunColor: C.sun,
      waterColor: C.water,
      distortionScale: 1.7,
    });
    water.rotation.x = -Math.PI / 2;
    const sky = new Sky();
    sky.scale.setScalar(10000);
    return { water, sky };
  }, [normals, scene]);

  useEffect(() => {
    configureSky(sky, sun);
    water.material.uniforms.sunDirection.value.copy(sun).normalize();
    const envSky = new Sky();
    envSky.scale.setScalar(10000);
    configureSky(envSky, sun);
    const envScene = new THREE.Scene();
    envScene.add(envSky);
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromScene(envScene);
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      envSky.geometry.dispose();
      envSky.material.dispose();
    };
  }, [gl, scene, sky, water, sun]);

  useFrame((_, dt) => {
    const u = water.material.uniforms;
    if (animate) u.time.value += dt / Math.max(env.Tw, 0.3);
    u.distortionScale.value = THREE.MathUtils.clamp(env.Hw * 120, 0.5, 8);
  });

  return (
    <>
      <primitive object={water} />
      <primitive object={sky} />
    </>
  );
}
