import { CSS_PROPERTIES, sanitizeStylesheet } from "@graview/core/css";
import { describe, expect, it } from "vitest";

/**
 * A VIEW LAYS ITS CARDS IN CSS COLUMNS (Roadmap
 * f-view-authoring-friction-2026-11). A rocks-and-minerals view laid its
 * specimen cards out in columns and kept each card whole in one — and the
 * open kit refused `break-inside`, so cards split across columns. The
 * whole multi-column family is the kit's now, and the list of what the kit
 * allows is `CSS_PROPERTIES` on `@graview/core/css`, the skill's to point at.
 */
const COLUMNS = `.shelf { columns: 3 14rem; column-count: 3; column-width: 14rem; column-gap: 1rem; column-rule: 1px solid var(--graview-edge); column-fill: balance }
.card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 1rem }
.shelf h2 { column-span: all; break-after: avoid; break-before: column }
p { orphans: 2; widows: 2; box-decoration-break: clone; -webkit-box-decoration-break: clone }`;

describe("a view's stylesheet", () => {
  it("keeps columns, their gap and rule, and where a box breaks across them", () => {
    const judged = sanitizeStylesheet(COLUMNS);
    expect(judged.refused).toEqual([]);
    for (const kept of ["columns: 3 14rem", "column-gap: 1rem", "break-inside: avoid", "page-break-inside: avoid", "column-span: all", "break-after: avoid", "break-before: column", "orphans: 2", "box-decoration-break: clone"]) expect(judged.css).toContain(kept);
  });

  it("is held to a list a view's author can read: CSS_PROPERTIES names every one of them", () => {
    for (const property of ["columns", "column-count", "column-width", "column-gap", "column-rule", "column-span", "column-fill", "break-inside", "break-before", "break-after"]) expect(CSS_PROPERTIES).toContain(property);
  });
});
