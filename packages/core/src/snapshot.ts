/*
 * `@graview/core/snapshot` — A SNAPSHOT SAYS WHEN IT WAS MADE AND WHAT IT
 * HOLDS, and can be read a kind at a time.
 *
 * A snapshot file used to be one JSON object, `{ nodes, edges }`: to learn
 * how old it was, or whether it held any tasks at all, a reader parsed every
 * record in it, and a page seeded from a 3 MB projection loaded all of it
 * before it drew anything. The format is now lines:
 *
 *   {"graview":"snapshot","format":2,"generatedAt":"…","kinds":{…},"edges":{…},"parts":[…]}
 *   {"id":"t1","kind":"task",…}          ← one record per line, a kind's together
 *   …
 *   {"kind":"blocks","from":"t1","to":"t2"}  ← then the links, one per line
 *
 * The first line is the header: when it was made, how many records of each
 * kind and links of each kind it holds, and where each kind's lines are —
 * by line and by byte — so a reader parses only the kinds it wants, and a
 * page fetches only their bytes. An old `{ nodes, edges }` file still reads.
 *
 * An entry of its own: a page reads a snapshot before it draws, and only
 * the page that does carries this.
 */
import type { GraphEdge, GraphSnapshot } from "./graph/types.js";

/** One kind's lines in the body (`kind` null: the links), by line and by byte from the body's start. */
export interface SnapshotPart {
  readonly kind: string | null;
  /** The part's first line, counted from the line after the header. */
  readonly line: number;
  readonly lines: number;
  /** The part's first byte, counted from the byte after the header's newline. */
  readonly at: number;
  readonly bytes: number;
}

export interface SnapshotHeader {
  readonly graview: "snapshot";
  /** 2 for the lines; 1 for an old `{ nodes, edges }` file, which says no time and has no parts. */
  readonly format: 1 | 2;
  /** When the snapshot was made, as an ISO time — absent when the writer never said. */
  readonly generatedAt?: string;
  /** Records of each kind, in the order the body holds them. */
  readonly kinds: Readonly<Record<string, number>>;
  /** Links of each kind. */
  readonly edges: Readonly<Record<string, number>>;
  readonly parts: readonly SnapshotPart[];
}

export interface SnapshotFile {
  readonly header: SnapshotHeader;
  /** What was read: every record, or the kinds asked for and the links among them. */
  readonly snapshot: GraphSnapshot;
}

export interface ReadSnapshotOptions {
  /** Only these kinds of record, and only the links whose both ends are among them. */
  readonly kinds?: readonly string[];
}

/** The first line of every snapshot in the line format. */
export const SNAPSHOT_FORMAT = 2;

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

function counted<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

/**
 * A graph as a snapshot file: the header, each kind's records together in
 * the order they first appear, then the links. `generatedAt` defaults to now.
 */
export function writeSnapshot(snapshot: GraphSnapshot, options: { readonly generatedAt?: string | Date } = {}): string {
  const byKind = new Map<string, string[]>();
  for (const node of snapshot.nodes) {
    const lines = byKind.get(node.kind) ?? [];
    lines.push(JSON.stringify(node));
    byKind.set(node.kind, lines);
  }
  const groups: [string | null, string[]][] = [...byKind, [null, snapshot.edges.map((edge) => JSON.stringify(edge))]];
  const parts: SnapshotPart[] = [];
  let line = 0;
  let at = 0;
  for (const [kind, lines] of groups) {
    const bytes = lines.reduce((sum, text) => sum + byteLength(text) + 1, 0);
    parts.push({ kind, line, lines: lines.length, at, bytes });
    line += lines.length;
    at += bytes;
  }
  const generatedAt = options.generatedAt ?? new Date();
  const header: SnapshotHeader = {
    graview: "snapshot",
    format: SNAPSHOT_FORMAT,
    generatedAt: typeof generatedAt === "string" ? generatedAt : generatedAt.toISOString(),
    kinds: Object.fromEntries([...byKind].map(([kind, lines]) => [kind, lines.length])),
    edges: counted(snapshot.edges, (edge) => edge.kind),
    parts,
  };
  return [JSON.stringify(header), ...groups.flatMap(([, lines]) => lines)].join("\n") + "\n";
}

function isHeader(value: unknown): value is SnapshotHeader {
  return typeof value === "object" && value !== null && (value as { graview?: unknown }).graview === "snapshot";
}

/** An old `{ nodes, edges }` file, said as a header. */
function legacy(value: unknown): SnapshotFile {
  const parsed = value as Partial<GraphSnapshot> & { generatedAt?: unknown };
  if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('This is not a graph snapshot: it needs a snapshot header line, or "nodes" and "edges" arrays.');
  }
  const header: SnapshotHeader = {
    graview: "snapshot",
    format: 1,
    ...(typeof parsed.generatedAt === "string" ? { generatedAt: parsed.generatedAt } : {}),
    kinds: counted(parsed.nodes, (node) => node.kind),
    edges: counted(parsed.edges, (edge) => edge.kind),
    parts: [],
  };
  return { header, snapshot: { nodes: parsed.nodes, edges: parsed.edges } };
}

function firstLine(text: string): string {
  const end = text.indexOf("\n");
  return end === -1 ? text : text.slice(0, end);
}

function parseHeader(line: string): SnapshotHeader | undefined {
  try {
    const value = JSON.parse(line) as unknown;
    if (!isHeader(value)) return undefined;
    if (value.format > SNAPSHOT_FORMAT) {
      throw new Error(`This snapshot is in format ${value.format}, newer than this framework reads (${SNAPSHOT_FORMAT}).`);
    }
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** Keeps the records of the asked kinds, and the links whose both ends are kept. */
function narrowed(snapshot: GraphSnapshot, kinds: readonly string[] | undefined): GraphSnapshot {
  if (!kinds) return snapshot;
  const nodes = snapshot.nodes.filter((node) => kinds.includes(node.kind));
  const ids = new Set(nodes.map((node) => node.id));
  return { nodes, edges: snapshot.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
}

/** What a snapshot says about itself, read from its first line alone (an old file is read whole). */
export function readSnapshotHeader(text: string): SnapshotHeader {
  return parseHeader(firstLine(text)) ?? legacy(JSON.parse(text)).header;
}

/**
 * A snapshot file, read: the line format or an old `{ nodes, edges }`. With
 * `kinds`, only those kinds' lines are parsed — the rest are skipped by the
 * header's line counts, never read as JSON.
 */
export function readSnapshot(text: string, options: ReadSnapshotOptions = {}): SnapshotFile {
  const header = parseHeader(firstLine(text));
  if (!header) {
    const file = legacy(JSON.parse(text));
    return { header: file.header, snapshot: narrowed(file.snapshot, options.kinds) };
  }
  const lines = text.split("\n");
  const nodes: GraphSnapshot["nodes"][number][] = [];
  let edges: GraphEdge[] = [];
  for (const part of header.parts) {
    if (part.kind !== null && options.kinds && !options.kinds.includes(part.kind)) continue;
    const body = lines.slice(1 + part.line, 1 + part.line + part.lines).map((line) => JSON.parse(line) as never);
    if (part.kind === null) edges = body;
    else nodes.push(...body);
  }
  return { header, snapshot: narrowed({ nodes, edges }, options.kinds) };
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchSnapshotOptions extends ReadSnapshotOptions {
  readonly fetch?: Fetch;
  /** How many bytes the first request asks for, to find the header in. Default 64 KB. */
  readonly headerBytes?: number;
  /** Anything else each request carries — credentials, a cache mode. */
  readonly init?: RequestInit;
}

/**
 * A SNAPSHOT FETCHED A KIND AT A TIME. With `kinds`, the header is fetched
 * first and then only those kinds' bytes and the links', by range; a server
 * that does not serve ranges answers with the whole file, which is read as
 * a whole and narrowed. Without `kinds`, the whole file. An old file is
 * read whole either way.
 */
export async function fetchSnapshot(url: string, options: FetchSnapshotOptions = {}): Promise<SnapshotFile> {
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const get = async (range?: string): Promise<Response> => {
    const response = await send(url, {
      ...options.init,
      ...(range ? { headers: { ...(options.init?.headers as Record<string, string> | undefined), range } } : {}),
    });
    if (!response.ok) throw new Error(`The snapshot at ${url} answered ${response.status}.`);
    return response;
  };
  const whole = async () => readSnapshot(await (await get()).text(), options);
  if (!options.kinds) return whole();

  const first = await get(`bytes=0-${(options.headerBytes ?? 65_536) - 1}`);
  const opened = await first.text();
  if (first.status !== 206) return readSnapshot(opened, options);
  const end = opened.indexOf("\n");
  const header = end === -1 ? undefined : parseHeader(opened.slice(0, end));
  if (!header) return whole();

  const start = byteLength(opened.slice(0, end)) + 1;
  const wanted = header.parts.filter((part) => part.bytes > 0 && (part.kind === null || options.kinds!.includes(part.kind)));
  // Neighboring parts in one request: the body keeps a kind's lines together, so two kinds side by side are one range.
  const ranges: { from: number; to: number; parts: SnapshotPart[] }[] = [];
  for (const part of wanted) {
    const last = ranges[ranges.length - 1];
    if (last && last.to === part.at) {
      last.to = part.at + part.bytes;
      last.parts.push(part);
    } else ranges.push({ from: part.at, to: part.at + part.bytes, parts: [part] });
  }
  const nodes: GraphSnapshot["nodes"][number][] = [];
  const edges: GraphEdge[] = [];
  for (const range of ranges) {
    const response = await get(`bytes=${start + range.from}-${start + range.to - 1}`);
    const text = await response.text();
    if (response.status !== 206) return readSnapshot(text, options);
    const lines = text.split("\n");
    let at = 0;
    for (const part of range.parts) {
      const records = lines.slice(at, at + part.lines).map((line) => JSON.parse(line) as never);
      at += part.lines;
      if (part.kind === null) edges.push(...records);
      else nodes.push(...records);
    }
  }
  return { header, snapshot: narrowed({ nodes, edges }, options.kinds) };
}
