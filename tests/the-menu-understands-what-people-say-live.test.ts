import type { AnySchema, Principal, Store } from "@graview/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTodoUiStore } from "../apps/todo/src/ui/app.js";
import { createRotaUiStore } from "../apps/rota/src/ui/app.js";
import { createStore as createDiscographyStore } from "../apps/discography/src/domain/app.js";
import discographySeed from "../apps/discography/src/data/seed.json" with { type: "json" };
import { answerHere, type InlineResult } from "../packages/tools/src/inline-ai.js";
import { heldBy } from "../packages/tools/src/graph-plan.js";
import { forThePerson } from "../packages/tools/src/sentences.js";
import { jevDecide, jevKeyFromEnvironment, JEV_MODEL } from "../packages/tools/src/providers/jev.js";
import type { HostAi, ThinkingProvider } from "../packages/tools/src/ai.js";

/*
 * THE MENU UNDERSTANDS WHAT PEOPLE SAY (Roadmap f-menu-type-anything), a
 * live eval. Opt-in: it runs only where TYPESAFE_API_KEY (or JEV_API_KEY)
 * and XAI_API_KEY are set. Each line is a thing a person types in the
 * right-click menu, on a card, a list or a place of the todo example, the
 * rota or the discography, and what should come of it: one act over which
 * records, a plan for what the app lacks, or an answer in words. It writes
 * the table to docs/menu-eval.json and fails under the bar (90%).
 */
const jev = jevKeyFromEnvironment();
const xai = process.env["XAI_API_KEY"];
const BAR = 0.9;

const grok = (model: string): ThinkingProvider => ({
  model,
  think: async ({ system, prompt }) => {
    const answer = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${xai}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
    const body = (await answer.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { text: body.choices?.[0]?.message?.content ?? "", usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 } };
  },
});

type Over = "itself" | "held" | "done" | "open";
type Expected = { readonly act: readonly string[]; readonly over: Over; readonly to?: string } | { readonly missing: "link" | "field"; readonly who?: string } | { readonly answer: true };
interface Case {
  readonly app: "todo" | "rota" | "discography";
  readonly on: string;
  readonly said: string;
  readonly expect: Expected;
  /** The turn before on the same card. */
  readonly after?: string;
  /** Who is at the seat, where not the app's usual one. */
  readonly as?: string;
}
const act = (names: string | readonly string[], over: Over): Expected => ({ act: typeof names === "string" ? [names] : names, over });
const answer: Expected = { answer: true };

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
  { app: "todo", on: "week", said: "what's overdue?", expect: answer },
  { app: "todo", on: "week", said: "what's left this week?", expect: answer },
  { app: "todo", on: "week", said: "how many tasks are in here?", expect: answer },
  { app: "todo", on: "week", said: "whats due tomorrow", expect: answer },
  { app: "todo", on: "t-deposit", said: "is this late?", expect: answer },
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
  /* The rota. */
  { app: "rota", on: "s-mon-open", said: "give this shift to Bo", expect: act("cover", "itself") },
  { app: "rota", on: "s-mon-open", said: "move this to friday", expect: act("move-shift", "itself") },
  { app: "rota", on: "s-mon-open", said: "cancel this shift", expect: act("drop-shift", "itself") },
  { app: "rota", on: "v-ada", said: "ada is away for a while", expect: act("step-back", "itself") },
  { app: "rota", on: "s-mon-open", said: "who is on this?", expect: answer },
  /* The discography. */
  { app: "discography", on: "SONG", said: "is this released?", expect: answer },
  { app: "discography", on: "SONG", said: "scrap it", expect: act("scrap-song", "itself") },
  { app: "discography", on: "SONG", said: "scrap this one", expect: act("scrap-song", "itself") },
  { app: "discography", on: "album:gang-related-the-soundtrack", said: "what's on this album?", expect: answer },
];

const people: Record<Case["app"], Principal> = {
  todo: { kind: "human", id: "user-nora", roles: ["keeper"] },
  rota: { kind: "human", id: "user-jo", roles: ["coordinator"] },
  discography: { kind: "human", id: "user-label", roles: ["label"] },
};
const storeOf = (app: Case["app"]): Store<AnySchema> =>
  (app === "todo" ? createTodoUiStore("2026-09-01") : app === "rota" ? createRotaUiStore("2026-09-01") : createDiscographyStore({ snapshot: discographySeed as never })) as unknown as Store<AnySchema>;

/** The records an "over" names, as the store holds them before the ask. */
function recordsOf(store: Store<AnySchema>, on: string, over: Over): readonly string[] {
  if (over === "itself") return [on];
  const held = heldBy(store, on)?.ids ?? [];
  const done = (id: string) => (store.graph.getNode(id) as Record<string, unknown> | undefined)?.["done"] === true;
  return over === "held" ? held : over === "done" ? held.filter(done) : held.filter((id) => !done(id));
}

function judged(store: Store<AnySchema>, one: Case, on: string, result: InlineResult): { readonly ok: boolean; readonly got: string } {
  const proposals = result.ghost?.proposals ?? [];
  const said = result.answer ?? "";
  const got = proposals.length > 0 ? `${[...new Set(proposals.map((p) => p.call.name))].join("+")} × ${proposals.length}` : result.missing ? `missing ${result.missing.need ? Object.keys(result.missing.need)[0] : "(no need)"}: ${result.missing.said}` : result.interaction.outcome === "failed" ? `failed: ${result.interaction.failed ?? ""}` : `answer: ${said}`;
  // Whatever the card shows is a sentence for the person: never the pipeline's own note.
  if (said && !forThePerson(said)) return { ok: false, got: `${got} [not a sentence]` };
  const expected = one.expect;
  if ("act" in expected) {
    const want = new Set(recordsOf(store, on, expected.over));
    const records = proposals.map((p) => String(p.record ?? Object.values(p.call.args).find((value) => typeof value === "string" && want.has(value)) ?? ""));
    // A ghost leaves out what the store would refuse (finishing what is done): every record proposed is one meant, and most of those meant are there.
    const ok = proposals.length > 0 && proposals.every((p) => expected.act.includes(p.call.name)) && (!expected.to || proposals.every((p) => Object.values(p.call.args).includes(expected.to))) && records.every((id) => want.has(id)) && (expected.over === "itself" || expected.over === "done" || records.length >= Math.ceil(want.size / 2));
    return { ok, got };
  }
  if ("missing" in expected) return { ok: Boolean(result.missing?.need && expected.missing in result.missing.need && (!expected.who || result.missing.who === expected.who)), got: `${got}${result.missing?.who ? ` (who ${result.missing.who})` : ""}${result.taken ? ` [taking “${result.taken.said}” as ${result.taken.as}]` : ""}` };
  // An answer may offer a change beside it, never one made over every record.
  return { ok: proposals.every((p) => !p.id.startsWith("each:")) && !result.missing && result.interaction.outcome !== "failed" && said.length > 0, got };
}

describe.skipIf(!jev || !xai)("the menu understands what people say, live", () => {
  it(`gets at least ${BAR * 100}% of ${CASES.length} things people type right, quickly`, async () => {
    const ai: HostAi = { name: "grok", fast: { model: JEV_MODEL, decide: jevDecide({ apiKey: jev! }) }, light: grok("grok-4.20-0309-non-reasoning"), thinking: grok("grok-4.20-0309-non-reasoning") };
    const songs = (discographySeed as { nodes: { id: string; kind: string; status?: string }[] }).nodes.filter((node) => node.kind === "song");
    const SONG = songs[0]!.id;
    // Four at a time, as several people typing would: the times are each ask's own, not a queue's.
    const pool = async <T, R>(items: readonly T[], width: number, work: (item: T) => Promise<R>): Promise<R[]> => {
      const out: R[] = new Array(items.length);
      let next = 0;
      await Promise.all(Array.from({ length: width }, async () => {
        while (next < items.length) {
          const index = next++;
          out[index] = await work(items[index]!);
        }
      }));
      return out;
    };
    const rows = await pool(CASES, 4, async (one) => {
        const store = storeOf(one.app);
        const on = one.on === "SONG" ? SONG : one.on;
        const started = Date.now();
        const principal = one.as ? { ...people[one.app], id: one.as } : people[one.app];
        const result = await answerHere(ai, { store, target: { on: "record", id: on }, principal, said: one.said, ...(one.after ? { follows: { said: one.after, answer: "" } } : {}) });
        const ms = Date.now() - started;
        const { ok, got } = judged(store, one, on, result);
        const expected = "act" in one.expect ? `${one.expect.act.join("|")} over ${one.expect.over}` : "missing" in one.expect ? `missing ${one.expect.missing}` : "an answer";
        return { app: one.app, on, said: one.said, expected, got, ok, ms, stages: (result.interaction.stages ?? []).map((stage) => `${stage.stage} ${stage.ms}`).join(", ") };
    });
    const times = rows.map((row) => row.ms).sort((a, b) => a - b);
    const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))]!;
    const score = rows.filter((row) => row.ok).length / rows.length;
    const report = { at: new Date().toISOString(), fast: JEV_MODEL, light: "grok-4.20-0309-non-reasoning", score, bar: BAR, medianMs: at(0.5), p90Ms: at(0.9), rows };
    mkdirSync(new URL("../docs", import.meta.url), { recursive: true });
    writeFileSync(new URL("../docs/menu-eval.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`MENU EVAL ${Math.round(score * 100)}% (${rows.filter((row) => row.ok).length}/${rows.length}), median ${at(0.5)} ms, p90 ${at(0.9)} ms`);
    for (const row of rows) console.log(`${row.ok ? "ok  " : "MISS"} ${row.app}/${row.on} “${row.said}” → want ${row.expected}; got ${row.got} (${row.ms} ms; ${row.stages})`);
    expect(score).toBeGreaterThanOrEqual(BAR);
  }, 300_000);
});
