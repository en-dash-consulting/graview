import { labelOf, nounOf } from "@graview/core";
import { mixStyles, styleFor, transformFor, hueFor } from "@graview/render";
import {
  useEffect,
  useRef,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { ActivityMark } from "./activity.js";
import { useGraview } from "./context.js";
import { pickedFrom, usePickTargets } from "./picking.js";
import { WHO } from "./where-drawn.js";
import { cssTransform, planeShadow } from "./scene-helpers.js";
import type { SceneNode } from "./scene-root.js";

interface HostProps {
  readonly node: SceneNode;
  readonly useDom: boolean;
  readonly touched: boolean;
  /** From altitude: how far below this box's top the plot's front vertex lies, so the nameplate can stand there as a signpost. */
  readonly frontY?: number;
  /** From altitude: how far below this box's top the plot's centre lies, where the landmark stands in the square. */
  readonly centreY?: number;
  /** From altitude: this box is the focused place's screen, a billboard on its plot. */
  readonly screen?: boolean;
  /** For a screen: how tall the lens actually drew in its natural box, so the billboard can be cut to it. */
  onDrawnHeight?(height: number | undefined): void;

  /** Too narrow for its plane's fidelity; rendering its glyph instead. */
  readonly crowded?: boolean;
  /** What just happened here, if anything. Absent on a quiet graph. */
  readonly activity?: ActivityMark;
  readonly scheme: "light" | "dark";
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly selected: boolean;
  onSelect(additive: boolean): void;
  /** A view marked an inner element with `data-graview-pick`. */
  onPick(id: string, additive: boolean): void;
  /** The deliberate second gesture: go into the thing that was picked. */
  onTravel(id: string): void;
  /**
   * Ask for the actions at a point, in viewport coordinates, naming what the
   * gesture landed on so the list can lead with it.
   */
  onMenu(at: { x: number; y: number; on?: string }): void;
  /** The whole selection, so the keyboard can tell a first press from a second. */
  readonly selection: readonly string[];
  onJackIn(): void;
  /** Dragging a card pins it. The scene owns the gesture; the host reports it. */
  onDragStart(event: ReactPointerEvent<HTMLElement>): void;
  onDragMove(event: ReactPointerEvent<HTMLElement>): void;
  onDragEnd(): void;
  /** True for the instant after a drag, so the click it produces is ignored. */
  readonly swallowClick: { current: boolean };
  readonly children: ReactNode;
}

/**
 * One view's box. Absolutely positioned so the canvas can place it, and sized
 * so the capture texture matches the DOM exactly.
 */
export function SceneViewHost({
  node,
  useDom,
  touched,
  frontY,
  centreY,
  screen,
  onDrawnHeight,
  crowded,
  activity,
  scheme,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onPick,
  onTravel,
  onMenu,
  selection,
  onJackIn,
  onDragStart,
  onDragMove,
  onDragEnd,
  swallowClick,
  children,
}: HostProps) {
  // The tag's dot must agree with every other dot in a branded app.
  const { brand: hostBrand, store: hostStore, actsDoor } = useGraview();
  /*
   * The name a screen reader reads for this box: the group's plural, or the
   * node's own label — never the id, which is an address.
   */
  const hostName = node.beyond
    ? /* Not a thing in the graph: the row saying what it could not hold. */
      `${node.beyond.length} more district${node.beyond.length === 1 ? "" : "s"}`
    : node.aggregate?.opens?.in === "place"
    ? /* A band's group is heard with its count: "Single, 80 albums". */
      `${node.aggregate.label}, ${node.aggregate.memberIds.length} ${node.aggregate.memberIds.length === 1 ? node.aggregate.kind.replace(/-/g, " ") : (hostStore.schema.tryDefinition(node.aggregate.kind)?.plural ?? `${node.aggregate.kind}s`).toLowerCase()}`
    : node.aggregate
    ? node.aggregate.label
    : (() => {
        const graphNode = hostStore.graph.getNode(node.id);
        if (!graphNode) return node.id;
        return labelOf(hostStore.schema.tryDefinition(node.kind), graphNode as never);
      })();
  /*
   * The tag hugs the PANEL, not the band slot. A host flex-centres a
   * panel shorter than its slot, so a fixed top offset hung the tag in
   * open ground above the card it names — measured against the drawn
   * child instead, the same lesson every measured surface here learned.
   */
  const [tagAt, setTagAt] = useState<{ top: number; right: number } | null>(null);
  const tagged = Math.round(node.plane) === 0 && !node.aggregate;
  /*
   * Measured when the panel's SIZE changes, not on every render — from the
   * observer, when the layout is already clean, so the reads are free.
   *
   * It ran after every render and read two bounding boxes, and a host
   * renders every frame of a transition — so every frame forced the browser
   * to lay the whole scene out before it could paint it (docs/scale.md, a
   * third of the frame landing on a hub). An observer reports once when it
   * starts watching, after layout and before paint, so the tag is placed
   * in its first frame without forcing one.
   */
  useLayoutEffect(() => {
    if (!tagged) return;
    const host = ref.current;
    if (!host) return;
    const place = () => {
      /*
       * The PANEL, never the tag itself.
       *
       * `firstElementChild` was the drawn panel right up until the view had
       * nothing to draw — a focus on a node an act had just removed — and
       * then the tag was the only child, so this measured the tag against
       * its own host and moved it by the offset below, every render, until
       * React gave up with "Maximum update depth exceeded" and blanked the
       * page. A measurement that can read its own output has to say which
       * child it means.
       */
      const child = [...host.children].find(
        // An empty data attribute reads as "", so presence is the question.
        (element) => (element as HTMLElement).dataset["graviewKindtag"] === undefined,
      ) as HTMLElement | undefined;
      if (!child) return;
      /*
       * Drawn boxes, in the host's own units. Offsets would ignore the
       * natural box's centring and shrink (the stamp at altitude) and land
       * the tag mid-card; a box difference includes them, and dividing by
       * the host's drawn scale takes the plane's scale back out.
       */
      const hostBox = host.getBoundingClientRect();
      const childBox = child.getBoundingClientRect();
      const scale = host.offsetWidth > 0 ? hostBox.width / host.offsetWidth : 1;
      const next = {
        top: Math.round((childBox.top - hostBox.top) / scale) - 9,
        right: Math.round((hostBox.right - childBox.right) / scale) + 14,
      };
      setTagAt((current) =>
        current && current.top === next.top && current.right === next.right ? current : next,
      );
    };
    if (typeof ResizeObserver === "undefined") {
      place();
      return;
    }
    const watch = new ResizeObserver(place);
    watch.observe(host);
    for (const element of host.children) watch.observe(element);
    return () => watch.disconnect();
  }, [tagged, node.id]);
  /*
   * A node's depth is its plane, pulled forward by however near it sits
   * within that plane.
   *
   * Mid-transition a plane is already fractional so the treatment is mixed
   * rather than snapping, and `depth` uses the same machinery: a card at the
   * near end of the arc is treated as 1.6 planes back rather than 2, which is
   * what makes the arc curve away instead of lying flat.
   */
  const at = node.plane - (1 - (node.depth ?? 1)) * 0.55;
  const lower = Math.max(0, Math.min(2, Math.floor(at))) as 0 | 1 | 2;
  const upper = Math.max(0, Math.min(2, Math.ceil(at))) as 0 | 1 | 2;
  const style =
    lower === upper
      ? styleFor(lower, scheme)
      : mixStyles(styleFor(lower, scheme), styleFor(upper, scheme), at - lower);
  const transform = transformFor(style, node.x, node.y, canvasWidth, canvasHeight);
  /*
   * The blur is the NEAREST plane's, not a mix. It is under half a pixel,
   * nobody can see it tween, and a filter whose radius changes is a filter
   * repainted — every host, every frame of every transition
   * (docs/scale.md). Snapped, it changes once, halfway.
   */
  const blur = styleFor(Math.max(0, Math.min(2, Math.round(at))) as 0 | 1 | 2, scheme).blur;
  const ref = useRef<HTMLDivElement | null>(null);
  usePickTargets(ref);

  /*
   * A view drawn smaller than it was designed for is SCALED, not re-solved.
   *
   * When the layout gives a node a natural size, the view lays itself out at
   * that size and the whole result is transformed down into the slot. That is
   * the same picture, smaller — which is what a captured texture would do on
   * the GPU path anyway, and what keeps the shrunk interface an interface:
   * every pick target inside it is still a real target, because nothing here
   * is an image.
   *
   * Rendering into the slot instead is what broke it: a coverage matrix asked
   * to lay itself out in a third of its width piled its rotated column
   * headers into a corner and clipped its rows.
   */
  const natural = node.natural;
  const shrink = natural
    ? Math.min(node.width / natural.width, node.height / natural.height)
    : 1;
  /*
   * A BILLBOARD REPORTS ITS PICTURE'S HEIGHT.
   *
   * The lens lays itself out in the natural box, as tall as the window, and
   * a lens is built to fill what it is given: a header, then a scroll
   * region that takes the rest. So neither the box nor the lens's own
   * height says how tall the PICTURE is. What does: the extent of what is
   * in flow, plus what every scroll region inside needs beyond what it has
   * (negative when it has room to spare). From the whole box that comes to
   * header-plus-rows; cut to that, the scroll region holds exactly its
   * rows and the measure is its own fixed point. Watched for size and for
   * content, because rows come and go without anything resizing; withdrawn
   * when this box stops being the screen.
   */
  const naturalRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!screen || !onDrawnHeight) return;
    const box = naturalRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      let extent = 0;
      let wanted = 0;
      for (const child of box.children) {
        if (!(child instanceof HTMLElement) || child.classList.contains("graview-screen-fullscreen")) continue;
        extent = Math.max(extent, child.offsetTop + child.offsetHeight);
        for (const el of [child, ...child.querySelectorAll<HTMLElement>("*")]) {
          const overflow = getComputedStyle(el).overflowY;
          if (overflow === "auto" || overflow === "scroll") wanted += el.scrollHeight - el.clientHeight;
        }
      }
      onDrawnHeight(extent + wanted);
    };
    let queued = 0;
    const later = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        measure();
      });
    };
    measure();
    const sizes = new ResizeObserver(later);
    sizes.observe(box);
    for (const child of box.children) sizes.observe(child);
    const content = new MutationObserver(later);
    content.observe(box, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => {
      if (queued) cancelAnimationFrame(queued);
      sizes.disconnect();
      content.disconnect();
      onDrawnHeight(undefined);
    };
  }, [screen, onDrawnHeight, node.id]);

  const domOnly: CSSProperties = useDom
    ? {
        transform: cssTransform(transform),
        transformOrigin: "0 0",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        // Recession dims toward the ground; entering and leaving nodes carry
        // their own fade on top of it.
        opacity: (1 - style.falloff * 0.55) * (node.opacity ?? 1),
        /*
         * Depth is handed DOWN as the elevation token, not painted on the
         * host.
         *
         * A host box-shadow outlines the box the layout allotted, which is
         * only the same shape as the view when the view fills it. Once a
         * detail panel sized to its own content, every focused node picked
         * up a large ghost rectangle behind it. Setting the token means the
         * panel casts the plane's shadow from its own edges — and any view
         * built on `Panel` gets it without knowing planes exist.
         */
        ["--graview-lift-low" as string]: planeShadow(style.shadow, scheme),
        ...(frontY !== undefined ? { ["--graview-front-y" as string]: `${frontY.toFixed(1)}px` } : {}),
        ...(centreY !== undefined ? { ["--graview-centre-y" as string]: `${centreY.toFixed(1)}px` } : {}),
      }
    : // The GPU path does NOT fade the host: the shader owns opacity there,
      // and applying it in both places made an entering view fade as
      // opacity² — visibly faster and dimmer than the DOM path, so the two
      // renderers disagreed about the same transition. It also meant a view
      // captured mid-fade baked its own transparency into the texture.
      {};

  return (
    <div
      ref={ref}
      data-graview-view={node.id}
      data-graview-plane={Math.round(node.plane)}
      data-graview-selected={selected || undefined}
      data-graview-touched={touched || undefined}
      data-graview-plot={frontY !== undefined ? "" : undefined}
      data-graview-screen={screen ? "" : undefined}
      /*
       * A card drawn deliberately BEHIND another says so in the tree.
       *
       * Two boxes overlapping is either a tuck or a collision, and from the
       * outside those look identical — which is how a fan of six illegible
       * slivers went unnoticed while every automated check reported the
       * screen clean. Stating the intent is what lets a checker tell them
       * apart, and lets a person reading the tree know which it is.
       */
      data-graview-nested={node.nestedUnder ?? undefined}
      data-graview-crowded={crowded || undefined}
      /*
       * A card YOU put there says so. The layout already knows — a pin wins
       * over the computed position — and without the mark there is no way to
       * tell a card that was dragged from one the layout happened to put in
       * the same place, which is the difference between a scene you arranged
       * and a scene that looks slightly wrong.
       */
      data-graview-pinned={node.pinned || undefined}
      /*
       * Activity, stated as attributes rather than as inline styles.
       *
       * It is the theme's job to decide what "an agent read this" looks like,
       * and a stylesheet animation runs once and stops — which is how
       * watching costs nothing on a quiet graph. There is no frame loop here
       * and nothing to tick.
       */
      data-graview-activity={activity ? activity.manner : undefined}
      data-graview-wrote={activity?.wrote || undefined}
      data-graview-read={activity && !activity.wrote ? true : undefined}
      data-graview-broke={activity?.broke || undefined}
      /*
        * "Open X" only where clicking raises X. On plane 0 the group IS what
        * you are looking at, so the tooltip promised something clicking does
        * not do — and it shadowed the more specific titles a view puts on its
        * own contents.
        */
      /*
       * While something is happening here, the tooltip says WHAT — the
       * intent the op recorded, in the app's own words. Watching should not
       * require opening the activity list to find out what the light meant.
       */
      title={
        activity
          ? `${WHO[activity.manner]} ${activity.wrote ? "changed this" : "read this"}: ${activity.intent}`
          : node.aggregate && Math.round(node.plane) !== 0
            ? `Open ${node.aggregate.label}`
            : undefined
      }
      role="group"
      /*
       * A CARD IS NAMED WHAT IT SAYS IT IS.
       *
       * A district had its plural and a record had its id, so the whole
       * accessibility tree of a populated scene read "item:buy-milk" while
       * the card in front of you said "Buy milk". An id is an address, not a
       * name; the label comes from the declaration, the same `label(node)`
       * every heading, chip and crumb reads. An id with no node behind it
       * (mid-removal) keeps the address, which is at least true.
       */
      aria-label={hostName}
      /* Said where a screen reader reads the card; the seat says it on screen. */
      aria-keyshortcuts={actsDoor && !node.beyond ? actsDoor.key : undefined}
      tabIndex={0}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onClick={(event) => {
        // A drag that ends on a card must not also select it.
        if (swallowClick.current) return;
        /*
         * A CONTROL INSIDE A VIEW HAS ITS OWN MEANING, and selecting the
         * card it sits on is not it.
         *
         * The keyboard path below has said so since it was written; the
         * pointer path had not, because until a view drew a real control
         * nothing noticed. The calendar draws several — previous, next,
         * today, the range, "+3 more" — and pressing any of them also
         * selected every task in the district the calendar was drawing, so
         * changing the month lit up the whole month.
         */
        const inControl = (event.target as HTMLElement | null)?.closest(
          "input, textarea, select, button, a[href], [contenteditable='true']",
        );
        if (inControl && !inControl.hasAttribute("data-graview-pick")) return;
        const additive = event.metaKey || event.shiftKey;
        /*
         * A view may nominate its own inner targets.
         *
         * Any element carrying `data-graview-pick="<node id>"` is a real
         * thing in the graph, and clicking it means that thing — not the
         * view that happens to be drawing it. One rule, in one place, and
         * every view gets it: a span in the calendar, a row in a roster, a
         * chip in a summary.
         *
         * Without this, clicking an event in the week could only ever mean
         * "the week", which is why clicking an event appeared to do nothing.
         */
        const picked = pickedFrom(event.target);
        if (picked && picked !== node.id) {
          event.stopPropagation();
          onPick(picked, additive);
          return;
        }
        onSelect(additive);
      }}
      onKeyDown={(event) => {
        /*
         * ITS ACTS, ONE KEY AWAY. The keyboard's right-click: what the key
         * lands on is chosen, as a right-click chooses it, and the seat
         * opens on its acts with the keyboard in them. Only on the card
         * itself — a letter typed into a field inside it is a letter.
         */
        if (
          actsDoor &&
          !node.beyond &&
          event.key.toLowerCase() === actsDoor.key.toLowerCase() &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey &&
          !(event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")
        ) {
          event.preventDefault();
          event.stopPropagation();
          const on = pickedFrom(event.target) ?? node.id;
          if (!selection.includes(on)) onPick(on, false);
          // Back to what the keyboard stood on — the card, or the mark inside it it had reached.
          actsDoor.open(event.target instanceof HTMLElement ? event.target : event.currentTarget);
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        /*
         * NEVER STEAL A KEY FROM A CONTROL THAT HAS ITS OWN MEANING FOR IT.
         *
         * A card is a target, and so are the pick marks a view draws inside
         * it — but a real control is not. Preventing the default before
         * asking swallowed Enter inside the title's own editor, so renaming
         * a record in place stopped committing: the field stayed open and
         * nothing was written. `pnpm remember` is what noticed.
         */
        const inControl = (event.target as HTMLElement | null)?.closest(
          "input, textarea, select, button, [contenteditable='true']",
        );
        if (inControl) return;
        const picked = pickedFrom(event.target);
        event.preventDefault();
        event.stopPropagation();
        /*
         * THE CARD ITSELF ANSWERS THE KEYBOARD.
         *
         * It was a tab stop that did nothing: the handler returned unless the
         * key had landed on an inner pick target, on the grounds that the
         * host "has its own meaning" — which was true, and reachable only
         * with a pointer. On a blank app that is the whole of it. The one
         * district is the only thing on screen, selecting it is what opens
         * the strip, and the strip is where the first act lives, so a
         * keyboard alone could not add the first record to a new product.
         *
         * Enter on the host does what a click on it does; Enter again on a
         * card already selected alone does what the second click does — the
         * same two-step the inner targets have.
         */
        if (!picked || picked === node.id) {
          const already = selection.length === 1 && selection[0] === node.id;
          if (already && !event.metaKey && !event.shiftKey) onJackIn();
          else onSelect(event.metaKey || event.shiftKey);
          return;
        }
        /*
         * Enter selects; Enter again on something already selected alone
         * travels. The keyboard needs the same two-step the pointer has, and
         * a modifier would have been a worse answer than repeating yourself.
         */
        const already = selection.length === 1 && selection[0] === picked;
        if (already && !event.metaKey && !event.shiftKey) onTravel(picked);
        else onPick(picked, event.metaKey || event.shiftKey);
      }}
      onContextMenu={(event) => {
        const picked = pickedFrom(event.target);
        event.preventDefault();
        event.stopPropagation();
        /*
         * Right-click SELECTS, always — through onPick, never onSelect,
         * because onSelect's kind-card branch toggles the raised relation
         * and returns without selecting, which opened a menu about nothing
         * (and quietly raised People on the way).
         */
        const on = picked && picked !== node.id ? picked : node.id;
        onPick(on, false);
        /*
         * The menu is about THIS, and says so. Without the name the
         * derivation could only rank by the selection, and a rule that
         * implicates several nodes in one violation put somebody else's
         * repair at the top of the menu you opened on yours.
         */
        onMenu({ x: event.clientX, y: event.clientY, on });
      }}
      onDoubleClick={(event) => {
        const picked = pickedFrom(event.target);
        if (picked && picked !== node.id) {
          event.stopPropagation();
          onTravel(picked);
          return;
        }
        onJackIn();
      }}
      style={{
        position: "absolute",
        /*
         * On the capture path the host is OUT of hit-testing entirely.
         *
         * This is the fix for the defect that kept the GPU path off by
         * default. It was recorded as "a click crashes the renderer process",
         * and that was a symptom rather than the cause: bisected in Chromium
         * 154, a plain HOVER over a captured view brings the process down just
         * as reliably, while selecting the same node from the keyboard does
         * not. What is fatal is the browser's own hit-test descending into a
         * `layoutsubtree` canvas child.
         *
         * Nothing is lost by removing it. `updateElementGeometry` does not
         * redirect hit-testing in this build, so a DOM hit-test on a captured
         * view was already returning the wrong answer — it reported the box
         * where the element was LAID OUT rather than where it was DRAWN, which
         * is why `PointerRouter` exists at all. The compositor already runs one
         * on the canvas; this stops the platform racing it into a crash.
         *
         * Keyboard reach and the accessibility tree are untouched:
         * `pointer-events` says nothing about focus, and the views stay real,
         * focusable DOM.
         *
         * On the DOM path the theme narrows the host's hit area to its drawn
         * content (`[data-graview-stage="dom"] [data-graview-view]`): the
         * box is the layout's, the target is the view's.
         */
        ...(useDom ? {} : { pointerEvents: "none" as const }),
        // Each host sits at its own layout position, on BOTH paths.
        //
        // Under `layoutsubtree` every child is laid out at the canvas origin,
        // so hosts pinned to 0,0 pile up on each other and only some of them
        // end up with usable paint records — five views captured completely
        // blank because of it. Giving each its own box keeps them distinct
        // for the capture. The GPU still draws each wherever its plane
        // transform says; this only decides what gets rasterised.
        // Nearer planes paint over further ones — and an OPENED district
        // comes to the front outright: its roster grows over whatever is
        // beside it, and a chip half-hidden behind the live view is a chip
        // nobody can press.
        zIndex: node.opened ? 11 : 10 - Math.round(node.plane),
        left: useDom ? 0 : Math.round(node.x),
        top: useDom ? 0 : Math.round(node.y),
        // Whole pixels, matching what the renderer allocates a texture for.
        // A host of height 399.4 rasterises into 400 rows; a texture sized
        // from the rounded 399 rejects the copy, and the view keeps whatever
        // was in the texture before — silently.
        width: Math.round(node.width),
        height: Math.round(node.height),
        boxSizing: "border-box",
        // A view that sizes to its content is centred in the box the layout
        // gave it, rather than pinned to the top with the remainder left as
        // dead white space.
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...domOnly,
      }}
    >
      {natural ? (
        /*
         * Centred on the slot and scaled about its own middle, so the
         * proportions the view chose survive a slot that does not share them.
         * `position: absolute` keeps the natural box out of the host's flow —
         * it must not be able to push the host's own geometry around, since
         * the capture allocates a texture from that.
         */
        <div
          ref={naturalRef}
          data-graview-natural={`${Math.round(natural.width)}x${Math.round(natural.height)}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: natural.width,
            height: natural.height,
            transform: `translate(-50%, -50%) scale(${shrink})`,
            transformOrigin: "50% 50%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
      {/*
        * WHAT KIND OF THING THIS IS, said on the thing. The one thread that
        * runs through every Graview surface is the kind — its hue in every
        * chip's dot, its name in the legend — and the focus panel was the
        * one place it went unsaid: a person's page that never says
        * "person". The tag sits astride the panel's top-right edge, scene
        * chrome rather than view content, so no view has to remember it.
        */}
      {Math.round(node.plane) === 0 && !node.aggregate ? (
        <span
          data-graview-kindtag=""
          className="graview-kind-tag"
          aria-hidden="true"
          style={{
            ...(tagAt ?? {}),
            ["--graview-hue" as string]: Math.round(
              hueFor(node.kind, hostBrand?.accents),
            ),
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              flex: "0 0 auto",
              background: `hsl(${Math.round(hueFor(node.kind, hostBrand?.accents))} 55% var(--graview-tint-lightness) / 0.9)`,
            }}
          />
          {/* The kind's noun, never its id: "car", not "vehicle"; "test drive", not "test-drive". */}
          {nounOf(hostStore.schema.tryDefinition(node.kind), node.kind)}
        </span>
      ) : null}
    </div>
  );
}
