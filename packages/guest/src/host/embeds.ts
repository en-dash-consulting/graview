/*
 * A VIDEO ON YOUTUBE OR VIMEO, NAMED BY A VIEW (HQ f-view-video-embeds):
 * what the view said, read down to a provider and a checked id, and the only
 * addresses made from them.
 *
 *   <graview-video data-provider="youtube" data-video="dQw4w9WgXcQ"></graview-video>
 *   <graview-video data-watch="https://vimeo.com/76979871"></graview-video>
 *
 * THE PROVIDERS ARE A CLOSED LIST, and nothing a view says reaches an
 * address but what is read here: an id of the provider's own alphabet and
 * length, an unlisted Vimeo video's key, a start in whole seconds. The rest
 * of a watch address is dropped, so the host builds each player's address
 * from its own words. Anything else is refused, with why.
 *
 * Pure, and carried by a headless run: no DOM, nothing of the framework's,
 * and no URL parser, which a headless isolate may not have.
 */

/** The providers a view may play a video from. */
export const EMBED_PROVIDERS = ["youtube", "vimeo"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

/** A provider as a person says it. */
export const EMBED_WORDS: Readonly<Record<EmbedProvider, string>> = { youtube: "YouTube", vimeo: "Vimeo" };
/** The one origin each provider's player is drawn from: what a host's `frame-src` lists. */
export const EMBED_ORIGINS: Readonly<Record<EmbedProvider, string>> = { youtube: "https://www.youtube-nocookie.com", vimeo: "https://player.vimeo.com" };

/** The shapes a player may have: its width by its height. */
export const EMBED_SHAPES = ["16:9", "4:3", "1:1", "9:16"] as const;
export type EmbedShape = (typeof EMBED_SHAPES)[number];

export interface NamedEmbed {
  readonly provider: EmbedProvider;
  readonly id: string;
  /** An unlisted Vimeo video's key, as its own address says it. */
  readonly hash?: string;
  /** Where it starts, in whole seconds. */
  readonly start?: number;
  readonly shape: EmbedShape;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/* Words of YouTube's own that stand where an id does, and are no video. */
const NOT_A_VIDEO = new Set(["videoseries", "live_stream"]);
const VIMEO_ID = /^[1-9][0-9]{0,11}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;
/** The latest a video may be started, in seconds: a day. */
const LATEST = 86_400;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com"]);

/** A start as a person or an address says one — `90`, `90s`, `1m30s`, `1h2m3s` — in whole seconds; undefined where it says none. */
export function startOf(said: string | null | undefined): number | undefined {
  if (typeof said !== "string" || said === "" || said.length > 12) return undefined;
  const plain = /^([0-9]{1,6})s?$/.exec(said);
  const parts = plain ? undefined : /^(?:([0-9]{1,2})h)?(?:([0-9]{1,4})m)?(?:([0-9]{1,6})s)?$/.exec(said);
  if (!plain && !parts) return undefined;
  const seconds = plain ? Number(plain[1]) : Number(parts![1] ?? 0) * 3600 + Number(parts![2] ?? 0) * 60 + Number(parts![3] ?? 0);
  return seconds <= LATEST ? seconds : undefined;
}

type Read = Omit<NamedEmbed, "shape"> & { readonly tall?: boolean };

/** One value of a query or a fragment, where it is said exactly once. */
function once(pairs: string, name: string): string | undefined {
  const found = pairs.split("&").flatMap((pair) => (pair.startsWith(`${name}=`) ? [pair.slice(name.length + 1)] : []));
  return found.length === 1 ? found[0] : undefined;
}

/* Plain printable ASCII with no user, port or backslash, and nothing encoded in its path: an address of the providers' own writing, with nothing in it to be read two ways. */
const ADDRESS = /^https?:\/\/([a-z.-]{1,40})(\/[A-Za-z0-9_\-/]{0,120})?(?:\?([A-Za-z0-9_\-.=&~+%:/,]{0,300}))?(?:#([A-Za-z0-9_\-.=&]{0,60}))?$/;

/** The video a watch address names, or undefined where it names none on the list. */
function readAddress(address: string): Read | undefined {
  if (address.length > 500) return undefined;
  const split = ADDRESS.exec(address);
  if (!split) return undefined;
  const host = split[1]!;
  const path = (split[2] ?? "/").replace(/(.)\/$/, "$1");
  const query = split[3] ?? "";
  const fragment = split[4] ?? "";
  const asked = startOf(once(query, "t") ?? once(query, "start") ?? once(fragment, "t"));
  const start = asked ? { start: asked } : {};
  if (host === "youtu.be" || YOUTUBE_HOSTS.has(host)) {
    const short = /^\/([A-Za-z0-9_-]+)$/.exec(path);
    const held = /^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]+)$/.exec(path);
    const id = host === "youtu.be" ? short?.[1] : path === "/watch" ? once(query, "v") : held?.[2];
    if (id === undefined || !YOUTUBE_ID.test(id) || NOT_A_VIDEO.has(id)) return undefined;
    return { provider: "youtube", id, ...start, ...(host !== "youtu.be" && held?.[1] === "shorts" ? { tall: true } : {}) };
  }
  if (VIMEO_HOSTS.has(host) || host === "player.vimeo.com") {
    const held = host === "player.vimeo.com" ? /^\/video\/([0-9]+)$/.exec(path) : /^\/(?:channels\/[A-Za-z0-9_-]+\/)?([0-9]+)(?:\/([0-9a-f]+))?$/.exec(path);
    const id = held?.[1];
    if (id === undefined || !VIMEO_ID.test(id)) return undefined;
    const hash = held?.[2] ?? once(query, "h");
    if (hash !== undefined && !VIMEO_HASH.test(hash)) return undefined;
    return { provider: "vimeo", id, ...(hash ? { hash } : {}), ...start };
  }
  return undefined;
}

/** What an element says, by attribute: `element.getAttribute`. */
export type SaidBy = (name: string) => string | null;

/** Whether a `<graview-video>` names a video on a provider, rather than a record's or the app's own. */
export const namesEmbed = (said: SaidBy): boolean => said("data-provider") !== null || said("data-video") !== null || said("data-watch") !== null;

const shown = (value: string) => JSON.stringify(value.length > 80 ? `${value.slice(0, 79)}…` : value);
const LIST = 'YouTube (data-provider="youtube") and Vimeo (data-provider="vimeo")';

/**
 * The video a `<graview-video>` names on a provider, or why it names none,
 * as the rest of a sentence about it ("it …").
 */
export function namedEmbed(said: SaidBy): { readonly embed: NamedEmbed } | { readonly why: string } {
  const provider = said("data-provider");
  const video = said("data-video");
  const watch = said("data-watch");
  let read: Read | undefined;
  if (watch !== null) {
    if (provider !== null || video !== null) return { why: "names a video twice: by its watch address (data-watch), or by its provider and id (data-provider, data-video), and not both" };
    read = readAddress(watch.trim());
    if (!read) return { why: `names the address ${shown(watch)}, which is no watch address of a provider a view plays: ${LIST}, as https://www.youtube.com/watch?v=<id>, https://youtu.be/<id> or https://vimeo.com/<id>` };
  } else {
    if (provider === null) return { why: `names the video ${shown(video ?? "")} and no provider: a view plays from ${LIST}` };
    if (!(EMBED_PROVIDERS as readonly string[]).includes(provider)) return { why: `names the provider ${shown(provider)}, which is none a view plays from: ${LIST}` };
    const id = video ?? "";
    if (provider === "youtube") {
      if (!YOUTUBE_ID.test(id) || NOT_A_VIDEO.has(id)) return { why: `names the YouTube video ${shown(id)}, which is no id of a video: one is 11 letters, digits, - and _ (the v= of its address)` };
      read = { provider, id };
    } else {
      const split = /^([0-9]+)(?:\/([0-9a-f]+))?$/.exec(id);
      if (!split || !VIMEO_ID.test(split[1]!) || (split[2] !== undefined && !VIMEO_HASH.test(split[2]))) return { why: `names the Vimeo video ${shown(id)}, which is no id of a video: one is digits, with an unlisted video's key after a slash ("76979871/8272103f6e")` };
      read = { provider: "vimeo", id: split[1]!, ...(split[2] ? { hash: split[2] } : {}) };
    }
  }
  const at = said("data-start");
  const start = at === null ? read.start : startOf(at.trim());
  if (at !== null && start === undefined) return { why: `starts at ${shown(at)}, which is no time in it: data-start is whole seconds ("90") or "1m30s", within a day` };
  const asked = said("data-shape");
  if (asked !== null && !(EMBED_SHAPES as readonly string[]).includes(asked)) return { why: `asks for the shape ${shown(asked)}: a player is 16:9, 4:3, 1:1 or 9:16 (data-shape)` };
  return { embed: { provider: read.provider, id: read.id, ...(read.hash ? { hash: read.hash } : {}), ...(start ? { start } : {}), shape: asked !== null ? (asked as EmbedShape) : read.tall ? "9:16" : "16:9" } };
}

/** Which video it is, whatever its start and shape: one player is kept for it across a view's drawings. */
export const embedKey = (embed: NamedEmbed): string => `${embed.provider}:${embed.id}${embed.hash ? `/${embed.hash}` : ""}`;

/** The player's address, the only one a frame is given: played at once, since a person's press asks for it. */
export function embedSrc(embed: NamedEmbed): string {
  if (embed.provider === "youtube") return `${EMBED_ORIGINS.youtube}/embed/${embed.id}?autoplay=1&playsinline=1&rel=0${embed.start ? `&start=${embed.start}` : ""}`;
  return `${EMBED_ORIGINS.vimeo}/video/${embed.id}?autoplay=1&dnt=1${embed.hash ? `&h=${embed.hash}` : ""}${embed.start ? `#t=${embed.start}s` : ""}`;
}

/** Where the video is watched on the provider's own site: the link that is always there. */
export function embedLink(embed: NamedEmbed): string {
  if (embed.provider === "youtube") return `https://www.youtube.com/watch?v=${embed.id}${embed.start ? `&t=${embed.start}s` : ""}`;
  return `https://vimeo.com/${embed.id}${embed.hash ? `/${embed.hash}` : ""}${embed.start ? `#t=${embed.start}s` : ""}`;
}

/** Which providers a host plays from (`embeds` on a view's definition): every one where it says nothing, none for an empty list. */
export interface EmbedHost {
  readonly providers: readonly EmbedProvider[];
}
export const embedPlays = (provider: EmbedProvider, host: EmbedHost | undefined): boolean => host === undefined || host.providers.includes(provider);

/** A title as a view said it, held to a line. */
export const embedTitle = (said: SaidBy, embed: NamedEmbed): string => {
  const given = (said("aria-label") ?? said("title") ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  return given || `A ${EMBED_WORDS[embed.provider]} video`;
};
