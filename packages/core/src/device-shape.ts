/*
 * THE SCREENS A DEVICE OFFERS (Roadmap f-device-nav-bar).
 *
 *   devices: { screens: [{ place: "home", label: "Today" }, { place: "tasks", label: "Tasks" }] }
 *
 * A device that shows an app on a fixed screen — an e-ink reader on a wall,
 * a kitchen tablet — has no bar to hunt through and no keyboard: it has a
 * strip along its bottom, one press per screen, and Refresh. An app says
 * which of its places that strip offers, in order, each under a word short
 * enough for the strip. Unsaid, the strip is worked out from the app's jobs,
 * else from its bar (`deviceScreensOf`, `@graview/core/seat`).
 *
 * The same shape in a document (`devices`) and in `defineApp({ devices })`;
 * `graview check` holds each screen to the app's places (`device-*`).
 */

/** One screen of the strip: the place it shows and the word under its press. */
export interface DeviceScreen {
  /**
   * The place, as a place is named anywhere: its address word (`home`,
   * `tasks`, a lens's `as`), its title, its address (`/tasks`,
   * `/places/the-week`), or one of the app's jobs as `job:<name>`.
   */
  readonly place: string;
  /** The word under its press on the strip: at most `LONGEST_SCREEN_LABEL` characters. */
  readonly label: string;
}

/** What an app says of the devices that show it. */
export interface AppDevices {
  /** The strip's screens in order, at most `MOST_DEVICE_SCREENS`. */
  readonly screens?: readonly DeviceScreen[];
}

/**
 * THE MOST SCREENS A STRIP HOLDS. Refresh takes a press of its own, so four
 * screens make five presses: at the narrowest device the framework draws for
 * (a reader 758 px wide) each is 151 px, past twice the 64 px a finger needs,
 * with room for a word in type read at arm's length.
 */
export const MOST_DEVICE_SCREENS = 4;

/** The longest word under a press: twelve characters fit 151 px at the strip's 22 px type. */
export const LONGEST_SCREEN_LABEL = 12;

/** A job named as a screen's place: `job:<name>`. */
export const JOB_SCREEN_PREFIX = "job:";
