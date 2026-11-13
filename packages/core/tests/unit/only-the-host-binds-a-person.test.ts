import { describe, expect, it } from "vitest";
import { bindPerson } from "../../src/binding.js";
import { checkApp } from "../../src/check.js";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { acceptSuggestion, suggest } from "../../src/tidying.js";
import { BIND_PERSON, createSchema, defineApp, defineNode, PermissionDeniedError, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * BINDING AN ACCOUNT TO A PERSON IS THE HOST'S, acting for the app's owner
 * when an invitation is accepted. No grant gives it — not one written in
 * the declaration, not one an edit adds — so `graview check` refuses a grant
 * that names it, an edit refuses to add one, and the store refuses the act
 * from every seat but the host's own, whatever a policy it was handed says.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const schema = createSchema([participant]);

const host: Principal = { kind: "system", id: "host" };
const editor: Principal = { kind: "human", id: "acct-ed", roles: ["editor"] };
const owner: Principal = { kind: "human", id: "acct-own", roles: ["owner"] };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };

const granting = (grants: Policy["grants"]): Policy => ({ roles: ["owner", "editor", "member"], grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["editor"], mutations: ["edit-participant"] }, { roles: ["member"], mutations: ["edit-participant"], self: true }, ...grants] } as Policy);
const storeWith = (policy: Policy | undefined) =>
  new Store<AnySchema>({ schema, ...(policy ? { policy } : {}), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }], edges: [] } } as never);

describe("graview check refuses a grant that gives binding", () => {
  const codes = (policy: Policy) => checkApp(defineApp({ name: "binding", schema, policy }) as never).findings;

  it("refuses an editor's grant of bind-person, in a sentence that says who binds", () => {
    const found = codes(granting([{ roles: ["editor"], mutations: [BIND_PERSON] }])).filter((one) => one.severity === "error");
    const said = found.find((one) => one.code === "grant-gives-binding");
    expect(said).toBeDefined();
    expect(said!.message).toMatch(/no grant gives it/i);
    expect(said!.message).toMatch(/host/i);
    // Said once, as what it is, and not as an act nobody declared.
    expect(found.map((one) => one.code)).not.toContain("grant-unknown-mutation");
  });

  it("refuses one that would let a role propose it", () => {
    const found = codes(granting([{ roles: ["editor"], mutations: [], propose: [BIND_PERSON] } as never]));
    expect(found.filter((one) => one.code === "grant-gives-binding")).toHaveLength(1);
  });

  it("refuses an act of the app's own under binding's name, which would stand in its place", () => {
    const own = { name: BIND_PERSON, title: "Bind", input: z.object({}), apply: () => undefined };
    const found = checkApp(defineApp({ name: "binding", schema, mutations: [own] as never }) as never).findings;
    expect(found.filter((one) => one.code === "binding-act-taken" && one.severity === "error")).toHaveLength(1);
  });

  it("refuses it in a document, compiled and as an edit adds it", () => {
    const doc = {
      format: "graview-document",
      formatVersion: 1,
      name: "Binding",
      kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } } },
      roles: ["owner", "editor"],
      policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["editor"], mutations: [BIND_PERSON] }] },
    };
    const made = compileDocument(doc as never);
    expect(made.ok).toBe(false);
    expect(made.findings.filter((one) => one.severity === "error").map((one) => one.message).join(" ")).toMatch(/no grant gives it/i);

    const own = compileDocument({ ...doc, policy: { grants: [{ roles: ["owner"], mutations: "*" }] }, acts: { [BIND_PERSON]: { title: "Bind", on: "member", effects: [{ set: { name: "x" } }] } } } as never);
    expect(own.findings.filter((one) => one.code === "binding-act-taken" && one.severity === "error")).toHaveLength(1);

    const plain = { ...doc, policy: { grants: [{ roles: ["owner"], mutations: "*" }] } };
    const edited = editDocument(plain as never, [{ op: "add-grant", roles: ["editor"], mutations: [BIND_PERSON] }] as never);
    expect(edited.ok).toBe(false);
    expect(JSON.stringify(edited.ok ? [] : edited.findings)).toMatch(/no grant gives it/i);
  });
});

describe("the store refuses binding from every seat but the host's", () => {
  it("refuses an editor whom a grant names it for", () => {
    const store = storeWith(granting([{ roles: ["editor"], mutations: [BIND_PERSON] }]));
    expect(() => bindPerson(store, bud, "participant:bud", { author: editor })).toThrow(PermissionDeniedError);
    expect(store.permits({ name: BIND_PERSON, args: { record: "participant:bud", seat: "acct-bud" } }, editor).ok).toBe(false);
    expect(() => store.apply({ name: BIND_PERSON, args: { record: "participant:bud", seat: "acct-ed" } }, { author: editor })).toThrow(PermissionDeniedError);
    expect(store.personOf(bud)).toBe("acct-bud");
  });

  it("refuses an owner too, granted every act and binding by name: the host binds for them", () => {
    const store = storeWith(granting([{ roles: ["owner"], mutations: [BIND_PERSON] }]));
    expect(() => bindPerson(store, bud, "participant:bud", { author: owner })).toThrow(PermissionDeniedError);
    expect(() => bindPerson(store, bud, "participant:bud", { author: owner })).toThrow(/only the host/i);
    expect(store.personOf(bud)).toBe("acct-bud");
  });

  it("binds as the host's own seat, with a policy and without one", () => {
    for (const policy of [granting([]), undefined]) {
      const store = storeWith(policy);
      expect(bindPerson(store, bud, "participant:bud", { author: host }).ops).toHaveLength(1);
      expect(store.personOf(bud)).toBe("participant:bud");
    }
  });

  it("refuses the app's own actor, a workflow and another app's change: only the host itself binds", () => {
    for (const author of [
      { kind: "system", id: "tidying", name: "Graview, tidying", automated: true },
      { kind: "system", id: "workflow:weekly", name: "Weekly", automated: true },
      { kind: "system", id: "app:elsewhere" },
    ] as Principal[]) {
      const store = storeWith(granting([]));
      expect(() => bindPerson(store, bud, "participant:bud", { author })).toThrow(PermissionDeniedError);
      expect(store.personOf(bud)).toBe("acct-bud");
    }
  });

  it("never lets a suggestion bind, though a member votes it in", () => {
    const store = new Store<AnySchema>({ schema, policy: granting([]), tidying: { autoAcceptAt: 1 }, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }], edges: [] } } as never);
    const workflow = { kind: "system", id: "workflow:x", name: "X", automated: true } as never;
    let made: { id: string } | undefined;
    try {
      made = suggest(store, [{ name: BIND_PERSON, args: { record: "participant:bud", seat: "acct-bud" } }], { author: workflow, lineage: { basis: "x" } });
    } catch {
      made = undefined;
    }
    if (made) {
      try {
        acceptSuggestion(store, made.id, { author: owner });
      } catch {
        // Refused is as good as not bound.
      }
    }
    expect(store.personOf(bud)).toBe("acct-bud");
  });

  it("never takes a refused binding as a proposal for the owner to accept", () => {
    const store = storeWith(granting([{ roles: ["editor"], mutations: [], propose: [BIND_PERSON] } as never]));
    expect(store.mayPropose({ name: BIND_PERSON, args: { record: "participant:bud", seat: "acct-bud" } }, editor)).toBe(false);
  });

  it("tells the bound seat to nobody whom a grant names binding for", () => {
    const store = storeWith(granting([{ roles: ["editor"], mutations: [BIND_PERSON] }]));
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(JSON.stringify(store.seenBy(editor).graph.snapshot())).not.toContain("acct-bud");
    expect(JSON.stringify(store.seenBy(editor).log.all())).not.toContain("acct-bud");
  });
});
