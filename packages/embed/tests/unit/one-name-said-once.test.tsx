// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { createPageRegistry, PageMain, type PageComponent } from "@graview/pages";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed, preload } from "../../src/index.js";

// Every face fetched before the first render, so each draws in the commit that renders it (FR-57).
beforeAll(() => preload());

/**
 * ONE NAME, SAID ONCE. The embed prefixes every landmark inside it with its
 * own label; a picture whose panel was named the same as the embed — "The
 * pipeline" in an embed labeled "The pipeline" — became "The pipeline ·
 * The pipeline".
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const schema = createSchema([car]);
const app = defineApp({ name: "Lot", schema, mutations: [] });

describe("an embed's landmarks", () => {
  it("does not say a landmark's name twice when it is the embed's own", async () => {
    const Named: PageComponent<typeof schema> = ({ context }) => (
      <PageMain context={context}>
        <nav aria-label="Lot">the lot</nav>
      </PageMain>
    );
    const named = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("home", Named);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Embed app={app} face="pages" pages={named} label="Lot" fonts={false} />));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    const labels = [...host.querySelectorAll("nav")].map((nav) => nav.getAttribute("aria-label"));
    expect(labels).toContain("Lot");
    expect(labels).not.toContain("Lot · Lot");
    await act(async () => root.unmount());
    host.remove();
  });

  it("does not leave a second region of the embed's own name", async () => {
    // The pipeline lens's scroll panel is a region named by its title; in an
    // embed labeled the same, it is the embed's region, not another one.
    const Scroller: PageComponent<typeof schema> = ({ context }) => (
      <PageMain context={context}>
        <div role="region" tabIndex={0} aria-label="Lot">the lot</div>
      </PageMain>
    );
    const scrolled = createPageRegistry<typeof schema, PageComponent<typeof schema>>(schema).surface("home", Scroller);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<Embed app={app} face="pages" pages={scrolled} label="Lot" fonts={false} />));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    const regions = [...host.querySelectorAll("section[aria-label], [role=region]")].filter((el) => el.getAttribute("aria-label") === "Lot");
    expect(regions).toHaveLength(1);
    expect(host.querySelector('[role=group][aria-label="Lot"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
