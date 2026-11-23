// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, fileField, Store, z, type AnySchema, type FileValue, type HostFiles } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PagesApp, recordPath, type PageContext } from "../../src/index.js";

/**
 * A DOCUMENT WITH A PREVIEW IS DRAWN BY ITS PICTURE (HQ
 * f-file-values-carry-a-preview). A workshop's deliverables are PDFs; a
 * card and a row showed nothing of them, and a view needed a hand-made
 * preview field that went stale when the file was replaced. The host now
 * makes a picture of the first page and hands it on the file's own value
 * (`preview: { src, thumb?, width?, height? }`, paths on the host), and
 * the record is drawn by it where it would be drawn by a picture field's:
 * small on its card and its row (the smaller `thumb`), and on its page
 * where the PDF's box stands, opening the document.
 */
const report: FileValue = {
  href: "/graview/files/a0c2.pdf",
  name: "pom-report.pdf",
  type: "application/pdf",
  bytes: 240_000,
  preview: { src: "/graview/files/a0c2-page-1.png", thumb: "/graview/files/a0c2-page-1-240.png", width: 850, height: 1100 },
};
const deliverable = defineNode("deliverable", { fields: z.object({ name: z.string(), report: fileField().optional() }), plural: "Deliverables", label: (node: { name: string }) => node.name });
const schema = createSchema([deliverable]);
const store = () => new Store<AnySchema>({ schema, mutations: [], snapshot: { nodes: [{ id: "d1", kind: "deliverable", name: "Workshop report", report }], edges: [] } as never });
/** Cloud serves a record's file under the app's base. */
const cloud: HostFiles = { maxBytes: 0, kinds: [], upload: async () => report, src: (href) => `/a/pom${href}` };

async function draw(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  const until = async <T,>(read: () => T | null | undefined): Promise<T> => {
    for (let tries = 0; tries < 200; tries++) {
      const found = read();
      if (found) return found;
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    throw new Error("it never arrived");
  };
  return { host, until, done: async () => (await act(async () => root.unmount()), host.remove()) };
}
const page = (path: string) => {
  const live = store();
  const context: PageContext<AnySchema> = { store: live, views: registerDefaultViews(live.schema, createViews(live.schema)), files: cloud };
  return draw(<PagesApp context={context} initialPath={path} />);
};

describe("a document with a preview its host made", () => {
  it("is drawn on its card by the preview's thumb, where the host serves it", async () => {
    const live = store();
    const views = registerDefaultViews(live.schema, createViews(live.schema));
    const Card = views.lookup("deliverable", { cardinality: "one", fidelity: "summary" }) as ViewComponent<AnySchema>;
    const { host, until, done } = await draw(
      <GraviewProvider store={live} views={views} files={cloud}>
        <Card node={live.graph.getNode("d1") as never} cardinality="one" fidelity="summary" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    const img = await until(() => host.querySelector<HTMLImageElement>("img[data-graview-preview]"));
    expect(img.getAttribute("src")).toBe("/a/pom/graview/files/a0c2-page-1-240.png");
    expect(img.getAttribute("data-graview-thumb")).toBe(report.href);
    expect(img.getAttribute("alt")).toBe("pom-report.pdf");
    await done();
  });

  it("is drawn on its row by the preview's thumb", async () => {
    const { host, until, done } = await page("/deliverables");
    const img = await until(() => host.querySelector<HTMLImageElement>('[data-graview-record="d1"] img[data-graview-preview]'));
    expect(img.getAttribute("src")).toBe("/a/pom/graview/files/a0c2-page-1-240.png");
    await done();
  });

  it("is drawn on its record's page by the preview, pressed to open the document, its line under it", async () => {
    const { host, until, done } = await page(recordPath(schema, "deliverable", "d1"));
    const link = await until(() => host.querySelector<HTMLAnchorElement>(`a[data-graview-preview="${report.href}"]`));
    expect(link.getAttribute("href")).toBe("/a/pom/graview/files/a0c2.pdf");
    expect(link.getAttribute("aria-label")).toBe("Open pom-report.pdf");
    const img = link.querySelector("img")!;
    expect([img.getAttribute("src"), img.getAttribute("width"), img.getAttribute("height")]).toEqual(["/a/pom/graview/files/a0c2-page-1.png", "850", "1100"]);
    // The preview stands where the PDF's box would: one picture of the document, not two.
    expect(host.querySelector('object[type="application/pdf"]')).toBeNull();
    expect(host.querySelector("[data-graview-file-line]")?.textContent).toContain("pom-report.pdf");
    await done();
  });

  it("is a file a record may keep, and a preview that is no path on the host is refused", () => {
    const live = store();
    expect(live.graph.getNode("d1")).toMatchObject({ report });
    const shape = fileField();
    expect(shape.safeParse(report).success).toBe(true);
    expect(shape.safeParse({ ...report, preview: { src: "/graview/files/p.png" } }).success).toBe(true);
    for (const preview of [{ src: "https://elsewhere.example/p.png" }, { src: "data:image/png;base64,AAAA" }, { src: "/graview/files/p.png", thumb: "javascript:alert(1)" }, { src: "/graview/files/p.png", width: 0 }, {}]) {
      expect(shape.safeParse({ ...report, preview }).success).toBe(false);
    }
  });

  it("draws a record by its photograph before a document's preview", async () => {
    const both = defineNode("job", { fields: z.object({ name: z.string(), papers: z.array(fileField()).optional(), photo: fileField().optional() }), plural: "Jobs", label: (node: { name: string }) => node.name });
    const { firstPicture } = await import("@graview/core/blocks");
    const photo: FileValue = { href: "/graview/files/porch.jpg", name: "porch.jpg", type: "image/jpeg", bytes: 1_000 };
    expect(firstPicture({ papers: [report], photo }, both)).toBe(photo);
    expect(firstPicture({ papers: [report] }, both)).toBe(report);
    const { preview: _drawnBy, ...bare } = report;
    expect(firstPicture({ papers: [bare] }, both)).toBeUndefined();
  });
});
