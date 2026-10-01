import * as core from "@graview/core";
import { todoApp } from "@graview/todo";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain module of the harness, with no types of its own.
import { frictionOf, planJobs, regressionsOf } from "../scripts/lib/journeys.mjs";

/**
 * THE JOURNEYS HARNESS'S OWN LOGIC, held without a browser: which jobs a
 * declaration implies, how the friction is ranked, and what counts as a
 * regression. `scripts/verify-journeys.mjs` drives the jobs; these are the
 * rules it reads the result by.
 */
type Run = { done: boolean; presses: number; ms: number; violations: { rule: string; detail: string }[]; deadEnd?: string; skipped?: string };
const run = (done: boolean, presses: number, extra: Partial<Run> = {}): Run => ({ done, presses, ms: 100, violations: [], ...extra });
const report = (runs: Record<string, Run>) => ({ apps: { todo: { jobs: { find: { says: "Finding a task by part of its name", runs } } } } });

describe("the jobs a declaration implies", () => {
  const { jobs } = planJobs({ app: todoApp, core });
  const byId = Object.fromEntries(jobs.map((job: { id: string }) => [job.id, job]));

  it("makes every kind the app declares a creating act for, and not a module's", () => {
    expect(byId["make-task"]).toMatchObject({ act: "add-task", subject: { arg: "listId" } });
    expect(byId["make-invitation"]).toBeUndefined();
    expect(byId["make-user"]).toBeUndefined();
  });

  it("finds, renames and relates the first creatable kind, through the acts that do it", () => {
    expect(byId["find"]).toMatchObject({ kind: "task" });
    expect(byId["change"]).toMatchObject({ kind: "task", field: "label", act: "rename" });
    expect(byId["relate"]).toMatchObject({ act: "wait-for", subjectArg: "taskId", otherArg: "blockerId" });
    expect(byId["undo"]).toMatchObject({ act: "rename" });
  });

  it("asks for a repair where there are rules, and a refusal where there is a policy", () => {
    expect(byId["repair"]).toBeDefined();
    expect(byId["refused"]).toBeDefined();
  });
});

describe("the friction, ranked", () => {
  it("puts a job that cannot be done before one done with a rule broken, and that before one that merely costs more", () => {
    const friction = frictionOf(
      report({
        "scene/1440/pointer": run(true, 3),
        "scene/1440/keyboard": run(true, 30),
        "pages/1440/pointer": run(true, 4, { violations: [{ rule: "keyboard-lands-nowhere", detail: "Enter on <input> left the keyboard on <body>" }] }),
        "pages/1440/keyboard": run(false, 0, { deadEnd: "there is no Find box on the screen" }),
      }),
    ) as { says: string }[];
    expect(friction.map((item) => item.says)).toEqual([
      "todo: Finding a task by part of its name cannot be done on the pages on a laptop from the keyboard — there is no Find box on the screen.",
      "todo: Finding a task by part of its name works but breaks keyboard-lands-nowhere: Enter on <input> left the keyboard on <body> — on the pages on a laptop with the pointer.",
      "todo: Finding a task by part of its name on the scene on a laptop from the keyboard takes 30 presses; on the scene on a laptop with the pointer, 3.",
    ]);
  });
});

describe("a regression", () => {
  const before = report({ "scene/1440/pointer": run(true, 10), "pages/390/pointer": run(true, 2), "pages/1440/pointer": run(true, 4) });

  it("is a job that was done and now is not, or costs more than 30% more presses", () => {
    const after = report({ "scene/1440/pointer": run(true, 14), "pages/390/pointer": run(true, 2), "pages/1440/pointer": run(false, 1, { deadEnd: "the form is gone" }) });
    expect(regressionsOf(before, after)).toEqual([
      "todo: Finding a task by part of its name on the scene on a laptop with the pointer took 10 presses and now takes 14.",
      "todo: Finding a task by part of its name on the pages on a laptop with the pointer was done and now is not — the form is gone.",
    ]);
  });

  it("is not one more press on a two-press job, a job that got cheaper, or anything with no verdict before it", () => {
    const after = report({ "scene/1440/pointer": run(true, 6), "pages/390/pointer": run(true, 3), "pages/1440/pointer": run(true, 4) });
    expect(regressionsOf(before, after)).toEqual([]);
    expect(regressionsOf(null, after)).toEqual([]);
  });
});
