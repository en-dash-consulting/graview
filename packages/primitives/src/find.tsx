import { counted, nounOf, numberAsRead, pluralLabel, pluralOf, type AnySchema, type Hit } from "@graview/core";
import { actsOn, fold, search, touchWeights } from "@graview/core/search";
import { kindCardId, withFocus, withJackIn, withOverview, withPicture, withSelection } from "@graview/layout/view";
import { withoutSearch, withQuery } from "@graview/layout/view-moves";
import { useKit } from "@graview/react/drawing";
import { matchWith, POPOVER_STYLE, useFound, useGraview, usePopover, useViolations } from "@graview/react/provider";
import { hueFor } from "@graview/render";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { VISUALLY_HIDDEN } from "./primitives/index.js";
import { openQuickAsk, useQuickAskDrawn } from "./quick-ask-desk.js";

// The Find box searches: it hands the provider the matcher as it is fetched (FR-179).
matchWith({ search, touchWeights });

/**
 * THE FIND BOX. The graph is the result list.
 *
 * Typing writes `#q=` — an adjustment of the stop, so the address follows
 * each keystroke without piling up history — and every picture lights what
 * the words find and dims the rest, through the emphasis it already reads.
 * The strip under the box names the hits for the keyboard and the screen
 * reader: grouped by kind, the best first, each a line of its name and a
 * line of why it matched with the words that matched marked. Enter travels.
 *
 * THE LIST STAYS STILL. A record's acts once unfolded under it as the
 * pointer passed over it, and every row below jumped while the pointer was
 * heading for one of them. Now passing over a row only lights it — and only
 * when the pointer really moved, not when the list scrolled or drew again
 * under a still one — and nothing is put in or taken out of the list. On a
 * desk the lit row is said whole in a panel beside the list, its acts there
 * as buttons; in a narrow strip or a phone's sheet a row's acts open under
 * it only when its "⋯" is pressed. → reaches the acts from the keyboard in
 * both, ← comes back.
 *
 * `/` or ⌘K reaches it from anywhere; Escape clears the words; Back returns
 * to a search the way it returns to any stop. There is no palette over a
 * grayed-out app: the picture is the answer and the strip is its index.
 *
 * AND THE LAST ROW ASKS. Words that are a question rather than a name —
 * "what is overdue", "who covers Thursday" — find little; the strip's last
 * row, "Ask: ‘…’", asks them of the quick ask, answered on a card beside
 * what is selected, where a quick ask is drawn. There, ⌘K is the quick
 * ask's command bar and `/` stays Find's; where none is drawn both are
 * Find's.
 */

type ActHit = Extract<Hit, { about: "act" }>;

/** One row of the strip: a hit, and the id the listbox knows it by. */
interface Row {
  readonly id: string;
  readonly hit: Hit;
}

/** The way to every record of a kind the words found, where the strip shows only the best few: into the kind, narrowed by the words. */
interface AllRow {
  readonly id: string;
  readonly all: string;
  readonly count: number;
}

/** The strip's last row: the words, asked of the quick ask. */
interface AskRow {
  readonly id: string;
  readonly ask: string;
}

/** An act on a record of the strip, offered where it was asked for: the desk's panel, or under its row. */
interface ActRow {
  readonly id: string;
  readonly act: ActHit;
  /** The id of the record's row. */
  readonly of: string;
}

type ListRow = Row | AllRow | AskRow;
type AnyRow = ListRow | ActRow;

/** One kind's rows in the strip, with how many the words found of it and the way to all of them. */
interface Group {
  readonly key: string;
  readonly rows: readonly Row[];
  readonly count: number;
  readonly more: AllRow | null;
}

const isAct = (row: AnyRow | undefined): row is ActRow => row !== undefined && "act" in row;
const recordOf = (row: AnyRow | undefined): Row | undefined => (row !== undefined && "hit" in row && row.hit.about === "node" ? row : undefined);

/** The kind a hit belongs with in the strip; rules have a group of their own. */
const groupOf = (hit: Hit): string => (hit.about === "rule" ? "rule:" : hit.about === "act" ? "act:" : hit.kind);

/** Whether the viewport is a desk's: room for the panel beside the list. */
function useWide(compact: boolean): boolean {
  const measure = () => typeof window === "undefined" || window.innerWidth >= WIDE_FROM;
  const [wide, setWide] = useState(measure);
  useEffect(() => {
    const again = () => setWide(measure());
    window.addEventListener("resize", again);
    return () => window.removeEventListener("resize", again);
  }, []);
  return wide && !compact;
}

export function FindBox<S extends AnySchema>({ compact = false }: { readonly compact?: boolean }) {
  const { store, view, setView, principal, setMenuAt, brand, aiDesk, selection } = useGraview<S>();
  const asks = useQuickAskDrawn(aiDesk);
  const found = useFound();
  const violations = useViolations<S>();
  const flag = useKit().marks.flag;
  const wide = useWide(compact);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Where the keyboard waits between Enter and the place standing (see `hold`).
  const holder = useRef<HTMLSpanElement>(null);
  const strip = useId();
  const [open, setOpen] = useState(false);
  // The row lit: the keys' or the pointer's.
  const [active, setActive] = useState<string | null>(null);
  // The row the desk's panel says: the lit one, a moment behind a pointer crossing rows on its way to the panel.
  const [shown, setShown] = useState<string | null>(null);
  // The records whose acts were asked for under their rows (a narrow strip's "⋯", or →).
  const [opened, setOpened] = useState<readonly string[]>([]);
  const q = view.q ?? "";

  /*
   * `/` OR ⌘K, FROM ANYWHERE. ⌘K is a chord nobody types into a field, so
   * it works from one; `/` is a character, so it only reaches the box when
   * the keys are not already somewhere writing. Inside an embed, on
   * somebody else's page, only a key pressed in the embed or on nothing at
   * all is the box's (`/` only in the embed), and one the host's page
   * already answered is not: ⌘K
   * in the host's own editor stays the editor's, and of two embeds the
   * first to answer has it (FR-131).
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const chord = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!chord && !slash) return;
      const box = input.current;
      if (!box) return;
      const root = box.closest("[data-graview-embed]");
      const target = event.target;
      const nowhere = target === document.body || target === document.documentElement || target === window;
      // `/` is a character the host's page may want (a browser's quick find): inside an embed it is the box's only from within.
      if (root && !((chord && nowhere) || (target instanceof Node && root.contains(target)))) return;
      const at = document.activeElement;
      const writing =
        at instanceof HTMLInputElement ||
        at instanceof HTMLTextAreaElement ||
        at instanceof HTMLSelectElement ||
        (at instanceof HTMLElement && at.isContentEditable);
      if (slash && writing) return;
      event.preventDefault();
      // A phone's bar keeps the box put away until it is asked for.
      if (box.getClientRects().length === 0) box.closest<HTMLElement>("[data-graview-app-bar]")?.querySelector<HTMLButtonElement>('[data-testid="app-find-open"]')?.click();
      box.focus({ preventScroll: true });
      box.select();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /*
   * THE GROUPS: a kind's rows under its heading, the kinds in the order of
   * their best hit. Where several kinds share the strip each shows its best
   * few and a row to all of them, so one kind of a hundred hits does not push
   * every other kind out of sight; one kind alone shows its rows whole.
   */
  const groups = useMemo<readonly Group[]>(() => {
    const held = new Map<string, Row[]>();
    for (const [index, hit] of (found?.hits ?? []).entries()) {
      if (hit.about === "act") continue;
      const key = groupOf(hit);
      const rows = held.get(key) ?? [];
      rows.push({ id: `${strip}-${index}`, hit });
      held.set(key, rows);
    }
    const several = [...held.values()].filter((rows) => rows.some((row) => row.hit.about === "node")).length > 1;
    return [...held.entries()].map(([key, entries]) => {
      let records = 0;
      const rows = entries.filter((row) => row.hit.about !== "node" || !several || ++records <= GROUP_CAP);
      const listed = rows.filter((row) => row.hit.about === "node").length;
      const count = key.endsWith(":") ? entries.length : (found?.byKind[key] ?? listed);
      const more = !key.endsWith(":") && listed > 0 && count > listed ? { id: `${strip}-all-${key}`, all: key, count } : null;
      return { key, rows, count, more };
    });
  }, [found, strip]);
  const asking: AskRow | null = asks && q.trim() ? { id: `${strip}-ask`, ask: q.trim() } : null;
  const rows = useMemo<readonly ListRow[]>(
    () => [...groups.flatMap((group): readonly ListRow[] => (group.more ? [...group.rows, group.more] : group.rows)), ...(asking ? [asking] : [])],
    [groups, asking?.ask],
  );
  const manyFound = (found?.hits ?? []).filter((hit) => hit.about === "node").length;
  // The words as the matcher folded them, and what they mark in a row.
  const words = found?.words ?? q;
  const marking = useMemo(() => fold(words).split(" ").filter(Boolean), [words]);

  /*
   * WHAT CAN BE DONE ABOUT IT: the acts on a record, from the same matcher
   * asked with that record as the subject — never subjectless, and only
   * those this seat may run.
   */
  const actsOf = useCallback(
    (row: Row): readonly ActRow[] =>
      row.hit.about === "node" ? actsOn(store, row.hit.id, words, { principal, limit: ACTS_MOST }).map((act, at) => ({ id: `${row.id}-act-${at}`, act, of: row.id })) : [],
    [store, words, principal],
  );
  const lit = rows.find((row) => row.id === active);
  const subject = rows.find((row) => row.id === shown) ?? lit ?? rows[0];
  const panelActs = useMemo(() => (wide && recordOf(subject) ? actsOf(subject as Row) : []), [wide, subject?.id, actsOf]);
  const openActs = useMemo(() => {
    if (wide) return new Map<string, readonly ActRow[]>();
    return new Map(opened.flatMap((id) => {
      const row = recordOf(rows.find((one) => one.id === id));
      return row ? [[id, actsOf(row)] as const] : [];
    }));
  }, [wide, opened, rows, actsOf]);
  // In a narrow strip, which records have acts to ask for: a "⋯" that opened on nothing would be offered and refused.
  const hasActs = useMemo(() => {
    if (wide) return new Set<string>();
    return new Set(rows.flatMap((row) => (recordOf(row) && actsOf(row as Row).length > 0 ? [row.id] : [])));
  }, [wide, rows, actsOf]);
  const actRows = useMemo<readonly ActRow[]>(() => (wide ? panelActs : [...openActs.values()].flat()), [wide, panelActs, openActs]);
  const current: AnyRow | undefined = lit ?? actRows.find((row) => row.id === active) ?? rows[0];

  // A new answer starts at its first row, as a list does.
  useEffect(() => {
    setActive(null);
    setShown(null);
    setOpened([]);
  }, [q]);

  /*
   * WHERE ENTER WENT, THE KEYS GO (the tenth walk). Into a kind or one of
   * its pictures, the keyboard was let go on nothing, and narrowing what
   * Find had opened began with twenty Tabs back down the page. It lands on
   * the place's own arranging line — Sort, Filter — or, where the place
   * draws none, on the place; unless something else took the keys first.
   */
  const landOn = useRef<string | null>(null);
  useEffect(() => {
    const kind = landOn.current;
    if (!kind) return;
    landOn.current = null;
    let frames = 0;
    const look = () => {
      const place = document.querySelector<HTMLElement>(`[data-graview-view="aggregate:${CSS.escape(kind)}"]`);
      const at = document.activeElement;
      const free = !at || at === document.body || at === document.documentElement || at === input.current || at === holder.current || at === place;
      if (!free) return;
      // The first the line draws: on a phone it folds Sort into "Arrange", and a folded control takes no keys.
      const line = [...(place?.querySelectorAll<HTMLElement>('[role="group"][aria-label="Arrange"] :is(button, input)') ?? [])].find((one) => one.checkVisibility?.() ?? true);
      if (line) return line.focus({ preventScroll: true });
      /*
       * The line comes with the place's picture, which may be fetched the
       * first time: meanwhile the keys wait on the place itself, from the
       * first frame it stands, and go on to its line when it comes. Left on
       * nothing while they waited, the root gave them back to the box Enter
       * was pressed in, and on a slow machine the next key a person typed —
       * the place's acts key — went into the words.
       */
      if (place && place.tabIndex >= 0 && at !== place) place.focus({ preventScroll: true });
      if (++frames < 240) requestAnimationFrame(look);
      // The place never stood: the keyboard is let go, and the root gives it back to the box.
      else if (document.activeElement === holder.current) holder.current?.blur();
    };
    requestAnimationFrame(look);
  }, [view]);

  /*
   * NOT ONE FRAME IN THE BOX (0.1.48). The keys went to the place on the
   * first frame it stood, but Enter let them go on nothing until then, and a
   * key pressed in that frame — a person typing the place's acts key
   * straight after Enter — still landed in the words. So Enter on a kind or
   * a picture moves the keyboard at once, in the same press: onto the place
   * where it already stands, else onto a holder here that says where it is
   * going, until the place does.
   */
  const hold = (kind: string, going: string) => {
    const place = document.querySelector<HTMLElement>(`[data-graview-view="aggregate:${CSS.escape(kind)}"]`);
    if (place && place.tabIndex >= 0) return place.focus({ preventScroll: true });
    const waiting = holder.current;
    if (!waiting) return input.current?.blur();
    waiting.setAttribute("aria-label", going);
    waiting.focus({ preventScroll: true });
  };

  /*
   * THE POINTER LIGHTS, IT DOES NOT MOVE ANYTHING. A row is lit by the
   * pointer only when the pointer itself moved: a list scrolled, or drawn
   * again, under a still pointer sends a mouse event at the same place, and
   * that lit whatever row slid under it. And the panel follows the pointer a
   * moment behind (`AIM`), so a pointer crossing rows on its way to an act
   * in the panel finds the record it left still there.
   */
  const pointer = useRef<{ x: number; y: number; moved: boolean }>({ x: Number.NaN, y: Number.NaN, moved: false });
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const at = pointer.current;
      at.moved = event.clientX !== at.x || event.clientY !== at.y;
      at.x = event.clientX;
      at.y = event.clientY;
    };
    window.addEventListener("mousemove", onMove, { capture: true, passive: true });
    return () => window.removeEventListener("mousemove", onMove, { capture: true });
  }, []);
  const aim = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(aim.current), []);

  /** Lights a row from the keyboard: the panel says it at once. */
  const highlight = (row: AnyRow | undefined) => {
    if (!row) return;
    clearTimeout(aim.current);
    setActive(row.id);
    if (!isAct(row)) setShown(row.id);
  };

  /** Lights the row under a pointer that moved. */
  const point = (event: ReactMouseEvent) => {
    if (!pointer.current.moved) return;
    const id = (event.target as Element).closest?.('[role="option"]')?.id;
    if (!id || id === active) return;
    const row = rows.find((one) => one.id === id) ?? actRows.find((one) => one.id === id);
    if (!row) return;
    setActive(row.id);
    if (isAct(row)) return;
    clearTimeout(aim.current);
    aim.current = setTimeout(() => setShown(row.id), AIM);
  };

  /** Into the panel: whatever row the pointer crossed on its way, the record the panel says is the one lit. */
  const settle = () => {
    clearTimeout(aim.current);
    if (subject && !isAct(current)) setActive(subject.id);
  };

  /** A record's acts, asked for under its row; asked again, put away. */
  const toggle = (row: Row) => setOpened((now) => (now.includes(row.id) ? now.filter((id) => id !== row.id) : [...now, row.id]));

  /** How many rows a page of the strip is: what it shows at once, less one kept for context. */
  const pageOf = (count: number) => {
    const pane = list.current;
    const one = pane?.querySelector<HTMLElement>('[role="option"]')?.getBoundingClientRect().height ?? 0;
    const room = pane?.clientHeight ?? 0;
    return Math.min(count, one > 0 && room > 0 ? Math.max(1, Math.floor(room / one) - 1) : FIND_PAGE);
  };

  // The row lit is the row in sight: the strip scrolls to it as the keys move.
  useEffect(() => {
    if (active) document.getElementById(active)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const travel = (row: AnyRow | undefined) => {
    if (!row) return;
    if ("ask" in row) {
      // The words are asked about what is selected, answered on a card beside it; the picture lets go of them.
      openQuickAsk(aiDesk, { pointed: { ...(selection[0] !== undefined ? { on: selection[0] } : {}), about: selection }, asked: row.ask });
      setView((stop) => withoutSearch(stop));
      setOpen(false);
      return;
    }
    if ("all" in row) {
      // Every one the words found of the kind: into it, narrowed by the words, as the district's "N match" goes in.
      setView((stop) => withJackIn(withOverview(stop, false), kindCardId(row.all), { ownPicture: true, ...(stop.q ? { carry: stop.q } : {}) }));
      landOn.current = row.all;
      setOpen(false);
      return hold(row.all, `Opening ${pluralLabel(store.schema, row.all)} matching “${q.trim()}”…`);
    }
    if (isAct(row)) {
      // The act lives in the menu on its subject, with its form and its preview.
      const subjectId = row.act.subject;
      setView((stop) => withSelection(stop, [subjectId]));
      const box = input.current?.getBoundingClientRect();
      setMenuAt({ x: box?.left ?? 0, y: (box?.bottom ?? 0) + 6, on: subjectId });
      setOpen(false);
      input.current?.blur();
      return;
    }
    const hit = row.hit;
    switch (hit.about) {
      case "node":
        setView((stop) => withSelection(withFocus(withOverview(stop, false), hit.id), [hit.id]));
        break;
      case "kind":
        /*
         * INTO THE KIND, WHOLE (the tenth walk). The row is there because the
         * words NAME the kind — "talks" — so they are not words to narrow its
         * records by: carried in, "talks" kept ten talks of 1,960. The
         * district's own "N match" is the way in narrowed by the words. And
         * on the ground, as a search's descent is: the words took you to it.
         */
        setView((stop) => withJackIn(withOverview(stop, false), kindCardId(hit.kind), { ownPicture: true }));
        landOn.current = hit.kind;
        setOpen(false);
        return hold(hit.kind, `Opening ${hit.label}…`);
      case "place":
        setView((stop) => withPicture(stop, hit.kind, hit.as));
        landOn.current = hit.kind;
        setOpen(false);
        return hold(hit.kind, `Opening ${hit.title}…`);
      case "rule": {
        const named = violations.filter((violation) => violation.invariant === hit.name).flatMap((violation) => violation.nodeIds);
        setView((stop) => withSelection(stop, [...new Set(named)]));
        break;
      }
      case "act":
        break;
    }
    setOpen(false);
    input.current?.blur();
  };

  const announce = found ? spoken(found.byKind, found.hits, store.schema) : "";
  const expanded = open && q.trim().length > 0;
  /*
   * The list is one of the family (FR-77): in the top layer, hung from the
   * box, and the only popover open — opening another closes it, and it
   * closes the one before it. The keyboard stays in the box, as a
   * combobox's does; its rows are `aria-activedescendant`.
   */
  /*
   * On a phone's bar the strip is a sheet the bar's width, hung from the
   * bar's bottom edge — the bar's, not the screen's: in a narrow box on a
   * desk it is the box's width, under the box.
   */
  const underTheBar = useCallback(() => {
    const bar = input.current?.closest("[data-graview-app-bar]")?.getBoundingClientRect();
    if (bar) return { x: bar.right, y: bar.bottom - SHEET_GAP };
    // A box with no bar above it (the Shell's): the sheet hangs under the box, as it always did.
    const box = input.current?.getBoundingClientRect();
    return box ? { x: box.right, y: box.bottom } : null;
  }, []);
  const popover = usePopover("find", {
    open: expanded,
    onOpenChange: (next) => {
      if (!next) setOpen(false);
    },
    ...(compact ? { at: underTheBar } : {}),
  });

  const nothing = rows.every((row) => "ask" in row);
  const actsOfRecord = (row: AnyRow | undefined) => (isAct(row) ? actRows.filter((one) => one.of === row.of) : []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    /*
     * RECORD TO RECORD, ONE KEY EACH (the tenth walk). ↓ and ↑ walk the
     * records; → goes into the acts of the one lit — the desk's panel, or
     * opened under it in a narrow strip — and ← back to it. In the acts ↓
     * and ↑ walk the acts.
     */
    const inActs = isAct(current) && active !== null;
    const from = inActs ? rows.find((row) => row.id === (current as ActRow).of) : active !== null ? lit : undefined;
    // Nothing lit yet: the first ↓ lands on the first row, not the second.
    const at = from ? rows.indexOf(from) : -1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (inActs) {
        const acts = actsOfRecord(current);
        const next = acts.indexOf(current as ActRow) + 1;
        if (next < acts.length) return highlight(acts[next]);
        // Past the last act: under a row, the next record; in the panel, it stays.
        if (wide) return;
      }
      highlight(rows[Math.min(rows.length - 1, at + 1)]);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (inActs) {
        const acts = actsOfRecord(current);
        const back = acts.indexOf(current as ActRow) - 1;
        return highlight(back >= 0 ? acts[back] : from);
      }
      highlight(rows[Math.max(0, at - 1)]);
    } else if ((event.key === "PageDown" || event.key === "PageUp") && rows.length > 0) {
      /*
       * A PAGE OF RECORDS AT A TIME (the tenth walk): the strip's own
       * height of them, so a hundred talks are ten keys and not a hundred.
       * Home and End stay the words' own: the box is a field being written in.
       */
      event.preventDefault();
      setOpen(true);
      const step = event.key === "PageDown" ? pageOf(rows.length) : -pageOf(rows.length);
      highlight(rows[Math.min(rows.length - 1, Math.max(0, (at < 0 ? -1 : at) + step))]);
    } else if (event.key === "ArrowRight" && !inActs && recordOf(current)) {
      const row = current as Row;
      const acts = wide ? (row.id === subject?.id ? panelActs : actsOf(row)) : (openActs.get(row.id) ?? actsOf(row));
      if (acts.length === 0) return;
      event.preventDefault();
      if (!wide && !opened.includes(row.id)) setOpened((now) => [...now, row.id]);
      setShown(row.id);
      setActive(acts[0]!.id);
    } else if (event.key === "ArrowLeft" && inActs) {
      event.preventDefault();
      const of = (current as ActRow).of;
      if (!wide) setOpened((now) => now.filter((id) => id !== of));
      highlight(rows.find((row) => row.id === of));
    } else if (event.key === "Enter") {
      event.preventDefault();
      travel(current);
    } else if (event.key === "Escape") {
      event.preventDefault();
      // The words first; an empty box lets go of the keys.
      if (q) setView((stop) => withoutSearch(stop));
      else input.current?.blur();
    }
  };

  const option = (row: ListRow, body: ReactNode, extra: CSSProperties = {}, props: Record<string, string> = {}) => {
    const on = row.id === current?.id;
    return (
      <div key={row.id} id={row.id} role="option" aria-selected={on} onClick={() => travel(row)} style={{ ...OPTION, ...(on ? LIT : null), ...extra }} {...props}>
        {body}
      </div>
    );
  };

  const actOption = (row: ActRow, under: boolean) => {
    const on = row.id === current?.id;
    return (
      <div
        key={row.id}
        id={row.id}
        role="option"
        aria-selected={on}
        data-testid="find-act"
        data-about="act"
        onClick={() => travel(row)}
        style={{ ...(under ? ACT_UNDER : ACT), ...(on ? ACT_LIT : null), ...(row.act.destructive ? { color: "var(--graview-warn)" } : null) }}
      >
        {row.act.title}
      </div>
    );
  };

  return (
    <div style={{ position: "relative", minWidth: 0, flex: "1 1 auto" }} data-testid="find">
      <input
        ref={(element) => {
          input.current = element;
          popover.trigger.ref(element);
        }}
        data-graview-popover-trigger="find"
        type="search"
        role="combobox"
        aria-label="Find anything"
        aria-expanded={expanded}
        aria-controls={strip}
        aria-autocomplete="list"
        {...(expanded && current ? { "aria-activedescendant": current.id } : {})}
        data-testid="find-box"
        placeholder="Find…"
        aria-keyshortcuts="/ Meta+K Control+K"
        value={q}
        onChange={(event) => {
          const typed = event.target.value;
          setOpen(true);
          setView((stop) => withQuery(stop, typed.length > 0 ? typed : null));
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          boxSizing: "border-box",
          minWidth: 0,
          height: 30,
          // Room at its end for the shortcut the bar says over it until it is used.
          padding: "0 var(--graview-bar-find-end, 10px) 0 10px",
          font: "inherit",
          fontSize: "0.875rem",
          color: "var(--graview-ink)",
          background: "var(--graview-panel)",
          border: `1px solid ${q ? "var(--graview-accent)" : "var(--graview-edge)"}`,
          borderRadius: 8,
        }}
      />
      {/* The count, said as it changes — the strip is the list, this is the sentence. */}
      <span role="status" aria-live="polite" style={VISUALLY_HIDDEN} data-testid="find-count">
        {q.trim() ? announce : ""}
      </span>
      {/* Where the keyboard waits between Enter on a kind and its place standing: never the box. */}
      <span ref={holder} tabIndex={-1} role="status" style={VISUALLY_HIDDEN} data-testid="find-landing" />
      <div
        {...popover.pane}
        id={strip}
        role="listbox"
        aria-label={q ? `What “${q}” finds` : "What the words find"}
        data-testid="find-strip"
        data-graview-find={wide ? "panel" : "narrow"}
        hidden={!expanded}
        // Mousedown on a row must not blur the box before the click lands.
        onMouseDown={(event) => event.preventDefault()}
        // Shown, it is a column — the list, the panel beside it, the keys under them; put away, the popover's own rule hides it.
        style={{ ...STRIP, ...(compact ? SHEET : wide && !nothing ? WIDE : null), ...(expanded ? { display: "flex" } : null) }}
      >
        <div style={{ ...BODY, gridTemplateColumns: wide && !nothing ? `minmax(0, 1fr) ${PANEL_WIDTH}` : "minmax(0, 1fr)" }}>
          <div ref={list} role="presentation" data-testid="find-list" onMouseMove={point} style={LIST}>
            {nothing ? (
              <p role="presentation" style={{ margin: 0, padding: "10px 12px", color: "var(--graview-ink-muted)", fontSize: "0.875rem" }} data-testid="find-nothing">
                Nothing here is called “{found?.words || q}”.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.key} role="group" aria-label={headingOf(group.key, store.schema)}>
                  <div role="presentation" style={HEADING}>
                    {group.key !== "rule:" && group.key !== "act:" ? <Mark kind={group.key} accents={brand?.accents} /> : null}
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{headingOf(group.key, store.schema)}</span>
                    <span aria-hidden="true" style={COUNT} data-testid="find-group-count">
                      {numberAsRead(group.count)}
                    </span>
                  </div>
                  {group.rows.map((row) => {
                    const hit = row.hit;
                    const record = hit.about === "node" ? hit : null;
                    const asks = !wide && record !== null && hasActs.has(row.id);
                    const under = openActs.get(row.id);
                    return (
                      <Fragment key={row.id}>
                        {option(
                          row,
                          <>
                            <HitLine hit={hit} flag={flag} words={record?.near && record.why.matched ? [...marking, fold(record.why.matched)] : marking} />
                            {asks ? (
                              <span
                                aria-hidden="true"
                                data-testid="find-acts-open"
                                data-open={under ? "" : undefined}
                                title={under ? "Put its actions away" : "Actions"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggle(row);
                                }}
                                style={{ ...MORE, ...(under ? MORE_OPEN : null) }}
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                                  <circle cx="3.5" cy="8" r="1.4" fill="currentColor" />
                                  <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                                  <circle cx="12.5" cy="8" r="1.4" fill="currentColor" />
                                </svg>
                              </span>
                            ) : null}
                          </>,
                          asks ? { paddingRight: 48 } : {},
                          {
                            "data-testid": "find-hit",
                            "data-about": hit.about,
                            ...(record?.near ? { "data-near": "" } : {}),
                            title: titleOf(hit),
                          },
                        )}
                        {under ? (
                          <div role="group" aria-label={`What can be done about ${record?.label ?? "it"}`} style={UNDER}>
                            {under.map((act) => actOption(act, true))}
                          </div>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {group.more
                    ? option(
                        group.more,
                        <span style={ONE_LINE}>
                          All {numberAsRead(group.more.count)} {pluralOf(store.schema, group.more.all).toLowerCase()} matching “{q.trim()}”
                        </span>,
                        ALL,
                        { "data-testid": "find-all", "data-about": "all" },
                      )
                    : null}
                </div>
              ))
            )}
            {asking ? option(asking, <span style={ONE_LINE}>Tell Graview: <span style={{ fontWeight: 600 }}>‘{asking.ask}’</span></span>, { borderTop: "1px solid var(--graview-edge)", marginTop: 4 }, { "data-testid": "find-ask" }) : null}
            {/* A long answer says how to make it short: another word, as a list's far end says "type more of the name". */}
            {manyFound > MANY_FOUND ? (
              <p role="presentation" style={NOTE} data-testid="find-more-words">
                {numberAsRead(manyFound)} found: another word of the name narrows them.
              </p>
            ) : null}
            {found && found.searched.past === false && found.searched.kinds.some((kind) => store.schema.tryDefinition(kind)?.lifecycle) ? (
              <p role="presentation" style={NOTE}>
                Current ones; add is:any for the past.
              </p>
            ) : null}
          </div>
          {wide && !nothing && subject ? (
            <div role="group" aria-label="The one lit" data-testid="find-panel" onMouseEnter={settle} onMouseMove={point} style={PANEL}>
              <Said row={subject} schema={store.schema} accents={brand?.accents} marking={marking} q={q.trim()} flag={flag} />
              {panelActs.length > 0 ? (
                <div role="group" aria-label="Actions" style={{ display: "grid", gap: 4 }}>
                  <div role="presentation" style={{ ...HEADING, padding: "10px 0 4px" }}>
                    Actions
                  </div>
                  {panelActs.map((act) => actOption(act, false))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {compact ? null : (
          <div aria-hidden="true" style={FOOT} data-testid="find-keys">
            <span><kbd style={KBD}>↑</kbd><kbd style={KBD}>↓</kbd> move</span>
            <span><kbd style={KBD}>↵</kbd> open</span>
            <span><kbd style={KBD}>→</kbd> actions</span>
            <span><kbd style={KBD}>esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The row lit, said whole in the desk's panel: what it is, its name, and why the words found it. */
function Said({ row, schema, accents, marking, q, flag }: { row: ListRow; schema: AnySchema; accents?: Readonly<Record<string, number>> | undefined; marking: readonly string[]; q: string; flag: string }) {
  let kind: string | null = null;
  let over = "";
  let name: ReactNode;
  let lines: ReactNode = null;
  if ("ask" in row) {
    over = "Tell Graview";
    name = `‘${row.ask}’`;
    lines = <p style={PANEL_LINE}>Says it to Graview about what is selected; the answer comes on a card beside it.</p>;
  } else if ("all" in row) {
    kind = row.all;
    over = pluralLabel(schema, row.all);
    name = `All ${numberAsRead(row.count)} matching “${q}”`;
    lines = <p style={PANEL_LINE}>Opens the {pluralOf(schema, row.all).toLowerCase()}, narrowed by these words.</p>;
  } else {
    const hit = row.hit;
    switch (hit.about) {
      case "node": {
        kind = hit.kind;
        over = capitalized(nounOf(schema.tryDefinition(hit.kind), hit.kind));
        name = (
          <>
            {hit.flagged ? <span style={{ color: "var(--graview-warn)" }}>{flag} </span> : null}
            <Marked text={hit.label} words={marking} />
          </>
        );
        const notes = [hit.apart, hit.current ? null : "past", hit.archived ? "set aside" : null].filter(Boolean).join(" · ");
        lines = (
          <>
            {notes ? <p style={PANEL_LINE}>{capitalized(notes)}</p> : null}
            {hit.near ? (
              <p style={PANEL_LINE}>
                Near “{hit.why.asked}”{hit.why.field !== "label" ? ` — ${hit.why.reading.toLowerCase()}: ${hit.why.fragment}` : ""}
              </p>
            ) : hit.why.field !== "label" ? (
              <p style={PANEL_LINE}>
                <span style={{ color: "var(--graview-ink-faint)" }}>{hit.why.reading}</span>
                <br />
                <Marked text={hit.why.fragment} words={marking} />
              </p>
            ) : null}
          </>
        );
        break;
      }
      case "kind":
        kind = hit.kind;
        over = "Kind";
        name = hit.label;
        lines = <p style={PANEL_LINE}>Goes into the {hit.label.toLowerCase()}, all of them{hit.count > 0 ? `; ${numberAsRead(hit.count)} match these words` : ""}.</p>;
        break;
      case "place":
        kind = hit.kind;
        over = "Place";
        name = hit.title;
        lines = <p style={PANEL_LINE}>A picture of the {pluralOf(schema, hit.kind).toLowerCase()}.</p>;
        break;
      case "rule":
        over = "Rule";
        name = hit.label;
        lines = <p style={PANEL_LINE}>Selects what it flags.</p>;
        break;
      case "act":
        over = "Act";
        name = hit.title;
        break;
    }
  }
  return (
    <div role="presentation" data-testid="find-said" style={{ display: "grid", gap: 6 }}>
      <div style={{ ...HEADING, padding: 0 }}>
        {kind ? <Mark kind={kind} accents={accents} /> : null}
        {over}
      </div>
      <div style={PANEL_NAME}>{name}</div>
      {lines}
    </div>
  );
}

function HitLine({ hit, flag, words }: { hit: Hit; flag: string; words: readonly string[] }) {
  switch (hit.about) {
    case "node":
      return (
        <>
          <span style={TITLE}>
            {hit.flagged ? <span style={{ color: "var(--graview-warn)" }}>{flag} </span> : null}
            <Marked text={hit.label} words={words} />
            {hit.apart ? <span style={MUTED}> · {hit.apart}</span> : null}
            {hit.current ? null : <span style={MUTED}> · past</span>}
          </span>
          {hit.near ? (
            // Found by a word near the one typed, and said so: "Near “florist” — tags: flowers".
            <span style={{ ...ONE_LINE, ...MUTED }} data-testid="find-near">
              Near “{hit.why.asked}”{hit.why.field !== "label" ? ` — ${hit.why.reading.toLowerCase()}: ` : ""}
              {hit.why.field !== "label" ? <Marked text={hit.why.fragment} words={words} /> : null}
            </span>
          ) : hit.why.field !== "label" ? (
            <span style={{ ...ONE_LINE, ...MUTED }}>
              {hit.why.reading.toLowerCase()}: <Marked text={hit.why.fragment} words={words} />
            </span>
          ) : null}
        </>
      );
    case "kind":
      return (
        <span style={ONE_LINE}>
          <Marked text={hit.label} words={words} />
          <span style={MUTED}> · {hit.count} match</span>
        </span>
      );
    case "place":
      return (
        <span style={ONE_LINE}>
          Go to <Marked text={hit.title} words={words} />
        </span>
      );
    case "rule":
      return (
        <span style={ONE_LINE}>
          The rule “<Marked text={hit.label} words={words} />”
        </span>
      );
    case "act":
      return <span style={ONE_LINE}>{hit.title}</span>;
  }
}

/**
 * THE WORDS THAT MATCHED, MARKED: each word of the text that a word typed
 * begins — "track" in "on-site tracking" — as the matcher reads them, case
 * and accents aside, so the mark is where the match was.
 */
function markedParts(text: string, words: readonly string[]): readonly { readonly text: string; readonly marked?: true }[] {
  if (words.length === 0) return [{ text }];
  const parts: { text: string; marked?: true }[] = [];
  let last = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    const token = match[0];
    const folded = fold(token).replace(/ /g, "");
    const word = words.filter((one) => folded.startsWith(one)).sort((a, b) => b.length - a.length)[0];
    if (!word) continue;
    // Where folding kept its length, the letters typed; where it did not (a ligature, a dotted I), the whole word.
    const length = folded.length === token.length ? word.length : token.length;
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: token.slice(0, length), marked: true });
    last = start + length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

function Marked({ text, words }: { text: string; words: readonly string[] }) {
  return (
    <>
      {markedParts(text, words).map((part, at) =>
        part.marked ? (
          <mark key={at} style={MARK}>
            {part.text}
          </mark>
        ) : (
          <Fragment key={at}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/** A row's whole text, for the pointer that rests on one cut short. */
function titleOf(hit: Hit): string {
  if (hit.about !== "node") return "";
  const why = hit.near ? `Near “${hit.why.asked}”` : hit.why.field !== "label" ? `${hit.why.reading}: ${hit.why.fragment}` : "";
  return why ? `${hit.label}\n${why}` : hit.label;
}

const capitalized = (text: string) => (text ? text[0]!.toUpperCase() + text.slice(1) : text);

function Mark({ kind, accents }: { kind: string; accents?: Readonly<Record<string, number>> | undefined }) {
  const hue = Math.round(hueFor(kind, accents));
  return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, flex: "0 0 auto", background: `hsl(${hue} 55% 52%)` }} />;
}

function headingOf(key: string, schema: AnySchema): string {
  if (key === "rule:") return "Rules";
  if (key === "act:") return "Acts";
  return pluralLabel(schema, key);
}

/** "3 tasks, 1 list" — what a screen reader hears as the count changes. */
function spoken(byKind: Readonly<Record<string, number>>, hits: readonly Hit[], schema: AnySchema): string {
  const parts = Object.entries(byKind).map(([kind, count]) => {
    return counted(schema, kind, count);
  });
  const others = hits.filter((hit) => hit.about === "kind" || hit.about === "place" || hit.about === "rule").length;
  if (others > 0) parts.push(`${others} ${others === 1 ? "place or rule" : "places and rules"}`);
  const near = hits.filter((hit) => hit.about === "node" && hit.near).length;
  return parts.length === 0 ? "Nothing found" : `${parts.join(", ")} found${near > 0 ? `, ${near} of them near` : ""}`;
}

/** A page of the strip's rows where it cannot be measured. */
const FIND_PAGE = 10;

/** From how many records an answer asks for another word rather than being walked. */
const MANY_FOUND = 12;

/** Where several kinds share the strip, how many of each it shows before "All N …". */
const GROUP_CAP = 5;

/** How many acts a record offers in the strip; the rest are in its menu. */
const ACTS_MOST = 6;

/** How long the panel waits on a pointer crossing rows before it says the row lit (ms). */
const AIM = 140;

/** From what viewport width the strip has room for the panel beside the list. */
const WIDE_FROM = 760;

const PANEL_WIDTH = "15.5rem";

const STRIP: CSSProperties = {
  ...POPOVER_STYLE,
  flexDirection: "column",
  width: "min(26rem, calc(100vw - 24px))",
  maxHeight: "min(64vh, 30rem)",
  overflow: "hidden",
  boxSizing: "border-box",
  // The panel's color over the ground's: where the scheme's panel is a glass, the picture behind does not read through the words.
  background: "linear-gradient(var(--graview-panel), var(--graview-panel)) var(--graview-ground, var(--graview-panel))",
  borderTop: "1px solid var(--graview-edge)",
  borderRight: "1px solid var(--graview-edge)",
  borderBottom: "1px solid var(--graview-edge)",
  borderLeft: "1px solid var(--graview-edge)",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgb(0 0 0 / 0.18)",
  padding: 0,
};

/** On a desk, room for the panel beside the list. */
const WIDE: CSSProperties = { width: "min(42rem, calc(100vw - 24px))" };

/** The gap `useTopLayer` leaves under an anchor, taken back so the sheet meets the bar's edge. */
const SHEET_GAP = 6;
/** On a phone's bar the strip is a sheet under the bar, the bar's own width (`--graview-bar-width`, the screen's where no bar says it). */
const SHEET: CSSProperties = {
  width: "var(--graview-bar-width, 100vw)",
  maxHeight: "55vh",
  borderRadius: 0,
  borderLeft: "none",
  borderRight: "none",
};

const BODY: CSSProperties = { display: "grid", gridTemplateRows: "minmax(0, 1fr)", flex: "1 1 auto", minHeight: 0 };

const LIST: CSSProperties = { overflowY: "auto", overflowX: "hidden", minHeight: 0, padding: "4px 0", overscrollBehavior: "contain" };

const PANEL: CSSProperties = {
  overflowY: "auto",
  minHeight: 0,
  padding: "12px 14px",
  borderLeft: "1px solid var(--graview-edge)",
  background: "var(--graview-panel-muted)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const PANEL_NAME: CSSProperties = { fontWeight: 600, fontSize: "0.9375rem", lineHeight: 1.35, color: "var(--graview-ink)", overflowWrap: "anywhere" };

const PANEL_LINE: CSSProperties = { margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-ink-muted)", overflowWrap: "anywhere" };

const HEADING: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 12px 4px",
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--graview-ink-muted)",
};

const COUNT: CSSProperties = { marginLeft: "auto", fontWeight: 400, letterSpacing: 0, fontVariantNumeric: "tabular-nums", color: "var(--graview-ink-faint)" };

const OPTION: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 1,
  minHeight: 34,
  padding: "5px 12px",
  alignContent: "center",
  cursor: "pointer",
  fontSize: "0.875rem",
  lineHeight: 1.35,
  color: "var(--graview-ink)",
  minWidth: 0,
};

/** The row lit: a wash and a bar at its edge, in the app's accent. */
const LIT: CSSProperties = { background: "color-mix(in srgb, var(--graview-accent) 12%, var(--graview-panel))", boxShadow: "inset 3px 0 0 var(--graview-accent)" };

const ALL: CSSProperties = { color: "var(--graview-accent)", fontSize: "0.8125rem", minHeight: 30 };

const ONE_LINE: CSSProperties = { display: "block", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** A record's name: two lines at most, so a long name still shows the word that found it, and never more, so no row is a paragraph. */
const TITLE: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  minWidth: 0,
  overflow: "hidden",
  overflowWrap: "anywhere",
  fontWeight: 600,
};

const MUTED: CSSProperties = { color: "var(--graview-ink-muted)", fontSize: "0.8125rem", fontWeight: 400 };

const MARK: CSSProperties = {
  background: "color-mix(in srgb, var(--graview-accent) 24%, transparent)",
  color: "inherit",
  borderRadius: 2,
  padding: 0,
  boxShadow: "0 1px 0 color-mix(in srgb, var(--graview-accent) 70%, transparent)",
};

const ACT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 32,
  padding: "4px 10px",
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--graview-edge)",
  borderRadius: 6,
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  fontSize: "0.8125rem",
  lineHeight: 1.3,
  cursor: "pointer",
  overflowWrap: "anywhere",
};

const ACT_UNDER: CSSProperties = { ...ACT, minHeight: 32, margin: "0 12px 4px 24px" };

const ACT_LIT: CSSProperties = { borderColor: "var(--graview-accent)", boxShadow: "inset 0 0 0 1px var(--graview-accent)", background: "color-mix(in srgb, var(--graview-accent) 12%, var(--graview-panel))" };

const UNDER: CSSProperties = { display: "grid", padding: "2px 0 6px" };

/** A narrow strip's "⋯": its acts, asked for. Over the row's end, in room the row keeps for it, so the row's words never run under it. */
const MORE: CSSProperties = {
  position: "absolute",
  top: "50%",
  right: 6,
  transform: "translateY(-50%)",
  width: 36,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 6,
  color: "var(--graview-ink-muted)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
};

const MORE_OPEN: CSSProperties = { color: "var(--graview-accent)", borderColor: "var(--graview-edge)", background: "var(--graview-panel)" };

const NOTE: CSSProperties = { margin: 0, padding: "6px 12px 4px", color: "var(--graview-ink-faint)", fontSize: "0.75rem" };

const FOOT: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 14px",
  padding: "7px 12px",
  borderTop: "1px solid var(--graview-edge)",
  color: "var(--graview-ink-faint)",
  fontSize: "0.75rem",
  flex: "0 0 auto",
};

const KBD: CSSProperties = {
  display: "inline-block",
  minWidth: 16,
  padding: "0 4px",
  marginRight: 3,
  border: "1px solid var(--graview-edge)",
  borderRadius: 4,
  font: "inherit",
  fontSize: "0.6875rem",
  lineHeight: "16px",
  textAlign: "center",
  color: "var(--graview-ink-muted)",
  background: "var(--graview-panel)",
};
