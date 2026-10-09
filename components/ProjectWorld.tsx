"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { computeLayout } from "@/lib/layout";
import { damp, motion } from "@/lib/motion";
import { sceneTarget } from "@/lib/sceneTarget";
import { usePortfolio } from "@/lib/store";
import { GridFloor } from "./GridFloor";
import { ProfilePortal } from "./ProfilePortal";
import { ProjectCarousel } from "./ProjectCarousel";

/**
 * The 3D exhibition space: responsive layout, a camera rig with damped pointer
 * parallax, and the world contents (grid, carousel, portal).
 */
export function ProjectWorld() {
  const { size, camera, gl } = useThree();
  const look = useRef(new THREE.Vector3());
  const smoothed = useRef({ x: 0, y: 0, w: 0 });

  useEffect(() => {
    motion.layout = computeLayout(size.width, size.height);
    motion.viewport.w = size.width;
    motion.viewport.h = size.height;
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = motion.layout.fov;
    cam.near = 0.1;
    cam.far = 80;
    cam.updateProjectionMatrix();
    const dpr = gl.getPixelRatio();
    sceneTarget.setSize(Math.round(size.width * dpr * 0.5), Math.round(size.height * dpr * 0.5));
  }, [size, camera, gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const L = motion.layout;
    const s = usePortfolio.getState();
    const sm = smoothed.current;
    // parallax only while the user is freely exploring
    const allow = s.transition === "idle" && motion.fly === 0 && !motion.reducedMotion && s.mode !== "PROJECT" ? 1 : 0;
    sm.w = damp(sm.w, allow, 3, dt);
    sm.x = damp(sm.x, motion.pointer.inside ? motion.pointer.x : 0, 2.6, dt);
    sm.y = damp(sm.y, motion.pointer.inside ? motion.pointer.y : 0, 2.6, dt);
    const px = sm.x * sm.w * L.parallax;
    const py = sm.y * sm.w * L.parallax;

    const intro = 1 - motion.intro;
    // a calm, small parallax and no camera roll (roll is a classic motion-sickness trigger)
    camera.position.set(-px * 0.22, L.camY - py * 0.08 + intro * 0.5, L.camZ + intro * intro * 2.4);
    look.current.set(-px * 0.08, L.lookY - py * 0.03, 0);
    camera.lookAt(look.current);
  }, -2);

  return (
    <>
      <GridFloor />
      <ProjectCarousel />
      <ProfilePortal />
    </>
  );
}
