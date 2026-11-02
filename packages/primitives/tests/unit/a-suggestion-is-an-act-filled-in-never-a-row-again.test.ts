import { describe, expect, it } from "vitest";
import { filledActs, notARow, type MenuSuggestion } from "../../src/menu-suggested.js";

/*
 * SUGGESTED NEVER SAYS A ROW AGAIN (Roadmap f-make-any-page-better). The
 * rows under Suggested already offer "Set the status …" and "Change the
 * task …"; a suggestion is the act with its answer in it, or a Better UI
 * nudge, and anything a row says as it is is dropped.
 */
const status = { id: "schema:set-status", label: "Set the status …", provider: "schema", open: [{ name: "status", shape: { type: "choice", options: ["todo", "doing", "done"] } }] };
const change = { id: "schema:change", label: "Change the task …", provider: "schema", open: [{ name: "title", shape: { type: "text" } }] };
const archive = { id: "schema:archive", label: "Archive the task", provider: "schema", open: [] };
const drop = { id: "schema:drop", label: "Drop it", provider: "schema", destructive: true, open: [{ name: "status", shape: { type: "choice", options: ["todo", "doing"] } }] };

describe("a suggested act", () => {
  it("is a choice filled in with the next of its options after the one the record holds, in the option's words", () => {
    const said = filledActs([status, change, archive, drop], { status: "todo" }, { status: { todo: "Todo", doing: "Doing", done: "Done" } });
    expect(said.map((one) => one.label)).toEqual(["Set the status to Doing"]);
    expect(filledActs([status], { status: "doing" }).map((one) => one.label)).toEqual(["Set the status to Done"]);
    // At the last option, or on nothing, there is no next to suggest.
    expect(filledActs([status], { status: "done" })).toEqual([]);
    expect(filledActs([status], undefined)).toEqual([]);
  });

  it("that asks nothing names the record, in its words' “it” or “this” or after them, and one that sets it aside is left to its row", () => {
    const finish = { id: "schema:finish", label: "Mark it done", provider: "schema", open: [] };
    const aside = { id: "schema:archive", label: "Archive this", provider: "schema", setsAside: true as const, open: [] };
    const close = { id: "schema:close", label: "Finish", provider: "schema", open: [] };
    expect(filledActs([finish, aside, close], { done: false }, {}, "Book the hall").map((one) => one.label)).toEqual(["Mark “Book the hall” done", "Finish “Book the hall”"]);
  });

  it("is dropped where a row under it says the same as it is", () => {
    const candidates: MenuSuggestion[] = [
      { key: "act:a", label: "Set the status", mode: "chat", source: "act" },
      { key: "act:b", label: "Set the status to Doing", mode: "chat", source: "act" },
      { key: "told:c", label: "Archive the task", mode: "chat", source: "told" },
      { key: "nudge:0", label: "Make “Tasks” easier to read at a glance", mode: "better", source: "nudge" },
    ];
    expect(notARow(candidates, ["Set the status …", "Change the task …", "Archive the task"]).map((one) => one.key)).toEqual(["act:b", "nudge:0"]);
  });
});
