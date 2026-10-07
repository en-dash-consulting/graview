import {
  fieldWriters,
  formFields,
  humanizeField,
  nounOf,
  labelOf,
  readableFields,
  withArticle,
  type AnySchema,
  type FormField,
  type InvariantDefinition,
  type Store,
  type Violation,
  defOf,
  descriptionOf,
} from "@graview/core";

/**
 * THE QUESTIONS ARE DERIVED, NOT AUTHORED.
 *
 * A Graview declaration already types every question worth asking. A
 * `z.enum` is a Choice whose criteria are its own options; a `nodeRef` is a
 * Choice over the live nodes of that kind, labeled the way every surface
 * labels them; a `z.boolean` and an invariant are a truth with the rule as
 * what "yes" means; a bounded number is a Score over its own levels. None
 * of it is written by hand, for the same reason no agent tool is: two
 * descriptions of one domain will disagree, and the one in the declaration
 * is the one the store enforces.
 *
 * The shapes here are the wire shapes of a decision provider — a map of
 * typed questions over one state, typed answers back under the same keys —
 * so a derived question is sent as it is, and an answer is read straight
 * into an argument of the act that writes the thing asked about.
 */

export type ChoiceQuestion = {
  readonly type: "choice";
  readonly instructions: string;
  /** Option name → what it means, or null when the name says it all. */
  readonly criteria: Readonly<Record<string, string | null>>;
};
export type NoulQuestion = {
  readonly type: "noul";
  readonly instructions: string;
  readonly criteria?: { readonly true?: string; readonly false?: string };
};
export type ScoreQuestion = {
  readonly type: "score";
  readonly instructions: string;
  /** Ordered level descriptions, lowest first. At least two. */
  readonly criteria: readonly string[];
};
export type Question = ChoiceQuestion | NoulQuestion | ScoreQuestion;

/** Where a question came from, and where its answer goes. */
export type QuestionAbout =
  | {
      readonly about: "field";
      readonly kind: string;
      readonly field: string;
      /** The act that writes the field, and the argument the answer fills. */
      readonly writes?: { readonly mutation: string; readonly arg: string; readonly subjectArg: string };
    }
  | {
      readonly about: "argument";
      readonly mutation: string;
      readonly arg: string;
      /** For a pair question: the other node the argument would name. Carried, not parsed — an id may hold a colon. */
      readonly other?: string;
    }
  | { readonly about: "rule"; readonly invariant: string; readonly subjectId?: string }
  | {
      readonly about: "repair";
      readonly invariant: string;
      readonly subjectId?: string;
      /** Option name → the call it means, arguments already settled. */
      readonly options: Readonly<Record<string, { readonly mutation: string; readonly args: Readonly<Record<string, unknown>> }>>;
    };

export type DerivedQuestion = QuestionAbout & {
  /** Stable, code-facing. Never sent to the model. */
  readonly id: string;
  readonly question: Question;
  /** For a Score: the field's own scale, so level 0 is `min`. */
  readonly scale?: { readonly min: number; readonly max: number };
};

/**
 * A QUESTION FOR A PERSON, because the answer was not one.
 *
 * "turf 0.5, bed 0.45" is a split, not an answer, and a low confidence is a
 * shrug. Either is offered rather than applied: the question, the node it
 * is about by name, and each option with its probability and the call it
 * would be — so a surface can stand the question AT that node, with the
 * choices as presses, rather than in a list somewhere else.
 */
export interface OfferedQuestion {
  readonly id: string;
  /** The node it is about, when it is about one. */
  readonly nodeId?: string;
  /** Its label, so a surface can say it without a lookup. */
  readonly nodeLabel?: string;
  /** The question in the declaration's words. */
  readonly asks: string;
  /** Why it is offered rather than applied. */
  readonly because: "split" | "unsure";
  readonly confidence: number;
  readonly options: readonly {
    readonly value: string;
    readonly probability: number;
    /** The call taking this option would be; absent when "no" means do nothing. */
    readonly call?: { readonly mutation: string; readonly args: Readonly<Record<string, unknown>>; readonly why?: string };
  }[];
}

/** Node-typed values a decision provider answers with, as declared. */
const MAX_SCORE_LEVELS = 10;

/** The description a zod field carries, through optional/default wrappers. */
function describedAs(schema: unknown): string | undefined {
  let at: unknown = schema;
  while (at) {
    const said = descriptionOf(at);
    if (said) return said;
    at = defOf(at)?.innerType;
  }
  return undefined;
}

const say = (field: FormField, description: string | undefined, of: string): string =>
  description ?? `${humanizeField(field.name)} of ${of}.`;

/**
 * One scalar control as one question, or nothing when the control has no
 * typed answer (text, a date, a list). `describe` is the field's own
 * description, which is the instruction when there is one — the
 * declaration's words, not a paraphrase.
 */
function questionFor<S extends AnySchema>(
  store: Store<S>,
  field: FormField,
  description: string | undefined,
  of: string,
): Question | undefined {
  switch (field.control) {
    case "choice": {
      if (!field.options?.length) return undefined;
      const criteria: Record<string, string | null> = {};
      for (const option of field.options) criteria[option] = null;
      return { type: "choice", instructions: `Which ${humanizeField(field.name).toLowerCase()}? ${say(field, description, of)}`, criteria };
    }
    case "node": {
      /*
       * THE LIVE NODES OF THAT KIND, labeled by labelOf: the same word a
       * card shows, a chat names and a tool describes. The option name is
       * the id, because the answer has to be a call's argument; the
       * meaning beside it is what the model reads.
       */
      const criteria: Record<string, string | null> = {};
      for (const node of store.graph.allNodes()) {
        if (!field.kinds.includes("*") && !field.kinds.includes(node.kind as string)) continue;
        if (store.modules.disabledKinds.has(node.kind as string)) continue;
        criteria[node.id] = `${withArticle(nounOf(store.schema.tryDefinition(node.kind as string), node.kind as string))}: ${labelOf(store.schema.tryDefinition(node.kind as string), node)}`;
      }
      if (Object.keys(criteria).length === 0) return undefined;
      return { type: "choice", instructions: `Which ${humanizeField(field.name).toLowerCase()}? ${say(field, description, of)}`, criteria };
    }
    case "boolean":
      return {
        type: "noul",
        instructions: `${humanizeField(field.name)}: ${description ?? `is this true of ${of}?`}`,
        criteria: { true: `${humanizeField(field.name)} holds.`, false: `${humanizeField(field.name)} does not hold.` },
      };
    case "number": {
      if (field.min === undefined || field.max === undefined) return undefined;
      const span = field.max - field.min;
      if (span < 1 || span + 1 > MAX_SCORE_LEVELS) return undefined;
      const levels: string[] = [];
      for (let level = field.min; level <= field.max; level++) {
        levels.push(
          level === field.min
            ? `${humanizeField(field.name)} ${level} of ${field.max}: the least.`
            : level === field.max
              ? `${humanizeField(field.name)} ${level} of ${field.max}: the most.`
              : `${humanizeField(field.name)} ${level} of ${field.max}.`,
        );
      }
      return { type: "score", instructions: `How much ${humanizeField(field.name).toLowerCase()}? ${say(field, description, of)}`, criteria: levels };
    }
    default:
      return undefined;
  }
}

/** The number a Score answer means, on the field's own scale. */
export function scoreToValue(field: { readonly min: number }, level: number): number {
  return field.min + Math.round(level);
}

/**
 * The questions a KIND asks of one of its members: one per settable field
 * with a typed answer, each naming the act that writes it. A kind whose
 * every field is prose asks nothing, and says so by an empty list.
 */
export function questionsForKind<S extends AnySchema>(store: Store<S>, kind: string): readonly DerivedQuestion[] {
  const definition = store.schema.tryDefinition(kind);
  if (!definition) return [];
  const shape = (definition.fields as { shape?: Record<string, unknown> }).shape ?? {};
  const writers = fieldWriters(store.schema, store.allMutations()).get(kind);
  const of = withArticle(nounOf(definition, kind));
  const out: DerivedQuestion[] = [];
  for (const field of formFields(definition.fields)) {
    if (field.name in (definition.fixed ?? {})) continue;
    const question = questionFor(store, field, describedAs(shape[field.name]), of);
    if (!question) continue;
    const scale =
      field.control === "number" && field.min !== undefined && field.max !== undefined
        ? { scale: { min: field.min, max: field.max } }
        : {};
    const writer = (writers?.get(field.name) ?? [])
      .map((name) => store.allMutations().find((mutation) => mutation.name === name))
      .find((mutation) => mutation?.subject && formFields(mutation.input).some((arg) => arg.name === field.name));
    out.push({
      id: `field:${kind}.${field.name}`,
      about: "field",
      kind,
      field: field.name,
      ...(writer?.subject ? { writes: { mutation: writer.name, arg: field.name, subjectArg: writer.subject.arg } } : {}),
      ...scale,
      question,
    });
  }
  return out;
}

/**
 * The questions an ACT asks before it can be called: one per argument with
 * a typed answer that `given` has not already settled. The subject is
 * usually given — a run fans out over nodes and asks each one's questions
 * — and an argument with no typed answer is simply not asked, which is
 * what the checker already guaranteed a decision provider would never
 * meet on its allowlist.
 */
export function questionsForMutation<S extends AnySchema>(
  store: Store<S>,
  name: string,
  given: Readonly<Record<string, unknown>> = {},
): readonly DerivedQuestion[] {
  const mutation = store.mutation(name);
  const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
  const of = mutation.title ?? name;
  const out: DerivedQuestion[] = [];
  for (const field of formFields(mutation.input)) {
    if (field.name in given) continue;
    const question = questionFor(store, field, describedAs(shape[field.name]), `the act "${of}"`);
    if (!question) continue;
    const scale =
      field.control === "number" && field.min !== undefined && field.max !== undefined
        ? { scale: { min: field.min, max: field.max } }
        : {};
    out.push({ id: `arg:${name}.${field.name}`, about: "argument", mutation: name, arg: field.name, ...scale, question });
  }
  return out;
}

/**
 * A RULE IS A TRUTH, and its repairs are the closed set that follows.
 *
 * The invariant's own words are what "yes" means; a violation the store
 * already raised narrows the follow-on Choice to the repairs it named, each
 * with its arguments settled, so the answer is a call and not a guess.
 * Asked without a violation, the follow-on is over the repairs the
 * invariant declares it may name, which is what a loop asks before the
 * store has judged.
 */
export function questionsForInvariant<S extends AnySchema>(
  store: Store<S>,
  name: string,
  violation?: Violation,
): readonly DerivedQuestion[] {
  const invariant = store.allInvariants().find((candidate) => candidate.name === name) as
    | InvariantDefinition<S>
    | undefined;
  if (!invariant) return [];
  const rule = invariant.description ?? invariant.label ?? humanizeField(invariant.name);
  const subject = violation?.subjectId;
  const suffix = subject ? `:${subject}` : "";
  const out: DerivedQuestion[] = [
    {
      id: `rule:${name}${suffix}`,
      about: "rule",
      invariant: name,
      ...(subject ? { subjectId: subject } : {}),
      question: {
        type: "noul",
        instructions: violation ? `${rule} Is this so of the state given?` : `${rule} Does this hold in the state given?`,
        criteria: { true: rule, false: violation?.message ?? `${rule} — but it does not hold.` },
      },
    },
  ];
  const criteria: Record<string, string | null> = {};
  const options: Record<string, { mutation: string; args: Readonly<Record<string, unknown>> }> = {};
  /*
   * Two repairs of one violation are often the same act with different
   * arguments — "call it turf", "call it a bed" — so the option name is
   * the act's name only while that is unique, and `options` says which
   * call each name means.
   */
  const nameFor = (mutation: string): string => {
    if (!(mutation in options)) return mutation;
    let n = 2;
    while (`${mutation}:${n}` in options) n += 1;
    return `${mutation}:${n}`;
  };
  if (violation) {
    for (const repair of violation.repairs) {
      if (repair.missing?.length) continue;
      const key = nameFor(repair.mutation);
      criteria[key] = repair.label;
      options[key] = { mutation: repair.mutation, args: { ...(repair.args ?? {}) } };
    }
  } else {
    for (const repairName of invariant.repairs ?? []) {
      const mutation = store.allMutations().find((candidate) => candidate.name === repairName);
      criteria[repairName] = mutation?.description ?? mutation?.title ?? null;
      options[repairName] = { mutation: repairName, args: {} };
    }
  }
  /*
   * A Choice with one option is not a question, and a violation with one
   * ready repair has already answered: a caller finding no repair question
   * takes the one the violation named.
   */
  if (Object.keys(criteria).length >= 2) {
    out.push({
      id: `repair:${name}${suffix}`,
      about: "repair",
      invariant: name,
      ...(subject ? { subjectId: subject } : {}),
      options,
      question: {
        type: "choice",
        instructions: `Which repair should be taken so that: ${rule}`,
        criteria,
      },
    });
  }
  return out;
}

/**
 * A PAIR IS A TRUTH. An act that joins a subject to one other node —
 * "says it helps": a practice and a concern — asked of one particular pair
 * is a yes-or-no question, and the act's own title and description are
 * its words. Fan this out over every pair and you have a matrix nobody
 * ever had to author.
 */
export function pairQuestion<S extends AnySchema>(
  store: Store<S>,
  name: string,
  subjectId: string,
  otherId: string,
): (DerivedQuestion & { readonly about: "argument" }) | undefined {
  const mutation = store.mutation(name);
  const subject = mutation.subject;
  if (!subject) return undefined;
  const a = store.graph.getNode(subjectId);
  const b = store.graph.getNode(otherId);
  if (!a || !b) return undefined;
  const other = formFields(mutation.input).find(
    (field) => field.control === "node" && field.name !== subject.arg && (field.kinds.includes("*") || field.kinds.includes(b.kind as string)),
  );
  if (!other) return undefined;
  const labelA = labelOf(store.schema.tryDefinition(a.kind as string), a);
  const labelB = labelOf(store.schema.tryDefinition(b.kind as string), b);
  const title = mutation.title ?? name;
  return {
    id: `pair:${name}:${subjectId}:${otherId}`,
    about: "argument",
    mutation: name,
    arg: other.name,
    other: otherId,
    question: {
      type: "noul",
      instructions: `${title}: ${labelA} — ${labelB}? ${mutation.description ?? ""}`.trim(),
      criteria: {
        true: `"${title}" holds for ${labelA} and ${labelB}.`,
        false: `"${title}" does not hold for ${labelA} and ${labelB}.`,
      },
    },
  };
}

/**
 * THE STATE A QUESTION IS ASKED OVER: one node as the model should see it
 * — its kind and what the kind is for, its label, its readable fields in
 * the declaration's own words, and what it is joined to, by label. Nothing
 * a card would not show. Ids are kept beside labels so an answer that is
 * an id can be checked against what was shown.
 */
export function nodeState<S extends AnySchema>(store: Store<S>, id: string): Readonly<Record<string, unknown>> | undefined {
  const node = store.graph.getNode(id);
  if (!node) return undefined;
  const definition = store.schema.tryDefinition(node.kind as string);
  const fields: Record<string, unknown> = {};
  for (const field of readableFields(node, definition)) fields[field.label] = field.value;
  const joined: Record<string, string[]> = {};
  for (const edge of store.graph.outEdges(id)) {
    const other = store.graph.getNode(edge.to);
    if (!other) continue;
    (joined[edge.kind] ??= []).push(labelOf(store.schema.tryDefinition(other.kind as string), other));
  }
  for (const edge of store.graph.inEdges(id)) {
    const other = store.graph.getNode(edge.from);
    if (!other) continue;
    const inverse = `${edge.kind} (from)`;
    (joined[inverse] ??= []).push(labelOf(store.schema.tryDefinition(other.kind as string), other));
  }
  return {
    id,
    kind: node.kind,
    ...(definition?.description ? { "what the kind is": definition.description } : {}),
    label: labelOf(definition, node),
    fields,
    ...(Object.keys(joined).length > 0 ? { joined } : {}),
  };
}

/** Every derived question in the app, for a reader — or a test — that wants the whole surface. */
export function allQuestions<S extends AnySchema>(store: Store<S>): readonly DerivedQuestion[] {
  const out: DerivedQuestion[] = [];
  for (const kind of store.schema.kinds as readonly string[]) {
    if (store.modules.disabledKinds.has(kind)) continue;
    out.push(...questionsForKind(store, kind));
  }
  for (const mutation of store.allMutations()) out.push(...questionsForMutation(store, mutation.name));
  for (const invariant of store.allInvariants()) out.push(...questionsForInvariant(store, invariant.name));
  return out;
}
