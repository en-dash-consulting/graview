import * as z from "../schema/zod.js";
import { ConnectionSpec } from "../document/connection-spec.js";
import { PurposeSpec } from "../document/purpose-spec.js";
import { DocumentSpec, FieldSpec, KindSpec } from "../document/schema.js";
import { BLOCK_KEYS, FIGURE_EMPHASES, FIGURE_FORMATS, LIST_AS, MAX_LIST_LIMIT, MAX_TEXT_LINES, VIEW_FIELD_FORMATS, VIEW_SLOTS, VIEW_TONES } from "../document/views.js";
import { SHIPPED_LENSES, SHIPPED_LENS_NAMES } from "../places.js";

/*
 * THE DECLARATION DOCUMENT AS JSON SCHEMA, one per version, from the shape
 * the compiler reads (`DocumentSpec`) — never written by hand, so it cannot
 * say a key the compiler refuses or refuse one it reads. The build writes it
 * to `dist/document.schema.json`, `@graview/core/document.schema.json`, and
 * a document that names it in `$schema` is checked in an editor as it is
 * typed: an unknown key is underlined there, not refused at run time.
 *
 * zod says every key, type, pattern, range and closed object itself. What
 * it cannot say is a refinement — a function — so the few the format has
 * are said here again, in JSON Schema's words, and the test that holds this
 * schema to the compiler (`the-document-schema-is-the-compilers`) catches
 * one said wrong.
 *
 * LENSES AND BLOCKS are read by the compiler loosely and judged by the
 * checker afterwards, sentence by sentence, so zod has nothing to say about
 * them and an editor gave no help with a lens's name, its options or a
 * view's blocks. They are said here from the tables the checker judges by:
 * `SHIPPED_LENSES` (each lens's name, roles and options) and `BLOCK_KEYS`
 * (each block and what it may say besides). A lens's name and options are
 * held tighter than the compiler holds them — it warns (`lens-not-shipped`,
 * `lens-option-unknown`) where the editor underlines — because a document
 * can only draw the lenses Graview ships, and the document editor already
 * refuses any other.
 */

/** Where a version's schema is served: the published tarball's own file. */
export const documentSchemaUrl = (version: string) => `https://unpkg.com/@graview/core@${version}/dist/document.schema.json`;

/** The two naming conventions, said together wherever a name is written: the first write met them one at a time. */
export const NAMING =
  'Kinds, acts, rules and roles are kebab-case, like "tool-note"; fields and relations are camelCase, like "supersededBy", so a rule can say them bare. A kind keeps the name it is given, because every record stores it.';

/** A name every object already answers to: no field or relation may be called one. */
const INHERITED = Object.getOwnPropertyNames(Object.prototype);

type Json = Record<string, unknown>;
/** The shape a lazily built one stands for: what the override is handed as it walks the document's shape. */
const built = (lazy: z.ZodMiniLazy): unknown => lazy._zod.innerType;
const at = (schema: Json, ...path: string[]): Json => path.reduce<Json>((node, key) => (node[key] ?? {}) as Json, schema);

export function documentJsonSchema(version: string): Json {
  const [documentSpec, kindSpec, fieldSpec] = [built(DocumentSpec), built(KindSpec), built(FieldSpec)];
  const schema = z.toJSONSchema(documentSpec as z.ZodMiniType, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      const json = jsonSchema as Json;
      if (zodSchema === documentSpec) {
        Object.assign(at(json, "properties", "kinds"), { minProperties: 1, maxProperties: 40, description: `The kinds of record, by name. ${NAMING}` });
        for (const what of ["kinds", "acts", "rules"]) Object.assign(at(json, "properties", what, "propertyNames"), { description: NAMING });
      }
      if (zodSchema === kindSpec) {
        Object.assign(at(json, "properties", "fields"), { minProperties: 1, description: `The kind's fields, by name. ${NAMING}` });
        Object.assign(at(json, "properties", "fields", "propertyNames"), { not: { enum: ["id", "kind", ...INHERITED] }, description: NAMING });
        Object.assign(at(json, "properties", "edges", "propertyNames"), { not: { enum: INHERITED }, description: NAMING });
        Object.assign(at(json, "properties", "edges"), { description: `The kind's relations, by name. ${NAMING}` });
        Object.assign(at(json, "properties", "computed"), { maxProperties: 20 });
      }
      if (zodSchema === fieldSpec) {
        json["allOf"] = [
          // An enum lists its options, and only an enum has them.
          { if: { properties: { type: { const: "enum" } } }, then: { required: ["options"] }, else: { not: { required: ["options"] } } },
          // Only a list says what it is a list `of`.
          { if: { properties: { type: { const: "list" } } }, else: { not: { required: ["of"] } } },
        ];
      }
    },
  }) as Json;
  const { $schema, ...rest } = schema;
  const properties = at(rest, "properties");
  properties["lenses"] = { description: (properties["lenses"] as Json | undefined)?.["description"] ?? LENSES_SAID, type: "array", items: lensSchema() };
  properties["views"] = {
    description: "Each kind's views by kind — its card, row and page, each a list of blocks — and `home`: the home view, a list of blocks about no one record.",
    type: "object",
    additionalProperties: {
      anyOf: [
        { type: "object", properties: Object.fromEntries(VIEW_SLOTS.map((slot) => [slot, blocks(`The blocks a ${slot} draws.`)])), additionalProperties: false },
        blocks("The home view's blocks (under `home`)."),
      ],
    },
  };
  // A connection is read loosely by the compiler and judged by the checker (`connection-findings.ts`): its whole shape, said here for an editor.
  const { $schema: _connection, ...connection } = z.toJSONSchema(built(ConnectionSpec) as z.ZodMiniType, { io: "input", unrepresentable: "any" }) as Json;
  properties["connections"] = {
    description: "Other systems this app is kept in step with, by name: today, Google calendars. `graview serve` and `graview preview` run them, with credentials from the environment; none is ever written here.",
    type: "object",
    propertyNames: at(properties, "connections", "propertyNames"),
    additionalProperties: connection,
  };
  // A purpose likewise (Roadmap f-app-jobs, `purpose-spec.ts`): read loosely by the compiler, judged by the checker, said here whole.
  const { $schema: _purpose, ...purpose } = z.toJSONSchema(built(PurposeSpec) as z.ZodMiniType, { io: "input", unrepresentable: "any" }) as Json;
  properties["purpose"] = {
    ...purpose,
    description: "Who the app is for (`for`), and up to twelve jobs they come to it to do: each a question in their words (`ask`), answered by the records of one kind (`kind`) a rule-language condition holds for (`where`), in an order (`sort`), with the act they usually take next (`act`), for some roles or everybody (`roles`).",
  };
  rest["$defs"] = { ...((rest["$defs"] as Json | undefined) ?? {}), ...blockDefs() };
  return {
    $schema,
    $id: documentSchemaUrl(version),
    title: `Graview declaration document, format ${String(at(rest, "properties", "formatVersion")["const"])} (@graview/core ${version})`,
    description:
      'A whole Graview app as one JSON object: its kinds, fields, relations, acts, rules, roles, views and brand. `graview check --document <file>` compiles it and says what is wrong in words; this schema is the same shape, for an editor. Name it in a document\'s "$schema".',
    ...rest,
  };
}

const LENSES_SAID = "The pictures the app draws beside its lists: each names a lens Graview ships, binds it to the kinds it stands on, and, with a title, is a place of its own.";

const blocks = (description: string): Json => ({ description, type: "array", items: { $ref: "#/$defs/ViewBlock" } });
const expression: Json = { type: "string", minLength: 1, maxLength: 2000, description: "A line of the rule language, like \"status == 'booked'\" or \"count(all('offer'))\"." };
const template: Json = { type: "string", minLength: 1, maxLength: 300, description: 'Words with {field} in braces, like "{name}" or "{quote|money}".' };
const words: Json = { type: "string", minLength: 1 };
const tone: Json = {
  description: `${VIEW_TONES.join(", ")}, or { "expr": … } that works one out.`,
  anyOf: [{ enum: [...VIEW_TONES] }, { type: "object", properties: { expr: expression }, required: ["expr"], additionalProperties: false }],
};

/** What the key that names a block holds: `{"title": "{name}"}`, `{"list": "out('holds')"}`. */
const BLOCK_VALUE: Readonly<Record<string, Json>> = {
  title: template,
  headline: template,
  figure: { description: 'An expression for a number worked out, or true for the kind\'s picture: {"figure": true}.', anyOf: [expression, { const: true }] },
  list: expression,
  text: template,
  badge: template,
  field: { type: "string", description: "A field of the record, drawn as it is declared." },
  image: { type: "string", description: "A field holding pictures." },
  progress: { type: "object", properties: { value: expression, max: expression }, required: ["value", "max"], additionalProperties: false },
  group: blocks("The blocks drawn together."),
  when: expression,
  divider: { const: true },
};

/** What each block may say besides, by block: `BLOCK_KEYS` names them, this says what each holds. */
const BLOCK_OPTIONS: Readonly<Record<string, Readonly<Record<string, Json>>>> = {
  title: {},
  headline: {},
  list: {
    sort: {
      description: 'A key read from each record, lowest first, or { "by": key, "direction": "asc" | "desc" | "choices" }.',
      anyOf: [expression, { type: "object", properties: { by: expression, direction: { enum: ["asc", "desc", "choices"] } }, required: ["by"], additionalProperties: false }],
    },
    limit: { type: "integer", minimum: 1, maximum: MAX_LIST_LIMIT },
    group: {
      description: 'A choice field, or { "by": field, "headings": { choice: words } }.',
      anyOf: [words, { type: "object", properties: { by: words, headings: { type: "object", additionalProperties: { type: "string" } } }, required: ["by"], additionalProperties: false }],
    },
    empty: words,
    as: { enum: [...LIST_AS] },
  },
  text: { tone, lines: { type: "integer", minimum: 0, maximum: MAX_TEXT_LINES, description: "How many lines a card or a row shows before the text is cut short; 0 shows it whole." } },
  badge: { tone },
  field: { as: { enum: [...VIEW_FIELD_FORMATS] }, currency: words, label: words },
  image: { as: { enum: ["thumb", "gallery"] }, label: words },
  progress: { label: words },
  group: { direction: { enum: ["row", "column"] } },
  when: { show: blocks("The blocks shown while the expression holds.") },
  divider: {},
  figure: { as: { enum: [...FIGURE_FORMATS] }, currency: words, label: words, emphasis: { enum: [...FIGURE_EMPHASES] } },
};

/**
 * A view's block, one shape per block the checker knows. Built from
 * `BLOCK_KEYS`, so a block or a key added there and not said here stops the
 * build rather than going untyped.
 */
function blockDefs(): Json {
  const shapes = Object.entries(BLOCK_KEYS).map(([block, keys]) => {
    const value = BLOCK_VALUE[block];
    const options = BLOCK_OPTIONS[block];
    if (!value || !options) throw new Error(`document-schema: the "${block}" block has no JSON Schema; say it in BLOCK_VALUE and BLOCK_OPTIONS.`);
    for (const key of keys) if (!options[key]) throw new Error(`document-schema: the "${block}" block's "${key}" has no JSON Schema; say it in BLOCK_OPTIONS.`);
    return {
      type: "object",
      properties: { [block]: value, ...Object.fromEntries(keys.map((key) => [key, options[key]!])), key: { type: "string", description: "What a face claims this block by." } },
      required: block === "when" ? ["when", "show"] : [block],
      additionalProperties: false,
    };
  });
  return { ViewBlock: { description: `A block from the closed set every view is written in: ${Object.keys(BLOCK_KEYS).join(", ")}.`, anyOf: shapes } };
}

/** A declared lens: a name from `SHIPPED_LENSES`, and per lens the options it takes and the shape its bindings are. */
function lensSchema(): Json {
  const fieldBindings: Json = {
    description: 'Per kind, each role bound to a field — "start": "due" — or to a field and the values that make it true — { "field": "status", "is": ["done"] }.',
    type: "object",
    additionalProperties: {
      type: "object",
      additionalProperties: { anyOf: [{ type: "string" }, { type: "object", properties: { field: { type: "string" }, is: { type: "array" } }, required: ["field", "is"], additionalProperties: false }] },
    },
  };
  return {
    type: "object",
    required: ["name"],
    properties: {
      name: { description: `Which lens: ${SHIPPED_LENS_NAMES.join(", ")}.`, enum: [...SHIPPED_LENS_NAMES] },
      title: { type: "string", minLength: 1, maxLength: 80, description: "With a title, the lens is a place: a pill on the bar and a page of its own." },
      on: { type: "string", description: "The kind it is a place over, when its bindings do not say." },
      options: { type: "object" },
      bindings: { type: "object" },
      binds: { enum: ["fields", "entities"] },
      requiredRoles: { type: "array", items: { type: "string" } },
      provenBy: { type: "string" },
      arrangedBy: { description: "What the picture opens arranged by, in the arrangement grammar." },
      hidden: { type: "boolean", description: "Kept off the lists: reached by its address, a link or navigate." },
      create: { type: "boolean" },
    },
    additionalProperties: false,
    allOf: SHIPPED_LENS_NAMES.map((name) => {
      const lens = SHIPPED_LENSES[name];
      const options: Json = {
        description: lens.options.length > 0 ? `What the ${name} lens takes besides its roles: ${lens.options.join(", ")}.` : `The ${name} lens takes no options.`,
        type: "object",
        properties: Object.fromEntries((lens.options as readonly string[]).map((option) => [option, option === "blocks" ? blocks("The blocks the lens draws, about no one record.") : {}])),
        additionalProperties: false,
      };
      const roles = lens.requiredRoles.length > 0 ? ` It binds ${lens.requiredRoles.join(", ")}.` : "";
      return {
        if: { properties: { name: { const: name } }, required: ["name"] },
        then: { properties: { options, ...(lens.binds === "fields" ? { bindings: { ...fieldBindings, description: `${String(fieldBindings["description"])}${roles}` } } : {}) } },
      };
    }),
  };
}
