/**
 * A STARTING DOCUMENT COMPOSED FROM PARTS (Roadmap f-compose-from-parts;
 * the starter's second framework half).
 *
 * A person who says "kinda" to a template keeps some of its parts, drops
 * others, and asks for parts it lacks; one nothing fits composes from what
 * they described alone. `startingDocument` is that composition as a
 * function: it starts from a template's document or from nothing, takes
 * each dropped kind out with the rules, lenses, acts and relations only it
 * served (`editDocument`'s `remove-kind`), or a dropped trait's carriers,
 * and brings each added trait's MODULE in — a `person` kind, an owner link
 * and a "has an owner" rule for `owners`; a status field, named step acts
 * and a board for `status`; an amount, a budget and the over-budget rule
 * for `budget` — each joining the kind people see most where it can
 * rather than standing apart. A trait the document already carries is left
 * as it is. Every change is one `editDocument` accepts, so the result
 * compiles; what it took from where is said as `took`, for a host to show
 * as chips. Then `composeDesign` gives it its jobs and look, as today.
 *
 * Exported on `@graview/core/compose`, on no page.
 */
import { designFindings } from "./document/design-findings.js";
import { editDocument, type DocumentEdit } from "./document/edit.js";
import { FORMAT, FORMAT_VERSION, type GraviewDocument, type KindSpec } from "./document/schema.js";
import { humanizeField } from "./schema/define-node.js";
import { an, DUE_FIELD, hasTrait, isPeopleKind, listedWords, mainKindOf, movingChoices, TRAITS, traitNounOf, traitPluralOf, traitsOfDocument, traitWords, type TraitName } from "./traits.js";

/**
 * One part of the base to leave out, said as what it is: a kind, a rule
 * (by its name), a lens (by its title) or a trait. A kinda turn's reading
 * (`@graview/tools/starter`'s `KindaReading.drop`) is a list of these.
 */
export interface DropPart {
  readonly part: "kind" | "rule" | "lens" | "trait";
  readonly name: string;
}

export interface StartingOptions {
  /** The template's document to start from; none starts from nothing. */
  readonly base?: GraviewDocument;
  /**
   * What of the base to leave out: a kind or a trait by its name, or any
   * part as a `DropPart` — so the rules and views a person unticked go
   * with the kinds, and are said in `left` and `edits`.
   */
  readonly drop?: readonly (string | DropPart)[];
  /** Traits to bring in, each as its module, joined to the kind people see most. */
  readonly add?: readonly TraitName[];
  /** What the app is called. */
  readonly name: string;
  /** What it is for, in the person's words: `purpose.for`. */
  readonly purpose?: string;
}

export type PartKind = "kind" | "field" | "relation" | "rule" | "lens" | "act" | "sight" | "trait";

/** One part of the result and where it came from: the base's name, or the trait whose module brought it. */
export interface Part {
  readonly part: string;
  readonly what: PartKind;
  readonly from: string;
}

export interface StartingDocument {
  readonly document: GraviewDocument;
  /** What the result is made of: the base's kinds, traits, rules and lenses kept, and every part each added module brought. */
  readonly took: readonly Part[];
  /** What was dropped from the base. */
  readonly left: readonly Part[];
  /** Each change in a sentence, as `editDocument` says it; and what could not be done, said. */
  readonly said: readonly string[];
  /**
   * THE EDITS THAT TOOK, in order: the same change as a list `editDocument`
   * applies to the base in one call (Roadmap f-seat-reshape). A host that
   * applies a declaration's changes through its own path — a proposal a
   * person accepts, one undo — applies these, and gets `document`.
   */
  readonly edits: readonly DocumentEdit[];
}

const DONE = new Set(["done", "complete", "completed", "closed", "shipped", "booked", "paid", "finished", "resolved", "published", "delivered", "approved", "merged", "released", "signed", "won", "returned", "fixed", "filed", "chosen"]);
const ENDED = new Set(["canceled", "declined", "rejected", "withdrawn", "abandoned", "lost", "dropped", "archived", "wontfix", "won't do", "duplicate", "passed", "dismissed", "scrapped"]);
const CHOSEN = /^(chosen|picked|selected|winner|won|booked|hired|accepted)$/i;
const PUBLISHED = /^(published|live|public)$/i;
const STATUS_FIELD = /status|stage|state|phase|progress/i;
const GROUPING = /categor|room|area|group|project|section|event|trip|exchange|phase|department|team|bucket|budget|folder|list|board|topic|channel|release|season|sprint|milestone/i;
const PLACE_NOUNS = new Set(["place", "venue", "location", "room", "site", "building", "store", "warehouse", "city", "country", "region", "address", "hall", "stadium", "office", "shelf"]);
const SOURCE_NOUNS = new Set(["source", "reference", "citation", "evidence"]);
const GROUPING_NOUNS = new Set(["season", "era", "period", "epoch", "edition", "generation", "age", "campaign", "tournament"]);

const quote = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const kebab = (words: string) => words.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const isMoney = (name: string, field: KindSpec["fields"][string]) => (field.type === "number" || field.type === "integer") && (field.format === "money" || /cost|price|quote|amount|salary|fee|spend|total|paid|owed/i.test(name)) && !/budget|limit|cap$|allowance/i.test(name);
const isDate = (field: KindSpec["fields"][string]) => field.type === "date" || field.type === "datetime";

/** A document with one kind and nothing else: where a person who matched no template begins. */
function emptyDocument(name: string, roster: boolean): GraviewDocument {
  const kind = roster ? "person" : "item";
  const noun = roster ? "person" : "item";
  const plural = roster ? "people" : "items";
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    name,
    kinds: { [kind]: { noun, plural, fields: { name: { type: "string", required: true } }, label: "{name}" } },
    acts: { [`add-${kind}`]: { title: `Add ${an(noun)} ${noun}`, description: `Add a new ${noun}.`, creates: kind } },
  } as GraviewDocument;
}

/*
 * THE COMPOSER: one document, changed one edit at a time, each change said
 * and each part it brought recorded with where it came from. An edit the
 * editor refuses is said and passed over, so a module that cannot join a
 * particular base still leaves a document that compiles.
 */
class Composer {
  doc: GraviewDocument;
  readonly took: Part[] = [];
  readonly left: Part[] = [];
  readonly said: string[] = [];
  readonly edits: DocumentEdit[] = [];
  constructor(doc: GraviewDocument) {
    this.doc = doc;
  }

  /** Apply one edit; true when it took. */
  apply(edit: DocumentEdit, from?: string, parts: readonly Omit<Part, "from">[] = []): boolean {
    const outcome = editDocument(this.doc, [edit]);
    if (!outcome.ok) {
      this.said.push(`Not done (${edit.op}${typeof edit["kind"] === "string" ? ` on ${edit["kind"]}` : ""}): ${outcome.findings.map((finding) => finding.message).join("; ")}.`);
      return false;
    }
    this.doc = outcome.document;
    this.said.push(...outcome.said);
    this.edits.push(edit);
    if (from !== undefined) for (const part of parts) this.took.push({ ...part, from });
    return true;
  }

  // ── what a module reads off the document as it stands ──

  get main(): string {
    return mainKindOf(this.doc)!;
  }
  spec(kind: string): KindSpec {
    return this.doc.kinds[kind]!;
  }
  noun(kind: string) {
    return traitNounOf(this.doc, kind);
  }
  plural(kind: string) {
    return traitPluralOf(this.doc, kind);
  }
  Plural(kind: string) {
    return capital(this.plural(kind));
  }
  /** How a rule's sentence says one record: the kind's label, else its first word field. */
  label(kind: string): string {
    const spec = this.spec(kind);
    if (spec.label) return spec.label;
    const word = Object.entries(spec.fields).find(([, field]) => field.type === "string")?.[0];
    return word ? `{${word}}` : `${an(this.noun(kind))} ${this.noun(kind)}`;
  }
  freeField(kind: string, ...wanted: string[]): string {
    const spec = this.spec(kind);
    const taken = (name: string) => spec.fields[name] !== undefined || spec.edges?.[name] !== undefined;
    for (const name of wanted) if (!taken(name)) return name;
    let n = 2;
    while (taken(`${wanted[0]}${n}`)) n += 1;
    return `${wanted[0]}${n}`;
  }
  freeAct(...wanted: string[]): string {
    for (const name of wanted) if (!this.doc.acts?.[name]) return name;
    let n = 2;
    while (this.doc.acts?.[`${wanted[0]}-${n}`]) n += 1;
    return `${wanted[0]}-${n}`;
  }
  freeRule(name: string): string {
    if (!this.doc.rules?.[name]) return name;
    let n = 2;
    while (this.doc.rules?.[`${name}-${n}`]) n += 1;
    return `${name}-${n}`;
  }
  freeKind(name: string): string {
    if (!this.doc.kinds[name]) return name;
    let n = 2;
    while (this.doc.kinds[`${name}-${n}`]) n += 1;
    return `${name}-${n}`;
  }
  freeTitle(title: string): string {
    const titles = new Set((this.doc.lenses ?? []).map((lens) => String((lens as { title?: unknown }).title ?? "").toLowerCase()));
    if (!titles.has(title.toLowerCase())) return title;
    let n = 2;
    while (titles.has(`${title} ${n}`.toLowerCase())) n += 1;
    return `${title} ${n}`;
  }
  /** The kind that is people, if the document has one. */
  peopleKind(): string | undefined {
    return Object.keys(this.doc.kinds).find((kind) => isPeopleKind(this.doc, kind));
  }
  kindNamed(nouns: Set<string>): string | undefined {
    return Object.keys(this.doc.kinds).find((kind) => nouns.has(kind.toLowerCase()) || nouns.has(this.noun(kind)));
  }
  /** The kind's status: a choice that moves, or one named so. */
  status(kind: string): { field: string; options: readonly string[] } | undefined {
    const moving = movingChoices(this.doc, kind)[0];
    if (moving) return { field: moving.field, options: moving.options };
    const named = Object.entries(this.spec(kind).fields).find(([name, field]) => field.type === "enum" && Array.isArray(field.options) && field.options.length >= 2 && STATUS_FIELD.test(name));
    return named ? { field: named[0], options: named[1].options! } : undefined;
  }
  /** The condition under which a record is still on its way: none when the kind has no status that ends. */
  stillOpen(kind: string): string | undefined {
    const status = this.status(kind);
    if (!status) return undefined;
    // An option a template spells with a doubled l is read as its American spelling.
    const ends = status.options.filter((option) => DONE.has(option.toLowerCase()) || ENDED.has(option.toLowerCase().replace(/ll/g, "l")));
    if (ends.length === 0) return undefined;
    return ends.length === 1 ? `${status.field} != ${quote(ends[0]!)}` : `not (${status.field} in [${ends.map(quote).join(", ")}])`;
  }
  /** The kind the main kind is grouped under: a relation of one to a kind named like a grouping, never people. */
  groupOf(kind: string): { relation: string; kind: string } | undefined {
    for (const [relation, edge] of Object.entries(this.spec(kind).edges ?? {})) {
      const to = Array.isArray(edge.to) && edge.to.length === 1 ? edge.to[0]! : undefined;
      if (edge.cardinality !== "one" || !to || !this.doc.kinds[to] || isPeopleKind(this.doc, to)) continue;
      if (GROUPING.test(to) || GROUPING.test(this.noun(to))) return { relation, kind: to };
    }
    return undefined;
  }
}

type Module = (c: Composer, from: string) => void;

/** `add-kind`, with its "add" act, said as parts; where sights say who sees what, everyone sees the new kind, since a kind no sight names is seen by nobody. */
function addKind(c: Composer, from: string, kind: string, spec: Record<string, unknown>): boolean {
  const before = new Set(Object.keys(c.doc.acts ?? {}));
  if (!c.apply({ op: "add-kind", kind, ...spec }, from, [{ part: kind, what: "kind" }])) return false;
  for (const act of Object.keys(c.doc.acts ?? {})) if (!before.has(act)) c.took.push({ part: act, what: "act", from });
  if (c.doc.policy?.sees?.length) c.apply({ op: "add-sight", roles: "*", kinds: [kind] }, from, [{ part: `${kind}: everyone`, what: "sight" }]);
  return true;
}

/** The lenses that draw by a kind's field or relation — a board's column, a calendar's start, a coverage's link — which cannot stand without it. */
function lensesDrawnBy(c: Composer, kind: string, name: string): string[] {
  return (c.doc.lenses ?? []).flatMap((lens) => {
    const { title, bindings } = lens as { title?: unknown; bindings?: Record<string, Record<string, unknown>> };
    if (typeof title !== "string" || !bindings) return [];
    const byField = Object.values(bindings[kind] ?? {}).includes(name);
    const link = bindings["link"] ?? {};
    const byLink = link["edge"] === name || (Array.isArray(link["path"]) && link["path"].includes(name));
    return byField || byLink ? [title] : [];
  });
}
const addField = (c: Composer, from: string, kind: string, field: string, spec: Record<string, unknown>) => c.apply({ op: "add-field", kind, field, ...spec }, from, [{ part: `${kind}.${field}`, what: "field" }]);
const addRelation = (c: Composer, from: string, kind: string, relation: string, spec: Record<string, unknown>) => c.apply({ op: "add-relation", kind, relation, ...spec }, from, [{ part: `${kind}.${relation}`, what: "relation" }]);
const addAct = (c: Composer, from: string, act: string, spec: Record<string, unknown>) => c.apply({ op: "add-act", act, ...spec }, from, [{ part: act, what: "act" }]);
const addRule = (c: Composer, from: string, rule: string, spec: Record<string, unknown>) => c.apply({ op: "add-rule", rule, ...spec }, from, [{ part: rule, what: "rule" }]);
const addLens = (c: Composer, from: string, title: string, spec: Record<string, unknown>) => c.apply({ op: "add-lens", title, ...spec }, from, [{ part: title, what: "lens" }]);

/*
 * THE MODULES, one a trait. Each reads the document as it stands, reuses
 * what is there (a kind that is people, a status, a money field) and adds
 * only what is missing, joined to the kind people see most.
 */
const MODULES: Readonly<Record<TraitName, Module>> = {
  owners(c, from) {
    const main = c.main;
    // The people, or a person kind brought in; where the people are what the app is about, one of them has each on them.
    let person = c.peopleKind();
    if (!person) {
      person = c.freeKind("person");
      if (!addKind(c, from, person, { noun: "person", plural: "people", description: "Somebody who has things on them.", fields: { name: { type: "string", required: true } }, label: "{name}" })) return;
    }
    const owner = c.freeField(main, "owner", "ownedBy");
    if (!addRelation(c, from, main, owner, { to: [person], cardinality: "one", description: "who it is on", inverse: `their ${c.plural(main)}` })) return;
    const give = c.freeAct(`give-${main}`, "give-to");
    addAct(c, from, give, { title: "Give it to someone", on: main, connects: owner, description: `Say who ${an(c.noun(main))} ${c.noun(main)} is on.`, fromTheOtherEnd: `Give them one of the ${c.plural(main)}` });
    addRule(c, from, c.freeRule(`${main}-has-an-owner`), { title: `Every ${c.noun(main)} has somebody on it`, description: `${capital(an(c.noun(main)))} ${c.noun(main)} that is everyone's is nobody's.`, over: main, require: `present(${owner})`, says: `Nobody is on ${c.label(main)}`, repairs: [{ act: give, label: "Give it to someone" }] });
    addLens(c, from, c.freeTitle("Who has what"), { lens: "coverage", bindings: { rows: { kind: main }, columns: { kind: person }, link: { edge: owner } } });
  },

  status(c, from) {
    const main = c.main;
    let status = c.status(main);
    if (!status) {
      const field = c.freeField(main, "status", "stage");
      if (!addField(c, from, main, field, { type: "enum", options: ["open", "doing", "done"], default: "open", required: true })) return;
      status = { field, options: ["open", "doing", "done"] };
      addAct(c, from, c.freeAct(`start-${main}`, "start"), { title: "Start", on: main, sets: { [field]: "doing" }, allowedWhen: `${field} == 'open'`, refusal: `${c.label(main)} is already under way`, description: "Take it up." });
      addAct(c, from, c.freeAct(`finish-${main}`, "finish"), { title: "Finish", on: main, sets: { [field]: "done" }, allowedWhen: `${field} != 'done'`, refusal: `${c.label(main)} is already done`, description: "Mark it done." });
      addAct(c, from, c.freeAct(`reopen-${main}`, "reopen"), { title: "Reopen", on: main, sets: { [field]: "open" }, allowedWhen: `${field} != 'open'`, refusal: `${c.label(main)} is already open`, description: "Put it back at the start." });
    } else {
      // A status that nothing moves: a named step to each of its values.
      const moved = new Set(movingChoices(c.doc, main).flatMap((choice) => (choice.field === status!.field ? choice.steps : [])).flatMap((act) => [c.doc.acts?.[act]?.sets?.[status!.field]].filter((value): value is string => typeof value === "string")));
      for (const option of status.options) {
        if (moved.has(option)) continue;
        addAct(c, from, c.freeAct(`mark-${kebab(option)}`), { title: `Mark ${option.toLowerCase()}`, on: main, sets: { [status.field]: option }, allowedWhen: `${status.field} != ${quote(option)}`, refusal: `${c.label(main)} is already ${option.toLowerCase()}`, description: `Move it to ${option.toLowerCase()}.` });
      }
    }
    addLens(c, from, c.freeTitle(`${c.Plural(main)} by ${humanizeField(status.field).toLowerCase()}`), { lens: "columns", bindings: { [main]: { column: status.field } } });
  },

  schedule(c, from) {
    const main = c.main;
    let due = Object.entries(c.spec(main).fields).find(([name, field]) => isDate(field) && DUE_FIELD.test(name))?.[0];
    if (!due) {
      due = c.freeField(main, "due", "dueOn");
      if (!addField(c, from, main, due, { type: "date", description: "when it is due" })) return;
    }
    const set = c.freeAct(`set-${main}-date`, "set-date");
    addAct(c, from, set, { title: "Set the date", on: main, writes: [due], description: "Say when it is due, or move the date." });
    const open = c.stillOpen(main);
    addRule(c, from, c.freeRule(`${main}-on-time`), { title: `${c.Plural(main)} are done by their date`, over: main, when: open ? `present(${due}) and ${open}` : `present(${due})`, require: `days(today(), ${due}) >= 0`, says: `${c.label(main)} is past its date`, repairs: [{ act: set, label: "Move the date" }] });
    addLens(c, from, c.freeTitle(`${c.Plural(main)} by date`), { lens: "calendar", bindings: { [main]: { start: due } } });
  },

  budget(c, from) {
    const main = c.main;
    let amount = Object.entries(c.spec(main).fields).find(([name, field]) => isMoney(name, field))?.[0];
    if (!amount) {
      amount = c.freeField(main, "cost", "amount");
      if (!addField(c, from, main, amount, { type: "number", format: "money", description: "what it costs" })) return;
    }
    const group = c.groupOf(main);
    const holder = group?.kind ?? main;
    let budget = Object.entries(c.spec(holder).fields).find(([name, field]) => (field.type === "number" || field.type === "integer") && /budget|limit|allowance/i.test(name))?.[0];
    if (!budget) {
      budget = c.freeField(holder, "budget");
      if (!addField(c, from, holder, budget, { type: "number", format: "money", description: "the most to spend" })) return;
    }
    const set = c.freeAct("set-budget", `set-${holder}-budget`);
    addAct(c, from, set, { title: "Set the budget", on: holder, writes: [budget], description: "Set or raise the most to spend." });
    if (group) {
      addRule(c, from, c.freeRule(`${holder}-within-budget`), { title: `${c.Plural(main)} fit the ${c.noun(holder)}'s budget`, over: holder, when: `present(${budget})`, require: `sum(in(${quote(group.relation)}), ${quote(amount)}) <= ${budget}`, says: `${c.label(holder)} is over its {${budget}|money} budget`, repairs: [{ act: set, label: "Raise the budget" }] });
    } else {
      addRule(c, from, c.freeRule(`${main}-within-budget`), { title: `${c.Plural(main)} fit their budget`, over: main, when: `present(${budget}) and present(${amount})`, require: `${amount} <= ${budget}`, says: `${c.label(main)} is over its {${budget}|money} budget`, repairs: [{ act: set, label: "Raise the budget" }] });
    }
    // Money with no currency is said as a bare number: the app's is said once.
    if (!(c.doc.brand as { currency?: unknown } | undefined)?.currency) c.apply({ op: "set-brand", currency: "USD" }, from);
  },

  places(c, from) {
    const main = c.main;
    let place = c.kindNamed(PLACE_NOUNS);
    if (!place || place === main) {
      place = c.freeKind("place");
      if (!addKind(c, from, place, { noun: "place", plural: "places", description: "Somewhere things happen or are kept.", fields: { name: { type: "string", required: true }, address: { type: "string" } }, label: "{name}" })) return;
    }
    const at = c.freeField(main, "at", "location");
    if (!addRelation(c, from, main, at, { to: [place], cardinality: "one", description: "where it is", inverse: "what is here" })) return;
    addLens(c, from, c.freeTitle(`${c.Plural(main)} by place`), { lens: "coverage", bindings: { rows: { kind: main }, columns: { kind: place }, link: { edge: at } } });
  },

  sources(c, from) {
    const main = c.main;
    let source = c.kindNamed(SOURCE_NOUNS);
    if (!source || source === main) {
      source = c.freeKind("source");
      if (!addKind(c, from, source, { noun: "source", plural: "sources", description: "Where a claim comes from: an article, a page, a report.", fields: { title: { type: "string", required: true }, link: { type: "url" }, publisher: { type: "string" } }, label: "{title}" })) return;
    }
    const cites = c.freeField(main, "cites", "citesSource");
    if (!addRelation(c, from, main, cites, { to: [source], cardinality: "many", description: "what backs it up", inverse: "cited by" })) return;
    const cite = c.freeAct("cite", `cite-${main}`);
    addAct(c, from, cite, { title: "Cite a source", on: main, connects: cites, description: "Say where this comes from.", fromTheOtherEnd: `Cite it on one of the ${c.plural(main)}` });
    const status = c.status(main);
    const done = status?.options.filter((option) => DONE.has(option.toLowerCase())) ?? [];
    addRule(c, from, c.freeRule(`${main}-cites-a-source`), { title: `${done.length > 0 ? `${capital(listedWords(done.map((value) => value.toLowerCase()), "or"))} ${c.plural(main)} cite` : `${c.Plural(main)} cite`} a source`, over: main, ...(done.length > 0 ? { when: done.length === 1 ? `${status!.field} == ${quote(done[0]!)}` : `${status!.field} in [${done.map(quote).join(", ")}]` } : {}), require: `count(out(${quote(cites)})) >= 1`, says: `${c.label(main)} cites no source`, repairs: [{ act: cite, label: "Cite a source" }] });
  },

  stock(c, from) {
    const main = c.main;
    const onHand = c.freeField(main, "onHand", "inStock");
    if (!addField(c, from, main, onHand, { type: "integer", label: "On hand", description: "how many there are", min: 0 })) return;
    const reorderAt = c.freeField(main, "reorderAt");
    if (!addField(c, from, main, reorderAt, { type: "integer", label: "Reorder at", description: "the count to reorder at", min: 0 })) return;
    const count = c.freeAct("count-stock", `count-${main}`);
    addAct(c, from, count, { title: "Count the stock", on: main, writes: [onHand], description: "Say how many there are now." });
    addAct(c, from, c.freeAct("set-reorder-point"), { title: "Set the reorder point", on: main, writes: [reorderAt], description: "Say the count to reorder at." });
    addRule(c, from, c.freeRule(`${main}-above-reorder-point`), { title: `${c.Plural(main)} are above their reorder point`, over: main, when: `present(${reorderAt})`, require: `present(${onHand}) and ${onHand} >= ${reorderAt}`, says: `${c.label(main)} is running low`, repairs: [{ act: count, label: "Count it" }] });
  },

  votes(c, from) {
    const main = c.main;
    const votes = c.freeField(main, "votes");
    if (!addField(c, from, main, votes, { type: "integer", default: 0, min: 0, description: "how many asked for it" })) return;
    addAct(c, from, c.freeAct("vote", `vote-for-${main}`), { title: "Vote for it", on: main, sets: { [votes]: { expr: `if(${votes} == null, 1, ${votes} + 1)` } }, description: "Count one more person for it." });
  },

  private(c, from) {
    const main = c.main;
    const others = Object.keys(c.doc.kinds).filter((kind) => kind !== main);
    // Present, a sight is the whole story: a kind no sight names is seen by nobody, so the rest are shown to everyone first.
    if (!c.doc.policy?.sees?.length && others.length > 0) c.apply({ op: "add-sight", roles: "*", kinds: others }, from, [{ part: `${others.join(", ")}: everyone`, what: "sight" }]);
    c.apply({ op: "add-sight", roles: "*", kinds: [main], own: true }, from, [{ part: `${main}: own`, what: "sight" }]);
  },

  history(c, from) {
    const main = c.main;
    let season = c.kindNamed(GROUPING_NOUNS);
    if (!season || season === main) {
      season = c.freeKind("season");
      if (!addKind(c, from, season, { noun: "season", plural: "seasons", description: "A stretch of the record: a year, a run, an era.", fields: { name: { type: "string", required: true }, year: { type: "integer" }, notes: { type: "text" } }, label: "{name}" })) return;
    }
    const inSeason = c.freeField(main, "inSeason", "partOf");
    if (!addRelation(c, from, main, inSeason, { to: [season], cardinality: "one", description: "the season it belongs to", inverse: `its ${c.plural(main)}` })) return;
    if (!Object.values(c.spec(main).fields).some(isDate)) addField(c, from, main, c.freeField(main, "date", "happenedOn"), { type: "date", description: "when it happened" });
    if (!Object.entries(c.spec(main).fields).some(([name]) => /result|outcome|score/i.test(name))) addField(c, from, main, c.freeField(main, "result"), { type: "string", description: "how it ended" });
    addLens(c, from, c.freeTitle(`${c.Plural(main)} by ${c.noun(season)}`), { lens: "coverage", bindings: { rows: { kind: main }, columns: { kind: season }, link: { edge: inSeason } } });
  },

  publishing(c, from) {
    const main = c.main;
    let body = Object.entries(c.spec(main).fields).find(([name, field]) => field.type === "text" && /body|content|copy|words|summary/i.test(name))?.[0];
    if (!body) {
      body = c.freeField(main, "body", "words");
      if (!addField(c, from, main, body, { type: "text", format: "markdown", description: "the words themselves" })) return;
    }
    let status = c.status(main);
    let published: string;
    if (status) {
      published = status.options.find((option) => PUBLISHED.test(option)) ?? "published";
      if (!status.options.includes(published) && !c.apply({ op: "set-options", kind: main, field: status.field, add: [published] }, from, [{ part: `${main}.${status.field}: ${published}`, what: "field" }])) return;
    } else {
      const field = c.freeField(main, "status", "stage");
      if (!addField(c, from, main, field, { type: "enum", options: ["draft", "published"], default: "draft", required: true })) return;
      status = { field, options: ["draft", "published"] };
      published = "published";
    }
    const publish = c.freeAct("publish", `publish-${main}`);
    addAct(c, from, publish, { title: "Publish", on: main, sets: { [status.field]: published }, allowedWhen: `${status.field} != ${quote(published)}`, refusal: `${c.label(main)} is already ${published}`, description: "Put it out." });
    const first = status.options.find((option) => !PUBLISHED.test(option));
    if (first) addAct(c, from, c.freeAct("unpublish", `unpublish-${main}`), { title: "Take it down", on: main, sets: { [status.field]: first }, allowedWhen: `${status.field} == ${quote(published)}`, refusal: `${c.label(main)} is not ${published}`, description: `Take it back to ${first}.` });
    const write = c.freeAct(`write-${main}`, "write");
    addAct(c, from, write, { title: "Write it", on: main, writes: [body], description: "Write or change the words." });
    addRule(c, from, c.freeRule(`${published}-${main}-has-words`), { title: `${capital(published)} ${c.plural(main)} have words`, over: main, when: `${status.field} == ${quote(published)}`, require: `present(${body})`, says: `${c.label(main)} is ${published} with no words`, repairs: [{ act: write, label: "Write it" }] });
  },

  roster(c, from) {
    let person = c.peopleKind();
    if (!person) {
      person = c.freeKind("person");
      if (!addKind(c, from, person, { noun: "person", plural: "people", description: "Somebody on the roster.", fields: { name: { type: "string", required: true } }, label: "{name}" })) return;
    }
    const spec = c.spec(person);
    if (!Object.keys(spec.fields).some((name) => /role|position|part/i.test(name))) addField(c, from, person, c.freeField(person, "role"), { type: "string", description: "what they do" });
    if (!Object.values(spec.fields).some((field) => field.type === "email")) addField(c, from, person, c.freeField(person, "email"), { type: "email" });
    if (!Object.values(spec.fields).some((field) => field.type === "phone")) addField(c, from, person, c.freeField(person, "phone"), { type: "phone" });
  },

  routines(c, from) {
    const main = c.main;
    const every = c.freeField(main, "every", "often");
    if (!addField(c, from, main, every, { type: "enum", options: ["daily", "weekly", "fortnightly", "monthly"], default: "weekly", required: true, label: "How often" })) return;
    const lastDone = c.freeField(main, "lastDone");
    if (!addField(c, from, main, lastDone, { type: "date", label: "Last done" })) return;
    const done = c.freeAct("done-today", `${main}-done-today`);
    addAct(c, from, done, { title: "Done today", on: main, sets: { [lastDone]: "$today" }, description: "Note that it was done today." });
    addRule(c, from, c.freeRule(`${main}-not-overdue`), { title: `${c.Plural(main)} are done as often as they come round`, over: main, when: `present(${lastDone})`, require: `days(${lastDone}, today()) <= if(${every} == 'daily', 1, if(${every} == 'weekly', 7, if(${every} == 'fortnightly', 14, 31)))`, says: `${c.label(main)} is overdue — last done {${lastDone}|relative}`, repairs: [{ act: done, label: "Done it today" }] });
  },

  comparison(c, from) {
    const main = c.main;
    let status = c.status(main);
    let chosen: string;
    if (status) {
      chosen = status.options.find((option) => CHOSEN.test(option)) ?? "chosen";
      if (!status.options.includes(chosen) && !c.apply({ op: "set-options", kind: main, field: status.field, add: [chosen] }, from, [{ part: `${main}.${status.field}: ${chosen}`, what: "field" }])) return;
    } else {
      const field = c.freeField(main, "status", "stage");
      if (!addField(c, from, main, field, { type: "enum", options: ["considering", "chosen", "passed"], default: "considering", required: true })) return;
      status = { field, options: ["considering", "chosen", "passed"] };
      chosen = "chosen";
      addAct(c, from, c.freeAct(`pass-on-${main}`, "pass"), { title: "Pass on it", on: main, sets: { [field]: "passed" }, allowedWhen: `${field} != 'passed'`, refusal: `${c.label(main)} was already passed on`, description: "Leave it out of the running; it is kept, not deleted." });
    }
    // The step that chooses, unless one already does ("Book").
    const field = status.field;
    if (!Object.values(c.doc.acts ?? {}).some((act) => [act.on ?? []].flat().includes(main) && act.sets?.[field] === chosen)) addAct(c, from, c.freeAct(`choose-${main}`, "choose"), { title: "Choose it", on: main, sets: { [field]: chosen }, allowedWhen: `${field} != ${quote(chosen)}`, refusal: `${c.label(main)} is already ${chosen}`, description: "Pick this one." });
    const group = c.groupOf(main);
    if (group) {
      addRule(c, from, c.freeRule(`one-${chosen}-per-${group.kind}`), { title: `One ${c.noun(main)} ${chosen} per ${c.noun(group.kind)}`, over: group.kind, require: `count(in(${quote(group.relation)}) where ${status.field} == ${quote(chosen)}) <= 1`, says: `${c.label(group.kind)} has more than one ${c.noun(main)} ${chosen}` });
    } else {
      addRule(c, from, c.freeRule(`one-${chosen}`), { title: `One ${c.noun(main)} ${chosen}`, over: "graph", require: `count(all(${quote(main)}) where ${status.field} == ${quote(chosen)}) <= 1`, says: `More than one ${c.noun(main)} is ${chosen}` });
    }
  },
};

/**
 * DROP A TRAIT: what only it carries goes — its rules, its lenses, its
 * sights, and its relations and fields no other trait names (with the
 * lenses drawn by them, which cannot stand without them), then a kind of
 * its own left standing apart. A carrier two traits share (a status a
 * board and a publish step both stand on) stays, since the other still
 * needs it; so does the kind people see most and the field its label says.
 */
function dropTrait(c: Composer, name: TraitName, from: string) {
  const traits = traitsOfDocument(c.doc);
  const trait = traits.find((one) => one.trait === name);
  if (!trait) return c.said.push(`${c.doc.name} has no ${traitWords(name)} to leave out.`);
  const shared = new Set(traits.filter((one) => one.trait !== name).flatMap((one) => [...one.fields, ...one.relations]));
  const main = c.main;
  const removeLens = (title: string) => c.apply({ op: "remove-lens", title }) && c.left.push({ part: title, what: "lens", from });
  for (const rule of trait.rules) if (c.doc.rules?.[rule] && c.apply({ op: "remove-rule", rule })) c.left.push({ part: rule, what: "rule", from });
  for (const title of trait.lenses) removeLens(title);
  if (name === "private") {
    for (const sight of [...(c.doc.policy?.sees ?? [])]) {
      if ((sight.own || sight.via) && c.apply({ op: "remove-sight", roles: sight.roles, kinds: sight.kinds, ...(sight.own ? { own: true } : {}), ...(sight.via ? { via: sight.via } : {}) })) c.left.push({ part: `${sight.kinds.join(", ")}: ${sight.via ? `via ${sight.via}` : "own"}`, what: "sight", from });
    }
  }
  for (const relation of trait.relations) {
    const [kind, edge] = relation.split(".") as [string, string];
    if (shared.has(relation) || !c.doc.kinds[kind]?.edges?.[edge]) continue;
    for (const title of lensesDrawnBy(c, kind, edge)) removeLens(title);
    if (c.apply({ op: "remove-relation", kind, relation: edge })) c.left.push({ part: relation, what: "relation", from });
  }
  for (const field of trait.fields) {
    const [kind, fieldName] = field.split(".") as [string, string];
    const spec = c.doc.kinds[kind];
    if (shared.has(field) || !spec?.fields[fieldName] || Object.keys(spec.fields).length < 2 || c.label(kind).includes(`{${fieldName}}`)) continue;
    for (const title of lensesDrawnBy(c, kind, fieldName)) removeLens(title);
    if (c.apply({ op: "remove-field", kind, field: fieldName })) c.left.push({ part: field, what: "field", from });
  }
  for (const kind of trait.kinds) {
    if (kind === main || !c.doc.kinds[kind] || Object.keys(c.doc.kinds).length < 2) continue;
    const linked = Object.values(c.doc.kinds).some((spec) => Object.values(spec.edges ?? {}).some((edge) => Array.isArray(edge.to) && edge.to.includes(kind))) || Object.keys(c.doc.kinds[kind]!.edges ?? {}).length > 0;
    if (linked) continue;
    dropKind(c, kind, from);
  }
  c.left.push({ part: name, what: "trait", from });
}

/** Drop a kind, with what only it served (`remove-kind`); the sights that showed only it go first, as the editor asks. */
function dropKind(c: Composer, kind: string, from: string) {
  if (!Object.hasOwn(c.doc.kinds, kind)) return c.said.push(`${c.doc.name} has no kind called ${kind} to leave out.`);
  if (Object.keys(c.doc.kinds).length === 1) return c.said.push(`${c.doc.name} keeps at least one kind, so ${kind} stays.`);
  const sees = c.doc.policy?.sees ?? [];
  if (sees.length > 0 && sees.every((sight) => sight.kinds.every((k) => k === kind))) for (const sight of [...sees]) c.apply({ op: "remove-sight", roles: sight.roles, kinds: sight.kinds, ...(sight.own ? { own: true } : {}), ...(sight.via ? { via: sight.via } : {}) });
  if (c.apply({ op: "remove-kind", kind })) c.left.push({ part: kind, what: "kind", from });
}

const isTrait = (name: string): name is TraitName => (TRAITS as readonly string[]).includes(name);

/** Drop a rule by its name, or say the base has none called so. */
function dropRule(c: Composer, rule: string, from: string) {
  if (!c.doc.rules?.[rule]) return c.said.push(`${c.doc.name} has no rule called ${rule} to leave out.`);
  if (c.apply({ op: "remove-rule", rule })) c.left.push({ part: rule, what: "rule", from });
}

/** Drop a lens by its title, or say the base has none called so. */
function dropLens(c: Composer, title: string, from: string) {
  if (!(c.doc.lenses ?? []).some((lens) => (lens as { title?: unknown }).title === title)) return c.said.push(`${c.doc.name} has no view called ${title} to leave out.`);
  if (c.apply({ op: "remove-lens", title })) c.left.push({ part: title, what: "lens", from });
}

/** A part to drop, said as what it is: a bare name is a trait when it names one and no kind does, else a kind. */
const dropPartOf = (c: Composer, drop: string | DropPart): DropPart => (typeof drop !== "string" ? drop : isTrait(drop) && !Object.hasOwn(c.doc.kinds, drop) ? { part: "trait", name: drop } : { part: "kind", name: drop });

/**
 * A STARTING DOCUMENT FROM PARTS: the base (or nothing) named, its
 * dropped kinds and traits taken out with what only they served, each
 * added trait's module joined to the kind people see most, and what was
 * taken from where said. A trait the document already carries is left as
 * it is and said so. Every change is one `editDocument` accepts in turn,
 * so the document compiles; `composeDesign` then gives it its jobs and
 * look.
 */
export function startingDocument(options: StartingOptions): StartingDocument {
  const adds = [...new Set(options.add ?? [])];
  const base = options.base;
  const c = new Composer(base ? (JSON.parse(JSON.stringify(base)) as GraviewDocument) : emptyDocument(options.name, adds.includes("roster")));
  const from = base?.name ?? "nothing";
  if (base) {
    if (base.name !== options.name) c.apply({ op: "set-name", name: options.name });
    for (const kind of Object.keys(base.kinds)) c.took.push({ part: kind, what: "kind", from });
  } else {
    for (const kind of Object.keys(c.doc.kinds)) c.took.push({ part: kind, what: "kind", from });
  }
  if (options.purpose !== undefined && options.purpose !== (base?.purpose?.for ?? undefined)) c.apply({ op: "set-purpose", for: options.purpose });

  // The rules and views first, then the kinds and traits: a rule a dropped kind would take with it is then said as dropped by name.
  const drops = (options.drop ?? []).map((drop) => dropPartOf(c, drop));
  for (const drop of [...drops.filter((one) => one.part === "rule" || one.part === "lens"), ...drops.filter((one) => one.part === "kind" || one.part === "trait")]) {
    if (drop.part === "rule") dropRule(c, drop.name, from);
    else if (drop.part === "lens") dropLens(c, drop.name, from);
    else if (drop.part === "trait") {
      if (isTrait(drop.name)) dropTrait(c, drop.name, from);
      else c.said.push(`${drop.name} is not a trait Graview knows, so nothing is left out for it.`);
    } else dropKind(c, drop.name, from);
  }
  // What the base still carries after the drops, said as its own: its traits, rules and lenses kept.
  const dropped = new Set(c.left.map((part) => `${part.what}:${part.part}`));
  c.took.splice(0, c.took.length, ...c.took.filter((part) => !dropped.has(`${part.what}:${part.part}`)));
  if (base) {
    for (const trait of traitsOfDocument(c.doc)) c.took.push({ part: trait.trait, what: "trait", from });
    for (const rule of Object.keys(c.doc.rules ?? {})) c.took.push({ part: rule, what: "rule", from });
    for (const lens of c.doc.lenses ?? []) if (typeof (lens as { title?: unknown }).title === "string") c.took.push({ part: (lens as { title: string }).title, what: "lens", from });
  }

  for (const trait of adds) {
    if (hasTrait(c.doc, trait)) {
      c.said.push(`${c.doc.name} already has ${traitWords(trait)}.`);
      continue;
    }
    const before = c.took.length;
    MODULES[trait](c, trait);
    if (c.took.length > before) c.took.push({ part: trait, what: "trait", from: trait });
  }

  /*
   * What the parts made together, judged by the critic once: a kind now the
   * one people see most with no glance, a thirteenth place. Each edit is the
   * critic's own, asked again after it until it has no warning left — as
   * `composeDesign` asks it — so the document is handed on with none.
   */
  const applied = new Set<string>();
  for (let round = 0; round < 40; round += 1) {
    const next = designFindings(c.doc).find((finding) => finding.severity === "warning" && (finding.edits ?? []).some((edit) => !applied.has(JSON.stringify(edit))));
    if (!next) break;
    for (const edit of next.edits ?? []) {
      const key = JSON.stringify(edit);
      if (applied.has(key)) continue;
      applied.add(key);
      c.apply(edit as DocumentEdit);
    }
  }
  return { document: c.doc, took: c.took, left: c.left, said: c.said, edits: c.edits };
}

/** A reshape composed: a starting document from the app's own, with what the change loses said in plain words. */
export interface ComposedReshape extends StartingDocument {
  /** What the change loses — a kind's records, a field's values, a relation's links — one sentence each; empty when nothing is lost. */
  readonly breaking: readonly string[];
  /** What the composer could not do, said: a module that could not join this base. */
  readonly notDone: readonly string[];
}

/** What a removal loses, in plain words; nothing for a rule, a lens or an act, which hold no records. */
export function breakingOf(base: GraviewDocument, edit: DocumentEdit): string | undefined {
  const kind = typeof edit["kind"] === "string" ? edit["kind"] : undefined;
  if (edit.op === "remove-kind" && kind) return `All ${base.kinds[kind] ? traitPluralOf(base, kind) : kind} records go, with their links.`;
  if (edit.op === "remove-field" && kind && typeof edit["field"] === "string") return `${capital(kind)}'s ${edit["field"]} values go.`;
  if (edit.op === "remove-relation" && kind && typeof edit["relation"] === "string") return `The ${kind} → ${edit["relation"]} links go.`;
  return undefined;
}

/**
 * A CHANGE TO AN APP COMPOSED FROM A SEAT'S READING (Roadmap f-seat-reshape):
 * the traits to add and the kinds and traits to drop, as the seat read them
 * off a person's words and the person left them on the card, composed onto
 * the app's own document by `startingDocument` — its edits the change a
 * host applies as one, with what each removal loses said. The host's half,
 * on no page: a page says the card in words (`@graview/tools/reshape`) and
 * hands the reading to its host, which composes here, previews with its
 * data and applies as the person.
 */
export function composeReshape(options: { readonly document: GraviewDocument; readonly add: readonly TraitName[]; readonly drop: readonly (string | DropPart)[] }): ComposedReshape {
  const once = new Map(options.drop.map((drop) => [typeof drop === "string" ? drop : `${drop.part}:${drop.name}`, drop] as const));
  const made = startingDocument({ base: options.document, name: options.document.name, add: [...new Set(options.add)], drop: [...once.values()] });
  return {
    ...made,
    breaking: [...new Set(made.edits.map((edit) => breakingOf(options.document, edit)).filter((words): words is string => words !== undefined))],
    notDone: made.said.filter((line) => line.startsWith("Not done")),
  };
}
