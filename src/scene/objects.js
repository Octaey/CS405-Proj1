import * as mat4 from '../math/mat4.js';

const ROT = { x: mat4.rotateX, y: mat4.rotateY, z: mat4.rotateZ };
const DEFAULTS = { tx: 0, ty: -0.15, tz: 0.7, angle: 0.6, axis: 'y', sx: 0.4, sy: 0.4, sz: 0.4, order: 'T·R·S' };

export function createObjects(panel) {
  const state = { ...DEFAULTS };
  const f = panel.folder('Part A · transformations');
  const syncs = [];
  const slider = (label, key, min, max, step) => syncs.push(f.slider(label, state, key, min, max, step));
  slider('translate x', 'tx', -2, 2, 0.01);
  slider('translate y', 'ty', -1.2, 1.2, 0.01);
  slider('translate z', 'tz', 0.1, 2, 0.01);
  slider('rotate (rad)', 'angle', -Math.PI, Math.PI, 0.01);
  const axisSel = f.select('rotation axis', ['x', 'y', 'z'], state.axis, (v) => (state.axis = v));
  slider('scale x', 'sx', 0.1, 1.2, 0.01);
  slider('scale y', 'sy', 0.1, 1.2, 0.01);
  slider('scale z', 'sz', 0.1, 1.2, 0.01);
  const orderSel = f.select('order', ['T·R·S', 'S·R·T'], state.order, (v) => (state.order = v));
  const trsText = f.text();
  const srtText = f.text();
  f.note('The cube uses the selected order. Everything else in the project uses T·R·S.');

  function matrices() {
    const T = mat4.translate(state.tx, state.ty, state.tz);
    const R = ROT[state.axis](state.angle);
    const S = mat4.scale(state.sx, state.sy, state.sz);
    return {
      T, R,
      TRS: mat4.multiply(T, mat4.multiply(R, S)),
      SRT: mat4.multiply(S, mat4.multiply(R, T)),
    };
  }

  return {
    state,

    update(sink, a, debugAxes) {
      const m = matrices();
      const active = state.order === 'T·R·S' ? m.TRS : m.SRT;
      trsText.set(`M = T·R·S${state.order === 'T·R·S' ? '   ← drawn' : ''}\n${mat4.format(m.TRS)}`);
      srtText.set(`M = S·R·T${state.order === 'S·R·T' ? '   ← drawn' : ''}\n${mat4.format(m.SRT)}`);
      sink.mesh(active, [0.93, 0.35, 0.25]);

      const cubeB = mat4.multiply(mat4.translate(-0.6 * a, -0.55, 0.5),
        mat4.multiply(mat4.multiply(mat4.rotateY(0.5), mat4.rotateX(0.3)), mat4.scale(0.3, 0.3, 0.3)));
      const bar = mat4.multiply(mat4.translate(-0.28 * a, -0.7, 0.6),
        mat4.multiply(mat4.rotateZ(Math.PI / 4), mat4.scale(0.55, 0.12, 0.12)));
      sink.mesh(cubeB, [0.25, 0.7, 0.75]);
      sink.mesh(bar, [0.6, 0.75, 0.3]);

      if (debugAxes) {
        sink.axes(mat4.multiply(m.T, m.R), 0.3);
        sink.axes(mat4.multiply(mat4.translate(-0.6 * a, -0.55, 0.5), mat4.multiply(mat4.rotateY(0.5), mat4.rotateX(0.3))), 0.3);
        sink.axes(mat4.multiply(mat4.translate(-0.28 * a, -0.7, 0.6), mat4.rotateZ(Math.PI / 4)), 0.3);
      }
    },

    reset() {
      Object.assign(state, DEFAULTS);
      orderSel.set(state.order);
      axisSel.set(state.axis);
      syncs.forEach((s) => s.update());
    },
  };
}
