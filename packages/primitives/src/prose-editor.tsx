import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { TextBody } from "./text-body.js";

/*
 * THE TEXT AREA PROSE IS CHANGED IN (FR-147), fetched the first time a
 * person opens one: every record draws prose, few are edited, and a page's
 * first load carries the drawing, not the editor.
 *
 * As tall as what it holds (`field-sizing: content`, measured where an
 * engine lacks it). Enter is a new line; Ctrl or ⌘ with Enter saves, as
 * does leaving it; Escape puts it back. Named for the field.
 *
 * Markdown (FR-180) is written as Markdown, and "Preview" shows it as the
 * record will draw it — "Write" goes back to the words, where they were.
 */
export default function ProseEditor({
  field,
  label,
  value,
  markdown,
  onSave,
  onCancel,
}: {
  readonly field: string;
  readonly label: string;
  readonly value: string;
  /** The field is written in Markdown (FR-180): a "Preview" shows it drawn. */
  readonly markdown?: boolean;
  /** `left`: the person moved the keyboard elsewhere, and it stays there. */
  readonly onSave: (draft: string, left: boolean) => void;
  readonly onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [preview, setPreview] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => area.current?.focus(), [preview]);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element || preview || (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content"))) return;
    const fit = () => {
      element.style.height = "auto";
      const style = getComputedStyle(element);
      element.style.height = `${element.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)}px`;
    };
    fit();
    // Again once the page has laid the area out: a text area just put in the page can measure before its width is settled.
    const frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [draft, preview]);
  return (
    <form
      style={{ display: "grid", gap: 8, minWidth: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft, false);
      }}
    >
      {preview ? (
        <div data-graview-preview={field} aria-label={`${label}, as it will read`} role="region" style={PREVIEW}>
          <TextBody text={draft} markdown />
        </div>
      ) : (
        <textarea
          ref={area}
          aria-label={label}
          data-graview-field={field}
          value={draft}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSave(draft, false);
            }
          }}
          onBlur={(event) => {
            // Moving to the form's own buttons is not leaving it.
            if (event.relatedTarget instanceof Node && event.currentTarget.form?.contains(event.relatedTarget)) return;
            onSave(draft, true);
          }}
          style={TEXT_AREA}
        />
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button type="submit" style={BUTTON}>
          Save
        </button>
        <button type="button" onClick={onCancel} style={BUTTON}>
          Cancel
        </button>
        {markdown ? (
          <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)} style={BUTTON}>
            {preview ? "Write" : "Preview"}
          </button>
        ) : null}
        <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>Ctrl or ⌘ Enter saves · Esc puts it back</span>
      </div>
    </form>
  );
}

const PREVIEW: CSSProperties = { minHeight: "7.5em", padding: "8px 10px", border: "1px dashed var(--graview-edge-bright)", borderRadius: 6, lineHeight: 1.6, minWidth: 0 };

const BUTTON: CSSProperties = { font: "inherit", fontSize: "0.8125rem", minHeight: 28, padding: "2px 12px" };

const TEXT_AREA = {
  font: "inherit",
  lineHeight: 1.5,
  width: "100%",
  boxSizing: "border-box",
  minHeight: "7.5em",
  padding: "8px 10px",
  resize: "vertical",
  fieldSizing: "content",
  color: "var(--graview-ink)",
  background: "var(--graview-panel, transparent)",
  border: "1px solid var(--graview-edge-bright)",
  borderRadius: 6,
} as CSSProperties;
