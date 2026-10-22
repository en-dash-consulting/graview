import type { DescribedItem, DescribedPart, DescribedProblem } from "@graview/core/describe";
import type { GuestNode, GuestProps } from "../protocol.js";
import { placeNamed, placesSaid, type NamedPlace } from "../host/links-words.js";
import { notPressable } from "../host/pressable.js";
import { TreeElement, type TreeNode, TreeText } from "./tree.js";

/*
 * WHAT A VIEW DREW, SAID IN THE WORDS A PLACE IS DESCRIBED IN (FR-95, FR-89).
 *
 * A headless run leaves a tree of what the open kit drew (tree.ts). This
 * reads it back as `describePlace` says a place: headings, text, figures,
 * fields, and lists with each record's title and what its row or card says
 * — so a chat that wrote a view is told what a person will see in the same
 * shape it is told what a declared lens shows, and can compare the two.
 *
 * It reads what the view drew, never what it computed: an `<h2>` is a
 * heading, a run of siblings each bound to a record (`data-record`, a
 * `data-key` that is a record's id, or one record link inside) is a list of
 * those records, a `<dl>` is fields, a `<figure>` a figure, a `<meter>` or
 * `<progress>` a progress, an `<svg>` its label. Nothing is laid out, so a
 * card list is one column: the width a view is drawn at is its stylesheet's
 * business, which no tree can say.
 */

export interface DescribeDrawingContext {
  /** What the view was shown: a record a link or a row names is looked up here, and only here. */
  readonly props: GuestProps;
  /** The app's places, by slug and title: where a `data-place` may point. */
  readonly places: readonly NamedPlace[];
  /** The fields files dropped on the view go in, as its manifest says them (FR-193): what a `data-drop` may name. */
  readonly accepts?: readonly { readonly kind: string; readonly field: string }[];
}

export interface DescribedDrawing {
  readonly parts: readonly DescribedPart[];
  readonly problems: readonly DescribedProblem[];
  /** The acts the drawing binds a press to (`data-act`), each once. */
  readonly acts: readonly string[];
  /** The records it binds or links to (`data-record`), each once. */
  readonly records: readonly string[];
}

const HEADINGS: Readonly<Record<string, number>> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
/** What flows inside a line of text, rather than standing as a block of its own. */
const INLINE = new Set(["a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del", "dfn", "em", "i", "ins", "kbd", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr", "label"]);
const SKIPPED = new Set(["style", "template", "datalist", "option"]);

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * A video's length as a person reads it, as `@graview/core`'s `videoWords`
 * says it ("a 45-second video"): written here because this module goes into
 * the headless runtime, which carries nothing of the framework, and held to
 * core's by `a-view-places-a-records-video`.
 */
export function videoWords(file: { readonly duration?: number }): string {
  const seconds = file.duration === undefined ? 0 : Math.round(file.duration);
  if (seconds < 1) return "a video";
  if (seconds < 60) return `a ${seconds}-second video`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `a ${minutes}-minute video`;
  const hours = Math.floor(minutes / 60);
  return `a ${hours}-hour${minutes % 60 > 0 ? ` ${minutes % 60}-minute` : ""} video`;
}
const isElement = (node: TreeNode): node is TreeElement => node instanceof TreeElement;
const hidden = (element: TreeElement) => element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true";

/** The text a person reads in a node: hidden parts, stylesheets and options left out. */
function textOf(node: TreeNode): string {
  if (node instanceof TreeText) return node.data;
  if (!isElement(node)) return "";
  if (hidden(node) || SKIPPED.has(node.localName)) return "";
  if (node.localName === "br") return " ";
  if (node.localName === "img") return node.getAttribute("alt") ?? "";
  return node.childNodes.map(textOf).join(node.localName === "td" || node.localName === "th" ? " " : "");
}

/** Every element under one, in order. */
function* elementsUnder(element: TreeElement): Generator<TreeElement> {
  for (const child of element.childNodes) {
    if (!isElement(child)) continue;
    yield child;
    yield* elementsUnder(child);
  }
}

/** The words a field saved as it is typed asks for (FR-191, host/press.ts), said wrongly: what the host would never save, and why. */
function saveProblems(element: TreeElement): DescribedProblem[] {
  const save = element.getAttribute("data-save");
  const debounce = element.getAttribute("data-debounce");
  if (save === null && debounce === null) return [];
  const at = `drawing <${element.localName}${save !== null ? ` data-save="${save}"` : ` data-debounce="${debounce}"`}>`;
  const problems: DescribedProblem[] = [];
  if (save === null) return [{ at, says: 'data-debounce is read only on a field that saves as it is typed (data-save="input").' }];
  if (!["input", "textarea", "select"].includes(element.localName)) problems.push({ at, says: "Only a field saves as it is typed: an input, a textarea or a select. A button is pressed (data-act alone)." });
  else if (save !== "input" && save !== "change") problems.push({ at, says: `data-save is "input" (saved as the person types, once they pause, and when they leave it) or "change" (saved when they leave it or pick), not "${save}".` });
  else if (element.getAttribute("data-act") === null) problems.push({ at, says: 'It saves through no act: a field saved as it is typed names its act itself, data-act="…", one in the manifest.' });
  else if (!element.getAttribute("name")) problems.push({ at, says: "It has no name: the host sends a field as the act's argument its name says." });
  else {
    let scoped = false;
    let bound = false;
    for (let up: TreeElement | null = element; up; up = up.parentElement) {
      if (up.getAttribute("data-record") !== null) bound = true;
      if (up !== element && (up.localName === "fieldset" || up.getAttribute("role") === "group")) scoped = true;
    }
    if (!scoped || !bound) problems.push({ at, says: 'It is in no fieldset bound to a record: the host saves a field inside <fieldset data-record="…">, with the fields beside it, to the record the fieldset names.' });
  }
  if (debounce !== null && save !== "input") problems.push({ at, says: 'data-debounce is read only with data-save="input": a "change" saves at once.' });
  else if (debounce !== null && !(debounce.trim() !== "" && Number.isFinite(Number(debounce)) && Number(debounce) >= 250 && Number(debounce) <= 10_000)) problems.push({ at, says: `data-debounce is how long the host waits for the person to pause, in milliseconds from 250 to 10 000, not "${debounce}"; left out, it waits 1 000.` });
  return problems;
}

/** What a drop target the view drew needs (FR-193): a kind and field its manifest accepts, and a record it was shown to link to. */
function dropProblems(element: TreeElement, context: DescribeDrawingContext, shown: ReadonlyMap<string, GuestNode>): DescribedProblem[] {
  const kind = element.getAttribute("data-drop");
  if (kind === null) return [];
  const at = `drawing <${element.localName} data-drop="${kind}">`;
  const problems: DescribedProblem[] = [];
  const accepted = (context.accepts ?? []).filter((one) => one.kind === kind);
  const field = element.getAttribute("data-drop-field");
  if (accepted.length === 0) problems.push({ at, says: `The view's accepts names no field of "${kind}", so the host offers no drop target here: say the field files go in, accepts: [{ "kind": "${kind}", "field": "<its image, video or file field>" }].` });
  else if (field !== null && !accepted.some((one) => one.field === field)) problems.push({ at, says: `data-drop-field names "${field}", which the view's accepts does not name for "${kind}" (${accepted.map((one) => `"${one.field}"`).join(", ")}): the host offers no drop target here.` });
  const connect = element.getAttribute("data-drop-connect");
  if (connect !== null) {
    const colon = connect.indexOf(":");
    const record = colon > 0 ? connect.slice(colon + 1) : "";
    if (colon <= 0 || record === "" || shown.has(connect)) problems.push({ at, says: `data-drop-connect is "<relation>:<record id>" — "takenOn:day:saturday" — not "${connect}"${shown.has(connect) ? ", which names a record and no relation" : ""}.` });
    else if (!shown.has(record)) problems.push({ at, says: `data-drop-connect names "${record}", which this seat was not shown: the host offers no drop target here.` });
  }
  return problems;
}

export function describeDrawing(root: TreeElement, context: DescribeDrawingContext): DescribedDrawing {
  const problems: DescribedProblem[] = [];
  const acts = new Set<string>();
  const records = new Set<string>();
  const shown = new Map<string, GuestNode>();
  for (const node of [...(context.props.node ? [context.props.node] : []), ...(context.props.nodes ?? [])]) shown.set(node.id, node);
  const known = (name: string) => placeNamed(context.places, name) !== undefined;

  /* What the drawing binds, wherever it is: acts, records and places, and anything it names that is not there. */
  for (const element of elementsUnder(root)) {
    const act = element.getAttribute("data-act");
    if (act !== null) acts.add(act);
    /* An element the host can never press, whatever it is bound to (pressable.ts): an option, a label, a field to type into that does not save. A field that meant to save (data-debounce) is said by saveProblems. */
    const unpressed = act !== null && element.getAttribute("data-debounce") === null ? notPressable(element) : undefined;
    if (unpressed) problems.push({ at: `drawing <${element.localName} data-act="${act}">`, says: unpressed });
    const record = element.getAttribute("data-record");
    if (record !== null) {
      records.add(record);
      /* A record first, then a place by that slug, as the host follows it. */
      if (!shown.has(record) && !known(record)) problems.push({ at: `drawing <${element.localName} data-record="${record}">`, says: `It names "${record}", which this seat was not shown and is no place of this app: the host will not follow it. A view goes to a record by its id, or to a place by its slug.${placesSaid(context.places)}` });
    }
    const place = element.getAttribute("data-place");
    if (place !== null && !known(place)) problems.push({ at: `drawing <${element.localName} data-place="${place}">`, says: `It names the place "${place}", which this app does not have.${placesSaid(context.places)}` });
    problems.push(...saveProblems(element));
    problems.push(...dropProblems(element, context, shown));
  }

  /** The record an element stands for: its own `data-record`, a `data-key` that is a shown record's id, or the one record linked inside it. */
  const recordOf = (element: TreeElement): string | undefined => {
    /* A placed video names the record its file is on: a picture of it, not a row (0.1.37). */
    if (element.localName === "graview-video") return undefined;
    const own = element.getAttribute("data-record");
    if (own !== null) return own;
    const key = element.getAttribute("data-key") ?? element.getAttribute("id");
    if (key !== null && shown.has(key)) return key;
    const linked = new Set<string>();
    for (const inner of elementsUnder(element)) {
      const id = inner.getAttribute("data-record");
      if (id !== null && inner.localName !== "graview-video") linked.add(id);
    }
    return linked.size === 1 ? [...linked][0] : undefined;
  };

  /** A record as its row or card says it: its title (a heading, its link, its strong words, or its first line) and the rest. */
  const item = (element: TreeElement, id: string): DescribedItem => {
    const node = shown.get(id);
    const kind = node?.kind ?? (id.includes(":") ? id.slice(0, id.indexOf(":")) : "");
    const candidates = [...elementsUnder(element)];
    const titled =
      candidates.find((one) => one.localName in HEADINGS) ??
      candidates.find((one) => one.localName === "a" && one.getAttribute("data-record") === id) ??
      candidates.find((one) => one.localName === "strong" || one.localName === "b");
    const title = squash(titled ? textOf(titled) : "") || node?.label || id;
    const parts = blocks(element, titled);
    /* With no element of its own for the title, its first line was the title. */
    if (!titled && parts[0]?.t === "text" && squash(parts[0].text) === title) parts.shift();
    return { id, kind, title, parts };
  };

  /** One table's body rows as items: the first cell their title, the rest their fields under the head's labels. */
  const table = (element: TreeElement): DescribedPart => {
    const rows = [...elementsUnder(element)].filter((one) => one.localName === "tr" && !hidden(one));
    const head = rows.find((row) => row.parentElement?.localName === "thead" || row.childNodes.every((cell) => !isElement(cell) || cell.localName === "th"));
    const labels = head ? head.childNodes.filter(isElement).map((cell) => squash(textOf(cell))) : [];
    const items = rows
      .filter((row) => row !== head)
      .map((row): DescribedItem => {
        const cells = row.childNodes.filter(isElement);
        const id = recordOf(row);
        const node = id ? shown.get(id) : undefined;
        return {
          id: id ?? "",
          kind: node?.kind ?? "",
          title: squash(textOf(cells[0] ?? row)),
          parts: cells.slice(1).map((cell, index) => ({ t: "field", label: labels[index + 1] ?? "", text: squash(textOf(cell)) })),
        };
      });
    return { t: "list", as: "row", columns: 1, groups: [{ items }] };
  };

  /** The parts a block element's children make, `skip` left out (an item's title). */
  function blocks(element: TreeElement, skip?: TreeElement): DescribedPart[] {
    const out: DescribedPart[] = [];
    let line = "";
    const flush = () => {
      const text = squash(line);
      line = "";
      if (text) out.push({ t: "text", text });
    };
    const children = element.childNodes;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]!;
      if (child === skip) continue;
      if (child instanceof TreeText) {
        line += child.data;
        continue;
      }
      if (!isElement(child) || hidden(child) || SKIPPED.has(child.localName)) continue;
      if (skip && [...elementsUnder(child)].includes(skip)) {
        /* The title is somewhere inside: say the rest of this child, inline or not. */
        flush();
        out.push(...blocks(child, skip));
        continue;
      }
      /* A run of siblings each standing for a record is a list of those records. */
      const run: { element: TreeElement; id: string }[] = [];
      for (let at = index; at < children.length; at += 1) {
        const one = children[at]!;
        if (one instanceof TreeText && squash(one.data) === "") continue;
        if (!isElement(one) || hidden(one) || INLINE.has(one.localName) || one.localName in HEADINGS) break;
        const id = recordOf(one);
        if (!id) break;
        run.push({ element: one, id });
        index = at;
      }
      if (run.length > 0) {
        flush();
        const rows = run.every((one) => one.element.localName === "li" || one.element.localName === "tr");
        out.push({ t: "list", as: rows ? "row" : "card", columns: 1, groups: [{ items: run.map((one) => item(one.element, one.id)) }] });
        continue;
      }
      out.push(...one(child, (text) => (line += text), flush));
    }
    flush();
    return out;
  }

  /** One element's parts; inline ones add to the line being read. */
  function one(element: TreeElement, inline: (text: string) => void, flush: () => void): DescribedPart[] {
    const name = element.localName;
    if (INLINE.has(name) && name !== "label") {
      inline(textOf(element));
      return [];
    }
    if (name === "mark") {
      flush();
      const text = squash(textOf(element));
      return text ? [{ t: "badge", text }] : [];
    }
    flush();
    const level = HEADINGS[name] ?? (element.getAttribute("role") === "heading" ? Number(element.getAttribute("aria-level") ?? 2) : undefined);
    if (level !== undefined) {
      const text = squash(textOf(element));
      return text ? [{ t: "heading", level, text }] : [];
    }
    switch (name) {
      case "ul":
      case "ol":
      case "menu": {
        const items = element.childNodes.filter((child): child is TreeElement => isElement(child) && child.localName === "li" && !hidden(child));
        return [{ t: "list", as: "row", columns: 1, groups: [{ items: items.map((li) => {
          const id = recordOf(li);
          if (id) return item(li, id);
          const parts = blocks(li);
          const first = parts[0];
          const title = first && (first.t === "text" || first.t === "heading") ? first.text : "";
          return { id: "", kind: "", title, parts: title ? parts.slice(1) : parts };
        }) }] }];
      }
      case "table":
        return [table(element)];
      case "dl": {
        const parts: DescribedPart[] = [];
        let label = "";
        for (const child of element.childNodes.filter(isElement)) {
          if (child.localName === "dt") label = squash(textOf(child));
          else if (child.localName === "dd") parts.push({ t: "field", label, text: squash(textOf(child)) });
          else if (child.localName === "div") for (const inner of child.childNodes.filter(isElement)) {
            if (inner.localName === "dt") label = squash(textOf(inner));
            else if (inner.localName === "dd") parts.push({ t: "field", label, text: squash(textOf(inner)) });
          }
        }
        return parts;
      }
      case "figure": {
        const caption = element.childNodes.find((child): child is TreeElement => isElement(child) && child.localName === "figcaption");
        const text = squash(element.childNodes.filter((child) => child !== caption).map(textOf).join(" "));
        const label = caption ? squash(textOf(caption)) : "";
        return text ? [{ t: "figure", text, ...(label ? { label } : {}) }] : label ? [{ t: "text", text: label }] : [];
      }
      case "meter":
      case "progress": {
        const value = Number(element.getAttribute("value") ?? 0);
        const max = Number(element.getAttribute("max") ?? 1) || 1;
        const label = element.getAttribute("aria-label") ?? element.getAttribute("title") ?? "";
        return [{ t: "progress", label, text: `${Math.round((value / max) * 100)}%` }];
      }
      case "svg": {
        const title = element.childNodes.find((child): child is TreeElement => isElement(child) && child.localName === "title");
        const label = squash(element.getAttribute("aria-label") ?? (title ? textOf(title) : ""));
        if (label) return [{ t: "text", text: label, tone: "picture" }];
        const words = [...elementsUnder(element)].filter((inner) => inner.localName === "text").map((inner) => squash(textOf(inner))).filter(Boolean);
        return words.length > 0 ? [{ t: "text", text: words.join(" · "), tone: "picture" }] : [];
      }
      case "img": {
        const alt = squash(element.getAttribute("alt") ?? "");
        return alt ? [{ t: "text", text: alt, tone: "picture" }] : [];
      }
      /* A record's video the host plays (0.1.37): said by what it shows and how long it is, from the record the view was shown. */
      case "graview-video": {
        const field = element.getAttribute("data-field") ?? "";
        const node = shown.get(element.getAttribute("data-record") ?? "") as Record<string, unknown> | undefined;
        const held = node && field && Object.hasOwn(node, field) ? node[field] : undefined;
        const file = (Array.isArray(held) ? held : [held])[Number(element.getAttribute("data-index") ?? "0")] as { readonly name?: unknown; readonly type?: unknown; readonly caption?: unknown; readonly duration?: unknown } | undefined;
        if (!file || typeof file.name !== "string" || typeof file.type !== "string" || !file.type.startsWith("video/")) {
          problems.push({ at: `drawing <graview-video data-field="${field}">`, says: `It names no video on a record this seat was shown: the host draws no player there. A <graview-video> names a record the view was shown (data-record) and its video field (data-field).` });
          return [];
        }
        const words = typeof file.caption === "string" && file.caption.trim() ? file.caption.trim() : file.name;
        return [{ t: "text", text: `${words}, ${videoWords(typeof file.duration === "number" ? { duration: file.duration } : {})}`, tone: "picture" }];
      }
      case "button": {
        const text = squash(textOf(element));
        return text ? [{ t: "text", text, tone: "button" }] : [];
      }
      case "input":
      case "textarea":
      case "select": {
        const label = squash(element.getAttribute("aria-label") ?? element.getAttribute("placeholder") ?? element.getAttribute("name") ?? "");
        const value = name === "select" ? squash(textOf(element.childNodes.find((child): child is TreeElement => isElement(child) && child.localName === "option" && child.selected) ?? element)) : element.value;
        return [{ t: "field", label, text: value }];
      }
      case "label":
        return blocks(element);
      default:
        return blocks(element);
    }
  }

  return { parts: blocks(root), problems, acts: [...acts], records: [...records] };
}
