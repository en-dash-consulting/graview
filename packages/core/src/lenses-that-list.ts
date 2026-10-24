import type { ShippedLensName } from "./places.js";

/*
 * Apart from `./places.ts`, which a page draws its bar with: only the
 * checker, the document's edit and `describe` ask which lenses list
 * records, and a page's first chunk carries none of it.
 */

/**
 * THE SHIPPED LENSES THAT LIST RECORDS, and so offer "Export CSV" (Roadmap
 * f-view-export-csv): each arranges a kind's records before it draws them.
 * A plan draws outlines, the reach draws the policy and a blocks place its
 * own words, so none of them has a list to write.
 */
export const LENSES_THAT_LIST: readonly ShippedLensName[] = ["timeline", "calendar", "coverage", "board", "columns"];

/** Whether a lens lists records: one of `LENSES_THAT_LIST`. */
export const listsRecords = (name: string): boolean => (LENSES_THAT_LIST as readonly string[]).includes(name);
