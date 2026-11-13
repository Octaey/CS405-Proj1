import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCurveEditor } from '../src/scene/curveEditor.js';
import { curveToJSON } from '../src/scene/curveExport.js';
import { cubicBezierTangent, evalPiecewise } from '../src/math/curves.js';
import { closeArr } from './helpers.js';

const ctl = { slider: () => ({}), toggle: () => ({}), select: () => ({ set() {} }), button() {}, text: () => ({ set() {} }), note() {} };
const editor = () => createCurveEditor({ panel: { folder: () => ctl }, painting: { aspect: 1.43 } });

test('default Bézier has ≥ 3 segments, joined and C¹', () => {
  const S = editor().data.bezier;
  assert.ok(S.length >= 3);
  for (let i = 0; i < S.length - 1; i++) {
    closeArr(S[i][3], S[i + 1][0]);
    closeArr(cubicBezierTangent(...S[i], 1), cubicBezierTangent(...S[i + 1], 0), 1e-9);
  }
});

test('random drags of any control point keep every joint C¹', () => {
  const ed = editor();
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 200; n++) {
    const S = ed.data.bezier, i = Math.floor(rnd() * S.length);
    const ks = i === 0 ? [0, 1, 2, 3] : [1, 2, 3];
    ed.movePoint({ i, k: ks[Math.floor(rnd() * ks.length)] }, [rnd(), rnd()]);
    for (let j = 0; j < S.length - 1; j++) {
      closeArr(S[j][3], S[j + 1][0], 1e-9, `joint ${j} position:`);
      closeArr(cubicBezierTangent(...S[j], 1), cubicBezierTangent(...S[j + 1], 0), 1e-9, `joint ${j} tangent:`);
    }
  }
});

test('curve starts at P0 and ends at P3', () => {
  const S = editor().data.bezier;
  closeArr(evalPiecewise(S, 0), S[0][0]);
  closeArr(evalPiecewise(S, 1), S[S.length - 1][3]);
});

test('JSON export format', () => {
  const ed = editor();
  const b = curveToJSON({ painting: 'kavunlu', kind: 'bezier-c1', segments: ed.data.bezier });
  assert.equal(b.kind, 'bezier-c1');
  assert.ok(b.segments.every((s) => s.length === 4 && s.every((p) => p.length === 2 && p.every((x) => x >= 0 && x <= 1))));
  const c = curveToJSON({ painting: 'kavunlu', kind: 'catmull-rom', points: ed.data.cr });
  assert.equal(c.kind, 'catmull-rom');
  assert.ok(Array.isArray(c.points) && !('segments' in c));
});
