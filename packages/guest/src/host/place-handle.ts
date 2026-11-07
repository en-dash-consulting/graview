import type { ViewPlaceDrawing, ViewPlaceHandle } from "@graview/react/provider";
import { codeOf, type WorkerViewCode, type WorkerViewLoad } from "./code-of.js";
import type { WorkerViewManifest } from "./manifest.js";
import { readTheme } from "./theme.js";
import type { MountWorkerViewOptions, WorkerView } from "./view.js";
import { checkViewSource } from "./view-source.js";
import type { AnySchema } from "@graview/core";

/*
 * WHAT A VIEW'S PLACE LENDS ITS REVISION (Roadmap
 * f-make-this-section-better), made with the worker's host when a view is
 * first drawn — so a page that registers views carries none of it: the
 * view's code, its look, what it drew and what was refused of it, the host's
 * own checks of a view's code, a draft drawn in its place over it, and the
 * code drawn from then on.
 */

/** How long a draft has to draw before it is said not to have. */
const DRAFT_MS = 8000;

/** What a mounted view drew: its root, its stylesheet, its height. */
const drawingOf = (view: WorkerView | null | undefined): ViewPlaceDrawing => ({ root: view?.shadow.querySelector("[data-graview-view-root]") ?? undefined, css: view?.css ?? "", height: view?.contentHeight });

/** What the host refused of a drawing, in short sentences. */
const refusedOf = (view: WorkerView | null | undefined): readonly string[] =>
  (view?.refused ?? []).map((one) => `Refused ${one.reason === "css" ? "a rule of the stylesheet" : `${one.element ? `<${one.element}>` : "something"}${one.name ? ` ${one.name}` : ""}`} (${one.reason}).`);

export interface ViewPlaceHandleOptions {
  /** The element the view is drawn in (`data-worker-view-place`). */
  readonly element: HTMLElement;
  readonly definition: { readonly manifest: WorkerViewManifest; readonly worker: WorkerViewCode | WorkerViewLoad };
  /** The view as it is mounted now. */
  readonly mounted: () => WorkerView | null;
  /** The options the view is mounted with, for this code. */
  readonly optionsFor: (worker: WorkerViewCode | WorkerViewLoad) => MountWorkerViewOptions<AnySchema>;
  /** Draws this code from now on (a revision kept); undefined goes back to the view's own. */
  readonly draw: (source: string | undefined) => void;
  readonly mount: (element: HTMLElement, options: MountWorkerViewOptions<AnySchema>) => WorkerView;
  /** What fetches the headless press run, as the page lent it (`lendViewPressing`); unlent, the place presses nothing. */
  readonly pressing?: () => (() => Promise<typeof import("../headless/pressed-here.js")>) | undefined;
}

export function viewPlaceHandle({ element, definition, mounted, optionsFor, draw, mount, pressing }: ViewPlaceHandleOptions): ViewPlaceHandle {
  return {
    name: definition.manifest.name,
    title: definition.manifest.title ?? definition.manifest.name,
    source: async () => {
      const code = typeof definition.worker === "function" ? await codeOf(definition.worker) : definition.worker;
      return "source" in code ? code.source : undefined;
    },
    theme: async () => {
      const region = mounted()?.element;
      return region ? ({ ...readTheme(region) } as unknown as Record<string, string>) : {};
    },
    drawing: () => drawingOf(mounted()),
    refused: () => refusedOf(mounted()),
    check: async (source) => checkViewSource(source),
    /*
     * Every control the code would draw, pressed headless for this seat in
     * a worker of the page's own, nothing applied: fetched the first time a
     * draft is pressed, by what the page lent (`lendViewPressing`), so a
     * page that never asks — and a guest host alone — carries none of it.
     */
    presses: async (source) => {
      const lent = pressing?.();
      if (!lent) throw new Error("This page cannot press a view's controls.");
      const { pressedHere } = await lent();
      const options = optionsFor({ source });
      const ran = await pressedHere({
        manifest: options.manifest,
        source,
        store: options.store,
        principal: options.principal,
        ...(options.input ? { input: options.input() } : {}),
        ...(options.places ? { places: options.places() } : {}),
      });
      if (!ran.ok) {
        const problem = { control: "the view", element: "", does: "nothing", ok: false, says: ran.detail };
        return { ok: false, controls: [problem], problems: [problem] };
      }
      const pressed = ran.presses;
      return pressed ? { ok: pressed.ok, controls: pressed.controls, problems: pressed.problems } : { ok: true, controls: [], problems: [] };
    },
    draft: (source) => {
      const live = mounted()?.element;
      const holder = element.ownerDocument.createElement("div");
      holder.setAttribute("data-graview-section-draft", definition.manifest.name);
      holder.style.minWidth = "0";
      element.appendChild(holder);
      if (live) live.style.display = "none";
      let settle: (answer: { readonly failed?: string }) => void = () => undefined;
      const drawn = new Promise<{ readonly failed?: string }>((resolve) => (settle = resolve));
      const late = setTimeout(() => settle({ failed: `It did not draw in ${DRAFT_MS / 1000} seconds.` }), DRAFT_MS);
      const view = mount(holder, {
        ...optionsFor({ source }),
        /* Code proposed and not kept reads and writes nothing kept for its viewer. */
        draft: true,
        fallback: false,
        onFailure: (reason, detail) => settle({ failed: detail ?? `It failed (${reason}).` }),
        /* Drawn once it stands some height: an empty first measure is the region before the view's first drawing. */
        onContentHeight: (height) => {
          if (height !== undefined && height > 0) settle({});
        },
      });
      void drawn.then(() => clearTimeout(late));
      return {
        drawn,
        drawing: () => drawingOf(view),
        refused: () => refusedOf(view),
        dispose: () => {
          clearTimeout(late);
          view.dispose();
          holder.remove();
          if (live) live.style.display = "";
        },
      };
    },
    draw,
  };
}
