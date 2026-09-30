/*
 * Written exactly as the graview-invariant skill writes it: `judgesPast`
 * as a property of the bound declaration. `the-bound-declaration.test.ts`
 * compiles this file and expects no errors.
 */
import { z } from "zod";
import { bindSchema, createSchema, defineNode, type Violation } from "../../src/index.js";

const agreement = defineNode("agreement", {
  fields: z.object({ label: z.string(), status: z.enum(["active", "lapsed"]) }),
  lifecycle: { field: "status", retired: ["lapsed"] },
});
const { defineInvariant } = bindSchema(createSchema([agreement]));

export const audit = defineInvariant("audit", {
  scope: { kind: "agreement" },
  judgesPast: true,
  evaluate: ({ subject }): Violation[] =>
    subject.status === "lapsed"
      ? [{ invariant: "audit", subjectId: subject.id, label: subject.label, message: "lapsed", nodeIds: [subject.id], repairs: [] }]
      : [],
});
