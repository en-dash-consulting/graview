import type { AnySchema, Principal, Store } from "@graview/core";

/**
 * WHOSE SEAT MAY CHANGE THE DECLARATION — the judgment the studio's door
 * and the seat's `propose_change` share (Roadmap f-seat-reshape), so the
 * two cannot disagree about who is offered the app itself.
 *
 * The same shape as "Show the installation": where the app declares
 * something administered, the declaration belongs to the seat that
 * administers it and to nobody else. Where it declares nothing
 * administered — a scaffolded project on its first day, which has no
 * installation yet — it belongs to whoever is here, because there is no one
 * else and a project you cannot change is a project you cannot grow; unless
 * a policy says who may do everything, and then it is theirs: a grant of
 * every act, on every kind, not only their own. A storefront with shoppers
 * and staff offered its own declaration to somebody browsing who may do
 * nothing but sign up; a viewer is never offered it.
 */
export function mayChangeDeclaration<S extends AnySchema>(store: Store<S>, principal: Principal | undefined): boolean {
  const administered = [...store.modules.administered.keys()];
  if (administered.length > 0) return administered.some((name) => store.mayAdminister(name, principal));
  const policy = store.policy;
  if (!policy) return true;
  const roles = principal?.roles ?? [];
  return policy.grants.some(
    (grant) => grant.mutations === "*" && !grant.self && (grant.kinds === undefined || grant.kinds === "*") && (grant.roles === "*" || roles.some((role) => (grant.roles as readonly string[]).includes(role))),
  );
}
