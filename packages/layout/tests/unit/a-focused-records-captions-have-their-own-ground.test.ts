import { createSchema, defineNode, Graph, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { bandCaptions, captionWidth, EMPTY_VIEW, layout, MIN_CAPTION, type CaptionBox, type LayoutNode } from "../../src/index.js";

/**
 * A FOCUSED RECORD'S CAPTIONS HAVE GROUND OF THEIR OWN.
 *
 * A product with many records, a position focused in the scene: the
 * relation band's headings stood on the cards of the relation beside them
 * ("QUESTIONS THAT WOULD SETT…" over another group's cards), because the
 * band below a crowd was one grid in the frame's order — a relation began
 * mid-row, and its caption hung in a gutter no deeper than the gap between
 * two cards. The band is laid out by relation now, a caption's gutter
 * between its rows and a caption's words' room in the row it starts, so
 * no caption's box meets a card's or another caption's, crowded or not, on
 * a desk or a phone.
 */
const position = defineNode("position", { fields: z.object({ label: z.string() }), plural: "Positions" });
const question = defineNode("question", {
  fields: z.object({ label: z.string() }),
  edges: { settles: { to: ["position"], description: "the position it would settle", inverse: "questions that would settle it" } },
  plural: "Questions",
});
const call = defineNode("call", {
  fields: z.object({ label: z.string() }),
  edges: { about: { to: ["position"], description: "is a call about", inverse: "the calls made about it" } },
  plural: "Calls",
});
const note = defineNode("note", {
  fields: z.object({ label: z.string() }),
  edges: { on: { to: ["position"], description: "what it is a note on", inverse: "the notes written on it" } },
  plural: "Notes",
});
const task = defineNode("task", {
  fields: z.object({ label: z.string() }),
  edges: { for: { to: ["position"], description: "the position it is for", inverse: "the work it is waiting on" } },
  plural: "Tasks",
});
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const owned = defineNode("risk", {
  fields: z.object({ label: z.string() }),
  edges: {
    threatens: { to: ["position"], description: "what it threatens", inverse: "the risks that threaten it" },
    raisedBy: { to: ["person"], description: "who raised it", inverse: "the risks they raised" },
  },
  plural: "Risks",
});
const schema = createSchema([position, question, call, note, task, person, owned]);

/** The focus, and how many of each relation reach it. */
function world(counts: { question: number; call: number; note: number; task: number; risk: number }) {
  const nodes: { id: string; kind: string; label: string }[] = [{ id: "position:delivery", kind: "position", label: "Delivery" }];
  const edges: { kind: string; from: string; to: string }[] = [];
  const edgeOf = { question: "settles", call: "about", note: "on", task: "for", risk: "threatens" } as const;
  for (const [kind, n] of Object.entries(counts) as [keyof typeof edgeOf, number][]) {
    for (let i = 0; i < n; i++) {
      const id = `${kind}:${String(i).padStart(3, "0")}`;
      nodes.push({ id, kind, label: `${kind} ${i}` });
      edges.push({ kind: edgeOf[kind], from: id, to: "position:delivery" });
    }
  }
  return Graph.from(schema, { nodes, edges } as never);
}

const meets = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

const SIZES = [
  ["a desk", 1440, 900],
  ["a laptop", 1200, 760],
  ["a phone", 390, 844],
] as const;
const WORLDS = [
  // Few of each: below the crowd, where the band was one grid in id order.
  ["five small relations", { question: 1, call: 1, note: 2, task: 3, risk: 2 }],
  // Many records: past the crowd, a door or groups for the big ones.
  ["a hundred notes beside four small relations", { question: 1, call: 2, note: 140, task: 3, risk: 12 }],
] as const;

describe("a focused record's captions", () => {
  for (const [said, counts] of WORLDS) {
    for (const [where, width, height] of SIZES) {
      const result = layout(world(counts), schema, { ...EMPTY_VIEW, focusId: "position:delivery" }, { width, height });
      const cards = result.nodes.filter((node) => node.plane === 0 || node.plane === 1);
      const captions = bandCaptions(result);

      it(`stand on no card — ${said}, on ${where}`, () => {
        expect(captions.length).toBe(new Set(result.nodes.filter((node) => node.plane === 1 && node.via).map((node) => `${node.via!.edgeKind}|${node.via!.direction}`)).size);
        const onCards = captions.flatMap((caption) => cards.filter((card) => meets(caption, card)).map((card) => `${caption.text} on ${card.id}`));
        expect(onCards).toEqual([]);
      });

      it(`stand on no other caption — ${said}, on ${where}`, () => {
        const clashes: string[] = [];
        captions.forEach((a: CaptionBox, i) => captions.slice(i + 1).forEach((b) => meets(a, b) && clashes.push(`${a.text} / ${b.text}`)));
        expect(clashes).toEqual([]);
      });

      it(`keep each relation's cards together in a row — ${said}, on ${where}`, () => {
        const band = result.nodes.filter((node) => node.plane === 1);
        const rows = new Map<number, LayoutNode[]>();
        for (const node of band) rows.set(Math.round(node.y), [...(rows.get(Math.round(node.y)) ?? []), node]);
        for (const row of rows.values()) {
          const order = row.sort((a, b) => a.x - b.x).map((node) => node.via?.edgeKind);
          // A relation is one stretch of its row: it never resumes after another one.
          expect(order.filter((kind, i) => i === 0 || kind !== order[i - 1]).length).toBe(new Set(order).size);
        }
      });
    }

    it(`say their words whole on a desk — ${said}`, () => {
      const result = layout(world(counts), schema, { ...EMPTY_VIEW, focusId: "position:delivery" }, { width: 1440, height: 900 });
      for (const caption of bandCaptions(result)) expect(caption.width).toBeGreaterThanOrEqual(Math.min(MIN_CAPTION, captionWidth(caption.text)) - 0.5);
    });
  }
});

describe("a crowded relation", () => {
  it("is counted by one door, never several", () => {
    const result = layout(world({ question: 1, call: 2, note: 140, task: 3, risk: 12 }), schema, { ...EMPTY_VIEW, focusId: "position:delivery" }, { width: 1440, height: 900 });
    const doors = result.nodes.filter((node) => node.plane === 1 && node.aggregate?.opens?.in === "picture");
    const byRelation = new Map<string, number>();
    for (const door of doors) byRelation.set(door.via!.edgeKind, (byRelation.get(door.via!.edgeKind) ?? 0) + 1);
    for (const count of byRelation.values()) expect(count).toBe(1);
  });
});
