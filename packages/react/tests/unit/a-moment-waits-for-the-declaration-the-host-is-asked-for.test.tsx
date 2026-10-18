// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, z, type AnySchema, type PastDeclaration } from "@graview/core";
import type { HistoryHost } from "@graview/core/history";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOwnPlayback, type Playback } from "../../src/past.js";

/**
 * A MOMENT WAITS FOR THE DECLARATION THE HOST IS ASKED FOR (Roadmap
 * f-declaration-at-lazy). A host that keeps 27 versions of an app's
 * declaration hands only their sentences, and `history.declarationAt(seq)`
 * to fetch one: playback asks for it when it reaches a moment under that
 * mark, holds the picture it had until the answer comes rather than flash
 * a wrong one, and draws the moment under it. A slow answer is drawn under
 * today's in the meantime; a failed one stays today's.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const note = defineNode("note", { fields: z.object({ body: z.string() }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  description: "Add one.",
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label } as never);
  },
});
const me = { kind: "human", id: "nick" } as const;

function built() {
  const store = new Store({ schema, mutations: [add], snapshot: { nodes: [], edges: [] } });
  for (let n = 0; n < 6; n++) store.apply({ name: "add", args: { id: `t${n}`, label: `Task ${n}` } }, { author: me });
  return store as unknown as Store<AnySchema>;
}

let playback: Playback | undefined;
function Face({ store, host }: { store: Store<AnySchema>; host: HistoryHost }) {
  playback = useOwnPlayback(store, me, host);
  const past = playback.past;
  return <output>{past ? `${past.seq}:${past.store.schema.kinds.join(",")}` : "now"}</output>;
}

describe("a moment under a mark the host handed without its declaration", () => {
  let element: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    element = document.createElement("div");
    document.body.append(element);
    root = createRoot(element);
  });
  afterEach(() => {
    act(() => root.unmount());
    element.remove();
    vi.useRealTimers();
  });
  const settle = () =>
    act(async () => {
      for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const shown = () => element.querySelector("output")?.textContent;

  it("asks the host by the mark's seq, holds the picture it had, and is drawn under the answer", async () => {
    const store = built();
    const asked: number[] = [];
    let answer!: (declaration: PastDeclaration) => void;
    const host: HistoryHost = {
      declarations: [{ seq: 4, sentence: "Added a Note kind" }],
      declarationAt: (seq) => (asked.push(seq), new Promise<PastDeclaration>((resolve) => (answer = resolve))),
    };
    await act(async () => root.render(<Face store={store} host={host} />));
    expect(asked).toEqual([]);
    await act(async () => playback!.show(2));
    await settle();
    expect(shown()).toBe("2:task");
    expect(asked).toEqual([]);
    await act(async () => playback!.show(5));
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    // Held, not drawn under today's declaration while the answer is on its way.
    expect(shown()).toBe("2:task");
    expect(asked).toEqual([4]);
    await act(async () => answer({ schema: createSchema([task, note]) as AnySchema }));
    await settle();
    expect(shown()).toBe("5:task,note");
    // Asked once per mark: another moment under it is drawn at once.
    await act(async () => playback!.show(4));
    expect(shown()).toBe("4:task,note");
    expect(asked).toEqual([4]);
  });

  it("is drawn under today's while a slow answer is coming, and stays today's when it fails", async () => {
    const store = built();
    let fail!: (error: Error) => void;
    const host: HistoryHost = {
      declarations: [{ seq: 1, sentence: "Changed the declaration" }],
      declarationAt: () => new Promise<PastDeclaration>((_, reject) => (fail = reject)),
    };
    await act(async () => root.render(<Face store={store} host={host} />));
    await act(async () => playback!.show(3));
    await settle();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(shown()).toBe("3:task");
    await act(async () => fail(new Error("offline")));
    await settle();
    expect(shown()).toBe("3:task");
  });
});
