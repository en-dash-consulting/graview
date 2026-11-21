import { documentOf } from "../../document/to-document.js";
import { TOUCHED_FIELDS } from "../../graph/touched.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/*
 * WHEN A RECORD WAS MADE AND LAST TOUCHED IS THE FRAMEWORK'S (Graview HQ
 * feature:f-record-last-touched). Every record keeps `createdAt`,
 * `createdBy`, `updatedAt` and `updatedBy`, written by every op that touches
 * it and by no act; a field, relation or computed value of one of those
 * names would be a second thing under one name, and the record could hold
 * only one of them. An error, as a field and a relation of one name is.
 * A document is judged where it is compiled (`touched-field-taken` there).
 */
export function checkTouchedNames<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (documentOf(app)) return;
  const schema = app.schema as AnySchema;
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as { readonly fields?: { readonly shape?: Readonly<Record<string, unknown>> }; readonly edges?: Readonly<Record<string, unknown>>; readonly computed?: Readonly<Record<string, unknown>> } | undefined;
    for (const [part, names] of [
      ["fields", Object.keys(definition?.fields?.shape ?? {})],
      ["edges", Object.keys(definition?.edges ?? {})],
      ["computed", Object.keys(definition?.computed ?? {})],
    ] as const) {
      for (const name of names.filter((one) => TOUCHED_FIELDS.includes(one))) {
        add({ severity: "error", code: "touched-field-taken", where: `defineNode("${kind}").${part}.${name}`, message: touchedTakenSaid(kind, name), fix: touchedTakenFix(name) });
      }
    }
  }
}

/** Why a kind may not declare one of the four, in a sentence. */
export const touchedTakenSaid = (kind: string, name: string): string =>
  `${kind} declares "${name}", which every record already keeps: when it was made and last touched, and by whom (createdAt, createdBy, updatedAt, updatedBy), written by the framework as each change lands.`;

/** What to do instead. */
export const touchedTakenFix = (name: string): string => `Read the record's own ${name} wherever a field is read, and take the declared one out, or give it another name if it means something else.`;
