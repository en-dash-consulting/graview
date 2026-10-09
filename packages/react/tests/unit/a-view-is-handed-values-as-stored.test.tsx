// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW, aggregateId } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createViews, GraviewProvider, ResolvedView, Scene, type ViewProps } from "../../src/index.js";

/**
 * A VIEW IS HANDED THE VALUES AS THE RECORD KEEPS THEM.
 *
 * The framework says a day and a choice as a person reads them wherever IT
 * puts them in a sentence — "28 Aug 2026", "Tue", "No". A view is not one
 * of those places: it computes over the record, and `!task.done` on "No"
 * is false, `due >= day` on "28 Aug 2026" sorts by the day of the month.
 * So a boolean reaches a view as `false`, a day as `2026-08-28` and a
 * choice as `tue`, on a group's members and on one record alike.
 */
const task = defineNode("task", {
  fields: z.object({
    label: z.string(),
    done: z.boolean(),
    due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    day: z.enum(["mon", "tue", "wed"]).optional(),
  }),
  plural: "Tasks",
});
const schema = createSchema([task]);

const handed: Record<string, unknown>[] = [];
function Capture({ nodes, node }: ViewProps<typeof schema>) {
  for (const one of nodes ?? (node ? [node] : [])) handed.push({ ...one });
  return <p>{nodes?.length ?? 1}</p>;
}

const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "t-deposit", kind: "task", label: "Pay the deposit", done: false, due: "2026-08-28", day: "tue" },
        { id: "t-quote", kind: "task", label: "Get the second quote", done: true, due: "2026-08-26", day: "mon" },
      ],
      edges: [],
    },
  });

const views = () =>
  (["full", "summary", "glyph"] as const).reduce(
    (registry, fidelity) =>
      registry
        .register("task", { cardinality: "many", fidelity }, Capture)
        .register("task", { cardinality: "one", fidelity }, Capture),
    createViews(schema),
  );

const STORED = {
  "t-deposit": { done: false, due: "2026-08-28", day: "tue" },
  "t-quote": { done: true, due: "2026-08-26", day: "mon" },
};

let host: HTMLDivElement;
beforeEach(() => {
  handed.length = 0;
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => host.remove());

function expectStored() {
  expect(handed.length).toBeGreaterThan(0);
  for (const one of handed) {
    const kept = STORED[one["id"] as keyof typeof STORED];
    expect(kept).toBeDefined();
    expect(one).toMatchObject(kept);
    expect(typeof one["done"]).toBe("boolean");
  }
}

describe("a view's props", () => {
  it("carry a group's members with a boolean, a day and a choice as stored", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
          <ResolvedView
            node={{
              id: aggregateId("task"),
              kind: "task",
              plane: 0,
              x: 0,
              y: 0,
              width: 600,
              height: 400,
              pinned: false,
              aggregate: { kind: "task", memberIds: ["t-deposit", "t-quote"], label: "Tasks" },
            }}
            mode="scene"
            selected={false}
            fidelity="full"
          />
        </GraviewProvider>,
      );
    });
    expect(handed.map((one) => one["id"])).toEqual(["t-deposit", "t-quote"]);
    expectStored();
    await act(async () => root.unmount());
  });

  it("carry one record as stored", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
          <ResolvedView
            node={{ id: "t-deposit", kind: "task", plane: 0, x: 0, y: 0, width: 300, height: 200, pinned: false }}
            mode="scene"
            selected={false}
            fidelity="full"
          />
        </GraviewProvider>,
      );
    });
    expect(handed.map((one) => one["id"])).toEqual(["t-deposit"]);
    expectStored();
    await act(async () => root.unmount());
  });

  it("carry stored values through the whole scene, focused on the group", async () => {
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("task") }}>
          <Scene />
        </GraviewProvider>,
      );
    });
    expectStored();
    await act(async () => root.unmount());
  });
});
