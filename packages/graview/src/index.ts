import { main as core, USAGE as CORE_USAGE } from "@graview/core/cli";

/**
 * `graview` — the one command line.
 *
 * The framework is `@graview/*`, the packages an app imports. This package
 * is the tool a person installs: `npx graview create my-app` from nothing,
 * or `graview check` from inside a project that has it as a devDependency.
 * It owns no logic. Every subcommand lives in the package whose concern it
 * is — the generator and the checker in core, `serve` and `sync-seed` in
 * ship, `mcp` and `apply` in tools, `skills` in skills — and this
 * dispatches to it, so a project made with `graview
 * create` and one made by calling core's own CLI are the same project.
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
  if (command === "sync-seed") {
    const { syncSeed } = await import("@graview/ship/cli");
    return syncSeed(rest);
  }
  if (command === "mcp" || command === "apply") {
    const { mcp, apply } = await import("@graview/tools/cli");
    return command === "mcp" ? mcp(rest) : apply(rest);
  }
  if (command === "skills") {
    const { skills } = await import("@graview/skills/cli");
    return skills(rest);
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
  const { MCP_USAGE } = await import("@graview/tools/cli");
  const { SKILLS_USAGE } = await import("@graview/skills/cli");
  return `${CORE_USAGE}\n${SERVE_USAGE}\n${MCP_USAGE}\n${SKILLS_USAGE}`;
}
