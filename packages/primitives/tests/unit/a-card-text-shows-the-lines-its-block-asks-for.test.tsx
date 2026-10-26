import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { declaredViews } from "@graview/primitives";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A CARD'S TEXT SHOWS THE LINES ITS BLOCK ASKS FOR (FR-218). A card cuts a
 * text block at three lines, so `{"text": "{awards}", "tone": "accent"}`
 * on a footballer's card stopped at the third award at 390 pixels and
 * nothing showed the rest. The block now says how many lines it shows —
 * `"lines": 6`, or `"lines": 0` for the text whole — `graview check`
 * refuses any other value, and the card draws what it said.
 */
const AWARDS = "Ballon d'Or 1958\nWorld Cup 1958, 1962, 1970\nCopa Libertadores 1962, 1963\nIntercontinental Cup 1962, 1963\nCampeonato Brasileiro 1961–65, 1968\nTaça Brasil 1961–65\nNASL 1977";
const documentWith = (text: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Wiki",
  kinds: { player: { noun: "player", plural: "players", fields: { name: { type: "string", required: true }, awards: { type: "text" } } } },
  views: { player: { card: [{ title: "{name}" }, { text: "{awards}", tone: "accent", ...text }] } },
});
const anyone: Principal = { kind: "human", id: "u:anyone", roles: [] };

const card = (text: Record<string, unknown>) => {
  const compiled = compileDocument(documentWith(text), { today: () => "2026-10-25" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [{ id: "player:pele", kind: "player", name: "Pelé", awards: AWARDS }], edges: [] } as never });
  const views = declaredViews(app);
  const View = views.lookup("player" as never, { cardinality: "one", fidelity: "summary" }) as ViewComponent<AnySchema>;
  const html = renderToStaticMarkup(
    <GraviewProvider store={store} views={views} initialView={EMPTY_VIEW} principal={anyone}>
      <View node={store.graph.getNode("player:pele") as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
    </GraviewProvider>,
  );
  const drawn = /<(?:p|div) class="graview-spec-text"([^>]*)>/.exec(html);
  return { attributes: drawn?.[1] ?? null, every: html.includes("NASL 1977") };
};

describe("a card's text block", () => {
  it("shows six lines when it says lines: 6", () => {
    const { attributes, every } = card({ lines: 6 });
    expect(attributes).toContain('data-graview-lines="6"');
    expect(attributes).toMatch(/-webkit-line-clamp:6/);
    expect(attributes).toMatch(/max-height:8\.7em/);
    expect(every).toBe(true);
  });

  it("shows the text whole when it says lines: 0", () => {
    const { attributes } = card({ lines: 0 });
    expect(attributes).toContain('data-graview-lines="all"');
    expect(attributes).toMatch(/-webkit-line-clamp:none/);
    expect(attributes).toMatch(/max-height:none/);
    expect(attributes).toMatch(/overflow:visible/);
  });

  it("keeps the card's own three lines when it says nothing", () => {
    expect(card({}).attributes).not.toContain("data-graview-lines");
  });
});

describe("graview check on a text block's lines", () => {
  const findings = (lines: unknown) => compileDocument(documentWith({ lines }), { today: () => "2026-10-25" }).findings.filter((f) => f.code === "view-lines");
  it("takes a whole number from 0 to 12", () => {
    for (const lines of [0, 1, 6, 12]) expect(findings(lines)).toEqual([]);
  });
  it("refuses anything else, by the block's path", () => {
    for (const lines of [-1, 2.5, 13, "6", true, null]) {
      expect(findings(lines)).toEqual([expect.objectContaining({ severity: "error", path: expect.stringMatching(/views\.player\.card\.1\.lines$/) })]);
    }
  });
  it("no longer warns of a long text shown whole once the block says its lines", () => {
    const whole = (text: Record<string, unknown>) => compileDocument(documentWith(text), { today: () => "2026-10-25" }).findings.filter((f) => f.code === "view-whole-text");
    expect(whole({})).toHaveLength(1);
    expect(whole({ lines: 6 })).toEqual([]);
    expect(whole({ lines: 0 })).toEqual([]);
  });
  it("refuses lines on a block that is not text", () => {
    const refused = compileDocument({ ...documentWith({}), views: { player: { card: [{ title: "{name}", lines: 2 }] } } }, { today: () => "2026-10-25" }).findings;
    expect(refused).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unknown-key", severity: "error" })]));
  });
});
