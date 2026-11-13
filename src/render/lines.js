import linesWGSL from './shaders/lines.wgsl?raw';
import { createShader, fragmentConstants } from './shader.js';
import { DEPTH_FORMAT } from './renderer.js';

export function createLinePipeline(gpu) {
  const { device } = gpu;
  const module = createShader(device, linesWGSL, 'lines');
  return device.createRenderPipeline({
    label: 'lines',
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
    primitive: { topology: 'line-list' },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less-equal' },
  });
}

export class LineBatch {
  constructor(gpu, pipeline, capacityVertices = 30000) {
    this.device = gpu.device;
    this.pipeline = pipeline;
    this.capacity = capacityVertices;
    this.data = new Float32Array(capacityVertices * 6);
    this.count = 0;
    this.vertices = this.device.createBuffer({
      label: 'line vertices', size: capacityVertices * 6 * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.pool = [];
    this.used = 0;
  }

  clear() { this.count = 0; this.used = 0; }

  add(a, b, c) {
    if (this.count + 2 > this.capacity) return;
    const d = this.data, o = this.count * 6;
    d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2] ?? 0; d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2];
    d[o + 6] = b[0]; d[o + 7] = b[1]; d[o + 8] = b[2] ?? 0; d[o + 9] = c[0]; d[o + 10] = c[1]; d[o + 11] = c[2];
    this.count += 2;
  }

  polyline(points, c, closed = false) {
    for (let i = 0; i + 1 < points.length; i++) this.add(points[i], points[i + 1], c);
    if (closed && points.length > 2) this.add(points[points.length - 1], points[0], c);
  }

  upload() {
    if (this.count > 0) this.device.queue.writeBuffer(this.vertices, 0, this.data, 0, this.count * 6);
  }

  draw(pass, renderer, viewProj) {
    if (this.count === 0) return;
    if (!this.pool[this.used]) {
      const buffer = this.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer } }],
      });
      this.pool[this.used] = { buffer, bindGroup };
    }
    const slot = this.pool[this.used++];
    this.device.queue.writeBuffer(slot.buffer, 0, viewProj);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, slot.bindGroup);
    pass.setVertexBuffer(0, this.vertices);
    pass.draw(this.count);
    renderer.countDraw(this.count);
  }
}
