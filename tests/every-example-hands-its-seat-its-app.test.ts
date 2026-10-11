import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * EVERY EXAMPLE HANDS ITS PROVIDER ITS APP. A `GraviewProvider` holds the
 * app it draws (`useGraview().app`), and the chat hands it to a seat's
 * turn, so `describe_place` can describe a lens place and the declared
 * home. An app that mounts its own provider without `app` leaves its
 * seat unable to say what any of its lenses is — "is not a place this app
 * has" — while the same app through `mount` or `<Embed>` can. Every
 * example that mounts one passes it.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" || name === "dist" ? [] : sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

/** Every `<GraviewProvider …>` an example's own source opens, with its props. */
const mounts = readdirSync(join(repo, "apps")).flatMap((app) => {
  const src = join(repo, "apps", app, "src");
  try {
    statSync(src);
  } catch {
    return [];
  }
  return sources(src).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/<GraviewProvider\b([^>]*)>/g)].map((match) => ({ file: relative(repo, file), props: match[1]! })));
});

describe("every example's provider", () => {
  it("is found: the desk, the todo, the rota, the garden, the discography and the gauntlet each mount one", () => {
    expect(new Set(mounts.map((one) => one.file.split("/")[1]))).toEqual(new Set(["launcher", "todo", "rota", "seedbed", "discography", "gauntlet"]));
  });

  it("is handed the app it draws, so its seat can describe the app's lenses", () => {
    expect(mounts.filter((one) => !/\bapp=\{/.test(one.props)).map((one) => one.file)).toEqual([]);
  });
});
