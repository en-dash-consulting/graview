import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import type { AnySchema, GraviewApp, Principal, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createRotaStore, rotaApp } from "../../../../apps/rota/src/domain/app.js";
import { createSeedbedStore, seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { EXAMPLE_GARDEN } from "../../../../apps/seedbed/src/domain/example.js";
import { createTodoStore, todoApp } from "../../../../apps/todo/src/domain/app.js";

/**
 * A PLACE DRAWN FOR AN E-INK SCREEN (Roadmap f-eink-display-profile). A
 * reader on a wall shows sixteen grays, does not move, has no hover and no
 * keyboard, and is read from across a room: `renderScreen` from
 * `@graview/pages/device` draws any place of any app for it at a viewport the
 * host names — the home, a list and a record of todo, rota and seedbed here,
 * none of which has markup of its own for it.
 */

// The entry is imported with no DOM about: nothing of a browser is read as it loads, or as it renders.
expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined");
expect(typeof (globalThis as { document?: unknown }).document).toBe("undefined");
const { EINK_GRAYS, EINK_LEAST_TARGET, renderScreen, tapAt } = await import("@graview/pages/device");

const PW3 = { width: 758, height: 1024 } as const;
const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const keeper: Principal = { kind: "human", id: "user-nora", roles: ["keeper"] };
const coordinator: Principal = { kind: "human", id: "user-ada", roles: ["coordinator"] };
const gardener: Principal = { kind: "human", id: "june", roles: [] };

interface Example {
  readonly name: string;
  readonly store: () => Store<AnySchema>;
  readonly app: GraviewApp<AnySchema>;
  readonly viewer: Principal;
  readonly list: string;
}
const EXAMPLES: readonly Example[] = [
  { name: "todo", store: () => createTodoStore({ snapshot: json("../../../../apps/todo/src/data/example.json") }) as never, app: todoApp as never, viewer: keeper, list: "/tasks" },
  { name: "rota", store: () => createRotaStore({ snapshot: json("../../../../apps/rota/src/data/example.json") }) as never, app: rotaApp as never, viewer: coordinator, list: "/shifts" },
  { name: "seedbed", store: () => createSeedbedStore({ snapshot: EXAMPLE_GARDEN as never }) as never, app: seedbedApp as never, viewer: gardener, list: "/plantings" },
];

/** The home, a list and a record of each example: the three screens every app has. */
function screensOf(example: Example) {
  const store = example.store();
  const kind = example.list.slice(1);
  const listed = (store.schema.kinds as readonly string[]).find((one) => `/${store.schema.tryDefinition(one)?.plural?.toLowerCase() ?? `${one}s`}` === example.list || kind.startsWith(one))!;
  const record = store.graph.nodesOfKind(listed)[0]!;
  return ["home", example.list, record.id].map((place) => ({ place, screen: renderScreen(store, example.app, place, { profile: "eink", viewport: PW3, viewer: example.viewer }) }));
}

/** Every box placed on the screen, read off its inline style: where it is and how big. */
function boxesOf(html: string): { x: number; y: number; width: number; height: number }[] {
  return [...html.matchAll(/style="left:(\d+)px;top:(\d+)px;width:(\d+)px;height:(\d+)px"/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), width: Number(m[3]), height: Number(m[4]) }));
}

describe("every example drawn on the e-ink profile", () => {
  for (const example of EXAMPLES) {
    describe(example.name, () => {
      const screens = screensOf(example);

      it("draws its home, a list and a record, each found", () => {
        for (const { place, screen } of screens) expect(screen.found, place).toBe(true);
      });

      it("uses only the sixteen grays of the profile's ramp, in its sheet and on the page", () => {
        expect(EINK_GRAYS).toHaveLength(16);
        for (const { place, screen } of screens) {
          const colors = [...`${screen.css}\n${screen.html}`.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
          expect(colors.length, place).toBeGreaterThan(0);
          for (const color of colors) expect(EINK_GRAYS, `${place}: ${color}`).toContain(color);
          // No color said any other way: no rgb(), hsl(), named color or app token.
          expect(screen.css, place).not.toMatch(/rgba?\(|hsla?\(|oklch\(|var\(--graview|\b(red|green|blue|orange|yellow|purple|pink|teal)\b/i);
        }
      });

      it("has no transition, animation or hover rule, no script and nothing to fetch", () => {
        for (const { place, screen } of screens) {
          expect(screen.css, place).not.toMatch(/transition|animation|@keyframes|:hover|:focus|cursor/i);
          expect(screen.html, place).not.toMatch(/<script|\son[a-z]+\s*=|javascript:|<form|<button|<input|<iframe|<link\s|<img|@import|url\(|@font-face/i);
          expect(screen.html, place).toContain(screen.css);
        }
      });

      it("fits the viewport: every box inside it, a fixed screen that never scrolls", () => {
        for (const { place, screen } of screens) {
          expect(screen.html).toContain(`class="gv-screen" style="width:${PW3.width}px;height:${PW3.height}px"`);
          expect(screen.css).toMatch(/html, body \{[^}]*overflow: hidden/);
          const boxes = boxesOf(screen.html);
          expect(boxes.length, place).toBeGreaterThan(3);
          for (const box of boxes) {
            expect(box.x + box.width, place).toBeLessThanOrEqual(PW3.width);
            expect(box.y + box.height, place).toBeLessThanOrEqual(PW3.height);
          }
          // Every line is one line, cut short by the sheet rather than wrapping out of its row.
          expect(screen.css).toMatch(/\.gv-line \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis/);
        }
      });

      it("makes every press at least 64 px on each side, and no two presses overlap", () => {
        for (const { place, screen } of screens) {
          expect(screen.taps.length, place).toBeGreaterThan(0);
          for (const tap of screen.taps) {
            expect(tap.width, `${place}: ${tap.label}`).toBeGreaterThanOrEqual(EINK_LEAST_TARGET);
            expect(tap.height, `${place}: ${tap.label}`).toBeGreaterThanOrEqual(EINK_LEAST_TARGET);
            // Its own middle finds it, and nothing else.
            expect(tapAt(screen.taps, tap.x + tap.width / 2, tap.y + tap.height / 2)).toBe(tap);
          }
          for (const [i, a] of screen.taps.entries()) {
            for (const b of screen.taps.slice(i + 1)) {
              const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
              expect(apart, `${place}: ${a.label} / ${b.label}`).toBe(true);
            }
          }
        }
      });

      it("sets type for arm's length: nothing under 20 px", () => {
        const sizes = [...screens[0]!.screen.css.matchAll(/font(?:-size)?:[^;]*?(\d+)px/g)].map((m) => Number(m[1]));
        expect(sizes.length).toBeGreaterThan(5);
        for (const size of sizes) expect(size).toBeGreaterThanOrEqual(20);
      });
    });
  }
});

describe("content past the viewport", () => {
  const store = createTodoStore({ snapshot: json("../../../../apps/todo/src/data/example.json") });
  const tasks = store.graph.nodesOfKind("task").filter((task) => !(task as { archivedAt?: string }).archivedAt);

  it("goes onto fixed pages, each saying which of how many it is, and none of it is cut", () => {
    const first = renderScreen(store, todoApp, "/tasks", { profile: "eink", viewport: PW3, viewer: keeper });
    expect(first.page.index).toBe(0);
    expect(first.page.count).toBeGreaterThan(1);
    expect(first.html).toContain(`Page 1 of ${first.page.count}`);
    const opened = new Set<string>();
    for (let page = 0; page < first.page.count; page++) {
      const screen = renderScreen(store, todoApp, "/tasks", { profile: "eink", viewport: PW3, viewer: keeper, page });
      expect(screen.page).toEqual({ index: page, count: first.page.count });
      expect(screen.html).toContain(`Page ${page + 1} of ${first.page.count}`);
      for (const tap of screen.taps) if ("open" in tap.does) opened.add(tap.does.open);
      // Back on every page but the first, on on every page but the last, each a press of its own.
      const turns = screen.taps.filter((tap) => "page" in tap.does).map((tap) => (tap.does as { page: number }).page);
      expect(turns).toEqual([...(page > 0 ? [page - 1] : []), ...(page < first.page.count - 1 ? [page + 1] : [])]);
    }
    // Every task is on one of the pages.
    for (const task of tasks) expect(opened.has(task.id), task.id).toBe(true);
  });

  it("answers a page past the last with the last, and says so", () => {
    const last = renderScreen(store, todoApp, "/tasks", { profile: "eink", viewport: PW3, viewer: keeper, page: 99 });
    expect(last.page.index).toBe(last.page.count - 1);
  });

  it("fits more on a taller screen, and on one page when it all fits", () => {
    const tall = renderScreen(store, todoApp, "/tasks", { profile: "eink", viewport: { width: 758, height: 2400 }, viewer: keeper });
    expect(tall.page).toEqual({ index: 0, count: 1 });
    expect(tall.taps.some((tap) => "page" in tap.does)).toBe(false);
  });

  it("refuses a screen too small to lay out, and a profile it does not have, in words", () => {
    expect(() => renderScreen(store, todoApp, "home", { profile: "eink", viewport: { width: 200, height: 300 } })).toThrow(/too small for the e-ink profile/);
    expect(() => renderScreen(store, todoApp, "home", { profile: "lcd" as never, viewport: PW3 })).toThrow(/not a device profile/);
  });

  it("says nothing lives at an address nobody has, with the strip still there to go home", () => {
    const nowhere = renderScreen(store, todoApp, "/tasks/nobody", { profile: "eink", viewport: PW3, viewer: keeper });
    expect(nowhere.found).toBe(false);
    expect(nowhere.html).toContain("Nothing lives at this address.");
    expect(nowhere.taps.some((tap) => "go" in tap.does && tap.does.go === "/")).toBe(true);
  });
});

describe("the entry", () => {
  it("imports no React, router or DOM face, and draws in a bare context with no window, document, process or require — as a Worker runs it", async () => {
    const { build } = await import("esbuild");
    // @ts-expect-error — a plain .mjs module, without types.
    const { graviewSources } = await import("../../../../scripts/lib/graview-sources.mjs");
    const repo = fileURLToPath(new URL("../../../../", import.meta.url));
    const entry = `
      import { createSchema, defineApp, defineNode, Store, z } from "@graview/core";
      import { renderScreen } from "@graview/pages/device";
      const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
      const schema = createSchema([item]);
      const app = defineApp({ name: "shelf", schema });
      const store = new Store({ schema, snapshot: { nodes: [{ id: "a", kind: "item", label: "Lamp" }], edges: [] } });
      const at = { profile: "eink", viewport: { width: 758, height: 1024 } };
      globalThis.drawn = ["home", "/items", "/items/a"].map((place) => renderScreen(store, app, place, at));
    `;
    const bundled = await build({ stdin: { contents: entry, resolveDir: repo, loader: "ts" }, bundle: true, write: false, format: "iife", platform: "neutral", mainFields: ["module", "main"], plugins: [graviewSources(repo)], metafile: true, logLevel: "silent" });
    const inputs = Object.keys(bundled.metafile.inputs);
    expect(inputs.filter((path) => /node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(path))).toEqual([]);
    expect(inputs.filter((path) => /packages\/(react|primitives|layout|render)\//.test(path))).toEqual([]);
    // What a Worker has: no window, document, process or require.
    const context = createContext({ URL, TextEncoder, TextDecoder, console, btoa, atob });
    runInContext(bundled.outputFiles[0]!.text, context);
    const drawn = (context as { drawn: { found: boolean; taps: { does: object }[]; html: string }[] }).drawn;
    expect(drawn.map((one) => one.found)).toEqual([true, true, true]);
    expect(drawn[1]!.taps.some((tap) => "open" in tap.does)).toBe(true);
    expect(drawn[2]!.html).toContain("Lamp");
  }, 60_000);

  it("imports nothing of React, the router, the DOM faces or the seat, by its own source", () => {
    const source = readFileSync(new URL("../../src/device.ts", import.meta.url), "utf8");
    const imported = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imported.sort()).toEqual(["./static-read.js", "@graview/core", "@graview/core/describe", "@graview/core/devices", "@graview/core/jobs", "@graview/core/words", "@graview/tools/derive"]);
  });
});
