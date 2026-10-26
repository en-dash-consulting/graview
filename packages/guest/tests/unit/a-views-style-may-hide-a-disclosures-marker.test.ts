import { describe, expect, it } from "vitest";
import { sanitizeStylesheet } from "../../src/host/css.js";

/*
 * A VIEW'S STYLE MAY HIDE A DISCLOSURE'S MARKER (Roadmap
 * f-view-details-marker, FR-221). A view drew "More" as a `<details>` with
 * its own chevron and hid the browser's triangle, which in Safari takes
 * `summary::-webkit-details-marker`. Every `-webkit-` selector was refused
 * ("CSS the open kit leaves out") and took the whole rule with it, so the
 * triangle stayed beside the chevron. The marker is the disclosure's own,
 * in the view's tree, so `::marker` and `::-webkit-details-marker` are kept;
 * the other prefixed selectors are still refused.
 */
describe("a view's style", () => {
  it("keeps a rule that hides a disclosure's marker, in Safari's words and the standard's", () => {
    const css = "details.more summary::-webkit-details-marker{display:none} details.more summary::marker{content:''} details.more summary{list-style:none}";
    const said = sanitizeStylesheet(css);
    expect(said.refused).toEqual([]);
    expect(said.css).toContain("details.more summary::-webkit-details-marker { display: none; }");
    expect(said.css).toContain("details.more summary::marker {");
    expect(said.css).toContain("details.more summary { list-style: none; }");
  });

  it("still refuses another prefixed selector, and takes its rule with it", () => {
    const said = sanitizeStylesheet("input::-webkit-file-upload-button { display: none } .kept { color: red }");
    expect(said.css).not.toContain("file-upload");
    expect(said.css).toContain(".kept");
    expect(said.refused).toEqual([{ reason: "selector", name: "-webkit-file-upload-button" }]);
  });
});
