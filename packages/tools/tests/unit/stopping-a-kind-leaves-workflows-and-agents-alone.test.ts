import { readFileSync } from "node:fs";
import { Store, type AnySchema, type Author, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declined, stopSuggesting, stoppedKind, suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { dream } from "../../src/tidy/dream.js";
import { memoryWorkflowLog, runWorkflow } from "../../src/workflows.js";

/**
 * STOPPING A KIND IS SAID TO THE APP'S OWN TIDYING ACTOR, AND NOBODY ELSE.
 * A person who presses "Don't suggest this kind of thing" asked the actor to
 * stop suggesting; they did not turn off their own workflow, or a chat agent.
 */
const document = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/homeflow-week.gdd.json", import.meta.url), "utf8"));
const SUNDAY = "2026-11-01T23:00:00Z";
const nick: Principal = { kind: "human", id: "person:nick", roles: [] };
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const chat: Principal = { kind: "agent", id: "chat", name: "Claude" };

function homeflow() {
  const compiled = compileDocument(structuredClone(document));
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
  const run = () => runWorkflow({ app, store, workflow: "next-weeks-events", now: SUNDAY, log, trigger: { kind: "schedule", at: SUNDAY } });
  return { app, store, run };
}

/** An add-event call no workflow would ask for: the same kind of thing, about nothing it makes. */
const anEvent = (name: string) => ({ name: "add-event", args: { name, startsAt: "2030-01-01T09:00" } });

describe("after a person stops the actor suggesting a kind of thing", () => {
  it("their own workflow still makes that kind", async () => {
    const { store, run } = homeflow();
    const wanted = (await run()).made.length;
    expect(wanted).toBeGreaterThan(0);
    stopSuggesting(store, suggest(store, [anEvent("Ice cream")], { author: actor, lineage: { basis: "People like it" } })!.id, { author: nick });
    const real = await run();
    expect(real.outcome).toBe("ok");
    expect(real.made).toHaveLength(wanted);
  });

  it("is no decline of that kind for an approval workflow to drop", () => {
    const { store } = homeflow();
    stopSuggesting(store, suggest(store, [anEvent("Ice cream")], { author: actor, lineage: { basis: "People like it" } })!.id, { author: nick });
    // What `workflows/ask.ts` asks before it drops a change: a change a person declined, not one of a kind they stopped the actor suggesting.
    expect(declined(store, [anEvent("Swim")])).toBeUndefined();
    expect(stoppedKind(store, [anEvent("Swim")])).toBeDefined();
  });

  it("a chat agent may still suggest that kind", () => {
    const { store } = homeflow();
    stopSuggesting(store, suggest(store, [anEvent("Ice cream")], { author: actor, lineage: { basis: "People like it" } })!.id, { author: nick });
    expect(suggest(store, [anEvent("Swim")], { author: chat, lineage: { basis: "You asked" } })).toBeDefined();
    expect(suggestions(store).map((one) => one.author.id)).toEqual(["chat"]);
  });

  it("the app's own actor may not, and a workflow's own suggestion stays in the tray", () => {
    const { store } = homeflow();
    const workflow: Author = { kind: "system", id: "workflow:next-weeks-events", name: "Next week's events", automated: true };
    const asked = suggest(store, [anEvent("Asked by a workflow")], { author: workflow, lineage: { basis: "Its run" } })!;
    stopSuggesting(store, suggest(store, [anEvent("Ice cream")], { author: actor, lineage: { basis: "People like it" } })!.id, { author: nick });
    expect(() => suggest(store, [anEvent("Swim")], { author: actor, lineage: { basis: "People like it" } })).toThrow(/this kind of thing/);
    expect(suggestions(store).map((one) => one.id)).toEqual([asked.id]);
  });

  it("is not offered of a suggestion that is not the actor's: stopping it would hold nobody", () => {
    const { store } = homeflow();
    const fromChat = suggest(store, [anEvent("Swim")], { author: chat, lineage: { basis: "You asked" } })!;
    expect(() => stopSuggesting(store, fromChat.id, { author: nick })).toThrow(/the app's own actor/);
  });

  it("dream leaves out what a person stopped", async () => {
    const { store } = homeflow();
    stopSuggesting(store, suggest(store, [anEvent("Ice cream")], { author: actor, lineage: { basis: "People like it" } })!.id, { author: nick });
    const report = await dream(store, { judges: [{ name: "wants-an-event", judge: () => [{ judge: "wants-an-event", calls: [anEvent("Swim")], basis: "Often", confidence: 0.5, about: [] }] }] });
    expect(suggestions(store)).toEqual([]);
    expect(JSON.stringify(report)).toContain('"stopped"');
  });
});
