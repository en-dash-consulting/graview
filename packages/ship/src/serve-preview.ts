import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createMemoryAdapter, type AnySchema, type GraviewApp, type PersistenceAdapter, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { sayFindings, serializeCompiled } from "@graview/core/compiled";
import { serveStore, type ServedStore } from "./serve.js";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE DEFAULT FACES OVER A DOCUMENT, WITH NO PRODUCT (`graview preview`).
 *
 * `graview serve` is the store and draws nothing, so a stranger holding a
 * JSON document and a snapshot had to build a product to look at it. This
 * serves the same store and, beside it, a page that is Graview's own faces
 * — the scene and Pages, with the bar and the address bar — built once at
 * the framework's build and shipped in the `graview` package
 * (`dist/preview/`). The page asks `/graview/document` for the document,
 * the app compiled from it here, and the seat it sits in; everything else
 * under `/graview/` is the store's, and any other address is the page, so
 * a place can be linked and reloaded.
 */
export interface PreviewOptions {
  /** The declaration document, as read from its file. */
  readonly document: unknown;
  /** The graph a first install starts from. */
  readonly seed?: GraphSnapshot;
  /** The built page's directory: `index.html` and its chunks. */
  readonly page: string;
  /** Where the store keeps what is changed. In memory, gone when the preview stops, by default. */
  readonly adapter?: PersistenceAdapter<string>;
  /** Where the data is, in words a person can open. */
  readonly where?: string;
  /** 0, or nothing, for any free port. */
  readonly port?: number;
  /** Loopback by default: the page's seat is believed from its headers, which only this machine can then send. */
  readonly host?: string;
  /** Who the page sits as. A person holding every role the document declares, by default. */
  readonly principal?: Principal;
  /**
   * Believe the page's seat on a `host` other machines reach, because the
   * network in front of it is trusted (`--trust-seat-headers`). Refused
   * without it: anyone who could reach the preview could sit in any seat.
   */
  readonly trustSeatHeaders?: boolean;
}

export interface Preview {
  readonly app: GraviewApp<AnySchema>;
  readonly served: ServedStore<AnySchema>;
  readonly url: string;
  readonly principal: Principal;
  close(): Promise<void>;
}

/** The addresses only this machine reaches. */
export const LOOPBACK: ReadonlySet<string> = new Set(["127.0.0.1", "::1", "localhost"]);

const TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/** The roles a document declares, read without trusting its shape. */
function rolesOf(document: unknown): string[] {
  const roles = typeof document === "object" && document !== null ? (document as { roles?: unknown }).roles : undefined;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
}

/** The seat a preview sits in when none is named: a person who may do everything the document lets anyone do. */
export function previewPrincipal(document: unknown, asked: { readonly as?: string; readonly roles?: readonly string[] } = {}): Principal {
  const roles = asked.roles ?? rolesOf(document);
  return { kind: "human", id: asked.as ?? "preview", name: asked.as ?? "You", ...(roles.length > 0 ? { roles: [...roles] } : {}) };
}

export async function servePreview(options: PreviewOptions): Promise<Preview> {
  const host = options.host ?? "127.0.0.1";
  if (!LOOPBACK.has(host) && options.trustSeatHeaders !== true) {
    throw new Error(`refusing to listen on ${host} while believing seat headers: anyone who can reach it could claim any seat. Preview on 127.0.0.1 (the default), or say the network in front of it is trusted (trustSeatHeaders, --trust-seat-headers).`);
  }
  const index = join(options.page, "index.html");
  if (!existsSync(index)) {
    throw new Error(`The preview page is not at ${options.page}: build the framework (pnpm build) or reinstall graview.`);
  }
  const compiled = compileDocument(options.document);
  if (!compiled.ok) throw new Error(`The document does not compile:\n${sayFindings(compiled.findings)}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const principal = options.principal ?? previewPrincipal(options.document);
  const handed = JSON.stringify({ document: options.document, compiled: serializeCompiled(compiled), principal });
  const root = resolve(options.page);

  const answer = (request: Request): Response | undefined => {
    if (request.method !== "GET" && request.method !== "HEAD") return undefined;
    const path = decodeURIComponent(new URL(request.url).pathname);
    if (path === "/graview/document") return new Response(handed, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    if (path.startsWith("/graview/")) return undefined;
    const file = normalize(join(root, path));
    const served = file.startsWith(root + sep) && extname(file) !== "" && existsSync(file) && statSync(file).isFile() ? file : index;
    return new Response(readFileSync(served), {
      headers: { "content-type": TYPES[extname(served)] ?? "application/octet-stream", "cache-control": served === index ? "no-store" : "max-age=31536000, immutable" },
    });
  };

  const served = await serveStore({
    app: app as never,
    adapter: (options.adapter ?? createMemoryAdapter()) as never,
    ...(options.seed ? { seed: options.seed } : {}),
    port: options.port ?? 0,
    host,
    // On loopback only this machine reaches it; any other host is refused above unless the network is said to be trusted.
    trustSeatHeaders: true,
    // And only its own page: a page on another site, or one rebinding its own name to this machine, may not sit in that seat.
    ownOrigin: true,
    where: options.where ?? "memory (gone when the preview stops)",
    answer,
  });
  const url = `http://${host === "::1" ? "[::1]" : host === "0.0.0.0" ? "localhost" : host}:${served.port}`;
  return { app, served: served as unknown as ServedStore<AnySchema>, url, principal, close: () => served.close() };
}
