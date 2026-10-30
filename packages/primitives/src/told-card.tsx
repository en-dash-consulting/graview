import type { AnySchema, Principal, Store } from "@graview/core";
import { heldAlso, seenOnThisPage, toldListed } from "./told-listed.js";
export { seenOnThisPage, toldListed } from "./told-listed.js";
import { recordsOfTarget, type AiInteraction, type AiTarget } from "@graview/core/catalog";
import { similarTellings, tellingExamples, tellingOf, toldSeenBy, type Telling, type TellingDecided, type TellingDraft, type TellingExample, type TellingOutcome, type TellingRating, type TellingSlot, type ToldStore } from "@graview/core/told";
import type { AiDesk } from "@graview/react/provider";
import type { InlineResult } from "@graview/tools/inline-ai";
import { useEffect, useId, useState, type CSSProperties } from "react";
import type { AppPlan } from "./quick-ask-plan.js";

/**
 * WHAT A PERSON TELLS GRAVIEW, KEPT FROM THE ANSWER CARD (Roadmap
 * f-menu-learns), fetched with the card.
 *
 * Each Enter or reply on the card is one telling (`@graview/core/told`):
 * the words, what they were on (a kind and ids), the records they were read
 * as, the people they named, what was decided and by which slot, the time
 * it took, and — as the person goes on — how it ended and what they thought
 * of it. It goes to the host's door (`HostAi.told`); with none, nothing is
 * kept and the card draws no rating, because a press that keeps nothing
 * would say something untrue.
 */

/** The kind the words are on: the record's, the list's, the selection's first. */
export function kindOfTarget(store: Store<AnySchema>, target: AiTarget): string | undefined {
  if (target.on === "list") return target.kind;
  if (target.on === "lens") return target.kind;
  const first = recordsOfTarget(target)[0];
  return first ? store.graph.getNode(first)?.kind : undefined;
}

/** The tellings a reader may be suggested: those about records they see. */
export async function toldSeenHere(told: ToldStore, store: Store<AnySchema>, principal: Principal): Promise<readonly Telling[]> {
  return toldSeenBy(await toldListed(told), seenOnThisPage(store, principal));
}

/**
 * THE LIKE 👍 TELLINGS, AS EXAMPLES FOR THE SLOTS: the top three like the
 * words on this kind that were rated 👍 and are not excluded — given to Jev
 * and the light model by name, and their ids kept on the telling they
 * informed.
 */
export async function examplesHere(told: ToldStore | undefined, store: Store<AnySchema>, principal: Principal, words: string, target: AiTarget): Promise<{ readonly examples: readonly TellingExample[]; readonly ids: readonly string[] }> {
  if (!told) return { examples: [], ids: [] };
  const kind = kindOfTarget(store, target);
  // Never long in the way of an answer: what the host has not answered in a moment is not waited for.
  const seen = await Promise.race([toldSeenHere(told, store, principal), new Promise<readonly Telling[]>((resolve) => setTimeout(() => resolve([]), 400))]);
  const like = similarTellings(seen, { words, ...(kind ? { kind } : {}) }, { reader: principal, rated: true, most: 3 });
  return { examples: tellingExamples(like), ids: like.map((one) => one.telling.id) };
}

/** Which slot decided it, from the stages the entry timed. */
function slotOf(entry: AiInteraction): TellingSlot | undefined {
  const stages = new Set((entry.stages ?? []).map((one) => one.stage));
  if (stages.has("thinking")) return "full";
  if (stages.has("light")) return "light";
  if (stages.has("fast")) return "graph";
  return (entry.usage ?? []).some((usage) => usage.tier === "thinking") ? "full" : undefined;
}

/** What was decided: an act over N records, a plan, an open answer, or nothing it could do. */
function decidedOf(result: InlineResult, plan: AppPlan | { readonly refused: string } | undefined): TellingDecided {
  if (result.interaction.outcome === "failed" || (plan && "refused" in plan)) return { type: "refusal" };
  if (plan && "question" in plan) return plan.proposal ? { type: "plan", edits: plan.parts.length } : { type: "refusal" };
  const proposals = result.ghost?.proposals ?? [];
  if (proposals.length > 0) {
    const act = proposals[0]!.call.name;
    return { type: "act", act, records: new Set(proposals.map((one) => one.record ?? one.id)).size };
  }
  return { type: "answer" };
}

/** The records the words named as people: a proposal's values that are records, other than what it acts on. */
function peopleOf(store: Store<AnySchema>, result: InlineResult): readonly string[] {
  const people = new Set<string>();
  for (const proposal of result.ghost?.proposals ?? []) {
    for (const value of Object.values(proposal.call.args)) {
      if (typeof value === "string" && value !== proposal.record && store.graph.getNode(value)) people.add(value);
    }
  }
  return [...people];
}

/** The draft of one telling: the words, what they were on, what was decided and how long it took. */
export function tellingDraftOf(
  store: Store<AnySchema>,
  asked: {
    readonly words: string;
    readonly target: AiTarget;
    readonly result: InlineResult;
    readonly plan?: AppPlan | { readonly refused: string };
    readonly ms: number;
    readonly conversation?: string;
    readonly follows?: string;
    readonly examples?: readonly string[];
  },
): TellingDraft {
  const { target, result } = asked;
  const kind = kindOfTarget(store, target);
  const id = target.on === "record" || target.on === "field" ? target.id : undefined;
  const place = target.on === "lens" || target.on === "place" ? target.place : undefined;
  const reading = result.reading ? { which: result.reading.which, kind: result.reading.kind, records: result.reading.records } : undefined;
  const people = peopleOf(store, result);
  const slot = slotOf(result.interaction);
  const decided = decidedOf(result, asked.plan);
  return {
    words: asked.words,
    target: { on: target.on, ...(kind ? { kind } : {}), ...(id ? { id } : {}), ...(place ? { place } : {}) },
    ...(reading ? { reading } : {}),
    ...(people.length > 0 ? { people } : {}),
    decided,
    ...(slot ? { slot } : {}),
    ...(result.interaction.stages ? { stages: result.interaction.stages } : {}),
    ms: asked.ms,
    outcome: "previewed",
    ...(asked.conversation ? { conversation: asked.conversation } : {}),
    ...(asked.follows ? { follows: asked.follows } : {}),
    interaction: result.interaction.id,
    ...(asked.examples && asked.examples.length > 0 ? { examples: asked.examples } : {}),
  };
}

/** Kept with the host, as the person: the telling, or nothing for a visitor or a door that is not there. */
export function keepTelling(told: ToldStore | undefined, draft: TellingDraft, by: Principal): Telling | undefined {
  if (!told) return undefined;
  const telling = tellingOf(draft, by);
  if (!telling) return undefined;
  heldAlso(told, telling);
  void Promise.resolve()
    .then(() => told.add(telling))
    .catch(() => undefined);
  return telling;
}

/** A change to a kept telling, handed to the host and never awaited. */
export function changeTelling(told: ToldStore | undefined, id: string, change: Parameters<ToldStore["change"]>[1]): void {
  if (!told) return;
  void Promise.resolve()
    .then(() => told.change(id, change))
    .catch(() => undefined);
}

/** How an interaction's entry ended, as a telling says it. */
const OUTCOME_OF: Partial<Record<AiInteraction["outcome"], TellingOutcome>> = { accepted: "accepted", partly: "accepted", drawn: "accepted", dismissed: "declined" };

/**
 * HOW IT ENDED, HEARD FROM THE DESK: the change it proposed accepted (on the
 * card or on the tray once the card is put away), dismissed, or undone — an
 * undo a quiet sign, never a 👎. Heard until it is undone, or for half an
 * hour.
 */
export function watchTelling(desk: AiDesk, told: ToldStore, telling: Telling): () => void {
  let said: TellingOutcome | undefined;
  const hear = () => {
    const entry = desk.get().entries.find((one) => one.id === telling.interaction);
    if (!entry) return;
    const outcome = entry.undone ? "undone" : OUTCOME_OF[entry.outcome];
    if (!outcome || outcome === said) return;
    said = outcome;
    changeTelling(told, telling.id, { outcome });
    if (outcome === "undone") stop();
  };
  const unsubscribe = desk.subscribe(hear);
  const timer = setTimeout(() => stop(), 30 * 60_000);
  const stop = () => {
    unsubscribe();
    clearTimeout(timer);
  };
  return stop;
}

/**
 * 👍 AND 👎 AT THE FOOT OF AN ANSWERED CARD: quiet, reachable from the
 * keyboard, named "This was right" and "This was wrong"; a rating changed
 * while the card is open; a 👎 offers one optional line, "What should it
 * have done?", kept with the telling.
 */
export function RateTelling({ told, telling }: { readonly told: ToldStore; readonly telling: Telling }) {
  const [rating, setRating] = useState<TellingRating | undefined>(telling.rating);
  const [should, setShould] = useState("");
  const [kept, setKept] = useState(false);
  const field = useId();
  useEffect(() => {
    setRating(telling.rating);
    setShould("");
    setKept(false);
  }, [telling.id, telling.rating]);
  const rate = (next: TellingRating) => {
    const now = rating === next ? undefined : next;
    setRating(now);
    setKept(false);
    changeTelling(told, telling.id, { rating: now ?? null });
  };
  const keepShould = () => {
    const words = should.trim();
    if (!words || rating !== "down") return;
    changeTelling(told, telling.id, { should: words });
    setKept(true);
  };
  return (
    <div data-testid="quick-ask-rating" data-rating={rating ?? ""} style={{ display: "grid", gap: 6 }}>
      <div role="group" aria-label="Was this right?" style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
        <button type="button" data-testid="quick-ask-right" aria-label="This was right" title="This was right" aria-pressed={rating === "up"} onClick={() => rate("up")} style={rating === "up" ? THUMB_ON : THUMB}>
          <span aria-hidden="true">👍</span>
        </button>
        <button type="button" data-testid="quick-ask-wrong" aria-label="This was wrong" title="This was wrong" aria-pressed={rating === "down"} onClick={() => rate("down")} style={rating === "down" ? THUMB_ON : THUMB}>
          <span aria-hidden="true">👎</span>
        </button>
      </div>
      {rating === "down" ? (
        <div style={{ display: "grid", gap: 2 }}>
          <label htmlFor={field} style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
            What should it have done? <span style={{ color: "var(--graview-ink-faint)" }}>(optional)</span>
          </label>
          <input
            id={field}
            type="text"
            data-testid="quick-ask-should"
            value={should}
            maxLength={300}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(event) => {
              setShould(event.target.value);
              setKept(false);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              keepShould();
            }}
            onBlur={keepShould}
            style={SHOULD}
          />
          {kept ? (
            <span role="status" data-testid="quick-ask-should-kept" style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>
              Kept, to learn from.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const THUMB: CSSProperties = { display: "inline-grid", placeItems: "center", width: 30, height: 28, padding: 0, font: "inherit", fontSize: "0.875rem", lineHeight: 1, background: "transparent", border: "1px solid transparent", borderRadius: 6, boxShadow: "none", cursor: "pointer", opacity: 0.7 };
const THUMB_ON: CSSProperties = { ...THUMB, opacity: 1, borderColor: "var(--graview-accent)", background: "var(--graview-panel)" };
const SHOULD: CSSProperties = { boxSizing: "border-box", width: "100%", height: 32, padding: "0 8px", font: "inherit", fontSize: "max(1rem,16px)", color: "var(--graview-ink)", background: "var(--graview-panel)", border: "1px solid var(--graview-edge)", borderRadius: 8 };
