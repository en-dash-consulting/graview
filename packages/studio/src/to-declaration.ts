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
} from "@graview/core";
import { z } from "zod";
import type { FieldType } from "./meta.js";

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

/** The studio's graph as a checkable, runnable app. */
export function graphToDeclaration(snapshot: GraphSnapshot | Reading, options: DeclarationOptions = {}): GraviewApp<AnySchema> {
  const read = new Read(snapshot as Reading);
  const base = options.base;
  const kindName = new Map<string, string>();
  for (const kind of read.ofKind("kind")) kindName.set(kind.id, name(kind));
  // A kind called something else: `kind:plot` whose name is now "bed". The
  // checkout's acts still ask for a plot by name, so their references follow.
  const renamed = new Map<string, string>();
  for (const [id, now] of kindName) {
    const was = id.slice("kind:".length);
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
    for (const field of fieldsOf(kind)) shape[field.name] = zodFor(field.type, field.required, field.options);
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
      ...(str(kind, "description") ? { description: str(kind, "description")! } : {}),
      ...(hasLabel ? { label: (node: { id: string } & Record<string, unknown>) => String(node["label"] ?? node.id) } : {}),
      ...(lifecycleField && retired ? { lifecycle: { field: lifecycleField, retired: retired[0] === "date" ? ("date" as const) : retired } } : {}),
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
    const repairs = read.out(rule.id, "repairs").map(name);
    const over = read.out(rule.id, "over")[0];
    const kept = baseInvariants.get(ruleName);
    const scope = bool(rule, "wholeGraph") || !over ? ("graph" as const) : { kind: kindName.get(over.id) ?? name(over) };
    const description = str(rule, "description");
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
    const over = read.out(g.id, "over").map((kind) => kindName.get(kind.id) ?? name(kind));
    return {
      roles: bool(g, "everyone") ? "*" : lets,
      mutations: bool(g, "allActs") ? "*" : may,
      ...(bool(g, "allKinds") ? {} : { kinds: over }),
      ...(str(g, "describe") ? { describe: str(g, "describe")! } : {}),
      ...(bool(g, "self") ? { self: true } : {}),
    };
  });
  const policy: Policy | undefined = roles.length > 0 || grants.length > 0 ? { grants, ...(roles.length > 0 ? { roles } : {}) } : undefined;

  const baseLenses = new Map((base?.lenses ?? []).map((lens) => [lens.name, lens]));
  const lenses: LensDeclaration[] = read.ofKind("lens").map((lens) => {
    const kept = baseLenses.get(name(lens));
    const requiredRoles = read.out(lens.id, "requires").map(name);
    return { ...(kept ?? {}), name: name(lens), requiredRoles, ...(str(lens, "binds") ? { binds: str(lens, "binds") as "fields" | "entities" } : {}) };
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
