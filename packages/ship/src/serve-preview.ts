import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createMemoryAdapter, memoryViews, placeSlug, type AnySchema, type GraviewApp, type LensTidyEdit, type PersistenceAdapter, type Principal, type RemovedView, type Store } from "@graview/core";
import { editDocument } from "@graview/core/document";
import { compileDocument } from "@graview/core/check";
import { sayFindings, serializeCompiled } from "@graview/core/compiled";
import { runConnections, type RunConnectionsOptions, type RunningConnections } from "./connections.js";
import { readEnvFile } from "./connections-file.js";
import { seatHeaders } from "./remote.js";
import { VIEWS_PATH } from "./remote-views.js";
import { serveStore, type ServedStore } from "./serve.js";

/** Where the store answers a seat its state. */
const STATE_PATH = "/graview/state";
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
  /**
   * The document's connections (`connections.<name>`), run beside the store
   * with these options — where their state is kept, a host's token — or not
   * at all (`false`). Run with credentials from the environment by default.
   */
  readonly connections?: false | Omit<RunConnectionsOptions<AnySchema>, "app" | "store">;
}

export interface Preview {
  readonly app: GraviewApp<AnySchema>;
  readonly served: ServedStore<AnySchema>;
  readonly url: string;
  readonly principal: Principal;
  /** The connections running beside the store; none when the document declares none or they were turned off. */
  readonly connections: RunningConnections;
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
  let document = options.document;
  let handed = JSON.stringify({ document, compiled: serializeCompiled(compiled), principal });
  /*
   * A DECLARED LENS HIDDEN OR DELETED FROM THE PLACE MENU (Roadmap
   * f-place-menu-views): the change written into the document this preview
   * holds, which the page asks for again (`remoteViews`' `onDeclaration`);
   * a deleted lens kept as it was, so Restore puts it back where it stood.
   */
  const removedLenses = new Map<string, { readonly lens: Record<string, unknown>; readonly at: number }>();
  const lensesOf = (doc: unknown) => ((doc as { lenses?: Record<string, unknown>[] }).lenses ?? []).filter((lens) => typeof lens === "object" && lens !== null);
  const write = (edits: readonly unknown[]) => {
    const edited = editDocument(document as never, edits);
    if (!edited.ok) throw new Error(edited.findings.map((finding) => finding.message).join(" "));
    const next = compileDocument(edited.document);
    if (!next.ok) throw new Error(sayFindings(next.findings));
    document = edited.document;
    handed = JSON.stringify({ document, compiled: serializeCompiled(next), principal });
  };
  const declaration = {
    change(edit: LensTidyEdit) {
      if (edit.op === "remove-lens") {
        const lenses = lensesOf(document);
        const at = lenses.findIndex((lens) => typeof lens["title"] === "string" && placeSlug(lens["title"]) === placeSlug(edit.title));
        if (at >= 0) removedLenses.set(edit.title, { lens: lenses[at]!, at });
      }
      write([edit]);
    },
    restore(removed: RemovedView) {
      const held = removedLenses.get(removed.title);
      if (!held) throw new Error(`"${removed.title}" was deleted before this preview started, so it cannot be put back from here.`);
      const { name, title, on, bindings, options: lensOptions, create } = held.lens as { name?: string; title: string; on?: string; bindings?: unknown; options?: unknown; create?: boolean };
      write([{ op: "add-lens", title, ...(name ? { lens: name } : {}), ...(on ? { on } : {}), ...(bindings ? { bindings } : {}), ...(lensOptions ? { options: lensOptions } : {}), ...(create === false ? { create } : {}), at: held.at }]);
      removedLenses.delete(removed.title);
    },
  };
  const root = resolve(options.page);

  /*
   * THE STORE'S STATE, HANDED WITH THE DOCUMENT. The page asked for the
   * document, built the app, and only then asked the store for its state:
   * two round trips before it could draw, where one carries both. The
   * state is the one this seat would be answered at `/graview/state`, read
   * as the document is asked for; the page opens the store on it
   * (`openRemote`'s `state`).
   */
  let opened: ServedStore<AnySchema> | undefined;
  const stateNow = async (): Promise<string | undefined> => {
    if (!opened) return undefined;
    const answered = await opened.handle(new Request(`http://localhost${STATE_PATH}`, { headers: seatHeaders(principal) }));
    return answered.ok ? answered.text() : undefined;
  };
  /*
   * AND THE VIEWS IT TIDIED, likewise (Roadmap f-place-menu-views): asked
   * for after the document, they kept the page from drawing for one more
   * round trip — half a second on a phone. What this seat would be answered
   * at `/graview/views` comes with the document, and `remoteViews` starts
   * from it (`state`).
   */
  const viewsNow = async (): Promise<string | undefined> => {
    if (!opened) return undefined;
    const answered = await opened.handle(new Request(`http://localhost${VIEWS_PATH}`, { headers: seatHeaders(principal) }));
    return answered.ok ? answered.text() : undefined;
  };

  const answer = async (request: Request): Promise<Response | undefined> => {
    if (request.method !== "GET" && request.method !== "HEAD") return undefined;
    const path = decodeURIComponent(new URL(request.url).pathname);
    if (path === "/graview/document") {
      const [state, views] = await Promise.all([stateNow(), viewsNow()]);
      const more = `${state === undefined ? "" : `,"state":${state}`}${views === undefined ? "" : `,"views":${views}`}`;
      return new Response(more === "" ? handed : `${handed.slice(0, -1)}${more}}`, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
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
    // The page's seat may tidy every view, the declaration's lenses among them, which this preview writes into its document.
    views: memoryViews({ may: { views: true, lenses: true }, declaration }),
    mayTidyViews: () => ({ views: true, lenses: true }),
    answer,
  });
  opened = served as unknown as ServedStore<AnySchema>;
  const url = `http://${host === "::1" ? "[::1]" : host === "0.0.0.0" ? "localhost" : host}:${served.port}`;
  const connections = runConnections({ readFile: readEnvFile, ...(options.connections === false ? { paused: true } : options.connections), app, store: served.store as unknown as Store<AnySchema> });
  return {
    app,
    served: served as unknown as ServedStore<AnySchema>,
    url,
    principal,
    connections,
    close: async () => {
      await connections.stop();
      await served.close();
    },
  };
}
