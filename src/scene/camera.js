/**
 * Camera — Part C.
 *
 * The camera is plain data. viewProjection() turns it into P · V using YOUR
 * mat4.lookAt / mat4.perspective / mat4.orthographic / mat4.multiply.
 *
 * Until those exist it falls back to a fixed "fit the painting to the window"
 * matrix, so the starter shows your painting from the first `npm run dev`.
 * The panel tells you which of the two is active.
 */
import * as mat4 from '../math/mat4.js';
import { NotImplemented } from '../math/todo.js';

export function createCamera() {
  return {
    eye: [0, 0, 2.8],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fovY: Math.PI / 4, // radians
    near: 0.1,
    far: 100,
    projection: 'perspective', // or 'orthographic'
    orthoHeight: 2.2, // world units visible vertically in orthographic mode
  };
}

/**
 * @param {object} cam     from createCamera()
 * @param {number} aspect  canvas width / height
 * @param {number} paintingAspect  image width / height (only used by the fallback)
 * @returns {{ matrix: Float32Array, fallback: boolean, missing?: string }}
 */
export function viewProjection(cam, aspect, paintingAspect = 1) {
  try {
    const view = mat4.lookAt(cam.eye, cam.target, cam.up);
    let proj;
    if (cam.projection === 'orthographic') {
      const h = cam.orthoHeight / 2, w = h * aspect;
      proj = mat4.orthographic(-w, w, -h, h, cam.near, cam.far);
    } else {
      proj = mat4.perspective(cam.fovY, aspect, cam.near, cam.far);
    }
    return { matrix: mat4.multiply(proj, view), fallback: false };
  } catch (e) {
    if (!(e instanceof NotImplemented)) throw e;
    return { matrix: fitMatrix(aspect, paintingAspect), fallback: true, missing: e.message };
  }
}

/**
 * Placeholder used until Part C works: scales the painting quad (height 2,
 * width 2·paintingAspect, centred at the origin in the z = 0 plane) to fit
 * the canvas, and maps world z to depth so that +z is in front.
 * There is no camera here — do not build on this.
 */
function fitMatrix(aspect, paintingAspect) {
  const s = 0.92 * Math.min(1, aspect / paintingAspect);
  return new Float32Array([
    s / aspect, 0, 0, 0,
    0, s, 0, 0,
    0, 0, -0.05, 0,
    0, 0, 0.5, 1,
  ]);
}

export function createInspectionCamera() {
  return {
    eye: [5.2, 3.4, 7.0], target: [0, -0.1, 0.8], up: [0, 1, 0],
    fovY: Math.PI / 4, near: 0.1, far: 200, projection: 'perspective', orthoHeight: 2.2,
  };
}

export function orbit(cam, dx, dy) {
  const off = [cam.eye[0] - cam.target[0], cam.eye[1] - cam.target[1], cam.eye[2] - cam.target[2]];
  const r = Math.hypot(...off) || 1;
  let az = Math.atan2(off[0], off[2]);
  let el = Math.asin(Math.max(-1, Math.min(1, off[1] / r)));
  az -= dx * 0.006;
  el = Math.max(-1.55, Math.min(1.55, el + dy * 0.006));
  cam.eye = [
    cam.target[0] + r * Math.cos(el) * Math.sin(az),
    cam.target[1] + r * Math.sin(el),
    cam.target[2] + r * Math.cos(el) * Math.cos(az),
  ];
}

export function zoom(cam, delta) {
  const k = Math.exp(delta * 0.001);
  const off = [cam.eye[0] - cam.target[0], cam.eye[1] - cam.target[1], cam.eye[2] - cam.target[2]];
  const r = Math.hypot(...off) || 1;
  const nr = Math.max(0.6, Math.min(40, r * k));
  cam.eye = cam.target.map((t, i) => t + (off[i] / r) * nr);
  cam.orthoHeight = Math.max(0.3, Math.min(30, cam.orthoHeight * k));
}

export function cameraRay(cam, aspect, ndc) {
  const world = mat4.invertRigid(mat4.lookAt(cam.eye, cam.target, cam.up));
  let o, d;
  if (cam.projection === 'orthographic') {
    const hh = cam.orthoHeight / 2;
    o = [ndc[0] * hh * aspect, ndc[1] * hh, 0, 1];
    d = [0, 0, -1, 0];
  } else {
    const th = Math.tan(cam.fovY / 2);
    o = [0, 0, 0, 1];
    d = [ndc[0] * th * aspect, ndc[1] * th, -1, 0];
  }
  return { origin: mat4.transformVec4(world, o).slice(0, 3), dir: mat4.transformVec4(world, d).slice(0, 3) };
}

export function hitPaintingPlane(ray) {
  if (Math.abs(ray.dir[2]) < 1e-6) return null;
  const t = -ray.origin[2] / ray.dir[2];
  if (t <= 0) return null;
  return [ray.origin[0] + ray.dir[0] * t, ray.origin[1] + ray.dir[1] * t];
}
