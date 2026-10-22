import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { actSpelledAs, nearestAct, Store, UnknownMutationError, type AnySchema, type GraviewApp } from "../../src/index.js";
import { InvalidArguments } from "../../src/mutations/invalid-arguments.js";
import { actWords } from "../../src/document/policy-words.js";

/**
 * Filed by an agent building Threat Watch: a threat `partOf` another got
 * the act `connect-threat-part-of`, and `connect-threat-partOf` was "not
 * something this app can do", with no suggestion; the act read "Set the
 * threat"; `edit-threat` refused `whatToDo` without saying `set-verdict`
 * writes it; and a score given as "8.6" was refused as not a number.
 */
const threatWatch = {
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  kinds: {
    threat: {
      label: "{name}",
      fields: {
        name: { type: "string", required: true },
        score: { type: "number" },
        verdict: { type: "enum", options: ["watch", "act"] },
        whatToDo: { type: "text" },
      },
      edges: {
        partOf: { to: ["threat"], cardinality: "one", description: "The family it belongs to." },
        hits: { to: ["system"] },
      },
    },
    system: { label: "{name}", fields: { name: { type: "string", required: true } } },
    cve: { noun: "CVE", plural: "CVEs", label: "{name}", fields: { name: { type: "string", required: true } } },
  },
  acts: {
    "add-threat": { title: "Add a threat", creates: "threat" },
    "set-verdict": { title: "Set the verdict", on: "threat", args: { verdict: { type: "enum", options: ["watch", "act"] }, whatToDo: { type: "text" } }, sets: { verdict: "$verdict", whatToDo: "$whatToDo" } },
  },
};

const compiled = compileDocument(threatWatch);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const store = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: (app.mutations ?? []) as never,
    snapshot: {
      nodes: [
        { id: "t1", kind: "threat", name: "Lumma stealer" },
        { id: "t2", kind: "threat", name: "Infostealers" },
        { id: "s1", kind: "system", name: "Mail gateway" },
      ],
      edges: [],
    } as never,
  });

describe("an act asked for in another spelling", () => {
  it("connect-threat-partOf is connect-threat-part-of, and the log names the act by its own name", () => {
    const s = store();
    const result = s.apply({ name: "connect-threat-partOf", args: { id: "t1", to: "t2" } });
    expect(s.graph.out("t1", "partOf").map((node) => node.id)).toEqual(["t2"]);
    expect(result.ops[0]!.mutation?.name).toBe("connect-threat-part-of");
  });

  it("a relation spelled as it was declared keeps its one spelling: connect-threat-hits", () => {
    const s = store();
    s.apply({ name: "connect-threat-hits", args: { id: "t1", to: "s1" } });
    expect(s.graph.out("t1", "hits").map((node) => node.id)).toEqual(["s1"]);
  });

  it("is previewed and permitted under the same name", () => {
    const s = store();
    expect(s.preview({ name: "connect_threat_partOf", args: { id: "t1", to: "t2" } }).diff.addedEdges).toHaveLength(1);
    expect(s.permits({ name: "connect-threat-partOf", args: { id: "t1", to: "t2" } }).ok).toBe(true);
  });

  it("a name no act says is refused with the nearest: did you mean connect-threat-part-of?", () => {
    const s = store();
    let thrown: unknown;
    try {
      s.apply({ name: "connect-threat-partof-it", args: { id: "t1", to: "t2" } });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UnknownMutationError);
    expect((thrown as UnknownMutationError).nearest).toBe("connect-threat-part-of");
    expect((thrown as Error).message).toContain('did you mean "connect-threat-part-of"?');
  });

  it("a spelling two acts share is neither, and a name near nothing suggests nothing", () => {
    expect(actSpelledAs("edit-budgetLine", ["edit-budget-line"])).toBe("edit-budget-line");
    expect(actSpelledAs("edit-budget-line", ["edit-budgetLine", "edit-budget_line"])).toBeUndefined();
    expect(nearestAct("launch-rocket", ["add-threat", "edit-threat"])).toBeUndefined();
  });
});

describe("a relation to its own kind is titled in its own words", () => {
  const titleOf = (name: string) => store().allMutations().find((act) => act.name === name)?.title;

  it("Set the family it belongs to, not Set the threat", () => {
    expect(titleOf("connect-threat-part-of")).toBe("Set the family it belongs to");
    expect(titleOf("disconnect-threat-part-of")).toBe("Clear the family it belongs to");
  });

  it("a grant says it as the button does", () => {
    expect(actWords(threatWatch as never, "connect-threat-part-of")).toContain("Set the family it belongs to");
  });

  it("without a description that names the record, the relation's words follow: Set the threat (part of)", () => {
    const bare = compileDocument({ ...threatWatch, kinds: { ...threatWatch.kinds, threat: { ...threatWatch.kinds.threat, edges: { partOf: { to: ["threat"], cardinality: "one" } } } } });
    if (!bare.ok) throw new Error("compiles");
    expect(new Store<AnySchema>({ schema: bare.app.schema, mutations: (bare.app.mutations ?? []) as never }).allMutations().find((act) => act.name === "connect-threat-part-of")?.title).toBe("Set the threat (part of)");
  });

  it("a relation to another kind reads as it did: Link a system", () => {
    expect(titleOf("connect-threat-hits")).toBe("Link a system");
  });
});

describe("an edit refuses a field another act writes, naming that act", () => {
  it("edit-threat given whatToDo says whatToDo is set by set-verdict", () => {
    const s = store();
    let thrown: unknown;
    try {
      s.apply({ name: "edit-threat", args: { id: "t1", whatToDo: "Block the domain" } });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InvalidArguments);
    expect((thrown as Error).message).toContain("whatToDo is set by set-verdict");    expect(s.graph.getNode("t1")).not.toHaveProperty("whatToDo");
  });

  it("an argument no act writes is still said as one it does not take", () => {
    expect(() => store().apply({ name: "edit-threat", args: { id: "t1", colour: "red" } })).toThrow(/does not take "colour"/);
  });
});

describe("a number given as its digits", () => {
  it("'8.6' for a number field is 8.6, said nothing of", () => {
    const s = store();
    s.apply({ name: "edit-threat", args: { id: "t1", score: "8.6" } });
    expect(s.graph.getNode("t1")).toMatchObject({ score: 8.6 });
  });

  it("anything that is not exactly a number is refused as before", () => {
    for (const score of ["8.6 high", "", " 8", "eight", "0x10"]) expect(() => store().apply({ name: "edit-threat", args: { id: "t1", score } }), score).toThrow(InvalidArguments);
  });

  it("a text field given digits keeps them as text", () => {
    const s = store();
    s.apply({ name: "edit-threat", args: { id: "t1", name: "42" } });
    expect(s.graph.getNode("t1")).toMatchObject({ name: "42" });
  });
});
