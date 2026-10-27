import { bindsOf, isRepeatField, linkedRelationOf, nodeRefArgs, placeSlug, repeatedBy, repeatKey, requiredRolesOf, type LensDeclaration } from "@graview/core";
import { computedOf, documentOf } from "@graview/core/document";
import { fieldSpecOf } from "@graview/core/blocks";
import { isMarkdownField } from "@graview/core/words";
import type { AnyMutationDefinition, AnySchema, GraphEdge, GraphSnapshot, GraviewApp, InvariantDefinition } from "@graview/core";
import type { z } from "zod";
import { DECLARED_KIND, FIELD_TYPES, type FieldType } from "./meta.js";

/*
 * A DECLARATION READ INTO THE GRAPH. Every kind, field, edge, act, rule,
 * role, grant and lens the app declares becomes a node with a stable id —
 * `declared:plot`, `field:plot.label`, `edge:plot.tended-by`, `act:tend` —
 * so the same declaration read twice is the same graph, and a change is a
 * difference between two of them.
 *
 * NOT `kind:plot`, which is the trap this walked into. `kind:` is the
 * LAYOUT's own namespace for the district card of a kind, so a studio node
 * called `kind:rule` and the RULES district's card were the same id. Every
 * app here declares a kind called "rule", so in every one of their studios
 * the edge from a rule to the kind it judges resolved to the district it
 * started from and was drawn as a loop: a dotted circle labeled OVER,
 * saying a rule judges a rule.
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

interface ZodDef {
  readonly type?: string;
  readonly innerType?: unknown;
  readonly element?: unknown;
  readonly entries?: Record<string, unknown>;
  readonly checks?: readonly unknown[];
}
const defOf = (type: unknown): ZodDef =>
  ((type as { def?: ZodDef }).def ?? (type as { _def?: ZodDef })._def ?? {}) as ZodDef;

/*
 * The types zod's own shape says, read below. Any other type the document
 * reads a field as — a picture, a file, another app's address (FR-171), and
 * whatever the document learns next — is taken in the document's words, so
 * a type the document gains is one the studio reads without a line here.
 */
const READ_FROM_ZOD: ReadonlySet<string> = new Set(["string", "text", "number", "integer", "boolean", "date", "datetime", "enum", "list", "url", "email"]);
const isFieldType = (type: string): type is FieldType => (FIELD_TYPES as readonly string[]).includes(type);

/** A zod field's type, as the studio names types. */
export function fieldTypeOf(type: unknown): { readonly type: FieldType; readonly required: boolean; readonly options?: readonly string[]; readonly multiple?: true } {
  let def = defOf(type);
  let required = true;
  while (def.type === "optional" || def.type === "nullable" || def.type === "default") {
    required = false;
    def = defOf(def.innerType);
  }
  const tagged = fieldSpecOf(type)?.type;
  if (tagged !== undefined && !READ_FROM_ZOD.has(tagged) && isFieldType(tagged)) return { type: tagged, required };
  switch (def.type) {
    case "number":
    case "int":
      return { type: fieldSpecOf(type)?.type === "integer" ? "integer" : "number", required };
    case "boolean":
      return { type: "boolean", required };
    case "date":
      return { type: "date", required };
    case "enum": {
      const options = Object.values(def.entries ?? {}).map(String);
      return { type: "enum", required, options };
    }
    case "array": {
      // A choice that takes several of its options (FR-233): an enum that is `multiple`, not a list.
      const element = defOf((def as { element?: unknown }).element);
      if (element.type === "enum") return { type: "enum", required, options: Object.values(element.entries ?? {}).map(String), multiple: true };
      return { type: "list", required };
    }
    case "string": {
      // A link, an address or a date and time is a string zod checks; the document's reading says which.
      const said = fieldSpecOf(type)?.type;
      return { type: said === "url" || said === "email" || said === "date" || said === "datetime" || said === "text" ? said : "string", required };
    }
    default:
      return { type: "string", required };
  }
}

const shapeOf = (fields: unknown): Record<string, unknown> =>
  ((fields as { shape?: Record<string, unknown> }).shape ?? {}) as Record<string, unknown>;

/** The app's declaration as the studio's graph. */
export function declarationToGraph<S extends AnySchema>(app: GraviewApp<S>): GraphSnapshot {
  const nodes: Node[] = [];
  const edges: GraphEdge[] = [];
  const kinds = app.schema.definitions;
  const kindId = (kind: string) => `${DECLARED_KIND}${kind}`;
  const edgeIds = new Map<string, string>();
  // An app compiled from a document is read in the document's words: `text` is a long text, not the string zod sees (FR-54).
  const document = documentOf(app);

  for (const def of kinds) {
    nodes.push({
      id: kindId(def.kind),
      kind: "kind",
      label: def.kind,
      ...(def.plural ? { plural: def.plural } : {}),
      ...(def.noun ? { noun: def.noun } : {}),
      ...(def.description ? { description: def.description } : {}),
      ...(def.lifecycle ? { lifecycleField: def.lifecycle.field, retired: def.lifecycle.retired === "date" ? ["date"] : def.lifecycle.retired.map(String) } : {}),
      ...(def.figure ? { figure: def.figure } : {}),
      ...(def.people ? { people: true } : {}),
      ...(def.archives === false ? { neverArchived: true } : {}),
    });
    const fields = shapeOf(def.fields);
    for (const [name, type] of Object.entries(fields)) {
      // How a date repeats is the date's `repeats`, not a field of its own.
      const repeated = isRepeatField(type) ? repeatedBy(name) : undefined;
      if (repeated && fields[repeated]) continue;
      // A link to another app's record (FR-171) is kept in a field, and is a relation: its far end named, not tied.
      const far = linkedRelationOf(type);
      if (far) {
        const id = `edge:${def.kind}.${name}`;
        edgeIds.set(name, id);
        nodes.push({
          id,
          kind: "edge",
          label: name,
          cardinality: far.cardinality,
          appendOnly: false,
          toAny: false,
          toAnotherApp: far.kinds.map((kind) => `@${far.address.replace(/^@/, "")}/${kind}`),
          ...(far.description ? { description: far.description } : {}),
        });
        edges.push({ kind: "from-kind", from: id, to: kindId(def.kind) });
        continue;
      }
      const id = `field:${def.kind}.${name}`;
      const read = fieldTypeOf(type);
      const said = document?.kinds[def.kind]?.fields[name]?.type;
      const typed = said ? { ...read, type: said } : read;
      nodes.push({
        id,
        kind: "field",
        label: name,
        type: typed.type,
        required: typed.required,
        ...(typed.options ? { options: [...typed.options] } : {}),
        // Several at once (FR-233): the declaration's list of an enum, or the document's `multiple`.
        ...(typed.multiple || document?.kinds[def.kind]?.fields[name]?.multiple ? { multiple: true } : {}),
        ...(isRepeatField(fields[repeatKey(name)]) ? { repeats: true } : {}),
        ...(def.display?.labels?.[name] ? { description: def.display.labels[name] } : {}),
        // Written in Markdown (FR-180): the declaration's mark, or the document's format.
        ...(typed.type === "text" && (isMarkdownField(type) || document?.kinds[def.kind]?.fields[name]?.format === "markdown") ? { markdown: true } : {}),
      });
      edges.push({ kind: "of", from: id, to: kindId(def.kind) });
    }
    // What the kind works out, each a node of its own in declaration order (FR-83).
    for (const [name, computed] of computedOf(def)) {
      const id = `computed:${def.kind}.${name}`;
      nodes.push({
        id,
        kind: "computed",
        label: name,
        expr: computed.expr,
        ...(computed.label ? { shownAs: computed.label } : {}),
        ...(computed.description ? { description: computed.description } : {}),
      });
      edges.push({ kind: "computed-on", from: id, to: kindId(def.kind) });
    }
    for (const [name, edge] of Object.entries(def.edges)) {
      const id = `edge:${def.kind}.${name}`;
      edgeIds.set(name, id);
      nodes.push({
        id,
        kind: "edge",
        label: name,
        cardinality: edge.cardinality ?? "many",
        appendOnly: edge.appendOnly ?? false,
        toAny: edge.to === "*",
        ...(edge.description ? { description: edge.description } : {}),
        ...(edge.inverse ? { inverse: edge.inverse } : {}),
      });
      edges.push({ kind: "from-kind", from: id, to: kindId(def.kind) });
      if (edge.to !== "*") for (const target of edge.to) edges.push({ kind: "to-kind", from: id, to: kindId(target) });
    }
  }

  const actId = (name: string) => `act:${name}`;
  /** The checkout's own name for the far end of a tie: the node argument that is not the subject. */
  const targetArgOf = (mutation: AnyMutationDefinition): string | undefined => {
    if (!(mutation.connects?.length || mutation.severs?.length)) return undefined;
    const refs = nodeRefArgs(mutation.input);
    return refs.find((ref) => ref.name !== mutation.subject?.arg)?.name;
  };
  for (const mutation of (app.mutations ?? []) as unknown as readonly AnyMutationDefinition[]) {
    const id = actId(mutation.name);
    nodes.push({
      id,
      kind: "act",
      label: mutation.name,
      destructive: mutation.destructive ?? false,
      onAny: mutation.subject?.kinds === "*",
      derived: mutation.derived !== undefined,
      ...(mutation.title ? { title: mutation.title } : {}),
      ...(mutation.fromTheOtherEnd ? { fromTheOtherEnd: mutation.fromTheOtherEnd } : {}),
      ...(mutation.description ? { description: mutation.description } : {}),
      ...(mutation.writes ? { writes: [...mutation.writes] } : {}),
      ...(mutation.subject ? { subjectArg: mutation.subject.arg } : {}),
      ...(targetArgOf(mutation) ? { targetArg: targetArgOf(mutation) } : {}),
    });
    if (mutation.subject && mutation.subject.kinds !== "*") for (const kind of mutation.subject.kinds) edges.push({ kind: "on", from: id, to: kindId(kind) });
    for (const kind of mutation.creates ?? []) edges.push({ kind: "creates", from: id, to: kindId(kind) });
    for (const name of mutation.connects ?? []) {
      const target = edgeIds.get(name);
      if (target) edges.push({ kind: "connects", from: id, to: target });
    }
    for (const name of mutation.severs ?? []) {
      const target = edgeIds.get(name);
      if (target) edges.push({ kind: "severs", from: id, to: target });
    }
  }

  const declaredActs = new Set(((app.mutations ?? []) as unknown as readonly AnyMutationDefinition[]).map((mutation) => mutation.name));
  for (const rule of (app.invariants ?? []) as readonly InvariantDefinition[]) {
    const id = `rule:${rule.name}`;
    const derivedRepairs = (rule.repairs ?? []).filter((name) => !declaredActs.has(name));
    nodes.push({
      id,
      kind: "rule",
      label: rule.name,
      judgesPast: rule.judgesPast ?? false,
      ...(rule.readsTheClock ? { readsTheClock: true } : {}),
      wholeGraph: rule.scope === "graph",
      ...(rule.label ? { title: rule.label } : {}),
      ...(rule.judgment
        ? {
            ...(rule.judgment.require ? { require: rule.judgment.require } : {}),
            ...(rule.judgment.covers ? { coversEvery: rule.judgment.covers.every, coversThrough: rule.judgment.covers.through, ...(rule.judgment.covers.via ? { coversVia: rule.judgment.covers.via } : {}) } : {}),
            ...(rule.judgment.when ? { when: rule.judgment.when } : {}),
            ...(rule.judgment.says ? { says: rule.judgment.says } : {}),
          }
        : {}),
      ...(rule.description ?? rule.label ? { description: rule.description ?? rule.label } : {}),
      ...(derivedRepairs.length > 0 ? { derivedRepairs } : {}),
    });
    if (rule.scope !== "graph") edges.push({ kind: "over", from: id, to: kindId(rule.scope.kind) });
    for (const name of rule.repairs ?? []) if (declaredActs.has(name)) edges.push({ kind: "repairs", from: id, to: actId(name) });
  }

  const roleId = (role: string) => `role:${role}`;
  /*
   * SEATS ONLY. A lens's `requiredRoles` are binding SLOTS it asks the app
   * to answer — `start`, `rows`, `link` — and reading them in here put them
   * in the ROLES district beside "coordinator" and wrote them back into the
   * policy as roles a person could be granted. They belong to the lens.
   */
  const roles = new Set<string>(app.policy?.roles ?? []);
  for (const g of app.policy?.grants ?? []) if (g.roles !== "*") for (const role of g.roles) roles.add(role);
  for (const sight of app.policy?.sees ?? []) if (sight.roles !== "*") for (const role of sight.roles) roles.add(role);
  for (const role of roles) nodes.push({ id: roleId(role), kind: "role", label: role });

  (app.policy?.grants ?? []).forEach((g, index) => {
    const id = `grant:${index + 1}`;
    const who = g.roles === "*" ? "everyone" : g.roles.join(", ");
    const what = g.mutations === "*" ? "do anything" : g.mutations.join(", ");
    nodes.push({
      id,
      kind: "grant",
      label: g.describe ?? `${who} may ${what}`,
      self: g.self ?? false,
      ...(g.ownEnd ? { ownEnd: true } : {}),
      everyone: g.roles === "*",
      allActs: g.mutations === "*",
      allKinds: g.kinds === undefined || g.kinds === "*",
      ...(g.describe ? { describe: g.describe } : {}),
    });
    if (g.roles !== "*") for (const role of g.roles) edges.push({ kind: "lets", from: id, to: roleId(role) });
    if (g.mutations !== "*") for (const name of g.mutations) edges.push({ kind: "may", from: id, to: actId(name) });
    if (g.kinds && g.kinds !== "*") for (const kind of g.kinds) edges.push({ kind: "allows-on", from: id, to: kindId(kind) });
  });

  // Who sees what, a node each like a grant, so the studio can add, change and take one away (FR-02).
  (app.policy?.sees ?? []).forEach((sight, index) => {
    const id = `sight:${index + 1}`;
    const who = sight.roles === "*" ? "everybody" : sight.roles.join(", ");
    nodes.push({
      id,
      kind: "sight",
      label: sight.describe ?? `${who} may see ${sight.own || sight.via ? "their own " : ""}${sight.kinds.join(", ")}`,
      own: sight.own ?? false,
      ...(sight.via ? { via: sight.via } : {}),
      ...(sight.hide?.length ? { hide: [...sight.hide] } : {}),
      ...(sight.fields ? { fields: [...sight.fields] } : {}),
      everyone: sight.roles === "*",
      ...(sight.describe ? { describe: sight.describe } : {}),
    });
    if (sight.roles !== "*") for (const role of sight.roles) edges.push({ kind: "seen-by", from: id, to: roleId(role) });
    for (const kind of sight.kinds) edges.push({ kind: "shows", from: id, to: kindId(kind) });
  });

  for (const lens of app.lenses ?? []) {
    // Two lenses of one name are two places when each has its own title (FR-79).
    const id = lensNodeId(lens);
    const requires = requiredRolesOf(lens);
    nodes.push({
      id,
      kind: "lens",
      label: lens.name,
      ...(lens.binds ? { binds: lens.binds } : {}),
      ...(requires.length > 0 ? { requires: [...requires] } : {}),
      ...(lens.hidden === true ? { hidden: true } : {}),
      ...(lens.export === false ? { export: false } : {}),
    });
  }

  if (app.brand) {
    nodes.push({
      id: "brand",
      kind: "brand",
      label: app.brand.name,
      ...(app.brand.typography?.body ? { body: app.brand.typography.body } : {}),
      ...(app.brand.typography?.display ? { display: app.brand.typography.display } : {}),
    });
  }

  // Only edges whose both ends exist: an act that connects an edge the schema
  // does not declare is the checker's to report, not a dangling line here.
  const ids = new Set(nodes.map((node) => node.id));
  return { nodes, edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}

export type { z };

/** A lens as the studio reads its id from it: a declaration's, or a document's lens as JSON. */
export interface LensIdentity {
  readonly name: string;
  readonly title?: string;
  readonly on?: string;
  readonly binds?: "fields" | "entities";
  readonly bindings?: unknown;
}

/** The kinds a lens stands on: its `on`, or the kinds its bindings name — keyed by kind, or each slot's `kind`. */
export function lensKinds(lens: LensIdentity): readonly string[] {
  if (lens.on) return [lens.on];
  const bindings = lens.bindings;
  if (bindings === null || typeof bindings !== "object" || Array.isArray(bindings)) return [];
  const entries = Object.entries(bindings as Record<string, unknown>);
  const kinds =
    bindsOf(lens as LensDeclaration) === "entities"
      ? entries.map(([, slot]) => (slot !== null && typeof slot === "object" ? (slot as { kind?: unknown }).kind : undefined)).filter((kind): kind is string => typeof kind === "string")
      : entries.map(([kind]) => kind);
  return [...new Set(kinds)].sort();
}

/**
 * A lens's node id in the studio: its name, its title's address word when
 * it has one, and the kinds it stands on. Two lenses of one name and one
 * title on different kinds are two places (the checker keeps a title per
 * kind), so the kinds are part of the id — read from the lens alone, so the
 * same declaration read twice gives the same ids however many lenses it has.
 */
export function lensNodeId(lens: LensIdentity): string {
  const kinds = lensKinds(lens);
  return `lens:${lens.name}${lens.title ? `:${placeSlug(lens.title)}` : ""}${kinds.length > 0 ? `@${kinds.join(",")}` : ""}`;
}
