import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { entryArg, loadApp } from "@graview/core/cli";
import { readSnapshot } from "@graview/core/snapshot";
import type { GraviewApp, PersistenceAdapter } from "@graview/core";
import { createFileAdapter } from "./file-adapter.js";
import { fileSubscriptions } from "./file-subscriptions.js";
import { LIVE_PATH } from "./live.js";
import { openStore } from "./open-store.js";
import { serveStore } from "./serve.js";
import type { GraphSnapshot } from "./snapshot.js";
import { sayStep } from "./steps.js";
import { LOOPBACK, previewPrincipal, servePreview } from "./serve-preview.js";
import { findPlaywright, NO_PLAYWRIGHT, shoot, shotsOf } from "./shots.js";
import { applySteps, seedSteps } from "./sync-seed.js";
import { heldBy, holdFileOf, holdStore, sayHeld, type StoreHold } from "./store-hold.js";
import type { StoredMeta } from "./meta.js";

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
                       [--host <address>] [--trust-seat-headers]
      Serves the app's store over HTTP, and live over a WebSocket at
      /graview/live. The op log is the wire: a client sends calls, the
      store judges them under the caller's own seat, and the ops come back,
      pushed to every socket as they land. Data lives in <dir> (default
      ./data) as readable JSON, or in a SQLite file with --sqlite. It listens on 127.0.0.1 and
      believes the seat a request names in its headers, because only this
      machine can reach it; on any other --host it will not start unless
      --trust-seat-headers says the network in front of it can be trusted.

  graview sync-seed <entry> --seed <file> [--data <dir> | --sqlite <file>]
                            [--apply] [--prune] [--json]
      Diffs the bootstrap seed against the live store and says, as content
      steps, what would bring the store in step with it: records put,
      fields patched, ties made. Prints and exits by default; --apply lands
      the steps as one logged, undoable operation; --prune also drops what
      the seed no longer has. The seed itself is only ever read at first
      install — this is how default content moves afterwards, in place of
      deleting the store.

  graview preview <document.json> [--seed <file>] [--port <n>] [--host <address>]
                  [--data <dir> | --sqlite <file>] [--as <id>] [--roles a,b]
      Serves the store and Graview's own faces over it — the scene and
      Pages, with the bar — so a document and a snapshot can be looked at
      with no product. Nothing to build or install: the page ships with
      graview. The store is in memory unless --data or --sqlite name where
      to keep it; the page sits as a person holding every role the document
      declares, unless --as or --roles say who.

  graview shots <document.json> [--seed <file>] [--places a,b] [--out <dir>]
                [--scheme light|dark|both] [--width <px>[,<px>]] [--faces pages,scene]
      Photographs places headless to PNGs, <place>-<scheme>-<width>.png in
      <dir> (default ./shots): each place by its address word or title (the
      home, overview, a lens's name, a kind's plural) or a path such as
      /tasks/t1; every place when none is named. Needs Playwright, which you
      install beside the project (npm i -D playwright, then npx playwright
      install chromium).
`;

/** The same store, whichever command asked: parsed from the flags every store command shares. */
export const STORE_FLAGS = `--data <dir> (default ./data) | --sqlite <file>, and --seed <file> for a first install`;

export function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  if (at === -1) return undefined;
  return argv[at + 1];
}

export interface StoreBackend {
  readonly adapter: PersistenceAdapter<string> & {
    loadMeta?(scope: string): StoredMeta | null;
    saveMeta?(scope: string, meta: StoredMeta): void;
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
export function subscriptionsFileOf(backend: Pick<StoreBackend, "adapter" | "where">, scope: string): string {
  const root = (backend.adapter as { root?: string }).root;
  return root !== undefined ? join(root, scope, "subscriptions.json") : `${backend.where}.subscriptions.json`;
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
export function seatTrust(host: string, trustFlag: boolean): { readonly trust: boolean; readonly says: string } | { readonly refuse: string } {
  if (LOOPBACK.has(host)) return { trust: true, says: `believes seat headers: listening on ${host}, which only this machine reaches` };
  if (trustFlag) return { trust: true, says: `believes seat headers on ${host}, because --trust-seat-headers says the network in front of it is trusted` };
  return {
    refuse:
      `graview serve: refusing to listen on ${host} while believing seat headers — anyone who can reach it could claim any seat.\n` +
      `  Serve on 127.0.0.1 (the default), put a host that authenticates in front with its own seatOf, or say --trust-seat-headers.\n`,
  };
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
  const served = await serveStore({
    app: app as never,
    adapter: backend.adapter,
    ...(backend.seed ? { seed: backend.seed } : {}),
    port,
    host,
    trustSeatHeaders: trust.trust,
    where: backend.where,
    // Notify me: kept beside the store, and each match said here, where a host would deliver it.
    subscriptions: fileSubscriptions(subscriptionsFileOf(backend, app.name)),
    onSubscriptionMatch: (match) => {
      process.stdout.write(`graview serve: notify ${match.subscription.who.name ?? match.subscription.who.id}: ${match.said}\n`);
    },
  });
  hold.serving(served.url);

  process.stdout.write(
    `graview serve: ${app.name} on ${served.url}\n` +
      `  live: ${served.url.replace(/^http/, "ws")}${LIVE_PATH}\n` +
      `  data: ${backend.where}  (${backend.adapter.name})\n` +
      `  ${trust.says}\n` +
      `  ${served.store.graph.allNodes().length} nodes, ${served.opened.store.log.all().length} operations` +
      `${served.opened.migrated.length > 0 ? `, migrated: ${served.opened.migrated.map((op) => op.intent).join("; ")}` : ""}\n`,
  );
  const stop = () => {
    void served.close().then(() => {
      hold.release();
      process.exit(0);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return 0;
}

/**
 * `graview sync-seed` — default content moves without a wipe.
 *
 * Read-only unless `--apply` is said, because the steps are the product: a
 * person or an agent reads what WOULD change and decides. Applying lands
 * them through `applySteps`, which is `receive` on the open store — the
 * adapter hears it like any change, the log carries it with its inverse,
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
}

/** The document a preview or a shots run was asked for, or the reason it cannot start. */
function previewInput(argv: readonly string[], command: string): { readonly document: unknown } | number {
  const file = argv[0];
  if (!file || file.startsWith("--") || !file.endsWith(".json")) {
    process.stderr.write(`graview ${command}: a declaration document (a .json file) is required\n\n${SERVE_USAGE}`);
    return 2;
  }
  try {
    return { document: JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as unknown };
  } catch (error) {
    process.stderr.write(`graview ${command}: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}\n`);
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
export async function preview(argv: readonly string[], { page }: PreviewPage): Promise<number> {
  const input = previewInput(argv, "preview");
  if (typeof input === "number") return input;
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
      document: input.document,
      page,
      ...(backend.seed ? { seed: backend.seed } : {}),
      ...(keeps ? { adapter: backend.adapter, where: backend.where } : {}),
      // A free port unless told: `graview serve` holds 5196, and the two run side by side.
      port: Number(flag(argv, "--port") ?? 0),
      host,
      trustSeatHeaders: trust.trust,
      principal: previewPrincipal(input.document, { ...(as ? { as } : {}), ...(roles !== undefined ? { roles: listOf(roles) } : {}) }),
    });
  } catch (error) {
    hold?.release();
    process.stderr.write(`graview preview: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  const { app, served, url, principal } = opened;
  hold?.serving(url);
  process.stdout.write(
    `graview preview: ${app.name} on ${url}\n` +
      `  Pages: ${url}/   the scene: ${url}/places/overview\n` +
      `  data: ${keeps ? `${backend.where}  (${backend.adapter.name}), held by this preview: other writers are refused until it stops` : "in memory, gone when the preview stops"}\n` +
      `  sits as ${principal.name ?? principal.id}${principal.roles?.length ? `, holding ${principal.roles.join(", ")}` : ""}\n` +
      `  ${served.store.graph.allNodes().length} nodes. Ctrl-C stops it.\n`,
  );
  const stop = () => {
    void opened.close().then(() => {
      hold?.release();
      process.exit(0);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return 0;
}

/**
 * `graview shots` — named places photographed headless over the same
 * preview, on a free port of its own, into PNGs (`./shots.ts`).
 */
export async function shots(argv: readonly string[], { page }: PreviewPage): Promise<number> {
  const input = previewInput(argv, "shots");
  if (typeof input === "number") return input;
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
    opened = await servePreview({ document: input.document, page, ...(backend.seed ? { seed: backend.seed } : {}), port: Number(flag(argv, "--port") ?? 0) });
  } catch (error) {
    process.stderr.write(`graview shots: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  try {
    const { shots: taken, unknown } = shotsOf(opened.app, listOf(flag(argv, "--places")), faces as ("pages" | "scene")[]);
    if (unknown.length > 0) {
      const known = shotsOf(opened.app, [], ["pages"]).shots.map((shot) => shot.name).join(", ");
      process.stderr.write(`graview shots: ${opened.app.name} has no place called ${unknown.map((one) => JSON.stringify(one)).join(", ")}. Its places: ${known}, or a path such as /places/overview.\n`);
      return 2;
    }
    const out = resolve(process.cwd(), flag(argv, "--out") ?? "shots");
    try {
      const files = await shoot({
        url: opened.url,
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

