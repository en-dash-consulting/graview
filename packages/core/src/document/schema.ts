import * as z from "../schema/zod.js";

/*
 * THE GRAVIEW DECLARATION DOCUMENT, v1 — as data a stranger can hand us.
 *
 * docs/declaration-document.md is the prose; this is the shape. Every key is
 * closed (`strict`): an unknown key is a finding, not something quietly
 * ignored, because a model that misspells `requires` for `require` should be
 * told, not given an app whose rule holds nothing.
 *
 * Written in zod/mini (schema/zod.ts): a hosted page reads a document in the
 * browser, and the shape costs it what it calls, not all of zod (FR-57).
 */

export const FORMAT = "graview-document";
export const FORMAT_VERSION = 1;
export const MAX_DOCUMENT_BYTES = 256 * 1024;

/** kebab-case: kinds, acts, rules, edges, roles, modules. */
export const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** Field names are identifiers so a rule can say them bare: `quote != null`. */
export const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/;
const RESERVED_FIELDS = new Set(["id", "kind"]);

/** At least `min` and at most `max` long: a string's characters, a list's items. */
const sized = (min?: number, max?: number) => [...(min === undefined ? [] : [z.minLength(min)]), ...(max === undefined ? [] : [z.maxLength(max)])];
const str = (min?: number, max?: number) => z.string().check(...sized(min, max));
const some = <T extends z.ZodMiniType>(of: T, min?: number, max?: number) => z.array(of).check(...sized(min, max));

const name = (what: string) => z.string().check(z.regex(NAME, `${what} names are lower-case words joined by hyphens, like "booked-vendor"`));
/**
 * A RELATION'S NAME may be kebab-case or one camelCase word. camelCase is
 * recommended: a rule can then walk it bare (`tendedBy.name`), where
 * `tended-by.name` would read as a subtraction.
 */
export const EDGE_NAME = /^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][A-Za-z0-9]*)$/;
const edgeName = z.string().check(z.regex(EDGE_NAME, 'relation names are one camelCase word, like "tendedBy"'));
const fieldName = z
  .string()
  .check(
    z.regex(FIELD_NAME, 'field names are one word or camelCase, like "dueDate" — rules say them bare'),
    z.refine((n: string) => !RESERVED_FIELDS.has(n), 'a field cannot be called "id" or "kind" — the framework keeps those; try "type" or "category"'),
  );
const sentence = str(1, 500);
const expression = str(1, 2000);
const template = str(1, 300);

export const FIELD_TYPES = ["string", "text", "number", "integer", "boolean", "date", "datetime", "enum", "list", "url", "email"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FieldSpec = z
  .strictObject({
    type: z.enum(FIELD_TYPES),
    required: z.optional(z.boolean()),
    description: z.optional(sentence),
    /** What the field is called on screen, where its name does not say it. */
    label: z.optional(str(1, 60)),
    options: z.optional(some(str(1, 80), 1, 100)),
    of: z.optional(z.enum(["string", "number", "date"])),
    default: z.optional(z.unknown()),
    unit: z.optional(str(undefined, 12)),
    format: z.optional(z.enum(["money", "percent", "duration"])),
    /** The name this field had in the previous version: its values move instead of being dropped. */
    renamedFrom: z.optional(z.string().check(z.regex(FIELD_NAME))),
  })
  .check(
    z.superRefine((f, ctx) => {
      if (f.type === "enum" && !f.options) ctx.addIssue({ code: "custom", message: 'an enum field lists its "options"', path: ["options"] });
      if (f.type !== "enum" && f.options) ctx.addIssue({ code: "custom", message: '"options" belongs only on an enum field', path: ["options"] });
      if (f.type !== "list" && f.of) ctx.addIssue({ code: "custom", message: '"of" belongs only on a list field', path: ["of"] });
    }),
  );
export type FieldSpec = z.infer<typeof FieldSpec>;

export const EdgeSpec = z.strictObject({
  to: z.union([some(name("kind"), 1), z.literal("*")]),
  cardinality: z.optional(z.enum(["one", "many"])),
  description: z.optional(sentence),
  inverse: z.optional(str(1, 80)),
  appendOnly: z.optional(z.boolean()),
  /** The name this relation had in the previous version: its links move. */
  renamedFrom: z.optional(z.string()),
});
export type EdgeSpec = z.infer<typeof EdgeSpec>;

/** A computed field: its expression, or the expression with the words it is shown by (FR-83). */
export const ComputedSpec = z.union([expression, z.strictObject({ expr: expression, label: z.optional(str(1, 60)), description: z.optional(sentence) })]);
export type ComputedSpec = z.infer<typeof ComputedSpec>;

export const KindSpec = z.strictObject({
  noun: z.optional(str(1, 40)),
  plural: z.optional(str(1, 40)),
  description: z.optional(sentence),
  fields: z.record(fieldName, FieldSpec).check(z.refine((f: Record<string, unknown>) => Object.keys(f).length > 0, "a kind has at least one field")),
  label: z.optional(template),
  describe: z.optional(template),
  lifecycle: z.optional(z.strictObject({ field: fieldName, retired: some(z.union([z.string(), z.number(), z.boolean()]), 1) })),
  figure: z.optional(str(undefined, 20_000)),
  /** What a glance at one says — a card, a row, a hit in Find — first, in this order: the definition's `display.glance` (FR-39). */
  glance: z.optional(some(fieldName, 1, 20)),
  edges: z.optional(z.record(edgeName, EdgeSpec)),
  /**
   * Values worked out, not stored (FR-83): a name and a rule-language
   * expression read like a field — `"net": "sum(out('includes'), list * units)"` —
   * or `{ expr, label?, description? }`. Never written by an act.
   */
  computed: z.optional(z.record(z.string(), ComputedSpec).check(z.refine((c: Record<string, unknown>) => Object.keys(c).length <= 20, "a kind works out at most 20 computed fields"))),
  /** The name this kind had in the previous version: its records move. */
  renamedFrom: z.optional(z.string().check(z.regex(NAME))),
});
export type KindSpec = z.infer<typeof KindSpec>;

/** A value an effect writes: a literal, `$arg`, `$subject`, `$new`, `$now`, `$today`, or `{ expr }`. */
export const ValueSpec = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.strictObject({ expr: expression })]);
export type ValueSpec = z.infer<typeof ValueSpec>;

const ref = z.string().check(z.regex(/^\$[A-Za-z][A-Za-z0-9]*$/, 'a reference is "$" and a name, like "$subject" or "$new"'));

export const EffectSpec = z.union([
  z.strictObject({ create: name("kind"), as: z.optional(z.string().check(z.regex(FIELD_NAME))), set: z.optional(z.record(fieldName, ValueSpec)) }),
  z.strictObject({ set: z.record(fieldName, ValueSpec), target: z.optional(ref) }),
  z.strictObject({ connect: edgeName, from: ref, to: ref }),
  z.strictObject({ sever: edgeName, from: ref, to: ref }),
  z.strictObject({ remove: ref }),
]);
export type EffectSpec = z.infer<typeof EffectSpec>;

export const ActSpec = z.strictObject({
  title: z.optional(str(1, 80)),
  description: z.optional(sentence),
  /** How the act reads standing on the far end of the relation it makes or breaks. */
  fromTheOtherEnd: z.optional(str(1, 80)),
  on: z.optional(z.union([name("kind"), some(name("kind"), 1)])),
  creates: z.optional(name("kind")),
  sets: z.optional(z.record(fieldName, ValueSpec)),
  writes: z.optional(some(fieldName, 1)),
  connects: z.optional(edgeName),
  severs: z.optional(edgeName),
  removes: z.optional(z.literal(true)),
  args: z.optional(z.record(fieldName, FieldSpec)),
  effects: z.optional(some(EffectSpec, 1, 20)),
  allowedWhen: z.optional(expression),
  refusal: z.optional(template),
  destructive: z.optional(z.boolean()),
});
export type ActSpec = z.infer<typeof ActSpec>;

export const RepairSpec = z.strictObject({
  act: name("act"),
  label: z.optional(str(1, 80)),
  args: z.optional(z.record(z.string(), ValueSpec)),
});

export const RuleSpec = z.strictObject({
  title: z.optional(str(1, 120)),
  description: z.optional(sentence),
  over: z.union([z.literal("graph"), name("kind")]),
  when: z.optional(expression),
  require: expression,
  says: z.optional(template),
  repairs: z.optional(some(RepairSpec, undefined, 10)),
});
export type RuleSpec = z.infer<typeof RuleSpec>;

export const GrantSpec = z.strictObject({
  roles: z.union([some(name("role"), 1), z.literal("*")]),
  mutations: z.union([some(name("act"), 1), z.literal("*")]),
  kinds: z.optional(z.union([z.array(name("kind")), z.literal("*")])),
  describe: z.optional(sentence),
  self: z.optional(z.boolean()),
});

/**
 * Who sees which kinds — the framework's `Sight`, one meaning (FR-02).
 * Absent: everyone sees everything. Present: a kind no sight names is seen
 * by nobody but the system (a host that gives its owners everything serves
 * them as the system, or names them in a sight).
 */
export const SightSpec = z.strictObject({
  roles: z.union([some(name("role"), 1), z.literal("*")]),
  kinds: some(name("kind"), 1),
  /** Only the principal's own records: the ones they made, their own record, and what an edge joins to it. */
  own: z.optional(z.boolean()),
});
export type SightSpec = z.infer<typeof SightSpec>;

export const PolicySpec = z.strictObject({
  grants: z.array(GrantSpec),
  sees: z.optional(z.array(SightSpec)),
});
export type PolicySpec = z.infer<typeof PolicySpec>;

export const BrandSpec = z.strictObject({
  accent: z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/, 'an accent is a colour like "#c2577a"')),
  name: z.optional(str(1, 60)),
});

const loose = z.record(z.string(), z.unknown());

/** A kind's view specs: which slots it fills. The blocks are checked in views.ts, sentence by sentence. */
const ViewSpecsSpec = z.strictObject({
  card: z.optional(z.array(z.unknown())),
  row: z.optional(z.array(z.unknown())),
  page: z.optional(z.array(z.unknown())),
});

/**
 * THE ARRANGEMENT (FR-80): the kinds in order, the kinds the home leaves
 * off, the place the app opens on. Loose enough that a document which
 * carried anything else under `pages` before FR-80 — when it was accepted
 * and ignored — still parses; `graview check` says what it cannot honour.
 */
export const PagesSpec = z.looseObject({
  order: z.optional(z.array(z.string())),
  hide: z.optional(z.array(z.string())),
  first: z.optional(z.string()),
});

export const DocumentSpec = z.strictObject({
  format: z.literal(FORMAT),
  formatVersion: z.literal(FORMAT_VERSION),
  name: str(1, 80),
  description: z.optional(sentence),
  version: z.optional(z.number().check(z.int(), z.minimum(1))),
  kinds: z
    .record(name("kind"), KindSpec)
    .check(
      z.refine((k: Record<string, unknown>) => Object.keys(k).length > 0, "a document declares at least one kind"),
      z.refine((k: Record<string, unknown>) => Object.keys(k).length <= 40, "a document declares at most 40 kinds"),
    ),
  acts: z.optional(z.record(name("act"), ActSpec)),
  rules: z.optional(z.record(name("rule"), RuleSpec)),
  roles: z.optional(z.array(name("role"))),
  policy: z.optional(PolicySpec),
  modules: z.optional(loose),
  lenses: z.optional(z.array(loose)),
  pages: z.optional(PagesSpec),
  views: z.optional(z.record(z.string(), ViewSpecsSpec)),
  brand: z.optional(BrandSpec),
  settings: z.optional(z.array(loose)),
  migrations: z.optional(z.array(loose)),
});
export type GraviewDocument = z.infer<typeof DocumentSpec>;
