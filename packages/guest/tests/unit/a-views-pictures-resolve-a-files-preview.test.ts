// @vitest-environment jsdom
import type { FileValue } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuestMedia } from "../../src/host/media.js";
import { createGuestPictures, PICTURES_SETTLE_MS, standInPictures, type GuestPictures } from "../../src/host/pictures.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/*
 * A VIEW'S PICTURES RESOLVE A FILE'S PREVIEW, AND TAKE NOTHING FROM THE
 * DOCUMENTS (HQ f-file-values-carry-a-preview). A workshop's deliverables
 * view drew each report's first page from a preview field kept by hand,
 * which went stale when the report was replaced, and declaring `pictures`
 * for it took the `href` from the reports themselves. The host now makes
 * the first page and keeps it on the report's own value (`preview`), and a
 * view that asks for pictures is handed it as a picture field's — fetched
 * as the reader, made smaller, thumbed, with `src` — while the report, and
 * every document, keeps the path the record keeps.
 */
const PREVIEW = "/graview/files/report-page-1.png";
const report: FileValue = { href: "/graview/files/report.pdf", name: "report.pdf", type: "application/pdf", bytes: 900_000, caption: "The workshop's report", preview: { src: PREVIEW, thumb: "/graview/files/report-page-1-240.png", width: 850, height: 1_100 } };
const agenda: FileValue = { href: "/graview/files/agenda.docx", name: "agenda.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes: 20_000, at: "2026-11-02T09:00:00Z" };
const cover: FileValue = { href: "/graview/files/cover.png", name: "cover.png", type: "image/png", bytes: 3_000, width: 400, height: 300 };
const props: GuestProps = {
  view: "deliverables",
  nodes: [{ id: "deliverable:report", kind: "deliverable", label: "Workshop report", report, cover, notes: [agenda] }],
} as unknown as GuestProps;

let fetched: string[] = [];
afterEach(() => vi.restoreAllMocks());
function page() {
  fetched = [];
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    fetched.push(path);
    return new Response(new Uint8Array(500), { status: 200, headers: { "content-type": "image/png" } });
  });
}
const settled = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
  await new Promise((done) => setTimeout(done, PICTURES_SETTLE_MS));
};
async function handed(pictures: GuestPictures): Promise<Record<string, unknown>> {
  page();
  const host = createGuestPictures(window, { as: "data", view: '"Deliverables"', pictures, moved: () => undefined, shrink: async (blob) => blob, look: async () => ({ width: 850, height: 1_100 }) });
  host.hand(props);
  await settled();
  return host.hand(props).nodes![0] as unknown as Record<string, unknown>;
}

describe("a view whose manifest asks for pictures", () => {
  it("is handed a document's preview as a picture: src made from its bytes, fetched where the preview is, its shape, and the document's own facts", async () => {
    const node = await handed({ width: 400, thumb: 120 });
    const file = node["report"] as GuestFile;
    expect(file.src).toMatch(/^data:image\/png;base64,/);
    expect(file).toMatchObject({ name: "report.pdf", type: "application/pdf", bytes: 900_000, caption: "The workshop's report", width: 850, height: 1_100, aspect: 0.7727 });
    expect(fetched).toContain(PREVIEW);
    expect(fetched).not.toContain(report.href);
    // The preview's paths stay the host's; the document's own is the record's.
    expect(JSON.stringify(file)).not.toContain(report.preview!.src);
    expect(JSON.stringify(file)).not.toContain(report.preview!.thumb!);
    expect(file.href).toBe(report.href);
  });

  it("keeps href on the files in other fields: a document comes as the record keeps it, a picture by its facts", async () => {
    const node = await handed(true);
    expect(node["notes"]).toEqual([agenda]);
    expect((node["cover"] as GuestFile).src).toMatch(/^data:image\/png;base64,/);
    expect("href" in (node["cover"] as GuestFile)).toBe(false);
    expect(fetched).not.toContain(agenda.href);
  });

  it("chose another field's pictures, is handed the document as the record keeps it, its preview unfetched", async () => {
    const node = await handed({ deliverable: "cover" });
    const { preview: _path, ...kept } = report;
    expect(node["report"]).toEqual(kept);
    expect(fetched).not.toContain(PREVIEW);
  });

  it("headless, is handed the preview with a stand-in src, as a picture field's is", () => {
    const run = standInPictures(props, { view: '"Deliverables"', pictures: true, standIn: "data:x" });
    const node = run.props.nodes![0] as unknown as Record<string, unknown>;
    expect(node["report"]).toMatchObject({ href: report.href, name: "report.pdf", src: "data:x", width: 850, height: 1_100 });
    expect(node["notes"]).toEqual([agenda]);
    expect(JSON.stringify(node["report"])).not.toContain(report.preview!.src);
    expect(JSON.stringify(node["report"])).not.toContain(report.preview!.thumb!);
    expect(run.left).toEqual([]);
  });

  it("opens a document full screen by its preview, as a picture field's, and refuses one with none", () => {
    const said: string[] = [];
    const media = createGuestMedia(window, { view: '"Deliverables"', pictures: true, shown: () => props, file: (href) => `/a/pom${href}`, onProblem: (line) => said.push(line) });
    const button = window.document.createElement("button");
    button.setAttribute("data-lightbox", "");
    button.setAttribute("data-record", "deliverable:report");
    button.setAttribute("data-field", "report");
    window.document.body.appendChild(button);
    expect(media.open(button)).toBe(true);
    expect(window.document.querySelector("dialog[data-graview-lightbox] img")?.getAttribute("src")).toBe(`/a/pom${PREVIEW}`);
    (window.document.querySelector("dialog button") as HTMLButtonElement).click();
    button.setAttribute("data-field", "notes");
    expect(media.open(button)).toBe(false);
    expect(said[0]).toContain('names "agenda.docx" on "Workshop report", which is not a picture, a video or a document with a preview');
    media.dispose();
    button.remove();
  });
});
