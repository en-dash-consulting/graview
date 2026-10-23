import { humanizeField, nounOf, pluralOf, withArticle, type AnySchema, type MutationCall, type Store } from "@graview/core";
import { districtState } from "@graview/core/city";
import { nodeState, type Question } from "../questions.js";
import type { Blocks, PairBlock, RecordBlock } from "./blocking.js";
import { named, noun, type Candidate } from "./judges.js";
import type { Severity } from "./policy.js";
import { choiceOf, modelWord, noulOf, scoreOf, type SystemOneAnswer } from "./system-one.js";

/*
 * THE MODEL JUDGES; CODE ASKS, AND READS. Every candidate blocking found
 * is one request: its records as named JSON (what the actor may see of
 * them, and what the declaration says of their kind and relations), and
 * every independent question about them together — so a record's
 * archiving, its empty choices and its links are one call, not four. Each
 * answer is read back into a change with a confidence and a basis a person
 * reads; nothing here decides whether that change is made (`./policy.ts`).
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/** The questions' version: a change to their words changes every cache key, so nothing is read back from the old ones. */
export const QUESTION_SET = "dream-questions/1";

/** "None of these": the option that keeps a Choice from being made to pick. */
export const NONE_OF_THESE = "none of these";
/** "None fits": the option that keeps an empty choice empty. */
export const NONE_FITS = "none fits";

/** A judgment the model made: a change it would make (with how sure), or one it let go. */
export interface Judgment extends Candidate {
  readonly severity: Severity;
  /** The answering model. */
  readonly model: string;
  /** Two options nearly as likely: never made unasked. */
  readonly split?: boolean;
  /** The model chose none, or was not sure enough to say anything. */
  readonly none?: boolean;
}

/** One request: the state, its questions, what it covers, and how its answers read back. */
export interface Ask {
  /** The families and records it judges, so the floor does not judge them again: "duplicates:a|b", "links:x". */
  readonly covers: readonly string[];
  readonly state: Readonly<Record<string, unknown>>;
  readonly questions: Readonly<Record<string, Question>>;
  read(answers: Readonly<Record<string, SystemOneAnswer>>, model: string): readonly Judgment[];
}

const quote = (text: string) => `“${text}”`;
const two = (value: number) => value.toFixed(2);

/** A record as the model reads it: its kind, its name, its fields as the actor may see them, what it is joined to. No id. */
function recordState(store: Store<AnySchema>, node: Node): Record<string, unknown> {
  const { id: _id, "what the kind is": _kind, ...state } = (nodeState(store, node.id) ?? { kind: node.kind, label: named(store.schema, node) }) as Record<string, unknown>;
  return state;
}

/** What a kind is, in the declaration's words. */
function kindState(schema: AnySchema, kind: string): Record<string, unknown> {
  const definition = schema.tryDefinition(kind);
  const state = districtState(schema, kind);
  const done = state ? state.values.filter((_, at) => state.tiers[at] === "done") : [];
  const lifecycle = definition?.lifecycle;
  const finishedWhen = lifecycle
    ? lifecycle.retired === "date"
      ? `once its ${humanizeField(lifecycle.field).toLowerCase()} has passed`
      : `when its ${humanizeField(lifecycle.field).toLowerCase()} retires it`
    : done.length > 0
      ? `when its ${humanizeField(state!.field).toLowerCase()} is ${done.map(quote).join(" or ")}`
      : undefined;
  return {
    name: nounOf(definition, kind),
    ...(definition?.description ? { "what it is": definition.description } : {}),
    ...(finishedWhen ? { "finished when": finishedWhen } : {}),
  };
}

/** How long unchanged, in words that stay the same from one night to the next. */
const ageOf = (days: number): string => (days >= 365 ? "over a year" : days >= 180 ? "over six months" : days >= 90 ? "over three months" : days >= 30 ? "over a month" : `${days} days`);

/** The key a question takes from a field or relation name: letters, digits and underscores. */
const keyOf = (prefix: string, name: string) => `${prefix}_${name.replace(/[^A-Za-z0-9_]+/g, "_")}`;

/** Option names a model reads — each far record's name — made unique. */
function optionNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 && name !== NONE_OF_THESE ? name : `${name} (${count})`;
  });
}

/**
 * TWO RECORDS THAT MAY BE ONE. A Score — different, related but distinct,
 * the same thing — and a Noul for the name and each key field both fill,
 * in one request. The Score is the judgment; a key the model says differs
 * (two emails, two codes) keeps the merge to a person's word.
 */
export function pairAsk(store: Store<AnySchema>, pair: PairBlock): Ask {
  const schema = store.schema;
  const one = noun(schema, pair.kind);
  const many = pluralOf(schema, pair.kind);
  const first = named(schema, pair.other);
  const second = named(schema, pair.keeper);
  const questions: Record<string, Question> = {
    same_thing: {
      type: "score",
      instructions: `Are “first” and “second” the same ${one}, entered twice? Judge from what each record says.`,
      criteria: [`Different ${many}: alike only in passing.`, `Related but distinct: connected ${many}, still two of them.`, `The same ${one}, entered twice.`],
    },
    same_name: {
      type: "noul",
      instructions: `Do “first” and “second” have the same name, written two ways?`,
      criteria: { true: "One name, written two ways.", false: "Two different names." },
    },
  };
  for (const field of pair.keys) {
    questions[keyOf("same", field)] = {
      type: "noul",
      instructions: `Do “first” and “second” have the same ${humanizeField(field).toLowerCase()}, perhaps written two ways?`,
      criteria: { true: `One ${humanizeField(field).toLowerCase()}.`, false: `Two different ${humanizeField(field).toLowerCase()} values.` },
    };
  }
  return {
    covers: [`duplicates:${[pair.other.id, pair.keeper.id].sort().join("|")}`],
    state: { kind: kindState(schema, pair.kind), first: recordState(store, pair.other), second: recordState(store, pair.keeper) },
    questions,
    read(answers, model) {
      const same = scoreOf(answers["same_thing"], 3);
      if (same === undefined) return [];
      const keys = pair.keys.map((field) => ({ field, p: noulOf(answers[keyOf("same", field)]) })).filter((one): one is { field: string; p: number } => one.p !== undefined);
      const name = noulOf(answers["same_name"]);
      const nouls = [...keys.map((one) => one.p), ...(name === undefined ? [] : [name])];
      let confidence = nouls.length > 0 ? (2 * same + nouls.reduce((sum, p) => sum + p, 0) / nouls.length) / 3 : same;
      // A key the model says differs: never merged unasked.
      const differs = keys.find((one) => one.p < 0.2);
      if (differs) confidence = Math.min(confidence, 0.5);
      confidence = Math.round(confidence * 100) / 100;
      const agreed = keys.filter((one) => one.p >= 0.8).map((one) => `the same ${humanizeField(one.field).toLowerCase()}`);
      const basis = [
        `${modelWord(model)}: ${two(confidence)} that ${quote(first)} and ${quote(second)} are the same ${one}`,
        agreed.length > 0 ? ` (${agreed.join(", ")})` : "",
        differs ? `, though their ${humanizeField(differs.field).toLowerCase()} differs` : "",
      ].join("");
      return [{ judge: "duplicates", severity: "merge", model, calls: [{ name: `merge-${pair.kind}`, args: { id: pair.other.id, into: pair.keeper.id } }], basis, confidence, about: [pair.other.id, pair.keeper.id] }];
    },
  };
}

/**
 * ONE RECORD, EVERYTHING ABOUT IT. Whether it is finished or no longer
 * relevant (a Noul, with its state, how long unchanged and how its kind
 * says it is finished); for each empty choice, which option fits, or none
 * (a Choice); for each relation, which of the likeliest far records it
 * means, or none of these (a Choice — select, never generate; the
 * relation is always one the app declares).
 */
export function recordAsk(store: Store<AnySchema>, block: RecordBlock): Ask {
  const schema = store.schema;
  const node = block.node;
  const one = noun(schema, node.kind);
  const name = named(schema, node);
  const questions: Record<string, Question> = {};
  const state: Record<string, unknown> = { kind: kindState(schema, node.kind), record: recordState(store, node) };
  const covers: string[] = [];
  const readers: ((answers: Readonly<Record<string, SystemOneAnswer>>, model: string) => Judgment | undefined)[] = [];

  if (block.archive) {
    covers.push(`archive:${node.id}`);
    // Said coarsely, so tomorrow's run asks the same question and its answer is kept.
    const age = ageOf(block.archive.days);
    state["unchanged for"] = age;
    questions["finished"] = {
      type: "noul",
      instructions: `Is this ${one} finished, or no longer relevant, so it can be set aside (archived, kept but out of the lists)? It has been unchanged for ${age}.`,
      criteria: { true: "Finished or no longer relevant: setting it aside loses nothing anyone is using.", false: "Still open, still in use, or likely to be needed soon." },
    };
    const days = block.archive.days;
    const why = block.archive.why;
    readers.push((answers, model) => {
      const p = noulOf(answers["finished"]);
      if (p === undefined) return undefined;
      return {
        judge: "archive",
        severity: "archive",
        model,
        calls: [{ name: `archive-${node.kind}`, args: { id: node.id } }],
        basis: `${modelWord(model)}: ${two(p)} that ${quote(name)} is finished or no longer relevant (${why ? `${why}, ` : ""}unchanged for ${days} days)`,
        confidence: p,
        about: [node.id],
      };
    });
  }

  for (const fill of block.fills) {
    covers.push(`categorize:${node.id}:${fill.field}`);
    const key = keyOf("fill", fill.field);
    const words = humanizeField(fill.field).toLowerCase();
    const criteria: Record<string, string | null> = {};
    for (const option of fill.options) criteria[option] = null;
    criteria[NONE_FITS] = `No ${words} plainly fits; leave it empty.`;
    questions[key] = {
      type: "choice",
      instructions: `Which ${words} is this ${one}?${fill.description ? ` ${fill.description}` : ""} Choose “${NONE_FITS}” unless the record plainly says.`,
      criteria,
    };
    readers.push((answers, model) => {
      const chosen = choiceOf(answers[key]);
      if (!chosen) return undefined;
      const none = chosen.choice === NONE_FITS || !fill.options.includes(chosen.choice);
      return {
        judge: "categorize",
        severity: "categorize",
        model,
        calls: none ? [] : [{ name: fill.writes.mutation, args: { [fill.writes.subjectArg]: node.id, [fill.writes.arg]: chosen.choice } }],
        basis: none ? `${modelWord(model)}: no ${words} plainly fits ${quote(name)} (${two(chosen.confidence)})` : `${modelWord(model)}: ${two(chosen.confidence)} that the ${words} of ${quote(name)} is ${quote(chosen.choice)}`,
        confidence: chosen.confidence,
        about: [node.id],
        split: chosen.margin < 0.15,
        ...(none ? { none: true } : {}),
      };
    });
  }

  const candidates: Record<string, unknown> = {};
  for (const link of block.links) {
    const judge = link.missing ? "missing-links" : "links";
    covers.push(`links:${node.id}`);
    const key = keyOf("link", link.relation);
    const words = humanizeField(link.relation).toLowerCase();
    const options = optionNames(link.targets.map((target) => named(schema, target.node)));
    const byOption = new Map(options.map((option, at) => [option, link.targets[at]!] as const));
    const criteria: Record<string, string | null> = {};
    link.targets.forEach((target, at) => {
      criteria[options[at]!] = `${withArticle(noun(schema, target.node.kind))}: ${named(schema, target.node)}`;
    });
    criteria[NONE_OF_THESE] = "None of these is meant; leave it as it is.";
    candidates[key] = Object.fromEntries(link.targets.map((target, at) => [options[at]!, recordState(store, target.node)]));
    questions[key] = {
      type: "choice",
      instructions: `This ${one}'s “${words}”${link.description ? ` (${link.description})` : ""}: which of the candidates does the record mean? Choose one only if the record plainly means it; otherwise “${NONE_OF_THESE}”.`,
      criteria,
    };
    readers.push((answers, model) => {
      const chosen = choiceOf(answers[key]);
      if (!chosen) return undefined;
      const target = byOption.get(chosen.choice);
      const calls: MutationCall[] = target ? [{ name: link.act.name, args: { id: node.id, [link.act.to]: target.node.id } }] : [];
      return {
        judge,
        severity: "link",
        model,
        calls,
        basis: target
          ? `${modelWord(model)}: ${two(chosen.confidence)} that the ${words} of ${quote(name)} is ${quote(named(schema, target.node))} (${target.evidence})`
          : `${modelWord(model)}: none of the candidates is the ${words} of ${quote(name)} (${two(chosen.confidence)})`,
        confidence: chosen.confidence,
        about: target ? [node.id, target.node.id] : [node.id],
        split: chosen.margin < 0.15,
        ...(target ? {} : { none: true }),
      };
    });
  }
  if (Object.keys(candidates).length > 0) state["candidates"] = candidates;

  return {
    covers,
    state,
    questions,
    read: (answers, model) => readers.flatMap((reader) => reader(answers, model) ?? []),
  };
}

/** Every request a run would make, pairs first. */
export const asksOf = (store: Store<AnySchema>, blocks: Blocks): Ask[] => [...blocks.pairs.map((pair) => pairAsk(store, pair)), ...blocks.records.map((record) => recordAsk(store, record))];

/** The key a floor candidate is covered by, so a judgment the model made is not made again by the judges' rules. */
export function coverOf(candidate: Candidate): string {
  if (candidate.judge === "duplicates") return `duplicates:${[...candidate.about].sort().join("|")}`;
  if (candidate.judge === "links" || candidate.judge === "missing-links") return `links:${candidate.about[0]}`;
  return `${candidate.judge}:${candidate.about[0]}`;
}
