import * as z from "../schema/zod.js";
import { DocumentSpec, FieldSpec, KindSpec } from "../document/schema.js";

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
 */

/** Where a version's schema is served: the published tarball's own file. */
export const documentSchemaUrl = (version: string) => `https://unpkg.com/@graview/core@${version}/dist/document.schema.json`;

/** A name every object already answers to: no field or relation may be called one. */
const INHERITED = Object.getOwnPropertyNames(Object.prototype);

type Json = Record<string, unknown>;
const at = (schema: Json, ...path: string[]): Json => path.reduce<Json>((node, key) => (node[key] ?? {}) as Json, schema);

export function documentJsonSchema(version: string): Json {
  const schema = z.toJSONSchema(DocumentSpec, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      const json = jsonSchema as Json;
      if (zodSchema === (DocumentSpec as unknown)) Object.assign(at(json, "properties", "kinds"), { minProperties: 1, maxProperties: 40 });
      if (zodSchema === (KindSpec as unknown)) {
        Object.assign(at(json, "properties", "fields"), { minProperties: 1 });
        Object.assign(at(json, "properties", "fields", "propertyNames"), { not: { enum: ["id", "kind", ...INHERITED] } });
        Object.assign(at(json, "properties", "edges", "propertyNames"), { not: { enum: INHERITED } });
        Object.assign(at(json, "properties", "computed"), { maxProperties: 20 });
      }
      if (zodSchema === (FieldSpec as unknown)) {
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
  return {
    $schema,
    $id: documentSchemaUrl(version),
    title: `Graview declaration document, format ${String(at(rest, "properties", "formatVersion")["const"])} (@graview/core ${version})`,
    description:
      'A whole Graview app as one JSON object: its kinds, fields, relations, acts, rules, roles, views and brand. `graview check --document <file>` compiles it and says what is wrong in words; this schema is the same shape, for an editor. Name it in a document\'s "$schema".',
    ...rest,
  };
}
