// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, fileField, imageField, Store, type FileValue, type HostFiles } from "@graview/core";
import { GraviewProvider, HostFilesContext, createViews } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Fields, Files } from "../../src/index.js";
import { kindsWords, prepare, sizeWords, takes, typeWords } from "../../src/files.js";

/**
 * FR-162, FR-163. A RECORD SHOWS ITS PICTURES AND DOCUMENTS, AND TAKES NEW
 * ONES THROUGH THE HOST'S FILES.
 *
 * Drawn: a picture as a gallery that opens each full size, said by its
 * caption or its name; a PDF inline; anything else a download. Put there:
 * the editor sends each file to the host's `upload`, the answer becomes the
 * ordinary act that sets the field — recorded, and undone like any — and a
 * refusal, the host's or the editor's own, is said in words. Without the
 * host's files the editor says so and offers nothing.
 */
const porch: FileValue = { href: "/files/3f9a.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 182_000, caption: "The porch after the storm" };
const gutter: FileValue = { href: "/files/77b1.jpg", name: "gutter.jpg", type: "image/jpeg", bytes: 91_000 };
const quote: FileValue = { href: "/files/a0c2.pdf", name: "quote.pdf", type: "application/pdf", bytes: 40_210 };
const notes: FileValue = { href: "/files/b1.txt", name: "notes.txt", type: "text/plain", bytes: 820 };

const job = defineNode("job", { fields: z.object({ name: z.string(), photos: z.array(imageField()).max(20).optional(), papers: z.array(fileField()).optional() }), plural: "Jobs" });
const schema = createSchema([job]);
const storeWith = (fields: Record<string, unknown> = {}) => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "roof", kind: "job", name: "Fix the roof", ...fields }] as never, edges: [] } });

/** A host that keeps what it is sent, and says what it was sent. */
function fakeHost(options: Partial<HostFiles> & { readonly refuse?: string } = {}): HostFiles & { readonly sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    maxBytes: options.maxBytes ?? 1_000_000,
    kinds: options.kinds ?? ["image/*", "application/pdf"],
    async upload(file: Blob, name: string) {
      sent.push(name);
      if (options.refuse) throw new Error(options.refuse);
      return { href: `/files/${sent.length}-${name}`, name, type: file.type, bytes: file.size };
    },
  };
}

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

const pick = async (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
};

describe("a record's files, drawn", () => {
  it("pictures in a gallery, each said by its caption or its name, opening full size", async () => {
    const host = await draw(<Files as="field" read nodeId="roof" field="photos" label="Photos" files={[porch, gutter]} />);
    const gallery = await arrives(() => host.querySelector("[data-graview-gallery]"));
    expect([...gallery.querySelectorAll("img")].map((img) => img.getAttribute("alt"))).toEqual(["The porch after the storm", "gutter.jpg"]);
    const open = gallery.querySelector<HTMLButtonElement>('button[aria-label="Open gutter.jpg full size"]');
    expect(open).not.toBeNull();
    await act(async () => open!.click());
    const full = host.querySelector("[data-graview-full]");
    expect(full?.querySelector("img")?.getAttribute("src")).toBe("/files/77b1.jpg");
    expect(full?.querySelector("img")?.getAttribute("alt")).toBe("gutter.jpg");
  });

  it("a PDF inline, anything else a download, each by its name, its type and its size", async () => {
    const host = await draw(<Files as="field" read nodeId="roof" field="papers" label="Papers" files={[quote, notes]} />);
    const pdf = await arrives(() => host.querySelector<HTMLObjectElement>('object[type="application/pdf"]'));
    expect(pdf.getAttribute("data")).toBe("/files/a0c2.pdf");
    const links = [...host.querySelectorAll<HTMLAnchorElement>("a[download]")].map((a) => [a.getAttribute("href"), a.getAttribute("download")]);
    expect(links).toContainEqual(["/files/b1.txt", "notes.txt"]);
    expect(host.textContent).toContain("TXT · 820 bytes");
    expect(host.textContent).toContain("PDF · 40 KB");
  });

  it("a thumbnail, said by its caption", async () => {
    const host = await draw(<Files as="thumb" file={porch} />);
    const img = await arrives(() => host.querySelector("img"));
    expect([img.getAttribute("src"), img.getAttribute("alt"), img.getAttribute("width")]).toEqual(["/files/3f9a.jpg", "The porch after the storm", "56"]);
  });

  it("says sizes, types and what a host takes in words", () => {
    expect([sizeWords(820), sizeWords(40_210), sizeWords(3_400_000)]).toEqual(["820 bytes", "40 KB", "3.4 MB"]);
    expect([typeWords(quote), typeWords({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", name: "brief.docx" }), typeWords({ type: "image/heic" })]).toEqual(["PDF", "DOCX", "HEIC"]);
    expect(kindsWords(["image/*", "application/pdf"])).toBe("pictures and PDF files");
    expect([takes(["image/*"], "image/png"), takes(["image/*"], "application/pdf"), takes([], "text/plain")]).toEqual([true, false, true]);
  });
});

describe("a record's file field, put there through the host's files", () => {
  it("sends what is picked, sets the field by its act, and undo takes it back", async () => {
    const store = storeWith();
    const files = fakeHost();
    const host = await draw(
      <GraviewProvider store={store} views={createViews(schema)} files={files}>
        <Fields id="roof" />
      </GraviewProvider>,
    );
    const input = await arrives(() => host.querySelector<HTMLInputElement>('[data-graview-files="photos"] input[data-graview-file-input]'));
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe("image/*");
    await pick(input, [new File(["a"], "porch.png", { type: "image/png" }), new File(["b"], "gutter.png", { type: "image/png" })]);
    await arrives(() => (store.graph.getNode("roof") as { photos?: unknown[] } | undefined)?.photos);
    expect(files.sent).toEqual(["porch.png", "gutter.png"]);
    expect((store.graph.getNode("roof") as { photos: FileValue[] }).photos.map((file) => file.name)).toEqual(["porch.png", "gutter.png"]);
    const last = store.log.all().at(-1)!;
    expect(last.intent).toContain("porch.png, gutter.png");
    await act(async () => void store.undo(last.batch!));
    expect((store.graph.getNode("roof") as { photos?: unknown }).photos).toBeUndefined();
  });

  it("takes a pasted picture", async () => {
    const store = storeWith();
    const host = await draw(
      <GraviewProvider store={store} views={createViews(schema)} files={fakeHost()}>
        <Fields id="roof" />
      </GraviewProvider>,
    );
    const editor = await arrives(() => host.querySelector<HTMLElement>('[data-graview-files="photos"] [data-graview-file-editor]'));
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [new File(["c"], "pasted.png", { type: "image/png" })] } });
    await act(async () => editor.querySelector("button")!.dispatchEvent(paste));
    await arrives(() => (store.graph.getNode("roof") as { photos?: unknown[] } | undefined)?.photos);
    expect((store.graph.getNode("roof") as { photos: FileValue[] }).photos.map((file) => file.name)).toEqual(["pasted.png"]);
  });

  it("says a host's refusal, the kinds it takes and the most it takes in its own words, and sets nothing", async () => {
    const store = storeWith();
    const host = await draw(
      <GraviewProvider store={store} views={createViews(schema)} files={fakeHost({ refuse: "the disk is full", kinds: ["image/*"], maxBytes: 10 })}>
        <Fields id="roof" />
      </GraviewProvider>,
    );
    const photos = await arrives(() => host.querySelector<HTMLInputElement>('[data-graview-files="photos"] input[data-graview-file-input]'));
    await pick(photos, [new File(["a"], "porch.png", { type: "image/png" })]);
    const said = await arrives(() => host.querySelector('[data-graview-files="photos"] [role="alert"]'));
    expect(said.textContent).toBe("“porch.png” wasn’t kept: the disk is full");
    await pick(photos, [new File(["x".repeat(40)], "big.png", { type: "image/png" })]);
    await arrives(() => (host.querySelector('[data-graview-files="photos"] [role="alert"]')?.textContent?.includes("big.png") ? true : null));
    expect(host.querySelector('[data-graview-files="photos"] [role="alert"]')?.textContent).toBe("“big.png” is 40 bytes; this host takes files up to 10 bytes.");
    const papers = host.querySelector<HTMLInputElement>('[data-graview-files="papers"] input[data-graview-file-input]')!;
    await pick(papers, [new File(["%PDF"], "quote.pdf", { type: "application/pdf" })]);
    await arrives(() => host.querySelector('[data-graview-files="papers"] [role="alert"]'));
    expect(host.querySelector('[data-graview-files="papers"] [role="alert"]')?.textContent).toBe("“quote.pdf” is a PDF file; this host takes pictures.");
    expect(store.graph.getNode("roof")).not.toHaveProperty("photos");
    expect(store.graph.getNode("roof")).not.toHaveProperty("papers");
  });

  it("without the host's files says this host takes none, and offers no way to add one", async () => {
    const store = storeWith({ papers: [quote] });
    const host = await draw(
      <GraviewProvider store={store} views={createViews(schema)}>
        <Fields id="roof" />
      </GraviewProvider>,
    );
    const none = await arrives(() => host.querySelector('[data-graview-files="papers"] [data-graview-file-none]'));
    expect(none.textContent).toBe("This host doesn’t take files, so none can be added here.");
    expect(host.querySelector("input[data-graview-file-input]")).toBeNull();
    expect(host.querySelector("[data-graview-file-choose]")).toBeNull();
    // What it holds is still drawn, and may still be taken off a list.
    expect(host.querySelector('object[type="application/pdf"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Remove quote.pdf"]')).not.toBeNull();
  });
});

describe("a file field's editor, as it is used", () => {
  /** The editor as a form draws it, its value held by the test, under a host's files. */
  async function editor(options: { readonly value: readonly FileValue[]; readonly several: boolean; readonly files: HostFiles }) {
    let value: unknown = options.value;
    const changes: unknown[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    // Drawn again with what it changed to, inside the act its press is already in.
    const drawWith = (next: unknown) => {
      value = next;
      root.render(
        <HostFilesContext.Provider value={options.files}>
          <Files
            as="control"
            value={value}
            several={options.several}
            image
            label="Photos"
            onChange={(changed) => {
              changes.push(changed);
              drawWith(changed);
            }}
          />
        </HostFilesContext.Provider>,
      );
    };
    const render = (next: unknown) => act(async () => drawWith(next));
    await render(value);
    cleanup = async () => {
      await act(async () => root.unmount());
      container.remove();
    };
    await arrives(() => container.querySelector("[data-graview-file-editor]"));
    return { container, changes, render, value: () => value };
  }

  it("adds to what the field holds when the upload answers, not to what it held when the file was sent", async () => {
    let answer: (value: FileValue) => void = () => undefined;
    const files: HostFiles = { maxBytes: 1_000_000, kinds: ["image/*"], upload: () => new Promise<FileValue>((done) => (answer = done)) };
    const drawn = await editor({ value: [porch], several: true, files });
    await pick(drawn.container.querySelector<HTMLInputElement>("input[data-graview-file-input]")!, [new File(["n"], "new.png", { type: "image/png" })]);
    // Somebody else puts a picture there while this one is on its way.
    await drawn.render([porch, gutter]);
    await act(async () => answer({ href: "/files/new.png", name: "new.png", type: "image/png", bytes: 1 }));
    await arrives(() => (drawn.changes.length > 0 ? true : null));
    expect((drawn.value() as FileValue[]).map((file) => file.name)).toEqual(["porch.jpg", "gutter.jpg", "new.png"]);
  });

  it("says a file already there is there, and adds it no second time", async () => {
    const files: HostFiles = { maxBytes: 1_000_000, kinds: ["image/*"], upload: async () => porch };
    const drawn = await editor({ value: [porch], several: true, files });
    await pick(drawn.container.querySelector<HTMLInputElement>("input[data-graview-file-input]")!, [new File(["p"], "porch.jpg", { type: "image/jpeg" })]);
    const said = await arrives(() => drawn.container.querySelector('[role="alert"]'));
    expect(said.textContent).toBe("“porch.jpg” is already here.");
    expect(drawn.changes).toEqual([]);
  });

  it("says which files were left out when several are given to a field that holds one", async () => {
    const drawn = await editor({ value: [], several: false, files: fakeHost() });
    await pick(drawn.container.querySelector<HTMLInputElement>("input[data-graview-file-input]")!, [new File(["a"], "a.png", { type: "image/png" }), new File(["b"], "b.png", { type: "image/png" })]);
    const said = await arrives(() => drawn.container.querySelector('[role="alert"]'));
    expect(said.textContent).toBe("Photos holds one picture, so “b.png” was left out.");
    expect((drawn.value() as FileValue).name).toBe("a.png");
  });

  it("keeps the keyboard in the editor when a file is moved or removed", async () => {
    const drawn = await editor({ value: [porch, gutter], several: true, files: fakeHost() });
    const button = (name: string) => drawn.container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    button("Move gutter.jpg earlier")!.focus();
    await act(async () => button("Move gutter.jpg earlier")!.click());
    // At the top it can move no earlier: the keyboard is on what it can do there.
    expect(document.activeElement).toBe(button("Remove gutter.jpg"));
    await act(async () => button("Remove gutter.jpg")!.click());
    expect(document.activeElement).toBe(button("Remove porch.jpg"));
    await act(async () => button("Remove porch.jpg")!.click());
    expect(document.activeElement).toBe(drawn.container.querySelector("[data-graview-file-choose]"));
  });

  it("sends a HEIC this browser cannot read as it is where the host takes it, and refuses it in words where it does not", async () => {
    const heic = new File(["heic"], "IMG_0001.HEIC", { type: "" });
    const takesHeic = await prepare(heic, fakeHost({ kinds: ["image/*"] }), { image: true });
    expect(takesHeic).toMatchObject({ name: "IMG_0001.HEIC", type: "image/heic" });
    const refuses = await prepare(heic, fakeHost({ kinds: ["image/jpeg", "image/png"] }), { image: true });
    expect(refuses).toEqual({ refused: "“IMG_0001.HEIC” is a HEIC photo, which this browser can’t turn into a JPEG and this host doesn’t take. Save it as a JPEG and try again." });
  });
});
