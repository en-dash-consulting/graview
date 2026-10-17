/// <reference types="@webgpu/types" />
//
// The WebGPU globals are part of this file's PUBLIC declarations, so the
// reference has to live HERE rather than on the package entry: TypeScript
// drops a type reference from a `.d.ts` that does not itself name one of its
// types, so a reference on `index.ts` was emitted nowhere and an installed
// consumer got "cannot find name GPUDevice" from a file they cannot change.
// Found by typechecking a scratch project against the packed tarballs.
//
// It also has to be the ONLY route in: listing `@webgpu/types` under
// `compilerOptions.types` makes the globals ambient for this build, at which
// point TypeScript considers the reference satisfied and drops it from the
// emit. The build sees no difference; a stranger does.

import { PointerRouter, type Placement } from "../interaction/pointer-router.js";
import {
  captureElement,
  changedElementsOf,
  detectCapabilities,
  markDrawable,
  requestPaint,
  setLayoutSubtree,
  toDOMMatrix,
  updateElementGeometry,
  type Matrix4,
  type PlatformCapabilities,
} from "../platform/html-in-canvas.js";
import { COMPOSITOR_WGSL } from "./compositor.wgsl.js";
import type { ConnectorStyle } from "./connectors.js";
import type { Scheme } from "./plane.js";
import {
  CAPTURE_BUDGET,
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
   * are captured with it. A view marked `dom` is drawn by its host instead,
   * wherever its element is; it is only placed.
   */
  readonly element: HTMLElement;
}

/**
 * The minimum of a WebGPU device this module uses, said structurally: a
 * device from `navigator.gpu`, from `vgpu`, `vgpu/node` or `vgpu/mock` all
 * fit, and this package depends on none of them.
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
  /** The ground color receded planes drift toward. Defaults to a warm off-white. */
  readonly ground?: readonly [number, number, number];
  /** Stand the pointer router down once a browser redirects hit-testing itself. */
  readonly platformHandlesHitTesting?: boolean;
  readonly connectorOverrides?: Readonly<Record<string, Partial<ConnectorStyle>>>;
  /** The most captures one frame may spend; defaults to `CAPTURE_BUDGET`. */
  readonly captureBudget?: number;
  /**
   * Clear to transparent rather than to the ground, so whatever is under the
   * canvas — the ground, and views a host draws on the DOM path — shows
   * where no view is drawn.
   */
  readonly transparent?: boolean;
  /**
   * Whether receded planes are blurred; on unless turned off. The focused
   * plane is never blurred — every other plane is judged against it.
   */
  readonly blur?: boolean;
  /** The scheme the planes are treated in, as the DOM path treats them; dark when absent. */
  readonly scheme?: Scheme;
}

interface ViewResources {
  texture: GPUTexture;
  width: number;
  height: number;
  bindGroup: GPUBindGroup | null;
  /** This view's place in the shared uniform buffer. */
  slot: number;
}

const UNIFORM_BYTES = 64; // 4 x vec4f
/**
 * Each view's uniform sits at its own 256-byte slot of ONE buffer — the
 * offset alignment WebGPU guarantees — so a frame uploads every view's
 * uniform in a single write. A buffer and a write per view was a fifth of a
 * 512-view frame's script.
 */
const SLOT_BYTES = 256;
const SLOT_FLOATS = SLOT_BYTES / 4;
/**
 * Geometry reports a frame; the rest wait for the frames after. Each one
 * crosses into the browser, and a pan moves every view: 512 reports a frame
 * were the largest single cost of a 512-view frame.
 */
const GEOMETRY_BUDGET = 64;

/** A frame as submitted: its plan, and what could not be taken after all. */
export interface CompositedFrame extends FramePlan {
  /**
   * Views with no pixels yet whose capture the browser refused — an element
   * that has not been painted since it arrived in the canvas has no paint
   * record. Not drawn this frame; taken the next.
   */
  readonly missed: readonly string[];
  /** The views the browser said changed this frame; null when it does not say. */
  readonly changed: ReadonlySet<string> | null;
}

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
  private readonly idOf = new WeakMap<Element, string>();
  private readonly resources = new Map<string, ViewResources>();
  private readonly capturedAt: Record<string, number> = {};
  private uniforms: GPUBuffer | null = null;
  private staging = new Float32Array(0);
  private slotCount = 0;
  private nextSlot = 0;
  private readonly freeSlots: number[] = [];
  /** The transform each view's geometry was last reported at, as a key. */
  private readonly reported = new Map<string, string>();
  private readonly router: PointerRouter;
  private pipeline: GPURenderPipeline | null = null;
  private sampler: GPUSampler | null = null;
  private frame = 0;
  private detachRouter: (() => void) | null = null;
  private connectors: readonly PlannedConnector[] = [];
  private lastPlan: FramePlan | null = null;
  private lastPlacements: readonly Placement[] = [];
  private blur: boolean;
  private scheme: Scheme;

  readonly capabilities: PlatformCapabilities;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly deps: CompositorDeps,
    private readonly options: CompositorOptions = {},
  ) {
    setLayoutSubtree(canvas, true);
    this.blur = options.blur ?? true;
    this.scheme = options.scheme ?? "dark";
    this.capabilities = detectCapabilities(deps.gpu.device.gpu.queue, canvas);
    // Where the browser's own hit-test follows the drawn geometry, it answers; elsewhere the router does.
    const platformHits = options.platformHandlesHitTesting ?? this.capabilities.hitTestFollowsGeometry === "yes";
    this.router = new PointerRouter(canvas, { platformHandlesHitTesting: platformHits });
    // Said on the canvas, so a stylesheet lets the views' content take the pointer (`data-graview-hit`).
    canvas.setAttribute("data-graview-hit", platformHits ? "platform" : "router");
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
      const replaced = existing.element !== view.element || (existing.dom ?? false) !== (view.dom ?? false);
      if (replaced) this.track(view);
      const faded = (existing.opacity ?? 1) !== (view.opacity ?? 1);
      const dirty = existing.dirty || view.dirty === true || resized || replaced || faded;
      this.views.set(view.id, { ...view, dirty });
      if (replaced || resized) {
        // New pixels or a new size: there is nothing current to draw, so it
        // is taken as if seen for the first time. A view whose content only
        // went stale keeps its pixels and waits its turn in the budget —
        // forgetting those turned every stale view into a first sight, and
        // a reconcile per frame then spent no budget at all.
        delete this.capturedAt[view.id];
      }
    }
  }

  add(view: SceneView): void {
    if (!view.dom && view.element.parentElement !== this.canvas) {
      // The platform's own message for this arrives from deep inside a
      // capture call, a frame later, naming neither the view nor the fix.
      throw new Error(
        `View "${view.id}" must be an immediate child of the scene canvas — ` +
          "the capture API rejects deeper descendants. Nest inside a view, " +
          "never between views.",
      );
    }
    this.track(view);
    this.views.set(view.id, { ...view, dirty: true });
  }

  /** Knows the element as this view's, and marks it for the canvas to draw. */
  private track(view: SceneView): void {
    this.idOf.set(view.element, view.id);
    if (!view.dom) markDrawable(view.element);
  }

  remove(id: string): void {
    const resource = this.resources.get(id);
    resource?.texture.destroy();
    if (resource) this.freeSlots.push(resource.slot);
    this.resources.delete(id);
    this.reported.delete(id);
    this.views.delete(id);
    delete this.capturedAt[id];
  }

  /**
   * Turns the receded planes' blur on or off from the next frame. Only the
   * uniform changes: the same shader draws a radius of zero as the texture
   * itself, so a frame costs what it did.
   */
  setBlur(on: boolean): void {
    this.blur = on;
  }

  /** Treats the planes in this scheme from the next frame, as the DOM path does. */
  setScheme(scheme: Scheme): void {
    this.scheme = scheme;
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
   * One frame from a `paint` event, retaking only the views the event says
   * changed (`changedElements`) — the whole of keeping a page of live views
   * under the capture cliff. A build that does not say is `render()`.
   */
  paint(event: Event): CompositedFrame {
    return this.render(changedElementsOf(event));
  }

  /**
   * One frame: capture what is stale, draw every view back to front, and tell
   * the browser where each one landed.
   *
   * Call this from a `paint` listener. Outside one the browser has no paint
   * record and capture throws. `changed` is the elements whose DOM changed
   * since the last frame; given, a live view that did not change is not
   * retaken, and one that changed while off the canvas or over the budget
   * stays stale until it is.
   */
  render(changed?: ReadonlySet<Element> | null): CompositedFrame {
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
    let changedIds: Set<string> | undefined;
    if (changed) {
      changedIds = new Set();
      for (const element of changed) {
        const id = this.idOf.get(element);
        if (id !== undefined) changedIds.add(id);
      }
    }
    const reportedChanged = changedIds ? new Set(changedIds) : null;
    const plan = planFrame([...this.views.values()], this.connectors, {
      canvasWidth,
      canvasHeight,
      capturedAt: this.capturedAt,
      captureBudget: this.options.captureBudget ?? CAPTURE_BUDGET,
      scheme: this.scheme,
      ...(changedIds ? { changed: changedIds } : {}),
      ...(this.options.connectorOverrides
        ? { connectorOverrides: this.options.connectorOverrides }
        : {}),
    });
    this.lastPlan = plan;

    const missed: string[] = [];
    for (const capture of plan.captures) {
      const view = this.views.get(capture.viewId);
      if (!view) continue;
      const resource = this.ensureResources(device, view);
      try {
        captureElement(queue, view.element, resource.texture);
      } catch (error) {
        // An element the browser has not painted yet — just arrived in the
        // canvas — has no paint record to take. It is taken next frame; one
        // that never had pixels is not drawn until then.
        if (!(error instanceof DOMException && error.name === "InvalidStateError")) throw error;
        if (this.capturedAt[view.id] === undefined) missed.push(view.id);
        if (!view.dirty) this.views.set(view.id, { ...view, dirty: true });
        continue;
      }
      this.capturedAt[view.id] = this.frame;
      this.views.set(view.id, { ...view, dirty: false });
      changedIds?.delete(view.id);
    }
    // What changed and was not retaken — off the canvas, or over the budget —
    // is remembered as stale, since the browser will not say so twice.
    for (const id of [...(changedIds ?? []), ...plan.deferred]) {
      const view = this.views.get(id);
      if (view && !view.dirty) this.views.set(id, { ...view, dirty: true });
    }

    const encoder = device.createCommandEncoder({ label: "graview-compositor" });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.deps.surface.context.getCurrentTexture().createView(),
          clearValue: this.options.transparent ? { r: 0, g: 0, b: 0, a: 0 } : this.groundColor(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.ensurePipeline(device));

    const ground = this.options.ground ?? [0.957, 0.949, 0.933];
    const drawn: ViewResources[] = [];
    let highest = -1;
    for (const draw of plan.draws) {
      if (missed.includes(draw.viewId)) continue;
      const resource = this.resources.get(draw.viewId);
      if (!resource || !this.views.has(draw.viewId)) continue;
      packUniformInto(this.staging, resource.slot * SLOT_FLOATS, draw, canvasWidth, canvasHeight, ground, this.blur);
      if (resource.slot > highest) highest = resource.slot;
      drawn.push(resource);
    }
    if (highest >= 0 && this.uniforms) {
      queue.writeBuffer(this.uniforms, 0, this.staging.buffer, 0, (highest + 1) * SLOT_BYTES);
    }
    for (const resource of drawn) {
      pass.setBindGroup(0, this.ensureBindGroup(device, resource));
      pass.draw(6);
    }
    // Placed whether the GPU drew it or its host did: a press finds either.
    const placements: Placement[] = [];
    for (const placed of plan.placements) {
      const view = this.views.get(placed.viewId);
      if (!view) continue;
      placements.push({
        element: view.element,
        transform: placed.transform,
        width: placed.width,
        height: placed.height,
        depth: placed.depth,
      });
    }

    pass.end();
    queue.submit([encoder.finish()]);

    // Report the drawn positions even on builds that ignore them: it is what
    // makes the scene correct the day it lands. Only what moved since its
    // last report, and while a crowd is moving, once it stops.
    if (this.capabilities.geometrySync) {
      const moved: { element: HTMLElement; id: string; key: string; transform: Matrix4 }[] = [];
      // Off the canvas too: a view left at its last drawn place would be found there, invisible.
      for (const report of [...plan.geometry, ...plan.offCanvas]) {
        const view = this.views.get(report.viewId);
        if (!view) continue;
        const key = report.transform.join(",");
        if (this.reported.get(report.viewId) !== key) moved.push({ element: view.element, id: report.viewId, key, transform: report.transform });
      }
      // At most a budget's worth a frame, and the rest the frames after:
      // the browser hit-tests where a view was last reported, so a crowd
      // left unreported would answer a press where it was laid out.
      for (const { element, id, key, transform } of moved.slice(0, GEOMETRY_BUDGET)) {
        updateElementGeometry(this.canvas, element, { canvasTransform: toDOMMatrix(transform) });
        this.reported.set(id, key);
      }
      if (moved.length > GEOMETRY_BUDGET) requestPaint(this.canvas);

    }

    this.lastPlacements = placements;
    this.router.setPlacements(placements);
    return missed.length === 0
      ? { ...plan, missed, changed: reportedChanged }
      : { ...plan, draws: plan.draws.filter((draw) => !missed.includes(draw.viewId)), missed, changed: reportedChanged };
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
            // PREMULTIPLIED, as the shader writes it: "src-alpha" here
            // multiplied by alpha a second time, so every receded or fading
            // view came out darker than the DOM path drew it.
            blend: {
              color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
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
    // CEIL, not round. The browser rasterizes an element of height 399.4 into
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
    const slot = existing?.slot ?? this.takeSlot(device);
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
      slot,
    };
    this.resources.set(view.id, resource);
    return resource;
  }

  /** A free uniform slot, growing the shared buffer when there is none. */
  private takeSlot(device: GPUDevice): number {
    const free = this.freeSlots.pop();
    if (free !== undefined) return free;
    const slot = this.nextSlot++;
    if (slot >= this.slotCount) {
      const count = Math.max(64, this.slotCount * 2);
      this.uniforms?.destroy();
      this.uniforms = device.createBuffer({
        size: count * SLOT_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "graview-planes",
      });
      const staging = new Float32Array(count * SLOT_FLOATS);
      staging.set(this.staging);
      this.staging = staging;
      this.slotCount = count;
      // Every bind group named the old buffer.
      for (const resource of this.resources.values()) resource.bindGroup = null;
    }
    return slot;
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
        { binding: 0, resource: { buffer: this.uniforms!, offset: resource.slot * SLOT_BYTES, size: UNIFORM_BYTES } },
        { binding: 1, resource: resource.texture.createView() },
        { binding: 2, resource: this.sampler },
      ],
    });
    return resource.bindGroup;
  }

  dispose(): void {
    this.detach();
    this.canvas.removeAttribute("data-graview-hit");
    for (const id of [...this.resources.keys()]) this.remove(id);
    this.uniforms?.destroy();
    this.uniforms = null;
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
  blur = true,
): Float32Array<ArrayBuffer> {
  const packed = new Float32Array(UNIFORM_BYTES / 4);
  packUniformInto(packed, 0, draw, canvasWidth, canvasHeight, ground, blur);
  return packed;
}

/** `packUniform`, written in place: a frame packs every view without allocating. */
function packUniformInto(
  target: Float32Array,
  at: number,
  draw: ViewDraw,
  canvasWidth: number,
  canvasHeight: number,
  ground: readonly [number, number, number],
  blur: boolean,
): void {
  target[at] = draw.transform[12];
  target[at + 1] = draw.transform[13];
  target[at + 2] = draw.width;
  target[at + 3] = draw.height;
  target[at + 4] = blur ? draw.blur : 0;
  target[at + 5] = draw.style.falloff;
  target[at + 6] = draw.style.shadow;
  target[at + 7] = draw.opacity;
  target[at + 8] = canvasWidth;
  target[at + 9] = canvasHeight;
  target[at + 10] = 0;
  target[at + 11] = 0;
  target[at + 12] = ground[0];
  target[at + 13] = ground[1];
  target[at + 14] = ground[2];
  target[at + 15] = 1;
}
