import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A RECORD SAYS THE NOTION SOURCE IT IS KEPT IN STEP WITH. Nick, of a
 * Notion connection of several data sources: "these details should also
 * be viewable from Records". A record whose kind a connection keeps says
 * "Kept in step with Notion · <source>" at the head of its page, linked to
 * its page in Notion when it came from there and to the database
 * otherwise; a calendar's says Google Calendar; a kind nothing keeps says
 * nothing.
 */
const DATABASE = "1f2e3d4c5b6a79881f2e3d4c5b6a7988";
const PAGE = "b0000000000000000000000000000001";
const compiled = compileDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Garden",
  kinds: {
    task: { fields: { name: { type: "string", required: true } } },
    bed: { fields: { name: { type: "string", required: true } } },
    note: { fields: { name: { type: "string", required: true } } },
  },
  acts: { "add-task": { creates: "task" }, "add-bed": { creates: "bed" } },
  connections: {
    garden: {
      system: "notion",
      database: DATABASE,
      direction: "both",
      sources: [
        { source: "Tasks", kind: "task" },
        { source: "Beds", kind: "bed" },
      ],
    },
  },
});
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({
  schema: app.schema,
  mutations: app.mutations ?? [],
  snapshot: {
    nodes: [
      { id: `task:garden-${PAGE}`, kind: "task", name: "Mulch" },
      { id: "bed:north", kind: "bed", name: "North bed" },
      { id: "note:one", kind: "note", name: "A note" },
    ] as never,
    edges: [],
  },
});
const draw = (path: string) => renderToStaticMarkup(<PagesApp context={{ store, app }} initialPath={path} />);
const line = (page: string) => {
  const at = page.indexOf('data-testid="record-kept-in-step"');
  return at < 0 ? undefined : page.slice(at, page.indexOf("</p>", at)).replace(/<[^>]+>/g, "");
};

describe("a record says the Notion source it is kept in step with", () => {
  it("a record that came from Notion names its data source and opens its own page there", () => {
    const page = draw(`/tasks/${encodeURIComponent(`task:garden-${PAGE}`)}`);
    expect(line(page)).toContain("Kept in step with Notion · Tasks · Open in Notion");
    expect(page).toContain(`href="https://www.notion.so/${PAGE}"`);
  });

  it("a record made here names its source and opens the database", () => {
    const page = draw("/beds/bed%3Anorth");
    expect(line(page)).toContain("Kept in step with Notion · Beds");
    expect(page).toContain(`href="https://www.notion.so/${DATABASE}"`);
  });

  it("a record of a kind nothing keeps says nothing of it", () => {
    expect(line(draw("/notes/note%3Aone"))).toBeUndefined();
  });
});
