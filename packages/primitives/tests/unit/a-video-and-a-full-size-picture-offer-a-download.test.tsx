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
 * A VIDEO AND A FULL-SIZE PICTURE OFFER A DOWNLOAD (Roadmap
 * f-download-control-video-picture). A document's line had Open and
 * Download; a video's figure had nothing, and a picture opened full size
 * had only Close — so a render could not be saved from a phone. Each now
 * carries a Download link to its file under the host's base, asking the
 * host for the file as an attachment (`?download=1`), named for the file,
 * and big enough to press with a thumb.
 */
const render: FileValue = { href: "/graview/files/c4.mp4", name: "render.mp4", type: "video/mp4", bytes: 9_400_000, width: 1280, height: 720 };
const porch: FileValue = { href: "/graview/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000 };
const asked: string[] = [];
const cloud: HostFiles = { maxBytes: 1_000_000, kinds: ["image/*", "video/*"], upload: async () => porch, src: (href) => `/a/studio${href}`, kept: (href) => (asked.push(href), true) };

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});
async function draw(node: ReactNode, files: HostFiles = cloud): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<HostFilesContext.Provider value={files}>{node}</HostFilesContext.Provider>));
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

/** At least 44 px square on a phone: a thumb's press. */
const pressable = (link: HTMLElement) => {
  expect(parseFloat(link.style.minHeight)).toBeGreaterThanOrEqual(44);
  expect(parseFloat(link.style.minWidth)).toBeGreaterThanOrEqual(44);
};

describe("a video field's figure", () => {
  it("shows a Download link to its file under the host's base, asked as an attachment", async () => {
    const host = await draw(<Files as="field" read nodeId="cut" field="video" label="Video" files={[render]} />);
    const caption = await arrives(() => host.querySelector("[data-graview-video-figure] figcaption"));
    const link = caption.querySelector<HTMLAnchorElement>("a[data-graview-download]");
    expect(link?.getAttribute("href")).toBe("/a/studio/graview/files/c4.mp4?download=1");
    expect(link?.getAttribute("aria-label")).toBe("Download render.mp4");
    expect(link?.textContent).toBe("Download");
    pressable(link!);
  });

  it("joins the ask to an address that already asks something", async () => {
    const host = await draw(<Files as="field" read nodeId="cut" field="video" label="Video" files={[render]} />, { ...cloud, src: (href) => `/files?at=${encodeURIComponent(href)}` });
    const link = await arrives(() => host.querySelector<HTMLAnchorElement>("a[data-graview-download]"));
    expect(link.getAttribute("href")).toBe(`/files?at=${encodeURIComponent(render.href)}&download=1`);
  });
});

describe("a download of an address with a fragment", () => {
  it("asks before the fragment, never inside it", async () => {
    const host = await draw(<Files as="field" read nodeId="cut" field="video" label="Video" files={[render]} />, { ...cloud, src: (href) => `/a/studio${href}#t=1` });
    const link = await arrives(() => host.querySelector<HTMLAnchorElement>("a[data-graview-download]"));
    expect(link.getAttribute("href")).toBe("/a/studio/graview/files/c4.mp4?download=1#t=1");
  });
});

describe("the full-size picture dialog", () => {
  it("shows a Download link beside Close, named for the file", async () => {
    const host = await draw(<Files as="field" read nodeId="roof" field="photos" label="Photos" files={[porch]} />);
    const gallery = await arrives(() => host.querySelector("[data-graview-gallery]"));
    await act(async () => gallery.querySelector("button")!.click());
    const full = host.querySelector("[data-graview-full]")!;
    const link = full.querySelector<HTMLAnchorElement>("a[data-graview-download]");
    expect(link?.getAttribute("href")).toBe("/a/studio/graview/files/3f9a.jpg?download=1");
    expect(link?.getAttribute("aria-label")).toBe("Download porch.jpg");
    const close = [...full.querySelectorAll("button")].find((button) => button.textContent === "Close")!;
    expect(link!.closest("figcaption")).toBe(close.closest("figcaption"));
    pressable(link!);
    pressable(close);
  });
});
