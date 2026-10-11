import { describe, expect, it } from "vitest";
import { fetchSnapshot, readSnapshot, readSnapshotHeader, writeSnapshot } from "../../src/snapshot.js";

/**
 * A SNAPSHOT SAYS WHEN IT WAS MADE AND WHAT IT HOLDS, and a reader can take
 * one kind of it without parsing — or fetching — the rest. An old
 * `{ nodes, edges }` file still reads.
 */

const graph = {
  nodes: [
    { id: "t1", kind: "task", title: "Write it — properly" },
    { id: "z1", kind: "zone", title: "Core" },
    { id: "t2", kind: "task", title: "Ship it" },
    { id: "c1", kind: "change", title: "Release" },
  ],
  edges: [
    { kind: "blocks", from: "t1", to: "t2" },
    { kind: "touches", from: "t1", to: "z1" },
    { kind: "carries", from: "c1", to: "t1" },
  ],
};
const MADE = "2026-10-10T22:00:00.000Z";

describe("a snapshot file", () => {
  const text = writeSnapshot(graph, { generatedAt: MADE });

  it("opens with a header that says when it was made and how many of each kind it holds", () => {
    const header = readSnapshotHeader(text);
    expect(header).toMatchObject({
      graview: "snapshot",
      format: 2,
      generatedAt: MADE,
      kinds: { task: 2, zone: 1, change: 1 },
      edges: { blocks: 1, touches: 1, carries: 1 },
    });
    // The header is one line, readable without the rest.
    expect(readSnapshotHeader(text.split("\n")[0]!)).toEqual(header);
  });

  it("holds one record per line, each kind's together, then the links", () => {
    const lines = text.trimEnd().split("\n").slice(1).map((line) => JSON.parse(line) as { kind: string });
    expect(lines.map((line) => line.kind)).toEqual(["task", "task", "zone", "change", "blocks", "touches", "carries"]);
  });

  it("reads back to the same graph, each kind's records together", () => {
    const { snapshot } = readSnapshot(text);
    expect(snapshot.edges).toEqual(graph.edges);
    expect([...snapshot.nodes].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...graph.nodes].sort((a, b) => a.id.localeCompare(b.id)));
  });

  it("reads one kind alone, with the links among what it read", () => {
    const { header, snapshot } = readSnapshot(text, { kinds: ["task"] });
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["t1", "t2"]);
    expect(snapshot.edges).toEqual([{ kind: "blocks", from: "t1", to: "t2" }]);
    // The header still says what the whole file holds.
    expect(header.kinds).toEqual({ task: 2, zone: 1, change: 1 });
  });

  it("never parses a kind it was not asked for", () => {
    // A line that is not JSON in a kind nobody asked for is never read.
    const lines = text.split("\n");
    lines[3] = "not json at all";
    expect(readSnapshot(lines.join("\n"), { kinds: ["task"] }).snapshot.nodes).toHaveLength(2);
  });

  it("still reads an old { nodes, edges } file, pretty-printed or not, and says what it holds", () => {
    for (const old of [JSON.stringify(graph), JSON.stringify(graph, null, 2)]) {
      const { header, snapshot } = readSnapshot(old);
      expect(header).toMatchObject({ format: 1, kinds: { task: 2, zone: 1, change: 1 }, edges: { blocks: 1 } });
      expect(header.generatedAt).toBeUndefined();
      expect(snapshot).toEqual(graph);
      expect(readSnapshot(old, { kinds: ["zone"] }).snapshot).toEqual({ nodes: [graph.nodes[1]], edges: [] });
    }
  });

  it("refuses what is neither, and a newer format, saying which", () => {
    expect(() => readSnapshot('{"nodes":[]}')).toThrow('"nodes" and "edges" arrays');
    expect(() => readSnapshot('{"graview":"snapshot","format":9,"kinds":{},"edges":{},"parts":[]}\n')).toThrow("format 9, newer than");
  });
});

/** A server holding the file, answering ranges when it is asked to serve them. */
function served(text: string, ranges: boolean) {
  const bytes = new TextEncoder().encode(text);
  const asked: string[] = [];
  const fetch = async (_url: string, init?: RequestInit): Promise<Response> => {
    const range = (init?.headers as Record<string, string> | undefined)?.["range"];
    asked.push(range ?? "whole");
    if (!range || !ranges) return new Response(bytes, { status: 200 });
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range)!;
    return new Response(bytes.slice(Number(from), Math.min(Number(to) + 1, bytes.length)), { status: 206 });
  };
  return { fetch, asked };
}

describe("a snapshot fetched a kind at a time", () => {
  const text = writeSnapshot(graph, { generatedAt: MADE });

  it("asks for the header, then only the kinds wanted and the links", async () => {
    const server = served(text, true);
    const { header, snapshot } = await fetchSnapshot("/data/snapshot.jsonl", { kinds: ["task"], fetch: server.fetch, headerBytes: 64 });
    expect(header.generatedAt).toBe(MADE);
    expect(snapshot.nodes.map((node) => node.id)).toEqual(["t1", "t2"]);
    expect(snapshot.edges).toEqual([{ kind: "blocks", from: "t1", to: "t2" }]);
    // The header did not fit in 64 bytes, so the whole file was asked for once.
    expect(server.asked).toEqual(["bytes=0-63", "whole"]);

    const roomy = served(text, true);
    const again = await fetchSnapshot("/data/snapshot.jsonl", { kinds: ["task", "zone"], fetch: roomy.fetch });
    expect(again.snapshot.nodes.map((node) => node.id)).toEqual(["t1", "t2", "z1"]);
    expect(again.snapshot.edges).toEqual([graph.edges[0], graph.edges[1]]);
    // Task and zone sit side by side: one range for both, one for the links, nothing for the change.
    expect(roomy.asked).toHaveLength(3);
  });

  it("reads the whole answer when the server does not serve ranges, or the file is an old one", async () => {
    const plain = served(text, false);
    expect((await fetchSnapshot("/s", { kinds: ["zone"], fetch: plain.fetch })).snapshot.nodes).toEqual([graph.nodes[1]]);
    expect(plain.asked).toHaveLength(1);

    const old = served(JSON.stringify(graph, null, 2), true);
    expect((await fetchSnapshot("/s", { kinds: ["zone"], fetch: old.fetch })).snapshot.nodes).toEqual([graph.nodes[1]]);
    expect((await fetchSnapshot("/s", { fetch: old.fetch })).snapshot).toEqual(graph);
  });
});
