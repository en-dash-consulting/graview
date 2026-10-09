import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * AN ACT WITHOUT A TITLE IS SAID SO (`act-without-title`).
 *
 * Every surface names an act by its title: the context menu, Pages' "What
 * can be done", the seat's offered repairs. Without one the person read the
 * mutation's name — `move-to-list` — and the seat called that out as noise.
 * It is spoken now ("Move to list"), still the code's word and not the
 * app's, so `graview check` warns, and says the fix.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const titled = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }),
});
const untitled = defineMutation("move-to-list", {
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: false }),
});

const findings = (mutations: readonly unknown[]) =>
  checkApp(defineApp({ name: "lists", schema, mutations: mutations as never }) as never).findings.filter((finding) => finding.code === "act-without-title");

describe("an act without a title", () => {
  it("is a warning that names the act, the word a person would read instead, and the fix", () => {
    const [found, ...rest] = findings([titled, untitled]);
    expect(rest).toEqual([]);
    expect(found?.severity).toBe("warning");
    expect(found?.where).toBe('defineMutation("move-to-list")');
    expect(found?.message).toContain('"Move to list"');
    expect(found?.fix).toContain("title:");
  });

  it("says nothing of an act that has one", () => {
    expect(findings([titled])).toEqual([]);
  });
});
