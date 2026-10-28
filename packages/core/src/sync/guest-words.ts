import { capitalize } from "../capital.js";

/*
 * WHAT A PASS SENT OUT, IN WORDS (Roadmap f-sync-guest-changes-in-history):
 * the sentences of the history line a connection appends after a write
 * with guests — one record's ("Invited Ada to Long run; took bo@example.com
 * off it"), a pass's when it touched several ("Invited 2 people to 3
 * events"), and a write that did not go ("Did not invite Ada to Dinner:
 * …"). Each guest is said by the name of the person holding the address
 * when the app has one, else by the address.
 */

/** "Ada", "Ada and Ben", "Ada, Ben and Cat"; four or more are counted. */
export function namesSaid(names: readonly string[]): string {
  if (names.length > 3) return `${names.length} people`;
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** One record's line: who it invited and who it took off. */
export function recordSaid(invited: readonly string[], removed: readonly string[], record: string): string {
  const parts: string[] = [];
  if (invited.length > 0) parts.push(`invited ${namesSaid(invited)} to ${record}`);
  if (removed.length > 0) parts.push(`took ${namesSaid(removed)} off ${parts.length > 0 ? "it" : record}`);
  return capitalize(parts.join("; "));
}

/** A write with guests that did not go, and why. */
export function refusedSaid(invited: readonly string[], removed: readonly string[], record: string, error: string): string {
  const what = invited.length > 0 ? `invite ${namesSaid(invited)} to ${record}` : `take ${namesSaid(removed)} off ${record}`;
  return `Did not ${what}: ${error}`;
}

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** A pass's line over several records: "Invited 2 people to 3 events; took 1 person off 1 event". */
export function passSaid(invited: number, invitedTo: number, removed: number, removedFrom: number, noun: string, plural: string): string {
  const parts: string[] = [];
  if (invited > 0) parts.push(`invited ${counted(invited, "person", "people")} to ${counted(invitedTo, noun, plural)}`);
  if (removed > 0) parts.push(`took ${counted(removed, "person", "people")} off ${counted(removedFrom, noun, plural)}`);
  return capitalize(parts.join("; "));
}
