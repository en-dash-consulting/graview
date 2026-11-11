import { describe, expect, it } from "vitest";
import { cameraAt, LEVEL, meetingOf, sheetTransform, standingPoint, stopsOf, through, type Box } from "../../src/one-place-geometry.js";

const desk = { width: 1280, height: 820 };
const phone = { width: 390, height: 844 };
const tasks: Box = { x: 300, y: 380, width: 270, height: 140 };
const lists: Box = { x: 580, y: 280, width: 180, height: 100 };
const building: Box = { x: 420, y: 400, width: 30, height: 30 };
const record = { type: "record", id: "t-deposit", kind: "task" } as const;

describe("a page stands on its place in the Scene's city", () => {
  it("has page, stepped back, district and city at a desk, and page, district and city on a phone", () => {
    expect(stopsOf(record, desk.width)).toEqual(["page", "back", "district", "city"]);
    expect(stopsOf(record, phone.width)).toEqual(["page", "district", "city"]);
    expect(stopsOf({ type: "home" }, desk.width)).toEqual(["page", "back", "city"]);
    expect(stopsOf({ type: "overview" }, desk.width)).toEqual(["city"]);
  });

  it("puts a record page's foot on its building's roof, wherever the camera stands", () => {
    const camera = cameraAt("back", record, desk, { building, district: tasks });
    const foot = standingPoint("back", record, camera, { building, district: tasks }, desk);
    const roof = through(camera, { x: building.x + building.width / 2, y: building.y + 2 });
    expect(foot).toEqual(roof);
    // The camera brings the building close, and keeps it under the middle of the window.
    expect(camera.scale).toBeGreaterThan(1);
    expect(Math.abs(roof.x - desk.width / 2)).toBeLessThan(1);
  });

  it("stands home over the whole city with the camera level, and the city stop is the Scene as it is", () => {
    expect(cameraAt("back", { type: "home" }, desk, { city: tasks })).toEqual(LEVEL);
    expect(cameraAt("city", record, desk, { building, district: tasks })).toEqual(LEVEL);
  });

  it("turns the page a little at a desk and draws it flat on a phone", () => {
    const at = { x: 640, y: 500 };
    expect(sheetTransform("back", record, at, desk)).toContain("rotateY");
    expect(sheetTransform("district", record, at, phone)).not.toContain("rotate");
    expect(sheetTransform("page", record, at, desk)).toBe("none");
  });

  it("stands a place of several kinds where their districts meet, and never inside one kind's district", () => {
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
