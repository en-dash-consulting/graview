import type { GraviewDocument } from "./document/schema.js";
import { editDocument } from "./document/edit.js";
import type { CompiledDocument, RefusedDocument } from "./document/compile.js";
import type { GraviewApp } from "./app.js";
import type { AnySchema } from "./schema/schema.js";

/*
 * A CHANGE TO THE APP, COMPOSED, WITH THE COMPILE IT IS JUDGED BY HANDED IN
 * (Roadmap f-light-composer). `@graview/core/compose` judges it with the
 * framework's checker; `@graview/core/composer`, which a page fetches, with
 * the compile a page already has. What both share is here: the edits
 * applied, who may run and see what they add, and the sentences said.
 */

/** What a composed change answers: the changed document, the app it compiles to and the steps in words, or a refusal in words. */
export type ComposedAppChange = { readonly ok: true; readonly document: GraviewDocument; readonly app: GraviewApp<AnySchema>; readonly said: readonly string[] } | { readonly ok: false; readonly refused: string };

/** The edits applied to a document: the changed document and what each edit said, or the refusal. */
export function editedForChange(document: GraviewDocument, edits: readonly unknown[]): { readonly ok: true; readonly document: GraviewDocument; readonly said: string[] } | { readonly ok: false; readonly refused: string } {
  const edited = editDocument(document, edits);
  if (!edited.ok) return { ok: false, refused: `It could not be written: ${(edited.findings[0]?.message ?? "an edit was refused").replace(/\.$/, "")}.` };
  return { ok: true, document: edited.document, said: [...edited.said] };
}

/**
 * WHO MAY RUN AND SEE WHAT IT ADDS: a policy that names its acts would
 * leave the new ones unreachable (which the checker refuses), and one that
 * names what each role sees would hide a new kind, so both are granted as
 * the app's widest grant is, and said.
 */
export function grantedWhatItAdds(before: GraviewDocument, changed: GraviewDocument, said: string[]): GraviewDocument {
  const policy = changed.policy;
  const addedActs = Object.keys(changed.acts ?? {}).filter((name) => !(name in (before.acts ?? {})));
  const addedKinds = Object.keys(changed.kinds).filter((name) => !(name in before.kinds));
  const listing = (policy?.grants ?? []).filter((grant) => Array.isArray(grant.mutations) && !grant.self);
  const widest = [...listing].sort((a, b) => (b.mutations as readonly string[]).length - (a.mutations as readonly string[]).length)[0];
  const opens = (policy?.grants ?? []).some((grant) => grant.mutations === "*");
  let document = changed;
  if (policy && widest && addedActs.length > 0 && !opens) {
    document = { ...document, policy: { ...document.policy!, grants: [...document.policy!.grants, { roles: widest.roles, mutations: addedActs }] } };
    said.push(`Who may run what it adds: ${widest.roles === "*" ? "everybody" : (widest.roles as readonly string[]).join(" and ")}.`);
  }
  const sees = (document.policy as { readonly sees?: readonly { readonly roles?: unknown; readonly kinds?: readonly string[] }[] } | undefined)?.sees;
  if (sees && addedKinds.length > 0) {
    const roles = (document.roles as readonly string[] | undefined) ?? [...new Set(sees.flatMap((one) => (Array.isArray(one.roles) ? (one.roles as string[]) : [])))];
    document = { ...document, policy: { ...document.policy!, sees: [...sees, { roles, kinds: addedKinds }] } as never };
  }
  return document;
}

/** The changed document compiled by `compile`: the app, or the refusal said as `refusal` says it. */
export function compiledForChange(document: GraviewDocument, said: readonly string[], compile: (document: GraviewDocument) => CompiledDocument | RefusedDocument, refusal: string): ComposedAppChange {
  const compiled = compile(document);
  if (!compiled.ok) {
    const finding = compiled.findings.find((one) => one.severity === "error") ?? compiled.findings[0];
    return { ok: false, refused: `${refusal}${finding ? `: ${finding.message.replace(/\.$/, "")}` : ""}.` };
  }
  return { ok: true, document, app: compiled.app as GraviewApp<AnySchema>, said };
}
