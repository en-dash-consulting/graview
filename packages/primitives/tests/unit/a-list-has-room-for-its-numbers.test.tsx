// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { planFrom } from "@graview/tools";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Begin, PlanReview, registerDefaultViews } from "../../src/index.js";

/**
 * An app with thirteen kinds read its way in as "1…9, 0, 1, 2, 3": a numbered
 * list's markers hang in its left padding, and 1.25rem held one digit. The
 * room the list leaves is the widest number it shows, so "10" through "13"
 * are read whole — the way in and a model's plan alike.
 */
const kinds = Array.from({ length: 13 }, (_, i) =>
  defineNode(`kind-${String(i).padStart(2, "0")}`, { fields: z.object({ label: z.string() }), plural: `Kinds ${i}` }),
);
const schema = createSchema(kinds);
const { defineMutation } = bindSchema(schema);
const acts = kinds.map((node) =>
  defineMutation(`make-${node.kind}`, {
    title: `Make a ${node.kind}`,
    creates: [node.kind],
    input: z.object({ label: z.string() }),
    apply: (ctx, args) =>
      void ctx.addNode({ id: ctx.freshId(args.label, node.kind), kind: node.kind, label: args.label } as never),
  }),
);

const roomOf = async (element: ReactNode, store: Store<typeof schema>, testid: string): Promise<string> => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
        {element}
      </GraviewProvider>,
    ),
  );
  const list = host.querySelector<HTMLOListElement>(`[data-testid="${testid}"]`)!;
  expect(list.children.length).toBeGreaterThanOrEqual(10);
  const room = list.style.paddingLeft;
  await act(async () => root.unmount());
  host.remove();
  return room;
};

describe("a numbered list has room for its numbers", () => {
  it("leaves the way in room for a two-digit number", async () => {
    const store = new Store({ schema, mutations: acts, snapshot: { nodes: [], edges: [] } });
    expect(await roomOf(<Begin />, store, "begin")).toBe("3.5ch");
  });

  it("leaves a model's plan room for a two-digit number", async () => {
    const store = new Store({ schema, mutations: acts, snapshot: { nodes: [], edges: [] } });
    const plan = planFrom(
      store,
      kinds.map((node, i) => ({ mutation: `make-${node.kind}`, args: { label: `Thing ${i}` } })),
    );
    expect(await roomOf(<PlanReview plan={plan} />, store, "plan")).toBe("3.5ch");
  });
});
