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
 * A HOST THAT ANSWERS LATER (Roadmap f-files-kept-async). A host whose
 * bytes are elsewhere (Graview Cloud's are in R2) cannot say at once
 * whether it still keeps a file, so `kept` may answer a promise: the
 * picture is drawn as itself until the answer comes, then as "removed
 * later" if the host let it go — asked once per file, however often the
 * picture is drawn again, and a refusal to answer is taken as kept.
 */
const porch: FileValue = { href: "/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000, caption: "The porch after the storm" };
const gutter: FileValue = { href: "/files/77b1.jpg", name: "gutter.jpg", type: "image/jpeg", bytes: 91_000 };

function later(answers: Record<string, boolean | Error>) {
  const asked: string[] = [];
  const waiting: (() => void)[] = [];
  const files: HostFiles = {
    maxBytes: 1,
    kinds: ["image/*"],
    upload: async () => porch,
    kept: (href) => {
      asked.push(href);
      return new Promise<boolean>((resolve, reject) => {
        const answer = answers[href];
        waiting.push(() => (answer instanceof Error ? reject(answer) : resolve(answer !== false)));
      });
    },
  };
  return { files, asked, answer: () => act(async () => waiting.splice(0).forEach((go) => go())) };
}

async function drawn(files: HostFiles, element: ReturnType<typeof drawFiles>) {
  const place = document.createElement("div");
  document.body.appendChild(place);
  const root = createRoot(place);
  const draw = (next: ReturnType<typeof drawFiles>) => act(async () => root.render(<HostFilesContext.Provider value={files}>{next}</HostFilesContext.Provider>));
  await draw(element);
  return { place, again: draw, done: () => act(async () => root.unmount()) };
}

describe("a file the host answers for later", () => {
  it("is drawn as itself until the host answers, then as removed later", async () => {
    const host = later({ [porch.href]: false });
    const page = await drawn(host.files, drawFiles({ as: "thumb", file: porch }));
    expect(page.place.querySelector("img")?.getAttribute("src")).toBe(porch.href);
    expect(page.place.querySelector("[data-graview-removed-later]")).toBeNull();
    await host.answer();
    expect(page.place.querySelector("img")).toBeNull();
    expect(page.place.querySelector("[data-graview-removed-later]")?.getAttribute("aria-label")).toBe("The porch after the storm, removed later");
    await page.done();
  });

  it("stays drawn as itself in a gallery when the host says it is kept, and a refusal to answer is taken as kept", async () => {
    const host = later({ [porch.href]: true, [gutter.href]: new Error("R2 is away") });
    const page = await drawn(host.files, drawFiles({ as: "block", field: "photos", files: [porch, gutter], label: "Photos", view: "gallery" }));
    await host.answer();
    expect(page.place.querySelectorAll("[data-graview-removed-later]")).toHaveLength(0);
    expect([...page.place.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([porch.href, gutter.href]);
    await page.done();
  });

  it("is asked once per file, so a picture drawn again is drawn as the host answered, without asking again", async () => {
    const host = later({ [porch.href]: false });
    const first = await drawn(host.files, drawFiles({ as: "thumb", file: porch }));
    await first.again(drawFiles({ as: "thumb", file: porch, size: 40 }));
    await host.answer();
    await first.done();
    const second = await drawn(host.files, drawFiles({ as: "block", field: "photos", files: [porch], label: "Photos", view: "gallery" }));
    expect(second.place.querySelector("img")).toBeNull();
    expect(second.place.querySelector("[data-graview-removed-later]")).not.toBeNull();
    expect(host.asked).toEqual([porch.href]);
    await second.done();
  });
});
