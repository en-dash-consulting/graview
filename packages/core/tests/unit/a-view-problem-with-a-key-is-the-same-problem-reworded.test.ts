import { describe, expect, it } from "vitest";
import { problemsMade, viewProblemKey } from "../../src/revisions.js";

/*
 * A VIEW PROBLEM WITH A KEY IS THE SAME PROBLEM REWORDED (HQ
 * f-view-problem-key-follow-ups). A problem a view says may carry the key a
 * host files it by (a relation read without its far kind:
 * `far-kind-not-handed:<view>:<relation>:<kinds>`), made of names alone. Its
 * sentence may be reworded between versions; compared by its key, it is
 * neither made nor mended by the rewording. One with no key is still known
 * by its words.
 */
const key = "far-kind-not-handed:phase-board:inPhase:chunk";
const before = { view: "phase-board", says: '"phase-board" reads the relation "inPhase" and is handed no chunk.', key };
const after = { view: "phase-board", says: '"phase-board" reads "inPhase", and no chunk reaches it: add "chunk" to reads.kinds.', key };

describe("a view problem's key", () => {
  it("keys a problem by its own key, so a reworded sentence is the same problem", () => {
    expect(viewProblemKey(before)).toBe(viewProblemKey(after));
    const made = problemsMade({ views: [before] }, { views: [after] });
    expect(made.made).toEqual([]);
    expect(made.mended).toEqual([]);
    expect(made.text).toBe("This change broke nothing that held.");
  });

  it("still tells two problems with different keys apart, and one with no key by its words", () => {
    expect(viewProblemKey(before)).not.toBe(viewProblemKey({ ...before, key: "far-kind-not-handed:phase-board:inPhase:step" }));
    const plain = { view: "phase-board", says: "a part failed" };
    expect(viewProblemKey(plain)).not.toBe(viewProblemKey({ ...plain, says: "a part failed to draw" }));
    const made = problemsMade({ views: [plain] }, { views: [{ ...plain, says: "a part failed to draw" }] });
    expect(made.made.map((one) => one.says)).toEqual(["a part failed to draw"]);
  });
});
