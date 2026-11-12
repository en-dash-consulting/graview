import { describe, expect, it } from "vitest";
import { altitudeAt, anchorOf, cityArea, curveAt, END_ROOM, fitBeside, routeLine, cameraBetween, cameraPutting, edgeToward, fitCamera, leaveFrom, levelZooms, meetingOf, nearestThatWay, pageBox, panelBox, project, signFeet, signRoom, standingAt, standingCss, zoomAtAltitude, type Box } from "../../src/one-place-geometry.js";

const desk = { width: 2000, height: 1185, top: 48 };
const phone = { width: 390, height: 844, top: 96 };
const tasks: Box = { x: 300, y: 380, width: 270, height: 140 };
const lists: Box = { x: 580, y: 280, width: 180, height: 100 };
const record = { type: "record", id: "t-deposit", kind: "task" } as const;

describe("a page stands on its place in the Scene's city, one altitude from page to city", () => {
  it("reads the altitude off the camera's zoom, steadily between levels, and back", () => {
    const zooms = levelZooms(record, desk);
    expect(zooms[0]).toBeGreaterThan(zooms[1]);
    expect(zooms[1]).toBeGreaterThan(zooms[2]);
    for (const level of [0, 1, 2]) expect(altitudeAt(zooms[level]!, zooms)).toBeCloseTo(level, 6);
    // A little of a pinch is a little of the way.
    expect(altitudeAt(zooms[1]! * 0.98, zooms)).toBeGreaterThan(1);
    expect(altitudeAt(zooms[1]! * 0.98, zooms)).toBeLessThan(1.1);
    for (const a of [0.3, 1.5]) expect(altitudeAt(zoomAtAltitude(a, zooms), zooms)).toBeCloseTo(a, 6);
  });

  it("narrows the page from the window under the bar to the panel through every box between, a column at a desk and a sheet from the foot on a phone", () => {
    expect(pageBox(0, desk)).toEqual({ x: 0, y: desk.top, width: desk.width, height: desk.height - desk.top });
    expect(pageBox(1, desk)).toEqual(panelBox(desk));
    const half = pageBox(0.5, desk);
    expect(half.width).toBeLessThan(desk.width);
    expect(half.width).toBeGreaterThan(panelBox(desk).width);
    expect(panelBox(desk).x).toBeGreaterThan(desk.width / 2);
    expect(panelBox(desk).y).toBeGreaterThanOrEqual(desk.top);
    expect(panelBox(phone).y).toBeGreaterThan(phone.height / 3);
  });

  it("goes into its view at the city by moving and scaling alone — never turned or sheared — its foot on the view's foot", () => {
    const panel = panelBox(desk);
    expect(standingCss(standingAt(1, panel, { x: 600, y: 700 }, 96))).toBe("none");
    const stood = standingAt(2, panel, { x: 600, y: 700 }, 96);
    expect(panel.x + panel.width / 2 + stood.x).toBeCloseTo(600);
    expect(panel.y + stood.height + stood.y).toBeCloseTo(700);
    expect(panel.width * stood.scale).toBeCloseTo(96);
    for (const a of [1, 1.3, 1.7, 2]) expect(standingCss(standingAt(a, panel, { x: 600, y: 700 }, 96))).not.toMatch(/rotate|skew|perspective|matrix/);
  });

  it("stands a kind's views in rows of three under its name, and the plaza's rising behind one another, none over another", () => {
    const feet = [...signFeet(["a", "b", "c", "d"], { x: 500, y: 600 }, 96, "down").values()];
    expect(feet.slice(0, 3).every((foot) => foot.y === feet[0]!.y)).toBe(true);
    expect(feet[3]!.y).toBeGreaterThan(feet[0]!.y);
    for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) expect(Math.abs(feet[i]!.x - feet[j]!.x) >= 96 || Math.abs(feet[i]!.y - feet[j]!.y) >= 64).toBe(true);
    const up = [...signFeet(["a", "b", "c", "d"], { x: 500, y: 600 }, 96, "up").values()];
    expect(up[3]!.y).toBeLessThan(up[0]!.y);
    expect(signRoom(4, 96).height).toBeGreaterThan(signRoom(3, 96).height);
  });

  it("fits a box into an area with a margin, never closer than it is asked", () => {
    const camera = fitCamera({ x: 0, y: 0, width: 1000, height: 500 }, { x: 0, y: 50, width: 500, height: 500 }, 10);
    const a = project(camera, { x: 0, y: 0 });
    const b = project(camera, { x: 1000, y: 500 });
    expect(a.x).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(b.x).toBeLessThanOrEqual(490 + 1e-9);
    expect(fitCamera({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 500, height: 500 }, 10, 1).s).toBe(1);
  });

  it("moves the camera so the place travels in a straight line on the window", () => {
    const about = { x: 400, y: 300 };
    const from = cameraPutting(about, { x: 100, y: 100 }, 1);
    const to = cameraPutting(about, { x: 300, y: 500 }, 2);
    const mid = project(cameraBetween(from, to, about, 0.5), about);
    expect(mid.x).toBeCloseTo(200);
    expect(mid.y).toBeCloseTo(300);
  });

  it("leaves the page's edge that faces the city, level with the part, and ends a line to a building under the page at its edge", () => {
    const page = { x: 100, y: 100, width: 300, height: 400 };
    expect(leaveFrom({ x: 250, y: 300 }, page, false)).toEqual({ x: 100, y: 300 });
    expect(leaveFrom({ x: 250, y: 300 }, page, true)).toEqual({ x: 250, y: 100 });
    expect(edgeToward({ x: 120, y: 300 }, page)).toEqual({ x: 100, y: 300 });
    expect(edgeToward({ x: 50, y: 50 }, page)).toBeNull();
  });

  it("walks the views with the arrow keys to the nearest one that way", () => {
    const at = { x: 100, y: 100, width: 50, height: 30 };
    const others = [
      { key: "right", box: { x: 200, y: 105, width: 50, height: 30 } },
      { key: "far-right", box: { x: 400, y: 100, width: 50, height: 30 } },
      { key: "below", box: { x: 100, y: 200, width: 50, height: 30 } },
    ];
    expect(nearestThatWay(at, others, "right")).toBe("right");
    expect(nearestThatWay(at, others, "down")).toBe("below");
    expect(nearestThatWay(at, others, "left")).toBeNull();
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

  it("keeps a line to the city: never over the page, the bar or the control, pointing at a building out of sight from the city's edge", () => {
    const page = panelBox(desk);
    const control = { x: 16, y: desk.height - 48, width: 220, height: 32 };
    const area = cityArea(page, desk, control, false);
    const from = { x: page.x, y: 900 };
    for (const target of [{ x: 300, y: 500 }, { x: page.x + 100, y: -200 }, { x: -300, y: 400 }, { x: 400, y: desk.height + 300 }, { x: page.x + 50, y: 400 }]) {
      const route = routeLine(from, target, area, false)!;
      expect(route).not.toBeNull();
      for (let i = 1; i < 20; i++) {
        const t = i / 20;
        const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * route.bend.x + t * t * route.to.x;
        const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * route.bend.y + t * t * route.to.y;
        expect(x).toBeLessThanOrEqual(page.x);
        expect(y).toBeGreaterThanOrEqual(desk.top);
        expect(x > control.x && x < control.x + control.width && y > control.y && y < control.y + control.height).toBe(false);
      }
    }
    expect(routeLine(from, { x: page.x + 100, y: -200 }, area, false)!.toward).not.toBeNull();
    expect(routeLine(from, { x: 300, y: 500 }, area, false)!.toward).toBeNull();
  });

  it("keeps a phone's lines off the control and the legend over it, leaving the sheet's edge past them", () => {
    const sheet = panelBox(phone);
    // The control riding on the sheet's top edge, and the legend over it.
    const control = { x: 16, y: sheet.y - 58, width: 298, height: 48 };
    const legend = { x: 16, y: control.y - 30 - 160, width: 300, height: 160 };
    const area = cityArea(sheet, phone, null, true);
    for (const target of [{ x: 60, y: 140 }, { x: 200, y: control.y + 10 }, { x: 350, y: 200 }, { x: 40, y: legend.y + 40 }, { x: 200, y: phone.height }]) {
      for (const part of [{ x: 40, y: sheet.y + 40 }, { x: 300, y: sheet.y + 40 }, { x: 370, y: sheet.y + 40 }]) {
        const route = routeLine({ x: part.x, y: sheet.y }, target, area, true, [control, legend]);
        if (!route) continue;
        // It leaves the sheet's own edge, past the control, and its end keeps clear of the sheet's edge.
        expect(route.from.y).toBe(sheet.y);
        expect(route.from.x).toBeGreaterThan(control.x + control.width);
        expect(route.to.y).toBeLessThanOrEqual(sheet.y - 6 - END_ROOM + 0.01);
        for (let i = 1; i < 40; i++) {
          const p = curveAt(route.from, route.bend, route.to, i / 40);
          for (const box of [control, legend]) expect(p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height).toBe(false);
        }
      }
    }
    // A building in plain sight beside the control is reached.
    expect(routeLine({ x: 370, y: sheet.y }, { x: 350, y: 200 }, area, true, [control])?.toward).toBeNull();
  });

  it("fits the city beside what stands at the foot: above it, or to its right, whichever is larger", () => {
    const city = { x: 0, y: 0, width: 800, height: 300 };
    const legend = { x: 16, y: desk.height - 260, width: 330, height: 244 };
    const camera = fitBeside(city, desk, [legend], 20);
    const left = city.x * camera.s + camera.x;
    const bottom = (city.y + city.height) * camera.s + camera.y;
    // Never under the legend: wholly to its right, or wholly above it.
    expect(left >= legend.x + legend.width || bottom <= legend.y).toBe(true);
    // With nothing at the foot, the whole window under the bar.
    expect(fitBeside(city, desk, [], 20).s).toBeGreaterThanOrEqual(camera.s);
  });
});
