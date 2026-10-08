// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { declaredLenses, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { fetchDeclaredLenses } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, preload } from "../../src/index.js";

/**
 * A DECLARED LENS IS A PLACE ON THE GRAVIEW FACE (FR-79), AND THE APP OPENS
 * WHERE THE DECLARATION SAYS (FR-80).
 *
 * The embed is handed a compiled document and nothing else — no views, no
 * registration — and every lens the document titles is a picture among the
 * places the bar's place control opens (FR-138).
 */
const hall = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/every-lens.gdd.json"), "utf8"));
const compiled = compileDocument(hall, { today: () => "2026-09-01" });
if (!compiled.ok) throw new Error("every-lens did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = {
  nodes: [
    { id: "s1", kind: "shift", label: "Monday door", day: "mon", from: 540, until: 720, on: "2026-09-07" },
    { id: "v1", kind: "volunteer", label: "Ada" },
    { id: "seat-1", kind: "seat", label: "Front left", x: 0.2, y: 0.3 },
    { id: "r1", kind: "room", label: "The cellar" },
    { id: "m1", kind: "member", label: "Nora" },
  ],
  edges: [{ id: "e1", kind: "covered-by", from: "s1", to: "v1" }],
};

beforeAll(() => Promise.all([preload(), fetchDeclaredLenses()]));

describe("a document's declared lenses, in the embed's scene", () => {
  it("are the Pictures among the places by their titles, while the switch says the scene is drawn", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Embed app={app} seed={seed as never} face="scene" principal={{ kind: "human", id: "m1", roles: ["keeper"] }} fonts={false} />));
    await act(async () => new Promise((done) => setTimeout(done, 30)));
    // The switch says the scene is drawn (FR-137); the bar names what the scene shows, and lists its pictures — each declared lens among them (FR-144).
    expect(host.querySelector('[data-testid="app-face-scene"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="app-places-open"]')?.getAttribute("aria-label")).toMatch(/ — everything the scene shows$/);
    const shown = [...host.querySelectorAll('[data-testid="app-places"] [data-place-group="pictures"] [data-testid^="app-place-scene:"]')].map((entry) => entry.textContent?.trim());
    expect(shown.sort()).toEqual(declaredLenses(app).drawn.map((lens) => lens.title).sort());
    expect(host.querySelector('[data-testid="app-place-home"]')).toBeNull();
    // The host decides the face (`onFace`): it is told, and draws the pages.
    const asked: string[] = [];
    await act(async () => root.render(<Embed app={app} seed={seed as never} face="scene" onFace={(face) => asked.push(face)} principal={{ kind: "human", id: "m1", roles: ["keeper"] }} fonts={false} />));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="app-face-pages"]')!.click());
    expect(asked).toEqual(["pages"]);
    await act(async () => root.render(<Embed app={app} seed={seed as never} face="pages" principal={{ kind: "human", id: "m1", roles: ["keeper"] }} fonts={false} />));
    await act(async () => new Promise((done) => setTimeout(done, 30)));
    // Each is a picture among the places, by its title, after the home and the lists.
    const pictures = [...host.querySelectorAll('[data-testid="app-places"] [data-place-group="pictures"] [data-testid^="app-place-place:"]')];
    expect(pictures.map((entry) => entry.textContent?.trim())).toEqual(declaredLenses(app).drawn.map((lens) => lens.title));
    expect(host.querySelector('[data-testid="app-places"] [data-testid]')?.getAttribute("data-testid")).toBe("app-place-home");
    await act(async () => root.unmount());
    host.remove();
  });
});
