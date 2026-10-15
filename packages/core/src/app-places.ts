import type { GraviewApp } from "./app.js";
import { declaredLenses, MOST_STANDING, openingOf, orderKinds, OVERVIEW_PATH, OVERVIEW_SLUG, pagesTitle, sceneTitle, type PlaceFinding, type ShippedLensName } from "./places.js";
import type { AnySchema } from "./schema/schema.js";
import { pluralLabel } from "./schema/define-node.js";
import { kindPath, onePerPicture, placePath, sharesItsName, type PagesArrangement, type Place } from "./views/types.js";

/*
 * EVERY PLACE AN APP HAS, AND WHAT ITS ARRANGEMENT ASKS THAT IT CANNOT
 * HONOR. A file of its own (FR-179): the seat lists the places an ask can
 * go to, a host lists them when an app is opened and the checker judges
 * the arrangement — none of it before a page draws its bar, which reads
 * the places that stand from `./places.ts` (`@graview/core/seat`,
 * `@graview/core/check`).
 */


/** What the arrangement asks that the declaration cannot honor: kinds and places that do not exist, and lenses kept off the lists that cannot be. */
export function arrangementFindings<S extends AnySchema>(app: GraviewApp<S>, places: readonly Place[] = placesOfLenses(app)): readonly PlaceFinding[] {
  const pages = app.pages;
  const findings: PlaceFinding[] = [];
  /* A LENS KEPT OFF THE LISTS says so with true, and is a place to keep off them: it has a title. */
  (app.lenses ?? []).forEach((lens, index) => {
    const hidden: unknown = lens.hidden;
    const titled = typeof lens.title === "string" && lens.title.trim().length > 0;
    if (hidden !== undefined && typeof hidden !== "boolean") {
      findings.push({ severity: "warning", code: "lens-hidden-not-a-boolean", path: `lenses.${index}.hidden`, message: `${titled ? `"${lens.title}"` : `lenses.${index}`} says hidden is ${JSON.stringify(hidden)}, which is not true or false, so it is listed.`, fix: `Write "hidden": true to keep it off the lists, or drop it.` });
    } else if (hidden === true && !titled) {
      findings.push({ severity: "note", code: "lens-hidden-untitled", path: `lenses.${index}.hidden`, message: `lenses.${index} is hidden, but it has no title, so it is no place to hide.`, fix: `Give it a title to make it a place, or drop "hidden".` });
    }
  });
  const taken = places.find((place) => place.as === OVERVIEW_SLUG);
  if (taken) {
    findings.push({
      severity: "warning",
      code: "pages-overview-taken",
      path: "pages",
      message: `The place "${taken.title}" has the address the scene keeps (${OVERVIEW_PATH}), so the bar's "${sceneTitle(pages)}" and it cannot both be reached there.`,
      fix: `Give "${taken.title}" another title (or another "as"): the scene keeps ${OVERVIEW_PATH} whatever the declaration calls it.`,
    });
  }
  if (!pages) return findings;
  if (sceneTitle(pages).toLowerCase() === pagesTitle(pages).toLowerCase()) {
    findings.push({
      severity: "warning",
      code: "pages-faces-alike",
      path: "pages",
      message: `The bar's switch would call both the scene and the pages "${sceneTitle(pages)}", so a reader could not tell its two buttons apart.`,
      fix: `Give pages.scene and pages.pages two different words (unsaid, they are "Scene" and "Pages").`,
    });
  }
  const kinds = app.schema.kinds as readonly string[];
  for (const part of ["order", "hide"] as const) {
    (pages[part] ?? []).forEach((kind, index) => {
      if (!kinds.includes(kind)) {
        findings.push({ severity: "warning", code: "pages-kind-unknown", path: `pages.${part}.${index}`, message: `pages.${part} names "${kind}", which is not a kind, so it is passed over.`, fix: `Use one of: ${kinds.join(", ")}.` });
      }
    });
  }
  (pages.primary ?? []).forEach((word, index) => {
    const opening = openingOf(word, app.schema, places);
    if (opening === undefined || opening.to === "home") {
      findings.push({
        severity: "warning",
        code: "pages-primary-unknown",
        path: `pages.primary.${index}`,
        message:
          opening?.to === "home"
            ? `pages.primary names "${word}", but Home always stands on the bar, so it is passed over.`
            : `pages.primary names "${word}", which is not a kind or a place, so it is passed over.`,
        fix: `Name a kind (${kinds.join(", ")}) or a place (${places.map((place) => `"${place.title}"`).join(", ") || "none is declared"}).`,
      });
    }
  });
  (pages.primary ?? []).forEach((word, index) => {
    const opening = openingOf(word, app.schema, places);
    if (opening?.to === "place" && opening.place.hidden) {
      findings.push({
        severity: "warning",
        code: "pages-primary-hidden",
        path: `pages.primary.${index}`,
        message: `pages.primary names "${word}", a lens kept off the lists (hidden), so the bar cannot stand it up.`,
        fix: `Show the lens (set-lens-hidden with "hidden": false), or leave it out of pages.primary.`,
      });
    }
  });
  if ((pages.primary?.length ?? 0) > MOST_STANDING - 1) {
    findings.push({
      severity: "warning",
      code: "pages-primary-many",
      path: "pages.primary",
      message: `pages.primary names ${pages.primary!.length} places, and at most ${MOST_STANDING - 1} stand beside Home: the rest fold into "More" anyway.`,
      fix: `Name the ${MOST_STANDING - 1} a person reaches for most.`,
    });
  }
  if (pages.first !== undefined && openingOf(pages.first, app.schema, places) === undefined) {
    findings.push({
      severity: "warning",
      code: "pages-first-unknown",
      path: "pages.first",
      message: `pages.first is "${pages.first}", which is not a place, a kind or "home", so the app opens at its home.`,
      fix: `Name a place (${places.map((place) => `"${place.title}"`).join(", ") || "none is declared"}), a kind, or "home".`,
    });
  }
  return findings;
}

/** The places a declaration's lenses make, with any its registered views name. */
function placesOfLenses<S extends AnySchema>(app: GraviewApp<S>): readonly Place[] {
  const out: Place[] = [];
  for (const lens of declaredLenses(app).drawn) {
    // One picture over several kinds is a place on each, and says so (`over`): every list names it once.
    for (const kind of lens.kinds) out.push({ kind, title: lens.title, as: lens.as, ...(lens.across ? { across: lens.across } : {}), ...(lens.kinds.length > 1 ? { over: lens.kinds } : {}), ...(lens.hidden ? { hidden: true } : {}) });
  }
  for (const place of app.views?.places?.() ?? []) {
    if (!out.some((held) => held.kind === place.kind && held.as === place.as)) out.push(place);
  }
  return out;
}

/**
 * ONE OF AN APP'S NAMED PLACES, as a host lists them (FR-79, FR-80): what it
 * is called, what it is over, and its address on each face — `address` on
 * the routed face, `stop` in the scene's fragment.
 */
export interface AppPlace {
  /** The address word: a place's `as`, a kind's plural, or `home`. */
  readonly slug: string;
  readonly title: string;
  /** The kind it is over; null for the home. A picture over several kinds is listed once, under the first. */
  readonly kind: string | null;
  /** Every kind a picture over several is over — the timetable of talks and workshops — each one's district going in to it. */
  readonly over?: readonly string[];
  readonly cardinality: "many";
  /** Its path on the routed face: `/`, `/<plural>`, `/places/<as>`. */
  readonly address: string;
  /** Its stop in the scene: `#view=<as>`, `#focus=aggregate:<kind>`, or `#`. */
  readonly stop: string;
  /** Which shipped lens draws it, when a declared lens does. */
  readonly lens?: ShippedLensName;
  /** A kind left off the home by `pages.hide`, or a lens kept off the lists (`hidden`); still reachable at its address. */
  readonly hidden?: boolean;
  /** Where the app opens (`pages.first`). */
  readonly first?: boolean;
}

/**
 * EVERY PLACE AN APP HAS, by name: the home, each declared lens that draws
 * (and each place its registered views name, when the app carries them),
 * and each kind — in the arrangement's order. What Graview Cloud's
 * connector lists when an app is opened, and what a chat can send somebody
 * to.
 */
export function placesOf<S extends AnySchema>(app: GraviewApp<S>): readonly AppPlace[] {
  return placesFrom(app.schema, placesOfLenses(app), { ...(app.pages ? { pages: app.pages } : {}), lenses: declaredLenses(app).drawn, home: (app.home?.length ?? 0) > 0 });
}

/**
 * THE SAME LIST FROM WHAT A FACE HOLDS: the schema, the places its view
 * registry names, and the arrangement — what `placesOf` makes from the
 * declaration, for a seat handed a store and its views rather than the app.
 * One builder, so the two can never name, address or order a place
 * differently.
 */
export function placesFrom(
  schema: AnySchema,
  lensPlaces: readonly Place[],
  options: { readonly pages?: PagesArrangement; readonly lenses?: readonly { readonly as: string; readonly kinds: readonly string[]; readonly lens: ShippedLensName }[]; readonly home?: boolean } = {},
): readonly AppPlace[] {
  const { pages } = options;
  const kindsDeclared = schema.kinds as readonly string[];
  const places = lensPlaces.filter((place) => kindsDeclared.includes(place.kind));
  const opening = openingOf(pages?.first, schema, places);
  const hidden = new Set(pages?.hide ?? []);
  const kinds = orderKinds(kindsDeclared, pages?.order);
  const out: AppPlace[] = [
    { slug: "home", title: "Home", kind: null, cardinality: "many", address: "/", stop: "#", ...(opening?.to === "home" || (opening === undefined && options.home) ? { first: true } : {}) },
    // The scene, a place like the others (FR-132): its stop rides on its address.
    { slug: OVERVIEW_SLUG, title: sceneTitle(pages), kind: null, cardinality: "many", address: OVERVIEW_PATH, stop: "#" },
  ];
  // A picture over several kinds once, under the first of them in the arrangement's order.
  const byKind = onePerPicture([...places].sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind)));
  for (const place of byKind) {
    const lens = options.lenses?.find((one) => one.as === place.as && one.kinds.includes(place.kind));
    const shared = sharesItsName(place, places);
    out.push({
      slug: place.as,
      title: place.title,
      kind: place.kind,
      ...(place.over ? { over: place.over.filter((kind) => kindsDeclared.includes(kind)) } : {}),
      cardinality: "many",
      address: placePath(place.as, shared ? kindPath(schema, place.kind).slice(1) : undefined),
      stop: shared ? `#focus=aggregate:${place.kind}&in.view=${encodeURIComponent(place.as)}` : `#view=${encodeURIComponent(place.as)}`,
      ...(lens ? { lens: lens.lens } : {}),
      ...(place.hidden ? { hidden: true } : {}),
      ...(opening?.to === "place" && opening.place.as === place.as && (opening.place.kind === place.kind || place.over?.includes(opening.place.kind)) ? { first: true } : {}),
    });
  }
  for (const kind of kinds) {
    out.push({
      slug: kindPath(schema, kind).slice(1),
      title: pluralLabel(schema, kind),
      kind,
      cardinality: "many",
      address: kindPath(schema, kind),
      stop: `#focus=aggregate:${kind}`,
      ...(hidden.has(kind) ? { hidden: true } : {}),
      ...(opening?.to === "kind" && opening.kind === kind ? { first: true } : {}),
    });
  }
  return out;
}
