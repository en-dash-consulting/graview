import { describe, expect, it } from "vitest";
import { householdApp } from "the household example";
import { coachingApp } from "the coaching example";
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
    const the coaching example = store.graph.getNode("the coaching example")!;
    const counted = surfaceOf(coachingApp as never);
    expect(the coaching example["kinds"]).toBe(counted.kinds);
    expect(the coaching example["rules"]).toBe(counted.rules);
    expect(counted.kinds).toBe(coachingApp.schema.kinds.length);
  });

  it("decides every capability by looking, never by remembering", () => {
    const timeline = CAPABILITIES.find((item) => item.id === "cap-timeline")!;
    expect(timeline.holds(householdApp as never)).toBe(true);
    const board = CAPABILITIES.find((item) => item.id === "cap-board")!;
    expect(board.holds(householdApp as never)).toBe(false);
    expect(board.holds(coachingApp as never)).toBe(true);
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
    store.apply({ name: "show-app", args: { appId: "the coaching example" } });
    expect(store.graph.out("desk", "showing").map((node) => node.id)).toEqual(["the coaching example"]);
  });

  it("records who opened it, and lets it be undone", () => {
    const store = createLauncherStore();
    store.apply({ name: "show-app", args: { appId: "the coaching example" } }, { author: { kind: "human" } });
    const batch = store.batches().at(-1)!;
    expect(batch.author.kind).toBe("human");
    expect(batch.intent).toContain("Open");
    store.undo(batch.id);
    expect(store.graph.out("desk", "showing")).toHaveLength(0);
  });

  it("shows one app at a time, so switching is one gesture", () => {
    const store = createLauncherStore();
    store.apply({ name: "show-app", args: { appId: "the coaching example" } });
    store.apply({ name: "show-app", args: { appId: "proposal" } });
    expect(store.graph.out("desk", "showing").map((node) => node.id)).toEqual(["proposal"]);
  });

  it("seeds itself from a link, so a shared URL lands where it says", () => {
    const store = createLauncherStore("the household example");
    expect(store.graph.out("desk", "showing").map((node) => node.id)).toEqual(["the household example"]);
  });
});

describe("the desk can say the framework is wrong", () => {
  it("names a capability nothing uses", () => {
    const store = createLauncherStore();
    const unused = store.violations().find((v) => v.invariant === "every-capability-is-earned")!;
    expect(unused.message).toContain("maintained for nobody");
  });

  it("says a lens with one user is unproven — about the lens written last", () => {
    /*
     * The argument this whole exercise has been making out loud, enforced
     * rather than asserted. It fires on the board lens today, and the honest
     * thing is to let it say so rather than soften the rule until it passes.
     */
    const store = createLauncherStore();
    const unproven = store.violations().find((v) => v.invariant === "a-lens-needs-two-users")!;
    expect(unproven.message).toContain("Board lens");
    expect(unproven.message).toContain("one user does not prove a lens");
  });

  it("accepts an argument, but insists there is one", () => {
    const store = createLauncherStore();
    const before = store.violations().length;
    store.apply({
      name: "justify",
      args: { id: "cap-board", text: "Proven against a seating plan in the lens's own tests." },
    });
    const after = store.violations();
    expect(after).toHaveLength(before - 1);
    expect(after.some((v) => v.invariant === "a-lens-needs-two-users")).toBe(false);
  });

  it("passes its own third rule, because every app here declares a lens", () => {
    const store = createLauncherStore();
    expect(store.violations().some((v) => v.invariant === "every-app-uses-a-lens")).toBe(false);
    expect(APPS).toHaveLength(3);
  });
});
