/**
 * `@graview/core/composer` — A CHANGE TO THE APP, COMPOSED ON THE PAGE THAT
 * ASKS FOR IT (Roadmap f-light-composer).
 *
 * Graview Cloud lends `composeChange` to its owner and editor pages, so the
 * quick ask, "Make “Tasks” better" and "Other ways to show this" can offer a
 * change to the app rehearsed before it is offered. `composeAppChange` from
 * `@graview/core/compose` carries the whole composer and the framework's
 * checker: fetched lazily from the shell, it moved about 75 KB of zod and of
 * the brand's rules into every visitor's first load, and bundled apart it was
 * some 660 KB with a second copy of core whose errors the shell's store did
 * not recognize.
 *
 * This is the part of it a page needs: the edits a plan names applied
 * (`editDocument`), who may run and see what they add granted as the app's
 * widest grant is, and the changed document compiled the way the page
 * compiles its own, then judged by the checks a change made on a page can
 * fail (`compileForAChange`): its acts, rules, computed values, formats,
 * links, jobs, aliases and view keys, and of the framework's checks the
 * pages' routes and the lenses' bindings, so nothing is offered that the
 * host would then refuse. The app it makes is built by the shell's own
 * core, so the store that rehearses the plan reads its errors as its own.
 * The whole checker stays where a change is kept: the host's
 * `onProposeChange` judges it again before it applies it, and
 * `@graview/core/compose` is the composer that judges with all of it, for
 * a host's server. Imported here: nothing of the city, the look or a
 * reshape's traits.
 */
import { compileForAChange } from "./composer-check.js";
import type { GraviewDocument } from "./document/schema.js";
import { compiledForChange, editedForChange, grantedWhatItAdds, type ComposedAppChange } from "./compose-change.js";

export type { ComposedAppChange } from "./compose-change.js";
/** A changed document, compiled and judged by the checks a change made on a page can fail. */
export { compileForAChange } from "./composer-check.js";

/**
 * A CHANGE TO THE APP, COMPOSED AND COMPILED, FOR A PAGE (`composeChange` on
 * `mount` and the provider): `edits` applied to `document`, what it adds
 * granted, the steps said in words, and the app it compiles to, or a
 * refusal in words. A reshape's `add` and `drop` (traits composed whole) are
 * `@graview/core/compose`'s, and are refused here in words.
 */
export function composeAppChange(change: { readonly document: GraviewDocument; readonly edits?: readonly unknown[]; readonly add?: readonly string[]; readonly drop?: readonly string[] }): ComposedAppChange {
  if (!change.edits) return { ok: false, refused: "Only a change written as edits can be composed here; a reshape is composed by the host." };
  const edited = editedForChange(change.document, change.edits);
  if (!edited.ok) return edited;
  const said = edited.said;
  return compiledForChange(grantedWhatItAdds(change.document, edited.document, said), said, compileForAChange, "It would not pass the checks a page asks");
}
