import type { GraviewApp } from "./app.js";
import { placesOf, type AppPlace } from "./app-places.js";
import { JOB_SCREEN_PREFIX, MOST_DEVICE_SCREENS, shortScreenLabel, type DeviceScreen } from "./device-shape.js";
import { jobsFor, jobsOf, type ResolvedJob } from "./jobs.js";
import type { Principal } from "./permissions/types.js";
import { HOME_SLUG, OVERVIEW_SLUG, primaryOf, supportingKinds } from "./places.js";
import type { AnySchema } from "./schema/schema.js";
import { humanizeField } from "./schema/define-node.js";
import { placeSlug } from "./views/types.js";

/*
 * WHICH PLACE A SCREEN SHOWS, AND WHICH SCREENS A DEVICE OFFERS (Roadmap
 * f-device-nav-bar). One reading for the checker, the edits and the e-ink
 * render (`@graview/pages/device`), so a screen `graview check` accepts is
 * the screen the strip draws.
 */

/** A screen's place, found: a place of the app or one of its jobs. */
export type ScreenPlace =
  | { readonly is: "place"; readonly place: AppPlace }
  | { readonly is: "job"; readonly job: ResolvedJob };

/** One press of the strip, worked out: where it goes, the word under it, and where the screen came from. */
export interface ResolvedScreen {
  /** Where it goes: a place's address (`/`, `/tasks`, `/places/the-week`), or `job:<name>`. */
  readonly go: string;
  readonly label: string;
  /** What the strip was made from: the app's own `devices.screens`, its jobs, or its bar. */
  readonly from: "declared" | "jobs" | "bar";
}

const said = (text: string) => text.trim().toLowerCase();

/**
 * THE PLACE A SCREEN NAMES, as a place is named anywhere: its address word
 * (`home`, `tasks`, a lens's `as`), its title, its address, the kind whose
 * list it is, or `job:<name>`. The scene (`overview`) is no screen: a device
 * draws no picture that moves. Undefined when it names none of them.
 */
export function screenPlaceOf<S extends AnySchema>(app: GraviewApp<S>, word: string, places: readonly AppPlace[] = placesOf(app)): ScreenPlace | undefined {
  const asked = word.trim();
  if (asked.startsWith(JOB_SCREEN_PREFIX)) {
    const name = asked.slice(JOB_SCREEN_PREFIX.length);
    const job = jobsOf(app).find((one) => one.name === name);
    return job ? { is: "job", job } : undefined;
  }
  const word_ = said(asked);
  const found = places.find(
    (place) =>
      place.slug !== OVERVIEW_SLUG &&
      (place.slug === asked || place.address === asked || said(place.title) === word_ || placeSlug(place.title) === word_ || (place.kind !== null && place.kind === asked && place.address === `/${place.slug}`)),
  );
  return found ? { is: "place", place: found } : undefined;
}

/** Every place a screen's word answers to, the one the strip goes to first: more than one, and the word is ambiguous. */
export function screenPlacesNamed<S extends AnySchema>(app: GraviewApp<S>, word: string, places: readonly AppPlace[] = placesOf(app)): readonly AppPlace[] {
  const asked = word.trim();
  if (asked.startsWith(JOB_SCREEN_PREFIX)) return [];
  const word_ = said(asked);
  return places.filter(
    (place) =>
      place.slug !== OVERVIEW_SLUG &&
      (place.slug === asked || place.address === asked || said(place.title) === word_ || placeSlug(place.title) === word_ || (place.kind !== null && place.kind === asked && place.address === `/${place.slug}`)),
  );
}

/** Where a screen's place goes: its address, or `job:<name>`. */
export const screenGo = (found: ScreenPlace): string => (found.is === "job" ? `${JOB_SCREEN_PREFIX}${found.job.name}` : found.place.address);

/**
 * THE SCREENS A DEVICE OFFERS THIS SEAT, in order, at most
 * `MOST_DEVICE_SCREENS`:
 *
 *   - the app's own `devices.screens`, each that names a place it has (the
 *     checker says of one that does not: `device-screen-place`), and a job
 *     only to a seat it is for;
 *   - else, when the app says what its people come to do, the home and its
 *     jobs for this seat, each under its name in words;
 *   - else the places its bar stands: the home, then each main kind's list
 *     and picture the seat may see — what `pages.primary` names when it
 *     names any.
 */
export function deviceScreensOf<S extends AnySchema>(app: GraviewApp<S>, options: { readonly principal?: Principal; readonly kept?: ReadonlySet<string> } = {}): readonly ResolvedScreen[] {
  const principal: Principal = options.principal ?? { kind: "human" };
  const kept = options.kept ?? new Set<string>();
  const places = placesOf(app);
  const forSeat = new Set(jobsFor(jobsOf(app), principal).map((job) => job.name));
  const shows = (found: ScreenPlace): boolean => (found.is === "job" ? forSeat.has(found.job.name) && !kept.has(found.job.kind) : found.place.kind === null || !kept.has(found.place.kind));

  const declared = Array.isArray(app.devices?.screens) ? (app.devices!.screens as readonly DeviceScreen[]) : undefined;
  if (declared && declared.length > 0) {
    const out: ResolvedScreen[] = [];
    for (const screen of declared) {
      if (typeof screen?.place !== "string" || typeof screen.label !== "string") continue;
      const found = screenPlaceOf(app, screen.place, places);
      if (!found || !shows(found)) continue;
      const go = screenGo(found);
      if (!out.some((one) => one.go === go)) out.push({ go, label: screen.label, from: "declared" });
    }
    return out.slice(0, MOST_DEVICE_SCREENS);
  }

  const home = places.find((place) => place.slug === HOME_SLUG)!;
  const jobs = jobsFor(jobsOf(app), principal).filter((job) => !kept.has(job.kind));
  if (jobs.length > 0) {
    // A word nobody wrote for the strip is held to the strip's length, shortened in words (`shortScreenLabel`).
    return [{ go: home.address, label: shortScreenLabel(home.title), from: "jobs" as const }, ...jobs.map((job) => ({ go: `${JOB_SCREEN_PREFIX}${job.name}`, label: shortScreenLabel(humanizeField(job.name)), from: "jobs" as const }))].slice(0, MOST_DEVICE_SCREENS);
  }

  // The bar: what `pages.primary` stands up, or every kind but the ones that support the others, its lists before its pictures.
  const lensPlaces = places.filter((place) => place.kind !== null && place.address.startsWith("/places/")).map((place) => ({ kind: place.kind!, title: place.title, as: place.slug }));
  const primary = primaryOf(app.pages, app.schema, lensPlaces);
  const supporting = supportingKinds(app.schema, app.pages);
  const stands = (place: AppPlace): boolean => {
    if (place.kind === null || place.hidden || place.slug === OVERVIEW_SLUG || kept.has(place.kind)) return false;
    if (primary) return place.address.startsWith("/places/") ? primary.places.has(`${place.kind}|${place.slug}`) : primary.kinds.has(place.kind);
    return !supporting.has(place.kind);
  };
  const lists = places.filter((place) => stands(place) && !place.address.startsWith("/places/"));
  const pictures = places.filter((place) => stands(place) && place.address.startsWith("/places/"));
  return [home, ...lists, ...pictures].map((place) => ({ go: place.address, label: shortScreenLabel(place.title), from: "bar" as const })).slice(0, MOST_DEVICE_SCREENS);
}
