import { citedFieldsOf } from "../../schema/cites.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/*
 * A CITED FIELD NAMES WHAT CITES IT (Roadmap f-field-cites-marker). A
 * field's `cites` names a field or a relation of the same kind, which holds
 * where its value came from. One that names nothing the kind declares, or
 * the field itself, cites nothing a record could fill: every value would
 * read as uncited. An error, since the declaration says something the app
 * cannot do.
 */
export function checkCites<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  const schema = app.schema as AnySchema;
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as { readonly fields?: { readonly shape?: Readonly<Record<string, unknown>> }; readonly edges?: Readonly<Record<string, unknown>> } | undefined;
    const fields = Object.keys(definition?.fields?.shape ?? {});
    const relations = Object.keys(definition?.edges ?? {});
    for (const [field, cites] of Object.entries(citedFieldsOf(schema, kind))) {
      const where = `defineNode("${kind}").fields.${field}`;
      if (cites === field) {
        add({ severity: "error", code: "field-cites", where, message: `${kind}'s ${field} says it is cited by itself, so its value is its own citation and nothing says where it came from.`, fix: `Name the field or relation of ${kind} that holds where ${field} came from, like "source", or leave "cites" out.` });
      } else if (!fields.includes(cites) && !relations.includes(cites)) {
        const could = [...fields.filter((one) => one !== field), ...relations];
        add({
          severity: "error",
          code: "field-cites",
          where,
          message: `${kind}'s ${field} is cited by "${cites}", which is no field or relation of ${kind}, so no record could cite it.`,
          fix: could.length > 0 ? `Name one of ${kind}'s fields or relations (${could.map((one) => `"${one}"`).join(", ")}), or declare a "${cites}" field to hold the citation.` : `Declare a "${cites}" field or relation on ${kind} to hold the citation, or leave "cites" out.`,
        });
      }
    }
  }
}
