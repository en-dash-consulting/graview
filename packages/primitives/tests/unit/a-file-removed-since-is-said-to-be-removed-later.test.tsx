// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { FileValue, HostFiles } from "@graview/core";
import { HostFilesContext } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { drawFiles } from "../../src/files.js";

/**
 * A FILE REMOVED SINCE IS SAID TO BE REMOVED LATER (Roadmap f-playback).
 * The past holds every file a record ever held; the bytes are the host's,
 * and one it has let go of since is drawn as "removed later" — on a card's
 * thumbnail and in a record's gallery — never as a broken picture.
 */
const porch: FileValue = { href: "/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000, caption: "The porch after the storm" };
const gutter: FileValue = { href: "/files/77b1.jpg", name: "gutter.jpg", type: "image/jpeg", bytes: 91_000 };
const host = (kept: readonly string[]): HostFiles => ({ maxBytes: 1, kinds: ["image/*"], upload: async () => porch, kept: (href) => kept.includes(href) });

async function drawn(files: HostFiles, element: ReturnType<typeof drawFiles>) {
  const place = document.createElement("div");
  document.body.appendChild(place);
  const root = createRoot(place);
  await act(async () => root.render(<HostFilesContext.Provider value={files}>{element}</HostFilesContext.Provider>));
  return { place, done: () => act(async () => root.unmount()) };
}

describe("a file the host no longer keeps", () => {
  it("is said to be removed later on a thumbnail, and drawn as itself while it is kept", async () => {
    const gone = await drawn(host([]), drawFiles({ as: "thumb", file: porch }));
    expect(gone.place.querySelector("img")).toBeNull();
    expect(gone.place.querySelector("[data-graview-removed-later]")?.getAttribute("aria-label")).toBe("The porch after the storm, removed later");
    await gone.done();
    const kept = await drawn(host([porch.href]), drawFiles({ as: "thumb", file: porch }));
    expect(kept.place.querySelector("img")?.getAttribute("src")).toBe(porch.href);
    await kept.done();
  });

  it("is said to be removed later in a gallery, beside the pictures still kept, and opens nothing", async () => {
    const both = await drawn(host([gutter.href]), drawFiles({ as: "block", field: "photos", files: [porch, gutter], label: "Photos", view: "gallery" }));
    expect(both.place.querySelectorAll("[data-graview-removed-later]")).toHaveLength(1);
    expect([...both.place.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([gutter.href]);
    expect(both.place.querySelectorAll("button")).toHaveLength(1);
    await both.done();
  });
});
