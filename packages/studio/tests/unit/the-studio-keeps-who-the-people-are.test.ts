import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStudio } from "../../src/index.js";

/**
 * THE STUDIO KEEPS WHO THE PEOPLE ARE, AND WHAT READS THEM (Roadmap
 * f-people-kind, f-own-end-grants, "visibility scoped by relation"). A sight
 * the studio dropped its `via` from would show every match to every giver,
 * and a grant that lost its `ownEnd` would let a voter take back anybody's
 * vote: opened and written back, each survives.
 */
const participant = defineNode("participant", { fields: z.object({ label: z.string() }), people: true });
const match = defineNode("match", {
  fields: z.object({ label: z.string() }),
  edges: { givenBy: { to: ["participant"], cardinality: "one", description: "who gives", inverse: "the match they give in" } },
});
const schema = createSchema([participant, match]);
const { defineMutation } = bindSchema(schema);
const unhand = defineMutation("unhand", {
  title: "Take the match back",
  subject: { kinds: ["match"], arg: "id" },
  severs: ["givenBy"],
  input: z.object({ id: nodeRef(["match"]), giver: nodeRef(["participant"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "givenBy", from: args.id, to: args.giver });
  },
});
const app = defineApp({
  name: "Santa",
  schema,
  mutations: [unhand],
  policy: {
    roles: ["participant"],
    grants: [{ roles: ["participant"], mutations: ["unhand"], ownEnd: true }],
    sees: [{ roles: "*", kinds: ["participant"] }, { roles: ["participant"], kinds: ["match"], via: "givenBy" }],
  },
});

describe("the people, through the studio", () => {
  it("keeps the people kind, an own-end grant and a sight via a relation in the declaration and in the files it writes", () => {
    const studio = createStudio(app);
    const declared = studio.declaration();
    expect(declared.schema.tryDefinition("participant")?.people).toBe(true);
    expect(declared.policy?.grants).toEqual([{ roles: ["participant"], mutations: ["unhand"], ownEnd: true }]);
    expect(declared.policy?.sees).toEqual([{ roles: "*", kinds: ["participant"] }, { roles: ["participant"], kinds: ["match"], via: "givenBy" }]);
    const files = studio.files();
    const policy = files.find((file) => file.path.endsWith("policy.ts"))!.contents;
    expect(policy).toContain('{ roles: ["participant"], mutations: ["unhand"], ownEnd: true },');
    expect(policy).toContain('{ roles: ["participant"], kinds: ["match"], via: "givenBy" },');
    expect(files.find((file) => file.path.endsWith("schema.ts"))!.contents).toContain("people: true,");
  });
});
