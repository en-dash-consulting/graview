import { firstSentence } from "./excerpt.js";

/*
 * A LONG TEXT'S START AT A GLANCE (FR-180): what a list, a card, a row, a
 * describe line, a table cell and a seat's line say of a record's prose.
 * The record's page says it whole.
 *
 * What is said is the text's FIRST BLOCK — its first paragraph, heading or
 * list item, its lines run together — and of that the first sentence when
 * the block is too long, else its words up to the most allowed, with an
 * ellipsis wherever words were left out mid-thought. Markdown's syntax is
 * taken out (FR-180): "## Heading **bold**" is said "Heading bold", a link
 * is its words, code its letters. How many LINES that draws in is the
 * surface's to clamp; this decides only WHAT text is shown.
 */

// Each reads one line and is linear in it.
const HEADING = /^ {0,3}#{1,6}(?:[ \t]+|$)/;
const LIST_ITEM = /^[ \t]*(?:[-*+•]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const FENCE = /^ {0,3}(?:`{3,}|~{3,})/;
const QUOTE = /^ {0,3}(?:>[ \t]?)+/;
// Read on a trimmed line, so no two runs of spaces meet.
const TABLE_RULE = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/;
const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

/** One line of Markdown said as words: emphasis, code, links, tags and escapes taken out. */
function inlineWords(line: string): string {
  return line
    .replace(/!?\[([^\]\n]{0,500})\]\([^)\n]{0,500}\)/g, "$1")
    .replace(/<((?:https?:|mailto:)[^>\s]*)>/gi, "$1")
    .replace(/<\/?[A-Za-z][^<>\n]*>/g, "")
    .replace(/`+([^`\n]*)`+/g, "$1")
    .replace(/(\*\*|__|~~)(?=\S)([^\n]{0,500}?\S)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]{0,500}?\S)\*(?![\w*])/g, "$1$2")
    .replace(/(^|\W)_(?=\S)([^_\n]{0,500}?\S)_(?!\w)/g, "$1$2")
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, "$1")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? "");
}

/**
 * The text's blocks — paragraphs, headings and list items — each its lines
 * run together and its syntax taken out, read until `enough` characters are
 * had; and whether any text is left after the last one read.
 */
function blocksOf(text: string, markdown: boolean, enough: number): { readonly blocks: readonly string[]; readonly more: boolean } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let taken: string[] = [];
  let had = 0;
  let fenced = false;
  const close = () => {
    const block = taken.join(" ").replace(/\s+/g, " ").trim();
    if (block) {
      blocks.push(block);
      had += block.length;
    }
    taken = [];
  };
  let next = 0;
  while (next < lines.length && had <= enough) {
    let line = lines[next++]!;
    if (markdown && FENCE.test(line)) {
      fenced = !fenced;
      if (!fenced) close();
      continue;
    }
    if (!fenced && (line.trim().length === 0 || (markdown && (RULE.test(line) || TABLE_RULE.test(line.trim()))))) {
      close();
      continue;
    }
    const heading = !fenced && markdown && HEADING.test(line);
    const item = !fenced && LIST_ITEM.test(line);
    // A heading or a list item is a block of its own: the paragraph before it ends there.
    if (heading || item) close();
    if (markdown && !fenced) {
      line = line.replace(QUOTE, "");
      if (heading) line = line.replace(HEADING, "").replace(/[ \t]+#+[ \t]*$/, "");
      if (item) line = line.replace(LIST_ITEM, "");
      if (line.includes("|")) line = line.replace(/^[ \t]*\||\|[ \t]*$/g, "").split("|").map((cell) => cell.trim()).filter(Boolean).join(" · ");
      // A glance reads no further than it says: a 20,000-character line is not stripped whole for 160 of it.
      line = inlineWords(Number.isFinite(enough) ? line.slice(0, enough * 2 + 200) : line);
    } else if (item) line = line.replace(LIST_ITEM, "");
    taken.push(line);
    if (heading) close();
    // A very long block is read only as far as any excerpt says.
    if (taken.reduce((sum, one) => sum + one.length, 0) > enough) break;
  }
  close();
  return { blocks, more: lines.slice(next).some((line) => line.trim().length > 0 && !(markdown && (FENCE.test(line) || RULE.test(line)))) };
}

/** Cuts words to at most `most` characters, at a word's end, with an ellipsis. */
function cut(flat: string, most: number): string {
  const kept = flat.slice(0, most + 1).replace(/\s+\S*$/, "");
  return `${(kept || flat.slice(0, most)).replace(/[\s,;:.—-]+$/, "")}…`;
}

/**
 * A TEXT'S START, as a list, a card, a row, a describe line, a table cell
 * or a search hit says it (FR-180): its first block — paragraph, heading
 * or item — or about `most` characters (160) of it, the first sentence
 * where that fits; an ellipsis after where words were left out mid-thought;
 * Markdown's syntax taken out when `markdown` says the text is Markdown.
 */
export function excerptOf(text: string, options: { readonly markdown?: boolean | undefined; readonly most?: number | undefined } = {}): string {
  const most = options.most ?? 160;
  const { blocks, more } = blocksOf(text, options.markdown === true, most);
  const first = blocks[0] ?? "";
  if (first.length <= most) return (more || blocks.length > 1) && first.length > 0 && !/[.!?…:]$/.test(first) ? `${first}…` : first;
  const sentence = firstSentence(first);
  return sentence && sentence.length <= most ? sentence : cut(first, most);
}

/** Markdown said as words, whole: every block's words in a line, the syntax taken out — what a search finds by and shows a fragment of. */
export const markdownWords = (text: string): string => blocksOf(text, true, Number.POSITIVE_INFINITY).blocks.join(" ");
