/**
 * WHAT A DECLARATION IS MADE OF, in a closed vocabulary (Roadmap
 * f-document-traits; the starter's deconstruction of templates).
 *
 * A template's pitch says what it is for; its declaration says what it is
 * made of — a status that moves, people who own things, money against a
 * budget — and two templates that share no word of prose can share most of
 * their structure. `traitsOf` reads that structure off the declaration,
 * never off hand-written tags, and says each trait it finds with the kinds,
 * fields, relations, rules, lenses and acts that carry it and one sentence
 * a person reads ("Vendors' quote against each category's budget").
 *
 * Conservative, as `inferJobs` is: a trait is read only where the
 * declaration leaves no doubt — a status needs its step acts, ownership a
 * relation of one to a kind that is people, a budget a field called one
 * beside a money field — so a host asking "does this app have X?" is told
 * yes only when it would draw X. The vocabulary is a stability surface
 * (`docs/stability.md`): a name is never renamed or taken away within the
 * major, and one added is said in the changelog.
 *
 * Exported on `@graview/core/compose`, on no page.
 */
import type { GraviewApp } from "./app.js";
import type { GraviewDocument, KindSpec } from "./document/schema.js";
import { toDocument } from "./document/to-document.js";
import { humanizeField } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

/** The closed vocabulary, in the order traits are said. */
export const TRAITS = ["owners", "status", "schedule", "budget", "places", "sources", "stock", "votes", "private", "history", "publishing", "roster", "routines", "comparison"] as const;
export type TraitName = (typeof TRAITS)[number];

/** Each trait in a person's words, as a chip or a question says it ("Does what they described need people who own things?"). */
export const TRAIT_WORDS: Readonly<Record<TraitName, string>> = {
  owners: "people who own things",
  status: "a status that moves",
  schedule: "dates it is due by, or a schedule",
  budget: "money against a budget",
  places: "places",
  sources: "sources behind claims",
  stock: "counts in stock",
  votes: "votes or picks",
  private: "private to its owner",
  history: "a history, a record book",
  publishing: "content to publish",
  roster: "a roster of people",
  routines: "repeating routines",
  comparison: "a comparison to pick one from",
};

/** One trait a declaration carries: what carries it, named, and one sentence. Fields and relations are said as `<kind>.<name>`; lenses by title. */
export interface Trait {
  readonly trait: TraitName;
  readonly words: string;
  readonly said: string;
  readonly kinds: readonly string[];
  readonly fields: readonly string[];
  readonly relations: readonly string[];
  readonly rules: readonly string[];
  readonly lenses: readonly string[];
  readonly acts: readonly string[];
}

/*
 * THE WORDS THE READING LEANS ON. Kind names that are people, places or
 * the groupings of a record book; field names that say a date is one a
 * record is due by, or one that only records the past; the relation names
 * that say ownership. Each list is what the catalog's own templates say,
 * and nothing a declaration could not have meant.
 */
const PERSON_NOUNS = new Set(["person", "people", "member", "user", "player", "guest", "candidate", "participant", "traveller", "traveler", "volunteer", "interviewer", "interviewee", "contact", "trade", "staff", "student", "employee", "teammate", "crew", "attendee", "friend", "customer", "client", "driver", "speaker", "host", "teacher", "parent", "kid", "child", "coach", "patient", "tenant", "resident", "neighbor", "applicant", "recruit", "contributor", "assignee", "worker", "collaborator", "runner"]);
const PLACE_NOUNS = new Set(["place", "venue", "location", "room", "site", "building", "store", "warehouse", "city", "country", "region", "address", "hall", "stadium", "office", "shelf"]);
const SOURCE_NOUNS = new Set(["source", "reference", "citation", "evidence"]);
const GROUPING_NOUNS = new Set(["season", "era", "period", "epoch", "edition", "generation", "age", "campaign", "tournament"]);
const OWNER_EDGE = /owner|owned|assign|^lead$|responsible|^by$|^by-|done-?by|interviewer|reviewer|maker|author|keeper|givenby|^for-?person$/i;
export const DUE_FIELD = /due|deadline|until|needed|needby|target|expires|^ends?(on|at)?$|^by$/i;
const SCHEDULE_FIELD = /^(date|day|when|at|start|starts|startsat|startson|startdate|scheduled|scheduledfor|scheduledon|happens|happenson|held|heldon|from|time|exchangedate|.*date|.*day)$/i;
const PAST_FIELD = /released|fixed|published|applied|checked|created|added|done|last|first|updated|seen|born|birth|founded|finished|completed|closed/i;
const STATUS_FIELD = /status|stage|state|phase|progress/i;
const BUDGET_FIELD = /budget|limit|cap$|allowance/i;
const MONEY_FIELD = /budget|cost|price|quote|amount|salary|fee|spend|total|paid|owed/i;
const PLACE_FIELD = /^(place|location|venue|address|where|city|town)$/i;
const STOCK_FIELD = /reorder|onhand|instock|^stock|quantity|^qty/i;
const VOTE_FIELD = /^votes?$|votecount|upvotes|^score$|^points$/i;
const VOTE_EDGE = /^(votes?|votesfor|votedby|voters|picks?|chooses|choices|favorites|likes)$/i;
const CADENCE_FIELD = /often|frequency|cadence|^every$|repeat|interval/i;
const LAST_DONE_FIELD = /^last/i;
const PUBLISHED_OPTION = /^(published|live|public)$/i;
const ONE_PER_GROUP = /count\(.*\bwhere\b.*\)\s*<=\s*1\b/;

const lower = (value: string) => value.toLowerCase();
const nounOf = (document: GraviewDocument, kind: string) => lower(document.kinds[kind]?.noun ?? humanizeField(kind));
const pluralOf = (document: GraviewDocument, kind: string) => lower(document.kinds[kind]?.plural ?? `${nounOf(document, kind)}s`);
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const Plural = (document: GraviewDocument, kind: string) => capital(pluralOf(document, kind));
const an = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");
const listed = (words: readonly string[], join = "and") => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} ${join} ${words[words.length - 1]}`);
/** The identifiers an expression or a template says — field, relation and kind names, quoted or bare. */
const tokens = (text: string | undefined) => new Set((text ?? "").split(/[^A-Za-z0-9_-]+/).filter(Boolean));
const kindsOf = (document: GraviewDocument): [string, KindSpec][] => Object.entries(document.kinds);
type Acts = NonNullable<GraviewDocument["acts"]>;
const actsOn = (document: GraviewDocument, kind: string): [string, Acts[string]][] => Object.entries(document.acts ?? {}).filter(([, act]) => [act.on ?? []].flat().includes(kind));
type Lens = { readonly name?: unknown; readonly title?: unknown; readonly bindings?: unknown; readonly on?: unknown };
const lensesOf = (document: GraviewDocument): Lens[] => (Array.isArray(document.lenses) ? (document.lenses as Lens[]) : []);
const titleOf = (lens: Lens) => (typeof lens.title === "string" ? lens.title : undefined);
const bindingsOf = (lens: Lens): Record<string, Record<string, unknown>> => (lens.bindings && typeof lens.bindings === "object" ? (lens.bindings as Record<string, Record<string, unknown>>) : {});
/** A single target kind of this document, where a relation leads to one. */
const targetOf = (document: GraviewDocument, to: unknown): string | undefined => (Array.isArray(to) && to.length === 1 && typeof to[0] === "string" && document.kinds[to[0]] ? to[0] : undefined);

/** Whether the kind stands for people: declared so, or named so. */
export function isPeopleKind(document: GraviewDocument, kind: string): boolean {
  const spec = document.kinds[kind];
  if (!spec) return false;
  return spec.people === true || PERSON_NOUNS.has(lower(kind)) || PERSON_NOUNS.has(nounOf(document, kind));
}
const isPlaceKind = (document: GraviewDocument, kind: string) => PLACE_NOUNS.has(lower(kind)) || PLACE_NOUNS.has(nounOf(document, kind));
const isSourceKind = (document: GraviewDocument, kind: string) => SOURCE_NOUNS.has(lower(kind)) || SOURCE_NOUNS.has(nounOf(document, kind));
const isGroupingKind = (document: GraviewDocument, kind: string) => GROUPING_NOUNS.has(lower(kind)) || GROUPING_NOUNS.has(nounOf(document, kind));
const isMoneyField = (name: string, field: KindSpec["fields"][string]) => (field.type === "number" || field.type === "integer") && (field.format === "money" || MONEY_FIELD.test(name));
const isDate = (field: KindSpec["fields"][string]) => field.type === "date" || field.type === "datetime";

/** Lenses of one name whose bindings name this kind's field in this role (a calendar's `start`, a board's `column`). */
function lensesBinding(document: GraviewDocument, name: string, kind: string, role: string, field: string): string[] {
  return lensesOf(document)
    .filter((lens) => lens.name === name && bindingsOf(lens)[kind]?.[role] === field)
    .map(titleOf)
    .filter((title): title is string => title !== undefined);
}
/** Coverage lenses whose rows or columns are the kind. */
function coveragesOver(document: GraviewDocument, kind: string, side: "rows" | "columns", edge?: string): string[] {
  return lensesOf(document)
    .filter((lens) => lens.name === "coverage" && bindingsOf(lens)[side]?.["kind"] === kind && (edge === undefined || bindingsOf(lens)["link"]?.["edge"] === edge))
    .map(titleOf)
    .filter((title): title is string => title !== undefined);
}
/** The rules whose expressions or words say any of these names, over any of these kinds (or the graph). */
function rulesSaying(document: GraviewDocument, names: readonly string[], over?: readonly string[]): string[] {
  const wanted = new Set(names);
  return Object.entries(document.rules ?? {})
    .filter(([, rule]) => (over === undefined || rule.over === "graph" || over.includes(rule.over)) && [...tokens(`${rule.when ?? ""} ${rule.require} ${rule.says ?? ""}`)].some((token) => wanted.has(token)))
    .map(([name]) => name);
}

/** What one reading found: the carriers, gathered; the sentence, from the first (the kind people see most) unless said otherwise. */
class Found {
  readonly kinds = new Set<string>();
  readonly fields = new Set<string>();
  readonly relations = new Set<string>();
  readonly rules = new Set<string>();
  readonly lenses = new Set<string>();
  readonly acts = new Set<string>();
  said: string | undefined;
  readonly add = (part: "kinds" | "fields" | "relations" | "rules" | "lenses" | "acts", ...names: readonly string[]) => {
    for (const name of names) this[part].add(name);
  };
  readonly say = (sentence: string) => {
    this.said ??= sentence;
  };
  readonly any = () => this.kinds.size + this.fields.size + this.relations.size + this.rules.size + this.lenses.size + this.acts.size > 0;
  readonly asTrait = (trait: TraitName): Trait => ({ trait, words: TRAIT_WORDS[trait], said: this.said ?? TRAIT_WORDS[trait], kinds: [...this.kinds], fields: [...this.fields], relations: [...this.relations], rules: [...this.rules], lenses: [...this.lenses], acts: [...this.acts] });
}

/** The kind people see most: the one with the most fields, declared earliest among equals — what `startingDocument` joins a module to. */
export function mainKindOf(document: GraviewDocument): string | undefined {
  let best: { kind: string; fields: number } | undefined;
  for (const [kind, spec] of kindsOf(document)) {
    const fields = Object.keys(spec.fields).length + Object.keys(spec.edges ?? {}).length;
    if (!best || fields > best.fields) best = { kind, fields };
  }
  return best?.kind;
}
/** Kinds in the order a reading walks them: the kind people see most first, then as declared. */
function walked(document: GraviewDocument): [string, KindSpec][] {
  const main = mainKindOf(document);
  return kindsOf(document).sort(([a], [b]) => Number(b === main) - Number(a === main));
}

/** A choice field that moves: an enum whose values named step acts set — a status, a stage — with the acts that move it. */
export function movingChoices(document: GraviewDocument, kind: string): { field: string; options: readonly string[]; steps: string[] }[] {
  const spec = document.kinds[kind];
  if (!spec) return [];
  const found: { field: string; options: readonly string[]; steps: string[] }[] = [];
  for (const [name, field] of Object.entries(spec.fields)) {
    if (field.type !== "enum" || !Array.isArray(field.options) || field.options.length < 2) continue;
    const steps = actsOn(document, kind)
      .filter(([, act]) => typeof act.sets?.[name] === "string" && (field.options as string[]).includes(act.sets[name] as string))
      .map(([act]) => act);
    const named = STATUS_FIELD.test(name) || spec.lifecycle?.field === name;
    if ((named && steps.length >= 1) || steps.length >= 2) found.push({ field: name, options: field.options, steps });
  }
  return found;
}

/*
 * THE FOURTEEN READINGS, one a trait. Each walks the kinds people see most
 * first, gathers what carries the trait, and says the first instance.
 */
const READINGS: Readonly<Record<TraitName, (document: GraviewDocument, found: Found) => void>> = {
  owners(document, found) {
    for (const [kind, spec] of walked(document)) {
      for (const [edge, relation] of Object.entries(spec.edges ?? {})) {
        const target = targetOf(document, relation.to);
        if (relation.cardinality !== "one" || !target || !isPeopleKind(document, target) || !OWNER_EDGE.test(edge)) continue;
        found.add("kinds", kind, target);
        found.add("relations", `${kind}.${edge}`);
        found.add("rules", ...rulesSaying(document, [edge], [kind, target]));
        found.add("lenses", ...coveragesOver(document, kind, "rows", edge));
        found.add("acts", ...actsOn(document, kind).filter(([, act]) => act.connects === edge || act.severs === edge).map(([act]) => act));
        found.say(`Each ${nounOf(document, kind)} has one of the ${pluralOf(document, target)} on it (${edge}).`);
      }
    }
  },
  status(document, found) {
    for (const [kind] of walked(document)) {
      for (const { field, options, steps } of movingChoices(document, kind)) {
        found.add("kinds", kind);
        found.add("fields", `${kind}.${field}`);
        found.add("acts", ...steps);
        found.add("rules", ...rulesSaying(document, [field], [kind]));
        found.add("lenses", ...lensesBinding(document, "columns", kind, "column", field));
        found.say(`${Plural(document, kind)} move through ${listed(options.map(lower))}.`);
      }
    }
  },
  schedule(document, found) {
    for (const [kind, spec] of walked(document)) {
      for (const [name, field] of Object.entries(spec.fields)) {
        if (!isDate(field) || PAST_FIELD.test(name)) continue;
        const calendars = lensesBinding(document, "calendar", kind, "start", name);
        const due = DUE_FIELD.test(name);
        if (!due && !SCHEDULE_FIELD.test(name) && calendars.length === 0) continue;
        found.add("kinds", kind);
        found.add("fields", `${kind}.${name}`);
        found.add("lenses", ...calendars);
        found.add("rules", ...rulesSaying(document, [name], [kind]));
        found.add("acts", ...actsOn(document, kind).filter(([, act]) => (act.writes ?? []).includes(name) || act.sets?.[name] !== undefined).map(([act]) => act));
        const words = /date|day|when|time/i.test(name) ? lower(humanizeField(name)) : `date (${name})`;
        found.say(due ? `${Plural(document, kind)} are due by a date (${name}).` : `${Plural(document, kind)} have ${an(words)} ${words}${calendars.length > 0 ? ", on a calendar" : ""}.`);
      }
    }
  },
  budget(document, found) {
    const budgets = kindsOf(document).flatMap(([kind, spec]) => Object.entries(spec.fields).filter(([name, field]) => (field.type === "number" || field.type === "integer") && BUDGET_FIELD.test(name)).map(([name]) => ({ kind, name })));
    if (budgets.length === 0) return;
    const sums = walked(document).flatMap(([kind, spec]) => Object.entries(spec.fields).filter(([name, field]) => isMoneyField(name, field) && !BUDGET_FIELD.test(name)).map(([name]) => ({ kind, name })));
    if (sums.length === 0) return;
    const names = [...budgets, ...sums].map((one) => one.name);
    for (const one of [...budgets, ...sums]) {
      found.add("kinds", one.kind);
      found.add("fields", `${one.kind}.${one.name}`);
      found.add("acts", ...actsOn(document, one.kind).filter(([, act]) => (act.writes ?? []).includes(one.name) || act.sets?.[one.name] !== undefined).map(([act]) => act));
    }
    // The rules that hold a sum to a budget: those whose requirement says a budget field's name.
    found.add("rules", ...rulesSaying(document, names).filter((rule) => budgets.some((budget) => tokens(document.rules![rule]!.require).has(budget.name))));
    const sum = sums[0]!;
    const budget = budgets.find((one) => one.kind === sum.kind) ?? budgets[0]!;
    found.say(`${Plural(document, sum.kind)}' ${lower(humanizeField(sum.name))} against ${budget.kind === sum.kind ? "each one's" : `each ${nounOf(document, budget.kind)}'s`} ${lower(humanizeField(budget.name))}.`);
  },
  places(document, found) {
    for (const [kind, spec] of walked(document)) {
      if (isPlaceKind(document, kind)) {
        found.add("kinds", kind);
        found.add("lenses", ...coveragesOver(document, kind, "columns"));
      }
      for (const [edge, relation] of Object.entries(spec.edges ?? {})) {
        const target = targetOf(document, relation.to);
        if (!target || !isPlaceKind(document, target)) continue;
        found.add("kinds", kind, target);
        found.add("relations", `${kind}.${edge}`);
        found.add("rules", ...rulesSaying(document, [edge], [kind, target]));
        found.say(`${Plural(document, kind)} are at ${pluralOf(document, target)} (${edge}).`);
      }
      for (const [name, field] of Object.entries(spec.fields)) {
        if (field.type !== "place" && !(field.type === "string" && PLACE_FIELD.test(name))) continue;
        found.add("kinds", kind);
        found.add("fields", `${kind}.${name}`);
        found.say(`${Plural(document, kind)} say where (${name}).`);
      }
    }
    if (found.any() && !found.said) found.say(`${listed([...found.kinds].map((kind) => Plural(document, kind)))} are places.`);
  },
  sources(document, found) {
    for (const [kind, spec] of walked(document)) {
      for (const [edge, relation] of Object.entries(spec.edges ?? {})) {
        const target = targetOf(document, relation.to);
        if (!target || (!isSourceKind(document, target) && !/^cite/i.test(edge))) continue;
        found.add("kinds", kind, target);
        found.add("relations", `${kind}.${edge}`);
        found.add("rules", ...rulesSaying(document, [edge, target], [kind, target]));
        found.add("acts", ...actsOn(document, kind).filter(([, act]) => act.connects === edge || act.severs === edge).map(([act]) => act));
        found.say(`${Plural(document, kind)} cite ${pluralOf(document, target)} (${edge}).`);
      }
      for (const [name, field] of Object.entries(spec.fields)) {
        if (field.type !== "url" || !/^source/i.test(name)) continue;
        found.add("kinds", kind);
        found.add("fields", `${kind}.${name}`);
        found.add("rules", ...rulesSaying(document, [name], [kind]));
        found.say(`${Plural(document, kind)} link to their source (${name}).`);
      }
    }
  },
  stock(document, found) {
    for (const [kind, spec] of walked(document)) {
      const counts = Object.entries(spec.fields).filter(([name, field]) => (field.type === "number" || field.type === "integer") && STOCK_FIELD.test(name)).map(([name]) => name);
      const worked = Object.keys(spec.computed ?? {}).filter((name) => STOCK_FIELD.test(name));
      const reorder = counts.some((name) => /reorder/i.test(name));
      const moved = kindsOf(document).some(([, other]) => Object.entries(other.fields).some(([name, field]) => /^(change|delta|moved)$/i.test(name) && (field.type === "number" || field.type === "integer")));
      if (!reorder && !(worked.length + counts.length > 0 && moved)) continue;
      found.add("kinds", kind);
      found.add("fields", ...counts.map((name) => `${kind}.${name}`), ...worked.map((name) => `${kind}.${name}`));
      found.add("rules", ...rulesSaying(document, [...counts, ...worked], [kind]));
      found.add("acts", ...actsOn(document, kind).filter(([, act]) => counts.some((name) => (act.writes ?? []).includes(name) || act.sets?.[name] !== undefined)).map(([act]) => act));
      found.say(`${Plural(document, kind)} have a count in stock${reorder ? " and a reorder point" : ""}.`);
    }
  },
  votes(document, found) {
    for (const [kind, spec] of walked(document)) {
      for (const [name, field] of Object.entries(spec.fields)) {
        if ((field.type !== "number" && field.type !== "integer") || !VOTE_FIELD.test(name)) continue;
        const acts = actsOn(document, kind).filter(([, act]) => act.sets?.[name] !== undefined).map(([act]) => act);
        if (acts.length === 0) continue;
        found.add("kinds", kind);
        found.add("fields", `${kind}.${name}`);
        found.add("acts", ...acts);
        found.add("rules", ...rulesSaying(document, [name], [kind]));
        found.say(`${Plural(document, kind)} collect votes (${name}).`);
      }
      for (const [edge, relation] of Object.entries(spec.edges ?? {})) {
        const target = targetOf(document, relation.to);
        if (!target || !VOTE_EDGE.test(edge)) continue;
        found.add("kinds", kind, target);
        found.add("relations", `${kind}.${edge}`);
        found.add("rules", ...rulesSaying(document, [edge], [kind, target]));
        found.add("acts", ...actsOn(document, kind).filter(([, act]) => act.connects === edge || act.severs === edge).map(([act]) => act));
        found.say(`${Plural(document, kind)} pick ${pluralOf(document, target)} (${edge}).`);
      }
    }
  },
  private(document, found) {
    const kinds: string[] = [];
    for (const sight of document.policy?.sees ?? []) {
      if (!sight.own && !sight.via) continue;
      for (const kind of sight.kinds) {
        if (!document.kinds[kind]) continue;
        found.add("kinds", kind);
        if (!kinds.includes(kind)) kinds.push(kind);
        if (sight.via) for (const [from, spec] of kindsOf(document)) if (spec.edges?.[sight.via]) found.add("relations", `${from}.${sight.via}`);
      }
    }
    if (kinds.length > 0) found.say(`${listed(kinds.map((kind) => Plural(document, kind)))} are seen only by whose they are.`);
  },
  history(document, found) {
    for (const [kind, spec] of walked(document)) {
      for (const [edge, relation] of Object.entries(spec.edges ?? {})) {
        const target = targetOf(document, relation.to);
        if (relation.cardinality !== "one" || !target || !isGroupingKind(document, target)) continue;
        const dated = Object.entries(spec.fields).some(([name, field]) => isDate(field) || /year|result|outcome|score|finish/i.test(name));
        if (!dated) continue;
        found.add("kinds", kind, target);
        found.add("relations", `${kind}.${edge}`);
        found.add("rules", ...rulesSaying(document, [edge, target], [kind, target]));
        found.add("lenses", ...coveragesOver(document, kind, "rows", edge), ...lensesOf(document).filter((lens) => lens.name === "timeline" && bindingsOf(lens)[kind] !== undefined).map(titleOf).filter((title): title is string => title !== undefined));
        found.say(`${Plural(document, kind)} grouped into ${pluralOf(document, target)}, a record book.`);
      }
    }
  },
  publishing(document, found) {
    for (const [kind, spec] of walked(document)) {
      const words = Object.entries(spec.fields).filter(([, field]) => field.type === "text").map(([name]) => name);
      if (words.length === 0) continue;
      const moving = movingChoices(document, kind).map((choice) => choice.field);
      for (const [name, field] of Object.entries(spec.fields)) {
        // A status that reaches published — not a type whose values happen to include "live".
        if (field.type !== "enum" || !(STATUS_FIELD.test(name) || moving.includes(name)) || !(field.options ?? []).some((option) => PUBLISHED_OPTION.test(option))) continue;
        const published = (field.options ?? []).find((option) => PUBLISHED_OPTION.test(option))!;
        found.add("kinds", kind);
        found.add("fields", `${kind}.${name}`, ...words.map((word) => `${kind}.${word}`));
        found.add("acts", ...actsOn(document, kind).filter(([, act]) => act.sets?.[name] === published).map(([act]) => act));
        found.add("rules", ...rulesSaying(document, [name, ...words], [kind]).filter((rule) => tokens(`${document.rules![rule]!.when ?? ""} ${document.rules![rule]!.require}`).has(published) || words.some((word) => tokens(document.rules![rule]!.require).has(word))));
        found.say(`${Plural(document, kind)} go from ${lower(field.options![0]!)} to ${lower(published)}, with their words.`);
      }
    }
  },
  roster(document, found) {
    for (const [kind, spec] of walked(document)) {
      if (!isPeopleKind(document, kind)) continue;
      const fields = Object.keys(spec.fields);
      if (fields.length < 2) continue;
      found.add("kinds", kind);
      found.add("fields", ...fields.map((name) => `${kind}.${name}`));
      found.add("lenses", ...coveragesOver(document, kind, "columns"), ...coveragesOver(document, kind, "rows"));
      found.say(`${Plural(document, kind)}, with ${listed(fields.slice(1).map((name) => lower(humanizeField(name))))}.`);
    }
  },
  routines(document, found) {
    for (const [kind, spec] of walked(document)) {
      const repeating = Object.entries(spec.fields).filter(([, field]) => isDate(field) && field.repeats === true).map(([name]) => name);
      const cadence = Object.entries(spec.fields).filter(([name, field]) => (field.type === "enum" || field.type === "string" || field.type === "integer" || field.type === "number") && CADENCE_FIELD.test(name)).map(([name]) => name);
      const lastDone = Object.entries(spec.fields).filter(([name, field]) => isDate(field) && LAST_DONE_FIELD.test(name)).map(([name]) => name);
      if (repeating.length === 0 && !(cadence.length > 0 && lastDone.length > 0)) continue;
      const names = [...repeating, ...cadence, ...lastDone];
      found.add("kinds", kind);
      found.add("fields", ...names.map((name) => `${kind}.${name}`));
      found.add("rules", ...rulesSaying(document, names, [kind]));
      found.add("acts", ...actsOn(document, kind).filter(([, act]) => names.some((name) => (act.writes ?? []).includes(name) || act.sets?.[name] !== undefined)).map(([act]) => act));
      found.say(repeating.length > 0 ? `${Plural(document, kind)} repeat (${repeating[0]}).` : `${Plural(document, kind)} come round again, each with when it was last done.`);
    }
  },
  comparison(document, found) {
    for (const [name, rule] of Object.entries(document.rules ?? {})) {
      if (!ONE_PER_GROUP.test(rule.require) || rule.over === "graph") continue;
      const group = rule.over;
      // The kind compared: the one whose relation the count walks in, else the group itself.
      const walked = /in\('([^']+)'\)/.exec(rule.require)?.[1];
      const compared = walked ? kindsOf(document).find(([, spec]) => spec.edges?.[walked])?.[0] : undefined;
      const value = /==\s*'([^']+)'/.exec(rule.require)?.[1];
      found.add("kinds", ...(compared ? [compared] : []), group);
      found.add("rules", name);
      if (compared && walked) found.add("relations", `${compared}.${walked}`);
      if (compared && value) found.add("acts", ...actsOn(document, compared).filter(([, act]) => Object.values(act.sets ?? {}).includes(value)).map(([act]) => act));
      found.say(compared ? `${Plural(document, compared)} compared within each ${nounOf(document, group)}, one ${value ?? "chosen"}.` : `One ${value ?? "chosen"} per ${nounOf(document, group)}.`);
    }
  },
};

const isDocument = (source: GraviewDocument | GraviewApp<AnySchema>): source is GraviewDocument => (source as GraviewDocument).format === "graview-document";

/**
 * THE TRAITS A DECLARATION CARRIES, in `TRAITS` order, each with what
 * carries it and one sentence. A TypeScript app is read as the document it
 * would be (`toDocument`). Nothing is read off prose: a template that says
 * "budget" in its pitch and declares no budget field has no budget trait,
 * and one that declares a budget beside its quotes has it whatever its
 * pitch says.
 */
export function traitsOf(source: GraviewDocument | GraviewApp<AnySchema>): Trait[] {
  const document = isDocument(source) ? source : toDocument(source).document;
  const traits: Trait[] = [];
  for (const trait of TRAITS) {
    const found = new Found();
    READINGS[trait](document, found);
    if (found.any()) traits.push(found.asTrait(trait));
  }
  return traits;
}

/** Whether a declaration carries one trait — what a module asks before it adds anything. */
export function hasTrait(document: GraviewDocument, trait: TraitName): boolean {
  const found = new Found();
  READINGS[trait](document, found);
  return found.any();
}

/** The words of a trait, for a chip ("people who own things") — a name off the vocabulary is said back as given. */
export function traitWords(trait: string): string {
  return (TRAIT_WORDS as Record<string, string>)[trait] ?? trait;
}

export { an, listed as listedWords, nounOf as traitNounOf, pluralOf as traitPluralOf };
