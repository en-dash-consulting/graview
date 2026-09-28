import { z } from "zod";
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
export function toJsonSchema(schema: z.ZodType): JsonSchema {
  const convert = (z as { toJSONSchema?: (s: z.ZodType, o?: unknown) => JsonSchema })
    .toJSONSchema;
  if (typeof convert !== "function") {
    throw new Error(
      "This Zod build has no toJSONSchema(). Upgrade to zod >= 3.25 / 4.x, " +
        "or pass a JSON Schema explicitly.",
    );
  }
  return convert(schema, { io: "input", unrepresentable: "any" });
}

/** JSON Schema for one node kind, including its id and kind discriminator. */
export function nodeJsonSchema(definition: AnyNodeDefinition): JsonSchema {
  return toJsonSchema(
    definition.fields.extend({
      id: z.string().min(1),
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
  input: z.ZodType;
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
