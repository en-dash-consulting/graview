import type { CSSProperties, ReactNode } from "react";
import { headingLevel, markdownBlocks, type MarkdownBlock, type MarkdownInline } from "@graview/core/markdown";

/*
 * PROSE WRITTEN IN MARKDOWN, DRAWN (FR-180): fetched the first time a record
 * draws a text field its declaration says is Markdown — a page's first load
 * carries none of it.
 *
 * `@graview/core/markdown` reads the text into blocks and runs of words;
 * this draws each as the element it is. Every word is a text node React
 * writes, a link's address is one of the web's or mail's (anything else is
 * its words), a picture is its words, and no HTML passes through: whatever
 * a value holds, it never becomes markup, a script or a handler.
 *
 * Headings are demoted under the page's own (a Markdown "#" is drawn one
 * level below the section it is in); a long line of code or a wide table
 * scrolls in its own box, never the page.
 */

const BODY: CSSProperties = { display: "grid", gap: "0.7em", minWidth: 0, overflowWrap: "anywhere" };
const BLOCK: CSSProperties = { margin: 0 };
// A list says its marks whatever a page's own reset says of lists.
const LIST: CSSProperties = { margin: 0, paddingInlineStart: "1.6em", display: "grid", gap: "0.3em" };
const ITEM_BLOCKS: CSSProperties = { display: "grid", gap: "0.3em", minWidth: 0 };
const HEADING: CSSProperties = { margin: "0.4em 0 0", fontSize: "1em", fontWeight: 650, lineHeight: 1.35, color: "var(--graview-ink)" };
const CODE: CSSProperties = { fontSize: "0.9em", background: "var(--graview-panel-muted)", borderRadius: 4, padding: "0.1em 0.3em" };
const PRE: CSSProperties = { margin: 0, padding: "0.7em 0.9em", overflowX: "auto", maxWidth: "100%", background: "var(--graview-panel-muted)", borderRadius: "var(--graview-radius-sm, 8px)", fontSize: "0.875em", lineHeight: 1.5, whiteSpace: "pre", overflowWrap: "normal" };
const QUOTE: CSSProperties = { margin: 0, paddingInlineStart: "0.9em", borderInlineStart: "3px solid var(--graview-edge)", color: "var(--graview-ink-muted)", display: "grid", gap: "0.6em" };
const RULE: CSSProperties = { border: 0, borderTop: "1px solid var(--graview-edge)", margin: "0.3em 0", width: "100%" };
const TABLE_BOX: CSSProperties = { overflowX: "auto", maxWidth: "100%" };
const TABLE: CSSProperties = { borderCollapse: "collapse", fontSize: "0.9375em", minWidth: "50%" };
const CELL: CSSProperties = { padding: "0.35em 0.7em", borderBottom: "1px solid var(--graview-edge)", textAlign: "start", verticalAlign: "top", overflowWrap: "normal" };
// A link in prose is a target a finger can take: its padding grows the box it is pressed in, not the line it stands in.
const LINK: CSSProperties = { color: "var(--graview-accent)", paddingBlock: "0.2em" };

function inline(parts: readonly MarkdownInline[], target: "_blank" | "_self"): ReactNode[] {
  return parts.map((part, at) => {
    switch (part.t) {
      case "text":
        return part.text;
      case "br":
        return <br key={at} />;
      case "code":
        return (
          <code key={at} style={CODE}>
            {part.text}
          </code>
        );
      case "strong":
        return <strong key={at}>{inline(part.children, target)}</strong>;
      case "em":
        return <em key={at}>{inline(part.children, target)}</em>;
      case "del":
        return <del key={at}>{inline(part.children, target)}</del>;
      case "link": {
        const blank = target === "_blank" && !/^mailto:/i.test(part.href);
        return (
          <a key={at} href={part.href} rel="noopener noreferrer nofollow" {...(blank ? { target: "_blank" } : {})} style={LINK} onClick={(event) => event.stopPropagation()}>
            {inline(part.children, target)}
          </a>
        );
      }
    }
  });
}

function blocks(list: readonly MarkdownBlock[], from: number, target: "_blank" | "_self"): ReactNode[] {
  return list.map((block, at) => {
    switch (block.t) {
      case "heading": {
        const Tag = `h${headingLevel(block.level, from)}` as "h3";
        return (
          <Tag key={at} style={HEADING}>
            {inline(block.children, target)}
          </Tag>
        );
      }
      case "p":
        return (
          <p key={at} style={BLOCK}>
            {inline(block.children, target)}
          </p>
        );
      case "list": {
        const items = block.items.map((item, index) => {
          // A task's box stands in for the bullet.
          const first = item[0]?.t === "p" ? item[0].children[0] : undefined;
          const task = first?.t === "text" && /^[☐☑] /.test(first.text);
          return (
            <li key={index} style={{ display: "list-item", minWidth: 0, ...(task ? { listStyle: "none" } : {}) }}>
              {item.length === 1 && item[0]!.t === "p" ? inline(item[0]!.children, target) : <div style={ITEM_BLOCKS}>{blocks(item, from, target)}</div>}
            </li>
          );
        });
        return block.ordered ? (
          <ol key={at} start={block.start} style={{ ...LIST, listStyle: "decimal" }}>
            {items}
          </ol>
        ) : (
          <ul key={at} style={{ ...LIST, listStyle: "disc" }}>
            {items}
          </ul>
        );
      }
      case "quote":
        return (
          <blockquote key={at} style={QUOTE}>
            {blocks(block.blocks, from, target)}
          </blockquote>
        );
      case "code":
        return (
          <pre key={at} style={PRE} tabIndex={0}>
            <code>{block.text}</code>
          </pre>
        );
      case "rule":
        return <hr key={at} style={RULE} />;
      case "table":
        return (
          <div key={at} style={TABLE_BOX} data-graview-md-table="">
            <table style={TABLE}>
              <thead>
                <tr>
                  {block.head.map((cell, index) => (
                    <th key={index} style={{ ...CELL, fontWeight: 600, ...(block.align[index] ? { textAlign: block.align[index] } : {}) }}>
                      {inline(cell, target)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, column) => (
                      <td key={column} style={{ ...CELL, ...(block.align[column] ? { textAlign: block.align[column] } : {}) }}>
                        {inline(cell, target)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

/** A Markdown text drawn as prose: headings from `headingsFrom` (3), links opening in `target` (a new tab). */
export default function MarkdownBody({
  text,
  className,
  style,
  headingsFrom = 3,
  target = "_blank",
}: {
  readonly text: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly headingsFrom?: number;
  readonly target?: "_blank" | "_self";
}) {
  return (
    <div data-graview-text-body="" data-graview-markdown="" {...(className ? { className } : {})} style={{ ...BODY, ...style }}>
      {blocks(markdownBlocks(text), headingsFrom, target)}
    </div>
  );
}
