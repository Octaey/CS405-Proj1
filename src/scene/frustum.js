import * as mat4 from '../math/mat4.js';
import * as vec3 from '../math/vec3.js';

const NEAR_COLOR = [0.3, 0.85, 1.0];
const FAR_COLOR = [1.0, 0.85, 0.3];
const EDGE_COLOR = [0.85, 0.85, 0.85];

export function drawFrustum(lines, cam, aspect) {
  const view = mat4.lookAt(cam.eye, cam.target, cam.up);
  const toWorld = mat4.invertRigid(view);
  const dist = vec3.length(vec3.sub(cam.target, cam.eye));
  const dNear = cam.near;
  const dFar = Math.max(dNear * 1.2, Math.min(cam.far, dist * 1.7));

  const rect = (d) => {
    let hh, hw;
    if (cam.projection === 'orthographic') { hh = cam.orthoHeight / 2; hw = hh * aspect; }
    else { hh = d * Math.tan(cam.fovY / 2); hw = hh * aspect; }
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
      .map(([x, y]) => mat4.transformVec4(toWorld, [x, y, -d, 1]).slice(0, 3));
  };
  const n = rect(dNear), f = rect(dFar);
  lines.polyline(n, NEAR_COLOR, true);
  lines.polyline(f, FAR_COLOR, true);
  for (let i = 0; i < 4; i++) lines.add(n[i], f[i], EDGE_COLOR);
  if (cam.projection !== 'orthographic') for (let i = 0; i < 4; i++) lines.add(cam.eye, n[i], EDGE_COLOR);

  const o = mat4.transformVec4(toWorld, [0, 0, 0, 1]);
  [[0.25, 0, 0, [1, 0.3, 0.3]], [0, 0.25, 0, [0.3, 1, 0.3]], [0, 0, 0.25, [0.4, 0.5, 1]]].forEach(([x, y, z, c]) => {
    lines.add(o.slice(0, 3), mat4.transformVec4(toWorld, [x, y, z, 1]).slice(0, 3), c);
  });
}
