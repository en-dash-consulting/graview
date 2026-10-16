/**
 * The plane compositing shader.
 *
 * One textured quad per drawn view. The vertex stage places it from a plane
 * transform expressed in canvas pixels; the fragment stage applies the
 * atmospheric-depth treatment the DOM path draws with CSS: the plane's blur
 * (the focused plane's is zero), and its falloff as a fade toward the
 * ground under it.
 *
 * Blur and falloff live here rather than in CSS because per-plane blur is
 * near-free on the GPU and expensive in the compositor — that difference is
 * the whole justification for the GPU pipeline.
 */
export const COMPOSITOR_WGSL = /* wgsl */ `
struct Plane {
  // x, y, width, height in canvas pixels, after the plane transform.
  rect: vec4f,
  // blur radius in texels, contrast falloff 0..1, shadow strength (cast by
  // the view's own panel, so unused here), and the view's own opacity — which is how a node entering or leaving the scene
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
  let opacity = plane.style.w;

  let color = blurred(in.uv, radius);

  // Recession dims the view toward whatever is under it — the ground — by
  // the same share the DOM path's \`opacity\` does (\`recededOpacity\`), and
  // the plane's shadow is the view's own panel, captured with it. Mixing
  // toward a fixed ground color and darkening the quad's edges here drew a
  // different picture from the DOM path's: gray bands down a light card,
  // and haze of the wrong color in the other scheme.
  let alpha = opacity * (1.0 - falloff * 0.55);

  // A capture arrives with STRAIGHT alpha and the canvas composites
  // premultiplied, so the color is multiplied by its own alpha here, once.
  // Without it a panel's soft shadow — dark at a low alpha — came out
  // lighter than the ground it fell on.
  let a = color.a * alpha;
  return vec4f(color.rgb * a, a);
}
`;
