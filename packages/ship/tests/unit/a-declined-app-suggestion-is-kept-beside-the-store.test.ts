import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GraviewDocument } from "@graview/core/document";
import { frictionEvent } from "@graview/core/friction";
import { declineAppSuggestion, learnFromUse } from "@graview/core/learn";
import { describe, expect, it } from "vitest";
import { createFileAdapter, fileLearned, learnedFileOf } from "../../src/index.js";

/*
 * WHAT PEOPLE ANSWERED TO THE APP'S OWN SUGGESTIONS ABOUT ITSELF (Roadmap
 * f-learned-suggestions), kept in `learned.json` beside the store, where the
 * friction log they were learned from is kept: read again by another
 * process, so a decline one command keeps holds for the next.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Wedding",
  kinds: { vendor: { noun: "vendor", plural: "vendors", fields: { name: { type: "string", required: true } } } },
} as unknown as GraviewDocument;
const friction = ["ada", "bo", "cy"].map((id) => frictionEvent({ type: "search-miss", words: "supplier", kind: "vendor" }, { kind: "human", id })!);

describe("learned.json", () => {
  it("is kept beside the store, in the app's own folder of a data directory", () => {
    const root = mkdtempSync(join(tmpdir(), "learned-"));
    expect(learnedFileOf({ adapter: createFileAdapter(root), where: root }, "wedding")).toBe(join(root, "wedding", "learned.json"));
  });

  it("a declined suggestion is never offered again, by this process or the next", () => {
    const path = join(mkdtempSync(join(tmpdir(), "learned-")), "wedding", "learned.json");
    const [alias] = learnFromUse({ document, friction });
    expect(alias?.key).toBe("alias:vendor:supplier");
    fileLearned(path).add(declineAppSuggestion(alias!, { by: { kind: "human", id: "ada" }, at: "2026-10-25T00:00:00.000Z" }));
    const read = fileLearned(path).list();
    expect(read).toEqual([{ key: "alias:vendor:supplier", answer: "declined", at: "2026-10-25T00:00:00.000Z", by: { kind: "human", id: "ada" }, said: alias!.said }]);
    expect(learnFromUse({ document, friction, declined: read })).toEqual([]);
  });

  it("keeps one answer per suggestion, the latest standing, and reads a broken file as none", () => {
    const path = join(mkdtempSync(join(tmpdir(), "learned-")), "learned.json");
    const kept = fileLearned(path);
    kept.add(declineAppSuggestion("alias:vendor:supplier", { at: "2026-10-24T00:00:00.000Z" }));
    kept.add(declineAppSuggestion("alias:vendor:supplier", { at: "2026-10-25T00:00:00.000Z" }));
    expect(JSON.parse(readFileSync(path, "utf8")).decisions).toHaveLength(1);
    writeFileSync(path, "{ not json");
    expect(fileLearned(path).list()).toEqual([]);
  });
});
