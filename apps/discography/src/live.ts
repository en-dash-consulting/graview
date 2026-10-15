/// <reference types="@webgpu/types" />
/**
 * THE DISCOGRAPHY AT 512 LIVE VIEWS, on the GPU capture path.
 *
 * The scene itself never draws this many: a stop holds what its band can
 * (about two dozen at the hub), and altitude draws districts. So this page
 * draws the catalog's own songs, N at once, each a live view on the focus
 * plane — a card that may change any frame — and moves them all every
 * frame, the way a pan does, while a few change their text, the way a
 * playing track or an edit does. `scripts/verify-scale.mjs` reads its frame
 * rate at 64, 128, 256 and 512.
 *
 *   /live.html?n=512&mode=after    attachGpu: retakes only what changed, in
 *                                  a budget, the rest on the DOM path
 *   /live.html?n=512&mode=before   every live view retaken every frame, no
 *                                  budget — the capture policy before
 *
 * Chromium with `--enable-blink-features=CanvasDrawElement` only; anywhere
 * else it says so on the page and in `__live`.
 */
import { attachGpu, Compositor, type SceneView } from "@graview/render/gpu";
import { transformFor, styleFor, toDOMMatrix } from "@graview/render";
import seed from "./data/seed.json";

const params = new URLSearchParams(window.location.search);
const N = Number(params.get("n") ?? 512);
const MODE = params.get("mode") === "before" ? "before" : "after";
/** Views whose text changes each frame. */
const CHANGING = Number(params.get("change") ?? 4);

const W = 1440;
const H = 900;
const COLS = 16;
const CARD = { width: 84, height: 24 };
const PITCH = { x: W / COLS, y: 27 };

const songs = (seed as { nodes: { id: string; kind: string; label: string }[] }).nodes.filter((node) => node.kind === "song");

interface Live {
  mode: string;
  n: number;
  ready: boolean;
  error?: string;
  frames: number;
  captures: number;
  deferred: number;
  missed: number;
  onDom: number;
}
const live: Live = { mode: MODE, n: N, ready: false, frames: 0, captures: 0, deferred: 0, missed: 0, onDom: 0 };
(window as unknown as { __live: Live }).__live = live;

document.body.style.cssText = "margin:0;background:#f4f2ee;overflow:hidden;font:11px/1.2 ui-sans-serif,system-ui";
const stage = document.createElement("div");
stage.style.cssText = `position:relative;width:${W}px;height:${H}px`;
const under = document.createElement("div");
under.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden`;
const canvas = document.createElement("canvas");
canvas.width = W;
canvas.height = H;
canvas.setAttribute("content", "drawable");
canvas.setAttribute("layoutsubtree", "");
canvas.style.cssText = `display:block;position:relative;width:${W}px;height:${H}px`;
stage.append(under, canvas);
document.body.append(stage);

const cards = Array.from({ length: N }, (_, i) => {
  const song = songs[i % songs.length]!;
  const card = document.createElement("div");
  card.setAttribute("data-graview-view", song.id + "#" + i);
  card.style.cssText = `position:absolute;left:0;top:0;width:${CARD.width}px;height:${CARD.height}px;box-sizing:border-box;padding:3px 5px;background:#fff;border:1px solid #d9d4ca;border-radius:5px;color:#1a1a1a;overflow:hidden;white-space:nowrap;text-overflow:ellipsis`;
  card.textContent = song.label;
  canvas.append(card);
  return card;
});
const home = (i: number) => ({ x: (i % COLS) * PITCH.x + 3, y: Math.floor(i / COLS) * PITCH.y + 3 });

/** Where each card is this frame: the whole set swaying, as under a hand. */
const layoutAt = (frame: number) => {
  const sway = Math.round(Math.sin(frame / 12) * 2);
  return {
    nodes: cards.map((card, i) => ({ id: card.getAttribute("data-graview-view")!, plane: 0, x: home(i).x + sway, y: home(i).y, width: CARD.width, height: CARD.height })),
    connectors: [],
  };
};

/** A few cards change each frame, round the set. */
const change = (frame: number) => {
  for (let k = 0; k < CHANGING; k++) {
    const i = (frame * CHANGING + k) % N;
    const song = songs[i % songs.length]!;
    cards[i]!.textContent = `${song.label} · ${frame % 100}`;
  }
};

async function start() {
  if (!("gpu" in navigator)) throw new Error("No WebGPU.");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No WebGPU adapter.");
  const device = await adapter.requestDevice();
  const gpu = { device: { gpu: device } };
  let frame = 0;

  if (MODE === "before") {
    const context = canvas.getContext("webgpu") as GPUCanvasContext;
    context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: "premultiplied" });
    const compositor = new Compositor(canvas, { gpu, surface: { context } }, { captureBudget: Number.POSITIVE_INFINITY, transparent: true });
    const byId = new Map(cards.map((card) => [card.getAttribute("data-graview-view")!, card]));
    canvas.addEventListener("paint", () => {
      frame += 1;
      change(frame);
      compositor.reconcile(layoutAt(frame).nodes.map((node) => ({ ...node, element: byId.get(node.id)! }) as SceneView));
      // No `changedElements`: every live view is retaken, as before.
      const plan = compositor.render();
      live.frames += 1;
      live.captures += plan.captureCount;
      canvas.requestPaint?.();
    });
    canvas.requestPaint?.();
  } else {
    const onDom = new Set<string>();
    const attach = attachGpu({
      gpu,
      onFrame: (frame) => {
        live.frames += 1;
        live.captures += frame.captureCount;
        live.deferred += frame.deferred.length;
        live.missed += frame.missed.length;
      },
    });
    const byId = new Map(cards.map((card) => [card.getAttribute("data-graview-view")!, card]));
    // The DOM path, under the canvas: a handed-back card at the same transform.
    const drawOnDom = (ids: ReadonlySet<string>) => {
      for (const [id, card] of byId) {
        const wanted = ids.has(id) ? under : canvas;
        if (card.parentElement === wanted) continue;
        if (wanted === canvas) card.style.transform = "";
        wanted.append(card);
      }
      onDom.clear();
      for (const id of ids) onDom.add(id);
      live.onDom = onDom.size;
    };
    const tick = () => {
      frame += 1;
      change(frame);
      const layout = layoutAt(frame);
      for (const node of layout.nodes) {
        if (!onDom.has(node.id)) continue;
        const card = byId.get(node.id)!;
        card.style.transformOrigin = "0 0";
        card.style.transform = toDOMMatrix(transformFor(styleFor(0), node.x, node.y)).toString();
      }
      attach({ canvas, layout: layout as never, dirty: new Set(), hostOf: (id) => byId.get(id) ?? null, drawOnDom });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  live.ready = true;
}

declare global {
  interface HTMLCanvasElement {
    requestPaint?(): void;
  }
}

start().catch((error: unknown) => {
  live.error = String(error);
  document.body.textContent = `The GPU capture path is not available here: ${String(error)}`;
});
