import { GraphError } from "../graph/graph.js";
import type { AnySchema } from "../schema/schema.js";
import { fieldWords, humanizeField } from "../schema/define-node.js";

/** The parts of a mutation that say which kinds its arguments fill. */
interface Filling {
  readonly name: string;
  readonly creates?: readonly string[];
  readonly subject?: { readonly kinds: readonly string[] | "*"; readonly arg: string };
}

/**
 * AN ARGUMENT ASKED FOR IN THE RECORD'S OWN WORDS.
 *
 * A form walked off a mutation's input named each field by its argument —
 * "Vin", "Body", "Label" — and offered a choice's raw values — "suv",
 * "plug-in-hybrid" — while the record the act makes, one page later, said
 * "VIN", "Body style", "Name", "SUV" and "Plug-in hybrid", because the kind
 * declares them. An argument that fills a field of the kind the act makes
 * or acts on is that field, and is asked for in that field's words.
 */
export function argumentWords(
  schema: AnySchema,
  mutation: Filling | undefined,
  name: string,
): { readonly label: string; readonly option: (value: string) => string } {
  const kinds = [...(mutation?.creates ?? []), ...(mutation?.subject && mutation.subject.kinds !== "*" ? mutation.subject.kinds : [])];
  for (const kind of kinds) {
    const definition = schema.tryDefinition(kind);
    const shape = ((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}) as Record<string, unknown>;
    if (!definition || !(name in shape)) continue;
    const format = definition.display?.format?.[name];
    const declared = definition.display?.labels?.[name];
    return {
      // A kind's `label` is its name: "Label *" is the field's key, not a word for it.
      label: declared ?? (name === "label" ? "Name" : fieldWords(definition, name)),
      option: (value) => (format ? format(value) : humanizeField(value)),
    };
  }
  return { label: name === "label" ? "Name" : humanizeField(name), option: (value) => humanizeField(value) };
}

/** Arguments a mutation refused, each with where it was and what was wrong. */
export class InvalidArguments extends GraphError {
  constructor(
    readonly mutation: string,
    readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
  ) {
    super(
      `Invalid arguments for mutation "${mutation}"`,
      issues.map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`).join("; "),
    );
    this.name = "InvalidArguments";
  }
}

/**
 * WHY A PRESS DID NOT TAKE, in a person's words.
 *
 * Arguments a mutation refused are said field by field, in the words the
 * form asked in: "Email — Invalid email address", never `Invalid arguments
 * for mutation "sign-up" email: Invalid email address`, which named the act
 * by its id and the field by its key to somebody who had only ever seen
 * "Sign up" and "Email". Anything else is the refusal's own sentence.
 */
export function failureWords(
  schema: AnySchema,
  mutations: readonly Filling[],
  error: unknown,
): string {
  if (error instanceof InvalidArguments) {
    const mutation = mutations.find((one) => one.name === error.mutation);
    const said = error.issues.map((issue) => {
      const field = issue.path.length > 0 ? argumentWords(schema, mutation, String(issue.path[0])).label : undefined;
      return field ? `${field} — ${issue.message.replace(/^./, (first) => first.toLowerCase())}` : issue.message;
    });
    return `Not yet: ${said.join("; ")}.`;
  }
  return error instanceof Error ? error.message : String(error);
}
