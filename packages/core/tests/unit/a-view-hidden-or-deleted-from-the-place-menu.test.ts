import { describe, expect, it } from "vitest";
import { memoryViews, removedLensName, type LensTidyEdit, type RemovedView } from "../../src/index.js";

/**
 * A VIEW HIDDEN OR DELETED FROM THE PLACE MENU (Roadmap f-place-menu-views).
 * The host keeps script views; `memoryViews` is the keeping a page, a test
 * or `graview serve` uses: a deleted view kept thirty days, then gone for
 * good (`useTidiedViews` on `@graview/react` is the registry as it leaves it).
 */
describe("a view hidden or deleted from the place menu", () => {
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
