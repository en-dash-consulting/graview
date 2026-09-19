import { formFields, type FormField } from "./form.js";

/**
 * WHAT A DECISION PROVIDER COULD NEVER SUPPLY.
 *
 * A decision provider answers in values the declaration already types: a
 * Choice over named options (an enum, a node of some kind), a truth, a
 * Score over an ordered rubric (a bounded number). It has no prose, so an
 * act whose required arguments include free text — or a date, which is
 * neither chosen from a set nor scored — is an act it could not possibly
 * call, whatever the allowlist says. The checker refuses such a provider;
 * a surface deriving questions skips such an act rather than asking one
 * it cannot fill.
 *
 * Optional arguments are not counted: a decision provider leaves them
 * unset, which is what optional means. A variant's tag is a choice; its
 * arms' fields are judged like any other.
 */
export interface UndecidableArgument {
  readonly name: string;
  readonly control: FormField["control"];
}

const walk = (field: FormField, path: string, out: UndecidableArgument[]): void => {
  if (field.optional) return;
  switch (field.control) {
    case "choice":
    case "node":
    case "boolean":
      return;
    case "number":
      // A Score needs an ordered rubric; an unbounded number is not one.
      if (field.min === undefined || field.max === undefined) out.push({ name: path, control: field.control });
      return;
    case "group":
      for (const child of field.fields) walk(child, `${path}.${child.name}`, out);
      return;
    case "variant":
      // The tag is a Choice; every arm must then be decidable for the
      // provider to be able to choose any of them.
      for (const arm of field.options) {
        for (const child of arm.fields) walk(child, `${path}.${child.name}`, out);
      }
      return;
    default:
      // text, date, list, opaque: nothing a typed answer can produce.
      out.push({ name: path, control: field.control });
  }
};

/** The required arguments of an act that no typed answer can fill. */
export function undecidableArguments(mutation: { readonly input?: unknown }): readonly UndecidableArgument[] {
  const out: UndecidableArgument[] = [];
  for (const field of formFields(mutation.input)) walk(field, field.name, out);
  return out;
}
