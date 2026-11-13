import * as mat4 from '../math/mat4.js';
import { SceneNode } from './node.js';

const { translate: T, scale: S, rotateZ, rotateY, multiply: mul } = mat4;
const box = (cx, cy, cz, sx, sy, sz) => mul(T(cx, cy, cz), S(sx, sy, sz));

export function createHierarchy(panel) {
  const base = new SceneNode('base');
  const shoulder = base.addChild(new SceneNode('shoulder'));
  const elbow = shoulder.addChild(new SceneNode('elbow'));
  const wrist = elbow.addChild(new SceneNode('wrist'));
  const fingerL = wrist.addChild(new SceneNode('fingerL'));
  const fingerR = wrist.addChild(new SceneNode('fingerR'));

  base.data = { shape: box(0, 0.06, 0, 0.45, 0.12, 0.45), color: [0.55, 0.55, 0.58] };
  shoulder.data = { shape: box(0, 0.275, 0, 0.09, 0.55, 0.09), color: [0.95, 0.55, 0.2] };
  elbow.data = { shape: box(0, 0.225, 0, 0.07, 0.45, 0.07), color: [0.2, 0.7, 0.65] };
  wrist.data = { shape: box(0, 0.04, 0, 0.16, 0.08, 0.16), color: [0.65, 0.45, 0.9] };
  fingerL.data = { shape: box(0, 0.06, 0, 0.035, 0.12, 0.035), color: [0.95, 0.85, 0.3] };
  fingerR.data = { shape: box(0, 0.06, 0, 0.035, 0.12, 0.035), color: [0.95, 0.85, 0.3] };

  const state = { animate: true, time: 0 };
  const f = panel.folder('Part B · scene graph');
  f.toggle('animate', state, 'animate');
  const leafText = f.text();
  f.note('base → shoulder → elbow → wrist → fingerL. Untick "animate" to freeze the pose and check the matrix by hand.');

  function animate(t) {
    shoulder.local = mul(T(0, 0.12, 0), rotateZ(0.5 * Math.sin(t)));
    elbow.local = mul(T(0, 0.55, 0), rotateZ(0.9 * Math.sin(1.3 * t + 1)));
    wrist.local = mul(T(0, 0.45, 0), rotateY(1.5 * t));
    const open = 0.45 + 0.3 * Math.sin(3 * t);
    fingerL.local = mul(T(-0.06, 0.08, 0), rotateZ(open));
    fingerR.local = mul(T(0.06, 0.08, 0), rotateZ(-open));
  }
  animate(0);

  return {
    state,
    root: base,

    update(sink, dt, a, debugAxes) {
      if (state.animate) state.time += dt;
      animate(state.time);
      base.local = T(0.65 * a, -0.85, 0.5);
      base.updateWorld();

      base.traverse((node) => {
        sink.mesh(mat4.multiply(node.world, node.data.shape), node.data.color);
        if (debugAxes) sink.axes(node.world, 0.2);
      });
      leafText.set(`world(fingerL) =\nbase·shoulder·elbow·wrist·fingerL\n${mat4.format(fingerL.world, 3)}`);
    },

    reset() { state.time = 0; state.animate = true; },
  };
}
