import type { AnySchema, Principal, Store } from "@graview/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { createTodoUiStore } from "../../apps/todo/src/ui/app.js";
import { createRotaUiStore } from "../../apps/rota/src/ui/app.js";
import { createStore as createDiscographyStore } from "../../apps/discography/src/domain/app.js";
import discographySeed from "../../apps/discography/src/data/seed.json" with { type: "json" };
import { answerHere, type InlineResult } from "../../packages/tools/src/inline-ai.js";
import { heldBy, peopleKinds } from "../../packages/tools/src/graph-plan.js";
import { forThePerson } from "../../packages/tools/src/sentences.js";
import { factsOf } from "../../packages/tools/src/facts.js";
import { claimedAbsent, dayWords, saysDone } from "../../packages/tools/src/say-change.js";
import { jevDecide, jevKeyFromEnvironment, JEV_MODEL } from "../../packages/tools/src/providers/jev.js";
import type { HostAi, ThinkingProvider } from "../../packages/tools/src/ai.js";

/*
 * THE MENU'S LIVE EVAL, SHARED (Roadmap f-menu-type-anything): the cases'
 * shape, the apps they are asked on, how an answer is judged — the act and
 * its records, the plan's need, or an answer's facts read from the graph —
 * and the run, four at a time, written to docs/. The cases tuned on and the
 * held-out ones are two files that use it.
 */
export const jev = jevKeyFromEnvironment();
export const xai = process.env["XAI_API_KEY"];
export const BAR = 0.9;

const grok = (model: string): ThinkingProvider => ({
  model,
  think: async ({ system, prompt }) => {
    const answer = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${xai}` }, body: JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
    const body = (await answer.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { text: body.choices?.[0]?.message?.content ?? "", usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 } };
  },
});

export type Over = "itself" | "held" | "done" | "open";
/** What a true answer must say, read from the graph: each a word or a pattern; `atLeast` of them, else all. */
export type Facts = (store: Store<AnySchema>, on: string) => { readonly says: readonly (string | RegExp)[]; readonly atLeast?: number };
export type Expected = { readonly act: readonly string[]; readonly over: Over; readonly to?: string; readonly orAsk?: true } | { readonly missing: "link" | "field"; readonly who?: string } | { readonly answer: true; readonly facts?: Facts } | { readonly parts: readonly { readonly act: readonly string[]; readonly over: Over }[] } | { readonly clarify: true } | { readonly notClaimed: true } | { readonly outside: true };
export interface Case {
  readonly app: "todo" | "rota" | "discography";
  readonly on: string;
  readonly said: string;
  readonly expect: Expected;
  /** The turn before on the same card. */
  readonly after?: string;
  /** Who is at the seat, where not the app's usual one. */
  readonly as?: string;
}
export const act = (names: string | readonly string[], over: Over): Expected => ({ act: typeof names === "string" ? [names] : names, over });
export const answer: Expected = { answer: true };
export const says = (facts: Facts): Expected => ({ answer: true, facts });
export const label = (store: Store<AnySchema>, id: string) => String((store.graph.getNode(id) as Record<string, unknown> | undefined)?.["label"] ?? id);
export const outOf = (store: Store<AnySchema>, id: string, kind: string) => store.graph.out(id, kind).map((node) => label(store, node.id));
export const inOf = (store: Store<AnySchema>, id: string, kind: string) => store.graph.in(id, kind).map((node) => label(store, node.id));
export const tasksIn = (store: Store<AnySchema>, list: string) => store.graph.out(list, "holds") as unknown as Record<string, unknown>[];
export const number = (n: number) => new RegExp(`\\b(${n}|${["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? n})\\b`, "i");


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
  const got = proposals.length > 0 ? `${[...new Set(proposals.map((p) => p.call.name))].join("+")} × ${proposals.length}${said ? `, saying: ${said}` : ""}` : result.missing ? `missing ${result.missing.need ? Object.keys(result.missing.need)[0] : "(no need)"}: ${result.missing.said}` : result.interaction.outcome === "failed" ? `failed: ${result.interaction.failed ?? ""}` : `answer: ${said}`;
  // Whatever the card shows is a sentence for the person: never the pipeline's own note.
  if (said && !forThePerson(said)) return { ok: false, got: `${got} [not a sentence]` };
  // No engine words: a record "itself", or an act's own title in quotes.
  const titles = store.allMutations().map((one) => one.title).filter((title): title is string => typeof title === "string");
  if (/\bitself\b/i.test(said) || titles.some((title) => said.includes(`“${title}”`))) return { ok: false, got: `${got} [engine words]` };
  // Never something false about the app: a person or record the graph holds, said to be absent.
  if (claimedAbsent(store, said).length > 0 || (result.missing && claimedAbsent(store, result.missing.said).length > 0)) return { ok: false, got: `${got} [says something here is absent]` };
  // Told to do something and nothing changed: never words that say it was done.
  if (!("answer" in one.expect) && proposals.length === 0 && !result.missing && saysDone(said)) return { ok: false, got: `${got} [says a change was made that was not]` };
  const expected = one.expect;
  /*
   * THE WORDS SAY WHAT WILL HAPPEN: where an act runs over more than one
   * record, the count it runs over is in the words; every value it takes
   * (a record by its name, a day by its name, words given) is named.
   */
  const byAct = new Map<string, number>();
  for (const p of proposals) byAct.set(p.call.name, (byAct.get(p.call.name) ?? 0) + 1);
  const counted = [...byAct.values()].every((n) => n === 1 || new RegExp(`\\b${n}\\b`).test(said));
  const subjectOf = (name: string) => store.allMutations().find((one) => one.name === name)?.subject?.arg;
  const valued = proposals.every((p) =>
    Object.entries(p.call.args).every(([arg, value]) => {
      if (arg === subjectOf(p.call.name) || typeof value !== "string" || value === "") return true;
      const wanted = store.graph.getNode(value) ? label(store, value) : (dayWords(value) ?? value);
      return said.includes(wanted);
    }),
  );
  // Plain words: no word said twice over ("Move Move the broadband"), no pronoun before a name ("They Bo Ferreira"), and a record named in the line is quoted.
  const plain = !/\b(\w+)\s+\1\b/i.test(said) && !/^(They|It|He|She|This|These)\s+[A-Z“]/.test(said) && proposals.every((p) => { const node = store.graph.getNode(String(p.record ?? "")); const name = label(store, String(p.record ?? "")); return !node || peopleKinds(store).includes(node.kind) || !said.includes(name) || said.includes(`“${name}”`); });
  const worded = proposals.length === 0 || (counted && valued && plain && !/ — |\bitself\b|\beach of\b/.test(said));
  // Told something the app may not do: a change proposed, a plan, or plain words that it could not — never words that it was done.
  // Outside the app: said plainly that it is not done from here — no change, no plan to add a field.
  if ("outside" in expected) return { ok: proposals.length === 0 && !result.missing && /\bcan'?t\b.*\bfrom here\b/i.test(said), got };
  if ("notClaimed" in expected) return { ok: proposals.length > 0 || Boolean(result.missing) || (said.length > 0 && !saysDone(said)), got };
  if ("clarify" in expected) return { ok: proposals.length === 0 && /\?/.test(said) && /\b(all|which)\b/i.test(said), got };
  if (!worded) return { ok: false, got: `${got} [words do not say what will happen]` };
  if ("parts" in expected) {
    // One plan of two parts: each part's act over its own records, and every change proposed one of theirs.
    const recordOf = (p: (typeof proposals)[number]) => String(p.record ?? "");
    const each = expected.parts.map((part) => {
      const want = new Set(recordsOf(store, on, part.over));
      const mine = proposals.filter((p) => part.act.includes(p.call.name) && want.has(recordOf(p)));
      return { mine, want };
    });
    const ok = each.every((part) => part.mine.length > 0) && proposals.every((p) => each.some((part, at) => expected.parts[at]!.act.includes(p.call.name) && part.want.has(recordOf(p))));
    return { ok, got };
  }
  // A destructive act over several, said loosely: asking which is as right as the act.
  if ("act" in expected && expected.orAsk && proposals.length === 0 && /\?/.test(said) && /\b(all|which)\b/i.test(said)) return { ok: true, got };
  if ("act" in expected) {
    const want = new Set(recordsOf(store, on, expected.over));
    const records = proposals.map((p) => String(p.record ?? Object.values(p.call.args).find((value) => typeof value === "string" && want.has(value)) ?? ""));
    // A ghost leaves out what the store would refuse (finishing what is done): every record proposed is one meant, and most of those meant are there.
    const ok = proposals.length > 0 && proposals.every((p) => expected.act.includes(p.call.name)) && (!expected.to || proposals.every((p) => Object.values(p.call.args).includes(expected.to))) && records.every((id) => want.has(id)) && (expected.over === "itself" || expected.over === "done" || records.length >= Math.ceil(want.size / 2));
    return { ok, got };
  }
  if ("missing" in expected) return { ok: Boolean(result.missing?.need && expected.missing in result.missing.need && (!expected.who || result.missing.who === expected.who)), got: `${got}${result.missing?.who ? ` (who ${result.missing.who})` : ""}${result.taken ? ` [taking “${result.taken.said}” as ${result.taken.as}]` : ""}` };
  // A question never comes with a change: a suggestion beside the answer is the person's to choose, never the card's proposal.
  const facts = expected.facts?.(store, on);
  // What the model was told: a fact it was given and did not say is the answer's fault; one never given is the pipeline's.
  const told = facts ? JSON.stringify(factsOf(store, people[one.app], [on, ...(heldBy(store, on)?.ids ?? [])])) : "";
  const given = facts ? facts.says.filter((fact) => (typeof fact === "string" ? told.toLowerCase().includes(fact.toLowerCase()) : true)).length : 0;
  const found = facts ? facts.says.filter((fact) => (typeof fact === "string" ? said.toLowerCase().includes(fact.toLowerCase()) : fact.test(said))).length : 0;
  const true_ = !facts || (facts.says.length > 0 && found >= (facts.atLeast ?? facts.says.length));
  return { ok: proposals.length === 0 && !result.missing && result.interaction.outcome !== "failed" && said.length > 0 && true_, got: facts ? `${got} [facts said ${found}/${facts.says.length}, given ${given}: ${facts.says.map(String).join(", ")}]` : got };
}


/** Asks every case live, judges it, writes the table to docs/<file>, and says the score and the times. */
export async function runEval(cases: readonly Case[], title: string, file: string): Promise<{ readonly score: number; readonly rows: readonly { readonly ok: boolean }[] }> {
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
    const rows = await pool(cases, 4, async (one) => {
        const store = storeOf(one.app);
        const on = one.on === "SONG" ? SONG : one.on;
        const started = Date.now();
        const principal = one.as ? { ...people[one.app], id: one.as } : people[one.app];
        const result = await answerHere(ai, { store, target: { on: "record", id: on }, principal, said: one.said, ...(one.after ? { follows: { said: one.after, answer: "" } } : {}) });
        const ms = Date.now() - started;
        const { ok, got } = judged(store, one, on, result);
        const expected = "outside" in one.expect ? "outside the app, said plainly" : "notClaimed" in one.expect ? "a change, a plan, or words that it could not" : "clarify" in one.expect ? "a question back: which?" : "parts" in one.expect ? one.expect.parts.map((part) => `${part.act.join("|")} over ${part.over}`).join(" + ") : "act" in one.expect ? `${one.expect.act.join("|")} over ${one.expect.over}` : "missing" in one.expect ? `missing ${one.expect.missing}` : one.expect.facts ? "a true answer" : "an answer";
        return { app: one.app, on, said: one.said, expected, got, ok, ms, stages: (result.interaction.stages ?? []).map((stage) => `${stage.stage} ${stage.ms}`).join(", ") };
    });
    const times = rows.map((row) => row.ms).sort((a, b) => a - b);
    const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))]!;
    const score = rows.filter((row) => row.ok).length / rows.length;
    // Decided by Jev alone: no light or Thinking model asked.
    const jevAlone = rows.filter((row) => !/\b(light|thinking)\b/.test(row.stages)).length / rows.length;
    const report = { at: new Date().toISOString(), fast: JEV_MODEL, light: "grok-4.20-0309-non-reasoning", score, bar: BAR, medianMs: at(0.5), p90Ms: at(0.9), jevAlone, rows };
    mkdirSync(new URL("../../docs", import.meta.url), { recursive: true });
    writeFileSync(new URL(`../../docs/${file}`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${title} ${Math.round(score * 100)}% (${rows.filter((row) => row.ok).length}/${rows.length}), median ${at(0.5)} ms, p90 ${at(0.9)} ms, ${Math.round(jevAlone * 100)}% decided by Jev alone`);
    for (const row of rows) console.log(`${row.ok ? "ok  " : "MISS"} ${row.app}/${row.on} “${row.said}” → want ${row.expected}; got ${row.got} (${row.ms} ms; ${row.stages})`);
    return { score, rows };
}
