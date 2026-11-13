import meshWGSL from './shaders/mesh.wgsl?raw';
import { createShader, fragmentConstants } from './shader.js';
import { DEPTH_FORMAT } from './renderer.js';
import { cube } from '../scene/geometry.js';
import { multiply } from '../math/mat4.js';

const UNIFORM_FLOATS = 16 + 16 + 4;

export class MeshRenderer {
  constructor(gpu) {
    const { device } = gpu;
    this.device = device;
    const data = cube();
    this.vertexCount = data.length / 6;
    this.vertices = device.createBuffer({
      label: 'cube vertices', size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertices, 0, data);

    const module = createShader(device, meshWGSL, 'mesh');
    this.pipeline = device.createRenderPipeline({
      label: 'mesh',
      layout: 'auto',
      vertex: {
        module, entryPoint: 'vs',
        buffers: [{
          arrayStride: 6 * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' },
          ],
        }],
      },
      fragment: { module, entryPoint: 'fs', targets: [{ format: gpu.viewFormat }], constants: fragmentConstants(gpu) },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.pool = [];
    this.used = 0;
    this.scratch = new Float32Array(UNIFORM_FLOATS);
  }

  reset() { this.used = 0; }

  #slot() {
    if (!this.pool[this.used]) {
      const buffer = this.device.createBuffer({
        size: UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }],
      });
      this.pool[this.used] = { buffer, bindGroup };
    }
    return this.pool[this.used++];
  }

  draw(pass, renderer, viewProj, model, color) {
    const slot = this.#slot();
    const s = this.scratch;
    s.set(multiply(viewProj, model), 0);
    s.set(model, 16);
    s.set([color[0], color[1], color[2], 1], 32);
    this.device.queue.writeBuffer(slot.buffer, 0, s);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, slot.bindGroup);
    pass.setVertexBuffer(0, this.vertices);
    pass.draw(this.vertexCount);
    renderer.countDraw(this.vertexCount);
  }
}
