import { canonicalize } from "./canonical.js";
/*
 * JSON Patch (RFC 6902: add, remove, replace, move, copy, test) — how an agent
 * in a chat proposes a small change without resending the whole document.
 */

export type PatchOp =
  | { readonly op: "add" | "replace" | "test"; readonly path: string; readonly value: unknown }
  | { readonly op: "remove"; readonly path: string }
  | { readonly op: "move" | "copy"; readonly from: string; readonly path: string };

export class PatchError extends Error {}

const unescape = (s: string) => s.replace(/~1/g, "/").replace(/~0/g, "~");
const pointer = (path: string): string[] => {
  if (path === "") return [];
  if (!path.startsWith("/")) throw new PatchError(`"${path}" is not a JSON pointer; it should start with "/"`);
  return path.slice(1).split("/").map(unescape);
};

function parentOf(root: unknown, parts: string[], path: string): { parent: Record<string, unknown> | unknown[]; key: string } {
  let node = root as Record<string, unknown> | unknown[];
  for (const part of parts.slice(0, -1)) {
    const next = Array.isArray(node) ? node[Number(part)] : (node as Record<string, unknown>)[part];
    if (next === null || typeof next !== "object") throw new PatchError(`nothing at "${path}" to change`);
    node = next as Record<string, unknown> | unknown[];
  }
  return { parent: node, key: parts.at(-1)! };
}

function get(root: unknown, path: string): unknown {
  let node = root;
  for (const part of pointer(path)) {
    if (node === null || typeof node !== "object") throw new PatchError(`nothing at "${path}"`);
    node = Array.isArray(node) ? node[Number(part)] : (node as Record<string, unknown>)[part];
  }
  if (node === undefined) throw new PatchError(`nothing at "${path}"`);
  return node;
}

export function applyPatch<T>(document: T, ops: readonly PatchOp[]): T {
  if (ops.length > 200) throw new PatchError("a patch may have at most 200 operations");
  let root: unknown = structuredClone(document);
  for (const op of ops) {
    const parts = pointer(op.path);
    if (op.op === "test") {
      if (canonicalize(get(root, op.path)) !== canonicalize(op.value)) throw new PatchError(`"${op.path}" is not what the patch expected`);
      continue;
    }
    const value = "from" in op ? structuredClone(get(root, op.from)) : "value" in op ? structuredClone(op.value) : undefined;
    if (op.op === "move" && "from" in op) root = applyPatch(root, [{ op: "remove", path: op.from }]);
    if (parts.length === 0) {
      if (op.op === "remove") throw new PatchError("cannot remove the whole document");
      root = value;
      continue;
    }
    const { parent, key } = parentOf(root, parts, op.path);
    if (Array.isArray(parent)) {
      const i = key === "-" ? parent.length : Number(key);
      if (!Number.isInteger(i) || i < 0 || i > parent.length) throw new PatchError(`"${op.path}" is not a place in that list`);
      if (op.op === "remove") parent.splice(i, 1);
      else if (op.op === "replace") parent[i] = value;
      else parent.splice(i, 0, value);
    } else {
      if ((op.op === "remove" || op.op === "replace") && !(key in parent)) throw new PatchError(`nothing at "${op.path}" to ${op.op}`);
      if (op.op === "remove") delete parent[key];
      else parent[key] = value;
    }
  }
  return root as T;
}
