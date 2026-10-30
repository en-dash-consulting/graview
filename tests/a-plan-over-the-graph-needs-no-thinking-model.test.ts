import type { AnySchema, Principal, Store } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { createTodoUiStore } from "../apps/todo/src/ui/app.js";
import { askedParts, asking, decideOverTheGraph, explicitReading, givingOf, narrowingOf, politely, renameOf } from "../packages/tools/src/graph-plan.js";
import { sayChange } from "../packages/tools/src/say-change.js";
import { answerHere } from "../packages/tools/src/inline-ai.js";
import { forThePerson } from "../packages/tools/src/sentences.js";
import type { FastProvider, ThinkingProvider } from "../packages/tools/src/ai.js";
import type { Answer, Decide } from "../packages/tools/src/fast.js";
import { todoApp } from "../apps/todo/src/domain/app.js";
import { planFor, type AppPlan } from "../packages/primitives/src/quick-ask-plan.js";

/**
 * A PLAN OVER THE GRAPH NEEDS NO THINKING MODEL (Roadmap f-menu-type-anything).
 * "Assign all these to Sam" on the todo example's This week list: the Fast
 * slot decides, in one typed call, that "these" are the tasks the list holds
 * (allTheseOnAListMeansTheRecordsInIt), that no act can assign them, that
 * Sam is a user the app has, and that each task would need a link to a
 * person — and code says what the app lacks. The Thinking slot is not asked.
 */
const nora: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const store = () => createTodoUiStore("2026-09-01") as unknown as Store<AnySchema>;

/** A Fast slot that reads as Jev would: "these" the held records, no act for assigning, Sam by name, a link to a person — sure of each. */
const reading = (misread = false): FastProvider & { asked: string[] } => {
  const asked: string[] = [];
  const decide: Decide = async (state, questions) => {
    const said = String((state as { said?: string }).said ?? "");
    const answers: Record<string, Answer> = {};
    for (const [key, question] of Object.entries(questions)) {
      if (question.type !== "choice") continue;
      asked.push(key);
      const names = Object.keys(question.criteria);
      const sure = (choice: string, chance = 0.92): Answer => ({ type: "choice", choice, confidence: chance, probabilities: Object.fromEntries(names.map((name) => [name, name === choice ? chance : (1 - chance) / Math.max(1, names.length - 1)])) });
      if (key === "reading") answers[key] = misread && !/tasks/.test(said) ? sure("itself", 0.55) : sure(/\b(these|all|them|each|everything|tasks)\b/i.test(said) ? "held" : "itself");
      else if (key === "act") answers[key] = sure("none");
      else if (key === "person") answers[key] = sure(names.find((name) => /sam/i.test(String(question.criteria[name]))) ?? "none");
      else if (key === "need") answers[key] = sure("person");
    }
    return { answers, usage: { inputTokens: 40, outputTokens: 0 } };
  };
  return { model: "jev-latest", decide, asked };
};
const never: ThinkingProvider = { model: "never", think: vi.fn(async () => ({ text: "{}" })) };

describe("a plan over the graph", () => {
  it("reads “all these” on a list as the tasks it holds, and “this list” as the list itself (allTheseOnAListMeansTheRecordsInIt)", async () => {
    const kept = store();
    const held = kept.graph.out("week", "holds").map((node) => node.id);
    const these = await decideOverTheGraph(reading(), { store: kept, target: { on: "record", id: "week" }, said: "assign all these to Sam" });
    expect(these.reading).toMatchObject({ which: "held", kind: "task", records: held, words: `the ${held.length} tasks in This week`, close: false });
    const itself = await decideOverTheGraph(reading(), { store: kept, target: { on: "record", id: "week" }, said: "rename this list to Sam" });
    expect(itself.reading).toMatchObject({ which: "itself", kind: "list", records: ["week"] });
  });

  it("says what the app lacks for the tasks, with the person by name, and asks no Thinking slot (aPlanOverTheGraphNeedsNoThinkingModel)", async () => {
    const fast = reading();
    const result = await answerHere({ fast, thinking: never }, { store: store(), target: { on: "record", id: "week" }, principal: nora, said: "assign all these to Sam" });
    expect(never.think).not.toHaveBeenCalled();
    expect(result.missing).toEqual({ said: "Tasks have no one assigned to them.", need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Sam" });
    expect(result.reading?.which).toBe("held");
    expect(result.interaction.stages?.map((stage) => stage.stage)).toEqual(["fast"]);
    expect(result.interaction.stages?.[0]).toMatchObject({ model: "jev-latest" });
  });

  it("says a close reading, so a reply can flip it — and a reply that names the tasks reads them (aReplyRevisesThePlanOnTheCard)", async () => {
    const fast = reading(true);
    const first = await answerHere({ fast, thinking: never }, { store: store(), target: { on: "record", id: "week" }, principal: nora, said: "assign all these to Sam" });
    expect(first.reading).toMatchObject({ which: "itself", close: true });
    expect(first.missing?.need).toEqual({ link: { on: "list", called: "assigned to", to: "person" } });
    const reply = await answerHere({ fast, thinking: never }, { store: store(), target: { on: "record", id: "week" }, principal: nora, said: "no, not lists.. i want to assign the tasks in this list to sam", follows: { said: "assign all these to Sam", answer: first.answer!, reading: "itself" } });
    expect(reply.reading).toMatchObject({ which: "held", kind: "task" });
    expect(reply.missing).toMatchObject({ need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Sam" });
    expect(never.think).not.toHaveBeenCalled();
  });

  it("revises on a reply that narrows to the open ones, or names the field", async () => {
    const kept = store();
    const open = kept.graph.out("week", "holds").filter((node) => (node as Record<string, unknown>)["done"] !== true).map((node) => node.id);
    const follows = { said: "assign all these to Sam", answer: "Tasks have no one assigned to them.", reading: "held" as const };
    const narrowed = await decideOverTheGraph(reading(), { store: kept, target: { on: "record", id: "week" }, said: "only the open ones", follows });
    expect(narrowed.reading).toMatchObject({ which: "held", records: open, words: `the ${open.length} open tasks in This week` });
    const owner = await decideOverTheGraph(reading(), { store: kept, target: { on: "record", id: "week" }, said: "call it owner", follows });
    expect(owner.missing).toEqual({ said: "Tasks have no owner.", need: { link: { on: "task", called: "owner", to: "person" } }, who: "Sam" });
  });

  it("retargets a plan given the list itself to the tasks it holds, in code, rather than refusing it in words (aReplyRevisesThePlanOnTheCard)", async () => {
    const kept = store();
    const held = kept.graph.out("week", "holds").length;
    const env = { store: kept, principal: nora, app: todoApp, ai: { name: "fake" }, places: [], selection: [] } as never;
    const plan = (await planFor(env, { said: "assign all these to Sam", missing: { said: "Tasks have no one assigned to them.", need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Sam" }, members: ["week"], host: false, where: "This week" })) as AppPlan;
    expect(plan.parts.at(-1)?.said).toBe(`Assign Sam to the ${held} tasks in This week.`);
    expect(JSON.stringify(plan)).not.toMatch(/acts on|not on a list/);
  });

  it("takes “me” as the person at the seat, and “her” as the one the turn before named — and says whom it took", async () => {
    const mine = await decideOverTheGraph(reading(), { store: store(), target: { on: "record", id: "week" }, said: "assign these to me", principal: { id: "user-nora" } });
    expect(mine.missing).toMatchObject({ need: { link: { on: "task", to: "person" } }, who: "Nora" });
    const hers = await decideOverTheGraph(reading(), { store: store(), target: { on: "record", id: "t-book" }, said: "give this to her", follows: { said: "what does Nora have on this week?" } });
    expect(hers.taken).toEqual({ said: "her", as: "Nora" });
    expect(hers.missing).toMatchObject({ who: "Nora" });
  });

  it("never lets a model's note reach the card: a fragment is said plainly (theCardNeverShowsThePipelinesOwnNotes)", async () => {
    const noting: ThinkingProvider = { model: "noting", think: async () => ({ text: JSON.stringify({ answer: "", lacks: "a way to close or archive tasks" }) }) };
    const result = await answerHere({ fast: reading(), thinking: noting }, { store: store(), target: { on: "record", id: "week" }, principal: nora, said: "frobnicate these" });
    expect(result.answer).toBe("I couldn't work out how to do that — try saying it another way.");
    expect(forThePerson("a way to close or archive tasks")).toBe(false);
    expect(forThePerson("Tasks have no one assigned to them.")).toBe(true);
  });

  it("reads polite and indirect instructions as instructions, two asks as two parts, a person named without “to”, and a rename said as a statement", () => {
    for (const said of ["could you close these for me", "please mark this done", "i'd like these archived", "can we push this to monday", "these should be marked done", "Sam should take care of these"]) {
      expect(politely(said), said).toBe(true);
      expect(asking(said), said).toBe(false);
    }
    for (const said of ["could you tell me what is due?", "what is left?", "is this late?"]) expect(asking(said), said).toBe(true);
    expect(askedParts("archive the done ones, then close the open ones")).toEqual(["archive the done ones", "close the open ones"]);
    expect(askedParts("close this and move it to someday")).toEqual(["close this", "move it to someday"]);
    expect(askedParts("assign these to Sam and Nora")).toEqual(["assign these to Sam and Nora"]);
    expect(askedParts("rename it to Pack and Go")).toEqual(["rename it to Pack and Go"]);
    expect(givingOf("Nora should handle these")).toMatchObject({ called: "assigned to", who: "Nora" });
    expect(givingOf("make these Sam's responsibility")).toMatchObject({ who: "Sam" });
    expect(givingOf("this is Nora's now")).toMatchObject({ who: "Nora" });
    expect(renameOf("the name should be Packing week")).toBe("Packing week");
    expect(renameOf("call it Boxes")).toBe("Boxes");
    expect(renameOf("rename this list to Packing week")).toBe("Packing week");
    expect(renameOf("Moving days is a better name")).toBe("Moving days");
    expect(renameOf("move it to someday")).toBeUndefined();
  });

  it("narrows by done or open however it is said, and a destructive act over several needs a clear reading (aDestructiveActOverSeveralNeedsAClearReading)", () => {
    for (const said of ["drop the ones I've done", "archive the completed tasks", "clear out the finished stuff", "delete the done one"]) expect(narrowingOf(said), said).toEqual({ open: false, finished: true });
    for (const said of ["close the outstanding ones", "finish the remaining tasks", "mark everything still to do as done", "the unfinished ones"]) expect(narrowingOf(said), said).toEqual({ open: true, finished: false });
    expect(narrowingOf("open this")).toEqual({ open: false, finished: false });
    expect(explicitReading("delete the old ones")).toBe(false);
    expect(explicitReading("archive the stuff here")).toBe(false);
    expect(explicitReading("drop all of these")).toBe(true);
    expect(explicitReading("drop the ones I've done")).toBe(true);
  });

  it("says what will happen with its values and its exact count (theCardSaysWhatWillHappenWithItsValues)", () => {
    const kept = store();
    const act = (name: string) => kept.allMutations().find((one) => one.name === name)! as never;
    const open = ["t-notice", "t-meter", "t-post", "t-broadband", "t-keys"];
    expect(sayChange(kept, { act: act("finish"), args: {}, records: open, narrowed: "open", where: "in This week" })).toBe("Mark the 5 open tasks in This week done.");
    expect(sayChange(kept, { act: act("drop"), args: {}, records: ["t-boxes"], narrowed: "done", where: "in This week" })).toBe("Drop the 1 done task in This week.");
    expect(sayChange(kept, { act: act("rename"), args: { label: "Return the keys" }, records: ["t-keys"], itself: true })).toBe("Rename Hand back the keys to “Return the keys”.");
    expect(sayChange(kept, { act: act("move-to-list"), args: { listId: "today" }, records: ["t-book"], itself: true })).toBe("Move Book the van to Today.");
    expect(sayChange(kept, { act: act("reschedule"), args: { due: "2026-09-07" }, records: ["t-book"], itself: true })).toBe("Move the date of Book the van to Monday, Sep 7.");
  });

  it("reads the giving the words say, and to whom", () => {
    expect(givingOf("assign all these to Sam")).toEqual({ called: "assigned to", who: "Sam" });
    expect(givingOf("no, not lists.. i want to assign the tasks in this list to sam")).toEqual({ called: "assigned to", who: "Sam" });
    expect(givingOf("what is left to do?")).toBeUndefined();
  });
});
