// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Principal } from "@graview/core";
import { suggest } from "@graview/core/tidying";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { createViews, GoToContext, GraviewProvider, type GoTo } from "@graview/react";
import axe from "axe-core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, registerDefaultViews, Shell } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * A SUGGESTION'S CHIP OPENS ITS RECORD (FR-225, Roadmap
 * f-suggestion-chips-open-their-record). The Suggested tray named each
 * record a suggestion was about as a chip with a pick target that only the
 * scene's own pointer handler answered: it looked pressable and did nothing,
 * on either face and from the keyboard. Each is now the same button a
 * record is in Activity: on the scene it focuses and chooses the record and
 * the tray closes; on a face that says where going to a record goes
 * (`GoToContext`, as the routed face does) it goes there; a record since
 * removed is a plain label. Its accessible name is the record's name.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node) => node.label, edges: { "waits-for": { to: ["task"], description: "what has to happen first" } } });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const waitFor = defineMutation("wait-for", {
  title: "This has to happen first",
  subject: { kinds: ["task"], arg: "taskId" },
  connects: ["waits-for"],
  input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }),
  describe: (args, graph) => `“${(graph.getNode(args.taskId) as { label: string }).label}” waits for “${(graph.getNode(args.blockerId) as { label: string }).label}”`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
  },
});
const remove = defineMutation("remove", {
  title: "Remove",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  describe: () => "Remove it",
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

function storeWithASuggestion() {
  const store = new Store({
    schema,
    mutations: [waitFor, remove],
    snapshot: { nodes: [{ id: "keys", kind: "task", label: "Find the keys" }, { id: "piano", kind: "task", label: "Move the piano" }] as never, edges: [] },
  });
  suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "The keys are in the piano", confidence: 0.5 } });
  return store;
}

async function drawn(store: Store<typeof schema>, options: { readonly onViewChange?: (view: ViewState) => void; readonly goTo?: GoTo } = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const shell = <Shell<typeof schema> scheme="light" onScheme={() => {}} />;
  const inside: ReactNode = options.goTo ? <GoToContext.Provider value={options.goTo}>{shell}</GoToContext.Provider> : shell;
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={nora} {...(options.onViewChange ? { onViewChange: options.onViewChange } : {})}>
        {inside}
      </GraviewProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  await settled(() => expect(document.querySelector('[data-testid="suggested-button"]')).not.toBeNull());
  await act(async () => document.querySelector<HTMLElement>('[data-testid="suggested-button"]')!.click());
  await settled(() => expect(document.querySelector('[data-testid="suggested"] [data-testid="suggestion-record"]')).not.toBeNull());
  return host;
}

const chips = () => [...document.querySelectorAll<HTMLButtonElement>('[data-testid="suggested"] [data-testid="suggestion-record"]')];

describe("a record chip in the Suggested tray", () => {
  it("is a button named for the record, with nothing in the tray that only the scene's pointer answers", async () => {
    const host = await drawn(storeWithASuggestion());
    const tray = document.querySelector('[data-testid="suggested"]')!;
    expect(tray.querySelector("[data-graview-pick]")).toBeNull();
    expect(chips().map((chip) => [chip.tagName, chip.textContent, chip.title, chip.getAttribute("data-record")])).toEqual([
      ["BUTTON", "Find the keys", "Go to Find the keys", "keys"],
      ["BUTTON", "Move the piano", "Go to Move the piano", "piano"],
    ]);
    // Reachable from the keyboard: a button, not a span with a pointer.
    for (const chip of chips()) expect(chip.tabIndex).toBe(0);
    const said = await axe.run(host, { rules: { "color-contrast": { enabled: false } } });
    expect(said.violations.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  it("on the scene, focuses and chooses the record and closes the tray", async () => {
    const views: ViewState[] = [];
    await drawn(storeWithASuggestion(), { onViewChange: (view) => views.push(view) });
    await act(async () => chips().find((chip) => chip.getAttribute("data-record") === "piano")!.click());
    await settled(() => expect(document.querySelector('[data-testid="suggested"]')).toBeNull());
    // Two writes in one gesture — the focus, then the choice — each said to the observer against the view before the gesture.
    expect(views.some((view) => view.focusId === "piano" && !view.overview)).toBe(true);
    expect(views.some((view) => view.selection?.length === 1 && view.selection[0] === "piano")).toBe(true);
  });

  it("on a face that says where a record opens, goes there and closes the tray", async () => {
    const went: string[] = [];
    const goTo: GoTo = { record: (id) => went.push(id), place: () => {}, list: () => {} };
    await drawn(storeWithASuggestion(), { goTo });
    await act(async () => chips().find((chip) => chip.getAttribute("data-record") === "keys")!.click());
    await settled(() => expect(document.querySelector('[data-testid="suggested"]')).toBeNull());
    expect(went).toEqual(["keys"]);
  });
});
