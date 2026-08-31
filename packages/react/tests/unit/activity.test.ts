import type { Operation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { markActivity, type ActivityMark } from "../../src/activity.js";

/**
 * Watching, without a renderer.
 *
 * The strongest argument for the overview is not orientation, it is being
 * able to see the system work — and everything that takes is already in the
 * op log: who moved, what they meant, what they read and what they wrote.
 * This is that reading, so it can be asked as a question rather than only
 * looked at.
 */

let seq = 0;
const op = (partial: Partial<Operation>): Operation => ({
  id: `op-${(seq += 1)}`,
  seq,
  batch: "batch-1",
  author: { kind: "human" },
  intent: "did something",
  mutation: null,
  primitives: [],
  inverse: [],
  reads: [],
  writes: [],
  at: new Date().toISOString(),
  ...partial,
});

const HOLD = 2600;
const empty = new Map<string, ActivityMark>();

describe("what just happened, per node", () => {
  it("marks what was written, and says who wrote it", () => {
    const marks = markActivity(
      empty,
      [op({ writes: ["ana"], intent: "Reassign the school run" })],
      [],
      1000,
      HOLD,
    );
    expect(marks.get("ana")).toMatchObject({
      wrote: true,
      read: false,
      manner: "directed",
      intent: "Reassign the school run",
    });
  });

  it("tells a turn an agent took on its own from one you directed", () => {
    const mine = markActivity(empty, [op({ writes: ["ana"] })], [], 1000, HOLD);
    const theirs = markActivity(
      empty,
      [op({ writes: ["ana"], author: { kind: "agent", id: "claude", session: "ui" } })],
      [],
      1000,
      HOLD,
    );
    expect(mine.get("ana")!.manner).toBe("directed");
    expect(theirs.get("ana")!.manner).toBe("autonomous");
  });

  it("calls it co-edited when two participants touch the same thing", () => {
    const first = markActivity(empty, [op({ writes: ["ana"] })], [], 1000, HOLD);
    const both = markActivity(
      first,
      [op({ writes: ["ana"], author: { kind: "agent", id: "claude", session: "ui" } })],
      [],
      1200,
      HOLD,
    );
    expect(both.get("ana")!.manner).toBe("co-edited");
    // Two agents in different sessions are two participants too — the log
    // already separates them, so nothing new is needed to notice.
    const twoAgents = markActivity(
      markActivity(
        empty,
        [op({ writes: ["bo"], author: { kind: "agent", id: "claude", session: "a" } })],
        [],
        1000,
        HOLD,
      ),
      [op({ writes: ["bo"], author: { kind: "agent", id: "claude", session: "b" } })],
      [],
      1100,
      HOLD,
    );
    expect(twoAgents.get("bo")!.manner).toBe("co-edited");
  });

  it("marks a rule's own repair as a rule", () => {
    const marks = markActivity(
      empty,
      [op({ writes: ["ana"], author: { kind: "rule" }, intent: "Restore the split" })],
      [],
      1000,
      HOLD,
    );
    expect(marks.get("ana")!.manner).toBe("rule");
  });

  it("shows what was READ as well as what was written", () => {
    /*
     * The half a diff cannot show. An agent that changed one thing after
     * looking at nine is doing something different from one that changed the
     * same thing after looking at none, and only the log knows which.
     */
    const marks = markActivity(
      empty,
      [
        op({
          author: { kind: "agent", id: "claude", session: "ui" },
          reads: ["ana", "bo", "morning"],
          writes: ["morning"],
        }),
      ],
      [],
      1000,
      HOLD,
    );
    expect(marks.get("ana")).toMatchObject({ read: true, wrote: false });
    expect(marks.get("bo")).toMatchObject({ read: true, wrote: false });
    // Written AND read is written: saying it was also looked at adds nothing.
    expect(marks.get("morning")).toMatchObject({ wrote: true });
  });

  it("flags a rule that has just begun to fail, on every node it implicates", () => {
    /*
     * Including nodes the change never touched. The whole reason to watch
     * from outside is that a change lands on one card and the consequence
     * appears on another — and seeing the second without having gone looking
     * for it is the thing a list of diffs cannot do.
     */
    const marks = markActivity(
      empty,
      [op({ writes: ["morning"] })],
      [{ nodeIds: ["morning", "ana"], message: "Duty split is uneven" }],
      1000,
      HOLD,
    );
    expect(marks.get("morning")!.broke).toBe(true);
    expect(marks.get("ana")).toMatchObject({
      broke: true,
      manner: "rule",
      intent: "Duty split is uneven",
      wrote: false,
    });
  });

  it("keeps earlier marks that are still inside the window", () => {
    // Two changes a second apart are two things happening, not one erasing
    // the other — which is the whole reason to watch rather than to poll.
    const first = markActivity(empty, [op({ writes: ["ana"] })], [], 1000, HOLD);
    const second = markActivity(first, [op({ writes: ["bo"] })], [], 2000, HOLD);
    expect([...second.keys()].sort()).toEqual(["ana", "bo"]);
  });

  it("drops marks that have aged out, so a quiet graph goes quiet", () => {
    const first = markActivity(empty, [op({ writes: ["ana"] })], [], 1000, HOLD);
    const later = markActivity(first, [op({ writes: ["bo"] })], [], 1000 + HOLD + 1, HOLD);
    expect([...later.keys()]).toEqual(["bo"]);
  });

  it("says nothing at all when nothing happened", () => {
    expect(markActivity(empty, [], [], 1000, HOLD).size).toBe(0);
  });
});
