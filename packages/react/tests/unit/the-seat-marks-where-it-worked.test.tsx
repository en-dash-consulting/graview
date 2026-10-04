// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GraviewProvider } from "../../src/context.js";
import { createViews } from "../../src/view-registry.js";
import { useSeatWork } from "../../src/animation.js";

/**
 * WHERE THE SEAT WORKED IS MARKED ON THE THING.
 *
 * The robot walked to what it wrote and stood there; the walk is gone and
 * the attribution is not. What the log attributes to an agent marks what
 * it wrote for a hold, and stays in a list the companion offers to take
 * you back to. A person's own edit is not the seat's work, and an undo
 * takes the mark with it: a mark over a change that no longer exists is
 * the seat claiming credit for nothing.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [finish as never],
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
  });

const seen = async (run: (held: ReturnType<typeof store>) => Promise<void> | void) => {
  const made = store();
  let latest: ReturnType<typeof useSeatWork> | null = null;
  const Probe = () => {
    latest = useSeatWork();
    return null;
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={made} views={createViews(schema)} initialView={EMPTY_VIEW}>
        <Probe />
      </GraviewProvider>,
    ),
  );
  await act(async () => {
    await run(made);
  });
  const work = latest!;
  await act(async () => root.unmount());
  host.remove();
  return work;
};

describe("the seat marks where it worked", () => {
  it("marks what an agent wrote, and says what it did in its own words", async () => {
    const work = await seen((made) =>
      void made.apply({ name: "finish", args: { taskId: "t1" } }, { author: { kind: "agent", id: "tidy", session: "ui" }, intent: "Finish Pay the deposit" }),
    );
    expect([...work.marks.entries()]).toEqual([["t1", "tidy"]]);
    expect(work.acts).toHaveLength(1);
    expect(work.acts[0]!.who).toBe("tidy");
    expect(work.acts[0]!.intent).toBe("Finish Pay the deposit");
    expect(work.acts[0]!.wrote).toEqual(["t1"]);
  });

  it("marks nothing a person did themselves", async () => {
    const work = await seen((made) =>
      void made.apply({ name: "finish", args: { taskId: "t1" } }, { author: { kind: "human", id: "nora" }, intent: "Finish it" }),
    );
    expect(work.marks.size).toBe(0);
    expect(work.acts).toHaveLength(0);
  });

  it("takes the mark back with the change: an undone act is not something the seat just did", async () => {
    const work = await seen(async (made) => {
      const applied = made.apply({ name: "finish", args: { taskId: "t1" } }, { author: { kind: "agent", id: "tidy", session: "ui" }, intent: "Finish it" });
      made.undo([applied.batch], { author: { kind: "human", id: "nora" } });
    });
    expect(work.marks.size).toBe(0);
    expect(work.acts).toHaveLength(0);
  });
});
