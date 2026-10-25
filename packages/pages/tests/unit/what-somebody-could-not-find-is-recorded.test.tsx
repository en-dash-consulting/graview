// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { attachFriction, bindSchema, createSchema, defineNode, Store, type FrictionDraft, type Principal } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DerivedForm, PagesApp } from "../../src/index.js";

/**
 * WHAT SOMEBODY COULD NOT FIND, OR DO, IS RECORDED (Roadmap f-friction-log):
 * words that found nothing on `/search`, once they settle — the box writes
 * the address at every keystroke, and "inv" on the way to "invoice" is no
 * miss — and an act a form pressed and was refused, with its code. Through
 * the one door, `recordFriction`: a store nobody attached a sink to
 * records nothing, and a visitor is never recorded.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const app = { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: ["finish"] }] };
const fresh = () => new Store({ schema, mutations: [finish], policy: app, snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the van", done: false }] as never, edges: [] } });
const ada: Principal = { kind: "human", id: "ada", roles: [] };

let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  vi.useRealTimers();
  host.remove();
});

async function searched(store: Store<typeof schema>, path: string, principal: Principal) {
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, principal }} initialPath={path} />));
  await act(async () => void vi.advanceTimersByTime(2000));
  await act(async () => root.unmount());
}

describe("the friction a page records", () => {
  it("records words that found nothing once they settle, and nothing for words that found something", async () => {
    const store = fresh();
    const heard: [FrictionDraft, Principal | undefined][] = [];
    attachFriction(store, (draft, by) => heard.push([draft, by as Principal | undefined]));
    await searched(store, "/search?q=invoice", ada);
    await searched(store, "/search?q=van", ada);
    // The only kind the words were looked for in is said with them.
    expect(heard).toEqual([[{ type: "search-miss", words: "invoice", kind: "task" }, ada]]);
  });

  it("a visitor's search is never recorded", async () => {
    const store = fresh();
    const heard: FrictionDraft[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    await searched(store, "/search?q=parking", { kind: "visitor", id: "visitor:rsvp:1" });
    expect(heard).toEqual([]);
  });

  it("records an act a form pressed and was refused, with its code and the kind it was on", async () => {
    const store = fresh();
    const heard: FrictionDraft[] = [];
    attachFriction(store, (draft) => heard.push(draft));
    const root = createRoot(host);
    await act(async () => root.render(<DerivedForm store={store} mutation={finish} prefilled={{ id: "t1" }} principal={ada} />));
    await act(async () => host.querySelector("form")!.requestSubmit());
    expect(host.querySelector('[data-testid="refused"]')?.textContent).not.toBe("");
    expect(heard).toEqual([{ type: "refused", act: "finish", code: "forbidden", kind: "task" }]);
    await act(async () => root.unmount());
  });
});
