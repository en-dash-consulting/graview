// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal, type Violation } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm, Repairs } from "../../src/index.js";

/**
 * A FORM SUBMITS AS THE PERSON WHO WAS ASKED "MAY I?".
 *
 * The routed face asks the derivation what this seat may do — and offered
 * every permitted act live — then applied it with NO author, so the store
 * judged the anonymous human, who under a policy may do nothing. Every
 * form and every one-press repair on the routed face refused on press the
 * moment an app declared a policy: "Not permitted: close-note on a note —
 * keeper can", said to the keeper. W-047 made the derivation ask as
 * somebody; the submit beside it still asked as nobody.
 */
const note = defineNode("note", {
  fields: z.object({ label: z.string(), done: z.boolean() }),
  plural: "Notes",
});
const schema = createSchema([note]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const close = defineMutation("close-note", {
  title: "Close it",
  description: "Mark a note done.",
  subject: { kinds: ["note"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["note"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const openNotes = defineInvariant("open-notes", {
  scope: { kind: "note" },
  repairs: ["close-note"],
  evaluate({ subject }): Violation[] {
    return subject.done ? [] : [{ invariant: "open-notes", subjectId: subject.id, label: subject.label, message: `${subject.label} is still open`, nodeIds: [subject.id], repairs: [{ mutation: "close-note", args: { id: subject.id }, label: "Close it" }] }];
  },
});
const keeper: Principal = { kind: "human", id: "nina", roles: ["keeper"] };
const guarded = () =>
  new Store({
    schema,
    mutations: [close],
    invariants: [openNotes],
    policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] } as never,
    snapshot: { nodes: [{ id: "n1", kind: "note", label: "One", done: false }] as never, edges: [] },
  });

async function mounted(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, unmount: () => act(async () => root.unmount()) };
}

describe("the routed face writes as the person at the keyboard", () => {
  it("a derived form applies as the principal it was given, and the log names them", async () => {
    const store = guarded();
    const { host, unmount } = await mounted(<DerivedForm store={store} mutation={close} prefilled={{ id: "n1" }} principal={keeper} />);
    await act(async () => {
      host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(host.querySelector('[data-testid="refused"]')?.textContent ?? "", "no refusal").toBe("");
    expect((store.graph.getNode("n1") as { done: boolean }).done).toBe(true);
    expect(store.log.all().at(-1)?.author).toMatchObject({ id: "nina" });
    await unmount();
  });

  it("a one-press repair applies as the principal too", async () => {
    const store = guarded();
    const repairs = store.violations()[0]!.repairs;
    const { host, unmount } = await mounted(<Repairs store={store} repairs={repairs} principal={keeper} />);
    await act(async () => {
      host.querySelector<HTMLButtonElement>("button[data-graview-repair]")!.click();
    });
    expect(host.querySelector('[data-testid="refused"]')?.textContent ?? "", "no refusal").toBe("");
    expect(store.violations()).toEqual([]);
    expect(store.log.all().at(-1)?.author).toMatchObject({ id: "nina" });
    await unmount();
  });
});
