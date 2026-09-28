import { createSchema, defineNode, Graph, isoDate, parseArrangement } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, arrangementOf, sayCondition, withArrangement } from "../../src/index.js";
import { arrangeable } from "@graview/core";

/**
 * One control row, drawn from the declaration, for every surface that
 * arranges — and the stop carries what it chose, in the fragment's own
 * spelling of the shared words.
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } } });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), due: isoDate.optional(), size: z.enum(["small", "large"]).optional() }),
  display: { labels: { due: "Due date" } },
  lifecycle: { field: "done", retired: [true] },
});
const schema = createSchema([list, task]);
const graph = Graph.from(schema, {
  nodes: [
    { id: "today", kind: "list", label: "Today" },
    { id: "t1", kind: "task", label: "Book the van", done: false },
  ],
  edges: [{ kind: "holds", from: "today", to: "t1" }],
} as never);

describe("the arrange bar", () => {
  it("offers what the declaration offers, in its words, and names each condition as a chip", () => {
    const html = renderToStaticMarkup(
      <ArrangeBar schema={schema} graph={graph} kind="task" arrangement={parseArrangement({ sort: "due:desc", filter: "holds:today,done:false,is:past,due:before:2026-10-01", group: "due:month" })} onChange={() => {}} kept={{ shown: 1, of: 4 }} />,
    );
    expect(html).toContain('data-testid="arrange-sort"');
    expect(html).toContain(">Due date<");
    expect(html).toContain('data-testid="arrange-direction"');
    expect(html).toContain("↓");
    expect(html).toContain('data-testid="arrange-bucket"');
    expect(html).toContain("The list it is on: Today");
    expect(html).toContain("Done: no");
    expect(html).toContain(">Past<");
    expect(html).toContain("Due date before 2026-10-01");
    expect(html).toContain("1 of 4");
    // The far ends an edge condition may name come from the graph.
    expect(html).toContain('value="holds:today"');
  });

  it("declines a part when told to, and the whole row when told everything", () => {
    const partial = renderToStaticMarkup(<ArrangeBar schema={schema} graph={graph} kind="task" arrangement={{}} onChange={() => {}} allow={{ group: false }} query={false} />);
    expect(partial).toContain('data-testid="arrange-sort"');
    expect(partial).not.toContain('data-testid="arrange-group"');
    expect(partial).not.toContain('data-testid="arrange-query"');
    expect(renderToStaticMarkup(<ArrangeBar schema={schema} graph={graph} kind="task" arrangement={{}} onChange={() => {}} allow={false} query={false} />)).toBe("");
  });

  it("carries the arrangement in the stop as in.sort, in.filter, in.group and in.q", () => {
    const arrangement = parseArrangement({ sort: "label", filter: "done:false", group: "holds", q: "van" });
    const view = withArrangement(EMPTY_VIEW, arrangement);
    expect(view.within).toEqual({ sort: "label", filter: "done:false", group: "holds", q: "van" });
    expect(arrangementOf(view)).toEqual(arrangement);
    // Clearing a part removes its word; clearing everything removes `within`.
    expect(withArrangement(view, { sort: arrangement.sort }).within).toEqual({ sort: "label" });
    expect(withArrangement(view, {}).within).toBeUndefined();
    expect(sayCondition(schema, graph, arrangeable(schema, "task"), { key: "colour", value: "red" })).toBe("colour: red");
  });
});
