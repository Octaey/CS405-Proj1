import { c1NextControl } from '../math/curves.js';

const px = (x, y) => [x / 1280, y / 893];

const KAVUNLU_BEZIER = [
  px(385, 215), px(430, 125), px(540, 98), px(680, 98),
  [0, 0], px(1075, 235), px(1112, 300),
  [0, 0], px(1140, 450), px(1105, 515),
];
const KAVUNLU_CR = [
  px(235, 570), px(300, 650), px(450, 710), px(640, 735), px(850, 705), px(1000, 645), px(1050, 602),
];

const GENERIC_BEZIER = [
  [0.2, 0.7], [0.22, 0.4], [0.38, 0.28], [0.5, 0.3],
  [0, 0], [0.7, 0.4], [0.75, 0.55],
  [0, 0], [0.8, 0.7], [0.7, 0.8],
];
const GENERIC_CR = [[0.2, 0.85], [0.35, 0.9], [0.5, 0.88], [0.65, 0.9], [0.8, 0.85]];

export function enforceC1(segs) {
  for (let i = 1; i < segs.length; i++) {
    segs[i][0] = [...segs[i - 1][3]];
    segs[i][1] = c1NextControl(segs[i - 1][2], segs[i - 1][3]);
  }
  return segs;
}

function makeBezier(flat) {
  const segs = [];
  for (let i = 0; i + 3 < flat.length; i += 3) segs.push([flat[i], flat[i + 1], flat[i + 2], flat[i + 3]].map((p) => [...p]));
  return enforceC1(segs);
}

export function defaultCurves(paintingId) {
  const kav = paintingId === 'kavunlu';
  return {
    bezier: makeBezier(kav ? KAVUNLU_BEZIER : GENERIC_BEZIER),
    cr: (kav ? KAVUNLU_CR : GENERIC_CR).map((p) => [...p]),
  };
}
