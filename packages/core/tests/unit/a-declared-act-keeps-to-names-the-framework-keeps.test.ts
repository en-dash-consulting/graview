import { describe, expect, it } from "vitest";
import { bindPerson } from "../../src/binding.js";
import { compileDocument } from "../../src/check.js";
import { compileDocumentWithoutCheck, editDocument } from "../../src/document/index.js";
import { BIND_PERSON, createSchema, defineNode, Store, z, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A DECLARED ACT KEEPS TO NAMES THE FRAMEWORK KEEPS FOR ITSELF. A name the
 * framework answers with an act of its own is never an app's: a document
 * that declares one is refused, an edit may not add one, and a store
 * answers the name with the framework's act whatever the app declared.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const schema = createSchema([participant]);
const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud" };

const doc = {
  format: "graview-document",
  formatVersion: 1,
  name: "Reserved",
  kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } } },
};
const ownAct = { title: "Mine", on: "member", effects: [{ set: { name: "x" } }] };

describe("a declared act keeps to names the framework keeps", () => {
  it("is refused in a document, checked or not, in a sentence that says to rename it", () => {
    for (const made of [compileDocument({ ...doc, acts: { [BIND_PERSON]: ownAct } } as never), compileDocumentWithoutCheck({ ...doc, acts: { [BIND_PERSON]: ownAct } } as never)]) {
      expect(made.ok).toBe(false);
      const said = made.findings.find((one) => one.code === "binding-act-taken");
      expect(said?.severity).toBe("error");
      expect(said?.fix).toMatch(/another name/i);
    }
  });

  it("is refused as an edit adds it", () => {
    const edited = editDocument(doc as never, [{ op: "add-act", act: BIND_PERSON, ...ownAct }] as never);
    expect(edited.ok).toBe(false);
    expect(JSON.stringify(edited.ok ? [] : edited.findings)).toContain("binding-act-taken");
  });

  it("is answered by the framework's own act in a store, whatever the app declares", () => {
    let ran = 0;
    const declared = { name: BIND_PERSON, title: "Mine", input: z.object({}).passthrough(), apply: () => { ran += 1; return []; } };
    const store = new Store<AnySchema>({ schema, mutations: [declared] as never, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }], edges: [] } } as never);
    expect(store.allMutations().some((one) => one === (declared as never))).toBe(false);
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(ran).toBe(0);
    expect(store.graph.personBoundTo?.("acct-bud")).toBe("participant:bud");
  });
});
