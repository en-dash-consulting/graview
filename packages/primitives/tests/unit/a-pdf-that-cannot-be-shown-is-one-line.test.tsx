// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { type FileValue } from "@graview/core";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Files } from "../../src/index.js";

/**
 * A PDF THAT CANNOT BE SHOWN IS ONE LINE (FR-234, Roadmap
 * f-pdf-fallback-one-line).
 *
 * A record's PDF was an `<object>` 420 px tall with a border, its fallback
 * sentence inside it: where a browser draws no PDF inline — an iPhone, or a
 * host whose page says `object-src 'none'` — the reader got a tall empty
 * box with one sentence. Now the file's line stands outside the box and
 * says it all, "week44.pdf · PDF · 1.2 MB — Open / Download", and the box
 * takes its height only once the browser has loaded the PDF into it. jsdom
 * loads nothing, so here the box stays as a browser that draws no PDF would
 * leave it, and a `load` event dispatched by hand is the browser that does.
 */
const quote: FileValue = { href: "/files/a0c2.pdf", name: "week44.pdf", type: "application/pdf", bytes: 1_200_000 };

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function draw(node: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

/** The files' part is fetched the first time one is drawn: wait for what it draws. */
async function arrives<T>(find: () => T | null | undefined): Promise<T> {
  for (let tries = 0; tries < 200; tries++) {
    const found = find();
    if (found) return found;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error("it never arrived");
}

const words = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim();

describe("a record's PDF (FR-234)", () => {
  it("is one line outside the box — its name, its type, its size, Open and Download — and the box has no height until the browser has loaded the PDF into it", async () => {
    const host = await draw(<Files as="field" read nodeId="roof" field="papers" label="Papers" files={[quote]} />);
    const object = await arrives(() => host.querySelector<HTMLObjectElement>('object[type="application/pdf"]'));
    const row = host.querySelector('[data-graview-document="application/pdf"]')!;
    // The line says it all, outside the object.
    const line = row.querySelector("[data-graview-file-line]")!;
    expect(line.closest("object")).toBeNull();
    expect(words(line)).toBe("week44.pdf · PDF · 1.2 MB — Open / Download");
    const open = line.querySelector<HTMLAnchorElement>("a[target=_blank]")!;
    const download = line.querySelector<HTMLAnchorElement>("a[download]")!;
    expect([open.textContent, open.getAttribute("href"), open.getAttribute("rel")]).toEqual(["Open", "/files/a0c2.pdf", "noopener"]);
    expect([download.textContent, download.getAttribute("href"), download.getAttribute("download")]).toEqual(["Download", "/files/a0c2.pdf", "week44.pdf"]);
    // Nothing of the fallback is inside the box, and the box is not sized while nothing is in it.
    expect(words(object)).toBe("");
    expect(object.getAttribute("data-graview-pdf")).toBe("waiting");
    expect(object.style.height).toBe("0px");
    expect(object.style.border).toBe("");
    // The browser that draws a PDF loads it: the box takes its height.
    await act(async () => object.dispatchEvent(new Event("load")));
    expect(object.getAttribute("data-graview-pdf")).toBe("shown");
    expect(object.style.height).toBe("420px");
    expect(object.style.border).not.toBe("");
  });
});
