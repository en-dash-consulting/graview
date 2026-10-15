/// <reference types="@webgpu/types" />
//
// See compositor.ts for why the reference lives on the file that names the
// WebGPU globals rather than on the package entry.

import type { InterpolatedLayout, Layout } from "@graview/layout";
import { detectCapabilities, requestPaint } from "../platform/html-in-canvas.js";
import { Compositor, type CompositedFrame, type CompositorOptions, type SceneView, type VgpuLike } from "./compositor.js";
import { fromLayout } from "./from-layout.js";

/**
 * What a host hands the capture path each time its picture changes — the
 * shape of `@graview/react`'s `attachRenderer` argument, said here without
 * naming React.
 */
export interface GpuScene {
  readonly canvas: HTMLCanvasElement;
  /** The picture as it is right now; mid-transition, between two states. */
  readonly layout: Layout | InterpolatedLayout;
  /** Views whose content changed without the browser being able to tell. */
  readonly dirty: ReadonlySet<string>;
  /** The host element for a view id, wherever it is drawn. */
  hostOf(id: string): HTMLElement | null;
  /**
   * The views the capture path hands to the DOM path, replacing the last
   * set. The host draws these as it would with no GPU at all — the same
   * affine transform, under the canvas — so where a view is drawn changes
   * and what it looks like does not.
   */
  drawOnDom?(ids: ReadonlySet<string>): void;
}

export interface AttachGpuOptions extends CompositorOptions {
  /** A device to draw with; a fresh one from `navigator.gpu` otherwise. */
  readonly gpu?: VgpuLike;
  /** Every frame's plan, after it is submitted. Measurement harnesses only. */
  readonly onFrame?: (frame: CompositedFrame, compositor: Compositor) => void;
}

/**
 * How many frames in a row a view may change AGAIN while it is still owed
 * pixels before it is handed to the DOM path. Once is a crowd that changed
 * together — a theme, a stop — and is caught up a budget at a time; three
 * in a row is a view changing faster than the budget can follow.
 */
const DEFERRALS_BEFORE_HANDING_ON = 3;

/**
 * The capture path as an `attachRenderer`: a canvas becomes a compositor
 * the first time it is handed over, and stays one across every later call.
 *
 * It keeps a page of live views under the capture cliff three ways. A view
 * is retaken only when the browser says its DOM changed (the `paint`
 * event's `changedElements`), so a still view costs nothing however live it
 * is. A view off the canvas is neither taken nor drawn. And no frame after
 * a stop lands spends more than its budget on retakes: what is over it is
 * drawn a frame late, and a view that keeps changing faster than the budget
 * follows is handed to the DOM path (`drawOnDom`), where a change costs no
 * capture. The hand-off has no seam: the host draws it at the same
 * transform, under the canvas, in the frame the GPU stops drawing it. It
 * stays there while it is in the picture, because the way back has one —
 * an element just returned to a canvas has no paint record for a frame.
 *
 * Where the platform cannot capture at all, every view goes to the DOM path
 * and the canvas stays empty.
 */
export function attachGpu(options: AttachGpuOptions = {}): (scene: GpuScene) => () => void {
  const sessions = new WeakMap<HTMLCanvasElement, Session>();
  return (scene) => {
    let session = sessions.get(scene.canvas);
    if (!session || session.disposed) {
      session = new Session(scene.canvas, options);
      sessions.set(scene.canvas, session);
    }
    session.show(scene);
    const held = session;
    return () => held.release();
  };
}

class Session {
  disposed = false;
  private scene: GpuScene | null = null;
  private compositor: Compositor | null = null;
  private ownDevice: GPUDevice | null = null;
  private stale = true;
  private readonly onDom = new Set<string>();
  private readonly lateFor = new Map<string, number>();
  private releasing: ReturnType<typeof setTimeout> | null = null;
  private readonly observer: MutationObserver | null;
  private readonly onPaint = (event: Event) => this.paint(event);

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly options: AttachGpuOptions,
  ) {
    // A host moving between the canvas and the DOM path is a new set of
    // views to reconcile, whether or not the picture changed.
    this.observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            this.stale = true;
            requestPaint(this.canvas);
          });
    this.observer?.observe(canvas, { childList: true });
    void this.start();
  }

  show(scene: GpuScene): void {
    if (this.releasing) clearTimeout(this.releasing);
    this.releasing = null;
    this.scene = scene;
    this.stale = true;
    requestPaint(this.canvas);
  }

  /**
   * A host calls cleanup and then attaches again on every picture; only a
   * cleanup NOT followed by an attach in the same task is the end.
   */
  release(): void {
    if (this.releasing) clearTimeout(this.releasing);
    this.releasing = setTimeout(() => this.dispose(), 0);
  }

  private async start(): Promise<void> {
    const everyView = () => {
      const ids = new Set(this.scene?.layout.nodes.map((node) => node.id) ?? []);
      this.scene?.drawOnDom?.(ids);
    };
    try {
      let gpu = this.options.gpu;
      if (!gpu) {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error("No WebGPU adapter.");
        const device = await adapter.requestDevice();
        this.ownDevice = device;
        gpu = { device: { gpu: device } };
      }
      if (this.disposed) return;
      const device = gpu.device.gpu;
      if (!detectCapabilities(device.queue, this.canvas).usable) throw new Error("No element capture.");
      const context = this.canvas.getContext("webgpu");
      if (!context) throw new Error("No WebGPU context on the scene canvas.");
      context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: "premultiplied" });
      this.compositor = new Compositor(this.canvas, { gpu, surface: { context } }, { transparent: true, ...this.options });
      this.compositor.attach();
      this.canvas.addEventListener("paint", this.onPaint);
      this.stale = true;
      requestPaint(this.canvas);
    } catch {
      // Nothing to capture with: every view is drawn the way it is without a GPU.
      everyView();
    }
  }

  private paint(event: Event): void {
    const compositor = this.compositor;
    const scene = this.scene;
    if (!compositor || !scene) return;
    if (this.stale) {
      this.stale = false;
      compositor.reconcile(this.views(scene));
    }
    const frame = compositor.paint(event);
    this.options.onFrame?.(frame, compositor);

    // A view left late that keeps changing is changing faster than the budget follows.
    let handed = false;
    const late = new Set(frame.deferred);
    for (const id of [...this.lateFor.keys()]) if (!late.has(id)) this.lateFor.delete(id);
    for (const id of late) {
      // Without word from the browser, being late again is all there is to go on.
      if (frame.changed && !frame.changed.has(id)) continue;
      const times = (this.lateFor.get(id) ?? 0) + 1;
      this.lateFor.set(id, times);
      if (times >= DEFERRALS_BEFORE_HANDING_ON && !this.onDom.has(id)) {
        this.onDom.add(id);
        this.lateFor.delete(id);
        handed = true;
      }
    }
    if (handed) scene.drawOnDom?.(new Set(this.onDom));
    // Keep painting while anything is owed pixels.
    if (frame.deferred.length > 0 || frame.missed.length > 0) requestPaint(this.canvas);
  }

  /** The picture as views: a host in the canvas is captured, one outside it is placed. */
  private views(scene: GpuScene): SceneView[] {
    const inCanvas = new Map<string, HTMLElement>();
    for (const child of this.canvas.children) {
      const id = child.getAttribute("data-graview-view");
      if (id !== null) inCanvas.set(id, child as HTMLElement);
    }
    const present = new Set<string>();
    const views: SceneView[] = [];
    for (const view of fromLayout(scene.layout, scene.dirty).views) {
      present.add(view.id);
      const element = inCanvas.get(view.id) ?? scene.hostOf(view.id);
      if (!element) continue;
      views.push({ ...view, element, ...(element.parentElement === this.canvas ? {} : { dom: true }) });
    }
    // A view that left the picture leaves the DOM path's set with it.
    let left = false;
    for (const id of this.onDom) {
      if (present.has(id)) continue;
      this.onDom.delete(id);
      left = true;
    }
    if (left) scene.drawOnDom?.(new Set(this.onDom));
    return views;
  }

  private dispose(): void {
    this.disposed = true;
    this.observer?.disconnect();
    this.canvas.removeEventListener("paint", this.onPaint);
    this.compositor?.dispose();
    this.compositor = null;
    this.ownDevice?.destroy();
    this.ownDevice = null;
  }
}
