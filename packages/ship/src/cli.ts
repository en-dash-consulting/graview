import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { entryArg, loadApp } from "@graview/core/cli";
import { readSnapshot } from "@graview/core/snapshot";
import type { GraviewApp, PersistenceAdapter } from "@graview/core";
import { createFileAdapter, scopeDirectory } from "./file-adapter.js";
import { fileSubscriptions } from "./file-subscriptions.js";
import { fileFriction } from "./file-friction.js";
import { fileViews } from "./file-views.js";
import { LIVE_PATH } from "./live.js";
import { openStore } from "./open-store.js";
import { serveStore } from "./serve.js";
import { SERVE_KEY } from "./seat-headers.js";
import type { GraphSnapshot } from "./snapshot.js";
import { sayStep } from "./steps.js";
import { keyedAddress, LOOPBACK, previewPrincipal, servePreview, type SplashRenderer } from "./serve-preview.js";
import { findPlaywright, NO_PLAYWRIGHT, shoot, shotsOf } from "./shots.js";
import { bundleAppForPage } from "./preview-app.js";
import { applySteps, sayRefusals, seedRefusals, seedSteps } from "./sync-seed.js";
import { runConnections } from "./connections.js";
import { fileConnectionState, readEnvFile } from "./connections-file.js";
import { heldBy, holdFileOf, holdStore, sayHeld, sayTookOver, type StoreHold } from "./store-hold.js";
import type { StoredMeta } from "./meta.js";
import { homeScreenAnswer } from "./home-screen.js";

/**
 * `graview serve` — the store behind HTTP, and the data in a folder you can
 * open.
 *
 * The file adapter is the default because the point of this command is the
 * answer to "where is my data": a directory holding `snapshot.json`, a
 * `log.jsonl` with one operation per line that a person can `grep`, and a
 * `meta.json` carrying the stored version. `--sqlite` swaps the adapter and
 * changes nothing else, which is the actual claim about adapters.
 */
export const SERVE_USAGE = `  graview serve <entry> [--data <dir>] [--port <n>] [--seed <file>] [--sqlite <file>]
                       [--host <address>] [--trust-seat-headers] [--allow-origin <origin>]
                       [--no-sync] [--no-friction]
      Serves the app's store over HTTP, and live over a WebSocket at
      /graview/live. The op log is the wire: a client sends calls, the
      store judges them under the caller's own seat, and the ops come back,
      pushed to every socket as they land. Data lives in <dir> (default
      ./data) as readable JSON, or in a SQLite file with --sqlite. It listens on 127.0.0.1 and
      believes the seat a request names in its headers, because only this
      machine can reach it — from a program, or from a page on its own
      origin; a page on another origin is refused unless --allow-origin
      names it (say it once per origin, as http://localhost:5195), and
      no header names the system's seat. Each run mints a key and prints
      it in the address it says: only a request carrying it is believed
      (a page opens that address, a program passes it whole as
      --remote-url), because another account on this machine reaches
      loopback too. Health answers without it. On any other --host it will not
      start unless --trust-seat-headers says the network in front of it can
      be trusted, and then it believes every seat header, the system's too.
      The app's declared connections (a Google calendar, a Notion database) run beside it, with
      credentials from the environment and their cursors beside the data;
      --no-sync leaves them off. What people looked for and could not do
      (a search that found nothing, an act refused) is kept for 90 days in
      friction.json beside the data, each person reading only their own and
      the counts, never a visitor's; --no-friction keeps none.

  graview sync-seed <entry> --seed <file> [--data <dir> | --sqlite <file>]
                            [--apply] [--prune] [--json]
      Diffs the bootstrap seed against the live store and says, as content
      steps, what would bring the store in step with it: records put,
      fields patched, ties made. Prints and exits by default; --apply lands
      the steps as one logged, undoable operation; --prune also drops what
      the seed no longer has. The seed itself is only ever read at first
      install — this is how default content moves afterwards, in place of
      deleting the store.

  graview preview <document.json | app module> [--seed <file>] [--port <n>] [--host <address>]
                  [--data <dir> | --sqlite <file>] [--as <id>] [--roles a,b] [--no-sync]
                  [--view <view.js> --manifest <manifest.json>]
      Serves the store and Graview's own faces over it — the scene and
      Pages, with the bar — so a document and a snapshot can be looked at
      with no product. Nothing to build or install: the page ships with
      graview. An app declared in code is taken as graview check takes it
      (./dist/domain/app.js), its module bundled for the page with the
      project's esbuild. The store is in memory unless --data or --sqlite
      name where to keep it; the page sits as a person holding every role
      the app declares, unless --as or --roles say who. Its connections run as
      serve's do, unless --no-sync. --view and --manifest draw a worker view
      proposed and not kept where it attaches, marked as a draft. Each of
      the app's forms for visitors is at /forms/<name>, drawn alone and
      answered as a visitor minted for that page. On 127.0.0.1 each run
      mints a key, carried by every address it prints: open one of those
      (the key is traded for a cookie), since nothing but health answers
      without it.

  graview shots <document.json | app module> [--seed <file>] [--places a,b] [--out <dir>]
                [--scheme light|dark|both] [--width <px>[,<px>]] [--faces pages,scene]
                [--view <view.js> --manifest <manifest.json>]
      Photographs places headless to PNGs, <place>-<scheme>-<width>.png in
      <dir> (default ./shots): each place by its address word or title (the
      home, overview, a lens's name, a kind's plural) or a path such as
      /tasks/t1; every place when none is named. Needs Playwright, which you
      install beside the project (npm i -D playwright, then npx playwright
      install chromium). --view and --manifest picture a proposed view
      before it is kept: name its place by its title, as a kept view's.
`;

/** The same store, whichever command asked: parsed from the flags every store command shares. */
export const STORE_FLAGS = `--data <dir> (default ./data) | --sqlite <file>, and --seed <file> for a first install`;

/** Every value a flag said more than once is given. */
function flags(argv: readonly string[], name: string): string[] {
  return argv.flatMap((arg, at) => (arg === name && argv[at + 1] !== undefined ? [argv[at + 1]!] : []));
}

export function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  if (at === -1) return undefined;
  return argv[at + 1];
}

export interface StoreBackend {
  readonly adapter: PersistenceAdapter<string> & {
    loadMeta?(scope: string): StoredMeta | null | Promise<StoredMeta | null>;
    saveMeta?(scope: string, meta: StoredMeta): void | Promise<void>;
  };
  /** Where the data is, in words a person can open. */
  readonly where: string;
  /** The file that says which process writes this store now (`./store-hold.ts`). */
  readonly holdFile: string;
  readonly seed?: GraphSnapshot;
}

/**
 * Takes the store for `command`, or writes the sentence that says who holds
 * it and returns undefined. Every command that writes a store on disk asks
 * this first, so a running preview's folder is never written behind its back.
 */
export function holdBackend(backend: StoreBackend, command: string, wanted: string, options: { readonly remote?: boolean } = {}): StoreHold | undefined {
  const held = holdStore(backend.holdFile, command);
  if ("heldBy" in held) {
    process.stderr.write(`graview ${command}: ${sayHeld(held.heldBy, backend.where, wanted, options)}`);
    return undefined;
  }
  if (held.tookOverFrom) process.stderr.write(`graview ${command}: ${sayTookOver(held.tookOverFrom, backend.where)}`);
  return held;
}

/**
 * THE BACKEND FLAGS, PARSED ONCE. `serve`, `sync-seed`, `mcp` and `apply`
 * all take the same store: a folder of readable JSON, or a SQLite file, and
 * a seed for a first install. One parser, so the four commands cannot come
 * to mean different things by the same words.
 */
export async function backendFrom(argv: readonly string[], cwd = process.cwd()): Promise<StoreBackend> {
  const sqlite = flag(argv, "--sqlite");
  const data = resolve(cwd, flag(argv, "--data") ?? "data");
  const seedFile = flag(argv, "--seed");
  const seed = seedFile ? readSeed(resolve(cwd, seedFile)) : undefined;
  if (sqlite) {
    const file = resolve(cwd, sqlite);
    return { adapter: await sqliteAdapter(file), where: file, holdFile: holdFileOf(file, "file"), ...(seed ? { seed } : {}) };
  }
  return { adapter: createFileAdapter(data), where: data, holdFile: holdFileOf(data, "folder"), ...(seed ? { seed } : {}) };
}

/**
 * WHERE "NOTIFY ME" IS KEPT FOR A STORE ON DISK (Roadmap
 * f-notify-subscriptions): `subscriptions.json` in the app's own folder of
 * a data directory, or beside a SQLite file — the one file `graview serve`
 * and `graview mcp` on the same store both read.
 */
/** Where `graview serve` and `graview preview --data` keep the connections' cursors and links: beside the store, as the subscriptions are. */
export function connectionsFileOf(backend: Pick<StoreBackend, "adapter" | "where">, scope: string): string {
  const root = (backend.adapter as { root?: string }).root;
  return root !== undefined ? join(scopeDirectory(root, scope), "connections.json") : `${backend.where}.connections.json`;
}

export function subscriptionsFileOf(backend: Pick<StoreBackend, "adapter" | "where">, scope: string): string {
  const root = (backend.adapter as { root?: string }).root;
  return root !== undefined ? join(scopeDirectory(root, scope), "subscriptions.json") : `${backend.where}.subscriptions.json`;
}

/** Where `graview serve` keeps the friction log (Roadmap f-friction-log): beside the store, as the subscriptions are. */
export function frictionFileOf(backend: Pick<StoreBackend, "adapter" | "where">, scope: string): string {
  const root = (backend.adapter as { root?: string }).root;
  return root !== undefined ? join(scopeDirectory(root, scope), "friction.json") : `${backend.where}.friction.json`;
}

/** Where the answers to the app's own suggestions about itself are kept (Roadmap f-learned-suggestions): beside the store, with the friction log they are learned from. */
export function learnedFileOf(backend: Pick<StoreBackend, "adapter" | "where">, scope: string): string {
  const root = (backend.adapter as { root?: string }).root;
  return root !== undefined ? join(scopeDirectory(root, scope), "learned.json") : `${backend.where}.learned.json`;
}

/** Where `graview serve` keeps the views a person tidied from the place menu (Roadmap f-place-menu-views): beside the store, as the subscriptions are. */
export function viewsFileOf(backend: Pick<StoreBackend, "adapter" | "where">, scope: string): string {
  const root = (backend.adapter as { root?: string }).root;
  return root !== undefined ? join(scopeDirectory(root, scope), "views.json") : `${backend.where}.views.json`;
}

/** A seed file in either snapshot format: the line format with its header, or an old `{ nodes, edges }`. */
function readSeed(file: string): GraphSnapshot {
  try {
    return readSnapshot(readFileSync(file, "utf8")).snapshot as GraphSnapshot;
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The entry module, or the reason it is not one — said before anything is opened. */
async function entryOf(argv: readonly string[], command: string, usage: string): Promise<GraviewApp | number> {
  const entry = entryArg(argv, 0);
  if (!entry) {
    process.stderr.write(`graview ${command}: an entry module is required\n\n${usage}`);
    return 2;
  }
  return loadApp(entry);
}


/**
 * WHETHER `graview serve` BELIEVES A SEAT HEADER (FR-06). Seat headers are
 * how the framework's own clients say who they are, and anyone who can
 * reach the server can send them. On loopback that is only this machine,
 * so they are believed and the command says so; anywhere else it refuses
 * to start unless told the network in front of it is trusted.
 */
export function seatTrust(
  host: string,
  trustFlag: boolean,
): { readonly trust: boolean; readonly says: string; readonly ownOrigin: boolean; readonly system: boolean; readonly keyed: boolean } | { readonly refuse: string } {
  /*
   * Said, the network in front is the operator's word, the system's seat among the headers it carries.
   * Unsaid, on loopback, "only this machine" is held to: a page on another
   * origin in this machine's browser — or one rebinding its name here — is
   * refused (`ownOrigin`), and no header names the system's seat. And
   * this machine is not one person: another account on it, or a program
   * that sends no `Origin`, reaches loopback too, so a seat is believed
   * only from a request carrying the key this run mints (`keyed`).
   */
  if (trustFlag) return { trust: true, ownOrigin: false, system: true, keyed: false, says: `believes seat headers on ${host}, because --trust-seat-headers says the network in front of it is trusted` };
  if (LOOPBACK.has(host))
    return {
      trust: true,
      ownOrigin: true,
      system: false,
      keyed: true,
      says: `believes seat headers: listening on ${host}, which only this machine reaches, only from its own origin or one --allow-origin names, and only with this run's key`,
    };
  return {
    refuse:
      `graview serve: refusing to listen on ${host} while believing seat headers — anyone who can reach it could claim any seat.\n` +
      `  Serve on 127.0.0.1 (the default), put a host that authenticates in front with its own seatOf, or say --trust-seat-headers.\n`,
  };
}

/**
 * A KEY FOR ONE RUN of `graview serve`: 32 random bytes, said only in the
 * terminal it runs in, as the address to open (`?graview_key=<key>`). A
 * new run is a new key, so an address printed yesterday opens nothing.
 */
export function mintServeKey(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * This run's key: `GRAVIEW_SERVE_KEY` when it is set and at least 16
 * characters (a harness that starts its own server and opens it), else one
 * minted for the run.
 */
export function serveKey(): string {
  const said = process.env["GRAVIEW_SERVE_KEY"];
  return said !== undefined && said.length >= 16 ? said : mintServeKey();
}

export async function serve(argv: readonly string[]): Promise<number> {
  const app = await entryOf(argv, "serve", SERVE_USAGE);
  if (typeof app === "number") return app;
  const port = Number(flag(argv, "--port") ?? 5196);
  const host = flag(argv, "--host") ?? "127.0.0.1";
  const trust = seatTrust(host, argv.includes("--trust-seat-headers"));
  if ("refuse" in trust) {
    process.stderr.write(trust.refuse);
    return 1;
  }
  const backend = await backendFrom(argv);
  const hold = holdBackend(backend, "serve", "Serving it a second time");
  if (!hold) return 1;
  const key = trust.keyed ? serveKey() : undefined;
  const served = await serveStore({
    app: app as never,
    adapter: backend.adapter,
    ...(backend.seed ? { seed: backend.seed } : {}),
    port,
    host,
    trustSeatHeaders: trust.trust,
    trustSystemSeat: trust.system,
    ownOrigin: trust.ownOrigin,
    ...(key !== undefined ? { key } : {}),
    allowOrigins: flags(argv, "--allow-origin"),
    where: backend.where,
    // The app on a home screen: its manifest and its SVG mark, for a page that links them (Roadmap f-app-icons-home-screen).
    answer: homeScreenAnswer(app.brand, { name: app.name }).answer,
    // Notify me: kept beside the store, and each match said here, where a host would deliver it.
    subscriptions: fileSubscriptions(subscriptionsFileOf(backend, app.name)),
    // The views a person hid or deleted from the place menu, kept beside the store, thirty days for a deleted one.
    views: fileViews(viewsFileOf(backend, app.name)),
    // What people could not do, kept beside the store for ninety days, or not at all.
    friction: argv.includes("--no-friction") ? false : fileFriction(frictionFileOf(backend, app.name)),
    onSubscriptionMatch: (match) => {
      process.stdout.write(`graview serve: notify ${match.subscription.who.name ?? match.subscription.who.id}: ${match.said}\n`);
    },
  });
  hold.serving(served.url);
  // The declared connections, kept in step beside the store: credentials from the environment, cursors beside the data.
  const connections = runConnections({
    app: app as never,
    store: served.store as never,
    state: fileConnectionState(connectionsFileOf(backend, app.name)),
    readFile: readEnvFile,
    paused: argv.includes("--no-sync"),
    say: (line) => process.stdout.write(`graview serve: connection ${line}\n`),
  });

  // Listening for a stop before saying where it listens: whoever reads the address may send one at once.
  stopOnSignal("serve", async () => {
    await connections.stop();
    await served.close();
  }, hold);
  process.stdout.write(
    `graview serve: ${app.name} on ${served.url}\n` +
      // The address carries this run's key: a page opens it, a program passes it whole as --remote-url.
      (key !== undefined ? `  address: ${served.url}/?${SERVE_KEY.param}=${key}  (this run's key: a page opens it, a program passes it whole as --remote-url or sends the key as ${SERVE_KEY.header})\n` : "") +
      `  live: ${served.url.replace(/^http/, "ws")}${LIVE_PATH}\n` +
      `  data: ${backend.where}  (${backend.adapter.name})\n` +
      `  ${trust.says}\n` +
      `  ${served.store.graph.allNodes().length} nodes, ${served.opened.store.log.all().length} operations` +
      `${served.opened.migrated.length > 0 ? `, migrated: ${served.opened.migrated.map((op) => op.intent).join("; ")}` : ""}\n`,
  );
  return 0;
}

/** How long a server's stop may take before the process goes anyway: the sockets' grace, and a margin. */
const STOP_DEADLINE_MS = 2500;

/**
 * A SERVER STOPS WHEN IT IS TOLD TO. SIGTERM, SIGINT or SIGHUP closes the
 * server — its live sockets told and given a short grace, its keep-alive
 * connections cut — lets the store go, and exits. A close that is still
 * waiting at the deadline, or a second signal, exits anyway: a process that
 * only `kill -9` stops leaves its store's hold naming it.
 */
function stopOnSignal(command: string, close: () => Promise<void>, hold: StoreHold | undefined): void {
  let stopping = false;
  const leave = (code: number) => {
    hold?.release();
    process.exit(code);
  };
  const stop = () => {
    if (stopping) return leave(0);
    stopping = true;
    setTimeout(() => {
      process.stderr.write(`graview ${command}: a connection was still open after ${STOP_DEADLINE_MS / 1000} s; stopped anyway.\n`);
      leave(0);
    }, STOP_DEADLINE_MS).unref();
    close().then(
      () => leave(0),
      (error: unknown) => {
        process.stderr.write(`graview ${command}: stopping: ${error instanceof Error ? error.message : String(error)}\n`);
        leave(1);
      },
    );
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("SIGHUP", stop);
}

/**
 * `graview sync-seed` — default content moves without a wipe.
 *
 * Read-only unless `--apply` is said, because the steps are the product: a
 * person or an agent reads what WOULD change and decides. Applying lands
 * them through `applySteps`, which is `receive` on the open store — the
 * adapter hears it like any change, the log carries it like any op,
 * and undo is the ordinary undo.
 */
export async function syncSeed(argv: readonly string[]): Promise<number> {
  const app = await entryOf(argv, "sync-seed", SERVE_USAGE);
  if (typeof app === "number") return app;
  if (flag(argv, "--remote-url")) {
    process.stderr.write(
      `graview sync-seed: runs where the data is — against --data or --sqlite on the host, not a remote URL.\n`,
    );
    return 2;
  }
  const backend = await backendFrom(argv);
  if (!backend.seed) {
    process.stderr.write(`graview sync-seed: --seed <file> is required\n\n${SERVE_USAGE}`);
    return 2;
  }
  const applying = argv.includes("--apply");
  /*
   * A dry run only reads, so it runs beside a preview, and says the apply
   * would be refused rather than letting a person find out after. An apply
   * takes the store first: written behind a running preview it would be
   * invisible to its pages, and the preview's next write could undo it.
   */
  const hold = applying ? holdBackend(backend, "sync-seed", "Syncing the seed into it") : undefined;
  if (applying && !hold) return 1;
  const holder = applying ? null : heldBy(backend.holdFile);
  const opened = await openStore({ app: app as never, adapter: backend.adapter, scope: app.name, seed: backend.seed });
  try {
    const live = opened.store.graph.snapshot() as GraphSnapshot;
    const steps = seedSteps(backend.seed, live, { prune: argv.includes("--prune") });
    const json = argv.includes("--json");
    if (steps.length === 0) {
      process.stdout.write(json ? `{"steps":[],"applied":null}\n` : `graview sync-seed: ${backend.where} already has everything the seed has.\n`);
      return 0;
    }
    /*
     * JUDGED BEFORE IT IS ASKED. Every put and patch is applied to a copy as
     * the store would apply it, so a dry run that passes is an apply that
     * lands, and an apply that would be refused is refused here, naming
     * every record at once — not after a clean-looking dry run.
     */
    const refused = seedRefusals(app.schema, steps, live);
    if (refused.length > 0) {
      const fits = steps.filter((step) => !refused.some((one) => one.step === step));
      process.stdout.write(
        json
          ? `${JSON.stringify({ steps, refused, applied: null }, null, 2)}\n`
          : `graview sync-seed: ${refused.length} of ${steps.length} step${steps.length === 1 ? "" : "s"} would be refused by what ${app.name} declares, so the store would take none of them:\n` +
              sayRefusals(refused) +
              (fits.length > 0 ? `The other ${fits.length} fit${fits.length === 1 ? "s" : ""}:\n${fits.map((step) => `  ${sayStep(step)}\n`).join("")}` : "") +
              `Nothing was written. Change these records in the seed, or the declaration, and run this again.\n`,
      );
      return 1;
    }
    if (!argv.includes("--apply")) {
      process.stdout.write(
        json
          ? `${JSON.stringify({ steps, applied: null }, null, 2)}\n`
          : `graview sync-seed: ${steps.length} step${steps.length === 1 ? "" : "s"} would bring ${backend.where} in step with the seed:\n` +
              steps.map((step) => `  ${sayStep(step)}\n`).join("") +
              (holder
                ? `Nothing was written. A ${holder.command} (pid ${holder.pid}${holder.url ? `, ${holder.url}` : ""}) holds ${backend.where}: stop it before adding --apply, or the apply will be refused.\n`
                : `Nothing was written. Add --apply to land them as one undoable operation.\n`),
      );
      return 0;
    }
    const landed = applySteps(opened.store, steps);
    await opened.flush();
    if (!landed) {
      process.stdout.write(json ? `{"steps":[],"applied":null}\n` : `graview sync-seed: the steps came to nothing against ${backend.where}.\n`);
      return 0;
    }
    process.stdout.write(
      json
        ? `${JSON.stringify({ steps, applied: { id: landed.id, batch: landed.batch, primitives: landed.primitives.length } }, null, 2)}\n`
        : `graview sync-seed: landed ${landed.primitives.length} change${landed.primitives.length === 1 ? "" : "s"} on ${backend.where} as batch ${landed.batch}.\n` +
            steps.map((step) => `  ${sayStep(step)}\n`).join("") +
            `Undo with: graview apply <entry> --undo ${JSON.stringify(landed.batch)} [--data|--sqlite as above]\n`,
    );
    return 0;
  } finally {
    opened.close();
    hold?.release();
  }
}

/** Where the page `graview preview` serves lives: the `graview` package hands it in, since the page ships there. */
export interface PreviewPage {
  readonly page: string;
  /** The opening screen's renderer (`@graview/pages/splash`), which the tool carries beside the page (Roadmap f-splash-in-document). */
  readonly splash?: SplashRenderer;
}

/**
 * The document a preview or a shots run was asked for — or the app declared
 * in code, as `graview check` loads one, with its module bundled for the
 * page (W-245) — or the reason it cannot start.
 */
async function previewInput(argv: readonly string[], command: string): Promise<{ readonly document: unknown; readonly code?: undefined } | { readonly code: { readonly app: GraviewApp; readonly bundle: string }; readonly document?: undefined } | number> {
  const file = argv[0];
  if (!file || file.startsWith("--")) {
    process.stderr.write(`graview ${command}: a declaration document (a .json file) or an app module (./dist/domain/app.js) is required\n\n${SERVE_USAGE}`);
    return 2;
  }
  if (!file.endsWith(".json")) {
    try {
      const app = await loadApp(file);
      return { code: { app, bundle: await bundleAppForPage(file) } };
    } catch (error) {
      process.stderr.write(`graview ${command}: cannot picture ${file}: ${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  }
  try {
    return { document: JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as unknown };
  } catch (error) {
    process.stderr.write(`graview ${command}: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

/** What `servePreview` is handed of it: the document, or the app in code. */
const previewed = (input: { readonly document?: unknown; readonly code?: { readonly app: GraviewApp; readonly bundle: string } }) => (input.code ? { code: input.code as never } : { document: input.document });

/** A view proposed and not kept (FR-187), from `--view <view.js> --manifest <manifest.json>`: nothing when neither is given, or the reason it cannot be read. */
function draftOf(argv: readonly string[], command: string): { readonly draftView?: { readonly manifest: unknown; readonly source: string } } | number {
  const view = flag(argv, "--view");
  const manifest = flag(argv, "--manifest");
  if (view === undefined && manifest === undefined) return {};
  if (view === undefined || manifest === undefined) {
    process.stderr.write(`graview ${command}: --view and --manifest go together: the view's source and its manifest\n`);
    return 2;
  }
  try {
    return { draftView: { manifest: JSON.parse(readFileSync(resolve(process.cwd(), manifest), "utf8")) as unknown, source: readFileSync(resolve(process.cwd(), view), "utf8") } };
  } catch (error) {
    process.stderr.write(`graview ${command}: cannot read the view: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

const listOf = (said: string | undefined): string[] =>
  (said ?? "")
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);

/** What a step throws, said as the command's sentence rather than a stack: a seed that does not read, say. */
async function said<T>(command: string, step: () => Promise<T>): Promise<T | undefined> {
  try {
    return await step();
  } catch (error) {
    process.stderr.write(`graview ${command}: ${error instanceof Error ? error.message : String(error)}\n`);
    return undefined;
  }
}

/**
 * `graview preview` — the store and Graview's own faces over a document,
 * for somebody with no product (`./serve-preview.ts`).
 */
export async function preview(argv: readonly string[], { page, splash }: PreviewPage): Promise<number> {
  const input = await previewInput(argv, "preview");
  if (typeof input === "number") return input;
  const draft = draftOf(argv, "preview");
  if (typeof draft === "number") return draft;
  const host = flag(argv, "--host") ?? "127.0.0.1";
  const trust = seatTrust(host, argv.includes("--trust-seat-headers"));
  if ("refuse" in trust) {
    process.stderr.write(trust.refuse.replaceAll("graview serve", "graview preview"));
    return 1;
  }
  const keeps = flag(argv, "--data") !== undefined || flag(argv, "--sqlite") !== undefined;
  const backend = await said("preview", () => backendFrom(argv));
  if (backend === undefined) return 1;
  const roles = flag(argv, "--roles");
  const as = flag(argv, "--as");
  // A preview that keeps its data holds the store while it runs: nothing else may write it behind the pages it serves.
  const hold = keeps ? holdBackend(backend, "preview", "Previewing it a second time") : undefined;
  if (keeps && !hold) return 1;
  let opened;
  try {
    opened = await servePreview({
      ...previewed(input),
      page,
      ...(splash ? { splash } : {}),
      ...draft,
      ...(backend.seed ? { seed: backend.seed } : {}),
      ...(keeps ? { adapter: backend.adapter, where: backend.where } : {}),
      // A free port unless told: `graview serve` holds 5196, and the two run side by side.
      port: Number(flag(argv, "--port") ?? 0),
      host,
      trustSeatHeaders: trust.trust,
      // On loopback, this run's key: another account on this machine reaches loopback too.
      ...(trust.keyed ? { key: serveKey() } : {}),
      principal: previewPrincipal(input.code?.app ?? input.document, { ...(as ? { as } : {}), ...(roles !== undefined ? { roles: listOf(roles) } : {}) }),
      // The document's connections: credentials from the environment, cursors beside the data when it is kept, else in memory.
      connections: {
        ...(keeps ? { state: fileConnectionState(connectionsFileOf(backend, input.code?.app.name ?? (input.document as { name?: string }).name ?? "app")) } : {}),
        paused: argv.includes("--no-sync"),
        say: (line) => process.stdout.write(`graview preview: connection ${line}\n`),
      },
    });
  } catch (error) {
    hold?.release();
    process.stderr.write(`graview preview: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  const { app, served, url, principal } = opened;
  hold?.serving(url);
  // Each address said carries this run's key, which a browser trades for a cookie on the first one it opens.
  const at = (path: string) => keyedAddress(`${url}${path}`, opened.key);
  // Listening for a stop before saying where it listens: whoever reads the address may send one at once.
  stopOnSignal("preview", () => opened.close(), hold);
  process.stdout.write(
    `graview preview: ${app.name} on ${url}\n` +
      `  Pages: ${at("/")}   the scene: ${at("/places/overview")}\n` +
      // Each form for a visitor at its own address, answered as a visitor minted per page (Roadmap f-public-forms).
      (app.forms && Object.keys(app.forms).length > 0 ? `  forms: ${Object.keys(app.forms).map((name) => at(`/forms/${name}`)).join("   ")}\n` : "") +
      `  data: ${keeps ? `${backend.where}  (${backend.adapter.name}), held by this preview: other writers are refused until it stops` : "in memory, gone when the preview stops"}\n` +
      `  sits as ${principal.name ?? principal.id}${principal.roles?.length ? `, holding ${principal.roles.join(", ")}` : ""}\n` +
      `  ${served.store.graph.allNodes().length} nodes. Ctrl-C stops it.\n`,
  );
  return 0;
}

/**
 * `graview shots` — named places photographed headless over the same
 * preview, on a free port of its own, into PNGs (`./shots.ts`).
 */
export async function shots(argv: readonly string[], { page }: PreviewPage): Promise<number> {
  const input = await previewInput(argv, "shots");
  if (typeof input === "number") return input;
  const draft = draftOf(argv, "shots");
  if (typeof draft === "number") return draft;
  const scheme = flag(argv, "--scheme") ?? "light";
  if (!["light", "dark", "both"].includes(scheme)) {
    process.stderr.write(`graview shots: --scheme is light, dark or both (got ${JSON.stringify(scheme)})\n`);
    return 2;
  }
  const widths = listOf(flag(argv, "--width") ?? "1280").map(Number);
  if (widths.some((width) => !Number.isInteger(width) || width < 200 || width > 4000)) {
    process.stderr.write(`graview shots: --width takes widths in pixels, 200 to 4000, separated by commas\n`);
    return 2;
  }
  const faces = listOf(flag(argv, "--faces") ?? "pages");
  if (faces.length === 0 || faces.some((face) => face !== "pages" && face !== "scene")) {
    process.stderr.write(`graview shots: --faces is pages, scene or pages,scene\n`);
    return 2;
  }
  const engine = await findPlaywright();
  if (!engine) {
    process.stderr.write(NO_PLAYWRIGHT);
    return 1;
  }
  const backend = await said("shots", () => backendFrom(argv));
  if (backend === undefined) return 1;
  let opened;
  try {
    // On loopback, as every shots run is, with this run's key: the pages it opens trade it for a cookie.
    opened = await servePreview({ ...previewed(input), page, ...draft, ...(backend.seed ? { seed: backend.seed } : {}), port: Number(flag(argv, "--port") ?? 0), key: serveKey() });
  } catch (error) {
    process.stderr.write(`graview shots: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  try {
    // A draft's place by its title too, as a kept view's (W-243).
    const drafted = draft.draftView?.manifest;
    const { shots: taken, unknown } = shotsOf(opened.app, listOf(flag(argv, "--places")), faces as ("pages" | "scene")[], drafted);
    if (unknown.length > 0) {
      const known = shotsOf(opened.app, [], ["pages"], drafted).shots.map((shot) => shot.name).join(", ");
      process.stderr.write(`graview shots: ${opened.app.name} has no place called ${unknown.map((one) => JSON.stringify(one)).join(", ")}. Its places: ${known}, or a path such as /places/overview.\n`);
      return 2;
    }
    const out = resolve(process.cwd(), flag(argv, "--out") ?? "shots");
    try {
      const files = await shoot({
        url: opened.url,
        ...(opened.key !== undefined ? { key: opened.key } : {}),
        shots: taken,
        out,
        schemes: scheme === "both" ? ["light", "dark"] : [scheme as "light" | "dark"],
        widths,
        engine,
        onShot: (file) => process.stdout.write(`  ${file}\n`),
      });
      process.stdout.write(`graview shots: ${files.length} picture${files.length === 1 ? "" : "s"} of ${opened.app.name} in ${out}\n`);
      return 0;
    } catch (error) {
      const said = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        /Executable doesn't exist|playwright install/i.test(said)
          ? `graview shots: Playwright is installed but its browser is not. Run: npx playwright install chromium\n`
          : `graview shots: ${said}\n`,
      );
      return 1;
    }
  } finally {
    await opened.close();
  }
}

/**
 * The sqlite adapter, imported only when asked for.
 *
 * `better-sqlite3` is a native module. A static import would make every
 * `graview serve` — and every bundler that ever saw this file — need it
 * built, for a flag most people never pass.
 */
async function sqliteAdapter(file: string) {
  const { createSqliteAdapter } = await import("@graview/core");
  const { default: Database } = (await import("better-sqlite3" as string)) as {
    default: new (path: string) => never;
  };
  // `createTables` because this is the "point it at a file" case: an app
  // with its own Drizzle schema passes its own database and leaves it alone.
  return createSqliteAdapter({ database: new Database(file), createTables: true });
}

