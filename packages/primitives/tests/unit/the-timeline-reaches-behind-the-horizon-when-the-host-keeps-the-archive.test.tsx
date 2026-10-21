// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, z, type AnySchema, type LogArchive } from "@graview/core";
import type { HistoryHost } from "@graview/core/history";
import { pastOf } from "@graview/core/past";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, usePlayback, type Playback } from "@graview/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Timeline } from "../../src/timeline.js";

/**
 * THE TIMELINE REACHES BEHIND THE HORIZON WHEN THE HOST KEEPS THE ARCHIVE
 * (FR-196). A compacted store holds a checkpoint and a short tail. Handed
 * `history.archived`, the scrubber's range reaches back to the start, the
 * moment drawn there is the uncompacted store's, and no "Restore to here"
 * reaches behind the horizon; without it the scrubber begins at the
 * horizon and says the changes before were archived; and a refusal is said
 * on the timeline while the present is left as it was.
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

function built(): Store<AnySchema> {
  let minute = 0;
  const store = new Store({ schema, mutations: [add], snapshot: { nodes: [], edges: [] }, now: () => new Date(Date.UTC(2026, 9, 13, 9, minute)).toISOString() });
  for (minute = 0; minute < 20; minute++) store.apply({ name: "add", args: { id: `t${minute}`, label: `Task ${minute}` } }, { author: me });
  return store as unknown as Store<AnySchema>;
}
function compacted(): { store: Store<AnySchema>; archive: LogArchive } {
  const store = built();
  return { store, archive: store.compact(store.checkpoint({ seq: 10 })!) };
}

let playback: Playback | null = null;
function Hold() {
  playback = usePlayback();
  return null;
}

describe("the timeline of a compacted store", () => {
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
      for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const opened = async (store: Store<AnySchema>, history: HistoryHost) => {
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={createViews(store.schema)} initialView={EMPTY_VIEW} principal={me} history={history}>
          <Hold />
          <Timeline face="pages" />
        </GraviewProvider>,
      ),
    );
    await act(async () => playback!.show(15));
    await settle();
  };
  const scrubber = () => element.querySelector<HTMLInputElement>('[data-testid="scrubber"]')!;
  const scrubTo = async (index: number) => {
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(scrubber(), String(index));
      scrubber().dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();
  };
  const text = (id: string) => element.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;

  it("reaches seq 1 with an archive, drawn as the uncompacted store stood, with no restore behind the horizon", async () => {
    const { store, archive } = compacted();
    const asked: [number, number][] = [];
    await opened(store, { archived: async (from, to) => (asked.push([from, to]), archive) });
    // Every seq behind the horizon is a stop, then one per gesture of the tail.
    expect(Number(scrubber().max)).toBe(20);
    expect(element.querySelector('[data-testid="timeline-archived"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="timeline-horizon"]')).toBeNull();
    await scrubTo(1);
    expect(asked).toEqual([[0, 10]]);
    expect(playback!.past?.seq).toBe(1);
    expect(playback!.past!.store.graph.snapshot()).toEqual(pastOf(built(), 1).graph.snapshot());
    expect(text("timeline-caption")).toBe("You: Add “Task 0”");
    expect(text("as-of")).toMatch(/^As of /);
    expect(element.querySelector('[data-testid="restore-here"]')).toBeNull();
    // Further through the archive, nothing more is asked.
    await scrubTo(7);
    expect(playback!.past?.store.graph.nodesOfKind("task")).toHaveLength(7);
    expect(asked).toHaveLength(1);
    // In front of the horizon, a restore is offered again.
    await scrubTo(12);
    expect(element.querySelector('[data-testid="restore-here"]')).not.toBeNull();
  });

  it("begins at the horizon without one, and says the changes before were archived", async () => {
    const { store } = compacted();
    await opened(store, {});
    expect(Number(scrubber().max)).toBe(10);
    expect(text("timeline-horizon")).toMatch(/archived/);
    expect(element.querySelector('[data-testid="timeline-archived"]')).toBeNull();
  });

  it("says the archive refused, and leaves the present untouched", async () => {
    const { store } = compacted();
    const now = store.graph.snapshot();
    await opened(store, { archived: () => Promise.reject(new Error("Forbidden: this seat may not read the archive")) });
    const shown = playback!.past?.seq;
    await scrubTo(3);
    expect(text("archive-refused")).toMatch(/Forbidden/);
    expect(text("timeline-caption")).toBe("The archive could not be read");
    expect(playback!.past?.seq).toBe(shown);
    expect(store.graph.snapshot()).toEqual(now);
    expect(store.log.length).toBe(20);
  });
});
