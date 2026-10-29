import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import type { GraviewDocument } from "../../src/document/index.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { datesIn, generateStep, generateWants, keyedId, windowDays, workflowWords, type GenerateStep } from "../../src/workflows.js";

/**
 * A GENERATE STEP WANTS EACH DAY OF ITS WINDOW ONCE (Roadmap
 * f-job-generate-from-pattern). Homeflow's Sunday evening: next week's
 * events from the household's routines (a date that repeats, one day of
 * it skipped), its school drives (a set of weekdays and a time) and its
 * plan items (one day each). Each source's days in the window are worked
 * out — a skipped day is not among them, a series that is not active
 * gives none, a plan item next month gives none — and each wanted record
 * has a key and the id the key gives it, so the same day is the same
 * record whichever run asks. Across the end of daylight saving time a wall
 * time stays on the wall and a drive's time of day is read on the app's
 * clock. Every name a step says is held to the declaration.
 */
const fixture = (): GraviewDocument => JSON.parse(readFileSync(new URL("../document/fixtures/homeflow-week.gdd.json", import.meta.url), "utf8"));

const SUNDAY_EVENING = Date.parse("2026-11-01T23:00:00Z"); // 6 PM in New York, the day the clocks went back

function homeflow(document: GraviewDocument = fixture()) {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    timeZone: "America/New_York",
    snapshot: {
      nodes: [
        // Tuesdays and Thursdays at five; Thursday the 5th skipped.
        { id: "routine:swim", kind: "routine", name: "Swim practice", active: true, startsAt: "2026-10-06T17:00", startsAtRepeat: { every: "week", on: ["tue", "thu"], except: ["2026-11-05"] } },
        { id: "routine:piano", kind: "routine", name: "Piano", active: false, startsAt: "2026-09-07T16:00", startsAtRepeat: { every: "week", on: ["mon"] } },
        { id: "drive:school", kind: "drive", name: "School run", days: ["mon", "wed", "fri"], at: "07:30" },
        { id: "plan-item:dentist", kind: "plan-item", name: "Dentist", date: "2026-11-04" },
        { id: "plan-item:recital", kind: "plan-item", name: "Recital", date: "2026-11-20" },
      ] as never,
      edges: [],
    },
  });
  return { app, store, steps: (document.workflows!["next-weeks-events"] as unknown as { steps: GenerateStep[] }).steps };
}

const wantsOf = (step: GenerateStep, store: Store<AnySchema>) => generateWants(step, { graph: store.graph, schema: store.schema, workflow: "next-weeks-events", now: SUNDAY_EVENING, timeZone: "America/New_York" });

describe("a generate step's days", () => {
  it("are next week's, Monday to Sunday, on a Sunday evening in the app's zone", () => {
    expect(windowDays("next week", { today: "2026-11-01", zone: "America/New_York" })).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(windowDays("this week", { today: "2026-11-01", zone: "America/New_York" })).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(windowDays("next 7 days", { today: "2026-11-01", zone: "America/New_York" })).toEqual({ from: "2026-11-01", to: "2026-11-07" });
    expect(windowDays("tomorrow", { today: "2026-11-01", zone: "America/New_York" })).toEqual({ from: "2026-11-02", to: "2026-11-02" });
  });

  it("fall where a series, a set of weekdays and a one-off date say, and a skipped day is not among them", () => {
    const week = { from: "2026-11-02", to: "2026-11-08" };
    expect(datesIn({ startsAt: "2026-10-06T17:00", startsAtRepeat: { every: "week", on: ["tue", "thu"], except: ["2026-11-05"] } }, "startsAt", week, "America/New_York")).toEqual(["2026-11-03T17:00"]);
    expect(datesIn({ days: ["fri", "mon", "wed"] }, "days", week, "UTC")).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
    expect(datesIn({ date: "2026-11-04" }, "date", week, "UTC")).toEqual(["2026-11-04"]);
    expect(datesIn({ date: "2026-11-20" }, "date", week, "UTC")).toEqual([]);
    expect(datesIn({ date: null }, "date", week, "UTC")).toEqual([]);
  });
});

describe("what Homeflow's Sunday run wants", () => {
  it("is one event per routine day, drive day and plan item in next week, each under the id its key gives", () => {
    const { store, steps } = homeflow();
    const [routines, drives, plans] = steps.map((step) => wantsOf(step, store));
    expect(routines!.wanted.map((one) => [one.key, one.values])).toEqual([["routine:swim:2026-11-03", { name: "Swim practice", startsAt: "2026-11-03T17:00" }]]);
    expect(drives!.wanted.map((one) => one.key)).toEqual(["drive:school:2026-11-02", "drive:school:2026-11-04", "drive:school:2026-11-06"]);
    // 7:30 on the New York wall, after the clocks went back: 12:30 UTC.
    expect(drives!.wanted[0]!.values).toEqual({ name: "Drive: School run", startsAt: "2026-11-02T12:30:00Z" });
    expect(plans!.wanted.map((one) => [one.key, one.values["startsAt"]])).toEqual([["plan-item:dentist:2026-11-04", "2026-11-04T14:00:00Z"]]);
    expect(routines!.wanted[0]!.id).toBe(keyedId("event", "next-weeks-events", "routine:swim:2026-11-03"));
    expect(routines!.wanted[0]!.id).toBe("event:wf.next-weeks-events.routine:swim:2026-11-03");
    expect([...routines!.problems, ...drives!.problems, ...plans!.problems]).toEqual([]);
  });

  it("is the same, record for record, however often it is asked", () => {
    const { store, steps } = homeflow();
    expect(wantsOf(steps[1]!, store)).toEqual(wantsOf(steps[1]!, store));
  });

  it("is said in one line beside the workflow's words", () => {
    const { app, steps } = homeflow();
    expect(generateStep.words(steps[0]!)).toBe("Make an event for each day next week a routine where active falls on");
    expect(workflowWords({ name: "next-weeks-events", ...app.workflows!["next-weeks-events"]! } as never)).toContain("next week's events");
  });
});

/** The fixture with its first step changed, and what the checker says of it. */
function codesFor(change: (step: Record<string, unknown>, document: Record<string, any>) => Record<string, unknown>): string[] {
  const document = fixture() as unknown as Record<string, any>;
  const workflow = document["workflows"]["next-weeks-events"];
  workflow.steps[0] = change({ ...workflow.steps[0] }, document);
  const compiled = compileDocument(document as GraviewDocument);
  return compiled.findings.filter((finding) => finding.path.startsWith("workflows.")).map((finding) => finding.code);
}

describe("what the checker says of a generate step", () => {
  it("says nothing of Homeflow's", () => {
    expect(codesFor((step) => step)).toEqual([]);
  });

  it.each([
    ["a kind it makes that is not one", "workflow-kind-unknown", (step: Record<string, unknown>) => ({ ...step, generate: "evnt" })],
    ["a kind it reads that is not one", "workflow-kind-unknown", (step: Record<string, unknown>) => ({ ...step, from: [{ kind: "routin", dates: "startsAt" }] })],
    ["a date field the source lacks", "workflow-generate-dates-unknown", (step: Record<string, unknown>) => ({ ...step, from: [{ kind: "routine", dates: "when" }] })],
    ["a where that reads what is not there", "workflow-where-invalid", (step: Record<string, unknown>) => ({ ...step, from: [{ kind: "routine", where: "actve", dates: "startsAt" }] })],
    ["a window it cannot read", "workflow-generate-window-invalid", (step: Record<string, unknown>) => ({ ...step, window: "fortnight" })],
    ["a window expression that reads a record", "workflow-generate-window-invalid", (step: Record<string, unknown>) => ({ ...step, window: { from: "today()", to: "startsAt" } })],
    ["a field the made kind lacks", "workflow-generate-set-unknown", (step: Record<string, unknown>) => ({ ...step, set: { title: { expr: "name" } } })],
    ["a $ name it does not give", "workflow-generate-value-invalid", (step: Record<string, unknown>) => ({ ...step, set: { startsAt: "$day" } })],
    ["an expression reading what the source lacks", "workflow-generate-value-invalid", (step: Record<string, unknown>) => ({ ...step, set: { name: { expr: "nam" } } })],
    ["a relation nobody declares", "workflow-generate-link-unknown", (step: Record<string, unknown>) => ({ ...step, link: "made-from" })],
    ["a key reading what the source lacks", "workflow-key-field-unknown", (step: Record<string, unknown>) => ({ ...step, key: "{source}:{nope}" })],
    ["an act that is not one", "workflow-act-unknown", (step: Record<string, unknown>) => ({ ...step, using: "add-evnt" })],
    ["an act that makes another kind", "workflow-generate-act-makes-other", (step: Record<string, unknown>) => ({ ...step, using: "add-drive" })],
  ])("refuses %s (%s)", (_said, code, change) => {
    expect(codesFor(change)).toContain(code);
  });

  it("refuses a kind no act makes (workflow-generate-no-act)", () => {
    expect(
      codesFor((step, document) => {
        delete document["acts"]["add-event"];
        return step;
      }),
    ).toContain("workflow-generate-no-act");
  });

  it("asks which act when two make the kind, and writes the edit that names one (workflow-generate-act-ambiguous)", () => {
    const document = fixture() as unknown as Record<string, any>;
    document["acts"]["plan-event"] = { title: "Plan an event", description: "One thing on the calendar, planned.", creates: "event" };
    const compiled = compileDocument(document as GraviewDocument);
    const finding = compiled.findings.find((one) => one.code === "workflow-generate-act-ambiguous");
    expect(finding?.path).toBe("workflows.next-weeks-events.steps.0.using");
    expect(JSON.stringify(finding?.edits)).toContain('"using":"add-event"');
  });
});
