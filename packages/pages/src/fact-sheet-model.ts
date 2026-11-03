import { fieldsWrittenBy, humanizeField, type AnySchema, type EdgeDeclaration, type Principal, type Store } from "@graview/core";
import type { Affordance, AffordanceSet } from "@graview/tools";
import { editableFields } from "@graview/tools/edit";
import type { RecordFacts, RecordLinkGroup } from "./facts.js";

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/*
 * THE FACTS AS ONE SHEET, AND WHAT IS LEFT TO DO BESIDE THEM (Roadmap
 * f-facts-by-type).
 *
 * A record's page drew each fact as a value, each relation as a section of
 * its own, and then every act again under "What can be done" — so "Mark it
 * done" was a button below the "Finished: No" it changes, "Move it to
 * another list" a button below the list it is on, and the page was a wall
 * of outline buttons that each repeated a fact. Here a relation an act sets
 * or clears is a row of the facts with its own picker, and an act whose
 * whole effect is one fact's or one relation's control is folded into it:
 * "What can be done" keeps what the facts cannot say.
 *
 * Decided from the declaration — what an act `writes`, `connects` and
 * `severs`, and what it asks — never from its name.
 */

/** A tie a relation's row makes or breaks: the act, offered on this record, and the one record it still asks for. */
export interface RelationAct {
  readonly affordance: Affordance;
  /** The argument that names the record at the far end. */
  readonly arg: string;
  /** The records it may name, as the derivation narrowed them. */
  readonly candidates: readonly string[];
}

/** One relation of a record, as a row of its facts: its records as chips, and the acts that set, add and remove them. */
export interface RelationFact extends RecordLinkGroup {
  /** Unique on the page: the relation, which way it is read, and its words. */
  readonly key: string;
  /** What the row is called: the relation's own words from this end, "The list it is on". */
  readonly label: string;
  /**
   * Holds ONE from this end: declared `cardinality: "one"`, or set by an act
   * that also severs it (a move — "Move it to another list"). Its chip
   * changes it; a relation of many adds and removes.
   */
  readonly one: boolean;
  /** The act that ties another record here (sets the one, adds to the many). */
  readonly set?: RelationAct;
  /** The act that unties one of its records, run with that record. */
  readonly remove?: RelationAct;
}

interface Tie {
  readonly relation: string;
  readonly direction: "out" | "in";
  readonly verb: "set" | "remove";
  readonly moves: boolean;
  readonly act: RelationAct;
  readonly farKinds: readonly string[];
}

/**
 * WHETHER AN ACT OFFERED HERE ONLY TIES OR UNTIES ONE RELATION OF THIS
 * RECORD, and which way: it connects or severs exactly one relation, makes
 * nothing, writes no field, names this record and asks for exactly one other
 * record. "Add a presenter" is; "Give it a slot", which also sets a start
 * time, is not.
 */
function tieOf<S extends AnySchema>(store: Store<S>, id: string, affordance: Affordance): Tie | undefined {
  if (affordance.provider === "invariant" || affordance.batch) return undefined;
  const mutation = store.allMutations().find((one) => one.name === affordance.mutation);
  if (!mutation?.subject || mutation.creates?.length) return undefined;
  const connects = mutation.connects ?? [];
  const severs = mutation.severs ?? [];
  const relations = new Set([...connects, ...severs]);
  if (relations.size !== 1) return undefined;
  const relation = [...relations][0]!;
  const asked = affordance.open.filter((parameter) => !parameter.optional);
  if (asked.length !== 1 || !asked[0]!.kinds?.length) return undefined;
  const far = asked[0]!;
  const at = Object.entries(affordance.args).find(([, value]) => value === id)?.[0];
  if (at === undefined) return undefined;
  const record = store.graph.getNode(id);
  if (!record) return undefined;
  const subjectIsRecord = at === mutation.subject.arg;
  const subjectKinds = subjectIsRecord ? [record.kind as string] : (far.kinds as readonly string[]);
  // It changes no field of its subject: a tie and nothing else.
  for (const kind of subjectKinds) {
    const definition = store.schema.tryDefinition(kind);
    if (definition && fieldsWrittenBy(mutation as never, definition).length > 0) return undefined;
  }
  // The end that declares the relation is where it leaves from.
  const subjectDeclares = subjectKinds.some((kind) => Boolean((store.schema.tryDefinition(kind)?.edges as Record<string, unknown> | undefined)?.[relation]));
  const direction = subjectIsRecord === subjectDeclares ? "out" : "in";
  return {
    relation,
    direction,
    verb: connects.includes(relation) ? "set" : "remove",
    moves: connects.includes(relation) && severs.includes(relation),
    act: { affordance, arg: far.name, candidates: far.candidates ?? [] },
    farKinds: far.kinds as readonly string[],
  };
}

/** A relation's words from one end: its own description leaving, its inverse arriving — else its name, with an arrow for the way it points. */
function relationWords<S extends AnySchema>(store: Store<S>, kind: string, relation: string, direction: "out" | "in", farKinds: readonly string[]): string | undefined {
  if (direction === "out") return (store.schema.tryDefinition(kind)?.edges as Record<string, EdgeDeclaration> | undefined)?.[relation]?.description;
  for (const far of farKinds) {
    const declared = (store.schema.tryDefinition(far)?.edges as Record<string, EdgeDeclaration> | undefined)?.[relation];
    if (declared) return declared.inverse ?? declared.description;
  }
  return undefined;
}

/**
 * EVERY RELATION OF A RECORD AS A ROW OF ITS FACTS: the ones it has, and the
 * ones it has none of yet that an act offered here could give it — "What
 * has to happen first", empty, with its way to add one, rather than an act
 * at the foot of the page.
 */
export function relationFacts<S extends AnySchema>(store: Store<S>, id: string, facts: RecordFacts): readonly RelationFact[] {
  const ties = facts.actions.affordances.flatMap((affordance) => {
    const tie = tieOf(store, id, affordance);
    return tie ? [tie] : [];
  });
  const rows = facts.links.map((group) => ({ group, set: undefined as RelationAct | undefined, remove: undefined as RelationAct | undefined, moves: false }));
  const fits = (row: (typeof rows)[number], tie: Tie) =>
    row.group.edgeKind === tie.relation && row.group.direction === tie.direction && (row.group.targets.length === 0 || row.group.targets.some((target) => tie.farKinds.includes(target.kind) || tie.farKinds.includes("*")));
  for (const tie of ties) {
    let row = rows.find((one) => fits(one, tie));
    if (!row && tie.verb === "set") {
      const description = relationWords(store, facts.kind, tie.relation, tie.direction, tie.farKinds);
      row = { group: { edgeKind: tie.relation, direction: tie.direction, ...(description ? { description } : {}), targets: [] }, set: undefined, remove: undefined, moves: false };
      rows.push(row);
    }
    if (!row) continue;
    if (tie.verb === "set" && !row.set) {
      row.set = tie.act;
      row.moves = tie.moves;
    }
    if (tie.verb === "remove" && !row.remove) row.remove = tie.act;
  }
  return rows.map(({ group, set, remove, moves }) => ({
    ...group,
    key: `${group.edgeKind}|${group.direction}|${group.description ?? ""}`,
    label: group.description ? capitalize(group.description) : `${group.direction === "in" ? "← " : "→ "}${humanizeField(group.edgeKind)}`,
    one: (group.direction === "out" && store.schema.edge(group.edgeKind)?.cardinality === "one") || moves,
    ...(set ? { set } : {}),
    ...(remove ? { remove } : {}),
  }));
}

export interface FoldOptions {
  /** The fields the page draws with their own control — the facts, and the heading where it is the name's. */
  readonly fields: readonly string[];
  /** The relations it draws as rows (`relationFacts`). */
  readonly relations: readonly RelationFact[];
  readonly principal?: Principal;
}

/**
 * THE ACTS A FACT'S OWN CONTROL ALREADY DOES, by the affordance's id.
 *
 * An act is folded into a fact when its whole effect is that fact: it sets
 * one field of this record — the field is drawn, its control runs this act
 * (`editableFields`: the writer, or one of its alternatives), and the act
 * asks for nothing but that field's value — or it is the act a relation's
 * row ties or unties with. "Mark it done" is the switch beside "Finished";
 * "Move the date" is the date; "Rename" is the heading; "Move it to another
 * list" is the list's chip. "Block time for it", which sets three fields
 * and asks for a length, is not.
 */
export function foldedActs<S extends AnySchema>(store: Store<S>, id: string, actions: AffordanceSet, options: FoldOptions): ReadonlySet<string> {
  const node = store.graph.getNode(id);
  if (!node) return new Set();
  const definition = store.schema.tryDefinition(node.kind as string);
  const drawn = new Set(options.fields);
  const controls = new Map<string, ReadonlySet<string>>();
  for (const editable of editableFields(store, id, options.principal ? { principal: options.principal } : {})) {
    if (!drawn.has(editable.field)) continue;
    controls.set(editable.field, new Set([editable.mutation, ...editable.alternatives.map((one) => one.mutation)]));
  }
  const tied = new Set(options.relations.flatMap((row) => [row.set?.affordance.id, row.remove?.affordance.id]).filter((one): one is string => one !== undefined));
  const folded = new Set<string>();
  for (const affordance of actions.affordances) {
    if (affordance.provider === "invariant" || affordance.batch) continue;
    if (tied.has(affordance.id)) {
      folded.add(affordance.id);
      continue;
    }
    const mutation = store.allMutations().find((one) => one.name === affordance.mutation);
    if (!mutation?.subject || !definition || mutation.creates?.length || mutation.connects?.length || mutation.severs?.length) continue;
    if (affordance.args[mutation.subject.arg] !== id) continue;
    const written = fieldsWrittenBy(mutation as never, definition);
    if (written.length !== 1) continue;
    const field = written[0]!;
    if (!controls.get(field)?.has(mutation.name)) continue;
    // It asks for nothing the field's control does not give it: the value, or nothing at all.
    if (affordance.open.some((parameter) => !parameter.optional && parameter.name !== field)) continue;
    folded.add(affordance.id);
  }
  return folded;
}

/** What can be done beyond the facts: the derived set less the acts a fact's control already does (`foldedActs`). */
export function actsBeyondFacts<S extends AnySchema>(store: Store<S>, id: string, actions: AffordanceSet, options: FoldOptions): AffordanceSet {
  const folded = foldedActs(store, id, actions, options);
  return folded.size === 0 ? actions : { ...actions, affordances: actions.affordances.filter((affordance) => !folded.has(affordance.id)) };
}

/**
 * THE FIELD THE HEADING IS, where the heading can be renamed in place: a
 * field this seat may change that holds exactly the record's name — `label`
 * for a task, `title` for a talk. The heading is then that field's control,
 * and the facts do not say it a second time.
 */
export function titleFieldOf<S extends AnySchema>(store: Store<S>, id: string, label: string, principal?: Principal): string | undefined {
  const node = store.graph.getNode(id) as Record<string, unknown> | undefined;
  if (!node) return undefined;
  return editableFields(store, id, principal ? { principal } : {}).find((field) => field.takesValue && field.open.length === 0 && field.shape.type === "text" && node[field.field] === label)?.field;
}
