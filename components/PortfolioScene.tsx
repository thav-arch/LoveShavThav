"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { motion } from "@/lib/motion";
import { portalRef, sceneTarget } from "@/lib/sceneTarget";
import { usePortfolio } from "@/lib/store";
import { disposeLabelTextures } from "@/lib/card-label";
import { disposeProjectTextures, setMaxAnisotropy } from "@/lib/textures";
import { ProjectWorld } from "./ProjectWorld";
import { compositeFragment, flowFragment, fullscreenVertex } from "./shaders/flow";

const FLOW_SIZE = 128;
/** how long the wake keeps rendering after the cursor stops (ms) */
// the liquid wake is a brief, local ripple — a long, screen-wide smear reads as motion blur
const WAKE_MS = 900;

/**
 * Manual render pass (priority 1 disables R3F's own render).
 *  1. While the portal is visible the scene is rendered without it into a
 *     half-res target, which the chrome ring samples for refraction.
 *  2. While the cursor's liquid wake is alive, the frame is rendered into an
 *     MSAA target and composited through the flow map (shaders/flow.ts).
 *     When the cursor has been still for a while the scene renders directly,
 *     so the effect costs nothing at rest.
 */
function Renderer() {
  const { gl, size } = useThree();

  const fx = useMemo(() => {
    const frame = new THREE.WebGLRenderTarget(2, 2, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    const flowOpts = {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    };
    let read = new THREE.WebGLRenderTarget(FLOW_SIZE, FLOW_SIZE, flowOpts);
    let write = new THREE.WebGLRenderTarget(FLOW_SIZE, FLOW_SIZE, flowOpts);
    const quad = new THREE.PlaneGeometry(2, 2);
    const flowMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: flowFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tMap: { value: read.texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uVelocity: { value: new THREE.Vector2() },
        uFalloff: { value: 0.1 },
        uAlpha: { value: 1 },
        uDissipation: { value: 0.965 },
        uAspect: { value: 1 },
      },
    });
    const compMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: frame.texture },
        tFlow: { value: read.texture },
        uStrength: { value: 0.018 },
        uTime: { value: 0 },
      },
    });
    const flowMesh = new THREE.Mesh(quad, flowMat);
    const compMesh = new THREE.Mesh(quad, compMat);
    flowMesh.frustumCulled = compMesh.frustumCulled = false;
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return {
      frame,
      flowMat,
      compMat,
      flowMesh,
      compMesh,
      ortho,
      swap() {
        [read, write] = [write, read];
      },
      get read() {
        return read;
      },
      get write() {
        return write;
      },
      dispose() {
        frame.dispose();
        read.dispose();
        write.dispose();
        quad.dispose();
        flowMat.dispose();
        compMat.dispose();
      },
    };
  }, []);

  useEffect(() => fx.dispose, [fx]);
  useEffect(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2());
    fx.frame.setSize(v.x, v.y);
  }, [size, gl, fx]);

  const st = useRef({ px: NaN, py: NaN, vx: 0, vy: 0, lastMove: -1e9 });

  useFrame(({ gl, scene, camera, clock }, dt) => {
    const now = performance.now();
    const p = motion.pointer;
    const s = st.current;

    // cursor velocity in px/ms, smoothed
    if (Number.isNaN(s.px)) {
      s.px = p.px;
      s.py = p.py;
    }
    const dx = p.px - s.px;
    const dy = p.py - s.py;
    s.px = p.px;
    s.py = p.py;
    const ms = Math.max(dt * 1000, 1);
    s.vx += (dx / ms - s.vx) * 0.5;
    s.vy += (dy / ms - s.vy) * 0.5;
    const moving = (p.inside || motion.dragging) && Math.hypot(dx, dy) > 0.5;
    if (moving) s.lastMove = now;
    const wake = motion.theme.cursorWake && !motion.reducedMotion && now - s.lastMove < WAKE_MS;

    if (wake) {
      const u = fx.flowMat.uniforms;
      u.tMap.value = fx.read.texture;
      (u.uMouse.value as THREE.Vector2).set(p.px / motion.viewport.w, 1 - p.py / motion.viewport.h);
      // clamp so a fast flick bends the frame without tearing it apart
      (u.uVelocity.value as THREE.Vector2).set(s.vx, s.vy).clampLength(0, 1.4);
      u.uAlpha.value = moving ? 1 : 0;
      u.uAspect.value = motion.viewport.w / motion.viewport.h;
      u.uDissipation.value = Math.pow(0.9, dt * 60); // fades in ~0.3 s
      gl.setRenderTarget(fx.write);
      gl.render(fx.flowMesh, fx.ortho);
      fx.swap();
    }

    const portal = portalRef.current;
    if (portal?.visible) {
      portal.visible = false;
      gl.setRenderTarget(sceneTarget);
      gl.clear();
      gl.render(scene, camera);
      portal.visible = true;
    }

    if (wake) {
      gl.setRenderTarget(fx.frame);
      gl.clear();
      gl.render(scene, camera);
      fx.compMat.uniforms.tFlow.value = fx.read.texture;
      fx.compMat.uniforms.uTime.value = clock.elapsedTime;
      fx.compMat.uniforms.uStrength.value = motion.theme.wakeStrength * 0.6;
      gl.setRenderTarget(null);
      gl.render(fx.compMesh, fx.ortho);
    } else {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
    }
  }, 1);
  return null;
}

export default function PortfolioScene() {
  const mode = usePortfolio((s) => s.mode);
  const transition = usePortfolio((s) => s.transition);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    motion.reducedMotion = mq.matches;
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      disposeProjectTextures();
      disposeLabelTextures();
    };
  }, []);

  // the case study fully covers the canvas: stop rendering entirely
  const covered = (mode === "PROJECT" || mode === "PAGE") && transition === "idle";
  useEffect(() => {
    motion.paused = covered;
  }, [covered]);

  return (
    <div className="scene" data-covered={covered || undefined}>
      <Canvas
        frameloop={covered || tabHidden ? "never" : "always"}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 35, near: 0.1, far: 80, position: [0, 0.4, 7] }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color("#000000"), 1);
          setMaxAnisotropy(gl.capabilities.getMaxAnisotropy());
        }}
      >
        <ProjectWorld />
        <Renderer />
      </Canvas>
    </div>
  );
}
