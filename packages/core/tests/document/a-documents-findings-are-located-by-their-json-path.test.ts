import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * EVERY FINDING ON A DOCUMENT IS LOCATED BY ITS JSON PATH. `checkApp`
 * places a finding the way a TypeScript author writes the declaration —
 * `defineMutation("link").connects` — and a document's author holds no such
 * call: they hold `acts.link.connects`. Each finding the checker hands back
 * on a document says where it is, and what to do, in the document's words.
 */
const tracker = {
  format: "graview-document",
  formatVersion: 1,
  name: "Tracker",
  kinds: {
    module: { noun: "module", plural: "modules", label: "{name}", fields: { name: { type: "string", required: true } } },
    task: {
      noun: "task",
      plural: "tasks",
      label: "{name}",
      fields: { name: { type: "string", required: true }, done: { type: "boolean" } },
      edges: { in: { to: ["module"], cardinality: "one" } },
    },
  },
  acts: {
    "add-task": { title: "Add a task", creates: "task" },
    "add-module": { title: "Add a module", creates: "module" },
    // Connects and nothing severs: the checker warns of a relation that can never be unmade.
    file: { title: "File it", on: "task", connects: "in" },
    finish: { title: "Finish", on: "task", sets: { done: true } },
    "rename-module": { title: "Rename", on: "module", writes: ["name"] },
  },
  rules: {
    "no-orphan-task": { title: "No orphan task", over: "task", require: "done", repairs: [{ act: "finish" }, { act: "rename-module" }] },
  },
} as unknown as GraviewDocument;

describe("a document's findings are located by their JSON path", () => {
  const { findings } = compileDocument(tracker);
  const fromTheChecker = findings.filter((f) => f.code.startsWith("check:"));

  it("finds what it should, so the rest of the test is asked of something", () => {
    expect(fromTheChecker.map((f) => f.code)).toEqual(expect.arrayContaining(["check:repair-wrong-kind", "check:edge-without-severer"]));
  });

  it("locates an act's finding at acts.<act>, and a rule's repair at rules.<rule>.repairs.<n>", () => {
    expect(fromTheChecker.find((f) => f.code === "check:edge-without-severer")?.path).toBe("acts.file.connects");
    expect(fromTheChecker.find((f) => f.code === "check:repair-wrong-kind")?.path).toBe("rules.no-orphan-task.repairs.1");
  });

  it("never names the TypeScript spelling — defineNode, defineMutation, defineInvariant — in a path, a message or a fix", () => {
    for (const f of fromTheChecker) {
      expect(`${f.path} ${f.message} ${f.fix ?? ""}`).not.toMatch(/define(Node|Mutation|Invariant|App)\b/);
    }
  });
});
