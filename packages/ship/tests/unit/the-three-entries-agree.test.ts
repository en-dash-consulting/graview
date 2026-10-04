import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THREE ENTRIES, ONE VOCABULARY. `@graview/ship` is imported three ways:
 * the main entry (Node), `./browser` (a page) and `./runtime` (a server in
 * any JavaScript runtime). A runtime host that hydrates a remote store, or
 * reports its status, names the same types a page or a Node host names, and
 * an entry that left one out made it write `import type` from an entry it
 * may not import. So every name the main or browser entry exports is on the
 * runtime entry too, unless it is listed below with why a server has no use
 * for it — and the list itself is checked, so it cannot go stale.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../src");

/** The names an entry exports, read from its `export { … } from` and `export type { … } from` lines. */
function exportsOf(entry: string): Set<string> {
  const source = readFileSync(resolve(src, entry), "utf8");
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s+from/g)) {
    for (const name of match[1]!.split(",").map((part) => part.trim()).filter(Boolean)) names.add(name.replace(/^type\s+/, "").split(/\s+as\s+/).at(-1)!);
  }
  return names;
}

/** What the runtime entry leaves out on purpose: a page's, or Node's. */
const NOT_ON_THE_RUNTIME: Readonly<Record<string, string>> = {
  // The page's storage: localStorage and the address bar.
  browserStartsFresh: "a page's address bar",
  createBrowserAdapter: "localStorage",
  forgetFreshParam: "a page's address bar",
  freshHref: "a page's address bar",
  BrowserAdapter: "localStorage",
  BrowserAdapterOptions: "localStorage",
  StorageLike: "localStorage",
  // Tab-to-tab presence: a BroadcastChannel between a person's tabs.
  createBroadcastPresence: "a page's tabs",
  presenceChannelName: "a page's tabs",
  BroadcastPresenceOptions: "a page's tabs",
  ChannelLike: "a page's tabs",
  // The photograph budget is a browser's storage quota, judged before the act in the page.
  assertPhotoFits: "a browser's quota",
  photosUsed: "a browser's quota",
  storageBytes: "a browser's quota",
  PhotoTooLarge: "a browser's quota",
  PHOTO_BUDGET_BYTES: "a browser's quota",
  PHOTO_MAX_BYTES: "a browser's quota",
  PhotoBudget: "a browser's quota",
  PhotoField: "a browser's quota",
  // Node: the filesystem, node:http and the CLI.
  createFileAdapter: "node:fs",
  FileAdapter: "node:fs",
  serveStore: "node:http",
  ServeOptions: "node:http",
  ServedStore: "node:http",
  serve: "the CLI",
  SERVE_USAGE: "the CLI",
  backendFrom: "the CLI",
  syncSeed: "the CLI",
  StoreBackend: "the CLI",
};

describe("the runtime entry, beside the main and browser entries", () => {
  const main = exportsOf("index.ts");
  const browser = exportsOf("browser.ts");
  const runtime = exportsOf("runtime.ts");

  it("exports every name the main or browser entry does, but those a server has no use for", () => {
    const missing = [...new Set([...main, ...browser])].filter((name) => !runtime.has(name) && !(name in NOT_ON_THE_RUNTIME)).sort();
    expect(missing).toEqual([]);
  });

  it("carries the observable client's types, as the main and browser entries do", () => {
    for (const name of ["RemoteStatus", "RemoteCounters", "RemoteBackoff", "RemoteStore", "RemoteOptions"]) {
      expect([main.has(name), browser.has(name), runtime.has(name)], name).toEqual([true, true, true]);
    }
  });

  it("leaves out only what it really leaves out, so the list says the truth", () => {
    const listed = Object.keys(NOT_ON_THE_RUNTIME);
    expect(listed.filter((name) => runtime.has(name))).toEqual([]);
    expect(listed.filter((name) => !main.has(name) && !browser.has(name))).toEqual([]);
  });

  it("exports nothing the main entry does not, so Node reaches every name a runtime does", () => {
    expect([...runtime].filter((name) => !main.has(name)).sort()).toEqual([]);
  });
});
