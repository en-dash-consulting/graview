// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author } from "@graview/core";
import { declined, suggest } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, registerDefaultViews, Shell } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * THE SCENE SAYS WHAT TIDYING DID, AND WHAT IT SUGGESTS. A test actor —
 * the app's own, `automated` — links two tasks it is sure of and suggests
 * a third it is not. On the scene's bar, Activity folds its run into one
 * row, "Tidied 2 things today", which opens to each change with its
 * lineage and its own undo; beside it a quiet Suggested tray holds the
 * third, which a person accepts or declines there. A record a person said
 * to leave alone says so where its acts are.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string() }),
  plural: "Tasks",
  label: (node) => node.label,
  edges: { "waits-for": { to: ["task"], description: "what has to happen first", inverse: "what is waiting on this" } },
});
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
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora = { kind: "human" as const, id: "nora", name: "Nora" };

function tidied() {
  const store = new Store({
    schema,
    mutations: [waitFor],
    snapshot: {
      nodes: [
        { id: "book", kind: "task", label: "Book the van" },
        { id: "quote", kind: "task", label: "Get a quote" },
        { id: "paint", kind: "task", label: "Paint the hall" },
        { id: "shelves", kind: "task", label: "Take the shelves down" },
        { id: "piano", kind: "task", label: "Move the piano" },
        { id: "keys", kind: "task", label: "Hand back the keys" },
      ] as never,
      edges: [],
    },
  });
  store.apply({ name: "wait-for", args: { taskId: "book", blockerId: "quote" } }, { author: actor, lineage: { basis: "Booking needs the quote", confidence: 0.94 } });
  store.apply({ name: "wait-for", args: { taskId: "paint", blockerId: "shelves" } }, { author: actor, lineage: { basis: "The shelves cover the wall", confidence: 0.91 } });
  suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "The piano goes out before the keys go back", confidence: 0.42 } });
  return store;
}

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

async function scene(store: Store<typeof schema>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={nora}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return host;
}
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);

describe("the scene's bar, after the app's own actor tidied", () => {
  it("folds the actor's two links into one digest row that opens to each with its lineage and its own undo", async () => {
    const host = await scene(tidied());
    await settled(() => expect(host.querySelector('[data-testid="activity-button"]')).not.toBeNull());
    await act(async () => $('[data-testid="activity-button"]')!.click());
    const digest = $('[data-testid="activity-digest"]')!;
    expect(digest.textContent).toContain("Graview, tidying");
    expect(digest.textContent).toContain("Tidied 2 things today");
    // The suggestion is the tray's, not a row here.
    expect($('[data-testid="diff-log"]')!.textContent).not.toContain("Hand back the keys");
    await act(async () => digest.querySelector<HTMLButtonElement>('[data-testid="digest-toggle"]')!.click());
    const each = [...document.querySelectorAll('[data-testid="digest-change"]')];
    expect(each.map((row) => row.querySelector("[data-graview-lineage]")?.textContent)).toEqual([" · based on “The shelves cover the wall” · 91% sure", " · based on “Booking needs the quote” · 94% sure"]);
    expect(each.every((row) => row.querySelector('[data-testid="undo-turn"]') !== null)).toBe(true);
  });

  it("holds the third in a quiet Suggested tray beside Activity, which a person declines there, and the actor is refused it next time", async () => {
    const store = tidied();
    const host = await scene(store);
    await settled(() => expect(host.querySelector('[data-graview-app-bar] [data-testid="suggested-button"]')).not.toBeNull());
    expect($('[data-testid="suggested-button"]')!.textContent).toContain("1");
    await act(async () => $('[data-testid="suggested-button"]')!.click());
    const row = $('[data-testid="suggestion"]')!;
    expect(row.textContent).toContain("Graview, tidying suggests “Hand back the keys” waits for “Move the piano”");
    expect(row.textContent).toContain("based on “The piano goes out before the keys go back” · 42% sure");
    expect(store.graph.allEdges()).toHaveLength(2);
    await act(async () => row.querySelector<HTMLButtonElement>('[data-testid="suggestion-decline"]')!.click());
    await settled(() => expect($('[data-testid="suggested-button"]')).toBeNull());
    expect(store.graph.allEdges()).toHaveLength(2);
    expect(declined(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }])?.author).toMatchObject(nora);
    expect(() => suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "Again" } })).toThrow(/declined/);
    // The keyboard went to Activity with the tray, never to <body>.
    expect(document.activeElement?.getAttribute("data-testid")).toBe("activity-button");
  });

  it("accepts a suggestion as the person, carrying its lineage", async () => {
    const store = tidied();
    await scene(store);
    await settled(() => expect($('[data-testid="suggested-button"]')).not.toBeNull());
    await act(async () => $('[data-testid="suggested-button"]')!.click());
    await act(async () => $('[data-testid="suggestion-accept"]')!.click());
    const made = store.log.all().at(-1)!;
    expect(made.author).toMatchObject(nora);
    expect(made.lineage?.basis).toBe("The piano goes out before the keys go back");
    expect(store.graph.allEdges()).toHaveLength(3);
    await settled(() => expect($('[data-testid="suggested-button"]')).toBeNull());
  });
});

describe("the scene's record card", () => {
  it("offers Leave this one alone, and says a record left alone is so where its acts are", async () => {
    const store = tidied();
    const draw = async (selected: string) => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () =>
        root.render(
          <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: selected }} initialSelection={[selected]} principal={nora}>
            <Inspector />
          </GraviewProvider>,
        ),
      );
      return { host, close: () => act(async () => root.unmount()) };
    };
    const before = await draw("piano");
    expect(before.host.textContent).toContain("Leave this one alone");
    expect(before.host.querySelector('[data-testid="left-alone"]')).toBeNull();
    await before.close();
    store.apply({ name: "leave-alone-task", args: { id: "piano" } }, { author: nora });
    const after = await draw("piano");
    expect(after.host.querySelector('[data-testid="left-alone"]')?.textContent).toBe("Left alone: nothing automated changes it.");
    expect(after.host.textContent).toContain("Allow tidying again");
    expect(after.host.textContent).not.toContain("Leave this one alone");
    await after.close();
    expect(() => store.apply({ name: "wait-for", args: { taskId: "piano", blockerId: "keys" } }, { author: actor })).toThrow("Graview, tidying may not change “Move the piano”: a person said to leave it alone.");
  });
});
