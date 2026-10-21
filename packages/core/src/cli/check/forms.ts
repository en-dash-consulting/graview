import { argumentsNeverShown } from "../../mutations/kept-arguments.js";
import { formFields } from "../../mutations/form.js";
import { pickersIn, visitorSeesKind } from "../../mutations/visitor-form.js";
import { grantsTo, permittedMutations } from "../../permissions/policy.js";
import type { Principal } from "../../permissions/types.js";
import type { AnySchema } from "../../schema/schema.js";
import { VISITOR_ROLE } from "../../visitor-form-shape.js";
import type { CheckContext } from "./context.js";

/**
 * A FORM FOR A VISITOR, JUDGED (Roadmap f-public-forms). A visitor is a
 * principal holding the form's role, so everything a form promises is the
 * policy's to keep, and each way it could not is a sentence here before a
 * stranger meets it: an act the role may not run (the form would refuse
 * every answer), a field the visitor cannot fill (a picker over records
 * they are not served, a field their sight keeps from them, a required one
 * the form leaves out), a policy that serves the visitor every record, and
 * a role that may read or do more than its forms ask.
 */
export function checkForms<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, mutations, declaredMutations, add } = ctx;
  const forms = Object.entries(app.forms ?? {});
  if (forms.length === 0) return;
  const policy = app.policy;
  const plural = (kind: string) => app.schema.tryDefinition(kind)?.plural ?? `${kind} records`;
  const formActs = new Set(forms.map(([, form]) => form.act));

  for (const [name, form] of forms) {
    const where = `forms["${name}"]`;
    const role = form.role ?? VISITOR_ROLE;
    const visitor: Principal = { kind: "human", id: "form:", roles: [role] };
    const act = mutations.get(form.act);
    if (!act) {
      add({ severity: "error", code: "form-unknown-act", where: `${where}.act`, message: `The form "${name}" runs "${form.act}", which is not an act of this app.`, fix: `Name one of the app's acts: ${declaredMutations.map((m) => m.name).join(", ")}.` });
      continue;
    }
    if (act.subject) {
      add({ severity: "error", code: "form-act-on-a-record", where: `${where}.act`, message: `"${form.act}" acts on a record somebody picks, and a visitor is shown no record to pick.`, fix: `Open an act that makes a record (creates) or acts on none.` });
      continue;
    }
    if (!policy || !policy.sees || policy.sees.length === 0) {
      add({
        severity: "error",
        code: "form-without-sight",
        where,
        message: policy ? `The policy says nothing of who sees what, so a visitor at the form "${name}" would be served every record of the app.` : `The app has no policy, so a visitor at the form "${name}" may do anything and is served every record.`,
        fix: policy ? `Say who sees each kind in policy.sees, naming the roles that do; a kind no sight names is kept from the visitor.` : `Declare a policy: grant the "${role}" role "${form.act}", and say who sees each kind in policy.sees.`,
      });
      continue;
    }
    if (permittedMutations(policy, visitor, [act]).length === 0) {
      add({ severity: "error", code: "form-act-not-granted", where: `${where}.act`, message: `A visitor holds the role "${role}", and no grant lets it run "${form.act}": the form would refuse every answer.`, fix: `Add a grant: { roles: ["${role}"], mutations: ["${form.act}"] }.` });
    }

    const all = formFields(act.input);
    const never = argumentsNeverShown(app.schema, policy, visitor, act);
    const asked = form.fields ?? all.map((field) => field.name);
    for (const field of form.fields ?? []) {
      if (!all.some((one) => one.name === field)) add({ severity: "error", code: "form-field-unknown", where: `${where}.fields`, message: `"${field}" is not an argument of "${form.act}".`, fix: `Name its arguments: ${all.map((one) => one.name).join(", ")}.` });
    }
    for (const field of all) {
      const required = !field.optional && field.control !== "boolean";
      if (required && !asked.includes(field.name)) {
        add({ severity: "error", code: "form-omits-required", where: `${where}.fields`, message: `"${form.act}" needs "${field.name}", which the form "${name}" does not ask for, so no answer could be received.`, fix: `Add "${field.name}" to the form's fields, or make it optional.` });
        continue;
      }
      if (!asked.includes(field.name)) continue;
      const unseen = pickersIn(field).filter((picker) => !picker.kinds.some((kind) => kind !== "*" && visitorSeesKind(policy, visitor, kind)));
      const kept = never.has(field.name);
      if (unseen.length === 0 && !kept) continue;
      const why = kept ? `the visitor's sight keeps the field from them` : `it picks from ${unseen.flatMap((picker) => picker.kinds).map(plural).join(" or ")}, which a visitor is not served`;
      // Unsaid, the form leaves out what a visitor could not answer; said, or required, it is the declaration's to change.
      if (required) add({ severity: "error", code: "form-field-unfillable", where: `${where}.fields`, message: `A visitor cannot fill "${field.name}" at the form "${name}": ${why}.`, fix: kept ? `Show the field to the "${role}" role, or make it optional and leave it out of the form.` : `Make it optional and leave it out of the form, or show the "${role}" role the records it picks from (a sight naming it).` });
      else if (form.fields) add({ severity: "warning", code: "form-field-unfillable", where: `${where}.fields`, message: `A visitor cannot fill "${field.name}" at the form "${name}": ${why}, so it is left out.`, fix: `Take "${field.name}" out of the form's fields.` });
    }

    // A picker over records the visitor is served offers them every one: deliberate when a sight names the role, not when it says everybody.
    const pickedKinds = new Set(all.filter((field) => asked.includes(field.name)).flatMap(pickersIn).flatMap((picker) => picker.kinds));
    for (const kind of app.schema.kinds as readonly string[]) {
      const sights = policy.sees.filter((sight) => sight.kinds.includes(kind) && grantsTo(sight, visitor) && !sight.own && !sight.via);
      if (sights.length === 0) continue;
      const toEverybody = sights.every((sight) => sight.roles === "*");
      if (pickedKinds.has(kind) && !toEverybody) continue;
      add({
        severity: "warning",
        code: "form-visitor-sees",
        where: `${where}`,
        message: `A visitor at the form "${name}" is served every one of the ${plural(kind)}${toEverybody ? ", because a sight shows them to everybody" : `, because a sight names the "${role}" role`}${pickedKinds.has(kind) ? ", and the form's picker offers them all" : ""}.`,
        fix: toEverybody ? `Name the roles that see the ${plural(kind)} in policy.sees rather than "*", or leave it if anybody with the form's link may read them.` : `Take "${role}" out of the sight, or leave it if the form's visitors may read them.`,
      });
    }
  }

  // The role a form's visitor holds may run the forms' acts and nothing else declared: anything more is open to whoever holds a link.
  const roles = new Set(forms.map(([, form]) => form.role ?? VISITOR_ROLE));
  if (!policy) return;
  for (const role of roles) {
    const more = permittedMutations(policy, { kind: "human", id: "form:", roles: [role] }, declaredMutations).filter((mutation) => !formActs.has(mutation.name));
    if (more.length === 0) continue;
    add({ severity: "warning", code: "form-visitor-may-more", where: "policy.grants", message: `A form's visitor holds the role "${role}", which may also run ${more.map((m) => `"${m.name}"`).join(", ")} — open to whoever has a form's link.`, fix: `Grant the "${role}" role only its forms' acts.` });
  }
}
