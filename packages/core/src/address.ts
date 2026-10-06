/**
 * AN APP'S ADDRESS UNDER A HOST'S BASE PATH (FR-106).
 *
 * A host that owns the page gives the routed face the address bar
 * (`routing: "address"` on the embed), and serves the app at `/` or under a
 * path of its own — `/apps/<id>/`, say. `placesOf(app)` says each place's
 * address relative to the app (`/`, `/<plural>`, `/places/<as>`); these say
 * it under the base, spelled the way the face's own links are, and read an
 * address in the bar back to the app's own path.
 */

/** A base path as the router holds it: a leading slash, no trailing one, and the root as `""`. */
export function basePathOf(basePath: string | undefined): string {
  const trimmed = (basePath ?? "").replace(/\/+$/, "");
  if (trimmed === "") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * A place's address under a base: `addressOf("/places/the-board", { basePath:
 * "/apps/a1/" })` is `/apps/a1/places/the-board`. The home is the base itself
 * (`/apps/a1`), as the routed face's own link home spells it. Takes an
 * `AppPlace` from `placesOf` or its `address`; what is encoded stays encoded.
 */
export function addressOf(place: string | { readonly address: string }, options: { readonly basePath?: string } = {}): string {
  const address = typeof place === "string" ? place : place.address;
  const base = basePathOf(options.basePath);
  const path = address.startsWith("/") ? address : `/${address}`;
  if (base === "") return path;
  if (path === "/") return base;
  if (path.startsWith("/?") || path.startsWith("/#")) return `${base}${path.slice(1)}`;
  return `${base}${path}`;
}

/**
 * An address in the bar, read back to the app's own path: `/apps/a1/tasks`
 * under `/apps/a1` is `/tasks`, the base itself is `/`, and an address that
 * is not under the base at all is `null`. Compared as the router compares,
 * ignoring case; what is encoded stays encoded.
 */
export function pathWithin(pathname: string, basePath: string | undefined): string | null {
  const base = basePathOf(basePath);
  if (base === "") return pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!pathname.toLowerCase().startsWith(base.toLowerCase())) return null;
  const rest = pathname.slice(base.length);
  if (rest === "" || rest === "/") return "/";
  return rest.startsWith("/") ? rest : null;
}
