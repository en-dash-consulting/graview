import { PointerRouter, type Placement } from "../interaction/pointer-router.js";
import {
  captureElement,
  detectCapabilities,
  requestPaint,
  setLayoutSubtree,
  toDOMMatrix,
  updateElementGeometry,
  type PlatformCapabilities,
} from "../platform/html-in-canvas.js";
import { COMPOSITOR_WGSL } from "./compositor.wgsl.js";
import type { ConnectorStyle } from "./connectors.js";
import {
  planFrame,
  type FramePlan,
  type PlannedConnector,
  type PlannedView,
  type ViewDraw,
} from "./frame-plan.js";

/** A view in the scene: its DOM subtree, plus everything the plan needs. */
export interface SceneView extends PlannedView {
  /**
   * The element captured for this view. It MUST be an immediate child of the
   * scene canvas — the platform rejects anything deeper. Its own descendants
   * are captured with it.
   */
  readonly element: HTMLElement;
}

/**
 * The minimum of vgpu this module uses, named so the compositor can be driven
 * by `vgpu`, `vgpu/node` or `vgpu/mock` without importing any of them.
 */
export interface VgpuLike {
  readonly device: { readonly gpu: GPUDevice };
  dispose?(): void;
}

export interface SurfaceLike {
  readonly context: GPUCanvasContext;
}

export interface CompositorDeps {
  readonly gpu: VgpuLike;
  readonly surface: SurfaceLike;
}

export interface CompositorOptions {
  /** The ground colour receded planes drift toward. Defaults to a warm off-white. */
  readonly ground?: readonly [number, number, number];
  /** Stand the pointer router down once a browser redirects hit-testing itself. */
  readonly platformHandlesHitTesting?: boolean;
  readonly connectorOverrides?: Readonly<Record<string, Partial<ConnectorStyle>>>;
}

interface ViewResources {
  texture: GPUTexture;
  width: number;
  height: number;
  bindGroup: GPUBindGroup | null;
  uniform: GPUBuffer;
}

const UNIFORM_BYTES = 64; // 4 x vec4f

/**
 * Captures views into GPU textures and composites them as quads at plane
 * depth, then reports each drawn position back to the browser.
 *
 * The frame is decided by `planFrame` — which fidelity captures, what order
 * things draw in, where each view lands — and this class only submits it.
 * Keeping the decisions out of here is what lets them be tested in CI with
 * no GPU and no DOM.
 */
export class Compositor {
  private readonly views = new Map<string, SceneView>();
  private readonly resources = new Map<string, ViewResources>();
  private readonly capturedAt: Record<string, number> = {};
  private readonly router: PointerRouter;
  private pipeline: GPURenderPipeline | null = null;
  private sampler: GPUSampler | null = null;
  private frame = 0;
  private detachRouter: (() => void) | null = null;
  private connectors: readonly PlannedConnector[] = [];
  private lastPlan: FramePlan | null = null;
  private lastPlacements: readonly Placement[] = [];

  readonly capabilities: PlatformCapabilities;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly deps: CompositorDeps,
    private readonly options: CompositorOptions = {},
  ) {
    setLayoutSubtree(canvas, true);
    this.capabilities = detectCapabilities(deps.gpu.device.gpu.queue, canvas);
    this.router = new PointerRouter(canvas, {
      ...(options.platformHandlesHitTesting === undefined
        ? {}
        : { platformHandlesHitTesting: options.platformHandlesHitTesting }),
    });
  }

  attach(): () => void {
    this.detachRouter = this.router.attach();
    return () => this.detach();
  }

  detach(): void {
    this.detachRouter?.();
    this.detachRouter = null;
  }

  /**
   * Brings the scene in line with a new set of views, keeping the GPU
   * resources of everything that survived.
   *
   * Removing and re-adding every view on each edit destroys and reallocates
   * every texture, which is both wasteful and — at this scene's size — enough
   * to bring the GPU process down. Reconciling touches only what changed.
   */
  reconcile(views: readonly SceneView[]): void {
    const next = new Map(views.map((view) => [view.id, view]));
    for (const id of [...this.views.keys()]) {
      if (!next.has(id)) this.remove(id);
    }
    for (const view of views) {
      const existing = this.views.get(view.id);
      if (!existing) {
        this.add(view);
        continue;
      }
      // What actually changes the PIXELS: a different element, a different
      // box, or a different opacity. Moving a view does not — and marking a
      // move dirty put every plane-1 view back into the per-frame capture
      // budget for the whole of every transition.
      const resized = existing.width !== view.width || existing.height !== view.height;
      const replaced = existing.element !== view.element;
      const faded = (existing.opacity ?? 1) !== (view.opacity ?? 1);
      const dirty = existing.dirty || resized || replaced || faded;
      this.views.set(view.id, { ...view, dirty });
      if (replaced || (dirty && !this.capturedAtIsFresh(view.id))) {
        // Force a first-class recapture rather than relying on the fidelity
        // rule, which for `glyph` never recaptures at all.
        delete this.capturedAt[view.id];
      }
    }
  }

  /** Whether this view's cached texture still reflects what it looks like. */
  private capturedAtIsFresh(id: string): boolean {
    return this.capturedAt[id] !== undefined && this.views.get(id)?.dirty !== true;
  }

  add(view: SceneView): void {
    if (view.element.parentElement !== this.canvas) {
      // The platform's own message for this arrives from deep inside a
      // capture call, a frame later, naming neither the view nor the fix.
      throw new Error(
        `View "${view.id}" must be an immediate child of the scene canvas — ` +
          "the capture API rejects deeper descendants. Nest inside a view, " +
          "never between views.",
      );
    }
    this.views.set(view.id, { ...view, dirty: true });
  }

  remove(id: string): void {
    const resource = this.resources.get(id);
    resource?.texture.destroy();
    resource?.uniform.destroy();
    this.resources.delete(id);
    this.views.delete(id);
    delete this.capturedAt[id];
  }

  /** Replaces the connector set, e.g. after a layout change. */
  setConnectors(connectors: readonly PlannedConnector[]): void {
    this.connectors = connectors;
  }

  /** Marks a view's texture stale, so the next frame recaptures it. */
  invalidate(id: string): void {
    const view = this.views.get(id);
    if (view) this.views.set(id, { ...view, dirty: true });
  }

  all(): SceneView[] {
    return [...this.views.values()];
  }

  /** Last frame's plan. Measurement harnesses and tests only. */
  plan(): FramePlan | null {
    return this.lastPlan;
  }

  /** Where each view was drawn last frame, with the element it came from. */
  placements(): readonly Placement[] {
    return this.lastPlacements;
  }

  /** Raw device handle. Measurement harnesses only. */
  deviceForProbe(): GPUDevice {
    return this.deps.gpu.device.gpu;
  }

  /** Asks the browser for a `paint` event — the only moment capture is legal. */
  scheduleFrame(): void {
    requestPaint(this.canvas);
  }

  /**
   * One frame: capture what is stale, draw every view back to front, and tell
   * the browser where each one landed.
   *
   * Call this from a `paint` listener. Outside one the browser has no paint
   * record and capture throws.
   */
  render(): FramePlan {
    const device = this.deps.gpu.device.gpu;
    const queue = device.queue;
    this.frame += 1;

    // Read the canvas's CURRENT backing size every frame.
    //
    // This used to be a tuple captured when the compositor was built. Once
    // the scene became responsive the canvas resized underneath it, the
    // shader kept mapping canvas pixels to NDC with the old dimensions, and
    // every quad landed somewhere it should not — barely at the origin,
    // badly further down. The canvas is the surface; there is no second
    // source of truth to go stale.
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const plan = planFrame([...this.views.values()], this.connectors, {
      canvasWidth,
      canvasHeight,
      capturedAt: this.capturedAt,
      ...(this.options.connectorOverrides
        ? { connectorOverrides: this.options.connectorOverrides }
        : {}),
    });
    this.lastPlan = plan;

    for (const capture of plan.captures) {
      const view = this.views.get(capture.viewId);
      if (!view) continue;
      const resource = this.ensureResources(device, view);
      captureElement(queue, view.element, resource.texture);
      this.capturedAt[view.id] = this.frame;
      this.views.set(view.id, { ...view, dirty: false });
    }

    const encoder = device.createCommandEncoder({ label: "graview-compositor" });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.deps.surface.context.getCurrentTexture().createView(),
          clearValue: this.groundColor(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.ensurePipeline(device));

    const placements: Placement[] = [];
    for (const draw of plan.draws) {
      const view = this.views.get(draw.viewId);
      const resource = this.resources.get(draw.viewId);
      if (!view || !resource) continue;

      queue.writeBuffer(
        resource.uniform,
        0,
        packUniform(
          draw,
          canvasWidth,
          canvasHeight,
          this.options.ground ?? [0.957, 0.949, 0.933],
        ),
      );
      pass.setBindGroup(0, this.ensureBindGroup(device, resource));
      pass.draw(6);

      placements.push({
        element: view.element,
        transform: draw.transform,
        width: view.width,
        height: view.height,
        depth: view.plane,
      });
    }

    pass.end();
    queue.submit([encoder.finish()]);

    // Report the drawn positions even on builds that ignore them: the call is
    // free, and it is what makes the scene correct the day it lands.
    if (this.capabilities.geometrySync) {
      for (const report of plan.geometry) {
        const view = this.views.get(report.viewId);
        if (!view) continue;
        updateElementGeometry(this.canvas, view.element, {
          canvasTransform: toDOMMatrix(report.transform),
        });
      }
    }

    this.lastPlacements = placements;
    this.router.setPlacements(placements);
    return plan;
  }

  private groundColor(): GPUColor {
    const [r, g, b] = this.options.ground ?? [0.957, 0.949, 0.933];
    return { r, g, b, a: 1 };
  }

  private ensurePipeline(device: GPUDevice): GPURenderPipeline {
    if (this.pipeline) return this.pipeline;
    const module = device.createShaderModule({
      code: COMPOSITOR_WGSL,
      label: "graview-compositor",
    });
    this.pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs_main" },
      fragment: {
        module,
        entryPoint: "fs_main",
        targets: [
          {
            format: navigator.gpu.getPreferredCanvasFormat(),
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
    return this.pipeline;
  }

  private ensureResources(device: GPUDevice, view: SceneView): ViewResources {
    // CEIL, not round. The browser rasterises an element of height 399.4 into
    // 400 rows, and a 399-row texture makes the copy fail validation — which
    // it does silently, leaving the view with whatever was in the texture
    // before, or nothing at all. Allocate at least what can arrive.
    const width = Math.max(1, Math.ceil(view.width));
    const height = Math.max(1, Math.ceil(view.height));
    const existing = this.resources.get(view.id);
    if (existing && existing.width === width && existing.height === height) {
      return existing;
    }
    existing?.texture.destroy();
    const texture = device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
      label: `graview-view-${view.id}`,
    });
    const resource: ViewResources = {
      texture,
      width,
      height,
      bindGroup: null,
      uniform:
        existing?.uniform ??
        device.createBuffer({
          size: UNIFORM_BYTES,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: `graview-plane-${view.id}`,
        }),
    };
    this.resources.set(view.id, resource);
    return resource;
  }

  private ensureBindGroup(device: GPUDevice, resource: ViewResources): GPUBindGroup {
    if (resource.bindGroup) return resource.bindGroup;
    this.sampler ??= device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    resource.bindGroup = device.createBindGroup({
      layout: this.ensurePipeline(device).getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: resource.uniform } },
        { binding: 1, resource: resource.texture.createView() },
        { binding: 2, resource: this.sampler },
      ],
    });
    return resource.bindGroup;
  }

  dispose(): void {
    this.detach();
    for (const id of [...this.resources.keys()]) this.remove(id);
  }
}

/**
 * The uniform layout the compositing shader reads, packed as data so a test
 * can assert on it with no GPU present.
 */
export function packUniform(
  draw: ViewDraw,
  canvasWidth: number,
  canvasHeight: number,
  ground: readonly [number, number, number],
): Float32Array<ArrayBuffer> {
  return new Float32Array([
    draw.transform[12], draw.transform[13], draw.width, draw.height,
    draw.style.blur, draw.style.falloff, draw.style.shadow, draw.opacity,
    canvasWidth, canvasHeight, 0, 0,
    ground[0], ground[1], ground[2], 1,
  ]);
}
