import { bindSchema, createSchema, defineNode, Store, type Violation } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Connections } from "../../src/index.js";

/*
 * A RULE'S CONNECTIONS ARE WHAT IT FINDS WRONG. A rule has no edges, so its
 * card said "nothing is connected" while the band beside it showed the
 * tasks its violations named — two surfaces disagreeing. What a node judges
 * is a connection, captioned as such.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }), label: (n) => n.label });
const rule = defineNode("rule", { fields: z.object({ label: z.string() }), label: (n) => n.label });
const schema = createSchema([task, rule]);
const { defineInvariant } = bindSchema(schema);
const nothingDone = defineInvariant("nothing-done", {
  scope: { kind: "rule" },
  evaluate({ graph, subject }): Violation[] {
    const done = graph.nodesOfKind("task").filter((t) => (t as { done: boolean }).done);
    if (done.length === 0) return [];
    return [{ invariant: "nothing-done", subjectId: subject.id, label: subject.label, message: "something is done", nodeIds: done.map((t) => t.id), repairs: [] }];
  },
});

describe("what it finds wrong", () => {
  it("lists the nodes a rule's violations name as a connection, and says nothing is connected only when nothing is", () => {
    const store = new Store({
      schema,
      mutations: [],
      invariants: [nothingDone],
      snapshot: {
        nodes: [
          { id: "r", kind: "rule", label: "Nothing done" },
          { id: "t1", kind: "task", label: "Order boxes", done: true },
          { id: "t2", kind: "task", label: "Book the van", done: false },
        ],
        edges: [],
      },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={createViews(schema)} initialView={EMPTY_VIEW}>
        <Connections id="r" empty="Nothing is connected to this rule yet." />
      </GraviewProvider>,
    );
    expect(html).toContain("what it finds wrong");
    expect(html).toContain("Order boxes");
    expect(html).not.toContain("Book the van");
    expect(html).not.toContain("Nothing is connected");
    const quiet = renderToStaticMarkup(
      <GraviewProvider store={store} views={createViews(schema)} initialView={EMPTY_VIEW}>
        <Connections id="t2" empty="Nothing is connected to this task yet." />
      </GraviewProvider>,
    );
    expect(quiet).toContain("Nothing is connected");
  });
});
