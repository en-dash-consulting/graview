import { placesOf, type AnySchema, type GraviewApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createTodoUiStore } from "../../../../apps/todo/src/ui/app.js";
import { todoApp } from "../../../../apps/todo/src/domain/app.js";
import { isDraftFailure, templateDraft } from "../../src/draft.js";
import { resolveAsk } from "../../src/go.js";
import { SEAT_OFFERS, suggestionsFor } from "../../src/suggest.js";

/**
 * THE SEAT OFFERS SOMEWHERE TO GO AND SOMETHING TO DRAW — in the reader's
 * words, and each one an ask the seat answers without a model: what falls
 * due this week (the resolver narrows the kind's list to it), another
 * picture to go to, and a board a shipped lens can bind.
 */
const TODAY = "2026-09-01";
const store = createTodoUiStore(TODAY);
const places = placesOf(todoApp).filter((place) => place.kind !== null && place.address.startsWith("/places/")).map((place) => ({ title: place.title, kind: place.kind, picture: true }));
const nothing = { id: null, name: "the whole thing" };

describe("what the seat offers to ask, beyond what is wrong", () => {
  it("offers what falls due this week, and a board to draw, at most three in all", () => {
    const offered = suggestionsFor({ store, subject: nothing, violations: [], today: TODAY, places });
    expect(offered.length).toBeLessThanOrEqual(SEAT_OFFERS);
    expect(offered.map((one) => [one.why, one.ask])).toEqual([
      ["due", "Tasks due this week"],
      ["draw", "Show tasks as a board by day"],
      ["here", "What is here?"],
    ]);
  });

  it("puts what is wrong first, and keeps to three", () => {
    const late = { invariant: "x", label: "x", message: "late", nodeIds: ["t-deposit"], repairs: [] };
    const offered = suggestionsFor({ store, subject: { id: "t-deposit", name: "Pay the deposit" }, violations: [late], today: TODAY, places });
    expect(offered.map((one) => one.why)).toEqual(["problem", "due", "draw"]);
  });

  it("offers another picture to go to when nothing falls due", () => {
    const offered = suggestionsFor({ store, subject: nothing, violations: [], today: "2030-01-01", places });
    expect(offered[0]).toEqual({ ask: `Go to ${places[0]!.title}`, why: "go" });
  });

  it("never offers to go where the reader already is", () => {
    const here = places[0]!;
    const offered = suggestionsFor({ store, subject: nothing, violations: [], today: "2030-01-01", places, place: { title: here.title, kind: here.kind ?? "task" } });
    expect(offered.map((one) => one.ask)).not.toContain(`Go to ${here.title}`);
  });

  it("says each so the seat answers it without a model: the due ask moves to the narrowed list, the drawing is a board", () => {
    const [due, draw] = suggestionsFor({ store, subject: nothing, violations: [], today: TODAY, places });
    const went = resolveAsk(store as never, due!.ask, { places: placesOf(todoApp), today: TODAY });
    expect(went).toMatchObject({ about: "kind", moves: [{ to: "kind", kind: "task" }] });
    const drawn = templateDraft(draw!.ask, { app: { name: "Things", schema: todoApp.schema } as unknown as GraviewApp<AnySchema> });
    expect(drawn && !isDraftFailure(drawn) ? drawn.lens : drawn).toMatchObject({ name: "columns", on: "task", bindings: { task: { column: "day" } } });
  });
});
