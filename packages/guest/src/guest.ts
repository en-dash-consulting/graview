import { openGuest, type Guest } from "./channel.js";
import type { GuestFont, HostMessage } from "./protocol.js";
import { reportRecords } from "./record-report.js";

/** The window a guest runs in, as far as the SDK reads it. */
interface GuestWindow {
  readonly parent: { postMessage(message: unknown, targetOrigin: string): void } | null;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

export interface ConnectGuestOptions {
  /**
   * The host's origin, when the guest knows it: a hello from any other
   * origin is ignored. Without it the hello is still taken only from the
   * parent window, which is the frame's host by construction.
   */
  readonly hostOrigin?: string;
  /** The window to connect from. The global one by default. */
  readonly window?: GuestWindow;
}

export type { Guest };

/** A face as the client takes it: a `data:` font, never an address it would fetch. */
const DATA_FONT = /^data:font\/(?:woff2|woff|ttf|otf);base64,[A-Za-z0-9+/]+=*$/;

/**
 * THE FACES THE APP LENDS A FRAME (Roadmap f-faces-lent-to-frames): each a
 * `data:` font the host read, put in this document's fonts so the guest's
 * `font-family` draws in it, and those lent before taken out once the new
 * are in. Nothing is fetched: what is not a `data:` font is not taken. The
 * frame's client alone: a worker view's faces are the page's (fonts.ts).
 */
function frameFonts(): (message: HostMessage) => void {
  let lent: FontFace[] = [];
  return (message) => {
    if (message.type !== "fonts" || !Array.isArray(message.fonts)) return;
    const here = globalThis as { document?: Document; FontFace?: typeof FontFace };
    const Face = here.FontFace;
    const faces = here.document?.fonts;
    if (!Face || !faces) return;
    const before = lent;
    lent = [];
    for (const font of message.fonts.slice(0, 8) as readonly Partial<GuestFont>[]) {
      if (typeof font?.family !== "string" || typeof font.src !== "string" || !DATA_FONT.test(font.src)) continue;
      const source = `url(${JSON.stringify(font.src)})`;
      const descriptors = { display: "swap" as const, ...(typeof font.weight === "string" ? { weight: font.weight } : {}), ...(typeof font.style === "string" ? { style: font.style } : {}) };
      /* A family that is not one identifier ("Baloo 2") is an error at once in Firefox unless quoted, as the host's own loading finds (fonts.ts). */
      let face = new Face(font.family, source, descriptors);
      if (face.status === "error") face = new Face(JSON.stringify(font.family), source, descriptors);
      faces.add(face);
      lent.push(face);
      face.load().catch(() => faces.delete(face));
    }
    for (const face of before) faces.delete(face);
  };
}

/**
 * Connect a guest view to its host: say it is ready, take the first hello
 * from the parent, and talk only over the port that came with it.
 */
export function connectGuest(options: ConnectGuestOptions = {}): Guest {
  const at = options.window ?? (globalThis as unknown as GuestWindow);
  const fonts = frameFonts();
  /* Where its records are, said once the host has said hello, and again as they move (record-report.ts): what a line to each is drawn from. A window that lays nothing out says nothing. */
  let reporting: (() => void) | undefined;
  const laidOut = at as unknown as Window & typeof globalThis;
  const report = () => {
    if (!reporting && laidOut.document && "ResizeObserver" in laidOut && "MutationObserver" in laidOut && "requestAnimationFrame" in laidOut) reporting = reportRecords(laidOut, (boxes, shows) => opened.send({ type: "records", boxes, shows }));
  };
  const opened = openGuest(
    {
      listen(heard) {
        at.addEventListener("message", heard);
        return () => at.removeEventListener("message", heard);
      },
      fromHost: (event) => event.source === (at.parent as unknown) && (options.hostOrigin === undefined || event.origin === options.hostOrigin),
      ready: (message) => at.parent?.postMessage(message, "*"),
    },
    {
      onMessage: (message) => {
        fonts(message);
        report();
      },
    },
  );
  const { guest } = opened;
  const close = guest.close;
  guest.close = () => (reporting?.(), close());
  return guest;
}
