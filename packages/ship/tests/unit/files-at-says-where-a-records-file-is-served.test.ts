import { fileSrc } from "@graview/core";
import { describe, expect, it } from "vitest";
import { filesAt } from "../../src/browser.js";

/**
 * A RECORD'S FILE IS FETCHED WHERE THE HOST SERVES IT (0.1.36). A record
 * keeps `href: "/graview/files/<sha>.<ext>"`, what the host's upload
 * answered, without the base the app is served under; Graview Cloud serves
 * the bytes only under that base (`/a/<app>/graview/files/…`). A host
 * already hands `filesAt(base + "/graview/files")`, so `filesAt` says where
 * each file is from its own url, and the page draws it there.
 */
const take = { maxBytes: 1_000, kinds: ["image/*"] };

describe("filesAt says where a record's file is served", () => {
  it("under the host's base, from its own url", () => {
    const files = filesAt("/a/jobs/graview/files", take);
    expect(files.src?.("/graview/files/3f9a.webp")).toBe("/a/jobs/graview/files/3f9a.webp");
    expect(fileSrc(files, "/graview/files/3f9a.webp")).toBe("/a/jobs/graview/files/3f9a.webp");
    // A trailing slash on the url is the same address.
    expect(filesAt("/a/jobs/graview/files/", take).src?.("/graview/files/3f9a.webp")).toBe("/a/jobs/graview/files/3f9a.webp");
    // By the page's whole address too.
    expect(filesAt("https://ws.graview.app/a/jobs/graview/files", take).src?.("/graview/files/q.pdf")).toBe("https://ws.graview.app/a/jobs/graview/files/q.pdf");
  });

  it("at the root and at the dev door, as the record says it", () => {
    expect(filesAt("/graview/files", take).src?.("/graview/files/3f9a.webp")).toBe("/graview/files/3f9a.webp");
    // The dev door answers hrefs under its own path, which are already where it serves them.
    expect(filesAt("/__graview/files", take).src?.("/__graview/files/abc.png")).toBe("/__graview/files/abc.png");
    // An href that is not one of the host's files is left as it is.
    expect(filesAt("/a/jobs/graview/files", take).src?.("/elsewhere/graview/files/x.png")).toBe("/elsewhere/graview/files/x.png");
    expect(filesAt("/a/jobs/graview/files", take).src?.("files/x.png")).toBe("files/x.png");
  });

  it("is the href itself for a host that does not say, or no host at all", () => {
    expect(fileSrc(undefined, "/graview/files/x.png")).toBe("/graview/files/x.png");
    expect(fileSrc({ ...take, upload: async () => ({ href: "", name: "", type: "", bytes: 0 }) }, "/graview/files/x.png")).toBe("/graview/files/x.png");
  });
});
