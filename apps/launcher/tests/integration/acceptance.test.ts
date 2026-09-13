import { describe, expect, it } from "vitest";
import { seedbedApp } from "@graview/seedbed";
import { todoApp } from "@graview/todo";
import { createLauncherStore, launcherApp } from "../../src/domain/app.js";
import { APPS, CAPABILITIES, surfaceOf } from "../../src/domain/survey.js";

/**
 * The desk holds itself to what it asks of everyone else.
 *
 * It was a Graview scene before — a store, a matrix, an inspector — which is
 * not the same thing as a Graview app. These are the differences, stated as
 * the things that were missing.
 */

describe("the desk is an app, not just a scene", () => {
  it("declares itself, so `graview check` can check it", () => {
    expect(launcherApp.name).toBe("launcher");
    expect(launcherApp.schema.kinds).toContain("desk");
    expect((launcherApp.mutations ?? []).length).toBeGreaterThan(0);
    expect((launcherApp.invariants ?? []).length).toBe(3);
  });

  it("reads the other apps rather than describing them", () => {
    // Nothing is written down twice: an app that gains a lens shows it here
    // without anyone editing a list.
    const store = createLauncherStore();
    const todo = store.graph.getNode("todo")!;
    const counted = surfaceOf(todoApp as never);
    expect(todo["kinds"]).toBe(counted.kinds);
    expect(todo["rules"]).toBe(counted.rules);
    expect(counted.kinds).toBe(todoApp.schema.kinds.length);
  });

  it("decides every capability by looking, never by remembering", () => {
    const timeline = CAPABILITIES.find((item) => item.id === "cap-timeline")!;
    expect(timeline.holds(todoApp as never)).toBe(true);
    expect(timeline.holds(seedbedApp as never)).toBe(false);
    const board = CAPABILITIES.find((item) => item.id === "cap-board")!;
    expect(board.holds(todoApp as never)).toBe(false);
  });
});

describe("what is in front of you lives in the graph", () => {
  /*
   * The one thing this surface does was React state and a query string, so
   * it was invisible to the log, could not be undone, and sat outside the
   * model the whole framework is about.
   */
  it("opens an app by running a mutation", () => {
    const store = createLauncherStore();
    expect(store.graph.out("desk", "showing")).toHaveLength(0);
    store.apply({ name: "show-app", args: { appId: "todo" } });
    expect(store.graph.out("desk", "showing").map((node) => node.id)).toEqual(["todo"]);
  });

  it("records who opened it, and lets it be undone", () => {
    const store = createLauncherStore();
    store.apply({ name: "show-app", args: { appId: "todo" } }, { author: { kind: "human" } });
    const batch = store.batches().at(-1)!;
    expect(batch.author.kind).toBe("human");
    expect(batch.intent).toContain("Open");
    store.undo(batch.id);
    expect(store.graph.out("desk", "showing")).toHaveLength(0);
  });

  it("shows one app at a time, so switching is one gesture", () => {
    const store = createLauncherStore();
    store.apply({ name: "show-app", args: { appId: "todo" } });
    store.apply({ name: "show-app", args: { appId: "seedbed" } });
    expect(store.graph.out("desk", "showing").map((node) => node.id)).toEqual(["seedbed"]);
  });

  it("seeds itself from a link, so a shared URL lands where it says", () => {
    const store = createLauncherStore("seedbed");
    expect(store.graph.out("desk", "showing").map((node) => node.id)).toEqual(["seedbed"]);
  });
});

describe("the desk can say the framework is wrong", () => {
  it("names a capability nothing uses", () => {
    const store = createLauncherStore();
    const unused = store.violations().find((v) => v.invariant === "every-capability-is-earned")!;
    expect(unused.message).toContain("maintained for nobody");
  });

  it("says a lens with one user is unproven", () => {
    /*
     * The argument this whole exercise has been making out loud, enforced
     * rather than asserted. With the product apps in their own repositories
     * it fires on the timeline — only the todo example binds it here — and
     * the honest thing is to let it say so rather than soften the rule.
     */
    const store = createLauncherStore();
    const unproven = store.violations().find((v) => v.invariant === "a-lens-needs-two-users")!;
    expect(unproven.message).toContain("Timeline lens");
    expect(unproven.message).toContain("one user does not prove a lens");
  });

  it("accepts an argument, but insists there is one", () => {
    const store = createLauncherStore();
    const before = store.violations().length;
    store.apply({
      name: "justify",
      args: { id: "cap-timeline", text: "Proven by a household week and a coaching week, in their own repositories." },
    });
    const after = store.violations();
    expect(after).toHaveLength(before - 1);
    expect(after.some((v) => v.invariant === "a-lens-needs-two-users")).toBe(false);
  });

  it("holds once every app it ships declares a lens", () => {
    /*
     * The garden drew its own picture and declared no lens, and the desk
     * said so rather than letting a rule pass by omission. It declares the
     * calendar now — a planting is a span, sown in March and brought in in
     * July, which is the shape a garden is planned around — so the rule
     * holds for the reason it exists to check rather than because anybody
     * softened it.
     */
    const store = createLauncherStore();
    expect(store.violations().find((v) => v.invariant === "every-app-uses-a-lens")).toBeUndefined();
    expect(APPS).toHaveLength(2);
  });
});
