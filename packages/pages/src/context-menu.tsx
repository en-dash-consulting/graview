import { argumentsTaken, fieldWords, humanizeField, layer, nounOf, pluralLabel, withArticle, type AnySchema, type Place } from "@graview/core";
import { narrowedPath } from "@graview/core/navigate";
import { aggregateId } from "@graview/layout/view";
import { GhostDoor, Inspector, NotifyDoor, SectionBetterDoor, useBoardMoveSection, useInlineAiSection, useNotifySection, useSectionBetterSection, useViewTidyingSection } from "@graview/primitives/pages";
import { MenuSections, sectionsArrive, sectionsWanted, sectionUnderNow } from "@graview/react/drawing";
import { PLACE_MENU_EVENT, useGraview, useGraviewIfAny, type MenuColumn, type MenuItem, type MenuSectionSource, type MenuTarget, type PointerMenu } from "@graview/react/provider";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useHref, useLocation, useNavigate } from "react-router-dom";
import type { PageContext } from "./page-context.js";
import { pathOfPlace } from "./page-places.js";
import { kindOfSlug, pluralSlug, recordPath } from "./registry.js";

/**
 * THE CONTEXT MENU ON THE ROUTED FACE — the scene's own menu (`Inspector`
 * at the pointer, the acts `@graview/tools` derives), opened on what the
 * gesture landed on here: a record (its page, a row, a card, a chip, a
 * lens's mark), a field on its page, a place, or the page's own ground.
 *
 * Opened by a right-click, by Shift+F10 and the context-menu key on what
 * has the keyboard, and by a finger resting on the page. THE BROWSER KEEPS
 * ITS OWN MENU in a text field or editable text, over text somebody has
 * selected, and whenever Shift or Option (Alt) is held with the
 * right-click — the way to a link's "Open in new tab" too, which the menu also offers itself, with
 * "Copy link" under it. A right-click elsewhere while text is selected
 * offers "Copy" first; a finger resting on text leaves it to the phone's
 * own selection, opening the menu only on a card, a row or a handle.
 *
 * WHAT IS UNDER THE CURSOR: a column — a status board's, or a region a
 * worker view marked `data-column="<field>:<value>"` — offers "Add a task
 * in Doing" and "Show only Doing". A Ctrl+click — a one-button trackpad's
 * right-click on a Mac — opens this menu like any right-click.
 */

/** What a menu opened here is about, before it is placed. */
type Aimed = Omit<PointerMenu, "x" | "y">;

/** How long a finger rests before the menu opens, and how far it may wander and still be resting. */
const LONG_PRESS_MS = 500;
const SLOP = 10;

/** Whether this is somewhere a person types, where the browser's own menu (paste, spelling) stays. */
function typingIn(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable || element.tagName === "TEXTAREA" || element.tagName === "SELECT") return true;
  return element.tagName === "INPUT" && !["button", "submit", "reset", "checkbox", "radio", "image", "file", "color", "range"].includes((element as HTMLInputElement).type);
}

/** Whether the press landed on text somebody selected: the browser's menu copies it. */
function onSelectedText(element: Element): boolean {
  const selected = typeof getSelection === "function" ? getSelection() : null;
  if (selected === null || selected.isCollapsed) return false;
  for (let at = 0; at < selected.rangeCount; at++) if (selected.getRangeAt(at).intersectsNode(element)) return true;
  return false;
}

/** The element itself under a press, inside a worker view's shadow root where the event was retargeted to its host. */
function innermost(event: { readonly target: EventTarget | null; readonly nativeEvent: Event }): Element {
  const first = event.nativeEvent.composedPath?.()[0];
  return first instanceof Element ? first : (event.target as Element);
}

/** An element's parent, out through a shadow root to its host. */
function upFrom(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/** The nearest element at or above this one, through shadow roots, with the attribute. */
function nearestWith(element: Element, attribute: string): Element | null {
  for (let at: Element | null = element; at; at = upFrom(at)) if (at.hasAttribute(attribute)) return at;
  return null;
}

/** What a press could be about besides its text: a card, a row, a link, a control, a column — what a finger resting on opens the menu. */
const HANDLE = 'a[href], button, summary, label, input, select, [role="button"], [draggable="true"], [data-graview-pick], [data-graview-listed], [data-graview-record], [data-graview-act], [data-graview-editable], [data-record], [data-act], [data-column]';

/**
 * Whether a finger at this point rests on text a person could select — a
 * character drawn there, in an element that is no handle: the phone's own
 * selection is what it is for, not the menu.
 */
function onSelectableText(element: Element, x: number, y: number): boolean {
  for (let at: Element | null = element; at; at = upFrom(at)) if (at.matches(HANDLE)) return false;
  if (typeof getComputedStyle === "function" && getComputedStyle(element).userSelect === "none") return false;
  for (const child of element.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE || !child.nodeValue?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(child);
    // A document that lays nothing out (jsdom) has no boxes to be on.
    if (typeof range.getClientRects !== "function") return false;
    for (const box of range.getClientRects()) if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true;
  }
  return false;
}

/** Text somebody selected inside this face, or none. */
function selectedIn(face: HTMLElement | null): string | null {
  const selected = typeof getSelection === "function" ? getSelection() : null;
  if (!selected || selected.isCollapsed || !face || !selected.anchorNode || !face.contains(selected.anchorNode)) return null;
  const text = selected.toString();
  return text.trim() ? text : null;
}

/** Puts words on the clipboard, saying so quietly; a browser that refuses is said too. */
function copied(text: string, said: (sentence: string) => void, what: string) {
  const writing = navigator.clipboard?.writeText?.(text);
  if (!writing) return said(`${what} could not be copied here`);
  void writing.then(
    () => said(`${what} copied`),
    () => said(`${what} could not be copied here`),
  );
}

/** What the keyboard goes back to when the menu closes: the nearest control at the target, else what had it. */
function homeOf(element: Element): HTMLElement | null {
  const control = element.closest<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])');
  if (control) return control;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/** The routed face's menu, where a provider is drawn under it; else nothing but its pages. */
export function PagesContextMenu<S extends AnySchema>({ context, root, children }: { readonly context: PageContext<S>; readonly root: RefObject<HTMLElement | null>; readonly children: ReactNode }) {
  return useGraviewIfAny() === null ? <>{children}</> : <Menu context={context} root={root}>{children}</Menu>;
}

function Menu<S extends AnySchema>({ context, root, children }: { readonly context: PageContext<S>; readonly root: RefObject<HTMLElement | null>; readonly children: ReactNode }) {
  const { setMenuAt } = useGraview<S>();
  const { store } = context;
  const schema = store.schema;
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // The router's own root (`/pages/`), for reading a link's address and writing one a new tab opens.
  const base = useHref("/").replace(/\/$/, "");

  /** A place, by its name and the kind its address names when two kinds share the name. */
  const placeAt = useCallback(
    (as: string, of: string | null): Place | undefined => context.views?.places().find((place) => place.as === as && (of === null || place.kind === of)),
    [context.views],
  );

  /** What an address on this face is: a record, a kind's list, a place, or none of them. */
  const aimAtPath = useCallback(
    (path: string, query: string): Aimed | null => {
      const [first = "", second, more] = path
        .split("/")
        .filter(Boolean)
        .map((part) => {
          try {
            return decodeURIComponent(part);
          } catch {
            return part;
          }
        });
      if (more !== undefined) return null;
      if (first === "places" && second !== undefined) {
        const place = placeAt(second, new URLSearchParams(query).get("of"));
        return place ? { face: "pages", place: place.as, about: [aggregateId(place.kind)], title: place.title } : null;
      }
      const kind = kindOfSlug(schema, first);
      if (!kind) return null;
      if (second === undefined) return { face: "pages", about: [aggregateId(kind)], title: pluralLabel(schema, kind) };
      return store.graph.getNode(second) ? { face: "pages", on: second, about: [second] } : null;
    },
    [schema, store, placeAt],
  );

  /** What a link on this face goes to, by its address; a link elsewhere is only its address. */
  const aimAtLink = useCallback(
    (link: HTMLAnchorElement): Aimed => {
      const href = link.href;
      try {
        const url = new URL(href, location.href);
        if (url.origin === location.origin && (base === "" || url.pathname === base || url.pathname.startsWith(`${base}/`))) {
          const aimed = aimAtPath(url.pathname.slice(base.length), url.search);
          if (aimed) return { ...aimed, href };
        }
      } catch {
        // Not an address: only the page.
      }
      return { face: "pages", about: [], href };
    },
    [base, aimAtPath],
  );

  /** What the page itself is about: its record, its kind's list, its place — or nothing, with Find. */
  const aimAtPage = useCallback((): Aimed => aimAtPath(pathname, search) ?? { face: "pages", about: [] }, [aimAtPath, pathname, search]);

  /** What a press at this element is about. */
  const aimAt = useCallback(
    (element: Element): Aimed => {
      const page = aimAtPage();
      // A value on the record's page: changed where it stands, beside the record's acts.
      const field = element.closest("[data-graview-field]")?.getAttribute("data-graview-field");
      if (field && page.on !== undefined && element.closest("[data-graview-pick], a[href]") === null) return { ...page, field };
      // An act — one of a record's, a list's way to begin one: about what the page is about, and the act (Roadmap f-notify-subscriptions).
      const act = element.closest("[data-graview-act]")?.getAttribute("data-graview-act");
      if (act) return { ...page, act };
      /*
       * A RECORD DRAWN IN A LENS, A HOME'S LIST, A CARD: the one it picks, or
       * the one a list's item is listed as — a board's card, a blocks lens's
       * card or row (FR-189) — wherever in it the press lands, its own
       * stretched link included. A link the item draws to somewhere else
       * stays that link, as does a link the whole list is drawn in.
       */
      const link = element.closest<HTMLAnchorElement>("a[href]");
      const listed = element.closest("[data-graview-listed]");
      const record = [element.closest("[data-graview-pick]")?.getAttribute("data-graview-pick"), listed && (!link || (listed.contains(link) && link.classList.contains("graview-spec-item-link"))) ? listed.getAttribute("data-graview-listed") : null]
        .map((id) => (id ? store.graph.getNode(id) : undefined))
        .find(Boolean);
      if (record) return { face: "pages", on: record.id, about: [record.id], href: `${base}${recordPath(schema, record.kind, record.id)}` };
      if (link) return aimAtLink(link);
      // A list's row, past its link: the record it is.
      const row = element.closest("[data-graview-record]")?.getAttribute("data-graview-record");
      if (row && store.graph.getNode(row)) return { face: "pages", on: row, about: [row] };
      return page;
    },
    [aimAtPage, aimAtLink, store, schema, base],
  );

  /**
   * THE COLUMN UNDER THE CURSOR: the nearest `data-column="<field>:<value>"`
   * — a status board's column, or a region a worker view marked — of the
   * kind it says (`data-column-kind`), else the kind the place or list is of.
   */
  const columnAt = useCallback(
    (element: Element, aimed: Aimed): MenuColumn | undefined => {
      const marked = nearestWith(element, "data-column");
      const said = marked?.getAttribute("data-column") ?? "";
      const split = said.indexOf(":");
      if (!marked || split <= 0 || split === said.length - 1) return undefined;
      const field = said.slice(0, split);
      const value = said.slice(split + 1);
      const place = aimed.place === undefined ? undefined : context.views?.places().find((one) => one.as === aimed.place);
      const kind = nearestWith(marked, "data-column-kind")?.getAttribute("data-column-kind") ?? place?.kind ?? (aimed.about?.length === 1 && aimed.about[0]!.startsWith("aggregate:") ? kindOfAggregate(aimed.about[0]!) : undefined);
      if (kind === undefined || !schema.tryDefinition(kind)) return undefined;
      return { kind, field, value, label: marked.getAttribute("data-column-label") ?? humanizeField(value) };
    },
    [context.views, schema],
  );

  /** What resting on an element in this face gets ready (FR-186): the menu a right-click there would open, as the Inspector's sections are told it. */
  const readyAt = useCallback(
    (element: Element): MenuTarget | null => {
      const face = root.current;
      if (face === null || !face.contains(element) || typingIn(element) || element.closest("[data-graview-popover]")) return null;
      const aimed = aimAt(element);
      return { face: "pages", on: aimed.on, about: aimed.about ?? [], field: aimed.field, place: aimed.place, href: aimed.href, act: aimed.act, column: columnAt(element, aimed), element: homeOf(element) };
    },
    [aimAt, columnAt, root],
  );

  /** The menu last opened here, so a row of it can open it again with an act begun ("Add a task in Doing"). */
  const last = useRef<PointerMenu | null>(null);
  /** The text selected when it opened, which "Copy" copies. */
  const selection = useRef<string | null>(null);

  /** Opens the menu about what is at `element`, at a point; `inner` is what was under it inside a worker view. */
  const open = useCallback(
    (element: Element, x: number, y: number, inner: Element = element, waited = false): void => {
      /* The first right-click inside a view fetches what finds its section, and the menu opens once it is here (without one, should it not arrive). */
      if (!waited && sectionsWanted(inner)) {
        const then = () => open(element, x, y, inner, true);
        void sectionsArrive().then(then, then);
        return;
      }
      const aimed = aimAt(element);
      const column = columnAt(inner, aimed);
      /* A section of a worker view under the cursor names the menu ("This week") and is outlined while it is open. */
      const section = sectionUnderNow(inner);
      selection.current = selectedIn(root.current);
      const menu: PointerMenu = { ...aimed, ...(column ? { column } : {}), ...(section ? { section, title: section.name } : {}), x: Math.round(x), y: Math.round(y), returnTo: homeOf(element) };
      last.current = menu;
      setMenuAt(menu);
    },
    [aimAt, columnAt, setMenuAt, root],
  );

  /* "Link copied", said quietly at the foot of the page and gone. */
  const [said, setSaid] = useState<{ readonly sentence: string; readonly at: number } | null>(null);
  useEffect(() => {
    if (!said) return;
    const gone = setTimeout(() => setSaid(null), 2400);
    return () => clearTimeout(gone);
  }, [said]);
  const say = useCallback((sentence: string) => setSaid({ sentence, at: Date.now() }), []);

  /** Opens it at an element, as the keyboard does: at the element's start, under its first line. */
  const openAt = useCallback(
    (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      open(element, box.left + Math.min(16, box.width / 2), Math.min(box.bottom, box.top + 36));
    },
    [open],
  );

  /** When the keyboard or a resting finger opened it last: the browser's own event after it is not a second gesture. */
  const openedBy = useRef(0);
  /** A finger resting on the page. */
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  /**
   * WHETHER TEXT WAS SELECTED BEFORE THE RIGHT BUTTON WENT DOWN. Safari and
   * every WebKit on a Mac select the word under a right-click between the
   * press and the menu, so the menu found "text somebody selected" under
   * every right-click on words and left the browser's own: a selection the
   * press itself made is not one a person made.
   */
  const rightDown = useRef<{ readonly at: number; readonly had: boolean } | null>(null);
  /** The press that opened the menu by resting opens nothing else. */
  const swallow = useRef(false);
  const stop = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => stop, []);

  /*
   * THE KEYBOARD'S RIGHT-CLICK: Shift+F10 and the context-menu key, on
   * whatever has the keyboard in this face — the page's own ground when it
   * is on nothing. Heard on the document, since a keyboard on <body> is
   * on no element of the face.
   */
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) return;
      const face = root.current;
      const target = event.target instanceof Element ? event.target : null;
      const nowhere = target === null || target === document.body || target === document.documentElement;
      const here = face !== null && target !== null && face.contains(target);
      // A keyboard on nothing is this face's when it is the first routed face on the page.
      if (!here && !(nowhere && document.querySelector("[data-graview-face='pages']") === face)) return;
      // In a text field the browser's; in the menu itself, nothing new.
      if (typingIn(target) || target?.closest("[data-graview-popover]")) return;
      event.preventDefault();
      openedBy.current = Date.now();
      const at = here && target instanceof HTMLElement ? target : (face?.querySelector<HTMLElement>("[data-graview-page-title], main h1, main") ?? null);
      if (at) openAt(at);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [root, openAt]);

  /*
   * THE PLACE MENU FROM THE BAR ABOVE (Roadmap f-place-menu-views): the
   * place you are on and each place in its drop-down open this face's menu
   * about the place, asked for with `PLACE_MENU_EVENT` on the face — the
   * bar is drawn under the embed's provider, this menu under the face's.
   */
  useEffect(() => {
    const face = root.current;
    if (!face) return;
    const asked = (event: Event) => {
      const menu = (event as CustomEvent<PointerMenu>).detail;
      if (menu) setMenuAt({ ...menu, face: "pages" });
    };
    face.addEventListener(PLACE_MENU_EVENT, asked);
    return () => face.removeEventListener(PLACE_MENU_EVENT, asked);
  }, [root, setMenuAt]);

  /* THE FACE'S OWN ROWS, beside the acts: going there, in a new tab, in the scene, changing the field, Find. */
  const own = useMemo<MenuSectionSource>(
    () => (target: MenuTarget) => {
      if (target.face !== "pages") return null;
      const items: MenuItem[] = [];
      const node = target.on === undefined ? undefined : store.graph.getNode(target.on);
      const place = target.place === undefined ? undefined : context.views?.places().find((one) => one.as === target.place);
      const kind = node ? undefined : target.about.length === 1 && target.about[0]!.startsWith("aggregate:") && !place ? kindOfAggregate(target.about[0]!) : undefined;
      const path = node ? recordPath(schema, node.kind, node.id) : place ? pathOfPlace(context, place) : kind ? `/${pluralSlug(schema, kind)}` : undefined;
      // The page it is already on, whatever else its address says (`?today=`, a list's arranging).
      const here = path !== undefined && pathname === path.split("?")[0];
      if (path !== undefined && !here) items.push({ id: "open", label: "Open", run: () => navigate(path) });
      const href = path !== undefined ? `${base}${path}` : target.href;
      if (href !== undefined) {
        items.push({ id: "open-in-a-new-tab", label: "Open in a new tab", run: () => void window.open(href, "_blank", "noopener") });
        // The same address, whole, for pasting elsewhere.
        items.push({ id: "copy-link", label: "Copy link", run: () => copied(new URL(href, location.href).href, say, "Link") });
      }
      /*
       * A COLUMN UNDER THE CURSOR, on its ground rather than a card in it:
       * a new record put in it — the add act begun with the column's value
       * given — and the place narrowed to it, as an address would narrow it.
       */
      const column = target.on === undefined ? target.column : undefined;
      if (column) {
        const adds = store.allMutations().find((mutation) => (mutation.creates as readonly string[] | undefined)?.includes(column.kind) && (argumentsTaken(mutation)?.includes(column.field) ?? false));
        if (adds && last.current) {
          const menu = last.current;
          items.push({ id: "add-in-column", label: `Add ${withArticle(nounOf(schema.tryDefinition(column.kind), column.kind))} in ${column.label}`, run: () => setMenuAt({ ...menu, begin: { act: adds.name, given: { [column.field]: column.value } } }) });
        }
        const listPath = place ? pathOfPlace(context, place) : `/${pluralSlug(schema, column.kind)}`;
        items.push({ id: "show-only-column", label: `Show only ${column.label}`, run: () => navigate(narrowedPath(listPath, { filter: `${column.field}:${column.value}` })) });
      }
      // Where the scene is to be had: the embed's own way, else the scene's address when the face owns its page.
      const stop = node ? `#focus=${encodeURIComponent(node.id)}` : place ? `#focus=${encodeURIComponent(aggregateId(place.kind))}&view=${encodeURIComponent(place.as)}` : kind ? `#focus=${encodeURIComponent(aggregateId(kind))}` : undefined;
      if (stop !== undefined && (context.overview || !context.embedded)) {
        const scene = context.overview;
        items.push({ id: "in-the-scene", label: "Show in the scene", run: () => (scene ? scene(stop) : location.assign(`${context.sceneHref ?? "/"}${stop}`)) });
      }
      // Ground, not a thing: what the page offers, Find among it.
      if (node === undefined && target.href === undefined) {
        items.push({
          id: "find",
          label: "Find…",
          run: () => {
            const box = root.current?.querySelector<HTMLInputElement>('[data-testid="nav-find"]') ?? document.querySelector<HTMLInputElement>('[data-testid="nav-find"]');
            if (box && box.offsetParent !== null) box.focus();
            else navigate("/search");
          },
        });
      }
      return items.length > 0 ? { id: "pages", items } : null;
    },
    [store, schema, context, pathname, base, navigate, root, say, setMenuAt],
  );
  /* Text somebody selected, copied: the first row, before anything else, where a right-click with a selection opened the menu. */
  const copy = useMemo<MenuSectionSource>(
    () => (target: MenuTarget) => {
      const text = selection.current;
      if (target.face !== "pages" || text === null) return null;
      return { id: "selection", at: "start", items: [{ id: "copy-selection", label: "Copy", run: () => copied(text, say, "Text") }] };
    },
    [say],
  );
  /* A value on its record's page, changed where it stands: the first row, before the record's acts. */
  const change = useMemo<MenuSectionSource>(
    () => (target: MenuTarget) => {
      if (target.face !== "pages" || target.field === undefined || target.on === undefined) return null;
      const node = store.graph.getNode(target.on);
      const value = target.element?.closest("[data-graview-field]") ?? root.current?.querySelector(`[data-graview-field="${CSS.escape(target.field)}"]`);
      if (!node || !(value instanceof HTMLElement) || !value.hasAttribute("data-graview-editable")) return null;
      const words = fieldWords(schema.tryDefinition(node.kind), target.field);
      return { id: "field", at: "start", items: [{ id: "change-field", label: `Change “${words}”`, run: () => value.click() }] };
    },
    [store, schema, root],
  );
  /* The inline AI's part of the menu, after the face's own, where the host gave a model and did not turn AI off. */
  const inlineAi = useInlineAiSection();
  /* "Notify me…" (Roadmap f-notify-subscriptions), where the reader is somebody the app can tell. */
  const notify = useNotifySection();
  /* "Move to ›" on a card on a status board: the columns it may go to, and the ones withheld with the reason. */
  const board = useBoardMoveSection();
  /* Hide and Delete for a place this viewer may tidy (Roadmap f-place-menu-views), after the face's own rows. */
  /* Deleting the place this page is: to the kind's own place, else home (`placeAfter`), rather than what the address falls back to. */
  const away = useCallback(
    (place: Place, after: Place | undefined) => {
      if (pathname === pathOfPlace(context, place).split("?")[0]) navigate(after ? pathOfPlace(context, after) : "/");
    },
    [pathname, context, navigate],
  );
  const tidy = useViewTidyingSection(away);
  /* "Make “This week” better" on a section of a worker view, for a seat that may change views (Roadmap f-make-this-section-better). */
  const better = useSectionBetterSection();
  const sections = useMemo(() => [copy, change, board, own, ...(tidy ? [tidy] : []), ...(notify ? [notify] : []), ...(better ? [better] : []), ...(inlineAi ? [inlineAi] : [])], [copy, change, board, own, tidy, notify, better, inlineAi]);

  return (
    <MenuSections sections={sections}>
      <div
        data-graview-menu-ground=""
        style={{ display: "contents" }}
        onContextMenu={(event) => {
          const target = event.target as Element;
          const down = rightDown.current;
          rightDown.current = null;
          // A word the right-click itself selected (WebKit on a Mac) is put back: nobody selected it.
          const pressMade = down !== null && !down.had && Date.now() - down.at < 2000;
          if (pressMade && !event.shiftKey && !event.altKey && !typingIn(target)) getSelection()?.removeAllRanges();
          // The browser's own: Shift or Option held, a text field, editable text, text somebody selected.
          if (event.shiftKey || event.altKey || typingIn(target) || onSelectedText(target)) return;
          event.preventDefault();
          // A right-click in the menu itself opens no second one over it.
          if (target.closest("[data-graview-popover]")) return;
          // The keyboard's and a resting finger's own gesture, said again by the browser, opens nothing new.
          if (Date.now() - openedBy.current < 700) return;
          // Nowhere to point (a key the browser turned into this): at the element, as the keyboard does.
          if (event.clientX === 0 && event.clientY === 0 && target instanceof HTMLElement) openAt(target);
          else open(target, event.clientX, event.clientY, innermost(event));
        }}
        onMouseDownCapture={(event) => {
          if (event.button !== 2) return;
          const selected = typeof getSelection === "function" ? getSelection() : null;
          rightDown.current = { at: Date.now(), had: selected !== null && !selected.isCollapsed };
        }}
        onPointerDown={(event) => {
          swallow.current = false;
          if (event.pointerType === "mouse" || !event.isPrimary) return;
          const target = event.target as Element;
          const inner = innermost(event);
          // A list that chooses keeps its own long press: resting on a row chooses it.
          if (typingIn(target) || target.closest("[data-graview-choose], [data-graview-popover]")) return;
          const { clientX: x, clientY: y } = event;
          // Resting on text is selecting it, the phone's own way: the menu opens on a card, a row or a handle.
          if (onSelectableText(inner, x, y)) return;
          stop();
          press.current = {
            x,
            y,
            timer: setTimeout(() => {
              press.current = null;
              swallow.current = true;
              openedBy.current = Date.now();
              open(target, x, y, inner);
            }, LONG_PRESS_MS),
          };
        }}
        onPointerMove={(event) => {
          const at = press.current;
          if (at && Math.hypot(event.clientX - at.x, event.clientY - at.y) > SLOP) stop();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onClickCapture={(event) => {
          if (!swallow.current) return;
          // The press that opened the menu by resting follows no link and presses nothing.
          swallow.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
      <MenuHome openAt={openAt} readyAt={readyAt} />
      {/* What the inline AI proposed and has not made, over the page. */}
      <GhostDoor placement="page" />
      {/* The sheet "Notify me…" opens, already filled in. */}
      <NotifyDoor />
      {/* A section a menu is open on, outlined; its card, where "Make this better" was asked. */}
      <SectionBetterDoor />
      {/* "Link copied", heard and seen, quietly. */}
      <p role="status" data-testid="menu-said" style={said ? SAID : HIDDEN}>
        {said?.sentence ?? ""}
      </p>
    </MenuSections>
  );
}

/** The quiet line at the foot of the window that says a copy was made. */
const SAID = { position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", margin: 0, padding: "6px 12px", borderRadius: 8, fontSize: "0.875rem", background: "var(--graview-panel)", color: "var(--graview-ink)", border: "1px solid var(--graview-edge)", boxShadow: "var(--graview-lift-low)", zIndex: layer("toast"), pointerEvents: "none" } as const;
const HIDDEN = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 } as const;

/** The kind a single-kind group id names. */
function kindOfAggregate(id: string): string | undefined {
  const kinds = id.slice("aggregate:".length).split("+");
  return kinds.length === 1 && kinds[0] ? kinds[0] : undefined;
}

/**
 * Where the menu is drawn, and where the keyboard lands when the menu goes
 * and the element it was opened from went with it (a record set aside from
 * its row): the page's heading, never <body>.
 */
function MenuHome({ openAt, readyAt }: { readonly openAt: (element: HTMLElement) => void; readonly readyAt: (element: Element) => MenuTarget | null }) {
  return (
    <span
      data-graview-menu-home=""
      tabIndex={-1}
      onFocus={(event) => {
        if (event.target !== event.currentTarget) return;
        const face = event.currentTarget.closest("[data-graview-face]");
        const heading = face?.querySelector<HTMLElement>("[data-graview-page-title]") ?? face?.querySelector<HTMLElement>("main h1, main") ?? null;
        if (!heading) return;
        if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }}
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      {/* A card's acts key, on this face, opens the menu about the card's record; resting on one gets that menu ready. */}
      <Inspector placement="menu" openActs={openAt} aimAt={readyAt} />
    </span>
  );
}
