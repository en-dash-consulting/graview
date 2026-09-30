import type { AnyMutationDefinition, GraphEdge, GraphSnapshot, AnySchema, GraviewApp } from "@graview/core";
import { fieldTypeOf } from "./from-declaration.js";
import type { FieldType } from "./meta.js";
import { printZod, type ZodUses } from "./zod-source.js";

/*
 * THE DECLARATION WRITTEN BACK AS CODE — the same files `graview create`
 * writes into `src/domain/`, so the studio and the checkout never disagree
 * about the shape of the app. Shape is what a graph can carry: a rule's
 * judgement and an act's hand-written body are code, and the files say
 * where the checkout's own must be kept.
 */

export type Node = { readonly id: string; readonly kind: string } & Record<string, unknown>;
interface Reading {
  readonly nodes: readonly Node[];
  readonly edges: readonly GraphEdge[];
}

export interface SourceOptions {
  /** The app's name, for the comments. */
  readonly name?: string;
  /** The exported schema's variable name; `graview create` uses `<camel>Schema`. */
  readonly schemaVar?: string;
  /**
   * The app the studio opened on. A judgement and a hand-written body are
   * code the studio cannot write; for a rule or an act the checkout
   * already has, the file says so LOUDLY — a stub that throws naming what
   * belongs there — rather than a stub that quietly holds. Every rule the
   * checkout wrote used to come back as `evaluate() { return []; }` under
   * a comment claiming the checkout's evaluate was kept.
   */
  readonly base?: GraviewApp<AnySchema>;
}

export interface WrittenFile {
  readonly path: string;
  readonly contents: string;
  /** The bodies the checkout must supply, by name: what this file could not write. */
  readonly kept: readonly string[];
}

export const q = (text: string): string => JSON.stringify(text);
export const camel = (slug: string): string => slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const pascal = (slug: string): string => {
  const c = camel(slug);
  return c.charAt(0).toUpperCase() + c.slice(1);
};
export const label = (node: Node): string => String(node["label"] ?? node.id);
const str = (node: Node, key: string): string | undefined => (typeof node[key] === "string" ? (node[key] as string) : undefined);
const bool = (node: Node, key: string): boolean => node[key] === true;
const list = (node: Node, key: string): string[] | undefined => (Array.isArray(node[key]) ? (node[key] as unknown[]).map(String) : undefined);

export class Read {
  private readonly byId = new Map<string, Node>();
  constructor(readonly reading: Reading) {
    for (const node of reading.nodes) this.byId.set(node.id, node);
  }
  node(id: string): Node | undefined {
    return this.byId.get(id);
  }
  ofKind(kind: string): Node[] {
    return this.reading.nodes.filter((node) => node.kind === kind);
  }
  out(from: string, kind: string): Node[] {
    return this.reading.edges.filter((edge) => edge.from === from && edge.kind === kind).map((edge) => this.byId.get(edge.to)).filter((node): node is Node => node !== undefined);
  }
  in(to: string, kind: string): Node[] {
    return this.reading.edges.filter((edge) => edge.to === to && edge.kind === kind).map((edge) => this.byId.get(edge.from)).filter((node): node is Node => node !== undefined);
  }
}

export function zodSource(type: FieldType, required: boolean, options?: readonly string[]): string {
  const base =
    type === "number"
      ? "z.number()"
      : type === "boolean"
        ? "z.boolean()"
        : type === "enum" && options && options.length > 0
          ? `z.enum([${options.map(q).join(", ")}])`
          : type === "list"
            ? "z.array(z.string())"
            : type === "string"
              ? "z.string().min(1)"
              : "z.string()";
  return required ? base : `${base}.optional()`;
}

const defaultSource = (type: FieldType, options?: readonly string[]): string =>
  type === "number" ? "0" : type === "boolean" ? "false" : type === "enum" ? q(options?.[0] ?? "") : type === "list" ? "[]" : type === "date" ? "new Date().toISOString().slice(0, 10)" : '""';

/**
 * The lines of a `defineNode` the studio carries from the checkout rather
 * than from its graph, narrowed to the fields that still exist — a label
 * for a field somebody deleted is not preserved, it is meaningless.
 */
function carried(
  base: GraviewApp<AnySchema> | undefined,
  kind: string,
  fields: ReadonlySet<string>,
  keptFormats: string[],
): string[] {
  const was = base?.schema?.tryDefinition?.(kind) as
    | {
        display?: { labels?: Record<string, string>; format?: Record<string, unknown>; hide?: readonly string[] };
        fixed?: Record<string, string>;
        fieldRoles?: Record<string, string>;
      }
    | undefined;
  if (!was) return [];
  const lines: string[] = [];
  const pairs = (record: Record<string, string> | undefined): string | undefined => {
    const left = Object.entries(record ?? {}).filter(([field]) => fields.has(field));
    return left.length === 0 ? undefined : `{ ${left.map(([at, value]) => `${q(at)}: ${q(value)}`).join(", ")} }`;
  };
  const labels = pairs(was.display?.labels);
  const hide = was.display?.hide?.filter((field) => fields.has(field));
  const formatted = Object.keys(was.display?.format ?? {}).filter((field) => fields.has(field));
  if (labels || (hide && hide.length > 0)) {
    lines.push(`  display: {`);
    if (labels) lines.push(`    labels: ${labels},`);
    if (hide && hide.length > 0) lines.push(`    hide: [${hide.map(q).join(", ")}],`);
    if (formatted.length > 0) {
      lines.push(
        `    // The checkout also formats ${formatted.map(q).join(", ")}; a format is a`,
        `    // FUNCTION and the studio cannot write one. Carry it over from`,
        `    // the file you are replacing, or these fields read as raw values.`,
      );
    }
    lines.push(`  },`);
  } else if (formatted.length > 0) {
    lines.push(
      `  // The checkout formats ${formatted.map(q).join(", ")} with a function the`,
      `  // studio cannot write. Carry display.format over from the file you`,
      `  // are replacing, or these fields read as raw values.`,
    );
  }
  for (const field of formatted) keptFormats.push(`${kind}.${field} (display.format)`);
  const fixed = pairs(was.fixed);
  if (fixed) lines.push(`  fixed: ${fixed},`);
  const roles = Object.entries(was.fieldRoles ?? {}).filter(([, field]) => fields.has(String(field)));
  if (roles.length > 0) {
    lines.push(`  fieldRoles: { ${roles.map(([role, field]) => `${q(role)}: ${q(String(field))}`).join(", ")} },`);
  }
  return lines;
}

/** A kind's fields, as the graph holds them. */
export function fieldsOf(read: Read, kind: Node): { name: string; type: FieldType; required: boolean; options: string[] | undefined }[] {
  return read.in(kind.id, "of").map((field) => ({
    name: label(field),
    type: (str(field, "type") ?? "string") as FieldType,
    required: bool(field, "required"),
    options: list(field, "options"),
  }));
}

/** An edge's declaration, one property per entry: `to: ["gardener"]`, `cardinality: "one"`, … */
export function edgeParts(read: Read, edge: Node): string[] {
  const targets = read.out(edge.id, "to-kind").map(label);
  const parts = [`to: ${bool(edge, "toAny") ? '"*"' : `[${targets.map(q).join(", ")}]`}`];
  if (str(edge, "cardinality") === "one") parts.push(`cardinality: "one"`);
  if (str(edge, "description")) parts.push(`description: ${q(str(edge, "description")!)}`);
  if (str(edge, "inverse")) parts.push(`inverse: ${q(str(edge, "inverse")!)}`);
  if (bool(edge, "appendOnly")) parts.push(`appendOnly: true`);
  return parts;
}

/** A kind's whole `defineNode` statement, as the graph holds it. */
export function kindLines(
  read: Read,
  kind: Node,
  base: GraviewApp<AnySchema> | undefined,
  keptFormats: string[],
  uses: ZodUses = { nodeRef: false, isoDate: false },
): string[] {
  const fields = fieldsOf(read, kind);
  // The checkout's own schema for a field the studio still reads the same way.
  const baseShape = ((base?.schema.tryDefinition(label(kind))?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}) as Record<string, unknown>;
  const fieldSource = (field: (typeof fields)[number]): string => {
    const own = baseShape[field.name];
    if (own !== undefined) {
      const was = fieldTypeOf(own);
      const same =
        was.type === field.type &&
        was.required === field.required &&
        (was.options ?? []).join("|") === (field.options ?? []).join("|");
      const printed = same ? printZod(own, uses) : null;
      if (printed !== null) return printed;
    }
    return zodSource(field.type, field.required, field.options);
  };
  const edges = read.in(kind.id, "from-kind");
  const lifecycleField = str(kind, "lifecycleField");
  const retired = list(kind, "retired");
  const lines = [`export const ${camel(label(kind))} = defineNode(${q(label(kind))}, {`];
  if (str(kind, "description")) lines.push(`  description: ${q(str(kind, "description")!)},`);
  lines.push(`  fields: z.object({`);
  for (const field of fields) lines.push(`    ${/^[a-z_$][\w$]*$/i.test(field.name) ? field.name : q(field.name)}: ${fieldSource(field)},`);
  lines.push(`  }),`);
  if (edges.length > 0) {
    lines.push(`  edges: {`);
    for (const edge of edges) {
      lines.push(`    ${q(label(edge))}: {`, ...edgeParts(read, edge).map((part) => `      ${part},`), `    },`);
    }
    lines.push(`  },`);
  }
  if (str(kind, "plural")) lines.push(`  plural: ${q(str(kind, "plural")!)},`);
  if (str(kind, "noun")) lines.push(`  noun: ${q(str(kind, "noun")!)},`);
  if (fields.some((field) => field.name === "label")) lines.push(`  label: (node) => node.label,`);
  else if (typeof (base?.schema?.tryDefinition?.(label(kind)) as { label?: unknown } | undefined)?.label === "function") {
    /*
     * A NAME BUILT FROM FIELDS is a function, and the studio cannot write
     * one. A vehicle named "2027 Subaru Forester Sport" from its year, make
     * and model came back with no label at all — every card an id — and
     * nothing said so.
     */
    lines.push(
      `  // The checkout names ${q(label(kind))} with a function the studio cannot write;`,
      `  // carry \`label\` over from the file you are replacing, or every one is named by its id.`,
    );
    keptFormats.push(`${label(kind)} (label)`);
  }
  if (lifecycleField && retired) lines.push(`  lifecycle: { field: ${q(lifecycleField)}, retired: ${retired[0] === "date" ? '"date"' : `[${retired.map(q).join(", ")}]`} },`);
  // The drawing is part of the declaration, so it is part of the file.
  if (str(kind, "figure")) lines.push(`  figure: ${q(str(kind, "figure")!)},`);
  /*
   * WHAT THE STUDIO DOES NOT MODEL, IT WRITES BACK ANYWAY.
   *
   * How a field reads, what is fixed and which fields answer a lens's
   * roles are decisions in the checkout that the studio has no act for.
   * Rebuilding a kind from the graph alone dropped all of them — so
   * applying would have turned "Blocked 09:00" back into
   * `plannedAt: 540` on every card. The one thing that genuinely cannot
   * be written is a `format` function; the file SAYS SO where it finds
   * one rather than losing it silently.
   */
  lines.push(...carried(base, label(kind), new Set(fields.map((field) => field.name)), keptFormats));
  lines.push(`});`);
  return lines;
}

/**
 * An act's whole `defineMutation` statement, as the graph holds it. `kept`
 * is an act the checkout already wrote: its body is code the studio never
 * saw, so the statement throws where the body belongs rather than doing
 * something else quietly.
 */
export function actLines(
  read: Read,
  act: Node,
  kept: boolean,
  checkout?: AnyMutationDefinition,
  uses: ZodUses = { nodeRef: true, isoDate: false },
): string[] {
  const actName = label(act);
  const on = read.out(act.id, "on").map((kind) => label(kind));
  const creates = read.out(act.id, "creates").map((kind) => label(kind));
  const connects = read.out(act.id, "connects");
  const severs = read.out(act.id, "severs");
  const writes = list(act, "writes") ?? [];
  const arg = str(act, "subjectArg") ?? "id";
  // The checkout's own word for the far end, kept; `to` only for an act the studio declared.
  const far = str(act, "targetArg") ?? "to";
  const onAny = bool(act, "onAny");
  const subjectKinds = onAny ? '"*"' : `[${on.map(q).join(", ")}]`;
  const lines = [`export const ${camel(actName)} = defineMutation(${q(actName)}, {`];
  const body: string[] = [];
  if (str(act, "title")) lines.push(`  title: ${q(str(act, "title")!)},`);
  if (str(act, "fromTheOtherEnd")) lines.push(`  fromTheOtherEnd: ${q(str(act, "fromTheOtherEnd")!)},`);
  if (str(act, "description")) lines.push(`  description: ${q(str(act, "description")!)},`);
  if (bool(act, "destructive")) lines.push(`  destructive: true,`);
  if (onAny || on.length > 0) lines.push(`  subject: { kinds: ${subjectKinds}, arg: ${q(arg)} },`);
  if (creates.length > 0) lines.push(`  creates: [${creates.map(q).join(", ")}],`);
  if (connects.length > 0) lines.push(`  connects: [${connects.map((edge) => q(label(edge))).join(", ")}],`);
  if (severs.length > 0) lines.push(`  severs: [${severs.map((edge) => q(label(edge))).join(", ")}],`);
  if (writes.length > 0) lines.push(`  writes: [${writes.map(q).join(", ")}],`);
  if (creates.length > 0) {
    const kind = creates[0]!;
    const kindNode = read.ofKind("kind").find((node) => label(node) === kind);
    const fields = kindNode ? fieldsOf(read, kindNode).filter((field) => field.name !== "label") : [];
    const asked = fields.filter((field) => field.required && field.type !== "list");
    lines.push(`  input: z.object({ label: z.string().min(1)${asked.map((field) => `, ${field.name}: ${zodSource(field.type, false, field.options)}`).join("")} }),`);
    lines.push(`  describe: (args) => \`${str(act, "title") ?? actName}: \${args.label}\`,`);
    body.push(`    ctx.addNode({`);
    body.push(`      id: ctx.freshId(args.label, ${q(kind)}),`);
    body.push(`      kind: ${q(kind)},`);
    body.push(`      label: args.label,`);
    for (const field of fields) if (field.required) body.push(`      ${field.name}: args.${field.name} ?? ${defaultSource(field.type, field.options)},`);
    body.push(`    });`);
  } else if (connects[0] ?? severs[0]) {
    const edge = (connects[0] ?? severs[0])!;
    const targets = read.out(edge.id, "to-kind").map((target) => label(target));
    const making = connects.length > 0;
    lines.push(`  input: z.object({ ${arg}: nodeRef(${subjectKinds}), ${far}: nodeRef(${targets.length > 0 ? `[${targets.map(q).join(", ")}]` : '"*"'}) }),`);
    lines.push(`  describe: (args, graph) => \`${str(act, "title") ?? actName}: \${nameOf(graph as Reader, args.${arg})} ${making ? "→" : "⇸"} \${nameOf(graph as Reader, args.${far})}\`,`);
    body.push(`    ctx.${making ? "addEdge" : "removeEdge"}({ kind: ${q(label(edge))}, from: args.${arg}, to: args.${far} });`);
  } else {
    const declared = new Map<string, { type: FieldType; options: string[] | undefined }>();
    for (const kindNode of read.ofKind("kind")) if (on.includes(label(kindNode))) for (const field of fieldsOf(read, kindNode)) declared.set(field.name, { type: field.type, options: field.options });
    lines.push(`  input: z.object({ ${arg}: nodeRef(${subjectKinds})${writes.map((field) => `, ${field}: ${declared.has(field) ? zodSource(declared.get(field)!.type, false, declared.get(field)!.options) : "z.string().optional()"}`).join("")} }),`);
    lines.push(`  describe: (args, graph) => \`${str(act, "title") ?? actName}: \${nameOf(graph as Reader, args.${arg})}\`,`);
    if (writes.length > 0) {
      body.push(`    const patch: Record<string, unknown> = {};`);
      for (const field of writes) body.push(`    if (args.${field} !== undefined) patch[${q(field)}] = args.${field};`);
      body.push(`    if (Object.keys(patch).length > 0) ctx.patchNode(args.${arg}, patch);`);
    } else {
      body.push(`    // Declared in the studio with no create, connect, sever or write: give it a body.`);
      body.push(`    void ctx;`);
      body.push(`    void args;`);
    }
  }
  /*
   * AN ACT THE CHECKOUT WROTE KEEPS ITS OWN ARGUMENTS AND ITS OWN WORDS.
   * The input above is derived from what the act declares — its kind's
   * fields, its tie's two ends — which is the checkout's input only by
   * luck; and the history's sentence is a function the studio never saw.
   */
  if (kept && checkout) {
    const printed = printZod(checkout.input, uses);
    const at = lines.findIndex((line) => line.startsWith("  input: "));
    if (at >= 0 && printed !== null) lines[at] = `  input: ${printed},`;
    const said = lines.findIndex((line) => line.startsWith("  describe: "));
    if (said >= 0 && checkout.describe) {
      lines.splice(said, 1, `  // describe: the checkout's own sentence for the history belongs here — the studio cannot write a function it never saw.`);
    }
  }
  lines.push(`  apply(ctx, args) {`);
  if (kept) {
    /*
     * AN ACT THE CHECKOUT WROTE keeps its declaration and loses its body
     * here, because a body is code the studio never saw. A generated one
     * that does something ELSE — "close it" patching only when a status
     * is passed, a tie without the checkout's own guard — is worse than
     * none, so the stub throws, naming what belongs here, and `kept`
     * says so to whoever writes the files.
     */
    lines.push(`    // The checkout's own body belongs here: the studio cannot write what it never saw.`);
    lines.push(`    void ctx;`);
    lines.push(`    void args;`);
    lines.push(`    throw new Error(${q(`${actName}: the checkout's apply belongs here — the studio cannot write a hand-written body`)});`);
  } else {
    lines.push(...body);
  }
  lines.push(`  },`);
  lines.push(`});`);
  return lines;
}

/** A rule's whole `defineInvariant` statement. `kept`: the checkout already judges it, so its evaluate is not the studio's to write. */
export function ruleLines(read: Read, rule: Node, kept: boolean): string[] {
  const ruleName = label(rule);
  const over = read.out(rule.id, "over")[0];
  const repairs = [...read.out(rule.id, "repairs").map(label), ...(list(rule, "derivedRepairs") ?? [])];
  const whole = bool(rule, "wholeGraph") || !over;
  const lines = [`export const ${camel(ruleName)} = ${whole ? "defineGraphInvariant" : "defineInvariant"}(${q(ruleName)}, {`];
  // The checkout's words for it, not its identifier.
  lines.push(`  label: ${q(str(rule, "title") ?? ruleName)},`);
  if (str(rule, "description")) lines.push(`  description: ${q(str(rule, "description")!)},`);
  if (!whole) lines.push(`  scope: { kind: ${q(label(over!))} },`);
  if (repairs.length > 0) lines.push(`  repairs: [${repairs.map(q).join(", ")}],`);
  if (bool(rule, "judgesPast")) lines.push(`  judgesPast: true,`);
  lines.push(`  evaluate(): Violation[] {`);
  if (kept) {
    /*
     * A rule the checkout already judges: its evaluate is code the
     * studio never saw. A stub that returns nothing would hold, and a
     * rule that holds when it should not is a lie the interface tells
     * with a green light. So it throws, naming what belongs here.
     */
    lines.push(`    // The checkout's own judgement belongs here: the studio cannot write what it never saw.`);
    lines.push(`    throw new Error(${q(`${ruleName}: the checkout's evaluate belongs here — the studio cannot write a judgement`)});`);
  } else {
    lines.push(`    // The judgement: return a violation per subject that breaks the rule.`);
    lines.push(`    return [];`);
  }
  lines.push(`  },`);
  lines.push(`});`);
  return lines;
}

/** `src/domain/schema.ts`, `mutations.ts`, `invariants.ts` and, with roles, `policy.ts`. */
export function declarationFiles(snapshot: GraphSnapshot | Reading, options: SourceOptions = {}): WrittenFile[] {
  const read = new Read(snapshot as Reading);
  const schemaVar = options.schemaVar ?? "schema";
  const name = options.name ?? "the app";
  const baseActs = new Set((options.base?.mutations ?? []).map((mutation) => mutation.name));
  const baseRules = new Set((options.base?.invariants ?? []).map((rule) => rule.name));
  const keptActs: string[] = [];
  const keptRules: string[] = [];
  const keptFormats: string[] = [];
  const kinds = read.ofKind("kind");

  /*
   * `z` FROM THE FRAMEWORK. A product never installs zod — `@graview/core`
   * re-exports it, and a second copy makes every kind's fields a nominally
   * different type — so a file importing "zod" is a file the product
   * cannot resolve.
   */
  const schemaUses: ZodUses = { nodeRef: false, isoDate: false };
  const kindText = kinds.flatMap((kind) => ["", ...kindLines(read, kind, options.base, keptFormats, schemaUses)]);
  const schemaTs = [
    `import { createSchema, defineNode, ${schemaUses.isoDate ? "isoDate, " : ""}z } from "@graview/core";`,
    ``,
    `/*`,
    ` * ${name}'s kinds, written by the studio. The shape is the declaration's;`,
    ` * edit it here or there, and \`graview check\` judges either.`,
    ` */`,
    ...kindText,
    ``,
    `export const ${schemaVar} = createSchema([${kinds.map((kind) => camel(label(kind))).join(", ")}]);`,
    `export type ${pascal(schemaVar)} = typeof ${schemaVar};`,
    ``,
  ].join("\n");

  const acts = read.ofKind("act").filter((act) => !bool(act, "derived"));
  const actUses: ZodUses = { nodeRef: true, isoDate: false };
  const actText = acts.flatMap((act) => {
    const kept = baseActs.has(label(act));
    if (kept) keptActs.push(label(act));
    const checkout = options.base?.mutations?.find((mutation) => mutation.name === label(act));
    return ["", ...actLines(read, act, kept, checkout as AnyMutationDefinition | undefined, actUses)];
  });
  const mutationsTs = [
    `import { bindSchema, ${actUses.isoDate ? "isoDate, " : ""}nodeRef, z, type GraphReader } from "@graview/core";`,
    `import { ${schemaVar} } from "./schema.js";`,
    ``,
    `const { defineMutation } = bindSchema(${schemaVar});`,
    ``,
    `// A node's name for the history: an id in the interface is a bug you shipped.`,
    `type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;`,
    `const nameOf = (graph: Reader, id: string): string => {`,
    `  const node = graph.getNode(id);`,
    `  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;`,
    `};`,
    ``,
    `/*`,
    ` * ${name}'s acts, written by the studio from what each act declares:`,
    ` * create, connect, sever or write. Where the checkout's own body did`,
    ` * more, keep the checkout's body under the studio's declaration.`,
    ` */`,
    ...actText,
    ``,
    `export const mutations = [${acts.map((act) => camel(label(act))).join(", ")}];`,
    ``,
  ].join("\n");

  const rules = read.ofKind("rule");
  const invariantsTs = [
    `import { bindSchema, type Violation } from "@graview/core";`,
    `import { ${schemaVar} } from "./schema.js";`,
    ``,
    `const { defineInvariant, defineGraphInvariant } = bindSchema(${schemaVar});`,
    ``,
    `/*`,
    ` * ${name}'s rules, as the studio declares them: what each judges and what`,
    ` * repairs it. A judgement is code — a rule the studio declared holds`,
    ` * nothing wrong until its evaluate says otherwise; a rule the checkout`,
    ` * already judges keeps the checkout's evaluate.`,
    ` */`,
    ...rules.flatMap((rule) => {
      const kept = baseRules.has(label(rule));
      if (kept) keptRules.push(label(rule));
      return ["", ...ruleLines(read, rule, kept)];
    }),
    ``,
    `export const invariants = [${rules.map((rule) => camel(label(rule))).join(", ")}];`,
    ``,
  ].join("\n");

  const roles = read.ofKind("role").map(label);
  const grants = read.ofKind("grant");
  const files: WrittenFile[] = [
    // A format is a function; the file names the ones it could not write.
    { path: "src/domain/schema.ts", contents: schemaTs, kept: keptFormats },
    { path: "src/domain/mutations.ts", contents: mutationsTs, kept: keptActs.map((act) => `${act}: apply`) },
    { path: "src/domain/invariants.ts", contents: invariantsTs, kept: keptRules.map((rule) => `${rule}: evaluate`) },
  ];
  if (roles.length > 0 || grants.length > 0) {
    const policyTs = [
      `import type { Policy } from "@graview/core";`,
      ``,
      `/* Who may do what in ${name}, as the studio declares it. */`,
      `export const policy: Policy = {`,
      `  roles: [${roles.map(q).join(", ")}],`,
      `  grants: [`,
      ...grants.map((g) => {
        const lets = read.out(g.id, "lets").map(label);
        const may = read.out(g.id, "may").map(label);
        const over = read.out(g.id, "allows-on").map(label);
        const parts = [
          `roles: ${bool(g, "everyone") ? '"*"' : `[${lets.map(q).join(", ")}]`}`,
          `mutations: ${bool(g, "allActs") ? '"*"' : `[${may.map(q).join(", ")}]`}`,
          ...(bool(g, "allKinds") ? [] : [`kinds: [${over.map(q).join(", ")}]`]),
          ...(str(g, "describe") ? [`describe: ${q(str(g, "describe")!)}`] : []),
          ...(bool(g, "self") ? ["self: true"] : []),
        ];
        return `    { ${parts.join(", ")} },`;
      }),
      `  ],`,
      `};`,
      ``,
    ].join("\n");
    files.push({ path: "src/domain/policy.ts", contents: policyTs, kept: [] });
  }
  return files;
}
