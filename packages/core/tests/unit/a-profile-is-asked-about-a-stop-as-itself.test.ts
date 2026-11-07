import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, profilePersonId, Store, z, type AnySchema, type Author, type Principal } from "../../src/index.js";
import { mayStopSuggesting, servedStops, stopSuggesting, suggest } from "../../src/tidying.js";

/**
 * TWO PROFILES OF ONE ACCOUNT ARE TWO SEATS (Roadmap f-viewer-state-and-me-framework,
 * f-inbox-needs-you-first). A tray asks who may stop a kind of suggestion once a
 * graph tick for each seat, and what one profile may do is not what another may:
 * one whose person was removed is done with what is done as them.
 */
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true, tidying: true };
const nick: Principal = { kind: "human", id: "user:nick", name: "Nick", roles: ["family"] };
const mia: Principal = { ...nick, profile: { id: "prf_mia", name: "Mia" } };
const leo: Principal = { ...nick, profile: { id: "prf_leo", name: "Leo" } };
const JADE = { name: "sign", args: { id: "rock:jade" } };

/** Mia and Leo each signed a rock, Leo's person has since been removed, and the app's own actor suggests another. */
function suggested() {
  const explorer = defineNode("explorer", { people: true, fields: z.object({ name: z.string() }) } as never);
  const rock = defineNode("rock", { fields: z.object({ title: z.string(), signed: z.string().optional() }) } as never);
  const schema = createSchema([explorer, rock]);
  const { defineMutation } = bindSchema(schema);
  const sign = defineMutation("sign", { title: "Sign it", doneAsMe: true, subject: { kinds: ["rock"], arg: "id" }, input: z.object({ id: nodeRef(["rock"]) }), apply: (ctx: any, args: any) => ctx.patchNode(args.id, { signed: ctx.me }) } as never);
  const store = new Store({
    schema,
    mutations: [sign] as never,
    policy: { roles: ["family"], grants: [{ roles: ["family"], mutations: "*" }] },
    snapshot: {
      nodes: [
        { id: "user:nick", kind: "explorer", name: "Nick" },
        { id: "rock:quartz", kind: "rock", title: "Quartz" },
        { id: "rock:opal", kind: "rock", title: "Opal" },
        { id: "rock:jade", kind: "rock", title: "Jade" },
      ],
      edges: [],
    } as never,
  }) as unknown as Store<AnySchema>;
  store.apply({ name: "sign", args: { id: "rock:quartz" } }, { author: mia });
  store.apply({ name: "sign", args: { id: "rock:opal" } }, { author: leo });
  store.apply({ name: "remove-explorer", args: { id: profilePersonId("user:nick", { id: "prf_leo" }) } }, { author: { kind: "system" } });
  const suggestion = suggest(store, [JADE], { author: actor, lineage: { basis: "It was found together", confidence: 0.8 } })!;
  return { store, suggestion: { calls: suggestion.suggests!, author: suggestion.author, lineage: suggestion.lineage }, id: suggestion.id };
}

describe("whether a profile may stop a kind of suggestion", () => {
  it("is answered for that profile, whichever of the account's profiles was asked first in the tick", () => {
    const { store, suggestion } = suggested();
    expect(store.permits(JADE, leo).ok).toBe(false);
    expect(mayStopSuggesting(store, suggestion, mia)).toBe(true);
    expect(mayStopSuggesting(store, suggestion, leo)).toBe(false);
    const again = suggested();
    expect(mayStopSuggesting(again.store, again.suggestion, leo)).toBe(false);
    expect(mayStopSuggesting(again.store, again.suggestion, mia)).toBe(true);
  });

  it("refuses the profile that may not, in the same tick another one was told it may", () => {
    const { store, suggestion, id } = suggested();
    expect(mayStopSuggesting(store, suggestion, mia)).toBe(true);
    expect(() => stopSuggesting(store, id, { author: leo })).toThrow(/no record here/);
  });

  it("serves each profile its own account of the stops", () => {
    const { store, id } = suggested();
    stopSuggesting(store, id, { author: mia });
    expect(servedStops(store, mia)?.stops.length).toBe(1);
    expect(servedStops(store, leo)?.stops ?? []).toEqual([]);
  });
});
