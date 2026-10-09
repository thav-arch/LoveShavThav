import * as THREE from "three";

/**
 * Off-screen copy of the scene (without the portal) that the chrome ring
 * samples for its refraction. Rendered at half resolution, and only while the
 * portal is visible.
 */
export const sceneTarget = new THREE.WebGLRenderTarget(2, 2, {
  type: THREE.HalfFloatType, // linear values; half-float avoids banding in the darks
  depthBuffer: true,
});

/** set by <ProfilePortal>; hidden while the refraction source is rendered */
export const portalRef: { current: THREE.Object3D | null } = { current: null };
