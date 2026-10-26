import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isProvisional } from "../../src/provenance.js";
import { bindSchema, createSchema, defineNode, KEEP_LINK, nodeRef, PermissionDeniedError, Store, type AnySchema, type Author, type Policy } from "../../src/index.js";

/*
 * KEEPING A LINK IS PERMITTED PER RELATION (FR-172). "Keep this link" was
 * permitted to anyone who could run ANY act that linked, unlinked or made
 * records: a clerk who could only add a property could accept a link a model
 * drew between two people. It is now permitted, as an act that connects
 * would be, to a seat that may run an act whose `connects` or `severs` names
 * that link's relation — and, as before, only on a link whose ends it sees.
 */
const lease = defineNode("lease", { fields: z.object({ label: z.string() }), edges: { about: { to: ["property"] } } });
const property = defineNode("property", { fields: z.object({ label: z.string() }) });
const person = defineNode("person", { fields: z.object({ label: z.string() }), edges: { knows: { to: ["person"] } } });
const schema = createSchema([lease, property, person]);
const { defineMutation } = bindSchema(schema);
const linkLease = defineMutation("link-lease", {
  title: "Say what a lease is about",
  subject: { kinds: ["lease"], arg: "id" },
  connects: ["about"],
  input: z.object({ id: nodeRef(["lease"]), to: nodeRef(["property"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "about", from: args.id, to: args.to });
  },
});
const unlinkLease = defineMutation("unlink-lease", {
  title: "Take back what a lease is about",
  subject: { kinds: ["lease"], arg: "id" },
  severs: ["about"],
  input: z.object({ id: nodeRef(["lease"]), to: nodeRef(["property"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "about", from: args.id, to: args.to });
  },
});
const introduce = defineMutation("introduce", {
  title: "Introduce two people",
  subject: { kinds: ["person"], arg: "id" },
  connects: ["knows"],
  input: z.object({ id: nodeRef(["person"]), to: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "knows", from: args.id, to: args.to });
  },
});
const addProperty = defineMutation("add-property", {
  title: "Add a property",
  creates: ["property"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: `property:${args.label}`, kind: "property", label: args.label } as never);
  },
});

const tidying: Author = { kind: "agent", id: "tidying", name: "Graview, tidying" };
const about = { kind: "about", from: "lease:harbor", to: "property:harbor" };
const knows = { kind: "knows", from: "person:ann", to: "person:bo" };
const seat = (role: string) => ({ kind: "human", id: role, roles: [role] }) as never;
const policy: Policy = {
  grants: [
    { roles: ["leasing"], mutations: ["link-lease"] },
    { roles: ["unleasing"], mutations: ["unlink-lease"] },
    { roles: ["host"], mutations: ["introduce"] },
    { roles: ["clerk"], mutations: ["add-property"] },
  ],
};

function storeOf(given?: Policy) {
  const store = new Store<AnySchema>({
    schema,
    mutations: [linkLease, unlinkLease, introduce, addProperty] as never,
    ...(given ? { policy: given } : {}),
    snapshot: {
      nodes: [
        { id: "lease:harbor", kind: "lease", label: "Harbor lease" },
        { id: "property:harbor", kind: "property", label: "12 Harbor Street" },
        { id: "person:ann", kind: "person", label: "Ann" },
        { id: "person:bo", kind: "person", label: "Bo" },
      ] as never,
      edges: [],
    },
  });
  // Two links a model drew, less than sure: each provisional until a person keeps it.
  store.append([{ primitives: [{ op: "add-edge", edge: about }, { op: "add-edge", edge: knows }], author: tidying, intent: "Tidy", lineage: { basis: "both name the street", confidence: 0.6 } }]);
  return store;
}
const may = (store: Store<AnySchema>, role: string, edge: typeof about) => store.permits({ name: KEEP_LINK, args: edge }, seat(role)).ok;

describe("keeping a link", () => {
  it("is permitted to a seat that may make that relation's links, and not another relation's", () => {
    const store = storeOf(policy);
    expect(may(store, "leasing", about)).toBe(true);
    expect(may(store, "leasing", knows)).toBe(false);
    expect(may(store, "host", knows)).toBe(true);
    expect(may(store, "host", about)).toBe(false);
    expect(() => store.apply({ name: KEEP_LINK, args: knows }, { author: seat("leasing") })).toThrow(PermissionDeniedError);
    store.apply({ name: KEEP_LINK, args: about }, { author: seat("leasing") });
    expect(isProvisional(store, about)).toBe(false);
    expect(isProvisional(store, knows)).toBe(true);
  });

  it("is permitted to a seat that may break that relation's links", () => {
    expect(may(storeOf(policy), "unleasing", about)).toBe(true);
    expect(may(storeOf(policy), "unleasing", knows)).toBe(false);
  });

  it("is not permitted to a seat that may only make records", () => {
    const store = storeOf(policy);
    expect(may(store, "clerk", about)).toBe(false);
    expect(may(store, "clerk", knows)).toBe(false);
  });

  it("is permitted to a grant that names keep-link itself, and to everyone where there is no policy", () => {
    expect(may(storeOf({ grants: [...policy.grants, { roles: ["clerk"], mutations: ["keep-link"] }] }), "clerk", knows)).toBe(true);
    expect(may(storeOf(), "anyone", knows)).toBe(true);
  });
});

/*
 * AND A RELATION NO DECLARED ACT MAKES OR BREAKS (0.1.37): it comes with its
 * derived connect and disconnect, permitted to whoever may make or write the
 * kind it leaves — so a link the tidying actor drew of it is kept by that
 * same seat, not by nobody a policy names.
 */
describe("keeping a link of a relation only its derived acts make", () => {
  const managed = defineNode("property", { fields: z.object({ label: z.string() }), edges: { managedBy: { to: ["person"], cardinality: "one" } } });
  const plain = createSchema([lease, managed, person]);
  const link = { kind: "managedBy", from: "property:harbor", to: "person:ann" };
  const store = new Store<AnySchema>({
    schema: plain,
    mutations: [linkLease, unlinkLease, introduce, addProperty] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "property:harbor", kind: "property", label: "12 Harbor Street" },
        { id: "person:ann", kind: "person", label: "Ann" },
      ] as never,
      edges: [],
    },
  });
  store.append([{ primitives: [{ op: "add-edge", edge: link }], author: tidying, intent: "Tidy", lineage: { basis: "the listing names her", confidence: 0.6 } }]);

  it("is permitted to a seat that may make the kind the relation leaves, as its derived connect is, and to no other", () => {
    expect(may(store, "clerk", link as never)).toBe(true);
    expect(may(store, "host", link as never)).toBe(false);
    store.apply({ name: KEEP_LINK, args: link }, { author: seat("clerk") });
    expect(isProvisional(store, link)).toBe(false);
  });
});

/*
 * AND A DOOR FOR EVERYBODY IS NOT A KEY TO EVERY RECORD'S LINKS (W-201).
 * "Anybody may add a property" lets a seat connect or disconnect only the
 * properties it made; keeping a link its derived acts make or break was
 * permitted on anybody's, so a seat with no role turned a link the tidying
 * actor drew on another's property into one a person accepted.
 */
describe("keeping a link of a relation only its derived acts make, riding a grant to everybody", () => {
  const managed = defineNode("property", { fields: z.object({ label: z.string() }), edges: { managedBy: { to: ["person"], cardinality: "one" } } });
  const plain = createSchema([lease, managed, person]);
  const eve = { kind: "human", id: "eve", roles: [] } as never;
  const make = () => {
    const store = new Store<AnySchema>({
      schema: plain,
      mutations: [linkLease, unlinkLease, introduce, addProperty] as never,
      policy: { grants: [{ roles: "*", mutations: ["add-property", "link-lease"] }] },
      snapshot: {
        nodes: [
          { id: "property:harbor", kind: "property", label: "12 Harbor Street" },
          { id: "person:ann", kind: "person", label: "Ann" },
          { id: "lease:harbor", kind: "lease", label: "Harbor lease" },
        ] as never,
        edges: [],
      },
    });
    store.apply({ name: "add-property", args: { label: "eves" } }, { author: eve });
    const drawn = [
      { kind: "managedBy", from: "property:harbor", to: "person:ann" },
      { kind: "managedBy", from: "property:eves", to: "person:ann" },
      { kind: "about", from: "lease:harbor", to: "property:harbor" },
    ];
    store.append([{ primitives: drawn.map((edge) => ({ op: "add-edge" as const, edge })), author: tidying, intent: "Tidy", lineage: { basis: "the listing names her", confidence: 0.6 } }]);
    return store;
  };

  it("keeps it only on a record the seat made, as its derived connect reaches", () => {
    const store = make();
    const theirs = { kind: "managedBy", from: "property:harbor", to: "person:ann" };
    const mine = { kind: "managedBy", from: "property:eves", to: "person:ann" };
    expect(store.permits({ name: "connect-property-managed-by", args: { id: "property:harbor", to: "person:ann" } }, eve).ok).toBe(false);
    const verdict = store.permits({ name: KEEP_LINK, args: theirs }, eve);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.refusal.message).toMatch(/only on what you made/);
    expect(() => store.apply({ name: KEEP_LINK, args: theirs }, { author: eve })).toThrow(PermissionDeniedError);
    expect(isProvisional(store, theirs)).toBe(true);
    store.apply({ name: KEEP_LINK, args: mine }, { author: eve });
    expect(isProvisional(store, mine)).toBe(false);
  });

  it("leaves a relation a declared act makes to that act's grant, on any record", () => {
    expect(make().permits({ name: KEEP_LINK, args: { kind: "about", from: "lease:harbor", to: "property:harbor" } }, eve).ok).toBe(true);
  });
});
