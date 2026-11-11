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

/** What a reader sees as one character: a grapheme, however many code units spell it. */
function characters(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => { segment(text: string): Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? [...new Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((one) => one.segment) : Array.from(text);
}

/** A character as wide as two of the strip's: East Asian wide and full-width forms, the pictures emoji draw, and a flag (a pair of regional indicators). */
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u;

/** How much of the strip a word takes under its press: one for each character a reader sees, two for a full-width one. */
export function screenLabelWidth(text: string): { readonly width: number; readonly wide: boolean } {
  let width = 0;
  let wide = false;
  for (const one of characters(text.trim())) {
    const isWide = WIDE.test(one);
    wide ||= isWide;
    width += isWide ? 2 : 1;
  }
  return { width, wide };
}

/** Words a shortened label does not end on: "Unbooked and…" says less than "Unbooked…". */
const CONNECTORS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);

/**
 * A WORD FOR THE STRIP, from a longer one: a title or a job's name worked
 * out for a screen nobody declared. Its leading article goes first ("The
 * fortnight" is "Fortnight"); then as many whole words as fit with an
 * ellipsis, never ending on "and" or "of"; and only a first word too long
 * for the press is cut inside itself.
 */
export function shortScreenLabel(text: string): string {
  const said = text.trim().replace(/\s+/g, " ");
  if (screenLabelWidth(said).width <= LONGEST_SCREEN_LABEL) return said;
  const bare = said.replace(/^(the|a|an)\s+/i, "");
  const capital = bare.charAt(0).toUpperCase() + bare.slice(1);
  if (screenLabelWidth(capital).width <= LONGEST_SCREEN_LABEL) return capital;
  const room = LONGEST_SCREEN_LABEL - 1;
  const kept: string[] = [];
  for (const word of capital.split(" ")) {
    if (screenLabelWidth([...kept, word].join(" ")).width > room) break;
    kept.push(word);
  }
  while (kept.length > 1 && CONNECTORS.has(kept[kept.length - 1]!.toLowerCase())) kept.pop();
  if (kept.length > 0) return `${kept.join(" ")}…`;
  let cut = "";
  for (const one of characters(capital)) {
    if (screenLabelWidth(`${cut}${one}`).width > room) break;
    cut += one;
  }
  return `${cut}…`;
}
