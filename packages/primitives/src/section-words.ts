/*
 * WHAT A HIGHLIGHTED AREA COVERS, IN WORDS (Roadmap
 * f-make-this-section-better): the parts of a view a person dragged over or
 * clicked, named as they would name them — "the three day columns", "the
 * heading “Dinner”" — from what each part is (its classes, its element,
 * its words) and how they stand (side by side, one under another).
 */

import type { MenuViewSection } from "@graview/react/provider";

/** The element a view is drawn in (`data-worker-view-place`), from a section of it. */
export function placeOfSection(section: MenuViewSection): Element | undefined {
  const root = section.elements[0]?.getRootNode() as { host?: Element } | undefined;
  return root?.host?.closest("[data-worker-view-place]") ?? root?.host?.parentElement ?? undefined;
}

/** One part, as it is read for its name. */
export interface PartRead {
  readonly tag: string;
  readonly classes: readonly string[];
  readonly text: string;
  readonly box: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
}

const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const counted = (n: number) => NUMBERS[n] ?? String(n);
const words = (text: string) => text.replace(/\s+/g, " ").trim();

/** What an element is called, by what it is: one, and many. */
const NOUNS: Readonly<Record<string, readonly [string, string]>> = {
  li: ["item", "items"],
  a: ["link", "links"],
  button: ["button", "buttons"],
  img: ["picture", "pictures"],
  p: ["paragraph", "paragraphs"],
  ul: ["list", "lists"],
  ol: ["list", "lists"],
  table: ["table", "tables"],
  tr: ["row", "rows"],
  td: ["cell", "cells"],
  th: ["column heading", "column headings"],
  section: ["section", "sections"],
  article: ["card", "cards"],
  nav: ["menu", "menus"],
  form: ["form", "forms"],
  input: ["field", "fields"],
  label: ["label", "labels"],
};
const GENERIC = new Set(["js", "is", "has", "item", "items", "wrap", "inner", "outer", "box", "el", "block", "row", "col", "cell", "card", "pick", "active", "selected"]);

/** The word a class names its parts by: "hf-wk-day" is a day. */
function wordOfClass(name: string): string | undefined {
  const parts = name.split(/[-_]+/).filter((part) => /^[a-z]{3,}$/i.test(part) && !GENERIC.has(part.toLowerCase()));
  return parts.at(-1)?.toLowerCase();
}

/** Whether boxes stand side by side (columns), one under another (rows), or neither. */
function standing(boxes: readonly PartRead["box"][]): "columns" | "rows" | undefined {
  if (boxes.length < 2) return undefined;
  const near = (a: number, b: number) => Math.abs(a - b) <= 6;
  if (boxes.every((box) => near(box.top, boxes[0]!.top))) return "columns";
  if (boxes.every((box) => near(box.left, boxes[0]!.left))) return "rows";
  return undefined;
}

/**
 * THE PARTS, NAMED: one by its words ("the heading “This week”"), several
 * by what they share and how they stand ("the three day columns"), else by
 * what they are ("two links and a picture").
 */
export function nameParts(parts: readonly PartRead[]): string {
  if (parts.length === 0) return "nothing";
  if (parts.length === 1) {
    const [one] = parts;
    const heading = /^h[1-6]$/.test(one!.tag);
    const noun = heading ? "heading" : (NOUNS[one!.tag]?.[0] ?? one!.classes.map(wordOfClass).find(Boolean) ?? "part");
    const said = words(one!.text);
    return said ? `the ${noun} “${said.length > 40 ? `${said.slice(0, 39)}…` : said}”` : `the ${noun}`;
  }
  const shared = parts[0]!.classes.filter((name) => parts.every((part) => part.classes.includes(name)));
  const word = shared.map(wordOfClass).find(Boolean);
  const tags = new Set(parts.map((part) => part.tag));
  const stand = standing(parts.map((part) => part.box));
  if (word) return `the ${counted(parts.length)} ${word} ${stand ?? (tags.size === 1 && NOUNS[parts[0]!.tag] ? NOUNS[parts[0]!.tag]![1] : "blocks")}`;
  if (tags.size === 1) {
    const noun = NOUNS[parts[0]!.tag]?.[1] ?? (/^h[1-6]$/.test(parts[0]!.tag) ? "headings" : (stand ?? "parts"));
    return `the ${counted(parts.length)} ${noun}`;
  }
  // Different things: each kind counted, in the order first met.
  const counts = new Map<string, number>();
  for (const part of parts) {
    const noun = /^h[1-6]$/.test(part.tag) ? "heading" : (NOUNS[part.tag]?.[0] ?? "part");
    counts.set(noun, (counts.get(noun) ?? 0) + 1);
  }
  const listed = [...counts].map(([noun, n]) => (n === 1 ? `a ${noun}` : `${counted(n)} ${NOUNS[Object.keys(NOUNS).find((tag) => NOUNS[tag]![0] === noun) ?? ""]?.[1] ?? `${noun}s`}`));
  return listed.length === 1 ? listed[0]! : `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}`;
}

/** Each part in a line the model is told: what it is, its classes, its first words. */
export function partLines(parts: readonly PartRead[]): string[] {
  return parts.map((part) => `<${part.tag}${part.classes.length ? ` class="${part.classes.join(" ")}"` : ""}> ${words(part.text).slice(0, 60)}`.trim());
}
