import "@remote-dom/core/polyfill";
import { Store, type AnySchema } from "@graview/core";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { drawTranscript, runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { sanitizeStylesheets } from "../../src/host/css.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { OPEN_MAX_STYLESHEET } from "@graview/core/css";
import { createViewRuntime } from "../../src/worker/view-global.js";

/*
 * A VIEW'S STYLESHEETS ARE DRAWN IN THE ORDER IT GAVE THEM (Threat Watch,
 * 2026-10-21). A view that called `graview.style` twice — the app's shared
 * design-system sheet, then its own — drew with only the second, and
 * nothing said the first was gone. Every call now adds its sheet after
 * the ones before, each judged on its own as one sheet always was (so a
 * sheet left open cannot swallow the next), and a sheet given again is the
 * sheet already there, so a view that styles on every push does not pile
 * them up. The page and the headless run draw the same sheets.
 */
const SHARED = ".gx { color: rgb(1, 2, 3) } .gx .box { border: 2px solid red }";
const OWN = ".pl .top { padding: 22px }";

/** The view's runtime over a stand-in for the port: the style messages it sent. */
function runtime() {
  const sent: { type: string; sheets?: readonly string[] }[] = [];
  const made = createViewRuntime({
    send: (request) => void sent.push(structuredClone(request) as never),
    act: () => Promise.resolve({ type: "answer", id: 0, ok: false, reason: "refused", message: "" }),
    navigate: () => {},
    microtask: (task) => queueMicrotask(task),
    now: () => 0,
    threw: () => {},
    warn: () => {},
    hardening: () => ({ removed: [], stuck: [], sealed: false }),
  });
  return { view: made.view, styles: () => sent.filter((one) => one.type === "style") };
}

const page = (sheets: readonly string[]) => {
  const dom = new JSDOM("<!doctype html><main></main>");
  const shadow = dom.window.document.querySelector("main")!.attachShadow({ mode: "open" });
  const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
  drawing.style(sheets);
  return { css: drawing.css, drawn: shadow.querySelector("[data-graview-view-style]")!.textContent as string, refused: drawing.refused };
};

describe("a view's stylesheets", () => {
  it("are every sheet the view gave, in order, each said to the host as the whole list", () => {
    const { view, styles } = runtime();
    view.style(SHARED);
    view.style(OWN);
    expect(styles().at(-1)?.sheets).toEqual([SHARED, OWN]);
  });

  it("keep a sheet given again where it was, without sending it twice", () => {
    const { view, styles } = runtime();
    view.style(SHARED);
    view.style(OWN);
    view.style(SHARED);
    view.style(OWN);
    expect(styles()).toHaveLength(2);
    expect(styles().at(-1)?.sheets).toEqual([SHARED, OWN]);
  });

  it("are drawn on the page with the first sheet's rules ahead of the second's", () => {
    const drawn = page([SHARED, OWN]);
    expect(drawn.drawn).toBe(drawn.css);
    expect(drawn.css).toContain(".gx { color: rgb(1, 2, 3); }");
    expect(drawn.css).toContain(".pl .top { padding: 22px; }");
    expect(drawn.css.indexOf(".gx {")).toBeLessThan(drawn.css.indexOf(".pl .top"));
  });

  it("are each judged on their own: a sheet left open does not swallow the next", () => {
    const judged = sanitizeStylesheets([".a { color: red", ".b { color: blue }"]);
    expect(judged.css).toContain(".b { color: blue; }");
  });

  it("hold to one budget between them: a sheet past it is refused for its size, and the ones before it are drawn", () => {
    const big = `.c { width: 1px }${" ".repeat(OPEN_MAX_STYLESHEET)}`;
    const judged = sanitizeStylesheets([SHARED, big, OWN]);
    expect(judged.css).toContain(".gx {");
    expect(judged.css).not.toContain(".c {");
    expect(judged.refused).toContainEqual({ reason: "size" });
  });

  it("are drawn the same by a headless run as by the page", async () => {
    const store = new Store<AnySchema>({ schema: offersApp.schema as AnySchema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
    const result = await runWorkerViewHeadless({
      store,
      principal: lin,
      run: nodeIsolate(),
      manifest: { name: "two-sheets", attach: "package", cardinality: "many" },
      source: `graview.style(${JSON.stringify(SHARED)}); graview.style(${JSON.stringify(OWN)}); graview.onProps(() => graview.render('<div class="gx">kept</div>'));`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.sheets).toEqual([SHARED, OWN]);
    expect(drawTranscript(result.transcript.renders, result.transcript.sheets, { maxNodes: 5_000 }).css).toBe(page([SHARED, OWN]).css);
  });
});
