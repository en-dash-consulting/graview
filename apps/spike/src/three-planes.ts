/**
 * Three DOM panels, captured into WebGPU textures and composited as quads at
 * three plane depths, with per-plane scale, blur, contrast falloff and
 * shadow.
 *
 * This is the validation the whole spatial model rests on: ordinary DOM
 * living under a `<canvas layoutsubtree>`, drawn where layout says rather
 * than where it sits, with its geometry reported back to the browser.
 */
import { Compositor, type SceneView } from "@graview/render";
import { init, surface } from "vgpu";

const PANEL_CONTENT = [
  {
    title: "This week",
    body: "Mon 08:30 school run · Tue 13:00 pickup · Wed nap 12:30",
    accent: "#1f5c4a",
  },
  { title: "People", body: "parent1 · parent2 · caregiver1 · child1 · child2", accent: "#5c3d1f" },
  { title: "Everything else", body: "4 agreements · 5 reasons · 1 trigger", accent: "#3d1f5c" },
];

function makePanel(index: number): HTMLElement {
  const content = PANEL_CONTENT[index] ?? PANEL_CONTENT[0]!;
  const el = document.createElement("div");
  el.id = `panel-${index}`;
  el.className = "panel";
  el.style.cssText = [
    "position:absolute",
    "left:0",
    `top:${index * 260}px`,
    "width:420px",
    "height:240px",
    "box-sizing:border-box",
    "padding:20px",
    "background:#ffffff",
    "border:1px solid #e2ded6",
    "border-radius:10px",
    "font:15px/1.5 ui-sans-serif, system-ui",
    "color:#1a1a1a",
  ].join(";");
  el.innerHTML = `
    <h2 style="margin:0 0 10px;font-size:19px;color:${content.accent}">${content.title}</h2>
    <p style="margin:0 0 14px">${content.body}</p>
    <button type="button" data-panel="${index}"
      style="font:inherit;padding:7px 13px;border:1px solid #ccc;border-radius:7px;background:#f6f4f0">
      Act on plane ${index}
    </button>
    <output style="display:block;margin-top:10px;color:#666">idle</output>
  `;
  el.querySelector("button")?.addEventListener("click", () => {
    const out = el.querySelector("output");
    if (out) out.textContent = `clicked at ${new Date().toISOString().slice(11, 19)}`;
  });
  return el;
}

export interface ThreePlaneScene {
  readonly canvas: HTMLCanvasElement;
  readonly compositor: Compositor;
  readonly views: readonly SceneView[];
  /** Runs `frames` paint cycles and resolves when the last one has drawn. */
  run(frames: number): Promise<void>;
  dispose(): void;
}

export async function mountThreePlanes(root: HTMLElement): Promise<ThreePlaneScene> {
  const canvas = document.createElement("canvas");
  canvas.id = "scene-canvas";
  canvas.width = 1000;
  canvas.height = 620;
  canvas.style.cssText = "display:block;width:1000px;height:620px";
  root.appendChild(canvas);

  const panels = [0, 1, 2].map((index) => {
    const panel = makePanel(index);
    canvas.appendChild(panel);
    return panel;
  });

  // vgpu owns the device and configures the canvas context. That context is
  // not optional: without one, capture fails with "containing canvas does not
  // have a rendering context".
  const gpu = await init();
  const canvasSurface = surface(gpu, canvas);

  const compositor = new Compositor(canvas, {
    gpu: gpu as never,
    surface: { context: canvasSurface.context, size: [canvas.width, canvas.height] },
  });

  // Layout positions are chosen by inverting the plane transform from where
  // each panel should LAND, so the three quads tile the canvas instead of
  // occluding each other — an occluded panel would prove nothing about
  // routing, because the router correctly gives the nearest plane the click.
  const DRAWN = [
    { x: 30, y: 30 },
    { x: 480, y: 300 },
    { x: 730, y: 460 },
  ];
  const SCALES = [1, 0.72, 0.52];
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const views: SceneView[] = panels.map((element, index) => {
    const scale = SCALES[index]!;
    const drawn = DRAWN[index]!;
    return {
      id: `panel-${index}`,
      element,
      plane: index,
      x: cx + (drawn.x - cx) / scale,
      y: cy + (drawn.y - cy) / scale,
      width: 420,
      height: 240,
    };
  });
  for (const view of views) compositor.add(view);
  compositor.attach();

  const run = (frames: number) =>
    new Promise<void>((resolve) => {
      let drawn = 0;
      const onPaint = () => {
        compositor.render();
        drawn += 1;
        if (drawn >= frames) {
          canvas.removeEventListener("paint", onPaint);
          resolve();
          return;
        }
        compositor.scheduleFrame();
      };
      canvas.addEventListener("paint", onPaint);
      compositor.scheduleFrame();
      // A build without paint events would hang forever otherwise.
      setTimeout(() => {
        canvas.removeEventListener("paint", onPaint);
        resolve();
      }, 5000);
    });

  return {
    canvas,
    compositor,
    views,
    run,
    dispose() {
      compositor.dispose();
      gpu.dispose?.();
      canvas.remove();
    },
  };
}

declare global {
  interface Window {
    mountThreePlanes?: typeof mountThreePlanes;
  }
}

if (typeof window !== "undefined") window.mountThreePlanes = mountThreePlanes;
