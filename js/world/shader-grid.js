// Ported from components/shaders/grid.ts (types stripped; logic unchanged)
/**
 * Glowing white grid floor.
 *
 * Two layers share one set of uniforms:
 *  - the line layer: real line segments (pre-cut so they can ripple under the
 *    portal and around the cursor), lit in white;
 *  - the halo layer: a flat plane that draws a soft glow around the same grid
 *    lines analytically (distance to the nearest line), so the lines appear to
 *    bloom without a post-processing pass.
 * Both react to the cursor (a travelling light pool), scroll velocity (bands
 * of light sweep through the floor) and the portal opening.
 */
const common = /* glsl */ `
uniform float uTime;
uniform float uShift;
uniform vec2  uPointer;     // pointer position on the floor (world xz)
uniform float uPointerOn;
uniform float uEnergy;      // 0..1 from carousel speed
uniform float uPhase;       // advances with the carousel position
uniform float uHue;         // shifts the palette per project
uniform float uVoid;
uniform float uOpacity;
uniform float uFogNear;
uniform float uFogFar;

// colour + light intensity of the floor at a world position
vec4 floorLight(vec3 w) {
  // plain white light (slightly dimmed: white reads brighter than the old pastels)
  vec3 col = vec3(0.82);

  float d = length(w.xz - uPointer);
  float pointer = uPointerOn * (exp(-d * d * 0.09) * 1.7 + exp(-d * 0.35) * 0.35);
  // a soft ring that radiates from the cursor
  pointer += uPointerOn * 0.35 * smoothstep(0.6, 0.0, abs(d - mod(uTime * 2.2, 9.0))) * exp(-d * 0.25);

  float bands = 0.5 + 0.5 * sin(w.z * 0.55 + w.x * 0.12 - uTime * 1.4 - uPhase * 2.2);
  float sweep = pow(bands, 3.0) * (0.25 + 1.4 * uEnergy);
  float centre = exp(-dot(w.xz - vec2(0.0, -0.6), w.xz - vec2(0.0, -0.6)) * 0.03);
  float breathe = 0.85 + 0.15 * sin(uTime * 0.9);

  float intensity = (0.32 + 0.55 * centre) * breathe + sweep + pointer + uVoid * 0.6 * centre;
  return vec4(col, intensity);
}

// colours are authored as display values; convert so the (additive) output
// looks identical whether drawn to screen or through the cursor-wake pass
vec3 display(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

float fade(float dist) {
  float far = 1.0 - smoothstep(uFogNear * 0.5, uFogFar, dist);
  float near = smoothstep(0.8, 3.0, dist);
  return far * near;
}
`;
export const gridVertex = /* glsl */ `
${common}
varying vec3 vWorld;
varying float vDist;

void main() {
  vec3 p = position;
  p.x += uShift;
  vec4 w = modelMatrix * vec4(p, 1.0);
  float r = length(w.xz - vec2(0.0, 0.8));
  w.y += uVoid * (sin(r * 2.2 - uTime * 2.6) * exp(-r * 0.16) * 0.22 + exp(-r * 0.45) * 0.45);
  // gentle swell under the cursor, and a ripple when the carousel moves fast
  float d = length(w.xz - uPointer);
  w.y += uPointerOn * 0.07 * exp(-d * d * 0.12);
  w.y += uEnergy * 0.05 * sin(w.x * 0.7 - uPhase * 3.0) * exp(-abs(w.z) * 0.08);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
export const gridFragment = /* glsl */ `
${common}
varying vec3 vWorld;
varying float vDist;

void main() {
  vec4 l = floorLight(vWorld);
  float a = uOpacity * l.a * fade(vDist);
  gl_FragColor = vec4(display(l.rgb * a), 1.0);
  #include <colorspace_fragment>
}
`;
export const haloVertex = /* glsl */ `
varying vec3 vWorld;
varying float vDist;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
export const haloFragment = /* glsl */ `
${common}
varying vec3 vWorld;
varying float vDist;

void main() {
  vec2 g = vec2(vWorld.x - uShift, vWorld.z);
  vec2 cell = abs(fract(g - 0.5) - 0.5);          // distance to nearest line per axis
  float line = min(cell.x, cell.y);
  float aa = fwidth(line) + 1e-4;
  float glow = exp(-line * 9.0) * 0.55 + exp(-line / aa * 0.5) * 0.25;
  vec4 l = floorLight(vWorld);
  // soft pooled light on the floor itself, strongest under the cursor
  float pool = 0.1 * l.a;
  float a = uOpacity * (glow * l.a + pool) * fade(vDist) * (1.0 - uVoid * 0.6);
  gl_FragColor = vec4(display(l.rgb * a), 1.0);
  #include <colorspace_fragment>
}
`;
