import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/**
 * THE STUDIO KEEPS WHAT A ROLE MAY PROPOSE (Roadmap f-proposals-for-review).
 * A grant that only proposes (`mutations: []`, `propose: [...]`) opened in
 * the studio and written back keeps its `propose`: dropped, a helper who
 * could ask for a change could ask for nothing.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean() }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const close = defineMutation("close-task", {
  title: "Close it",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});
const app = defineApp({
  name: "Chores",
  schema,
  mutations: [close],
  policy: { roles: ["keeper", "helper"], grants: [{ roles: ["keeper"], mutations: "*" }, { roles: ["helper"], mutations: [], propose: ["close-task"] }] },
});

describe("a grant that proposes, through the studio", () => {
  it("is kept in the declaration and in the files it writes", () => {
    const studio = createStudio(app);
    expect(studio.declaration().policy?.grants).toEqual([{ roles: ["keeper"], mutations: "*" }, { roles: ["helper"], mutations: [], propose: ["close-task"] }]);
    const policy = studio.files().find((file) => file.path.endsWith("policy.ts"))!.contents;
    expect(policy).toContain('{ roles: ["helper"], mutations: [], propose: ["close-task"] },');
  });
});
