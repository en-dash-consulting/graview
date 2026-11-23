import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat, unbindPerson } from "../../src/binding.js";
import { aiContextOf } from "../../src/catalog.js";
import { bindSchema, createSchema, defineNode, nameOfAuthor, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";
import { namedAuthors, seatLens } from "../../src/seen.js";

/**
 * A PROFILE WHOSE BINDING ENDED IS NAMED ONCE (Graview HQ
 * feature:f-host-names-unbound-profile-once). A profile on a family account
 * was bound to the person entered for it, acted, and the binding later
 * ended. The host and the profile's own seat are told its account, named as
 * the record it was bound to — and that record's name is the profile's own,
 * so what it did reads "Kiddo", never "Kiddo (Kiddo)".
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const renameGift = defineMutation("rename-gift", {
  subject: { kinds: ["gift"], arg: "id" },
  input: z.object({ id: nodeRef(["gift"]), title: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id as string, { title: args.title });
  },
});
const policy: Policy = { grants: [{ roles: ["member"], mutations: ["rename-gift"] }], sees: [{ roles: ["member"], kinds: ["participant", "gift"] }] };

const host: Principal = hostSeat({ id: "host" });
// An account a host names by nothing of its own, as a hosted one is.
const kiddo: Principal = { kind: "human", id: "user_family", roles: ["member"], profile: { id: "prf_kiddo", name: "Kiddo" } };

function family(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    mutations: [renameGift],
    policy,
    snapshot: {
      nodes: [
        { id: "participant:kiddo", kind: "participant", name: "Kiddo" },
        { id: "participant:mia", kind: "participant", name: "Mia" },
        { id: "gift:kite", kind: "gift", title: "A kite" },
      ],
      edges: [],
    },
  } as never);
}

/** Who made the last rename, as `principal`'s own log names its author. */
function lastAuthorTo(store: Store<AnySchema>, principal: Principal): string {
  const seen = store.seenBy(principal);
  const lens = seatLens(store as never, principal);
  const batch = seen.batches().find((one) => one.ops.some((op) => op.mutation?.name === "rename-gift"))!;
  return nameOfAuthor(namedAuthors(store as never, lens, batch.ops)[0]!.author, { graph: seen.graph as never, schema });
}

describe("a profile whose binding ended, to the host", () => {
  it("is named once, as the profile and the record it was bound to share a name", () => {
    const store = family();
    bindPerson(store, kiddo, "participant:kiddo", { author: host });
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: kiddo });
    unbindPerson(store, kiddo, { author: host });
    expect(lastAuthorTo(store, host)).toBe("Kiddo");
    expect(lastAuthorTo(store, kiddo)).toBe("Kiddo");
    expect(aiContextOf(store, { on: "record", id: "gift:kite" }, { principal: host, recent: 20 }).recent.map((one) => one.by)).toContain("Kiddo");
    expect(JSON.stringify(aiContextOf(store, { on: "record", id: "gift:kite" }, { principal: host, recent: 20 }))).not.toContain("Kiddo (Kiddo)");
  });

  it("says the account's own name beside the profile, and never the profile's twice", () => {
    for (const ends of [false, true]) {
      const store = family();
      const named: Principal = { ...kiddo, name: "Sam" };
      bindPerson(store, named, "participant:kiddo", { author: host });
      store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: named });
      if (ends) unbindPerson(store, named, { author: host });
      expect(lastAuthorTo(store, host), String(ends)).toBe("Kiddo (Sam)");
    }
  });

  it("is named once where the store made the profile's person on its first act", () => {
    const store = family();
    store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: kiddo });
    expect(lastAuthorTo(store, host)).toBe("Kiddo");
  });

  it("is named as its person where that person has a name of their own, bound or once bound alike", () => {
    const ann: Principal = { kind: "human", id: "user_ann", roles: ["member"] };
    for (const ends of [false, true]) {
      for (const [account, words] of [[kiddo, "Mia"], [{ ...kiddo, name: "Sam" }, "Mia (Sam)"]] as const) {
        const store = family();
        bindPerson(store, account, "participant:mia", { author: host });
        store.apply({ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: account });
        if (ends) unbindPerson(store, account, { author: host });
        expect(lastAuthorTo(store, host), `${ends} ${words}`).toBe(words);
        expect(lastAuthorTo(store, account), `${ends} ${words}`).toBe(words);
        // Anybody else reads the record, as they always did.
        expect(lastAuthorTo(store, ann), `${ends} ${words}`).toBe("Mia");
      }
    }
  });
});
