import * as z from "./zod.js";
import { takesAnId } from "../mutations/define-mutation.js";
import { nodeRefArgs } from "../mutations/node-ref.js";
import type { AnySchema } from "./schema.js";
import type { AnyNodeDefinition } from "./types.js";

export type JsonSchema = Record<string, unknown>;

/**
 * One source, three outputs: the same Zod declaration produces runtime
 * validation, TypeScript inference, and the JSON Schema an agent tool
 * definition needs. Nothing is written twice, so nothing drifts.
 */
export function toJsonSchema(schema: unknown): JsonSchema {
  return z.toJSONSchema(schema as z.ZodMiniType, { io: "input", unrepresentable: "any", override: formatsByName as never }) as JsonSchema;
}

/** zod's names for string formats that JSON Schema calls something else; the rest are the same word. */
const JSON_SCHEMA_FORMATS: Readonly<Record<string, string>> = { guid: "uuid", url: "uri", datetime: "date-time", json_string: "json-string" };

type ZodStringDef = { readonly type?: string; readonly format?: string; readonly checks?: readonly { readonly _zod?: { readonly def?: { readonly format?: string; readonly pattern?: RegExp } } }[] };

/*
 * A FORMAT IS SAID BY ITS NAME (a tool schema is a stability surface). zod
 * writes its own regex for `z.email()`, `z.uuid()`, `z.iso.datetime()` beside
 * the format, and that regex changes between zod's minor versions — so the
 * tools an app offers moved with the version a consumer happened to resolve.
 * A string format says `format` and nothing else; a pattern the author wrote
 * with `.regex(…)` is the author's, and is kept.
 */
function formatsByName(ctx: { readonly zodSchema: unknown; readonly jsonSchema: JsonSchema }): void {
  const def = (ctx.zodSchema as { _zod?: { def?: ZodStringDef } })._zod?.def;
  if (!def || def.type !== "string" || typeof def.format !== "string" || def.format === "regex") return;
  const js = ctx.jsonSchema;
  const authored = (def.checks ?? []).map((check) => check._zod?.def).filter((check) => check?.format === "regex" && check.pattern instanceof RegExp).map((check) => check!.pattern!.source);
  delete js["pattern"];
  const allOf = js["allOf"];
  if (Array.isArray(allOf) && allOf.every((part) => typeof part === "object" && part !== null && Object.keys(part).length === 1 && "pattern" in part)) delete js["allOf"];
  js["format"] = JSON_SCHEMA_FORMATS[def.format] ?? def.format;
  if (authored.length === 1) js["pattern"] = authored[0];
  else if (authored.length > 1) js["allOf"] = authored.map((pattern) => ({ pattern }));
}

/** JSON Schema for one node kind, including its id and kind discriminator. */
export function nodeJsonSchema(definition: AnyNodeDefinition): JsonSchema {
  return toJsonSchema(
    z.extend(definition.fields as unknown as z.ZodMiniObject, {
      id: z.string().check(z.minLength(1)),
      kind: z.literal(definition.kind),
    }),
  );
}

export interface MutationToolSchema {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  /** Arguments that name graph nodes, and the kinds each accepts. */
  readonly nodeRefs: readonly { name: string; kinds: readonly string[]; optional: boolean }[];
}

/**
 * Derives an agent-facing tool schema from a mutation declaration. The
 * `nodeRefs` metadata travels alongside so a caller can resolve "a person"
 * to real ids without the agent guessing.
 */
export function mutationToolSchema(mutation: {
  name: string;
  title?: string;
  description?: string;
  input: unknown;
  creates?: readonly string[];
}): MutationToolSchema {
  const refs = nodeRefArgs(mutation.input);
  const base = toJsonSchema(mutation.input);
  const properties = (base["properties"] ?? {}) as Record<string, JsonSchema>;
  /*
   * THE ID A CALLER MAY BRING. An act that creates takes it beside its own
   * arguments (`compileMutation` lifts it before the input parses), so the
   * tool says so — an agent that will name the node in its next call, or a
   * seed being synced, asks for the id it needs rather than reading one back.
   */
  if (takesAnId(mutation)) {
    const made = mutation.creates!.join(" | ");
    properties["id"] = {
      type: "string",
      minLength: 1,
      description: `Optional: the id for the ${made} this makes. Refused if the graph already has it; left out, one is minted from the label.`,
    };
    base["properties"] = properties;
  }
  for (const ref of refs) {
    const property = properties[ref.name];
    if (!property) continue;
    const kinds = ref.kinds.includes("*") ? "any node kind" : ref.kinds.join(" | ");
    property["description"] = [property["description"], `Id of a node (${kinds}).`]
      .filter(Boolean)
      .join(" ");
  }
  return {
    name: mutation.name,
    ...(mutation.title === undefined ? {} : { title: mutation.title }),
    description: mutation.description ?? mutation.title ?? mutation.name,
    inputSchema: base,
    nodeRefs: refs,
  };
}

/** Every node kind's JSON Schema, keyed by kind. */
export function schemaJson(schema: AnySchema): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const definition of schema.definitions) {
    out[definition.kind] = nodeJsonSchema(definition);
  }
  return out;
}
