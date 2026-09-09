import { main } from "@graview/core/cli";

/**
 * `npm create graview <dir>` resolves to the `create-graview` bin, by npm's
 * convention. This package is that door and nothing else: the generator and
 * the command live in `@graview/core`, so a project made this way and one
 * made with `graview create` are the same project.
 */
export function createGraview(argv: readonly string[]): Promise<number> {
  return main(["create", ...argv]);
}
