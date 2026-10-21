// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, z, type AnySchema, type LogArchive, type Operation } from "@graview/core";
import type { HistoryHost } from "@graview/core/history";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useOwnPlayback, type Playback } from "../../src/past.js";

/**
 * A MOMENT BEHIND THE HORIZON IS READ FROM THE HOST'S ARCHIVE (FR-196). A
 * compacted store holds only its tail; a host that keeps what the
 * compaction archived hands it back through `history.archived(from, to)`.
 * Playback asks for it when a moment behind the horizon is shown, holds
 * the picture it had while it is on its way (`archive` says which moment
 * is being read), and draws the moment folded from it; a refusal is said
 * (`archive.refused`) and the present is untouched.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
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

function compacted(): { store: Store<AnySchema>; archive: LogArchive } {
  const store = new Store({ schema, mutations: [add], snapshot: { nodes: [], edges: [] } });
  for (let n = 0; n < 20; n++) store.apply({ name: "add", args: { id: `t${n}`, label: `Task ${n}` } }, { author: me });
  const archive = store.compact(store.checkpoint({ seq: 10 })!);
  return { store: store as unknown as Store<AnySchema>, archive };
}

let playback: Playback | undefined;
function Face({ store, host }: { store: Store<AnySchema>; host: HistoryHost }) {
  playback = useOwnPlayback(store, me, host);
  const past = playback.past;
  return <output>{past ? `${past.seq}:${past.store.graph.nodesOfKind("task").length}` : "now"}</output>;
}

describe("a moment behind the undo horizon", () => {
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
  });
  const settle = () =>
    act(async () => {
      for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const shown = () => element.querySelector("output")?.textContent;

  it("holds the picture it had while the archive is read, then draws the moment as it stood", async () => {
    const { store, archive } = compacted();
    const asked: [number, number][] = [];
    let hand!: () => void;
    const host: HistoryHost = {
      archived: (from, to) => (asked.push([from, to]), new Promise<readonly Operation[]>((resolve) => (hand = () => resolve(archive.ops.filter((op) => op.seq >= from && op.seq < to))))),
    };
    await act(async () => root.render(<Face store={store} host={host} />));
    await act(async () => playback!.show(12));
    await settle();
    expect(shown()).toBe("12:12");
    await act(async () => playback!.show(1));
    await settle();
    // Held, and saying which moment is being read.
    expect(shown()).toBe("12:12");
    expect(playback!.archive).toMatchObject({ seq: 1 });
    expect(playback!.archive).not.toHaveProperty("refused");
    expect(asked).toEqual([[0, 10]]);
    await act(async () => hand());
    await settle();
    expect(shown()).toBe("1:1");
    expect(playback!.archive).toBeNull();
    // Read once: the rest of the archive is drawn at once.
    await act(async () => playback!.show(7));
    expect(shown()).toBe("7:7");
    expect(asked).toHaveLength(1);
  });

  it("says the archive refused, and leaves the present untouched", async () => {
    const { store } = compacted();
    const host: HistoryHost = { archived: () => Promise.reject(new Error("Forbidden")) };
    await act(async () => root.render(<Face store={store} host={host} />));
    await act(async () => playback!.show(3));
    await settle();
    expect(shown()).toBe("now");
    expect(playback!.archive?.seq).toBe(3);
    expect(playback!.archive?.refused).toMatch(/Forbidden/);
    expect(store.graph.nodesOfKind("task")).toHaveLength(20);
    expect(store.log.length).toBe(20);
    await act(async () => playback!.show(null));
    expect(playback!.archive).toBeNull();
  });
});
