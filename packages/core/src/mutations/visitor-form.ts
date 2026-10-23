import type { GraviewApp } from "../app.js";
import { grantsTo } from "../permissions/policy.js";
import type { Policy, Principal } from "../permissions/types.js";
import { humanizeField } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import { VISITOR_ROLE, type VisitorFormDeclaration } from "../visitor-form-shape.js";
import { askedFormFields, type FormField } from "./form.js";
import { argumentsNeverShown } from "./kept-arguments.js";
import type { AnyMutationDefinition } from "./types.js";

/**
 * A FORM FOR A VISITOR, RESOLVED (Roadmap f-public-forms): the declaration's
 * `forms.<name>` read against the app — the act it runs, the fields it asks
 * in the order it names them, and the words around them — or undefined
 * where the app declares no such form or its act is not one of its own.
 */
export interface VisitorForm<S extends AnySchema = AnySchema> {
  readonly name: string;
  readonly title: string;
  readonly intro?: string;
  /** What the visitor is told once the answer is received, when the declaration says. */
  readonly say?: string;
  readonly submit: string;
  readonly role: string;
  readonly act: AnyMutationDefinition<S>;
  /** The arguments asked, in order. */
  readonly fields: readonly FormField[];
}

/** The form's title: its own, or its name in words, an abbreviation kept as it is spelled ("RSVP" from `rsvp` only when said). */
const titleOf = (name: string, form: VisitorFormDeclaration) => form.title ?? humanizeField(name);

/**
 * WHETHER A VISITOR IS SERVED EVERY RECORD OF A KIND — by a sight that is
 * not only their own (`own`, `via`): the records a picker could offer
 * them. Without a policy, or one that says nothing of who sees what, every
 * kind is served to everybody.
 */
export function visitorSeesKind(policy: Policy | undefined, visitor: Principal, kind: string): boolean {
  const sights = policy?.sees;
  if (!sights || sights.length === 0) return true;
  return sights.some((sight) => sight.kinds.includes(kind) && grantsTo(sight, visitor) && !sight.own && !sight.via);
}

/** The pickers in a form field, nested groups, variants and lists walked. */
export function pickersIn(field: FormField): readonly (FormField & { readonly control: "node" })[] {
  switch (field.control) {
    case "node":
      return [field];
    case "group":
      return field.fields.flatMap(pickersIn);
    case "variant":
      return field.options.flatMap((option) => option.fields.flatMap(pickersIn));
    case "list":
      return pickersIn(field.item);
    default:
      return [];
  }
}

/**
 * WHETHER A VISITOR COULD ANSWER ONE ARGUMENT: a picker only over kinds
 * they are served, and a field their sight shows them.
 */
function fillable(policy: Policy | undefined, visitor: Principal, field: FormField, never: ReadonlySet<string>): boolean {
  if (never.has(field.name)) return false;
  return pickersIn(field).every((picker) => picker.kinds.some((kind) => kind !== "*" && visitorSeesKind(policy, visitor, kind)));
}

/** The visitor a form is judged for, before any is minted. */
const judgedVisitor = (role: string): Principal => ({ kind: "human", id: "form:", roles: [role] });

export function visitorForm<S extends AnySchema>(app: GraviewApp<S>, name: string, mutations: readonly AnyMutationDefinition<S>[] = app.mutations ?? []): VisitorForm<S> | undefined {
  const form = app.forms?.[name];
  if (!form) return undefined;
  const act = mutations.find((mutation) => mutation.name === form.act);
  if (!act) return undefined;
  const role = form.role ?? VISITOR_ROLE;
  const visitor = judgedVisitor(role);
  const never = argumentsNeverShown(app.schema, app.policy, visitor, act);
  const all = askedFormFields(app.schema, act);
  // Named, in the order named; unsaid, every argument a visitor could answer, in the order every form asks.
  const fields = form.fields ? form.fields.flatMap((field) => all.find((one) => one.name === field) ?? []) : all.filter((field) => fillable(app.policy, visitor, field, never));
  return {
    name,
    title: titleOf(name, form),
    ...(form.intro ? { intro: form.intro } : {}),
    ...(form.say ? { say: form.say } : {}),
    submit: form.submit ?? act.title ?? humanizeField(act.name),
    role,
    act,
    fields,
  };
}

/**
 * THE VISITOR A HOST MINTS FOR ONE SUBMISSION: a person with the form's
 * role and nothing else, under the id the host chose (`form:<token>`), and
 * named for the form — so Activity says "a visitor via the RSVP form" and
 * never the token. Hand the same principal to the page that draws the form
 * and to the store that judges it; a server that believes a seat's headers
 * reads it back from them. Throws where the app declares no such form.
 */
export function formVisitor(app: Pick<GraviewApp, "forms">, name: string, id: string): Principal {
  const form = app.forms?.[name];
  if (!form) throw new Error(`There is no form called "${name}"${app.forms ? `: the forms are ${Object.keys(app.forms).join(", ")}` : ": the app declares none"}.`);
  return { kind: "human", id, name: `a visitor via the ${titleOf(name, form)} form`, roles: [form.role ?? VISITOR_ROLE] };
}

/** What a visitor is told once their answer is received: the declaration's own words after a plain "Received". */
export function formReceived(form: Pick<VisitorForm, "say">): { readonly said: string; readonly next?: string } {
  return { said: "Received — thank you.", ...(form.say ? { next: form.say } : {}) };
}
