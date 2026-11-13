import * as mat4 from '../math/mat4.js';
import { MeshRenderer } from '../render/meshes.js';
import { createLinePipeline, LineBatch } from '../render/lines.js';
import { createObjects } from './objects.js';
import { createHierarchy } from './hierarchy.js';
import { createCurveEditor } from './curveEditor.js';
import { drawFrustum } from './frustum.js';

const AXIS_COLORS = [[1, 0.25, 0.25], [0.3, 1, 0.3], [0.35, 0.5, 1]];

export function createScene({ gpu, renderer, painting, panel }) {
  const meshes = new MeshRenderer(gpu);
  const pipeline = createLinePipeline(gpu);
  const lines = new LineBatch(gpu, pipeline);
  const frustumLines = new LineBatch(gpu, pipeline, 200);

  const state = { debugAxes: false, showFrustum: true };
  const f = panel.folder('Debug');
  f.toggle('local axes (x red, y green, z blue)', state, 'debugAxes');
  f.toggle('camera frustum (inspection view)', state, 'showFrustum');

  const objects = createObjects(panel);
  const hierarchy = createHierarchy(panel);
  const curves = createCurveEditor({ panel, painting });

  const draws = [];
  const sink = {
    mesh(model, color) { draws.push({ model, color }); },
    line(a, b, c) { lines.add(a, b, c); },
    polyline(points, c) { lines.polyline(points, c); },
    thick(points, c, e = 0.0025) {
      lines.polyline(points, c);
      lines.polyline(points.map((p) => [p[0] + e, p[1], p[2]]), c);
      lines.polyline(points.map((p) => [p[0], p[1] + e, p[2]]), c);
    },
    axes(world, len = 0.2) {
      const o = mat4.transformVec4(world, [0, 0, 0, 1]);
      [[len, 0, 0], [0, len, 0], [0, 0, len]].forEach((d, i) => {
        lines.add(o, mat4.transformVec4(world, [d[0], d[1], d[2], 1]), AXIS_COLORS[i]);
      });
    },
  };

  return {
    state,
    curves,

    update(dt, time, ctx) {
      meshes.reset();
      lines.clear();
      frustumLines.clear();
      draws.length = 0;

      const a = painting.aspect;
      objects.update(sink, a, state.debugAxes);
      hierarchy.update(sink, dt, a, state.debugAxes);
      curves.update(sink, dt);
      if (state.debugAxes) sink.axes(mat4.identity(), 0.5);
      if (state.showFrustum && ctx) drawFrustum(frustumLines, ctx.camera, ctx.aspect);

      lines.upload();
      frustumLines.upload();
    },

    draw(pass, viewProj, view = {}) {
      for (const d of draws) meshes.draw(pass, renderer, viewProj, d.model, d.color);
      lines.draw(pass, renderer, viewProj);
      if (view.inspection && state.showFrustum) frustumLines.draw(pass, renderer, viewProj);
    },

    setPainting(id) { curves.setPainting(id); },

    reset(paintingId) {
      objects.reset();
      hierarchy.reset();
      curves.reset(paintingId);
    },
  };
}
