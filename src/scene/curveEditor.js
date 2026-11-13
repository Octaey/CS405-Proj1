import * as C from '../math/curves.js';
import * as mat4 from '../math/mat4.js';
import { defaultCurves, enforceC1 } from './curveDefaults.js';
import { curveToJSON, downloadJSON } from './curveExport.js';

const Z = 0.012;
const MAX_SEGMENTS = 12, MAX_POINTS = 24;
const YELLOW = [1.0, 0.85, 0.25], DIM = [0.45, 0.58, 0.7], POLY = [0.75, 0.75, 0.78];
const LEVEL_COLORS = [null, [0.45, 0.7, 1.0], [0.5, 0.9, 0.45]];

const cube = (p, size) => mat4.multiply(mat4.translate(p[0], p[1], p[2]), mat4.scale(size, size, size));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createCurveEditor({ panel, painting }) {
  let paintingId = 'kavunlu';
  let curves = defaultCurves(paintingId);
  const state = {
    active: 'bezier', showPolygon: true, showCasteljau: true,
    segment: 0, t: 0.45, animate: true, speed: 0.12, u: 0,
  };
  let drag = null;

  const f = panel.folder('Part D · curves');
  const activeSel = f.select('active curve', [
    { value: 'bezier', label: 'piecewise Bézier (C¹)' },
    { value: 'cr', label: 'Catmull–Rom spline' },
  ], state.active, (v) => (state.active = v));
  f.toggle('control polygon', state, 'showPolygon');
  f.toggle('de Casteljau', state, 'showCasteljau');
  f.slider('segment', state, 'segment', 0, MAX_SEGMENTS - 1, 1);
  f.slider('parameter t', state, 't', 0, 1, 0.005);
  f.toggle('animate marker', state, 'animate');
  f.slider('speed', state, 'speed', 0, 0.5, 0.01);
  f.button('remove last', () => removeLast());
  f.button('reset curves', () => reset(paintingId));
  f.button('export JSON', () => exportJSON());
  const readout = f.text();
  f.note('Drag orange (anchor) / white (handle) cubes. Shift+click the painting to extend the active curve.');

  const a = () => painting.aspect;
  const toWorld = (uv) => [(2 * uv[0] - 1) * a(), 1 - 2 * uv[1], Z];
  const toUV = (xy) => [clamp01((xy[0] + a()) / (2 * a())), clamp01((1 - xy[1]) / 2)];

  function editable() {
    const out = [];
    if (state.active === 'bezier') {
      curves.bezier.forEach((s, i) => {
        if (i === 0) out.push({ ref: { i, k: 0 }, uv: s[0], role: 'anchor' });
        out.push({ ref: { i, k: 1 }, uv: s[1], role: 'handle' });
        out.push({ ref: { i, k: 2 }, uv: s[2], role: 'handle' });
        out.push({ ref: { i, k: 3 }, uv: s[3], role: 'anchor' });
      });
    } else {
      curves.cr.forEach((p, i) => out.push({ ref: { i }, uv: p, role: 'anchor' }));
    }
    return out;
  }

  function movePoint(ref, uv) {
    if (state.active === 'cr') { curves.cr[ref.i] = uv; return; }
    const segs = curves.bezier, { i, k } = ref;
    const add = (p, d) => [p[0] + d[0], p[1] + d[1]];
    if (k === 3 || (i === 0 && k === 0)) {
      const d = [uv[0] - segs[i][k][0], uv[1] - segs[i][k][1]];
      segs[i][k] = uv;
      if (k === 3) {
        segs[i][2] = add(segs[i][2], d);
        if (segs[i + 1]) segs[i + 1][1] = add(segs[i + 1][1], d);
      } else segs[0][1] = add(segs[0][1], d);
    } else if (k === 2) {
      segs[i][2] = uv;
    } else if (k === 1) {
      if (i === 0) segs[0][1] = uv;
      else segs[i - 1][2] = C.c1NextControl(uv, segs[i][0]);
    }
    enforceC1(segs);
  }

  function addPoint(uv) {
    if (state.active === 'bezier') {
      const segs = curves.bezier;
      if (segs.length >= MAX_SEGMENTS) return;
      const last = segs[segs.length - 1];
      const p0 = last[3];
      const p2 = [uv[0] + (p0[0] - uv[0]) * 0.3, uv[1] + (p0[1] - uv[1]) * 0.3];
      segs.push([[...p0], C.c1NextControl(last[2], last[3]), p2, uv]);
      enforceC1(segs);
    } else if (curves.cr.length < MAX_POINTS) curves.cr.push(uv);
  }

  function removeLast() {
    if (state.active === 'bezier') { if (curves.bezier.length > 3) curves.bezier.pop(); }
    else if (curves.cr.length > 4) curves.cr.pop();
  }

  function exportJSON() {
    const obj = state.active === 'bezier'
      ? curveToJSON({ painting: paintingId, kind: 'bezier-c1', segments: curves.bezier })
      : curveToJSON({ painting: paintingId, kind: 'catmull-rom', points: curves.cr });
    console.log(JSON.stringify(obj, null, 2));
    downloadJSON(obj, `${paintingId}-${obj.kind}.json`);
  }

  function reset(id) {
    paintingId = id;
    curves = defaultCurves(id);
    Object.assign(state, { active: 'bezier', segment: 0, t: 0.45, u: 0 });
    activeSel.set('bezier');
    drag = null;
  }

  function update(sink, dt) {
    const bezW = curves.bezier.map((s) => s.map(toWorld));
    const crW = curves.cr.map(toWorld);
    const bezActive = state.active === 'bezier';

    const nb = bezW.length * 32;
    const bezPath = Array.from({ length: nb + 1 }, (_, k) => C.evalPiecewise(bezW, k / nb));
    const crPath = C.catmullRomPath(crW, 20);
    sink.thick(bezPath, bezActive ? YELLOW : DIM);
    sink.thick(crPath, bezActive ? DIM : YELLOW);

    if (state.showPolygon) {
      if (bezActive) bezW.forEach((s) => sink.polyline(s, POLY));
      else sink.polyline(crW, POLY);
    }
    for (const p of editable()) {
      const w = toWorld(p.uv);
      sink.mesh(cube([w[0], w[1], Z + 0.01], p.role === 'anchor' ? 0.04 : 0.03),
        p.role === 'anchor' ? [0.95, 0.45, 0.15] : [0.95, 0.95, 0.95]);
    }

    let info = '';
    if (bezActive) {
      const seg = Math.min(Math.round(state.segment), bezW.length - 1);
      const levels = C.deCasteljau(bezW[seg], state.t);
      if (state.showCasteljau) {
        for (let l = 1; l < levels.length; l++) {
          const pts = levels[l].map((p) => [p[0], p[1], Z + 0.006]);
          if (LEVEL_COLORS[l]) { sink.thick(pts, LEVEL_COLORS[l], 0.0015); pts.forEach((p) => sink.mesh(cube(p, 0.02), LEVEL_COLORS[l])); }
        }
        const q = levels[levels.length - 1][0];
        sink.mesh(cube([q[0], q[1], Z + 0.02], 0.035), [1, 0.25, 0.25]);
      }
      const q = levels[levels.length - 1][0];
      info = `segment ${seg}  t = ${state.t.toFixed(3)}\nB(t) = (${toUV(q)[0].toFixed(3)}, ${toUV(q)[1].toFixed(3)}) uv\n`;
    }

    if (state.animate) state.u = (state.u + dt * state.speed) % 1;
    const evalAt = bezActive ? C.evalPiecewise(bezW, state.u) : C.evalCatmullRom(crW, state.u);
    const tan = bezActive ? C.tangentPiecewise(bezW, state.u) : C.tangentCatmullRom(crW, state.u);
    const angle = Math.atan2(tan[1], tan[0]);
    const place = mat4.multiply(mat4.translate(evalAt[0], evalAt[1], Z + 0.05), mat4.rotateZ(angle));
    sink.mesh(mat4.multiply(place, mat4.scale(0.16, 0.06, 0.06)), [1.0, 0.85, 0.2]);
    sink.mesh(mat4.multiply(place, mat4.multiply(mat4.translate(0.1, 0, 0), mat4.scale(0.06, 0.1, 0.1))), [0.95, 0.2, 0.2]);

    readout.set(
      `${bezActive ? `piecewise Bézier, ${curves.bezier.length} segments, C¹` : `Catmull–Rom, ${curves.cr.length} points`}\n` +
      `${info}marker u = ${state.u.toFixed(3)}  heading ${(angle * 180 / Math.PI).toFixed(0)}°`);
  }

  function pick(vp, ndc, size) {
    let best = null, bd = 18 * 18;
    for (const p of editable()) {
      const w = toWorld(p.uv);
      const c = mat4.transformVec4(vp, [w[0], w[1], w[2], 1]);
      if (c[3] <= 0) continue;
      const dx = (c[0] / c[3] - ndc[0]) * size[0] / 2, dy = (c[1] / c[3] - ndc[1]) * size[1] / 2;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p.ref; }
    }
    return best;
  }

  return {
    state,
    update,
    pick,
    reset,
    setPainting: reset,
    addPoint: (xy) => addPoint(toUV(xy)),
    beginDrag: (ref) => { drag = ref; },
    dragTo: (xy) => { if (drag) movePoint(drag, toUV(xy)); },
    endDrag: () => { drag = null; },
    get dragging() { return drag !== null; },
    exportJSON,
    get data() { return curves; },
    movePoint: (ref, uv) => movePoint(ref, uv),
  };
}
