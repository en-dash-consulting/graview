import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  admitArrangement,
  arrange,
  arrangeable,
  arrangeAllows,
  bucketStart,
  createSchema,
  defineNode,
  formatArrangement,
  Graph,
  isoDate,
  parseArrangement,
} from "../../src/index.js";
import { awkwardApp } from "../../src/testing.js";

/**
 * What a kind can be sorted, filtered and grouped by is in its declaration
 * already — field types, edges, lifecycle, standing — so the offers are
 * derived, not authored; and the chosen arrangement is a string short
 * enough for an address bar, so an arranged picture is a link.
 */

const list = defineNode("list", {
  fields: z.object({ label: z.string().min(1), order: z.number().int() }),
  edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } },
  display: { hide: ["order"] },
});
const task = defineNode("task", {
  fields: z.object({
    label: z.string().min(1),
    done: z.boolean(),
    due: isoDate.optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    notes: z.string().optional(),
  }),
  fieldRoles: { order: "due" },
  display: { labels: { due: "Due date" }, format: { size: (value) => `${String(value)} job` } },
  lifecycle: { field: "done", retired: [true] },
});
const schema = createSchema([list, task]);
const snapshot = {
  nodes: [
    { id: "today", kind: "list", label: "Today", order: 0 },
    { id: "week", kind: "list", label: "This week", order: 1 },
    { id: "t-van", kind: "task", label: "Book the van", done: false, due: "2026-09-01", size: "large" },
    { id: "t-milk", kind: "task", label: "Buy milk", done: true, due: "2026-08-27", size: "small" },
    { id: "t-tape", kind: "task", label: "Buy tape", done: false, due: "2026-09-03" },
    { id: "t-call", kind: "task", label: "Call the agent", done: false, size: "small" },
  ],
  edges: [
    { kind: "holds", from: "today", to: "t-van" },
    { kind: "holds", from: "today", to: "t-milk" },
    { kind: "holds", from: "week", to: "t-tape" },
  ],
};
const graph = Graph.from(schema, snapshot as never);
const tasks = graph.nodesOfKind("task");
const ctx = { schema, graph, flagged: new Set(["t-tape"]), today: "2026-09-28" };
const ids = (nodes: readonly { id: string }[]) => nodes.map((node) => node.id);

describe("what a kind can be arranged by", () => {
  it("offers its scalar fields, its edges from either end, and its standing — in the declaration's words", () => {
    const offers = arrangeable(schema, "task");
    expect(offers.sorts.map((offer) => offer.key)).toEqual(["label", "done", "due", "size", "notes", "holds"]);
    expect(offers.sorts.find((offer) => offer.key === "due")?.label).toBe("Due date");
    // The edge is declared on the LIST; from the task it reads by its inverse.
    expect(offers.sorts.find((offer) => offer.key === "holds")).toMatchObject({ about: "edge", label: "The list it is on", far: ["list"] });
    // A word field is a filter too (its values are the graph's, listed by a surface): the seventh walk.
    expect(offers.filters.map((offer) => offer.key)).toEqual(["done", "due", "size", "notes", "holds", "is"]);
    expect(offers.filters.find((offer) => offer.key === "is")?.options).toEqual(["current", "past", "any", "flagged", "clear"]);
    expect(offers.groups.map((offer) => offer.key)).toEqual(["done", "due", "size", "holds"]);
    expect(offers.groups.find((offer) => offer.key === "due")?.buckets).toEqual(["day", "week", "month", "year", "decade"]);
    expect(offers.natural).toEqual({ by: "due", direction: "asc" });

    const lists = arrangeable(schema, "list");
    // A hidden field is not an arrangement; a kind with no lifecycle has only its standing.
    expect(lists.sorts.map((offer) => offer.key)).toEqual(["label", "holds"]);
    expect(lists.filters.find((offer) => offer.key === "is")?.options).toEqual(["flagged", "clear"]);
    expect(lists.natural).toBeUndefined();
  });

  it("names only fields the kind has, for every declaration shape", () => {
    for (const kinds of [1, 4, 9]) {
      const app = awkwardApp({ kinds });
      for (const kind of app.schema.kinds as readonly string[]) {
        const definition = app.schema.tryDefinition(kind)!;
        const shape = Object.keys(definition.fields.shape as Record<string, unknown>);
        const offers = arrangeable(app.schema, kind);
        for (const offer of [...offers.sorts, ...offers.filters, ...offers.groups]) {
          if (offer.about === "field") expect(shape, `${kind}.${offer.key}`).toContain(offer.key);
          if (offer.about === "edge") expect(app.schema.edgeKinds, `${kind} ${offer.key}`).toContain(offer.key);
        }
      }
    }
  });
});

describe("the grammar", () => {
  it("round-trips one string per part and drops what it cannot read", () => {
    const words = { sort: "due:desc", filter: "done:false,holds:today,is:past", group: "due:month" };
    const parsed = parseArrangement(words);
    expect(parsed).toEqual({
      sort: { by: "due", direction: "desc" },
      filter: [
        { key: "done", value: "false" },
        { key: "holds", value: "today" },
        { key: "is", value: "past" },
      ],
      group: { by: "due", bucket: "month" },
    });
    expect(formatArrangement(parsed)).toEqual(words);
    expect(formatArrangement(parseArrangement({ sort: "label", group: "size" }))).toEqual({ sort: "label", group: "size" });
    expect(parseArrangement({ sort: "", filter: "nonsense,:x", group: "due:fortnight" })).toEqual({ group: { by: "due" } });
  });

  it("admits only what the kind offers, and says what it dropped", () => {
    const offers = arrangeable(schema, "task");
    const stale = parseArrangement({ sort: "priority", filter: "done:true,colour:red", group: "holds" });
    const { arrangement, dropped } = admitArrangement(stale, offers);
    expect(arrangement).toEqual({ filter: [{ key: "done", value: "true" }], group: { by: "holds" } });
    expect(dropped).toEqual(["sort priority", "filter colour"]);
  });

  it("lets a lens decline a part or the whole", () => {
    expect(arrangeAllows(undefined, "sort")).toBe(true);
    expect(arrangeAllows(false, "group")).toBe(false);
    expect(arrangeAllows({ group: false }, "group")).toBe(false);
    expect(arrangeAllows({ group: false }, "sort")).toBe(true);
  });
});

describe("arranging", () => {
  it("sorts by a field, by the label and by a far end, stably, with the unsaid last", () => {
    expect(ids(arrange(tasks, { sort: { by: "due", direction: "asc" } }, ctx).nodes)).toEqual(["t-milk", "t-van", "t-tape", "t-call"]);
    expect(ids(arrange(tasks, { sort: { by: "due", direction: "desc" } }, ctx).nodes)).toEqual(["t-tape", "t-van", "t-milk", "t-call"]);
    expect(ids(arrange(tasks, { sort: { by: "label", direction: "asc" } }, ctx).nodes)).toEqual(["t-van", "t-milk", "t-tape", "t-call"]);
    expect(ids(arrange(tasks, { sort: { by: "holds", direction: "asc" } }, ctx).nodes)).toEqual(["t-tape", "t-van", "t-milk", "t-call"]);
    // Ties keep the order they came in.
    expect(ids(arrange(tasks, { sort: { by: "size", direction: "asc" } }, ctx).nodes)).toEqual(["t-van", "t-milk", "t-call", "t-tape"]);
  });

  it("filters as a conjunction over fields, dates, edges and standing", () => {
    const only = (filter: string) => ids(arrange(tasks, parseArrangement({ filter }), ctx).nodes);
    expect(only("done:false")).toEqual(["t-van", "t-tape", "t-call"]);
    expect(only("done:false,holds:today")).toEqual(["t-van"]);
    expect(only("holds:*")).toEqual(["t-van", "t-milk", "t-tape"]);
    expect(only("holds:none")).toEqual(["t-call"]);
    expect(only("due:before:2026-09-02")).toEqual(["t-van", "t-milk"]);
    expect(only("due:on:2026-09-03")).toEqual(["t-tape"]);
    expect(only("size:small")).toEqual(["t-milk", "t-call"]);
    expect(only("is:past")).toEqual(["t-milk"]);
    expect(only("is:current")).toEqual(["t-van", "t-tape", "t-call"]);
    expect(only("is:flagged")).toEqual(["t-tape"]);
    expect(only("is:any")).toHaveLength(4);
  });

  it("groups by a choice in option order, by a boolean, by a far end, and by a date bucket — the empty group last", () => {
    const by = (group: string) => arrange(tasks, parseArrangement({ group }), ctx).groups.map((g) => [g.label, ids(g.nodes)]);
    expect(by("size")).toEqual([
      ["small job", ["t-milk", "t-call"]],
      ["large job", ["t-van"]],
      ["No size", ["t-tape"]],
    ]);
    expect(by("done")).toEqual([
      ["Yes", ["t-milk"]],
      ["No", ["t-van", "t-tape", "t-call"]],
    ]);
    expect(by("holds")).toEqual([
      ["This week", ["t-tape"]],
      ["Today", ["t-van", "t-milk"]],
      ["Without the list it is on", ["t-call"]],
    ]);
    expect(by("due:month")).toEqual([
      ["August 2026", ["t-milk"]],
      ["September 2026", ["t-van", "t-tape"]],
      ["No due date", ["t-call"]],
    ]);
    expect(by("due:week").map(([label]) => label)).toEqual(["Week of 2026-08-24", "Week of 2026-08-31", "No due date"]);
    expect(bucketStart("2026-09-28", "week")).toBe("2026-09-28");
    expect(bucketStart("2026-09-27", "week")).toBe("2026-09-21");
    expect(bucketStart("nonsense", "day")).toBeUndefined();
    // A catalogue of thirty years reads by the year and the decade.
    expect(bucketStart("2006-11-07", "year")).toBe("2006-01-01");
    expect(bucketStart("2006-11-07", "decade")).toBe("2000-01-01");
    expect(bucketStart("1999-11-09", "decade")).toBe("1990-01-01");
    const flat = arrange(tasks, {}, ctx);
    expect(flat.grouped).toBe(false);
    expect(flat.groups).toHaveLength(1);
  });
});

describe("the checker and the readers", () => {
  it("warns about an order role the kind lacks, notes a lens arrangement the bound kind cannot take, and says what can be arranged", async () => {
    const { defineApp } = await import("../../src/index.js");
    const { checkApp } = await import("../../src/check.js");
    const { describeApp } = await import("../../src/cli/describe.js");
    const { generateLlmsTxt } = await import("../../src/cli/docs.js");
    const lost = defineNode("lost", { fields: z.object({ label: z.string() }), fieldRoles: { order: "priority" } });
    const app = defineApp({
      name: "arranged",
      schema: createSchema([list, task, lost]),
      mutations: [],
      invariants: [],
      lenses: [
        { name: "calendar", requiredRoles: ["start"], bindings: { task: { start: "due" } }, arrangedBy: { group: "holds", sort: "colour" } },
        { name: "board", requiredRoles: [], binds: "entities", bindings: { slots: { kind: "list" } }, arrangedBy: { filter: "is:flagged" } },
      ],
    });
    const result = checkApp(app);
    const codes = result.findings.map((finding) => `${finding.code} @ ${finding.where}`);
    expect(codes).toContain('order-role-unknown @ defineNode("lost").fieldRoles.order');
    expect(codes).toContain('lens-arrangement-unknown @ lens "calendar" arrangedBy');
    expect(result.findings.find((finding) => finding.code === "lens-arrangement-unknown")?.message).toMatch(/sort colour/);
    // The board's `is:flagged` is something every kind offers: nothing to say.
    expect(codes.filter((code) => code.includes('lens "board"'))).toEqual([]);

    const described = describeApp(app);
    expect(described).toContain("## What can be arranged");
    expect(described).toMatch(/task: sort by label \(name\), done \(done\), due \(due date\)/);
    expect(described).toContain("sorted by due unless asked");
    expect(described).toContain("The calendar lens opens with group=holds and sort=colour.");
    const llms = generateLlmsTxt(app);
    expect(llms).toContain("## Arranging a picture");
    expect(llms).toMatch(/- arranged by: sort label \| done \| due \| size \| notes \| holds; filter done \| due \| size \| notes \| holds \| is; group done \| due \| size \| holds; due unless asked/);
  });
});
