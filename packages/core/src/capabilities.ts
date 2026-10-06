import { FORMATS } from "./formats.js";
import { FRAMEWORK_VERSION } from "./version.js";

/**
 * THE WIRE PROTOCOL this build speaks (`WIRE` in @graview/ship, and the
 * live socket beside it at `/graview/live`, whose `hello` and `welcome`
 * carry this number). Additive within a major: a route, a message or a
 * field may be added, none removed or changed in meaning
 * (docs/stability.md). It moves only when a client of the previous one
 * could no longer be served — the live socket (FR-05) was an addition,
 * so it stayed 1.
 */
export const WIRE_PROTOCOL = 1;

/**
 * THE SEAMS THIS VERSION SHIPS, by the ids Graview Cloud filed them under
 * (the "Hosted for strangers" epic). A host detects a seam here instead of
 * guessing from a version number, and retires its own interim for it. Each
 * id is named in the changeset that shipped it; `capabilities.test.ts`
 * holds the two lists to each other.
 */
const SHIPPED = ["FR-01", "FR-02", "FR-03", "FR-04", "FR-05", "FR-06", "FR-07", "FR-08", "FR-09", "FR-10", "FR-11", "FR-12", "FR-13", "FR-15", "FR-16", "FR-17", "FR-18", "FR-19", "FR-20", "FR-21", "FR-22", "FR-23", "FR-24", "FR-25", "FR-26", "FR-27", "FR-28", "FR-29", "FR-30", "FR-31", "FR-32", "FR-33", "FR-34", "FR-35", "FR-36", "FR-37", "FR-38", "FR-39", "FR-40", "FR-41", "FR-42", "FR-43", "FR-44", "FR-45", "FR-46", "FR-47", "FR-49", "FR-50", "FR-51", "FR-52", "FR-53", "FR-54", "FR-55", "FR-56", "FR-57", "FR-58", "FR-59", "FR-60", "FR-61", "FR-62", "FR-63", "FR-64", "FR-65", "FR-66", "FR-67", "FR-68", "FR-69", "FR-70", "FR-71", "FR-72", "FR-73", "FR-74", "FR-75", "FR-76", "FR-77", "FR-78", "FR-79", "FR-80", "FR-81", "FR-82", "FR-83", "FR-84", "FR-85", "FR-86", "FR-87", "FR-88", "FR-89", "FR-90", "FR-91", "FR-92", "FR-93", "FR-94", "FR-95", "FR-96", "FR-102"] as const;

/**
 * The declaration-document formats `@graview/core/document` parses, as
 * `<format>@<version>`. Said here rather than imported, so the main entry
 * does not carry the document module; a test holds the two together.
 */
export const DOCUMENT_FORMATS = ["graview-document@1"] as const;

export interface Capabilities {
  /** `FRAMEWORK_VERSION`: every @graview/* package shares it. */
  readonly version: string;
  /** `WIRE_PROTOCOL`. */
  readonly protocol: number;
  /** The declaration-document formats this build parses (FR-01), as `<format>@<version>`. */
  readonly documentFormats: readonly string[];
  /** The stored formats it writes and reads (FR-31). */
  readonly formats: typeof FORMATS;
  /** The FR ids of the seams this version ships. */
  readonly shipped: readonly string[];
}

/** What this build of the framework is and can do, for a host to read rather than guess (FR-30). */
export function capabilities(): Capabilities {
  return { version: FRAMEWORK_VERSION, protocol: WIRE_PROTOCOL, documentFormats: [...DOCUMENT_FORMATS], formats: FORMATS, shipped: [...SHIPPED] };
}
