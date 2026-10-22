import "@remote-dom/core/polyfill";
import { Store, type AnySchema } from "@graview/core";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { drawTranscript, runWorkerViewHeadless } from "../../src/headless/index.js";
import { sayRefusal } from "../../src/headless/judge.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { TreeElement, type TreeNode } from "../../src/headless/tree.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createViewRuntime } from "../../src/worker/view-global.js";

/*
 * A VIEW'S ACCESSIBLE CONTROLS ARE DRAWN ALIKE, HEADLESS AND ON THE PAGE
 * (Threat Watch, 2026-10-21). Graview Cloud filed that a view's
 * `<span class="box" role="checkbox" aria-checked="true">` ran headless
 * ("It runs") and was replaced on the page by the kind's own list, until
 * `aria-checked` was taken out. The open kit takes every `aria-*` state and
 * property and every role but the app's chrome's and notices', so a view
 * may build the controls a person reaches by keyboard and assistive
 * technology: a checkbox, a switch, a pressed toggle, a disclosure that
 * says what it controls, tabs and their panels, a slider and its value.
 *
 * The headless run and the page draw through one renderer and one judge
 * (host/open-render.ts, host/open-judge.ts), the page into a document and
 * the run into a tree of plain objects. Held here, for the same records
 * from the view's own runtime: what each keeps is the same element for
 * element and attribute for attribute, and what each refuses is the same
 * refusal, which the run says as a problem — so a run fails where the
 * page would leave something out, and nowhere else.
 */
const CONTROLS = `
<div class="gx" role="group" aria-label="Steps">
  <div class="it done" data-key="step:1"><span class="box" role="checkbox" aria-checked="true" tabindex="0" data-ck="step:1">✓</span><span class="stp">Rotate keys</span></div>
  <div class="it" data-key="step:2"><span class="box" role="checkbox" aria-checked="false" tabindex="0" data-ck="step:2"></span><span class="stp">Pin versions</span></div>
  <div class="it" data-key="step:3"><span class="box" role="checkbox" aria-checked="mixed" tabindex="0" aria-describedby="step-3-why">-</span><span id="step-3-why">Half done</span></div>
  <span class="sw on" role="switch" aria-checked="true" tabindex="0" aria-label="Only live threats"></span>
  <span class="tog" role="button" aria-pressed="true" tabindex="0">Bold</span>
  <span class="more" role="button" aria-expanded="false" aria-controls="more-steps" tabindex="0">Show all</span>
  <div id="more-steps" hidden>More</div>
  <div role="tablist" aria-label="Audience" aria-orientation="horizontal">
    <span role="tab" id="tab-dev" aria-selected="true" aria-controls="panel-dev" tabindex="0">Developers</span>
    <span role="tab" id="tab-ops" aria-selected="false" aria-controls="panel-ops" tabindex="-1">IT and ops</span>
  </div>
  <div role="tabpanel" id="panel-dev" aria-labelledby="tab-dev">The developers' steps</div>
  <div role="radiogroup" aria-label="Urgency" aria-required="true"><span role="radio" aria-checked="true" tabindex="0">Now</span><span role="radio" aria-checked="false" tabindex="-1">Today</span></div>
  <span role="slider" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100" aria-valuetext="40 percent" aria-label="Done" tabindex="0"></span>
  <span role="progressbar" aria-valuenow="3" aria-valuemax="8" aria-label="Steps done"></span>
  <span role="link" aria-current="page" tabindex="0">This page</span>
  <div role="listbox" aria-multiselectable="true" aria-activedescendant="opt-a" tabindex="0"><span role="option" id="opt-a" aria-selected="true">A</span><span role="option" aria-selected="false" aria-disabled="true">B</span></div>
  <div role="tree"><span role="treeitem" aria-expanded="true" aria-level="1" aria-posinset="1" aria-setsize="2">Root</span></div>
  <span role="menuitemcheckbox" aria-checked="false" aria-haspopup="false" aria-keyshortcuts="Control+B" aria-roledescription="toggle">Wrap</span>
  <table role="grid" aria-rowcount="10"><tr><th aria-sort="ascending">Name</th></tr></table>
  <input type="text" aria-invalid="true" aria-errormessage="name-error" aria-label="Name"><span id="name-error">Say a name.</span>
  <span aria-busy="false" aria-atomic="true" aria-live="polite" aria-relevant="additions">Saved</span>
</div>`;
/* What a page leaves out of the same drawing: the app's own notices and chrome. */
const REFUSED = `<span role="alert">Now!</span><div role="status">st</div><span aria-live="assertive">loud</span><section aria-label="Named">n</section>`;

/** The records the view's own runtime sends for markup, as the host hears them. */
async function recordsOf(markup: string): Promise<unknown[][]> {
  const renders: unknown[][] = [];
  const made = createViewRuntime({
    send: (request) => void (request.type === "render" && renders.push(structuredClone(request.records) as unknown[])),
    act: () => Promise.resolve({ type: "answer", id: 0, ok: false, reason: "refused", message: "" }),
    navigate: () => {},
    microtask: (task) => queueMicrotask(task),
    now: () => 0,
    threw: (error) => {
      throw error;
    },
    warn: () => {},
    hardening: () => ({ removed: [], stuck: [], sealed: false }),
  });
  made.view.render(markup);
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  return renders;
}

/** Host-set attributes the page adds on its own (a button's type, a field's autocomplete): not the view's. */
const HOSTS = new Set(["autocomplete"]);
type Said = readonly [string, readonly (readonly [string, string])[]];

function pageDrawn(renders: readonly unknown[][]) {
  const dom = new JSDOM("<!doctype html><main></main>");
  const shadow = dom.window.document.querySelector("main")!.attachShadow({ mode: "open" });
  const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: () => {} });
  for (const batch of renders) drawing.apply(batch);
  const out: Said[] = [];
  for (const element of shadow.querySelector("[data-graview-view-root]")!.querySelectorAll("*") as Iterable<Element>) {
    out.push([element.localName, [...element.attributes].filter((one) => !HOSTS.has(one.name)).map((one) => [one.name, one.value] as const).sort(([a], [b]) => (a < b ? -1 : 1))]);
  }
  return { said: out, refused: drawing.refused };
}

function headlessDrawn(renders: readonly unknown[][]) {
  const drawn = drawTranscript(renders, undefined, { maxNodes: 5_000 });
  const out: Said[] = [];
  const walk = (node: TreeNode) => {
    for (const child of node.childNodes) {
      if (!(child instanceof TreeElement)) continue;
      out.push([child.localName, [...child.attributes].filter(([name]) => !HOSTS.has(name)).sort(([a], [b]) => (a < b ? -1 : 1))]);
      walk(child);
    }
  };
  walk(drawn.root);
  return { said: out, refused: drawn.refused };
}

describe("a view's accessible controls", () => {
  it("keep every ARIA state and property and every control's role on the page", async () => {
    const page = pageDrawn(await recordsOf(CONTROLS));
    expect(page.refused).toEqual([]);
    const all = new Map(page.said.flatMap(([, attributes]) => attributes));
    for (const name of ["aria-checked", "aria-pressed", "aria-expanded", "aria-controls", "aria-selected", "aria-current", "aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext", "aria-labelledby", "aria-describedby", "aria-activedescendant", "aria-orientation", "aria-required", "aria-disabled", "aria-level", "aria-posinset", "aria-setsize", "aria-haspopup", "aria-keyshortcuts", "aria-roledescription", "aria-multiselectable", "aria-sort", "aria-rowcount", "aria-invalid", "aria-errormessage", "aria-busy", "aria-atomic", "aria-live", "aria-relevant"]) {
      expect(all.has(name), name).toBe(true);
    }
    const roles = new Set(page.said.flatMap(([, attributes]) => attributes.filter(([name]) => name === "role").map(([, value]) => value)));
    for (const role of ["checkbox", "switch", "button", "tablist", "tab", "tabpanel", "radiogroup", "radio", "slider", "progressbar", "link", "listbox", "option", "tree", "treeitem", "menuitemcheckbox", "grid", "group"]) expect(roles.has(role), role).toBe(true);
    expect(page.said.find(([, attributes]) => attributes.some(([name, value]) => name === "data-ck" && value === "step:1"))?.[1]).toContainEqual(["aria-checked", "true"]);
  });

  it("are drawn by a headless run element for element and attribute for attribute as the page draws them", async () => {
    const renders = await recordsOf(CONTROLS + REFUSED);
    const page = pageDrawn(renders);
    const headless = headlessDrawn(renders);
    expect(headless.said).toEqual(page.said);
    expect(headless.refused).toEqual(page.refused);
  });

  it("are refused alike where the page refuses: the app's notices and chrome, each said to the author", async () => {
    const renders = await recordsOf(REFUSED);
    const page = pageDrawn(renders);
    expect(page.refused.map((one) => `${one.reason} ${"element" in one ? one.element : ""} ${one.name ?? ""}`)).toEqual(["value span role", "value div role", "value span aria-live", "attribute section aria-label"]);
    expect(headlessDrawn(renders).refused).toEqual(page.refused);
    expect(page.refused.map((one) => sayRefusal(one).says)).toEqual([
      "Not drawn: the value of role is not one the open kit takes.",
      "Not drawn: the value of role is not one the open kit takes.",
      "Not drawn: the value of aria-live is not one the open kit takes.",
      "Not drawn: <section> does not take aria-label.",
    ]);
  });

  it("run headless with no problem, and a checkbox's state toggled by a press is drawn again", async () => {
    const store = new Store<AnySchema>({ schema: offersApp.schema as AnySchema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
    const result = await runWorkerViewHeadless({
      store,
      principal: lin,
      run: nodeIsolate(),
      manifest: { name: "controls", attach: "package", cardinality: "many" },
      source: `graview.onProps(() => graview.render(${JSON.stringify(CONTROLS)}));`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.description.problems).toEqual([]);
    expect(headlessDrawn(result.transcript.renders).said).toEqual(pageDrawn(result.transcript.renders).said);
  });
});
