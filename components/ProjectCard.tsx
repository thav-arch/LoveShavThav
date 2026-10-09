"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Project } from "@/lib/projects";
import { getLabelTexture, LABEL_BAND } from "@/lib/card-label";
import { getProjectTexture } from "@/lib/textures";
import { cardFragment, cardVertex } from "./shaders/card";

export type CardUniforms = Record<string, THREE.IUniform>;
export type CardHandle = { uniforms: CardUniforms; meshes: THREE.Mesh[] };

type Props = {
  k: number;
  project: Project;
  /** frame height in world units; width follows the cover's proportions */
  cardH: number;
  shared: CardUniforms;
  register: (k: number, handle: CardHandle | null) => void;
};

const DEFAULT_ASPECT = 1.6;

/**
 * One frame of the film strip: the curved card plus its faint floor reflection.
 * Its width comes from the project's cover proportions (project.aspect).
 * Both meshes share the same uniform objects (only uMirror differs), so the
 * carousel loop updates a single set of values per card.
 */
export function ProjectCard({ k, project, cardH, shared, register }: Props) {
  const aspect = project.aspect ?? DEFAULT_ASPECT;
  const handle = useMemo<CardHandle>(() => {
    const tex = getProjectTexture(project);
    const geometry = new THREE.PlaneGeometry(cardH * aspect, cardH, 64, 12);
    const uniforms: CardUniforms = {
      ...shared,
      uMap: { value: tex.texture },
      uCover: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: aspect },
      uHalfW: { value: (cardH * aspect) / 2 },
      uCorner: { value: 0.045 },
      uOffset: { value: 0 },
      uScale: { value: 1 },
      uVel: { value: 0 },
      uHover: { value: 0 },
      uHoverUv: { value: new THREE.Vector2(0.5, 0.5) },
      uFly: { value: 0 },
      uDrop: { value: 0 },
      uPush: { value: 0 },
      uAlpha: { value: 0 },
      uBright: { value: 1 },
      uFocus: { value: 0 },
      uMirror: { value: 0 },
      // the title printed on the card (lib/card-label.ts)
      uLabel: { value: getLabelTexture(project, aspect) },
      uLabelBand: { value: LABEL_BAND },
      uLabelOn: { value: 0 },
      uMeta: { value: 0 },
      uInd: { value: 0 },
    };
    const make = (mirror: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: cardVertex,
        fragmentShader: cardFragment,
        transparent: true,
        depthWrite: !mirror,
        uniforms: mirror ? { ...uniforms, uMirror: { value: 1 } } : uniforms,
      });
    const main = new THREE.Mesh(geometry, make(false));
    const reflection = new THREE.Mesh(geometry, make(true));
    reflection.renderOrder = -10;
    for (const m of [main, reflection]) m.frustumCulled = false;
    return { uniforms, meshes: [main, reflection] };
  }, [project, cardH, aspect, shared]);

  useEffect(() => {
    const entry = getProjectTexture(project);
    const sync = () => {
      handle.uniforms.uMap.value = entry.texture;
      const a = entry.aspect;
      (handle.uniforms.uCover.value as THREE.Vector2).set(Math.min(1, aspect / a), Math.min(1, a / aspect));
    };
    sync();
    entry.listeners.add(sync);
    register(k, handle);
    return () => {
      entry.listeners.delete(sync);
      register(k, null);
      handle.meshes.forEach((m) => (m.material as THREE.Material).dispose());
      handle.meshes[0].geometry.dispose();
    };
  }, [handle, project, k, aspect, register]);

  return (
    <>
      {handle.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}
