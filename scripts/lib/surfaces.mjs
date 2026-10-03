/**
 * THE FIVE SURFACES A HOST HOLDS THE FRAMEWORK TO (FR-30, docs/stability.md).
 *
 * A host running thousands of stored apps on one build needs to know, per
 * version, whether stored data folds the same, whether a declaration that
 * compiled still compiles, and whether derived tool schemas moved. A change
 * to a file on one of these surfaces asks every changeset in the pull
 * request for a `Compatibility:` line saying what it does to that surface —
 * "unchanged" is an answer; silence is not.
 */
export const SURFACES = [
  {
    name: "ops and primitives",
    paths: [/^packages\/core\/src\/ops\//, /^packages\/core\/src\/graph\/primitives\.ts$/, /^packages\/core\/src\/graph\/types\.ts$/],
  },
  {
    name: "stored formats",
    paths: [
      /^packages\/core\/src\/formats\.ts$/,
      /^packages\/core\/src\/persistence\//,
      /^packages\/ship\/src\/(open-store|export|meta|snapshot|file-adapter|browser-adapter|migrations)\.ts$/,
    ],
  },
  {
    name: "the wire",
    paths: [/^packages\/ship\/src\/(serve|remote|seat-headers)\.ts$/, /^packages\/core\/src\/presence\.ts$/, /^packages\/core\/src\/capabilities\.ts$/],
  },
  {
    name: "the declaration and check finding codes",
    paths: [/^packages\/core\/src\/cli\/check\//, /^packages\/core\/src\/document\//, /^packages\/core\/src\/validate-graph\.ts$/],
  },
  {
    name: "derived tool names and input schemas",
    paths: [
      /^packages\/tools\/src\/agent\/(tools|adapters)\.ts$/,
      /^packages\/tools\/src\/(mcp-stdio|derive)\.ts$/,
      /^packages\/core\/src\/mutations\/(derive-edits|form|node-ref)\.ts$/,
    ],
  },
];

/** The surfaces a list of changed files touches, by name. */
export function surfacesTouched(files) {
  return SURFACES.filter((surface) => files.some((file) => surface.paths.some((path) => path.test(file)))).map((surface) => surface.name);
}

/** Whether a changeset's text says what it does to compatibility. */
export function saysCompatibility(text) {
  return /^Compatibility:\s*\S/m.test(text.split("---").slice(2).join("---"));
}
