import { describe, expect, it } from "vitest";
import { compileBlocks, resolveBlocks, type BlockContext, type ResolvedBlock } from "../../src/blocks.js";

/**
 * A HEADLINE INSIDE A GROUP IS A SECTION HEADING, NOT THE PAGE'S TITLE.
 * The home's first headline is the page's heading (level 1); a headline at
 * the top of a column inside a row was the first of ITS blocks, and was said
 * at level 1 too — two columns, two more page titles, each with the app's
 * line repeated under it.
 */
const ctx: BlockContext = { node: null, heading: 2, firstHeading: 1, kinds: new Map(), fields: {}, today: "2026-10-15" };

const headlines = (blocks: readonly ResolvedBlock[]): string[] =>
  blocks.flatMap((block) => (block.t === "headline" ? [`${block.level} ${block.text}`] : block.t === "group" || block.t === "when" ? headlines(block.blocks) : []));

describe("a nested headline is a section heading", () => {
  it("is said at the level of the view's sections, never as the page's heading", () => {
    const blocks = compileBlocks([
      { headline: "The review" },
      {
        group: [
          { group: [{ headline: "Where the problems are" }, { text: "layout" }], direction: "column" },
          { group: [{ headline: "When they are planned" }, { text: "now" }], direction: "column" },
        ],
        direction: "row",
      },
      { headline: "Everything else" },
    ]);
    expect(headlines(resolveBlocks(blocks, ctx))).toEqual(["1 The review", "2 Where the problems are", "2 When they are planned", "2 Everything else"]);
  });

  it("is a section heading even where the view's top has no headline", () => {
    const blocks = compileBlocks([{ group: [{ headline: "Where the problems are" }], direction: "column" }]);
    expect(headlines(resolveBlocks(blocks, ctx))).toEqual(["2 Where the problems are"]);
  });

  it("is a section heading under a condition too", () => {
    const blocks = compileBlocks([{ headline: "The review" }, { when: "true", show: [{ headline: "Shown when it holds" }] }]);
    expect(headlines(resolveBlocks(blocks, ctx))).toEqual(["1 The review", "2 Shown when it holds"]);
  });
});
