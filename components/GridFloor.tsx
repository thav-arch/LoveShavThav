"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { clamp, damp, motion } from "@/lib/motion";
import { visibleHeight } from "@/lib/layout";
import { gridFragment, gridVertex, haloFragment, haloVertex } from "./shaders/grid";

const CELL = 1;
const SEG = 0.5;

const ndc = new THREE.Vector2();
const ray = new THREE.Raycaster();

/**
 * Glowing pastel grid floor: line layer + analytic glow halo. Slides with the
 * carousel, follows the cursor with a pool of light, flares with scroll speed
 * and ripples under the portal.
 */
export function GridFloor() {
  const { lines, halo, materials, uniforms } = useMemo(() => {
    const pts: number[] = [];
    const X = 26;
    const Z0 = -40;
    const Z1 = 8;
    // lines parallel to x (constant z), cut into short segments so they can bend
    for (let z = Z0; z <= Z1; z += CELL) for (let x = -X; x < X; x += SEG) pts.push(x, 0, z, x + SEG, 0, z);
    // lines parallel to z (constant x)
    for (let x = -X; x <= X; x += CELL) for (let z = Z0; z < Z1; z += SEG) pts.push(x, 0, z, x, 0, z + SEG);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));

    const uniforms = {
      uVoid: { value: 0 },
      uTime: { value: 0 },
      uShift: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPointerOn: { value: 0 },
      uEnergy: { value: 0 },
      uPhase: { value: 0 },
      uHue: { value: 0 },
      uOpacity: { value: 0 },
      uFogNear: { value: 8 },
      uFogFar: { value: 20 },
    };
    const make = (vertexShader: string, fragmentShader: string) =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    const lineMat = make(gridVertex, gridFragment);
    const haloMat = make(haloVertex, haloFragment);

    const lines = new THREE.LineSegments(g, lineMat);
    lines.frustumCulled = false;
    lines.renderOrder = -20;

    const halo = new THREE.Mesh(new THREE.PlaneGeometry(60, 48), haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.z = -16;
    halo.frustumCulled = false;
    halo.renderOrder = -21;
    return { lines, halo, materials: [lineMat, haloMat], uniforms };
  }, []);

  useEffect(
    () => () => {
      lines.geometry.dispose();
      halo.geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [lines, halo, materials],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const L = motion.layout;
    const u = uniforms;
    lines.visible = halo.visible = motion.theme.gridIntensity > 0;
    const portal = motion.portal.open;
    lines.position.y = L.floorY;
    halo.position.y = L.floorY - 0.002;

    // the film's sideways speed is its speed along the path × cos(fold)
    const sx = motion.arc * Math.cos(L.fold);
    u.uShift.value = -(((sx % CELL) + CELL) % CELL);
    u.uTime.value = state.clock.elapsedTime;
    u.uVoid.value = 1 - Math.pow(1 - portal, 3);
    u.uFogNear.value = L.fogNear;
    u.uFogFar.value = L.fogFar + 6;
    u.uPhase.value = motion.pos;
    u.uHue.value = damp(u.uHue.value, motion.theme.gridHue + motion.pos * 0.11, 3, dt);
    u.uEnergy.value = damp(u.uEnergy.value, clamp(Math.abs(motion.vel) / 2.2, 0, 1), 5, dt);

    // where the cursor touches the floor (or the floor just in front of the cards)
    let tx = 0;
    let tz = 0.5;
    if (motion.pointer.inside || motion.dragging) {
      ndc.set(motion.pointer.x, motion.pointer.y);
      ray.setFromCamera(ndc, state.camera);
      const d = ray.ray.direction;
      const o = ray.ray.origin;
      const t = d.y < -1e-3 ? (L.floorY - o.y) / d.y : Infinity;
      const halfW = (visibleHeight(L.fov, L.camZ) * motion.viewport.w) / motion.viewport.h / 2;
      if (t < 30) {
        tx = o.x + d.x * t;
        tz = Math.max(o.z + d.z * t, -14);
      } else tx = motion.pointer.x * halfW;
    }
    const p = u.uPointer.value;
    p.set(damp(p.x, tx, 5, dt), damp(p.y, tz, 5, dt));
    const on = (motion.pointer.inside || motion.dragging ? 1 : 0) * (1 - motion.fly);
    u.uPointerOn.value = damp(u.uPointerOn.value, on, 3, dt);

    u.uOpacity.value =
      0.34 * motion.theme.gridIntensity * clamp(motion.intro * 1.6 - 0.5, 0, 1) * (1 - motion.fly) * (0.5 + 0.5 * motion.worldVis);
  }, -1);

  return (
    <>
      <primitive object={halo} />
      <primitive object={lines} />
    </>
  );
}
