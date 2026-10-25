import { describe, expect, it } from "vitest";
import { describePlace, type DescribedHostView } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { compileDocumentWithoutCheck, type GraviewDocument } from "../../src/document/index.js";

/*
 * A KIND'S LIST PAGE SAYS THE VIEW THAT REPLACES IT (FR-203). A view of many
 * whose manifest says `replaces: "page"` is drawn on the kind's list page in
 * place of the list, so describe_place says that list page as the pages
 * face draws it: the heading, then the view, and no form but what it offers.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Club",
  kinds: {
    player: { fields: { name: { type: "string", required: true } } },
    team: { fields: { name: { type: "string", required: true } } },
  },
} as unknown as GraviewDocument;

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const compiled = compileDocumentWithoutCheck(document);
if (!compiled.ok) throw new Error("does not compile");
const app = compiled.app;
const store = new Store<AnySchema>({
  schema: app.schema as AnySchema,
  mutations: app.mutations ?? [],
  snapshot: { nodes: [{ id: "p1", kind: "player", name: "Pelé" }, { id: "t1", kind: "team", name: "Santos" }], edges: [] } as never,
});
const roster: DescribedHostView = { name: "roster", attach: "player", cardinality: "many", replaces: "page", parts: [{ t: "text", text: "1 on the roster" }] };

function said(slug: string, views?: readonly DescribedHostView[]) {
  const described = describePlace(store, owner, slug, { app, today: "2026-10-25", ...(views ? { views } : {}) });
  if (!described.ok) throw new Error(described.error);
  return described.description;
}

describe("a kind's list page", () => {
  it("is the view of many that replaces it, under the heading, with no form", () => {
    const page = said("players", [roster]);
    expect(page.drawnBy).toBe("view:roster");
    expect(page.parts.map((part) => part.t)).toEqual(["heading", "view"]);
    expect(page.parts[1]).toEqual({ t: "view", name: "roster", replaces: true, parts: [{ t: "text", text: "1 on the roster" }] });
    expect(page.forms ?? []).toEqual([]);
  });
  it("is the derived list when the view does not replace it, or is hidden, or is of another kind", () => {
    const { replaces: _, ...beside } = roster;
    expect(said("players", [beside]).drawnBy).toBe("derived");
    expect(said("players", [{ ...roster, hidden: true }]).drawnBy).toBe("derived");
    expect(said("teams", [roster]).drawnBy).toBe("derived");
  });
});
