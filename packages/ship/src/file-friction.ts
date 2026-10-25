import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isVisitorAuthor } from "@graview/core";
import { keptFriction, type FrictionEvent, type HeldFriction } from "@graview/core/friction";

/**
 * THE FRICTION LOG KEPT IN A FILE BESIDE THE STORE (Roadmap f-friction-log):
 * `friction.json` in the store's own directory, read again whenever another
 * process wrote it — so a tool call `graview mcp --data <dir>` got wrong is
 * read by `graview serve` on the same directory. Plain JSON, written whole
 * and moved into place, the old let go on every write.
 *
 * Not in the op log, on purpose: what somebody could not do is about the
 * app, not part of it — not undone, not exported, not served to anybody
 * but its author and as counts.
 */
export function fileFriction(path: string, options: { readonly retentionDays?: number; readonly most?: number } = {}): HeldFriction {
  let held: readonly FrictionEvent[] = [];
  let stamp = -1;
  const fresh = (): readonly FrictionEvent[] => {
    if (!existsSync(path)) {
      held = [];
      stamp = -1;
      return held;
    }
    const at = statSync(path).mtimeMs;
    if (at !== stamp) {
      try {
        held = (JSON.parse(readFileSync(path, "utf8")) as { events?: FrictionEvent[] }).events ?? [];
      } catch {
        // A file somebody broke by hand is read as empty, and written whole again on the next event.
        held = [];
      }
      stamp = at;
    }
    return held;
  };
  return {
    add(event) {
      if (isVisitorAuthor(event.by)) return;
      const next = keptFriction([...fresh(), event], options);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(`${path}.tmp`, `${JSON.stringify({ events: next })}\n`);
      renameSync(`${path}.tmp`, path);
      held = next;
      stamp = statSync(path).mtimeMs;
    },
    list: () => keptFriction(fresh(), options),
  };
}
