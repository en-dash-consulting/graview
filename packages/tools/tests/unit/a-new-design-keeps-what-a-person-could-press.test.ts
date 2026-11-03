import { describe, expect, it } from "vitest";
import { CONTROL_WORDS, IT_DOES_NOT_WORK, pressFindings, pressSaid, type PressSaid } from "../../src/section.js";

/*
 * INTERACTIVE PARITY (Roadmap f-make-any-page-better): a new design keeps
 * what the page let a person do on each record — finish it, open it — bound
 * to the same act and accepted when pressed, and what its controls do is
 * said from that press check, never from the model's own account.
 */
const wanted = [
  { label: "Write the brief", id: "t1", presses: true, opens: true },
  { label: "Book the hall", id: "t2", presses: true, opens: true },
];
const act = (id: string, ok = true): PressSaid => ({ control: "Done", element: `<button data-act="finish" data-record="${id}">`, does: "act", ok, says: ok ? "Mark it done is accepted." : "Refused." });
const link = (id: string): PressSaid => ({ control: id, element: `<a data-record="${id}">`, does: "link", ok: true, says: "Opens it." });
const checkbox: PressSaid = { control: "Done", element: '<input type="checkbox">', does: "nothing", ok: false, says: "Pressing it does nothing: bind it with data-act." };

describe("a new design keeps what a person could press", () => {
  it("finds an unbound checkbox and every record that can no longer be marked", () => {
    const findings = pressFindings({ controls: [checkbox, link("t1"), link("t2")], problems: [checkbox] }, wanted, ["finish", "reopen"], "tasks");
    expect(findings[0]).toMatch(/^Done: Pressing it does nothing/);
    expect(findings[1]).toMatch(/“Write the brief”, “Book the hall” can no longer be marked .* bound to “finish” or “reopen”/);
    expect(findings[1]).toContain('<button data-act="finish" data-record="t1">');
    expect(findings).toHaveLength(2);
  });

  it("passes a design whose every record is bound to the act and opens its page", () => {
    expect(pressFindings({ controls: [act("t1"), act("t2"), link("t1"), link("t2")], problems: [] }, wanted, ["finish", "reopen"], "tasks")).toEqual([]);
  });

  it("finds a record that no longer opens its page", () => {
    expect(pressFindings({ controls: [act("t1"), act("t2"), link("t1")], problems: [] }, wanted, ["finish"], "tasks")).toEqual(["“Book the hall” no longer opens its page: link each with data-record=\"its id\"."]);
  });

  it("says only what pressing accepted", () => {
    const acts = [{ act: "finish", title: "Mark it done", toggle: "done" }, { act: "reopen", title: "Open it again", toggle: "done" }];
    expect(pressSaid({ controls: [act("t1"), act("t2"), act("t3", false), link("t1")] }, acts, "tasks")).toBe("Pressing each control checked it: Mark it done works on 2 tasks and 1 opens its page.");
    expect(pressSaid({ controls: [checkbox] }, acts, "tasks")).toBeUndefined();
  });

  it("knows a sentence about a control, and a person who says one does not work", () => {
    expect(CONTROL_WORDS.test("Each task has a checkbox that saves as you tick it.")).toBe(true);
    expect(CONTROL_WORDS.test("The tasks are grouped by status, newest first.")).toBe(false);
    for (const words of ["I can't mark them complete", "it doesn't work", "the button is fake", "still broken"]) expect(IT_DOES_NOT_WORK.test(words)).toBe(true);
    expect(IT_DOES_NOT_WORK.test("make it easier to read at a glance")).toBe(false);
  });
});
