import type { GraviewDocument } from "./schema.js";

/*
 * CANONICAL FORM: keys sorted, undefined dropped, so two documents that mean
 * the same thing are the same bytes — and therefore the same hash. A
 * proposal is identified by the hash of the document it would produce, and
 * apply refuses a hash that is no longer what the app would become.
 */

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function canonicalize(document: GraviewDocument): string {
  return JSON.stringify(sortKeys(document));
}

export async function documentHash(document: GraviewDocument): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(document));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
