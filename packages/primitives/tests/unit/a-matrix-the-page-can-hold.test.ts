import { describe, expect, it } from "vitest";
import { capCoverage, COVERAGE_MAX_COLUMNS, COVERAGE_MAX_ROWS, type CoverageGrid } from "../../src/index.js";

/**
 * A MATRIX THE PAGE CAN HOLD. A real discography's "who worked with whom"
 * is 568 artists by 568 — a third of a million cells — and the page never
 * came back from drawing them. Past the limit the picture keeps the most
 * tied rows and columns in their own order, says how many there were, and
 * still counts what is missing over all of them.
 */
const grid = (rows: number, columns: number, ties: readonly [number, number][]): CoverageGrid => ({
  rows: Array.from({ length: rows }, (_, i) => ({ id: `r${i}`, ref: "", label: `Row ${i}`, group: "", required: true, covered: ties.some(([r]) => r === i), badged: false })),
  columns: Array.from({ length: columns }, (_, i) => ({ id: `c${i}`, label: `Column ${i}`, used: ties.some(([, c]) => c === i) })),
  cells: ties.map(([r, c]) => ({ rowId: `r${r}`, columnId: `c${c}` }) as CoverageGrid["cells"][number]),
  gaps: Array.from({ length: rows }, (_, i) => i).filter((i) => !ties.some(([r]) => r === i)).map((i) => `r${i}`),
  unasked: Array.from({ length: columns }, (_, i) => i).filter((i) => !ties.some(([, c]) => c === i)).map((i) => `c${i}`),
});

describe("a coverage the page can hold", () => {
  it("leaves a grid inside the limits exactly as it was", () => {
    const small = grid(5, 4, [[0, 1], [2, 3]]);
    expect(capCoverage(small)).toBe(small);
  });

  it("keeps the most tied rows and columns, in their own order, and says of how many", () => {
    const ties: [number, number][] = [[7, 0], [7, 1], [7, 2], [3, 0], [3, 1], [9, 2], [1, 5]];
    const capped = capCoverage(grid(10, 6, ties), { rows: 3, columns: 3 });
    // r7 has three ties, r3 two; r1 and r9 one each, and the tie goes to the grid's own order.
    expect(capped.rows.map((row) => row.id)).toEqual(["r1", "r3", "r7"]);
    expect(capped.columns.map((column) => column.id)).toEqual(["c0", "c1", "c2"]);
    expect(capped.of).toEqual({ rows: 10, columns: 6 });
    // Only the cells both of whose ends are drawn.
    expect(capped.cells).toHaveLength(5);
    // What is missing is still counted over all of it.
    expect(capped.gaps).toHaveLength(10 - 4);
    expect(capped.unasked).toEqual(["c3", "c4"]);
  });

  it("draws at most the default limits of a third of a million cells", () => {
    const ties: [number, number][] = Array.from({ length: 2000 }, (_, i) => [i % 568, (i * 7) % 568]);
    const capped = capCoverage(grid(568, 568, ties));
    expect(capped.rows.length).toBe(COVERAGE_MAX_ROWS);
    expect(capped.columns.length).toBe(COVERAGE_MAX_COLUMNS);
    expect(COVERAGE_MAX_ROWS * COVERAGE_MAX_COLUMNS).toBeLessThanOrEqual(1000);
  });
});
