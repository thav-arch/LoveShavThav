"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { projects } from "@/lib/projects";
import { setSceneCursor } from "@/lib/cursor";
import { portalMetrics, visibleHeight } from "@/lib/layout";
import {
  activeProjectIndex,
  clamp,
  damp,
  INSTANCE_COUNT,
  motion,
  projectAtInstance,
} from "@/lib/motion";
import { isPortalMode, usePortfolio } from "@/lib/store";
import { arcAt, frameOffset, frameWidth, PATH_MAX, PATH_N, pathModel, pickCard, slotOf, type Pick } from "@/lib/track";
import { loading, onReveal } from "@/lib/loading";
import { texturesReady } from "@/lib/textures";
import { enterProject, playIntro } from "@/lib/transitions";
import { ProjectCard, type CardHandle, type CardUniforms } from "./ProjectCard";

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Matrix4();

function pickAtPointer(camera: THREE.Camera): Pick | null {
  ndc.set(motion.pointer.x, motion.pointer.y);
  ray.setFromCamera(ndc, camera);
  return pickCard(ray.ray, motion.layout);
}

function makePathTexture() {
  const t = new THREE.DataTexture(new Float32Array(PATH_N * 4), PATH_N, 1, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.userData.key = "";
  return t;
}

/** pixels per world unit on the z = 0 plane (front of the arc) */
const basePx = () => motion.viewport.h / visibleHeight(motion.layout.fov, motion.layout.camZ);

/**
 * The WebGL carousel: owns the instances, the input (wheel / drag / keys /
 * click) and the single per-frame loop that drives every card uniform and the
 * HTML labels layered over the cards.
 */
export function ProjectCarousel() {
  const { camera, gl } = useThree();
  const router = useRouter();
  const handles = useRef<(CardHandle | null)[]>([]);
  const hoverUv = useRef(new THREE.Vector2(0.5, 0.5));

  const shared = useMemo<CardUniforms>(
    () => ({
      // the S-wave film path, shared with lib/track.ts as an arc-length table
      uPath: { value: makePathTexture() },
      uPathMax: { value: PATH_MAX },
      uPathN: { value: PATH_N },
      uCardY: { value: 0 },
      uFloorY: { value: -1.5 },
      uTime: { value: 0 },
      uFlyMatrix: { value: new THREE.Matrix4() },
      uVoid: { value: 0 },
      uVoidR: { value: 2 },
      uVoidY: { value: 0 },
      uFogNear: { value: 8 },
      uFogFar: { value: 20 },
    }),
    [],
  );

  useEffect(() => () => (shared.uPath.value as THREE.Texture).dispose(), [shared]);

  const register = useCallback((k: number, h: CardHandle | null) => {
    handles.current[k] = h;
  }, []);

  // first load: report progress to the film-reel loader; it opens its shutters
  // once the previews are decoded and then asks for the intro (lib/loading.ts)
  useEffect(() => {
    loading.sceneMounted();
    loading.expectTextures(projects.length);
    onReveal(() => playIntro());
    texturesReady().then(() => loading.markReady());
    const t = setTimeout(() => loading.markReady(), 6000); // never wait forever
    return () => clearTimeout(t);
  }, []);

  /* ---------------------------------------------------------------- input */
  useEffect(() => {
    const el = gl.domElement;
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let pxVel = 0;
    let moved = 0;
    let pointerId = -1;

    const canScroll = () => {
      const s = usePortfolio.getState();
      return s.transition === "idle" && (s.mode === "WORLD" || isPortalMode(s.mode));
    };
    const pxPerCard = () => motion.layout.pitch * basePx();

    const onWheel = (e: WheelEvent) => {
      if (!canScroll()) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      // never let the reel run more than ~1.5 frames ahead: a fast flick glides instead of racing
      motion.target = clamp(motion.target + clamp(d / 420, -0.6, 0.6), motion.pos - 1.5, motion.pos + 1.5);
      motion.lastInput = performance.now();
      motion.interaction = "wheel";
    };

    const onDown = (e: PointerEvent) => {
      if (!canScroll() || e.button > 0) return;
      pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      motion.dragging = true;
      startX = lastX = e.clientX;
      lastT = performance.now();
      pxVel = 0;
      moved = 0;
    };

    const onMove = (e: PointerEvent) => {
      motion.pointer.px = e.clientX;
      motion.pointer.py = e.clientY;
      motion.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      motion.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
      motion.pointer.inside = e.pointerType === "mouse" || motion.dragging;
      if (!motion.dragging || e.pointerId !== pointerId) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dt = Math.max(1, now - lastT) / 1000;
      lastX = e.clientX;
      lastT = now;
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      pxVel = pxVel * 0.65 + (dx / dt) * 0.35;
      motion.target -= dx / pxPerCard();
      motion.lastInput = now;
      if (moved > 6) {
        motion.interaction = "drag";
        setSceneCursor("DRAG");
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!motion.dragging || e.pointerId !== pointerId) return;
      motion.dragging = false;
      pointerId = -1;
      const now = performance.now();
      if (moved < 6) {
        motion.interaction = "idle";
        const hit = pickAtPointer(camera);
        const s = usePortfolio.getState();
        if (!hit || s.mode !== "WORLD") return;
        if (Math.abs(hit.slot) < 0.5) enterProject(projects[projectAtInstance(hit.k)].slug, router, "world");
        else motion.target = Math.round(motion.pos + hit.slot);
        return;
      }
      // release with inertia, then settle on the nearest card
      if (now - lastT > 90) pxVel = 0;
      motion.target = Math.round(motion.target - clamp((pxVel * 0.2) / pxPerCard(), -2, 2));
      motion.interaction = "idle";
      motion.lastInput = now;
      setSceneCursor(null);
    };

    const onLeave = () => {
      motion.pointer.inside = false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!canScroll() || (e.target as HTMLElement)?.closest?.("input, textarea")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") motion.target = Math.round(motion.target) + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") motion.target = Math.round(motion.target) - 1;
      else if (e.key === "Enter" && usePortfolio.getState().mode === "WORLD" && !(e.target as HTMLElement)?.closest?.("button, a"))
        enterProject(projects[activeProjectIndex()].slug, router, "world");
    };

    addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("pointerdown", onDown);
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      removeEventListener("keydown", onKey);
    };
  }, [gl, camera, router]);

  /* ----------------------------------------------------------- frame loop */
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const L = motion.layout;
    const store = usePortfolio.getState();
    const now = performance.now();

    // settle onto the nearest card once input stops
    if (!motion.dragging && motion.interaction === "wheel" && now - motion.lastInput > 160) {
      // biased toward the scroll direction so one deliberate notch always advances a card
      motion.target = Math.round(motion.target + 0.28 * Math.sign(motion.target - motion.pos));
      motion.interaction = "idle";
    }
    const prev = motion.pos;
    const lambda = motion.dragging ? 16 : motion.dampOverride || L.damping;
    motion.pos = damp(motion.pos, motion.target, lambda, dt);
    if (Math.abs(motion.pos - motion.target) < 1e-4) motion.pos = motion.target;
    motion.arc = arcAt(motion.pos, L);
    const v = (motion.pos - prev) / Math.max(dt, 1e-4);
    motion.vel = damp(motion.vel, clamp(v, -2.5, 2.5), 7, dt);
    // spring-follow the velocity, critically damped: frames lean with the scroll
    // and settle without wobbling (overshoot / jelly motion causes discomfort)
    const accel = (motion.vel - motion.flex) * 140 - motion.flexV * 23.7;
    motion.flexV += accel * dt;
    motion.flex += motion.flexV * dt;
    const accelSlow = (motion.flex - motion.flexSlow) * 45 - motion.flexSlowV * 13.4;
    motion.flexSlowV += accelSlow * dt;
    motion.flexSlow += motion.flexSlowV * dt;
    motion.spread = 1 + 0.02 * Math.min(Math.abs(motion.flex), 2);

    if (store.transition === "idle" && store.mode !== "PROJECT") {
      const ai = activeProjectIndex();
      if (ai !== store.activeIndex) store.set({ activeIndex: ai, direction: v >= 0 ? 1 : -1 });
    }

    // hover picking (mouse only)
    const canHover =
      store.mode === "WORLD" && store.transition === "idle" && motion.pointer.inside && motion.intro > 0.6 && motion.worldVis > 0.95;
    let hit: Pick | null = null;
    if (canHover && !motion.dragging) {
      hit = pickAtPointer(state.camera);
      if (hit) hoverUv.current.set(hit.u, hit.v);
    }
    motion.hovered = hit ? hit.k : -1;
    if (!motion.dragging) {
      setSceneCursor(hit ? (Math.abs(hit.slot) < 0.5 ? "VIEW" : hit.slot < 0 ? "PREV" : "NEXT") : null);
    }

    // screen-filling pose used by the open transition
    const D = 1.6;
    const vh = visibleHeight(L.fov, D);
    const vw = vh * (state.camera as THREE.PerspectiveCamera).aspect;
    const flyW = motion.flyInstance >= 0 ? frameWidth(motion.flyInstance, L) : L.cardW;
    const fs = Math.max(vh / L.cardH, vw / flyW) * 1.002;
    (shared.uFlyMatrix.value as THREE.Matrix4)
      .copy(state.camera.matrixWorld)
      .multiply(tmpM.makeTranslation(0, 0, -D))
      .multiply(tmpS.makeScale(fs, fs, 1));

    const portalE = easeOut(motion.portal.open);
    const pm = portalMetrics(L, motion.viewport.w / motion.viewport.h);
    const path = pathModel(L);
    const tex = shared.uPath.value as THREE.DataTexture;
    if (tex.userData.key !== path.key) {
      (tex.image.data as Float32Array).set(path.data);
      tex.userData.key = path.key;
      tex.needsUpdate = true;
    }
    shared.uCardY.value = L.cardY;
    shared.uFloorY.value = L.floorY;
    shared.uTime.value = state.clock.elapsedTime;
    shared.uVoid.value = portalE;
    shared.uVoidR.value = pm.voidR;
    shared.uVoidY.value = L.lookY;
    shared.uFogNear.value = L.fogNear;
    shared.uFogFar.value = L.fogFar;

    const velScale = (motion.reducedMotion ? 0.25 : 1) * (1 - motion.fly);
    // titles are printed on the cards (shaders/card.ts): fade them with the world
    const labelVis =
      (1 - smooth(0, 0.35, motion.fly)) * smooth(0.6, 1, motion.worldVis) * (1 - smooth(0, 0.3, portalE)) * smooth(0.45, 1, motion.intro);

    for (let k = 0; k < INSTANCE_COUNT; k++) {
      const h = handles.current[k];
      if (!h) continue;
      const u = h.uniforms;
      const slot = slotOf(k);
      const a = Math.abs(slot);
      const off = frameOffset(k, motion.arc, L);
      const fw = frameWidth(k, L);
      const isFly = k === motion.flyInstance;

      const introK = easeOut(clamp(motion.intro * 1.7 - a * 0.16 - 0.1, 0, 1));
      const wv = smooth(0, 1, clamp(motion.worldVis * 1.5 - a * 0.1, 0, 1));
      const vis = introK * wv;
      const edge = 1 - smooth(L.maxSlot - 0.9, L.maxSlot, a);
      const hover = damp(u.uHover.value, motion.hovered === k ? 1 : 0, 8, dt);
      // the centre frame reacts first; outer frames follow a beat later
      const vel = clamp((motion.flex + (motion.flexSlow - motion.flex) * clamp(a / 2.5, 0, 1)) * velScale, -1.4, 1.4);

      u.uOffset.value = off;
      u.uVel.value = vel;
      u.uHover.value = hover;
      if (motion.hovered === k) (u.uHoverUv.value as THREE.Vector2).lerp(hoverUv.current, 1 - Math.exp(-10 * dt));
      u.uFly.value = isFly ? motion.fly : 0;
      // the portal opening also pushes the reel back, clear of the ring
      u.uPush.value = isFly ? 0 : motion.fly * 2.8 + (1 - wv) * 1.2 + (1 - introK) * 0.7 + portalE * 1.4;
      u.uDrop.value = (1 - wv) * 1.6 + (1 - introK) * 0.18;
      u.uAlpha.value = edge * vis * (isFly ? 1 : 1 - motion.fly);
      // intro: each frame warms up like a projector lamp, with a faint flicker
      let lamp = 1;
      if (motion.intro < 1) {
        const lk = clamp(motion.intro * 1.5 - a * 0.14 - 0.12, 0, 1);
        const n = Math.sin(Math.floor(state.clock.elapsedTime * 24) * 7.13 + k * 12.9898) * 43758.5453;
        const flick = 1 - 0.22 * (1 - lk) * (n - Math.floor(n) > 0.6 ? 1 : 0);
        lamp = (0.22 + 0.78 * lk * lk * (3 - 2 * lk)) * flick;
      }
      u.uBright.value = (isFly ? 1 + 0.3 * motion.fly : 1 - 0.5 * portalE) * lamp;
      u.uFocus.value = 1 - clamp(a * 1.4, 0, 1);
      u.uCorner.value = motion.theme.cardRadius;
      const visible = u.uAlpha.value > 0.002;
      h.meshes[0].visible = visible;
      h.meshes[1].visible = visible && motion.fly < 0.5;
      h.meshes[0].renderOrder = isFly ? 1000 : 100 - Math.round(a * 10);

      // printed title: fades with the world, meta line + indicator with focus / hover
      const focus = u.uFocus.value;
      u.uLabelOn.value = labelVis * (isFly ? 1 : 1 - motion.fly);
      u.uMeta.value = focus;
      u.uInd.value = Math.max(focus * 0.75, hover);
    }
  }, -1);

  return (
    <>
      {Array.from({ length: INSTANCE_COUNT }, (_, k) => (
        <ProjectCard
          key={k}
          k={k}
          project={projects[projectAtInstance(k)]}
          cardH={motion.layout.cardH}
          shared={shared}
          register={register}
        />
      ))}
    </>
  );
}
