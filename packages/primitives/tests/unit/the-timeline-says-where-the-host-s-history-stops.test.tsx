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
 * THE TIMELINE SAYS WHERE THE HOST'S HISTORY STOPS (FR-213). A plan keeps
 * thirty days of history and refuses the archive behind that; the timeline
 * said "The archive could not be read" with an alert. Handed
 * `history.kept`, it says the plan's sentence and its link in a quiet line
 * at a moment made at or before it, and never asks the archive for a range
 * made wholly before it; and an archive that answers `keptFrom` is stepped
 * through behind it by the epochs it kept, never refused.
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
const minuteOf = (minute: number) => new Date(Date.UTC(2026, 9, 13, 9, minute)).toISOString();
const KEPT = { sentence: "The Free plan keeps 30 days of history.", action: { label: "See plans", href: "/plans" } };

function built(): Store<AnySchema> {
  let minute = 0;
  const store = new Store({ schema, mutations: [add], now: () => minuteOf(minute) });
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

describe("the timeline of a host that keeps a window of history", () => {
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

  it("says the plan's sentence and its link in a quiet line, and asks nothing made wholly before the time it keeps since", async () => {
    const { store } = compacted();
    const asked: [number, number][] = [];
    // Kept since 9:12: every archived change, made by 9:09, is before it.
    await opened(store, { kept: { since: minuteOf(12), ...KEPT }, archived: async (from, to) => (asked.push([from, to]), { ops: [] }) });
    // No stop behind the horizon: the scrubber begins there, then one per gesture of the tail.
    expect(Number(scrubber().max)).toBe(10);
    await scrubTo(0);
    expect(playback!.past?.seq).toBe(10);
    expect(playback!.past!.store.graph.snapshot()).toEqual(pastOf(built(), 10).graph.snapshot());
    expect(text("timeline-kept")).toBe("The Free plan keeps 30 days of history. See plans");
    expect(element.querySelector('[data-testid="timeline-kept-action"]')?.getAttribute("href")).toBe("/plans");
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(asked).toEqual([]);
    // A moment made after it says nothing of it.
    await scrubTo(8);
    expect(playback!.past?.seq).toBe(18);
    expect(element.querySelector('[data-testid="timeline-kept"]')).toBeNull();
  });

  it("steps behind an answer's keptFrom by the epochs the archive kept, and says a moment between them is before what is kept rather than refused", async () => {
    const { store, archive } = compacted();
    const whole = built();
    const asked: [number, number][] = [];
    const answer = { ops: archive.ops.filter((op) => op.seq >= 6), epochs: [whole.checkpoint({ seq: 3 })!, whole.checkpoint({ seq: 6 })!], keptFrom: 6 };
    await opened(store, { kept: { since: minuteOf(0), ...KEPT }, archived: async (from, to) => (asked.push([from, to]), answer) });
    // Every seq behind the horizon is a stop until the archive is read.
    expect(Number(scrubber().max)).toBe(20);
    await scrubTo(1);
    expect(asked).toEqual([[0, 10]]);
    expect(playback!.archive).toEqual({ seq: 1, behindKept: true });
    expect(text("timeline-caption")).toBe("Nothing this far back is kept");
    expect(text("timeline-kept")).toMatch(/^The Free plan keeps 30 days of history\./);
    expect(element.querySelector('[data-testid="archive-refused"]')).toBeNull();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    // Read, the scrubber stops at the epoch kept at seq 3, then at every seq from 6.
    expect(Number(scrubber().max)).toBe(15);
    await scrubTo(1);
    expect(playback!.past?.seq).toBe(6);
    expect(playback!.past!.store.graph.snapshot()).toEqual(pastOf(whole, 6).graph.snapshot());
    expect(text("timeline-kept")).not.toBeNull();
    await scrubTo(0);
    expect(playback!.past?.seq).toBe(3);
    expect(playback!.past!.store.graph.snapshot()).toEqual(pastOf(whole, 3).graph.snapshot());
    expect(text("timeline-kept")).not.toBeNull();
    await scrubTo(3);
    expect(playback!.past?.seq).toBe(8);
    expect(playback!.past!.store.graph.snapshot()).toEqual(pastOf(whole, 8).graph.snapshot());
    expect(element.querySelector('[data-testid="timeline-kept"]')).toBeNull();
    expect(asked).toHaveLength(1);
  });
});
