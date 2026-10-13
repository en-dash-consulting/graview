import type { Arrangement, ArrangementWords, Condition, DateBucket, Grouping, Sort } from "./arrangement.js";

/*
 * THE GRAMMAR. One string per part, short enough to read in an address bar
 * and to type by hand:
 *
 *   sort   = <key>[:asc|:desc]                  due:desc      label
 *   filter = <key>:<value>[,<key>:<value>...]   done:false,holds:today,is:past
 *   group  = <key>[:day|:week|:month]           status        due:month     holds
 *
 * A lens carries them as `in.sort`, `in.filter`, `in.group` in the fragment;
 * a page carries them as `?sort=&filter=&group=`. Same words, same parser.
 *
 * A file of its own (FR-179): a page reads an address's arrangement before
 * it draws anything, and what a kind can be arranged by (`arrangeable`, in
 * `./arrangement.ts`) only when a list or the matcher is fetched — a bundler
 * places a whole file in the first chunk when the first chunk reaches it.
 */

const BUCKETS: readonly DateBucket[] = ["day", "week", "month", "year", "decade"];

export function parseArrangement(words: ArrangementWords): Arrangement {
  const out: { sort?: Sort; filter?: Condition[]; group?: Grouping; query?: string } = {};
  if (words.q && words.q.trim().length > 0) out.query = words.q;
  if (words.sort) {
    const [by, direction] = words.sort.split(":");
    if (by) out.sort = { by, direction: direction === "desc" ? "desc" : "asc" };
  }
  if (words.filter) {
    const conditions: Condition[] = [];
    for (const part of words.filter.split(",")) {
      const colon = part.indexOf(":");
      if (colon <= 0) continue;
      conditions.push({ key: part.slice(0, colon), value: part.slice(colon + 1) });
    }
    if (conditions.length > 0) out.filter = conditions;
  }
  if (words.group) {
    const [by, bucket] = words.group.split(":");
    if (by) out.group = { by, ...(BUCKETS.includes(bucket as DateBucket) ? { bucket: bucket as DateBucket } : {}) };
  }
  return out;
}
