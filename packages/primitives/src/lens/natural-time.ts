/**
 * A LENS'S ROLES FOR ONE KIND, its start the kind's natural time where the
 * lens names none: a timeline over runs binds their end and their lane, and
 * draws each at when it is (`fieldRoles.when`) — said once, on the kind, and
 * read by the lists and the glance as well.
 */
export function withNaturalTime<R extends { readonly start: string }>(
  roles: R | undefined,
  definition: { readonly fieldRoles?: Readonly<Record<string, string>> } | undefined,
): R | undefined {
  const when = definition?.fieldRoles?.["when"];
  return roles && !roles.start && when ? { ...roles, start: when } : roles;
}
