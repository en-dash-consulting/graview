import { createSchema, defineNode, nodeRef, type AnyMutationDefinition, type GraviewApp } from "@graview/core";
import { renameIn, type DeclaredKinds, type NameChange } from "@graview/core/document";
import { z } from "zod";

/*
 * THE DECLARATION, DECLARED.
 *
 * A Graview app is kinds, fields, edges, acts, rules, roles, grants, lenses
 * and a brand. Here each of those is a kind of node, declared with the same
 * `defineNode` an app uses, so the declaration is a graph the scene and the
 * pages can show and the store can edit. Adding a field is an act; renaming
 * a kind is an act; every change is an op with an author, an intent and an
 * inverse, undone like any other. Nothing in the studio is a second way of
 * editing — it is the first way, pointed at itself.
 */

const label = z.string().min(1);

/**
 * The id namespace for a kind the app declares.
 *
 * Deliberately NOT `kind:`, which `@graview/layout` mints its district card
 * ids in (`KIND_PREFIX`). A node and a card sharing an id is a node the
 * scene cannot place, an edge drawn to the wrong district, and a `#sel=`
 * that names two different things.
 */
export const DECLARED_KIND = "declared:";

/**
 * A field's types: the declaration document's eleven (FR-54), so a field a
 * document declares is read as what it is — an integer, a date and time, a
 * link, an address, a long text — and handed back the same, never as the
 * nearest type the studio happened to know.
 */
export const FIELD_TYPES = ["string", "text", "number", "integer", "boolean", "date", "datetime", "enum", "list", "url", "email"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const kindNode = defineNode("kind", {
  description: "A kind of thing the app keeps track of.",
  plural: "kinds",
  fields: z.object({
    label,
    plural: z.string().optional(),
    /** What one of them is called, where the kind's name does not say it. */
    noun: z.string().optional(),
    description: z.string().optional(),
    /** The field the horizon reads, and the values that put a record behind it. */
    lifecycleField: z.string().optional(),
    retired: z.array(z.string()).optional(),
    /**
     * THE DRAWING OF THE THING, carried in the graph like anything else.
     *
     * Inline SVG or the name of a shipped figure. A figure was a decision
     * only a checkout could make: `drawFigure` could draw one and the CLI
     * could print one, but the studio read declarations that had figures
     * and gave back declarations that did not — so opening the studio on a
     * drawn app and applying would have rubbed every drawing out. Modeled
     * here, it survives the round trip and becomes something an agent may
     * propose.
     */
    figure: z.string().optional(),
  }),
  label: (node) => node.label,
  display: { labels: { label: "name", lifecycleField: "lifecycle field", retired: "retired when" } },
});

export const fieldNode = defineNode("field", {
  description: "A field a kind carries: its name, its type, whether it must be given.",
  plural: "fields",
  fields: z.object({
    label,
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    description: z.string().optional(),
  }),
  edges: {
    of: { to: ["kind"], cardinality: "one", description: "the kind it belongs to", inverse: "its fields" },
  },
  label: (node) => node.label,
  display: { labels: { label: "name" } },
});

/*
 * A VALUE A KIND WORKS OUT (FR-83), a node like a field is. Without one the
 * studio read an app's computed fields as nothing and handed the app back
 * without them, so a glance that said one named nothing and a card that
 * showed one drew a dash. Its own edge to its kind, not a field's `of`: a
 * computed field is no field — no act writes it, no form asks for it.
 */
export const computedNode = defineNode("computed", {
  description: "A value a kind works out from what it holds, in the rule language — read like a field, never stored or written.",
  plural: "computed fields",
  fields: z.object({
    label,
    /** What it is worked out as: `list * units`, `sum(out('includes'), list * units)`. */
    expr: z.string().min(1),
    /** The words it is shown by, where its name does not say it — the declaration's own `label`. */
    shownAs: z.string().optional(),
    description: z.string().optional(),
  }),
  edges: {
    "computed-on": { to: ["kind"], cardinality: "one", description: "the kind that works it out", inverse: "what it works out" },
  },
  label: (node) => node.label,
  display: { labels: { label: "name", expr: "worked out as", shownAs: "shown as" } },
});

export const edgeNode = defineNode("edge", {
  description: "A relation one kind may have to another, with a reading from each end.",
  plural: "edges",
  fields: z.object({
    label,
    description: z.string().optional(),
    inverse: z.string().optional(),
    cardinality: z.enum(["one", "many"]),
    appendOnly: z.boolean(),
    /** Declared to any kind at all. */
    toAny: z.boolean(),
  }),
  edges: {
    "from-kind": { to: ["kind"], cardinality: "one", description: "the kind it is declared on", inverse: "its edges" },
    "to-kind": { to: ["kind"], description: "the kinds it may reach", inverse: "the edges that reach it" },
  },
  label: (node) => node.label,
  display: { labels: { label: "name", description: "reading from this end", inverse: "reading from the far end", appendOnly: "append only", toAny: "to any kind" } },
});

export const actNode = defineNode("act", {
  description: "A named change: what it is called, what it creates, connects, severs or writes, and what it acts on.",
  plural: "acts",
  fields: z.object({
    label,
    title: z.string().optional(),
    /** How the act reads standing on the far end of the tie it makes or breaks (W-040). */
    fromTheOtherEnd: z.string().optional(),
    description: z.string().optional(),
    destructive: z.boolean(),
    writes: z.array(z.string()).optional(),
    /** The argument that names the subject, when the act has one. */
    subjectArg: z.string().optional(),
    /**
     * The argument that names the far end of the tie an act makes or
     * breaks — the checkout's own word for it (`dependsOn`, `handler`).
     * Written back under an invented `to`, every caller of the act broke:
     * the app's tests, its pages, its seat, all asking by the old name.
     */
    targetArg: z.string().optional(),
    /** Acts on any kind at all. */
    onAny: z.boolean(),
    /** Derived by the framework from a kind's fields; not written by hand. */
    derived: z.boolean(),
  }),
  edges: {
    on: { to: ["kind"], description: "the kinds it acts on", inverse: "the acts on it" },
    creates: { to: ["kind"], description: "the kind it brings into being", inverse: "how one comes to be" },
    connects: { to: ["edge"], description: "the relation it makes", inverse: "the acts that make it" },
    severs: { to: ["edge"], description: "the relation it breaks", inverse: "the acts that break it" },
  },
  label: (node) => node.title ?? node.label,
  display: { labels: { label: "name", subjectArg: "subject argument", targetArg: "far-end argument", fromTheOtherEnd: "from the other end", onAny: "on any kind" } },
});

export const ruleNode = defineNode("rule", {
  description: "An invariant the graph is held to, and the acts that put it right.",
  plural: "rules",
  fields: z.object({
    label,
    /** What the rule is called, in words — the checkout's `label`, kept apart from its name. */
    title: z.string().optional(),
    description: z.string().optional(),
    judgesPast: z.boolean(),
    /** Judged over the whole graph rather than one kind's records. */
    wholeGraph: z.boolean(),
    /**
     * Repairs naming an act the FRAMEWORK derives — `edit-song`,
     * `remove-album` — which has no node here to point an edge at. Kept by
     * name, or the round trip dropped them: "One song per track number"
     * came back with no repairs at all.
     */
    derivedRepairs: z.array(z.string()).optional(),
    /**
     * THE JUDGMENT, IN WORDS (FR-07): what must hold, in the rule language —
     * `quote != null`, `count(in('fills') where status == 'booked') <= 1`.
     * A rule that has one is judged by the studio and by the files it
     * writes; one without is the checkout's to judge in code.
     */
    require: z.string().optional(),
    /** Only the records for which this holds are judged. */
    when: z.string().optional(),
    /** What a violation says, as a template over the record: "{name} has no quote". */
    says: z.string().optional(),
  }),
  edges: {
    over: { to: ["kind"], description: "the kind it judges", inverse: "the rules over it" },
    repairs: { to: ["act"], description: "the acts that put it right", inverse: "the rules it repairs" },
  },
  label: (node) => node.label,
  display: { labels: { label: "name", judgesPast: "judges the past", wholeGraph: "over the whole graph" } },
});

export const roleNode = defineNode("role", {
  /*
   * A SEAT'S STANDING, and nothing else that happens to be called a role.
   *
   * A lens also has "required roles" — `start`, `end`, `rows`, `columns`,
   * `link` — but those are BINDING SLOTS it asks an app to answer with its
   * own fields and kinds, not something a person can hold. Reading both into
   * this kind put "columns" and "start" in the studio's ROLES district
   * beside "coordinator", and wrote them into the policy the studio hands
   * back — so `permits` would have recognized "columns" as a seat somebody
   * could be granted. They are the lens's own field now.
   */
  description: "A role a seat may hold.",
  plural: "roles",
  fields: z.object({ label }),
  label: (node) => node.label,
  display: { labels: { label: "name" } },
});

export const grantNode = defineNode("grant", {
  description: "One permission: these roles may take these acts, on these kinds.",
  plural: "grants",
  fields: z.object({
    label,
    describe: z.string().optional(),
    self: z.boolean(),
    everyone: z.boolean(),
    allActs: z.boolean(),
    allKinds: z.boolean(),
  }),
  edges: {
    lets: { to: ["role"], description: "the roles it lets", inverse: "what they are let do" },
    may: { to: ["act"], description: "the acts it allows", inverse: "who may take it" },
    // Its own name: `over` is the rule's, and one name is one relation.
    "allows-on": { to: ["kind"], description: "the kinds it allows those acts on", inverse: "who may act on it" },
  },
  label: (node) => node.label,
  display: { labels: { self: "on their own record only", allActs: "every act", allKinds: "every kind" } },
});

export const sightNode = defineNode("sight", {
  /*
   * WHO SEES WHAT, as a node like a grant is (FR-02). The studio carried a
   * checkout's `sees` through untouched and had no act for one, so a sight
   * could be kept but never added, changed or taken away where everything
   * else about the policy is.
   */
  description: "Who may see the records of some kinds at all — and, with own, only their own.",
  plural: "sights",
  fields: z.object({
    label,
    describe: z.string().optional(),
    /** Only the seat's own records: theirs, joined to theirs, or made by them. */
    own: z.boolean(),
    /** Every seat, whatever its roles. */
    everyone: z.boolean(),
  }),
  edges: {
    "seen-by": { to: ["role"], description: "the roles it lets see", inverse: "what they see" },
    shows: { to: ["kind"], description: "the kinds it shows", inverse: "who sees it" },
  },
  label: (node) => node.label,
  display: { labels: { own: "their own records only", everyone: "everybody" } },
});

export const lensNode = defineNode("lens", {
  description: "A named way of looking at the graph, and the slots it asks an app to fill.",
  plural: "lenses",
  fields: z.object({
    label,
    binds: z.enum(["fields", "entities"]).optional(),
    /**
     * The slots the lens asks an app to bind — `start` and `end` for a
     * timeline, `rows`, `columns` and `link` for a coverage grid. A field
     * rather than an edge to `role`, because a slot is part of the lens's
     * own contract and a seat's role is a person's standing; one district
     * holding both said the roster had eight roles, five of which nobody
     * could ever be.
     */
    requires: z.array(z.string()).optional(),
  }),
  label: (node) => node.label,
  display: { labels: { label: "name", requires: "the slots it asks an app to bind" } },
});

export const brandNode = defineNode("brand", {
  description: "The installation's own name and voice.",
  plural: "brands",
  fields: z.object({ label, body: z.string().optional(), display: z.string().optional() }),
  label: (node) => node.label,
  display: { labels: { label: "name", body: "body typeface", display: "display typeface" } },
});

export const STUDIO_SCHEMA = createSchema([kindNode, fieldNode, computedNode, edgeNode, actNode, ruleNode, roleNode, grantNode, sightNode, lensNode, brandNode]);
export type StudioSchema = typeof STUDIO_SCHEMA;

/*
 * THE ACTS ON A DECLARATION. Each is an ordinary mutation: titled, described,
 * saying what it creates, connects, severs or writes, so the checker holds
 * the studio to the standard it holds every app to, and an agent's tool
 * schema for the studio is the same shape as for any app.
 */
type Ctx = Parameters<AnyMutationDefinition<StudioSchema>["apply"]>[0];
type Reader = Parameters<NonNullable<AnyMutationDefinition<StudioSchema>["describe"]>>[1];
type Spec<I extends z.ZodType> = Omit<AnyMutationDefinition<StudioSchema>, "name" | "input" | "apply" | "describe"> & {
  readonly input: I;
  readonly describe?: (args: z.infer<I>, graph: Reader) => string;
  readonly apply: (ctx: Ctx, args: z.infer<I>) => void;
};
const nameOf = (ctx: Ctx, id: string): string => {
  const node = ctx.graph.getNode(id) as { label?: string } | undefined;
  return node?.label ?? id;
};
const slug = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "thing";
/*
 * A NAME ALREADY WRITTEN AS ONE IS KEPT. A relation may be one camelCase
 * word ("tendedBy") and a field always is ("lastDone"): folding them to
 * lower case made a different relation from the one a document — and
 * editDocument, and every builder that writes documents — names with the
 * same words. Words that are not yet a name are still made into one.
 */
const RELATION_NAME = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][A-Za-z0-9]*)$/;
const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;
const named = (text: string, legal: RegExp): string => (legal.test(text.trim()) ? text.trim() : slug(text));

const act = <I extends z.ZodType>(name: string, spec: Spec<I>): AnyMutationDefinition<StudioSchema> =>
  ({ ...spec, name }) as AnyMutationDefinition<StudioSchema>;

export const addKind = act("add-kind", {
  title: "Add a kind",
  description: "Declare a new kind of thing the app keeps track of.",
  creates: ["kind"],
  input: z.object({ label: z.string().min(1), plural: z.string().optional(), description: z.string().optional() }),
  describe: (args) => `Add the kind ${args.label}`,
  apply(ctx, args) {
    const name = slug(args.label);
    ctx.addNode({
      id: `${DECLARED_KIND}${name}`,
      kind: "kind",
      label: name,
      ...(args.plural ? { plural: args.plural } : {}),
      ...(args.description ? { description: args.description } : {}),
    });
    // Every kind has a name to be called by: the field the views read first.
    ctx.addNode({ id: `field:${name}.label`, kind: "field", label: "label", type: "string", required: true });
    ctx.addEdge({ kind: "of", from: `field:${name}.label`, to: `${DECLARED_KIND}${name}` });
  },
});

export const renameKind = act("rename-kind", {
  title: "Rename the kind",
  description: "Call a kind something else. Its records keep their ids; a migration carries their kind.",
  subject: { kinds: ["kind"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["kind"]), label: z.string().min(1) }),
  describe: (args, graph) => `Rename ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id} to ${args.label}`,
  apply(ctx, args) {
    const from = nameOf(ctx, args.id);
    const to = slug(args.label);
    const kinds = declaredKinds(ctx.graph as never);
    ctx.patchNode(args.id, { label: to });
    // A computed field that sweeps the kind by name (`all('party')`) follows it, by the rule language's own walk.
    if (from !== to) renameComputed(ctx, kinds, { what: "kind", from, to });
  },
});

export const removeKind = act("remove-kind", {
  title: "Remove the kind",
  description: "Take a kind out of the declaration, with its fields and the edges declared on it. Its records need a migration.",
  subject: { kinds: ["kind"], arg: "id" },
  destructive: true,
  input: z.object({ id: nodeRef(["kind"]) }),
  describe: (args, graph) => `Remove the kind ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    /*
     * The kind, its fields and the edges declared on it go together. Each
     * removal is emitted once: the context reads incident edges from the
     * graph as it stood, so removing a field and then its kind would say
     * "remove the of edge" twice.
     */
    const gone = [args.id, ...ctx.graph.in(args.id, "of").map((node) => node.id), ...ctx.graph.in(args.id, "computed-on").map((node) => node.id), ...ctx.graph.in(args.id, "from-kind").map((node) => node.id)];
    const going = new Set(gone);
    const touched = new Map<string, { kind: string; from: string; to: string }>();
    for (const edge of ctx.graph.allEdges()) {
      if (going.has(edge.from) || going.has(edge.to)) touched.set(`${edge.kind} ${edge.from} ${edge.to}`, edge);
    }
    for (const edge of touched.values()) ctx.emit({ op: "remove-edge", edge });
    for (const id of gone) {
      const node = ctx.graph.getNode(id);
      if (node) ctx.emit({ op: "remove-node", node });
    }
  },
});

export const addField = act("add-field", {
  title: "Add a field",
  description: "Give a kind a field: a name, a type, and whether it must be given.",
  subject: { kinds: ["kind"], arg: "kind" },
  creates: ["field"],
  connects: ["of"],
  fromTheOtherEnd: "of",
  input: z.object({
    kind: nodeRef(["kind"]),
    label: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    description: z.string().optional(),
  }),
  describe: (args, graph) => `Add the field ${args.label} to ${(graph.getNode(args.kind) as { label?: string } | undefined)?.label ?? args.kind}`,
  apply(ctx, args) {
    const kind = nameOf(ctx, args.kind);
    const name = named(args.label, FIELD_NAME);
    const id = `field:${kind}.${name}`;
    ctx.addNode({
      id,
      kind: "field",
      label: name,
      type: args.type,
      required: args.required,
      ...(args.options ? { options: args.options } : {}),
      ...(args.description ? { description: args.description } : {}),
    });
    ctx.addEdge({ kind: "of", from: id, to: args.kind });
  },
});

/** The declaration the studio holds, as the rule language's name walk reads it. */
function declaredKinds(graph: { ofKind?: unknown; nodesOfKind(kind: string): readonly { id: string; label?: unknown }[]; in(id: string, edge?: string): readonly { id: string; kind: string; label?: unknown }[]; out(id: string, edge?: string): readonly { id: string; label?: unknown }[] }): DeclaredKinds {
  const kinds: Record<string, { fields: string[]; edges: Record<string, string[]> }> = {};
  for (const kind of graph.nodesOfKind("kind")) {
    const name = String(kind.label);
    kinds[name] = {
      fields: graph.in(kind.id, "of").filter((node) => node.kind === "field").map((field) => String(field.label)),
      edges: Object.fromEntries(graph.in(kind.id, "from-kind").map((edge) => [String(edge.label), graph.out(edge.id, "to-kind").map((to) => String(to.label))])),
    };
  }
  return kinds;
}

/*
 * RENAME, AND EVERYTHING THAT READS IT FOLLOWS (FR-34). The same operation
 * as `editDocument`'s rename-field: the field's records keep their values,
 * and every rule judged in words that reads it — its `require`, its `when`,
 * the sentence it `says` — is rewritten by the rule language's own walk,
 * which knows a quoted word and another kind's field of the same name from
 * this one.
 */
export const renameField = act("rename-field", {
  title: "Rename the field",
  description: "Give a field a new name. Its records keep their values, and every rule that reads it follows.",
  subject: { kinds: ["field"], arg: "id" },
  /*
   * Said, so no derived "Change the field" offers the name beside it: a
   * name patched in place would skip the rules that read it (FR-61 left the
   * name the only thing such an edit could still change).
   */
  writes: ["label"],
  input: z.object({ id: nodeRef(["field"]), to: z.string().regex(/^[a-z][A-Za-z0-9]*$/, 'a field name is one word or camelCase, like "dueDate"') }),
  describe: (args, graph) => `Rename the field ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id} to ${args.to}`,
  apply(ctx, args) {
    const field = ctx.graph.getNode(args.id) as { label: string } | undefined;
    const owner = ctx.graph.out(args.id, "of")[0] as { label: string } | undefined;
    if (!field || !owner || field.label === args.to) return;
    const change = { what: "field" as const, kind: owner.label, from: field.label, to: args.to };
    const kinds = declaredKinds(ctx.graph as never);
    ctx.patchNode(args.id, { label: args.to });
    for (const rule of ctx.graph.nodesOfKind("rule") as readonly ({ id: string; wholeGraph?: boolean } & Record<string, unknown>)[]) {
      const over = rule.wholeGraph ? "graph" : String((ctx.graph.out(rule.id, "over")[0] as { label?: string } | undefined)?.label ?? "graph");
      const patch: Record<string, string> = {};
      for (const key of ["require", "when"] as const) {
        const text = rule[key];
        if (typeof text !== "string") continue;
        const next = renameIn(kinds, over, { expression: text }, change);
        if (next !== undefined && next !== text) patch[key] = next;
      }
      if (typeof rule["says"] === "string") {
        const next = renameIn(kinds, over, { template: rule["says"] }, change);
        if (next !== undefined && next !== rule["says"]) patch["says"] = next;
      }
      if (Object.keys(patch).length > 0) ctx.patchNode(rule.id, patch as never);
    }
    // And every computed field that reads it, on this kind or walking to it from another (FR-83).
    renameComputed(ctx, kinds, change);
  },
});

/** Every computed field's expression with a name changed, read from the kind that works it out. */
function renameComputed(ctx: Ctx, kinds: DeclaredKinds, change: NameChange): void {
  for (const computed of ctx.graph.nodesOfKind("computed") as readonly { id: string; expr?: unknown }[]) {
    if (typeof computed.expr !== "string") continue;
    const owner = ctx.graph.out(computed.id, "computed-on")[0] as { label?: string } | undefined;
    if (!owner?.label) continue;
    // The kind as `kinds` names it: read before the change.
    const over = change.what === "kind" && owner.label === change.to ? change.from : owner.label;
    const next = renameIn(kinds, over, { expression: computed.expr }, change);
    if (next !== undefined && next !== computed.expr) ctx.patchNode(computed.id, { expr: next } as never);
  }
}

export const removeField = act("remove-field", {
  title: "Remove the field",
  description: "Take a field off its kind. Records that carry it need a migration.",
  subject: { kinds: ["field"], arg: "id" },
  destructive: true,
  severs: ["of"],
  input: z.object({ id: nodeRef(["field"]) }),
  describe: (args, graph) => `Remove the field ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

/*
 * A FIELD CHANGES IN PLACE (FR-61). What a field is — its type, whether it
 * must be given, its options, what it is for — each changed by an act of its
 * own, so the strip names the change and the studio says it as the one edit
 * a person writing the document would write: `retype-field`,
 * `set-required`, `set-options`, `set-label`. Its records keep their values;
 * whether they still fit is the checker's and the migration's to say.
 */
const fieldLabel = (graph: Reader, id: string): string => {
  const field = graph.getNode(id) as { label?: string } | undefined;
  const owner = graph.out(id, "of")[0] as { label?: string } | undefined;
  return owner?.label && field?.label ? `${owner.label}'s ${field.label}` : (field?.label ?? id);
};

export const retypeField = act("retype-field", {
  title: "Change the field's type",
  description: "Make a field another type. An enum is given its options; a field made anything else lets them go.",
  subject: { kinds: ["field"], arg: "id" },
  writes: ["type", "options"],
  input: z.object({ id: nodeRef(["field"]), type: z.enum(FIELD_TYPES), options: z.array(z.string().min(1)).min(1).optional() }),
  describe: (args, graph) => `Make ${fieldLabel(graph, args.id)} a ${args.type}`,
  apply(ctx, args) {
    const field = ctx.graph.getNode(args.id) as { options?: readonly string[] } | undefined;
    if (args.type === "enum") {
      const options = args.options ?? field?.options;
      if (!options || options.length === 0) throw new Error(`${nameOf(ctx, args.id)} is made an enum, and an enum names its options: give them`);
      ctx.patchNode(args.id, { type: args.type, options: [...options] });
      return;
    }
    ctx.patchNode(args.id, { type: args.type, ...(field?.options !== undefined ? { options: undefined } : {}) });
  },
});

export const setRequired = act("set-required", {
  title: "Say whether it must be given",
  description: "Make a field required, or optional again.",
  subject: { kinds: ["field"], arg: "id" },
  writes: ["required"],
  input: z.object({ id: nodeRef(["field"]), required: z.boolean() }),
  describe: (args, graph) => `Make ${fieldLabel(graph, args.id)} ${args.required ? "required" : "optional"}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { required: args.required });
  },
});

export const setOptions = act("set-options", {
  title: "Change the options",
  description: "Say the options a field offers. Options already there keep their order and new ones come after them; a field that is not an enum yet becomes one.",
  subject: { kinds: ["field"], arg: "id" },
  writes: ["options"],
  input: z.object({ id: nodeRef(["field"]), options: z.array(z.string().min(1)).min(1) }),
  describe: (args, graph) => `Offer ${args.options.join(", ")} on ${fieldLabel(graph, args.id)}`,
  apply(ctx, args) {
    /*
     * OFFERED ON EVERY FIELD, so never refused on one: a field that is not
     * an enum is made one with these options, which the studio says as the
     * `retype-field` it is.
     */
    const field = ctx.graph.getNode(args.id) as { type?: string; options?: readonly string[] } | undefined;
    const had = field?.type === "enum" ? (field.options ?? []) : [];
    const kept = had.filter((option) => args.options.includes(option));
    const added = args.options.filter((option) => !had.includes(option));
    ctx.patchNode(args.id, { ...(field?.type === "enum" ? {} : { type: "enum" }), options: [...new Set([...kept, ...added])] });
  },
});

export const describeField = act("describe-field", {
  title: "Say what the field is for",
  description: "Give a field the sentence that says what it is for, or take it away with an empty one.",
  subject: { kinds: ["field"], arg: "id" },
  writes: ["description"],
  input: z.object({ id: nodeRef(["field"]), description: z.string() }),
  describe: (args, graph) => (args.description.trim() ? `Say what ${fieldLabel(graph, args.id)} is for` : `Take away what ${fieldLabel(graph, args.id)} says it is for`),
  apply(ctx, args) {
    const said = args.description.trim();
    ctx.patchNode(args.id, { description: said === "" ? undefined : said });
  },
});

export const addEdge = act("add-edge", {
  title: "Add an edge",
  description: "Declare a relation from one kind to another, with a reading from each end.",
  subject: { kinds: ["kind"], arg: "kind" },
  creates: ["edge"],
  connects: ["from-kind", "to-kind"],
  fromTheOtherEnd: "from-kind",
  input: z.object({
    kind: nodeRef(["kind"]),
    label: z.string().min(1),
    to: nodeRef(["kind"]),
    description: z.string().optional(),
    inverse: z.string().optional(),
    cardinality: z.enum(["one", "many"]).optional(),
  }),
  describe: (args, graph) =>
    `Add the edge ${args.label} from ${(graph.getNode(args.kind) as { label?: string } | undefined)?.label ?? args.kind} to ${(graph.getNode(args.to) as { label?: string } | undefined)?.label ?? args.to}`,
  apply(ctx, args) {
    const kind = nameOf(ctx, args.kind);
    const name = named(args.label, RELATION_NAME);
    const id = `edge:${kind}.${name}`;
    ctx.addNode({
      id,
      kind: "edge",
      label: name,
      cardinality: args.cardinality ?? "many",
      appendOnly: false,
      toAny: false,
      ...(args.description ? { description: args.description } : {}),
      ...(args.inverse ? { inverse: args.inverse } : {}),
    });
    ctx.addEdge({ kind: "from-kind", from: id, to: args.kind });
    ctx.addEdge({ kind: "to-kind", from: id, to: args.to });
  },
});

export const removeEdge = act("remove-edge", {
  title: "Remove the edge",
  description: "Take a relation out of the declaration. Records that hold it need a migration.",
  subject: { kinds: ["edge"], arg: "id" },
  destructive: true,
  severs: ["from-kind", "to-kind"],
  input: z.object({ id: nodeRef(["edge"]) }),
  describe: (args, graph) => `Remove the edge ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

export const addAct = act("add-act", {
  title: "Add an act",
  description: "Declare a named change on a kind. What it does is written from what it says: create, connect, sever or write.",
  subject: { kinds: ["kind"], arg: "kind" },
  creates: ["act"],
  connects: ["on"],
  fromTheOtherEnd: "on",
  input: z.object({
    kind: nodeRef(["kind"]),
    label: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    writes: z.array(z.string()).optional(),
  }),
  describe: (args, graph) => `Add the act ${args.title} on ${(graph.getNode(args.kind) as { label?: string } | undefined)?.label ?? args.kind}`,
  apply(ctx, args) {
    const name = slug(args.label);
    const id = `act:${name}`;
    ctx.addNode({
      id,
      kind: "act",
      label: name,
      title: args.title,
      destructive: false,
      onAny: false,
      derived: false,
      subjectArg: "id",
      ...(args.description ? { description: args.description } : {}),
      ...(args.writes ? { writes: args.writes } : {}),
    });
    ctx.addEdge({ kind: "on", from: id, to: args.kind });
  },
});

export const removeAct = act("remove-act", {
  title: "Remove the act",
  description: "Take an act out of the declaration. Grants that allowed it and rules that repaired with it let go of it.",
  subject: { kinds: ["act"], arg: "id" },
  destructive: true,
  severs: ["on", "creates", "connects", "severs"],
  input: z.object({ id: nodeRef(["act"]) }),
  describe: (args, graph) => `Remove the act ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

export const addRule = act("add-rule", {
  title: "Add a rule",
  description: "Hold a kind to a rule: what must hold, in the rule language (`quote != null`), and what a broken one says. Without a judgment the checkout writes one in code.",
  subject: { kinds: ["kind"], arg: "kind" },
  creates: ["rule"],
  connects: ["over"],
  fromTheOtherEnd: "over",
  input: z.object({
    kind: nodeRef(["kind"]),
    label: z.string().min(1),
    description: z.string().min(1),
    require: z.string().min(1).optional(),
    when: z.string().min(1).optional(),
    says: z.string().min(1).optional(),
  }),
  describe: (args, graph) => `Add the rule ${args.label} over ${(graph.getNode(args.kind) as { label?: string } | undefined)?.label ?? args.kind}`,
  apply(ctx, args) {
    const name = slug(args.label);
    const id = `rule:${name}`;
    ctx.addNode({
      id,
      kind: "rule",
      label: name,
      description: args.description,
      judgesPast: false,
      wholeGraph: false,
      ...(args.require ? { require: args.require } : {}),
      ...(args.when ? { when: args.when } : {}),
      ...(args.says ? { says: args.says } : {}),
    });
    ctx.addEdge({ kind: "over", from: id, to: args.kind });
  },
});

export const removeRule = act("remove-rule", {
  title: "Remove the rule",
  description: "Stop holding the graph to a rule.",
  subject: { kinds: ["rule"], arg: "id" },
  destructive: true,
  severs: ["over", "repairs"],
  input: z.object({ id: nodeRef(["rule"]) }),
  describe: (args, graph) => `Remove the rule ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

export const nameRepair = act("name-repair", {
  title: "Name a repair",
  description: "Say which act puts a broken rule right, so the rule becomes a one-press fix and a legal move for an agent.",
  subject: { kinds: ["rule"], arg: "rule" },
  connects: ["repairs"],
  fromTheOtherEnd: "Repairs a rule",
  input: z.object({ rule: nodeRef(["rule"]), act: nodeRef(["act"]) }),
  describe: (args, graph) => `${(graph.getNode(args.rule) as { label?: string } | undefined)?.label ?? args.rule} is repaired by ${(graph.getNode(args.act) as { label?: string } | undefined)?.label ?? args.act}`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "repairs", from: args.rule, to: args.act });
  },
});

export const forgetRepair = act("forget-repair", {
  title: "Forget a repair",
  description: "Take back the claim that an act puts this rule right.",
  subject: { kinds: ["rule"], arg: "rule" },
  severs: ["repairs"],
  fromTheOtherEnd: "No longer repairs a rule",
  input: z.object({ rule: nodeRef(["rule"]), act: nodeRef(["act"]) }),
  describe: (args, graph) => `${(graph.getNode(args.rule) as { label?: string } | undefined)?.label ?? args.rule} is no longer repaired by ${(graph.getNode(args.act) as { label?: string } | undefined)?.label ?? args.act}`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "repairs", from: args.rule, to: args.act });
  },
});

export const setFigure = act("set-figure", {
  title: "Draw the kind",
  description:
    "Give a kind its figure: line art of the thing, in the house style, wherever the kind is drawn.",
  subject: { kinds: ["kind"], arg: "id" },
  writes: ["figure"],
  input: z.object({ id: nodeRef(["kind"]), figure: z.string().min(1) }),
  describe: (args, graph) =>
    `Draw ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { figure: args.figure });
  },
});

export const addRole = act("add-role", {
  title: "Add a role",
  description: "Declare a role a seat may hold.",
  creates: ["role"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Add the role ${args.label}`,
  apply(ctx, args) {
    const name = slug(args.label);
    ctx.addNode({ id: `role:${name}`, kind: "role", label: name });
  },
});

export const grant = act("grant", {
  title: "Grant",
  description: "Let a role take an act, on one kind or on all of them.",
  subject: { kinds: ["role"], arg: "role" },
  creates: ["grant"],
  connects: ["lets", "may", "allows-on"],
  fromTheOtherEnd: "lets",
  input: z.object({ role: nodeRef(["role"]), act: nodeRef(["act"]), kind: nodeRef(["kind"]).optional(), self: z.boolean().optional() }),
  describe: (args, graph) =>
    `${(graph.getNode(args.role) as { label?: string } | undefined)?.label ?? args.role} may ${(graph.getNode(args.act) as { label?: string } | undefined)?.label ?? args.act}`,
  apply(ctx, args) {
    const role = nameOf(ctx, args.role);
    const actName = nameOf(ctx, args.act);
    const id = ctx.freshId(`${role} may ${actName}`, "grant");
    ctx.addNode({ id, kind: "grant", label: `${role} may ${actName}`, self: args.self ?? false, everyone: false, allActs: false, allKinds: !args.kind });
    ctx.addEdge({ kind: "lets", from: id, to: args.role });
    ctx.addEdge({ kind: "may", from: id, to: args.act });
    if (args.kind) ctx.addEdge({ kind: "allows-on", from: id, to: args.kind });
  },
});

export const revokeGrant = act("revoke-grant", {
  title: "Revoke the grant",
  description: "Take a permission back.",
  subject: { kinds: ["grant"], arg: "id" },
  destructive: true,
  severs: ["lets", "may", "allows-on"],
  input: z.object({ id: nodeRef(["grant"]) }),
  describe: (args, graph) => `Revoke ${(graph.getNode(args.id) as { label?: string } | undefined)?.label ?? args.id}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

const labelOf = (graph: Reader, id: string): string => (graph.getNode(id) as { label?: string } | undefined)?.label ?? id;

export const addSight = act("add-sight", {
  title: "Let a role see a kind",
  description:
    "Say who may see the records of a kind: one role, or everybody when none is named; with own, only their own records. Once any sight is declared, a kind no sight names is seen by nobody but the system.",
  subject: { kinds: ["kind"], arg: "kind" },
  creates: ["sight"],
  connects: ["seen-by", "shows"],
  fromTheOtherEnd: "shows",
  input: z.object({ kind: nodeRef(["kind"]), role: nodeRef(["role"]).optional(), own: z.boolean().optional(), describe: z.string().optional() }),
  describe: (args, graph) =>
    `${args.role ? labelOf(graph, args.role) : "Everybody"} may see ${args.own ? "their own " : ""}${labelOf(graph, args.kind)}`,
  apply(ctx, args) {
    const who = args.role ? nameOf(ctx, args.role) : "everybody";
    const what = nameOf(ctx, args.kind);
    const said = `${who} may see ${args.own ? "their own " : ""}${what}`;
    const id = ctx.freshId(said, "sight");
    ctx.addNode({ id, kind: "sight", label: said, own: args.own ?? false, everyone: !args.role, ...(args.describe ? { describe: args.describe } : {}) });
    if (args.role) ctx.addEdge({ kind: "seen-by", from: id, to: args.role });
    ctx.addEdge({ kind: "shows", from: id, to: args.kind });
  },
});

export const changeSight = act("change-sight", {
  title: "Change the sight",
  description: "Keep a sight to a seat's own records, or not, and say why in a sentence.",
  subject: { kinds: ["sight"], arg: "id" },
  writes: ["own", "describe"],
  input: z.object({ id: nodeRef(["sight"]), own: z.boolean().optional(), describe: z.string().optional() }),
  describe: (args, graph) => `Change ${labelOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { ...(args.own !== undefined ? { own: args.own } : {}), ...(args.describe !== undefined ? { describe: args.describe } : {}) });
  },
});

export const removeSight = act("remove-sight", {
  title: "Take the sight away",
  description: "Stop letting these roles see these kinds. A kind no sight names is then seen by nobody but the system.",
  subject: { kinds: ["sight"], arg: "id" },
  destructive: true,
  severs: ["seen-by", "shows"],
  input: z.object({ id: nodeRef(["sight"]) }),
  describe: (args, graph) => `Take away ${labelOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

/**
 * TAKE A PLACE AWAY: a lens the app declared, and the place its title made.
 * Said to the document as `remove-lens` (a lens kept from the seat's draft
 * is taken back the same way); the records it drew are not touched.
 */
export const removeLens = act("remove-lens", {
  title: "Take the lens away",
  description: "Stop drawing this lens. A lens with a title is a place, and the place goes with it; nothing it drew is removed.",
  subject: { kinds: ["lens"], arg: "id" },
  destructive: true,
  input: z.object({ id: nodeRef(["lens"]) }),
  describe: (args, graph) => `Take away the lens ${labelOf(graph, args.id)}`,
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

export const STUDIO_MUTATIONS: readonly AnyMutationDefinition<StudioSchema>[] = [
  addKind,
  renameKind,
  removeKind,
  addField,
  renameField,
  removeField,
  retypeField,
  setRequired,
  setOptions,
  describeField,
  addEdge,
  removeEdge,
  addAct,
  removeAct,
  addRule,
  removeRule,
  nameRepair,
  forgetRepair,
  setFigure,
  addRole,
  grant,
  revokeGrant,
  addSight,
  changeSight,
  removeSight,
  removeLens,
];

/** The studio as an app: the meta-schema, its acts, and an agent seat that may propose any of them. */
export function studioApp(name = "Studio"): GraviewApp<StudioSchema> {
  return {
    name,
    schema: STUDIO_SCHEMA,
    mutations: STUDIO_MUTATIONS,
    intelligence: [{ name: "studio-agent", kind: "llm", description: "Proposes changes to the declaration; a person accepts or declines them." }],
  };
}
