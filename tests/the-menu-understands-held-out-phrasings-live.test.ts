import { describe, expect, it } from "vitest";
import { act, inOf, jev, outOf, runEval, says, tasksIn, xai, type Case } from "./menu-eval/judge.js";

/*
 * HELD OUT (Roadmap f-menu-type-anything): twenty phrasings written after
 * the tuned eval held, and never tuned on — other verbs, odd word order,
 * two asks in one sentence, polite and wordy ways of saying it. Scored on
 * its own (docs/menu-eval-held-out.json); under 85% says what fails.
 */
const HELD_OUT: readonly Case[] = [
  { app: "todo", on: "week", said: "could you please mark everything on this list as finished", expect: act("finish", "held") },
  { app: "todo", on: "week", said: "these are all done now", expect: act("finish", "held") },
  { app: "todo", on: "t-book", said: "done with this one, thanks", expect: act("finish", "itself") },
  { app: "todo", on: "t-book", said: "this one can wait till friday", expect: act("reschedule", "itself") },
  { app: "todo", on: "week", said: "push everything here back by a week", expect: act("reschedule", "held") },
  { app: "todo", on: "t-book", said: "put it on the someday list", expect: act("move-to-list", "itself") },
  { app: "todo", on: "week", said: "finish the open ones and archive the done ones", expect: act(["finish", "archive-task"], "held") },
  { app: "todo", on: "week", said: "i'd like to get rid of this list", expect: act(["remove-list", "archive-list"], "itself") },
  { app: "todo", on: "t-deposit", said: "the deposit is paid", expect: act("finish", "itself") },
  { app: "todo", on: "week", said: "Sam should take care of these", expect: { missing: "link", who: "Sam" } },
  { app: "todo", on: "t-book", said: "make this nora's job", expect: { missing: "link", who: "Nora" } },
  { app: "todo", on: "week", said: "list name should be Moving week", expect: act("rename", "itself") },
  { app: "todo", on: "t-quote", said: "actually this isn't finished", expect: act("reopen", "itself") },
  { app: "todo", on: "week", said: "anything here overdue", expect: says((store, on) => ({ says: tasksIn(store, on).some((task) => task["done"] !== true && typeof task["due"] === "string" && task["due"] < "2026-09-01") ? [] : [/\b(no|none|nothing|not)\b/i] })) },
  { app: "todo", on: "t-book", said: "what's blocking this", expect: says((store, on) => ({ says: outOf(store, on, "waits-for").map((name) => name.split(" ").slice(-1)[0]!) })) },
  { app: "rota", on: "s-mon-open", said: "bo can do this one instead", expect: { act: ["cover"], over: "itself", to: "v-bo" } },
  { app: "rota", on: "v-cass", said: "cass needs a break for a few weeks", expect: act("step-back", "itself") },
  { app: "rota", on: "s-wed-food", said: "who's covering?", expect: says((store, on) => ({ says: outOf(store, on, "covered-by").map((name) => name.split(" ")[0]!) })) },
  { app: "rota", on: "s-tue-craft", said: "shift this to wednesday please", expect: act("move-shift", "itself") },
  { app: "discography", on: "SONG", said: "which album is this from", expect: says((store, on) => ({ says: inOf(store, on, "tracks").map((name) => name.split(/[\s/]/)[0]!) })) },
];
const HELD_BAR = 0.85;

describe.skipIf(!jev || !xai)("the menu understands phrasings it was never tuned on, live", () => {
  it(`gets at least ${HELD_BAR * 100}% of ${HELD_OUT.length} held-out phrasings right`, async () => {
    const { score } = await runEval(HELD_OUT, "HELD OUT", "menu-eval-held-out.json");
    expect(score).toBeGreaterThanOrEqual(HELD_BAR);
  }, 300_000);
});
