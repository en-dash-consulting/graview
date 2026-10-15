import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileBlocks, resolveBlocks } from "../../src/blocks.js";
import { readDocument } from "../../src/document/index.js";

/**
 * A FIGURE MAY BE SAID LARGE. A home whose headline wears a display face
 * drew its stat tiles' numbers at a figure's modest size, with no way to
 * say they were the point of the page: `"emphasis": "large"` says so, the
 * check holds it to the words it knows, and the drawing carries it.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/blocks-layout.gdd.json", import.meta.url), "utf8"));
const errorsWith = (home: unknown[]) => readDocument({ ...review, views: { ...review.views, home } }).findings.filter((f) => f.severity === "error").map((f) => `${f.code} @ ${f.path}`);

describe("a figure may be said large", () => {
  it("is taken on a figure that works a number out", () => {
    expect(errorsWith([{ figure: "count(all('finding'))", label: "findings", emphasis: "large" }])).toEqual([]);
  });

  it("is refused in any other word, and on the kind's picture", () => {
    expect(errorsWith([{ figure: "count(all('finding'))", emphasis: "huge" }])).toEqual(["view-emphasis @ views.home.0.emphasis"]);
    expect(errorsWith([{ figure: true, emphasis: "large" }])).toContain("unknown-key @ views.home.0.emphasis");
  });

  it("is carried to what a face draws", () => {
    const [large, plain] = resolveBlocks(compileBlocks([{ figure: "2", emphasis: "large" }, { figure: "3" }]), { node: null, kinds: new Map(), fields: {}, today: "2026-10-15" });
    expect(large).toMatchObject({ t: "number", text: "2", emphasis: "large" });
    expect(plain).not.toHaveProperty("emphasis");
  });
});
