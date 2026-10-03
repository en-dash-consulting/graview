import {
  createSchema,
  defineInvariant,
  defineNode,
  nodeRef,
  nodeRefArgs,
  type AnyMutationDefinition,
  type AnySchema,
  type EdgeDeclaration,
  type Grant,
  type GraphEdge,
  type GraphSnapshot,
  type GraviewApp,
  type InvariantDefinition,
  type LensDeclaration,
  type Policy,
  type Sight,
} from "@graview/core";
import { expressionRule } from "@graview/core/document";
import { z } from "zod";
import { DECLARED_KIND, type FieldType } from "./meta.js";
import { fieldTypeOf } from "./from-declaration.js";

/*
 * THE GRAPH READ BACK AS A DECLARATION. Kinds become `defineNode`, fields
 * become zod, edges become edge declarations, acts become mutations, rules
 * become invariants, roles and grants a policy — an app the checker can
 * judge and the store can run. Where the checkout wrote an act's body or a
 * rule's judgement by hand, the base app supplies it by name; an act the
 * studio declared gets a body written from what it says (create, connect,
 * sever, write), and a rule the studio declared judges nothing until the
 * checkout gives it a body.
 */

type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;

export interface Reading {
  readonly nodes: readonly Node[];
  readonly edges: readonly GraphEdge[];
}

class Read {
  private readonly byId = new Map<string, Node>();
  constructor(private readonly snapshot: Reading) {
    for (const node of snapshot.nodes) this.byId.set(node.id, node);
  }
  ofKind(kind: string): Node[] {
    return this.snapshot.nodes.filter((node) => node.kind === kind);
  }
  node(id: string): Node | undefined {
    return this.byId.get(id);
  }
  /** Targets of `kind` edges leaving `from`. */
  out(from: string, kind: string): Node[] {
    return this.snapshot.edges.filter((edge) => edge.from === from && edge.kind === kind).map((edge) => this.byId.get(edge.to)).filter((node): node is Node => node !== undefined);
  }
  /** Sources of `kind` edges arriving at `to`. */
  in(to: string, kind: string): Node[] {
    return this.snapshot.edges.filter((edge) => edge.to === to && edge.kind === kind).map((edge) => this.byId.get(edge.from)).filter((node): node is Node => node !== undefined);
  }
}

const str = (node: Node, key: string): string | undefined => (typeof node[key] === "string" ? (node[key] as string) : undefined);
const bool = (node: Node, key: string): boolean => node[key] === true;
const list = (node: Node, key: string): string[] | undefined => (Array.isArray(node[key]) ? (node[key] as unknown[]).map(String) : undefined);
const name = (node: Node): string => str(node, "label") ?? node.id;

/** The zod type a studio field declares. */
export function zodFor(type: FieldType, required: boolean, options?: readonly string[]): z.ZodType {
  const base: z.ZodType =
    type === "number"
      ? z.number()
      : type === "boolean"
        ? z.boolean()
        : type === "enum" && options && options.length > 0
          ? z.enum(options as [string, ...string[]])
          : type === "list"
            ? z.array(z.string())
            : type === "string"
              ? z.string().min(1)
              : z.string();
  return required ? base : base.optional();
}

/** A value a required field can start with, when an act creates a record without asking. */
export function defaultFor(type: FieldType, options?: readonly string[]): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "enum":
      return options?.[0] ?? "";
    case "list":
      return [];
    case "date":
      return new Date().toISOString().slice(0, 10);
    default:
      return "";
  }
}

export interface DeclarationOptions<S extends AnySchema = AnySchema> {
  /** The checkout's app: bodies for acts and rules the studio only names. */
  readonly base?: GraviewApp<S>;
  readonly name?: string;
}

/**
 * WHAT THE STUDIO DOES NOT MODEL, IT MUST NOT SILENTLY DESTROY.
 *
 * A kind carries decisions the studio has no act for: how a field READS
 * (`display.labels`, `display.format`, `display.hide`), which fields are
 * `fixed` because nothing may rewrite them, and which of them answer a
 * lens's roles (`fieldRoles`). Rebuilding a kind from the graph alone threw
 * all of it away — so applying the studio to Things would have turned
 * "Blocked 09:00" back into `plannedAt: 540` on every task card, and
 * brought back the `field-without-writer` warning on a rationale that is
 * fixed on purpose. Neither is a change anyone asked for, and neither is
 * visible in the studio, which makes it the worst kind of loss.
 *
 * Carried from the checkout's own declaration, narrowed to the fields that
 * still exist — a label for a field somebody deleted is not preserved, it
 * is meaningless.
 */
function kept(
  base: GraviewApp<AnySchema> | undefined,
  kind: string,
  shape: Record<string, z.ZodType>,
): Record<string, unknown> {
  const was = base?.schema?.tryDefinition?.(kind) as
    | {
        display?: {
          labels?: Record<string, string>;
          format?: Record<string, unknown>;
          hide?: readonly string[];
          glance?: readonly string[];
        };
        fixed?: Record<string, string>;
        fieldRoles?: Record<string, string>;
        label?: unknown;
      }
    | undefined;
  if (!was) return {};
  const here = (name: string) => name in shape;
  // A name built from fields ("2027 Subaru Forester Sport") is the checkout's function, carried
  // while the kind has no `label` field of its own to fall back on.
  const naming = typeof was.label === "function" && !here("label") ? { label: was.label } : undefined;
  const narrow = <T,>(record: Record<string, T> | undefined): Record<string, T> | undefined => {
    if (!record) return undefined;
    const left = Object.fromEntries(Object.entries(record).filter(([field]) => here(field)));
    return Object.keys(left).length > 0 ? left : undefined;
  };
  const labels = narrow(was.display?.labels);
  const format = narrow(was.display?.format);
  const hide = was.display?.hide?.filter(here);
  // What a glance says, while its fields do (W-169: the round trip dropped it).
  const glance = was.display?.glance?.filter(here);
  const display =
    labels || format || (hide && hide.length > 0) || (glance && glance.length > 0)
      ? {
          ...(labels ? { labels } : {}),
          ...(format ? { format } : {}),
          ...(hide && hide.length > 0 ? { hide } : {}),
          ...(glance && glance.length > 0 ? { glance } : {}),
        }
      : undefined;
  const fixed = narrow(was.fixed);
  // A role names a FIELD, so it survives only while its field does.
  const roles = was.fieldRoles
    ? Object.fromEntries(Object.entries(was.fieldRoles).filter(([, field]) => here(String(field))))
    : undefined;
  return {
    ...(display ? { display } : {}),
    ...(fixed ? { fixed } : {}),
    ...(roles && Object.keys(roles).length > 0 ? { fieldRoles: roles } : {}),
    ...(naming ?? {}),
  };
}

/** The studio's graph as a checkable, runnable app. */
export function graphToDeclaration(snapshot: GraphSnapshot | Reading, options: DeclarationOptions = {}): GraviewApp<AnySchema> {
  const read = new Read(snapshot as Reading);
  const base = options.base;
  const kindName = new Map<string, string>();
  for (const kind of read.ofKind("kind")) kindName.set(kind.id, name(kind));
  // A kind called something else: `declared:plot` whose name is now "bed".
  // The checkout's acts still ask for a plot by name, so their references
  // follow.
  const renamed = new Map<string, string>();
  for (const [id, now] of kindName) {
    const was = id.slice(DECLARED_KIND.length);
    if (was !== now) renamed.set(was, now);
  }
  const follow = (kind: string) => renamed.get(kind) ?? kind;
  const edgeName = new Map<string, string>();
  for (const edge of read.ofKind("edge")) edgeName.set(edge.id, name(edge));

  const fieldsOf = (kind: Node) =>
    read.in(kind.id, "of").map((field) => ({
      name: name(field),
      type: (str(field, "type") ?? "string") as FieldType,
      required: bool(field, "required"),
      options: list(field, "options"),
    }));

  const definitions = read.ofKind("kind").map((kind) => {
    const shape: Record<string, z.ZodType> = {};
    /*
     * THE CHECKOUT'S OWN SCHEMA for a field the graph still reads the same
     * way: its bounds are not in the graph, and rebuilding from the graph
     * alone dropped every one — a label's `.max(60)`, a track number's
     * `.int()` — so the app the studio applied validated less than the one
     * it opened on, and the checker said `label-unbounded` of every kind.
     */
    const baseShape = ((base?.schema.tryDefinition(name(kind))?.fields as { shape?: Record<string, z.ZodType> } | undefined)?.shape ?? {}) as Record<string, z.ZodType>;
    for (const field of fieldsOf(kind)) {
      const own = baseShape[field.name];
      const was = own ? fieldTypeOf(own) : undefined;
      const same =
        was !== undefined &&
        was.type === field.type &&
        was.required === field.required &&
        (was.options ?? []).join("|") === (field.options ?? []).join("|");
      shape[field.name] = same ? own! : zodFor(field.type, field.required, field.options);
    }
    const edges: Record<string, EdgeDeclaration> = {};
    for (const edge of read.in(kind.id, "from-kind")) {
      const targets = read.out(edge.id, "to-kind").map((target) => kindName.get(target.id) ?? name(target));
      edges[name(edge)] = {
        to: bool(edge, "toAny") ? "*" : targets,
        ...(str(edge, "cardinality") === "one" ? { cardinality: "one" as const } : {}),
        ...(str(edge, "description") ? { description: str(edge, "description")! } : {}),
        ...(str(edge, "inverse") ? { inverse: str(edge, "inverse")! } : {}),
        ...(bool(edge, "appendOnly") ? { appendOnly: true } : {}),
      };
    }
    const lifecycleField = str(kind, "lifecycleField");
    const retired = list(kind, "retired");
    const hasLabel = "label" in shape;
    return defineNode(name(kind), {
      fields: z.object(shape),
      edges,
      ...(str(kind, "plural") ? { plural: str(kind, "plural")! } : {}),
      ...(str(kind, "noun") ? { noun: str(kind, "noun")! } : {}),
      ...(str(kind, "description") ? { description: str(kind, "description")! } : {}),
      ...(hasLabel ? { label: (node: { id: string } & Record<string, unknown>) => String(node["label"] ?? node.id) } : {}),
      ...(lifecycleField && retired ? { lifecycle: { field: lifecycleField, retired: retired[0] === "date" ? ("date" as const) : retired } } : {}),
      ...(str(kind, "figure") ? { figure: str(kind, "figure")! } : {}),
      // What the studio has no act for is CARRIED, not dropped.
      ...kept(base, name(kind), shape),
    } as never);
  });
  const schema = createSchema(definitions as never) as AnySchema;

  const baseMutations = new Map((base?.mutations ?? []).map((mutation) => [mutation.name, mutation as AnyMutationDefinition]));
  const mutations: AnyMutationDefinition[] = [];
  for (const act of read.ofKind("act")) {
    if (bool(act, "derived")) continue;
    const actName = name(act);
    const on = read.out(act.id, "on").map((kind) => kindName.get(kind.id) ?? name(kind));
    const creates = read.out(act.id, "creates").map((kind) => kindName.get(kind.id) ?? name(kind));
    const connects = read.out(act.id, "connects");
    const severs = read.out(act.id, "severs");
    const writes = list(act, "writes");
    const subjectArg = str(act, "subjectArg") ?? "id";
    const subject = bool(act, "onAny") ? { kinds: "*" as const, arg: subjectArg } : on.length > 0 ? { kinds: on, arg: subjectArg } : undefined;
    const said = {
      name: actName,
      ...(str(act, "title") ? { title: str(act, "title")! } : {}),
      ...(str(act, "fromTheOtherEnd") ? { fromTheOtherEnd: str(act, "fromTheOtherEnd")! } : {}),
      ...(str(act, "description") ? { description: str(act, "description")! } : {}),
      ...(bool(act, "destructive") ? { destructive: true } : {}),
      ...(subject ? { subject } : {}),
      ...(creates.length > 0 ? { creates } : {}),
      ...(connects.length > 0 ? { connects: connects.map(name) } : {}),
      ...(severs.length > 0 ? { severs: severs.map(name) } : {}),
      ...(writes ? { writes } : {}),
    };
    const kept = baseMutations.get(actName);
    if (kept) {
      // The checkout's body, under what the studio now says about it; its
      // node references follow a renamed kind.
      mutations.push({ ...kept, ...said, input: renamed.size > 0 ? followingRenames(kept.input, follow) : kept.input, apply: kept.apply } as AnyMutationDefinition);
      continue;
    }
    mutations.push(writtenBody(said, { creates, connects, severs, writes: writes ?? [], on, read, kindName, fieldsOf }));
  }

  const baseInvariants = new Map((base?.invariants ?? []).map((rule) => [rule.name, rule as InvariantDefinition]));
  const invariants: InvariantDefinition[] = read.ofKind("rule").map((rule) => {
    const ruleName = name(rule);
    const repairs = [...read.out(rule.id, "repairs").map(name), ...(list(rule, "derivedRepairs") ?? [])];
    const over = read.out(rule.id, "over")[0];
    const kept = baseInvariants.get(ruleName);
    const scope = bool(rule, "wholeGraph") || !over ? ("graph" as const) : { kind: kindName.get(over.id) ?? name(over) };
    const description = str(rule, "description");
    /*
     * A judgement in words is judged — the studio's own rule and the
     * checkout's alike, since the words are the judgement (FR-07).
     */
    const require = str(rule, "require");
    if (require) {
      return expressionRule(
        ruleName,
        {
          over: scope === "graph" ? "graph" : scope.kind,
          require,
          ...(str(rule, "when") ? { when: str(rule, "when")! } : {}),
          ...(str(rule, "says") ? { says: str(rule, "says")! } : {}),
          title: str(rule, "title") ?? ruleName,
          ...(description ? { description } : {}),
          ...(repairs.length > 0 ? { repairs } : {}),
          ...(bool(rule, "judgesPast") ? { judgesPast: true } : {}),
        },
      );
    }
    if (kept) return { ...kept, scope, ...(description ? { description } : {}), ...(repairs.length > 0 ? { repairs } : {}) } as InvariantDefinition;
    return defineInvariant(ruleName, {
      scope,
      label: ruleName,
      description: description ?? `${ruleName}: declared in the studio; the checkout gives it a judgement.`,
      ...(repairs.length > 0 ? { repairs } : {}),
      ...(bool(rule, "judgesPast") ? { judgesPast: true } : {}),
      // Declared, not yet judged: a rule with no body holds nothing wrong.
      evaluate: () => [],
    } as never) as InvariantDefinition;
  });

  const roles = read.ofKind("role").map(name);
  const grants: Grant[] = read.ofKind("grant").map((g) => {
    const lets = read.out(g.id, "lets").map(name);
    const may = read.out(g.id, "may").map(name);
    const over = read.out(g.id, "allows-on").map((kind) => kindName.get(kind.id) ?? name(kind));
    return {
      roles: bool(g, "everyone") ? "*" : lets,
      mutations: bool(g, "allActs") ? "*" : may,
      ...(bool(g, "allKinds") ? {} : { kinds: over }),
      ...(str(g, "describe") ? { describe: str(g, "describe")! } : {}),
      ...(bool(g, "self") ? { self: true } : {}),
    };
  });
  /*
   * WHO SEES WHAT, read from the sights in the graph (FR-02), kept to the
   * kinds still declared — a sight whose every kind is gone keeps nothing.
   */
  const sees: Sight[] = read
    .ofKind("sight")
    .map((sight) => ({
      roles: bool(sight, "everyone") ? ("*" as const) : read.out(sight.id, "seen-by").map(name),
      kinds: read.out(sight.id, "shows").map((kind) => kindName.get(kind.id) ?? name(kind)),
      ...(bool(sight, "own") ? { own: true } : {}),
      ...(str(sight, "describe") ? { describe: str(sight, "describe")! } : {}),
    }))
    .filter((sight) => sight.kinds.length > 0);
  const policy: Policy | undefined =
    roles.length > 0 || grants.length > 0 || sees.length > 0 ? { grants, ...(roles.length > 0 ? { roles } : {}), ...(sees.length > 0 ? { sees } : {}) } : undefined;

  /*
   * A LENS'S BINDINGS FOLLOW THE KINDS THEY NAME — and let go of the ones
   * that are gone.
   *
   * The bindings are carried from the checkout, because the studio has no
   * act that writes one. Carried VERBATIM, renaming `plot` to `bed` left the
   * coverage grid bound to a kind that no longer exists, and `graview check`
   * refused to apply the rename with an error about a lens nobody had
   * touched. Removing a kind left the same wreckage.
   *
   * So renames are followed, the same way an act's subject follows one; and
   * a lens that named something now deleted is dropped whole rather than
   * half-bound, on the principle this file already keeps for display labels
   * — what refers to something that is gone is not preserved, it is
   * meaningless.
   */
  const liveKinds = new Set(kindName.values());
  const liveEdges = new Set(edgeName.values());
  type Bound = Record<string, unknown>;
  const followBindings = (
    bindings: LensDeclaration["bindings"] | undefined,
    binds: "fields" | "entities",
  ): { readonly ok: true; readonly bindings?: LensDeclaration["bindings"] } | { readonly ok: false } => {
    if (!bindings) return { ok: true };
    if (binds === "entities") {
      const out: Bound = {};
      for (const [role, bound] of Object.entries(bindings as Record<string, Bound>)) {
        const kind = typeof bound?.["kind"] === "string" ? follow(bound["kind"] as string) : undefined;
        const edge = typeof bound?.["edge"] === "string" ? (bound["edge"] as string) : undefined;
        if (kind !== undefined && !liveKinds.has(kind)) return { ok: false };
        if (edge !== undefined && !liveEdges.has(edge)) return { ok: false };
        out[role] = kind !== undefined ? { ...bound, kind } : bound;
      }
      return { ok: true, bindings: out as LensDeclaration["bindings"] };
    }
    // A `fields` lens is keyed BY KIND, so a rename rekeys it.
    const out: Bound = {};
    for (const [kind, roles] of Object.entries(bindings as Record<string, Bound>)) {
      const now = follow(kind);
      if (!liveKinds.has(now)) return { ok: false };
      out[now] = roles;
    }
    return { ok: true, bindings: out as LensDeclaration["bindings"] };
  };

  const baseLenses = new Map((base?.lenses ?? []).map((lens) => [lens.name, lens]));
  const lenses: LensDeclaration[] = read.ofKind("lens").flatMap((lens) => {
    const kept = baseLenses.get(name(lens));
    const requiredRoles = list(lens, "requires") ?? [];
    const binds = (str(lens, "binds") as "fields" | "entities" | undefined) ?? kept?.binds ?? "fields";
    const followed = followBindings(kept?.bindings, binds);
    if (!followed.ok) return [];
    return [
      {
        ...(kept ?? {}),
        name: name(lens),
        requiredRoles,
        ...(str(lens, "binds") ? { binds: str(lens, "binds") as "fields" | "entities" } : {}),
        ...(followed.bindings ? { bindings: followed.bindings } : {}),
      },
    ];
  });

  const brandNode = read.ofKind("brand")[0];
  const brand = base?.brand
    ? { ...base.brand, ...(brandNode ? { name: name(brandNode) } : {}) }
    : undefined;

  return {
    name: options.name ?? base?.name ?? "Declared in the studio",
    schema,
    mutations,
    invariants,
    ...(policy ? { policy } : {}),
    ...(lenses.length > 0 ? { lenses } : {}),
    ...(brand ? { brand } : {}),
    ...(base?.modules ? { modules: base.modules } : {}),
    ...(base?.intelligence ? { intelligence: base.intelligence } : {}),
    ...(base?.version !== undefined ? { version: base.version } : {}),
    ...(base?.migrations ? { migrations: base.migrations } : {}),
  };
}

/** The same input, with every node reference to a renamed kind pointing at its new name. */
function followingRenames(input: z.ZodType, follow: (kind: string) => string): z.ZodType {
  const shape = (input as { shape?: Record<string, z.ZodType> }).shape;
  if (!shape) return input;
  const refs = new Map(nodeRefArgs(input).map((ref) => [ref.name, ref]));
  const next: Record<string, z.ZodType> = {};
  for (const [key, type] of Object.entries(shape)) {
    const ref = refs.get(key);
    if (!ref || ref.kinds.length === 0) {
      next[key] = type;
      continue;
    }
    const kinds = ref.kinds.map(follow);
    const ofKind = nodeRef(kinds);
    next[key] = ref.optional ? ofKind.optional() : ofKind;
  }
  return z.object(next);
}

interface BodyContext {
  readonly creates: readonly string[];
  readonly connects: readonly Node[];
  readonly severs: readonly Node[];
  readonly writes: readonly string[];
  readonly on: readonly string[];
  readonly read: Read;
  readonly kindName: Map<string, string>;
  readonly fieldsOf: (kind: Node) => readonly { name: string; type: FieldType; required: boolean; options: string[] | undefined }[];
}

/**
 * A body written from what the act says. Create: a record of the kind with
 * its required fields started; connect or sever: the edge between the
 * subject and a named far end; write: the named fields patched from the
 * arguments. Nothing else is guessed — an act that says none of these is
 * declared with a body that does nothing, and the interface withholds it
 * as an act that would change nothing.
 */
function writtenBody(said: Partial<AnyMutationDefinition> & { name: string }, ctx: BodyContext): AnyMutationDefinition {
  const subjectKinds = ctx.on.length > 0 ? ctx.on : "*";
  const arg = said.subject?.arg ?? "id";
  if (ctx.creates.length > 0) {
    const kind = ctx.creates[0]!;
    const kindNode = ctx.read.ofKind("kind").find((node) => (ctx.kindName.get(node.id) ?? "") === kind);
    const fields = kindNode ? ctx.fieldsOf(kindNode) : [];
    const shape: Record<string, z.ZodType> = { label: z.string().min(1) };
    for (const field of fields) if (field.name !== "label" && field.required && field.type !== "list") shape[field.name] = zodFor(field.type, false, field.options);
    return {
      ...said,
      input: z.object(shape),
      describe: (args: Record<string, unknown>) => `${said.title ?? said.name}: ${String(args["label"] ?? "")}`,
      apply(context, args: Record<string, unknown>) {
        const started: Record<string, unknown> = {};
        for (const field of fields) {
          if (field.name === "label") continue;
          if (args[field.name] !== undefined) started[field.name] = args[field.name];
          else if (field.required) started[field.name] = defaultFor(field.type, field.options);
        }
        context.addNode({ id: context.freshId(String(args["label"]), kind), kind, label: args["label"], ...started } as never);
      },
    } as AnyMutationDefinition;
  }
  const edgeToTouch = ctx.connects[0] ?? ctx.severs[0];
  if (edgeToTouch) {
    const edgeKind = name(edgeToTouch);
    const targets = ctx.read.out(edgeToTouch.id, "to-kind").map((kind) => ctx.kindName.get(kind.id) ?? name(kind));
    const making = ctx.connects.length > 0;
    return {
      ...said,
      input: z.object({ [arg]: nodeRef(subjectKinds === "*" ? "*" : subjectKinds), to: nodeRef(targets.length > 0 ? targets : "*") }),
      describe: (args: Record<string, unknown>) => `${said.title ?? said.name}: ${String(args[arg])} ${making ? "→" : "⇸"} ${String(args["to"])}`,
      apply(context, args: Record<string, unknown>) {
        const edge = { kind: edgeKind, from: String(args[arg]), to: String(args["to"]) };
        if (making) context.addEdge(edge);
        else context.removeEdge(edge);
      },
    } as AnyMutationDefinition;
  }
  const shape: Record<string, z.ZodType> = { [arg]: nodeRef(subjectKinds === "*" ? "*" : subjectKinds) };
  // A written field is asked for in its own type: the kind's declaration says what a size is.
  const declared = new Map<string, { type: FieldType; options: string[] | undefined }>();
  for (const kindNode of ctx.read.ofKind("kind")) {
    if (!ctx.on.includes(ctx.kindName.get(kindNode.id) ?? "")) continue;
    for (const field of ctx.fieldsOf(kindNode)) declared.set(field.name, { type: field.type, options: field.options });
  }
  for (const field of ctx.writes) {
    const known = declared.get(field);
    shape[field] = known ? zodFor(known.type, false, known.options) : z.string().optional();
  }
  return {
    ...said,
    input: z.object(shape),
    describe: (args: Record<string, unknown>) => `${said.title ?? said.name}: ${String(args[arg])}`,
    apply(context, args: Record<string, unknown>) {
      const patch: Record<string, unknown> = {};
      for (const field of ctx.writes) if (args[field] !== undefined) patch[field] = args[field];
      if (Object.keys(patch).length > 0) context.patchNode(String(args[arg]), patch);
    },
  } as AnyMutationDefinition;
}
