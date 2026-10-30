import { describe, expect, it } from "vitest";
import { jevDecide, jevKeyFromEnvironment } from "../../src/providers/jev.js";

/*
 * THE MENU'S FAST SLOT, ASKED OF JEV ITSELF (Roadmap f-menu-type-anything).
 * Opt-in: it runs only where TYPESAFE_API_KEY (or JEV_API_KEY) is set, and
 * asserts only what a live model's answers must be — typed, among what was
 * offered, recorded as Jev's — never which way it judged.
 */
const key = jevKeyFromEnvironment();

describe.skipIf(!key)("the right-click menu's Fast slot, judged by Jev, live", () => {
  it("answers the menu's Choice over its rows, 'none of these' among them, with one of the options", async () => {
    const decide = jevDecide({ apiKey: key! });
    const decided = await decide({ typed: "complete" }, { row: { type: "choice", instructions: "Which of these menu rows does somebody typing “complete” mean?", criteria: { r1: "Rename it", r2: "Finish it", r3: "Copy link", none: "None of these rows" } } });
    const answer = decided.answers["row"];
    expect(answer?.type).toBe("choice");
    expect(["r1", "r2", "r3", "none"]).toContain(answer?.type === "choice" ? answer.choice : "");
  });

});
