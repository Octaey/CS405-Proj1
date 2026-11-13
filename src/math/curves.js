import { todo } from './todo.js';

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

/* ---------------------------------------------------------- Bézier ------ */

export function bernstein3(t) {
  const u = 1 - t;
  return [u * u * u, 3 * t * u * u, 3 * t * t * u, t * t * t];
}

export function cubicBezier(p0, p1, p2, p3, t) {
  const [b0, b1, b2, b3] = bernstein3(t);
  return p0.map((_, i) => b0 * p0[i] + b1 * p1[i] + b2 * p2[i] + b3 * p3[i]);
}

export function cubicBezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return p0.map((_, i) =>
    3 * (u * u * (p1[i] - p0[i]) + 2 * u * t * (p2[i] - p1[i]) + t * t * (p3[i] - p2[i])));
}

export function deCasteljau(points, t) {
  const levels = [points.map((p) => [...p])];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < prev.length - 1; i++) next.push(lerp(prev[i], prev[i + 1], t));
    levels.push(next);
  }
  return levels;
}

/* ----------------------------------------------- piecewise, C¹ joints --- */

export function c1NextControl(p2, p3) {
  return p3.map((x, i) => 2 * x - p2[i]);
}

export function evalPiecewise(segments, u) {
  const { index, t } = locate(segments.length, u);
  return cubicBezier(...segments[index], t);
}

export function tangentPiecewise(segments, u) {
  const { index, t } = locate(segments.length, u);
  return cubicBezierTangent(...segments[index], t).map((x) => x * segments.length);
}

function locate(n, u) {
  const g = Math.min(Math.max(u, 0), 1) * n;
  const index = Math.min(n - 1, Math.floor(g));
  return { index, t: g - index };
}

export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return p0.map((_, i) => 0.5 * (
    2 * p1[i] +
    (-p0[i] + p2[i]) * t +
    (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
    (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

export function catmullRomTangent(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return p0.map((_, i) => 0.5 * (
    (-p0[i] + p2[i]) +
    2 * (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t +
    3 * (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t2));
}

function crSpan(points, u) {
  const P = [points[0], ...points, points[points.length - 1]];
  const { index, t } = locate(points.length - 1, u);
  return { q: [P[index], P[index + 1], P[index + 2], P[index + 3]], t };
}

export function evalCatmullRom(points, u) {
  const { q, t } = crSpan(points, u);
  return catmullRom(...q, t);
}

export function tangentCatmullRom(points, u) {
  const { q, t } = crSpan(points, u);
  return catmullRomTangent(...q, t).map((x) => x * (points.length - 1));
}

export function catmullRomPath(points, samplesPerSpan = 16) {
  const spans = points.length - 1;
  if (spans < 1) return points.map((p) => [...p]);
  const out = [];
  for (let k = 0; k <= spans * samplesPerSpan; k++) out.push(evalCatmullRom(points, k / (spans * samplesPerSpan)));
  return out;
}

export function bsplineBasis(t) { return todo('curves.bsplineBasis'); }
export function bspline(p0, p1, p2, p3, t) { return todo('curves.bspline'); }
