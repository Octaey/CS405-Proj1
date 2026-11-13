struct Uniforms {
  mvp: mat4x4f,
  model: mat4x4f,
  color: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
};

@vertex
fn vs(@location(0) pos: vec3f, @location(1) normal: vec3f) -> VSOut {
  var o: VSOut;
  o.position = u.mvp * vec4f(pos, 1.0);
  o.normal = (u.model * vec4f(normal, 0.0)).xyz;
  return o;
}

@fragment
fn fs(i: VSOut) -> @location(0) vec4f {
  let n = normalize(i.normal);
  let light = normalize(vec3f(0.4, 0.8, 0.6));
  let diffuse = max(dot(n, light), 0.0);
  let c = srgbToLinear(u.color.rgb) * (0.28 + 0.85 * diffuse);
  return toOutput(vec4f(c, 1.0));
}
