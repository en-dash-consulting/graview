import { describe, expect, it } from "vitest";
import { act, answer, BAR, jev, runEval, says, tasksIn, outOf, inOf, number, xai, type Case } from "./menu-eval/judge.js";

/*
 * THE MENU UNDERSTANDS WHAT PEOPLE SAY (Roadmap f-menu-type-anything), a
 * live eval. Opt-in: it runs only where TYPESAFE_API_KEY (or JEV_API_KEY)
 * and XAI_API_KEY are set. Each line is a thing a person types in the
 * right-click menu, on a card, a list or a place of the todo example, the
 * rota or the discography, and what should come of it: one act over which
 * records, a plan for what the app lacks, or an answer in words. It writes
 * the table to docs/menu-eval.json and fails under the bar (90%).
 */
const CASES: readonly Case[] = [
  /* Done, said every way people say it. */
  { app: "todo", on: "week", said: "close all tasks in this list", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "mark these done", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "finish everything this week", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "tick off the done ones", expect: answer },
  { app: "todo", on: "week", said: "complete all of them", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "check these off", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "mark all as done", expect: act("finish", "held") },
  { app: "todo", on: "today", said: "mark everything done", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "clsoe all of them", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "mrk these done", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "finish the open ones", expect: act("finish", "open") },
  { app: "todo", on: "t-book", said: "close this", expect: act("finish", "itself") },
  { app: "todo", on: "t-book", said: "mark this done", expect: act("finish", "itself") },
  { app: "todo", on: "t-book", said: "finsh this one", expect: act("finish", "itself") },
  { app: "todo", on: "t-book", said: "done", expect: act("finish", "itself") },
  /* Back again. */
  { app: "todo", on: "t-quote", said: "put this back", expect: act("reopen", "itself") },
  { app: "todo", on: "t-quote", said: "reopen this", expect: act("reopen", "itself") },
  { app: "todo", on: "today", said: "reopen the done ones", expect: act("reopen", "done") },
  /* When, and where. */
  { app: "todo", on: "week", said: "move these to today", expect: act(["move-to-list", "reschedule"], "held") },
  { app: "todo", on: "week", said: "push these to tomorrow", expect: act("reschedule", "held") },
  { app: "todo", on: "t-book", said: "move this to next week", expect: act(["reschedule", "move-to-list"], "itself") },
  { app: "todo", on: "t-book", said: "move this to someday", expect: act("move-to-list", "itself") },
  { app: "todo", on: "t-book", said: "change the due date to friday", expect: act("reschedule", "itself") },
  { app: "todo", on: "t-book", said: "push it back a day", expect: act("reschedule", "itself") },
  /* Gone, or set aside. */
  { app: "todo", on: "week", said: "delete the finished ones", expect: act(["drop", "remove-task"], "done") },
  { app: "todo", on: "t-book", said: "delete this", expect: act(["drop", "remove-task"], "itself") },
  { app: "todo", on: "week", said: "drop all of these", expect: act(["drop", "remove-task"], "held") },
  { app: "todo", on: "week", said: "archive this", expect: act("archive-list", "itself") },
  { app: "todo", on: "week", said: "archive these", expect: act("archive-task", "held") },
  /* Names. */
  { app: "todo", on: "week", said: "rename this to Packing", expect: act("rename", "itself") },
  { app: "todo", on: "t-book", said: "rename this task to Book the big van", expect: act("rename", "itself") },
  { app: "todo", on: "t-deposit", said: "this has to wait for Book the van", expect: act("wait-for", "itself") },
  /* Questions. */
  { app: "todo", on: "today", said: "what's overdue?", expect: says((store, on) => ({ says: tasksIn(store, on).filter((task) => task["done"] !== true && typeof task["due"] === "string" && task["due"] < "2026-09-01").map((task) => String(task["label"])) })) },
  { app: "todo", on: "week", said: "what's left this week?", expect: says((store, on) => { const left = tasksIn(store, on).filter((task) => task["done"] !== true).map((task) => String(task["label"]).split(" ").slice(-1)[0]!); return { says: left, atLeast: Math.ceil(left.length / 2) }; }) },
  { app: "todo", on: "week", said: "how many tasks are in here?", expect: says((store, on) => ({ says: [number(tasksIn(store, on).length)] })) },
  { app: "todo", on: "week", said: "whats due tomorrow", expect: says((store, on) => ({ says: tasksIn(store, on).filter((task) => task["due"] === "2026-09-02").map((task) => String(task["label"]).split(" ").slice(-2).join(" ")) })) },
  { app: "todo", on: "t-deposit", said: "is this late?", expect: says(() => ({ says: [/\b(yes|late|overdue)\b/i] })) },
  { app: "todo", on: "week", said: "undo that", expect: answer },
  /* What the app does not have yet. */
  { app: "todo", on: "week", said: "assign these to Sam", expect: { missing: "link" } },
  { app: "todo", on: "t-book", said: "give this one to Nora", expect: { missing: "link" } },
  { app: "todo", on: "week", said: "assign all tasks in this list to sam", expect: { missing: "link" } },
  { app: "todo", on: "week", said: "make these urgent", expect: { missing: "field" } },
  { app: "todo", on: "week", said: "give these a priority of high", expect: { missing: "field" } },
  /* People said as pronouns. */
  { app: "todo", on: "week", said: "assign these to me", expect: { missing: "link", who: "Nora" } },
  { app: "todo", on: "t-book", said: "give this to her", after: "what does Nora have on this week?", expect: { missing: "link", who: "Nora" } },
  { app: "todo", on: "week", said: "assign them to him", after: "assign these to Sam", expect: { missing: "link", who: "Sam" } },
  { app: "rota", on: "s-fri-repair", said: "give this to her", after: "is Ada free on friday?", expect: { act: ["cover"], over: "itself", to: "v-ada" } },
  { app: "rota", on: "s-mon-open", said: "take this off me", as: "user-ada", expect: { act: ["uncover"], over: "itself", to: "v-ada" } },
  { app: "rota", on: "s-thu-baby", said: "take her off this", expect: { act: ["uncover"], over: "itself", to: "v-ada" } },
  /* Said another way again: phrasings written after the rest held. */
  { app: "todo", on: "week", said: "mark the lot as complete", expect: act("finish", "held") },
  { app: "todo", on: "t-book", said: "bin this", expect: act(["drop", "remove-task", "archive-task"], "itself") },
  { app: "todo", on: "week", said: "postpone these until next monday", expect: act("reschedule", "held") },
  { app: "todo", on: "week", said: "get rid of the done ones", expect: act(["drop", "remove-task", "archive-task"], "done") },
  { app: "todo", on: "week", said: "rename it Moving week", expect: act("rename", "itself") },
  { app: "todo", on: "week", said: "what should I do first?", expect: answer },
  { app: "todo", on: "week", said: "set these aside", expect: act("archive-task", "held") },
  { app: "rota", on: "s-fri-repair", said: "give this shift to me", as: "user-ada", expect: { act: ["cover"], over: "itself", to: "v-ada" } },
  { app: "rota", on: "s-mon-open", said: "swap this to the saturday", expect: act("move-shift", "itself") },
  /* Polite and indirect instructions are instructions. */
  { app: "todo", on: "week", said: "could you close these for me", expect: act("finish", "held") },
  { app: "todo", on: "t-book", said: "please mark this one done", expect: act("finish", "itself") },
  { app: "todo", on: "week", said: "i'd like these archived", expect: act("archive-task", "held") },
  { app: "todo", on: "t-book", said: "can we push this to monday", expect: act("reschedule", "itself") },
  { app: "todo", on: "week", said: "these should be marked done", expect: act("finish", "held") },
  { app: "rota", on: "s-mon-open", said: "would you drop this shift", expect: act("drop-shift", "itself") },
  /* Two asks in one sentence: one plan of two parts, each read on its own. */
  { app: "todo", on: "week", said: "archive the done ones, then close the open ones", expect: { parts: [{ act: ["archive-task"], over: "done" }, { act: ["finish"], over: "open" }] } },
  { app: "todo", on: "week", said: "drop the done ones and close the open ones", expect: { parts: [{ act: ["drop", "remove-task"], over: "done" }, { act: ["finish"], over: "open" }] } },
  { app: "todo", on: "t-book", said: "close this and move it to someday", expect: { parts: [{ act: ["finish"], over: "itself" }, { act: ["move-to-list"], over: "itself" }] } },
  /* A person named without "to". */
  { app: "todo", on: "week", said: "Nora should handle these", expect: { missing: "link", who: "Nora" } },
  { app: "todo", on: "week", said: "make these Sam's responsibility", expect: { missing: "link", who: "Sam" } },
  { app: "todo", on: "t-book", said: "this is Nora's now", expect: { missing: "link", who: "Nora" } },
  { app: "rota", on: "s-fri-repair", said: "Bo should take this one", expect: { act: ["cover"], over: "itself", to: "v-bo" } },
  { app: "rota", on: "s-fri-repair", said: "this is Cass's shift now", expect: { act: ["cover"], over: "itself", to: "v-cass" } },
  /* A rename said as a statement. */
  { app: "todo", on: "week", said: "the name should be Packing week", expect: act("rename", "itself") },
  { app: "todo", on: "t-book", said: "call it Book the small van", expect: act("rename", "itself") },
  { app: "todo", on: "week", said: "Moving days is a better name", expect: act("rename", "itself") },
  /* Facts used: the link the words are about, by name. */
  { app: "todo", on: "t-book", said: "what does this depend on?", expect: says((store, on) => ({ says: outOf(store, on, "waits-for").map((name) => name.split(" ").slice(-1)[0]!) })) },
  { app: "todo", on: "t-book", said: "is anything holding this up?", expect: says((store, on) => ({ says: outOf(store, on, "waits-for").map((name) => name.split(" ").slice(-1)[0]!) })) },
  { app: "rota", on: "s-sat-market", said: "who's doing this one?", expect: says((store, on) => ({ says: outOf(store, on, "covered-by").map((name) => name.split(" ")[0]!) })) },
  /* The rota. */
  { app: "rota", on: "s-mon-open", said: "give this shift to Bo", expect: act("cover", "itself") },
  { app: "rota", on: "s-mon-open", said: "move this to friday", expect: act("move-shift", "itself") },
  { app: "rota", on: "s-mon-open", said: "cancel this shift", expect: act("drop-shift", "itself") },
  { app: "rota", on: "v-ada", said: "ada is away for a while", expect: act("step-back", "itself") },
  { app: "rota", on: "s-mon-open", said: "who is on this?", expect: says((store, on) => ({ says: outOf(store, on, "covered-by").map((name) => name.split(" ")[0]!) })) },
  /* The discography. */
  { app: "discography", on: "SONG", said: "is this released?", expect: says(() => ({ says: [/\byes\b|is released|has been released/i] })) },
  { app: "discography", on: "SONG", said: "scrap it", expect: act("scrap-song", "itself") },
  { app: "discography", on: "SONG", said: "scrap this one", expect: act("scrap-song", "itself") },
  { app: "discography", on: "album:cloudy-eyed-stroll-mitch-bade", said: "what's on this album?", expect: says((store, on) => ({ says: outOf(store, on, "tracks") })) },
  /* Open questions whose answers the graph holds. */
  { app: "todo", on: "t-book", said: "which list is this on?", expect: says((store, on) => ({ says: inOf(store, on, "holds") })) },
  { app: "todo", on: "t-book", said: "what is this waiting for?", expect: says((store, on) => ({ says: outOf(store, on, "waits-for").map((name) => name.split(" ").slice(-1)[0]!) })) },
  { app: "todo", on: "t-book", said: "when is this due?", expect: says(() => ({ says: [/2026-09-01|september 1|1 september|sept?\.? 1\b|\btoday\b/i] })) },
  { app: "todo", on: "week", said: "how many of these are done?", expect: says((store, on) => ({ says: [number(tasksIn(store, on).filter((task) => task["done"] === true).length)] })) },
  { app: "rota", on: "s-mon-open", said: "where is this held?", expect: says((store, on) => ({ says: outOf(store, on, "held-at").map((name) => name.replace(/^The /, "")) })) },
  { app: "rota", on: "v-bo", said: "how many shifts does bo cover?", expect: says((store, on) => ({ says: [number(inOf(store, on, "covered-by").length)] })) },
  { app: "rota", on: "s-mon-open", said: "what day is this on?", expect: says(() => ({ says: [/monday|2026-09-14|14 september|september 14/i] })) },
  { app: "rota", on: "s-fri-repair", said: "is anyone on this?", expect: says(() => ({ says: [/\b(no|nobody|no one|not|isn't|uncovered|empty)\b/i] })) },
  { app: "discography", on: "SONG", said: "who made this?", expect: says((store, on) => ({ says: outOf(store, on, "by") })) },
  { app: "discography", on: "album:cloudy-eyed-stroll-mitch-bade", said: "how many songs are on this album?", expect: says((store, on) => ({ says: [number(outOf(store, on, "tracks").length)] })) },
];

describe.skipIf(!jev || !xai)("the menu understands what people say, live", () => {
  it(`gets at least ${BAR * 100}% of ${CASES.length} things people type right, quickly`, async () => {
    const { score } = await runEval(CASES, "MENU EVAL", "menu-eval.json");
    expect(score).toBeGreaterThanOrEqual(BAR);
  }, 300_000);
});
