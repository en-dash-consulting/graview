import { type AnySchema, bindSchema, createSchema, DATE_VALUE, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type ChatContext, graphResponder } from "../../src/index.js";

/**
 * THE CONVERSATION KEEPS A YEAR OR A MONTH AS SAID (Roadmap
 * f-partial-dates-in-conversation). A `date` may hold `2006` or `2016-05`
 * (0.1.56), but the seat's own reading of a sentence filled every date
 * with the day it was, so "founded in 2006" became a false exact date, and
 * a record that knew only its month was said back as "2016-05". Now a date
 * that may know only that much keeps the year or the month the sentence
 * names, and one is said back as "2006" or "May 2016".
 */
const company = defineNode("company", {
  // A date that may know only its year or its month: a document's date, and `DATE_VALUE` in a declaration.
  fields: z.object({ label: z.string(), founded: z.string().regex(DATE_VALUE).optional(), audited: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  plural: "Companies",
});
const schema = createSchema([company]);
const bound = bindSchema(schema);

const found = bound.defineMutation("found", {
  title: "Founded",
  description: "Say when a company was founded.",
  subject: { kinds: ["company"], arg: "companyId" },
  input: z.object({ companyId: nodeRef(["company"]), founded: z.string().regex(DATE_VALUE) }),
  apply(ctx, args) {
    ctx.patchNode(args.companyId, { founded: args.founded });
  },
});
const audit = bound.defineMutation("audit", {
  title: "Audited",
  description: "Say the day a company was audited.",
  subject: { kinds: ["company"], arg: "companyId" },
  input: z.object({ companyId: nodeRef(["company"]), audited: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  apply(ctx, args) {
    ctx.patchNode(args.companyId, { audited: args.audited });
  },
});

const TODAY = "2026-10-27";
const store = (founded?: string) =>
  new Store({
    schema,
    mutations: [found, audit],
    invariants: [],
    snapshot: { nodes: [{ id: "acme", kind: "company", label: "Acme", ...(founded ? { founded } : {}) }] as never, edges: [] },
  });
const ask = <S extends AnySchema>(at: Store<S>, text: string, context: ChatContext = {}) => graphResponder<S>()(at, text, { ...context, today: TODAY });

describe("a year or a month said to the seat", () => {
  it("keeps a year as said: 'founded in 2006' stores 2006", async () => {
    const at = store();
    const reply = await ask(at, "Acme was founded in 2006");
    expect(reply.proposals).toEqual([{ mutation: "found", args: { companyId: "acme", founded: "2006" }, why: "you asked in words" }]);
    at.apply({ name: "found", args: reply.proposals[0]!.args });
    expect(at.graph.getNode("acme")).toMatchObject({ founded: "2006" });
  });

  it("keeps a month as said, however it is written", async () => {
    for (const [said, kept] of [
      ["Acme was founded in May 2016", "2016-05"],
      ["Acme was founded sept. 2016", "2016-09"],
      ["Acme was founded 2016-05", "2016-05"],
      ["Acme was founded 5/2016", "2016-05"],
    ] as const) {
      const reply = await ask(store(), said);
      expect(reply.proposals.map((proposal) => proposal.args), said).toEqual([{ companyId: "acme", founded: kept }]);
    }
  });

  it("gives a date that must be a day the day it is, as before", async () => {
    const reply = await ask(store(), "Acme was audited in 2006");
    expect(reply.proposals).toEqual([{ mutation: "audit", args: { companyId: "acme", audited: TODAY }, why: "you asked in words" }]);
  });

  it("reads no year out of a day, an id or a number", async () => {
    const reply = await ask(store(), "Acme was founded on 2016-05-04");
    // A whole day is not a year or a month alone: the day it is stands in, as it always did.
    expect(reply.proposals.map((proposal) => proposal.args)).toEqual([{ companyId: "acme", founded: TODAY }]);
    expect((await ask(store(), "Acme was founded, see ticket 20160504")).proposals.map((proposal) => proposal.args)).toEqual([{ companyId: "acme", founded: TODAY }]);
  });
});

describe("a year or a month said back", () => {
  it("says a month as a person does", async () => {
    const reply = await ask(store("2016-05"), "tell me about Acme");
    expect(reply.say).toContain("founded May 2016");
    expect(reply.say).not.toContain("2016-05");
  });

  it("says a year as itself", async () => {
    expect((await ask(store("2006"), "tell me about Acme")).say).toContain("founded 2006");
  });
});
