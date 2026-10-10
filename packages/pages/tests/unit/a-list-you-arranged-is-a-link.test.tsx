import { arrangeable } from "@graview/core/arrange";
import { createSchema, defineNode, isoDate, Store } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";
import { arrangementFromSearch } from "../../src/page-list.js";

/**
 * A list you arranged is a link you can send. The list page reads sort,
 * filter, group and q from its search through the shared module — the same
 * words a lens carries in its fragment — and every key it grew before the
 * module existed still lands, because somebody may have sent it.
 */
const list = defineNode("list", {
  fields: z.object({ label: z.string() }),
  plural: "Lists",
  edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } },
});
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), due: isoDate.optional() }),
  plural: "Tasks",
  lifecycle: { field: "done", retired: [true] },
});
const schema = createSchema([list, task]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "today", kind: "list", label: "Today" },
        { id: "week", kind: "list", label: "This week" },
        { id: "t-van", kind: "task", label: "Book the van", done: false, due: "2026-09-01" },
        { id: "t-milk", kind: "task", label: "Buy milk", done: true, due: "2026-08-27" },
        { id: "t-tape", kind: "task", label: "Buy tape", done: false, due: "2026-09-03" },
      ] as never,
      edges: [
        { kind: "holds", from: "today", to: "t-van" },
        { kind: "holds", from: "today", to: "t-milk" },
        { kind: "holds", from: "week", to: "t-tape" },
      ],
    },
  });
const draw = (path: string) => {
  const context: PageContext<typeof schema> = { store: store() };
  return renderToStaticMarkup(<PagesApp context={context} initialPath={path} />);
};
const rows = (html: string) => [...html.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*href="\/tasks\/([^"]+)"/g)].map((match) => match[1]);
const headings = (html: string) => [...html.matchAll(/data-testid="list-group"[\s\S]*?<h2[^>]*>([^<]*)</g)].map((match) => match[1]!.trim());

describe("a list you arranged is a link", () => {
  it("shows the current ones by default, and the past when asked in the shared words or the old one", () => {
    expect(rows(draw("/tasks"))).toEqual(["t-van", "t-tape"]);
    expect(rows(draw("/tasks?filter=is:any"))).toEqual(["t-van", "t-milk", "t-tape"]);
    expect(rows(draw("/tasks?past=1"))).toEqual(["t-van", "t-milk", "t-tape"]);
    expect(draw("/tasks")).toContain('data-testid="past-link"');
    // A filter that names the retired state is the past, asked for by name (W-104).
    expect(rows(draw("/tasks?filter=done:true"))).toEqual(["t-milk"]);
  });

  it("sorts, groups and finds through the shared grammar, and draws the row", () => {
    expect(rows(draw("/tasks?sort=due:desc"))).toEqual(["t-tape", "t-van"]);
    const grouped = draw("/tasks?group=holds&filter=is:any");
    expect(headings(grouped)).toEqual(["This week", "Today"]);
    expect(grouped).toContain('data-grouped="holds"');
    expect(headings(draw("/tasks?group=due:month&filter=is:any"))).toEqual(["August 2026", "September 2026"]);
    expect(rows(draw("/tasks?q=tape"))).toEqual(["t-tape"]);
    // A short list is read, not arranged: the line is its count alone, said once.
    const html = draw("/tasks");
    expect(html).toMatch(/data-testid="arrange-count"[^>]*>2 tasks</);
    expect(html).not.toContain('data-testid="arrange-sort"');
    expect(html).not.toMatch(/data-testid="arrange-count"[\s\S]*data-testid="arrange-count"/);
    // An address that arranged it keeps the line, saying how — the arrangement read back off the address.
    const sorted = draw("/tasks?sort=due:desc");
    for (const control of ["arrange-bar", "arrange-sort", "arrange-group", "arrange-add"]) expect(sorted).toContain(`data-testid="${control}"`);
    expect(sorted).toMatch(/data-testid="arrange-sort"[^>]*value="due"[^>]*aria-label="Sorted by due, latest first"/);
    expect(sorted).not.toContain("<select");
    // The words have one box: the nav's, which narrows the list it is on — not a second one in the row.
    expect(sorted).toContain('data-testid="nav-find"');
    expect(sorted).not.toContain('data-testid="arrange-query"');
    // Every condition reads as a chip, in the declaration's words.
    expect(draw("/tasks?filter=holds:today")).toContain("The list it is on: Today");
  });

  it("still lands the links this page used to write: by, an edge to a node, with, past", () => {
    expect(headings(draw("/tasks?by=holds&past=1"))).toEqual(["This week", "Today"]);
    const narrowed = draw("/tasks?holds=today");
    expect(rows(narrowed)).toEqual(["t-van"]);
    // Said once, on the arranging line: how many of how many, and the condition with its ×.
    expect(narrowed).toMatch(/data-testid="arrange-kept"[^>]*>1 of 2</);
    expect(narrowed).toMatch(/data-testid="arrange-condition"[^>]*>The list it is on: Today</);
    expect(rows(draw("/tasks?with=holds&past=1"))).toEqual(["t-van", "t-milk", "t-tape"]);
  });

  it("says what a stale link asked for that the kind cannot be arranged by, and shows the rest", () => {
    const html = draw("/tasks?sort=priority&group=holds&filter=is:any");
    expect(html).toContain('data-testid="list-dropped"');
    expect(html).toContain("sort priority");
    expect(headings(html)).toEqual(["This week", "Today"]);
    const offers = arrangeable(schema, "task");
    expect(arrangementFromSearch(new URLSearchParams("sort=priority&by=holds&holds=today&past=1"), offers, ["holds"])).toEqual({
      arrangement: {
        filter: [
          { key: "holds", value: "today" },
          { key: "is", value: "any" },
        ],
        group: { by: "holds" },
      },
      dropped: ["sort priority"],
    });
  });

  it("says None of them, with a way back, when the arrangement leaves nothing", () => {
    const html = draw("/tasks?filter=holds:none");
    expect(html).toContain("None of them.");
    expect(html).toContain("Show every one");
  });

  it("says what was searched when the words find nothing, and that the past needs is:any", () => {
    const html = draw("/tasks?q=zzzz");
    expect(html).toContain("Nothing here is called “zzzz”.");
    expect(html).toContain("Tasks, current ones; add is:any for past ones.");
    expect(html).toContain("Show every one");
    // The words may widen the horizon themselves, as in the Find box.
    expect(rows(draw("/tasks?q=milk"))).toEqual([]);
    expect(rows(draw("/tasks?q=milk%20is:any"))).toEqual(["t-milk"]);
  });
});
