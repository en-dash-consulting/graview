/**
 * WHY NO GRANT NAMES `bind-person` OR `rebind-person` (Roadmap
 * f-invite-binds-existing-person, f-rebind-after-acting), as the checker, a
 * compile and an edit say it: whose record a person is is the host's to
 * say, as an invitation is accepted or a binding is corrected. Kept out of
 * what a page draws with.
 */
import { BIND_PERSON } from "./binding-served.js";

/** The sentence a grant that names a binding act is refused with. */
export const bindingUngranted = (act: string = BIND_PERSON): string =>
  act === BIND_PERSON
    ? `"${BIND_PERSON}" is the host's, and no grant gives it: only the host binds an account to the person entered for it, as an invitation is accepted`
    : `"${act}" is the host's, and no grant gives it: only the host moves an account, and what it did, from one person's record to another's`;
