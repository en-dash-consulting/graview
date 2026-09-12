// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW, edgeSelectionId, type ViewState } from "@graview/layout";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GraviewProvider, createViews, useNavigation, useSelection } from "../../src/index.js";

/**
 * A STOP THAT NAMES SOMETHING THAT IS NO LONGER THERE.
 *
 * The address holds a focus and a selection by id, and ordinary acts remove
 * things. Nothing resolved those ids against the graph after the removal, so
 * severing a relation left its own pane open, offering the act that severed
 * it — which refused with "Cannot remove missing edge handled-by
 * item:pay-the-deposit person:ada-nowak", the graph's own words in front of
 * a person — and dropping the record you had travelled into left a focus
 * nothing could lay out.
 */
const item = defineNode("item", {
  description: "A thing.",
  fields: z.object({ label: z.string() }),
  plural: "Items",
  edges: { "handled-by": { to: ["person"], description: "who has it", inverse: "what they have" } },
});
const person = defineNode("person", {
  description: "Somebody.",
  fields: z.object({ label: z.string() }),
  plural: "People",
});
const schema = createSchema([item, person]);
const { defineMutation } = bindSchema(schema);

const drop = defineMutation("drop", {
  title: "Drop it",
  subject: { kinds: ["item"], arg: "id" },
  input: z.object({ id: nodeRef(["item"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

const unhand = defineMutation("unhand", {
  title: "Take it back",
  subject: { kinds: ["item"], arg: "id" },
  severs: ["handled-by"],
  input: z.object({ id: nodeRef(["item"]), handler: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "handled-by", from: args.id, to: args.handler });
  },
});

const made = () =>
  new Store({
    schema,
    mutations: [drop, unhand],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "item:deposit", kind: "item", label: "Pay the deposit" },
        { id: "person:ada", kind: "person", label: "Ada Nowak" },
      ] as never,
      edges: [{ kind: "handled-by", from: "item:deposit", to: "person:ada" }],
    },
  });

/** Renders the provider and reports the stop it settles on. */
async function stand(store: ReturnType<typeof made>, initialView: ViewState) {
  const seen: { view: ViewState; selection: readonly string[] }[] = [];
  let travel: ((to: string) => void) | null = null;
  function Probe() {
    const { view, focus } = useNavigation();
    const { selection } = useSelection();
    travel = focus;
    seen.push({ view, selection });
    return null;
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={store} views={createViews(schema)} initialView={initialView}>
        <Probe />
      </GraviewProvider>,
    );
  });
  return {
    latest: () => seen[seen.length - 1]!,
    async travelTo(id: string) {
      await act(async () => travel?.(id));
    },
    async apply(name: string, args: Record<string, unknown>) {
      await act(async () => {
        store.apply({ name, args } as never);
      });
    },
    async stop() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

describe("a stop that still exists", () => {
  it("drops the selection of a record an act has removed", async () => {
    const store = made();
    const at = await stand(store, {
      ...EMPTY_VIEW,
      focusId: "aggregate:item",
      selection: ["item:deposit"],
    });
    expect(at.latest().selection).toEqual(["item:deposit"]);
    await at.apply("drop", { id: "item:deposit" });
    expect(at.latest().selection).toEqual([]);
    await at.stop();
  });

  it("drops the selection of a relation an act has severed", async () => {
    const store = made();
    const line = edgeSelectionId("handled-by", "item:deposit", "person:ada");
    const at = await stand(store, { ...EMPTY_VIEW, focusId: "item:deposit", selection: [line] });
    expect(at.latest().selection).toEqual([line]);
    await at.apply("unhand", { id: "item:deposit", handler: "person:ada" });
    expect(at.latest().selection).toEqual([]);
    await at.stop();
  });

  it("leaves the focus somewhere when the record it names is removed", async () => {
    const store = made();
    // The app's home is the items group; travelling in and dropping the
    // record must land back there rather than on an id nothing can lay out.
    const at = await stand(store, { ...EMPTY_VIEW, focusId: "aggregate:item" });
    await at.travelTo("item:deposit");
    expect(at.latest().view.focusId).toBe("item:deposit");
    await at.apply("drop", { id: "item:deposit" });
    expect(at.latest().view.focusId).toBe("aggregate:item");
    await at.stop();
  });

  it("keeps a kind card and a group, which are not nodes", async () => {
    const store = made();
    const at = await stand(store, {
      ...EMPTY_VIEW,
      focusId: "aggregate:item",
      selection: ["kind:item"],
    });
    await at.apply("drop", { id: "item:deposit" });
    expect(at.latest().selection).toEqual(["kind:item"]);
    expect(at.latest().view.focusId).toBe("aggregate:item");
    await at.stop();
  });
});
