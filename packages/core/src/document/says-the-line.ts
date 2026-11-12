/**
 * WHETHER A HOME'S OWN WORDS ALREADY SAY THE APP'S LINE (Roadmap
 * f-better-bare-app-defaults). The home said the app's description under a
 * headline that said it already. A headline, a title or a line of the
 * home's blocks — inside a group or a `when` as well — that says the whole
 * description, word for word (case, punctuation and spacing aside), says
 * it; a few of its words in another sentence do not. The face and
 * `describePlace` both ask this, of the same blocks, so they never differ.
 */

/** Words compared as a reader compares them: case, punctuation and spacing aside. */
export const wordsOf = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Whether one of these texts says the line whole, on word boundaries. */
export function saysTheLine(texts: readonly string[], line: string): boolean {
  const said = wordsOf(line);
  return said.length > 0 && texts.some((text) => ` ${wordsOf(text)} `.includes(` ${said} `));
}

type Literal = { readonly text?: string };

/** The literal words of a home's headlines, titles and lines, as declared (`views.home`) or compiled (`compileBlocks`), groups and `when`s walked. */
export function homeWords(blocks: readonly unknown[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly unknown[]): void => {
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const block = raw as Record<string, unknown>;
      // Compiled: `t` and its template's parts, the literal ones read.
      if (typeof block["t"] === "string") {
        if (block["t"] === "headline" || block["t"] === "title" || block["t"] === "text") out.push(((block["parts"] as readonly Literal[] | null) ?? []).map((part) => part.text ?? " ").join(""));
        if (Array.isArray(block["blocks"])) walk(block["blocks"] as readonly unknown[]);
        if (Array.isArray(block["show"])) walk(block["show"] as readonly unknown[]);
        continue;
      }
      // Declared: the key is the block's kind, a template's braces left out.
      for (const key of ["headline", "title", "text"] as const) if (typeof block[key] === "string") out.push((block[key] as string).replace(/\{[^}]*\}/g, " "));
      if (Array.isArray(block["group"])) walk(block["group"] as readonly unknown[]);
      if (Array.isArray(block["show"])) walk(block["show"] as readonly unknown[]);
    }
  };
  walk(blocks);
  return out;
}

/** Whether a home's blocks already say the app's line, so it is not said again over them. */
export const homeSaysTheLine = (blocks: readonly unknown[], line: string): boolean => saysTheLine(homeWords(blocks), line);
