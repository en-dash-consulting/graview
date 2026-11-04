/*
 * WHERE A CHANGE SHOWS (Roadmap f-views-know-today).
 *
 * An act's answer said what it changed and nothing of where a person would
 * see it, so an agent that added three tasks reported done while the home
 * that lists them still drew the day before. Handed a commit's ops, this
 * names the places that draw the records it touched — the home, a kind's
 * list, a lens, a view the host keeps — so the answer can say "these appear
 * on Home and Tasks", and flags each such place a script view draws, with
 * what its source pins a day to (`datesPinned`), so the agent looks at it.
 */
import type { GraviewApp } from "../app.js";
import { placesOf } from "../app-places.js";
import type { Primitive } from "../graph/primitives.js";
import { HOME_SLUG, OVERVIEW_SLUG } from "../places.js";
import type { AnySchema } from "../schema/schema.js";
import { datesPinned, type PinnedDate } from "./pinned-dates.js";

/** A view the host keeps, as its manifest says it, and its source where the host has it. */
export interface TouchedView {
  readonly name: string;
  readonly title?: string;
  /** The kind it is a picture of, or "home". */
  readonly attach: string;
  readonly cardinality?: "one" | "many";
  readonly hidden?: boolean;
  /** The other kinds it is handed (its manifest's `reads.kinds`). */
  readonly reads?: { readonly kinds?: readonly string[] };
  /** Its script, read for a day it pins. */
  readonly source?: string;
}

export interface PlacesTouchedOptions {
  /** A record's kind by its id, for an op that names a record without carrying it (a field changed, a link made): `(id) => store.graph.getNode(id)?.kind`. */
  readonly kindOf?: (id: string) => string | undefined;
  /** The views the host keeps. */
  readonly views?: readonly TouchedView[];
  /** The app's today (`store.today() ?? isoToday()`): with it, a view's source is read for a day it pins. */
  readonly today?: string;
  readonly locale?: string;
}

/** A place that draws a record a change touched. */
export interface TouchedPlace {
  readonly slug: string;
  readonly title: string;
  readonly address: string;
  /** The kinds of the touched records it draws. */
  readonly kinds: readonly string[];
  /** The host's view that draws it, by name, when a script view does: what to look at after the change. */
  readonly view?: string;
  /** What that view's source pins a day to, each in a sentence. */
  readonly pinned?: readonly PinnedDate[];
}

export interface PlacesTouched {
  /** The kinds of the records the ops touched. */
  readonly kinds: readonly string[];
  readonly places: readonly TouchedPlace[];
  readonly said: readonly string[];
  /** "These appear on Home and Tasks. Home is drawn by a view (front): look at it after this change." */
  readonly text: string;
}

const andList = (items: readonly string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** The kinds of the records a commit's primitives touch: a record made, changed or removed, and both ends of a link. */
function kindsTouched(ops: readonly { readonly primitives: readonly Primitive[] }[], kindOf: (id: string) => string | undefined): string[] {
  const kinds = new Set<string>();
  const add = (kind: string | undefined) => kind !== undefined && kinds.add(kind);
  for (const op of ops) {
    for (const one of op.primitives ?? []) {
      if (one.op === "add-node" || one.op === "remove-node") add(one.node.kind as string);
      else if (one.op === "patch-node" || one.op === "splice-text") add(kindOf(one.id));
      else if (one.op === "add-edge" || one.op === "remove-edge") {
        add(kindOf(one.edge.from));
        add(kindOf(one.edge.to));
      }
    }
  }
  return [...kinds];
}

/** The kinds a declared home's blocks list (`all('task')`), read from their text. */
function kindsOfDeclaredHome(home: unknown, kinds: readonly string[]): string[] {
  const text = JSON.stringify(home ?? null);
  return kinds.filter((kind) => new RegExp(`['"]${kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\\\?['"]`).test(text));
}

/**
 * THE PLACES THAT DRAW WHAT A COMMIT TOUCHED: given its ops (`Operation`s,
 * or anything with their `primitives`), each place of the app — the home,
 * a lens, a kind's list, a view the host keeps — that draws a record of a
 * kind it made, changed, removed or linked, in the app's order, with the
 * view that draws it and what that view pins a day to.
 */
export function placesTouched<S extends AnySchema>(app: GraviewApp<S>, ops: readonly { readonly primitives: readonly Primitive[] }[], options: PlacesTouchedOptions = {}): PlacesTouched {
  const kinds = kindsTouched(ops, options.kindOf ?? (() => undefined));
  const views = options.views ?? [];
  const declared = app.schema.kinds as readonly string[];
  const pinnedBy = (view: TouchedView | undefined, title: string) =>
    view?.source !== undefined && options.today !== undefined ? datesPinned(view.source, { today: options.today, title, ...(options.locale ? { locale: options.locale } : {}) }) : [];
  const places: TouchedPlace[] = [];
  for (const place of placesOf(app, { views })) {
    if (place.slug === OVERVIEW_SLUG) continue;
    let drawn: readonly string[];
    let view: TouchedView | undefined;
    if (place.slug === HOME_SLUG) {
      view = views.find((one) => one.attach === "home");
      drawn = view ? (view.reads?.kinds ?? []) : (app.home?.length ?? 0) > 0 ? kindsOfDeclaredHome(app.home, declared) : declared.filter((kind) => !(app.pages?.hide ?? []).includes(kind));
    } else {
      view = place.view !== undefined ? views.find((one) => one.name === place.view) : undefined;
      drawn = [...(place.over ?? (place.kind ? [place.kind] : [])), ...(view?.reads?.kinds ?? [])];
    }
    const touched = kinds.filter((kind) => drawn.includes(kind));
    if (touched.length === 0) continue;
    const pinned = pinnedBy(view, place.title);
    places.push({ slug: place.slug, title: place.title, address: place.address, kinds: touched, ...(view ? { view: view.name } : {}), ...(pinned.length > 0 ? { pinned } : {}) });
  }
  const said: string[] = [];
  if (places.length > 0) said.push(`These appear on ${andList(places.map((place) => place.title))}.`);
  for (const place of places) {
    if (!place.view) continue;
    said.push(place.pinned ? `${place.title} is drawn by a view (${place.view}) that writes its own dates: look at it after this change.` : `${place.title} is drawn by a view (${place.view}): look at it after this change.`);
    for (const one of place.pinned ?? []) said.push(one.says);
  }
  return { kinds, places, said, text: said.length > 0 ? said.join(" ") : "Nothing this change touched is drawn on a place of this app." };
}
