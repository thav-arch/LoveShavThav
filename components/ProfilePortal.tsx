"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { portalMetrics, PORTAL_TUBE } from "@/lib/layout";
import { clamp, motion } from "@/lib/motion";
import { portalRef, sceneTarget } from "@/lib/sceneTarget";
import { chromeFragment, discFragment, discVertex, dropVertex, ringVertex } from "./shaders/portal";

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// droplets orbit slowly in the band just inside the ring, clear of the text
const DROPS = [
  { r: 0.05, rad: 0.7, speed: 0.07, ph: 0.6 },
  { r: 0.032, rad: 0.66, speed: -0.05, ph: 2.4 },
  { r: 0.04, rad: 0.72, speed: 0.045, ph: 3.9 },
  { r: 0.026, rad: 0.64, speed: -0.08, ph: 5.3 },
];

/**
 * Liquid chrome portal (WebGL part of the PROFILE / PLAYGROUND state).
 * It stays locked in front of the camera so it reads as a lens on the
 * screen while the 3D world keeps moving behind it.
 */
export function ProfilePortal() {
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const res = useMemo(() => new THREE.Vector2(1, 1), []);

  const { ring, disc, drops, shapeUniforms, materials } = useMemo(() => {
    const shapeUniforms = {
      uTime: { value: 0 },
      uLobe: { value: 1 },
      uWob: { value: 1 },
      uTube: { value: PORTAL_TUBE },
    };
    const chromeUniforms = {
      uScene: { value: sceneTarget.texture },
      uRes: { value: res },
      uRefract: { value: 0.08 },
    };
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: chromeFragment,
      uniforms: { ...shapeUniforms, ...chromeUniforms },
    });
    const discMat = new THREE.ShaderMaterial({ vertexShader: discVertex, fragmentShader: discFragment, uniforms: shapeUniforms });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, PORTAL_TUBE, 48, 240), ringMat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 160), discMat);
    disc.renderOrder = 1;
    ring.renderOrder = 2;
    const dropGeo = new THREE.IcosahedronGeometry(1, 5);
    const drops = DROPS.map((d, i) => {
      const m = new THREE.Mesh(
        dropGeo,
        new THREE.ShaderMaterial({
          vertexShader: dropVertex,
          fragmentShader: chromeFragment,
          uniforms: { ...chromeUniforms, uTime: shapeUniforms.uTime, uSeed: { value: i * 1.7 } },
        }),
      );
      m.renderOrder = 3;
      return m;
    });
    for (const o of [ring, disc, ...drops]) o.frustumCulled = false;
    return { ring, disc, drops, shapeUniforms, materials: [ringMat, discMat, ...drops.map((d) => d.material as THREE.Material)] };
  }, [res]);

  useEffect(() => {
    portalRef.current = group.current;
    return () => {
      portalRef.current = null;
      ring.geometry.dispose();
      disc.geometry.dispose();
      drops[0].geometry.dispose();
      materials.forEach((m) => m.dispose());
    };
  }, [ring, disc, drops, materials]);

  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const open = motion.portal.open;
    g.visible = open > 0.002;
    if (!g.visible) return;

    const t = state.clock.elapsedTime;
    const cam = state.camera;
    const pm = portalMetrics(motion.layout, motion.viewport.w / motion.viewport.h);

    // lock to the camera: centred on screen at a fixed distance
    cam.getWorldDirection(fwd);
    g.position.copy(cam.position).addScaledVector(fwd, pm.dist);
    g.quaternion.copy(cam.quaternion);

    const e = 1 - Math.pow(1 - open, 3);
    const swell = e * (1 + 0.07 * Math.sin(Math.min(open, 1) * Math.PI));
    g.scale.set(pm.sx * swell + 1e-4, pm.sy * swell + 1e-4, pm.sx * swell + 1e-4);
    ring.rotation.z = (1 - e) * 1.1;
    disc.rotation.z = ring.rotation.z;

    shapeUniforms.uTime.value = t;
    shapeUniforms.uLobe.value = 1.25 * (1 - smooth(0.12, 0.85, open));
    shapeUniforms.uWob.value = motion.reducedMotion ? 0.3 : 1;
    gl.getDrawingBufferSize(res);

    drops.forEach((m, i) => {
      const d = DROPS[i];
      const a = t * d.speed + d.ph;
      const rr = d.rad + 0.03 * Math.sin(t * 0.7 + i);
      m.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.1 + 0.05 * Math.sin(t * 0.5 + i));
      const s = d.r * smooth(0.55, 1, open) * (1 + 0.15 * Math.sin(t * 1.2 + d.ph));
      m.scale.setScalar(s + 1e-4);
    });
  }, -1);

  return (
    <group ref={group} visible={false}>
      <primitive object={disc} />
      <primitive object={ring} />
      {drops.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
