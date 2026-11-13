# CS405 Project 1 — Transformations, Projection & Curves from Paintings

One WebGPU application (plain JavaScript, Vite, no maths or graphics libraries) that turns
**Şeker Ahmed Paşa — *Kavunlu Natürmort*** (Sakıp Sabancı Museum) into a small 3D scene.
The painting hangs at z = 0 as a textured quad; objects, a scene graph, a camera rig and two
curves live in front of it.

    p_clip = P · V · M · p_object

## Run it

Needs Node.js ≥ 20.19 and a WebGPU browser (current Chrome / Edge, Safari 26+, Firefox 141+ on Windows).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests for the maths, the scene graph and the curve editor
npm run export-curves  # regenerates exports/*.json (the default curves)
```

Other bundled paintings: `?painting=kabatas`, `moda`, `selim-turbesi`, `ormanda-karaca`
(or use the panel). The default curves trace real shapes only on `kavunlu`; on the others you
get a generic arch that you can drag into place.

## Controls

**Mouse (on the main view)**

| Action | Effect |
|---|---|
| drag on empty space | orbit the camera around its target |
| wheel | zoom (dolly in perspective, visible height in orthographic) |
| drag an orange / white cube | move a control point of the *active* curve, in the painting's plane |
| shift + click | add a point (Bézier: a new C¹ segment; Catmull–Rom: a new point) |

**Panel** (right side; every group can be collapsed)

| Group | Control | What it does |
|---|---|---|
| Painting | painting | switches painting (curves reset to that painting's defaults) |
| Part C · camera | view | `main camera` / `inspection camera (fixed)` / `split: main \| inspection` |
| | projection | perspective ⇄ orthographic at run time |
| | fov Y, near, far | live camera parameters (see the readout below them: eye, target, fov, near, far) |
| Debug | local axes | x red, y green, z blue, for every node, object and the world origin |
| | camera frustum | draws the main camera's frustum (visible in the inspection view) |
| Part A | translate / rotate / axis / scale | drive the red cube |
| | order | `T·R·S` or `S·R·T`; both 4×4 matrices are printed, the used one is marked |
| Part B | animate | freezes the robot arm so you can check a world matrix by hand; the readout shows `world(fingerL)` |
| Part D | active curve | piecewise Bézier (C¹) or Catmull–Rom |
| | control polygon, de Casteljau | show/hide the polygon and the construction for the chosen segment and *t* |
| | segment, parameter t | choose which Bézier segment and where on it |
| | animate marker, speed | the arrow rides the active curve, heading = curve tangent |
| | remove last | removes the last segment (min. 3) or point (min. 4) |
| | reset curves | back to the defaults |
| | export JSON | downloads the active curve in normalised (u, v) coordinates |
| View | reset | resets camera, objects, hierarchy and curves |
| (top) | frame time | frame ms / fps, CPU ms, draw calls and **vertices submitted per frame** |

## Where things are

```
src/math/    vec3.js  mat4.js  curves.js         own maths (column-major, WebGPU depth z ∈ [0,1])
src/scene/   node.js  hierarchy.js               Part B  scene graph (SceneNode + robot arm)
             objects.js                          Part A  UI-driven cube, T·R·S vs S·R·T
             camera.js  frustum.js               Part C  lookAt/projection use, orbit, ray, frustum drawing
             curveEditor.js curveDefaults.js     Part D  editing, de Casteljau, marker, C¹ enforcement
             curveExport.js                      Part D  JSON export
             scene.js                            wires A, B, D; records the draw list
src/render/  gpu.js renderer.js painting.js      provided (painting.js: one uniform buffer per view)
             meshes.js  lines.js  shaders/       lit cubes and line batches (uniform pools per draw)
src/ui/      panel.js stats.js input.js          panel, frame-time readout, pointer events
src/main.js                                      views, orbit/picking, render loop
tests/                                           starter tests + tests/editor.test.js (C¹ under random drags)
exports/                                         default curves as JSON (appendix material)
```

## Conventions

- Matrices are `Float32Array(16)`, column-major (translation at indices 12–14), uploaded as-is to `mat4x4f`.
- Column vectors, `multiply(A, B) = A·B` (B acts first). **The whole project uses `M = T·R·S`.**
- Right-handed world; the camera looks down −z; clip depth is WebGPU's `[0, 1]`.
- Colours are written in sRGB in the code, converted to linear in the shaders, and every fragment
  shader returns `toOutput(...)`.

## Notes

- The curves are stored in normalised painting coordinates (u, v), so they follow the painting
  when its size changes and export directly. The Bézier joints are C¹ by construction: after every
  edit `enforceC1()` sets each segment's first handle to `2·P3 − P2` of the previous one.
- Second curve family: **Catmull–Rom** (`bspline` / `bsplineBasis` are intentionally left as TODO stubs;
  the starter tests skip them).
- The frustum is drawn with its far plane clamped to `min(far, 1.7 × distance to target)`, otherwise a
  far plane at 100 would dwarf the scene.
