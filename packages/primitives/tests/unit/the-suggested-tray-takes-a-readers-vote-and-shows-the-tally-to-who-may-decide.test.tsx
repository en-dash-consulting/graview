// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Policy, type Principal } from "@graview/core";
import { suggest, suggestions, voteSuggestion } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";
import { tallyWords } from "../../src/suggested.js";

/**
 * THE SUGGESTED TRAY TAKES A READER'S VOTE, AND SHOWS THE TALLY TO WHOEVER
 * MAY DECIDE (Roadmap f-suggestion-votes). A reader who may see a
 * suggestion and may not make its change presses Accept or Decline and is
 * not refused: the row says "Your vote was recorded" and stays, the
 * pressed button says which way they voted, pressing the other changes it,
 * and Withdraw vote takes it back. Nothing of the graph changes. A keeper,
 * who may make it, sees "1 for, 0 against" beside Accept, kept current as
 * votes land, and is offered no vote of their own.
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
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora", roles: ["keeper"] };
const ria: Principal = { kind: "human", id: "ria", name: "Ria", roles: ["reader"] };
const rob: Principal = { kind: "human", id: "rob", name: "Rob", roles: ["reader"] };
/** The keeper keeps the list; a reader reads it, and may run nothing. */
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };

function storeWith() {
  const store = new Store({
    schema,
    mutations: [waitFor],
    policy,
    snapshot: { nodes: ["piano", "keys"].map((id) => ({ id, kind: "task", label: id[0]!.toUpperCase() + id.slice(1) })) as never, edges: [] },
  });
  suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "One goes before the other", confidence: 0.4 } });
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

async function scene(store: Store<typeof schema>, principal: Principal) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  await act(async () => root.render(
    <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={principal}>
      <Shell<typeof schema> scheme="light" onScheme={() => {}} />
    </GraviewProvider>,
  ));
  unmount = () => act(async () => root.unmount());
  return element;
}
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const open = async () => {
  await settled(() => expect($('[data-graview-app-bar] [data-testid="suggested-button"]')).not.toBeNull());
  await act(async () => $('[data-testid="suggested-button"]')!.click());
  await settled(() => expect($('[data-testid="suggestion"]')).not.toBeNull());
};

describe("a reader at the Suggested tray", () => {
  it("votes with Accept and Decline, is told so, keeps the row, and may change or withdraw the vote", async () => {
    const store = storeWith();
    const id = suggestions(store)[0]!.id;
    await scene(store, ria);
    await open();
    const accept = $('[data-testid="suggestion-accept"]')!;
    const decline = $('[data-testid="suggestion-decline"]')!;
    // Said to a screen reader before it is pressed: this press is a vote.
    expect(document.getElementById(accept.getAttribute("aria-describedby")!)?.textContent).toBe("Counts as your vote; somebody who may make it decides.");
    expect(accept.getAttribute("aria-pressed")).toBe("false");
    expect($('[data-testid="suggestion-tally"]')).toBeNull();
    await act(async () => accept.click());
    await settled(() => expect($('[data-testid="suggestion-voted"]')?.textContent).toBe("Your vote was recorded."));
    expect($('[data-testid="suggestion"]')?.getAttribute("data-suggestion")).toBe(id);
    expect($('[data-testid="suggestion-refused"]')).toBeNull();
    expect(store.graph.allEdges()).toEqual([]);
    expect(suggestions(store, ria)[0]!.tally).toEqual({ for: 1, against: 0, mine: "for" });
    await settled(() => expect($('[data-testid="suggestion-accept"]')?.getAttribute("aria-pressed")).toBe("true"));
    expect($('[data-testid="suggestion-heard"]')?.textContent).toBe("Your vote was recorded.");
    // The other way: one standing vote, changed.
    await act(async () => decline.click());
    await settled(() => expect($('[data-testid="suggestion-decline"]')?.getAttribute("aria-pressed")).toBe("true"));
    expect($('[data-testid="suggestion-accept"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(suggestions(store, ria)[0]!.tally).toEqual({ for: 0, against: 1, mine: "against" });
    // And taken back.
    const withdraw = $('[data-testid="suggestion-withdraw-vote"]')!;
    expect(withdraw.textContent).toBe("Withdraw vote");
    await act(async () => withdraw.click());
    await settled(() => expect($('[data-testid="suggestion-voted"]')?.textContent).toBe("Your vote was withdrawn."));
    await settled(() => expect($('[data-testid="suggestion-withdraw-vote"]')).toBeNull());
    expect(suggestions(store, ria)[0]!.tally).toEqual({ for: 0, against: 0 });
    // Still waiting, for everyone.
    expect(suggestions(store, nora)).toHaveLength(1);
  });
});

describe("a keeper at the Suggested tray", () => {
  it("sees the tally beside Accept, kept current as votes land, and is offered no vote", async () => {
    const store = storeWith();
    const id = suggestions(store)[0]!.id;
    voteSuggestion(store, id, "for", { author: ria });
    await scene(store, nora);
    await open();
    expect($('[data-testid="suggestion-tally"]')?.textContent).toBe("1 for, 0 against");
    expect($('[data-testid="suggestion-accept"]')?.hasAttribute("aria-pressed")).toBe(false);
    expect($('[data-testid="suggestion-withdraw-vote"]')).toBeNull();
    // Rob's vote lands from elsewhere: the tally follows, though no record changed.
    await act(async () => void voteSuggestion(store, id, "against", { author: rob }));
    await settled(() => expect($('[data-testid="suggestion-tally"]')?.textContent).toBe("1 for, 1 against"));
    // Accept makes it, as ever.
    await act(async () => $('[data-testid="suggestion-accept"]')!.click());
    await settled(() => expect($('[data-testid="suggested-button"]')).toBeNull());
    expect(store.graph.allEdges()).toHaveLength(1);
  });

  it("is shown nothing where nobody voted", async () => {
    await scene(storeWith(), nora);
    await open();
    expect($('[data-testid="suggestion-tally"]')).toBeNull();
    expect(tallyWords({ for: 4, against: 1 })).toBe("4 for, 1 against");
  });
});
