import type { FormatName } from "@graview/core";

/**
 * What a store keeps beside its graph: the declaration version it was last
 * migrated to, and — from FR-31 — the framework that wrote it and the
 * formats it wrote in, so a reader can tell a newer shape from its own.
 * A meta written before the stamp has neither, and reads as format 1.
 */
export interface StoredMeta {
  readonly version: number;
  readonly framework?: string;
  readonly formats?: Partial<Record<FormatName, number>>;
  /**
   * What the run that gives profiles' people ids of their own did here
   * (`migrateProfilePeople`): each id it renamed, old to new, and whether
   * it finished. The host's alone, never served to a seat.
   */
  readonly profilePeople?: { readonly renamed: Readonly<Record<string, string>>; readonly done?: true };
}
