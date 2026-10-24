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

  /*
   * A DELETED HOME VIEW IS NOT THE HOME (Roadmap f-deleted-view-still-public).
   * The home's own view had no name, so a host listing it as deleted could
   * not take it off the home: whoever was handed the registry with it in —
   * a signed-out visitor, say — was drawn the view its owner had deleted.
   */
  it("draws the home view given before a deleted one, and the derived home when every one is deleted", () => {
    const views = registry();
    views.home?.("the nest", { name: "nest" });
    views.home?.("the story", { name: "story" });
    expect(views.homeView?.()).toBe("the story");
    const removed = (...names: string[]) => names.map((name) => ({ name, title: name, at: "2026-10-22T06:00:00.000Z", until: "2026-11-21T06:00:00.000Z" }));
    expect(tidyViews(views, { hidden: [], removed: removed("story") }).homeView?.()).toBe("the nest");
    expect(tidyViews(views, { hidden: [], removed: removed("story", "nest") }).homeView?.()).toBeUndefined();
    // Hidden is a word for the lists, which the home is not on: a hidden home view is still the home.
    expect(tidyViews(views, { hidden: ["story"], removed: [] }).homeView?.()).toBe("the story");
  });

  it("is answered as the registry itself when nothing is tidied", () => {
    const views = registry();
    expect(tidyViews(views, { hidden: [], removed: [] })).toBe(views);
  });

});
