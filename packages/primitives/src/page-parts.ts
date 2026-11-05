import { fieldWords, labelOf, nounOf, pluralLabel, type AnySchema } from "@graview/core";
import type { GraviewContextValue, MenuPage } from "@graview/react/provider";
import { mayChangeDeclaration } from "@graview/tools/section";

/*
 * A BUILT-IN PAGE'S PARTS, NAMED AS A PERSON WOULD (Roadmap
 * f-make-any-page-better): fetched with the menu's section, on the first
 * right-click on a page that offers "Make … better". The part is the
 * narrowest one the view spec says as one thing: a group's heading is the
 * group ("Someday"); anywhere else on a kind's list — a row, a card, the
 * heading — the list ("Tasks"), never the record a row is; a record's page
 * is every page of its kind ("Task page"); a place by its title ("The
 * week"); the front page "Home".
 */

/** A part of a built-in page "Make … better" is offered on. */
export interface PagePart {
  /** What the menu and the card call it: "Tasks", "Someday", "Task page", "Home". */
  readonly name: string;
  readonly slot: "list" | "group" | "record" | "home" | "place";
  /** The kind it draws: a list's, a record page's, a place's. */
  readonly kind?: string;
  /** The place, by the name it is registered under. */
  readonly place?: string;
  /** The record whose page it is, when it is one. */
  readonly record?: string;
  /** The group's words, when it is a group of a list. */
  readonly group?: string;
  /** What is outlined while the menu is open. */
  readonly elements: readonly Element[];
  /** The page's own region: what a draft is judged by. */
  readonly main: Element | null;
}

/** What the menu reads of the provider for a page's part. */
export type PartHere = Pick<GraviewContextValue<AnySchema>, "keptViews" | "store" | "principal" | "onProposeChange" | "composeChange" | "views">;

/** Each part offered, by the element the menu was opened at, for the outline while it is open. */
export const PARTS = /* @__PURE__ */ new WeakMap<Element, PagePart>();

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const words = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** A group's own words, without its count: "Someday", from "▾ Someday · 3 tasks". */
function groupWords(head: Element): string {
  const copy = head.cloneNode(true) as Element;
  for (const span of copy.querySelectorAll("span")) span.remove();
  return words(copy.textContent).replace(/^[▸▾]\s*/, "");
}

/** The part of a built-in page under the element a menu was opened at, or none (a popover, a page about nothing to change). */
export function pagePartOf(page: MenuPage, here: PartHere): PagePart | undefined {
  const at = page.at;
  if (!at.isConnected || at.closest("[data-graview-popover], [data-worker-view]")) return undefined;
  const main = at.closest("[data-graview-page-main], main") ?? at.closest("[data-graview-face]");
  const schema = here.store.schema;
  const aggregate = page.about?.length === 1 && page.about[0]!.startsWith("aggregate:") ? page.about[0]!.slice("aggregate:".length) : undefined;
  const of = aggregate && !aggregate.includes("+") && schema.tryDefinition(aggregate) ? aggregate : undefined;
  let part: PagePart | undefined;
  const record = page.on !== undefined ? here.store.graph.getNode(page.on) : undefined;
  if (record) {
    part = { name: `${capital(nounOf(schema.tryDefinition(record.kind), record.kind))} page`, slot: "record", kind: record.kind, record: record.id, elements: main ? [main] : [], main };
  } else if (page.place !== undefined) {
    const place = here.views.places?.().find((one) => one.as === page.place);
    if (place) part = { name: place.title, slot: "place", kind: place.kind, place: place.as, elements: main ? [main] : [], main };
  } else if (of) {
    const head = at.closest(".graview-group-head");
    const group = head?.closest('[data-testid="list-group"]');
    const said = head ? groupWords(head) : "";
    part = group && said ? { name: said, slot: "group", kind: of, group: said, elements: [group], main } : { name: pluralLabel(schema, of), slot: "list", kind: of, elements: main ? [main] : [], main };
  } else if (page.home) {
    part = { name: "Home", slot: "home", elements: main ? [main] : [], main };
  }
  return part;
}

/**
 * Whether this seat may change the part: the app, where the host lends a
 * change to it and the seat may change the declaration — or the page's
 * own view, where the host's views lend `fork` and say this seat may
 * change views. A place drawn by a lens is the declaration's alone.
 */
export function pageMayChange(part: PagePart, here: PartHere): boolean {
  const spec = here.onProposeChange !== undefined && here.composeChange !== undefined && mayChangeDeclaration(here.store, here.principal);
  const fork = part.slot !== "place" && typeof here.keptViews?.fork === "function" && typeof here.keptViews.draftFork === "function" && here.keptViews.current().may.views === true;
  return spec || fork;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;
/** A value as a page would say it, for finding it in the page's words: a day as "Sep 3". */
const sayable = (value: unknown): string | undefined => {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (ISO.test(value)) {
    const day = new Date(`${value.slice(0, 10)}T12:00:00`);
    return Number.isNaN(day.getTime()) ? undefined : day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return value.length <= 40 ? value : undefined;
};

/**
 * WHAT IS WORTH SUGGESTING ON A PART (Roadmap f-make-any-page-better), as
 * ✨ Better UI nudges in the menu: a field the rows do not show
 * ("Show due dates on each row"), a list with dates not sorted by them
 * ("Sort these by due date"), and, always, making it easier to read.
 */
export function nudgesFor(part: PagePart, here: PartHere): string[] {
  const nudges: string[] = [];
  const { store } = here;
  const text = ((part.main as HTMLElement | null)?.innerText ?? "").toLowerCase();
  if ((part.slot === "list" || part.slot === "group") && part.kind) {
    const definition = store.schema.tryDefinition(part.kind);
    const fields = Object.keys(((definition as { fields?: { shape?: object } } | undefined)?.fields?.shape ?? {}) as object).filter((field) => !["label", "name", "title"].includes(field));
    // Each record by the name its kind gives it: a vendor's is its `name`, never a `label` it does not have.
    const shown = store.graph.nodesOfKind(part.kind).filter((node) => text.includes(labelOf(definition, node as never).toLowerCase())).slice(0, 6);
    const words = (field: string) => fieldWords(definition, field).toLowerCase();
    const dated = fields.find((field) => shown.some((node) => typeof (node as Record<string, unknown>)[field] === "string" && ISO.test(String((node as Record<string, unknown>)[field]))));
    const missing = fields.find((field) => {
      const said = shown.map((node) => sayable((node as Record<string, unknown>)[field])).filter((one): one is string => one !== undefined);
      return said.length > 0 && said.every((one) => !text.includes(one.toLowerCase()));
    });
    if (missing) {
      const day = shown.some((node) => ISO.test(String((node as Record<string, unknown>)[missing] ?? "")));
      nudges.push(day && !/date|day/.test(words(missing)) ? `Show the ${words(missing)} date on each row` : `Show ${words(missing)} on each row`);
    }
    const sorted = here.views.arrangement?.()?.lists?.[part.kind] as { readonly sort?: string | { readonly by?: string } } | undefined;
    const by = typeof sorted?.sort === "string" ? sorted.sort : sorted?.sort?.by;
    if (dated && by !== dated) nudges.push(`Sort these by ${/date|day/.test(words(dated)) ? words(dated) : `${words(dated)} date`}, soonest first`);
  }
  nudges.push(`Make “${part.name}” easier to read at a glance`);
  return nudges.slice(0, 3);
}
