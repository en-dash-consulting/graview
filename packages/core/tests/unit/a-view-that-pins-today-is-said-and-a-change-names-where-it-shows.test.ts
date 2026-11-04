import { describe, expect, it } from "vitest";
import { createSchema, defineApp, defineNode, z } from "../../src/index.js";
import { datesPinned, placesTouched } from "../../src/revisions.js";

/*
 * A VIEW THAT PINS TODAY IS SAID, AND A CHANGE NAMES WHERE IT SHOWS (Roadmap
 * f-views-know-today). A chat added records to a Cloud app with act_batch,
 * every act succeeded, and the home went on drawing the day before: its view
 * held `TODAY = "2026-11-01"`, "Tomorrow · Mon 2 Nov" and "due Fri 30 Oct".
 * Nothing told the agent, so it said it was done. Now the source is read for
 * what pins a day, and a commit's ops name the places that draw what it
 * touched, with the view to look at.
 */
const FROZEN_HOME = `
const TODAY = "2026-11-01";
graview.onProps((props) => graview.render(graview.html\`
  <h2>Tomorrow · Mon 2 Nov</h2>
  <p>Report due Fri 30 Oct</p>
  <p>Founded 12 March 2019</p>
  <ul>\${props.nodes.map((task) => graview.html\`<li>\${task.label}</li>\`)}</ul>\`));
`;

const READS_TODAY = `
graview.onProps((props) => graview.render(graview.html\`
  <h2>\${graview.fromToday(graview.today)}</h2>
  <ul>\${props.nodes.map((task) => graview.html\`<li>\${task.label} · \${graview.fromToday(task.due, { due: true })}</li>\`)}</ul>\`));
`;

describe("what a view's source pins a day to", () => {
  it("says a date given to a name that means today, day words beside a written date, and a date gone by, against today", () => {
    const pinned = datesPinned(FROZEN_HOME, { today: "2026-11-02", title: "Home", locale: "en-US" });
    expect(pinned.map(({ phrase, why }) => [phrase, why])).toEqual([
      ['TODAY = "2026-11-01"', "today"],
      ["Tomorrow · Mon 2 Nov", "day-words"],
      ["due Fri 30 Oct", "past"],
    ]);
    expect(pinned[1]!.says).toBe("Home may be out of date: it says “Tomorrow · Mon 2 Nov” and today is Mon, Nov 2. Read today from graview instead.");
    expect(pinned[0]!.at).toBe("source line 2");
  });

  it("says nothing of a view that reads today from graview, or of a date long past", () => {
    expect(datesPinned(READS_TODAY, { today: "2026-11-02" })).toEqual([]);
    expect(datesPinned(`graview.render("Founded 12 March 2019, launched 2024-05-01");`, { today: "2026-11-02" })).toEqual([]);
  });
});

const task = defineNode("task", { fields: z.object({ name: z.string(), due: z.string().optional() }), plural: "Tasks", label: (node) => node.name });
const person = defineNode("person", { fields: z.object({ name: z.string() }), plural: "People", label: (node) => node.name });
const note = defineNode("note", { fields: z.object({ text: z.string() }), plural: "Notes", label: (node) => node.text });
const app = defineApp({ name: "Week", schema: createSchema([task, person, note]), mutations: [] });
const added = { primitives: [{ op: "add-node" as const, node: { id: "t9", kind: "task", name: "Book the van" } as never }] };
const front = { name: "front", title: "Home", attach: "home", cardinality: "many" as const, reads: { kinds: ["task"] }, source: FROZEN_HOME };

describe("the places a change touches", () => {
  it("names the home and the list that draw a record it made, and the view to look at with the dates it pins", () => {
    const touched = placesTouched(app, [added], { views: [front], today: "2026-11-02", locale: "en-US" });
    expect(touched.kinds).toEqual(["task"]);
    expect(touched.places.map((place) => [place.title, place.view ?? null])).toEqual([
      ["Home", "front"],
      ["Tasks", null],
    ]);
    expect(touched.places[0]!.pinned?.map((one) => one.phrase)).toEqual(['TODAY = "2026-11-01"', "Tomorrow · Mon 2 Nov", "due Fri 30 Oct"]);
    expect(touched.text).toMatch(/^These appear on Home and Tasks\. Home is drawn by a view \(front\) that writes its own dates: look at it after this change\. Home may be out of date: it says “TODAY = "2026-11-01"”/);
  });

  it("reads a changed field's and a link's kinds by id, and leaves out a place that draws none of them", () => {
    const kindOf = (id: string) => ({ t1: "task", p1: "person" })[id];
    const changed = { primitives: [{ op: "patch-node" as const, id: "p1", before: { name: "Al" }, after: { name: "Alan" } }] };
    const touched = placesTouched(app, [changed], { views: [front], kindOf });
    expect(touched.places.map((place) => place.title)).toEqual(["People"]);
    const linked = placesTouched(app, [{ primitives: [{ op: "add-edge" as const, edge: { kind: "owns", from: "p1", to: "t1" } }] }], { kindOf });
    expect(linked.places.map((place) => place.title)).toEqual(["Home", "Tasks", "People"]);
  });
});
