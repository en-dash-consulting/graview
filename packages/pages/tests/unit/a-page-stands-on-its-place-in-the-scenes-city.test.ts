import { describe, expect, it } from "vitest";
import { anchorOf, IN, meetingOf, standingCss, standingOn, stopAtZoom, stopsOf, zoomAt, type Box } from "../../src/one-place-geometry.js";

const desk = { width: 2000, height: 1185 };
const phone = { width: 390, height: 844 };
const tasks: Box = { x: 300, y: 380, width: 270, height: 140 };
const lists: Box = { x: 580, y: 280, width: 180, height: 100 };
const building: Box = { x: 420, y: 400, width: 30, height: 30 };
const record = { type: "record", id: "t-deposit", kind: "task" } as const;

describe("a page stands on its place in the Scene's city", () => {
  it("has the page, the panel, the page stood back and the city, at a desk and on a phone; home has no panel", () => {
    expect(stopsOf(record, desk.width)).toEqual(["page", "panel", "back", "city"]);
    expect(stopsOf(record, phone.width)).toEqual(["page", "panel", "back", "city"]);
    expect(stopsOf({ type: "home" }, desk.width)).toEqual(["page", "back", "city"]);
    expect(stopsOf({ type: "overview" }, desk.width)).toEqual(["city"]);
  });

  it("asks the Scene's own camera to come closest at the panel, less stood back, and level over the city", () => {
    expect(zoomAt("panel", record, desk.width)).toBeGreaterThan(zoomAt("back", record, desk.width));
    expect(zoomAt("back", record, desk.width)).toBeGreaterThan(zoomAt("city", record, desk.width));
    expect(zoomAt("city", record, desk.width)).toBe(1);
    // The page waits where its first step begins, so stepping back begins in place.
    expect(zoomAt("page", record, desk.width)).toBe(zoomAt("panel", record, desk.width));
  });

  it("moves one level for a zoom past a level's range, and never on a hand resting near its own", () => {
    expect(stopAtZoom(2.1, "panel", record, desk.width)).toBe("panel");
    expect(stopAtZoom(1.4, "panel", record, desk.width)).toBe("back");
    expect(stopAtZoom(0.7, "back", record, desk.width)).toBe("city");
    expect(stopAtZoom(2.6, "back", record, desk.width)).toBe("panel");
    expect(stopAtZoom(2.9, "panel", record, desk.width)).toBe("page");
    // Home stood back and its overview share a camera: zooming out is the overview.
    expect(stopAtZoom(0.7, "back", { type: "home" }, desk.width)).toBe("city");
  });

  it("stands a record page's foot on its building's roof, turned a little at a desk and flat on a phone", () => {
    const at = anchorOf(record, { building, district: tasks }, desk)!;
    expect(at.x).toBe(building.x + building.width / 2);
    const stood = standingOn("back", record, at, desk);
    // Its foot's middle, where the transform turns it about, is moved onto the point.
    expect(stood.x + desk.width / 2).toBe(at.x);
    expect(stood.y + desk.height).toBeCloseTo(at.y - 4);
    expect(standingCss(stood, desk)).toContain("rotateY");
    expect(standingCss(standingOn("back", record, at, phone), phone)).not.toContain("rotate");
    expect(standingCss(IN, desk)).toBe("none");
  });

  it("stands a place of one kind on its district, and of several where they meet, never inside one kind's district", () => {
    const one = anchorOf({ type: "place", as: "the-lists", kinds: ["list"] }, { districts: [lists], all: [tasks, lists] }, desk)!;
    expect(one).toEqual({ x: lists.x + lists.width / 2, y: lists.y + lists.height / 2 });
    const far: Box = { x: 900, y: 600, width: 200, height: 100 };
    const meet = meetingOf([tasks, far], [tasks, lists, far])!;
    for (const box of [tasks, lists, far]) {
      const inside = meet.x > box.x && meet.x < box.x + box.width && meet.y > box.y && meet.y < box.y + box.height;
      expect(inside).toBe(false);
    }
    // Two districts whose middles meet inside a third: a plaza above the city instead.
    const plaza = meetingOf([{ x: 0, y: 380, width: 100, height: 140 }, { x: 900, y: 380, width: 100, height: 140 }], [tasks, { x: 0, y: 380, width: 100, height: 140 }, { x: 900, y: 380, width: 100, height: 140 }])!;
    expect(plaza.y).toBeLessThan(380);
  });
});
