import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, isWithheld, logSeenBy, nodeRef, refusalOf, Store, type AnySchema, type Principal } from "../../src/index.js";
import { MUTATIONS, oracle, policyOf, rng, SCHEMA, storeAt, world } from "../support/unseen-worlds.js";

/**
 * A SENTENCE NAMES ONLY WHAT ITS READER MAY SEE (FR-55).
 *
 * An op's sentence is made by its act's `describe`, which reads the graph:
 * "Drop d:barn in favour of Freya Davies". Two ways it reached a seat that
 * may not see Freya: the own-words exception excused another author's
 * call because the op's primitives carried a value the seat had written
 * (its own guess, `ref: "b:freya"`), and a sentence that read a hidden
 * record through an edge named no hidden id at all. Now a seat's own words
 * excuse only what it wrote, and an op records which records its sentence
 * read (`described`): another author's op is served whole only when its
 * reader may see every one of them.
 */
const viewer: Principal = { kind: "human", id: "u2", roles: ["r1"] };
const everyone: Principal = { kind: "human", id: "u1", roles: ["r1", "r2"] };

function barn() {
  const store = new Store<AnySchema>({
    schema: SCHEMA as unknown as AnySchema,
    mutations: MUTATIONS as never,
    policy: policyOf({ sights: [{ roles: ["r1"], kinds: ["d"] }, { roles: ["r2"], kinds: ["a", "b", "c", "d"] }] }),
    snapshot: { nodes: [{ id: "b:freya", kind: "b", title: "Freya Davies" }], edges: [] },
  });
  // The viewer guesses an id, and writes it into a record of its own.
  store.apply({ name: "make", args: { title: "Barn", ref: "b:freya" } }, { author: viewer });
  return store;
}

describe("a sentence names only what its reader may see", () => {
  it("withholds another author's act whose call names a hidden record, though its primitives carry the seat's own words", () => {
    const store = barn();
    store.apply({ name: "drop", args: { id: "d:barn", because: "b:freya" } }, { author: everyone });
    const served = logSeenBy(store, viewer);
    expect(isWithheld(served[1]!)).toBe(true);
    expect(JSON.stringify(served[1])).not.toContain("Freya");
    expect(JSON.stringify(served[1])).not.toContain('"because"');
    // The seat's own act stays its own.
    expect(isWithheld(served[0]!)).toBe(false);
  });

  it("withholds an act whose sentence read a hidden record through an edge, and serves it whole to a seat that sees it", () => {
    const store = barn();
    store.applyPrimitives([{ op: "add-edge", edge: { kind: "rel", from: "d:barn", to: "b:freya" } }], { author: { kind: "system" } });
    const tagged = store.apply({ name: "tag", args: { id: "d:barn" } }, { author: everyone });
    expect(tagged.ops[0]!.intent).toBe("Tag Barn near Freya Davies");
    expect(tagged.ops[0]!.described).toEqual(expect.arrayContaining(["d:barn", "b:freya"]));
    const toViewer = logSeenBy(store, viewer).at(-1)!;
    expect(isWithheld(toViewer)).toBe(true);
    expect(JSON.stringify(toViewer)).not.toContain("Freya");
    const toEveryone = logSeenBy(store, everyone).at(-1)!;
    expect(toEveryone.intent).toBe("Tag Barn near Freya Davies");
  });

  it("says an act's own refusal without its words when they were worded from a record its caller may not see", () => {
    const { defineMutation } = bindSchema(SCHEMA);
    const claim = defineMutation("claim", {
      title: "Claim",
      subject: { kinds: ["d"], arg: "id" },
      input: z.object({ id: nodeRef(["d"]), from: z.string() }),
      apply(ctx, args) {
        const holder = ctx.graph.getNode(args.from) as { title?: string } | undefined;
        throw new Error(`${holder?.title ?? "Nobody"} holds it already.`);
      },
    });
    const store = new Store<AnySchema>({
      schema: SCHEMA as unknown as AnySchema,
      mutations: [...MUTATIONS, claim] as never,
      policy: policyOf({ sights: [{ roles: ["r1"], kinds: ["d"] }, { roles: ["r2"], kinds: ["a", "b", "c", "d"] }] }),
      snapshot: { nodes: [{ id: "b:freya", kind: "b", title: "Freya Davies" }, { id: "d:barn", kind: "d", title: "Barn", ref: "d:barn" }], edges: [] },
    });
    const said = (author: Principal) => {
      try {
        store.apply({ name: "claim", args: { id: "d:barn", from: "b:freya" } }, { author });
      } catch (error) {
        return refusalOf(error);
      }
      throw new Error("not refused");
    };
    expect(said(viewer)).toEqual({ reason: "invalid", sentence: "“Claim” could not be done as asked." });
    expect(said(everyone).sentence).toBe("Freya Davies holds it already.");
  });

  it(`never serves another author's sentence quoting a record its reader may not see — 1,000 random worlds`, () => {
    let whole = 0;
    let withheld = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const store = storeAt(w, w.ops.length);
      const r = rng(seed * 7);
      const ids = () => store.graph.allNodes().map((node) => node.id);
      for (let round = 0; round < 6; round++) {
        const live = ids();
        if (live.length === 0) break;
        const pick = () => live[Math.floor(r() * live.length)]!;
        const call = [
          { name: "credit", args: { id: pick(), because: pick() } },
          { name: "tag", args: { id: pick() } },
          { name: "drop", args: { id: pick(), because: pick() } },
          { name: "point", args: { id: pick(), ref: pick() } },
        ][Math.floor(r() * 4)]!;
        try {
          store.applyAll([call], { author: { kind: "system", id: "host" } });
        } catch {
          // Refused alike for every reader.
        }
        // A link no argument names, for a sentence to follow.
        const now = ids();
        const any = () => now[Math.floor(r() * now.length)]!;
        if (now.length > 1 && r() < 0.5) {
          try {
            store.applyPrimitives([{ op: "add-edge", edge: { kind: "rel", from: any(), to: any() } }], { author: { kind: "system", id: "host" } });
          } catch {
            // A link already there.
          }
        }
      }
      // Every record's title, for the ones this viewer may not see: what no sentence it is served may quote.
      const hidden = new Set([...w.nodes, ...store.graph.allNodes()].filter((node) => !oracle(w, node.id)).map((node) => String(node["title"])));
      const quoted = (sentence: string) => [...hidden].find((title) => new RegExp(`(^|[^A-Za-z0-9])${title}($|[^A-Za-z0-9])`).test(sentence));
      for (const op of logSeenBy(store, w.viewer).slice(w.ops.length)) {
        if (isWithheld(op)) {
          withheld++;
          continue;
        }
        whole++;
        const title = quoted(`${op.intent} ${op.batchIntent ?? ""}`);
        expect(title, `seed ${seed}: ${op.id} "${op.intent}" quotes a hidden record's title`).toBeUndefined();
      }
    }
    expect(whole).toBeGreaterThan(500);
    expect(withheld).toBeGreaterThan(500);
  }, 120_000);
});
