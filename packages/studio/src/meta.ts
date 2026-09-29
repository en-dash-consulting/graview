import { createSchema, defineNode, nodeRef, type AnyMutationDefinition, type GraviewApp } from "@graview/core";
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

export const FIELD_TYPES = ["string", "text", "number", "boolean", "date", "enum", "list"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const kindNode = defineNode("kind", {
  description: "A kind of thing the app keeps track of.",
  plural: "kinds",
  fields: z.object({
    label,
    plural: z.string().optional(),
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
     * drawn app and applying would have rubbed every drawing out. Modelled
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
   * back — so `permits` would have recognised "columns" as a seat somebody
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

export const STUDIO_SCHEMA = createSchema([kindNode, fieldNode, edgeNode, actNode, ruleNode, roleNode, grantNode, lensNode, brandNode]);
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
    ctx.patchNode(args.id, { label: slug(args.label) });
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
    const gone = [args.id, ...ctx.graph.in(args.id, "of").map((node) => node.id), ...ctx.graph.in(args.id, "from-kind").map((node) => node.id)];
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
    const name = slug(args.label);
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
    const name = slug(args.label);
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
  description: "Hold a kind to a rule. The judgement is written in the checkout; the studio declares it and names its repairs.",
  subject: { kinds: ["kind"], arg: "kind" },
  creates: ["rule"],
  connects: ["over"],
  fromTheOtherEnd: "over",
  input: z.object({ kind: nodeRef(["kind"]), label: z.string().min(1), description: z.string().min(1) }),
  describe: (args, graph) => `Add the rule ${args.label} over ${(graph.getNode(args.kind) as { label?: string } | undefined)?.label ?? args.kind}`,
  apply(ctx, args) {
    const name = slug(args.label);
    const id = `rule:${name}`;
    ctx.addNode({ id, kind: "rule", label: name, description: args.description, judgesPast: false, wholeGraph: false });
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

export const STUDIO_MUTATIONS: readonly AnyMutationDefinition<StudioSchema>[] = [
  addKind,
  renameKind,
  removeKind,
  addField,
  removeField,
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
