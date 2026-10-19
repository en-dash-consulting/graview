import { createSchema, createViewRegistry, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { tidyViews } from "../../src/tidy-views.js";

/**
 * A REGISTRY TIDIED AS THE HOST KEEPS ITS VIEWS (Roadmap f-place-menu-views):
 * a hidden view is off the lists and still at its address, never its kind's
 * default; a deleted one is no place and never drawn.
 */
const schema = createSchema([defineNode("task", { fields: z.object({ title: z.string() }) })]);
const many = { cardinality: "many", fidelity: "full" } as const;

function registry() {
  const views = createViewRegistry<typeof schema, string>(schema);
  views.register("task", many, "the app's own list");
  views.register("task", many, "the board a chat drew", { title: "Board", name: "board" });
  views.register("task", many, "the week a chat drew", { title: "The week", name: "week", beside: true });
  return views;
}

describe("a registry tidied as the host keeps its views", () => {
  it("is a place kept off the lists while hidden, still reached by its address and no longer its kind's default", () => {
    const views = registry();
    expect(views.places().map((place) => place.name)).toEqual(["board", "week"]);
    const tidied = tidyViews(views, { hidden: ["board"], removed: [] });
    expect(tidied.places().find((place) => place.as === "board")?.hidden).toBe(true);
    expect(tidied.resolve("task", many, "board")?.view).toBe("the board a chat drew");
    expect(tidied.resolve("task", many)?.view).toBe("the app's own list");
    expect(tidied.lookup("task", many)).toBe("the app's own list");
    // The registry itself is untouched.
    expect(views.resolve("task", many)?.view).toBe("the board a chat drew");
  });

  it("is no place and never drawn while deleted, by its address either", () => {
    const tidied = tidyViews(registry(), { hidden: [], removed: [{ name: "week", title: "The week", at: "2026-10-19T00:00:00.000Z", until: "2026-11-18T00:00:00.000Z" }] });
    expect(tidied.places().map((place) => place.name)).toEqual(["board"]);
    expect(tidied.resolve("task", many, "the-week")?.view).toBe("the board a chat drew");
  });

  it("is answered as the registry itself when nothing is tidied", () => {
    const views = registry();
    expect(tidyViews(views, { hidden: [], removed: [] })).toBe(views);
  });

});
