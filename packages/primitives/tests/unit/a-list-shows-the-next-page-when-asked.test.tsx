// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileBlocks } from "@graview/core/blocks";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { declaredViews } from "../../src/index.js";
import { SpecPlace } from "../../src/spec-views.js";

/**
 * A LIST SHOWS THE NEXT PAGE WHEN ASKED (2026-10-15, The Beatles).
 *
 * A home listing 158 songs drew 100 and said "and 58 more", with no way to
 * them. It draws 100 and a "Show 58 more" button, which draws the rest —
 * under their headings where the list is grouped by a linked record.
 */
// Under jsdom a module's own URL is not a file's: the fixtures are read from the checkout, where the tests run.
const fixtures = join(process.cwd(), "packages/core/tests/document/fixtures");
const base = JSON.parse(readFileSync(join(fixtures, "beatles.gdd.json"), "utf8"));
const seed = JSON.parse(readFileSync(join(fixtures, "beatles.seed.json"), "utf8"));

async function drawn(blocks: unknown[]) {
  const compiled = compileDocument({ ...structuredClone(base), views: { home: blocks } }, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed as never });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={{ kind: "human", id: "u", roles: ["owner"] }}>
        <SpecPlace blocks={compileBlocks(blocks)} slot="home" />
      </GraviewProvider>,
    );
  });
  return host;
}

const listed = (host: HTMLElement) => host.querySelectorAll("[data-graview-listed]").length;

describe("a list past a page", () => {
  it("draws 100 of 158 songs and a button that shows the other 58", async () => {
    const host = await drawn([{ list: "all('song')", sort: "name", as: "row" }]);
    expect(listed(host)).toBe(100);
    const button = host.querySelector<HTMLButtonElement>("[data-graview-show-more]")!;
    expect(button.textContent).toBe("Show 58 more");
    await act(async () => button.click());
    expect(listed(host)).toBe(158);
    expect(host.querySelector("[data-graview-show-more]")).toBeNull();
    expect(host.textContent).not.toContain("and 58 more");
  });

  it("shows the rest under the headings of the records they are linked to", async () => {
    const host = await drawn([{ list: "all('song')", sort: "name", as: "row", group: "writtenBy" }]);
    await act(async () => host.querySelector<HTMLButtonElement>("[data-graview-show-more]")!.click());
    // Each heading says how many its group holds: every one listed, not only the first page.
    expect([...host.querySelectorAll(".graview-spec-list-heading")].map((heading) => heading.firstChild?.textContent?.trim())).toEqual(["Harrison", "Lennon", "McCartney", "Starkey"]);
    expect([...host.querySelectorAll(".graview-spec-list-count")].reduce((sum, count) => sum + Number(count.textContent), 0)).toBe(158);
    expect(listed(host)).toBe(158);
  });
});
