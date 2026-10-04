import { describe, expect, it } from "vitest";
import { logSeenBy, type Principal } from "../../src/index.js";
import { canonical, fold, rng, schemaOf, storeAt, storeOf, unseenIds, world } from "../support/unseen-worlds.js";

/**
 * A SEAT IS SERVED ITS OWN WORDS (FR-55).
 *
 * The seat view clears a field that names a record the seat may not see,
 * or withholds the record when the field is required — and so a seat that
 * wrote a guessed id into its own record learned whether the guess was
 * real: an editor adding a vendor whose category is `category:venue` saw
 * the field come back cleared, or the vendor withheld, when the venue
 * existed, and as written when `category:nothing-here` did not. A value a
 * seat wrote tells it nothing it did not say: a field whose current value
 * this seat's principal wrote — or the person an agent acts for — is served
 * as written, and a record withheld only for such a field is served.
 */
const WORLDS = 1000;

/** Every whole mention of an id — `d:n1`, never the start of `d:n10` — said as `<id>`. */
const unnamed = (text: string, id: string): string => text.split(/([\w:-]+)/).map((part) => (part === id ? "<id>" : part)).join("");
/** Everything a seat is served, with one id written out of it. */
const servedOf = (store: ReturnType<typeof storeOf>, viewer: Principal, id: string) =>
  unnamed(JSON.stringify({ snapshot: store.seenBy(viewer).snapshot(), log: logSeenBy(store, viewer) }), id).replace(/batch:[a-z0-9]+:/g, "batch:minted:").replace(/"at":"[^"]*"/g, "\"at\":\"now\"");

describe("a seat is served its own words", () => {
  it("serves a record the seat made naming a hidden record exactly as one naming nothing", () => {
    const w = Array.from({ length: 50 }, (_, at) => world(at + 1)).find((one) => one.nodes.filter((node) => node.kind === "b" || node.kind === "c").length >= 2)!;
    const viewer = { kind: "human" as const, id: "editor", roles: ["r1"] };
    const sights = [{ roles: ["r1"], kinds: ["a", "d"] }];
    const make = (ref: string) => {
      const store = storeOf({ ...w, sights, viewer });
      store.apply({ name: "make", args: { title: "Barn", ref } }, { author: viewer });
      return store;
    };
    const hidden = w.nodes.find((node) => node.kind === "b" || node.kind === "c")!.id;
    const nothing = `${hidden.split(":")[0]}:nothing-here`;
    const there = make(hidden);
    expect(servedOf(there, viewer, hidden)).toBe(servedOf(make(nothing), viewer, nothing));
    // Its own record is served as written, required field and all.
    expect(there.seenBy(viewer).graph.getNode("d:barn")).toMatchObject({ ref: hidden });
    // Somebody else's record naming the same hidden one is still withheld from it.
    const someone = { kind: "human" as const, id: "someone", roles: ["r1"] };
    there.apply({ name: "make", args: { title: "Shed", ref: hidden } }, { author: someone });
    expect(there.seenBy(viewer).graph.getNode("d:shed")).toBeUndefined();
    // Once somebody else points that field at a hidden record, the words are theirs, and the record is withheld again.
    const another = w.nodes.find((node) => (node.kind === "b" || node.kind === "c") && node.id !== hidden)!.id;
    there.apply({ name: "point", args: { id: "d:barn", ref: another } }, { author: someone });
    expect(there.seenBy(viewer).graph.getNode("d:barn")).toBeUndefined();
  });

  it(`serves what a seat wrote identically whether the id it named exists — and folds — ${WORLDS.toLocaleString("en")} random worlds`, () => {
    let probed = 0;
    for (let seed = 1; seed <= WORLDS; seed++) {
      const w = world(seed, { required: seed % 2 === 0 });
      const there = new Set(w.nodes.map((node) => node.id));
      // A hidden record the seat has not already named in its own words: those it is served already.
      const before = servedOf(storeAt(w, w.ops.length), w.viewer, "\u0000");
      const hidden = unseenIds(w).filter((id) => there.has(id) && !before.includes(JSON.stringify(id)));
      if (hidden.length === 0) continue;
      const r = rng(seed * 31337);
      const named = hidden[Math.floor(r() * hidden.length)]!;
      const nothing = `${named.split(":")[0]}:never-${seed}`;
      const mine = w.nodes.filter((node) => !hidden.includes(node.id)).map((node) => node.id);
      const write = (ref: string) => {
        const store = storeAt(w, w.ops.length);
        store.apply({ name: "make", args: { title: "Guess", ref } }, { author: w.viewer });
        if (mine.length > 0) {
          try {
            store.apply({ name: "point", args: { id: mine[0]!, ref } }, { author: w.viewer });
          } catch {
            // A record the seat may not see is refused, alike for both.
          }
        }
        return store;
      };
      const a = write(named);
      const b = write(nothing);
      expect(servedOf(a, w.viewer, named), `seed ${seed}: ${named} served unlike ${nothing}`).toBe(servedOf(b, w.viewer, nothing));
      // What it is served still folds to what it is served.
      expect(canonical(fold(schemaOf(w), logSeenBy(a, w.viewer))), `seed ${seed}: folds`).toBe(canonical(a.seenBy(w.viewer).snapshot()));
      probed++;
    }
    expect(probed).toBeGreaterThan(WORLDS / 3);
  }, 120_000);
});
