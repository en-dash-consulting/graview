import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_VIEW_BLOCKS, MAX_VIEW_BLOCKS_IN_ALL, readDocument } from "../../src/document/index.js";

/**
 * A VIEW IS HELD TO FORTY BLOCKS AT ITS TOP, A GROUP COUNTING AS ONE, AND
 * TO 120 IN ALL. A home of four stat tiles (a figure and a line each), four
 * summary lines, five meters and three lists is sixteen things on the page,
 * and was refused as fifty-six blocks.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/blocks-layout.gdd.json", import.meta.url), "utf8"));
const withHome = (home: unknown[]) => ({ ...review, views: { ...review.views, home } });
const sizes = (home: unknown[]) => readDocument(withHome(home)).findings.filter((f) => f.code === "view-size");

const tile = (n: number) => ({ group: [{ figure: "count(all('finding'))", label: `tile ${n}` }, { text: "in all" }], direction: "column" });
const meter = { progress: { value: "count(all('finding') where phase == 'now')", max: "count(all('finding'))" }, label: "now" };

describe("a view counts the blocks at its top", () => {
  it("takes a home of fourteen things on the page, sixty-three blocks counted inside", () => {
    const home = [
      { headline: "The review" },
      { group: [tile(1), tile(2), tile(3), tile(4)], direction: "row" },
      ...Array.from({ length: 4 }, (_, i) => ({ text: `Line ${i + 1}` })),
      { group: [meter, meter, meter, meter, meter], direction: "column" },
      ...Array.from({ length: 3 }, () => ({ list: "all('finding')", as: "row" })),
      // More inside groups, as a real home's stat tiles and meters hold: sixty-three in all.
      ...Array.from({ length: 4 }, () => ({ group: Array.from({ length: 8 }, (_, i) => ({ text: `Detail ${i}` })), direction: "row" })),
    ];
    expect(sizes(home)).toEqual([]);
  });

  it("refuses a forty-first block at the top, and says a group counts as one", () => {
    expect(sizes(Array.from({ length: MAX_VIEW_BLOCKS }, () => ({ divider: true })))).toEqual([]);
    const [over] = sizes(Array.from({ length: MAX_VIEW_BLOCKS + 1 }, () => ({ divider: true })));
    expect(over?.path).toBe("views.home");
    expect(over?.message).toMatch(/41 blocks at its top/);
    expect(over?.message).toMatch(/a group or a condition counting as one/);
  });

  it("keeps a ceiling on every block, counted inside groups and conditions", () => {
    const group = (n: number) => ({ group: Array.from({ length: n }, () => ({ divider: true })) });
    // 10 groups of 11 blocks: 10 at the top, 120 in all.
    expect(sizes(Array.from({ length: 10 }, () => group(11)))).toEqual([]);
    const [over] = sizes([...Array.from({ length: 10 }, () => group(11)), { divider: true }]);
    expect(over?.message).toMatch(new RegExp(`121 blocks counting the ones inside its groups and conditions; a view has at most ${MAX_VIEW_BLOCKS_IN_ALL} in all`));
  });
});
