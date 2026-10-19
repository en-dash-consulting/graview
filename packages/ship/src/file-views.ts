import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { memoryViews, type KeptViews, type KeptViewsState, type MemoryViewsOptions } from "@graview/core";

/**
 * THE VIEWS A PERSON TIDIED, KEPT IN A FILE BESIDE THE STORE (Roadmap
 * f-place-menu-views): `views.json` in the store's own directory — the
 * names hidden, and the views deleted with the day each is gone for good —
 * written whole and moved into place after every change, read once when
 * `graview serve` starts. Not in the op log: hiding a view is about how the
 * app is shown, not a change to its records.
 */
export function fileViews(path: string, options: Omit<MemoryViewsOptions, "initial"> = {}): KeptViews {
  const read = (): Partial<KeptViewsState> => {
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Partial<KeptViewsState>;
    } catch {
      return {};
    }
  };
  const held = read();
  const kept = memoryViews({ ...options, initial: { hidden: held.hidden ?? [], removed: held.removed ?? [] } });
  kept.onChange?.(() => {
    const { hidden, removed } = kept.current();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, `${JSON.stringify({ hidden, removed }, null, 2)}\n`);
    renameSync(`${path}.tmp`, path);
  });
  return kept;
}
