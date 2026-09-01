import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW, edgeSelectionId } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * A selected LINE gets an inspector about the relation: the declaration's
 * own sentence, both ends as pressable names, and the actions the schema
 * provider derived for exactly this edge.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: {
    "rides-in": { to: ["duty"], description: "who is along for it" },
  },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const removeRider = bound.defineMutation("remove-rider", {
  title: "Take them off it",
  description: "Remove a rider from a run.",
  severs: ["rides-in"],
  input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "rides-in", from: args.personId, to: args.dutyId });
  },
});

const store = () =>
  new Store({
    schema,
    mutations: [removeRider],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "morning", kind: "duty", label: "Morning run" },
      ] as never,
      edges: [{ kind: "rides-in", from: "ana", to: "morning" }],
    },
  });

const render = (selection: readonly string[]) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, focusId: "morning" }}
      initialSelection={selection}
    >
      <Inspector />
    </GraviewProvider>,
  );

describe("the inspector for a selected line", () => {
  it("names the relation, says its sentence, and links both ends", () => {
    const html = render([edgeSelectionId("rides-in", "ana", "morning")]);
    expect(html).toContain("Rides in");
    expect(html).toContain("relation");
    expect(html).toContain("who is along for it");
    expect(html).toContain('data-testid="edge-from"');
    expect(html).toContain("Ana");
    expect(html).toContain("Morning run");
    // Not a node: the travel hint would be a lie on a line.
    expect(html).not.toContain("double-click opens");
  });

  it("offers the derived severing action, prefilled", () => {
    const html = render([edgeSelectionId("rides-in", "ana", "morning")]);
    expect(html).toContain("Take them off it");
  });

  it("says plainly when no mutation claims the edge kind", () => {
    const plain = new Store({ schema, mutations: [], invariants: [] });
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={plain}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={EMPTY_VIEW}
        initialSelection={[edgeSelectionId("rides-in", "ana", "morning")]}
      >
        <Inspector />
      </GraviewProvider>,
    );
    expect(html).toContain("no mutation declares");
  });
});
