import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileValue } from "@graview/core";
import { DOOR_LOCKED, fromThisApp, openDoors, sendJson, type DevServerPlugin } from "./door.js";

/*
 * A DEV SERVER'S FILES (FR-163): the door a file field's editor sends to
 * while an app runs under `pnpm dev`, and the harnesses' too. It keeps what
 * it is sent IN MEMORY, for as long as the dev server runs, and serves it
 * back from the same path — so a picture put on a record shows on its card
 * and its page, and the record keeps a `FileValue` like any host's.
 *
 * Never in a build: a deployed app's host stores files its own way (Graview
 * Cloud at `/graview/files/<sha256>.<ext>`), and a page that is handed no
 * `files` says that host takes none. Same-origin only, like every door here.
 *
 *   POST <path>            the bytes, `content-type` their type and
 *                          `x-graview-file-name` the name, URI-encoded;
 *                          answers the `FileValue`, or `{ error }` in words
 *   GET  <path>            `{ maxBytes, kinds }`: what it takes
 *   GET  <path>/<sha>.<ext> the bytes, as their type and never sniffed: a
 *                          picture or a PDF inline, anything else a download;
 *                          and nothing but a PDF, whose viewer a sandbox would
 *                          stop, ever runs as this app's page when it is opened
 *                          (`content-security-policy: sandbox`). An SVG is a
 *                          picture that can carry a script: an `<img>` never
 *                          runs it, and opened on its own it is sandboxed.
 *                          A video is inline too, and served a range at a
 *                          time (`range: bytes=…`, 206), as a player seeks
 *                          and as WebKit plays nothing without. It is kept
 *                          as it was sent: making a phone's HEVC `.mov` an
 *                          MP4 every browser plays, and its poster, are a
 *                          real host's (Graview Cloud's) to do.
 */

export const DEV_FILES_PATH = "/__graview/files";
/** What the dev door takes unless told otherwise: pictures, videos, PDFs and plain text, up to 10 MB each. */
export const DEV_FILES_KINDS: readonly string[] = ["image/*", "video/*", "application/pdf", "text/plain"];
export const DEV_FILES_MAX_BYTES = 10_000_000;

export interface DevFilesOptions {
  /** Where the door answers. `/__graview/files` by default. */
  readonly path?: string;
  /** The most one file may be, in bytes. */
  readonly maxBytes?: number;
  /** The media types it takes; `image/*` for any picture. */
  readonly kinds?: readonly string[];
}

const ENDINGS: Readonly<Record<string, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/heic": "heic", "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "application/pdf": "pdf", "text/plain": "txt" };

/** The one range a player asks for (`bytes=2-5`, `bytes=7-`, `bytes=-3`), within `size`; "unsatisfiable" past it; undefined for none, or several. */
function rangeOf(asked: string | undefined, size: number): { readonly start: number; readonly end: number } | "unsatisfiable" | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(asked?.trim() ?? "");
  if (!match || (match[1] === "" && match[2] === "")) return undefined;
  const start = match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[1] === "" || match[2] === "" ? size - 1 : Math.min(size - 1, Number(match[2]));
  return start >= size || start > end ? "unsatisfiable" : { start, end };
}

const takes = (kinds: readonly string[], type: string) => kinds.length === 0 || kinds.some((kind) => kind === "*" || kind === "*/*" || kind === type || kind === `${type.split("/")[0]}/*`);

const sizeWords = (bytes: number) => (bytes < 1000 ? `${bytes} bytes` : bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`);

/** The request's bytes, or undefined once past `limit`. */
function readBytes(req: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        resolve(undefined);
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(size > limit ? undefined : Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** The door's handler, for a server that is not Vite's; `devFiles` is the plugin. */
export function devFilesHandler(options: DevFilesOptions = {}) {
  const path = options.path ?? DEV_FILES_PATH;
  const maxBytes = options.maxBytes ?? DEV_FILES_MAX_BYTES;
  const kinds = options.kinds ?? DEV_FILES_KINDS;
  const kept = new Map<string, { readonly type: string; readonly name: string; readonly bytes: Buffer }>();
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!fromThisApp(req)) return sendJson(res, 403, { error: DOOR_LOCKED });
    // Mounted at `path` (Vite strips it) or handed every request (strip it here).
    const url = (req.url ?? "/").split("?")[0]!;
    const rest = url.startsWith(path) ? url.slice(path.length) : url;
    if (req.method === "GET") {
      if (rest === "" || rest === "/") return sendJson(res, 200, { maxBytes, kinds });
      const file = kept.get(rest.replace(/^\//, ""));
      if (!file) return sendJson(res, 404, { error: "No file is kept at that address." });
      const video = file.type.startsWith("video/");
      const shown = file.type.startsWith("image/") || video || file.type === "application/pdf";
      const range = video ? rangeOf(req.headers.range, file.bytes.length) : undefined;
      if (range === "unsatisfiable") {
        res.statusCode = 416;
        res.setHeader("content-range", `bytes */${file.bytes.length}`);
        res.end();
        return;
      }
      const body = range ? file.bytes.subarray(range.start, range.end + 1) : file.bytes;
      res.statusCode = range ? 206 : 200;
      res.setHeader("content-type", file.type);
      res.setHeader("content-length", String(body.length));
      if (video) res.setHeader("accept-ranges", "bytes");
      if (range) res.setHeader("content-range", `bytes ${range.start}-${range.end}/${file.bytes.length}`);
      res.setHeader("x-content-type-options", "nosniff");
      // Never run as this app's page if it is opened, an SVG's script least of all: only a PDF's viewer needs to run.
      if (file.type !== "application/pdf") res.setHeader("content-security-policy", "sandbox");
      res.setHeader("cache-control", "private, max-age=31536000, immutable");
      res.setHeader("content-disposition", `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      res.end(body);
      return;
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "Send a file with POST, or GET one by its address." });
    const type = String(req.headers["content-type"] ?? "application/octet-stream").split(";")[0]!.trim().toLowerCase();
    let name = "file";
    try {
      name = decodeURIComponent(String(req.headers["x-graview-file-name"] ?? "file")).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255) || "file";
    } catch {
      // A name that does not decode is kept as "file".
    }
    if (!takes(kinds, type)) return sendJson(res, 415, { error: `this server doesn't take ${type} files` });
    const bytes = await readBytes(req, maxBytes);
    if (!bytes) return sendJson(res, 413, { error: `it is more than ${sizeWords(maxBytes)}, the most this server takes` });
    const sha = createHash("sha256").update(bytes).digest("hex");
    const ending = ENDINGS[type] ?? /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase() ?? "bin";
    const key = `${sha}.${ending}`;
    kept.set(key, { type, name, bytes });
    const value: FileValue = { href: `${path}/${key}`, name, type, bytes: bytes.length };
    sendJson(res, 200, value);
  };
}

/**
 * THE VITE PLUGIN: `plugins: [devFiles()]`, then hand the page
 * `files: filesAt("/__graview/files", { maxBytes, kinds })` from
 * `@graview/ship/browser` in development. Serve only — a build carries none.
 */
export function devFiles(options: DevFilesOptions = {}): DevServerPlugin {
  const handler = devFilesHandler(options);
  return {
    name: "graview:dev-files",
    apply: "serve",
    configureServer(server) {
      openDoors(server);
      server.middlewares.use(options.path ?? DEV_FILES_PATH, (req, res) => {
        void handler(req, res);
      });
    },
  };
}
