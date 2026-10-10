// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Graph, isoDate, type Arrangement } from "@graview/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ArrangeBar, preloadArrangeLists } from "../../src/index.js";

// The lists the line opens come when first wanted; here, before the first press.
await preloadArrangeLists();

/**
 * A LIST ARRANGES ON ONE QUIET LINE.
 *
 * Nick, on Graview Cloud's "Purchase scenarios": "these filters/controls
 * are annoying, ugly, and consume a lot of real estate". The list opened
 * with "Sort by [as they come ▾]", "Group by [nothing ▾]" and a full-width
 * "Only… ▾" — three form boxes, two of them saying a non-choice. The line
 * is the count and three words now, each opening a short list; a default
 * says nothing, a choice says itself, and the keyboard reaches every option.
 */
const list = defineNode("list", { fields: z.object({ label: z.string() }), edges: { holds: { to: ["task"], description: "the tasks on this list", inverse: "the list it is on" } } });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean(), due: isoDate.optional(), size: z.enum(["small", "large"]).optional() }),
  display: { labels: { due: "Due date" } },
  plural: "Tasks",
});
const schema = createSchema([list, task]);
const graph = Graph.from(schema, {
  nodes: [
    { id: "today", kind: "list", label: "Today" },
    { id: "t1", kind: "task", label: "Book the van", done: false, due: "2026-09-01", size: "small" },
    { id: "t2", kind: "task", label: "Pack the books", done: false, due: "2026-09-03", size: "large" },
  ],
  edges: [{ kind: "holds", from: "today", to: "t1" }],
} as never);

let host: HTMLDivElement;
let root: Root;
let arrangement: Arrangement;
const draw = (next: Arrangement = {}, kept = { shown: 2, of: 2 }) => {
  arrangement = next;
  act(() =>
    root.render(
      <ArrangeBar
        schema={schema}
        graph={graph}
        kind="task"
        arrangement={arrangement}
        onChange={(changed) => draw(changed, kept)}
        kept={kept}
        noun={{ one: "task", many: "tasks" }}
        query={false}
        testId={`line-${Math.random().toString(36).slice(2)}`}
      />,
    ),
  );
};
const $ = (selector: string) => host.querySelector<HTMLElement>(selector);
const byId = (suffix: string) => $(`[data-testid$="-${suffix}"]`);
const press = (element: HTMLElement | null) => act(() => element!.click());
const key = (name: string) => act(() => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true })));

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the arranging line", () => {
  it("says the count once, in words, then Sort, Group and Filter — no select, no box, no non-choice", () => {
    draw();
    expect(byId("count")?.textContent).toBe("2 tasks");
    expect(byId("sort")?.textContent).toBe("Sort");
    expect(byId("group")?.textContent).toBe("Group");
    expect(byId("add")?.textContent).toBe("Filter");
    expect(host.querySelector("select")).toBeNull();
    expect(host.textContent).not.toMatch(/as they come|nothing|Only…/);
    // A default reads as an invitation; a choice says itself.
    expect(byId("sort")?.hasAttribute("data-set")).toBe(false);
  });

  it("says a narrowed list as how many of how many, and each condition as words with a way to take it off", () => {
    draw({ filter: [{ key: "holds", value: "today" }] }, { shown: 1, of: 2 });
    expect(byId("count")?.textContent).toBe("1 of 2 tasks");
    const token = byId("condition")!;
    expect(token.textContent).toContain("The list it is on: Today");
    press(token.querySelector("button"));
    expect(arrangement.filter).toBeUndefined();
  });

  it("opens each list from its word, the keyboard in at the choice made, walked by the arrows, and Escape gives it back", () => {
    draw({ sort: { by: "due", direction: "desc" } });
    const sort = byId("sort")!;
    expect(sort.textContent).toContain("Sorted by due date");
    expect(sort.getAttribute("aria-label")).toBe("Sorted by due date, latest first");
    sort.focus();
    press(sort);
    expect(sort.getAttribute("aria-expanded")).toBe("true");
    const pane = $('[data-testid="arrange-list"]')!;
    expect(pane).not.toBeNull();
    expect(document.activeElement?.getAttribute("data-value")).toBe("due");
    // The direction lives in the list, in the words its values read in.
    expect(pane.textContent).toContain("Earliest first");
    expect(pane.textContent).toContain("Latest first");
    key("ArrowDown");
    expect(document.activeElement?.getAttribute("data-value")).not.toBe("due");
    key("Home");
    expect(document.activeElement?.getAttribute("data-value")).toBe("");
    key("Escape");
    expect($('[data-testid="arrange-list"]')).toBeNull();
    expect(document.activeElement).toBe(byId("sort"));
  });

  it("reaches every way to arrange from the keyboard: a sort, a direction, a grouping and its width, a condition", () => {
    draw();
    press(byId("sort"));
    press($('[data-testid="arrange-list"] [data-value="due"]'));
    expect(arrangement.sort).toEqual({ by: "due", direction: "asc" });
    press(byId("sort"));
    press($('[data-testid$="-direction-desc"]'));
    expect(arrangement.sort).toEqual({ by: "due", direction: "desc" });
    press(byId("group"));
    press($('[data-testid="arrange-list"] [data-value="due"]'));
    press(byId("group"));
    press($('[data-testid$="-bucket-month"]'));
    expect(arrangement.group).toEqual({ by: "due", bucket: "month" });
    expect(byId("group")?.textContent).toContain("Grouped by due date, a month each");
    press(byId("add"));
    press($('[data-testid="arrange-list"] [data-value="size:large"]'));
    expect(arrangement.filter).toEqual([{ key: "size", value: "large" }]);
    // A condition already on is pressed in the list, and pressing it again takes it off.
    press(byId("add"));
    expect($('[data-testid="arrange-list"] [data-value="size:large"]')?.getAttribute("aria-pressed")).toBe("true");
    press($('[data-testid="arrange-list"] [data-value="size:large"]'));
    expect(arrangement.filter).toBeUndefined();
  });

  it("has one Arrange for a narrow line, which holds the sort, the grouping and the filter in one list", () => {
    draw();
    press(byId("all"));
    const pane = $('[data-testid="arrange-list"]')!;
    expect([...pane.querySelectorAll("[role=group]")].map((group) => group.getAttribute("aria-label")).filter((name) => ["Sort", "Group", "Filter"].includes(name ?? ""))).toEqual(["Sort", "Group", "Filter"]);
  });

  it("is the count alone when the surface declines arranging", () => {
    act(() => root.render(<ArrangeBar schema={schema} graph={graph} kind="task" arrangement={{}} onChange={() => {}} kept={{ shown: 1, of: 1 }} noun={{ one: "task", many: "tasks" }} allow={false} />));
    expect(byId("count")?.textContent).toBe("1 task");
    expect(byId("sort")).toBeNull();
    expect(byId("query")).toBeNull();
  });
});
