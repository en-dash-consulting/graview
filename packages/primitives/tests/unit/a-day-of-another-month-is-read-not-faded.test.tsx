// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A DAY OF THE NEXT OR LAST MONTH IS TOLD BY ITS GROUND, NOT FADED. The
 * month's grid drew the days around it at 45% opacity, so their numbers read
 * at 1.9:1 against the page — axe's color-contrast on the tour's calendar
 * (verify site, everyViewportIsClean). The cell keeps full opacity and wears
 * the muted panel instead.
 */
describe("a day of another month in the calendar's grid", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../../src/lens/calendar-drawing.tsx"), "utf8");
  const cell = source.slice(source.indexOf("data-calendar-outside={cell.outside"), source.indexOf("data-calendar-outside={cell.outside") + 2000);

  it("is never drawn at less than full opacity", () => {
    expect(cell).not.toMatch(/opacity:\s*cell\.outside/);
  });

  it("is told apart by the muted panel behind it", () => {
    expect(cell).toMatch(/cell\.outside \? "var\(--graview-panel-muted\)"/);
  });
});
