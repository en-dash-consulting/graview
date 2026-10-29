// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Policy, type Principal } from "@graview/core";
import { propose, suggest, suggestions } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";

/**
 * THE SUGGESTED TRAY LISTS A PERSON'S PROPOSALS APART (Roadmap
 * f-proposals-for-review): under "Proposed", first, each "Proposed by Ria"
 * with the words she gave; the app's own suggestions under "Suggested by
 * the app". The keeper accepts one, made as herself with the proposal in
 * its lineage; its proposer is offered Withdraw rather than a vote.
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
/** The keeper keeps the list; a reader reads it, may run nothing, and may propose what waits for what. */
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["reader"], mutations: [], propose: ["wait-for"] }] };

function storeWith() {
  const store = new Store({
    schema,
    mutations: [waitFor],
    policy,
    snapshot: { nodes: ["piano", "keys"].map((id) => ({ id, kind: "task", label: id[0]!.toUpperCase() + id.slice(1) })) as never, edges: [] },
  });
  suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "One goes before the other", confidence: 0.4 } });
  propose(store, ria, [{ name: "wait-for", args: { taskId: "piano", blockerId: "keys" } }], "The piano is tuned once the keys are back");
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

describe("a person's proposal at the Suggested tray", () => {
  it("is listed apart from the app's own, said as proposed by its proposer, and accepted by the keeper as herself", async () => {
    const store = storeWith();
    await scene(store, nora);
    await open();
    await settled(() => expect($('[data-testid="proposals"]')).not.toBeNull());
    const proposals = $('[data-testid="proposals"]')!;
    expect(proposals.previousElementSibling?.textContent).toBe("Proposed");
    expect(proposals.querySelector('[data-testid="proposed-by"]')?.textContent).toBe("Proposed by Ria:");
    expect(proposals.textContent).toContain("The piano is tuned once the keys are back");
    expect($('[data-testid="suggestions"]')?.previousElementSibling?.textContent).toBe("Suggested by the app");
    expect($('[data-testid="suggestions"]')?.textContent).toContain("Graview, tidying");
    const id = suggestions(store).find((one) => one.lineage?.proposedBy === "ria")!.id;
    await act(async () => proposals.querySelector<HTMLElement>('[data-testid="suggestion-accept"]')!.click());
    await settled(() => expect(store.graph.allEdges()).toHaveLength(1));
    expect(store.log.all().at(-1)).toMatchObject({ author: nora, lineage: { suggestion: id, proposedBy: "ria" } });
  });

  it("offers its proposer Withdraw, not a vote, and takes it away when pressed", async () => {
    const store = storeWith();
    await scene(store, ria);
    await open();
    await settled(() => expect($('[data-testid="proposals"] [data-testid="proposal-withdraw"]')).not.toBeNull());
    const row = $('[data-testid="proposals"] [data-testid="suggestion"]')!;
    expect(row.querySelector('[data-testid="proposed-by"]')?.textContent).toBe("Proposed by you:");
    expect(row.querySelector('[data-testid="suggestion-accept"]')).toBeNull();
    expect(row.querySelector('[data-testid="suggestion-decline"]')).toBeNull();
    await act(async () => row.querySelector<HTMLElement>('[data-testid="proposal-withdraw"]')!.click());
    await settled(() => expect(suggestions(store).filter((one) => one.lineage?.proposedBy === "ria")).toEqual([]));
    expect(store.graph.allEdges()).toEqual([]);
  });
});
