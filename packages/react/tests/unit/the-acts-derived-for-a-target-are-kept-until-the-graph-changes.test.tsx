// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Principal } from "@graview/core";
import type { AffordanceProvider, AffordanceSet } from "@graview/tools";
import { defaultProviders } from "@graview/tools/derive";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createViews, GraviewProvider, prepareAffordances, useAffordances, useGraview } from "../../src/index.js";

/**
 * THE ACTS DERIVED FOR A TARGET ARE KEPT UNTIL THE GRAPH CHANGES (FR-186).
 * A context menu derived its acts every time it opened. A face that saw the
 * pointer rest on a record now derives them first (`prepareAffordances`),
 * and the menu opened on it draws that derivation — the same object, the
 * providers asked once — and a change to the graph drops it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { done: true }),
});

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function setUp() {
  const store = new Store({ schema, mutations: [finish], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Book the hall", done: false }, { id: "t2", kind: "task", label: "Pay the deposit", done: false }], edges: [] } as never });
  const asked = { count: 0 };
  const counting: AffordanceProvider<typeof schema> = {
    name: "counting" as never,
    derive: () => {
      asked.count += 1;
      return {};
    },
  };
  const providers = [...defaultProviders<typeof schema>(), counting];
  const seen: AffordanceSet[] = [];
  // The seat as the provider says it (with its session): what a face that readies a menu asks as.
  const here: { principal?: Principal } = {};
  function Seat() {
    here.principal = useGraview().principal;
    return null;
  }
  function Menu({ on }: { readonly on: string }) {
    seen.push(useAffordances({ about: [on], focus: on }));
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const draw = (on: string | null) =>
    act(() =>
      root.render(
        <GraviewProvider store={store} views={createViews(schema)} principal={{ kind: "human", id: "ada" }} providers={providers}>
          <Seat />
          {on ? <Menu on={on} /> : null}
        </GraviewProvider>,
      ),
    );
  draw(null);
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { store, asked, providers, principal: here.principal!, seen, draw };
}

describe("the acts derived for a target", () => {
  it("are derived once when the pointer rested first, and the menu opened there draws that derivation", () => {
    const { store, asked, providers, principal, seen, draw } = setUp();
    const prepared = prepareAffordances(store, ["t1"], { principal, providers, focus: "t1" });
    expect(asked.count).toBe(1);
    expect(prepared.affordances.map((one) => one.mutation)).toContain("finish");
    draw("t1");
    expect(asked.count).toBe(1);
    expect(seen.at(-1)).toBe(prepared);
  });

  it("are not derived again when the menu is opened again on the same thing", () => {
    const { asked, seen, draw } = setUp();
    draw("t1");
    const first = asked.count;
    draw(null);
    draw("t1");
    expect(asked.count).toBe(first);
    expect(seen.at(-1)).toBe(seen[0]);
  });

  it("are derived again once the graph changes", () => {
    const { store, asked, providers, principal, seen, draw } = setUp();
    const prepared = prepareAffordances(store, ["t1"], { principal, providers, focus: "t1" });
    act(() => void store.apply({ name: "finish", args: { taskId: "t1" } }));
    draw("t1");
    expect(asked.count).toBe(2);
    expect(seen.at(-1)).not.toBe(prepared);
  });

  it("are kept apart per target", () => {
    const { store, providers, principal } = setUp();
    const one = prepareAffordances(store, ["t1"], { principal, providers, focus: "t1" });
    const two = prepareAffordances(store, ["t2"], { principal, providers, focus: "t2" });
    expect(two).not.toBe(one);
    expect(prepareAffordances(store, ["t1"], { principal, providers, focus: "t1" })).toBe(one);
  });
});
