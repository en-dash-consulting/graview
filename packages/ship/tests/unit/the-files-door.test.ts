import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { isFileValue } from "@graview/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { filesAt } from "../../src/browser.js";
import { DEV_FILES_KINDS, devFiles, devFilesHandler } from "../../src/dev.js";

/**
 * FR-163. A DEV SERVER'S FILES: the door a file field's editor sends to under
 * `pnpm dev` and in the harnesses — kept in memory, served back from the same
 * path, refused in words past its size or outside its kinds, and answered to
 * this app's own page only. `filesAt` is the page's half: the seam a host
 * hands `mount`, sending to that door and reading back the `FileValue`.
 */
let server: Server;
let base: string;
beforeAll(async () => {
  const handler = devFilesHandler({ maxBytes: 64, kinds: ["image/*", "application/pdf"] });
  server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

const files = () => filesAt(`${base}/__graview/files`, { maxBytes: 64, kinds: ["image/*", "application/pdf"], fetch: (url, init) => fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), origin: base } }) });

describe("the dev server's files", () => {
  it("keeps what it is sent and answers the value a record keeps, at a path on this host", async () => {
    const value = await files().upload(new Blob(["PNG pixels!"], { type: "image/png" }), "porch & gutter.png");
    expect(isFileValue(value)).toBe(true);
    expect(value).toMatchObject({ name: "porch & gutter.png", type: "image/png", bytes: 11 });
    expect(value.href).toMatch(/^\/__graview\/files\/[0-9a-f]{64}\.png$/);
  });

  it("serves it back as its type, never sniffed; a picture or a PDF inline, anything else never run", async () => {
    const value = await files().upload(new Blob(["%PDF-1.4"], { type: "application/pdf" }), "quote.pdf");
    const served = await fetch(`${base}${value.href}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("application/pdf");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("content-disposition")).toMatch(/^inline/);
    expect(await served.text()).toBe("%PDF-1.4");
  });

  it("never runs what it serves as this app's page: an SVG, which can carry a script, is drawn by an <img> but sandboxed when opened", async () => {
    const svg = "<svg><script>parent.x=document.cookie</script></svg>";
    const value = await files().upload(new Blob([svg], { type: "image/svg+xml" }), "badge.svg");
    const served = await fetch(`${base}${value.href}`);
    expect(served.headers.get("content-type")).toBe("image/svg+xml");
    expect(served.headers.get("content-security-policy")).toMatch(/(^|;\s*)sandbox(;|$)/);
    // A raster picture is sandboxed too: what the record says it is never decides what the bytes may do.
    const png = await files().upload(new Blob(["PNG pixels"], { type: "image/png" }), "porch.png");
    expect((await fetch(`${base}${png.href}`)).headers.get("content-security-policy")).toMatch(/(^|;\s*)sandbox(;|$)/);
  });

  it("says what it takes, and refuses past its size or outside its kinds in words the editor says", async () => {
    expect(await (await fetch(`${base}/__graview/files`)).json()).toEqual({ maxBytes: 64, kinds: ["image/*", "application/pdf"] });
    await expect(files().upload(new Blob(["x".repeat(65)], { type: "image/png" }), "big.png")).rejects.toThrow("it is more than 64 bytes, the most this server takes");
    await expect(files().upload(new Blob(["GIF89a"], { type: "text/html" }), "page.html")).rejects.toThrow("this server doesn't take text/html files");
  });

  it("answers this app's own page only", async () => {
    const elsewhere = await fetch(`${base}/__graview/files`, { method: "POST", body: "x", headers: { "content-type": "image/png", origin: "https://elsewhere.example" } });
    expect(elsewhere.status).toBe(403);
  });

  it("is a dev-server plugin and nothing else, taking pictures, PDFs and plain text by default", () => {
    expect(devFiles()).toMatchObject({ name: "graview:dev-files", apply: "serve" });
    expect(DEV_FILES_KINDS).toEqual(["image/*", "application/pdf", "text/plain"]);
  });
});
