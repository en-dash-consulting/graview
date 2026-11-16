import { capabilities, createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { listPageViewOf } from "../../src/list-page-view.js";
import { tidyViews } from "../../src/tidy-views.js";
import { createViews, markReplacesPage, type ViewComponent } from "../../src/view-registry.js";

/**
 * A KIND'S LIST PAGE IS THE LAST VIEW THAT REPLACES IT (FR-238). Graview
 * Cloud's `deliverables-board` said `replaces: "page"`, and a second titled
 * view of many on the kind registered after it won the kind's default cell,
 * so `/deliverables` drew the plain list. `listPageViewOf` answers the view
 * the list page draws whatever won the cell: the last view of many at full
 * that replaces the page and is still registered, and not tidied away.
 */
const schema = createSchema([defineNode("deliverable", { fields: z.object({ label: z.string() }) }), defineNode("client", { fields: z.object({ label: z.string() }) })]);
const many = { cardinality: "many", fidelity: "full" } as const;
const view = (replaces: boolean): ViewComponent<typeof schema> => {
  const drawn: ViewComponent<typeof schema> = () => null;
  return replaces ? markReplacesPage(drawn) : drawn;
};

describe("which view a kind's list page draws", () => {
  it("is the view that replaces the page, though another view of many registered after it wins the kind's cell", () => {
    const board = view(true);
    const status = view(false);
    const views = createViews(schema)
      .register("deliverable", many, board, { title: "Deliverables", name: "deliverables-board" })
      .register("deliverable", many, status, { title: "Status", name: "status" });
    expect(views.lookup("deliverable", many)).toBe(status);
    expect(listPageViewOf(views, "deliverable")?.name).toBe("deliverables-board");
    expect(listPageViewOf(views, "deliverable")?.view).toBe(board);
    expect(listPageViewOf(views, "client")).toBeUndefined();
  });

  it("is the last of several that replace it", () => {
    const views = createViews(schema)
      .register("deliverable", many, view(true), { title: "Board", name: "board" })
      .register("deliverable", many, view(true), { title: "Kanban", name: "kanban" })
      .register("deliverable", many, view(false), { title: "Status", name: "status" });
    expect(listPageViewOf(views, "deliverable")?.name).toBe("kanban");
  });

  it("is none where no view of many replaces it", () => {
    const views = createViews(schema).register("deliverable", many, view(false), { title: "Status", name: "status" }).register("deliverable", { cardinality: "one", fidelity: "full" }, view(true), { name: "one" });
    expect(listPageViewOf(views, "deliverable")).toBeUndefined();
  });

  it("is none for a view the host deleted or hid, and the one before it is the list page again", () => {
    const views = createViews(schema)
      .register("deliverable", many, view(true), { title: "Board", name: "board" })
      .register("deliverable", many, view(true), { title: "Kanban", name: "kanban" })
      .register("deliverable", many, view(false), { title: "Status", name: "status" });
    expect(listPageViewOf(tidyViews(views, { hidden: ["kanban"], removed: [] }), "deliverable")?.name).toBe("board");
    const gone = tidyViews(views, { hidden: [], removed: [{ name: "kanban", title: "Kanban", at: "2026-11-15T00:00:00.000Z", until: "2026-12-15T00:00:00.000Z" }] });
    expect(listPageViewOf(gone, "deliverable")?.name).toBe("board");
    expect(listPageViewOf(tidyViews(gone, { hidden: ["board"], removed: [] }), "deliverable")).toBeUndefined();
  });

  it("is none for a view replaced since by one that does not replace the page, under its title or in its cell", () => {
    const titled = createViews(schema).register("deliverable", many, view(true), { title: "Board", name: "board" }).register("deliverable", many, view(false), { title: "Board", name: "board" });
    expect(listPageViewOf(titled, "deliverable")).toBeUndefined();
    const untitled = createViews(schema).register("deliverable", many, view(true)).register("deliverable", many, view(false));
    expect(listPageViewOf(untitled, "deliverable")).toBeUndefined();
    const renamed = createViews(schema).register("deliverable", many, view(true), { title: "Board", name: "board" }).register("deliverable", many, view(false), { title: "Kanban", name: "board" });
    expect(listPageViewOf(renamed, "deliverable")).toBeUndefined();
    // Its place taken away, and the kind's cell taken since by a view that does not replace the page.
    const forgotten = createViews(schema).register("deliverable", many, view(true), { title: "Board", name: "board" }).register("deliverable", many, view(false), { name: "plain" });
    forgotten.forget?.("deliverable", "board");
    expect(listPageViewOf(forgotten, "deliverable")).toBeUndefined();
  });

  it("is an untitled view that replaces it, though a titled view of many registered after it", () => {
    const roll = view(true);
    const views = createViews(schema).register("deliverable", many, roll, { name: "roll" }).register("deliverable", many, view(false), { title: "Status", name: "status" });
    expect(listPageViewOf(views, "deliverable")?.view).toBe(roll);
  });

  it("is the view whose place shares its title with one the host deleted", () => {
    const views = createViews(schema).register("deliverable", many, view(true), { title: "Board", name: "a" }).register("deliverable", many, view(false), { title: "Board", name: "b" });
    expect(listPageViewOf(views, "deliverable")).toBeUndefined();
    const tidied = tidyViews(views, { hidden: [], removed: [{ name: "b", title: "Board", at: "2026-11-15T00:00:00.000Z", until: "2026-12-15T00:00:00.000Z" }] });
    expect(listPageViewOf(tidied, "deliverable")?.name).toBe("a");
  });

  it("is the view made after one of the same title the host deleted", () => {
    const views = createViews(schema).register("deliverable", many, view(false), { title: "Board", name: "b" }).register("deliverable", many, view(true), { title: "Board", name: "a" });
    const tidied = tidyViews(views, { hidden: [], removed: [{ name: "b", title: "Board", at: "2026-11-15T00:00:00.000Z", until: "2026-12-15T00:00:00.000Z" }] });
    expect(listPageViewOf(tidied, "deliverable")?.name).toBe("a");
    expect(tidied.resolve("deliverable", many, "board")?.name).toBe("a");
  });

  it("is none for a view beside the kind's pictures or kept off the lists", () => {
    const views = createViews(schema).register("deliverable", many, view(true), { title: "Board", name: "board", beside: true }).register("deliverable", many, view(true), { title: "Kept", name: "kept", hidden: true });
    expect(listPageViewOf(views, "deliverable")).toBeUndefined();
  });

  it("is a seam the framework says it ships", () => {
    expect(capabilities().shipped).toContain("FR-238");
  });
});
