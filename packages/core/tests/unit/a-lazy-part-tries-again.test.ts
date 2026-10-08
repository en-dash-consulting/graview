import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { failedUrl, retryingImport } from "../../src/retrying-import.js";

/**
 * A LAZY PART THAT FAILED TO LOAD TRIES AGAIN (FR-139).
 *
 * Chromium and Firefox keep a failed `import()` for the document's life, so
 * a loader that only called the bundler's import again would fail forever.
 * The retry asks for the URL the failure named, under a query of its own.
 */
describe("a lazy part tries again", () => {
  const module = () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-retry-"));
    const file = join(dir, "part.mjs");
    writeFileSync(file, "export const part = 'here';\n");
    return pathToFileURL(file).href;
  };

  it("imports the URL a failure named, under a query of its own, where the engine keeps the failure", async () => {
    const url = module();
    const load = vi.fn(() => Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${url}`)));
    const part = retryingImport<{ part: string }>(load);
    await expect(part()).rejects.toThrow(/Failed to fetch/);
    const again = await part();
    expect(again.part).toBe("here");
    // The bundler's own import was asked once: the second try was the named URL.
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("calls the loader again where the failure names no URL, as WebKit's does not", async () => {
    let calls = 0;
    const part = retryingImport(() => (++calls === 1 ? Promise.reject(new TypeError("Importing a module script failed.")) : Promise.resolve({ part: "here" })));
    await expect(part()).rejects.toThrow(/Importing/);
    expect((await part()).part).toBe("here");
    expect(calls).toBe(2);
  });

  it("joins an attempt on its way, and keeps the module once it is here", async () => {
    const load = vi.fn(() => Promise.resolve({ part: "here" }));
    const part = retryingImport(load);
    const [one, two] = await Promise.all([part(), part()]);
    expect(one).toBe(two);
    await part();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads the URL from each engine's words", () => {
    expect(failedUrl(new TypeError("Failed to fetch dynamically imported module: http://x.test/a-1.js"))).toBe("http://x.test/a-1.js");
    expect(failedUrl(new TypeError("error loading dynamically imported module: https://x.test/a.js?v=2"))).toBe("https://x.test/a.js?v=2");
    expect(failedUrl(new TypeError("Importing a module script failed."))).toBeUndefined();
  });
});
