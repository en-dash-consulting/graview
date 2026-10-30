/**
 * `@graview/tools/inline-ai` — THE INLINE AI: A PICK AMONG WHAT THE APP
 * ALREADY KNOWS, PREVIEWED BEFORE IT IS KEPT (Roadmap f-ai-candidate-catalog).
 *
 * Pointed at something, the inline AI asks a model to choose among the
 * catalog's candidates (`catalogOf`, `@graview/core/catalog`) over the
 * state the viewer may see (`aiContextOf`) — never to invent an act, a
 * field or a record:
 *
 *  - `suggestHere` asks which few candidates the person most likely wants
 *    there: the Fast slot as one typed Choice, else the Thinking slot for
 *    JSON naming candidates;
 *  - `fillHere` asks a Choice per field the record could be filled in on,
 *    in one call, and answers the fills as proposals;
 *  - `panelHere` asks the Thinking slot (else the Fast one) which panel to
 *    draw, and answers its recipe, which `@graview/tools/draft` draws and
 *    "Keep as a lens" keeps;
 *  - `answerHere` answers words asked from the command bar or on an answer
 *    card (the quick ask): the host's Answer slot, else the Thinking slot,
 *    for prose and the candidates that act on it, else the Fast slot's
 *    pick among the candidates.
 *
 * A proposed change is a GHOST (`ghostOf`): each call rehearsed as the
 * person and said in the act's own sentence, applied only when they accept
 * all of it or some (`acceptGhost`) — as one batch, so one undo takes it
 * back, whose ops carry lineage `interaction: <id>` and come through
 * `ai:<interaction>`. Every call to a model reports its tier, model and
 * tokens, to the interaction's entry and to the host's `meter`.
 *
 * The slots are the host's (`HostAi.fast`, `HostAi.thinking`): Jev
 * (`jevFast`) for the Fast one, any language model for the Thinking one,
 * and stubs (`stubFast`, `stubThinking`) for tests and a dev app. Fetched
 * when the inline AI is first opened: a page whose reader never right-
 * clicks carries none of it.
 */
import { argumentsTaken, labelOf, pluralOf, recordFriction, type AnySchema, type AppPurpose, type Author, type MutationCall, type Principal, type Store } from "@graview/core";
import {
  aiContextOf,
  catalogOf,
  type AiCandidate,
  type AiCatalog,
  type AiContextSent,
  type AiContextState,
  type AiInteraction,
  type AiOffered,
  type AiPanel,
  type AiTarget,
  type AiUsage,
  type CatalogAct,
  type CatalogPlace,
  type PanelCandidate,
} from "@graview/core/catalog";
import type { AiPrice, AnswerProvider, AnswerReply, FastProvider, HostAi, ThinkingProvider } from "./ai.js";
import { firstJsonObject } from "./intelligence.js";
import type { Answer, ChoiceAnswer } from "./fast.js";
import { JEV_INPUT_USD_PER_MILLION, JEV_MODEL, jevDecide, type JevOptions } from "./providers/jev.js";
import type { ChoiceQuestion, Question } from "./questions.js";

// ── the slots ───────────────────────────────────────────────────────────────

/** The Fast slot as the host filled it, else its `decide` behind it. */
export function fastOf(ai: HostAi): FastProvider | undefined {
  if (ai.off) return undefined;
  return ai.fast ?? (ai.decide ? { model: ai.name ?? "decide", decide: ai.decide } : undefined);
}

/** Whether a menu asks for suggestions as it opens (FR-185): `ai.ts`'s, here too for the runner. */
export { HOVER_CHIP_CONFIDENCE, suggestsOnOpen } from "./ai.js";

/** The Thinking slot as the host filled it, else its `complete` (or its `turn`, with no tools) behind it. */
export function thinkingOf(ai: HostAi): ThinkingProvider | undefined {
  if (ai.off) return undefined;
  if (ai.thinking) return ai.thinking;
  const model = ai.name ?? "model";
  if (ai.complete) {
    const complete = ai.complete;
    return { model, think: ({ system, prompt }) => complete({ prompt, system }) };
  }
  if (ai.turn) {
    const turn = ai.turn;
    return { model, think: async ({ system, prompt }) => ({ text: await turn({ system, messages: [{ role: "user", content: prompt }], tools: [], call: async () => ({ error: "No tools here." }) }) }) };
  }
  return undefined;
}

/** JEV IN THE FAST SLOT: `jevDecide` with its model and its price, for a host that holds a TypeSafe key or a bridge to one. */
export function jevFast(options: JevOptions = {}): FastProvider {
  return { model: options.model ?? JEV_MODEL, decide: jevDecide(options), price: { inputPerMillion: JEV_INPUT_USD_PER_MILLION } };
}

const costOf = (price: AiPrice | undefined, inputTokens: number, outputTokens: number): number | undefined =>
  price ? (inputTokens / 1_000_000) * (price.inputPerMillion ?? 0) + (outputTokens / 1_000_000) * (price.outputPerMillion ?? 0) : undefined;

// ── what one ask is made of ─────────────────────────────────────────────────

/** Where the inline AI was opened, and as whom. */
export interface InlineAsk<S extends AnySchema = AnySchema> {
  readonly store: Store<S>;
  readonly target: AiTarget;
  readonly principal: Principal;
  /** Who the entry says asked, when not the principal itself. */
  readonly by?: Author;
  /** The acts the derivation offers here, when the face has them. */
  readonly acts?: readonly CatalogAct[];
  readonly places?: readonly CatalogPlace[];
  /** The place the viewer is on, and what else is selected. */
  readonly place?: string;
  readonly selection?: readonly string[];
  /** Words the person typed, for a panel or an ask. */
  readonly said?: string;
  /** The interaction's id, when the face made one; else one is made. */
  readonly interaction?: string;
  /** The app's purpose (`app.purpose`, Roadmap f-app-jobs): who it is for and this viewer's jobs, said to the model in its state. */
  readonly purpose?: AppPurpose;
}

/** One proposed change, as a ghost draws it and an acceptance applies it. */
export interface Proposal {
  /** The candidate it came from. */
  readonly id: string;
  readonly label: string;
  /** What accepting it does, in the act's own sentence. */
  readonly said: string;
  readonly call: MutationCall;
  readonly confidence?: number;
  readonly record?: string;
  readonly field?: string;
}

/** CHANGES PROPOSED AND NOT MADE: previewed for the person, who accepts all of them, some, or none. */
export interface Ghost {
  readonly interaction: string;
  readonly target: AiTarget;
  /** What was asked, in words: the lineage's basis when it is kept. */
  readonly basis: string;
  readonly model?: string;
  readonly proposals: readonly Proposal[];
}

/** What an ask came to: the entry, and what it offers — suggestions, a ghost, a panel, or an answer in words. */
export interface InlineResult {
  readonly interaction: AiInteraction;
  /** The candidates picked, best first, each ready to take with one press. */
  readonly offers: readonly AiCandidate[];
  readonly ghost?: Ghost;
  readonly panel?: AiPanel;
  /** A quick ask's answer, in words. */
  readonly answer?: string;
  /**
   * WHAT THE APP LACKS FOR IT (Roadmap f-menu-type-anything): the model found
   * no act that can do what was asked because the app has no field, link or
   * kind for it — said plainly ("Tasks have no one to assign them to."), the
   * traits that would bring it (`TRAITS`), and the person the words name, to
   * make or find. The face composes the whole plan from it.
   */
  readonly missing?: AnswerMissing;
}

/** What an answer found the app lacks, and what would finish the ask. */
export interface AnswerMissing {
  readonly said: string;
  readonly add: readonly string[];
  /** The record the words name, by its name ("Nick"), to find or make. */
  readonly who?: string;
  /** The act to run over every record asked about once the app has it, by what it does ("give it to someone"): the plan finds it in the changed app. */
  readonly then?: string;
}

/** A fresh interaction id: `ai-` and something unique enough for one app's history. */
export const interactionId = (): string => `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The target in words: a record's name, a kind's plural, a place's title. */
export function targetWords<S extends AnySchema>(store: Store<S>, target: AiTarget, places: readonly CatalogPlace[] = []): string {
  const name = (id: string) => {
    const node = store.graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
    return node ? labelOf(store.schema.tryDefinition(node.kind), node as never) : "a record";
  };
  switch (target.on) {
    case "record":
      return name(target.id);
    case "field":
      return `${name(target.id)} · ${target.field}`;
    case "selection":
      return `${target.ids.length} records`;
    case "list":
      return store.schema.tryDefinition(target.kind) ? pluralOf(store.schema, target.kind) : target.kind;
    case "lens":
    case "place":
      return places.find((place) => place.as === target.place)?.title ?? (target.place === "home" ? "Home" : target.place);
    case "act":
      return target.act;
  }
}

/** A candidate one press takes: no act that still asks for something. */
const ready = (candidate: AiCandidate): boolean => candidate.type !== "act" || candidate.asks.length === 0;

const offeredOf = (candidate: AiCandidate, confidence?: number): AiOffered => ({ id: candidate.id, type: candidate.type, label: candidate.label, ...(confidence !== undefined ? { confidence } : {}) });

interface Asked {
  readonly id: string;
  readonly catalog: AiCatalog;
  readonly state: AiContextState;
  readonly entry: Omit<AiInteraction, "ask" | "offered" | "outcome">;
  readonly usage: AiUsage[];
  readonly meter: (usage: AiUsage) => void;
}

function begin<S extends AnySchema>(ai: HostAi, ask: InlineAsk<S>): Asked {
  const id = ask.interaction ?? interactionId();
  const catalog = catalogOf(ask.store, ask.target, { principal: ask.principal, ...(ask.acts ? { acts: ask.acts } : {}), ...(ask.places ? { places: ask.places } : {}) });
  const state = aiContextOf(ask.store, ask.target, { principal: ask.principal, ...(ask.place ? { place: ask.place } : {}), ...(ask.selection ? { selection: ask.selection } : {}), ...(ask.purpose ? { purpose: ask.purpose } : {}) });
  const usage: AiUsage[] = [];
  return {
    id,
    catalog,
    state,
    entry: { id, at: new Date().toISOString(), by: ask.by ?? ask.principal, target: ask.target, targetLabel: targetWords(ask.store, ask.target, ask.places) },
    usage,
    meter: (one) => {
      usage.push(one);
      ai.meter?.({ ...one, interaction: id });
    },
  };
}

/** One decision, its usage reported. */
async function decided(fast: FastProvider, state: unknown, questions: Readonly<Record<string, Question>>, meter: (usage: AiUsage) => void): Promise<Readonly<Record<string, Answer>>> {
  const answer = await fast.decide(state, questions);
  const { inputTokens, outputTokens } = answer.usage;
  const cost = costOf(fast.price, inputTokens, outputTokens);
  meter({ tier: "fast", model: fast.model, inputTokens, outputTokens, ...(cost !== undefined ? { costUsd: cost } : {}) });
  return answer.answers;
}

/** One request to the thinking model, its usage reported. */
async function thought(thinking: ThinkingProvider, system: string, prompt: string, asked: Asked, meter: (usage: AiUsage) => void): Promise<unknown> {
  const reply = await thinking.think({ system, prompt, state: asked.state, catalog: asked.catalog });
  const inputTokens = reply.usage?.inputTokens;
  const outputTokens = reply.usage?.outputTokens;
  const cost = reply.usage?.costUsd ?? (inputTokens !== undefined ? costOf(thinking.price, inputTokens, outputTokens ?? 0) : undefined);
  meter({ tier: "thinking", model: thinking.model, ...(inputTokens !== undefined ? { inputTokens } : {}), ...(outputTokens !== undefined ? { outputTokens } : {}), ...(cost !== undefined ? { costUsd: cost } : {}) });
  return firstJsonObject(reply.text);
}

/** A choice among candidates, keyed `c1`, `c2`… — an option's name is a key, not an id that may hold anything. */
function choiceAmong(candidates: readonly AiCandidate[], instructions: string): { readonly question: ChoiceQuestion; readonly of: (key: string) => AiCandidate | undefined } {
  const keyed = new Map(candidates.map((candidate, at) => [`c${at + 1}`, candidate]));
  return {
    question: { type: "choice", instructions, criteria: Object.fromEntries([...keyed].map(([key, candidate]) => [key, `${candidate.label} — ${candidate.description}`])) },
    of: (key) => keyed.get(key),
  };
}

/** The candidates a choice's probabilities rank, best first. */
function ranked(answer: Answer | undefined, of: (key: string) => AiCandidate | undefined, most: number): { readonly candidate: AiCandidate; readonly confidence: number }[] {
  if (answer?.type !== "choice") return [];
  const choice = answer as ChoiceAnswer;
  const order = Object.entries(choice.probabilities).sort((a, b) => b[1] - a[1]);
  if (!order.some(([key]) => key === choice.choice)) order.unshift([choice.choice, choice.confidence]);
  return order.flatMap(([key, confidence]) => {
    const candidate = of(key);
    return candidate ? [{ candidate, confidence }] : [];
  }).slice(0, most);
}

const failedResult = (asked: Asked, ask: string | undefined, kind: AiInteraction["ask"]["kind"], why: string): InlineResult => ({
  interaction: { ...asked.entry, ask: { kind, said: ask ?? "" }, offered: [], outcome: "failed", failed: why, usage: [...asked.usage] },
  offers: [],
});

const NO_MODEL = "AI isn't on here.";

// ── a suggestion ────────────────────────────────────────────────────────────

/**
 * WHAT THE PERSON MOST LIKELY WANTS HERE: the Fast slot's pick among the
 * candidates one press takes (a fill, an act that asks nothing, a panel, a
 * place, a record), its top few kept; or the Thinking slot's, as JSON
 * naming candidate ids, when there is no Fast one. Nothing is changed.
 */
export async function suggestHere<S extends AnySchema>(ai: HostAi, ask: InlineAsk<S>, most = 3): Promise<InlineResult> {
  const asked = begin(ai, ask);
  const said = ask.said ?? "Suggest";
  const choices = asked.catalog.candidates.filter(ready).slice(0, 24);
  if (choices.length === 0) return { interaction: { ...asked.entry, ask: { kind: "suggest", said }, offered: [], outcome: "offered", usage: [] }, offers: [] };
  const fast = fastOf(ai);
  const thinking = thinkingOf(ai);
  let picked: { candidate: AiCandidate; confidence?: number }[] = [];
  try {
    if (fast) {
      const { question, of } = choiceAmong(choices, "Which of these would the person most likely want to do next, here?");
      const answers = await decided(fast, { ...asked.state, candidates: choices.map((candidate) => ({ id: candidate.id, type: candidate.type, says: candidate.description })) }, { next: question }, asked.meter);
      picked = ranked(answers["next"], of, most);
    } else if (thinking) {
      const parsed = (await thought(
        thinking,
        "You suggest what a person most likely wants to do next in an app. Answer only JSON: {\"pick\": [candidate ids, best first]}. Pick only ids from the candidates.",
        JSON.stringify({ state: asked.state, candidates: choices.map((candidate) => ({ id: candidate.id, says: candidate.description })) }),
        asked,
        asked.meter,
      )) as { pick?: unknown } | undefined;
      const ids = Array.isArray(parsed?.pick) ? parsed.pick.filter((one): one is string => typeof one === "string") : [];
      picked = ids.flatMap((id) => choices.filter((candidate) => candidate.id === id)).slice(0, most).map((candidate) => ({ candidate }));
    } else return failedResult(asked, said, "suggest", NO_MODEL);
  } catch (error) {
    return failedResult(asked, said, "suggest", error instanceof Error ? error.message : String(error));
  }
  return {
    interaction: { ...asked.entry, ask: { kind: "suggest", said }, offered: picked.map(({ candidate, confidence }) => offeredOf(candidate, confidence)), outcome: "offered", usage: [...asked.usage] },
    offers: picked.map(({ candidate }) => candidate),
  };
}

// ── several chosen ──────────────────────────────────────────────────────────

/** One act every chosen record shares, as the selection bar offers it (`actsForSeveral`). */
export interface SharedAct {
  /** The bar's own id for it. */
  readonly id: string;
  readonly label: string;
  readonly mutation: string;
  readonly args: Readonly<Record<string, unknown>>;
}

/** An ask about records chosen together: the acts they share, which the bar runs over every one. */
export interface SeveralAsk<S extends AnySchema = AnySchema> extends InlineAsk<S> {
  readonly shared: readonly SharedAct[];
}

/** The candidate id the selection bar's act is offered as. */
export const sharedActCandidate = (id: string): string => `several:${id}`;

/**
 * WHAT TO DO WITH THE RECORDS CHOSEN TOGETHER: the Fast slot's pick among
 * the acts they all share that ask nothing more (each run over every one by
 * the bar), the panels of their kind and the places that show them — its
 * top few, each with how sure it was. ONLY EVER THE FAST SLOT: with none,
 * nothing is asked, and the bar offers its acts alone. Nothing is changed.
 */
export async function suggestForSeveral<S extends AnySchema>(ai: HostAi, ask: SeveralAsk<S>, most = 2): Promise<InlineResult> {
  const asked = begin(ai, { ...ask, acts: [] });
  const said = ask.said ?? "Suggest for the chosen";
  const count = ask.target.on === "selection" ? ask.target.ids.length : 1;
  const acts: AiCandidate[] = ask.shared.map((act) => ({ type: "act", id: sharedActCandidate(act.id), label: act.label, description: `${act.label}, for all ${count} chosen`, mutation: act.mutation, args: act.args, asks: [] }));
  const choices = [...acts, ...asked.catalog.candidates.filter((candidate) => candidate.type === "panel" || candidate.type === "place")].slice(0, 24);
  const fast = fastOf(ai);
  if (!fast) return failedResult(asked, said, "suggest", NO_MODEL);
  if (choices.length === 0) return { interaction: { ...asked.entry, ask: { kind: "suggest", said }, offered: [], outcome: "offered", usage: [] }, offers: [] };
  let picked: { candidate: AiCandidate; confidence: number }[];
  try {
    const { question, of } = choiceAmong(choices, `Which of these would the person most likely want to do next with the ${count} records they chose together?`);
    const answers = await decided(fast, { ...asked.state, candidates: choices.map((candidate) => ({ id: candidate.id, type: candidate.type, says: candidate.description })) }, { next: question }, asked.meter);
    // The first always; another only where the model gave it a fair chance — the bar is no place for a long shot.
    picked = ranked(answers["next"], of, most).filter((pick, at) => at === 0 || pick.confidence >= SEVERAL_SECOND);
  } catch (error) {
    return failedResult(asked, said, "suggest", error instanceof Error ? error.message : String(error));
  }
  return {
    interaction: { ...asked.entry, ask: { kind: "suggest", said }, offered: picked.map(({ candidate, confidence }) => offeredOf(candidate, confidence)), outcome: "offered", usage: [...asked.usage] },
    offers: picked.map(({ candidate }) => candidate),
  };
}

/** How sure the Fast slot must be of a second suggestion for the selection bar to offer it too. */
const SEVERAL_SECOND = 0.25;

// ── fills ───────────────────────────────────────────────────────────────────

/**
 * THE RECORD FILLED IN: one typed Choice per field or relation the catalog
 * offers values for, asked in one call of the Fast slot (else the Thinking
 * slot, for JSON naming one candidate per field), answered as a ghost of
 * the chosen fills, each with its confidence. Nothing is changed.
 */
export async function fillHere<S extends AnySchema>(ai: HostAi, ask: InlineAsk<S>): Promise<InlineResult> {
  const asked = begin(ai, ask);
  const said = ask.said ?? "Fill in";
  const fills = asked.catalog.candidates.filter((candidate) => candidate.type === "fill");
  const byField = new Map<string, AiCandidate[]>();
  for (const fill of fills) byField.set(fill.field, [...(byField.get(fill.field) ?? []), fill]);
  if (byField.size === 0) return { interaction: { ...asked.entry, ask: { kind: "fill", said }, offered: [], outcome: "offered", usage: [] }, offers: [] };
  const fast = fastOf(ai);
  const thinking = thinkingOf(ai);
  const chosen: { candidate: AiCandidate; confidence?: number }[] = [];
  try {
    if (fast) {
      const asking = [...byField].map(([field, options], at) => ({ key: `f${at + 1}`, field, ...choiceAmong(options, `Which value fits "${field}" best for this record?`) }));
      const answers = await decided(fast, asked.state, Object.fromEntries(asking.map((one) => [one.key, one.question])), asked.meter);
      for (const one of asking) {
        // A relation that holds many may take more than one: the likely ones, the first always.
        const many = !isField(ask.store, ask.target, one.field) && cardinalityOf(ask.store, ask.target, one.field) !== "one";
        chosen.push(...ranked(answers[one.key], one.of, many ? 3 : 1).filter((pick, at) => at === 0 || pick.confidence >= 0.4));
      }
    } else if (thinking) {
      const parsed = (await thought(
        thinking,
        "You fill in a record's fields in an app. Answer only JSON: {\"fills\": [candidate ids]}, at most one per field, only ids from the candidates.",
        JSON.stringify({ state: asked.state, candidates: fills.map((candidate) => ({ id: candidate.id, says: candidate.description })) }),
        asked,
        asked.meter,
      )) as { fills?: unknown } | undefined;
      const ids = Array.isArray(parsed?.fills) ? parsed.fills.filter((one): one is string => typeof one === "string") : [];
      const once = new Set<string>();
      for (const id of ids) {
        const candidate = fills.find((one) => one.id === id);
        if (candidate?.type === "fill" && !once.has(candidate.field)) {
          once.add(candidate.field);
          chosen.push({ candidate });
        }
      }
    } else return failedResult(asked, said, "fill", NO_MODEL);
  } catch (error) {
    return failedResult(asked, said, "fill", error instanceof Error ? error.message : String(error));
  }
  const model = asked.usage.at(-1)?.model;
  const ghost = ghostOf(ask.store, {
    interaction: asked.id,
    target: ask.target,
    basis: said,
    ...(model ? { model } : {}),
    proposals: chosen.flatMap(({ candidate, confidence }) => (candidate.type === "fill" ? [{ id: candidate.id, label: candidate.label, said: candidate.description, call: candidate.call, record: candidate.record, field: candidate.field, ...(confidence !== undefined ? { confidence } : {}) }] : [])),
  }, ask.principal);
  return {
    interaction: { ...asked.entry, ask: { kind: "fill", said }, offered: ghost.proposals.map((proposal) => ({ id: proposal.id, type: "fill" as const, label: proposal.label, ...(proposal.confidence !== undefined ? { confidence: proposal.confidence } : {}) })), outcome: "offered", usage: [...asked.usage] },
    offers: [],
    ...(ghost.proposals.length > 0 ? { ghost } : {}),
  };
}

/** Whether a name is one of the target record's fields, not one of its relations. */
function isField<S extends AnySchema>(store: Store<S>, target: AiTarget, name: string): boolean {
  const id = target.on === "record" || target.on === "field" ? target.id : undefined;
  const kind = id ? store.graph.getNode(id)?.kind : undefined;
  const shape = (kind ? (store.schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape : undefined) ?? {};
  return name in shape;
}

/** How many a relation of the target record holds: "one", or many. */
function cardinalityOf<S extends AnySchema>(store: Store<S>, target: AiTarget, edge: string): string | undefined {
  const id = target.on === "record" || target.on === "field" ? target.id : undefined;
  const kind = id ? store.graph.getNode(id)?.kind : undefined;
  return kind ? (store.schema.tryDefinition(kind) as { edges?: Record<string, { cardinality?: string }> } | undefined)?.edges?.[edge]?.cardinality : undefined;
}

// ── a record ────────────────────────────────────────────────────────────────

/**
 * A RECORD PROPOSED: the Thinking slot fills in the arguments of one of
 * the catalog's acts that makes a record (one that still asks for words),
 * and the call is a ghost like any fill — previewed, accepted or not, kept
 * as one batch. The model fills only what the act asks; the act, its
 * subject and everything the target settled stay the catalog's.
 */
export async function recordHere<S extends AnySchema>(ai: HostAi, ask: InlineAsk<S>): Promise<InlineResult> {
  const asked = begin(ai, ask);
  const said = ask.said ?? "Add one";
  const makes = new Set(ask.store.allMutations().filter((mutation) => (mutation.creates ?? []).length > 0).map((mutation) => mutation.name));
  const acts = asked.catalog.candidates.filter((candidate): candidate is Extract<AiCandidate, { type: "act" }> => candidate.type === "act" && candidate.asks.length > 0 && makes.has(candidate.mutation));
  if (acts.length === 0) return failedResult(asked, said, "record", "Nothing here makes a record.");
  const thinking = thinkingOf(ai);
  if (!thinking) return failedResult(asked, said, "record", NO_MODEL);
  let picked: { act: Extract<AiCandidate, { type: "act" }>; args: Record<string, unknown> } | undefined;
  try {
    const parsed = (await thought(
      thinking,
      'You propose one new record for an app by filling in an act. Answer only JSON: {"act": a candidate id, "args": {argument: value}}. Use only the candidates, and fill every argument the act asks for with a value that fits the state.',
      JSON.stringify({ ask: said, state: asked.state, candidates: acts.map((act) => ({ id: act.id, says: act.description, asks: act.asks })) }),
      asked,
      asked.meter,
    )) as { act?: unknown; args?: unknown } | undefined;
    const act = acts.find((one) => one.id === parsed?.act);
    const args = typeof parsed?.args === "object" && parsed.args !== null ? (parsed.args as Record<string, unknown>) : {};
    // Only what the act asks: an argument the catalog settled is never the model's to change.
    if (act) picked = { act, args: Object.fromEntries(Object.entries(args).filter(([name]) => act.asks.includes(name))) };
  } catch (error) {
    return failedResult(asked, said, "record", error instanceof Error ? error.message : String(error));
  }
  if (!picked) return failedResult(asked, said, "record", "The model named no act this app has here.");
  const model = asked.usage.at(-1)?.model;
  const ghost = ghostOf(ask.store, { interaction: asked.id, target: ask.target, basis: said, ...(model ? { model } : {}), proposals: [{ id: picked.act.id, label: picked.act.label, said: picked.act.description, call: { name: picked.act.mutation, args: { ...picked.act.args, ...picked.args } } }] }, ask.principal);
  if (ghost.proposals.length === 0) return failedResult(asked, said, "record", "What the model proposed could not be made here.");
  return {
    interaction: { ...asked.entry, ask: { kind: "record", said }, offered: ghost.proposals.map((proposal) => ({ id: proposal.id, type: "act" as const, label: proposal.said })), outcome: "offered", usage: [...asked.usage] },
    offers: [picked.act],
    ghost,
  };
}

// ── a panel ─────────────────────────────────────────────────────────────────

/**
 * A PANEL DRAWN FOR THE TARGET: the Thinking slot names one of the
 * catalog's panels and a title (else the Fast slot picks one). Answered as
 * its recipe, which `recipeDraft` (`@graview/tools/draft`) draws exactly
 * as a view the seat drew, and "Keep as a lens" keeps.
 */
export async function panelHere<S extends AnySchema>(ai: HostAi, ask: InlineAsk<S>): Promise<InlineResult> {
  const asked = begin(ai, ask);
  const said = ask.said ?? "Make a panel";
  const panels = asked.catalog.candidates.filter((candidate): candidate is PanelCandidate => candidate.type === "panel");
  if (panels.length === 0) return failedResult(asked, said, "panel", "Nothing here can be drawn as a panel.");
  const fast = fastOf(ai);
  const thinking = thinkingOf(ai);
  let pick: { panel: PanelCandidate; title?: string; confidence?: number } | undefined;
  try {
    if (thinking) {
      const parsed = (await thought(
        thinking,
        "You choose a panel to draw in an app. Answer only JSON: {\"panel\": a candidate id, \"title\": a short title}. Choose only among the candidates.",
        JSON.stringify({ ask: said, state: asked.state, candidates: panels.map((candidate) => ({ id: candidate.id, says: candidate.description })) }),
        asked,
        asked.meter,
      )) as { panel?: unknown; title?: unknown } | undefined;
      const found = panels.find((candidate) => candidate.id === parsed?.panel);
      if (found) pick = { panel: found, ...(typeof parsed?.title === "string" && parsed.title.trim() ? { title: parsed.title.trim().slice(0, 60) } : {}) };
    } else if (fast) {
      const { question, of } = choiceAmong(panels, `Which panel answers this best: ${said}`);
      const best = ranked((await decided(fast, asked.state, { panel: question }, asked.meter))["panel"], of, 1)[0];
      if (best?.candidate.type === "panel") pick = { panel: best.candidate, confidence: best.confidence };
    } else return failedResult(asked, said, "panel", NO_MODEL);
  } catch (error) {
    return failedResult(asked, said, "panel", error instanceof Error ? error.message : String(error));
  }
  if (!pick) return failedResult(asked, said, "panel", "The model named no panel this app can draw.");
  const title = pick.title ?? pick.panel.label;
  const panel: AiPanel = { title, recipe: { ...pick.panel.panel, title } };
  return {
    interaction: { ...asked.entry, ask: { kind: "panel", said }, offered: [offeredOf(pick.panel, pick.confidence)], outcome: "drawn", panel, usage: [...asked.usage] },
    offers: [pick.panel],
    panel,
  };
}

// ── a quick ask ─────────────────────────────────────────────────────────────

/** The Answer slot as the host filled it; else none, and the Thinking or Fast slot answers. */
export function answerOf(ai: HostAi): AnswerProvider | undefined {
  return ai.off ? undefined : ai.answer;
}

/** A quick ask: the inline ask, with the ask it follows on the same card. */
export interface QuickAsk<S extends AnySchema = AnySchema> extends InlineAsk<S> {
  readonly said: string;
  /**
   * THE RECORDS A LIST OR A PLACE SHOWS, asked about as one ("all the tasks
   * in this list"): the model may answer with one act over every one of
   * them, previewed whole as one change.
   */
  readonly members?: readonly string[];
  /** The traits the app could take (`TRAITS`, said in words), offered where the model finds the app lacks what was asked. */
  readonly traits?: readonly { readonly trait: string; readonly says: string }[];
  /** The ask before this one on the card, and what it was answered: a follow-up, not a thread. */
  readonly follows?: { readonly said: string; readonly answer: string };
}

const ANSWER_SYSTEM =
  'You answer a person\'s question about what they are looking at in an app, from the state given and nothing else. Answer only JSON: {"answer": one to three short sentences, "pick": [candidate ids that act on the answer, best first, at most three]}. Pick only ids from the candidates, and none when nothing fits. Never say an id to the person. ' +
  'Where "members" are given and the person asks for something done to every one of them, answer "each": {"act": the name of one of "member_acts", "args": the values it asks for, by name} — one act over every member, as one change. ' +
  'Where no act can do what they ask because the app has no field, link or kind for it, answer "lacks": one plain sentence of what the app is missing (never an id), "add": [the names of "traits" that would bring it], "who": the name of the record their words name, if any, and "then": what is to be done to each member once the app has it, in a few words.';

/**
 * WORDS ASKED ABOUT WHAT THE PERSON IS ON (the quick ask): answered in a
 * few sentences, with the catalog's candidates that act on the answer —
 * a change among them is a ghost, previewed as the person and kept only
 * when accepted; a place, a record or a panel is one press on the card.
 * The host's Answer slot answers when given; else the Thinking slot, as
 * JSON; else the Fast slot picks the candidates that fit the words. A
 * follow-up carries the ask before it and its answer, and nothing older.
 */
export async function answerHere<S extends AnySchema>(ai: HostAi, ask: QuickAsk<S>): Promise<InlineResult> {
  const begun = begin(ai, ask);
  const said = ask.said.trim();
  const host = answerOf(ai);
  const thinking = thinkingOf(ai);
  const fast = fastOf(ai);
  const all = begun.catalog.candidates.filter((candidate) => ready(candidate) || candidate.type === "panel" || candidate.type === "place" || candidate.type === "record").slice(0, 32);
  /*
   * TWO STEPS (Roadmap f-menu-type-anything): where a model will write the
   * answer and a Fast slot is given, the Fast slot first picks the context
   * that matters to the words — which of the catalog's candidates, which
   * records around the target — and only that reaches the model that
   * answers; with no Fast slot, the default the target is scoped to. Either
   * way the entry says what was sent.
   */
  let sent: { readonly choices: readonly AiCandidate[]; readonly state: AiContextState; readonly context: AiContextSent };
  try {
    sent = fast && (host || thinking) && said ? await contextPicked(fast, said, begun, all) : defaultContext(begun, all);
  } catch (error) {
    return failedResult(begun, said, "ask", error instanceof Error ? error.message : String(error));
  }
  const asked: Asked = { ...begun, state: sent.state, catalog: { ...begun.catalog, candidates: sent.choices }, entry: { ...begun.entry, context: sent.context } };
  const choices = sent.choices;
  /* The records a list shows, as this viewer may see them, and the acts any of them takes. */
  const members = (ask.members ?? []).flatMap((id) => {
    const node = ask.store.graph.getNode(id);
    return node ? [node] : [];
  }).slice(0, 60);
  const memberKinds = new Set(members.map((node) => node.kind));
  const memberActs = ask.store.allMutations().flatMap((mutation) => {
    const kinds = mutation.subject?.kinds;
    if (!mutation.subject || !(kinds === "*" || (kinds as readonly string[]).some((kind) => memberKinds.has(kind)))) return [];
    return [{ name: mutation.name, title: mutation.title ?? mutation.name, subjectArg: mutation.subject.arg, asks: (argumentsTaken(mutation) ?? []).filter((arg) => arg !== mutation.subject!.arg) }];
  });
  let each: { readonly act: string; readonly args: Readonly<Record<string, unknown>> } | undefined;
  let missing: AnswerMissing | undefined;
  let text = "";
  let picked: { candidate: AiCandidate; confidence?: number }[] = [];
  const pickedOf = (ids: readonly unknown[]) => ids.flatMap((id) => choices.filter((candidate) => candidate.id === id)).slice(0, 3).map((candidate) => ({ candidate }));
  try {
    if (host) {
      const reply: AnswerReply = await host.answer({ said, target: ask.target, targetLabel: asked.entry.targetLabel, state: asked.state, catalog: { target: asked.catalog.target, candidates: choices }, ...(ask.follows ? { follows: ask.follows } : {}) });
      const inputTokens = reply.usage?.inputTokens;
      const outputTokens = reply.usage?.outputTokens;
      const cost = reply.usage?.costUsd ?? (inputTokens !== undefined ? costOf(host.price, inputTokens, outputTokens ?? 0) : undefined);
      asked.meter({ tier: "thinking", model: host.model, ...(inputTokens !== undefined ? { inputTokens } : {}), ...(outputTokens !== undefined ? { outputTokens } : {}), ...(cost !== undefined ? { costUsd: cost } : {}) });
      text = typeof reply.text === "string" ? reply.text.trim() : "";
      picked = pickedOf(reply.pick ?? []);
    } else if (thinking) {
      const parsed = (await thought(
        thinking,
        ANSWER_SYSTEM,
        JSON.stringify({
          ask: said,
          about: asked.entry.targetLabel,
          ...(ask.follows ? { follows: ask.follows } : {}),
          state: asked.state,
          candidates: choices.map((candidate) => ({ id: candidate.id, says: candidate.description })),
          ...(members.length > 0 ? { members: members.map((node) => ({ id: node.id, label: labelOf(ask.store.schema.tryDefinition(node.kind), node as never) })), member_acts: memberActs.map((act) => ({ name: act.name, title: act.title, asks: act.asks })) } : {}),
          ...(ask.traits && ask.traits.length > 0 ? { traits: ask.traits } : {}),
        }),
        asked,
        asked.meter,
      )) as { answer?: unknown; pick?: unknown; each?: unknown; lacks?: unknown; add?: unknown; who?: unknown; then?: unknown } | undefined;
      text = typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
      picked = pickedOf(Array.isArray(parsed?.pick) ? parsed.pick : []);
      each = eachOf(parsed?.each);
      if (typeof parsed?.lacks === "string" && parsed.lacks.trim()) {
        const traits = new Set((ask.traits ?? []).map((one) => one.trait));
        missing = {
          said: parsed.lacks.trim(),
          add: (Array.isArray(parsed.add) ? parsed.add : []).filter((one): one is string => typeof one === "string" && traits.has(one)),
          ...(typeof parsed.who === "string" && parsed.who.trim() ? { who: parsed.who.trim() } : {}),
          ...(typeof parsed.then === "string" && parsed.then.trim() ? { then: parsed.then.trim() } : {}),
        };
      }
    } else if (fast && choices.length > 0) {
      const { question, of } = choiceAmong(choices, `Which of these best answers, or acts on: ${said}`);
      const answers = await decided(fast, { ...asked.state, asked: said, candidates: choices.map((candidate) => ({ id: candidate.id, type: candidate.type, says: candidate.description })) }, { answer: question }, asked.meter);
      picked = ranked(answers["answer"], of, 3);
      text = picked.length > 0 ? `These fit “${said}”.` : "";
    } else return failedResult(asked, said, "ask", NO_MODEL);
  } catch (error) {
    return failedResult(asked, said, "ask", error instanceof Error ? error.message : String(error));
  }
  if (!text && picked.length === 0 && !each && !missing) {
    // The seat could not answer (Roadmap f-friction-log): the question, and the place it was asked on. A provider that failed is not this.
    const place = ask.target.on === "place" || ask.target.on === "lens" ? ask.target.place : undefined;
    const kind = ask.target.on === "list" ? ask.target.kind : ask.target.on === "lens" ? ask.target.kind : undefined;
    recordFriction(ask.store, { type: "unanswered", question: said, ...(place ? { place } : {}), ...(kind ? { kind } : {}) }, ask.principal);
    return failedResult(asked, said, "ask", "The AI had no answer to that here.");
  }
  const model = asked.usage.at(-1)?.model;
  // A change picked is a proposal, previewed as the person: never made until it is accepted.
  const proposals = picked.flatMap(({ candidate, confidence }) => {
    const proposal = proposalOf(candidate);
    return proposal ? [{ ...proposal, ...(confidence !== undefined ? { confidence } : {}) }] : [];
  });
  /*
   * ONE ACT OVER EVERY RECORD THE LIST SHOWS, AS ONE CHANGE: a proposal for
   * each, previewed as the person, accepted together and taken back with one
   * undo; one the store would refuse them is left out, as any ghost's.
   */
  const act = each ? memberActs.find((one) => one.name === each!.act) : undefined;
  if (act) {
    for (const node of members) {
      const mutation = ask.store.allMutations().find((one) => one.name === act.name);
      const kinds = mutation?.subject?.kinds;
      if (!mutation || !(kinds === "*" || (kinds as readonly string[]).includes(node.kind))) continue;
      proposals.push({ id: `each:${act.name}:${node.id}`, label: `${act.title}: ${labelOf(ask.store.schema.tryDefinition(node.kind), node as never)}`, said: act.title, call: { name: act.name, args: { ...each!.args, [act.subjectArg]: node.id } }, record: node.id });
    }
  }
  const ghost = proposals.length > 0 ? ghostOf(ask.store, { interaction: asked.id, target: ask.target, basis: said, ...(model ? { model } : {}), proposals }, ask.principal) : undefined;
  const offers = picked.map(({ candidate }) => candidate).filter((candidate) => proposalOf(candidate) === undefined);
  const offered = [...offers.map((candidate) => offeredOf(candidate, picked.find((one) => one.candidate === candidate)?.confidence)), ...(ghost?.proposals ?? []).map((proposal) => ({ id: proposal.id, type: (proposal.field !== undefined ? "fill" : "act") as AiOffered["type"], label: proposal.label, ...(proposal.confidence !== undefined ? { confidence: proposal.confidence } : {}) }))];
  return {
    interaction: { ...asked.entry, ask: { kind: "ask", said }, offered, outcome: "offered", ...(text ? { answer: text } : {}), usage: [...asked.usage] },
    offers,
    ...(ghost && ghost.proposals.length > 0 ? { ghost } : {}),
    ...(text ? { answer: text } : missing ? { answer: missing.said } : {}),
    ...(missing ? { missing } : {}),
  };
}

/** The model's "each", read: an act's name and its values, or nothing. */
function eachOf(value: unknown): { readonly act: string; readonly args: Readonly<Record<string, unknown>> } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { act, args } = value as { act?: unknown; args?: unknown };
  if (typeof act !== "string") return undefined;
  return { act, args: typeof args === "object" && args !== null && !Array.isArray(args) ? (args as Record<string, unknown>) : {} };
}

// ── the ghost ───────────────────────────────────────────────────────────────

/**
 * PROPOSALS, PREVIEWED AS THE PERSON: each call rehearsed as they would
 * make it and said in the act's own sentence; one the store would refuse
 * them is dropped, never shown as something they could accept.
 */
export function ghostOf<S extends AnySchema>(store: Store<S>, ghost: Ghost, principal: Principal): Ghost {
  const proposals = ghost.proposals.flatMap((proposal) => {
    try {
      const preview = store.previewAll([proposal.call], { author: principal });
      const said = preview.ops.map((op) => op.intent).join("; ");
      return preview.ops.length > 0 ? [{ ...proposal, said: said || proposal.said }] : [];
    } catch {
      // Refused as this person: not theirs to accept, so not drawn.
      return [];
    }
  });
  return { ...ghost, proposals };
}

/** A proposal as one press of the menu takes it: a fill, or an act that asks nothing. */
export function proposalOf(candidate: AiCandidate): Proposal | undefined {
  if (candidate.type === "fill") return { id: candidate.id, label: candidate.label, said: candidate.description, call: candidate.call, record: candidate.record, field: candidate.field };
  if (candidate.type === "act" && candidate.asks.length === 0) return { id: candidate.id, label: candidate.label, said: candidate.description, call: { name: candidate.mutation, args: { ...candidate.args } } };
  return undefined;
}

/**
 * ACCEPT A GHOST, ALL OF IT OR SOME (`ids`): the chosen calls applied as
 * the person, as one batch — one undo takes it back — carrying lineage
 * `{ basis: what was asked, model, confidence, interaction }` and coming
 * through `ai:<interaction>`. Answers the batch, or a sentence when the
 * store refused it.
 */
export function acceptGhost<S extends AnySchema>(store: Store<S>, ghost: Ghost, options: { readonly author: Principal; readonly ids?: readonly string[] }): { readonly ok: true; readonly batch: string; readonly accepted: readonly string[] } | { readonly ok: false; readonly refused: string } {
  const chosen = ghost.proposals.filter((proposal) => options.ids === undefined || options.ids.includes(proposal.id));
  if (chosen.length === 0) return { ok: false, refused: "Nothing was chosen." };
  const confidences = chosen.flatMap((proposal) => (proposal.confidence === undefined ? [] : [proposal.confidence]));
  try {
    const result = store.applyAll(
      chosen.map((proposal) => proposal.call),
      {
        author: options.author,
        via: `ai:${ghost.interaction}`,
        intent: ghost.basis,
        lineage: { basis: `Asked “${ghost.basis}”`, ...(ghost.model ? { model: ghost.model } : {}), ...(confidences.length > 0 ? { confidence: Math.min(...confidences) } : {}), interaction: ghost.interaction },
      },
    );
    const batch = result.ops[0]?.batch;
    if (!batch) return { ok: false, refused: "That changes nothing now." };
    return { ok: true, batch, accepted: chosen.map((proposal) => proposal.id) };
  } catch (error) {
    return { ok: false, refused: error instanceof Error ? error.message : String(error) };
  }
}

/** The entry after a ghost was accepted, in whole or in part. */
export function acceptedEntry(entry: AiInteraction, accepted: readonly string[], batch: string): AiInteraction {
  // A suggestion offers a few things to choose one of: taking one is taking it.
  const all = entry.ask.kind === "suggest" ? accepted.length > 0 : entry.offered.length > 0 && entry.offered.every((offer) => accepted.includes(offer.id));
  return { ...entry, outcome: all ? "accepted" : "partly", accepted, batches: [...(entry.batches ?? []), batch] };
}

/** The entry after its offer was put away. */
export const dismissedEntry = (entry: AiInteraction): AiInteraction => ({ ...entry, outcome: "dismissed" });

// ── the context a quick ask sends ───────────────────────────────────────────

/** How many candidates and records the Fast slot may keep, and how likely one must be to be kept past the first. */
const CONTEXT_MOST = { candidates: 8, records: 6 } as const;
const CONTEXT_FLOOR = 0.1;
/** How many records around the target the Fast slot is asked about, one Noul each. */
const CONTEXT_ASKED_RECORDS = 12;

/** The records around the target, as the state tells them: the selection, then its neighbors, each once. */
const recordsAround = (state: AiContextState): readonly { readonly id: string; readonly kind: string; readonly label: string }[] => {
  const seen = new Set<string>();
  return [...state.selection, ...state.neighbors].filter((one) => !seen.has(one.id) && (seen.add(one.id), true));
};

/** The default: every candidate and every record the target is scoped to. */
function defaultContext(asked: Asked, choices: readonly AiCandidate[]): { readonly choices: readonly AiCandidate[]; readonly state: AiContextState; readonly context: AiContextSent } {
  return { choices, state: asked.state, context: { by: "default", candidates: choices.map((one) => one.id), records: recordsAround(asked.state).map((one) => one.id) } };
}

/**
 * THE FAST SLOT PICKS WHAT MATTERS, in Jev's own typed questions, one
 * decision: a Choice of which candidate could answer or act on the words
 * ("none of these" among them), each kept best first while it is likely
 * enough, at least the best one unless none was chosen, at most a few; and
 * a Noul for each record around the target — are the words about it? —
 * kept where it is more likely so than not. The target itself is always
 * sent; the state keeps the records picked and nothing else around it.
 */
async function contextPicked(fast: FastProvider, said: string, asked: Asked, choices: readonly AiCandidate[]): Promise<{ readonly choices: readonly AiCandidate[]; readonly state: AiContextState; readonly context: AiContextSent }> {
  const around = recordsAround(asked.state);
  const questions: Record<string, Question> = {};
  const candidates = choices.length > 0 ? choiceAmong(choices, `Which of these could answer, or act on: ${said}`) : undefined;
  if (candidates) questions["candidates"] = { ...candidates.question, criteria: { ...candidates.question.criteria, none: "None of these" } };
  const keyed = new Map(around.slice(0, CONTEXT_ASKED_RECORDS).map((record, at) => [`record-${at + 1}`, record]));
  for (const [key, record] of keyed) questions[key] = { type: "noul", instructions: `Is “${said}” about ${record.label} (${record.kind})?` };
  if (Object.keys(questions).length === 0) return { ...defaultContext(asked, choices), context: { by: "fast", model: fast.model, candidates: [], records: [] } };
  const answers = await decided(fast, { target: asked.state.target, asked: said }, questions, asked.meter);
  const kept = <T,>(answer: Answer | undefined, of: (key: string) => T | undefined, most: number): T[] => {
    if (answer?.type !== "choice" || answer.choice === "none") return [];
    const order = Object.entries(answer.probabilities).filter(([key]) => key !== "none").sort((a, b) => b[1] - a[1]);
    if (!order.some(([key]) => key === answer.choice)) order.unshift([answer.choice, answer.confidence]);
    return order.filter(([, chance], at) => at === 0 || chance >= CONTEXT_FLOOR).flatMap(([key]) => {
      const one = of(key);
      return one === undefined ? [] : [one];
    }).slice(0, most);
  };
  const picked = candidates ? kept(answers["candidates"], candidates.of, CONTEXT_MOST.candidates) : [];
  const records = [...keyed]
    .flatMap(([key, record]) => {
      const answer = answers[key];
      return answer?.type === "noul" && answer.noul > 0.5 ? [{ record, chance: answer.noul }] : [];
    })
    .sort((a, b) => b.chance - a.chance)
    .slice(0, CONTEXT_MOST.records)
    .map((one) => one.record);
  const ids = new Set(records.map((record) => record.id));
  const state: AiContextState = { ...asked.state, selection: asked.state.selection.filter((one) => ids.has(one.id)), neighbors: asked.state.neighbors.filter((one) => ids.has(one.id)) };
  return { choices: picked, state, context: { by: "fast", model: fast.model, candidates: picked.map((one) => one.id), records: records.map((one) => one.id) } };
}

// ── stubs ───────────────────────────────────────────────────────────────────

/** A rough count of tokens, four characters each: what a stub reports, so metering has numbers to read. */
const tokensIn = (value: unknown): number => Math.ceil(JSON.stringify(value).length / 4);

/**
 * A FAST SLOT FOR TESTS AND A DEV APP: no network, the same shape as Jev.
 * Each Choice is answered with the option whose words `prefer` matches
 * first (else the first option), sure in proportion to its rank; a Noul
 * with yes; a Score with its middle. It reports tokens as Jev would be
 * metered for the request.
 */
export function stubFast(options: { readonly model?: string; readonly prefer?: readonly RegExp[] } = {}): FastProvider {
  const prefer = options.prefer ?? [];
  return {
    model: options.model ?? "stub-fast",
    price: { inputPerMillion: JEV_INPUT_USD_PER_MILLION },
    decide: async (state, questions) => {
      const answers: Record<string, Answer> = {};
      for (const [key, question] of Object.entries(questions)) {
        if (question.type === "choice") {
          const names = Object.keys(question.criteria);
          const rank = (name: string) => {
            const words = `${name} ${question.criteria[name] ?? ""}`;
            const at = prefer.findIndex((pattern) => pattern.test(words));
            return at < 0 ? prefer.length : at;
          };
          const order = [...names].sort((a, b) => rank(a) - rank(b) || names.indexOf(a) - names.indexOf(b));
          const probabilities = Object.fromEntries(order.map((name, at) => [name, Math.round((0.9 / 2 ** at) * 1000) / 1000]));
          answers[key] = { type: "choice", choice: order[0]!, confidence: probabilities[order[0]!]!, probabilities };
        } else if (question.type === "noul") answers[key] = { type: "noul", noul: 0.8 };
        else answers[key] = { type: "score", score: Math.floor(question.criteria.length / 2), confidence: 0.5, probabilities: {}, legend: {} };
      }
      return { answers, usage: { inputTokens: tokensIn({ state, questions }), outputTokens: 0 } };
    },
  };
}

/**
 * A THINKING SLOT FOR TESTS AND A DEV APP: answers each of the inline AI's
 * requests from its catalog alone — a quick ask's answer "About <the
 * target>: an answer to “<the words>”, as drafted." with its first three
 * candidates one press takes, the first panel grouped by a choice
 * (else the first panel) titled "<label>, as drafted", the first act that
 * asks for words with each one "A new <argument>, as drafted", the first
 * candidates it was offered, one fill per field — and reports tokens by
 * length.
 */
export function stubThinking(options: { readonly model?: string } = {}): ThinkingProvider {
  return {
    model: options.model ?? "stub-thinking",
    think: async ({ system, prompt, catalog }) => {
      const panels = catalog.candidates.filter((candidate): candidate is PanelCandidate => candidate.type === "panel");
      const panel = panels.find((candidate) => candidate.id.includes(":group:")) ?? panels[0];
      const fills = catalog.candidates.filter((candidate) => candidate.type === "fill");
      const fields = new Set<string>();
      const maker = catalog.candidates.find((candidate) => candidate.type === "act" && candidate.asks.length > 0);
      const asked = /"answer"/.test(system) ? (JSON.parse(prompt) as { ask?: string; about?: string }) : undefined;
      const text = asked
        ? JSON.stringify({ answer: `About ${asked.about ?? "this"}: an answer to “${asked.ask ?? ""}”, as drafted.`, pick: catalog.candidates.filter((candidate) => candidate.type !== "act" || candidate.asks.length === 0).slice(0, 3).map((candidate) => candidate.id) })
        : /"act"/.test(system)
        ? JSON.stringify(maker?.type === "act" ? { act: maker.id, args: Object.fromEntries(maker.asks.map((name) => [name, `A new ${name}, as drafted`])) } : {})
        : /"panel"/.test(system)
        ? JSON.stringify(panel ? { panel: panel.id, title: `${panel.label}, as drafted` } : {})
        : /"fills"/.test(system)
          ? JSON.stringify({ fills: fills.filter((fill) => (fill.type === "fill" && !fields.has(fill.field) ? (fields.add(fill.field), true) : false)).map((fill) => fill.id) })
          : JSON.stringify({ pick: catalog.candidates.filter(ready).slice(0, 3).map((candidate) => candidate.id) });
      return { text, usage: { inputTokens: tokensIn(system) + tokensIn(prompt), outputTokens: tokensIn(text) } };
    },
  };
}
