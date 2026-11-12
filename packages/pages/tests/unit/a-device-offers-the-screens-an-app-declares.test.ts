import { readFileSync } from "node:fs";
import type { Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { renderScreen } from "@graview/pages/device";
import { createRotaStore, rotaApp } from "../../../../apps/rota/src/domain/app.js";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A DEVICE OFFERS THE SCREENS AN APP DECLARES (Roadmap f-device-nav-bar): its
 * `devices.screens` drawn in order as a strip along the foot of the screen,
 * with Refresh last, each a press that goes to its place, the one on screen
 * marked — and with none declared, the home and the app's jobs, else the
 * places its bar stands.
 */
const PW3 = { width: 758, height: 1024 } as const;
const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const todo = () => createTodoStore({ snapshot: json("../../../../apps/todo/src/data/example.json") });
const declared = { ...todoApp, devices: { screens: [{ place: "tasks", label: "Tasks" }, { place: "home", label: "Today" }, { place: "The week", label: "Week" }] } };

/** The strip: the presses along the foot of the screen, left to right. */
const stripOf = (screen: ReturnType<typeof renderScreen>) => screen.taps.filter((tap) => tap.y + tap.height === PW3.height).sort((a, b) => a.x - b.x);
const marked = (screen: ReturnType<typeof renderScreen>) => [...screen.html.matchAll(/class="gv-at gv-press gv-here" style="[^"]*" data-tap="(\d+)"/g)].map((m) => screen.taps[Number(m[1])]!.label);

describe("the strip of a declared app", () => {
  it("draws its screens in order with Refresh last, each a press that goes to its place, spanning the screen", () => {
    const screen = renderScreen(todo(), declared, "/tasks", { profile: "eink", viewport: PW3, viewer: keeper });
    const strip = stripOf(screen);
    expect(strip.map((tap) => [tap.label, tap.does])).toEqual([
      ["Tasks", { go: "/tasks" }],
      ["Today", { go: "/" }],
      ["Week", { go: "/places/the-week" }],
      ["Refresh", { refresh: true }],
    ]);
    expect(strip[0]!.x).toBe(0);
    expect(strip.at(-1)!.x + strip.at(-1)!.width).toBe(PW3.width);
    for (const [i, tap] of strip.entries()) if (i > 0) expect(tap.x).toBe(strip[i - 1]!.x + strip[i - 1]!.width);
  });

  it("marks the screen it is on — and, on a record, the screen of its kind's list", () => {
    const store = todo();
    expect(marked(renderScreen(store, declared, "/tasks", { profile: "eink", viewport: PW3, viewer: keeper }))).toEqual(["Tasks"]);
    expect(marked(renderScreen(store, declared, "home", { profile: "eink", viewport: PW3, viewer: keeper }))).toEqual(["Today"]);
    const task = store.graph.nodesOfKind("task")[0]!;
    expect(marked(renderScreen(store, declared, task.id, { profile: "eink", viewport: PW3, viewer: keeper }))).toEqual(["Tasks"]);
    // A place on no screen marks none.
    expect(marked(renderScreen(store, declared, "/lists", { profile: "eink", viewport: PW3, viewer: keeper }))).toEqual([]);
  });
});

describe("an app that declares no screens", () => {
  it("offers the home and its jobs, a job's screen its question and the records that answer it", () => {
    const store = todo();
    const home = renderScreen(store, todoApp, "home", { profile: "eink", viewport: PW3, viewer: keeper });
    const strip = stripOf(home);
    const jobs = (todoApp.purpose?.jobs ?? []).map((job) => `job:${job.name}`);
    expect(strip.map((tap) => tap.does)).toEqual([{ go: "/" }, ...jobs.slice(0, 3).map((go) => ({ go })), { refresh: true }]);
    const late = renderScreen(store, todoApp, jobs[0]!, { profile: "eink", viewport: PW3, viewer: keeper });
    expect(late.found).toBe(true);
    expect(late.title).toContain(todoApp.purpose!.jobs![0]!.ask);
    expect(marked(late)).toEqual([strip[1]!.label]);
    expect(renderScreen(store, todoApp, "job:nobody-asked", { profile: "eink", viewport: PW3, viewer: keeper }).found).toBe(false);
  });

  it("else offers what its bar stands, from the home", () => {
    const rota = createRotaStore({ snapshot: json("../../../../apps/rota/src/data/example.json") });
    const strip = stripOf(renderScreen(rota, rotaApp, "home", { profile: "eink", viewport: PW3, viewer: { kind: "human", id: "user-ada", roles: ["coordinator"] } }));
    expect(strip[0]!.does).toEqual({ go: "/" });
    expect(strip.at(-1)!.does).toEqual({ refresh: true });
    expect(strip.map((tap) => tap.label)).toContain("Shifts");
    expect(strip.length).toBeLessThanOrEqual(5);
  });
});
