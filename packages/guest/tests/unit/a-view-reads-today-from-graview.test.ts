import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { fromToday } from "../../src/from-today.js";
import { runWorkerViewHeadless, type HeadlessResult } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";

/*
 * A VIEW READS TODAY FROM GRAVIEW (Roadmap f-views-know-today). A chat's
 * home view held `TODAY = "2026-11-01"` and "Tomorrow · Mon 2 Nov"; records
 * were added the next day and it went on drawing the day before, and the
 * description of the place said each row's title two or three times, so a
 * correct drawing read as a broken one. Now a view is handed the app's
 * today and says a day against it in the framework's words; a run says a
 * view that pins one; and a row's title is said once.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the LifeLogics fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));
const TODAY = "2026-11-02";
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed, invariantOptions: { today: TODAY } });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const home: WorkerViewManifest = { name: "front", title: "The front", attach: "home", cardinality: "many", reads: { kinds: ["offer"] } };
const run = (source: string) => runWorkerViewHeadless({ store: store(), principal: owner, run: nodeIsolate(), manifest: home, source });
const described = (result: HeadlessResult) => {
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result.description;
};

describe("today, as a view is handed it", () => {
  it("is the app's today on every push, the day its rules read", () => {
    expect(workerViewProps(store(), owner, { manifest: home }).today).toBe(TODAY);
  });

  it("is said against a day in the words a record's page says it, and a due day gone by is overdue", () => {
    expect(["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-01", "2026-10-30", "2026-11-23"].map((day) => fromToday(day, TODAY))).toEqual(["today", "tomorrow", "in 3 days", "yesterday", "3 days ago", "in 3 weeks"]);
    expect(fromToday("2026-10-30", TODAY, { due: true })).toBe("overdue");
  });

  it("draws the right relative day in a view that reads it from graview", async () => {
    const source = `graview.onProps(() => graview.render(graview.html\`<p id="when">\${graview.today} · \${graview.fromToday("2026-11-02")} · \${graview.fromToday("2026-11-05T15:00:00Z")} · \${graview.fromToday("2026-10-31", { due: true })}</p>\`));`;
    const description = described(await run(source));
    expect(description.text).toContain("2026-11-02 · today · in 3 days · overdue");
    expect(description.problems).toEqual([]);
  });
});

describe("a view that pins today", () => {
  it("is said among the run's problems, against the app's today", async () => {
    const source = `const TODAY = "2026-11-01";\ngraview.onProps(() => graview.render(graview.html\`<h2>Tomorrow · Mon 2 Nov</h2><p>Report due Fri 30 Oct</p>\`));`;
    const problems = described(await run(source)).problems;
    expect(problems.map((one) => one.says)).toEqual([
      "Home may be out of date: it says “TODAY = \"2026-11-01\"” and today is Mon, Nov 2. Read today from graview instead.",
      "Home may be out of date: it says “Tomorrow · Mon 2 Nov” and today is Mon, Nov 2. Read today from graview instead.",
      "Home may be out of date: it says “due Fri 30 Oct” and today is Mon, Nov 2. Read today from graview instead.",
    ]);
  });
});

describe("a row's title in a place's description", () => {
  it("is said once, not again through its first line, its owner and a button to it", async () => {
    const source = `graview.onProps((props) => graview.render(graview.html\`<ul>\${props.nodes.filter((n) => n.kind === "offer").slice(0, 2).map((offer) => graview.html\`<li><span>\${offer.label}</span> <span>Ann · \${offer.label}</span> <button data-record="\${offer.id}">Open \${offer.label}</button></li>\`)}</ul>\`));`;
    const text = described(await run(source)).text;
    expect(text.split("\n").slice(1, 4)).toEqual(["- Two-day workshop", "  Ann", "  Open"]);
    expect(text.match(/Two-day workshop/g)).toHaveLength(1);
  });
});
