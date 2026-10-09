// Ported from components/shaders/portal.ts (types stripped; logic unchanged)
/**
 * Liquid chrome portal.
 *
 * The ring is a TorusGeometry whose vertices are rebuilt analytically from its
 * UVs: the centre-line radius and tube thickness are modulated by animated
 * harmonics, so the ring is a 4-lobed organic blob while opening (uLobe ≈ 1)
 * and relaxes into a slowly breathing ring (uLobe → 0). The surface refracts a
 * render-target copy of the scene with RGB-split offsets (chromatic
 * aberration) and mixes in a procedural studio environment for the chrome.
 */
const shapeChunk = /* glsl */ `
uniform float uTime;
uniform float uLobe;
uniform float uWob;
uniform float uTube;

float shapeR(float phi) {
  return 1.0
    + uLobe * (0.26 * sin(4.0 * phi + 0.6 + uTime * 0.5) + 0.07 * sin(7.0 * phi - uTime * 0.9))
    + uWob * (0.03 * sin(3.0 * phi - uTime * 1.1) + 0.022 * sin(5.0 * phi + uTime * 0.8) + 0.018 * sin(2.0 * phi + uTime * 0.45));
}
float tubeR(float phi) {
  return uTube * (1.0
    + uWob * (0.2 * sin(3.0 * phi + uTime * 0.9 + 1.7) + 0.12 * sin(6.0 * phi - uTime * 0.7))
    + uLobe * 0.5 * sin(4.0 * phi + 2.2 + uTime * 0.5));
}
vec3 centreLine(float phi) {
  float r = shapeR(phi);
  return vec3(cos(phi) * r, sin(phi) * r,
              uWob * 0.08 * sin(2.0 * phi + uTime * 0.6) + uLobe * 0.22 * sin(4.0 * phi + 1.4));
}
`;
export const ringVertex = /* glsl */ `
${shapeChunk}
varying vec3 vN;
varying vec3 vWorld;

void main() {
  float phi = uv.x * 6.28318530718;
  float th  = uv.y * 6.28318530718;
  vec3 c = centreLine(phi);
  vec3 T = normalize(centreLine(phi + 0.003) - centreLine(phi - 0.003));
  vec3 N = normalize(cross(T, vec3(0.0, 0.0, 1.0)));
  vec3 B = normalize(cross(N, T));
  vec3 nrm = cos(th) * N + sin(th) * B;
  vec3 pos = c + nrm * tubeR(phi);

  vec4 w = modelMatrix * vec4(pos, 1.0);
  vWorld = w.xyz;
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * nrm);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const discVertex = /* glsl */ `
${shapeChunk}
void main() {
  vec3 p = position;
  float len = length(p.xy);
  float phi = atan(p.y, p.x);
  float r = shapeR(phi) - tubeR(phi) * 0.2;
  vec3 c = centreLine(phi);
  vec3 pos = vec3(normalize(p.xy + 1e-6) * len * r, c.z * len - 0.02);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
}
`;
export const discFragment = /* glsl */ `
void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }
`;
export const dropVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vWorld;
uniform float uTime;
uniform float uSeed;
void main() {
  // soft wobble so droplets read as liquid, not spheres
  vec3 p = position * (1.0 + 0.12 * sin(position.y * 5.0 + uTime * 2.0 + uSeed) * sin(position.x * 4.0 + uTime * 1.3));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
export const chromeFragment = /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uRefract;
varying vec3 vN;
varying vec3 vWorld;

vec3 env(vec3 d) {
  vec3 c = vec3(0.012);
  c += vec3(1.0) * smoothstep(0.55, 0.95, dot(d, normalize(vec3(-0.45, 0.85, 0.5)))) * 1.7;
  c += vec3(0.86, 0.92, 1.0) * smoothstep(0.7, 1.0, dot(d, normalize(vec3(0.75, -0.3, 0.6)))) * 0.9;
  c += vec3(0.95, 0.6, 0.32) * smoothstep(0.6, 1.0, dot(d, normalize(vec3(0.9, 0.15, -0.3)))) * 0.45;
  c += vec3(0.75) * (1.0 - smoothstep(0.0, 0.16, abs(d.y + 0.08)));
  c *= 0.78 + 0.22 * sin(d.x * 13.0 + d.y * 8.0 + uTime * 0.35);
  return c;
}

void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(vWorld - cameraPosition);
  float facing = clamp(dot(n, -v), 0.0, 1.0);
  vec3 r = reflect(v, n);

  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 vn = normalize((viewMatrix * vec4(n, 0.0)).xyz);
  vec2 off = vn.xy * uRefract;
  vec3 refr = vec3(
    texture2D(uScene, suv - off * 0.9).r,
    texture2D(uScene, suv - off).g,
    texture2D(uScene, suv - off * 1.12).b);

  vec3 sh = vec3(0.035, 0.012, 0.0);
  vec3 refl = vec3(env(normalize(r + sh)).r, env(r).g, env(normalize(r - sh)).b);

  float fres = pow(1.0 - facing, 2.6);
  vec3 col = refr * 1.7 * (1.0 - fres * 0.6) + refl * (0.4 + fres * 0.95);
  col *= 0.7 + 0.3 * smoothstep(0.03, 0.25, facing);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
