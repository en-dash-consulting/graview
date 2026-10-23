// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Dismissal, type DismissalStore, type Principal } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type AwaySummary } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";
import { awayWords } from "../../src/suggested.js";

/**
 * "NOT NOW" IS ONE PERSON'S, AND THE TRAY SAYS WHAT WAS DONE WHILE THEY
 * WERE AWAY. Beside Accept and Decline, the Suggested tray offers Not now:
 * it puts a suggestion out of this person's sight until tomorrow, kept in
 * the host's store of their own state (else this browser's), and the log —
 * what everyone reads and the app's own actor is held to — says nothing of
 * it, so it still waits for everyone else. Given what the actor did while
 * the person was away, the tray says "One suggestion waiting · tidied 12
 * things while you were away", and nothing when there is nothing to say.
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
const nora: Principal = { kind: "human", id: "nora", name: "Nora" };
const sam: Principal = { kind: "human", id: "sam", name: "Sam" };

function storeWith(waiting: number) {
  const store = new Store({
    schema,
    mutations: [waitFor],
    snapshot: { nodes: ["piano", "keys", "van", "quote"].map((id) => ({ id, kind: "task", label: id[0]!.toUpperCase() + id.slice(1) })) as never, edges: [] },
  });
  const pairs = [
    ["keys", "piano"],
    ["van", "quote"],
  ].slice(0, waiting);
  for (const [taskId, blockerId] of pairs) suggest(store, [{ name: "wait-for", args: { taskId, blockerId } }], { author: actor, lineage: { basis: "One goes before the other", confidence: 0.4 } });
  return store;
}

/** A host's store of one person's "not now", as a host would keep it beside their subscriptions. */
function hostDismissals(initial: Dismissal[] = []): DismissalStore & { held: Dismissal[] } {
  const listeners = new Set<() => void>();
  const kept = {
    held: initial,
    list: () => kept.held,
    dismiss(one: Dismissal) {
      kept.held = [...kept.held.filter((each) => each.suggestion !== one.suggestion), one];
      for (const listener of listeners) listener();
    },
    onChange(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return kept;
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

async function scene(store: Store<typeof schema>, host: { readonly principal?: Principal; readonly dismissals?: DismissalStore; readonly whileAway?: AwaySummary } = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  await act(async () =>
    root.render(
      <GraviewProvider
        store={store}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, overview: true }}
        principal={host.principal ?? nora}
        {...(host.dismissals ? { dismissals: host.dismissals } : {})}
        {...(host.whileAway ? { whileAway: host.whileAway } : {})}
      >
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return element;
}
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const open = async () => {
  await settled(() => expect($('[data-graview-app-bar] [data-testid="suggested-button"]')).not.toBeNull());
  await act(async () => $('[data-testid="suggested-button"]')!.click());
};

describe("Not now, in the Suggested tray", () => {
  it("puts the suggestion out of this person's sight until tomorrow, in the host's store, while the log says nothing and it still waits for everyone else", async () => {
    const store = storeWith(1);
    const kept = hostDismissals();
    await scene(store, { dismissals: kept });
    await open();
    const row = $('[data-testid="suggestion"]')!;
    const button = row.querySelector<HTMLButtonElement>('[data-testid="suggestion-not-now"]')!;
    expect(button.textContent).toBe("Not now");
    // What it does is said to a screen reader, not only on hover.
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe("Hides it from you until tomorrow; it still waits for everyone else.");
    const ops = store.log.length;
    const before = Date.now();
    await act(async () => button.click());
    await settled(() => expect($('[data-testid="suggested-button"]')).toBeNull());
    expect(store.log.length).toBe(ops);
    expect(kept.held).toHaveLength(1);
    expect(kept.held[0]!.suggestion).toBe(suggestions(store)[0]!.id);
    const until = Date.parse(kept.held[0]!.until!);
    expect(until - before).toBeGreaterThanOrEqual(86_400_000 - 1000);
    expect(until - before).toBeLessThanOrEqual(86_400_000 + 5000);
    // Still waiting, for Sam and for the app's own actor alike: Not now is no decline.
    expect(suggestions(store, sam)).toHaveLength(1);
    expect(suggestions(store, nora, { dismissed: kept.held })).toHaveLength(0);
    // Nothing made yet, so no Activity: the keyboard went to the bar with the tray, never to <body>.
    expect(document.activeElement?.closest("[data-graview-app-bar]")).not.toBeNull();
  });

  it("shows it again once the time the person said has passed", async () => {
    const store = storeWith(1);
    const id = suggestions(store)[0]!.id;
    await scene(store, { dismissals: hostDismissals([{ suggestion: id, at: "2026-10-01T09:00:00Z", until: "2026-10-02T09:00:00Z" }]) });
    await open();
    expect($('[data-testid="suggestion"]')?.getAttribute("data-suggestion")).toBe(id);
  });

  it("is kept in this browser when the host keeps nowhere, so the tray drawn again still leaves it out", async () => {
    const store = storeWith(2);
    const keeper: Principal = { kind: "human", id: "nora-in-this-browser", name: "Nora" };
    await scene(store, { principal: keeper });
    await open();
    const [first, second] = suggestions(store);
    await act(async () => $(`[data-suggestion="${first!.id}"] [data-testid="suggestion-not-now"]`)!.click());
    await settled(() => expect($(`[data-suggestion="${first!.id}"]`)).toBeNull());
    // Two waited: the keyboard stays in the tray, on the next one.
    await settled(() => expect(document.activeElement?.closest("[data-suggestion]")?.getAttribute("data-suggestion")).toBe(second!.id));
    expect($('[data-testid="suggestion-heard"]')?.textContent).toBe("Hidden from you until tomorrow.");
    const said = JSON.parse(localStorage.getItem("graview:not-now:app:nora-in-this-browser") ?? "[]") as Dismissal[];
    expect(said.map((one) => one.suggestion)).toEqual([first!.id]);
    await unmount!();
    document.body.innerHTML = "";
    await scene(store, { principal: keeper });
    await open();
    expect([...document.querySelectorAll('[data-testid="suggestion"]')].map((row) => row.getAttribute("data-suggestion"))).toEqual([second!.id]);
    expect($('[data-testid="suggested-button"]')!.textContent).toContain("1");
  });
});

describe("what was done while the person was away", () => {
  it("is said in a line on the tray, beside what waits", async () => {
    await scene(storeWith(1), { whileAway: { tidied: 12, waiting: 1 } });
    await settled(() => expect($('[data-testid="suggested-button"]')).not.toBeNull());
    expect($('[data-testid="suggested-button"]')!.getAttribute("aria-label")).toBe("Suggested: One suggestion waiting · tidied 12 things while you were away");
    await act(async () => $('[data-testid="suggested-button"]')!.click());
    expect($('[data-testid="while-away"]')?.textContent).toBe("One suggestion waiting · tidied 12 things while you were away.");
  });

  it("is drawn though nothing waits, when the actor did something, and not at all when it did nothing", async () => {
    await scene(storeWith(0), { whileAway: { tidied: 3, waiting: 0 } });
    await settled(() => expect($('[data-testid="suggested-button"]')).not.toBeNull());
    expect($('[data-testid="suggested-button"]')!.textContent).toContain("Tidied 3");
    await act(async () => $('[data-testid="suggested-button"]')!.click());
    expect($('[data-testid="while-away"]')?.textContent).toBe("Tidied 3 things while you were away.");
    await unmount!();
    document.body.innerHTML = "";
    await scene(storeWith(0), { whileAway: { tidied: 0, waiting: 0 } });
    await settled(() => expect($("[data-graview-app-bar]")).not.toBeNull());
    expect($('[data-testid="suggested-button"]')).toBeNull();
  });

  it("counts what waits as this person sees it, and says one thing and many as a person would", () => {
    expect(awayWords(3, 12)).toBe("3 suggestions waiting · tidied 12 things while you were away");
    expect(awayWords(1, 1)).toBe("One suggestion waiting · tidied one thing while you were away");
    expect(awayWords(2, 0)).toBe("2 suggestions waiting");
    expect(awayWords(0, 0)).toBeUndefined();
  });
});
