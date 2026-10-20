import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * ONE WRITER AT A TIME ON A STORE ON DISK.
 *
 * A running `graview preview` or `graview serve` holds the graph in memory
 * and writes it back as it changes. Anything else that wrote to the same
 * folder while it ran — `graview sync-seed --apply`, `graview apply`, a
 * second preview — was invisible to its open pages, and the server's next
 * write could put the old records back over it. Both commands said they
 * had succeeded, so the loss was silent.
 *
 * So a process that writes a store says so in a file beside it, and every
 * other writer reads that file first and refuses in a sentence that names
 * who holds it and how to go on. A hold left by a process that has since
 * died is noticed (its pid answers nobody) and taken over; nothing has to
 * be deleted by hand after a crash.
 */
export interface StoreHolder {
  /** The command holding it: `preview`, `serve`, `mcp`, `apply`, `sync-seed`. */
  readonly command: string;
  readonly pid: number;
  /** Where its server answers, once it listens: the way to act through it instead. */
  readonly url?: string;
  readonly since: string;
}

export interface StoreHold {
  readonly file: string;
  /** The hold this one replaced, when its process had gone without letting go (a `kill -9`, a crash). */
  readonly tookOverFrom?: StoreHolder;
  /** Says where the holder now answers, once its server listens. */
  serving(url: string): void;
  release(): void;
}

/** The file that says who holds a store: inside a data folder, or beside a SQLite file. */
export function holdFileOf(where: string, kind: "folder" | "file"): string {
  return kind === "folder" ? join(where, "graview.lock") : `${where}.graview.lock`;
}

const alive = (pid: number): boolean => {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it exists, and it is somebody else's.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Who holds the store whose hold file is `file` right now, or null: a hold whose process is gone is nobody's. */
export function heldBy(file: string): StoreHolder | null {
  if (!existsSync(file)) return null;
  let holder: StoreHolder;
  try {
    holder = JSON.parse(readFileSync(file, "utf8")) as StoreHolder;
  } catch {
    return null;
  }
  return typeof holder.pid === "number" && alive(holder.pid) ? holder : null;
}

const portOf = (url: string): string => {
  try {
    return `:${new URL(url).port}`;
  } catch {
    return url;
  }
};

/**
 * The refusal, as a sentence a person can act on: who holds the store,
 * why writing beside it would lose something, and what to do instead.
 */
export function sayHeld(holder: StoreHolder, where: string, wanted: string, options: { readonly remote?: boolean } = {}): string {
  const who = `a ${holder.command}${holder.url ? ` on ${portOf(holder.url)}` : ""} (pid ${holder.pid}, since ${holder.since})`;
  const server = holder.command === "preview" || holder.command === "serve";
  const through = options.remote && holder.url ? ` Or act through it instead: add --remote-url ${holder.url} in place of --data or --sqlite.` : "";
  return (
    `${who} holds ${where}. ${wanted} would not reach the pages it has open, and its next write could put the old records back, so nothing was written.\n` +
    `  Stop the ${holder.command} (Ctrl-C in its shell) and run this again${server ? `, then start the ${holder.command} once more` : ""}.${through}\n`
  );
}

/** The sentence a writer says when it took over a hold whose process had gone. */
export function sayTookOver(holder: StoreHolder, where: string): string {
  return `took over ${where} from a ${holder.command ?? "process"} (pid ${holder.pid}, since ${holder.since ?? "a time it did not say"}), which is no longer running.\n`;
}

/**
 * Takes the store whose hold file is `file` for this process, or says who
 * has it.
 *
 * The file is created exclusively, so two writers starting at once cannot
 * both believe they won; a stale hold is replaced. Released on `release()`
 * and, failing that, when the process exits.
 */
export function holdStore(file: string, command: string): StoreHold | { readonly heldBy: StoreHolder } {
  mkdirSync(dirname(file), { recursive: true });
  const mine: StoreHolder = { command, pid: process.pid, since: new Date().toISOString() };
  const write = (holder: StoreHolder, flag: "wx" | "w") => writeFileSync(file, `${JSON.stringify(holder, null, 2)}\n`, { flag });
  let stale: StoreHolder | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      write(mine, "wx");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const holder = heldBy(file);
      if (holder) return { heldBy: holder };
      if (attempt > 0) throw error;
      // Stale: whoever wrote it is gone. Take it over and try once more.
      try {
        stale = JSON.parse(readFileSync(file, "utf8")) as StoreHolder;
      } catch {
        /* unreadable: nobody's, and nothing to name */
      }
      try {
        unlinkSync(file);
      } catch {
        /* someone else took it over first; the second attempt says who */
      }
    }
  }
  let held = true;
  let current = mine;
  const release = () => {
    if (!held) return;
    held = false;
    process.off("exit", release);
    try {
      const there = JSON.parse(readFileSync(file, "utf8")) as StoreHolder;
      if (there.pid === process.pid) unlinkSync(file);
    } catch {
      /* already gone */
    }
  };
  process.on("exit", release);
  return {
    file,
    ...(stale && typeof stale.pid === "number" ? { tookOverFrom: stale } : {}),
    serving(url) {
      if (!held) return;
      current = { ...current, url };
      write(current, "w");
    },
    release,
  };
}
