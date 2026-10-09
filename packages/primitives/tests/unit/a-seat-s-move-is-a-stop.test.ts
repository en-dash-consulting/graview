import { toUrl, type ViewState } from "@graview/layout/view";
import { describe, expect, it } from "vitest";
import { sceneMove } from "../../src/seat-move.js";

/**
 * A SEAT'S MOVE IS A STOP the scene could have been walked to: the picture
 * the bar's place list opens, the district Find descends into narrowed, the
 * record the strip selects — so the address says it and Back walks out.
 */
const up: ViewState = { focusId: null, relation: null, expanded: [], pins: {}, overview: true, selection: ["t-book"] };
const stop = (move: Parameters<typeof sceneMove>[1]) => {
  const made = sceneMove(up, move);
  return "view" in made ? toUrl(made.view) : made.pane;
};

describe("a seat's move on the scene", () => {
  it("a picture is the kind's district, down, with the picture in view and nothing selected", () => {
    expect(stop({ to: "picture", kind: "task", as: "the-week", title: "The week", address: "/places/the-week", said: "Went to The week." })).toBe("#focus=aggregate%3Atask&in.view=the-week");
  });

  it("a kind narrowed is its district, down and close, carrying the list page's filter words", () => {
    expect(stop({ to: "kind", kind: "task", title: "Overdue tasks", filter: "due:before:2026-09-01,done:false", address: "/tasks?filter=…", said: "Went to the overdue tasks." })).toBe(
      "#focus=aggregate%3Atask&zoom=1&in.filter=due%3Abefore%3A2026-09-01%2Cdone%3Afalse",
    );
  });

  it("a record is focused and selected, on the ground", () => {
    expect(stop({ to: "record", id: "t-deposit", kind: "task", label: "Pay the deposit", address: "/tasks/t-deposit", said: "Went to Pay the deposit." })).toBe("#focus=t-deposit&sel=t-deposit");
  });

  it("the home and the scene are the opening stop, and the problems are the standing's pane", () => {
    expect(stop({ to: "place", slug: "home", title: "Home", address: "/", said: "Went to Home." })).toBe("#");
    expect(stop({ to: "problems", address: "/problems", said: "Went to the problems." })).toBe("problems");
  });
});
