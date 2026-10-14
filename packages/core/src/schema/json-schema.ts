import { ARCHIVED, LEFT_ALONE } from "../graph/archived.js";
import * as z from "./zod.js";
import { argumentsTaken, takesAnId } from "../mutations/define-mutation.js";
import { nodeRefArgs } from "../mutations/node-ref.js";
import { isAppLinkField } from "./app-link.js";
import { EVERY, isRepeatField, WEEKDAYS } from "../repeat.js";
import { isMarkdownField } from "./markdown.js";
import { typedFieldOf } from "./typed-field-of.js";
import { amountOf } from "./amount-mark.js";
import { amountMark, amountSentence } from "./amount-words.js";
import type { AnySchema } from "./schema.js";
import { writeJsonSchema, type JsonSchema } from "./to-json-schema.js";
import type { AnyNodeDefinition } from "./types.js";

export type { JsonSchema };

/**
 * One source, three outputs: the same Zod declaration produces runtime
 * validation, TypeScript inference, and the JSON Schema an agent tool
 * definition needs. Nothing is written twice, so nothing drifts.
 */
export function toJsonSchema(schema: unknown): JsonSchema {
  return writeJsonSchema(schema, formatsByName);
}

/** zod's names for string formats that JSON Schema calls something else; the rest are the same word. */
const JSON_SCHEMA_FORMATS: Readonly<Record<string, string>> = { guid: "uuid", url: "uri", datetime: "date-time", json_string: "json-string" };

/** What a phone, a place and a duration hold, for an agent, where the field says nothing of itself. */
const TYPED_WORDS = {
  phone: "A phone number as it is written, like +1 555 123 4567 or 020 7946 0958 ext. 12.",
  place: "An address or a place's name, as a person would search a map for it.",
  duration: "A length of time in whole minutes: 90 is 1 h 30 min.",
} as const;

type ZodStringDef = { readonly type?: string; readonly format?: string; readonly checks?: readonly { readonly _zod?: { readonly def?: { readonly format?: string; readonly pattern?: RegExp } } }[] };

/*
 * A FORMAT IS SAID BY ITS NAME (a tool schema is a stability surface). zod
 * writes its own regex for `z.email()`, `z.uuid()`, `z.iso.datetime()` beside
 * the format, and that regex changes between zod's minor versions — so the
 * tools an app offers moved with the version a consumer happened to resolve.
 * A string format says `format` and nothing else; a pattern the author wrote
 * with `.regex(…)` is the author's, and is kept.
 */
export function formatsByName(ctx: { readonly zodSchema: unknown; readonly jsonSchema: JsonSchema }): void {
  // Another app's address (FR-171), beside its pattern: an agent sets an address, not a name.
  if (isAppLinkField(ctx.zodSchema)) ctx.jsonSchema["x-graview-app-link"] = true;
  // How a date repeats, kept beside it as `<date>Repeat`: written out where a declaration checks it by a function of its own.
  if (isRepeatField(ctx.zodSchema)) {
    ctx.jsonSchema["x-graview-repeat"] = true;
    if (!ctx.jsonSchema["type"] && !ctx.jsonSchema["anyOf"] && !ctx.jsonSchema["oneOf"]) Object.assign(ctx.jsonSchema, repeatJson());
  }
  // Prose in Markdown (FR-180): a caller writes Markdown, and it is kept as written.
  if (isMarkdownField(ctx.zodSchema)) {
    ctx.jsonSchema["contentMediaType"] = "text/markdown";
    // Said in words too: not every tool caller reads `contentMediaType`.
    const said = ctx.jsonSchema["description"];
    if (!(typeof said === "string" && said.endsWith("Written in Markdown."))) ctx.jsonSchema["description"] = `${typeof said === "string" && said ? `${said.replace(/\.?$/, ".")} ` : ""}Written in Markdown.`;
  }
  /*
   * A PHONE, A PLACE OR A DURATION says which (`x-graview-type`), so an agent
   * sends the shape the field keeps: a phone as it is written, a place as an
   * address or a name, and a duration as WHOLE MINUTES — 90, never "1h 30m".
   * Where the field says nothing of itself, its description says the same.
   */
  const typed = typedFieldOf(ctx.zodSchema);
  if (typed) {
    const js = ctx.jsonSchema;
    js["x-graview-type"] = typed;
    if (typed === "duration") js["x-graview-unit"] = "minutes";
    js["description"] ??= TYPED_WORDS[typed];
  }
  // An amount says what it is (money in USD, a percent as a fraction), so a model sets 10000, never "$10,000" or 15 for 15%.
  const marked = amountOf(ctx.zodSchema, false);
  if (marked) {
    const amount = amountMark(marked);
    ctx.jsonSchema["x-graview-format"] = amount.format ?? "unit";
    if (amount.currency) ctx.jsonSchema["x-graview-currency"] = amount.currency;
    if (amount.unit && amount.format !== "money") ctx.jsonSchema["x-graview-unit"] = amount.unit;
    const said = ctx.jsonSchema["description"];
    ctx.jsonSchema["description"] = typeof said === "string" && said.length > 0 ? `${said} ${amountSentence(amount)}` : amountSentence(amount);
  }
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
  const js = toJsonSchema(
    z.extend(definition.fields as unknown as z.ZodMiniObject, {
      id: z.string().check(z.minLength(1)),
      kind: z.literal(definition.kind),
    }),
  );
  // The kind that stands for the people says so (Roadmap f-people-kind): a record's id is a member's principal id.
  if (definition.people) js["x-graview-people"] = true;
  // A stored record may be archived (FR-173): the framework's mark, never a declared field.
  const properties = js["properties"] as Record<string, JsonSchema> | undefined;
  if (properties) properties[ARCHIVED] = { type: "boolean", const: true, description: "Set when the record is archived: kept with its links and history, out of lists, counts and rules." };
  // And a person may have said to leave it alone: no automated author changes it.
  if (properties) properties[LEFT_ALONE] = { type: "boolean", const: true, description: "Set when a person said to leave the record alone: no automated author changes it." };
  return js;
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
  // An act refuses an argument it does not take (FR-121), and its tool says so.
  if (argumentsTaken(mutation)) base["additionalProperties"] = false;
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

/** How a date repeats, as JSON Schema: what `repeatSchema` checks, said for an agent. */
function repeatJson(): JsonSchema {
  const day = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
  const int = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
  return {
    type: "object",
    description: 'How the date beside it repeats; the date is the first occurrence. "on" is weekdays for "week", days of the month (-1 the last) for "month".',
    properties: {
      every: { type: "string", enum: [...EVERY] },
      interval: int(1, 99),
      on: { type: "array", minItems: 1, maxItems: 31, items: { anyOf: [{ type: "string", enum: [...WEEKDAYS] }, int(-1, 31)] } },
      until: day,
      count: int(1, 1000),
      except: { type: "array", maxItems: 500, items: day },
      continues: { type: "string", maxLength: 200 },
    },
    required: ["every"],
    additionalProperties: false,
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
