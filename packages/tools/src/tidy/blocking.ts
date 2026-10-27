import { humanizeField, nameKey, type AnySchema, type SearchRanker } from "@graview/core";
import { formFields } from "@graview/core/forms";
import { fold } from "@graview/core/search";
import { tidyingOf } from "@graview/core/tidying";
import { questionsForKind } from "../questions.js";
import { actNamed, connectOf, fieldsOf, finishedOf, KEY_FIELD, keeperOf, lastMoved, mayTouch, named, type JudgeContext } from "./judges.js";

/*
 * BLOCKING: WHAT IS WORTH ASKING A MODEL ABOUT, FOUND IN CODE. Far wider
 * than the judges' exact matches — two records of a kind that share an
 * uncommon word in their names, or a value, or that the host's ranker
 * calls near; a record whose text mentions another's name or one of its
 * words; a choice left empty; a one-link relation left empty — and capped
 * per run, so a large app asks about its likeliest few, not every pair.
 * Nothing here decides: a model judges each (`./judging.ts`), and code
 * says what its answer is enough for (`./policy.ts`).
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

/** Two records of one kind that may be one: the one that would stay, the one merged into it, and why they were paired. */
export interface PairBlock {
  readonly kind: string;
  readonly keeper: Node;
  readonly other: Node;
  /** Fields both fill and that name one thing (an email, a code, a value they share): asked one by one. */
  readonly keys: readonly string[];
  /** Words a person reads: "both have the word “acme”". */
  readonly evidence: readonly string[];
  readonly strength: number;
}

/** A far record a relation might point to, and why it was put forward. */
export interface TargetBlock {
  readonly node: Node;
  /** "its notes say “Harbor Catering”", "they share the word “harbor”", "the host's search calls it near". */
  readonly evidence: string;
  /** Whether the record's own text names it. */
  readonly mentioned: boolean;
}

/** One relation of a record to ask about: the act that links it, and the far records to choose among. */
export interface LinkBlock {
  readonly relation: string;
  readonly description?: string;
  /** An empty one-link relation (`missing-links`), rather than a link the record's text names (`links`). */
  readonly missing: boolean;
  readonly act: { readonly name: string; readonly to: string };
  readonly targets: readonly TargetBlock[];
}

/** One empty choice field of a record, and the act that writes it. */
export interface FillBlock {
  readonly field: string;
  readonly options: readonly string[];
  readonly description?: string;
  readonly writes: { readonly mutation: string; readonly arg: string; readonly subjectArg: string };
}

/** Everything one record is asked about, in one request. */
export interface RecordBlock {
  readonly node: Node;
  /** Present when it is old enough to set aside: how many days unchanged, and what its declaration says of it. */
  readonly archive?: { readonly days: number; readonly why?: string };
  readonly fills: readonly FillBlock[];
  readonly links: readonly LinkBlock[];
}

export interface Blocks {
  readonly pairs: readonly PairBlock[];
  readonly records: readonly RecordBlock[];
}

/** What blocking may find, and how much of it. */
export interface BlockingOptions {
  /** The judges' names a run uses: only their families are found. */
  readonly families: ReadonlySet<string>;
  /** The host's ranker (`HostAi.near`): records it calls near are paired too. */
  readonly near?: SearchRanker;
  /** At most this many pairs a run. 40 when unsaid. */
  readonly maxPairs?: number;
  /** At most this many records a run. 60 when unsaid. */
  readonly maxRecords?: number;
  /** At most this many far records a relation chooses among. 8 when unsaid. */
  readonly maxTargets?: number;
}

/** Words that say nothing about which thing it is: articles, joins, a company's legal form. */
const STOP = new Set(
  "the and for with from into onto about this that these those your our their its are was were has have had not but all any can will per via inc incorporated corp corporation company llc ltd limited group plc gmbh".split(" "),
);

/*
 * WORDS THAT NAME NOTHING IN PARTICULAR, so one of them in a record's text
 * is no evidence that the text means a record whose name holds it: a goal
 * named "Just ship it, today" was put forward for every note that said
 * "just", and a model judged each pair, and was paid for it (FR-224).
 */
const COMMON = new Set(
  (
    "just only also even still then than them they been being does done make made making take took like over other each every much many such upon want need needs should would could might must " +
    "what when where which there here some more most very well good great first last next thing things something anything everything nothing someone anyone everyone people person " +
    "time times today tomorrow yesterday week weeks month months year years day days hour hours work working note notes list item items task tasks goal goals plan plans idea ideas " +
    "doing going come comes came keep keeps kept know knows think thinks thought find found look looks give gives gave help helps start starts stop stops open close " +
    "about after before again against because between through under until while whom whose yours ours mine both either neither same self another"
  ).split(" "),
);

/** Whether a word of a far record's name could tell which record a text means: four letters or more, no stop word, no common one. */
const tellingWord = (word: string): boolean => word.length >= 4 && !STOP.has(word) && !COMMON.has(word);

/** How many names of a pool hold each of its words — a word most of a kind's names hold tells nothing of which one is meant. */
function namesHolding(schema: AnySchema, pool: readonly Node[]): (word: string) => number {
  const counts = new Map<string, number>();
  for (const far of pool) for (const word of new Set(wordsOf(named(schema, far)))) counts.set(word, (counts.get(word) ?? 0) + 1);
  return (word) => counts.get(word) ?? 0;
}

/** A text's telling words: folded, three letters or more, the stop words out. */
export function wordsOf(text: string): string[] {
  return fold(text)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOP.has(word));
}

/** Whether `inside` holds `words` as whole words, folded. */
const holds = (inside: string, words: string): boolean => words.length > 0 && ` ${inside} `.includes(` ${words} `);

/** A record's own text, field by field: its string fields the declaration does not hide. */
function textsOf(schema: AnySchema, node: Node): { readonly field: string; readonly text: string }[] {
  const hidden = new Set(schema.tryDefinition(node.kind)?.display?.hide ?? []);
  return fieldsOf(schema, node.kind).flatMap((field) => {
    const value = node[field];
    return !hidden.has(field) && typeof value === "string" && value.trim() ? [{ field, text: value }] : [];
  });
}

/** A kind's free-text fields: not a choice, a date or a number, whose shared value says nothing of which record it is. */
const freeText = (schema: AnySchema, kind: string): Set<string> => {
  const definition = schema.tryDefinition(kind);
  return new Set(definition ? formFields(definition.fields).filter((field) => field.control === "text" && !("long" in field && field.long) && !("markdown" in field && field.markdown)).map((field) => field.name) : []);
};

/** The fields a short value of which names one thing — an email, a phone, a code: free text, not the label, not prose. */
const valueFields = (schema: AnySchema, node: Node, label: string | undefined, free: ReadonlySet<string>) =>
  textsOf(schema, node).filter(({ field, text }) => free.has(field) && field !== label && text.length <= 80 && nameKey(text).length >= 3 && nameKey(text) !== nameKey(named(schema, node)));

/** The field a kind is named by, when it is one field: `label`, else `name` or `title`. */
const labelField = (schema: AnySchema, kind: string): string | undefined => ["label", "name", "title"].find((field) => fieldsOf(schema, kind).includes(field));

/** Same-kind pairs that may be one record. */
async function pairsOf(context: JudgeContext, options: BlockingOptions): Promise<PairBlock[]> {
  const { store } = context;
  const schema = store.schema;
  const found: PairBlock[] = [];
  for (const definition of schema.definitions) {
    const kind = definition.kind;
    if (definition.archives === false || !actNamed(store, `merge-${kind}`) || tidyingOf(schema, kind) === "never") continue;
    const records = (store.graph.nodesOfKind(kind as never) as unknown as Node[]).filter((node) => mayTouch(context, node));
    if (records.length < 2) continue;
    const label = labelField(schema, kind);
    const byPair = new Map<string, { a: Node; b: Node; strength: number; evidence: string[]; keys: Set<string> }>();
    const pair = (a: Node, b: Node, strength: number, evidence: string, key?: string) => {
      if (a.id === b.id) return;
      const [first, second] = a.id < b.id ? [a, b] : [b, a];
      const id = `${first.id}\u0000${second.id}`;
      const was = byPair.get(id) ?? { a: first, b: second, strength: 0, evidence: [], keys: new Set<string>() };
      was.strength += strength;
      if (!was.evidence.includes(evidence)) was.evidence.push(evidence);
      if (key) was.keys.add(key);
      byPair.set(id, was);
    };
    // Telling words in the name and the key fields; a word half the kind shares tells nothing.
    const index = new Map<string, Node[]>();
    const wordSets = new Map<string, Set<string>>();
    for (const node of records) {
      // A key value (an email, a code) is one word, whole: its domain alone says nothing.
      const keys = fieldsOf(schema, kind).filter((field) => KEY_FIELD.test(field) && typeof node[field] === "string" && String(node[field]).trim()).map((field) => nameKey(String(node[field])));
      const words = new Set([...wordsOf(named(schema, node)), ...keys]);
      wordSets.set(node.id, words);
      for (const word of words) index.set(word, [...(index.get(word) ?? []), node]);
    }
    const common = Math.max(4, Math.ceil(records.length * 0.25));
    for (const [word, holders] of index) {
      if (holders.length < 2 || holders.length > common) continue;
      for (let i = 0; i < holders.length; i++)
        for (let j = i + 1; j < holders.length; j++) {
          const a = wordSets.get(holders[i]!.id)!;
          const b = wordSets.get(holders[j]!.id)!;
          const shared = [...a].filter((one) => b.has(one)).length;
          // Each shared word adds 1 / the words between them, so a pair sums to its Jaccard.
          pair(holders[i]!, holders[j]!, 1 / (a.size + b.size - shared), `both have the word “${word}”`);
        }
    }
    // A short value both hold: an email, a phone, a website, a code.
    const byValue = new Map<string, { field: string; nodes: Node[] }>();
    const free = freeText(schema, kind);
    for (const node of records)
      for (const { field, text } of valueFields(schema, node, label, free)) {
        const key = `${field}\u0000${nameKey(text)}`;
        const was = byValue.get(key) ?? { field, nodes: [] };
        was.nodes.push(node);
        byValue.set(key, was);
      }
    for (const { field, nodes } of byValue.values()) {
      if (nodes.length < 2 || nodes.length > common) continue;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) pair(nodes[i]!, nodes[j]!, 1, `both have the same ${field}`, field);
    }
    // The host's ranker, asked of each record's name over the rest of its kind.
    if (options.near) {
      for (const node of records.slice(0, 50)) {
        const others = records.filter((one) => one.id !== node.id).map((one) => ({ id: one.id, kind, label: named(schema, one), texts: textsOf(schema, one).map(({ field, text }) => ({ field, reading: field, text })) }));
        let scores: readonly { id: string; score: number }[] = [];
        try {
          scores = await options.near(named(schema, node), others);
        } catch {
          scores = [];
        }
        for (const score of scores) {
          const other = records.find((one) => one.id === score.id);
          if (other && score.score >= 0.5) pair(node, other, score.score, "the host's search calls them near");
        }
      }
    }
    for (const { a, b, strength, evidence, keys } of byPair.values()) {
      const keeper = keeperOf(store, [a, b], context.touched, context.made);
      const other = keeper.id === a.id ? b : a;
      const keyFields = new Set([...keys, ...fieldsOf(schema, kind).filter((field) => KEY_FIELD.test(field) && typeof a[field] === "string" && typeof b[field] === "string" && String(a[field]).trim() && String(b[field]).trim())]);
      if (label) keyFields.delete(label);
      found.push({ kind, keeper, other, keys: [...keyFields], evidence, strength });
    }
  }
  return found.sort((a, b) => b.strength - a.strength).slice(0, options.maxPairs ?? 40);
}

/** The far records a record might link to through one relation, likeliest first. `holding` says how many of the kind's names hold a word. */
async function targetsOf(context: JudgeContext, node: Node, targets: readonly Node[], missing: boolean, options: BlockingOptions, holding: (word: string) => number): Promise<TargetBlock[]> {
  const schema = context.store.schema;
  const texts = textsOf(schema, node);
  const own = fold(named(schema, node));
  const said = texts.map(({ field, text }) => ({ field, text: fold(text) }));
  const ownWords = new Set(wordsOf(texts.map(({ text }) => text).join(" ")));
  /*
   * A WORD IS EVIDENCE ONLY WHEN IT IS TELLING: not a stop word or a common
   * one, and held by few of the kind's names — three at most, fewer in a
   * small kind — so "weekly" in five goals' names picks none of them, and
   * "standup" in one picks it.
   */
  const few = Math.max(1, Math.min(3, Math.floor(targets.length / 2)));
  const telling = (word: string) => tellingWord(word) && holding(word) <= few;
  const out = new Map<string, TargetBlock & { readonly weight: number }>();
  const put = (far: Node, evidence: string, weight: number, mentioned: boolean) => {
    const was = out.get(far.id);
    if (!was || was.weight < weight) out.set(far.id, { node: far, evidence, weight, mentioned });
  };
  for (const far of targets) {
    const name = fold(named(schema, far));
    if (name.replace(/ /g, "").length < 3 || name === own) continue;
    // Its whole name in the record's text.
    const whole = said.find(({ text }) => holds(text, name));
    if (whole) {
      put(far, `its ${humanizeField(whole.field).toLowerCase()} says “${named(schema, far)}”`, 3, true);
      continue;
    }
    // One of its key values, whole, in the record's text: an email, a code.
    const keys = fieldsOf(schema, far.kind)
      .filter((field) => KEY_FIELD.test(field) && typeof far[field] === "string")
      .map((field) => fold(String(far[field])))
      .filter((value) => value.replace(/ /g, "").length >= 3);
    const key = keys.find((value) => said.some(({ text }) => holds(text, value)));
    if (key) {
      put(far, `its text says “${key}”`, 2, true);
      continue;
    }
    // Its telling words in the record's text: one for a short name, two for a name of three words or more.
    const words = [...new Set(wordsOf(named(schema, far)))].filter(telling).filter((word) => said.some(({ text }) => holds(text, word)));
    const needed = name.split(" ").length >= 3 ? 2 : 1;
    if (words.length >= needed) {
      put(far, `its text says ${words.slice(0, 2).map((word) => `“${word}”`).join(" and ")}`, 2, true);
      continue;
    }
    if (!missing) continue;
    // For an empty one-link relation, a telling word or a value the two share is enough to ask.
    const farWords = wordsOf([named(schema, far), ...textsOf(schema, far).map(({ text }) => text)].join(" "));
    const shared = farWords.find((word) => ownWords.has(word) && telling(word));
    if (shared) put(far, `they share the word “${shared}”`, 1, false);
  }
  if (missing && options.near && out.size < (options.maxTargets ?? 8)) {
    try {
      const scores = await options.near(
        named(schema, node),
        targets.map((far) => ({ id: far.id, kind: far.kind, label: named(schema, far), texts: textsOf(schema, far).map(({ field, text }) => ({ field, reading: field, text })) })),
      );
      for (const score of scores) {
        const far = targets.find((one) => one.id === score.id);
        if (far && score.score >= 0.5) put(far, "the host's search calls it near", score.score, false);
      }
    } catch {
      // A ranker that fails puts nothing forward.
    }
  }
  return [...out.values()].sort((a, b) => b.weight - a.weight).slice(0, options.maxTargets ?? 8).map(({ node: far, evidence, mentioned }) => ({ node: far, evidence, mentioned }));
}

/** What each record is asked about: set aside, an empty choice, a link its text names, an empty one-link relation. */
async function recordsOf(context: JudgeContext, options: BlockingOptions): Promise<RecordBlock[]> {
  const { store } = context;
  const schema = store.schema;
  const today = new Date(context.now).toISOString().slice(0, 10);
  const wants = (family: string) => options.families.has(family);
  const found: (RecordBlock & { readonly weight: number })[] = [];
  for (const definition of schema.definitions) {
    const kind = definition.kind;
    if (tidyingOf(schema, kind) === "never") continue;
    const archives = wants("archive") && definition.archives !== false && actNamed(store, `archive-${kind}`) !== undefined;
    const finished = archives ? finishedOf(schema, kind, today) : undefined;
    const choices = wants("categorize")
      ? questionsForKind(store, kind).flatMap((question) => {
          if (question.about !== "field" || !question.writes || question.question.type !== "choice") return [];
          const field = formFields(definition.fields).find((one) => one.name === question.field);
          return field?.control === "choice" && field.optional && field.options?.length ? [{ field: field.name, options: field.options, writes: question.writes, instructions: question.question.instructions }] : [];
        })
      : [];
    const relations = (Object.entries(definition.edges ?? {}) as [string, { readonly to: readonly string[] | "*"; readonly cardinality?: string; readonly acts?: string; readonly description?: string }][]).flatMap(([relation, edge]) => {
      if (edge.acts === "none" || tidyingOf(schema, kind) === "no-links" || tidyingOf(schema, kind, relation) === "never") return [];
      const kinds = (edge.to === "*" ? schema.definitions.map((one) => one.kind) : edge.to).filter((target) => tidyingOf(schema, target) !== "never" && tidyingOf(schema, target) !== "no-links");
      const act = connectOf(store, kind, relation, kinds);
      if (!act) return [];
      const holding = namesHolding(schema, kinds.flatMap((target) => store.graph.nodesOfKind(target as never) as unknown as Node[]));
      return [{ relation, edge, kinds, act, holding }];
    });
    for (const node of store.graph.nodesOfKind(kind as never) as unknown as Node[]) {
      if (!mayTouch(context, node)) continue;
      let archive: RecordBlock["archive"];
      if (archives) {
        const moved = lastMoved(schema, node, context.touched);
        const days = moved === undefined ? -1 : Math.floor((context.now - moved) / 86_400_000);
        if (days >= context.olderThanDays) {
          const why = finished?.(node);
          archive = { days, ...(why ? { why } : {}) };
        }
      }
      const fills = choices.filter(({ field }) => node[field] === undefined || node[field] === null || node[field] === "").map(({ field, options: values, writes }) => {
        const description = (definition.fields.shape as Record<string, { description?: string }> | undefined)?.[field]?.description;
        return { field, options: values, writes, ...(description ? { description } : {}) };
      });
      const links: LinkBlock[] = [];
      for (const { relation, edge, kinds, act, holding } of relations) {
        const linked = new Set(store.graph.out(node.id, relation).map((one) => one.id));
        const missing = edge.cardinality === "one";
        if (missing && linked.size > 0) continue;
        if (!wants(missing ? "missing-links" : "links")) continue;
        const pool = kinds.flatMap((target) => store.graph.nodesOfKind(target as never) as unknown as Node[]).filter((far) => far.id !== node.id && !linked.has(far.id) && mayTouch(context, far));
        const targets = await targetsOf(context, node, pool, missing, options, holding);
        if (targets.length > 0) links.push({ relation, ...(edge.description ? { description: edge.description } : {}), missing, act, targets });
      }
      if (!archive && fills.length === 0 && links.length === 0) continue;
      // A record its declaration says is finished, then one that names another, comes first.
      const weight = (archive?.why ? 3 : archive ? 1 : 0) + links.filter((link) => link.targets.some((target) => target.mentioned)).length * 2 + links.length + fills.length;
      found.push({ node, ...(archive ? { archive } : {}), fills, links, weight });
    }
  }
  return found
    .sort((a, b) => b.weight - a.weight)
    .slice(0, options.maxRecords ?? 60)
    .map(({ weight: _weight, ...block }) => block);
}

/** What a run would ask a model about: pairs that may be one, and records with something to judge. */
export async function blocksOf(context: JudgeContext, options: BlockingOptions): Promise<Blocks> {
  return {
    pairs: options.families.has("duplicates") ? await pairsOf(context, options) : [],
    records: await recordsOf(context, options),
  };
}
