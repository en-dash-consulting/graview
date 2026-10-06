import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkApp } from "../../src/cli/check.js";
import { createSchema, defineApp, defineMutation, defineNode, nodeRef, z } from "../../src/index.js";
import { compileDocument, type Finding } from "../../src/document/index.js";

/**
 * FR-105. THE CHECK WARNS WHEN AN ACT READS A KIND SOME ROLE THAT MAY RUN
 * IT CANNOT SEE. The store hides what a seat may not see and refuses a call
 * naming a hidden record as one naming nothing; an act's own logic — a
 * condition that counts hidden records, a refusal worded from one, an
 * effect that copies from one — can still tell a seat that one exists. With
 * a chat writing acts, the author is told: the act, the role, the kind, and
 * where the act reads it. A document's act is read for its condition,
 * refusal and effects; a TypeScript act's body is not read, so it says what
 * it reads with `reads`. A warning only: nothing at run time changes.
 */
const lifelogics = JSON.parse(readFileSync(new URL("./fixtures/lifelogics.gdd.json", import.meta.url), "utf8"));

const DEALS = {
  format: "graview-document",
  formatVersion: 1,
  name: "Deals",
  roles: ["owner", "agent"],
  kinds: {
    deal: { fields: { name: { type: "string", required: true }, stage: { type: "enum", options: ["open", "won"], required: true } }, edges: { notes: { to: ["memo"] } } },
    memo: { fields: { name: { type: "string", required: true }, flagged: { type: "boolean" } } },
  },
  acts: {
    // Reads the memos joined to the deal: allowed only when none is flagged.
    "close-deal": { on: "deal", sets: { stage: "won" }, allowedWhen: "not some(out('notes'), flagged == true)" },
    // Words its refusal from a memo.
    "reopen-deal": { on: "deal", sets: { stage: "open" }, allowedWhen: "stage == 'won'", refusal: "{first(all('memo')).name} says no" },
    // Copies a count of memos into the record.
    "rename-deal": { on: "deal", writes: ["name"] },
    "tally-deal": { on: "deal", sets: { name: { expr: "name + ' (' + count(notes) + ')'" } } },
  },
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["deal", "memo"] },
      { roles: ["agent"], kinds: ["deal"] },
    ],
  },
};

const hidden = (findings: readonly Finding[]) => findings.filter((f) => f.code === "check:act-reads-hidden-kind");

describe("a document's act that reads what a role that may run it cannot see", () => {
  const result = compileDocument(DEALS);

  it("compiles — it is a warning, not a refusal", () => {
    expect(result.ok).toBe(true);
  });

  it("names the act, the role, the kind and where the act reads it: a condition, a refusal, a value it sets", () => {
    expect(hidden(result.findings).map((f) => [f.severity, f.path, f.message])).toEqual([
      ["warning", "acts.close-deal", '"close-deal" reads memo records (its condition), which "agent" may run it but may not see: whether it is allowed, what it refuses with or what it writes can tell "agent" that a memo they cannot see exists.'],
      ["warning", "acts.reopen-deal", '"reopen-deal" reads memo records (its refusal), which "agent" may run it but may not see: whether it is allowed, what it refuses with or what it writes can tell "agent" that a memo they cannot see exists.'],
      ["warning", "acts.tally-deal", '"tally-deal" reads memo records (a value it sets), which "agent" may run it but may not see: whether it is allowed, what it refuses with or what it writes can tell "agent" that a memo they cannot see exists.'],
    ]);
  });

  it("says nothing of an act that reads only what it is handed, nor of a role that sees what is read", () => {
    const findings = hidden(result.findings);
    expect(findings.some((f) => f.path === "acts.rename-deal")).toBe(false);
    expect(findings.some((f) => f.message.includes('"owner"'))).toBe(false);
  });

  it("says nothing once the role may see the kind, or may not run the act", () => {
    const seen = structuredClone(DEALS);
    seen.policy.sees[1]!.kinds.push("memo");
    expect(hidden(compileDocument(seen).findings)).toEqual([]);
    const kept = structuredClone(DEALS) as typeof DEALS & { policy: { grants: unknown[] } };
    kept.policy.grants = [{ roles: ["owner"], mutations: "*" }, { roles: ["agent"], mutations: ["rename-deal"] }];
    expect(hidden(compileDocument(kept).findings)).toEqual([]);
  });

  it("follows a walk from every member of a set to the kind it reaches", () => {
    const walked = structuredClone(DEALS) as unknown as { acts: Record<string, unknown> };
    walked.acts = { "close-all": { on: "deal", sets: { stage: "won" }, allowedWhen: "count(out(all('deal'), 'notes')) == 0" } };
    expect(hidden(compileDocument(walked).findings).map((f) => f.path)).toEqual(["acts.close-all"]);
  });

  it("LifeLogics, whose acts read nothing beyond what they are handed, is told nothing", () => {
    expect(hidden(compileDocument(lifelogics).findings)).toEqual([]);
  });
});

describe("a TypeScript act says what it reads, because its body cannot be read", () => {
  const deal = defineNode("deal", { fields: z.object({ name: z.string() }) });
  const memo = defineNode("memo", { fields: z.object({ name: z.string() }) });
  const schema = createSchema([deal, memo]);
  const policy = {
    grants: [{ roles: "*" as const, mutations: "*" as const }],
    sees: [
      { roles: ["owner"], kinds: ["deal", "memo"] },
      { roles: ["agent"], kinds: ["deal"] },
    ],
  };
  const app = (mutation: ReturnType<typeof defineMutation>) => defineApp({ name: "Deals", schema, mutations: [mutation as never], policy });
  const said = (mutation: ReturnType<typeof defineMutation>) => checkApp(app(mutation)).findings.filter((f) => f.code === "act-reads-hidden-kind").map((f) => [f.where, f.message]);

  it("a body that reads the graph and does not say so is not guessed at", () => {
    const close = defineMutation("close-deal", { input: z.object({ deal: nodeRef(["deal"]) }), subject: { kinds: ["deal"], arg: "deal" }, apply() {} });
    expect(said(close)).toEqual([]);
  });

  it("an act that declares it reads memo is named for each role that may run it and may not see one", () => {
    const close = defineMutation("close-deal", { input: z.object({ deal: nodeRef(["deal"]) }), subject: { kinds: ["deal"], arg: "deal" }, reads: ["memo"], apply() {} });
    expect(said(close)).toEqual([["close-deal", '"close-deal" reads memo records (what it declares it reads), which "agent" may run it but may not see: whether it is allowed, what it refuses with or what it writes can tell "agent" that a memo they cannot see exists.']]);
  });

  it("an act that asks for a record of a kind its runner may not see is told it can never be given one", () => {
    const attach = defineMutation("attach-memo", { input: z.object({ deal: nodeRef(["deal"]), memo: nodeRef(["memo"]) }), subject: { kinds: ["deal"], arg: "deal" }, apply() {} });
    expect(said(attach)).toEqual([["attach-memo", '"attach-memo" asks for memo records (its argument "memo"), and "agent" may run it but may not see one, so "agent" can never give one: the store refuses it as missing.']]);
  });
});
