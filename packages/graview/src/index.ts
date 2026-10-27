import { fileURLToPath } from "node:url";
import { main as core, USAGE as CORE_USAGE } from "@graview/core/cli";

/**
 * `graview` — the one command line.
 *
 * The framework is `@graview/*`, the packages an app imports. This package
 * is the tool a person installs: `npx graview create my-app` from nothing,
 * or `graview check` from inside a project that has it as a devDependency.
 * It owns no logic. Every subcommand lives in the package whose concern it
 * is — the generator, the checker and `doctor` in core, `serve`,
 * `sync-seed`, `preview` and `shots` in ship, `mcp`, `apply`, `dream` and `learn` in tools,
 * `skills` in skills, `view` in guest — and this dispatches to it, so a
 * project made with `graview create` and one made by calling core's own
 * CLI are the same project. What it carries is the page `preview` serves,
 * built into `dist/preview/` at the framework's build: the tool's to ship,
 * never a product's runtime dependency's.
 *
 * `serve` and `skills` are imported when asked for, not before: `graview
 * check` should not load an HTTP server, and a bundler that ever sees this
 * file should not be asked to follow better-sqlite3.
 */
export async function main(given: readonly string[]): Promise<number> {
  // `pnpm graview -- create …` hands the separator on; it is the package manager's, not a command.
  const argv = given[0] === "--" ? given.slice(1) : given;
  const [command, ...rest] = argv;
  if (command === "serve") {
    const { serve } = await import("@graview/ship/cli");
    return serve(rest);
  }
  if (command === "preview" || command === "shots") {
    // The page they serve is built into this package (`dist/preview/`, by scripts/build-preview-page.mjs): it is the tool's to carry, not a product's dependency's.
    const { preview, shots } = await import("@graview/ship/cli");
    const page = fileURLToPath(new URL("./preview/", import.meta.url));
    if (command === "shots") return shots(rest, { page });
    // The opening screen's renderer rides beside the page (`@graview/pages/splash`, bundled there), so the tool depends on no face to draw it.
    const { splashHtml } = (await import(new URL("./preview/splash.js", import.meta.url).href)) as { splashHtml: NonNullable<Parameters<typeof preview>[1]["splash"]> };
    return preview(rest, { page, splash: splashHtml });
  }
  if (command === "sync-seed") {
    const { syncSeed } = await import("@graview/ship/cli");
    return syncSeed(rest);
  }
  if (command === "mcp" || command === "apply" || command === "dream" || command === "learn") {
    const { mcp, apply, dream, learn } = await import("@graview/tools/cli");
    return command === "mcp" ? mcp(rest) : command === "apply" ? apply(rest) : command === "dream" ? dream(rest) : learn(rest);
  }
  if (command === "skills") {
    const { skills } = await import("@graview/skills/cli");
    return skills(rest);
  }
  if (command === "view") {
    const { view } = await import("@graview/guest/cli");
    return view(rest);
  }
  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(await usage());
    return 0;
  }
  return core([...argv]);
}

/** Core's usage, then the subcommands the other packages contribute. */
async function usage(): Promise<string> {
  const { SERVE_USAGE } = await import("@graview/ship/cli");
  const { MCP_USAGE, DREAM_USAGE, LEARN_USAGE } = await import("@graview/tools/cli");
  const { SKILLS_USAGE } = await import("@graview/skills/cli");
  const { VIEW_USAGE } = await import("@graview/guest/cli");
  return `${CORE_USAGE}\n${SERVE_USAGE}\n${MCP_USAGE}\n${DREAM_USAGE}\n${LEARN_USAGE}\n${SKILLS_USAGE}\n${VIEW_USAGE}`;
}
