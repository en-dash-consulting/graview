/**
 * `@graview/core/learn` — APPS IMPROVE FROM USE (Roadmap f-learned-suggestions).
 *
 * The app's own actor ("Graview, tidying") suggests changes to records and
 * a person accepts or declines each (`@graview/core/tidying`). This is the
 * same actor suggesting changes to the APP — the declaration — from
 * evidence of use: the words people searched with and found nothing
 * (`@graview/core/friction`), the values a text field keeps repeating and
 * the dates written into one (the records), the same two acts taken one
 * after the other on one record (the op log), a place nobody opens (counts
 * a host passes), and an agent's tool calls that went wrong.
 *
 * Each is offered only when at least `minPeople` distinct people show it —
 * never one person's habit — and each is a suggestion, never a change:
 * `learnFromUse` reads and writes nothing, `acceptAppSuggestion` applies a
 * suggestion's edits through `editDocument` as one change with its lineage
 * (`{ basis, suggestion }`), and `declineAppSuggestion` is a decision a host
 * keeps (`LearnedStore`; `graview serve` keeps `learned.json` beside the
 * store) and hands back as `declined`, so the same suggestion — by its
 * `key`, stable across runs — is never offered again.
 *
 * Its own entry: a page draws nothing with it, and it reaches the editor.
 */
import { editDocument, type DocumentEdit, type EditOptions, type Fill } from "./document/edit.js";
import type { Finding } from "./document/findings.js";
import type { GraviewDocument } from "./document/schema.js";
import type { FrictionEvent } from "./friction.js";
import { lineageOf, type Lineage } from "./ops/lineage.js";
import { undoneIn } from "./ops/log.js";
import type { Author, Operation } from "./ops/types.js";
import { humanizeField, withArticle } from "./schema/define-node.js";
import { placeSlug } from "./views/types.js";

// ── the shapes ──────────────────────────────────────────────────────────────

/** One change to the app the actor suggests: its edits, what it would do and why, and how many people showed it. */
export interface AppSuggestion {
  /** Who it is, the same on every run: a decline holds by it. At most 120 characters. */
  readonly key: string;
  /** The edits that make it, as `editDocument` takes them. */
  readonly edits: readonly DocumentEdit[];
  /** What it would change, in a sentence. */
  readonly said: string;
  /** What it is based on, in a sentence: the lineage's `basis` once accepted. */
  readonly why: string;
  /** How many distinct people showed it, and how many times. */
  readonly evidence: { readonly people: number; readonly times: number };
}

/** A record, as the graph holds it. */
export type LearnedRecord = { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>;

/** A person's answer to a suggestion, kept where the host keeps the app's other state. */
export interface LearnedDecision {
  readonly key: string;
  readonly answer: "accepted" | "declined";
  readonly at: string;
  readonly by?: Author;
  /** What the suggestion would have changed, as it was said. */
  readonly said?: string;
}

export interface LearnInput {
  /** The app, as a document (`documentOf(app) ?? toDocument(app).document`). */
  readonly document: GraviewDocument;
  /** What people could not do, as the host keeps it (`friction.json` beside a served store). */
  readonly friction?: readonly FrictionEvent[];
  /** The store's op log: who wrote what, and the acts people take one after another. */
  readonly log?: readonly Operation[];
  /** The graph's records: the values a field keeps. Who wrote each is read from `log`. */
  readonly records?: readonly LearnedRecord[];
  /** What was answered before — decisions, or their keys alone — never offered again. */
  readonly declined?: readonly (string | { readonly key: string })[];
  /**
   * HOW MANY PEOPLE OPENED EACH PLACE, by its slug (`placeSlug(title)`), over
   * a window the host chose. The framework does not see a place open; a host
   * with analytics passes the counts. A declared place at 0 while another
   * was opened by `minPeople` or more is suggested hidden.
   */
  readonly opens?: Readonly<Record<string, number>>;
  /** The fewest distinct people a suggestion rests on: 3 unsaid, never fewer than 2. */
  readonly minPeople?: number;
}

/** What the actor learned: the suggestions, and what it saw and could not suggest, with why. */
export interface Learned {
  readonly suggestions: readonly AppSuggestion[];
  readonly skipped: readonly { readonly key: string; readonly why: string }[];
}

/** How far after a search that found nothing a person's next change is taken as what they were looking for. */
const FOLLOW_MS = 10 * 60_000;
/** How close two acts on one record are to be one sequence. */
const SEQUENCE_MS = 5 * 60_000;
/** The judge's name on what it suggests and what an accepted suggestion changes (`lineage.actor`). */
export const LEARNING_ACTOR = "learns from use";

// ── who ─────────────────────────────────────────────────────────────────────

/** The person behind an author — whom an agent acted for — or nobody: the app's own actor, a rule, the system. */
function personOf(author: Author | undefined): string | undefined {
  if (!author) return undefined;
  if (author.onBehalfOf) return personOf(author.onBehalfOf);
  if (author.automated || author.kind === "system" || author.kind === "rule" || author.kind === "visitor") return undefined;
  return `${author.kind}:${author.id ?? "?"}`;
}

const people = (count: number): string => `${count} ${count === 1 ? "person" : "people"}`;
const times = (count: number): string => (count === 1 ? "once" : `${count} times`);
const listed = (words: readonly string[]): string => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);

// ── the words the app already says ──────────────────────────────────────────

/** A word as it is compared: lower case, a plural's `s` gone. */
const stem = (word: string): string => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
const wordsOf = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);

/** Every word a kind, its noun, plural, fields, labels and aliases are called by, stemmed. */
function namesOf(document: GraviewDocument): ReadonlySet<string> {
  const names = new Set<string>();
  const add = (text: string | undefined) => {
    if (text) for (const word of wordsOf(text)) names.add(stem(word));
  };
  for (const [kind, spec] of Object.entries(document.kinds)) {
    add(kind);
    add(humanizeField(kind));
    add(spec.noun);
    add(spec.plural);
    for (const alias of spec.aliases ?? []) add(alias);
    for (const [field, f] of Object.entries(spec.fields)) {
      add(field);
      add(humanizeField(field));
      add(f.label);
      for (const alias of f.aliases ?? []) add(alias);
    }
  }
  return names;
}

/** Words as a search's are grouped: lower case, whitespace folded, the punctuation at the ends gone. */
const foldWords = (words: string): string =>
  words
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "");

/** Words that could be another name for something: one to three words of letters, three to forty characters. */
const couldBeAName = (words: string): boolean => words.length >= 3 && words.length <= 40 && /^[a-zß-ÿ][a-zß-ÿ'-]*(?: [a-zß-ÿ][a-zß-ÿ'-]*){0,2}$/.test(words);

// ── the log, read once ──────────────────────────────────────────────────────

/** The fields of a record's own a framework keeps, never a field a person wrote. */
const KEPT = new Set(["id", "kind"]);

interface ReadLog {
  /** The ops people made, in order: none undone, none an undo, none a suggestion. */
  readonly ops: readonly Operation[];
  /** Who last wrote each record's field: `<id>\u0000<field>` → person. */
  readonly writer: ReadonlyMap<string, string>;
  /** Each record's kind, as the log and the records say it. */
  readonly kindOf: ReadonlyMap<string, string>;
}

function readLog(log: readonly Operation[], records: readonly LearnedRecord[]): ReadLog {
  const undone = undoneIn(log);
  const ops = log.filter((op) => !op.undoes && !op.suggests && !op.withheld && !undone.has(op.id));
  const writer = new Map<string, string>();
  const kindOf = new Map<string, string>(records.map((record) => [record.id, record.kind]));
  for (const op of ops) {
    const who = personOf(op.author);
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node") kindOf.set(primitive.node.id, primitive.node.kind);
      const fields = primitive.op === "add-node" ? Object.keys(primitive.node) : primitive.op === "patch-node" ? Object.keys(primitive.after) : [];
      const id = primitive.op === "add-node" ? primitive.node.id : primitive.op === "patch-node" ? primitive.id : undefined;
      if (id === undefined) continue;
      for (const field of fields) {
        if (KEPT.has(field)) continue;
        if (who) writer.set(`${id}\u0000${field}`, who);
        else writer.delete(`${id}\u0000${field}`);
      }
    }
  }
  return { ops, writer, kindOf };
}

/** The record an op is about: its subject, else the first record it wrote. */
const subjectOf = (op: Operation): string | undefined => {
  const id = op.mutation?.args?.["id"];
  return typeof id === "string" ? id : op.writes[0];
};

/** The fields of its subject an op changed. */
function fieldsChanged(op: Operation, subject: string): string[] {
  return op.primitives.flatMap((primitive) => (primitive.op === "patch-node" && primitive.id === subject ? Object.keys(primitive.after).filter((field) => !KEPT.has(field)) : []));
}

// ── the judges ──────────────────────────────────────────────────────────────

interface Context {
  readonly document: GraviewDocument;
  readonly minPeople: number;
  readonly log?: ReadLog;
  readonly records: readonly LearnedRecord[];
  readonly friction: readonly FrictionEvent[];
  readonly skipped: { key: string; why: string }[];
}

/**
 * ANOTHER WORD FOR A KIND OR A FIELD: words several people searched with
 * and found nothing, that nothing in the app is called. What each of them
 * did next — the first change they made within ten minutes — says what
 * they were looking for: a field of a kind, when enough of them changed the
 * same one; else the kind, by what they changed or where they searched.
 */
function aliases(ctx: Context): AppSuggestion[] {
  const names = namesOf(ctx.document);
  const groups = new Map<string, { people: Map<string, { kind?: string; field?: string }>; times: number }>();
  for (const event of ctx.friction) {
    if (event.type !== "search-miss") continue;
    const who = personOf(event.by);
    const words = foldWords(event.words);
    if (!who || !couldBeAName(words) || wordsOf(words).every((word) => names.has(stem(word)))) continue;
    const group = groups.get(words) ?? { people: new Map(), times: 0 };
    group.times += 1;
    // What they did next, on the log: the kind of the record they changed, and the one field when it was one.
    const after = Date.parse(event.at);
    const next = ctx.log?.ops.find((op) => personOf(op.author) === who && Date.parse(op.at) > after && Date.parse(op.at) - after <= FOLLOW_MS);
    const subject = next ? subjectOf(next) : undefined;
    const kind = (subject && ctx.log?.kindOf.get(subject)) ?? event.kind;
    const changed = next && subject ? fieldsChanged(next, subject) : [];
    const vote = { ...(kind ? { kind } : {}), ...(changed.length === 1 ? { field: changed[0]! } : {}) };
    // A person's later evidence stands in for their earlier: one person, one vote.
    if (vote.kind || !group.people.has(who)) group.people.set(who, vote.kind ? vote : (group.people.get(who) ?? {}));
    groups.set(words, group);
  }
  const out: AppSuggestion[] = [];
  for (const [words, group] of groups) {
    if (group.people.size < ctx.minPeople) continue;
    const tally = (keyOf: (vote: { kind?: string; field?: string }) => string | undefined) => {
      const counts = new Map<string, number>();
      for (const vote of group.people.values()) {
        const key = keyOf(vote);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts].sort(([a, one], [b, other]) => other - one || a.localeCompare(b))[0];
    };
    const field = tally((vote) => (vote.kind && vote.field && ctx.document.kinds[vote.kind]?.fields[vote.field] ? `${vote.kind}.${vote.field}` : undefined));
    const kind = tally((vote) => (vote.kind && ctx.document.kinds[vote.kind] ? vote.kind : undefined));
    const evidence = { people: group.people.size, times: group.times };
    if (field && field[1] >= ctx.minPeople) {
      const [of, name] = field[0].split(".") as [string, string];
      out.push({
        key: `alias:${of}.${name}:${words}`.slice(0, 120),
        edits: [{ op: "add-alias", kind: of, field: name, alias: words }],
        said: `Take “${words}” as another word for ${of}'s ${name}, so search and the seat know it.`,
        why: `${people(group.people.size)} searched for “${words}” and found nothing, ${times(group.times)}; ${people(field[1])} then changed ${of}'s ${name}.`,
        evidence,
      });
    } else if (kind && kind[1] >= ctx.minPeople) {
      const spec = ctx.document.kinds[kind[0]]!;
      out.push({
        key: `alias:${kind[0]}:${words}`.slice(0, 120),
        edits: [{ op: "add-alias", kind: kind[0], alias: words }],
        said: `Take “${words}” as another word for ${withArticle(spec.noun ?? humanizeField(kind[0]).toLowerCase())}, so searching it finds the ${(spec.plural ?? `${kind[0]}s`).toLowerCase()}.`,
        why: `${people(group.people.size)} searched for “${words}” and found nothing, ${times(group.times)}, ${kind[1] === group.people.size ? "each" : `${kind[1]} of them`} looking among the ${(spec.plural ?? `${kind[0]}s`).toLowerCase()}.`,
        evidence,
      });
    }
  }
  return out;
}

/** The text fields of each kind a record's label is not written from, with their values across the records. */
function textFields(ctx: Context): { kind: string; field: string; values: { value: string; who?: string }[] }[] {
  const out: { kind: string; field: string; values: { value: string; who?: string }[] }[] = [];
  for (const [kind, spec] of Object.entries(ctx.document.kinds)) {
    const named = new Set([...(spec.label ?? "").matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]!));
    // Unsaid, a record is named by its first required word field (`defaultLabelField`): never a choice.
    if (!spec.label) {
      const first = Object.entries(spec.fields).find(([, f]) => f.type === "string" && f.required) ?? Object.entries(spec.fields).find(([, f]) => f.type === "string");
      if (first) named.add(first[0]);
    }
    for (const [field, f] of Object.entries(spec.fields)) {
      if ((f.type !== "string" && f.type !== "text") || named.has(field) || f.format === "markdown") continue;
      const values = ctx.records
        .filter((record) => record.kind === kind && typeof record[field] === "string" && (record[field] as string).trim() !== "")
        .map((record) => {
          const who = ctx.log?.writer.get(`${record.id}\u0000${field}`);
          return { value: (record[field] as string).trim(), ...(who ? { who } : {}) };
        });
      if (values.length > 0) out.push({ kind, field, values });
    }
  }
  return out;
}

/**
 * A CHOICE FIELD THE APP IS MISSING: a text field whose values, across
 * at least six records, are two to eight values each written at least
 * twice, by `minPeople` people or more — retyped to a choice of them, the
 * most used first. Values that convert are kept, as every retype keeps them.
 */
function choices(ctx: Context): AppSuggestion[] {
  const out: AppSuggestion[] = [];
  for (const { kind, field, values } of textFields(ctx)) {
    if (values.length < 6) continue;
    const counts = new Map<string, number>();
    for (const { value } of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const options = [...counts].sort(([a, one], [b, other]) => other - one || a.localeCompare(b)).map(([value]) => value);
    if (options.length < 2 || options.length > 8 || options.length * 2 > values.length) continue;
    if ([...counts.values()].some((count) => count < 2) || options.some((option) => option.length > 40)) continue;
    const writers = new Set(values.flatMap((one) => (one.who ? [one.who] : [])));
    if (writers.size < ctx.minPeople) continue;
    const plural = (ctx.document.kinds[kind]!.plural ?? `${kind}s`).toLowerCase();
    out.push({
      key: `choice:${kind}.${field}`,
      edits: [{ op: "retype-field", kind, field, type: "enum", options }],
      said: `Make ${kind}'s ${field} a choice of ${listed(options)}, so it is picked rather than typed, and a list can be grouped and filtered by it.`,
      why: `${values.length} ${plural}' ${field} hold only these ${options.length} values, written by ${people(writers.size)}.`,
      evidence: { people: writers.size, times: values.length },
    });
  }
  return out;
}

/** A date written in words: 2026-11-02, 11/2/2026, March 3, 3 March. */
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}/(?:\\d{4}|\\d{2})\\b|\\b${MONTH} \\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}(?:st|nd|rd|th)? ${MONTH}(?=\\s|$|[.,;])`, "i");

/**
 * A DATE FIELD THE APP IS MISSING: a text field most of whose values —
 * three in five, of at least five records — carry a date in words, written
 * by `minPeople` people or more. A date field is added beside it, and
 * nothing is moved: the dates stay in the words until somebody moves them.
 */
function dates(ctx: Context): AppSuggestion[] {
  const out: AppSuggestion[] = [];
  for (const { kind, field, values } of textFields(ctx)) {
    if (values.length < 5) continue;
    const dated = values.filter((one) => DATE.test(one.value));
    if (dated.length * 5 < values.length * 3) continue;
    const writers = new Set(dated.flatMap((one) => (one.who ? [one.who] : [])));
    if (writers.size < ctx.minPeople) continue;
    const spec = ctx.document.kinds[kind]!;
    const name = /date$/i.test(field) ? `${field}On` : `${field}Date`;
    if (spec.fields[name] || spec.edges?.[name]) {
      ctx.skipped.push({ key: `date:${kind}.${field}`, why: `${kind}'s ${field} holds dates, and ${kind} already has a ${name} to suggest beside it.` });
      continue;
    }
    const plural = (spec.plural ?? `${kind}s`).toLowerCase();
    out.push({
      key: `date:${kind}.${field}`,
      edits: [{ op: "add-field", kind, field: name, type: "date", description: `The date people wrote into ${field}.` }],
      said: `Give ${kind} a date field, ${name}, beside ${field}, so a calendar, a sort and a rule can read it. Nothing is moved: the dates stay in ${field} until somebody moves them by hand.`,
      why: `${dated.length} of ${values.length} ${plural}' ${field} carry a date in words, written by ${people(writers.size)}.`,
      evidence: { people: writers.size, times: dated.length },
    });
  }
  return out;
}

/** What keeps an act from being part of one composed act, or nothing: an act that only sets its subject's fields composes. */
function cannotCompose(document: GraviewDocument, name: string): string | undefined {
  const act = document.acts?.[name] as Record<string, unknown> | undefined;
  if (!act) return `${name} is not an act the document writes (it is code, or derived from the kinds)`;
  const more = Object.keys(act).filter((key) => !["title", "description", "on", "sets", "writes", "args", "allowedWhen", "refusal"].includes(key));
  if (more.length > 0) return `${name} does more than set its record's fields (${more.join(", ")})`;
  if (!act["on"] || Array.isArray(act["on"])) return `${name} is not on one kind`;
  return undefined;
}

/**
 * ONE ACT FOR A SEQUENCE SEVERAL PEOPLE REPEAT: two acts one person takes
 * one after the other, within five minutes, on the same record, by
 * `minPeople` people or more — composed into one act when the act language
 * can say it: both document acts that only set fields of the same kind,
 * neither asking for or setting a field the other does, the second with no
 * condition of its own (it would read the record after the first). Pairs
 * alone; a longer sequence is suggested pair by pair.
 */
function sequences(ctx: Context): AppSuggestion[] {
  if (!ctx.log) return [];
  const groups = new Map<string, { first: string; second: string; people: Set<string>; times: number }>();
  const last = new Map<string, Operation>();
  for (const op of ctx.log.ops) {
    const who = personOf(op.author);
    if (!who || !op.mutation) continue;
    const before = last.get(who);
    last.set(who, op);
    if (!before?.mutation || before.mutation.name === op.mutation.name) continue;
    const subject = subjectOf(op);
    if (!subject || subjectOf(before) !== subject || Date.parse(op.at) - Date.parse(before.at) > SEQUENCE_MS) continue;
    const key = `${before.mutation.name}>${op.mutation.name}`;
    const group = groups.get(key) ?? { first: before.mutation.name, second: op.mutation.name, people: new Set<string>(), times: 0 };
    group.people.add(who);
    group.times += 1;
    groups.set(key, group);
  }
  const out: AppSuggestion[] = [];
  for (const [sequence, { first, second, people: who, times: count }] of groups) {
    if (who.size < ctx.minPeople) continue;
    const key = `act:${sequence}`.slice(0, 120);
    const why = `${people(who.size)} took ${first} then ${second} on the same record, ${times(count)}.`;
    const refused = cannotCompose(ctx.document, first) ?? cannotCompose(ctx.document, second);
    if (refused) {
      ctx.skipped.push({ key, why: `${why} They cannot be one act: ${refused}.` });
      continue;
    }
    const a = ctx.document.acts![first] as Record<string, any>;
    const b = ctx.document.acts![second] as Record<string, any>;
    const fieldsOf = (act: Record<string, any>) => [...Object.keys(act["sets"] ?? {}), ...((act["writes"] ?? []) as string[]), ...Object.keys(act["args"] ?? {})];
    const shared = fieldsOf(a).filter((field) => fieldsOf(b).includes(field));
    const name = `${first}-and-${second}`;
    const reason =
      a["on"] !== b["on"] ? `${first} is on ${a["on"]} and ${second} on ${b["on"]}` : shared.length > 0 ? `both set ${listed(shared)}` : b["allowedWhen"] ? `${second}'s condition would read the record after ${first}` : ctx.document.acts![name] ? `the name ${name} is taken` : undefined;
    if (reason) {
      ctx.skipped.push({ key, why: `${why} They cannot be one act: ${reason}.` });
      continue;
    }
    const titleOf = (act: Record<string, any>, actName: string) => (act["title"] as string | undefined) ?? humanizeField(actName);
    const title = `${titleOf(a, first)}, then ${titleOf(b, second).replace(/^./, (letter) => letter.toLowerCase())}`.slice(0, 80);
    const sets = { ...(a["sets"] ?? {}), ...(b["sets"] ?? {}) };
    const writes = [...((a["writes"] ?? []) as string[]), ...((b["writes"] ?? []) as string[])];
    const args = { ...(a["args"] ?? {}), ...(b["args"] ?? {}) };
    out.push({
      key,
      edits: [
        {
          op: "add-act",
          act: name,
          title,
          description: `${titleOf(a, first)} and ${titleOf(b, second).replace(/^./, (letter) => letter.toLowerCase())}, as one act.`.slice(0, 500),
          on: a["on"],
          ...(Object.keys(sets).length > 0 ? { sets } : {}),
          ...(writes.length > 0 ? { writes } : {}),
          ...(Object.keys(args).length > 0 ? { args } : {}),
          ...(a["allowedWhen"] ? { allowedWhen: a["allowedWhen"], ...(a["refusal"] ? { refusal: a["refusal"] } : {}) } : {}),
        },
      ],
      said: `Add one act, “${title}”, that does what ${first} and ${second} do one after the other.`,
      why,
      evidence: { people: who.size, times: count },
    });
  }
  return out;
}

/**
 * A PLACE NOBODY OPENS: a declared place the host's counts say nobody
 * opened, while another was opened by `minPeople` people or more — hidden,
 * not removed, so it is still reached by its address and brought back with
 * one edit. Only from counts a host passes: the framework sees no place open.
 */
function retirements(ctx: Context, opens: Readonly<Record<string, number>> | undefined): AppSuggestion[] {
  if (!opens || Math.max(0, ...Object.values(opens)) < ctx.minPeople) return [];
  const most = Math.max(...Object.values(opens));
  return ((ctx.document.lenses ?? []) as readonly { readonly title?: string; readonly hidden?: boolean }[]).flatMap((lens) => {
    if (!lens.title || lens.hidden) return [];
    const slug = placeSlug(lens.title);
    if (opens[slug] !== 0) return [];
    return [
      {
        key: `retire:${slug}`.slice(0, 120),
        edits: [{ op: "set-lens-hidden", title: lens.title, hidden: true }],
        said: `Hide “${lens.title}” from the bar and the page list; it is still reached by its address, and one edit brings it back.`,
        why: `Nobody opened “${lens.title}”, while the most opened place had ${people(most)}.`,
        evidence: { people: 0, times: 0 },
      },
    ];
  });
}

/**
 * AN ACT AGENTS CALL WRONGLY: tool calls refused as invalid, then made in
 * a form that worked (`then`), by agents acting for `minPeople` people or
 * more. No change to what the act does: its description says the form that
 * worked, replacing it, when the act is the document's. One that is code or
 * derived is said in `skipped`.
 */
function toolDescriptions(ctx: Context): AppSuggestion[] {
  const groups = new Map<string, { people: Set<string>; times: number; forms: Map<string, number> }>();
  for (const event of ctx.friction) {
    if (event.type !== "tool-invalid" || !event.act || !event.then) continue;
    const who = personOf(event.by) ?? (event.by.id !== undefined ? `${event.by.kind}:${event.by.id}` : undefined);
    if (!who) continue;
    const group = groups.get(event.act) ?? { people: new Set<string>(), times: 0, forms: new Map<string, number>() };
    group.people.add(who);
    group.times += 1;
    group.forms.set(event.then, (group.forms.get(event.then) ?? 0) + 1);
    groups.set(event.act, group);
  }
  const out: AppSuggestion[] = [];
  for (const [act, group] of groups) {
    if (group.people.size < ctx.minPeople) continue;
    const key = `describe-act:${act}`.slice(0, 120);
    const why = `Agents acting for ${people(group.people.size)} called ${act} in a form it refused, ${times(group.times)}, and then in one it took.`;
    const spec = ctx.document.acts?.[act] as Record<string, unknown> | undefined;
    if (!spec) {
      ctx.skipped.push({ key, why: `${why} Its description is not the document's to change: ${act} is code or derived.` });
      continue;
    }
    const form = [...group.forms].sort(([a, one], [b, other]) => other - one || a.localeCompare(b))[0]![0];
    const base = ((spec["description"] as string | undefined) ?? (spec["title"] as string | undefined) ?? humanizeField(act)).replace(/\s*Called as \{.*\}\.$/, "").replace(/([^.!?])$/, "$1.");
    const description = `${base} Called as ${form}.`;
    if (description.length > 500 || spec["description"] === description) continue;
    out.push({
      key,
      edits: [{ op: "add-act", act, replace: true, ...spec, description }],
      said: `Say in ${act}'s description the form a call takes: “${description}”`,
      why,
      evidence: { people: group.people.size, times: group.times },
    });
  }
  return out;
}

// ── the judge ───────────────────────────────────────────────────────────────

/** The suggestions, with what the actor saw and could not suggest, and why. */
export function learningFrom(input: LearnInput): Learned {
  const minPeople = Math.max(2, Math.floor(input.minPeople ?? 3));
  const records = input.records ?? [];
  const ctx: Context = {
    document: input.document,
    minPeople,
    ...(input.log ? { log: readLog(input.log, records) } : {}),
    records,
    friction: input.friction ?? [],
    skipped: [],
  };
  const answered = new Set((input.declined ?? []).map((one) => (typeof one === "string" ? one : one.key)));
  const suggestions = [...aliases(ctx), ...choices(ctx), ...dates(ctx), ...sequences(ctx), ...toolDescriptions(ctx), ...retirements(ctx, input.opens)]
    .filter((one) => !answered.has(one.key))
    .sort((a, b) => b.evidence.people - a.evidence.people || b.evidence.times - a.evidence.times || a.key.localeCompare(b.key));
  return { suggestions, skipped: ctx.skipped.filter((one) => !answered.has(one.key)) };
}

/**
 * WHAT THE APP'S OWN ACTOR SUGGESTS CHANGING IN THE APP, from evidence of
 * use. Reads and writes nothing; a person accepts each
 * (`acceptAppSuggestion`) or declines it (`declineAppSuggestion`).
 */
export function learnFromUse(input: LearnInput): AppSuggestion[] {
  return [...learningFrom(input).suggestions];
}

// ── answering one ───────────────────────────────────────────────────────────

export interface AnswerOptions {
  /** Who answered. */
  readonly by?: Author;
  /** When, as an ISO time; now unsaid. */
  readonly at?: string;
}

export type AcceptedSuggestion =
  | {
      readonly ok: true;
      readonly document: GraviewDocument;
      /** What the edits did, in the editor's words. */
      readonly said: readonly string[];
      /** Values for records already there, for the migration (`editDocument`'s). */
      readonly fills: readonly Fill[];
      /** What the change is based on: the suggestion's why, and its key. */
      readonly lineage: Lineage;
      /** The answer, for the host to keep beside its other decisions. */
      readonly decision: LearnedDecision;
    }
  | { readonly ok: false; readonly findings: readonly Finding[] };

/**
 * ACCEPT A SUGGESTION: its edits applied to the document through
 * `editDocument`, as one change, carrying its lineage — `{ basis: why,
 * suggestion: key }` — and the decision the host keeps. The caller compiles,
 * checks and keeps the document as it keeps any other change; an edit that
 * no longer applies is refused with the editor's findings.
 */
export function acceptAppSuggestion(document: GraviewDocument, suggestion: AppSuggestion, options: AnswerOptions & EditOptions = {}): AcceptedSuggestion {
  const edited = editDocument(document, suggestion.edits, { ...(options.fonts ? { fonts: options.fonts } : {}), ...(options.views ? { views: options.views } : {}) });
  if (!edited.ok) return edited;
  const lineage = lineageOf({ basis: suggestion.why.slice(0, 500), suggestion: suggestion.key.slice(0, 120), actor: LEARNING_ACTOR })!;
  return { ok: true, document: edited.document, said: edited.said, fills: edited.fills, lineage, decision: decisionOf(suggestion, "accepted", options) };
}

/** DECLINE A SUGGESTION: the decision a host keeps and hands back as `declined`, so it is never offered again. Changes nothing. */
export function declineAppSuggestion(suggestion: AppSuggestion | string, options: AnswerOptions = {}): LearnedDecision {
  return decisionOf(suggestion, "declined", options);
}

function decisionOf(suggestion: AppSuggestion | string, answer: LearnedDecision["answer"], options: AnswerOptions): LearnedDecision {
  const key = typeof suggestion === "string" ? suggestion : suggestion.key;
  return { key, answer, at: options.at ?? new Date().toISOString(), ...(options.by ? { by: options.by } : {}), ...(typeof suggestion === "string" ? {} : { said: suggestion.said }) };
}

// ── keeping the answers ─────────────────────────────────────────────────────

/**
 * WHERE A HOST KEEPS WHAT PEOPLE ANSWERED: append and read back.
 * `memoryLearned` here; `fileLearned` (`learned.json` beside the store,
 * where `graview serve` keeps the friction log) in `@graview/ship`; a host's
 * own anywhere — Graview Cloud beside an app's document versions.
 */
export interface LearnedStore {
  add(decision: LearnedDecision): void | Promise<void>;
  list(): readonly LearnedDecision[] | Promise<readonly LearnedDecision[]>;
}

/** A store that answers at once. */
export interface HeldLearned extends LearnedStore {
  add(decision: LearnedDecision): void;
  list(): readonly LearnedDecision[];
}

/** The decisions kept, one per key: the latest answer stands. */
export function keptDecisions(decisions: readonly LearnedDecision[]): readonly LearnedDecision[] {
  const latest = new Map<string, LearnedDecision>();
  for (const decision of decisions) latest.set(decision.key, decision);
  return [...latest.values()];
}

/** Answers kept in memory for as long as the process runs. */
export function memoryLearned(): HeldLearned {
  let held: readonly LearnedDecision[] = [];
  return {
    add(decision) {
      held = keptDecisions([...held, decision]);
    },
    list: () => held,
  };
}
