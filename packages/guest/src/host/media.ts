import { isFileValue, isImage, isVideo, videoWords, type FileValue } from "@graview/core";
import { videoClock } from "@graview/core/blocks";
import type { GuestNode, GuestProps } from "../protocol.js";

/*
 * A RECORD'S VIDEO IN A WORKER VIEW, AND A FULL-SCREEN VIEWER (0.1.37).
 *
 * A worker view may not draw `<video>` (it fetches), may not hold the host's
 * path to a file (FR-175), and may not cover the app (`position: fixed`, the
 * top layer). So it names what it wants and the host draws it, from the
 * records the view was last shown — the viewer's sight cut to its manifest,
 * never more:
 *
 *   <graview-video data-record="moment:x" data-field="clip">
 *       the host draws a player in it: the poster first, the browser's own
 *       controls, `preload="metadata"`, captions where the value carries
 *       them, sized from the value — in a shadow root of its own, so the
 *       view's stylesheet sizes the box and reaches nothing inside it, and
 *       the view hears nothing pressed there.
 *
 *   <button data-lightbox data-record="moment:x" data-field="photo">
 *       a trusted press opens the host's full-screen viewer for that
 *       picture or video: a modal dialog the host draws over the app, which
 *       Escape and its Close button close, giving the keyboard back to the
 *       button. A view's code cannot open it: only the viewer's press does.
 *
 * `data-index` picks one file of a list (0 by default). Both are for a view
 * whose manifest asks for `pictures`; the file comes from where the host
 * serves it (`file`, else the href against the page). A record the view was
 * not shown, a field that holds no picture or video, or a view that did not
 * ask draws nothing, and says why once — in the view's console and to the
 * host's problems — naming the view.
 *
 * Fetched with the first view that places one, never with the page.
 */

export interface GuestMediaOptions {
  /** The view, as a sentence names it: `"Moments"`. */
  readonly view: string;
  /** Whether the view's manifest asks for pictures. */
  readonly pictures: boolean;
  /** The records the view was last shown, as the record keeps each file (before any picture was handed). */
  readonly shown: () => GuestProps | undefined;
  /** Where the page fetches a record's file (`FileValue.href`); undefined leaves it out. The href itself by default. */
  readonly file?: (href: string) => string | undefined;
  /** Something asked for was not drawn, and why, said once. */
  readonly onProblem?: (said: string) => void;
}

export interface GuestMedia {
  /** Draw (or draw again) the player in every `<graview-video>` under `root`. */
  refresh(root: ParentNode): void;
  /** A trusted press on (or in) a `data-lightbox` element: open the viewer. Whether it opened. */
  open(trigger: Element): boolean;
  /** Close the viewer, and let go of every player drawn. */
  dispose(): void;
}

/** The file a `<graview-video>` or a `data-lightbox` names, from what the view was shown; or why it names none. */
export function namedFile(element: Element, shown: GuestProps | undefined, as: "video" | "any"): { readonly file: FileValue; readonly on: GuestNode } | { readonly why: string } {
  const record = element.getAttribute("data-record") ?? "";
  const field = element.getAttribute("data-field") ?? "";
  const index = Number(element.getAttribute("data-index") ?? "0");
  const on = [...(shown?.node ? [shown.node] : []), ...(shown?.nodes ?? [])].find((node) => node.id === record);
  if (!record || !on) return { why: record ? `names a record it was not shown ("${record.slice(0, 80)}")` : "names no record (data-record)" };
  const held = field && Object.hasOwn(on, field) ? (on as unknown as Record<string, unknown>)[field] : undefined;
  const files = (Array.isArray(held) ? held : [held]).filter(isFileValue);
  const file = Number.isInteger(index) && index >= 0 ? files[index] : undefined;
  const label = on.label ? `"${on.label}"` : "a record";
  if (!field) return { why: `names no field of ${label} (data-field)` };
  if (!file) return { why: files.length === 0 ? `names "${field}" on ${label}, which holds no file it was shown` : `names file ${element.getAttribute("data-index")} of "${field}" on ${label}, which holds ${files.length}` };
  if (as === "video" ? !isVideo(file) : !isVideo(file) && !isImage(file)) return { why: `names "${file.name}" on ${label}, which is not ${as === "video" ? "a video" : "a picture or a video"}` };
  return { file, on };
}

/** A video said to somebody who cannot see it. */
const videoLabel = (file: FileValue) => `${file.caption?.trim() || file.name}, ${videoWords(file)}`;

/** The player, drawn in `into`: what the face draws (primitives' files), with the DOM alone. */
function drawPlayer(document: Document, into: ParentNode, file: FileValue, at: (href: string) => string | undefined, src: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.setAttribute("data-graview-video", "");
  video.setAttribute("controls", "");
  video.setAttribute("preload", "metadata");
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-label", videoLabel(file));
  const poster = file.poster ? at(file.poster) : undefined;
  if (poster) video.setAttribute("poster", poster);
  if (file.width && file.height) {
    video.setAttribute("width", String(file.width));
    video.setAttribute("height", String(file.height));
    video.style.aspectRatio = `${file.width} / ${file.height}`;
  } else video.style.aspectRatio = "16 / 9";
  video.style.cssText += ";display:block;width:100%;height:auto;max-height:80vh;background:#000;border-radius:var(--graview-radius, 8px)";
  const captions = file.captions ? at(file.captions) : undefined;
  if (captions) {
    const track = document.createElement("track");
    track.setAttribute("kind", "captions");
    track.setAttribute("src", captions);
    track.setAttribute("srclang", "en");
    track.setAttribute("label", "Captions");
    track.setAttribute("default", "");
    video.appendChild(track);
  }
  /* Its length where the value did not say it, read from what the player loaded first, for who listens. */
  if (file.duration === undefined) video.addEventListener("loadedmetadata", () => Number.isFinite(video.duration) && video.duration > 0 && video.setAttribute("aria-label", videoLabel({ ...file, duration: video.duration })));
  video.setAttribute("src", src);
  into.appendChild(video);
  return video;
}

export function createGuestMedia(window: Window & typeof globalThis, options: GuestMediaOptions): GuestMedia {
  const document = window.document;
  const told = new Set<string>();
  const say = (said: string) => {
    if (told.has(said)) return;
    told.add(said);
    options.onProblem?.(said);
  };
  /** A path on the host, as a record keeps one, where the host serves it, on this page's own origin only. */
  const at = (href: string): string | undefined => {
    const given = options.file ? options.file(href) : href;
    if (given === undefined) return undefined;
    try {
      const url = new window.URL(given, document.baseURI);
      return url.origin === window.location.origin && /^https?:$/.test(url.protocol) ? given : undefined;
    } catch {
      return undefined;
    }
  };
  /** What each player was drawn for: drawn again only when the file it names moved. */
  const drawn = new WeakMap<Element, string>();
  let dialog: HTMLDialogElement | undefined;
  /* Closed as a dialog closes, where the engine has no `close` of its own. */
  const shut = (box: HTMLDialogElement) => {
    if (typeof box.close === "function") return box.close();
    box.removeAttribute("open");
    box.dispatchEvent(new window.Event("close"));
  };

  const refused = (what: string, why: string) => say(`The ${what} in the view ${options.view} was not drawn: it ${why}.`);

  return {
    refresh(root) {
      const shown = options.shown();
      for (const element of Array.from(root.querySelectorAll("graview-video"))) {
        const shadow = element.shadowRoot ?? element.attachShadow({ mode: "open" });
        if (!options.pictures) {
          drawn.delete(element);
          shadow.replaceChildren();
          refused("video", 'asks for no pictures: a view places a record\'s video where its manifest says "pictures": true');
          continue;
        }
        const named = namedFile(element, shown, "video");
        const key = "file" in named ? JSON.stringify(named.file) : "";
        if (drawn.get(element) === key && shadow.childNodes.length > 0) continue;
        drawn.set(element, key);
        shadow.replaceChildren();
        if ("why" in named) {
          refused("video", named.why);
          continue;
        }
        const src = at(named.file.href);
        if (!src) {
          refused("video", `names "${named.file.name}", which this host does not say it serves on this page`);
          continue;
        }
        const style = document.createElement("style");
        style.textContent = ":host { display: block; min-width: 0; }";
        shadow.appendChild(style);
        drawPlayer(document, shadow, named.file, at, src);
      }
    },
    open(trigger) {
      if (!options.pictures) {
        refused("full-screen viewer", 'asks for no pictures: a view opens a record\'s picture or video full screen where its manifest says "pictures": true');
        return false;
      }
      const named = namedFile(trigger, options.shown(), "any");
      if ("why" in named) {
        refused("full-screen viewer", named.why);
        return false;
      }
      const src = at(named.file.href);
      if (!src) {
        refused("full-screen viewer", `names "${named.file.name}", which this host does not say it serves on this page`);
        return false;
      }
      if (dialog) shut(dialog);
      const file = named.file;
      const shownAs = file.caption?.trim() || file.name;
      const box = document.createElement("dialog");
      box.setAttribute("data-graview-lightbox", "");
      box.setAttribute("aria-label", isVideo(file) ? videoLabel(file) : shownAs);
      box.style.cssText = "padding:0;border:0;border-radius:var(--graview-radius, 8px);max-width:min(96vw, 1600px);max-height:94vh;background:var(--graview-panel, Canvas);color:var(--graview-ink, CanvasText)";
      const figure = document.createElement("figure");
      figure.style.cssText = "margin:0;display:grid;gap:8px;padding:10px";
      if (isVideo(file)) drawPlayer(document, figure, file, at, src);
      else {
        const image = document.createElement("img");
        image.setAttribute("src", src);
        image.setAttribute("alt", shownAs);
        image.style.cssText = "max-width:100%;max-height:80vh;object-fit:contain;display:block;margin:0 auto";
        figure.appendChild(image);
      }
      const caption = document.createElement("figcaption");
      caption.style.cssText = "display:flex;gap:12px;align-items:center;justify-content:space-between";
      const words = document.createElement("span");
      words.textContent = isVideo(file) && file.duration !== undefined ? `${shownAs} · ${videoClock(file.duration)}` : shownAs;
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Close";
      close.addEventListener("click", () => shut(box));
      caption.append(words, close);
      figure.appendChild(caption);
      box.appendChild(figure);
      /* A press on the dimmed page around it closes it; closed, it is gone, and the keyboard is back on what opened it. */
      box.addEventListener("click", (event) => event.target === box && shut(box));
      box.addEventListener("close", () => {
        box.remove();
        if (dialog === box) dialog = undefined;
        (trigger as HTMLElement).focus?.();
      });
      document.body.appendChild(box);
      dialog = box;
      if (typeof box.showModal === "function") box.showModal();
      else box.setAttribute("open", "");
      close.focus();
      return true;
    },
    dispose() {
      if (dialog) shut(dialog);
      dialog?.remove();
      dialog = undefined;
    },
  };
}
