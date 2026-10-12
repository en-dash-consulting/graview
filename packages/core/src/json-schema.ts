/**
 * `@graview/core/json-schema` — A KIND'S JSON SCHEMA AND AN ACT'S TOOL
 * SCHEMA, derived from the declaration by the seat's tools and the CLI.
 *
 * Its own entry because a bundler places a whole module in every chunk that
 * can reach it: exported from `@graview/core`, the writer rode in every
 * hosted page's first load, though no page derives a tool schema before a
 * seat is asked something (FR-165 paid for itself with it).
 */
export { mutationToolSchema, nodeJsonSchema, schemaJson, toJsonSchema } from "./schema/json-schema.js";
export type { JsonSchema, MutationToolSchema } from "./schema/json-schema.js";
