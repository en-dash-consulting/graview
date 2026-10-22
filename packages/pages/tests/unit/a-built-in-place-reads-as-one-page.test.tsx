// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { declaredViews, fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * A BUILT-IN PLACE READS AS ONE PAGE (Roadmap f-auto-view-type-polish).
 *
 * Threat Watch, as Graview Cloud's author built it (`threat-watch.gdd.json`):
 * a blocks lens grouped by a choice and drawn as rows, one that opens with a
 * headline, a kind with rows of its own, and one with none. Its By type page
 * stacked two headings, inset its rows past the title's edge, ruled its
 * group labels with a one-sided accent, and said every fact of a row as one
 * dot-joined string. Now the page says one heading and one line under it,
 * a group's heading is its label and its count, a row's choices are chips,
 * and an arrow after a link stands apart from its underlined words.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const compiled = compileDocument(JSON.parse(readFileSync(resolve(fixtures, "threat-watch.gdd.json"), "utf8")), { today: () => "2026-10-21" });
if (!compiled.ok) throw new Error(`Threat Watch did not compile: ${JSON.stringify(compiled.findings)}`);
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(resolve(fixtures, "threat-watch.seed.json"), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

async function rendered(path: string): Promise<{ host: HTMLElement; done: () => Promise<void> }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
  await act(async () => root.render(<PagesApp context={{ store, views: declaredViews(app), principal: owner, ...(app.brand ? { brand: app.brand } : {}) }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 30)));
  return {
    host,
    done: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

describe("a built-in place reads as one page", () => {
  it("says a lens's opening headline once, as the line under the page's title", async () => {
    const { host, done } = await rendered("/places/active-now");
    const lede = host.querySelector('[data-testid="place-lede"]');
    expect(lede?.textContent).toBe("Right now, four threats are active.");
    expect(lede?.getAttribute("data-graview-lede")).toBe("headline");
    // The lens leaves it out: no second heading under the title, and its count is not said again.
    const lens = host.querySelector('[data-testid="place-lens"]')!;
    expect(lens.textContent).not.toContain("Right now");
    expect(lens.querySelector(".graview-spec-place > .graview-spec-headline")).toBeNull();
    expect(host.textContent).not.toContain("14 threats.");
    await done();
  });

  it("keeps the count under the title where the lens opens with no headline", async () => {
    const { host, done } = await rendered("/places/by-type");
    expect(host.querySelector('[data-testid="place-lede"]')?.textContent).toBe("14 threats.");
    expect(host.querySelector('[data-testid="place-lede"]')?.hasAttribute("data-graview-lede")).toBe(false);
    await done();
  });

  it("draws the lens in the page's own column, with no inset of its own", async () => {
    const { host, done } = await rendered("/places/by-type");
    const place = host.querySelector('[data-testid="place-lens"] .graview-spec-place')!;
    expect(place.parentElement?.getAttribute("data-testid")).toBe("place-lens");
    await done();
  });

  it("heads each group with its label and how many it holds, on no rule of its own", async () => {
    const { host, done } = await rendered("/places/by-type");
    const heads = [...host.querySelectorAll(".graview-spec-list-heading")];
    expect(heads.map((head) => head.textContent)).toEqual(["Supply-chain compromises 6", "Self-spreading worms 3", "Ransomware 2", "Zero-days 3"]);
    expect(heads[0]!.querySelector(".graview-spec-list-count")?.textContent).toBe("6");
    await done();
  });

  it("draws a row's choices as chips and its date as quiet words after them, in the order written", async () => {
    const { host, done } = await rendered("/places/by-type");
    const meta = host.querySelector('[data-graview-listed="t-nx"] .graview-spec-meta')!;
    expect([...meta.querySelectorAll(".graview-spec-chip")].map((chip) => [chip.getAttribute("data-graview-field"), chip.textContent])).toEqual([
      ["severity", "High"],
      ["status", "Contained"],
      ["type", "Supply chain"],
    ]);
    expect(meta.querySelector(".graview-spec-meta-words")?.textContent).toBe("disclosed May 18, 2026");
    // Heard and copied as its facts a space apart: no dot read as a word of its own.
    expect(meta.textContent).toBe("High Contained Supply chain disclosed May 18, 2026");
    await done();
  });

  it("draws a kind's own glance with its choices as chips on its list", async () => {
    const { host, done } = await rendered("/sources");
    const row = host.querySelector('[data-graview-record="s-cisa"] .graview-row-glance')!;
    expect([...row.querySelectorAll(".graview-chip")].map((chip) => chip.textContent)).toEqual(["Advisory"]);
    expect(row.textContent).toBe("CISA Advisory Oct 14, 2026");
    await done();
  });

  it("underlines a link's words and not the arrow after them", async () => {
    const { host, done } = await rendered("/places/by-type");
    const link = host.querySelector<HTMLAnchorElement>('[data-testid="place-as-list"]')!;
    expect(link.style.textDecoration).toBe("none");
    const [words, arrow] = [...link.children] as HTMLElement[];
    expect(words!.textContent).toBe("All threats as a list");
    expect(words!.style.textDecorationLine).toBe("underline");
    expect(arrow!.textContent).toBe("→");
    expect(arrow!.getAttribute("aria-hidden")).toBe("true");
    await done();
  });
});
