import { fieldWords, pluralLabel, type AnySchema, type Place } from "@graview/core";
import { aggregateId } from "@graview/layout/view";
import { GhostDoor, Inspector, NotifyDoor, PLACE_MENU_EVENT, useBoardMoveSection, useInlineAiSection, useNotifySection, useViewTidyingSection } from "@graview/primitives/pages";
import { MenuSections } from "@graview/react/drawing";
import { useGraview, useGraviewIfAny, type MenuItem, type MenuSectionSource, type MenuTarget, type PointerMenu } from "@graview/react/provider";
import { useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
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
 * selected, and whenever Shift is held with the right-click — the way to
 * a link's "Open in new tab" too, which the menu also offers itself.
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
  return selected !== null && !selected.isCollapsed && selected.containsNode(element, true);
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
      // A record drawn in a lens, a home's list, a card.
      const picked = element.closest("[data-graview-pick]")?.getAttribute("data-graview-pick");
      if (picked && store.graph.getNode(picked)) return { face: "pages", on: picked, about: [picked], href: `${base}${recordPath(schema, store.graph.getNode(picked)!.kind, picked)}` };
      const link = element.closest<HTMLAnchorElement>("a[href]");
      if (link) return aimAtLink(link);
      // A list's row, past its link: the record it is.
      const row = element.closest("[data-graview-record]")?.getAttribute("data-graview-record");
      if (row && store.graph.getNode(row)) return { face: "pages", on: row, about: [row] };
      return page;
    },
    [aimAtPage, aimAtLink, store, schema, base],
  );

  /** What resting on an element in this face gets ready (FR-186): the menu a right-click there would open, as the Inspector's sections are told it. */
  const readyAt = useCallback(
    (element: Element): MenuTarget | null => {
      const face = root.current;
      if (face === null || !face.contains(element) || typingIn(element) || element.closest("[data-graview-popover]")) return null;
      const aimed = aimAt(element);
      return { face: "pages", on: aimed.on, about: aimed.about ?? [], field: aimed.field, place: aimed.place, href: aimed.href, act: aimed.act, element: homeOf(element) };
    },
    [aimAt, root],
  );

  /** Opens the menu about what is at `element`, at a point. */
  const open = useCallback(
    (element: Element, x: number, y: number) => {
      const aimed = aimAt(element);
      setMenuAt({ ...aimed, x: Math.round(x), y: Math.round(y), returnTo: homeOf(element) });
    },
    [aimAt, setMenuAt],
  );

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
      if (href !== undefined) items.push({ id: "open-in-a-new-tab", label: "Open in a new tab", run: () => void window.open(href, "_blank", "noopener") });
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
    [store, schema, context, pathname, base, navigate, root],
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
  const sections = useMemo(() => [change, board, own, ...(tidy ? [tidy] : []), ...(notify ? [notify] : []), ...(inlineAi ? [inlineAi] : [])], [change, board, own, tidy, notify, inlineAi]);

  return (
    <MenuSections sections={sections}>
      <div
        data-graview-menu-ground=""
        style={{ display: "contents" }}
        onContextMenu={(event) => {
          const target = event.target as Element;
          // The browser's own: Shift held, a text field, editable text, text somebody selected.
          if (event.shiftKey || typingIn(target) || onSelectedText(target)) return;
          event.preventDefault();
          // A right-click in the menu itself opens no second one over it.
          if (target.closest("[data-graview-popover]")) return;
          // The keyboard's and a resting finger's own gesture, said again by the browser, opens nothing new.
          if (Date.now() - openedBy.current < 700) return;
          // Nowhere to point (a key the browser turned into this): at the element, as the keyboard does.
          if (event.clientX === 0 && event.clientY === 0 && target instanceof HTMLElement) openAt(target);
          else open(target, event.clientX, event.clientY);
        }}
        onPointerDown={(event) => {
          swallow.current = false;
          if (event.pointerType === "mouse" || !event.isPrimary) return;
          const target = event.target as Element;
          // A list that chooses keeps its own long press: resting on a row chooses it.
          if (typingIn(target) || target.closest("[data-graview-choose], [data-graview-popover]")) return;
          stop();
          const { clientX: x, clientY: y } = event;
          press.current = {
            x,
            y,
            timer: setTimeout(() => {
              press.current = null;
              swallow.current = true;
              openedBy.current = Date.now();
              open(target, x, y);
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
    </MenuSections>
  );
}

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
