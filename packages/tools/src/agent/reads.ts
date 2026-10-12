import { labelOf, type AnySchema, type SearchResult, type Store, type Violation } from "@graview/core";
import { computedValues } from "@graview/core/blocks";
import { READ_CHARS, READ_LINKS, READ_PAGE, READ_PROBLEMS, READ_TEXT } from "./bounds.js";
import type { Authorship, UntrustedText } from "./untrusted.js";

/*
 * THE BOUNDED READS (FR-167), fetched with a seat's first read: a page of
 * records with how many more, a record without its neighborhood, the hits
 * and no more, and any answer held to `READ_CHARS`. The bounds are
 * `./bounds.ts`; the runtime that calls these is `./tools.ts`.
 */

/*
 * OTHER PEOPLE'S WORDS ARE DATA (FR-10), in what a record read answers:
 * marked here rather than in `./untrusted.ts`, which the runtime carries up
 * front, since only these reads hand a record over.
 */
const wrap = (text: string, author: NonNullable<ReturnType<Authorship["recordBy"]>>, by: Authorship): UntrustedText => ({ untrusted: true, authoredBy: by.say(author), text });

/** A record with each field somebody else wrote as their words. */
function markNode<N extends { id: string; kind: string }>(node: N, by: Authorship): N {
  let out: Record<string, unknown> | undefined;
  for (const [field, value] of Object.entries(node)) {
    if (typeof value !== "string" || field === "id" || field === "kind") continue;
    const author = by.fieldBy(node.id, field);
    if (!author) continue;
    out ??= { ...node };
    out[field] = wrap(value, author, by);
  }
  return (out ?? node) as N;
}

/**
 * A record's computed values (FR-83), with the words in them marked as
 * somebody's: a record named by a value is named in its author's words, and
 * words worked out from the record's own prose are that prose's author's.
 */
function markComputed(id: string, values: Readonly<Record<string, unknown>>, by: Authorship): Record<string, unknown> {
  const mark = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(mark);
    if (value !== null && typeof value === "object" && "id" in value && "label" in value) {
      const record = value as { id: string; label: string };
      const author = by.recordBy(record.id);
      return author ? { ...record, label: wrap(record.label, author, by) } : record;
    }
    if (typeof value === "string") {
      const author = by.recordBy(id);
      return author ? wrap(value, author, by) : value;
    }
    return value;
  };
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, mark(value)]));
}

/** A record's links, each named in the linked record's author's words when somebody else wrote them. */
function markLinks<L extends { readonly id: string; readonly label: string }>(links: readonly L[], by: Authorship): readonly (L | (Omit<L, "label"> & { label: UntrustedText }))[] {
  return links.map((link) => {
    const author = by.recordBy(link.id);
    return author ? { ...link, label: wrap(link.label, author, by) } : link;
  });
}

function markGraph<G extends { nodes: readonly { id: string; kind: string }[] }>(snapshot: G, by: Authorship): G {
  return { ...snapshot, nodes: snapshot.nodes.map((node) => markNode(node, by)) };
}

/** An answer's length, as a model is handed it. */
const charsOf = (value: unknown): number => (JSON.stringify(value) ?? "null").length;

/** Where a page starts: a whole number at or past 0, else 0. */
const offsetOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** "and 117 more nodes: call get_graph with offset 25 for the next page." — or nothing, when the page was the last. */
function moreSaid(total: number, offset: number, shown: number, tool: string, what: string, extra = ""): string | undefined {
  const rest = total - offset - shown;
  return rest > 0 ? `and ${rest} more ${what}: call ${tool} with ${extra}offset ${offset + shown} for the next page.` : undefined;
}

/** A violation as a tool answers it, without the parts a page draws its line with. */
const spoken = ({ line: _line, ...rest }: Violation): Omit<Violation, "line"> => rest;

/** A record with each long text cut at `READ_TEXT` characters, saying how long it was. */
function clipped<N extends object>(node: N): N {
  let out: Record<string, unknown> | undefined;
  for (const [field, value] of Object.entries(node)) {
    if (typeof value !== "string" || value.length <= READ_TEXT) continue;
    out ??= { ...(node as Record<string, unknown>) };
    out[field] = `${value.slice(0, READ_TEXT)}… (cut at ${READ_TEXT} of ${value.length} characters)`;
  }
  return (out ?? node) as N;
}

/**
 * The longest page of `items` from `offset` whose answer fits `READ_CHARS`:
 * at most `most`, and fewer while the answer is longer than a read may be.
 * At least one, so a page always moves on; a single record too long to fit
 * is cut whole by `withinReadChars`.
 */
function fittedPage<T, A>(items: readonly T[], offset: number, most: number, answer: (page: readonly T[]) => A): { readonly page: readonly T[]; readonly answer: A } {
  let count = Math.min(most, Math.max(0, items.length - offset));
  let page = items.slice(offset, offset + count);
  let said = answer(page);
  while (count > 1 && charsOf(said) > READ_CHARS) {
    count = Math.max(1, Math.floor(count * 0.75));
    page = items.slice(offset, offset + count);
    said = answer(page);
  }
  return { page, answer: said };
}

/**
 * ANY READ, HELD TO `READ_CHARS`. An answer that fits is handed back as it
 * is; one that does not — a place described in full, a long preview — is
 * its first characters with a sentence saying it was cut and how to ask for
 * less, so no read hands a model more than a read may.
 */
export function withinReadChars(tool: string, data: unknown): unknown {
  const json = JSON.stringify(data) ?? "null";
  if (json.length <= READ_CHARS) return data;
  const cut = `This answer was ${json.length} characters, more than the ${READ_CHARS} one read answers, so it is cut. Ask ${tool} for less, or use search_graph and get_node to read one thing.`;
  // Quoted again inside the answer, the partial grows by its escapes: shortened until the whole fits.
  for (let at = READ_CHARS - cut.length - 40; ; ) {
    const out = { cut, partial: json.slice(0, at) };
    const over = charsOf(out) - READ_CHARS;
    if (over <= 0) return out;
    at = Math.max(0, at - over - 8);
  }
}

/** `search_graph`: the hits without every match's id — what a picture lights, not what a model reads — and how many more. */
export function searchRead(found: SearchResult, marked: SearchResult): unknown {
  const { matched: _matched, ...answer } = marked;
  const shown = found.hits.filter((hit) => hit.about === "node").length;
  return found.total > shown ? { ...answer, more: `and ${found.total - shown} more records match: narrow the words, or add kind:<kind>.` } : answer;
}

/** `get_graph`: a page of records, the edges out of them, the total and how to read the next page. */
export function graphRead<S extends AnySchema>(seen: Store<S>, by: Authorship, args: Record<string, unknown>): { readonly data: unknown; readonly reads: readonly string[] } {
  const snapshot = seen.graph.snapshot();
  const offset = offsetOf(args["offset"]);
  const total = snapshot.nodes.length;
  const { page, answer } = fittedPage(snapshot.nodes, offset, READ_PAGE, (nodes) => {
    const on = new Set(nodes.map((node) => node.id));
    const more = moreSaid(total, offset, nodes.length, "get_graph", "nodes");
    return { ...markGraph({ nodes: nodes.map(clipped), edges: snapshot.edges.filter((edge) => on.has(edge.from)) }, by), total, ...(more ? { more } : {}) };
  });
  return { data: answer, reads: page.map((node) => node.id) };
}

/** `get_node`: the record's fields, its links as ids, kinds and labels a page each way, its problems and computed values. */
export function nodeRead<S extends AnySchema>(seen: Store<S>, by: Authorship, id: string, args: Record<string, unknown>): { readonly data: Record<string, unknown>; readonly reads: readonly string[] } {
  const node = seen.graph.getNode(id)!;
  const offset = offsetOf(args["offset"]);
  const outAll = seen.graph.outEdges(id);
  const inAll = seen.graph.inEdges(id);
  const out = outAll.slice(offset, offset + READ_LINKS);
  const inbound = inAll.slice(offset, offset + READ_LINKS);
  const link = (kind: string, other: string) => {
    const at = seen.graph.getNode(other);
    return { kind, id: other, label: at ? labelOf(seen.schema.tryDefinition(at.kind), at) : other };
  };
  // Worked out over what this seat sees, never the store's whole graph (FR-83, FR-55).
  const worked = computedValues(seen.schema, seen.graph as never, node as never);
  const problems = seen.violations().filter((violation) => violation.nodeIds.includes(id));
  const more = [
    moreSaid(outAll.length, offset, out.length, "get_node", "links out", `id "${id}" and `),
    moreSaid(inAll.length, offset, inbound.length, "get_node", "links in", `id "${id}" and `),
    problems.length > READ_PROBLEMS ? `and ${problems.length - READ_PROBLEMS} more problems: get_violations lists them.` : undefined,
  ].filter(Boolean);
  return {
    data: {
      node: markNode(clipped(node), by),
      ...(Object.keys(worked.values).length > 0 ? { computed: markComputed(id, worked.values, by) } : {}),
      ...(Object.keys(worked.refused).length > 0 ? { uncomputed: worked.refused } : {}),
      out: markLinks(out.map((edge) => link(edge.kind, edge.to)), by),
      in: markLinks(inbound.map((edge) => link(edge.kind, edge.from)), by),
      violations: problems.slice(0, READ_PROBLEMS).map(spoken),
      ...(more.length > 0 ? { more: more.join(" ") } : {}),
    },
    // Asking about a node is asking about its neighborhood: the answer names them, so looking at it looked at them.
    reads: [id, ...out.map((edge) => edge.to), ...inbound.map((edge) => edge.from)],
  };
}

/** `get_violations`: a page of problems, the total and how to read the next page. */
export function violationsRead(every: readonly Violation[], args: Record<string, unknown>): { readonly data: unknown; readonly reads: readonly string[] } {
  const offset = offsetOf(args["offset"]);
  const { page, answer } = fittedPage(every, offset, READ_PROBLEMS, (shown) => {
    const more = moreSaid(every.length, offset, shown.length, "get_violations", "problems");
    return { violations: shown.map(spoken), total: every.length, ...(more ? { more } : {}) };
  });
  return { data: answer, reads: [...new Set(page.flatMap((violation) => violation.nodeIds))] };
}
