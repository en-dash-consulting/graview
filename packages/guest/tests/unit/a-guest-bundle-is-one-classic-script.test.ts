import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { buildGuestBundle, checkGuestBundle, GuestBundleError } from "../../src/build.js";

/**
 * A GUEST BUNDLE IS ONE CLASSIC SCRIPT (FR-71): built with the framework's
 * own tooling, it is a strict IIFE with the worker entry first and nothing
 * to load at run time — no `import`, `import()` or `importScripts` — so a
 * host starts it with `new Worker(blobUrl)` and no `type: "module"`, which
 * Chromium refuses from a `blob:` URL in an opaque origin.
 * `scripts/guest-sandbox.mjs` starts one so under Claude's policy.
 */
const at = mkdtempSync(join(tmpdir(), "graview-guest-"));
const guest = (name: string, source: string) => {
  const path = join(at, `${name}.js`);
  writeFileSync(path, source);
  return path;
};

const CARD = guest(
  "card",
  `import { connectGuest, hardening } from "@graview/guest/worker";
import { format } from "./format.js";
const guest = connectGuest();
self.__seenBeforeTheGuest = { document: typeof document, kit: typeof customElements.get("gv-card"), hardening: typeof hardening };
guest.subscribe((props) => {
  const title = document.createElement("gv-title");
  title.textContent = format(props.node);
  guest.root.replaceChildren(title);
});`,
);
guest("format", `export const format = (node) => (node ? node.label : "");`);

describe("a guest bundle built with buildGuestBundle", () => {
  it("is one strict classic script, with nothing to load at run time", async () => {
    const built = await buildGuestBundle({ entry: CARD });
    expect(built.script.startsWith('"use strict";')).toBe(true);
    expect(built.script).not.toMatch(/\bimport\s*\(|\bimportScripts\b|\bimport\.meta\b|^\s*(import|export)\s/m);
    expect(await checkGuestBundle(built.script)).toEqual([]);
    expect(built.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(built.bytes).toBe(Buffer.byteLength(built.script));
    // It carries Remote DOM, and so Remote DOM's licence.
    expect(built.script).toContain("Shopify Inc. — MIT License");
  });

  it("runs the worker entry before the guest, and the guest's import of it is the same module", async () => {
    const { script } = await buildGuestBundle({ entry: CARD });
    const posted: unknown[] = [];
    const context = createContext({ postMessage: (message: unknown) => posted.push(message), addEventListener() {}, removeEventListener() {}, queueMicrotask, setTimeout, clearTimeout });
    runInContext("globalThis.self = globalThis;", context);
    runInContext(script, context);
    expect(runInContext("__seenBeforeTheGuest", context)).toEqual({ document: "object", kit: "function", hardening: "object" });
    // One runtime: had the guest's import been a second copy, its kit would have been defined twice and the script would have thrown.
    expect(posted).toEqual([{ graview: "guest-ready", protocol: 1 }]);
  });

  it("refuses a guest that loads code at run time", async () => {
    for (const [name, source] of [
      ["dynamic", `import "@graview/guest/worker"; import("https://cdn.example/more.js");`],
      ["computed", `import "@graview/guest/worker"; const where = "https://cdn.example/" + Date.now(); import(where);`],
      ["scripts", `import "@graview/guest/worker"; self.importScripts("https://cdn.example/more.js");`],
    ] as const) {
      await expect(buildGuestBundle({ entry: guest(name, source) }), name).rejects.toThrow(/import\(\)|importScripts|not a classic script/);
    }
  });

  it("checks a script it did not build the same way, reading past its comments", async () => {
    expect(await checkGuestBundle(`"use strict";\n/* import("x") in a comment is no import */ self.x = 1;`)).toEqual([]);
    expect(await checkGuestBundle(`"use strict"; import /* hidden */ ("https://cdn.example/x.js");`)).toEqual(["it loads code at run time with import()"]);
    expect(await checkGuestBundle(`self.x = 1;`)).toEqual(['it does not start "use strict";']);
    expect(await checkGuestBundle(`"use strict"; importScripts("x.js");`)).toEqual(["it names importScripts"]);
    expect(await checkGuestBundle(`"use strict"; export const x = 1;`)).toEqual([expect.stringMatching(/^it is not a classic script/)]);
    expect(await checkGuestBundle(`"use strict"; console.log(import.meta.url);`)).toEqual([expect.stringMatching(/^it is not a classic script/)]);
  });

  it("says what was wrong, by finding", async () => {
    const error = await buildGuestBundle({ entry: guest("again", `import "@graview/guest/worker"; importScripts("x.js");`) }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GuestBundleError);
    expect((error as GuestBundleError).findings).toEqual(["it names importScripts"]);
  });
});
