import { z } from "zod";

/*
 * THE GRAVIEW DECLARATION DOCUMENT, v1 — as data a stranger can hand us.
 *
 * docs/declaration-document.md is the prose; this is the shape. Every key is
 * closed (`strict`): an unknown key is a finding, not something quietly
 * ignored, because a model that misspells `requires` for `require` should be
 * told, not given an app whose rule holds nothing.
 */

export const FORMAT = "graview-document";
export const FORMAT_VERSION = 1;
export const MAX_DOCUMENT_BYTES = 256 * 1024;

/** kebab-case: kinds, acts, rules, edges, roles, modules. */
export const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Field names are identifiers so a rule can say them bare: `quote != null`. */
export const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;
const RESERVED_FIELDS = new Set(["id", "kind"]);

const name = (what: string) => z.string().regex(NAME, `${what} names are lower-case words joined by hyphens, like "booked-vendor"`);
/**
 * A RELATION'S NAME may be kebab-case or one camelCase word. camelCase is
 * recommended: a rule can then walk it bare (`tendedBy.name`), where
 * `tended-by.name` would read as a subtraction.
 */
export const EDGE_NAME = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][A-Za-z0-9]*)$/;
const edgeName = z.string().regex(EDGE_NAME, 'relation names are one camelCase word, like "tendedBy"');
const fieldName = z
  .string()
  .regex(FIELD_NAME, 'field names are one word or camelCase, like "dueDate" — rules say them bare')
  .refine((n) => !RESERVED_FIELDS.has(n), 'a field cannot be called "id" or "kind" — the framework keeps those; try "type" or "category"');
const sentence = z.string().min(1).max(500);
const expression = z.string().min(1).max(2000);
const template = z.string().min(1).max(300);

export const FIELD_TYPES = ["string", "text", "number", "integer", "boolean", "date", "datetime", "enum", "list", "url", "email"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FieldSpec = z
  .object({
    type: z.enum(FIELD_TYPES),
    required: z.boolean().optional(),
    description: sentence.optional(),
    /** What the field is called on screen, where its name does not say it. */
    label: z.string().min(1).max(60).optional(),
    options: z.array(z.string().min(1).max(80)).min(1).max(100).optional(),
    of: z.enum(["string", "number", "date"]).optional(),
    default: z.unknown().optional(),
    unit: z.string().max(12).optional(),
    format: z.enum(["money", "percent", "duration"]).optional(),
    /** The name this field had in the previous version: its values move instead of being dropped. */
    renamedFrom: z.string().regex(FIELD_NAME).optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.type === "enum" && !f.options) ctx.addIssue({ code: "custom", message: 'an enum field lists its "options"', path: ["options"] });
    if (f.type !== "enum" && f.options) ctx.addIssue({ code: "custom", message: '"options" belongs only on an enum field', path: ["options"] });
    if (f.type !== "list" && f.of) ctx.addIssue({ code: "custom", message: '"of" belongs only on a list field', path: ["of"] });
  });
export type FieldSpec = z.infer<typeof FieldSpec>;

export const EdgeSpec = z
  .object({
    to: z.union([z.array(name("kind")).min(1), z.literal("*")]),
    cardinality: z.enum(["one", "many"]).optional(),
    description: sentence.optional(),
    inverse: z.string().min(1).max(80).optional(),
    appendOnly: z.boolean().optional(),
    /** The name this relation had in the previous version: its links move. */
    renamedFrom: z.string().optional(),
  })
  .strict();
export type EdgeSpec = z.infer<typeof EdgeSpec>;

export const KindSpec = z
  .object({
    noun: z.string().min(1).max(40).optional(),
    plural: z.string().min(1).max(40).optional(),
    description: sentence.optional(),
    fields: z.record(fieldName, FieldSpec).refine((f) => Object.keys(f).length > 0, "a kind has at least one field"),
    label: template.optional(),
    describe: template.optional(),
    lifecycle: z.object({ field: fieldName, retired: z.array(z.union([z.string(), z.number(), z.boolean()])).min(1) }).strict().optional(),
    figure: z.string().max(20_000).optional(),
    edges: z.record(edgeName, EdgeSpec).optional(),
    /** The name this kind had in the previous version: its records move. */
    renamedFrom: z.string().regex(NAME).optional(),
  })
  .strict();
export type KindSpec = z.infer<typeof KindSpec>;

/** A value an effect writes: a literal, `$arg`, `$subject`, `$new`, `$now`, `$today`, or `{ expr }`. */
export const ValueSpec = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.object({ expr: expression }).strict()]);
export type ValueSpec = z.infer<typeof ValueSpec>;

const ref = z.string().regex(/^\$[A-Za-z][A-Za-z0-9]*$/, 'a reference is "$" and a name, like "$subject" or "$new"');

export const EffectSpec = z.union([
  z.object({ create: name("kind"), as: z.string().regex(FIELD_NAME).optional(), set: z.record(fieldName, ValueSpec).optional() }).strict(),
  z.object({ set: z.record(fieldName, ValueSpec), target: ref.optional() }).strict(),
  z.object({ connect: edgeName, from: ref, to: ref }).strict(),
  z.object({ sever: edgeName, from: ref, to: ref }).strict(),
  z.object({ remove: ref }).strict(),
]);
export type EffectSpec = z.infer<typeof EffectSpec>;

export const ActSpec = z
  .object({
    title: z.string().min(1).max(80).optional(),
    description: sentence.optional(),
    /** How the act reads standing on the far end of the relation it makes or breaks. */
    fromTheOtherEnd: z.string().min(1).max(80).optional(),
    on: z.union([name("kind"), z.array(name("kind")).min(1)]).optional(),
    creates: name("kind").optional(),
    sets: z.record(fieldName, ValueSpec).optional(),
    writes: z.array(fieldName).min(1).optional(),
    connects: edgeName.optional(),
    severs: edgeName.optional(),
    removes: z.literal(true).optional(),
    args: z.record(fieldName, FieldSpec).optional(),
    effects: z.array(EffectSpec).min(1).max(20).optional(),
    allowedWhen: expression.optional(),
    refusal: template.optional(),
    destructive: z.boolean().optional(),
  })
  .strict();
export type ActSpec = z.infer<typeof ActSpec>;

export const RepairSpec = z
  .object({
    act: name("act"),
    label: z.string().min(1).max(80).optional(),
    args: z.record(z.string(), ValueSpec).optional(),
  })
  .strict();

export const RuleSpec = z
  .object({
    title: z.string().min(1).max(120).optional(),
    description: sentence.optional(),
    over: z.union([z.literal("graph"), name("kind")]),
    when: expression.optional(),
    require: expression,
    says: template.optional(),
    repairs: z.array(RepairSpec).max(10).optional(),
  })
  .strict();
export type RuleSpec = z.infer<typeof RuleSpec>;

export const GrantSpec = z
  .object({
    roles: z.union([z.array(name("role")).min(1), z.literal("*")]),
    mutations: z.union([z.array(name("act")).min(1), z.literal("*")]),
    kinds: z.union([z.array(name("kind")), z.literal("*")]).optional(),
    describe: sentence.optional(),
    self: z.boolean().optional(),
  })
  .strict();

/**
 * Who sees which kinds — the framework's `Sight`, one meaning (FR-02).
 * Absent: everyone sees everything. Present: a kind no sight names is seen
 * by nobody but the system (a host that gives its owners everything serves
 * them as the system, or names them in a sight).
 */
export const SightSpec = z
  .object({
    roles: z.union([z.array(name("role")).min(1), z.literal("*")]),
    kinds: z.array(name("kind")).min(1),
    /** Only the principal's own records: the ones they made, their own record, and what an edge joins to it. */
    own: z.boolean().optional(),
  })
  .strict();
export type SightSpec = z.infer<typeof SightSpec>;

export const PolicySpec = z
  .object({
    grants: z.array(GrantSpec),
    sees: z.array(SightSpec).optional(),
  })
  .strict();
export type PolicySpec = z.infer<typeof PolicySpec>;

export const BrandSpec = z
  .object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'an accent is a colour like "#c2577a"'),
    name: z.string().min(1).max(60).optional(),
  })
  .strict();

const loose = z.record(z.string(), z.unknown());

/** A kind's view specs: which slots it fills. The blocks are checked in views.ts, sentence by sentence. */
const ViewSpecsSpec = z
  .object({
    card: z.array(z.unknown()).optional(),
    row: z.array(z.unknown()).optional(),
    page: z.array(z.unknown()).optional(),
  })
  .strict();

export const DocumentSpec = z
  .object({
    format: z.literal(FORMAT),
    formatVersion: z.literal(FORMAT_VERSION),
    name: z.string().min(1).max(80),
    description: sentence.optional(),
    version: z.number().int().min(1).optional(),
    kinds: z.record(name("kind"), KindSpec).refine((k) => Object.keys(k).length > 0, "a document declares at least one kind").refine((k) => Object.keys(k).length <= 40, "a document declares at most 40 kinds"),
    acts: z.record(name("act"), ActSpec).optional(),
    rules: z.record(name("rule"), RuleSpec).optional(),
    roles: z.array(name("role")).optional(),
    policy: PolicySpec.optional(),
    modules: loose.optional(),
    lenses: z.array(loose).optional(),
    pages: loose.optional(),
    views: z.record(z.string(), ViewSpecsSpec).optional(),
    brand: BrandSpec.optional(),
    settings: z.array(loose).optional(),
    migrations: z.array(loose).optional(),
  })
  .strict();
export type GraviewDocument = z.infer<typeof DocumentSpec>;
