import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { keptTold, toldAfter, type HeldTold, type Telling } from "@graview/core/told";

/**
 * WHAT PEOPLE TELL GRAVIEW, KEPT IN A FILE BESIDE THE STORE (Roadmap
 * f-menu-learns): `told.json` where `graview serve` keeps `friction.json`,
 * read again whenever another process wrote it. Plain JSON, written whole
 * and moved into place, the old let go on every write.
 *
 * Not in the op log, on purpose: what somebody told Graview is about the
 * app, not part of it — not undone, not exported, and deleted for good when
 * its teller or an owner deletes it.
 */
export function fileTold(path: string, options: { readonly retentionDays?: number; readonly most?: number } = {}): HeldTold {
  let held: readonly Telling[] = [];
  let stamp = -1;
  const fresh = (): readonly Telling[] => {
    if (!existsSync(path)) {
      held = [];
      stamp = -1;
      return held;
    }
    const at = statSync(path).mtimeMs;
    if (at !== stamp) {
      try {
        held = (JSON.parse(readFileSync(path, "utf8")) as { tellings?: Telling[] }).tellings ?? [];
      } catch {
        // A file somebody broke by hand is read as empty, and written whole again on the next telling.
        held = [];
      }
      stamp = at;
    }
    return held;
  };
  const write = (next: readonly Telling[]) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, `${JSON.stringify({ tellings: next })}\n`);
    renameSync(`${path}.tmp`, path);
    held = next;
    stamp = statSync(path).mtimeMs;
  };
  return {
    add: (telling) => write(toldAfter(fresh(), { add: telling }, options)),
    change: (id, change) => write(toldAfter(fresh(), { change: id, with: change })),
    remove: (id) => write(toldAfter(fresh(), { remove: id })),
    list: () => keptTold(fresh(), options),
  };
}
