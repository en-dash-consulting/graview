import { FORMATS } from "./formats.js";
import { FRAMEWORK_VERSION } from "./version.js";

/**
 * THE WIRE PROTOCOL this build speaks (`WIRE` in @graview/ship, and the
 * live protocol beside it once there is one). Additive within a major: a
 * route or a field may be added, none removed or changed in meaning
 * (docs/stability.md). It moves only when a client of the previous one
 * could no longer be served.
 */
export const WIRE_PROTOCOL = 1;

/**
 * THE SEAMS THIS VERSION SHIPS, by the ids Graview Cloud filed them under
 * (the "Hosted for strangers" epic). A host detects a seam here instead of
 * guessing from a version number, and retires its own interim for it. Each
 * id is named in the changeset that shipped it; `capabilities.test.ts`
 * holds the two lists to each other.
 */
const SHIPPED = ["FR-01", "FR-06", "FR-07", "FR-09", "FR-11", "FR-15", "FR-17", "FR-20", "FR-21", "FR-22", "FR-26", "FR-27", "FR-28", "FR-29", "FR-30", "FR-31", "FR-32", "FR-34"] as const;

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
