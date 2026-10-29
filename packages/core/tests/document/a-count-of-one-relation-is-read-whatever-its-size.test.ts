import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { blockContextFor, computedValues } from "../../src/blocks.js";
import { evaluateExpr, parseExpr, parseTemplate, renderTemplate, type GraviewDocument } from "../../src/document/index.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A COUNT OF ONE RELATION IS READ WHATEVER ITS SIZE (Roadmap
 * f-count-past-graph-budget). TECH N9NE's genres say `{songCount}
 * {songCount|plural: 'song'}` on each row, where `songCount` is
 * `count(in('inGenre'))`. Every genre drew its count but Hip hop, with
 * about 690 songs: its row drew "— —", while the same list's line said
 * "Songs 692". A row is held to a card's budget (500 steps), the line to a
 * record's (10,000), and the walk spent a step a song. A count of one
 * relation is now read from the edge index for one step, and a computed
 * field is the same value wherever it is read.
 */
const discography = {
  format: "graview-document",
  formatVersion: 1,
  name: "Discography",
  kinds: {
    genre: {
      noun: "genre",
      plural: "genres",
      label: "{name}",
      fields: { name: { type: "string", required: true } },
      computed: {
        songCount: { expr: "count(in('inGenre'))", label: "Songs" },
        // A walk that reads each song, not only how many: the card's budget still holds it.
        titled: { expr: "count(in('inGenre') where title != '')", label: "Titled" },
      },
    },
    song: { noun: "song", plural: "songs", label: "{title}", fields: { title: { type: "string", required: true } }, edges: { inGenre: { to: ["genre"] } } },
  },
} as unknown as GraviewDocument;

function store(songs: number): Store<AnySchema> {
  const compiled = compileDocument(discography);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const nodes = [{ id: "genre:hip-hop", kind: "genre", name: "Hip hop" }, ...Array.from({ length: songs }, (_, at) => ({ id: `song:${at}`, kind: "song", title: `Song ${at}` }))];
  const edges = Array.from({ length: songs }, (_, at) => ({ kind: "inGenre", from: `song:${at}`, to: "genre:hip-hop" }));
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes, edges } as never });
}

const row = (s: Store<AnySchema>, template: string) => {
  const ctx = blockContextFor(s, null, s.graph.getNode("genre:hip-hop")!, { slot: "row" });
  return renderTemplate(parseTemplate(template), { node: ctx.node, graph: ctx.graph, kinds: ctx.kinds, budget: ctx.budget, today: ctx.today });
};

describe("a count of one relation", () => {
  it("draws on a row of a genre with 700 songs, as the list's line says it", () => {
    const s = store(700);
    expect(row(s, "{songCount} {songCount|plural: 'song'}")).toBe("700 songs");
    expect(computedValues(s.schema, s.graph as never, s.graph.getNode("genre:hip-hop") as never).values["songCount"]).toBe(700);
  });

  it("is written in the template itself and still read from the index: count(in(...)) and exists(in(...))", () => {
    const s = store(700);
    expect(row(s, "{count(in('inGenre'))}")).toBe("700");
    expect(row(s, "{exists(in('inGenre'))}")).not.toBe("—");
  });

  it("costs one step, however many records the relation joins", () => {
    const s = store(5_000);
    const kinds = blockContextFor(s, null, null).kinds;
    const subject = s.graph.getNode("genre:hip-hop") as never;
    expect(evaluateExpr(parseExpr("count(in('inGenre'))"), { graph: s.graph as never, subject, kinds, budget: 2 })).toBe(5_000);
  });

  it("leaves the budget guarding a walk that reads each record: a filter over 700 songs on a row is still too much", () => {
    const s = store(700);
    expect(row(s, "{count(in('inGenre') where title != '')}")).toBe("—");
    expect(() => evaluateExpr(parseExpr("count(all('song'))"), { graph: s.graph as never, subject: null, kinds: new Map(), budget: 500 })).toThrow(/too much of the graph/);
  });
});
