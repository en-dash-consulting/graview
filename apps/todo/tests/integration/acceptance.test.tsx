import { deriveAffordances, createToolRuntime } from "@graview/tools";
import { EMPTY_VIEW, layout } from "@graview/layout";
import { GraviewProvider, Scene } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { todoApp } from "../../src/domain/app.js";
import { todoSchema } from "../../src/domain/schema.js";
import { EXAMPLE_TODAY, HOME, INITIAL_VIEW, PLACES, createTodoUiStore } from "../../src/ui/app.js";
import { todoViews } from "../../src/ui/views.js";
import { declaredLenses } from "@graview/core";
import { createTimelineLens, fetchDeclaredLenses, type TimelineOptions } from "@graview/primitives";

// The declared lenses are fetched as they are first drawn; a static render draws them only once they are here.
beforeAll(() => fetchDeclaredLenses());

/** The week, made from the declaration the way the framework draws it (FR-79): the app registers none. */
const declaredWeek = declaredLenses(todoApp).drawn.find((lens) => lens.lens === "timeline")!;
const weekLens = createTimelineLens(declaredWeek.options as unknown as TimelineOptions);

/**
 * The example, held to the same standard as the apps built to prove things.
 *
 * A demo nobody checks is a demo that rots, and this one is the first thing a
 * stranger reads — so it gets the same treatment: the rules must fire on the
 * data shipped with it, the repairs must resolve what they claim to, and the
 * lens borrowed from another domain must actually work.
 */

/*
 * The day the shipped example is written around.
 *
 * Named rather than "today" because that is the point: the rules are judged
 * against a date the caller supplies, so a test can ask what would be overdue
 * on a particular morning without moving anybody's system clock.
 */
const context = { today: EXAMPLE_TODAY };
const HUMAN = { kind: "human" as const, id: "you" };

describe("a todo list is enough to show the whole shape", () => {
  it("declares a kind, a mutation, a rule and a lens, and passes its own check", () => {
    // The domain's four, and the installation's two — who is here is in the
    // graph, as ordinary kinds, drawn only for the seat that keeps them.
    expect(todoApp.schema.kinds).toEqual(["list", "task", "rule", "reason", "user", "invitation"]);
    expect(todoApp.mutations?.length).toBeGreaterThan(5);
    expect(todoApp.invariants?.length).toBe(3);
    expect(todoApp.lenses?.map((lens) => lens.name)).toEqual(["reach", "calendar", "timeline"]);
  });

  it("draws its declared lenses as places with no registration of its own (FR-79)", () => {
    /*
     * The week, the month and who may do what are declared, with titles,
     * and the UI registers none of them: they are on the bar because the
     * declaration says so. The week is the tasks' default picture, as it
     * was when the app registered it last by hand.
     */
    const views = todoViews();
    expect(views.places().map((place) => place.title)).toEqual(expect.arrayContaining(["Who may do what", "The month", "The week", "The lists", "What is left"]));
    expect(declaredWeek.options["columns"]).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((id) => ({ id, label: id.toUpperCase() })));
    expect(views.resolve("task", { cardinality: "many", fidelity: "full" })?.title).toBe("The week");
  });

  it("reuses a lens written for a household's week, unchanged", () => {
    /*
     * The framework's central claim, in the smallest app. The timeline has
     * never heard of a task; this app said which of its fields are `start`,
     * `end` and the column, and got a week.
     */
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const placed = weekLens.place(store.graph.nodesOfKind("task") as never, todoSchema);
    expect(placed.length).toBeGreaterThan(5);
    expect(placed.every((span) => span.columnIds.length > 0)).toBe(true);
  });

  it("leaves an UNPLANNED task off the week rather than inventing a slot", () => {
    /*
     * A due date says when something is needed; a plan says when you intend to
     * do it. Only the second can be drawn, and the someday pile has neither —
     * so it is simply absent, which is the honest answer.
     */
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const placed = weekLens.place(store.graph.nodesOfKind("task") as never, todoSchema);
    const drawn = new Set(placed.map((span) => span.id));
    expect(drawn.has("t-shelves")).toBe(false);
    expect(drawn.has("t-deposit")).toBe(true);
  });
});

describe("the rules fire on the data it ships with", () => {
  it("catches a task finished before the thing it waits for", () => {
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const violation = store
      .violations(context)
      .find((v) => v.invariant === "nothing-done-before-what-it-waits-for")!;
    expect(violation.message).toContain("Order boxes");
    expect(violation.message).toContain("piano");
    // Two honest ways out, and the framework offers both rather than choosing.
    expect(violation.repairs.map((r) => r.mutation).sort()).toEqual(["finish", "reopen"]);
  });

  it("resolves it through the repair it named, and undoes", () => {
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const before = store.violations(context).length;
    const violation = store
      .violations(context)
      .find((v) => v.invariant === "nothing-done-before-what-it-waits-for")!;
    const repair = violation.repairs.find((r) => r.mutation === "reopen")!;
    const applied = store.apply({ name: repair.mutation, args: repair.args! }, { author: HUMAN });

    expect(
      store.violations(context).some((v) => v.invariant === "nothing-done-before-what-it-waits-for"),
    ).toBe(false);
    store.undo(applied.batch);
    expect(store.violations(context).length).toBe(before);
  });

  it("judges overdue against a date THREADED THROUGH, not the clock", () => {
    /*
     * An invariant that read `new Date()` would give a different answer every
     * morning and could not be tested at all — and `preview` could not say
     * what a change would break.
     */
    const store = createTodoUiStore(EXAMPLE_TODAY);
    expect(store.violations({ today: "2026-08-27" }).some((v) => v.invariant === "nothing-overdue")).toBe(
      false,
    );
    const late = store.violations(context).find((v) => v.invariant === "nothing-overdue")!;
    expect(late.message).toContain("Pay the deposit");
    // Missing arguments are named, so the interface offers a date picker
    // without anyone wiring one up per mutation.
    expect(late.repairs.find((r) => r.mutation === "reschedule")?.missing).toEqual(["due"]);
  });

  it("says nothing about overdue when nobody supplied a today", () => {
    // Absent is not "everything is fine": the rule declines to guess.
    expect(createTodoUiStore(EXAMPLE_TODAY).violations({}).some((v) => v.invariant === "nothing-overdue")).toBe(
      false,
    );
  });
});

describe("what can be done, derived", () => {
  it("offers a task's verbs without anyone writing a menu", () => {
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const derived = deriveAffordances(store, ["t-deposit"], { context });
    const names = derived.affordances.map((a) => a.mutation);
    expect(names).toContain("finish");
    expect(names).toContain("reschedule");
    // And the repair for the rule it breaks outranks the ordinary verbs,
    // because a thing that is currently wrong is more interesting than a
    // thing you could do.
    expect(derived.affordances[0]!.provider).toBe("invariant");
  });

  it("says what is true about a selection, not only what can be done", () => {
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const derived = deriveAffordances(store, ["t-deposit", "t-book"], { context });
    expect(derived.observations.length).toBeGreaterThan(0);
  });

  it("gives an agent the same actions, from the same declarations", async () => {
    const store = createTodoUiStore(EXAMPLE_TODAY);
    const seat = createToolRuntime(store, { author: { kind: "agent", id: "claude" } });
    const before = (store.graph.getNode("t-book") as unknown as { done: boolean }).done;
    const result = await seat.call("finish", { taskId: "t-book" });
    expect(result.ok).toBe(true);
    expect(before).toBe(false);
    expect((store.graph.getNode("t-book") as unknown as { done: boolean }).done).toBe(true);
    // In the log, attributed, and takeable back — like anything else.
    expect(store.log.all().at(-1)!.author).toMatchObject({ kind: "agent" });
  });
});

describe("the picture", () => {
  const render = (view = INITIAL_VIEW) =>
    renderToStaticMarkup(
      <GraviewProvider store={createTodoUiStore(EXAMPLE_TODAY)} views={todoViews()} initialView={view}>
        <Scene renderer="dom" />
      </GraviewProvider>,
    );

  it("opens on the lists, with every list placed", () => {
    const html = render();
    for (const label of ["Today", "This week", "Someday"]) expect(html).toContain(label);
  });

  it("draws the week when the week is the place", () => {
    const html = render({ ...EMPTY_VIEW, focusId: PLACES[0].id });
    // The lens's own columns, from this app's own days.
    expect(html).toContain(">Mon<");
    expect(html).toContain(">Sun<");
  });

  it("makes every task a real target", () => {
    // One attribute is the whole contract: the host routes a click on it to
    // that node, gives it a tab stop, and a single click selects in place.
    expect(render()).toContain('data-graview-pick="t-deposit"');
  });

  it("keeps everything it places inside the canvas", () => {
    const placed = layout(createTodoUiStore(EXAMPLE_TODAY).graph, todoSchema, INITIAL_VIEW, {
      width: 1400,
      height: 900,
    });
    for (const node of placed.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(1400);
      expect(node.y + node.height).toBeLessThanOrEqual(900);
    }
  });

  it("has a home that is one of its places", () => {
    expect(PLACES.map((place) => place.id)).toContain(HOME);
  });
});
