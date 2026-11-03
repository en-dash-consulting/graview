import type { HostAi } from "@graview/tools";
import { useEffect, useMemo, useRef, useState } from "react";

/*
 * SUGGESTED, IN THE MENU (Roadmap f-make-any-page-better): two or three
 * things worth doing here, each tagged with the way it goes — 💬 Chat
 * (records, structure, broader asks) or ✨ Better UI (how this looks). From
 * what worked here before, the obvious acts on what is under the cursor,
 * and the nudges a part gives (a field its rows do not show, a list with
 * dates not sorted by them) — the nudge that teaches a person the page can
 * be changed. The menu opens at once with them in their first order, the
 * rows' room held from the start; the Fast slot picks and tags them when
 * it answers, and nothing moves while the pointer rests on a row.
 */

/** A suggestion as the menu draws it. */
export interface MenuSuggestion {
  readonly key: string;
  /** The act alone, in words: never "like last time". */
  readonly label: string;
  readonly mode: "chat" | "better";
  readonly source: "told" | "act" | "nudge";
}

/** An act as the menu's rows offer it: its label, what it still asks, and what it was asked of. */
interface ActOffered {
  readonly id: string;
  readonly label: string;
  readonly destructive?: boolean;
  readonly setsAside?: true;
  readonly ties?: boolean;
  readonly provider: string;
  readonly open: readonly { readonly name: string; readonly optional?: boolean; readonly shape?: { readonly type: string; readonly options?: readonly string[] } }[];
}

/** A label as a row says it, folded to compare: no "…", no case, no spare spaces. */
const folded = (label: string) => label.replace(/\s*…\s*$/u, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * AN ACT FILLED IN, NEVER THE ROW AGAIN. A suggestion that says "Set the
 * status" over a row that says "Set the status …" offers nothing the rows
 * do not; a suggestion is the act with its answer in it — "Set the status
 * to Doing", the next of a choice after the one the record holds — or an
 * act that asks nothing said of the record by its name ("Mark “Book the
 * hall” done" for "Mark it done", "Finish “Book the van”"). An act whose answer cannot be guessed
 * (a name, a date, another record) is left to its row, as is one that
 * sets the record aside or loses it.
 */
export function filledActs(acts: readonly ActOffered[], record: Readonly<Record<string, unknown>> | undefined, optionWords: Readonly<Record<string, Readonly<Record<string, string>>>> = {}, name?: string): MenuSuggestion[] {
  if (!record) return [];
  const out: MenuSuggestion[] = [];
  const named: MenuSuggestion[] = [];
  for (const act of acts) {
    // A rule's repair is among the likeliest ("Finish “Pay the deposit”" where it is overdue); what loses or sets aside the record is not.
    if (act.destructive || act.setsAside || act.ties) continue;
    const asks = act.open.filter((one) => !one.optional);
    if (asks.length === 0 && act.open.length === 0 && name) {
      // "it", "this" or "this one" in the act's words is the record, by its name; else the name follows the act ("Finish “Book the van”").
      const said = act.label.replace(/\b(it|this one|this)\b/u, `“${name}”`);
      named.push({ key: `act:${act.id}`, label: said !== act.label ? said : `${act.label} “${name}”`, mode: "chat", source: "act" });
      continue;
    }
    const one = asks[0];
    if (asks.length !== 1 || one?.shape?.type !== "choice" || !one.shape.options || one.shape.options.length < 2) continue;
    const options = one.shape.options;
    const now = options.indexOf(String(record[one.name] ?? ""));
    const next = now >= 0 ? options[now + 1] : undefined;
    if (next === undefined) continue;
    const word = optionWords[one.name]?.[next] ?? next.replace(/[-_]+/g, " ").replace(/^./u, (first) => first.toUpperCase());
    out.push({ key: `act:${act.id}:${next}`, label: `${act.label.replace(/\s*…\s*$/u, "")} to ${word}`, mode: "chat", source: "act" });
  }
  return [...out, ...named];
}

/** What a suggestion would say that a row under it already says as it is: dropped. */
export function notARow(candidates: readonly MenuSuggestion[], rows: readonly string[]): MenuSuggestion[] {
  const said = new Set(rows.map(folded));
  return candidates.filter((one) => !said.has(folded(one.label)));
}

/** How many are shown: at most three, and the room for them held from the menu's first frame. */
export const SUGGESTED_MOST = 3;

/** The Fast slot the host gave, or its `decide`, where AI is not off. */
const fastOf = (ai: HostAi | undefined) => (ai === undefined || ai.off || ai.suggestOnOpen === false ? undefined : (ai.fast ?? (ai.decide ? { model: ai.name ?? "decide", decide: ai.decide } : undefined)));

type Answer = { readonly said: string; readonly order: readonly string[]; readonly modes: ReadonlyMap<string, MenuSuggestion["mode"]> };
/*
 * ASKED ONCE PER THING AND ITS STATE (as the inline AI's suggestions are,
 * FR-186): a menu opened again on the same record — the same object until
 * it changes — or on the same list with nothing changed draws what the Fast
 * slot answered before, in its first frame, and asks nothing.
 */
const ANSWERS = /* @__PURE__ */ new WeakMap<object, Map<string, Answer>>();
const answered = (depends: object | undefined, said: string) => (depends ? ANSWERS.get(depends)?.get(said) : undefined);

/** The first order, before the Fast slot answers: a nudge first where there is one, then what worked before, then the acts. */
function firstOrder(candidates: readonly MenuSuggestion[]): MenuSuggestion[] {
  const by = (source: MenuSuggestion["source"]) => candidates.filter((one) => one.source === source);
  const [nudges, told, acts] = [by("nudge"), by("told"), by("act")];
  const out: MenuSuggestion[] = [];
  const longest = Math.max(nudges.length, told.length, acts.length);
  for (let at = 0; at < longest; at++) for (const list of [nudges, told, acts]) if (list[at]) out.push(list[at]!);
  return out;
}

/**
 * The suggestions shown, in the Fast slot's order once it has answered for
 * this menu, each tagged by it; held as they are while `still` (the pointer
 * on a row). `asked` is what the menu is on, for the question.
 */
export function useSuggested(ai: HostAi | undefined, candidates: readonly MenuSuggestion[], asked: { readonly name: string; readonly opened: unknown; readonly better: boolean; readonly depends?: object }, still: boolean): readonly MenuSuggestion[] {
  const fast = fastOf(ai);
  const said = candidates.map((one) => `${one.key}\u0000${one.label}`).join("\u0001");
  const [fresh, setAnswer] = useState<Answer | null>(null);
  const answer = answered(asked.depends, said) ?? fresh;
  useEffect(() => {
    if (answered(asked.depends, said)) return;
    setAnswer(null);
    if (!fast || candidates.length === 0 || asked.opened === null || asked.opened === undefined) return;
    let live = true;
    const keyed = new Map(candidates.map((one, at) => [`s${at + 1}`, one]));
    const questions: Record<string, unknown> = {
      pick: { type: "choice", instructions: `Somebody right-clicked “${asked.name}” in an app. Which of these would they most likely want to do next?`, criteria: Object.fromEntries([...keyed].map(([key, one]) => [key, one.label])) },
    };
    if (asked.better)
      for (const [key, one] of keyed)
        questions[`about_${key}`] = {
          type: "choice",
          instructions: `Is “${one.label}” about how “${asked.name}” looks or is laid out, or about the records in it?`,
          criteria: { look: "How it looks or is laid out: style, size, what each row or card shows, its order or grouping", records: "The records themselves: changing, finishing, adding, assigning or asking about them" },
        };
    void fast
      .decide({ on: asked.name }, questions as never)
      .then((decided) => {
        ai?.meter?.({ tier: "fast", model: fast.model, inputTokens: decided.usage.inputTokens, outputTokens: decided.usage.outputTokens, interaction: "menu" });
        if (!live) return;
        const pick = decided.answers["pick"];
        const chance = (key: string) => (pick?.type === "choice" ? (pick.probabilities[key] ?? (pick.choice === key ? pick.confidence : 0)) : 0);
        const order = [...keyed.keys()].sort((a, b) => chance(b) - chance(a)).map((key) => keyed.get(key)!.key);
        const modes = new Map<string, MenuSuggestion["mode"]>();
        for (const [key, one] of keyed) {
          const about = decided.answers[`about_${key}`];
          if (about?.type === "choice") modes.set(one.key, about.choice === "look" ? "better" : "chat");
        }
        const one = { said, order, modes };
        if (asked.depends) {
          const kept = ANSWERS.get(asked.depends) ?? new Map<string, Answer>();
          kept.set(said, one);
          ANSWERS.set(asked.depends, kept);
        }
        setAnswer(one);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // Asked once per menu and per set of candidates; the slot is the host's, fixed for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, asked.opened, asked.depends, fast === undefined]);
  const shown = useMemo(() => {
    const ordered = answer && answer.said === said ? answer.order.map((key) => candidates.find((one) => one.key === key)!).filter(Boolean) : firstOrder(candidates);
    return ordered.slice(0, SUGGESTED_MOST).map((one) => ({ ...one, mode: answer?.modes.get(one.key) ?? one.mode }));
  }, [answer, said, candidates]);
  /* Nothing moves under a resting pointer: what was drawn stays until it leaves the rows. */
  const held = useRef(shown);
  if (!still) held.current = shown;
  return still ? held.current : shown;
}
