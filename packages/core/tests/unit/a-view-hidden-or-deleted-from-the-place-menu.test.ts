import { describe, expect, it } from "vitest";
import { createSchema, createViewRegistry, defineNode, memoryViews, removedLensName, tidyViews, z, type LensTidyEdit, type RemovedView } from "../../src/index.js";

/**
 * A VIEW HIDDEN OR DELETED FROM THE PLACE MENU (Roadmap f-place-menu-views).
 * The host keeps script views; `memoryViews` is the keeping a page, a test
 * or `graview serve` uses, and `tidyViews` the registry as it leaves it: a
 * hidden view off the lists and still at its address, a deleted one gone
 * from everywhere for thirty days and then for good.
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

describe("a view hidden or deleted from the place menu", () => {
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

  it("keeps a deleted view thirty days under Recently deleted, restores it, and forgets it after", async () => {
    let now = Date.parse("2026-10-19T12:00:00.000Z");
    const kept = memoryViews({ now: () => now, by: () => "Nick" });
    let told = 0;
    kept.onChange?.(() => told++);
    await kept.hide("board");
    expect(kept.current().hidden).toEqual(["board"]);
    await kept.show("board");
    expect(kept.current().hidden).toEqual([]);
    await kept.remove("board", { title: "Board", kind: "task" });
    const [removed] = kept.current().removed;
    expect(removed).toEqual({ name: "board", title: "Board", kind: "task", at: "2026-10-19T12:00:00.000Z", until: "2026-11-18T12:00:00.000Z", by: "Nick" });
    await kept.restore("board");
    expect(kept.current().removed).toEqual([]);
    await kept.remove("board", { title: "Board", kind: "task" });
    now += 30 * 86_400_000;
    expect(kept.current().removed).toEqual([]);
    await expect(kept.restore("board")).rejects.toThrow(/Nothing called "board" was deleted in the last 30 days/);
    expect(told).toBe(5);
  });

  it("offers declared lenses only where the host writes the declaration, and restores a removed lens by its rollback", async () => {
    expect(memoryViews({ may: { views: true, lenses: true } }).current().may).toEqual({ views: true, lenses: false });
    const changes: LensTidyEdit[] = [];
    const restored: RemovedView[] = [];
    const kept = memoryViews({ may: { views: true, lenses: true }, declaration: { change: (edit) => void changes.push(edit), restore: (entry) => void restored.push(entry) } });
    expect(kept.current().may.lenses).toBe(true);
    await kept.lens?.({ op: "set-lens-hidden", title: "By day", hidden: true });
    await kept.lens?.({ op: "remove-lens", title: "By day", on: "task" });
    expect(changes.map((edit) => edit.op)).toEqual(["set-lens-hidden", "remove-lens"]);
    expect(kept.current().removed[0]).toMatchObject({ name: removedLensName("By day"), title: "By day", kind: "task", lens: true });
    await kept.restore(removedLensName("By day"));
    expect(restored.map((entry) => entry.title)).toEqual(["By day"]);
    expect(kept.current().removed).toEqual([]);
  });
});
