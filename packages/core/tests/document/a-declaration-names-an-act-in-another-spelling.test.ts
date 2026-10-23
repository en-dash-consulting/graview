import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkApp, compileDocument } from "../../src/check.js";
import { createSchema, defineApp, defineNode, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A DECLARATION MAY NAME AN ACT IN ANOTHER SPELLING (Roadmap
 * f-act-spellings-in-declarations). 0.1.48 let a call name
 * `connect-threat-partOf` for `connect-threat-part-of`; a grant or a rule's
 * repair that named it so was still refused by `graview check`. A
 * document's is now written as the act's own name when it compiles, so the
 * policy compares real names when it runs; a name that says no act is
 * refused with the nearest.
 */
const threatWatch = (grant: readonly string[], repair: string) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  roles: ["owner", "analyst"],
  kinds: {
    threat: {
      label: "{name}",
      fields: { name: { type: "string", required: true } },
      edges: { partOf: { to: ["threat"], cardinality: "one", description: "The family it belongs to." } },
    },
  },
  acts: { "add-threat": { title: "Add a threat", creates: "threat" } },
  rules: { "in-a-family": { over: "threat", require: "count(out('partOf')) > 0", says: "{name} belongs to no family", repairs: [{ act: repair }] } },
  policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["analyst"], mutations: grant }] },
});

const compiled = (grant: readonly string[], repair: string) => {
  const result = compileDocument(threatWatch(grant, repair));
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((one) => one.severity === "error")));
  return result.app as GraviewApp<AnySchema>;
};

describe("a document naming an act in another spelling", () => {
  it("compiles a grant and a repair that say connect-threat-partOf, written as connect-threat-part-of", () => {
    const app = compiled(["connect-threat-partOf", "add-threat"], "connect_threat_partOf");
    expect(app.policy!.grants[1]!.mutations).toEqual(["connect-threat-part-of", "add-threat"]);
    expect(app.invariants?.[0]?.repairs).toEqual(["connect-threat-part-of"]);
  });

  it("lets the role the grant names run the act, matched by its real name", () => {
    const app = compiled(["connect-threat-partOf"], "connect-threat-partOf");
    const analyst: Principal = { kind: "human", id: "u:analyst", roles: ["analyst"] };
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [{ id: "t1", kind: "threat", name: "Lumma" }, { id: "t2", kind: "threat", name: "Stealers" }], edges: [] } as never });
    expect(store.permits({ name: "connect-threat-part-of", args: { id: "t1", to: "t2" } }, analyst).ok).toBe(true);
  });

  it("passes graview check", () => {
    const errors = checkApp(compiled(["connect-threat-partOf"], "connect-threat-partOf")).findings.filter((one) => one.severity === "error");
    expect(errors).toEqual([]);
  });

  it("refuses a name no act says, asking whether the nearest was meant", () => {
    const result = compileDocument(threatWatch(["connect-threat-partof-it"], "conect-threat-part-of"));
    expect(result.ok).toBe(false);
    const grant = result.findings.find((one) => one.code === "grant-act");
    const repair = result.findings.find((one) => one.code === "repair-act");
    expect(grant?.fix).toBe('did you mean "connect-threat-part-of"?');
    expect(repair?.fix).toBe('did you mean "connect-threat-part-of"?');
  });
});

describe("an app declared in TypeScript naming an act in another spelling", () => {
  it("is refused by graview check, naming the act's own spelling, since a grant written in code is matched as written", () => {
    const item = defineNode("budgetLine", { fields: z.object({ label: z.string() }) });
    const app = defineApp({ name: "budget", schema: createSchema([item]), mutations: [], policy: { roles: ["owner"], grants: [{ roles: ["owner"], mutations: ["edit-budget-line"] }] } });
    const finding = checkApp(app as never).findings.find((one) => one.code === "grant-unknown-mutation");
    expect(finding?.fix).toBe('Did you mean "edit-budgetLine"? Name it as it is spelled.');
  });
});
