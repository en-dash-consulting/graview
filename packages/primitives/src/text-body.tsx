import type { CSSProperties } from "react";

/*
 * PROSE KEEPS ITS SHAPE (FR-146).
 *
 * A `text` field holds what somebody wrote — an email drafted in full, with
 * its paragraphs, a numbered list and a bulleted one, as `\n` and `\n\n` —
 * and every surface drew it as HTML draws a string: the line breaks
 * collapsed, three thousand characters as one block. This reads the light
 * structure plain text already has and draws it as elements:
 *
 *   a blank line           a new paragraph, <p>
 *   a single line break    a line break inside it, <br>
 *   lines "1." "2)" …      a numbered list, <ol start>
 *   lines "-" "*" "•"      a bulleted list, <ul>
 *
 * Nothing else. It is not markdown: no emphasis, no links, no headings, no
 * HTML. Every word is a text node React writes, so a value can never become
 * markup, whatever it holds.
 */

/** One block of prose: a paragraph of lines, or a list of items. */
export type TextBlock =
  | { readonly t: "p"; readonly lines: readonly string[] }
  | { readonly t: "ol"; readonly start: number; readonly items: readonly string[] }
  | { readonly t: "ul"; readonly items: readonly string[] };

const NUMBERED = /^\s*(\d{1,6})[.)]\s+(.*)$/;
const BULLETED = /^\s*[-*•]\s+(.*)$/;

/** The blocks a piece of plain text is written in. */
export function textBlocks(text: string): readonly TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const chunk of text.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n+/)) {
    let run: { t: "p"; lines: string[] } | { t: "ol"; start: number; items: string[] } | { t: "ul"; items: string[] } | null = null;
    const close = () => {
      if (run && (run.t === "p" ? run.lines.length > 0 : run.items.length > 0)) blocks.push(run);
      run = null;
    };
    for (const line of chunk.split("\n")) {
      const numbered = NUMBERED.exec(line);
      const bulleted = numbered ? null : BULLETED.exec(line);
      if (numbered) {
        if (run?.t !== "ol") {
          close();
          run = { t: "ol", start: Number(numbered[1]), items: [] };
        }
        (run as { items: string[] }).items.push(numbered[2]!);
      } else if (bulleted) {
        if (run?.t !== "ul") {
          close();
          run = { t: "ul", items: [] };
        }
        (run as { items: string[] }).items.push(bulleted[1]!);
      } else if (run && run.t !== "p" && /^\s+\S/.test(line)) {
        // An indented line under an item goes on with the item.
        const items = run.items;
        items[items.length - 1] = `${items[items.length - 1]} ${line.trim()}`;
      } else if (line.trim().length > 0) {
        if (run?.t !== "p") {
          close();
          run = { t: "p", lines: [] };
        }
        (run as { lines: string[] }).lines.push(line.trim());
      }
    }
    close();
  }
  return blocks;
}

/** Whether a value has a shape to keep: a line break in it. One line of words is drawn as one line of words. */
export function hasShape(text: string): boolean {
  return /[\r\n]/.test(text);
}

const BODY: CSSProperties = { display: "grid", gap: "0.7em", minWidth: 0, overflowWrap: "anywhere" };
const BLOCK: CSSProperties = { margin: 0 };
const LIST: CSSProperties = { margin: 0, paddingInlineStart: "1.6em", display: "grid", gap: "0.3em" };

/**
 * Plain text drawn with its paragraphs, line breaks and lists kept: <p>,
 * <br>, <ol> and <ul>, every word a text node. `className` and the data
 * attribute let a surface style it as its own.
 */
export function TextBody({ text, className, style }: { readonly text: string; readonly className?: string; readonly style?: CSSProperties }) {
  return (
    <div data-graview-text-body="" {...(className ? { className } : {})} style={{ ...BODY, ...style }}>
      {textBlocks(text).map((block, index) =>
        block.t === "p" ? (
          <p key={index} style={BLOCK}>
            {block.lines.map((line, at) => (
              <span key={at}>
                {at > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        ) : block.t === "ol" ? (
          <ol key={index} start={block.start} style={LIST}>
            {block.items.map((item, at) => (
              <li key={at}>{item}</li>
            ))}
          </ol>
        ) : (
          <ul key={index} style={LIST}>
            {block.items.map((item, at) => (
              <li key={at}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
