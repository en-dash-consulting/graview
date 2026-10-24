import { describe, expect, it } from "vitest";
import { drawTranscript } from "../../src/headless/draw.js";
import { sayRefusal } from "../../src/headless/judge.js";
import { REFUSED_ROLES } from "../../src/open-kit.js";

/*
 * A VIEW NAMES A REGION IT SCROLLS (Roadmap f-view-style-role-region). A
 * sideways scroller — a timeline, a wide table, a mind map — takes the
 * keyboard and a name, and axe and the WAI's guidance give it
 * `role="region"` with an `aria-label`. The open kit refused `region` with
 * the landmarks of the app's own chrome, so views fell back to
 * `role="group"`. A named region is no chrome of the app's — the region a
 * view is drawn in is one itself — so it is drawn while it has a name, and
 * held back while it has none, whatever order the view gives its
 * attributes in. The chrome's landmarks stay refused.
 */
let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `r${(ids += 1)}`, type: 1, element: name, attributes, children });
const draw = (...renders: unknown[][]) => drawTranscript(renders, [], { maxNodes: 500 });
const at = (drawn: ReturnType<typeof draw>, id: string) => {
  const find = (node: { childNodes: ArrayLike<unknown> }): { getAttribute(name: string): string | null } | undefined => {
    for (const child of Array.from(node.childNodes) as { nodeType: number; getAttribute(name: string): string | null; childNodes: ArrayLike<unknown> }[]) {
      if (child.nodeType !== 1) continue;
      if (child.getAttribute("id") === id) return child;
      const inner = find(child);
      if (inner) return inner;
    }
    return undefined;
  };
  return find(drawn.root as never)!;
};

describe("a region a view draws", () => {
  it("is drawn with its name, whichever attribute the view gave first", () => {
    const drawn = draw([[0, "~", element("div", {}, [element("div", { id: "lane", role: "region", "aria-label": "Amendments, by year", tabindex: "0" }), element("div", { "aria-labelledby": "h", id: "lane-2", role: "region" })]), 0]]);
    expect(at(drawn, "lane").getAttribute("role")).toBe("region");
    expect(at(drawn, "lane-2").getAttribute("role")).toBe("region");
    expect(drawn.refused).toEqual([]);
  });

  it("is held back with no name, and said: a landmark that says nothing is no landmark", () => {
    const drawn = draw([[0, "~", element("div", { id: "lane", role: "region", tabindex: "0" }), 0]]);
    expect(at(drawn, "lane").getAttribute("role")).toBeNull();
    expect(drawn.refused).toEqual([{ reason: "value", element: "div", name: "role" }]);
    expect(sayRefusal(drawn.refused[0]!).says).toMatch(/role="region" is drawn while it has a name/);
  });

  it("is drawn once the view names it later", () => {
    const lane = element("div", { id: "lane", role: "region" });
    const drawn = draw([[0, "~", lane, 0]], [[3, lane.id, "aria-label", "Amendments", 2]]);
    expect(at(drawn, "lane").getAttribute("role")).toBe("region");
  });

  it("is held back again when the view takes its name away", () => {
    const lane = element("div", { id: "lane", role: "region", "aria-label": "Amendments" });
    const drawn = draw([[0, "~", lane, 0]], [[3, lane.id, "aria-label", null, 2]]);
    expect(at(drawn, "lane").getAttribute("role")).toBeNull();
  });
});

describe("the landmarks of the app's own chrome", () => {
  it("stay refused, named or not", () => {
    for (const role of ["main", "banner", "navigation", "contentinfo", "complementary", "search", "form", "alert", "status"]) {
      expect(REFUSED_ROLES as readonly string[], role).toContain(role);
      const drawn = draw([[0, "~", element("div", { id: "x", role, "aria-label": "Named" }), 0]]);
      expect(at(drawn, "x").getAttribute("role"), role).toBeNull();
    }
    expect(REFUSED_ROLES as readonly string[]).not.toContain("region");
  });
});
