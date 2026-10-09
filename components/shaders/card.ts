/**
 * Curved project card — one frame of the film strip.
 *
 * The geometry is a flat, subdivided plane centred at the origin. The vertex
 * shader lays every vertex onto the zig-zag film path over its rollers (the same
 * arc-length table as lib/track.ts, sampled from uPath), adds the frame's own sheet bulge, a velocity-driven travelling
 * wave, a per-frame fold and stretch while the strip moves (film being pulled),
 * a pointer bulge on hover and the "void" push when the portal opens.
 * For the open-project transition each vertex is blended towards a flat,
 * camera-facing, screen-filling pose (uFlyMatrix) — edges lag the centre so the
 * card visibly unrolls as it approaches.
 */
export const cardVertex = /* glsl */ `
uniform float uOffset;      // arc-length position of the card centre
uniform float uScale;
uniform float uHalfW;
uniform sampler2D uPath;    // arc-length table: (x, z, nx, nz) per sample
uniform float uPathMax;     // table covers arc -uPathMax..uPathMax
uniform float uPathN;
uniform float uCardY;
uniform float uVel;
uniform float uHover;
uniform vec2  uHoverUv;
uniform float uTime;
uniform float uFly;
uniform mat4  uFlyMatrix;
uniform float uDrop;        // y drop (intro / index transition)
uniform float uPush;        // z push away from camera
uniform float uMirror;      // 1 = floor reflection copy
uniform float uFloorY;
uniform float uVoid;        // portal opening 0..1
uniform float uVoidR;
uniform float uVoidY;
uniform float uFogNear;
uniform float uFogFar;

varying vec2 vUv;
varying float vFog;
varying float vShade;
varying float vMirrorFade;

// point + normal on the film path at arc length s (manual linear interpolation)
vec4 pathAt(float s) {
  float f = clamp((s + uPathMax) / (2.0 * uPathMax), 0.0, 1.0) * (uPathN - 1.0);
  float i = min(floor(f), uPathN - 2.0);
  vec4 a = texelFetch(uPath, ivec2(int(i), 0), 0);
  vec4 b = texelFetch(uPath, ivec2(int(i) + 1, 0), 0);
  return mix(a, b, f - i);
}

void main() {
  vUv = uv;
  vec3 p = position;
  float nx = p.x / uHalfW;

  float u  = uOffset + p.x * uScale;
  float y  = uCardY + p.y * uScale;
  vec4 P   = pathAt(u);
  vec3 n   = normalize(vec3(P.z, 0.0, P.w));
  vec3 cyl = vec3(P.x, y, P.y);

  float hd = distance(uv * vec2(1.6, 1.0), uHoverUv * vec2(1.6, 1.0));
  // gentle, low-amplitude reactions to scrolling (kept small for comfort:
  // large fast deformations near the camera read as motion sickness)
  float d = (0.035 + 0.02 * abs(uVel)) * (1.0 - nx * nx)
          + uVel * 0.05 * sin(u * 0.85 + 0.6)
          + uVel * 0.03 * p.x
          + uHover * (0.09 + 0.04 * (1.0 - smoothstep(0.0, 0.7, hd)));
  cyl += n * d;
  // frame corners stretch a touch while the strip is pulled
  cyl.y += uVel * 0.008 * p.x * p.x * sign(p.y + 0.001);

  // portal "void": cards near the ring are pulled outward and towards the camera
  vec2 rel = cyl.xy - vec2(0.0, uVoidY);
  float rr = length(rel);
  float inf = uVoid * (1.0 - smoothstep(uVoidR * 0.85, uVoidR * 2.1, rr));
  cyl.xy = vec2(0.0, uVoidY) + rel * (1.0 + inf * 0.16);
  cyl.z += inf * inf * 1.1;

  cyl.y -= uDrop;
  cyl.z -= uPush;

  // fly: flat, screen-filling pose in front of the camera; edges lag the centre
  vec3 flatP = (uFlyMatrix * vec4(p.xy, 0.0, 1.0)).xyz;
  float f = clamp(uFly * 1.3 - abs(nx) * 0.3 - abs(p.y) * 0.05, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 world = mix(cyl, flatP, f);

  vMirrorFade = 1.0;
  if (uMirror > 0.5) {
    float above = world.y - uFloorY;
    world.y = uFloorY - above;
    vMirrorFade = 1.0 - smoothstep(0.0, 1.6, above);
  }

  vec4 mv = viewMatrix * vec4(world, 1.0);
  vFog = smoothstep(uFogNear, uFogFar, -mv.z) * (1.0 - uFly);
  vShade = mix(clamp(dot(n, normalize(cameraPosition - cyl)), 0.0, 1.0), 1.0, uFly);
  gl_Position = projectionMatrix * mv;
}
`;

export const cardFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec2  uCover;       // cover-fit scale of the texture
uniform float uAspect;
uniform float uCorner;
uniform float uAlpha;
uniform float uBright;
uniform float uHover;
uniform float uFocus;       // 1 at the centre slot
uniform float uMirror;
uniform float uFly;
uniform float uTime;
uniform sampler2D uLabel;   // title / meta / indicator masks (lib/card-label.ts)
uniform float uLabelBand;   // label covers the bottom band of the card
uniform float uLabelOn;     // 0..1 label visibility
uniform float uMeta;        // meta line opacity (focus)
uniform float uInd;         // indicator opacity (focus / hover)

varying vec2 vUv;
varying float vFog;
varying float vShade;
varying float vMirrorFade;

void main() {
  // rounded-rect signed distance in card space (corner radius in card-height units)
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 b = vec2(uAspect, 1.0) * 0.5 - uCorner;
  vec2 dd = abs(q) - b;
  float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - uCorner;
  float aa = fwidth(sd) * 1.2;
  float mask = 1.0 - smoothstep(-aa, aa, sd);
  if (mask <= 0.001) discard;

  vec2 tuv = (vUv - 0.5) * uCover + 0.5;
  // subtle chromatic split while hovered
  float ca = uHover * 0.0035;
  vec3 c;
  c.r = texture2D(uMap, tuv + vec2(ca, 0.0)).r;
  c.g = texture2D(uMap, tuv).g;
  c.b = texture2D(uMap, tuv - vec2(ca, 0.0)).b;

  float light = mix(0.62, 1.0, uFocus) * mix(0.55, 1.0, vShade);
  light = mix(light, 1.0, uFly);
  c *= light * uBright * (1.0 + 0.1 * uHover);
  // soft top rim light and a faint bottom shade for depth
  c += vec3(0.08) * smoothstep(0.86, 1.0, vUv.y) * (1.0 - uFly);
  c *= mix(0.82, 1.0, smoothstep(0.0, 0.25, vUv.y + uFly));

  // the title, printed on the card: bends, rolls and fades with it
  if (uLabelOn > 0.001 && vUv.y < uLabelBand) {
    float band = vUv.y / uLabelBand;
    c *= 1.0 - 0.32 * uLabelOn * (1.0 - smoothstep(0.0, 1.0, band)); // soft shade for legibility
    vec3 m = texture2D(uLabel, vec2(vUv.x, band)).rgb;
    float a = clamp(m.r + m.g * uMeta * 0.85 + m.b * uInd, 0.0, 1.0) * uLabelOn;
    c = mix(c, vec3(0.97) * mix(0.8, 1.0, vShade) * uBright, a);
  }

  c = mix(c, vec3(0.0), vFog);
  float alpha = mask * uAlpha;
  if (uMirror > 0.5) alpha *= 0.13 * vMirrorFade;
  gl_FragColor = vec4(c, alpha);
  #include <colorspace_fragment>
}
`;
