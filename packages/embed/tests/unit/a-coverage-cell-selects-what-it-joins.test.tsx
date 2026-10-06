// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, preload } from "../../src/index.js";

/**
 * FR-111: A COVERAGE CELL OVER A PATH SELECTS WHAT IT JOINS, on both faces.
 * The Strengths lens crosses people with skills through a strength record;
 * choosing Ryan × SEO selected SEO alone, and its line went to the collapsed
 * strengths' district. Now the choice is Ryan, SEO and the strength between
 * them, and the lens draws its line from the cell to Ryan's row and to SEO's
 * column — on the Graview face and on the routed face's /places/strengths,
 * which keeps the person on the picture rather than leaving for SEO's page.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "org-strengths.gdd.json"), "utf8")), { today: () => "2026-10-06" });
if (!compiled.ok) throw new Error("org-strengths did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(resolve(fixtures, "org-strengths.seed.json"), "utf8"));
const owner = { kind: "human", id: "u:owner", roles: ["owner"] } as const;

beforeAll(() => Promise.all([preload(), fetchDeclaredLenses()]));

async function choose(face: "scene" | "pages") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<Embed app={app} seed={seed} face={face} principal={owner} fonts={false} label="The org" {...(face === "pages" ? { path: "/places/strengths" } : {})} />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  const cell = host.querySelector<HTMLElement>("[data-graview-joins]");
  await act(async () => {
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((done) => setTimeout(done, 30));
  });
  const emphasis = (id: string) => host.querySelector(`[data-graview-pick="${id}"]:not([data-graview-mark])`)?.getAttribute("data-graview-emphasis") ?? null;
  const seen = {
    cell: cell !== null,
    lines: [...host.querySelectorAll("[data-coverage-join-to]")].map((line) => line.getAttribute("data-coverage-join-to")).sort(),
    proxies: host.querySelectorAll("[data-graview-tie-proxy]").length,
    ryan: emphasis("p-ryan"),
    val: emphasis("p-val"),
    seo: emphasis("sk-seo"),
    heading: host.querySelector("h1")?.textContent?.trim() ?? null,
    // The seat names the selection: the strength, and the two it joins.
    inspector: host.textContent?.includes("Ryan SEO and 2 more") ?? false,
  };
  await act(async () => root.unmount());
  host.remove();
  return seen;
}

describe("choosing Ryan × SEO on the Strengths lens", () => {
  it("on the Graview face selects Ryan, SEO and the strength between them, and draws to Ryan and SEO — never to a district", async () => {
    const seen = await choose("scene");
    expect(seen.cell).toBe(true);
    expect(seen.lines).toEqual(["p-ryan", "sk-seo"]);
    expect(seen.proxies).toBe(0);
    expect([seen.ryan, seen.seo, seen.val]).toEqual(["lit", "lit", "dimmed"]);
    expect(seen.inspector).toBe(true);
  });

  it("on the routed face stays on the picture, lights Ryan and SEO, and draws to them", async () => {
    const seen = await choose("pages");
    expect(seen.cell).toBe(true);
    expect(seen.heading).toBe("Strengths");
    expect(seen.lines).toEqual(["p-ryan", "sk-seo"]);
    expect([seen.ryan, seen.seo, seen.val]).toEqual(["lit", "lit", "dimmed"]);
  });
});
