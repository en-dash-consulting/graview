import { describe, expect, it } from "vitest";
import { altitudeAt, anchorOf, cameraBetween, cameraPutting, edgeToward, levelZooms, meetingOf, pageBox, panelBox, project, standingAt, standingCss, zoomAtAltitude, type Box } from "../../src/one-place-geometry.js";

const desk = { width: 2000, height: 1185 };
const phone = { width: 390, height: 844 };
const tasks: Box = { x: 300, y: 380, width: 270, height: 140 };
const lists: Box = { x: 580, y: 280, width: 180, height: 100 };
const record = { type: "record", id: "t-deposit", kind: "task" } as const;

describe("a page stands on its place in the Scene's city, one altitude from page to city", () => {
  it("reads the altitude off the camera's zoom, steadily between levels, and back", () => {
    const zooms = levelZooms(record, desk);
    expect(zooms[0]).toBeGreaterThan(zooms[1]);
    expect(zooms[1]).toBeGreaterThan(zooms[2]);
    expect(zooms[2]).toBeGreaterThan(zooms[3]);
    for (const level of [0, 1, 2, 3]) expect(altitudeAt(zooms[level]!, zooms)).toBeCloseTo(level, 6);
    // A little of a pinch is a little of the way.
    expect(altitudeAt(zooms[1]! * 0.98, zooms)).toBeGreaterThan(1);
    expect(altitudeAt(zooms[1]! * 0.98, zooms)).toBeLessThan(1.1);
    for (const a of [0.3, 1.5, 2.7]) expect(altitudeAt(zoomAtAltitude(a, zooms), zooms)).toBeCloseTo(a, 6);
  });

  it("narrows the page from the window to the panel through every box between, a column at a desk and a sheet from the foot on a phone", () => {
    expect(pageBox(0, desk)).toEqual({ x: 0, y: 0, width: desk.width, height: desk.height });
    expect(pageBox(1, desk)).toEqual(panelBox(desk));
    const half = pageBox(0.5, desk);
    expect(half.width).toBeLessThan(desk.width);
    expect(half.width).toBeGreaterThan(panelBox(desk).width);
    expect(panelBox(desk).x).toBeGreaterThan(desk.width / 2);
    expect(panelBox(phone).y).toBeGreaterThan(phone.height / 3);
  });

  it("stands the page's foot on its roof at 2, turned at a desk and flat on a phone, and as it is at the panel", () => {
    const roof = { x: 600, y: 700 };
    const box = panelBox(desk);
    expect(standingCss(standingAt(1, roof, box, desk), desk)).toBe("none");
    const stood = standingAt(2, roof, box, desk);
    expect(box.x + box.width / 2 + stood.x).toBeCloseTo(roof.x);
    expect(standingCss(stood, desk)).toContain("rotateY");
    expect(standingCss(standingAt(2, roof, panelBox(phone), phone), phone)).not.toContain("rotate");
    // Into its building at the city, and gone.
    expect(standingAt(3, roof, box, desk).opacity).toBe(0);
  });

  it("moves the camera so the place travels in a straight line on the window", () => {
    const about = { x: 400, y: 300 };
    const from = cameraPutting(about, { x: 100, y: 100 }, 1);
    const to = cameraPutting(about, { x: 300, y: 500 }, 2);
    const mid = project(cameraBetween(from, to, about, 0.5), about);
    expect(mid.x).toBeCloseTo(200);
    expect(mid.y).toBeCloseTo(300);
  });

  it("ends a line to a building under the page at the page's edge", () => {
    const page = { x: 100, y: 100, width: 300, height: 400 };
    expect(edgeToward({ x: 120, y: 300 }, page)).toEqual({ x: 100, y: 300 });
    expect(edgeToward({ x: 50, y: 50 }, page)).toBeNull();
  });

  it("stands a place of one kind on its district, and of several where they meet, never inside one kind's district", () => {
    const one = anchorOf({ type: "place", as: "the-lists", kinds: ["list"] }, { districts: [lists], all: [tasks, lists] })!;
    expect(one).toEqual({ x: lists.x + lists.width / 2, y: lists.y + lists.height / 2 });
    const far: Box = { x: 900, y: 600, width: 200, height: 100 };
    const meet = meetingOf([tasks, far], [tasks, lists, far])!;
    for (const box of [tasks, lists, far]) {
      const inside = meet.x > box.x && meet.x < box.x + box.width && meet.y > box.y && meet.y < box.y + box.height;
      expect(inside).toBe(false);
    }
  });
});
