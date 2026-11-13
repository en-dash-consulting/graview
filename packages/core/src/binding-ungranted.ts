/**
 * WHY NO GRANT NAMES `bind-person` (Roadmap f-invite-binds-existing-person),
 * as the checker, a compile and an edit say it: binding an account to the
 * person entered for it is the host's, as an invitation is accepted. Kept
 * out of what a page draws with.
 */
import { BIND_PERSON } from "./binding-served.js";

export const BINDING_UNGRANTED = `"${BIND_PERSON}" is the host's, and no grant gives it: only the host binds an account to the person entered for it, as an invitation is accepted`;
