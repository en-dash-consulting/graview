import { composeAppChange } from "@graview/core/compose";
import { toDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { todoApp } from "../apps/todo/src/domain/app.js";
import type { HostAi, ThinkingProvider } from "../packages/tools/src/ai.js";
import { jevDecide, jevKeyFromEnvironment, JEV_MODEL } from "../packages/tools/src/providers/jev.js";
import { aboutTheLook, draftPageSpec, specCanSay } from "../packages/tools/src/section.js";

/*
 * MAKE ANY PAGE BETTER, ON REAL JEV (Roadmap f-make-any-page-better). Opt-in:
 * it runs only where TYPESAFE_API_KEY (or JEV_API_KEY) is set, and drafts
 * over the view spec only where XAI_API_KEY is too. Each phrasing typed in
 * the menu on Things' Tasks list is routed by Jev — about the look or about
 * the records — and each about the look is asked whether the view spec can
 * say it; those it can are drafted by the light model and judged by the
 * checker. It prints the table it measured and asserts only that every
 * phrasing was answered: how often Jev agrees with the words is the
 * table's to say, not a threshold's.
 */
const key = jevKeyFromEnvironment();
const xai = process.env["XAI_API_KEY"];

const grokLight: ThinkingProvider = {
  model: "grok-4.20-0309-non-reasoning",
  think: async ({ system, prompt }) => {
    const answer = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${xai}` }, body: JSON.stringify({ model: "grok-4.20-0309-non-reasoning", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }) });
    const body = (await answer.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { text: body.choices?.[0]?.message?.content ?? "", usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 } };
  },
};

/** Each phrasing, what it is about, and — about the look — whether the view spec can say it. */
const ALL: readonly { readonly said: string; readonly about: "look" | "records"; readonly spec?: boolean }[] = [
  { said: "make this page look better", about: "look", spec: true },
  { said: "show the due date on each row", about: "look", spec: true },
  { said: "sort the tasks by due date", about: "look", spec: true },
  { said: "group them by list", about: "look", spec: false },
  { said: "put the ones due soonest first", about: "look", spec: true },
  { said: "call the due field Deadline", about: "look", spec: true },
  { said: "make the cards bigger", about: "look", spec: false },
  { said: "use a warmer color for the rows", about: "look", spec: false },
  { said: "lay the tasks out in three columns side by side", about: "look", spec: false },
  { said: "more space between the rows", about: "look", spec: false },
  { said: "close these", about: "records" },
  { said: "assign to sam", about: "records" },
  { said: "move everything to tomorrow", about: "records" },
  { said: "delete the finished ones", about: "records" },
  { said: "which of these are late?", about: "records" },
];

const PHRASINGS = process.env["PAGE_EVAL_ONLY"] ? ALL.filter((one) => one.said.includes(process.env["PAGE_EVAL_ONLY"]!)) : ALL;

describe.skipIf(!key)("make any page better, on real Jev", () => {
  it("routes each phrasing typed on the Tasks list, and drafts what the spec can say", async () => {
    const ai: HostAi = { name: "live", fast: { model: JEV_MODEL, decide: jevDecide({ apiKey: key! }) }, ...(xai ? { light: grokLight } : {}) };
    const document = toDocument(todoApp as never).document;
    const part = { name: "Tasks", slot: "list" as const, kind: "task" };
    const rows: string[] = ["| phrasing | about (want) | about (Jev) | spec can say it? (Jev) | draft (light model, checked) | ends as (want) | ends as | ms |", "|---|---|---|---|---|---|---|---|"];
    let agreed = 0;
    for (const one of PHRASINGS) {
      const began = Date.now();
      const routed = await aboutTheLook(ai, one.said, part.name);
      let spec = "—";
      let draft = "—";
      let ends = "quick ask";
      if (routed.about === "look") {
        const can = await specCanSay(ai, one.said, part);
        spec = `${can.can ? "spec" : "own view"} (${can.by}${can.confidence !== undefined ? ` ${can.confidence.toFixed(2)}` : ""})`;
        ends = "own view offered";
        if (can.can && xai) {
          const drafted = await draftPageSpec({ ai, document, part, mode: "describe", words: one.said, judge: async (edits) => { const composed = composeAppChange({ document, edits }); return composed.ok ? [] : [composed.refused]; } });
          if (drafted.ok) ends = "spec draft";
          draft = drafted.ok ? `ok: ${process.env["PAGE_EVAL_EDITS"] ? JSON.stringify(drafted.edits) + " — " + drafted.said : drafted.edits.map((edit) => (edit as { op: string }).op).join(", ")}${drafted.repaired ? " (repaired)" : ""}` : drafted.cannot ? `cannot: ${drafted.cannot.slice(0, 60)}` : `refused: ${drafted.refused.slice(0, 400)}`;
        }
      }
      const want = one.about === "records" ? "quick ask" : one.spec ? "spec draft" : "own view offered";
      if (want === ends) agreed += 1;
      rows.push(`| ${one.said} | ${one.about} | ${routed.about} (${routed.by}${routed.confidence !== undefined ? ` ${routed.confidence.toFixed(2)}` : ""}) | ${spec} | ${draft} | ${want} | ${ends} | ${Date.now() - began} |`);
      expect(["look", "records"]).toContain(routed.about);
    }
    console.log(`LIVE EVAL make any page better: ${agreed} of ${PHRASINGS.length} end as wanted\n${rows.join("\n")}`);
  }, 600_000);

  /*
   * SUGGESTED, TAGGED BY JEV: the menu's candidates on Things' Tasks list —
   * the nudges a part gives and the obvious acts — each classed 💬 Chat or
   * ✨ Better UI, asked as the menu asks (`suggestionQuestions` in
   * `menu-suggested.ts`), in one call.
   */
  it("tags each suggestion on the Tasks list as Chat or Better UI", async () => {
    const decide = jevDecide({ apiKey: key! });
    const SUGGESTIONS: readonly { readonly label: string; readonly mode: "chat" | "better" }[] = [
      { label: "Show the due date on each row", mode: "better" },
      { label: "Sort these by due date, soonest first", mode: "better" },
      { label: "Make “Tasks” easier to read at a glance", mode: "better" },
      { label: "Finish it", mode: "chat" },
      { label: "Set the status", mode: "chat" },
      { label: "Move it to another list", mode: "chat" },
      { label: "Archive the task", mode: "chat" },
    ];
    const questions: Record<string, unknown> = {
      pick: { type: "choice", instructions: "Somebody right-clicked “Tasks” in an app. Which of these would they most likely want to do next?", criteria: Object.fromEntries(SUGGESTIONS.map((one, at) => [`s${at + 1}`, one.label])) },
    };
    SUGGESTIONS.forEach((one, at) => {
      questions[`about_s${at + 1}`] = {
        type: "choice",
        instructions: `Is “${one.label}” about how “Tasks” looks or is laid out, or about the records in it?`,
        criteria: { look: "How it looks or is laid out: style, size, what each row or card shows, its order or grouping", records: "The records themselves: changing, finishing, adding, assigning or asking about them" },
      };
    });
    const began = Date.now();
    const decided = await decide({ on: "Tasks" }, questions as never);
    const ms = Date.now() - began;
    const pick = decided.answers["pick"];
    const rows = ["| suggestion | want | Jev tagged | confidence |", "|---|---|---|---|"];
    let agreed = 0;
    SUGGESTIONS.forEach((one, at) => {
      const answer = decided.answers[`about_s${at + 1}`];
      const tagged = answer?.type === "choice" ? (answer.choice === "look" ? "better" : "chat") : "—";
      if (tagged === one.mode) agreed += 1;
      rows.push(`| ${one.label} | ${one.mode === "better" ? "✨ Better UI" : "💬 Chat"} | ${tagged === "better" ? "✨ Better UI" : tagged === "chat" ? "💬 Chat" : "—"} | ${answer?.type === "choice" ? answer.confidence.toFixed(2) : "—"} |`);
    });
    const top = pick?.type === "choice" ? Object.entries(pick.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => SUGGESTIONS[Number(k.slice(1)) - 1]?.label) : [];
    console.log(`LIVE EVAL suggestions: ${agreed} of ${SUGGESTIONS.length} tagged as wanted, in one call of ${ms} ms; Jev's top three: ${top.join(" · ")}\n${rows.join("\n")}`);
    expect(agreed).toBeGreaterThan(0);
  }, 120_000);
});
