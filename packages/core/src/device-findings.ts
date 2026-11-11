import type { GraviewApp } from "./app.js";
import { placesOf } from "./app-places.js";
import { error, type Finding } from "./document/findings.js";
import { DevicesSpec } from "./document/devices-spec.js";
import type { GraviewDocument } from "./document/schema.js";
import { screenPlaceOf, screenGo } from "./device-screens.js";
import { LONGEST_SCREEN_LABEL, MOST_DEVICE_SCREENS, screenLabelWidth, shortScreenLabel, type AppDevices, type DeviceScreen } from "./device-shape.js";
import { HOME_SLUG, OVERVIEW_SLUG } from "./places.js";
import { jobsOf } from "./jobs.js";
import type { AnySchema } from "./schema/schema.js";

/*
 * A DECLARATION'S DEVICE SCREENS, JUDGED (Roadmap f-device-nav-bar), in one
 * vocabulary for a document, a TypeScript app and an edit: each screen
 * names a place the app has, under a word the strip has room for, and the
 * strip holds them all.
 *
 * Codes: `device-screen-place`, `device-screen-label`, `device-screen-twice`,
 * `device-screens-too-many` — every one an error.
 */

export type DeviceFindingCode = "device-screen-place" | "device-screen-label" | "device-screen-twice" | "device-screens-too-many";

export interface DeviceFinding {
  readonly code: DeviceFindingCode;
  /** Which screen (its place in `screens`); none for what is wrong with the list. */
  readonly index?: number;
  readonly key?: keyof DeviceScreen;
  readonly message: string;
  readonly fix: string;
}

const quotedList = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** The words a screen may name a place by: every place's address word but the scene's, and each job as `job:<name>`. */
export function screenWords<S extends AnySchema>(app: GraviewApp<S>): readonly string[] {
  return [...placesOf(app).filter((place) => place.slug !== OVERVIEW_SLUG).map((place) => place.slug), ...jobsOf(app).map((job) => `job:${job.name}`)];
}

/** Every finding about an app's device screens, in the order they stand. */
export function deviceFindings<S extends AnySchema>(devices: AppDevices | undefined, app: GraviewApp<S>): DeviceFinding[] {
  const screens = devices?.screens ?? [];
  const out: DeviceFinding[] = [];
  if (screens.length > MOST_DEVICE_SCREENS) {
    out.push({
      code: "device-screens-too-many",
      message: `The app offers ${screens.length} device screens; the strip holds ${MOST_DEVICE_SCREENS} beside Refresh, each wide enough for a finger.`,
      fix: `Keep the ${MOST_DEVICE_SCREENS} people go to most; the others stay a press away from those.`,
    });
  }
  const places = placesOf(app);
  const went = new Map<string, number>();
  screens.forEach((screen, index) => {
    const said = `Device screen ${index + 1} ("${screen.label}")`;
    const found = screenPlaceOf(app, screen.place, places);
    if (!found) {
      const scene = screen.place.trim() === OVERVIEW_SLUG;
      out.push({
        code: "device-screen-place",
        index,
        key: "place",
        message: scene ? `${said} names the scene, which moves, and a device draws no picture that moves.` : `${said} names "${screen.place}", which is not a place of this app.`,
        fix: `Name one of its places: ${quotedList(screenWords(app))}.`,
      });
    } else {
      const go = screenGo(found);
      const first = went.get(go);
      if (first !== undefined) out.push({ code: "device-screen-twice", index, key: "place", message: `${said} goes where screen ${first + 1} already goes (${go === "/" ? HOME_SLUG : go}).`, fix: "Give each screen a place of its own, or take this one away." });
      else went.set(go, index);
    }
    // Counted as a reader sees it: one for each character however it is spelled, two for a full-width one.
    const label = screen.label.trim();
    const { width, wide } = screenLabelWidth(label);
    if (width === 0 || width > LONGEST_SCREEN_LABEL) {
      out.push({
        code: "device-screen-label",
        index,
        key: "label",
        message: width === 0 ? `Device screen ${index + 1} has no word under its press.` : `${said} is ${width} characters${wide ? " wide, a full-width character counting as two" : ""}, and the strip has room for ${LONGEST_SCREEN_LABEL} under each press.`,
        fix: `Say it in ${LONGEST_SCREEN_LABEL} characters or fewer${width > 0 ? `, like "${shortScreenLabel(label)}"` : ""}.`,
      });
    }
  });
  return out;
}

/** A device finding's place in a document: `devices.screens.2.label`, or `devices.screens` for the list. */
export const documentDevicePath = (finding: Pick<DeviceFinding, "index" | "key">): string =>
  `devices.screens${finding.index === undefined ? "" : `.${finding.index}${finding.key ? `.${finding.key}` : ""}`}`;

/** The shape of a document's `devices`, said as the compiler says a document's: nothing, when it is one. */
export function devicesShapeFindings(devices: unknown, at = "devices"): Finding[] {
  if (devices === undefined) return [];
  const parsed = DevicesSpec.safeParse(devices);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const path = [at, ...issue.path.map(String)].join(".");
    const keys = (issue as { keys?: readonly string[] }).keys;
    return keys ? error("unknown-key", path, `${keys.map((k) => `"${k}"`).join(", ")} ${keys.length === 1 ? "is" : "are"} not part of a Graview document here`, "devices says screens; a screen says place and label") : error("shape", path, issue.message);
  });
}

/** A document's device screens, judged with its own sentences at its own paths, over the app it compiles to. */
export function documentDeviceFindings<S extends AnySchema>(document: GraviewDocument, app: GraviewApp<S>): Finding[] {
  if (document.devices === undefined) return [];
  const shape = devicesShapeFindings(document.devices);
  if (shape.length > 0) return shape;
  return deviceFindings(document.devices, app).map((finding) => error(finding.code, documentDevicePath(finding), finding.message, finding.fix));
}
