import { describe, expect, it } from "vitest";
import { chipPlace } from "../../src/hover-chip.js";

/*
 * WHERE THE HOVER CHIP STANDS (Graview HQ feature:f-view-menu-suggests-under-pointer):
 * beside the record the pointer rests on, never over it or over what is
 * drawn above it — it stood above a row's right edge, over the heading
 * above it.
 */
const window = { width: 1400, height: 1000 };
const chip = { width: 220, height: 24 };
const overlaps = (a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

describe("a hover chip", () => {
  it("stands to the right of a row, level with it, where the window has room", () => {
    const row = { left: 412, top: 592, width: 111, height: 19 };
    const at = chipPlace(row, chip, window);
    expect(at.left).toBeGreaterThanOrEqual(row.left + row.width);
    expect(Math.abs(at.top + chip.height / 2 - (row.top + row.height / 2))).toBeLessThanOrEqual(1);
    expect(overlaps({ ...at, ...chip }, row)).toBe(false);
  });

  it("stands level with the top of a tall card, not its middle", () => {
    const card = { left: 100, top: 200, width: 300, height: 180 };
    const at = chipPlace(card, chip, window);
    expect(at.left).toBeGreaterThanOrEqual(400);
    expect(at.top).toBeLessThan(card.top + 24);
    expect(at.top).toBeGreaterThanOrEqual(card.top);
  });

  it("stands just below a row as wide as the window, from its left edge", () => {
    const row = { left: 16, top: 300, width: 1368, height: 44 };
    const at = chipPlace(row, chip, window);
    expect(at.left).toBe(16);
    expect(at.top).toBeGreaterThanOrEqual(row.top + row.height);
    expect(at.top).toBeLessThan(row.top + row.height + 12);
    expect(overlaps({ ...at, ...chip }, row)).toBe(false);
  });

  it("stands above a wide row at the window's bottom, and never outside the window", () => {
    const row = { left: 16, top: 950, width: 1368, height: 44 };
    const at = chipPlace(row, chip, window);
    expect(at.top + chip.height).toBeLessThanOrEqual(row.top);
    expect(at.top).toBeGreaterThanOrEqual(0);
    expect(at.left + chip.width).toBeLessThanOrEqual(window.width);
  });

  it("keeps off the records drawn beside it: below a card whose right is its neighbor", () => {
    const today = { left: 394, top: 1114, width: 197, height: 88 };
    const week = { left: 601, top: 1114, width: 197, height: 88 };
    const at = chipPlace(today, chip, { width: 1400, height: 1400 }, [week]);
    expect(overlaps({ ...at, ...chip }, week)).toBe(false);
    expect(overlaps({ ...at, ...chip }, today)).toBe(false);
    expect(at.top).toBeGreaterThanOrEqual(today.top + today.height);
  });

  it("follows the record: another row, another place", () => {
    const first = chipPlace({ left: 412, top: 592, width: 111, height: 19 }, chip, window);
    const second = chipPlace({ left: 412, top: 615, width: 93, height: 19 }, chip, window);
    expect(second.top - first.top).toBe(23);
    expect(second.left).not.toBe(first.left);
  });
});
