import './ui/style.css';
import { initWebGPU, showFatal } from './render/gpu.js';
import { Renderer } from './render/renderer.js';
import { Painting } from './render/painting.js';
import {
  createCamera, createInspectionCamera, viewProjection, orbit, zoom, cameraRay, hitPaintingPlane,
} from './scene/camera.js';
import { createScene } from './scene/scene.js';
import { createPanel } from './ui/panel.js';
import { Stats } from './ui/stats.js';
import { attachPointer } from './ui/input.js';
import { PAINTINGS, DEFAULT_PAINTING, paintingURL } from './config.js';
import * as mat4 from './math/mat4.js';

const PANEL_CSS_WIDTH = 320;

async function main() {
  const canvas = document.getElementById('gfx');
  const gpu = await initWebGPU(canvas);
  const renderer = new Renderer(gpu);
  const painting = new Painting(gpu);

  const params = new URLSearchParams(location.search);
  let current = PAINTINGS.find((p) => p.id === params.get('painting'))
    ?? PAINTINGS.find((p) => p.id === DEFAULT_PAINTING);
  await painting.load(paintingURL(current));

  /* ---------------- UI ---------------- */
  const panelRoot = document.getElementById('panel');
  const panel = createPanel(panelRoot);
  const title = document.createElement('h1');
  title.textContent = 'CS405 · Project 1';
  panelRoot.appendChild(title);
  const stats = new Stats(panelRoot);

  let scene = null;
  const pf = panel.folder('Painting');
  pf.select('painting', PAINTINGS.map((p) => ({ value: p.id, label: `${p.artist} — ${p.title}` })), current.id,
    async (id) => {
      current = PAINTINGS.find((p) => p.id === id);
      await painting.load(paintingURL(current));
      scene?.setPainting(id);
      history.replaceState(null, '', `?painting=${id}`);
    });

  const camera = createCamera();
  const inspection = createInspectionCamera();
  const view = { mode: 'main' };
  const cf = panel.folder('Part C · camera');
  const camStatus = cf.text('');
  cf.select('view', [
    { value: 'main', label: 'main camera' },
    { value: 'inspection', label: 'inspection camera (fixed)' },
    { value: 'split', label: 'split: main | inspection' },
  ], view.mode, (v) => (view.mode = v));
  const projSel = cf.select('projection', ['perspective', 'orthographic'], camera.projection, (v) => (camera.projection = v));
  const camSliders = [
    cf.slider('fov Y (rad)', camera, 'fovY', 0.2, 2.0, 0.01),
    cf.slider('near', camera, 'near', 0.01, 5, 0.01),
    cf.slider('far', camera, 'far', 2, 200, 1),
  ];
  const camReadout = cf.text('');
  cf.note('Drag to orbit, wheel to zoom. Drag a control point to edit it; shift+click adds one.');

  scene = createScene({ gpu, renderer, painting, panel });
  scene.setPainting(current.id);

  const vf = panel.folder('View');
  vf.button('reset', () => {
    Object.assign(camera, createCamera());
    projSel.set(camera.projection);
    camSliders.forEach((s) => s.update());
    scene.reset(current.id);
  });
  vf.note(gpu.encodeSRGB ? 'sRGB: encoded in shader (fallback)' : 'sRGB: canvas -srgb view');

  function layout() {
    const W = canvas.width, H = canvas.height;
    if (view.mode === 'main') return { main: { x: 0, y: 0, w: W, h: H }, insp: null };
    if (view.mode === 'inspection') return { main: null, insp: { x: 0, y: 0, w: W, h: H } };
    const dpr = W / canvas.clientWidth;
    const free = Math.max(2, Math.floor(W - PANEL_CSS_WIDTH * dpr));
    const half = Math.floor(free / 2);
    return { main: { x: 0, y: 0, w: half, h: H }, insp: { x: half, y: 0, w: free - half, h: H } };
  }
  let lastLayout = layout();
  let lastMainVP = null;

  function mainPointer(e) {
    const r = lastLayout.main;
    if (!r) return null;
    const dpr = canvas.width / canvas.clientWidth;
    const x = e.px[0] - r.x / dpr, y = e.px[1] - r.y / dpr;
    const w = r.w / dpr, h = r.h / dpr;
    if (x < 0 || y < 0 || x > w || y > h) return null;
    return { ndc: [2 * x / w - 1, 1 - 2 * y / h], size: [w, h] };
  }
  function planeHit(p) {
    return hitPaintingPlane(cameraRay(camera, p.size[0] / p.size[1], p.ndc));
  }

  /* -------------- input --------------- */
  let mode = 'none';
  attachPointer(canvas, {
    down(e) {
      const p = mainPointer(e);
      if (!p || !lastMainVP) { mode = 'none'; return; }
      if (e.button === 0 && e.shift) {
        const hit = planeHit(p);
        if (hit) scene.curves.addPoint(hit);
        mode = 'none';
        return;
      }
      const ref = e.button === 0 ? scene.curves.pick(lastMainVP, p.ndc, p.size) : null;
      if (ref) { scene.curves.beginDrag(ref); mode = 'point'; } else mode = 'orbit';
    },
    drag(e) {
      if (mode === 'orbit') orbit(camera, e.dx, e.dy);
      else if (mode === 'point') {
        const p = mainPointer(e);
        const hit = p && planeHit(p);
        if (hit) scene.curves.dragTo(hit);
      }
    },
    up() { scene.curves.endDrag(); mode = 'none'; },
    wheel(e) { if (mainPointer(e)) zoom(camera, e.delta); },
  });

  /* ------------ render loop ----------- */
  let last = performance.now();
  function frame(now) {
    stats.begin(now);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const L = layout();
    lastLayout = L;
    const mainAspect = L.main ? L.main.w / L.main.h : canvas.width / canvas.height;
    scene.update(dt, now / 1000, { camera, aspect: mainAspect });

    const mainVP = viewProjection(camera, mainAspect, painting.aspect);
    lastMainVP = mainVP.fallback ? null : mainVP.matrix;
    const inspVP = L.insp ? viewProjection(inspection, L.insp.w / L.insp.h, painting.aspect) : null;

    camStatus.set(mainVP.fallback
      ? `PLACEHOLDER view (no camera yet)\n${mainVP.missing}`
      : `camera: P · V (${camera.projection})`);
    camStatus.el.classList.toggle('warn', mainVP.fallback);
    camReadout.set(
      `eye    ${camera.eye.map((x) => x.toFixed(2)).join(', ')}\n` +
      `target ${camera.target.map((x) => x.toFixed(2)).join(', ')}\n` +
      `fovY ${(camera.fovY * 180 / Math.PI).toFixed(1)}°  near ${camera.near}  far ${camera.far}`
    );

    renderer.render((pass) => {
      const drawView = (r, vp, slot, isInspection) => {
        pass.setViewport(r.x, r.y, r.w, r.h, 0, 1);
        pass.setScissorRect(r.x, r.y, r.w, r.h);
        const paintingMVP = vp.fallback ? vp.matrix : mat4.multiply(vp.matrix, painting.model);
        painting.draw(pass, paintingMVP, renderer, slot);
        scene.draw(pass, vp.matrix, { inspection: isInspection });
      };
      if (L.main) drawView(L.main, mainVP, 0, false);
      if (L.insp) drawView(L.insp, inspVP, 1, true);
    });

    stats.end(renderer.stats);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  showFatal(e.message ?? String(e));
});
