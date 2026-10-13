import type { FileValue } from "@graview/core";
import type { GuestFile, GuestNode, GuestProps } from "../protocol.js";

/*
 * THE PICTURES ON THE RECORDS A GUEST IS HANDED (FR-175).
 *
 * A record keeps a file as a path on the host (FR-162), which the host
 * serves to the app's members with their credentials. A worker view and a
 * frame run at an opaque origin, so that path is nothing they can load —
 * and nothing they should learn. A guest that asks for pictures (a worker
 * view's manifest says `pictures`; a frame's host says it for the frame)
 * is handed each file as a `GuestFile` instead: a picture with an address
 * the host made from the bytes it fetched as the reader, as the brand's
 * logo is (FR-127), and a document as its name, type and size.
 *
 * Only what the guest is handed is fetched: its props are the reader's
 * sight cut to what the guest reads, so a file on a record the seat may not
 * see is never asked for. Within budgets: one picture is at most
 * `pictureBytes` as handed, and the pictures a view is handed together at
 * most `picturesBytes`; a picture wider than the view draws one is made
 * smaller first. What is left out says why, naming the view.
 */

/** What a guest asks for: `true`, or the widest it draws a picture, in CSS pixels (1 200 by default). */
export type GuestPictures = true | { readonly width?: number };

/** How many bytes of pictures a guest is handed. */
export interface GuestPictureLimits {
  /** The most one picture may be, as handed (made smaller first where it can be). 1 500 000 by default. */
  readonly pictureBytes?: number;
  /** The most the pictures a view is handed may be together. 12 000 000 by default. */
  readonly picturesBytes?: number;
}

/** The widest a picture is drawn, by default, in CSS pixels. */
export const PICTURE_WIDTH = 1_200;
/** A file larger than this, as the record says it, is not fetched for a guest at all. */
export const PICTURE_FETCH_BYTES = 40_000_000;

/** Whether a file is a picture a guest is handed an address for: an image, not an SVG, which could act. */
export const isGuestPicture = (file: { readonly type: string }): boolean => /^image\//i.test(file.type) && !/^image\/svg/i.test(file.type);

/** A file as a guest is handed it, before the host has its bytes: no path, and for a picture its facts. */
export function guestFileOf(file: FileValue, more: { readonly src?: string; readonly left?: string } = {}): GuestFile {
  const base = { name: file.name, type: file.type, bytes: file.bytes };
  if (!isGuestPicture(file)) return base;
  return {
    ...base,
    ...(file.width !== undefined ? { width: file.width } : {}),
    ...(file.height !== undefined ? { height: file.height } : {}),
    ...(file.caption !== undefined ? { caption: file.caption } : {}),
    ...(more.src !== undefined ? { src: more.src } : {}),
    ...(more.left !== undefined ? { left: more.left } : {}),
  };
}

const KEPT = new Set(["id", "kind", "label"]);

/* A file as a record keeps one: the store let in nothing else of this shape (`isFileValue`, FR-162), so its shape is enough here, without the store's checks on the page. */
const isFile = (value: unknown): value is FileValue => {
  const file = value as Partial<Record<keyof FileValue, unknown>> | null;
  return typeof file === "object" && file !== null && typeof file.href === "string" && typeof file.name === "string" && typeof file.type === "string" && typeof file.bytes === "number";
};

/**
 * EVERY FILE ON THE RECORDS IN `props`, as `hand` makes it — a field that
 * holds one, or a list of them — in the order a reader meets them: the
 * view's own record, then the others. Nothing else is changed.
 */
export function handFiles(props: GuestProps, hand: (file: FileValue, on: GuestNode) => GuestFile): GuestProps {
  const node = (one: GuestNode): GuestNode => {
    let changed: Record<string, unknown> | undefined;
    for (const [key, value] of Object.entries(one)) {
      if (KEPT.has(key)) continue;
      const files = isFile(value) ? hand(value, one) : Array.isArray(value) && value.length > 0 && value.every(isFile) ? value.map((file) => hand(file, one)) : undefined;
      if (files !== undefined) (changed ??= { ...one })[key] = files;
    }
    return (changed as GuestNode | undefined) ?? one;
  };
  return { ...props, ...(props.node ? { node: node(props.node) } : {}), ...(props.nodes ? { nodes: props.nodes.map(node) } : {}) };
}

export interface GuestPicturesOptions {
  /** `"blob"` for a worker view, drawn in this page (a `data:` image where the page's policy refuses `blob:`); `"data"` for a frame, another origin. */
  readonly as: "blob" | "data";
  /** The view, as a sentence names it: its title, else its name. */
  readonly view: string;
  readonly pictures: GuestPictures;
  readonly limits?: GuestPictureLimits;
  /** A picture is ready, or was left out: push again. */
  readonly moved: () => void;
  /** A picture was left out, and why, said once. */
  readonly onLeft?: (said: string) => void;
  /** How the bytes are made smaller: to at most `width` pixels across, and `bytes` bytes. The canvas, by default. */
  readonly shrink?: (blob: Blob, width: number, bytes: number) => Promise<Blob | undefined>;
}

export interface GuestPictureHand {
  /** `props` with each file as the guest is handed it, starting what has not been fetched. */
  hand(props: GuestProps): GuestProps;
  /** Let go of every address made. */
  dispose(): void;
}

type Entry =
  | { readonly state: "pending"; readonly bytes: number }
  | { readonly state: "ready"; readonly url: string; readonly bytes: number }
  | { readonly state: "left"; readonly said: string };

const said = (n: number) => n.toLocaleString("en-US");

/**
 * THE HOST'S PICTURES FOR ONE GUEST: fetched once each, on the page's own
 * origin with the reader's credentials, made smaller where the view needs
 * no more, and let go when no record handed holds them.
 */
export function createGuestPictures(window: Window & typeof globalThis, options: GuestPicturesOptions): GuestPictureHand {
  const width = options.pictures === true ? PICTURE_WIDTH : (options.pictures.width ?? PICTURE_WIDTH);
  const perFile = options.limits?.pictureBytes ?? 1_500_000;
  const perView = options.limits?.picturesBytes ?? 12_000_000;
  /* As many device pixels as the screen draws a CSS pixel with, up to two. */
  const need = Math.round(width * Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
  const shrink = options.shrink ?? ((blob: Blob, across: number, bytes: number) => shrinkOnCanvas(window, blob, across, bytes));
  const entries = new Map<string, Entry>();
  const told = new Set<string>();
  let disposed = false;
  let moving = false;
  const moved = () => {
    if (moving || disposed) return;
    moving = true;
    queueMicrotask(() => {
      moving = false;
      if (!disposed) options.moved();
    });
  };
  const tell = (text: string) => {
    if (told.has(text)) return;
    told.add(text);
    options.onLeft?.(text);
  };
  const release = (entry: Entry | undefined) => {
    if (entry?.state === "ready" && entry.url.startsWith("blob:")) window.URL.revokeObjectURL(entry.url);
  };
  const named = (file: FileValue, on: GuestNode) => `The picture "${file.name}" on ${on.label ? `"${on.label}"` : "a record"}`;

  /* Whether this page's policy lets an image load from its own `blob:` (ChatGPT's img-src has none): asked once. */
  let blobLoads: Promise<boolean> | undefined;
  const loads = (url: string) =>
    new Promise<boolean>((done) => {
      const image = new window.Image();
      image.onload = () => done(true);
      image.onerror = () => done(false);
      window.setTimeout(() => done(false), 2_000);
      image.src = url;
    });
  const dataOf = (blob: Blob) =>
    new Promise<string>((done, fail) => {
      const reader = new window.FileReader();
      reader.onload = () => done(String(reader.result));
      reader.onerror = fail;
      reader.readAsDataURL(blob);
    });
  const addressOf = async (blob: Blob): Promise<string> => {
    if (options.as === "blob") {
      const url = window.URL.createObjectURL(blob);
      blobLoads ??= loads(url);
      if (await blobLoads) return url;
      window.URL.revokeObjectURL(url);
    }
    return dataOf(blob);
  };

  const make = async (file: FileValue, on: GuestNode): Promise<Entry> => {
    const failed: Entry = { state: "left", said: `${named(file, on)} could not be loaded for the view ${options.view}.` };
    /* A path on the host, as a record keeps one (FR-162), on this page's own origin: never another's. */
    const url = new window.URL(file.href, window.document.baseURI);
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return failed;
    const response = await window.fetch(url.href, { credentials: "same-origin" });
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!response.ok || !isGuestPicture({ type })) return failed;
    let blob: Blob = new window.Blob([await response.arrayBuffer()], { type });
    if (blob.size > PICTURE_FETCH_BYTES) return failed;
    /* Made smaller where it is wider than the view draws a picture, or heavier than one may be; a picture that fits is handed as it is, animation and all. */
    const narrow = file.width !== undefined && file.width <= need;
    if (!narrow || blob.size > perFile) {
      const smaller = await shrink(blob, need, perFile).catch(() => undefined);
      if (smaller) blob = smaller;
      else if (blob.size > perFile) return failed;
    }
    if (blob.size > perFile) return { state: "left", said: `${named(file, on)} is left out: made as small as the ${said(width)} pixels across the view ${options.view} draws a picture at, it is still more than the ${said(perFile)} bytes one picture is handed.` };
    return { state: "ready", url: await addressOf(blob), bytes: blob.size };
  };

  /* What a picture is reckoned to come to before it is made: smaller by the square of how much narrower it is drawn, and no more than one picture may be. */
  const reckon = (file: FileValue) => Math.min(perFile, Math.ceil(file.bytes * (file.width && file.width > need ? (need / file.width) ** 2 : 1)));
  const start = (file: FileValue, on: GuestNode) => {
    entries.set(file.href, { state: "pending", bytes: reckon(file) });
    void make(file, on).then(
      (entry) => settle(file.href, entry),
      () => settle(file.href, { state: "left", said: `${named(file, on)} could not be loaded for the view ${options.view}.` }),
    );
  };
  const settle = (href: string, entry: Entry) => {
    if (disposed || entries.get(href)?.state !== "pending") return release(entry);
    entries.set(href, entry);
    if (entry.state === "left") tell(entry.said);
    moved();
  };

  return {
    hand(props) {
      if (disposed) return handFiles(props, (file) => guestFileOf(file));
      let total = 0;
      const held = new Set<string>();
      const handed = handFiles(props, (file, on) => {
        if (!isGuestPicture(file)) return guestFileOf(file);
        held.add(file.href);
        let entry = entries.get(file.href);
        if (entry?.state === "left") return guestFileOf(file, { left: entry.said });
        if (!entry && file.bytes > PICTURE_FETCH_BYTES) {
          entry = { state: "left", said: `${named(file, on)} is left out: at ${said(file.bytes)} bytes it is more than the host fetches for a view.` };
          entries.set(file.href, entry);
          tell(entry.said);
          return guestFileOf(file, { left: entry.said });
        }
        const bytes = entry ? entry.bytes : reckon(file);
        if (total + bytes > perView) {
          const left = `${named(file, on)} is left out: the view ${options.view} is handed at most ${said(perView)} bytes of pictures, and the pictures before it took them.`;
          tell(left);
          return guestFileOf(file, { left });
        }
        total += bytes;
        if (!entry) start(file, on);
        return guestFileOf(file, entry?.state === "ready" ? { src: entry.url } : {});
      });
      /* What no record handed holds any more is let go: its address, and a fetch still on its way. */
      for (const [href, entry] of entries) {
        if (held.has(href)) continue;
        release(entry);
        entries.delete(href);
      }
      return handed;
    },
    dispose() {
      disposed = true;
      for (const entry of entries.values()) release(entry);
      entries.clear();
    },
  };
}

/**
 * A PICTURE MADE SMALLER ON A CANVAS: at most `across` pixels wide, kept in
 * its own type where the canvas writes it (a JPEG stays a JPEG), and a JPEG
 * where that is still heavier than `bytes`. Nothing where the browser
 * cannot decode it.
 */
async function shrinkOnCanvas(window: Window & typeof globalThis, blob: Blob, across: number, bytes: number): Promise<Blob | undefined> {
  if (typeof window.createImageBitmap !== "function") return undefined;
  const bitmap = await window.createImageBitmap(blob);
  try {
    if (bitmap.width <= across && blob.size <= bytes) return blob;
    const scale = Math.min(1, across / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = window.document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.drawImage(bitmap, 0, 0, w, h);
    const write = (type: string) => new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.85));
    const own = /^image\/(jpeg|webp|png)$/i.test(blob.type) ? blob.type : "image/png";
    const first = await write(own);
    if (first && first.size <= bytes) return first;
    return (await write("image/jpeg")) ?? first ?? undefined;
  } finally {
    bitmap.close();
  }
}
