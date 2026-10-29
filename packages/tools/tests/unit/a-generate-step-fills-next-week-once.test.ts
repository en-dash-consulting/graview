import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { memoryWorkflowLog, runWorkflow } from "../../src/workflows.js";

/**
 * A GENERATE STEP FILLS NEXT WEEK ONCE (Roadmap f-job-generate-from-pattern).
 * Homeflow's Sunday evening: next week's events made from the household's
 * routines, school drives and plan items, each linked back to what it came
 * from. Run twice, it makes each event once and the second run is nothing
 * new. A person's change to a made event — a drive moved half an hour —
 * stands through the next run while a change to the source (a plan item
 * renamed) reaches its event; an event a person took away is not made
 * again, and one they set aside stays aside. `overwrite: true` sets back
 * what a person changed. The first run after the workflow is added is a
 * dry run that keeps nothing and says what it would make.
 */
const document = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/homeflow-week.gdd.json", import.meta.url), "utf8"));
const SUNDAY = "2026-11-01T23:00:00Z"; // 6 PM in New York
const NEXT_SUNDAY = "2026-11-08T23:00:00Z";
const nick: Principal = { kind: "human", id: "person:nick", roles: [] };

function homeflow(change: (doc: Record<string, any>) => void = () => {}) {
  const doc = structuredClone(document);
  change(doc);
  const compiled = compileDocument(doc);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    timeZone: "America/New_York",
    snapshot: {
      nodes: [
        { id: "routine:swim", kind: "routine", name: "Swim practice", active: true, startsAt: "2026-10-06T17:00", startsAtRepeat: { every: "week", on: ["tue", "thu"], except: ["2026-11-05"] } },
        { id: "drive:school", kind: "drive", name: "School run", days: ["mon", "wed", "fri"], at: "07:30" },
        { id: "plan-item:dentist", kind: "plan-item", name: "Dentist", date: "2026-11-04" },
      ] as never,
      edges: [],
    },
  });
  const log = memoryWorkflowLog();
  const run = (now: string = SUNDAY) => runWorkflow({ app, store, workflow: "next-weeks-events", now, log, trigger: { kind: "schedule", at: now } });
  const events = () => store.graph.nodesOfKind("event", { archived: "all" }) as unknown as { id: string; name: string; startsAt: string }[];
  return { app, store, log, run, events };
}

describe("a generate step run over Homeflow's week", () => {
  it("keeps nothing the first time, and says what it would make", async () => {
    const { run, events } = homeflow();
    const first = await run();
    expect(first.dry).toBe(true);
    expect(first.made).toHaveLength(5);
    expect(events()).toEqual([]);
    expect(first.notes.join(" ")).toContain("First run after a change");
  });

  it("makes each event once, linked to its source, and the second run is nothing new", async () => {
    const { run, events, store } = homeflow();
    await run();
    const real = await run();
    expect(real.outcome).toBe("ok");
    expect(real.made).toHaveLength(5);
    expect(events().map((event) => [event.name, event.startsAt]).sort()).toEqual([
      ["Dentist", "2026-11-04T14:00:00Z"],
      ["Drive: School run", "2026-11-02T12:30:00Z"],
      ["Drive: School run", "2026-11-04T12:30:00Z"],
      ["Drive: School run", "2026-11-06T12:30:00Z"],
      ["Swim practice", "2026-11-03T17:00"],
    ]);
    expect(store.graph.out("event:wf.next-weeks-events.routine:swim:2026-11-03", "pattern").map((node) => node.id)).toEqual(["routine:swim"]);
    expect(store.graph.out("plan-item:dentist", "event").map((node) => node.id)).toEqual(["event:wf.next-weeks-events.plan-item:dentist:2026-11-04"]);
    // Every op of the run carries its run, so Activity reads it as one row.
    expect(store.log.all().filter((op) => op.lineage?.run === real.id).length).toBeGreaterThan(0);

    const again = await run();
    expect(again.outcome).toBe("nothing-new");
    expect(again.made).toEqual([]);
    expect(again.changed).toEqual([]);
    expect(events()).toHaveLength(5);
  });

  it("keeps a moved occurrence where a person moved it, and carries a source's change to its event", async () => {
    const { run, events, store } = homeflow();
    await run();
    await run();
    const wednesday = "event:wf.next-weeks-events.drive:school:2026-11-04";
    store.apply({ name: "edit-event", args: { id: wednesday, startsAt: "2026-11-04T13:00:00Z" } }, { author: nick });
    store.apply({ name: "edit-plan-item", args: { id: "plan-item:dentist", name: "Dentist (Ada)" } }, { author: nick });

    const rerun = await run();
    expect(rerun.made).toEqual([]);
    expect(rerun.changed).toEqual(["event:wf.next-weeks-events.plan-item:dentist:2026-11-04"]);
    expect(rerun.notes.join(" ")).toContain("Kept 1 change a person made");
    expect(store.graph.getNode(wednesday)).toMatchObject({ startsAt: "2026-11-04T13:00:00Z" });
    expect(store.graph.getNode("event:wf.next-weeks-events.plan-item:dentist:2026-11-04")).toMatchObject({ name: "Dentist (Ada)" });
    expect(events()).toHaveLength(5);
  });

  it("sets back what a person changed when the step says overwrite", async () => {
    const { run, store } = homeflow((doc) => {
      doc["workflows"]["next-weeks-events"]["steps"][1]["overwrite"] = true;
    });
    await run();
    await run();
    const wednesday = "event:wf.next-weeks-events.drive:school:2026-11-04";
    store.apply({ name: "edit-event", args: { id: wednesday, startsAt: "2026-11-04T13:00:00Z" } }, { author: nick });
    // The declaration changed, so this run is dry again; the next one keeps.
    await run();
    expect(store.graph.getNode(wednesday)).toMatchObject({ startsAt: "2026-11-04T12:30:00Z" });
  });

  it("does not make again what a person took away, and leaves what they set aside", async () => {
    const { run, events, store } = homeflow();
    await run();
    await run();
    store.apply({ name: "remove-event", args: { id: "event:wf.next-weeks-events.drive:school:2026-11-02" } }, { author: nick });
    store.apply({ name: "archive-event", args: { id: "event:wf.next-weeks-events.drive:school:2026-11-06" } }, { author: nick });
    const rerun = await run();
    expect(rerun.outcome).toBe("nothing-new");
    expect(rerun.notes.join(" ")).toContain("Did not make 1 record again");
    expect(rerun.notes.join(" ")).toContain("Left 1 record a person set aside");
    expect(store.graph.getNode("event:wf.next-weeks-events.drive:school:2026-11-02")).toBeUndefined();
    expect(store.graph.isArchived("event:wf.next-weeks-events.drive:school:2026-11-06")).toBe(true);
    expect(events()).toHaveLength(4);
  });

  it("makes no duplicate when a run is retried after it stopped half way", async () => {
    const { run, events, store } = homeflow();
    await run();
    // The store refuses the third change and every one after it, as a server going away would.
    const applyAll = store.applyAll.bind(store);
    let calls = 0;
    store.applyAll = ((...args: Parameters<typeof applyAll>) => {
      if (++calls > 2) throw new Error("the server went away");
      return applyAll(...args);
    }) as typeof store.applyAll;
    const broken = await run();
    expect(broken.outcome).toBe("partial");
    expect(events()).toHaveLength(2);
    store.applyAll = applyAll;
    const retried = await run();
    expect(retried.made).toHaveLength(3);
    expect(events()).toHaveLength(5);
    expect(new Set(events().map((event) => event.id)).size).toBe(5);
  });

  it("makes the week after on the next Sunday, beside this week's", async () => {
    const { run, events } = homeflow();
    await run();
    await run();
    const later = await run(NEXT_SUNDAY);
    // Swim twice (no skip that week) and the drive three times; the dentist was this week.
    expect(later.made).toHaveLength(5);
    expect(events()).toHaveLength(10);
  });
});
