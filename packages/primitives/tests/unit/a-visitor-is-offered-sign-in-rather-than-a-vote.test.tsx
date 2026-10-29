// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Policy, type Principal, type SignIn, type VotesOptions } from "@graview/core";
import { suggest, suggestions, voteSuggestion } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";
import { advisoryWords, awayWords, tallyWords } from "../../src/suggested.js";

/**
 * A VISITOR IS OFFERED SIGN IN RATHER THAN A VOTE (Roadmap
 * f-votes-shared-seat). The store refuses a vote from a shared or
 * signed-out seat, so the tray does not offer one: such a seat sees the
 * host's "Sign in to vote" in place of Accept and Decline, before it
 * presses, and no vote at all where the host gave no way in. Where the host
 * keeps visitors' votes advisory, the visitor votes as a reader does, and
 * whoever may decide reads them apart: "1 for, 0 against · 2 visitors agree".
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
/** The keeper keeps the list; a reader reads it, and may run nothing. */
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };

function storeWith(votes?: VotesOptions) {
  const store = new Store({
    schema,
    mutations: [waitFor],
    policy,
    ...(votes ? { votes } : {}),
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

async function scene(store: Store<typeof schema>, principal: Principal, signIn?: SignIn) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  await act(async () => root.render(
    <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={principal} {...(signIn ? { signIn } : {})}>
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

const anonymous: Principal = { kind: "human", id: "anonymous", roles: ["reader"], shared: true };

describe("a visitor at the Suggested tray", () => {
  it("is offered Sign in to vote rather than a vote, and pressing it asks the host", async () => {
    const store = storeWith();
    const run = vi.fn();
    await scene(store, anonymous, { label: "Sign in to make changes", run });
    await open();
    expect($('[data-testid="suggestion-accept"]')).toBeNull();
    expect($('[data-testid="suggestion-decline"]')).toBeNull();
    const signIn = $('[data-testid="suggestion-sign-in"]')!;
    expect(signIn.tagName).toBe("BUTTON");
    expect(signIn.textContent).toBe("Sign in to vote");
    await act(async () => signIn.click());
    expect(run).toHaveBeenCalledTimes(1);
    expect(store.log.all().some((op) => op.vote !== undefined)).toBe(false);
    // Not now is still theirs.
    expect($('[data-testid="suggestion-not-now"]')).not.toBeNull();
  });

  it("is offered no vote at all where the host gave no way in", async () => {
    await scene(storeWith(), anonymous);
    await open();
    expect($('[data-testid="suggestion-accept"]')).toBeNull();
    expect($('[data-testid="suggestion-sign-in"]')).toBeNull();
    expect($('[data-testid="suggestion-not-now"]')).not.toBeNull();
  });

  it("votes as a reader does where the host keeps visitors' votes advisory, and a keeper reads them apart", async () => {
    const store = storeWith({ advisory: "visitors" });
    const id = suggestions(store)[0]!.id;
    voteSuggestion(store, id, "for", { author: { ...anonymous, visitorKey: "b" } });
    voteSuggestion(store, id, "for", { author: ria });
    await scene(store, { ...anonymous, visitorKey: "a" }, { label: "Sign in", run: () => {} });
    await open();
    expect($('[data-testid="suggestion-sign-in"]')).toBeNull();
    await act(async () => $('[data-testid="suggestion-accept"]')!.click());
    await settled(() => expect($('[data-testid="suggestion-voted"]')?.textContent).toBe("Your vote was recorded."));
    expect(suggestions(store, nora)[0]!.tally).toEqual({ for: 1, against: 0, advisory: { for: 2, against: 0 } });
    await unmount?.();
    unmount = undefined;
    document.body.innerHTML = "";
    await scene(store, nora);
    await open();
    expect($('[data-testid="suggestion-tally"]')?.textContent).toBe("1 for, 0 against · 2 visitors agree");
  });
});

describe("the words", () => {
  it("say visitors' votes apart from people's", () => {
    expect(tallyWords({ for: 4, against: 1 })).toBe("4 for, 1 against");
    expect(tallyWords({ for: 0, against: 0, advisory: { for: 1, against: 0 } })).toBe("0 for, 0 against · a visitor agrees");
    expect(advisoryWords({ for: 3, against: 1 })).toBe("3 visitors agree, one disagrees");
    expect(advisoryWords({ for: 0, against: 2 })).toBe("2 visitors disagree");
  });

  it("say how many readers agree with one that waits, while away", () => {
    expect(awayWords(2, 12, 3)).toBe("2 suggestions waiting · 3 readers agree with one that waits · tidied 12 things while you were away");
    expect(awayWords(1, 0, 1)).toBe("One suggestion waiting · a reader agrees with one that waits");
    expect(awayWords(1, 0)).toBe("One suggestion waiting");
  });
});
