/**
 * The plane compositing shader.
 *
 * One textured quad per drawn view. The vertex stage places it from a plane
 * transform expressed in canvas pixels; the fragment stage applies the
 * atmospheric-depth treatment: a separable-ish box blur, contrast falloff
 * toward the ground color, and a soft drop shadow that separates one plane
 * from the one behind it.
 *
 * Blur and falloff live here rather than in CSS because per-plane blur is
 * near-free on the GPU and expensive in the compositor — that difference is
 * the whole justification for the GPU pipeline.
 */
export const COMPOSITOR_WGSL = /* wgsl */ `
struct Plane {
  // x, y, width, height in canvas pixels, after the plane transform.
  rect: vec4f,
  // blur radius in texels, contrast falloff 0..1, shadow strength, and the
  // view's own opacity — which is how a node entering or leaving the scene
  // fades rather than popping.
  style: vec4f,
  // canvas size in pixels, and the ground color's rgb packed as xyz.
  canvas: vec4f,
  ground: vec4f,
}

@group(0) @binding(0) var<uniform> plane: Plane;
@group(0) @binding(1) var view_texture: texture_2d<f32>;
@group(0) @binding(2) var view_sampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
  // Two triangles, no vertex buffer: the quad is entirely a function of the
  // plane rect, so nothing has to be uploaded per frame except the uniform.
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let corner = corners[index];
  let pixel = plane.rect.xy + corner * plane.rect.zw;
  // Canvas pixels to clip space, y down.
  let ndc = vec2f(
    pixel.x / plane.canvas.x * 2.0 - 1.0,
    1.0 - pixel.y / plane.canvas.y * 2.0,
  );
  var out: VertexOut;
  out.position = vec4f(ndc, 0.0, 1.0);
  out.uv = corner;
  return out;
}

fn blurred(uv: vec2f, radius: f32) -> vec4f {
  if (radius <= 0.0) {
    return textureSample(view_texture, view_sampler, uv);
  }
  let size = vec2f(textureDimensions(view_texture, 0));
  let step = radius / size;
  var sum = vec4f(0.0);
  var weight = 0.0;
  // A 9-tap kernel: enough to read as depth-of-field at plane scale, cheap
  // enough to run on every capture every frame.
  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      let offset = vec2f(f32(x), f32(y)) * step;
      let w = select(1.0, 2.0, x == 0 && y == 0);
      sum = sum + textureSample(view_texture, view_sampler, uv + offset) * w;
      weight = weight + w;
    }
  }
  return sum / weight;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let radius = plane.style.x;
  let falloff = plane.style.y;
  let shadow = plane.style.z;
  let opacity = plane.style.w;

  var color = blurred(in.uv, radius);

  // Recede toward the GROUND color, not toward gray. On a dark ground that
  // reads as dimming and on a light one as haze — which is what distance
  // actually does to a surface, rather than a fixed "faded" look that only
  // works in one scheme.
  color = vec4f(mix(color.rgb, plane.ground.rgb, falloff), color.a);

  // Contact shadow around the quad's own border, drawn into its alpha so no
  // second pass is needed. It is what separates one plane from the one
  // behind it when both are dark.
  let edge = min(min(in.uv.x, in.uv.y), min(1.0 - in.uv.x, 1.0 - in.uv.y));
  let lift = 1.0 - smoothstep(0.0, 0.055, edge);
  color = vec4f(color.rgb * (1.0 - lift * shadow), color.a);

  // Premultiplied: the target blends with one-minus-src-alpha, so scaling
  // color and alpha together is what keeps a half-faded view from darkening
  // instead of dissolving.
  return vec4f(color.rgb * opacity, color.a * opacity);
}
`;
