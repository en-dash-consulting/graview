/**
 * AN ACT ASKED FOR IN ANOTHER SPELLING IS THE SAME ACT.
 *
 * A relation's act spells the relation in kebab-case (`partOf` →
 * `connect-threat-part-of`), and a tool name spells an act with
 * underscores; an agent that read the relation's name writes
 * `connect-threat-partOf` and met "no such act". A name that says the same
 * words as exactly one act — case, hyphens and underscores aside — is that
 * act. A name that says none is answered with the nearest act, so a
 * refusal can ask "did you mean …?" rather than only refuse. No imports, so
 * the store, the agent's tools and the server read it alike.
 */

/** A name's words, however it is spelled: `connect-threat-partOf`, `connect_threat_part_of` → `connect-threat-part-of`. */
export const spellingOf = (name: string): string =>
  name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

/** The one act among `acts` a name spells another way, or undefined: an exact name is itself, and a spelling two acts share is neither. */
export function actSpelledAs(name: string, acts: Iterable<string>): string | undefined {
  const words = spellingOf(name);
  const every = [...acts];
  if (every.includes(name)) return name;
  const said = every.filter((act) => spellingOf(act) === words);
  return said.length === 1 ? said[0] : undefined;
}

/** How many single-letter edits turn one into the other. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
}

/**
 * The act a name most nearly says, for "did you mean …?": within a few
 * letters of its words (a third of them at most), the nearest, and none
 * when two are equally near — a guess between two is no help.
 */
export function nearestAct(name: string, acts: Iterable<string>): string | undefined {
  const every = [...acts];
  const spelled = actSpelledAs(name, every);
  if (spelled) return spelled;
  const words = spellingOf(name);
  if (words === "") return undefined;
  let best: { act: string; far: number } | undefined;
  let tied = false;
  for (const act of every) {
    const far = distance(words, spellingOf(act));
    if (far > Math.max(2, Math.floor(Math.max(words.length, act.length) / 3))) continue;
    if (!best || far < best.far) {
      best = { act, far };
      tied = false;
    } else if (far === best.far) tied = true;
  }
  return best && !tied ? best.act : undefined;
}
