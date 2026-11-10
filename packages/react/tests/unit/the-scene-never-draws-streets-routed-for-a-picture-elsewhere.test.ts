import { describe, expect, it } from "vitest";
import { groundOf, routesFor, routesSeen } from "../../src/ribbons.js";

/**
 * THE SCENE NEVER DRAWS STREETS ROUTED FOR A PICTURE ELSEWHERE. The pages'
 * city behind a page routes the same ground without the scene's name cards
 * (`elsewhere`), into the same memory of routes; the scene's camera, moving
 * over a ground it had not routed itself yet, took the last routes for that
 * ground and drew streets laid through its own cards. It takes only its own.
 */
describe("the streets the scene's camera draws from", () => {
  const plots = new Map([
    ["a", { col: 0, row: 0, side: 2 }],
    ["b", { col: 5, row: 0, side: 2 }],
  ]);
  const ribbons = [{ key: "e|a|b", from: "a", to: "b", width: 3 }];

  it("are never the ones routed for a picture of the city drawn off the scene", () => {
    const ground = groundOf({ ribbons, plots });
    routesFor({ ribbons, plots, cell: 33, tilt: 0.5, elsewhere: true });
    expect(routesSeen(ground, 33, 0.5)).toBeUndefined();
    const own = routesFor({ ribbons, plots, cell: 33, tilt: 0.5, labels: [{ x: 0, y: 0, width: 10, height: 10 }] });
    expect(routesSeen(ground, 33, 0.5)).toBe(own);
  });
});
