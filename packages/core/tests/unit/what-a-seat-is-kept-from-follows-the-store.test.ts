import { afterEach, describe, expect, it, vi } from "vitest";
import { bindSchema, createSchema, declareInstallation, defineNode, FIELD_SIGHT, INSTALLATION_MODULE, profilePersonId, Store, z, type AnySchema, type Principal } from "../../src/index.js";
import { MUTATIONS, schema as phones } from "../support/hidden-phones.js";

/*
 * WHAT A SEAT IS KEPT FROM FOLLOWS THE STORE (Roadmap
 * f-visitor-link-check-off-the-draw-clock). `kindsKeptFrom` keeps its
 * answer while nothing it reads has changed; these hold that the answer it
 * gives after a change is the new one — a module turned off by an op, the
 * seat's own person added, field sight being judged, publishing loaded, a
 * change a host's `admit` refused and put back — and never the one it kept.
 */
afterEach(() => {
  vi.restoreAllMocks();
  delete FIELD_SIGHT.on;
});

const fresh = (store: object, principal: Principal) => [...(store as { kindsKeptNow(principal: Principal): ReadonlySet<string> }).kindsKeptNow(principal)].sort();
const kept = (store: Store<AnySchema>, principal: Principal) => [...store.kindsKeptFrom(principal)].sort();

describe("a module", () => {
  const installation = declareInstallation({ roles: ["coordinator", "gardener"], admin: "coordinator" });
  const garden = () =>
    new Store<AnySchema>({
      schema: createSchema([...installation.kinds]) as unknown as AnySchema,
      mutations: installation.mutations as never,
      modules: installation.modules,
      policy: installation.withPolicy({ roles: ["gardener"], grants: [] }),
      snapshot: { nodes: [{ id: "ravi", kind: "user", label: "Ravi", email: "ravi@garden.test", roles: ["gardener"], status: "active" }], edges: [] } as never,
    });
  const ravi: Principal = { kind: "human", id: "ravi", roles: ["gardener"] };

  it("turned off by an op changes what a seat is kept from, at once", () => {
    const store = garden();
    expect(kept(store, ravi)).toEqual(["invitation", "user"]);
    store.setEnabledModules([]);
    expect(store.modules.administered.has(INSTALLATION_MODULE)).toBe(false);
    expect(kept(store, ravi)).toEqual(fresh(store, ravi));
    expect(kept(store, ravi)).toEqual([]);
  });
});

describe("the seat's own person", () => {
  /* The people need an email a profile does not carry, so a profile's person cannot be made on first use: until somebody adds it, the seat is nobody here. */
  const explorer = defineNode("explorer", { fields: z.object({ name: z.string().min(1), email: z.string().min(1) }), people: true });
  const note = defineNode("note", { fields: z.object({ label: z.string() }) });
  const camp = createSchema([explorer, note]);
  const { defineMutation } = bindSchema(camp);
  const jot = defineMutation("jot", {
    creates: ["note"],
    doneAsMe: true,
    input: z.object({ label: z.string() }),
    apply(ctx, args) {
      ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label });
    },
  });
  const join = defineMutation("join", {
    creates: ["explorer"],
    input: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    apply(ctx, args) {
      ctx.addNode({ id: args.id, kind: "explorer", name: args.name, email: args.email });
    },
  });
  const store = () =>
    new Store<AnySchema>({
      schema: camp as unknown as AnySchema,
      mutations: [jot, join] as never,
      policy: { grants: [{ roles: ["camper"], mutations: ["jot"] }, { roles: ["lead"], mutations: "*" }], sees: [{ roles: ["camper", "lead"], kinds: ["explorer"] }] },
      snapshot: { nodes: [], edges: [] },
    });
  const mia: Principal = { kind: "human", id: "user:mia", roles: ["camper"], profile: { id: "prf_mia", name: "Mia" } };
  const lead: Principal = { kind: "human", id: "user:lead", roles: ["lead"] };

  it("added by the server's state, adopted, makes an act done as the seat its own, and what it begins no longer kept from it", () => {
    const camp = store();
    /* No person to be: "jot" is not offered, so a note is a kind Mia may neither see nor begin. */
    expect(camp.permittedMutations(mia).map((one) => one.name)).not.toContain("jot");
    expect(kept(camp, mia)).toEqual(["note"]);
    /* Her person, as a host's server holds it: no op of this store's made it, and the log is as long as it was. */
    camp.adopt({ snapshot: { nodes: [{ id: profilePersonId("user:mia", { id: "prf_mia" }), kind: "explorer", name: "Mia", email: "mia@camp.test" }], edges: [] } as never, log: [] });
    expect(camp.permittedMutations(mia).map((one) => one.name)).toContain("jot");
    expect(kept(camp, mia)).toEqual(fresh(camp, mia));
    expect(kept(camp, mia)).toEqual([]);
  });

  /* Each pair asked in the order that would hand the second the first's answer, were they taken for one seat. */
  const askedInTurn = (first: Principal, second: Principal) => {
    const camp = store();
    const answers = [kept(camp, first), kept(camp, second)];
    expect(answers).toEqual([fresh(camp, first), fresh(camp, second)]);
    return answers;
  };

  it("is worked out for the profile the seat is judged by: one whose profile a shared seat does not carry is another seat", () => {
    const shared = { ...mia, shared: 1 } as unknown as Principal;
    const [sharedFirst, miaAfter] = askedInTurn(shared, mia);
    expect(miaAfter).toEqual(["note"]);
    expect(sharedFirst).not.toEqual(miaAfter);
    const [miaFirst, sharedAfter] = askedInTurn(mia, shared);
    expect(sharedAfter).toEqual(sharedFirst);
    expect(miaFirst).toEqual(["note"]);
  });

  it("is never kept for a kind, an id or a role that is not a string, and is worked out correctly for it", () => {
    const camper: Principal = { kind: "human", id: "user:ada", roles: ["camper"] };
    const posing = { ...camper, roles: [{ toJSON: () => "camper" }] } as unknown as Principal;
    const [posed, real] = askedInTurn(posing, camper);
    expect(real).toEqual([]);
    expect(posed).not.toEqual(real);
    const camp = store();
    for (const odd of [posing, { kind: Symbol("human"), roles: ["camper"] }, { kind: "human", roles: [7] }] as unknown as Principal[]) {
      expect(kept(camp, odd)).toEqual(fresh(camp, odd));
    }
    /* An id that is a function is no seat's: working it out refuses it, as it always did, and nothing is kept for it. */
    const called = { kind: "human", id: () => "user:ada", roles: ["camper"] } as unknown as Principal;
    expect(() => fresh(camp, called)).toThrow();
    expect(() => kept(camp, called)).toThrow();
    expect((camp as unknown as { keptKinds?: { seats: Map<string, unknown> } }).keptKinds?.seats.size ?? 0).toBe(0);
  });

  it("reads a seat acting for nobody (`onBehalfOf: null`) as acting for nobody, and answers it apart from one that says nothing", () => {
    const loose = { kind: "human", id: "user:ada", roles: ["camper"], onBehalfOf: null } as unknown as Principal;
    const [nobody] = askedInTurn(loose, { kind: "human", id: "user:ada", roles: ["camper"] });
    expect(nobody).toEqual([]);
    /* The system with null beside it is not the system, as `isSystem` reads it: kept apart, each as worked out afresh. */
    askedInTurn({ kind: "system", onBehalfOf: null } as unknown as Principal, { kind: "system" });
    askedInTurn({ kind: "system" }, { kind: "system", onBehalfOf: null } as unknown as Principal);
  });

  it("asked by a host's `admit` of a change it then refuses: what was worked out over the change is let go with it", () => {
    const camp = store();
    kept(camp, mia);
    expect(() =>
      camp.apply(
        { name: "join", args: { id: "explorer:ada", name: "Ada", email: "ada@camp.test" } },
        {
          author: lead,
          admit: () => {
            kept(camp, mia);
            throw new Error("not today");
          },
        },
      ),
    ).toThrow(/not today/);
    expect((camp as unknown as { keptKinds?: unknown }).keptKinds).toBeUndefined();
    const judged = vi.spyOn(camp as unknown as { kindsKeptNow(principal: Principal): ReadonlySet<string> }, "kindsKeptNow");
    expect(kept(camp, mia)).toEqual(["note"]);
    expect(judged).toHaveBeenCalledTimes(1);
  });
});

describe("field sight", () => {
  const reader: Principal = { kind: "human", id: "person:rex", roles: ["reader"] };
  const readOnly = () =>
    new Store<AnySchema>({
      schema: phones as unknown as AnySchema,
      mutations: MUTATIONS as never,
      policy: { roles: ["reader"], grants: [], sees: [{ roles: ["reader"], kinds: ["contact"], fields: ["name"] }] },
      snapshot: { nodes: [{ id: "contact:doc", kind: "contact", name: "Doc", phone: "555 0101" }], edges: [] } as never,
    });

  it("judged at last changes what a seat is kept from, though nothing in the store changed", () => {
    const store = readOnly();
    expect(kept(store, reader)).toContain("contact");
    FIELD_SIGHT.on = true;
    expect(kept(store, reader)).not.toContain("contact");
    expect(kept(store, reader)).toEqual(fresh(store, reader));
  });
});

describe("publishing", () => {
  it("loaded is worked out again, though nothing in the store changed", async () => {
    const store = new Store<AnySchema>({ schema: phones as unknown as AnySchema, mutations: MUTATIONS as never, policy: { roles: ["reader"], grants: [], sees: [{ roles: ["reader"], kinds: ["contact"] }] }, publishing: { mode: "on-publish", working: ["reader"] } as never, snapshot: { nodes: [], edges: [] } });
    const reader: Principal = { kind: "human", id: "person:rex", roles: ["reader"] };
    kept(store, reader);
    const judged = vi.spyOn(store as unknown as { kindsKeptNow(principal: Principal): ReadonlySet<string> }, "kindsKeptNow");
    await import("../../src/publishing.js");
    expect(kept(store, reader)).toEqual(fresh(store, reader));
    expect(judged).toHaveBeenCalledTimes(2);
  });
});
