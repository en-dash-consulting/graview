import { readFileSync } from "node:fs";
import { createSchema, defineNode, isoDate, placesOf, Store, type AnySchema, type Policy, type Principal } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { resolveAsk, type AskAnswer, type SeatMove } from "../../src/go.js";
import { graphResponder, seatResponder } from "../../src/index.js";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";
import { createRotaStore, rotaApp } from "../../../../apps/rota/src/domain/app.js";
import { createSeedbedStore, seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";

/**
 * ASKS THE GRAPH CAN ANSWER, WITHOUT A MODEL.
 *
 * "Who's working thursday" was answered on the rota with "open questions
 * need AI" — and the roster holds the answer outright: the shifts on that
 * day, and the volunteers covering them. A named day, a date, a weekend is
 * read against the kind's date, relative to the day the store is judged
 * on; "who … <relation>" follows one relation from the filtered kind to
 * the kind asked for, matched by the relation's own declared words. The
 * names come back as records to press, and the app goes to the shifts.
 */

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const rotaExample = read("../../../../apps/rota/src/data/example.json");
const todoExample = read("../../../../apps/todo/src/data/example.json");

const moved = (answer: AskAnswer): readonly SeatMove[] => ("moves" in answer ? answer.moves : []);
const said = (answer: AskAnswer): string => ("say" in answer && answer.say) || "";
const picked = (answer: AskAnswer): readonly string[] => ("picks" in answer ? (answer.picks ?? []).map((hit) => hit.id) : []);

/** The rota, judged on its own Monday, 14 September 2026 — the day the store says, not the clock. */
const rota = () => createRotaStore({ snapshot: rotaExample, invariantOptions: { context: { today: "2026-09-14" } } });
const askRota = (text: string) => resolveAsk(rota(), text, { places: placesOf(rotaApp) });

describe("who, on a named day, on the rota", () => {
  it("'who's working thursday' names the volunteers covering Thursday's shifts, as records to press", () => {
    const answer = askRota("who's working thursday");
    expect(said(answer)).toMatch(/^On Thursday 17 Sep: Ada Nowak is working\./);
    expect(picked(answer)).toEqual(["v-ada"]);
    expect(answer.unresolved).toBeUndefined();
  });

  it("goes to the shifts on that day, in the words a page and a stop both carry", () => {
    const [move, ...more] = moved(askRota("who is working on Thursday?"));
    expect(more).toEqual([]);
    expect(move).toMatchObject({ to: "kind", kind: "shift", filter: "on:after:2026-09-16,on:before:2026-09-18", address: "/shifts?filter=on%3Aafter%3A2026-09-16%2Con%3Abefore%3A2026-09-18" });
  });

  it("reads the relation by its declared words: 'covering' is 'who is covering it', and 'on' needs no verb", () => {
    const wednesday = askRota("who's covering wednesday");
    expect(said(wednesday)).toMatch(/^On Wednesday 16 Sep: Bo Ferreira is covering\./);
    // Two shifts, one person: named once.
    expect(picked(wednesday)).toEqual(["v-bo"]);
    expect(picked(askRota("who's on tuesday"))).toEqual(["v-cass"]);
  });

  it("says which are uncovered, and says nobody when nobody is", () => {
    const friday = askRota("who's working friday");
    expect(said(friday)).toMatch(/^On Friday 18 Sep: nobody is working\. Friday repair cafe has nobody\./);
    expect(picked(friday)).toEqual([]);
    const weekend = askRota("who's working this weekend");
    expect(said(weekend)).toMatch(/^This weekend: Cass Whitley is working\. Sunday deep clean has nobody\./);
  });

  it("reads tomorrow, next Monday, and a date written either way round", () => {
    expect(said(askRota("who's working tomorrow"))).toMatch(/^On Tuesday 15 Sep: Cass Whitley/);
    expect(moved(askRota("who's working next monday"))[0]).toMatchObject({ filter: "on:after:2026-09-20,on:before:2026-09-22" });
    for (const text of ["who's working on 17 Sep", "who's working Sept 17th", "who's working on 17th of September"]) {
      expect(picked(askRota(text)), text).toEqual(["v-ada"]);
    }
  });

  it("a day with no shifts says so", () => {
    expect(said(askRota("who's working on 3 Oct"))).toMatch(/^No shifts on Saturday 3 Oct\./);
  });

  it("'which volunteers' names the kind outright, and 'what's on thursday' is the shifts that day", () => {
    expect(picked(askRota("which volunteers are working thursday"))).toEqual(["v-ada"]);
    const shifts = askRota("what's on thursday");
    expect(moved(shifts)[0]).toMatchObject({ kind: "shift", filter: "on:after:2026-09-16,on:before:2026-09-18" });
    expect(said(shifts)).toContain("Thursday baby group");
  });

  it("the graph answers it, grounded, and no model is asked", async () => {
    const complete = vi.fn(async () => '{"say": "Probably Bo.", "proposals": []}');
    const store = rota() as unknown as Store<AnySchema>;
    for (const respond of [graphResponder<AnySchema>(), seatResponder<AnySchema>({ complete })]) {
      const reply = await respond(store, "who's working thursday", { places: placesOf(rotaApp) });
      expect(reply.grounded).toBe(true);
      expect(reply.say).toMatch(/^On Thursday 17 Sep: Ada Nowak is working\./);
      expect(reply.picks?.map((hit) => hit.id)).toEqual(["v-ada"]);
      expect(reply.moves?.[0]).toMatchObject({ kind: "shift" });
    }
    expect(complete).not.toHaveBeenCalled();
    // Without any model, too: not "open questions need AI".
    const alone = await seatResponder<AnySchema>({})(store, "who's working thursday", { places: placesOf(rotaApp) });
    expect(alone.say).not.toContain("AI");
  });
});

describe("a named day on things", () => {
  // 2026-09-01 is a Tuesday.
  const ask = (text: string) => resolveAsk(createTodoStore({ snapshot: todoExample }), text, { places: placesOf(todoApp), today: "2026-09-01" });

  it("'what's due friday' is the tasks due on Friday 4 Sep", () => {
    const answer = ask("what's due friday");
    expect(moved(answer)[0]).toMatchObject({ to: "kind", kind: "task", filter: "due:after:2026-09-03,due:before:2026-09-05" });
    expect(said(answer)).toBe("Went to the tasks due Friday 4 Sep. One task is due Friday 4 Sep: Move the broadband.");
  });

  it("reads 'on thursday', 'next tuesday', 'yesterday' and a date", () => {
    expect(moved(ask("tasks due on thursday"))[0]).toMatchObject({ filter: "due:after:2026-09-02,due:before:2026-09-04" });
    expect(moved(ask("tasks due next tuesday"))[0]).toMatchObject({ filter: "due:after:2026-09-07,due:before:2026-09-09" });
    expect(moved(ask("tasks due yesterday"))[0]).toMatchObject({ filter: "due:after:2026-08-30,due:before:2026-09-01" });
    expect(moved(ask("what's due Sep 3"))[0]).toMatchObject({ filter: "due:after:2026-09-02,due:before:2026-09-04" });
    expect(picked(ask("what's due 3 September"))).toEqual(["t-meter", "t-post"]);
  });

  it("a record named after a day is still the record", () => {
    // A weekday inside a longer name is not a date ask.
    expect(ask("show tasks as a board by list")).toEqual({ unresolved: true });
  });
});

describe("a named day and one relation on seedbed", () => {
  const garden = () =>
    createSeedbedStore({
      snapshot: {
        nodes: [
          { id: "plot-a", kind: "plot", label: "Bed A", beds: 2 },
          { id: "plot-b", kind: "plot", label: "Bed B", beds: 1 },
          { id: "g-ana", kind: "gardener", label: "Ana" },
          { id: "p-beans", kind: "planting", label: "Runner beans", sown: "2026-08-31", status: "growing" },
          { id: "p-kale", kind: "planting", label: "Kale", sown: "2026-07-01", status: "growing" },
        ],
        edges: [
          { kind: "grows-in", from: "p-beans", to: "plot-a" },
          { kind: "grows-in", from: "p-kale", to: "plot-b" },
          { kind: "tended-by", from: "plot-a", to: "g-ana" },
        ],
      } as never,
    });
  const ask = (text: string) => resolveAsk(garden(), text, { places: placesOf(seedbedApp), today: "2026-09-01" });

  it("'plantings sown on 31 Aug' is a date against the kind's own date", () => {
    expect(picked(ask("plantings sown on 31 Aug"))).toEqual(["p-beans"]);
    expect(moved(ask("plantings sown yesterday"))[0]).toMatchObject({ filter: "sown:after:2026-08-30,sown:before:2026-09-01" });
  });

  it("'which plots were planted this week' follows the planting's relation by its words, to the kind asked for", () => {
    const answer = ask("which plots were planted this week");
    expect(picked(answer)).toEqual(["plot-a"]);
    expect(said(answer)).toMatch(/^This week: Bed A was planted\./);
    expect(moved(answer)[0]).toMatchObject({ kind: "planting", filter: "sown:after:2026-08-30,sown:before:2026-09-07" });
  });
});

describe("sight", () => {
  const helper = defineNode("helper", { fields: z.object({ label: z.string() }), plural: "Helpers", figure: "person" });
  const slot = defineNode("slot", {
    fields: z.object({ label: z.string(), on: isoDate }),
    plural: "Slots",
    edges: { "staffed-by": { to: ["helper"], description: "who is working it", inverse: "what they work" } },
  });
  const schema = createSchema([helper, slot]);
  const policy: Policy = { grants: [{ roles: ["helper"], mutations: "*" }], sees: [{ roles: ["helper"], kinds: ["helper"], own: true }, { roles: ["helper", "lead"], kinds: ["slot"] }, { roles: ["lead"], kinds: ["helper"] }] };
  const bethan: Principal = { kind: "human", id: "helper:bethan", roles: ["helper"] };
  const store = () =>
    new Store({
      schema,
      policy,
      snapshot: {
        nodes: [
          { id: "helper:bethan", kind: "helper", label: "Bethan Okonkwo" },
          { id: "helper:freya", kind: "helper", label: "Freya Davies" },
          { id: "slot-1", kind: "slot", label: "Morning", on: "2026-09-03" },
          { id: "slot-2", kind: "slot", label: "Evening", on: "2026-09-03" },
        ] as never,
        edges: [
          { kind: "staffed-by", from: "slot-1", to: "helper:bethan" },
          { kind: "staffed-by", from: "slot-2", to: "helper:freya" },
        ],
      },
    });

  it("names only the people this seat may see", () => {
    const answer = resolveAsk(store(), "who's working thursday", { principal: bethan, today: "2026-09-01" });
    expect(picked(answer)).toEqual(["helper:bethan"]);
    expect(JSON.stringify(answer)).not.toContain("Freya");
    // Everybody, for a seat that sees everybody.
    expect(picked(resolveAsk(store(), "who's working thursday", { principal: { kind: "human", id: "lead", roles: ["lead"] }, today: "2026-09-01" }))).toEqual(["helper:bethan", "helper:freya"]);
  });
});
