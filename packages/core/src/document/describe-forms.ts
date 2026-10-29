import { askedFormFields, type FormField } from "../mutations/form.js";
import { keptArguments } from "../mutations/kept-arguments.js";
import { argumentWords } from "../mutations/words.js";
import type { AnyMutationDefinition } from "../mutations/types.js";
import type { Principal } from "../permissions/types.js";
import { actTitle, humanizeField, humanizeValue, nounOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import type { VisitorForm } from "../mutations/visitor-form.js";
import type { DescribedForm, DescribedFormField } from "./described.js";

/*
 * A FORM, IN WORDS (`describe_place`). An agent that declared "Add a threat"
 * could not see what it asks: which fields, in what order, which must be
 * answered, a box or a choice and of what. Said here from the same walk
 * every face's form is drawn from (`formFields`), labeled in the words the
 * form says (`argumentWords`), and without the arguments the seat's sight
 * keeps from it (`keptArguments`) — so what is said is what is asked.
 */

type Words = ReturnType<typeof argumentWords>;

function described(schema: AnySchema, field: FormField, words: (name: string) => Words): DescribedFormField {
  // A box is always answered — unticked is a no — so it is never one that must be, as the form draws it.
  const required = !(field.optional || field.control === "boolean");
  // A picker is labeled by what it picks, as the form labels it: "Threat", not "Threat id".
  const label =
    field.control === "node" && !field.kinds.includes("*") ? field.kinds.map((kind) => humanizeField(nounOf(schema.tryDefinition(kind), kind))).join(" or ") : words(field.name).label;
  const base = { name: field.name, label, required };
  switch (field.control) {
    case "text":
      return { ...base, input: field.holds === "duration" ? "length of time" : field.holds ?? (field.markdown ? "Markdown text" : field.long ? "long text" : field.app ? "app address" : "text") };
    case "date":
      return { ...base, input: field.time || field.instant ? "date and time" : "date" };
    case "number":
      return { ...base, input: field.amount ? "amount" : "number", ...(field.min === undefined ? {} : { min: field.min }), ...(field.max === undefined ? {} : { max: field.max }) };
    case "choice":
      return { ...base, input: "choice", choices: (field.options ?? []).map((value) => words(field.name).option(value)) };
    case "boolean":
      return { ...base, input: "yes or no" };
    case "node":
      return { ...base, input: "record", kinds: field.kinds };
    case "linked":
      return { ...base, input: "record in another app" };
    case "file":
      return { ...base, input: field.image ? "picture" : field.video ? "video" : "file" };
    case "repeat":
      return { ...base, input: "how it repeats" };
    case "list":
      return { ...base, input: `list of ${described(schema, field.item, words).input}` };
    case "group":
      return { ...base, input: "group", fields: field.fields.map((one) => described(schema, one, words)) };
    case "variant":
      return { ...base, input: "one of", choices: field.options.map((option) => humanizeValue(option.value)) };
    default:
      return { ...base, input: "answer" };
  }
}

/** An act's form as the seat is asked it: its fields in order, less what the seat's sight keeps from it. */
export function describeActForm<S extends AnySchema>(store: Store<S>, principal: Principal, act: AnyMutationDefinition<S>): DescribedForm {
  const kept = keptArguments(store, principal, act);
  const schema = store.schema as AnySchema;
  const fields = askedFormFields(schema, act).filter((field) => field.name !== act.subject?.arg && !kept.has(field.name));
  const title = actTitle(act);
  return { act: act.name, title, submit: title, fields: fields.map((field) => described(schema, field, (name) => argumentWords(schema, act as never, name))) };
}

/** What a visitor's form (`forms.<name>`) asks, as `visitorForm` resolved it. */
export function describeVisitorForm(schema: AnySchema, form: VisitorForm): DescribedForm {
  return {
    act: form.act.name,
    title: form.title,
    submit: form.submit,
    visitor: form.name,
    fields: form.fields.map((field) => described(schema, field, (name) => argumentWords(schema, form.act as never, name))),
  };
}

/** The acts that make a kind's records, offered where its records are listed: this seat's, about no record already there. */
export function creatingActs<S extends AnySchema>(store: Store<S>, principal: Principal, kind: string): readonly AnyMutationDefinition<S>[] {
  return store.permittedMutations(principal).filter((act) => !act.derived && !act.subject && (act.creates ?? []).includes(kind as never));
}

/** A form as lines: its title, then each field — its label, a star when it must be answered, what it takes. */
export function formLines(form: DescribedForm, indent = ""): string[] {
  const lines = [`${indent}Form "${form.title}" (${form.visitor ? `the visitor form ${form.visitor}, running ` : ""}act ${form.act}), button "${form.submit}":`];
  const walk = (fields: readonly DescribedFormField[], at: string) => {
    for (const field of fields) {
      const takes = field.choices ? `${field.input}: ${field.choices.join(", ")}` : field.kinds ? `${field.input} (${field.kinds.join(" or ")})` : field.input;
      const range = field.min !== undefined || field.max !== undefined ? `, ${field.min ?? "…"} to ${field.max ?? "…"}` : "";
      lines.push(`${at}- ${field.label}${field.required ? " *" : ""} (${field.name}) — ${takes}${range}`);
      if (field.fields) walk(field.fields, `${at}  `);
    }
  };
  walk(form.fields, `${indent}  `);
  if (form.fields.length === 0) lines.push(`${indent}  (asks nothing)`);
  return lines;
}
