import { presenceName, type AnySchema, type Presence } from "@graview/core";
import { useGraview, useNode, type FieldTyping, type LiveTyping } from "@graview/react/provider";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { caretHere, carriedOver, carrySelection, diffText, inputSplice, runToPutBack, runToTakeBack } from "./live-text.js";
import { TextBody } from "./text-body.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * THE LIVE EDITOR (Roadmap f-collab-text, phase 4): a field typed together,
 * edited where a served store can carry it a keystroke at a time. Fetched
 * only once somebody opens such a field, with the typing it sends through.
 *
 * There is no draft and nothing to save: each keystroke is the field's, at
 * once, here and — a run at a time — for everybody else. "Done" closes it,
 * and so does Escape, which puts nothing back: what was typed was already
 * everybody's. Ctrl or ⌘ Z takes back this person's own last run of typing
 * into the field, never somebody else's, though they typed after it.
 *
 * Somebody else's typing lands in the text area as it arrives, and the
 * person's selection is carried over it, so they keep typing on the word
 * they were on. While an input method composes a word nothing is sent, and
 * what others type waits; the word and theirs meet once it is chosen.
 *
 * Everybody else typing here is drawn where their caret stands: a thin line
 * in their hue, their name on it, laid on a copy of the text that wraps as
 * the text area does. Nothing else is drawn.
 */
export default function LiveProseEditor(props: LiveProps & { readonly writtenWhole: ReactNode }) {
  const { store } = useGraview<AnySchema>();
  const { live, nodeId, field } = props;
  /*
   * Whether the declaration types the field together is read once the
   * host's typing has arrived, with `@graview/core/typing`: a field written
   * whole keeps its draft and Save. Until then the text area is read only.
   */
  const [typing, setTyping] = useState<FieldTyping | null>(null);
  useEffect(() => {
    let open = true;
    void live.typing(nodeId, field).then((one) => open && setTyping(one));
    return () => {
      open = false;
    };
    // The host's typing, asked once: `live` is new each time somebody else moves.
  }, [nodeId, field]);
  if (typing && !store.collaborative(nodeId, field)) return <>{props.writtenWhole}</>;
  return <LiveEditor {...props} typing={typing} />;
}

interface LiveProps {
  readonly nodeId: string;
  readonly field: string;
  readonly label: string;
  readonly markdown?: boolean;
  readonly live: LiveTyping;
  /** Closes the editor; `left`: the keyboard went elsewhere, and stays there. */
  readonly onDone: (left: boolean) => void;
}

function LiveEditor({
  nodeId,
  field,
  label,
  markdown,
  live,
  onDone,
  typing,
}: LiveProps & { readonly typing: FieldTyping | null }) {
  const { store, principal } = useGraview<AnySchema>();
  const node = useNode<AnySchema>(nodeId) as Record<string, unknown> | undefined;
  const value = textOf(node?.[field]);
  const [preview, setPreview] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);
  /** The field's text as the text area last showed it: what a keystroke is read against. */
  const shown = useRef(value);
  const composing = useRef(false);
  /** The host's typing as it is now: the same channel, a new object each time who is here changes. */
  const said = useRef(live);
  said.current = live;
  const textNow = () => textOf((store.graph.getNode(nodeId) as Record<string, unknown> | undefined)?.[field]);

  useEffect(() => area.current?.focus(), [preview, typing]);

  /*
   * Says where this person's caret stands, while the text area holds the
   * keyboard: read when it is said, at most every `CARET_MS`, so a run of
   * keystrokes is one word on the wire, not one each.
   */
  const caretSaid = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sayCaret = () => {
    if (caretSaid.current !== undefined) return;
    caretSaid.current = setTimeout(() => {
      caretSaid.current = undefined;
      const element = area.current;
      if (!element || element.ownerDocument.activeElement !== element) return;
      const backward = element.selectionDirection === "backward";
      said.current.sayCaret({ node: nodeId, field, anchor: backward ? element.selectionEnd : element.selectionStart, head: backward ? element.selectionStart : element.selectionEnd, rev: store.log.length });
    }, CARET_MS);
  };
  // Once, as it closes: `live` is new each time somebody else moves, and that is no reason to say the caret has gone.
  useEffect(
    () => () => {
      clearTimeout(caretSaid.current);
      said.current.sayCaret(null);
    },
    [],
  );

  /** The text area shows the field as it stands, the person's selection carried over what changed. */
  const showNow = (now: string) => {
    const element = area.current;
    if (!element) return;
    if (element.value !== now) {
      const selection = carrySelection({ start: element.selectionStart, end: element.selectionEnd }, diffText(element.value, now));
      const direction = element.selectionDirection ?? "none";
      element.value = now;
      element.setSelectionRange(selection.start, selection.end, direction);
    }
    shown.current = now;
  };

  /** A keystroke: what it changed in the text the area showed, carried over whatever landed since, sent. */
  const typed = () => {
    const element = area.current;
    if (!element || !typing || composing.current) return;
    const before = shown.current;
    const now = textNow();
    const mine = inputSplice(before, element.value, element.selectionEnd);
    if (mine.removed === "" && mine.inserted === "") return showNow(now);
    const over = before === now ? mine : carriedOver(mine, diffText(before, now));
    try {
      typing.splice(over.at, over.removed.length, over.inserted);
    } catch {
      // Refused here: the field stands as it was, and so does the area.
    }
    const after = textNow();
    if (element.value !== after) {
      element.value = after;
      const caret = Math.min(after.length, over.at + over.inserted.length);
      element.setSelectionRange(caret, caret);
    }
    shown.current = after;
    sayCaret();
  };

  // Somebody else's typing, an undo, a reload: shown at once — unless a word is being composed, when it waits for the word.
  useLayoutEffect(() => {
    if (!composing.current) showNow(value);
  }, [value]);

  const takeBack = async (again: boolean) => {
    if (!typing) return;
    typing.flush();
    // A run still on its way is taken back once the server has it.
    for (let tries = 0; typing.waiting() > 0 && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 30));
    const batch = again ? runToPutBack(store, principal, nodeId, field) : runToTakeBack(store, principal, nodeId, field);
    if (!batch) return;
    try {
      if (again) store.redo(batch, { author: principal });
      else store.undo(batch, { author: principal });
    } catch {
      // Refused: nothing changed, and nothing is said over the person's typing.
    }
  };

  const done = (left: boolean) => {
    typing?.flush();
    live.sayCaret(null);
    onDone(left);
  };

  const others = [...live.who.values()].filter((one) => one.caret?.node === nodeId && one.caret.field === field);

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }} data-graview-live={field}>
      {preview ? (
        <div data-graview-preview={field} aria-label={`${label}, as it will read`} role="region" style={PREVIEW}>
          <TextBody text={value} markdown />
        </div>
      ) : (
        <div style={{ position: "relative", minWidth: 0 }}>
          <textarea
            ref={area}
            aria-label={label}
            data-graview-field={field}
            defaultValue={value}
            readOnly={!typing}
            rows={3}
            onInput={typed}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
              typed();
            }}
            onSelect={sayCaret}
            onFocus={sayCaret}
            onPointerDown={() => typing?.flush()}
            onKeyDown={(event) => {
              const key = event.key;
              if (key === "Escape") {
                event.preventDefault();
                done(false);
              } else if ((event.metaKey || event.ctrlKey) && !event.altKey && key.toLowerCase() === "z") {
                // The store's undo, not the text area's: it knows whose typing is whose.
                event.preventDefault();
                void takeBack(event.shiftKey);
              } else if ((event.metaKey || event.ctrlKey) && key === "Enter") {
                event.preventDefault();
                done(false);
              } else if (key === "Enter" || CARET_KEYS.has(key)) {
                // A new line, or the caret moved: the run so far ends here.
                typing?.flush();
              }
            }}
            onKeyUp={sayCaret}
            onBlur={(event) => {
              typing?.flush();
              live.sayCaret(null);
              // Moving to the editor's own buttons is not leaving it.
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.closest("[data-graview-live]")?.contains(next)) return;
              done(true);
            }}
            style={TEXT_AREA}
          />
          {others.length > 0 ? <Carets text={value} others={others} area={area} log={store.log.all()} /> : null}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button type="button" onClick={() => done(false)} style={BUTTON}>
          Done
        </button>
        {markdown ? (
          <button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)} style={BUTTON}>
            {preview ? "Write" : "Preview"}
          </button>
        ) : null}
        <span style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)" }}>Saved as you type · Ctrl or ⌘ Z takes back your typing</span>
      </div>
    </div>
  );
}

/**
 * OTHERS' CARETS, ON A COPY OF THE TEXT: the same box, font and wrapping as
 * the text area, its words transparent, laid over it; a caret is a line at
 * its place in the copy, so it stands where the text area draws that place.
 */
function Carets({ text, others, area, log }: { readonly text: string; readonly others: readonly Presence[]; readonly area: { readonly current: HTMLTextAreaElement | null }; readonly log: Parameters<typeof caretHere>[2] }) {
  const copy = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = area.current;
    const mirror = copy.current;
    if (!element || !mirror) return;
    const follow = () => {
      mirror.scrollTop = element.scrollTop;
    };
    follow();
    element.addEventListener("scroll", follow);
    return () => element.removeEventListener("scroll", follow);
  });
  const placed = others
    .map((one) => ({ one, at: caretHere(one.caret!, one.participant, log, text.length).end }))
    .sort((a, b) => a.at - b.at);
  const parts: ReactNode[] = [];
  let from = 0;
  for (const { one, at } of placed) {
    parts.push(text.slice(from, at));
    from = at;
    const name = presenceName(one) || "Somebody";
    parts.push(
      <span
        key={one.participant}
        data-graview-caret={one.participant}
        title={`${name} is typing here`}
        style={{ borderLeft: `2px solid hsl(${Math.round(one.hue)} 55% 52%)`, marginLeft: -1, marginRight: -1, pointerEvents: "auto" }}
      />,
    );
  }
  // A last line that is empty is still a line.
  parts.push(`${text.slice(from)}​`);
  return (
    <div ref={copy} aria-hidden="true" style={COPY}>
      {parts}
    </div>
  );
}

/** How often a caret moved while typing is said, at most. */
const CARET_MS = 120;

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/** Keys that move the caret without typing: each ends the run before it. */
const CARET_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

const PREVIEW: CSSProperties = { minHeight: "7.5em", padding: "8px 10px", border: "1px dashed var(--graview-edge-bright)", borderRadius: 6, lineHeight: 1.6, minWidth: 0 };

const BUTTON: CSSProperties = { font: "inherit", fontSize: "0.8125rem", minHeight: 28, padding: "2px 12px" };

const BOX = {
  font: "inherit",
  lineHeight: 1.5,
  width: "100%",
  boxSizing: "border-box",
  minHeight: "7.5em",
  padding: "8px 10px",
  borderRadius: 6,
} as CSSProperties;

const TEXT_AREA = {
  ...BOX,
  resize: "vertical",
  fieldSizing: "content",
  color: "var(--graview-ink)",
  background: "var(--graview-panel, transparent)",
  border: "1px solid var(--graview-edge-bright)",
} as CSSProperties;

const COPY: CSSProperties = {
  ...BOX,
  position: "absolute",
  inset: 0,
  height: "100%",
  border: "1px solid transparent",
  color: "transparent",
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  overflow: "hidden",
  pointerEvents: "none",
};
