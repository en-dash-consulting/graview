// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FILES, jobsApp, jobsSeed, sam } from "../../../../scripts/fixtures/jobs-app.js";
import { filesAt } from "../../../ship/src/files-at.js";
import { PagesApp, recordPath, type PageContext } from "../../src/index.js";

/**
 * A RECORD'S PICTURE LOADS UNDER THE HOST'S BASE, ON PAGES (0.1.36). Graview
 * Cloud serves an app at `/a/<app>/` and its files only at
 * `/a/<app>/graview/files/…`, and hands the page
 * `files: filesAt(base + "/graview/files", …)`; a record keeps
 * `/graview/files/…` without the base. On 0.1.35 the record's page drew
 * `<img src="/graview/files/…">`, which the workspace's root answers with
 * its own page: every picture broken. Handed the same `filesAt` and nothing
 * else, the page now draws each picture, and links each paper, where the
 * host serves it.
 */
describe("a record's page under the host's base", () => {
  it("draws its pictures and links its papers at the host's address, from filesAt alone", async () => {
    const store = new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
    const context: PageContext<AnySchema> = {
      store,
      principal: sam,
      views: registerDefaultViews(store.schema, createViews(store.schema)),
      files: filesAt("/a/jobs/graview/files", { maxBytes: 1_000_000, kinds: ["image/*", "application/pdf"] }),
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={context} initialPath={recordPath(store.schema, "job", "job:porch")} />));
    let pictures: string[] = [];
    for (let tries = 0; tries < 200 && pictures.length === 0; tries++) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
      pictures = [...host.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "").filter((src) => src.includes("graview/files/"));
    }
    expect(pictures).toContain(`/a/jobs${FILES.porch}`);
    expect(pictures).toContain(`/a/jobs${FILES.step}`);
    expect(pictures.filter((src) => src.startsWith("/graview/"))).toEqual([]);
    const papers = [...host.querySelectorAll<HTMLAnchorElement>("a[download]")].map((a) => a.getAttribute("href"));
    expect(papers).toContain(`/a/jobs${FILES.quote}`);
    expect(papers.filter((href) => href?.startsWith("/graview/"))).toEqual([]);
    await act(async () => root.unmount());
    host.remove();
  });
});
