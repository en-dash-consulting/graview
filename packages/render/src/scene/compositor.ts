import { PointerRouter, type Placement } from "../interaction/pointer-router.js";
import {
  captureElement,
  detectCapabilities,
  requestPaint,
  setLayoutSubtree,
  toDOMMatrix,
  updateElementGeometry,
  type Matrix4,
  type PlatformCapabilities,
} from "../platform/html-in-canvas.js";
import { COMPOSITOR_WGSL } from "./compositor.wgsl.js";
import { styleFor, transformFor, type PlaneStyle } from "./plane.js";

/** One view drawn into the scene: a DOM subtree, and where it belongs. */
export interface SceneView {
  readonly id: string;
  readonly element: HTMLElement;
  /** 0 focus, 1 relations, 2 context. */
  plane: number;
  /** Layout position in canvas pixels, before the plane transform. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Set when the view's DOM changed and its texture is stale. */
  dirty?: boolean;
}

/**
 * The minimum of vgpu this module uses, named so the compositor can be driven
 * by `vgpu`, `vgpu/node` or `vgpu/mock` without importing any of them —
 * which is what lets the snapshot tests run in CI with no GPU present.
 */
export interface VgpuLike {
  readonly device: { readonly gpu: GPUDevice };
  dispose?(): void;
}

export interface SurfaceLike {
  readonly context: GPUCanvasContext;
  readonly size: readonly [number, number];
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
}

interface ViewResources {
  texture: GPUTexture;
  width: number;
  height: number;
  /** Frame index of the last capture, so summary fidelity can cache. */
  capturedAt: number;
  bindGroup: GPUBindGroup | null;
  uniform: GPUBuffer;
}

const UNIFORM_BYTES = 64; // 4 x vec4f

/**
 * Captures views into GPU textures and composites them as quads at plane
 * depth, then reports each drawn position back to the browser.
 *
 * Capture budget follows the fidelity axis, not the view count. That split is
 * load-bearing rather than an optimisation: capture costs ~0.016 ms per node
 * up to ~128 live captures a frame and then falls off a cliff — 33 ms at 160,
 * a crashed GPU process at 256. Without the split, a scene would hit that
 * cliff at around 130 visible nodes. Measurements: `docs/platform-findings.md`.
 */
export class Compositor {
  private readonly views = new Map<string, SceneView>();
  private readonly resources = new Map<string, ViewResources>();
  private readonly router: PointerRouter;
  private pipeline: GPURenderPipeline | null = null;
  private sampler: GPUSampler | null = null;
  private frame = 0;
  private detachRouter: (() => void) | null = null;
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

  /** Starts routing pointers against drawn geometry. */
  attach(): () => void {
    this.detachRouter = this.router.attach();
    return () => this.detach();
  }

  detach(): void {
    this.detachRouter?.();
    this.detachRouter = null;
  }

  add(view: SceneView): void {
    this.views.set(view.id, { ...view, dirty: true });
  }

  remove(id: string): void {
    const resource = this.resources.get(id);
    resource?.texture.destroy();
    resource?.uniform.destroy();
    this.resources.delete(id);
    this.views.delete(id);
  }

  /** Marks a view's texture stale, so the next frame recaptures it. */
  invalidate(id: string): void {
    const view = this.views.get(id);
    if (view) view.dirty = true;
  }

  all(): SceneView[] {
    return [...this.views.values()];
  }

  /** Asks the browser for a `paint` event — the only moment capture is legal. */
  scheduleFrame(): void {
    requestPaint(this.canvas);
  }

  /**
   * Whether a view needs recapturing this frame. Fidelity, not plane index,
   * decides, and the split is what keeps a large scene in frame budget:
   *
   * - `full`    live: captured every frame, because it is being edited
   * - `summary` cached: captured only when its DOM actually changed
   * - `glyph`   captured once and never again; at glyph scale the pixels
   *             stop carrying detail, so a cached texture is indistinguishable
   *             from a live one and costs nothing per frame
   */
  private shouldCapture(view: SceneView, style: PlaneStyle): boolean {
    const resource = this.resources.get(view.id);
    if (!resource || resource.capturedAt === 0) return true;
    switch (style.fidelity) {
      case "full":
        return true;
      case "summary":
        return view.dirty === true;
      case "glyph":
        return false;
    }
  }

  /** Last frame's drawn placements. Measurement harnesses only. */
  placements(): readonly Placement[] {
    return this.lastPlacements;
  }

  /** Raw device handle. Measurement harnesses only. */
  deviceForProbe(): GPUDevice {
    return this.deps.gpu.device.gpu;
  }

  /**
   * One frame: capture what is stale, draw every view back to front, and tell
   * the browser where each one landed.
   *
   * Call this from a `paint` listener. Outside one the browser has no paint
   * record and capture throws.
   */
  render(): void {
    const device = this.deps.gpu.device.gpu;
    const queue = device.queue;
    this.frame += 1;

    const ordered = [...this.views.values()].sort((a, b) => b.plane - a.plane);
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
    const [canvasWidth, canvasHeight] = this.deps.surface.size;

    for (const view of ordered) {
      const style = styleFor(view.plane);
      const resource = this.ensureResources(device, view);

      if (this.shouldCapture(view, style)) {
        captureElement(queue, view.element, resource.texture);
        resource.capturedAt = this.frame;
        view.dirty = false;
      }
      const transform = transformFor(style, view.x, view.y, canvasWidth, canvasHeight);
      this.writeUniform(queue, resource, view, style, transform, canvasWidth, canvasHeight);
      pass.setBindGroup(0, this.ensureBindGroup(device, resource));
      pass.draw(6);

      placements.push({
        element: view.element,
        transform,
        width: view.width,
        height: view.height,
        depth: view.plane,
      });

      // Report the drawn position even on builds that ignore it: the call is
      // free, and it is what makes the scene correct the day it lands.
      if (this.capabilities.geometrySync) {
        updateElementGeometry(this.canvas, view.element, {
          canvasTransform: toDOMMatrix(transform),
        });
      }
    }

    pass.end();
    queue.submit([encoder.finish()]);
    this.lastPlacements = placements;
    this.router.setPlacements(placements);
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
    const existing = this.resources.get(view.id);
    if (existing && existing.width === view.width && existing.height === view.height) {
      return existing;
    }
    existing?.texture.destroy();
    const texture = device.createTexture({
      size: [Math.max(1, Math.round(view.width)), Math.max(1, Math.round(view.height))],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
      label: `graview-view-${view.id}`,
    });
    const resource: ViewResources = {
      texture,
      width: view.width,
      height: view.height,
      capturedAt: 0,
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

  private writeUniform(
    queue: GPUQueue,
    resource: ViewResources,
    view: SceneView,
    style: PlaneStyle,
    transform: Matrix4,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const [r, g, b] = this.options.ground ?? [0.957, 0.949, 0.933];
    const data = new Float32Array([
      transform[12], transform[13], view.width * style.scale, view.height * style.scale,
      style.blur, style.falloff, style.shadow, 0,
      canvasWidth, canvasHeight, 0, 0,
      r, g, b, 1,
    ]);
    queue.writeBuffer(resource.uniform, 0, data);
  }

  dispose(): void {
    this.detach();
    for (const id of [...this.resources.keys()]) this.remove(id);
  }
}
