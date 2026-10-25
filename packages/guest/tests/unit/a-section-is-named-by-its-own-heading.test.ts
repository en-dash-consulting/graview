import { describe, expect, it } from "vitest";
import { drawTranscript } from "../../src/headless/draw.js";
import { sayRefusal } from "../../src/headless/judge.js";

/*
 * A SECTION IS NAMED BY ITS OWN HEADING (Roadmap f-view-labelledby, FR-219).
 * `<section aria-labelledby="ls-h"><h2 id="ls-h">` is how a page says what
 * a section is about, and the open kit refused it with the section's own
 * words (`aria-label`, `title`) — a named section is a region landmark. A
 * name read from the view's own heading is the view's, so `aria-labelledby`
 * and `aria-describedby` are drawn while every id they name is an element
 * the view drew, and held back, said in a sentence, while one names nothing.
 */
let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `s${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `s${(ids += 1)}`, type: 3, data });
const draw = (...renders: unknown[][]) => drawTranscript(renders, [], { maxNodes: 500 });
type Found = { getAttribute(name: string): string | null; localName?: string };
const find = (node: { childNodes: ArrayLike<unknown> }, name: string): Found | undefined => {
  for (const child of Array.from(node.childNodes) as (Found & { nodeType: number; tagName?: string; childNodes: ArrayLike<unknown> })[]) {
    if (child.nodeType !== 1) continue;
    if ((child.localName ?? child.tagName ?? "").toLowerCase() === name) return child;
    const inner = find(child, name);
    if (inner) return inner;
  }
  return undefined;
};

describe("a section labeled by its own heading", () => {
  it("is drawn with the attribute pointing at the heading, which comes after it", () => {
    const drawn = draw([[0, "~", element("section", { "aria-labelledby": "ls-h", class: "list" }, [element("h2", { id: "ls-h" }, [text("Drivers")])]), 0]]);
    expect(find(drawn.root as never, "section")!.getAttribute("aria-labelledby")).toBe("ls-h");
    expect(find(drawn.root as never, "h2")!.getAttribute("id")).toBe("ls-h");
    expect(drawn.refused).toEqual([]);
  });

  it("is drawn described by a paragraph of its own", () => {
    const drawn = draw([[0, "~", element("section", { "aria-labelledby": "h", "aria-describedby": "p" }, [element("h2", { id: "h" }, [text("Circuits")]), element("p", { id: "p" }, [text("Every circuit raced on.")])]), 0]]);
    const section = find(drawn.root as never, "section")!;
    expect([section.getAttribute("aria-labelledby"), section.getAttribute("aria-describedby")]).toEqual(["h", "p"]);
    expect(drawn.refused).toEqual([]);
  });

  it("is refused, in a sentence naming the id, where it names an element the view does not draw", () => {
    const drawn = draw([[0, "~", element("section", { "aria-labelledby": "missing" }, [element("h2", { id: "ls-h" }, [text("Drivers")])]), 0]]);
    expect(find(drawn.root as never, "section")!.getAttribute("aria-labelledby")).toBeNull();
    expect(drawn.refused).toEqual([{ reason: "reference", element: "section", name: "aria-labelledby", ids: ["missing"] }]);
    expect(sayRefusal(drawn.refused[0]!).says).toBe('Not drawn: <section> aria-labelledby names "missing", which is no element of this view. It names elements the view draws itself, by their id (<h2 id="…">), drawn once each is there.');
  });

  it("is drawn once the heading it names is drawn in a later batch, and taken back when the heading goes", () => {
    const section = element("section", { "aria-labelledby": "later" });
    const heading = element("h2", { id: "later" }, [text("Later")]);
    const drawn = draw([[0, "~", section, 0]], [[0, section.id, heading, 0]]);
    expect(find(drawn.root as never, "section")!.getAttribute("aria-labelledby")).toBe("later");
    const again = element("section", { "aria-labelledby": "later" }, [element("h2", { id: "later" })]);
    const gone = draw([[0, "~", again, 0]], [[1, again.id, 0]]);
    expect(find(gone.root as never, "section")!.getAttribute("aria-labelledby")).toBeNull();
    expect(gone.refused.at(-1)).toMatchObject({ reason: "reference", name: "aria-labelledby", ids: ["later"] });
  });

  it("is still refused a name in words of its own", () => {
    const drawn = draw([[0, "~", element("section", { "aria-label": "Notices", title: "Updates" }), 0]]);
    const found = find(drawn.root as never, "section")!;
    expect([found.getAttribute("aria-label"), found.getAttribute("title")]).toEqual([null, null]);
  });
});
