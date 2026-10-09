// Ported from components/shaders/flow.ts (types stripped; logic unchanged)
/**
 * Cursor liquid wake (screen-space).
 *
 * flowFragment: a low-res ping-pong "flow map". Each frame the previous map
 * fades a little and the cursor stamps its velocity (RG) and strength (B)
 * into a soft circle around its position.
 *
 * compositeFragment: the finished WebGL frame is re-sampled through the flow
 * map — pixels are dragged along the cursor's path, with a fine ripple and a
 * slight RGB split, so the cards, grid and portal bend like disturbed liquid.
 */
export const fullscreenVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
export const flowFragment = /* glsl */ `
uniform sampler2D tMap;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform float uFalloff;
uniform float uAlpha;
uniform float uDissipation;
uniform float uAspect;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tMap, vUv) * uDissipation;
  vec2 cursor = vUv - uMouse;
  cursor.x *= uAspect;
  vec3 stamp = vec3(uVelocity * vec2(1.0, -1.0), 1.0 - pow(1.0 - min(1.0, length(uVelocity)), 3.0));
  float falloff = smoothstep(uFalloff, 0.0, length(cursor)) * uAlpha;
  color.rgb = mix(color.rgb, stamp, vec3(falloff));
  gl_FragColor = vec4(color.rgb, 1.0);
}
`;
export const compositeFragment = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tFlow;
uniform float uStrength;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec3 flow = texture2D(tFlow, vUv).rgb;
  vec2 off = flow.xy * uStrength;
  // fine liquid ripple inside the wake
  off += flow.z * 0.0015 * vec2(sin(vUv.y * 40.0 + uTime * 2.0), sin(vUv.x * 32.0 - uTime * 1.6));
  // a faint colour fringe only (a strong RGB split looks like motion blur)
  vec3 c = vec3(
    texture2D(tScene, vUv - off).r,
    texture2D(tScene, vUv - off * 1.02).g,
    texture2D(tScene, vUv - off * 1.04).b);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;
