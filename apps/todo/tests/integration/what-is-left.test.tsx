import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../../src/data/example.json";
import { todoViews } from "../../src/ui/views.js";
import { labelsThatFit, whatIsLeft } from "../../src/ui/what-is-left.js";

type Task = { id: string; kind: string; label: string; done: boolean; due?: string };
const tasks = (example.nodes as Task[]).filter((node) => node.kind === "task");

/**
 * WHAT IS LEFT, ON THE EXAMPLE, SAYS SOMETHING IS LEFT.
 *
 * Seven tasks with a date are still open in the example, so the picture's
 * first day reads seven and its last reads one. A picture that read "0 left"
 * on every day over that data — a flat line along the bottom — looked broken
 * because it was, and the days are said as a person reads them ("26 Aug"),
 * not as the record keeps them.
 */
describe("what is left", () => {
  it("counts the open tasks due on each day or later, on the example", () => {
    const left = whatIsLeft(tasks);
    expect(left.days.map((one) => one.left)).toEqual([7, 7, 7, 6, 5, 4, 2, 1]);
    expect(left.peak).toBe(7);
    expect(left.open).toBe(7);
    expect(left.done).toBe(2);
    expect(left.undated).toBe(3);
    expect(left.days[0]).toMatchObject({ day: "2026-08-26", said: "26 Aug" });
    expect(left.days.at(-1)).toMatchObject({ day: "2026-09-05", said: "5 Sep" });
  });

  it("says the year only when the days cross one", () => {
    const left = whatIsLeft([
      { done: false, due: "2026-12-30" },
      { done: false, due: "2027-01-02" },
    ]);
    expect(left.days.map((one) => one.said)).toEqual(["30 Dec 2026", "2 Jan 2027"]);
  });

  it("counts a task as done only when it is, not when its value merely is not false", () => {
    // `done` is a boolean; a view reads the record as it is stored.
    const left = whatIsLeft([{ done: false, due: "2026-09-01" }, { done: true, due: "2026-09-02" }]);
    expect(left.days.map((one) => one.left)).toEqual([1, 0]);
  });

  it("thins the day labels to what fits the width, keeping the first and the last", () => {
    const xs = Array.from({ length: 20 }, (_, index) => index * 20);
    const kept = labelsThatFit(xs, () => 40, 8);
    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(19);
    for (let at = 1; at < kept.length; at += 1) expect(xs[kept[at]!]! - xs[kept[at - 1]!]!).toBeGreaterThanOrEqual(48);
    // A wide box keeps every one.
    expect(labelsThatFit([0, 100, 200], () => 40, 8)).toEqual([0, 1, 2]);
  });

  it("draws the example with a nonzero count and its days in words", () => {
    const views = todoViews();
    const View = views.resolve("task", { cardinality: "many", fidelity: "full" }, "what-is-left")!.view;
    const html = renderToStaticMarkup(
      <View nodes={tasks as never} label="What is left" fidelity="full" cardinality="many" mode="fullscreen" selected={false} />,
    );
    expect(html).toContain("26 Aug: 7 left");
    expect(html).toContain("5 Sep: 1 left");
    expect(html).not.toContain("2026-08-26");
    expect(html).not.toMatch(/: 0 left/);
  });

  it("says in words when everything with a date is done, rather than drawing a flat line", () => {
    const views = todoViews();
    const View = views.resolve("task", { cardinality: "many", fidelity: "full" }, "what-is-left")!.view;
    const finished = tasks.map((task) => (task.due ? { ...task, done: true } : task));
    const html = renderToStaticMarkup(
      <View nodes={finished as never} label="What is left" fidelity="full" cardinality="many" mode="fullscreen" selected={false} />,
    );
    expect(html).toContain("Everything with a date is done");
    expect(html).not.toContain("burndown-canvas");
  });

  it("says in words when nothing has a date, or only one day does", () => {
    const views = todoViews();
    const View = views.resolve("task", { cardinality: "many", fidelity: "full" }, "what-is-left")!.view;
    const draw = (nodes: unknown[]) =>
      renderToStaticMarkup(<View nodes={nodes as never} label="What is left" fidelity="full" cardinality="many" mode="fullscreen" selected={false} />);
    expect(draw([{ id: "a", kind: "task", label: "A", done: false }])).toContain("Nothing has a date yet");
    expect(draw([{ id: "a", kind: "task", label: "A", done: false, due: "2026-08-28" }])).toContain("Only 28 Aug has anything due: 1 still open.");
  });
});
