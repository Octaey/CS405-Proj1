import { add, sub, scale as vscale, dot, cross, normalize, length } from './vec3.js';

/* ------------------------------------------------------------- Part A ---- */

export function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function translate(tx, ty, tz) {
  const m = identity();
  m[12] = tx; m[13] = ty; m[14] = tz;
  return m;
}

export function rotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad), m = identity();
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}

export function rotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad), m = identity();
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}

export function rotateZ(rad) {
  const c = Math.cos(rad), s = Math.sin(rad), m = identity();
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
}

export function scale(sx, sy, sz) {
  const m = identity();
  m[0] = sx; m[5] = sy; m[10] = sz;
  return m;
}

export function transpose(m) {
  const o = new Float32Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r * 4 + c] = m[c * 4 + r];
  return o;
}

export function invertRigid(m) {
  const o = identity();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[c * 4 + r] = m[r * 4 + c];
  const t = [m[12], m[13], m[14]];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * t[0] + o[4 + r] * t[1] + o[8 + r] * t[2]);
  return o;
}

export function transformVec4(m, v) {
  const o = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r] += m[c * 4 + r] * v[c];
  return o;
}

/* ------------------------------------------------------------- Part C ---- */

export function lookAt(eye, target, up) {
  const f = normalize(sub(target, eye));
  let s = cross(f, up);
  if (length(s) < 1e-6) {
    const alt = Math.abs(f[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    s = cross(f, alt);
  }
  s = normalize(s);
  const u = cross(s, f);
  const m = identity();
  m[0] = s[0]; m[4] = s[1]; m[8] = s[2];
  m[1] = u[0]; m[5] = u[1]; m[9] = u[2];
  m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
  m[12] = -dot(s, eye);
  m[13] = -dot(u, eye);
  m[14] = dot(f, eye);
  return m;
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = far / (near - far);
  m[11] = -1;
  m[14] = (near * far) / (near - far);
  return m;
}

export function orthographic(left, right, bottom, top, near, far) {
  const m = identity();
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = 1 / (near - far);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = near / (near - far);
  return m;
}

/* ------------------------------------------------- provided (not graded) - */

export function format(m, digits = 2) {
  if (!m) return '(none)';
  const w = digits + 4;
  let s = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) s += (+m[c * 4 + r]).toFixed(digits).padStart(w);
    if (r < 3) s += '\n';
  }
  return s;
}
