import { humaniseField, nounOf, withArticle, type AnySchema } from "@graview/core";
import { useSubject } from "../companion.js";
import { edgeOfSelection, kindsOf } from "@graview/layout";
import { useAffordances, useApplyAffordance, useGraview, useSelection } from "@graview/react";
import { loadPins, togglePin, type Affordance, type PinOverrides } from "@graview/tools";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnswerArgs, nameOf } from "./answer-args.js";


/**
 * What is selected, what is true about it, and what can legally be done —
 * as a LEFT PANE beside the focus.
 *
 * It has lived bottom-right (a 340px column over the scene), bottom-centre
 * (a strip that sat on the kinds shelf), and now where the room actually
 * is: the left gutter beside a centred focus, which every state leaves
 * open, which a widened or zoomed view only makes wider, and which covers
 * neither the shelf below nor the picture you are acting on. In the
 * Graview the relation key holds the top of the same rail and this pane
 * takes the run of it below.
 */
/**
 * Where this pane is drawn.
 *
 * `float` is what it always was: a rail beside the picture, or a bar along
 * the bottom when the scene is narrow, and the same pane at the pointer
 * when a right-click opened it. `rail` is its body inside the companion,
 * which owns the frame and the scrolling; `menu` is only the pointer
 * popover, for a scene whose rail is the companion — so the context menu
 * and the assistant stay one construct without drawing the acts twice.
 */
export type InspectorPlacement = "float" | "rail" | "menu";

export function Inspector({ placement = "float" }: { readonly placement?: InspectorPlacement } = {}) {
  const { store, menuAt, setMenuAt, view } = useGraview<AnySchema>();
  const subject = useSubject();
  /*
   * The pane is positioned within the SCENE'S BOX, not the window. It was
   * fixed to the viewport, which put it at the page's edge when the scene
   * was a box on a page — an embed's inspector drawn over the host's own
   * navigation. The pointer menu's client coordinates are translated into
   * that box, and clamped to it.
   */
  const asideRef = useRef<HTMLElement>(null);

  /*
   * THE KEYBOARD KEEPS ITS PLACE.
   *
   * The pane is a live list: an act applies and leaves it, a pin regroups
   * it, an ask closes when it is answered. Every one of those removes the
   * element the keyboard was standing on, and a removed element takes focus
   * to <body> with it — so pressing Enter on "Mark it done" left somebody
   * working from the keyboard at the top of the document, six tabs from
   * where they were, once per act. The routed face never had this: its
   * forms stay mounted, so the two faces disagreed about what pressing a
   * button does.
   *
   * What is remembered is WHICH act, not which element: the ask's controls
   * belong to the act above them, so answering one puts you back on it.
   * Tabbing away is somebody leaving on purpose and is not restored; the
   * element going away underneath them is the only case this is for.
   *
   * And "went away" is asked of the ELEMENT, not of the blur. `relatedTarget`
   * is null when a removed node loses focus — and also when a Tab from the
   * last control in the document wraps round to the first, which Chromium
   * reports the same way. Trusting the blur alone left the pane holding a
   * stale key after an ordinary Tab out of it, and the next time focus fell
   * to <body> anywhere on the page — a rename committed in a card — the pane
   * reclaimed the keyboard from work it had no part in. So the element the
   * keyboard stood on is kept beside the key, and the pane restores only
   * when that element is no longer in the document.
   */
  const keptFocus = useRef<{ readonly key: string; readonly element: HTMLElement } | null>(null);
  /** The picture the pane sits on: where the keyboard goes if the pane goes. */
  const scene = useRef<HTMLElement | null>(null);
  const remember = (target: HTMLElement) => {
    const asking = target.closest("[data-graview-asking]")?.getAttribute("data-graview-asking");
    const pin = target.getAttribute("data-pin-for");
    const key = asking ?? target.getAttribute("data-affordance") ?? (pin === null ? null : `pin:${pin}`);
    keptFocus.current = key === null ? null : { key, element: target };
  };
  useEffect(() => {
    const pane = asideRef.current;
    const kept = keptFocus.current;
    if (kept === null || document.activeElement !== document.body) return;
    // Still on the page: nothing was pulled out from under the keyboard, so
    // wherever it went, it went on purpose.
    if (kept.element.isConnected) return;
    const key = kept.key;
    /*
     * AND WHEN THE PANE ITSELF GOES — Escape, the ×, or an act that clears
     * the selection — there is nothing inside it left to go back to. Chrome
     * and Firefox pick a new starting point for the next Tab on their own;
     * WEBKIT DOES NOT. Focus went away with a removed node and four presses
     * of Tab moved nothing at all, which is a keyboard that has stopped
     * working and a pointer as the only way out. The picture the pane was
     * about is the honest home.
     */
    if (!pane) {
      keptFocus.current = null;
      scene.current?.focus();
      return;
    }
    const home =
      (key.startsWith("pin:")
        ? pane.querySelector(`[data-pin-for="${CSS.escape(key.slice(4))}"]`)
        : null) ??
      pane.querySelector(`[data-affordance="${CSS.escape(key)}"]:not([disabled])`) ??
      // The act is gone — finished, severed, no longer offered. The pane
      // itself is then the honest home: the keyboard stays where the work
      // is, and Enter on a container does nothing by accident.
      pane;
    (home as HTMLElement).focus();
  });

  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const parent = asideRef.current?.offsetParent;
    // Held while the pane exists, because the keyboard needs somewhere to
    // land at the moment it stops existing.
    if (parent instanceof HTMLElement) scene.current = parent;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    setBox((current) =>
      current && current.left === rect.left && current.top === rect.top && current.width === rect.width && current.height === rect.height
        ? current
        : { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    );
  });
  const { selection, set, clear } = useSelection();
  /*
   * THE PERSON'S OWN PINS, loaded once per mount and passed into the same
   * derivation every surface reads — so a pin made here reorders the strip,
   * the pointer menu and nothing else invents a second action system.
   */
  const [pins, setPins] = useState<PinOverrides>(() => loadPins());
  /*
   * THE THING YOU PRESSED ON leads the list, in the strip as well as the
   * menu — one rank, derived once, so the two surfaces cannot disagree
   * about what comes first.
   *
   * The menu names what its gesture landed on. The strip has no gesture of
   * its own, so it takes the most recent addition to the selection, which
   * is the same thing: the card you just clicked. With a single selection
   * that is simply the selected node, which is what "resolve THIS item's
   * problem" means when only one item is in hand.
   */
  /*
   * WHAT THIS PANE IS ABOUT. The gesture's own target when a right-click
   * opened it, else the most recent addition to the selection — and, in
   * the companion's rail, the rail's own subject when nothing is chosen,
   * so the acts belong to the thing the header names. A rail that said
   * "Pay the deposit" over the acts of nothing was two panels again.
   */
  const focus = menuAt?.on ?? selection[selection.length - 1] ?? (placement === "rail" ? (subject.id ?? undefined) : undefined);
  /*
   * In the rail with nothing chosen, the acts are the SUBJECT's: what the
   * header names is what the buttons under it do. Everywhere else the
   * selection is what the strip is about, as it always was.
   */
  const about = placement === "rail" && selection.length === 0 && subject.id ? [subject.id] : undefined;
  const deriveOptions = useMemo(
    () => ({ pins, ...(focus === undefined ? {} : { focus }), ...(about ? { about } : {}) }),
    // `about` is a fresh array each render; the one id in it is what changes.
    [pins, focus, about?.[0]],
  );
  // Which acts the app itself pinned — the star on those demotes rather
  // than doubling up, so pressing it always visibly does something.
  const declaredPins = useMemo(
    () => new Set(store.allMutations().filter((mutation) => mutation.pinned).map((mutation) => mutation.name)),
    [store],
  );
  const { affordances, withheld, observations } = useAffordances(deriveOptions);
  /*
   * Whether the derivation is withholding a creating act for want of the
   * kind it connects to, rather than for want of a mutation. The observation
   * above the list already names it, so the empty-list sentence stands down.
   */
  const waiting = observations.some((observation) => observation.id.startsWith("schema:waits:"));
  const { apply, preview } = useApplyAffordance();
  const [pending, setPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  /* The withheld acts past the first three, on request — never dropped without a word. */
  const [allWithheld, setAllWithheld] = useState(false);
  /*
   * The searcher's text. Chrome that is mostly not there must not be
   * there: the field only renders once the list outgrows the fold.
   */
  const [query, setQuery] = useState("");
  /*
   * A REFUSAL IS A RESULT, said where the button was pressed.
   *
   * A mutation that throws — a validation failure, a guard's own sentence —
   * used to vanish into the console, and the strip read as a button that
   * does nothing. The seat already surfaces its refusals on itself; this is
   * the same honesty for every action.
   */
  const [failed, setFailed] = useState<string | null>(null);

  const act = (affordance: Affordance, args?: Record<string, unknown>): boolean => {
    try {
      preview(affordance, args);
      apply(affordance, args);
      setFailed(null);
      setMenuAt(null);
      return true;
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  const kinds = [
    ...new Set(
      selection.flatMap((id) => {
        const node = store.graph.getNode(id);
        return node ? [node.kind] : [];
      }),
    ),
  ];

  /*
   * WHAT THE SELECTION IS ABOUT, including a district.
   *
   * `kinds` above reads the selection's NODES, so a selected kind card — a
   * district, which has no node behind it — came out empty, and a pane with
   * every act withheld said "Nothing you may do with this mix of kinds"
   * about one district plainly named Owners. The card's own id knows the
   * kind; the badge stays off, because the title is already the plural.
   */
  const subjectKinds =
    kinds.length > 0
      ? kinds
      : [...new Set(selection.flatMap((id) => kindsOf(id)))];

  /*
   * A selected LINE. The pane's job flips from "what is this thing" to
   * "what is this relation": the declaration's own sentence for the edge,
   * both ends as pressable names, and the derived actions below — which
   * the schema provider has already pointed at this exact edge.
   */
  const edge = selection.length === 1 ? edgeOfSelection(selection[0]!) : null;
  const edgeEnds = edge
    ? { from: store.graph.getNode(edge.from), to: store.graph.getNode(edge.to) }
    : null;
  /*
   * The heading already reads the relation from its declaring end ("Where
   * they work"); what is left to say is how it reads from the other end —
   * "From North lot: who works here" — and nothing when that was not declared.
   */
  const edgeSaid = edge
    ? (() => {
        const declared = (store.schema.tryDefinition(store.graph.getNode(edge.from)?.kind ?? "")?.edges as
          | Record<string, { inverse?: string }>
          | undefined)?.[edge.kind];
        const far = store.graph.getNode(edge.to);
        return declared?.inverse && far ? `From ${nameOf(store, far.id)}: ${declared.inverse}` : null;
      })()
    : null;

  useEffect(() => {
    setPending(null);
    setExpanded(false);
    setAllWithheld(false);
    setFailed(null);
    setQuery("");
  }, [selection]);

  /*
   * The strip reserves NOTHING. It is a transient elevated surface, and it
   * floats in front of the scene the way a menu floats in front of a page —
   * with the elevation drawn honestly, so covering reads as "nearer", not as
   * a collision. Reserving a permanent band of the scene's height for it
   * squeezed every band on every screen for chrome that mostly is not there,
   * and insetting only while something is selected would reflow the picture
   * under a double-click. Floating is the only answer that moves nothing.
   */

  /*
   * A menu at the pointer closes the way a menu does. The strip does not —
   * it is not covering anything and clearing the selection is what the × is
   * for.
   */
  useEffect(() => {
    if (!menuAt) return;
    const away = () => setMenuAt(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAt(null);
    };
    // A frame later, or the click that opened it closes it again.
    const timer = setTimeout(() => document.addEventListener("mousedown", away), 0);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [menuAt, setMenuAt]);

  const atPointer = menuAt !== null;
  /*
   * In the companion's rail the pane is a SECTION, and the pointer popover
   * belongs to the copy mounted for it: drawing both would put the acts on
   * screen twice, once in the rail and once under the pointer.
   */
  const railed = placement === "rail" && !atPointer;
  const standDown = (placement === "rail" && atPointer) || (placement === "menu" && !atPointer);

  /*
   * Whether the picture has room for a rail beside it. Measured from the
   * scene's own box, not the window's: an embed in a column of an article is
   * narrow on the widest monitor there is.
   */
  const RAIL_NEEDS = 14 + 236 + 14 + 300;
  const narrow = (box?.width ?? Number.POSITIVE_INFINITY) < RAIL_NEEDS;

  /*
   * IN A NARROW BOX THE PICTURE MAKES ROOM.
   *
   * Floating is the right answer where there is ground to float over. In a
   * 350-wide Graview — an embed in a column of an article, or a phone —
   * there is none: a sheet along the bottom covers the districts and buries
   * the control that opens one, and a rail down the side covers the very
   * card it is about. So the scene's own box loses the sheet's height while
   * the sheet is open, and the layout re-runs into what is left.
   *
   * The old objection to insetting was that it reflows the picture under a
   * double-click. It does — once, when the sheet appears, and once when it
   * goes. Against chrome permanently over the content, that is the better
   * trade, and it is what every narrow interface already does.
   */
  useLayoutEffect(() => {
    const parent = asideRef.current?.offsetParent as HTMLElement | null;
    // In the companion's rail the companion makes the room, for the whole sheet it is part of.
    if (!parent || !narrow || atPointer || placement === "rail") return;
    const height = asideRef.current?.getBoundingClientRect().height ?? 0;
    const room = `${Math.round(height) + 20}px`;
    if (parent.style.paddingBottom === room) return;
    const before = parent.style.paddingBottom;
    parent.style.paddingBottom = room;
    return () => {
      parent.style.paddingBottom = before;
    };
  });


  /*
   * NOTHING CHOSEN, NOTHING TO SAY — as a floating strip. In the rail the
   * pane is a section of a panel that is about SOMETHING at all times: the
   * subject is the place you are looking at when you have chosen nothing,
   * and the acts that begin a kind are exactly what belongs under its name
   * there. So the rail draws whatever the derivation offers for the
   * subject, and stands down only when that is empty too.
   */
  if (selection.length === 0 && (placement !== "rail" || focus === undefined)) return null;

  /*
   * Whether the strip should say what is selected.
   *
   * It should not when the page you are looking at IS that thing: the document
   * has a heading, and the same string twice on one screen reads as a mistake
   * even when both are correct. The same holds after travelling — the focus
   * panel already carries the name at full size, and the strip repeating it
   * from the bottom of the window read as a stale leftover of the previous
   * stop.
   */
  /*
   * And in the companion the header above already names the subject, so a
   * chip saying "0 selected" under it is the same mistake from the other
   * direction: the rail is one panel about one thing, said once.
   */
  const named = !(selection.length === 1 && selection[0] === view.focusId) && placement !== "rail";

  /*
   * Nine rows before "Show N more", and the ranking has already put what
   * answers the current question first — which is what makes hiding the
   * tail honest. Everything past nine scrolls inside the pane's own box
   * once shown.
   */
  const fits = Math.max(1, Math.min(9, affordances.length));

  /*
   * ORDERED FOR READING, not only for ranking: what a broken rule demands,
   * then the acts somebody PINNED (the person's own before the app's — a
   * small fixed head-section), then what you can do to the THING, then its
   * TIES (the connects/severs acts, gathered under one heading instead of
   * shuffled among the rest), then — always last — what cannot be taken
   * back. Repairs first and destructive last are inviolate; pins and usage
   * only ever shuffle inside those walls.
   */
  const arranged = [
    ...affordances.filter((entry) => entry.provider === "invariant" && !entry.destructive),
    ...affordances.filter(
      (entry) => entry.pinned && entry.provider !== "invariant" && !entry.destructive,
    ),
    ...affordances.filter(
      (entry) => !entry.ties && !entry.destructive && !entry.pinned && entry.provider !== "invariant",
    ),
    ...affordances.filter(
      (entry) => entry.ties && !entry.destructive && !entry.pinned && entry.provider !== "invariant",
    ),
    ...affordances.filter((entry) => entry.destructive),
  ];
  /*
   * THE SEARCHER filters the same derived list — by label and by why, the
   * two sentences a person actually reads — and appears only when the list
   * outgrows the fold. Enter runs a sole survivor; Escape clears.
   */
  const searchable = arranged.length > fits && !atPointer;
  const trimmedQuery = query.trim().toLowerCase();
  const matched =
    searchable && trimmedQuery.length > 0
      ? arranged.filter((entry) =>
          `${entry.label} ${entry.why}`.toLowerCase().includes(trimmedQuery),
        )
      : null;
  const shown = matched ?? (expanded || atPointer ? arranged : arranged.slice(0, fits));
  const hidden = matched ? 0 : arranged.length - shown.length;
  /*
   * GROUPED BY WHAT THEY ANSWER. A repair arrives carrying the violation
   * that produced it, and without that sentence over it, "Cut X from
   * Thursday" offered on a selection of Y reads as a non sequitur. The
   * ranked order is untouched — consecutive repairs of one violation
   * gather under its sentence; everything else runs on below.
   */
  const sections: {
    heading: string | null;
    tone: "violation" | "ties" | null;
    items: typeof affordances;
  }[] = [];
  for (const affordance of shown) {
    const violation = !atPointer && affordance.provider === "invariant";
    const held = !atPointer && !violation && affordance.pinned !== undefined && !affordance.destructive;
    const tie = !atPointer && !violation && !held && affordance.ties === true && !affordance.destructive;
    const heading = violation ? affordance.why : held ? "pinned" : tie ? "its ties" : null;
    const tone = violation ? ("violation" as const) : held || tie ? ("ties" as const) : null;
    const last = sections[sections.length - 1];
    if (last && last.heading === heading) (last.items as Affordance[]).push(affordance);
    else sections.push({ heading, tone, items: [affordance] });
  }
  const open = affordances.find((affordance) => affordance.id === pending);

  /*
   * An observation that OPENS by restating the name is trimmed, not dropped.
   *
   * The strip read "Pay the deposit · task · \"Pay the deposit\" was due
   * 2026-08-28" — the same four words twice in one line, three inches apart,
   * which reads as a rendering fault rather than as two facts. The fact in it
   * is the date, and that is worth keeping; only the restatement goes. A name
   * appearing mid-sentence is left alone, because there it is doing work.
   */
  const title = selection.length === 1 ? nameOf(store, selection[0]!) : null;
  const trim = (text: string): string => {
    if (!title) return text;
    // Quoted or bare: a sentence that OPENS by restating the selected
    // name says it again three inches under the title.
    const restated = text.startsWith(`"${title}"`)
      ? text.slice(title.length + 2)
      : text.startsWith(title)
        ? text.slice(title.length)
        : null;
    if (restated === null) return text;
    const rest = restated.trimStart();
    return rest.length === 0 ? text : rest[0]!.toUpperCase() + rest.slice(1);
  };
  /*
   * A violation is stated ONCE. The invariant provider hands its message
   * out twice — as an observation, and as the `why` on every repair — so
   * whenever the repairs' own ⚠ heading is on screen, the observation
   * restating it is dropped. Where the heading is not shown (the pointer
   * menu, a violation whose repairs fell past the fold), the observation
   * remains the one statement of the trouble.
   */
  const headed = new Set(
    atPointer
      ? []
      : shown
          .filter((affordance) => affordance.provider === "invariant")
          .map((affordance) => affordance.why),
  );
  const said = observations
    .filter((observation) => !headed.has(observation.text))
    .map((observation) => ({ ...observation, text: trim(observation.text) }));

  if (standDown) return null;
  return (
    <aside
      ref={asideRef}
      aria-label="Inspector"
      // Chrome, not scene: the ties layer must never anchor a line to the
      // node names this pane repeats.
      data-graview-offstage=""
      data-testid={atPointer ? "context-menu" : "inspector-strip"}
      // Focusable only programmatically: the fallback home when the act
      // somebody was standing on is no longer offered.
      tabIndex={-1}
      onFocus={(event) => remember(event.target as HTMLElement)}
      onBlur={(event) => {
        // Somewhere else to go means they went there on purpose.
        if (event.relatedTarget !== null) keptFocus.current = null;
      }}
      onMouseDown={(event) => event.stopPropagation()}
      style={railed ? {
        // In the rail the companion owns the frame: this is a section of it.
        position: "static",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 7,
      } : {
        position: "absolute",
        /*
         * Above the jacked-in page, not only above the scene.
         *
         * Lifting a view out to read it left you with no way to act on it —
         * the strip was behind the full page, so a jacked-in node was
         * read-only by accident. The actions are the same derived ones; only
         * the backdrop changed.
         */
        zIndex: 60,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "9px 12px",
        borderRadius: "var(--graview-radius, 12px)",
        border: "1px solid var(--graview-edge)",
        background: "var(--graview-float)",
        // The high lift on both faces: the strip floats in FRONT of the
        // scene now rather than beside it in reserved room, and the shadow
        // is what makes covering read as "nearer" instead of as a collision.
        boxShadow: "var(--graview-lift-high)",
        ...(atPointer
          ? {
              // Clamped so a right click near an edge does not open a menu
              // half off the screen.
              left: Math.min(menuAt.x - (box?.left ?? 0), Math.max(8, (box?.width ?? window.innerWidth) - 320)),
              top: Math.min(menuAt.y - (box?.top ?? 0), Math.max(8, (box?.height ?? window.innerHeight) - 260)),
              width: 300,
              maxHeight: "min(52cqh, 420px)",
              overflow: "auto",
            }
          : narrow
            ? {
                /*
                 * A RAIL NEEDS A GUTTER. 14 + 236 + 14 of rail beside a
                 * picture that still wants three hundred pixels of its own
                 * is six hundred and twenty before anything is drawn — and
                 * a Graview in a column of an article, or at 390, has
                 * neither. The rail went straight over the focus: measured
                 * in a 350-wide embed, the pane covered 85% of the card it
                 * was about, and a click meant for the picture landed on
                 * "Close it".
                 *
                 * Along the bottom instead, full width, which is where a
                 * narrow interface has always put this. It still floats —
                 * the shadow says "nearer" — and it still scrolls inside
                 * itself.
                 */
                left: 10,
                right: 10,
                width: "auto",
                // Along the bottom, below the picture rather than over it:
                // the scene's box has given up this much room above.
                bottom: 10,
                maxHeight: "min(42cqh, 300px)",
                overflow: "auto",
              }
            : {
              /*
               * The left rail. Under the bar; in the Graview the relation
               * key holds the top of the rail, so the pane starts below it.
               * Everything past the viewport scrolls inside the pane.
               */
              left: 14,
              // Under the relation key in the Graview; under the bar's edge
              // otherwise — measured from the scene's own top, and no lower
              // than a short box can afford.
              top: view.overview ? "min(296px, 38cqh)" : 44,
              // Inside the gutter beside a 1040-wide centred focus at the
              // surveyed width, so the pane sits NEXT to the picture rather
              // than on its title.
              width: 236,
              /*
               * The pane stops ABOVE the raised band (plane 1 begins at 68%
               * of the stage) and scrolls inside itself: a tall list of
               * repairs must not buy its height with the first raised card.
               */
              maxHeight: view.overview ? "calc(100cqh - min(296px, 38cqh) - 20px)" : "calc(68cqh - 94px)",
              overflow: "auto",
            }),
      }}
    >
      {/*
        * The heading row disappears entirely when it would hold nothing but
        * the dismiss control. An empty bar with one × in it reads as a
        * rendering that lost its contents.
        */}
      <div
        style={{
          display: named || !atPointer ? "flex" : "none",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "2px 8px",
          minWidth: 0,
          // Room for the dismiss control pinned to the pane's corner.
          paddingRight: atPointer || railed ? 0 : 24,
        }}
      >
        {/*
          * The name, unless the page you are on is already that name.
          *
          * Jacked into one thing, the header says what it is and the strip
          * said it again three inches below — and the same string twice on one
          * screen reads as a mistake even when both are correct. What the
          * strip is FOR here is the actions.
          */}
        {!named ? null : (
          <>
            <strong style={{ fontSize: "0.9375rem", whiteSpace: "nowrap" }}>
              {selection.length === 1
                ? nameOf(store, selection[0]!)
                : `${selection.length} selected`}
            </strong>
            {kinds.length > 0 || edge ? (
              <span
                style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)", whiteSpace: "nowrap" }}
              >
                {edge ? "relation" : kinds.join(" · ")}
              </span>
            ) : null}
            {/* The onward gesture, said at the moment it applies — picking a
                thing is exactly when "how do I go into it" arises, and the
                jacked-in header was the one place that answered, which is
                after you had already found out. */}
            {selection.length === 1 && !edge ? (
              <span
                style={{ fontSize: "0.75rem", color: "var(--graview-ink-faint)", whiteSpace: "nowrap" }}
              >
                {/* Said for the state the thing is in: on a district already
                    opened, the same gesture closes it. */}
                {view.expanded.includes(selection[0]!) ? "· double-click closes" : "· double-click opens"}
              </span>
            ) : null}
          </>
        )}

        <span style={{ flex: "1 1 auto" }} />

        {/* A menu needs no close control — Escape, click-away and choosing an
            action all close it, and a × in a context menu reads as a dialog
            that lost its way. The docked strip keeps it: clearing the
            selection is a real act there. */}
      </div>
      {/* And in the rail the × belonged to a pane that could be dismissed; this
          one cannot — the companion is always there, and its subject follows
          you whether or not anything is chosen. */}
      {atPointer || railed ? null : (
        <button
          type="button"
          onClick={() => {
            setMenuAt(null);
            clear();
          }}
          aria-label="Clear selection"
          title="Clear selection"
          // Pinned to the pane's corner: a real 24px target that a narrow
          // header cannot push off the edge.
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            flex: "0 0 auto",
            width: 24,
            height: 24,
            display: "grid",
            placeItems: "center",
            padding: 0,
            fontSize: "0.875rem",
            lineHeight: 1,
            borderRadius: 7,
          }}
        >
          ×
        </button>
      )}

      {/*
        * A selected relation says WHAT IT MEANS — the declaration's own
        * sentence — and offers both of its ends as the next place to stand.
        */}
      {edge && edgeEnds ? (
        <div style={{ display: "grid", gap: 6 }}>
          {edgeSaid ? (
            <p
              data-testid="edge-said"
              style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-ink-muted)" }}
            >
              {edgeSaid}
            </p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {([
              ["from", edgeEnds.from],
              ["to", edgeEnds.to],
            ] as const).map(([which, end], index) => (
              <Fragment key={which}>
                {index === 1 ? (
                  <span aria-hidden="true" style={{ color: "var(--graview-ink-faint)" }}>
                    →
                  </span>
                ) : null}
                {end ? (
                  <button
                    type="button"
                    data-testid={`edge-${which}`}
                    onClick={() => set([end.id])}
                    title={`Select ${nameOf(store, end.id)}`}
                    style={{ fontSize: "0.8125rem", padding: "3px 9px", borderRadius: 999 }}
                  >
                    {nameOf(store, end.id)}
                  </button>
                ) : (
                  <span style={{ fontSize: "0.8125rem", color: "var(--graview-ink-faint)" }}>gone</span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}

      {/* What is true about it. The pane has the room to say the whole
          sentence; anything beyond the first two stays a count with the
          full list in the tooltip. */}
      {said.length > 0 ? (
        <div
          data-testid="observations"
          title={said.map((observation) => observation.text).join("\n")}
          style={{ display: "grid", gap: 3 }}
        >
          {said.slice(0, 2).map((observation) => (
            <p
              key={observation.id}
              style={{
                margin: 0,
                fontSize: "0.8125rem",
                lineHeight: 1.45,
                color: "var(--graview-ink-muted)",
              }}
            >
              {observation.text}
              {observation === said[1] && said.length > 2 ? (
                <span style={{ color: "var(--graview-ink-faint)" }}> +{said.length - 2}</span>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}

      {failed ? (
        <p
          data-testid="refused"
          style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-warn)" }}
        >
          {failed}
        </p>
      ) : null}

      {searchable ? (
        <input
          data-testid="action-filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${arranged.length} actions…`}
          aria-label="Filter actions"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Clearing the filter must not also clear the selection —
              // the document-level Escape stays out of it either way.
              event.stopPropagation();
              if (query.length > 0) setQuery("");
              // An empty field releases the key: blurred, the NEXT Escape
              // reaches the product-wide back-out instead of dying here.
              else event.currentTarget.blur();
              return;
            }
            if (event.key === "Enter" && matched?.length === 1) {
              const sole = matched[0]!;
              // What cannot be taken back is never one generic keystroke:
              // the destructive tail keeps requiring the aimed click.
              if (sole.destructive) return;
              if (sole.open.length > 0) setPending(sole.id);
              else if (act(sole)) setQuery("");
            }
          }}
          style={{
            font: "inherit",
            fontSize: "0.875rem",
            padding: "5px 9px",
            borderRadius: 8,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-panel)",
            color: "var(--graview-ink)",
          }}
        />
      ) : null}
      {matched !== null && matched.length === 0 ? (
        <p
          data-testid="no-matches"
          style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-ink-muted)" }}
        >
          Nothing offered here matches “{query.trim()}”.
        </p>
      ) : null}
      {affordances.length === 0 && !waiting ? (
        /*
         * An empty action list is a RESULT, not a blank space. Saying which
         * kind has no mutations declaring it as a subject is the same honesty
         * the check CLI gives an agent, pointed at a person.
         *
         * Except when the derivation has already said something truer: an
         * act that exists and cannot act YET — "Place a feature" cannot
         * begin until there is a zone — is not "no mutation declares it as a
         * subject", and saying both would be saying one wrong thing loudly.
         */
        <p
          data-testid="no-affordances"
          style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.45, color: "var(--graview-ink-muted)" }}
        >
          {withheld.length > 0
            ? // "Nothing can be done" would be a lie here: things can be
              // done, by somebody else. Which is a different sentence.
              `Nothing you may do with ${
                edge
                  ? "this relation"
                  : subjectKinds.length === 1
                    ? withArticle(nounOf(store.schema.tryDefinition(subjectKinds[0]!), subjectKinds[0]!))
                    : "this mix of kinds"
              } — ${withheld.length} action${withheld.length === 1 ? "" : "s"} withheld.`
            : edge
              ? `Nothing can be done with this line yet — nothing this app declares makes or breaks “${store.schema.edge(edge.kind)?.description ?? humaniseField(edge.kind).toLowerCase()}”.`
              : `Nothing can be done with ${
                  subjectKinds.length === 1 ? withArticle(nounOf(store.schema.tryDefinition(subjectKinds[0]!), subjectKinds[0]!)) : "this mix of kinds"
                } yet — nothing this app declares acts on ${subjectKinds.length === 1 ? "it" : "them"}.`}
        </p>
      ) : (
        <ol
          data-testid="affordances"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            // A pane and a menu both read as a column. Same list, same
            // components, same order.
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: 2,
          }}
        >
          {sections.map((section, index) => (
            <Fragment key={`${section.heading ?? "plain"}-${index}`}>
              {/* The violation these repairs answer, said over them — or,
                  for the tie group, a quiet caption: a heading is not a
                  warning unless a rule is actually broken. */}
              {section.heading ? (
                // A real list item, not a presentational one: a list whose
                // direct child has no list-item role is invalid to assistive
                // technology (axe's "list" rule), and the heading is content —
                // the finding these repairs answer is exactly what a screen
                // reader should hear before them.
                <li
                  data-graview-heading={section.tone}
                  style={{
                    fontSize: "0.75rem",
                    lineHeight: 1.4,
                    color:
                      section.tone === "violation"
                        ? "var(--graview-warn)"
                        : "var(--graview-ink-faint)",
                    ...(section.tone !== "violation"
                      ? { letterSpacing: "0.12em", textTransform: "uppercase" as const, fontSize: "0.75rem" }
                      : {}),
                    padding: "2px 2px 1px",
                    marginTop: index > 0 ? 6 : 0,
                  }}
                >
                  {section.tone === "violation" ? "⚠ " : ""}
                  {section.tone === "violation" ? trim(section.heading) : section.heading}
                </li>
              ) : index > 0 ? (
                <li
                  aria-hidden="true"
                  style={{ borderTop: "1px solid var(--graview-edge)", margin: "6px 0 3px" }}
                />
              ) : null}
              {section.items.map((affordance) => (
                <li key={affordance.id} style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
                  <button
                    type="button"
                    data-affordance={affordance.id}
                    /*
                     * Where the derivation put it. The sections regroup the
                     * list — pinned, its ties, the broken rule's own — so
                     * the row's place on screen is not the rank, and only
                     * the rank can say whether this pane and the record
                     * page agree about what leads.
                     */
                    data-rank={affordance.rank}
                    data-graview-destructive={affordance.destructive || undefined}
                    aria-pressed={pending === affordance.id}
                    title={affordance.why}
                    style={{
                      padding: "5px 10px",
                      fontSize: "0.875rem",
                      borderRadius: 8,
                      width: "100%",
                      textAlign: "left",
                      /*
                       * In the pane an action looks PRESSABLE — border and
                       * ground, like every other button in the product. Rows
                       * of bare text read as a list of remarks, and nobody
                       * presses a remark. The pointer menu keeps menu rows;
                       * a menu's own frame already says "choose one".
                       */
                      // Longhands, always present: a `border` shorthand with a
                      // `borderColor` that comes and goes as the act is
                      // opened and applied is a React warning on every
                      // rerender, and the colour is the only part that moves.
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor:
                        pending === affordance.id
                          ? "var(--graview-accent)"
                          : atPointer
                            ? "transparent"
                            : "var(--graview-edge)",
                      background: atPointer ? "none" : "var(--graview-panel)",
                      boxShadow: "none",
                      // What cannot be taken back says so before it is
                      // pressed — and the ranking has already put it last.
                      ...(affordance.destructive ? { color: "var(--graview-warn)" } : {}),
                      ...(pending === affordance.id ? { color: "var(--graview-accent)" } : {}),
                    }}
                    onClick={() => {
                      if (affordance.open.length > 0) {
                        setPending(pending === affordance.id ? null : affordance.id);
                        return;
                      }
                      act(affordance);
                    }}
                  >
                    {affordance.label}
                    {affordance.open.length > 0 ? (
                      <span style={{ color: "var(--graview-ink-faint)" }}> …</span>
                    ) : null}
                    {matched?.length === 1 &&
                    matched[0]?.id === affordance.id &&
                    !affordance.destructive ? (
                      // The searcher's promise, made visible exactly when
                      // it holds: Enter runs the one act left standing.
                      <span
                        aria-hidden="true"
                        title="Enter runs it"
                        style={{ float: "right", color: "var(--graview-ink-faint)", fontSize: "0.75rem" }}
                      >
                        ↵
                      </span>
                    ) : null}
                  </button>
                  {/*
                    * The other hand on the pin. The dev pinned an act by
                    * declaring it; this is the person's side of the same
                    * fact, kept in their browser, outranking the dev's.
                    * Unpinning is the same gesture.
                    */}
                  <button
                    type="button"
                    data-testid="pin-toggle"
                    data-pin-for={affordance.mutation}
                    aria-pressed={affordance.pinned !== undefined}
                    aria-label={
                      affordance.pinned !== undefined
                        ? `Unpin ${affordance.label}`
                        : `Pin ${affordance.label}`
                    }
                    title={
                      affordance.pinned === "declared"
                        ? "Pinned by the app — unpin it for yourself"
                        : affordance.pinned === "user"
                          ? "Unpin"
                          : "Pin to the top"
                    }
                    onClick={() =>
                      setPins(togglePin(pins, affordance.mutation, declaredPins.has(affordance.mutation)))
                    }
                    style={{
                      flex: "0 0 auto",
                      width: 24,
                      minHeight: 24,
                      display: "grid",
                      placeItems: "center",
                      padding: 0,
                      fontSize: "0.75rem",
                      border: "1px solid transparent",
                      background: "none",
                      boxShadow: "none",
                      borderRadius: 7,
                      /*
                       * WHOSE pin, said in the ink: the person's in the
                       * accent, the app's in quiet body ink. Two filled
                       * stars in one colour left no way to tell which pin
                       * was yours to regret.
                       */
                      color:
                        affordance.pinned === "user"
                          ? "var(--graview-accent)"
                          : affordance.pinned === "declared"
                            ? "var(--graview-ink-muted)"
                            : "var(--graview-ink-faint)",
                    }}
                  >
                    {affordance.pinned !== undefined ? "★" : "☆"}
                  </button>
                </li>
              ))}
            </Fragment>
          ))}
          {hidden > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                // What it DOES, not what is behind it. "+9 more" is a label
                // on a quantity; this is a control, and a control says what
                // pressing it will do.
                title={`Show all ${affordances.length} actions`}
                style={{ padding: "4px 10px", fontSize: "0.875rem", borderRadius: 8 }}
              >
                Show {hidden} more
              </button>
            </li>
          ) : null}
        </ol>
      )}

      {/*
        * Actions you may not take are SHOWN, disabled, with the reason.
        *
        * Hiding them teaches people the software is broken — they saw a
        * colleague do this yesterday and now the button is gone, so the
        * software is unreliable rather than the permission being deliberate.
        * The framework already treats an empty action list as a result and
        * explains it; this is the same honesty pointed at a different cause.
        */}
      {withheld.length > 0 ? (
        <ul
          data-testid="withheld"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            flexWrap: "nowrap",
            gap: 2,
          }}
        >
          {withheld.slice(0, atPointer || allWithheld ? withheld.length : 3).map((action) => (
            <li key={action.id} style={{ display: "grid", gap: 2 }}>
              <button
                type="button"
                disabled
                data-affordance={action.id}
                data-rank={action.rank}
                data-withheld={action.refusal.wouldNeed.join(",") || "nobody"}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.875rem",
                  borderRadius: 8,
                  borderStyle: "dashed",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                }}
              >
                <s>{action.label}</s>
              </button>
              {/*
                * THE REASON, OUT LOUD. It was a `title` on a DISABLED button
                * — which cannot be focused, so a keyboard had no way to ask
                * and a pointer had to hover a dead control to find out. The
                * pages face has always said the sentence in the open; this
                * is the same sentence, in the same place as the strike.
                */}
              <span
                data-testid="withheld-why"
                style={{
                  fontSize: "0.8125rem",
                  lineHeight: 1.4,
                  color: "var(--graview-ink-muted)",
                  padding: "0 10px",
                }}
              >
                {action.refusal.message}
              </span>
            </li>
          ))}
          {/*
            * NOT HIDDEN, THEN. The rail showed the first three withheld acts
            * and dropped the rest without a word: a producer standing on a
            * song saw three struck through and could not learn that seven
            * more were the artist's.
            */}
          {!atPointer && !allWithheld && withheld.length > 3 ? (
            <li>
              <button
                type="button"
                data-testid="withheld-more"
                onClick={() => setAllWithheld(true)}
                title={`Show all ${withheld.length} actions this seat may not take`}
                style={{ padding: "4px 10px", fontSize: "0.875rem", borderRadius: 8 }}
              >
                Show {withheld.length - 3} more withheld
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* The arguments appear in place, under the action that asked for them,
          rather than turning the strip into a form. */}
      {open ? (
        <AnswerArgs
          affordance={open}
          // On a refusal the prompt stays put with the reason beside it, so
          // a rejected answer can be corrected rather than retyped blind.
          onApply={(args) => {
            if (act(open, args)) setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </aside>
  );
}
