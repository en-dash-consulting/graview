import type { GuestTheme } from "../protocol.js";
import { REGION_CSS } from "../host/open-draw.js";
import type { AuditProblem, ViewAudit } from "./rules.js";

/*
 * THE RULES THAT NEED A BROWSER, RUN IN ONE (`graview view check --audit
 * --browser`). A headless run holds what a view drew to the rules its
 * structure answers; the ring the keyboard shows and text contrast need a
 * page laid out, and a keyboard trap needs Tab pressed. This opens Chromium
 * through Playwright — an optional peer of `@graview/guest`, asked for only
 * here — puts what the view drew in a region as the host draws it (the
 * host's region rules, the view's stylesheets as the host keeps them, the
 * app's tokens), between a control before and a control after, and runs
 * every rule there: `auditView` in the page, then Tab from before the view
 * until the keyboard is past it, and Shift+Tab back.
 *
 * A view's script does not run in that page: it ran headless, and what it
 * drew is what is laid out. A view cannot hold Tab by script — the host
 * tells a view no Tab, and no focus — so the order Tab walks is the order
 * the drawing gives, which is what is walked here.
 *
 * Nothing is fetched: every request the page makes is refused.
 */

/** What a headless run drew, ready for a page. */
export interface ViewDrawing {
  /** The view's markup, with the host's marks, from `markupOf`. */
  readonly markup: string;
  /** Its stylesheets, as the host keeps them (sanitized). */
  readonly css: string;
  /** What the region is called: the view's title. */
  readonly title: string;
  /** The elements the view hears a click on, as one selector within the drawing. */
  readonly clicked: string;
}

export interface BrowserAuditOptions {
  readonly theme: GuestTheme;
  /** The page's width in CSS pixels; 1440 by default. */
  readonly width?: number;
}

/** Playwright is not installed, or its Chromium is not: said as what to run. */
export class BrowserMissing extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserMissing";
  }
}

export const PLAYWRIGHT_MISSING =
  "--browser opens Chromium through Playwright, which this project does not have. Add it beside graview (npm install --save-dev playwright) and its browser (npx playwright install chromium), or leave --browser off to run the rules a drawing alone answers.";

/* As much of Playwright as this asks of it. */
interface Page {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  route(url: string, handler: (route: { abort(): Promise<void> }) => Promise<void> | void): Promise<void>;
  setContent(html: string): Promise<void>;
  addScriptTag(options: { content: string }): Promise<unknown>;
  evaluate<R, A>(run: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  focus(selector: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
}
interface Browser {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(options?: { headless?: boolean }): Promise<Browser> };
}

/** Playwright, from the project that runs the command; `BrowserMissing` when it has none. */
export async function loadPlaywright(load: () => Promise<unknown> = () => import(/* @vite-ignore */ "playwright" as string)): Promise<Playwright> {
  let module: unknown;
  try {
    module = await load();
  } catch {
    throw new BrowserMissing(PLAYWRIGHT_MISSING);
  }
  const playwright = ((module as { default?: unknown }).default ?? module) as Partial<Playwright>;
  if (!playwright.chromium || typeof playwright.chromium.launch !== "function") throw new BrowserMissing(PLAYWRIGHT_MISSING);
  return playwright as Playwright;
}

const TOKENS: readonly (readonly [keyof GuestTheme, string])[] = [
  ["accent", "--graview-accent"],
  ["ground", "--graview-ground"],
  ["panel", "--graview-panel"],
  ["ink", "--graview-ink"],
  ["inkMuted", "--graview-ink-muted"],
  ["edge", "--graview-edge"],
  ["fontBody", "--graview-font-body"],
  ["fontDisplay", "--graview-font-display"],
  ["fontMono", "--graview-font-mono"],
  ["radius", "--graview-radius"],
];

/** The page the drawing is laid out in: the app's tokens, a control before the region and one after it. */
export function auditPage(drawing: ViewDrawing, theme: GuestTheme): string {
  const safe = (value: string) => value.replace(/[<>{};]/g, "");
  const tokens = TOKENS.map(([key, name]) => `${name}: ${safe(String(theme[key] ?? ""))};`).join(" ");
  const title = drawing.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
:root { ${tokens} color-scheme: ${theme.scheme}; }
body { margin: 0; padding: 16px; background: var(--graview-ground); color: var(--graview-ink); font-family: var(--graview-font-body); }
</style></head><body><button type="button" data-audit-before>Before the view</button><div data-worker-view role="region" aria-label="${title}"></div><button type="button" data-audit-after>After the view</button></body></html>`;
}

/** Where the keyboard is: before the view, after it, in it (and on what), or somewhere else. */
type Where = { readonly at: "before" | "after" | "outside" } | { readonly at: "inside"; readonly on: string };

/**
 * Run every rule over a drawing in Chromium. `script` is the audit as one
 * classic script (`AUDIT_PAGE_SCRIPT`); `playwright` is what `loadPlaywright`
 * answered.
 */
export async function auditInBrowser(drawing: ViewDrawing, options: BrowserAuditOptions & { readonly playwright: Playwright; readonly script: string }): Promise<ViewAudit> {
  let browser: Browser;
  try {
    browser = await options.playwright.chromium.launch({ headless: true });
  } catch (error) {
    throw new BrowserMissing(`Playwright could not open Chromium (${error instanceof Error ? error.message.split("\n")[0] : String(error)}). Install its browser with npx playwright install chromium.`);
  }
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: options.width ?? 1440, height: 900 });
    await page.route("**/*", (route) => route.abort());
    await page.setContent(auditPage(drawing, options.theme));
    await page.evaluate(
      ({ css, markup }) => {
        const region = document.querySelector("[data-worker-view]")!;
        const shadow = region.attachShadow({ mode: "open" });
        const style = document.createElement("style");
        style.textContent = css;
        const root = document.createElement("div");
        root.setAttribute("data-graview-view-root", "");
        root.innerHTML = markup;
        shadow.append(style, root);
      },
      { css: `${REGION_CSS}\n${drawing.css}`, markup: drawing.markup },
    );
    await page.addScriptTag({ content: options.script });
    const audit = await page.evaluate(
      (clicked) => {
        const run = (globalThis as unknown as { __graviewAudit: (root: unknown, options: unknown) => unknown }).__graviewAudit;
        return JSON.parse(JSON.stringify(run(document.querySelector("[data-worker-view]")!.shadowRoot, { clicked: [clicked] })));
      },
      drawing.clicked,
    ) as ViewAudit;

    /* THE TRAP: Tab from before the view until the keyboard is after it, and Shift+Tab back. */
    const where = () =>
      page.evaluate(() => {
        const at = document.activeElement;
        if (at?.hasAttribute("data-audit-before")) return { at: "before" } as const;
        if (at?.hasAttribute("data-audit-after")) return { at: "after" } as const;
        const region = document.querySelector("[data-worker-view]")!;
        if (at !== region) return { at: "outside" } as const;
        /* Said as the audit says where: from the nearest data-key down, else from the view's root. */
        const path: string[] = [];
        for (let one = region.shadowRoot!.activeElement; one && !one.hasAttribute("data-graview-view-root"); one = one.parentElement) {
          const key = one.getAttribute("data-key");
          if (key) {
            path.unshift(`[data-key="${key.replace(/["\\]/g, "\\$&")}"]`);
            break;
          }
          const index = one.parentElement ? Array.from(one.parentElement.children).indexOf(one) + 1 : 1;
          path.unshift(`${one.localName}:nth-child(${index})`);
        }
        return { at: "inside", on: path.join(" > ") || "the view" } as const;
      }, undefined) as Promise<Where>;
    const stops = await page.evaluate(
      () =>
        document.querySelector("[data-worker-view]")!.shadowRoot!.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]').length,
      undefined,
    );
    const limit = stops * 2 + 4;
    const walk = async (from: string, key: string, to: "before" | "after"): Promise<{ readonly left: boolean; readonly last?: string }> => {
      await page.focus(from);
      let last: string | undefined;
      for (let press = 0; press < limit; press += 1) {
        await page.keyboard.press(key);
        const now = await where();
        if (now.at === to || now.at === "outside") return { left: true };
        if (now.at === "inside") last = now.on;
      }
      return { left: false, ...(last ? { last } : {}) };
    };
    const forward = await walk("[data-audit-before]", "Tab", "after");
    const back = await walk("[data-audit-after]", "Shift+Tab", "before");
    const trapped: AuditProblem[] = [];
    for (const [walked, way] of [[forward, "Tab"], [back, "Shift+Tab"]] as const) {
      if (walked.left) continue;
      trapped.push({
        rule: "keyboard-trap",
        wcag: "2.1.2",
        impact: "critical",
        at: walked.last ?? "the view",
        says: `${way} pressed ${limit} times from ${way === "Tab" ? "before" : "after"} the view never left it: the keyboard is held inside.`,
        fix: "Take away what turns Tab back into the view (a tabindex on an element that hands the keyboard on, or a box that takes it and holds it); Tab should walk through and out.",
        automatic: false,
      });
    }
    return {
      ...audit,
      problems: [...audit.problems, ...trapped],
      ran: [...audit.ran, "keyboard-trap"],
      skipped: audit.skipped.filter((one) => one.rule !== "keyboard-trap"),
      measured: { ...audit.measured, "keyboard-trap": stops },
    };
  } finally {
    await browser.close();
  }
}
