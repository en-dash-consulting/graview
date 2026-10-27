import { documentOf } from "../../document/to-document.js";
import { fieldsWrittenBy, subjectKindsOf } from "../../mutations/derive-edits.js";
import { collaborativeFieldOf } from "../../schema/collaborative-of.js";
import { defOf } from "../../schema/zod.js";
import type { AnyNodeDefinition } from "../../schema/types.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/*
 * AN ACT TYPING RIDES THAT CANNOT BE ASKED FAITHFULLY.
 *
 * A keystroke into a field typed together rides an act that writes the
 * field, and only where that act would run on the record now
 * (`wouldRun`): its `allowedOn` where it says one, else its `apply`, run
 * on the record with its subject and the field's own value and nothing
 * else. A TypeScript act that needs another argument is run without it, so
 * a rule in its `apply` that reads that argument, or that refuses its
 * absence first as `invalid`, is never reached — and the act lends typing
 * on a record it would refuse. Seen without running anything: whether the
 * act is a TypeScript one (not a document's act, not derived), whether it
 * declares `allowedOn`, and which arguments its input requires. A warning:
 * an act whose rule is only about the record is asked rightly as it is.
 */
export function checkTypingAsks<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, declaredMutations, add } = ctx;
  const schema = app.schema as AnySchema;
  const documentActs = (documentOf(app)?.acts ?? {}) as Record<string, unknown>;
  for (const mutation of declaredMutations) {
    const subject = mutation.subject;
    if (!subject || mutation.allowedOn || mutation.derived || Object.prototype.hasOwnProperty.call(documentActs, mutation.name)) continue;
    const shape = (mutation.input as { shape?: Record<string, unknown> }).shape ?? {};
    for (const kind of subjectKindsOf(schema, mutation as never)) {
      const definition = schema.tryDefinition(kind) as AnyNodeDefinition | undefined;
      if (!definition) continue;
      for (const field of fieldsWrittenBy(mutation as never, definition)) {
        if (!collaborativeFieldOf(schema, kind, field)) continue;
        const needs = Object.keys(shape).filter((arg) => arg !== subject.arg && arg !== field && !optional(shape[arg]));
        if (needs.length === 0) continue;
        const said = needs.map((arg) => `"${arg}"`).join(", ");
        add({
          severity: "warning",
          code: "typing-act-without-allowed-on",
          where: mutation.name,
          message: `"${mutation.name}" writes ${kind}'s ${field}, which is typed together, and needs ${said}, which a keystroke never gives it: typing is judged by running it on the record without ${needs.length === 1 ? "it" : "them"}, so a rule in its apply that reads ${needs.length === 1 ? "it" : "them"} is not asked, and the act lends typing on a record it would refuse.`,
          fix: `Declare allowedOn on "${mutation.name}": its rule about the record, judged without its other arguments.`,
        });
      }
    }
  }
}

/** Whether an argument may be left out. */
function optional(schema: unknown): boolean {
  const type = defOf(schema)?.type;
  return type === "optional" || type === "default" || type === "nullable";
}
