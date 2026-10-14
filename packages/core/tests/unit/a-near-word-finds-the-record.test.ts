import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, Store, type Hit, type Policy, type Principal } from "../../src/index.js";
import { NEAR_BELOW, search, slipsBetween, stemOf, type NearCandidate, type SearchRanker } from "../../src/search.js";

/**
 * A NEAR WORD FINDS THE RECORD, AND SAYS IT IS NEAR.
 *
 * A typo or another form of a word used to find nothing. Now, when the exact
 * hits are few, a record one slip away ("tulpis"), or another form of the
 * word ("planted" for "plants"), follows them — ranked after every exact
 * one, marked `near`, its why naming the word that answered. A host's ranker
 * (embeddings) finds what no spelling can — "the florist" is Bloom & Co,
 * tagged flowers — and is handed only what the seat may see.
 */

const person = defineNode("person", { fields: z.object({ label: z.string() }), people: true });
const vendor = defineNode("vendor", {
  fields: z.object({ label: z.string(), tags: z.string().optional(), notes: z.string().optional() }),
});
const secret = defineNode("secret", {
  fields: z.object({ label: z.string(), tags: z.string().optional() }),
  edges: { keptBy: { to: ["person"], cardinality: "one", description: "whose it is" } },
});
const schema = createSchema([person, vendor, secret]);
const policy: Policy = {
  grants: [{ roles: "*", mutations: "*" }],
  sees: [{ roles: "*", kinds: ["person", "vendor"] }, { roles: ["guest"], kinds: ["secret"], via: "keptBy" }],
};

const ann: Principal = { kind: "human", id: "p_ann", roles: ["guest"] };

function shop(more: readonly { id: string; kind: string; label: string }[] = []) {
  return new Store({
    schema,
    policy,
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "person", label: "Ann" },
        { id: "p_bo", kind: "person", label: "Bo" },
        { id: "v_bloom", kind: "vendor", label: "Bloom & Co", tags: "flowers, bouquets" },
        { id: "v_tulip", kind: "vendor", label: "Tulips Galore", tags: "bulbs" },
        { id: "v_bake", kind: "vendor", label: "Sweet Crumb", tags: "cakes", notes: "planted a garden of herbs" },
        { id: "v_van", kind: "vendor", label: "Van Hire" },
        { id: "s_mine", kind: "secret", label: "Ann's florist budget", tags: "flowers" },
        { id: "s_theirs", kind: "secret", label: "Bo's florist budget", tags: "flowers" },
        ...more,
      ] as never,
      edges: [
        { kind: "keptBy", from: "s_mine", to: "p_ann" },
        { kind: "keptBy", from: "s_theirs", to: "p_bo" },
      ],
    },
  });
}

const nodes = (hits: readonly Hit[]) => hits.filter((hit): hit is Extract<Hit, { about: "node" }> => hit.about === "node");

describe("a near word", () => {
  it("finds a record one slip away, and says it is near and which word answered", () => {
    const found = search(shop(), "tulpis");
    const [hit] = nodes(found.hits);
    expect(hit).toMatchObject({ id: "v_tulip", near: true, why: { strength: "near", by: "spelling", asked: "tulpis", matched: "tulips", field: "label" } });
    expect(found.matched).toEqual(["v_tulip"]);
  });

  it("finds a word still being typed with a slip in it", () => {
    expect(nodes(search(shop(), "flowr").hits).map((hit) => hit.id)).toContain("v_bloom");
  });

  it("finds another form of the word: a plural, -ing and -ed", () => {
    const planting = nodes(search(shop(), "planting").hits);
    expect(planting[0]).toMatchObject({ id: "v_bake", near: true, why: { by: "stem", field: "notes", matched: "planted" } });
    expect(nodes(search(shop(), "cake").hits)[0]).toMatchObject({ id: "v_bake" });
    expect(nodes(search(shop(), "bouquet").hits)[0]).toMatchObject({ id: "v_bloom" });
    expect(stemOf("flowering")).toBe(stemOf("flowers"));
    expect(stemOf("baked")).toBe(stemOf("bake"));
    expect(stemOf("running")).toBe("run");
  });

  it("finds the words in any order, and leaves the small ones aside when another word is near", () => {
    expect(nodes(search(shop(), "co bloom").hits)[0]).toMatchObject({ id: "v_bloom" });
    expect(nodes(search(shop(), "the tulpis").hits)[0]).toMatchObject({ id: "v_tulip", near: true });
  });

  it("never makes a short word near another, nor a number", () => {
    expect(nodes(search(shop(), "vat").hits)).toEqual([]);
    expect(slipsBetween("van", "can", 0)).toBe(1);
  });

  it("is ranked after every exact hit, and only fills in when the exact ones are few", () => {
    const store = shop();
    // "bulb" is exact on Tulips Galore; "bulbs" is the same word; nothing near crowds it.
    const exact = nodes(search(store, "bulbs").hits);
    expect(exact[0]).toMatchObject({ id: "v_tulip" });
    expect(exact[0]!.near).toBeUndefined();
    const crowded = shop(Array.from({ length: NEAR_BELOW }, (_, at) => ({ id: `v_t${at}`, kind: "vendor", label: `Tulpis ${at}` })));
    const many = nodes(search(crowded, "tulpis").hits);
    expect(many).toHaveLength(NEAR_BELOW);
    expect(many.every((hit) => hit.near === undefined)).toBe(true);
  });

  it("is asked for exact hits only with near: false", () => {
    expect(nodes(search(shop(), "tulpis", { near: false }).hits)).toEqual([]);
  });

  it("is never a record the seat may not see", () => {
    const found = search(shop(), "florst", { principal: ann });
    const ids = nodes(found.hits).map((hit) => hit.id);
    expect(ids).toContain("s_mine");
    expect(ids).not.toContain("s_theirs");
  });
});

describe("a host's ranker", () => {
  const florist: SearchRanker = (query, candidates) =>
    /florist/.test(query) ? candidates.flatMap((candidate) => (candidate.texts.some((text) => /flowers/.test(text.text)) ? [{ id: candidate.id, score: 0.7, matched: "flowers" }] : [])) : [];

  it("finds what no spelling can, as it arrives, said as near by meaning", async () => {
    const found = search(shop(), "the florist", { rank: florist });
    expect(nodes(found.hits)).toEqual([]);
    expect(found.later).toBeInstanceOf(Promise);
    const later = await found.later!;
    expect(nodes(later.hits)[0]).toMatchObject({ id: "v_bloom", near: true, why: { by: "meaning", matched: "flowers", asked: "florist", field: "tags", reading: "Tags" } });
    expect(later.matched).toContain("v_bloom");
  });

  it("is handed only what the seat sees — a hidden record is never a candidate, nor its text", async () => {
    const handed: NearCandidate[][] = [];
    const watching: SearchRanker = (query, candidates) => {
      handed.push([...candidates]);
      return florist(query, candidates);
    };
    const later = await search(shop(), "the florist", { principal: ann, rank: watching }).later!;
    const ids = handed.flat().map((candidate) => candidate.id);
    expect(ids).not.toContain("s_theirs");
    expect(JSON.stringify(handed)).not.toContain("Bo's florist");
    expect(nodes(later.hits).map((hit) => hit.id)).not.toContain("s_theirs");
  });

  it("is merged after the exact hits, ignores what it was not handed, and a failing ranker leaves the exact answer", async () => {
    const store = shop();
    const wild: SearchRanker = () => [{ id: "s_theirs", score: 1 }, { id: "v_van", score: 0.4, matched: "Van" }];
    const later = await search(store, "tulpis", { principal: ann, rank: wild }).later!;
    const ids = nodes(later.hits).map((hit) => hit.id);
    expect(ids[0]).toBe("v_tulip");
    expect(ids).toContain("v_van");
    expect(ids).not.toContain("s_theirs");
    const failing = search(store, "tulpis", { rank: () => Promise.reject(new Error("down")) });
    await expect(failing.later).resolves.toMatchObject({ matched: ["v_tulip"] });
  });

  it("is not asked when the exact hits are enough, or when near is false", () => {
    let asked = 0;
    const counting: SearchRanker = () => {
      asked += 1;
      return [];
    };
    expect(search(shop(), "tulips", { rank: counting }).later).toBeDefined();
    const store = shop(Array.from({ length: NEAR_BELOW }, (_, at) => ({ id: `v_x${at}`, kind: "vendor", label: `Tulips ${at}` })));
    expect(search(store, "tulips", { rank: counting }).later).toBeUndefined();
    expect(search(shop(), "tulpis", { rank: counting, near: false }).later).toBeUndefined();
    expect(asked).toBe(1);
  });
});
