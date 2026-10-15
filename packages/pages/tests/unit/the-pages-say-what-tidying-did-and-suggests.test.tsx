// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, isLeftAlone, nodeRef, Store, type Author, type Policy, type Principal } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * THE PAGES SAY WHAT TIDYING DID, AND WHAT IT SUGGESTS, as the scene does.
 * A test actor links two tasks it is sure of and suggests a third: the
 * routed face's bar draws Activity with the actor's run folded into one
 * digest row, and the Suggested tray beside it, where the third is
 * declined; a seat that may not see what a suggestion names is not shown
 * it; and a record's page sets and clears "leave this one alone", which
 * the actor is then refused.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string() }),
  plural: "Tasks",
  label: (node) => node.label,
  edges: { "waits-for": { to: ["task"], description: "what has to happen first", inverse: "what is waiting on this" } },
});
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes", label: (node) => node.label, edges: { about: { to: ["task"] } } });
const schema = createSchema([task, note]);
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
const pin = defineMutation("pin-note", {
  title: "Pin a note to a task",
  subject: { kinds: ["note"], arg: "id" },
  connects: ["about"],
  input: z.object({ id: nodeRef(["note"]), task: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "about", from: args.id, to: args.task });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora", roles: ["keeper"] };

function tidied(policy?: Policy) {
  const store = new Store({
    schema,
    mutations: [waitFor, pin],
    ...(policy ? { policy } : {}),
    snapshot: {
      nodes: [
        { id: "book", kind: "task", label: "Book the van" },
        { id: "quote", kind: "task", label: "Get a quote" },
        { id: "paint", kind: "task", label: "Paint the hall" },
        { id: "shelves", kind: "task", label: "Take the shelves down" },
        { id: "piano", kind: "task", label: "Move the piano" },
        { id: "keys", kind: "task", label: "Hand back the keys" },
        { id: "memo", kind: "note", label: "Ask Sam about the van" },
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
async function open(store: Store<typeof schema>, path: string, principal: Principal = nora) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, principal, views: createViews(schema) }} initialPath={path} />));
  unmount = () => act(async () => root.unmount());
  return host;
}
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);

describe("the routed face's bar, after the app's own actor tidied", () => {
  it("draws Activity with the actor's two links folded into one digest row, each with its lineage", async () => {
    await open(tidied(), "/tasks");
    await settled(() => expect($('[data-graview-app-bar] [data-testid="activity-button"]')).not.toBeNull());
    await act(async () => $('[data-testid="activity-button"]')!.click());
    await settled(() => expect($('[data-testid="activity-digest"]')).not.toBeNull());
    expect($('[data-testid="activity-digest"]')!.textContent).toContain("Graview, tidying Tidied 2 things today");
    await act(async () => $('[data-testid="digest-toggle"]')!.click());
    expect([...document.querySelectorAll('[data-testid="digest-change"] [data-graview-lineage]')].map((one) => one.textContent)).toEqual([" · based on “The shelves cover the wall” · 91% sure", " · based on “Booking needs the quote” · 94% sure"]);
  });

  it("draws the Suggested tray beside it, where the third waits and is declined, and is refused to the actor next time", async () => {
    const store = tidied();
    await open(store, "/tasks");
    await settled(() => expect($('[data-graview-app-bar] [data-testid="suggested-button"]')).not.toBeNull());
    await act(async () => $('[data-testid="suggested-button"]')!.click());
    expect($('[data-testid="suggestion"]')!.textContent).toContain("“Hand back the keys” waits for “Move the piano”");
    await act(async () => $('[data-testid="suggestion-decline"]')!.click());
    await settled(() => expect($('[data-testid="suggested-button"]')).toBeNull());
    expect(suggestions(store)).toEqual([]);
    expect(() => suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "Again" } })).toThrow(/declined/);
  });

  it("shows a seat only the suggestions about what it may see", async () => {
    const policy: Policy = {
      roles: ["keeper", "guest"],
      grants: [{ roles: "*", mutations: "*" }],
      sees: [
        { roles: ["keeper"], kinds: ["task", "note"] },
        { roles: ["guest"], kinds: ["task"] },
      ],
    };
    const store = tidied(policy);
    suggest(store, [{ name: "pin-note", args: { id: "memo", task: "book" } }], { author: actor, lineage: { basis: "The note names the van" } });
    await open(store, "/tasks", { kind: "human", id: "gus", roles: ["guest"] });
    await settled(() => expect($('[data-testid="suggested-button"]')).not.toBeNull());
    expect($('[data-testid="suggested-button"]')!.textContent).toContain("1");
    await act(async () => $('[data-testid="suggested-button"]')!.click());
    expect($('[data-testid="suggested"]')!.textContent).not.toContain("Ask Sam");
  });
});

describe("a record's page", () => {
  it("sets leave this one alone, says so at its head, refuses the actor, and clears it again", async () => {
    const store = tidied();
    await open(store, "/tasks/piano");
    const leave = () => [...document.querySelectorAll<HTMLButtonElement>("[data-testid='record-actions'] [data-affordance]")].find((button) => button.textContent === "Leave this one alone");
    await act(async () => $("[data-testid='record-actions-more']")?.click());
    expect(leave()).toBeDefined();
    await act(async () => leave()!.click());
    // The act asks nothing: its form is a single press.
    const go = [...document.querySelectorAll<HTMLButtonElement>("[data-testid='record-actions'] button")].find((button) => /^(Leave alone|Leave this one alone|Do it|Apply)/.test(button.textContent ?? "") && !button.hasAttribute("data-affordance"));
    await act(async () => go!.click());
    await settled(() => expect($("[data-testid='record-left-alone']")).not.toBeNull());
    expect(isLeftAlone(store, "piano")).toBe(true);
    expect($("[data-testid='record-left-alone']")!.textContent).toContain("Left alone.");
    expect(() => store.apply({ name: "wait-for", args: { taskId: "piano", blockerId: "keys" } }, { author: actor })).toThrow(/a person said to leave it alone/);
    await act(async () => $("[data-testid='allow-tidying']")!.click());
    expect(isLeftAlone(store, "piano")).toBe(false);
    expect($("[data-testid='record-left-alone']")).toBeNull();
  });
});
