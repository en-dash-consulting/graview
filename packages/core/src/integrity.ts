import { Graph } from "./graph/graph.js";
import { edgeId, type GraphSnapshot } from "./graph/types.js";
import type { Operation } from "./ops/types.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";

/**
 * A FOLD HAS A FINGERPRINT (FR-20).
 *
 * The hash must not care how a graph was built: the same records reached
 * by a fold, a hydration or a restore hash the same. So it is taken over a
 * canonical form: nodes by id, edges by their identity, every object's keys
 * sorted, and keys whose value is `undefined` dropped as JSON drops them.
 * Arrays inside a field keep their order, because order there is meaning.
 *
 * The canonical form is JSON of the graph and nothing else, so the hash
 * holds across framework versions that do not change the graph's shape.
 *
 * SYNCHRONOUS AND PORTABLE ON PURPOSE. A store verifies inside code where
 * nothing async may run, and the same function has to run in Node, in a
 * page and in a worker with no `node:` builtins. WebCrypto is async only,
 * so this is a plain SHA-256 (FIPS 180-4) over the UTF-8 bytes.
 */

/** JSON with every object's keys sorted, at every depth. `undefined` keys are dropped, as JSON.stringify would. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** The graph in the one form two equal graphs share. */
function canonicalSnapshot(snapshot: GraphSnapshot): string {
  const nodes = snapshot.nodes.map((node) => ({ key: node.id, value: node })).sort(byKey);
  const edges = snapshot.edges
    .map((edge) => ({ key: edgeId(edge), value: { kind: edge.kind, from: edge.from, to: edge.to } }))
    .sort(byKey);
  return canonicalJson({ nodes: nodes.map((n) => n.value), edges: edges.map((e) => e.value) });
}

/**
 * The fingerprint of a graph: `sha256:<hex>` of its canonical form.
 *
 * Two snapshots of the same graph hash the same whatever order their nodes,
 * edges or fields are in; a graph that differs in any record does not.
 */
export function snapshotHash(snapshot: GraphSnapshot): string {
  return `sha256:${sha256Hex(canonicalSnapshot(snapshot))}`;
}

/** What `store.verify()` found: the graph agrees with the fold of its log, or where they part. */
export type VerifyResult =
  | { readonly ok: true; readonly hash: string }
  | {
      readonly ok: false;
      /** The hash of what the log folds to. */
      readonly expected: string;
      /** The hash of the graph the store holds. */
      readonly actual: string;
      /**
       * The op after which the two first disagree. Absent when they
       * disagree before any op: the base itself does not match.
       */
      readonly divergedAfter?: string;
      /** The finding in a sentence. */
      readonly reason: string;
    };

export interface VerifyOptions {
  /** Validate nodes on the way in, as the store did. */
  readonly validate?: boolean;
  /** The graph the ops fold onto. Empty when absent. */
  readonly base?: GraphSnapshot;
}

/**
 * Folds `ops` onto a base and compares the result with `current`.
 *
 * When they disagree, the op after which they part is found by bisection:
 * the fold after op k is compared with `current` unwound by the inverses of
 * every op after k. A state the unwinding cannot reach (an inverse that
 * does not apply to what is held) counts as not yet diverged.
 */
export function verifyFold<S extends AnySchema>(
  schema: S,
  ops: readonly Operation[],
  current: GraphSnapshot,
  options: VerifyOptions = {},
): VerifyResult {
  const validate = options.validate ?? true;
  const base = (options.base ?? { nodes: [], edges: [] }) as GraphSnapshot<NodeOfSchema<S>>;
  const actual = snapshotHash(current);

  const folded = Graph.from(schema, base, { validate });
  for (const [index, op] of ops.entries()) {
    try {
      folded.applyPrimitives(op.primitives);
    } catch (error) {
      const previous = ops[index - 1];
      return {
        ok: false,
        expected: snapshotHash(folded.snapshot()),
        actual,
        ...(previous ? { divergedAfter: previous.id } : {}),
        reason: `The log does not fold: op "${op.id}" (${op.intent}) could not be applied. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  const expected = snapshotHash(folded.snapshot());
  if (expected === actual) return { ok: true, hash: actual };

  const forwardAt = (k: number): string => {
    const graph = Graph.from(schema, base, { validate });
    for (let i = 0; i <= k; i++) graph.applyPrimitives(ops[i]!.primitives);
    return snapshotHash(graph.snapshot());
  };
  const backwardAt = (k: number): string | undefined => {
    try {
      const graph = Graph.from(schema, current as GraphSnapshot<NodeOfSchema<S>>, { validate });
      for (let i = ops.length - 1; i > k; i--) graph.applyPrimitives(ops[i]!.inverse);
      return snapshotHash(graph.snapshot());
    } catch {
      return undefined;
    }
  };
  const disagree = (k: number): boolean => {
    const back = backwardAt(k);
    return back !== undefined && back !== forwardAt(k);
  };
  let lo = -1;
  let hi = ops.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (disagree(mid)) hi = mid;
    else lo = mid + 1;
  }
  const after = hi >= 0 ? ops[hi] : undefined;
  return {
    ok: false,
    expected,
    actual,
    ...(after ? { divergedAfter: after.id } : {}),
    reason: after
      ? `The graph and the fold of its log part after op "${after.id}" (${after.intent}).`
      : "The graph and the fold of its log disagree before any op: the base it folds from does not match.",
  };
}

// ── SHA-256 (FIPS 180-4), over the UTF-8 bytes of a string ──────────────────

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of a string's UTF-8 bytes, as lowercase hex. */
export function sha256Hex(text: string): string {
  const data = new TextEncoder().encode(text);
  const bitLength = data.length * 8;
  const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }
  return [...h].map((x) => x.toString(16).padStart(8, "0")).join("");
}
