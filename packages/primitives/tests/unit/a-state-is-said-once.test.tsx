import { readFileSync } from "node:fs";
import { declaredLenses, Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { declaredViews } from "@graview/primitives";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";

/**
 * A STATE IS SAID ONCE (FR-117). A state badge is the one pill a record
 * wears, and one repeated where its context already says it teaches a
 * reader to stop reading pills: Graview Cloud's vendor template drew a
 * "contacted" badge on every card standing in the Contacted column. A card
 * on a status board does not wear its own column's status, a row under a
 * grouped list's heading does not repeat the heading's value — and every
 * other block, and a badge that says something else, is drawn as before.
 */
const fixtures = new URL("../../../../scripts/fixtures/quiet/", import.meta.url);
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

function opened(document: unknown, seed: { nodes: unknown[]; edges: { id?: string }[] }) {
  const compiled = compileDocument(document, { today: () => "2026-10-02" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const snapshot = { nodes: seed.nodes, edges: seed.edges.map((edge, i) => ({ id: edge.id ?? `e${i}`, ...edge })) };
  const lens = (title: string) => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: snapshot as never });
    const drawn = declaredLenses(app).drawn.find((one) => one.title === title)!;
    const Lens = declaredLensView(drawn) as ViewComponent<AnySchema>;
    return renderToStaticMarkup(
      <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={owner}>
        <Lens cardinality="many" fidelity="full" mode="fullscreen" selected={false} label={title} />
      </GraviewProvider>,
    );
  };
  return lens;
}

/** Each column's value and the badges its cards wear. */
const columns = (html: string) =>
  [...html.matchAll(/data-graview-column="([^"]*)"([\s\S]*?)(?=data-graview-column="|$)/g)].map(([, value, body]) => ({
    value,
    badges: [...body!.matchAll(/class="graview-spec-badge"[^>]*>([^<]*)</g)].map((m) => m[1]),
    cards: [...body!.matchAll(/data-graview-listed="([^"]+)"/g)].length,
  }));

describe("a card on a status board", () => {
  const template = JSON.parse(readFileSync(new URL("vendor-shortlist.template.json", fixtures), "utf8"));
  const lens = opened(template.document, template.seed);

  it("does not wear its own column's status, in any column", () => {
    const board = columns(lens("Vendors by status"));
    expect(board.map((column) => column.value)).toEqual(["researching", "contacted", "booked", "declined"]);
    expect(board.reduce((sum, column) => sum + column.cards, 0)).toBe(4);
    for (const column of board) expect(column.badges, column.value).not.toContain(column.value);
  });

  it("keeps every other block it declares", () => {
    const html = lens("Vendors by status");
    // Sugar & Spoon is contacted: its quote and its due date are still said.
    const card = html.slice(html.indexOf('data-graview-listed="example-sugar-spoon"'));
    expect(card).toContain("Sugar &amp; Spoon");
    expect(card).toMatch(/Quote/);
  });
});

describe("a row under a grouped list's heading", () => {
  const document = JSON.parse(readFileSync(new URL("org.gdd.json", fixtures), "utf8"));
  const seed = JSON.parse(readFileSync(new URL("org.seed.json", fixtures), "utf8"));
  const lens = opened(document, seed);

  it("does not repeat the heading's value, and still says its name", () => {
    const html = lens("Hard lines");
    expect(html).toMatch(/class="graview-spec-list-heading"[^>]*>Hard</);
    expect(html).toContain("No default hierarchy");
    expect(html).not.toMatch(/class="graview-spec-badge"[^>]*>hard</);
  });

  it("a badge that says something else is still drawn: the strength's level", () => {
    const html = lens("Skills and levels");
    expect(html).toMatch(/class="graview-spec-badge"[^>]*>Lv 3</);
  });
});
