// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { FileValue, HostFiles } from "@graview/core";
import { HostFilesContext } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Files } from "../../src/index.js";

/**
 * A RECORD'S PICTURE LOADS WHERE THE HOST SERVES IT (0.1.36). A record
 * keeps `/graview/files/…`; Graview Cloud serves it only under the app's
 * base (`/a/<app>/graview/files/…`). The host says where (`HostFiles.src`),
 * and every place the scene draws, links or downloads a record's file asks
 * there — a thumbnail, a gallery, a picture full size, a PDF inline, a
 * download — while what the page says of the file (`data-graview-*`) and
 * what it asks the host it still keeps (`kept`) name the file as the
 * record keeps it.
 */
const porch: FileValue = { href: "/graview/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000, caption: "The porch after the storm" };
const quote: FileValue = { href: "/graview/files/a0c2.pdf", name: "quote.pdf", type: "application/pdf", bytes: 40_210 };
const notes: FileValue = { href: "/graview/files/b1.txt", name: "notes.txt", type: "text/plain", bytes: 820 };
const asked: string[] = [];
const cloud: HostFiles = {
  maxBytes: 1_000_000,
  kinds: ["image/*"],
  upload: async () => porch,
  src: (href) => `/a/jobs${href}`,
  kept: (href) => (asked.push(href), true),
};

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  asked.length = 0;
});
async function draw(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<HostFilesContext.Provider value={cloud}>{node}</HostFilesContext.Provider>));
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}
async function arrives<T>(find: () => T | null | undefined): Promise<T> {
  for (let tries = 0; tries < 200; tries++) {
    const found = find();
    if (found) return found;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("it never arrived");
}

describe("a record's file under the host's base", () => {
  it("is a thumbnail drawn at the host's address, said by the href the record keeps", async () => {
    const host = await draw(<Files as="thumb" file={porch} />);
    const img = await arrives(() => host.querySelector("img"));
    expect(img.getAttribute("src")).toBe("/a/jobs/graview/files/3f9a.jpg");
    expect(img.getAttribute("data-graview-thumb")).toBe(porch.href);
    expect(asked).toContain(porch.href);
    expect(asked.some((href) => href.startsWith("/a/"))).toBe(false);
  });

  it("is a gallery picture and its full size at the host's address", async () => {
    const host = await draw(<Files as="field" read nodeId="roof" field="photos" label="Photos" files={[porch]} />);
    const gallery = await arrives(() => host.querySelector("[data-graview-gallery]"));
    expect(gallery.querySelector("img")?.getAttribute("src")).toBe("/a/jobs/graview/files/3f9a.jpg");
    await act(async () => gallery.querySelector("button")!.click());
    const full = host.querySelector("[data-graview-full]");
    expect(full?.getAttribute("data-graview-full")).toBe(porch.href);
    expect(full?.querySelector("img")?.getAttribute("src")).toBe("/a/jobs/graview/files/3f9a.jpg");
  });

  it("is a PDF inline and a download at the host's address", async () => {
    const host = await draw(<Files as="field" read nodeId="roof" field="papers" label="Papers" files={[quote, notes]} />);
    const pdf = await arrives(() => host.querySelector<HTMLObjectElement>('object[type="application/pdf"]'));
    expect(pdf.getAttribute("data")).toBe("/a/jobs/graview/files/a0c2.pdf");
    const links = [...host.querySelectorAll<HTMLAnchorElement>("a[download]")].map((a) => a.getAttribute("href"));
    // The PDF has one Download (its Open is a link in a tab, not a download), the text file its name (FR-234).
    expect(links).toEqual(["/a/jobs/graview/files/a0c2.pdf", "/a/jobs/graview/files/b1.txt"]);
  });
});
