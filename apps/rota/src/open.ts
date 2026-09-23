import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  openRemote,
  openStore,
} from "@graview/ship/browser";
import type { Principal, Store } from "@graview/core";
import example from "./data/example.json";
import { rotaApp } from "./domain/app.js";
import { rotaBrand } from "./domain/brand.js";
import type { RotaSchema } from "./domain/schema.js";
import { openingSeat, today } from "./ui/app.js";

/**
 * HOW ROTA OPENS ITSELF, wherever it is opened — its own port, the
 * launcher, or against a server.
 *
 * Three places, one function. `?server=…` opens the store from a running
 * `graview serve` instead of from this browser; `?stored=1` puts a
 * version-1 roster in this browser first, so the migration is something a
 * reader can watch rather than a claim in a changelog.
 */
export interface OpenedApp {
  readonly store: Store<RotaSchema>;
  readonly principal: Principal;
  readonly brand: typeof rotaBrand;
  readonly remembers: boolean;
  /** What the opening had to run to get here — empty on an ordinary visit. */
  readonly migrated: readonly string[];
  /** Where the roster lives, for anything that wants to say so. */
  readonly where: string;
  onRefusal(listener: (reason: string) => void): () => void;
  /** What this browser has, askable from outside it — see verify-served. */
  intents(): readonly string[];
}

export async function open(): Promise<OpenedApp> {
  const principal = openingSeat();
  const search = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const server = search.get("server");

  if (server) {
    const remote = await openRemote({ app: rotaApp, url: server, principal });
    return {
      store: remote.store,
      principal,
      brand: rotaBrand,
      // The server remembers; this browser is a window onto it.
      remembers: false,
      migrated: remote.migrated,
      where: server,
      onRefusal: remote.onRefusal,
      intents: () => remote.store.log.all().map((operation) => operation.intent),
    };
  }

  const adapter = createBrowserAdapter();
  const stored = search.get("stored") === "1";
  if (stored) {
    await adapter.delete(rotaApp.name);
    await adapter.save(rotaApp.name, {
      nodes: example.nodes.filter((node) => node.id !== "rule-limit"),
      edges: example.edges,
    });
    adapter.saveMeta(rotaApp.name, { version: 1 });
  }
  const opened = await openStore({
    app: rotaApp,
    adapter,
    scope: rotaApp.name,
    seed: example,
    // A browser deliberately holding a version-1 roster is not a fresh one.
    fresh: stored ? false : browserStartsFresh(),
    storeOptions: { invariantOptions: { context: { today: today() } } },
  });
  forgetFreshParam();
  return {
    store: opened.store,
    principal,
    brand: rotaBrand,
    remembers: true,
    migrated: opened.migrated.map((operation) => operation.intent),
    where: "browser",
    onRefusal: () => () => {},
    intents: () => opened.store.log.all().map((operation) => operation.intent),
  };
}
