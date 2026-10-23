import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applySplice, createSchema, defineNode, Graph, invert, transformCaret, type SpliceTextPrimitive, type TextSplice } from "../../src/index.js";
import { composeSplices, diffSplice, transformSplices } from "../../src/typing.js";

/**
 * THE TRANSFORM, BY PROPERTY (collaborative text, phase 1). Seeded random
 * cases, so a failure names a case that comes back: two splices made at
 * once on one text, transformed, give the same text whichever lands first
 * (TP1); a splice and its inverse put the text back; a log of splices made
 * against older texts and transformed over what landed since folds to one
 * text, every time; a run of keystrokes composes; a caret keeps its word.
 */

/** A small, seeded generator (mulberry32): the same cases on every run. */
function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (most: number) => Math.floor(next() * (most + 1));
  const ALPHABET = ["a", "b", "c", " ", "é", "😀"];
  const text = (most: number) => Array.from({ length: int(most) }, () => ALPHABET[int(ALPHABET.length - 1)]).join("");
  /** A splice that applies to `on`: small texts and short runs, so ties and overlaps are common. */
  const splice = (on: string): TextSplice => {
    const at = int(on.length);
    const removed = on.slice(at, at + int(Math.min(4, on.length - at)));
    return { at, removed, inserted: text(3) };
  };
  return { int, text, splice };
}

const CASES = 4000;

describe("concurrent splices converge", () => {
  it(`two splices made at once give one text whichever lands first (TP1), over ${CASES} cases`, () => {
    const { text, splice } = random(1);
    let ties = 0;
    for (let n = 0; n < CASES; n++) {
      const base = text(8);
      const a = splice(base);
      const b = splice(base);
      if (a.at === b.at) ties++;
      const [a2, b2] = transformSplices(a, b);
      const ab = applySplice(applySplice(base, a), b2);
      const ba = applySplice(applySplice(base, b), a2);
      expect(ab, JSON.stringify({ base, a, b })).toBe(ba);
    }
    // The cases reach the tie the rule settles, often.
    expect(ties).toBeGreaterThan(CASES / 10);
  });

  it("at one offset, the earlier in the log is put first", () => {
    const base = "ab";
    const [a2, b2] = transformSplices({ at: 1, removed: "", inserted: "X" }, { at: 1, removed: "", inserted: "Y" });
    expect(applySplice(applySplice(base, { at: 1, removed: "", inserted: "X" }), b2)).toBe("aXYb");
    expect(applySplice(applySplice(base, { at: 1, removed: "", inserted: "Y" }), a2)).toBe("aXYb");
    // Two removals that overlap take out both, once; both insertions stay.
    const [c2] = transformSplices({ at: 0, removed: "abc", inserted: "1" }, { at: 2, removed: "cde", inserted: "2" });
    expect(applySplice(applySplice("abcdef", { at: 2, removed: "cde", inserted: "2" }), c2)).toBe("12f");
  });

  it(`a splice and its inverse put the text back, over ${CASES} cases, in a graph as in a string`, () => {
    const { text, splice } = random(2);
    const schema = createSchema([defineNode("note", { fields: z.object({ body: z.string() }) })]);
    for (let n = 0; n < CASES; n++) {
      const base = text(10);
      const one = splice(base);
      const primitive: SpliceTextPrimitive = { op: "splice-text", id: "n1", field: "body", ...one };
      const back = invert(primitive) as SpliceTextPrimitive;
      expect(applySplice(applySplice(base, one), back)).toBe(base);
      if (n % 10 === 0) {
        const graph = Graph.from(schema, { nodes: [{ id: "n1", kind: "note", body: base }], edges: [] });
        graph.applyPrimitives([primitive]);
        graph.applyPrimitives([back]);
        expect(graph.getNode("n1")?.body).toBe(base);
      }
    }
  });

  it("a log of splices made against older texts, each transformed over what landed since, folds to one text every time (300 logs of 25)", () => {
    const { int, text, splice } = random(3);
    const schema = createSchema([defineNode("note", { fields: z.object({ body: z.string() }) })]);
    for (let n = 0; n < 300; n++) {
      const start = text(6);
      const texts = [start];
      const log: TextSplice[] = [];
      for (let made = 0; made < 25; made++) {
        // A writer who last saw revision `seen` splices that text; the server transforms it over everything since.
        const seen = int(log.length);
        let landing = splice(texts[seen]!);
        for (const since of log.slice(seen)) landing = transformSplices(since, landing)[1];
        log.push(landing);
        texts.push(applySplice(texts.at(-1)!, landing));
      }
      const fold = () => {
        const graph = Graph.from(schema, { nodes: [{ id: "n1", kind: "note", body: start }], edges: [] });
        for (const one of log) graph.applyPrimitives([{ op: "splice-text", id: "n1", field: "body", ...one }]);
        return JSON.stringify(graph.snapshot());
      };
      const folded = fold();
      expect(JSON.parse(folded).nodes[0].body).toBe(texts.at(-1));
      expect(fold()).toBe(folded);
    }
  });

  it(`a run of keystrokes composes into one splice, over ${CASES} cases`, () => {
    const { int, text, splice } = random(4);
    let composed = 0;
    for (let n = 0; n < CASES; n++) {
      const base = text(8);
      const a = splice(base);
      const middle = applySplice(base, a);
      // Half of the second keystrokes land where the first left the caret.
      const b = n % 2 === 0 ? { at: a.at + a.inserted.length, removed: middle.slice(a.at + a.inserted.length, a.at + a.inserted.length + int(1)), inserted: text(2) } : splice(middle);
      const one = composeSplices(a, b);
      if (!one) continue;
      composed++;
      expect(applySplice(base, one), JSON.stringify({ base, a, b })).toBe(applySplice(middle, b));
    }
    expect(composed).toBeGreaterThan(CASES / 2);
    expect(composeSplices({ at: 0, removed: "", inserted: "a" }, { at: 5, removed: "", inserted: "b" })).toBeUndefined();
  });

  it(`a caret keeps its word through a splice that does not touch it, over ${CASES} cases`, () => {
    const { int, text } = random(5);
    const words = ["water", "the", "raised", "beds", "now", "😀ok"];
    for (let n = 0; n < CASES; n++) {
      const said = Array.from({ length: 2 + int(4) }, () => words[int(words.length - 1)]!);
      const body = said.join(" ");
      const w = int(said.length - 1);
      const from = said.slice(0, w).join(" ").length + (w > 0 ? 1 : 0);
      const to = from + said[w]!.length;
      const caret = from + int(to - from);
      // A splice wholly before the word, or wholly after it.
      const before = n % 2 === 0;
      const at = before ? int(from) : to + int(body.length - to);
      const room = before ? from - at : body.length - at;
      const one: TextSplice = { at, removed: body.slice(at, at + int(room)), inserted: text(3) };
      const after = applySplice(body, one);
      const moved = transformCaret(caret, one, "after");
      expect(after.slice(moved, moved + (to - caret)), JSON.stringify({ body, caret, one })).toBe(body.slice(caret, to));
    }
  });

  it("a caret on a splice goes the side its bias says", () => {
    const insert: TextSplice = { at: 3, removed: "", inserted: "XY" };
    expect(transformCaret(3, insert, "before")).toBe(3);
    expect(transformCaret(3, insert, "after")).toBe(5);
    const replace: TextSplice = { at: 1, removed: "bcd", inserted: "Z" };
    expect(transformCaret(2, replace, "before")).toBe(1);
    expect(transformCaret(2, replace, "after")).toBe(2);
    expect(transformCaret(4, replace)).toBe(2);
    expect(transformCaret(6, replace)).toBe(4);
  });

  it(`the splice between two texts makes one into the other and never halves an emoji, over ${CASES} cases`, () => {
    const { text } = random(6);
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    for (let n = 0; n < CASES; n++) {
      const before = text(8);
      const after = text(8);
      const one = diffSplice(before, after);
      expect(applySplice(before, one)).toBe(after);
      expect(lone.test(one.removed) || lone.test(one.inserted), JSON.stringify({ before, after, one })).toBe(false);
    }
    expect(diffSplice("Water the beds", "Water all the beds")).toEqual({ at: 6, removed: "", inserted: "all " });
    expect(diffSplice("a😀", "a😃")).toEqual({ at: 1, removed: "😀", inserted: "😃" });
  });
});
