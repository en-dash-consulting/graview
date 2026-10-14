import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A ROW DOES NOT REPEAT ITS HEADING. Grouped by day, every one of the
 * Program's sessions said "Sep 25, 2017" under a heading that said "Sep 25,
 * 2017"; narrowed to one status, every row said the status the line had
 * chosen. What the group or the narrowing already says is left off a row's
 * glance, and everything else it says stays.
 */
const session = defineNode("session", {
  fields: z.object({ label: z.string(), room: z.enum(["hall", "annex"]), host: z.string() }),
  plural: "Sessions",
  display: { labels: { room: "Room" } },
});
const schema = createSchema([session]);
const store = new Store({
  schema,
  snapshot: {
    nodes: [
      { id: "a", kind: "session", label: "Opening", room: "hall", host: "Ada Nowak" },
      { id: "b", kind: "session", label: "Closing", room: "hall", host: "Bo Ferreira" },
      { id: "c", kind: "session", label: "Lunch", room: "annex", host: "Cass Whitley" },
    ] as never,
    edges: [],
  },
});
const glances = (path: string) =>
  [...renderToStaticMarkup(<PagesApp context={{ store }} initialPath={path} />).matchAll(/<span class="graview-row-glance">(.*?)<\/span>/g)].map((match) => match[1]!);

describe("a list's rows", () => {
  it("say the field they are grouped by in the heading, not on every row", () => {
    const said = glances("/sessions?group=room");
    expect(said).toHaveLength(3);
    for (const one of said) expect(one).not.toMatch(/hall|annex/i);
    expect(said.join(" ")).toContain("Ada Nowak");
  });

  it("leave off a choice the list is narrowed to one value of", () => {
    const said = glances("/sessions?filter=room:hall");
    expect(said).toHaveLength(2);
    for (const one of said) expect(one).not.toMatch(/hall/i);
  });

  it("still say the field when nothing groups or narrows by it", () => {
    expect(glances("/sessions").join(" ")).toMatch(/hall/i);
  });
});
