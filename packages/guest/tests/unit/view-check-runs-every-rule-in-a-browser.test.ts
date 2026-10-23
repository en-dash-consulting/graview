import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIT_PAGE_SCRIPT } from "../../src/audit/page.generated.js";
import { auditPage, BrowserMissing, loadPlaywright, PLAYWRIGHT_MISSING } from "../../src/audit/browser.js";
import { HEADLESS_THEME } from "../../src/headless/index.js";
import { markupOf } from "../../src/headless/serialize.js";
import { createTree } from "../../src/headless/tree.js";
// @ts-expect-error — a plain .mjs module of the scripts, with no declarations.
import { auditPageModule, GENERATED_AUDIT } from "../../../../scripts/guest-view-runtime.mjs";

/*
 * `graview view check --audit --browser` (0.1.48, Roadmap
 * f-view-audit-in-a-browser). The ring the keyboard shows, text contrast
 * and a keyboard trap ran only inside scripts/verify-a11y.mjs: a view's
 * author had no way to run them. `--browser` lays what the view drew out in
 * Chromium, through the project's own Playwright — an optional peer of
 * @graview/guest, asked for only by this flag — and runs every rule there.
 * Headless here: what it hands the page, and what it says without
 * Playwright. In a browser: `pnpm verify a11y`
 * ("graviewViewCheckBrowserRunsEveryRule").
 */

describe("what a headless run hands the page", () => {
  it("is its drawing as markup a browser parses back the same: escaped, void elements closed, SVG kept, a field's value, and what it hears a click on marked", () => {
    const { document, root } = createTree();
    const p = document.createElement("p");
    p.setAttribute("title", 'Say "hi" & go');
    p.appendChild(document.createTextNode("<b>not bold</b> & more"));
    const input = document.createElement("input");
    input.setAttribute("name", "note");
    input.value = "typed";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
    const more = document.createElement("div");
    more.setAttribute("class", "more");
    more.appendChild(document.createTextNode("More"));
    for (const one of [p, input, svg, more]) root.appendChild(one);
    expect(markupOf(root, new Set([more]))).toBe(
      '<p title="Say &quot;hi&quot; &amp; go">&lt;b&gt;not bold&lt;/b&gt; &amp; more</p><input name="note" value="typed"><svg viewBox="0 0 10 10"><circle></circle></svg><div class="more" data-graview-audit-clicked>More</div>',
    );
  });

  it("is a page with the app's tokens, a control before the view and one after it, and the view's title said safely", () => {
    const page = auditPage({ markup: "", css: "", title: 'The "watch" <b>', clicked: "[data-graview-audit-clicked]" }, HEADLESS_THEME);
    expect(page).toContain(`--graview-accent: ${HEADLESS_THEME.accent};`);
    expect(page).toContain(`--graview-ink: ${HEADLESS_THEME.ink};`);
    expect(page.indexOf("data-audit-before")).toBeLessThan(page.indexOf("data-worker-view"));
    expect(page.indexOf("data-worker-view")).toBeLessThan(page.indexOf("data-audit-after"));
    expect(page).toContain('aria-label="The &quot;watch&quot; &lt;b>"');
    expect(page).not.toContain("<b>");
  });

  it("carries the audit as one classic script, current with its source (pnpm guest:runtime), that loads nothing", async () => {
    expect(readFileSync(GENERATED_AUDIT, "utf8")).toBe(await auditPageModule());
    expect(AUDIT_PAGE_SCRIPT).toContain("__graviewAudit");
    expect(AUDIT_PAGE_SCRIPT).not.toMatch(/\bimport\s*\(|\bimport\s+[{*\w]|\brequire\(/);
  });
});

describe("without Playwright", () => {
  afterEach(() => {
    vi.doUnmock("playwright");
    vi.resetModules();
  });

  it("says what to install, rather than failing on a missing module", async () => {
    await expect(loadPlaywright(() => Promise.reject(new Error("Cannot find package 'playwright'")))).rejects.toThrow(BrowserMissing);
    await expect(loadPlaywright(() => Promise.resolve({}))).rejects.toThrow(PLAYWRIGHT_MISSING);
    expect(PLAYWRIGHT_MISSING).toContain("npm install --save-dev playwright");
    expect(PLAYWRIGHT_MISSING).toContain("npx playwright install chromium");
  });

  it("graview view check --audit --browser exits 1 and says so, and --audit alone still runs the rules a drawing answers", async () => {
    vi.doMock("playwright", () => ({ default: {}, chromium: undefined }));
    const { view } = await import("../../src/cli.js");
    const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
    const argv = (...more: string[]) => [
      "check",
      new URL("../fixtures/lifelogics/packages.js", import.meta.url).pathname,
      "--app",
      new URL("lifelogics.gdd.json", fixtures).pathname,
      "--manifest",
      new URL("../fixtures/lifelogics/packages.manifest.json", import.meta.url).pathname,
      "--seed",
      new URL("lifelogics.seed.json", fixtures).pathname,
      ...more,
    ];
    const out: string[] = [];
    const err: string[] = [];
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (out.push(String(chunk)), true));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (err.push(String(chunk)), true));
    try {
      expect(await view(argv("--audit", "--browser"))).toBe(1);
      expect(err.join("")).toContain(PLAYWRIGHT_MISSING);
      out.length = 0;
      expect(await view(argv("--audit"))).toBe(0);
      expect(out.join("")).toContain("Not run: focus-visible");
      expect(out.join("")).toContain("Not run: keyboard-trap");
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
