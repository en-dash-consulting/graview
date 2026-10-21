import type { GraviewApp } from "./app.js";
import { arrangedEntries, declaredLenses, MOST_STANDING, openingOf, OVERVIEW_PATH, OVERVIEW_SLUG, pagesTitle, sceneTitle, viewReference, type PlaceFinding, type ShippedLensName } from "./places.js";
import type { AnySchema } from "./schema/schema.js";
import { allLabel, nounOf, pluralLabel, pluralOf } from "./schema/define-node.js";
import { kindPath, onePerPicture, placePath, placeSlug, samePicture, sharesItsName, type HostView, type PagesArrangement, type Place } from "./views/types.js";

/*
 * EVERY PLACE AN APP HAS, AND WHAT ITS ARRANGEMENT ASKS THAT IT CANNOT
 * HONOR. A file of its own (FR-179): the seat lists the places an ask can
 * go to, a host lists them when an app is opened and the checker judges
 * the arrangement — none of it before a page draws its bar, which reads
 * the places that stand from `./places.ts` (`@graview/core/seat`,
 * `@graview/core/check`).
 */


/**
 * What the arrangement asks that the declaration cannot honor: kinds and
 * places that do not exist, and lenses kept off the lists that cannot be.
 * `views` are the host's (`HostView`), when it says them: a `view:<name>`
 * none of them is, is a warning; unsaid, a view the app's own registry does
 * not hold is only a note — the host registers its views as the page opens.
 */
export function arrangementFindings<S extends AnySchema>(app: GraviewApp<S>, options: { readonly views?: readonly HostView[] } = {}): readonly PlaceFinding[] {
  const places = placesOfLenses(app, options.views);
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
  // A place titled as a kind's list is: the bar shows the place, and folds the list into More as "All <plural>" (`barPlaces`).
  const declaredKinds = app.schema.kinds as readonly string[];
  for (const place of onePerPicture(places.filter((one) => declaredKinds.includes(one.kind)))) {
    const kind = declaredKinds.find((one) => pluralLabel(app.schema, one).toLowerCase() === place.title.trim().toLowerCase());
    if (kind === undefined) continue;
    findings.push({
      severity: "warning",
      code: "pages-place-named-as-a-list",
      path: "pages",
      message: `The place "${place.title}" has the name of the list of every ${nounOf(app.schema.tryDefinition(kind), kind)}, so the bar names the place "${place.title}" and folds the list into More as "${allLabel(app.schema, kind)}" (still at ${kindPath(app.schema, kind)}).`,
      fix: `Give "${place.title}" a title that says what it shows of them, or leave it: the place is the one the bar calls "${place.title}".`,
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
  /*
   * A HOST'S VIEW BY NAME (`view:<name>`), in the order, the first place or
   * on the bar: where the host is not here to say its views, a name the
   * app's own registry does not hold is drawn once the host registers it.
   */
  const viewWords: [word: string, path: string][] = [
    ...(pages.order ?? []).map((word, index): [string, string] => [word, `pages.order.${index}`]),
    ...(pages.primary ?? []).map((word, index): [string, string] => [word, `pages.primary.${index}`]),
    ...(pages.first !== undefined ? [[pages.first, "pages.first"] as [string, string]] : []),
  ];
  for (const [word, path] of viewWords) {
    const name = viewReference(word);
    if (name === undefined || places.some((place) => place.name === name)) continue;
    const said = options.views?.find((view) => view.name === name);
    findings.push(
      options.views
        ? {
            severity: "warning",
            code: "pages-view-unknown",
            path,
            message: said ? `${path} names the view "${name}", which is not a picture of a kind (it ${said.attach === "home" ? "is the home's" : "draws one record"}), so it is passed over.` : `${path} names the view "${name}", which this app's host does not keep, so it is passed over.`,
            fix: `Name a view the host keeps by its name (${options.views.filter((view) => view.attach !== "home" && view.cardinality !== "one").map((view) => `"view:${view.name}"`).join(", ") || "it keeps none"}), or take it out.`,
          }
        : {
            severity: "note",
            code: "pages-view-not-drawn-here",
            path,
            message: `${path} names the view "${name}", which the host registers as the page opens: not drawn here yet, it stands where it is named once it is, and is passed over until then.`,
            fix: `Nothing to change if the host keeps a view by that name. Its manifest's "name" is what follows "view:".`,
          },
    );
  }
  for (const part of ["order", "hide"] as const) {
    (pages[part] ?? []).forEach((kind, index) => {
      if (part === "order" && viewReference(kind) !== undefined) return;
      if (!kinds.includes(kind)) {
        findings.push({ severity: "warning", code: "pages-kind-unknown", path: `pages.${part}.${index}`, message: `pages.${part} names "${kind}", which is not a kind, so it is passed over.`, fix: `Use one of: ${kinds.join(", ")}.` });
      }
    });
  }
  (pages.primary ?? []).forEach((word, index) => {
    const opening = openingOf(word, app.schema, places);
    if ((opening === undefined && viewReference(word) === undefined) || opening?.to === "home") {
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
  if (pages.first !== undefined && openingOf(pages.first, app.schema, places) === undefined && viewReference(pages.first) === undefined) {
    findings.push({
      severity: "warning",
      code: "pages-first-unknown",
      path: "pages.first",
      message: `pages.first is "${pages.first}", which is not a place, a kind or "home", so the app opens at its home.`,
      fix: `Name a place (${places.map((place) => `"${place.title}"`).join(", ") || "none is declared"}), a kind, or "home".`,
    });
  }
  // A drawn home and another first place: each does one thing, and a reader of the declaration is told which.
  const opening = openingOf(pages.first, app.schema, places);
  if (opening !== undefined && opening.to !== "home" && ((app.home?.length ?? 0) > 0 || app.views?.homeView?.() !== undefined)) {
    const where = opening.to === "place" ? `"${opening.place.title}"` : `the ${pluralOf(app.schema, opening.kind)} list`;
    findings.push({
      severity: "note",
      code: "pages-first-beside-home",
      path: "pages.first",
      message: `pages.first lands a new visit on ${where}; the home the declaration draws stays Home — on the bar, and at "/" for every press and link after the visit lands.`,
      fix: `Nothing to change if that is the intent. To open on the drawn home, take pages.first away (or set it to "home").`,
    });
  }
  return findings;
}

/** A host's view as a place: a titled picture of a kind, by its manifest name. */
function placeOfView(view: HostView): Place | undefined {
  if (view.attach === "home" || view.cardinality === "one" || !view.title) return undefined;
  return { kind: view.attach, title: view.title, as: placeSlug(view.title), name: view.name, lens: "view", ...(view.hidden ? { hidden: true } : {}) };
}

/** The places a declaration's lenses make, with any its registered views name, and the host's views it is told of. */
function placesOfLenses<S extends AnySchema>(app: GraviewApp<S>, views: readonly HostView[] = []): readonly Place[] {
  const out: Place[] = [];
  for (const lens of declaredLenses(app).drawn) {
    // One picture over several kinds is a place on each, and says so (`over`): every list names it once.
    for (const kind of lens.kinds) out.push({ kind, title: lens.title, as: lens.as, ...(lens.across ? { across: lens.across } : {}), ...(lens.kinds.length > 1 ? { over: lens.kinds } : {}), ...(lens.hidden ? { hidden: true } : {}) });
  }
  for (const place of [...(app.views?.places?.() ?? []), ...views.flatMap((view) => placeOfView(view) ?? [])]) {
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
  /** The host's name for it, when it is a view the host keeps (its manifest's `name`): what `view:<name>` names. */
  readonly view?: string;
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
 * to. `views` are the host's own (its kept script views' manifests): each
 * titled picture of a kind is a place, `name` its manifest's, listed where
 * `pages.order` names it (`view:<name>`) and first where `pages.first` does.
 */
export function placesOf<S extends AnySchema>(app: GraviewApp<S>, options: { readonly views?: readonly HostView[] } = {}): readonly AppPlace[] {
  return placesFrom(app.schema, placesOfLenses(app, options.views), { ...(app.pages ? { pages: app.pages } : {}), lenses: declaredLenses(app).drawn, home: (app.home?.length ?? 0) > 0 });
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
  // The kinds and the host's views `order` names, in its order: a view it names is listed there, among the kinds, not with the other pictures.
  const arranged = arrangedEntries(kindsDeclared, pages?.order, places);
  const kinds = arranged.flatMap((entry) => (entry.view ? [] : [entry.kind]));
  const ordered = arranged.flatMap((entry) => (entry.view ? [entry.view] : []));
  const out: AppPlace[] = [
    { slug: "home", title: "Home", kind: null, cardinality: "many", address: "/", stop: "#", ...(opening?.to === "home" || (opening === undefined && options.home) ? { first: true } : {}) },
    // The scene, a place like the others (FR-132): its stop rides on its address.
    { slug: OVERVIEW_SLUG, title: sceneTitle(pages), kind: null, cardinality: "many", address: OVERVIEW_PATH, stop: "#" },
  ];
  // A picture over several kinds once, under the first of them in the arrangement's order.
  const byKind = onePerPicture([...places].sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind)));
  const entryOf = (place: Place): AppPlace => {
    const lens = options.lenses?.find((one) => one.as === place.as && one.kinds.includes(place.kind));
    const shared = sharesItsName(place, places);
    return {
      slug: place.as,
      title: place.title,
      kind: place.kind,
      ...(place.over ? { over: place.over.filter((kind) => kindsDeclared.includes(kind)) } : {}),
      cardinality: "many",
      address: placePath(place.as, shared ? kindPath(schema, place.kind).slice(1) : undefined),
      stop: shared ? `#focus=aggregate:${place.kind}&in.view=${encodeURIComponent(place.as)}` : `#view=${encodeURIComponent(place.as)}`,
      ...(lens ? { lens: lens.lens } : {}),
      ...(place.name !== undefined ? { view: place.name } : {}),
      ...(place.hidden ? { hidden: true } : {}),
      ...(opening?.to === "place" && opening.place.as === place.as && (opening.place.kind === place.kind || place.over?.includes(opening.place.kind)) ? { first: true } : {}),
    };
  };
  for (const place of byKind) if (!ordered.some((view) => samePicture(view, place))) out.push(entryOf(place));
  for (const entry of arranged) {
    if (entry.view) {
      out.push(entryOf(entry.view));
      continue;
    }
    const kind = entry.kind;
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
