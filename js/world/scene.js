// The 3D world, in plain Three.js. Hand-ported from the original React Three Fiber components
// (PortfolioScene, ProjectWorld, ProjectCarousel, ProjectCard, GridFloor, ProfilePortal):
// same geometry, shaders, constants and per-frame maths — only the React wrappers are gone.
import * as THREE from "three";
import { portalMetrics, PORTAL_TUBE, visibleHeight, computeLayout } from "../core/layout.js";
import { activeProjectIndex, clamp, clampPos, damp, INSTANCE_COUNT, motion, PROJECT_COUNT, projectAtInstance } from "../core/motion.js";
import { projects } from "../core/projects.js";
import { setSceneCursor } from "../core/cursor.js";
import { loading } from "../core/loading.js";
import { portalRef, sceneTarget } from "../core/scene-target.js";
import * as store from "../core/store.js";
import { disposeLabelTextures, getLabelTexture, LABEL_BAND } from "../core/card-label.js";
import { getProjectTexture, setMaxAnisotropy, texturesReady } from "../core/textures.js";
import { arcAt, frameOffset, frameWidth, PATH_MAX, PATH_N, pathModel, pickCard, slotOf } from "../core/track.js";
import { cardFragment, cardVertex } from "./shader-card.js";
import { compositeFragment, flowFragment, fullscreenVertex } from "./shader-flow.js";
import { gridFragment, gridVertex, haloFragment, haloVertex } from "./shader-grid.js";
import { chromeFragment, discFragment, discVertex, dropVertex, ringVertex } from "./shader-portal.js";

const FLOW_SIZE = 128;
// the liquid wake is a brief, local ripple — a long, screen-wide smear reads as motion blur
const WAKE_MS = 900;
const DEFAULT_ASPECT = 1.6;

const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * createWorld(container, { openProject })
 *   openProject(slug, "world")  is called when a card is clicked / Enter is pressed.
 */
export function createWorld(container, { openProject }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false });
  const dpr = () => Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.75);
  renderer.setPixelRatio(dpr());
  renderer.setClearColor(new THREE.Color("#000000"), 1);
  renderer.autoClear = true;
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  camera.position.set(0, 0.4, 7);

  motion.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- sizing */
  const frameTarget = new THREE.WebGLRenderTarget(2, 2, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setPixelRatio(dpr());
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    motion.layout = computeLayout(w, h);
    motion.viewport.w = w;
    motion.viewport.h = h;
    camera.fov = motion.layout.fov;
    camera.aspect = w / h;
    camera.near = 0.1;
    camera.far = 80;
    camera.updateProjectionMatrix();
    const ratio = renderer.getPixelRatio();
    sceneTarget.setSize(Math.round(w * ratio * 0.5), Math.round(h * ratio * 0.5));
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    frameTarget.setSize(v.x, v.y);
  };
  resize();
  addEventListener("resize", resize);

  /* ------------------------------------------------------- liquid cursor wake */
  const flowOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  let flowRead = new THREE.WebGLRenderTarget(FLOW_SIZE, FLOW_SIZE, flowOpts);
  let flowWrite = new THREE.WebGLRenderTarget(FLOW_SIZE, FLOW_SIZE, flowOpts);
  const quad = new THREE.PlaneGeometry(2, 2);
  const flowMat = new THREE.ShaderMaterial({
    vertexShader: fullscreenVertex,
    fragmentShader: flowFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tMap: { value: flowRead.texture },
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
      tScene: { value: frameTarget.texture },
      tFlow: { value: flowRead.texture },
      uStrength: { value: 0.018 },
      uTime: { value: 0 },
    },
  });
  const flowMesh = new THREE.Mesh(quad, flowMat);
  const compMesh = new THREE.Mesh(quad, compMat);
  flowMesh.frustumCulled = compMesh.frustumCulled = false;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const wake = { px: NaN, py: NaN, vx: 0, vy: 0, lastMove: -1e9 };

  /* -------------------------------------------------------------- grid floor */
  const CELL = 1;
  const SEG = 0.5;
  const gridU = {
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
  const gridMaterials = (() => {
    const make = (vertexShader, fragmentShader) =>
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: gridU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return [make(gridVertex, gridFragment), make(haloVertex, haloFragment)];
  })();
  const gridLines = (() => {
    const pts = [];
    const X = 26;
    const Z0 = -40;
    const Z1 = 8;
    // lines parallel to x (constant z), cut into short segments so they can bend
    for (let z = Z0; z <= Z1; z += CELL) for (let x = -X; x < X; x += SEG) pts.push(x, 0, z, x + SEG, 0, z);
    // lines parallel to z (constant x)
    for (let x = -X; x <= X; x += CELL) for (let z = Z0; z < Z1; z += SEG) pts.push(x, 0, z, x, 0, z + SEG);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, gridMaterials[0]);
    lines.frustumCulled = false;
    lines.renderOrder = -20;
    return lines;
  })();
  const gridHalo = (() => {
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(60, 48), gridMaterials[1]);
    halo.rotation.x = -Math.PI / 2;
    halo.position.z = -16;
    halo.frustumCulled = false;
    halo.renderOrder = -21;
    return halo;
  })();
  scene.add(gridHalo, gridLines);

  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();

  function updateGrid(elapsed, dt) {
    const L = motion.layout;
    const u = gridU;
    gridLines.visible = gridHalo.visible = motion.theme.gridIntensity > 0;
    const portal = motion.portal.open;
    gridLines.position.y = L.floorY;
    gridHalo.position.y = L.floorY - 0.002;

    // the centre frame faces the camera, so the film's sideways speed there is its speed along the path
    const sx = motion.arc;
    u.uShift.value = -(((sx % CELL) + CELL) % CELL);
    u.uTime.value = elapsed;
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
      ray.setFromCamera(ndc, camera);
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

    u.uOpacity.value = 0.34 * motion.theme.gridIntensity * clamp(motion.intro * 1.6 - 0.5, 0, 1) * (1 - motion.fly) * (0.5 + 0.5 * motion.worldVis);
  }

  /* -------------------------------------------------------------- the strip */
  const makePathTexture = () => {
    const t = new THREE.DataTexture(new Float32Array(PATH_N * 4), PATH_N, 1, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.userData.key = "";
    return t;
  };
  const shared = {
    // the S-wave film path, shared with core/track.js as an arc-length table
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
  };

  /** one frame of the film strip: the curved card plus its faint floor reflection */
  function createCard(k, project, cardH) {
    const aspect = project.aspect ?? DEFAULT_ASPECT;
    const entry = getProjectTexture(project);
    const geometry = new THREE.PlaneGeometry(cardH * aspect, cardH, 64, 12);
    const uniforms = {
      ...shared,
      uMap: { value: entry.texture },
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
      // the title printed on the card (core/card-label.js)
      uLabel: { value: getLabelTexture(project, aspect) },
      uLabelBand: { value: LABEL_BAND },
      uLabelOn: { value: 0 },
      uMeta: { value: 0 },
      uInd: { value: 0 },
    };
    const make = (mirror) =>
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
    const sync = () => {
      uniforms.uMap.value = entry.texture;
      const a = entry.aspect;
      uniforms.uCover.value.set(Math.min(1, aspect / a), Math.min(1, a / aspect));
    };
    sync();
    entry.listeners.add(sync);
    scene.add(main, reflection);
    return { uniforms, meshes: [main, reflection] };
  }

  const cards = [];
  for (let k = 0; k < INSTANCE_COUNT; k++) cards.push(createCard(k, projects[projectAtInstance(k)], motion.layout.cardH));

  // first load: report progress; js/main.js starts the intro once the previews are decoded
  // (core/loading.js)
  loading.sceneMounted();
  loading.expectTextures(projects.length);
  texturesReady().then(() => loading.markReady());
  setTimeout(() => loading.markReady(), 6000); // never wait forever

  /* ---------------------------------------------------------------- input */
  const tmpM = new THREE.Matrix4();
  const tmpS = new THREE.Matrix4();
  const hoverUv = new THREE.Vector2(0.5, 0.5);
  const basePx = () => motion.viewport.h / visibleHeight(motion.layout.fov, motion.layout.camZ);
  const pickAtPointer = () => {
    ndc.set(motion.pointer.x, motion.pointer.y);
    ray.setFromCamera(ndc, camera);
    return pickCard(ray.ray, motion.layout);
  };

  let startX = 0;
  let lastX = 0;
  let lastT = 0;
  let pxVel = 0;
  let moved = 0;
  let pointerId = -1;
  const canScroll = () => store.state.transition === "idle" && (store.state.mode === "WORLD" || store.isPortalMode(store.state.mode));
  const pxPerCard = () => motion.layout.pitch * basePx();

  const onWheel = (e) => {
    if (!canScroll()) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
    // never let the reel run more than ~1.5 frames ahead: a fast flick glides instead of racing
    motion.target = clamp(motion.target + clamp(d / 520, -0.45, 0.45), motion.pos - 1.2, motion.pos + 1.2);
    // the strip ends at the first / last project: only a hint of give past the ends
    motion.target = clamp(motion.target, -0.08, PROJECT_COUNT - 1 + 0.08);
    motion.lastInput = performance.now();
    motion.interaction = "wheel";
  };
  // a tap has no pointermove before it, so every pointer event refreshes the position used for picking
  const setPointer = (e) => {
    motion.pointer.px = e.clientX;
    motion.pointer.py = e.clientY;
    motion.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    motion.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  };
  const onDown = (e) => {
    if (!canScroll() || e.button > 0) return;
    setPointer(e);
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    motion.dragging = true;
    startX = lastX = e.clientX;
    lastT = performance.now();
    pxVel = 0;
    moved = 0;
  };
  const onMove = (e) => {
    setPointer(e);
    motion.pointer.inside = e.pointerType === "mouse" || motion.dragging;
    if (!motion.dragging || e.pointerId !== pointerId) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT) / 1000;
    lastX = e.clientX;
    lastT = now;
    moved = Math.max(moved, Math.abs(e.clientX - startX));
    pxVel = pxVel * 0.65 + (dx / dt) * 0.35;
    // past the first / last project the strip resists (rubber band) and springs back on release
    const out = motion.target < 0 || motion.target > PROJECT_COUNT - 1;
    motion.target = clamp(motion.target - (dx / pxPerCard()) * (out ? 0.3 : 1), -0.35, PROJECT_COUNT - 1 + 0.35);
    motion.lastInput = now;
    if (moved > 6) {
      motion.interaction = "drag";
      setSceneCursor("DRAG");
    }
  };
  const onUp = (e) => {
    if (!motion.dragging || e.pointerId !== pointerId) return;
    motion.dragging = false;
    pointerId = -1;
    const now = performance.now();
    if (moved < 6) {
      motion.interaction = "idle";
      setPointer(e);
      const hit = pickAtPointer();
      if (!hit || store.state.mode !== "WORLD") return;
      if (Math.abs(hit.slot) < 0.5) openProject(projects[projectAtInstance(hit.k)].slug, "world");
      else motion.target = clampPos(Math.round(motion.pos + hit.slot));
      return;
    }
    // release with inertia, then settle on the nearest card
    if (now - lastT > 90) pxVel = 0;
    motion.target = clampPos(Math.round(motion.target - clamp((pxVel * 0.2) / pxPerCard(), -2, 2)));
    motion.interaction = "idle";
    motion.lastInput = now;
    setSceneCursor(null);
  };
  const onLeave = () => {
    motion.pointer.inside = false;
  };
  const onKey = (e) => {
    if (!canScroll() || e.target?.closest?.("input, textarea")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") motion.target = clampPos(Math.round(motion.target) + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") motion.target = clampPos(Math.round(motion.target) - 1);
    else if (e.key === "Home") motion.target = 0;
    else if (e.key === "End") motion.target = PROJECT_COUNT - 1;
    else if (e.key === "Enter" && store.state.mode === "WORLD" && !e.target?.closest?.("button, a")) openProject(projects[activeProjectIndex()].slug, "world");
  };
  addEventListener("wheel", onWheel, { passive: true });
  canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);
  document.documentElement.addEventListener("pointerleave", onLeave);
  addEventListener("keydown", onKey);

  /* ------------------------------------------------------------ the portal */
  const DROPS = [
    { r: 0.05, rad: 0.7, speed: 0.07, ph: 0.6 },
    { r: 0.032, rad: 0.66, speed: -0.05, ph: 2.4 },
    { r: 0.04, rad: 0.72, speed: 0.045, ph: 3.9 },
    { r: 0.026, rad: 0.64, speed: -0.08, ph: 5.3 },
  ];
  const portalRes = new THREE.Vector2(1, 1);
  const portalGroup = new THREE.Group();
  portalGroup.visible = false;
  const shapeUniforms = { uTime: { value: 0 }, uLobe: { value: 1 }, uWob: { value: 1 }, uTube: { value: PORTAL_TUBE } };
  const chromeUniforms = { uScene: { value: sceneTarget.texture }, uRes: { value: portalRes }, uRefract: { value: 0.08 } };
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, PORTAL_TUBE, 48, 240),
    new THREE.ShaderMaterial({ vertexShader: ringVertex, fragmentShader: chromeFragment, uniforms: { ...shapeUniforms, ...chromeUniforms } }),
  );
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 160), new THREE.ShaderMaterial({ vertexShader: discVertex, fragmentShader: discFragment, uniforms: shapeUniforms }));
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
  portalGroup.add(disc, ring, ...drops);
  scene.add(portalGroup);
  portalRef.current = portalGroup;
  const fwd = new THREE.Vector3();

  function updatePortal(elapsed) {
    const g = portalGroup;
    const open = motion.portal.open;
    g.visible = open > 0.002;
    if (!g.visible) return;
    const t = elapsed;
    const pm = portalMetrics(motion.layout, motion.viewport.w / motion.viewport.h);
    // lock to the camera: centred on screen at a fixed distance
    camera.getWorldDirection(fwd);
    g.position.copy(camera.position).addScaledVector(fwd, pm.dist);
    g.quaternion.copy(camera.quaternion);
    const e = 1 - Math.pow(1 - open, 3);
    const swell = e * (1 + 0.07 * Math.sin(Math.min(open, 1) * Math.PI));
    g.scale.set(pm.sx * swell + 1e-4, pm.sy * swell + 1e-4, pm.sx * swell + 1e-4);
    ring.rotation.z = (1 - e) * 1.1;
    disc.rotation.z = ring.rotation.z;
    shapeUniforms.uTime.value = t;
    shapeUniforms.uLobe.value = 1.25 * (1 - smooth(0.12, 0.85, open));
    shapeUniforms.uWob.value = motion.reducedMotion ? 0.3 : 1;
    renderer.getDrawingBufferSize(portalRes);
    drops.forEach((m, i) => {
      const d = DROPS[i];
      const a = t * d.speed + d.ph;
      const rr = d.rad + 0.03 * Math.sin(t * 0.7 + i);
      m.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.1 + 0.05 * Math.sin(t * 0.5 + i));
      const s = d.r * smooth(0.55, 1, open) * (1 + 0.15 * Math.sin(t * 1.2 + d.ph));
      m.scale.setScalar(s + 1e-4);
    });
  }

  /* ------------------------------------------------------ camera rig + loop */
  const look = new THREE.Vector3();
  const smoothed = { x: 0, y: 0, w: 0 };

  function updateCamera(dt) {
    const L = motion.layout;
    const s = store.state;
    // parallax only while the user is freely exploring
    const allow = s.transition === "idle" && motion.fly === 0 && !motion.reducedMotion && s.mode !== "PROJECT" ? 1 : 0;
    smoothed.w = damp(smoothed.w, allow, 3, dt);
    smoothed.x = damp(smoothed.x, motion.pointer.inside ? motion.pointer.x : 0, 2.6, dt);
    smoothed.y = damp(smoothed.y, motion.pointer.inside ? motion.pointer.y : 0, 2.6, dt);
    const px = smoothed.x * smoothed.w * L.parallax;
    const py = smoothed.y * smoothed.w * L.parallax;
    const intro = 1 - motion.intro;
    // a calm, small parallax and no camera roll (roll is a classic motion-sickness trigger)
    camera.position.set(-px * 0.22, L.camY - py * 0.08 + intro * 0.5, L.camZ + intro * intro * 2.4);
    look.set(-px * 0.08, L.lookY - py * 0.03, 0);
    camera.lookAt(look);
  }

  function updateCarousel(elapsed, dt) {
    const L = motion.layout;
    const now = performance.now();

    // settle onto the nearest card once input stops
    if (!motion.dragging && motion.interaction === "wheel" && now - motion.lastInput > 160) {
      // biased toward the scroll direction so one deliberate notch always advances a card
      motion.target = clampPos(Math.round(motion.target + 0.28 * Math.sign(motion.target - motion.pos)));
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

    if (store.state.transition === "idle" && store.state.mode !== "PROJECT") {
      const ai = activeProjectIndex();
      if (ai !== store.state.activeIndex) store.set({ activeIndex: ai, direction: v >= 0 ? 1 : -1 });
    }

    // hover picking (mouse only)
    const canHover = store.state.mode === "WORLD" && store.state.transition === "idle" && motion.pointer.inside && motion.intro > 0.6 && motion.worldVis > 0.95;
    let hit = null;
    if (canHover && !motion.dragging) {
      hit = pickAtPointer();
      if (hit) hoverUv.set(hit.u, hit.v);
    }
    motion.hovered = hit ? hit.k : -1;
    if (!motion.dragging) setSceneCursor(hit ? (Math.abs(hit.slot) < 0.5 ? "VIEW" : hit.slot < 0 ? "PREV" : "NEXT") : null);

    // screen-filling pose used by the open transition
    const D = 1.6;
    const vh = visibleHeight(L.fov, D);
    const vw = vh * camera.aspect;
    const flyW = motion.flyInstance >= 0 ? frameWidth(motion.flyInstance, L) : L.cardW;
    const fs = Math.max(vh / L.cardH, vw / flyW) * 1.002;
    shared.uFlyMatrix.value.copy(camera.matrixWorld).multiply(tmpM.makeTranslation(0, 0, -D)).multiply(tmpS.makeScale(fs, fs, 1));

    const portalE = easeOut(motion.portal.open);
    const pm = portalMetrics(L, motion.viewport.w / motion.viewport.h);
    const path = pathModel(L);
    const tex = shared.uPath.value;
    if (tex.userData.key !== path.key) {
      tex.image.data.set(path.data);
      tex.userData.key = path.key;
      tex.needsUpdate = true;
    }
    shared.uCardY.value = L.cardY;
    shared.uFloorY.value = L.floorY;
    shared.uTime.value = elapsed;
    shared.uVoid.value = portalE;
    shared.uVoidR.value = pm.voidR;
    shared.uVoidY.value = L.lookY;
    shared.uFogNear.value = L.fogNear;
    shared.uFogFar.value = L.fogFar;

    const velScale = (motion.reducedMotion ? 0.25 : 1) * (1 - motion.fly);
    // titles are printed on the cards (shader-card.js): fade them with the world
    const labelVis = (1 - smooth(0, 0.35, motion.fly)) * smooth(0.6, 1, motion.worldVis) * (1 - smooth(0, 0.3, portalE)) * smooth(0.45, 1, motion.intro);

    for (let k = 0; k < INSTANCE_COUNT; k++) {
      const h = cards[k];
      if (!h) continue;
      const u = h.uniforms;
      const slot = slotOf(k);
      const a = Math.abs(slot);
      const off = frameOffset(k, motion.arc, L);
      const isFly = k === motion.flyInstance;

      const introK = easeOut(clamp(motion.intro * 1.7 - a * 0.16 - 0.1, 0, 1));
      const wv = smooth(0, 1, clamp(motion.worldVis * 1.5 - a * 0.1, 0, 1));
      const vis = introK * wv;
      // frames to the left come toward the camera, so they fade out sooner than the receding ones on the right
      const edge = slot < 0 ? 1 - smooth(L.maxLeft - 0.6, L.maxLeft, a) : 1 - smooth(L.maxSlot - 0.9, L.maxSlot, a);
      const hover = damp(u.uHover.value, motion.hovered === k ? 1 : 0, 8, dt);
      // the centre frame reacts first; outer frames follow a beat later
      const vel = clamp((motion.flex + (motion.flexSlow - motion.flex) * clamp(a / 2.5, 0, 1)) * velScale, -1.4, 1.4);

      u.uOffset.value = off;
      u.uVel.value = vel;
      u.uHover.value = hover;
      if (motion.hovered === k) u.uHoverUv.value.lerp(hoverUv, 1 - Math.exp(-10 * dt));
      u.uFly.value = isFly ? motion.fly : 0;
      // the portal opening also pushes the reel back, clear of the ring
      u.uPush.value = isFly ? 0 : motion.fly * 2.8 + (1 - wv) * 1.2 + (1 - introK) * 0.7 + portalE * 1.4;
      u.uDrop.value = (1 - wv) * 1.6 + (1 - introK) * 0.18;
      u.uAlpha.value = edge * vis * (isFly ? 1 : 1 - motion.fly);
      // intro: each frame warms up like a projector lamp, with a faint flicker
      let lamp = 1;
      if (motion.intro < 1) {
        const lk = clamp(motion.intro * 1.5 - a * 0.14 - 0.12, 0, 1);
        const n = Math.sin(Math.floor(elapsed * 24) * 7.13 + k * 12.9898) * 43758.5453;
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
  }

  /** manual render pass: portal refraction copy, cursor wake composite, or a direct render */
  function renderFrame(elapsed, dt) {
    const now = performance.now();
    const p = motion.pointer;
    const s = wake;
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
    const wakeOn = motion.theme.cursorWake && !motion.reducedMotion && now - s.lastMove < WAKE_MS;

    if (wakeOn) {
      const u = flowMat.uniforms;
      u.tMap.value = flowRead.texture;
      u.uMouse.value.set(p.px / motion.viewport.w, 1 - p.py / motion.viewport.h);
      // clamp so a fast flick bends the frame without tearing it apart
      u.uVelocity.value.set(s.vx, s.vy).clampLength(0, 1.4);
      u.uAlpha.value = moving ? 1 : 0;
      u.uAspect.value = motion.viewport.w / motion.viewport.h;
      u.uDissipation.value = Math.pow(0.9, dt * 60); // fades in ~0.3 s
      renderer.setRenderTarget(flowWrite);
      renderer.render(flowMesh, ortho);
      [flowRead, flowWrite] = [flowWrite, flowRead];
    }

    const portal = portalRef.current;
    if (portal?.visible) {
      portal.visible = false;
      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      portal.visible = true;
    }

    if (wakeOn) {
      renderer.setRenderTarget(frameTarget);
      renderer.clear();
      renderer.render(scene, camera);
      compMat.uniforms.tFlow.value = flowRead.texture;
      compMat.uniforms.uTime.value = elapsed;
      compMat.uniforms.uStrength.value = motion.theme.wakeStrength * 0.6;
      renderer.setRenderTarget(null);
      renderer.render(compMesh, ortho);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  /* ------------------------------------------------------------- main loop */
  let last = performance.now();
  let elapsed = 0;
  let raf = 0;
  let running = true;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    // the case study fully covers the canvas, or the tab is hidden: do no work at all
    if (motion.paused || document.hidden) {
      last = now;
      return;
    }
    const rawDt = Math.min((now - last) / 1000, 0.5);
    last = now;
    elapsed += rawDt;
    const dt = Math.min(rawDt, 1 / 20);
    updateCamera(dt); // (priority -2 in the original)
    updateGrid(elapsed, dt);
    updateCarousel(elapsed, dt);
    updatePortal(elapsed);
    renderFrame(elapsed, rawDt);
  };
  raf = requestAnimationFrame(frame);

  return {
    canvas,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      removeEventListener("keydown", onKey);
      disposeLabelTextures();
      renderer.dispose();
    },
  };
}
