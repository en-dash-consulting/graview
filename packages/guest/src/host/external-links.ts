import type { GuestProps } from "../protocol.js";

/*
 * A VIEW'S LINK OUT (Threat Watch, 2026-10-21): an `<a href>` to somewhere
 * that is not this app — a record's own `url`, its contact's `mailto:`, its
 * `tel:` — judged by the page and by a headless run alike.
 *
 * WHAT A VIEW MAY LINK TO IS WHAT IT WAS HANDED. A view reads what the seat
 * sees and can write any string, and a link is a request the person makes
 * with one press: `https://elsewhere.example/?d=` and whatever the view
 * read would carry it out of the app however the link looked. So the host
 * draws an `href` only where its address is one a record the view was
 * shown holds, as the record holds it — the view chose which, never what
 * it says — or, where the host lists origins for links (`links.origins`,
 * on the view's definition, as `images.origins` is for images), any
 * `https:` address on one of them: the host's choice, made for the place.
 * A manifest cannot widen it; the manifest is the view author's own word.
 *
 * Only `https:`, `mailto:` and `tel:`: never `javascript:`, `data:`,
 * `blob:`, `http:` or a path of the app's, which a link of the app's own
 * (`data-record`, `data-place`) already goes to without an address.
 *
 * Pure, and carried by the headless runtime: no DOM, nothing of the
 * framework's.
 */

/** The schemes a view's link out may have. */
export const LINK_SCHEMES: readonly string[] = ["https:", "mailto:", "tel:"];

/** An address as the URL parser says it, where its scheme is one a link takes and it names nobody's password; nothing otherwise. */
export function linkAddress(value: string): string | undefined {
  if (typeof value !== "string" || value.length > 2_000 || /[\s<>"]/.test(value.trim()) || value.trim() !== value) return undefined;
  try {
    const parsed = new URL(value);
    if (!LINK_SCHEMES.includes(parsed.protocol)) return undefined;
    if (parsed.protocol === "https:" && (parsed.hostname === "" || parsed.username !== "" || parsed.password !== "")) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** Every address a view was handed that a link may go to: the values of the records it was shown, each as the URL parser says it. */
export function handedLinks(props: GuestProps | undefined): ReadonlySet<string> {
  const handed = new Set<string>();
  const take = (value: unknown) => {
    if (typeof value !== "string" || !/^(https|mailto|tel):/i.test(value)) return;
    const address = linkAddress(value);
    if (address) handed.add(address);
  };
  for (const node of [...(props?.node ? [props.node] : []), ...(props?.nodes ?? [])]) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "id" || key === "kind") continue;
      if (Array.isArray(value)) value.forEach(take);
      else take(value);
    }
  }
  return handed;
}

/** The https: origins of a host's list, as the URL parser says them. */
export function linkOriginsOf(listed: readonly string[] | undefined): readonly string[] {
  return (listed ?? []).flatMap((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "https:" && parsed.hostname !== "" && parsed.username === "" && parsed.password === "" ? [parsed.origin] : [];
    } catch {
      return [];
    }
  });
}

export interface LinkHost {
  /** What the view was handed: `handedLinks(props)`. */
  readonly handed: ReadonlySet<string>;
  /** The https: origins the host lists for links: none by default. */
  readonly origins?: readonly string[];
}

/** The address the host draws for a view's `href`, or undefined where it draws none. */
export function judgeLink(value: string, host: LinkHost): string | undefined {
  const address = linkAddress(value);
  if (!address) return undefined;
  if (host.handed.has(address)) return address;
  if (address.startsWith("https:") && linkOriginsOf(host.origins).includes(new URL(address).origin)) return address;
  return undefined;
}

/** Why a view's link was not drawn, in a sentence for its author, offering only what this host draws. */
export function linkRefusedWords(address: string, origins?: readonly string[]): string {
  const shown = address.length > 120 ? `${address.slice(0, 119)}…` : address;
  let scheme = "";
  try {
    scheme = new URL(address).protocol;
  } catch {
    scheme = "";
  }
  if (!LINK_SCHEMES.includes(scheme)) return `The link "${shown}" was not drawn: a view links only to an https:, mailto: or tel: address.`;
  const listed = linkOriginsOf(origins);
  return `The link "${shown}" was not drawn: it is no address this view was handed. A view links out only to an address a record it was shown holds (a url field), as the record holds it${listed.length > 0 ? `, or an https: address on ${listed.join(", ")}` : ""}; a record or a place of this app is <a data-record> or <a data-place>.`;
}
