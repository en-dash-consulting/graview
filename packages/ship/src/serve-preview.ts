import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createMemoryAdapter, memoryViews, placeSlug, type AnySchema, type GraviewApp, type LensTidyEdit, type PersistenceAdapter, type Principal, type RemovedView, type Store } from "@graview/core";
import { editDocument } from "@graview/core/document";
import { formVisitor } from "@graview/core/forms";
import { randomUUID } from "node:crypto";
import { compileDocument } from "@graview/core/check";
import { sayFindings, serializeCompiled } from "@graview/core/compiled";
import { runConnections, type RunConnectionsOptions, type RunningConnections } from "./connections.js";
import { readEnvFile } from "./connections-file.js";
import { seatHeaders } from "./remote.js";
import { VIEWS_PATH } from "./remote-views.js";
import { serveStore, type ServedStore } from "./serve.js";
import { SERVE_KEY } from "./seat-headers.js";

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
  /** The declaration document, as read from its file. Or `code`. */
  readonly document?: unknown;
  /**
   * AN APP DECLARED IN CODE (W-245), in place of a document: the app as
   * Node loaded it (`loadApp`, as `graview check` loads one), which the store
   * runs, and its module bundled for the browser (`bundleAppForPage`), which
   * the page imports from `/graview/app.js` and draws.
   */
  readonly code?: { readonly app: GraviewApp<AnySchema>; readonly bundle: string };
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
  /**
   * A VIEW PROPOSED AND NOT KEPT (FR-187): a worker view's manifest and its
   * source, handed to the page with the document and drawn there as the
   * embed's `draftView`, marked as a draft. It is written nowhere.
   */
  readonly draftView?: { readonly manifest: unknown; readonly source: string };
  /** What an open carries of the log: at most this many of the latest ops (`serveStore`'s `openTail`). The whole log by default. */
  readonly openTail?: number;
  /**
   * THIS RUN'S KEY (`serveStore`'s `key`): no request but health is
   * answered without it, so another account on this machine, or a program
   * that sends no `Origin`, cannot sit in the page's seat. `graview preview`
   * and `graview shots` hand one per run; `address` carries it, and the page
   * opened there trades it for a cookie.
   */
  readonly key?: string;
}

export interface Preview {
  readonly app: GraviewApp<AnySchema>;
  readonly served: ServedStore<AnySchema>;
  readonly url: string;
  /** The address to open: `url`, carrying the run's key when there is one. */
  readonly address: string;
  /** This run's key, when it was handed one. */
  readonly key?: string;
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

/** The seat a preview sits in when none is named: a person who may do everything the document — or the app in code — lets anyone do. */
export function previewPrincipal(document: unknown, asked: { readonly as?: string; readonly roles?: readonly string[] } = {}): Principal {
  const roles = asked.roles ?? (isApp(document) ? [...(document.policy?.roles ?? [])] : rolesOf(document));
  return { kind: "human", id: asked.as ?? "preview", name: asked.as ?? "You", ...(roles.length > 0 ? { roles: [...roles] } : {}) };
}

/** Whether what a preview was handed is an app (in code) rather than a document. */
const isApp = (said: unknown): said is GraviewApp<AnySchema> => typeof said === "object" && said !== null && "schema" in said && typeof (said as { schema?: { kinds?: unknown } }).schema?.kinds !== "undefined";

/** An address on a keyed server with the run's key in its query (before any `#`), or as it was with no key. */
export function keyedAddress(address: string, key: string | undefined): string {
  if (key === undefined) return address;
  const hash = address.indexOf("#");
  const [before, after] = hash < 0 ? [address, ""] : [address.slice(0, hash), address.slice(hash)];
  return `${before}${before.includes("?") ? "&" : "?"}${SERVE_KEY.param}=${encodeURIComponent(key)}${after}`;
}

/** Where the page imports an app in code from. */
export const PREVIEW_APP_PATH = "/graview/app.js";

export async function servePreview(options: PreviewOptions): Promise<Preview> {
  const host = options.host ?? "127.0.0.1";
  if (!LOOPBACK.has(host) && options.trustSeatHeaders !== true) {
    throw new Error(`refusing to listen on ${host} while believing seat headers: anyone who can reach it could claim any seat. Preview on 127.0.0.1 (the default), or say the network in front of it is trusted (trustSeatHeaders, --trust-seat-headers).`);
  }
  const index = join(options.page, "index.html");
  if (!existsSync(index)) {
    throw new Error(`The preview page is not at ${options.page}: build the framework (pnpm build) or reinstall graview.`);
  }
  const code = options.code;
  if ((code === undefined) === (options.document === undefined)) throw new Error("A preview is of a declaration document or of an app in code: hand it one of them.");
  const compiled = code ? undefined : compileDocument(options.document);
  if (compiled && !compiled.ok) throw new Error(`The document does not compile:\n${sayFindings(compiled.findings)}`);
  const app = code ? code.app : (compiled!.app as GraviewApp<AnySchema>);
  const principal = options.principal ?? previewPrincipal(code ? code.app : options.document);
  let document = options.document;
  const drafted = options.draftView ? { draftView: options.draftView } : {};
  // An app in code is handed as its module, which the page imports; a document with the app compiled from it.
  let handed = JSON.stringify(code ? { module: PREVIEW_APP_PATH, principal, ...drafted } : { document, compiled: serializeCompiled(compiled!), principal, ...drafted });
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
    handed = JSON.stringify({ document, compiled: serializeCompiled(next), principal, ...drafted });
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

  /*
   * A FORM FOR A VISITOR (Roadmap f-public-forms), at `/forms/<name>`: the
   * page asks for the document with `?form=<name>` and is handed a visitor
   * minted for this one answer (`form:<uuid>`) in place of the preview's
   * seat, with the state that visitor is served — which, for a form
   * `graview check` passes, is nothing of the app. Abuse limits and who may
   * open the form are a host's, not the preview's.
   */
  const formHanded = async (name: string): Promise<Response> => {
    if (!app.forms?.[name]) {
      const forms = Object.keys(app.forms ?? {});
      return new Response(JSON.stringify({ error: `There is no form called "${name}"${forms.length ? `: the forms are ${forms.join(", ")}` : ": the app declares none"}.` }), { status: 404, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    const visitor = formVisitor(app, name, `form:${randomUUID()}`);
    const said = JSON.parse(handed) as Record<string, unknown>;
    const answered = opened ? await opened.handle(new Request(`http://localhost${STATE_PATH}`, { headers: seatHeaders(visitor) })) : undefined;
    const state = answered?.ok ? JSON.parse(await answered.text()) : undefined;
    const { draftView: _draft, ...rest } = said;
    return new Response(JSON.stringify({ ...rest, principal: visitor, form: name, ...(state === undefined ? {} : { state }) }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  };

  const answer = async (request: Request): Promise<Response | undefined> => {
    if (request.method !== "GET" && request.method !== "HEAD") return undefined;
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    const form = url.searchParams.get("form");
    if (path === "/graview/document" && form !== null) return formHanded(form);
    if (path === "/graview/document") {
      const [state, views] = await Promise.all([stateNow(), viewsNow()]);
      const more = `${state === undefined ? "" : `,"state":${state}`}${views === undefined ? "" : `,"views":${views}`}`;
      return new Response(more === "" ? handed : `${handed.slice(0, -1)}${more}}`, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    if (code && path === PREVIEW_APP_PATH) return new Response(code.bundle, { headers: { "content-type": TYPES[".js"]!, "cache-control": "no-store" } });
    if (path.startsWith("/graview/")) return undefined;
    const file = normalize(join(root, path));
    const served = file.startsWith(root + sep) && extname(file) !== "" && existsSync(file) && statSync(file).isFile() ? file : index;
    // A visitor's form fetches no document as the preview's own seat: its head's preload of it, which the whole face reads, would hand the page every record.
    if (served === index && /^\/forms\//.test(path)) {
      const page = readFileSync(index, "utf8").replace(/<link rel="preload" href="\/graview\/document"[^>]*>\n?/g, "");
      return new Response(page, { headers: { "content-type": TYPES[".html"]!, "cache-control": "no-store" } });
    }
    return new Response(readFileSync(served), {
      headers: { "content-type": TYPES[extname(served)] ?? "application/octet-stream", "cache-control": served === index ? "no-store" : "max-age=31536000, immutable" },
    });
  };

  const served = await serveStore({
    app: app as never,
    adapter: (options.adapter ?? createMemoryAdapter()) as never,
    ...(options.seed ? { seed: options.seed } : {}),
    ...(options.openTail !== undefined ? { openTail: options.openTail } : {}),
    port: options.port ?? 0,
    host,
    // On loopback only this machine reaches it; any other host is refused above unless the network is said to be trusted.
    trustSeatHeaders: true,
    // And only its own page: a page on another site, or one rebinding its own name to this machine, may not sit in that seat.
    ownOrigin: true,
    where: options.where ?? "memory (gone when the preview stops)",
    // The page's seat may tidy every view, the declaration's lenses among them, which this preview writes into its document; an app in code is not written, so its lenses stay.
    views: code ? memoryViews({ may: { views: true, lenses: false } }) : memoryViews({ may: { views: true, lenses: true }, declaration }),
    mayTidyViews: () => ({ views: true, lenses: !code }),
    answer,
    ...(options.key !== undefined ? { key: options.key } : {}),
  });
  opened = served as unknown as ServedStore<AnySchema>;
  const url = `http://${host === "::1" ? "[::1]" : host === "0.0.0.0" ? "localhost" : host}:${served.port}`;
  const connections = runConnections({ readFile: readEnvFile, ...(options.connections === false ? { paused: true } : options.connections), app, store: served.store as unknown as Store<AnySchema> });
  return {
    app,
    served: served as unknown as ServedStore<AnySchema>,
    url,
    address: keyedAddress(`${url}/`, options.key),
    ...(options.key !== undefined ? { key: options.key } : {}),
    principal,
    connections,
    close: async () => {
      await connections.stop();
      await served.close();
    },
  };
}
