import type { GraviewApp, LensDeclaration } from "./app.js";
import { parseArrangement } from "./arrangement.js";
import { defOf } from "./schema/zod.js";
import type { AnySchema } from "./schema/schema.js";
import { placeSlug, type Place } from "./views/types.js";

/**
 * THE LENSES THIS FRAMEWORK SHIPS, AND WHAT EACH ONE TAKES AS DATA (FR-79).
 *
 * One table, read by everything that has to agree about a declared lens:
 * `graview check` (what it holds a declaration to), `graview describe`
 * (what it says is drawn), `placesOf` (what a host lists) and the
 * primitives that draw it (which factory, with which options). A lens is a
 * place because this says it can be one, and the four of them cannot
 * disagree because none of them has a list of its own.
 *
 * `options` is what a declaration may hand the factory beyond its roles —
 * data only. What a factory needs that cannot be data (a timeline's
 * `format`, a calendar's `today`) is derived where it is drawn.
 */
export const SHIPPED_LENSES = {
  timeline: { binds: "fields", requiredRoles: ["start", "end"], options: ["columns", "extent", "tick", "minWindow", "arranging"] },
  calendar: { binds: "fields", requiredRoles: ["start"], options: ["today", "range", "weekStartsOn", "perCell", "horizon", "arranging"] },
  coverage: { binds: "entities", requiredRoles: ["rows", "columns", "link"], options: ["rowRef", "rowGroup", "groupOrder", "requiredGroups", "requiredVia", "badge", "columnGroup"] },
  board: { binds: "entities", requiredRoles: ["slots", "x", "y", "fill"], options: ["fillFrom", "slotCode", "zones", "aspect", "emptyLabel", "pickTarget", "arranging", "arrange"] },
  plan: { binds: "entities", requiredRoles: ["regions", "outline"], options: ["hues", "aspect", "undrawnLabel", "strayLabel", "draw", "place", "help"] },
  reach: { binds: "nothing", requiredRoles: [], options: [] },
  /**
   * A PLACE DRAWN FROM BLOCKS (FR-81): `options.blocks` is a list from the
   * closed set the home and every card are written in — headlines, figures,
   * lists of records drawn by their own cards and rows — about no one
   * record, standing on the kind its `on` names. The data-only way to a
   * picture no shipped lens draws.
   */
  blocks: { binds: "nothing", requiredRoles: [], options: ["blocks"] },
  /**
   * A STATUS BOARD (FR-97): a kind's records in columns by one choice field
   * — `bindings: { task: { column: "status" } }` — in the field's declared
   * order, each drawn by its card, and moved between columns only by an act
   * the seat may run that sets the field (`columnMoves`).
   */
  columns: { binds: "fields", requiredRoles: ["column"], options: [] },
} as const satisfies Record<string, { binds: "fields" | "entities" | "nothing"; requiredRoles: readonly string[]; options: readonly string[] }>;

export type ShippedLensName = keyof typeof SHIPPED_LENSES;

/** The shipped lenses' names, in the order the table gives them. */
export const SHIPPED_LENS_NAMES = Object.keys(SHIPPED_LENSES) as readonly ShippedLensName[];

export const isShippedLens = (name: string): name is ShippedLensName => Object.prototype.hasOwnProperty.call(SHIPPED_LENSES, name);

/** The roles a lens requires: its own declaration's, or the shipped lens's when it names none. */
export function requiredRolesOf(lens: LensDeclaration): readonly string[] {
  return lens.requiredRoles ?? (isShippedLens(lens.name) ? SHIPPED_LENSES[lens.name].requiredRoles : []);
}

/** Which shape its bindings take: its own word, or the shipped lens's when it says none. */
export function bindsOf(lens: LensDeclaration): "fields" | "entities" {
  if (lens.binds) return lens.binds;
  return isShippedLens(lens.name) && SHIPPED_LENSES[lens.name].binds === "entities" ? "entities" : "fields";
}

/**
 * A DECLARED LENS THAT DRAWS: which factory, the place it is, the kinds it
 * stands on, and the factory's data options, resolved from the declaration's
 * bindings. Everything here is data; `@graview/primitives` turns it into a
 * view (`registerDeclaredLenses`).
 */
export interface DrawnLens {
  /** Its index in `app.lenses`. */
  readonly index: number;
  readonly lens: ShippedLensName;
  readonly title: string;
  /** The place's address word: its title, lower-cased and hyphenated. */
  readonly as: string;
  /** The kinds it is a place over: its `on`, or derived from its bindings. */
  readonly kinds: readonly string[];
  /** The other kind of a picture over two (a coverage's columns). */
  readonly across?: string;
  /** What the factory is handed, as data. */
  readonly options: Readonly<Record<string, unknown>>;
}

/** A declared lens that does not draw, and why — what `describe` says and `check` explains. */
export interface UndrawnLens {
  readonly index: number;
  readonly name: string;
  readonly title?: string;
  readonly why: string;
}

/** A finding about a declared lens or the arrangement, at its path in the declaration. */
export interface PlaceFinding {
  readonly severity: "warning" | "note";
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly fix: string;
}

export interface DeclaredLenses {
  readonly drawn: readonly DrawnLens[];
  readonly undrawn: readonly UndrawnLens[];
  readonly findings: readonly PlaceFinding[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The values an enum field takes, read from its schema; empty when it is not one. */
function enumValues(schema: AnySchema, kind: string, field: string): readonly string[] {
  const shape = schema.tryDefinition(kind)?.fields.shape as Record<string, unknown> | undefined;
  // Read from zod's own definition, through optional and default, rather than through the JSON-schema writer a page need not carry.
  let def = defOf(shape?.[field]);
  while (def && (def.type === "optional" || def.type === "default" || def.type === "nullable" || def.type === "prefault")) def = defOf(def.innerType);
  if (def?.type !== "enum") return [];
  const values = def.entries ? Object.values(def.entries) : (def.values ?? []);
  return values.filter((value): value is string => typeof value === "string");
}

/**
 * EVERY DECLARED LENS, SORTED INTO WHAT DRAWS AND WHAT DOES NOT.
 *
 * A lens draws when it names a lens this framework ships and gives itself a
 * `title` — the title is what makes it a place: a pill on the bar, a
 * drive-in from altitude, a page at `/places/<as>`. A lens without one is
 * bindings the checker holds, as every declared lens was before FR-79. A
 * titled lens whose options or bindings cannot make a picture does not draw,
 * and says why here, so the checker and the describer give the same reason
 * the picture is missing.
 */
export function declaredLenses<S extends AnySchema>(app: GraviewApp<S>): DeclaredLenses {
  const drawn: DrawnLens[] = [];
  const undrawn: UndrawnLens[] = [];
  const findings: PlaceFinding[] = [];
  const kinds = new Set(app.schema.kinds as readonly string[]);
  const edges = new Set<string>();
  for (const kind of kinds) for (const edge of Object.keys((app.schema.tryDefinition(kind)?.edges as Record<string, unknown> | undefined) ?? {})) edges.add(edge);
  const fieldsOf = (kind: string) => Object.keys((app.schema.tryDefinition(kind)?.fields.shape as Record<string, unknown> | undefined) ?? {});
  /** Titles already taken, per kind, so two places on one kind cannot share an address. */
  const taken = new Map<string, number>();

  (app.lenses ?? []).forEach((lens, index) => {
    const at = `lenses.${index}`;
    const title = typeof lens.title === "string" && lens.title.trim().length > 0 ? lens.title.trim() : undefined;
    const skip = (why: string, finding?: Omit<PlaceFinding, "severity"> & { severity?: PlaceFinding["severity"] }) => {
      undrawn.push({ index, name: lens.name, ...(title ? { title } : {}), why });
      if (finding) findings.push({ severity: "warning", ...finding });
    };
    if (!isShippedLens(lens.name)) {
      if (title) skip(`"${lens.name}" is not a lens this framework draws`, { code: "lens-not-shipped", path: `${at}.name`, message: `"${title}" names the lens "${lens.name}", which the framework does not ship, so nothing draws it.`, fix: `Name one of ${SHIPPED_LENS_NAMES.join(", ")} — or register the view yourself and drop the title.` });
      else skip("it is a lens this app wrote, drawn by the app's own views");
      return;
    }
    if (!title) return skip("it has no title, so it is bindings the checker holds and no place");
    const shipped = SHIPPED_LENSES[lens.name];
    const given = isRecord(lens.options) ? lens.options : {};
    if (lens.options !== undefined && !isRecord(lens.options)) {
      return skip("its options are not an object", { code: "lens-options-not-an-object", path: `${at}.options`, message: `"${title}" has options that are not an object.`, fix: `Write them as { "<option>": <value> }, or drop them.` });
    }
    for (const key of Object.keys(given)) {
      if (!(shipped.options as readonly string[]).includes(key)) {
        findings.push({ severity: "warning", code: "lens-option-unknown", path: `${at}.options.${key}`, message: `The ${lens.name} lens takes no option "${key}", so "${title}" ignores it.`, fix: shipped.options.length === 0 ? `The ${lens.name} lens takes no options; drop it.` : `Use one of: ${shipped.options.join(", ")}.` });
      }
    }
    const options: Record<string, unknown> = {};
    for (const key of shipped.options) if (given[key] !== undefined) options[key] = given[key];
    if (lens.arrangedBy) options["arrangedBy"] = parseArrangement(lens.arrangedBy);

    const bindings = isRecord(lens.bindings) ? (lens.bindings as Record<string, unknown>) : {};
    let stands: string[] = [];
    let across: string | undefined;
    const bad = (path: string, message: string, fix: string) => skip(message, { code: "lens-cannot-draw", path, message: `"${title}" cannot draw: ${message}.`, fix });

    if (shipped.binds === "fields") {
      const bound = Object.keys(bindings).filter((kind) => isRecord(bindings[kind]));
      const unknown = bound.filter((kind) => !kinds.has(kind));
      if (bound.length === 0) return bad(`${at}.bindings`, "it binds no kind", `Bind a kind's fields: "bindings": { "<kind>": { ${shipped.requiredRoles.map((role) => `"${role}": "<field>"`).join(", ")} } }.`);
      if (unknown.length > 0) return; // the binding check says so, as an error
      options["bindings"] = bindings;
      stands = bound;
      if (lens.name === "timeline") {
        /*
         * A TIMELINE'S COLUMNS. Named in the options, or read from the field
         * its `column` role is bound to when that field is a set of values —
         * a weekday, a lane. A timeline with neither has nowhere to put a
         * span, so it says so rather than drawing an empty week.
         */
        const columns = given["columns"];
        if (Array.isArray(columns)) {
          options["columns"] = columns.map((column) => (typeof column === "string" ? { id: column, label: column } : column));
        } else {
          const derived = bound.flatMap((kind) => {
            const roles = bindings[kind] as Record<string, unknown>;
            const field = typeof roles["column"] === "string" ? (roles["column"] as string) : typeof roles["columns"] === "string" ? (roles["columns"] as string) : undefined;
            return field ? enumValues(app.schema, kind, field) : [];
          });
          const values = [...new Set(derived)];
          if (values.length === 0) return bad(`${at}.options.columns`, "it has no columns — no option names them and no `column` role is bound to a field of set values", `Bind "column" to a field whose values are the columns, or say "columns": ["mon", "tue", …].`);
          options["columns"] = values.map((value) => ({ id: value, label: value.toUpperCase() }));
        }
        if (options["extent"] === undefined) options["extent"] = 1440;
      }
      if (lens.name === "columns") {
        // A board's columns are a field's choices: a field of free text or numbers has no columns to stand in.
        for (const kind of bound) {
          const field = (bindings[kind] as Record<string, unknown>)["column"];
          if (typeof field !== "string" || !fieldsOf(kind).includes(field)) return; // the binding check says so, as an error
          if (enumValues(app.schema, kind, field).length === 0) {
            return bad(`${at}.bindings.${kind}.column`, `its column field "${field}" is not a choice`, `Bind "column" to a choice field of ${kind}, like a status.`);
          }
        }
      }
      if (lens.name === "calendar" && options["today"] !== undefined && !(typeof options["today"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(options["today"]))) {
        return bad(`${at}.options.today`, "its today is not a date", `Write it as "YYYY-MM-DD", or leave it out and the calendar opens on the day it is drawn.`);
      }
      if (lens.name === "calendar" && options["range"] !== undefined && !["day", "week", "month", "quarter", "year", "years", "agenda"].includes(options["range"] as string)) {
        return bad(`${at}.options.range`, `its range "${String(options["range"])}" is not one a calendar opens at`, `Use one of: day, week, month, quarter, year, agenda.`);
      }
    } else if (shipped.binds === "entities") {
      /** A role's binding as the factory reads it: a kind, an edge, a path or a field name. */
      const role = (name: string): string | { path: readonly string[] } | undefined => {
        const binding = bindings[name] as Record<string, unknown> | undefined;
        if (!isRecord(binding)) return undefined;
        if (typeof binding["kind"] === "string") return binding["kind"];
        if (typeof binding["edge"] === "string") return binding["edge"];
        if (Array.isArray(binding["path"])) return { path: binding["path"] as string[] };
        if (typeof binding["field"] === "string") return binding["field"];
        return undefined;
      };
      for (const name of shipped.requiredRoles) if (role(name) === undefined) return; // the binding check says so, as an error
      const kindRole = lens.name === "coverage" ? "rows" : lens.name === "board" ? "slots" : "regions";
      const main = role(kindRole) as string;
      if (!kinds.has(main)) return;
      if (lens.name === "coverage") {
        const columns = role("columns") as string;
        if (!kinds.has(columns)) return;
        const link = role("link");
        if (typeof link === "string" && !edges.has(link)) return;
        Object.assign(options, { rows: main, columns, link });
        if (columns !== main) across = columns;
      } else if (lens.name === "board") {
        Object.assign(options, { slots: main, x: role("x"), y: role("y"), fill: role("fill") });
        for (const field of ["x", "y"]) if (!fieldsOf(main).includes(options[field] as string)) return;
      } else {
        Object.assign(options, { regions: main, outline: role("outline") });
        for (const optional of ["markers", "at", "within", "nests", "regionKind", "markerKind"]) {
          const value = role(optional);
          if (typeof value === "string") options[optional] = value;
        }
      }
      stands = [main];
    } else if (lens.name === "blocks") {
      // A place drawn from blocks stands where it is told, and draws what its blocks say (their words are checked with the views).
      if (!lens.on) return bad(`${at}.on`, "it does not say which kind it stands on", `Say "on": "<the kind it is a place of>".`);
      if (!Array.isArray(options["blocks"]) || options["blocks"].length === 0) return bad(`${at}.options.blocks`, "it has no blocks to draw", `Say "options": { "blocks": [{ "headline": "…" }, { "list": "all('<kind>')", "as": "card" }] }.`);
    } else {
      // The reach lens draws the policy, over the people: it stands where it is told, or on the people.
      const people = ["user", "person", "member"].find((kind) => kinds.has(kind));
      if (!lens.on && !people) return bad(`${at}.on`, "it does not say which kind it stands on", `Say "on": "<the kind whose records are the people>".`);
      stands = people ? [people] : [];
    }

    if (lens.on !== undefined) {
      if (typeof lens.on !== "string" || !kinds.has(lens.on)) {
        return bad(`${at}.on`, `it stands on "${String(lens.on)}", which is not a kind`, `Use one of: ${[...kinds].join(", ")}.`);
      }
      stands = [lens.on];
      // A coverage stood on its columns is across its rows: the other kind is whichever it does not stand on.
      if (lens.name === "coverage") {
        const other = [options["rows"], options["columns"]].find((kind) => kind !== lens.on);
        across = typeof other === "string" ? other : undefined;
      }
    }
    const as = placeSlug(title);
    if (as.length === 0) return bad(`${at}.title`, "its title has no letters or digits to make an address of", "Give it a title a person would say.");
    for (const kind of stands) {
      const key = `${kind}|${as}`;
      if (taken.has(key)) {
        return skip(`another lens on ${kind} is already called "${title}"`, { code: "lens-title-taken", path: `${at}.title`, message: `"${title}" is the title of lenses.${taken.get(key)} too, on the same kind, so one address would name two pictures.`, fix: "Give each its own title." });
      }
    }
    for (const kind of stands) taken.set(`${kind}|${as}`, index);
    drawn.push({ index, lens: lens.name, title, as, kinds: stands, ...(across ? { across } : {}), options });
  });
  return { drawn, undrawn, findings };
}

/**
 * WHERE THE HOME PUTS THINGS AND WHERE THE APP OPENS (FR-80).
 *
 *   pages: { order: ["offer", "package", "signal"], hide: ["party"], first: "The offers" }
 *
 * `order` is the kinds in the order the home, the routed face's nav and the
 * city at altitude walk them; kinds it does not name follow in the order
 * they were declared. `hide` takes kinds off the home — their cards and
 * counts — and nowhere else: a hidden kind keeps its list, its records,
 * its links and its search results. `first` is where the app opens: a
 * place by its title or address word, a kind by its name or plural, or
 * `"home"`. `scene` and `pages` are what the bar's switch calls the two
 * faces (FR-137).
 */
export interface PagesArrangement {
  readonly order?: readonly string[];
  readonly hide?: readonly string[];
  readonly first?: string;
  /**
   * WHAT THE BAR'S SWITCH CALLS THE SCENE (FR-137): "Scene" when the
   * declaration says none. Its address stays `/places/overview` whatever
   * it is called (FR-132).
   */
  readonly scene?: string;
  /** WHAT THE SWITCH CALLS THE ROUTED FACE (FR-137): "Pages" when the declaration says none. */
  readonly pages?: string;
}

/** The scene's address word (FR-132), whatever the declaration calls the scene. */
export const OVERVIEW_SLUG = "overview";
/** The scene's address on the routed face (FR-132); its stop rides on it as the fragment. */
export const OVERVIEW_PATH = `/places/${OVERVIEW_SLUG}`;
/** What the scene is called on the bar's switch (FR-137): the declaration's word, else "Scene". */
export function sceneTitle(pages: PagesArrangement | undefined): string {
  const said = pages?.scene?.trim();
  return said ? said : "Scene";
}
/** What the routed face is called on the bar's switch (FR-137): the declaration's word, else "Pages". */
export function pagesTitle(pages: PagesArrangement | undefined): string {
  const said = pages?.pages?.trim();
  return said ? said : "Pages";
}

/** Kinds in the arrangement's order: those `order` names first, the rest as given. */
export function orderKinds(kinds: readonly string[], order: readonly string[] | undefined): readonly string[] {
  if (!order || order.length === 0) return kinds;
  const named = order.filter((kind) => kinds.includes(kind));
  return [...new Set(named), ...kinds.filter((kind) => !named.includes(kind))];
}

/** Where `first` opens, resolved against the places and kinds a face has. */
export type Opening = { readonly to: "home" } | { readonly to: "place"; readonly place: Place } | { readonly to: "kind"; readonly kind: string };

const pluralWord = (schema: AnySchema, kind: string): string => (schema.tryDefinition(kind)?.plural as string | undefined) ?? `${kind}s`;

export function openingOf(first: string | undefined, schema: AnySchema, places: readonly Place[]): Opening | undefined {
  if (first === undefined) return undefined;
  const word = first.trim();
  if (word === "" ) return undefined;
  if (word.toLowerCase() === "home" || word === "/") return { to: "home" };
  const slug = placeSlug(word);
  const place = places.find((one) => one.title === word) ?? places.find((one) => one.as === slug);
  if (place) return { to: "place", place };
  const kinds = schema.kinds as readonly string[];
  const kind = kinds.find((one) => one === word) ?? kinds.find((one) => placeSlug(pluralWord(schema, one)) === slug);
  return kind ? { to: "kind", kind } : undefined;
}

/** What the arrangement asks that the declaration cannot honor: kinds and places that do not exist. */
export function arrangementFindings<S extends AnySchema>(app: GraviewApp<S>, places: readonly Place[] = placesOfLenses(app)): readonly PlaceFinding[] {
  const pages = app.pages;
  const findings: PlaceFinding[] = [];
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
    for (const kind of lens.kinds) out.push({ kind, title: lens.title, as: lens.as, ...(lens.across ? { across: lens.across } : {}) });
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
  /** The kind it is over; null for the home. */
  readonly kind: string | null;
  readonly cardinality: "many";
  /** Its path on the routed face: `/`, `/<plural>`, `/places/<as>`. */
  readonly address: string;
  /** Its stop in the scene: `#view=<as>`, `#focus=aggregate:<kind>`, or `#`. */
  readonly stop: string;
  /** Which shipped lens draws it, when a declared lens does. */
  readonly lens?: ShippedLensName;
  /** Left off the home by `pages.hide`; still reachable at its address. */
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
  const lensPlaces = placesOfLenses(app);
  const drawn = declaredLenses(app).drawn;
  const opening = openingOf(app.pages?.first, app.schema, lensPlaces);
  const hidden = new Set(app.pages?.hide ?? []);
  const kinds = orderKinds(app.schema.kinds as readonly string[], app.pages?.order);
  const shared = (place: Place) => lensPlaces.some((other) => other.as === place.as && other.kind !== place.kind);
  const out: AppPlace[] = [
    { slug: "home", title: "Home", kind: null, cardinality: "many", address: "/", stop: "#", ...(opening?.to === "home" || (opening === undefined && (app.home?.length ?? 0) > 0) ? { first: true } : {}) },
    // The scene, a place like the others (FR-132): its stop rides on its address.
    { slug: OVERVIEW_SLUG, title: sceneTitle(app.pages), kind: null, cardinality: "many", address: OVERVIEW_PATH, stop: "#" },
  ];
  const byKind = [...lensPlaces].sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
  for (const place of byKind) {
    const lens = drawn.find((one) => one.as === place.as && one.kinds.includes(place.kind));
    const of = shared(place) ? placeSlug(pluralWord(app.schema, place.kind)) : undefined;
    out.push({
      slug: place.as,
      title: place.title,
      kind: place.kind,
      cardinality: "many",
      address: `/places/${encodeURIComponent(place.as)}${of ? `?of=${encodeURIComponent(of)}` : ""}`,
      stop: of ? `#focus=aggregate:${place.kind}&in.view=${encodeURIComponent(place.as)}` : `#view=${encodeURIComponent(place.as)}`,
      ...(lens ? { lens: lens.lens } : {}),
      ...(opening?.to === "place" && opening.place.kind === place.kind && opening.place.as === place.as ? { first: true } : {}),
    });
  }
  for (const kind of kinds) {
    const plural = pluralWord(app.schema, kind);
    out.push({
      slug: placeSlug(plural),
      title: plural,
      kind,
      cardinality: "many",
      address: `/${placeSlug(plural)}`,
      stop: `#focus=aggregate:${kind}`,
      ...(hidden.has(kind) ? { hidden: true } : {}),
      ...(opening?.to === "kind" && opening.kind === kind ? { first: true } : {}),
    });
  }
  return out;
}
