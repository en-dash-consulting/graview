import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import { compileDocument } from "../../src/check.js";
import { coverageRule, editDocument, readDocument, toDocument, type GraviewDocument } from "../../src/document/index.js";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { ruleLine, withLines } from "../../src/lines.js";
import { createSchema, defineApp, defineNode, Store, z, type AnySchema, type GraviewApp } from "../../src/index.js";

/*
 * A COVERAGE RULE WITHOUT A COST WARNING (Roadmap f-rule-covers-every).
 *
 * "Every candidate has a stance on every issue the guide covers" can be
 * written in the rule language by counting the distinct issues a
 * candidate's stances reach against all issues — and the checker says
 * `rule-cost` of it, which a curated template may not carry, so the voter
 * guide said only "has a stance on file". Declared as a shape —
 * `covers: { every: "issue", through: "stances", via: "issue" }` — the
 * store judges it in one pass over the links, so there is no cost to warn
 * of, and each missing pair is one problem naming both records.
 */

/** The voter guide, as the Roadmap describes it: candidate → stances → issue. */
const GUIDE = {
  format: "graview-document",
  formatVersion: 1,
  name: "Voter guide",
  kinds: {
    candidate: {
      fields: { name: { type: "string", required: true } },
      edges: {
        stances: { to: ["stance"], cardinality: "many", description: "the stances this candidate has taken", inverse: "the candidate who holds it" },
        endorsedBy: { to: ["candidate"], cardinality: "many", description: "the candidates who endorse this one", inverse: "the candidates this one endorses" },
      },
    },
    issue: {
      fields: { title: { type: "string", required: true } },
      label: "{title}",
    },
    stance: {
      fields: { position: { type: "enum", options: ["for", "against", "undecided"], required: true } },
      edges: { issue: { to: ["issue"], cardinality: "one", description: "the issue this stance is on", inverse: "the stances on it" } },
    },
  },
  rules: {
    "stance-on-every-issue": {
      title: "A stance on every issue",
      over: "candidate",
      covers: { every: "issue", through: "stances", via: "issue" },
      says: "{candidate} has no stance on {issue}",
    },
  },
};

const SEED = {
  nodes: [
    { id: "cand:ana", kind: "candidate", name: "Ana Ortiz" },
    { id: "cand:ben", kind: "candidate", name: "Ben Lau" },
    { id: "issue:housing", kind: "issue", title: "Housing" },
    { id: "issue:transit", kind: "issue", title: "Transit" },
    { id: "issue:parks", kind: "issue", title: "Parks" },
    { id: "st:1", kind: "stance", position: "for" },
    { id: "st:2", kind: "stance", position: "against" },
    { id: "st:3", kind: "stance", position: "undecided" },
    { id: "st:4", kind: "stance", position: "for" },
    // Ben's stance on nothing yet: a record the test links.
    { id: "st:5", kind: "stance", position: "undecided" },
  ],
  edges: [
    { kind: "stances", from: "cand:ana", to: "st:1" },
    { kind: "stances", from: "cand:ana", to: "st:2" },
    { kind: "stances", from: "cand:ana", to: "st:3" },
    { kind: "stances", from: "cand:ben", to: "st:4" },
    { kind: "stances", from: "cand:ben", to: "st:5" },
    { kind: "issue", from: "st:1", to: "issue:housing" },
    { kind: "issue", from: "st:2", to: "issue:transit" },
    { kind: "issue", from: "st:3", to: "issue:parks" },
    { kind: "issue", from: "st:4", to: "issue:housing" },
  ],
};

function opened(document: unknown = GUIDE, seed: unknown = SEED) {
  const result = compileDocument(document);
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  const app = result.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: structuredClone(seed) as never });
  return { app, store, findings: result.findings };
}

const pairs = (store: Store<AnySchema>, rule = "stance-on-every-issue") =>
  store
    .violations()
    .filter((one) => one.invariant === rule)
    .map((one) => ({ subject: one.subjectId, nodes: [...one.nodeIds], message: one.message, status: one.status }));

describe("a coverage rule names each missing pair", () => {
  it("the voter guide's rule compiles with no warning at all", () => {
    const { findings } = opened();
    expect(findings.filter((f) => f.severity !== "note")).toEqual([]);
    expect(findings.map((f) => f.code)).not.toContain("rule-cost");
  });

  it("names each issue a candidate has no stance on, as one problem naming both records", () => {
    const { store } = opened();
    expect(pairs(store)).toEqual([
      { subject: "cand:ben", nodes: ["cand:ben", "issue:transit"], message: "Ben Lau has no stance on Transit", status: "violated" },
      { subject: "cand:ben", nodes: ["cand:ben", "issue:parks"], message: "Ben Lau has no stance on Parks", status: "violated" },
    ]);
  });

  it("is mended by the link, and broken again by a link taken away", () => {
    const { store } = opened();
    store.apply({ name: "connect-stance-issue", args: { id: "st:5", to: "issue:transit" } });
    expect(pairs(store).map((p) => p.nodes[1])).toEqual(["issue:parks"]);
    store.apply({ name: "disconnect-stance-issue", args: { id: "st:1", to: "issue:housing" } });
    expect(pairs(store).map((p) => p.message)).toEqual(["Ana Ortiz has no stance on Housing", "Ben Lau has no stance on Parks"]);
  });

  it("an archived issue is demanded of nobody, as all() counts no archived record", () => {
    const { store } = opened();
    store.apply({ name: "archive-issue", args: { id: "issue:parks" } });
    expect(pairs(store).map((p) => p.nodes[1])).toEqual(["issue:transit"]);
  });

  it("walks `through` alone when the relation reaches the covered kind, and a relation declared from the far side", () => {
    const direct = {
      ...GUIDE,
      kinds: {
        candidate: { fields: { name: { type: "string", required: true } }, edges: { addresses: { to: ["issue"], cardinality: "many", description: "the issues this candidate addresses", inverse: "the candidates who address it" } } },
        issue: { fields: { title: { type: "string", required: true } }, label: "{title}" },
      },
      rules: { addressed: { over: "candidate", covers: { every: "issue", through: "addresses" }, says: "{name} does not address {issue}" } },
    };
    const { store } = opened(direct, {
      nodes: SEED.nodes.filter((n) => n.kind !== "stance"),
      edges: [
        { kind: "addresses", from: "cand:ana", to: "issue:housing" },
        { kind: "addresses", from: "cand:ana", to: "issue:transit" },
        { kind: "addresses", from: "cand:ana", to: "issue:parks" },
        { kind: "addresses", from: "cand:ben", to: "issue:parks" },
      ],
    });
    expect(pairs(store, "addressed").map((p) => p.message)).toEqual(["Ben Lau does not address Housing", "Ben Lau does not address Transit"]);

    // The stance declares its candidate: the walk goes in along `candidate`, then out along `issue`.
    const fromTheStance = {
      ...GUIDE,
      kinds: {
        candidate: { fields: { name: { type: "string", required: true } } },
        issue: GUIDE.kinds.issue,
        stance: { fields: GUIDE.kinds.stance.fields, edges: { candidate: { to: ["candidate"], cardinality: "one", description: "whose stance it is", inverse: "the stances this candidate has taken" }, issue: GUIDE.kinds.stance.edges.issue } },
      },
      rules: { "stance-on-every-issue": { ...GUIDE.rules["stance-on-every-issue"], covers: { every: "issue", through: "candidate", via: "issue" } } },
    };
    const { store: inward, findings } = opened(fromTheStance, {
      nodes: SEED.nodes,
      edges: SEED.edges.map((e) => (e.kind === "stances" ? { kind: "candidate", from: e.to, to: e.from } : e)),
    });
    expect(findings.filter((f) => f.severity === "warning")).toEqual([]);
    expect(pairs(inward).map((p) => p.message)).toEqual(["Ben Lau has no stance on Transit", "Ben Lau has no stance on Parks"]);
  });

  it("says its shape in words, and a broken pair by the record it does not reach", () => {
    const { store } = opened();
    const rule = store.allInvariants().find((one) => one.name === "stance-on-every-issue")!;
    expect(ruleLine(rule, store.schema)?.text).toBe("reaches every issue through stances, then issue");
    const lined = withLines(store, store.violations()).find((one) => one.nodeIds.includes("issue:parks"))!;
    expect(lined.line?.text).toBe("does not reach Parks through stances, then issue");
    expect(lined.line?.record).toBe("Ben Lau");
    // The rule wrote its own sentence, so the message is left as written.
    expect(lined.message).toBe("Ben Lau has no stance on Parks");
  });

  it("without a sentence of its own, a pair is said by the title and the far record", () => {
    const quiet = { ...GUIDE, rules: { "stance-on-every-issue": { title: "A stance on every issue", over: "candidate", covers: GUIDE.rules["stance-on-every-issue"].covers } } };
    const { store } = opened(quiet);
    expect(pairs(store).map((p) => p.message)).toEqual(["Ben Lau: A stance on every issue — Transit", "Ben Lau: A stance on every issue — Parks"]);
    // The line is there besides, and the message is not said twice over.
    const lined = withLines(store, store.violations()).find((one) => one.nodeIds.includes("issue:parks"))!;
    expect(lined.message).toBe("Ben Lau: A stance on every issue — Parks");
    expect(lined.line?.text).toBe("does not reach Parks through stances, then issue");
  });

  it("judges only the records its `when` holds for", () => {
    const withWhen = { ...GUIDE, rules: { "stance-on-every-issue": { ...GUIDE.rules["stance-on-every-issue"], when: "name != 'Ben Lau'" } } };
    const { store } = opened(withWhen);
    expect(pairs(store)).toEqual([]);
  });
});

describe("graview check says what a coverage rule cannot follow, at the key", () => {
  const rule = (covers: Record<string, string>, over = "candidate") => compileDocument({ ...GUIDE, rules: { r: { over, covers } } }).findings.filter((f) => f.severity === "error").map(({ code, path, message, fix }) => ({ code, path, message, fix }));

  it("a relation no kind declares, or one the rule's kind cannot be followed through", () => {
    expect(rule({ every: "issue", through: "positions", via: "issue" })).toEqual([{ code: "rule-covers-relation", path: "rules.r.covers.through", message: '"positions" is not a relation any kind declares', fix: undefined }]);
    expect(rule({ every: "issue", through: "issue" })).toEqual([{ code: "rule-covers-relation", path: "rules.r.covers.through", message: '"issue" is a relation of stance, not of candidate, so a candidate cannot be followed through it', fix: "name a relation candidate declares, or one that points at candidate" }]);
  });

  it("a walk that stops short of the covered kind, and a `via` the first step does not reach", () => {
    expect(rule({ every: "issue", through: "stances" })).toEqual([{ code: "rule-covers-relation", path: "rules.r.covers.through", message: '"stances" reaches stance, not issue', fix: 'add "via": the relation from stance to issue, or name a relation that reaches issue' }]);
    expect(rule({ every: "issue", through: "stances", via: "stances" })).toEqual([{ code: "rule-covers-relation", path: "rules.r.covers.via", message: '"stances" reaches candidate, not issue', fix: "name a relation that reaches issue" }]);
    expect(rule({ every: "issue", through: "stances", via: "endorsedBy" })).toEqual([{ code: "rule-covers-relation", path: "rules.r.covers.via", message: '"endorsedBy" is a relation of candidate, which "stances" does not reach', fix: "name a relation of stance, or one that points at it" }]);
  });

  it("a kind the document does not declare is `rule-kind`, as a sweep of one is", () => {
    expect(rule({ every: "topic", through: "stances", via: "issue" }).map((f) => [f.code, f.path])).toEqual([["rule-kind", "rules.r.covers.every"]]);
  });

  it("a rule says `require` or `covers`, one of them, and a coverage rule is over a kind", () => {
    const paths = (r: Record<string, unknown>) => readDocument({ ...GUIDE, rules: { r } }).findings.map((f) => `${f.path}: ${f.message}`);
    expect(paths({ over: "candidate" })).toEqual(['rules.r.require: a rule says what must hold in "require", or what each record must be linked to in "covers"']);
    expect(paths({ over: "candidate", require: "count(stances) > 0", covers: { every: "issue", through: "stances", via: "issue" } })).toEqual(['rules.r.covers: a rule is judged by "require" or by "covers", not both']);
    expect(paths({ over: "graph", covers: { every: "issue", through: "stances", via: "issue" } })).toEqual(['rules.r.over: a coverage rule is over a kind, whose records it follows through their links; name the kind in "over"']);
  });

  it("the document's JSON Schema says the same", () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(documentJsonSchema("0.0.0"));
    expect(validate(GUIDE)).toBe(true);
    expect(validate({ ...GUIDE, rules: { r: { over: "candidate" } } })).toBe(false);
    expect(validate({ ...GUIDE, rules: { r: { over: "candidate", require: "true", covers: { every: "issue", through: "stances", via: "issue" } } } })).toBe(false);
    expect(validate({ ...GUIDE, rules: { r: { over: "graph", covers: { every: "issue", through: "stances", via: "issue" } } } })).toBe(false);
  });
});

describe("a coverage rule follows the declaration's renames and goes with what it walks", () => {
  const start = readDocument(GUIDE).document!;
  const edited = (edits: readonly Record<string, unknown>[]): GraviewDocument => {
    const outcome = editDocument(start, edits as never);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    return outcome.document;
  };
  const covers = (doc: GraviewDocument) => doc.rules!["stance-on-every-issue"]!.covers;

  it("a renamed relation or kind is followed in `covers`, and the rule still compiles", () => {
    const relation = edited([{ op: "rename-relation", kind: "candidate", relation: "stances", to: "positions" }]);
    expect(covers(relation)).toEqual({ every: "issue", through: "positions", via: "issue" });
    const kind = edited([{ op: "rename-kind", kind: "issue", to: "topic" }]);
    expect(covers(kind)).toEqual({ every: "topic", through: "stances", via: "issue" });
    for (const doc of [relation, kind]) expect(compileDocument(doc).findings.filter((f) => f.severity !== "note")).toEqual([]);
  });

  it("the rule goes with the covered kind, and with a relation it walks", () => {
    expect(edited([{ op: "remove-kind", kind: "issue" }]).rules?.["stance-on-every-issue"]).toBeUndefined();
    expect(edited([{ op: "remove-relation", kind: "candidate", relation: "stances" }]).rules?.["stance-on-every-issue"]).toBeUndefined();
  });
});

describe("a TypeScript declaration writes the same rule with coverageRule", () => {
  const candidate = defineNode("candidate", { fields: z.object({ name: z.string() }), label: (n) => n.name, edges: { stances: { to: ["stance"], cardinality: "many" } } });
  const issue = defineNode("issue", { fields: z.object({ title: z.string() }), label: (n) => n.title });
  const stance = defineNode("stance", { fields: z.object({ position: z.string() }), edges: { issue: { to: ["issue"], cardinality: "one" } } });
  const rule = coverageRule("stance-on-every-issue", { over: "candidate", covers: { every: "issue", through: "stances", via: "issue" }, says: "{candidate} has no stance on {issue}", title: "A stance on every issue" });
  const schema = createSchema([candidate, issue, stance] as const);

  it("is judged in a pass over the links and names each pair", () => {
    const store = new Store<AnySchema>({ schema: schema as never, invariants: [rule], snapshot: structuredClone(SEED) as never });
    expect(pairs(store).map((p) => [p.nodes.join(" → "), p.message])).toEqual([
      ["cand:ben → issue:transit", "Ben Lau has no stance on Transit"],
      ["cand:ben → issue:parks", "Ben Lau has no stance on Parks"],
    ]);
    expect(ruleLine(rule, schema as never)?.text).toBe("reaches every issue through stances, then issue");
  });

  it("is written to a document as `covers`, which compiles with no warning", () => {
    const back = toDocument(defineApp({ name: "Voter guide", schema, invariants: [rule] }) as never);
    expect(back.document?.rules?.["stance-on-every-issue"]).toEqual({ over: "candidate", covers: { every: "issue", through: "stances", via: "issue" }, says: "{candidate} has no stance on {issue}", title: "A stance on every issue" });
    expect(compileDocument(back.document).findings.filter((f) => f.severity === "warning").map((f) => f.code)).not.toContain("rule-cost");
  });

  it("a walk the schema cannot follow is could-not-judge, in the checker's words", () => {
    const wrong = coverageRule("wrong", { over: "candidate", covers: { every: "issue", through: "issue" } });
    const store = new Store<AnySchema>({ schema: schema as never, invariants: [wrong], snapshot: structuredClone(SEED) as never });
    const said = store.violations().filter((one) => one.invariant === "wrong");
    expect(said.length).toBeGreaterThan(0);
    expect(said[0]!.status).toBe("could-not-judge");
    expect(said[0]!.message).toContain('"issue" is a relation of stance, not of candidate');
  });
});
