import { describe, expect, it } from "vitest";
import { addressOf, basePathOf, createSchema, defineApp, defineNode, pathWithin, placesOf, z } from "../../src/index.js";

/**
 * AN ADDRESS UNDER A BASE PATH (FR-106). A host that owns the page gives the
 * routed face the address bar, and serves the app at `/` or under a path of
 * its own (`/apps/<id>/`). `placesOf(app)` says each place's address on the
 * routed face, relative to the app; `addressOf` says it under the host's
 * base, exactly as the face's own links spell it, and `pathWithin` reads it
 * back.
 */
describe("an address under a base path", () => {
  it("normalizes a base: a leading slash, no trailing one, and the root as nothing", () => {
    expect(basePathOf(undefined)).toBe("");
    expect(basePathOf("")).toBe("");
    expect(basePathOf("/")).toBe("");
    expect(basePathOf("//")).toBe("");
    expect(basePathOf("apps/a1")).toBe("/apps/a1");
    expect(basePathOf("/apps/a1/")).toBe("/apps/a1");
    expect(basePathOf("/apps/a1//")).toBe("/apps/a1");
  });

  it("joins a place's address onto the base, the home being the base itself", () => {
    expect(addressOf("/", {})).toBe("/");
    expect(addressOf("/", { basePath: "/" })).toBe("/");
    expect(addressOf("/", { basePath: "/apps/a1/" })).toBe("/apps/a1");
    expect(addressOf("/places/the-board", { basePath: "/apps/a1/" })).toBe("/apps/a1/places/the-board");
    expect(addressOf("/places/the-board", { basePath: "/apps/a1" })).toBe("/apps/a1/places/the-board");
    expect(addressOf("/places/the-board")).toBe("/places/the-board");
    // A shared name keeps its `?of=`, and an encoded slug stays encoded.
    expect(addressOf("/places/the-timetable?of=talks", { basePath: "/apps/a1/" })).toBe("/apps/a1/places/the-timetable?of=talks");
    expect(addressOf("/places/caf%C3%A9", { basePath: "/apps/a1" })).toBe("/apps/a1/places/caf%C3%A9");
  });

  it("reads an address back to the app's own path, and nothing outside the base", () => {
    expect(pathWithin("/", undefined)).toBe("/");
    expect(pathWithin("/places/the-board", "/")).toBe("/places/the-board");
    expect(pathWithin("/apps/a1", "/apps/a1/")).toBe("/");
    expect(pathWithin("/apps/a1/", "/apps/a1")).toBe("/");
    expect(pathWithin("/apps/a1/places/caf%C3%A9", "/apps/a1")).toBe("/places/caf%C3%A9");
    expect(pathWithin("/APPS/a1/tasks", "/apps/a1")).toBe("/tasks");
    // `/apps/a10` is not under `/apps/a1`, and `/elsewhere` is under nothing of the app's.
    expect(pathWithin("/apps/a10/tasks", "/apps/a1")).toBeNull();
    expect(pathWithin("/elsewhere", "/apps/a1")).toBeNull();
  });

  it("gives every place placesOf lists the address the routed face draws its link with", () => {
    const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
    const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
    const places = placesOf(app);
    expect(places.map((place) => addressOf(place, { basePath: "/apps/a1/" }))).toEqual(["/apps/a1", "/apps/a1/places/overview", "/apps/a1/tasks"]);
    for (const place of places) expect(pathWithin(addressOf(place, { basePath: "/apps/a1" }).split("?")[0]!, "/apps/a1")).toBe(place.address.split("?")[0]);
  });
});
