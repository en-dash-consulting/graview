import type { Policy } from "@graview/core";

/**
 * Who may do what in the discography.
 *
 * - the LABEL runs the catalogue: everything.
 * - an ARTIST makes songs and releases and says who is on them.
 * - a PRODUCER may only add or take away production credits.
 * - a fan holds no role, and reads.
 */
export const policy: Policy = {
  roles: ["label", "artist", "producer"],
  grants: [
    { roles: ["label"], mutations: "*" },
    {
      roles: ["artist"],
      mutations: ["add-song", "add-album", "release-song", "scrap-song", "put-on", "take-off", "credit", "uncredit", "feature", "unfeature", "tag", "untag", "release-by", "add-theme", "span", "unspan"],
      describe: "An artist makes the songs and the releases.",
    },
    { roles: ["producer"], mutations: ["produce", "unproduce"], kinds: ["song"], describe: "A producer credits production." },
  ],
};
