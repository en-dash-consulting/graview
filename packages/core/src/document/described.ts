/*
 * WHAT `describePlace` SAYS A PLACE SHOWS, as shapes: its parts, the
 * records in a list, its problems, the home's masthead and facts. A module
 * of their own, so what says one kind of part — a coverage grid in words —
 * reads them without importing the describer that calls it.
 */

/** One record in a list, as its card or row says it. */
export interface DescribedItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  /** What its card or row says beyond its title, in order. */
  readonly parts: readonly DescribedPart[];
}

export type DescribedPart =
  | { readonly t: "heading"; readonly level: number; readonly text: string }
  | { readonly t: "text"; readonly text: string; readonly tone?: string }
  | { readonly t: "badge"; readonly text: string }
  /** `long`: prose, drawn the record's width with its lines kept (FR-147); `markdown`: written in Markdown, drawn as prose (FR-180). */
  | { readonly t: "field"; readonly label: string; readonly text: string; readonly long?: true; readonly markdown?: true }
  | { readonly t: "figure"; readonly text: string; readonly label?: string }
  | { readonly t: "progress"; readonly label: string; readonly text: string }
  | {
      readonly t: "list";
      readonly as: "card" | "row" | "name";
      /** The columns a card list makes at this width; a row list is one. */
      readonly columns: number;
      readonly groups: readonly { readonly heading?: string; readonly items: readonly DescribedItem[] }[];
      /** What it says when it lists nothing. */
      readonly empty?: string;
      readonly more?: number;
    }
  /**
   * A view the host keeps, where a record's page draws it (`DescribePlaceOptions.views`):
   * by its manifest's name, with what it drew when the host said (`parts`, a headless run's).
   * `replaces`: it is the whole page, and nothing of the record's own is drawn beside it.
   */
  | { readonly t: "view"; readonly name: string; readonly title?: string; readonly replaces?: true; readonly parts?: readonly DescribedPart[] };

/**
 * A VIEW THE HOST KEEPS, as `describePlace` is told of it: its manifest's
 * `name`, `title`, `attach`, `cardinality` and `replaces` — and, where the
 * host ran it headless, what it drew (`parts`).
 */
export interface DescribedHostView {
  readonly name: string;
  readonly title?: string;
  readonly attach: string;
  readonly cardinality: "one" | "many";
  readonly replaces?: "page";
  readonly parts?: readonly DescribedPart[];
}

export interface DescribedProblem {
  /** Where: the block's path in the declaration (`views.home.3`, `lenses.1.options.blocks.0`, `views.offer.card.5`), with the record it was about. */
  readonly at: string;
  readonly says: string;
}

/**
 * THE APP'S MASTHEAD, as the home draws it on both faces (FR-124, FR-125):
 * its name, the line under it, and its logo — said by its alt text, and
 * whether it is drawn from SVG written inline or from a path.
 */
export interface DescribedMasthead {
  readonly name: string;
  readonly subtitle?: string;
  readonly logo?: { readonly alt: string; readonly drawn: "inline SVG" | "image"; readonly src?: string };
}

/** One fact of the whole graph (a document's top-level `computed`), as this seat's graph works it out. */
export interface DescribedFact {
  readonly name: string;
  readonly label: string;
  /** Its value as words: yes or no, a number, a record's name, names joined; absent when it could not be worked out. */
  readonly value?: string;
  /** Why it could not be worked out. */
  readonly refused?: string;
}

export interface PlaceDescription {
  /** On the home: what its masthead says (FR-125). */
  readonly masthead?: DescribedMasthead;
  /**
   * On the home, which is about no one record: the app's facts of the whole
   * graph, worked out over what this seat sees — what any block may say
   * with `fact('<name>')`, whether or not a block on this place does.
   */
  readonly facts?: readonly DescribedFact[];
  readonly place: { readonly slug: string; readonly title: string; readonly kind: string | null; readonly address: string };
  /** Who it was described for: the seat's roles, or "the system". */
  readonly seat: string;
  readonly width: number;
  readonly variant: "phone" | "wide";
  /** What draws it: the app's blocks, the framework's derived page, a shipped lens, a record's page, or a worker view run headless (FR-95). */
  readonly drawnBy: "blocks" | "derived" | "record" | `lens:${string}` | `view:${string}`;
  readonly parts: readonly DescribedPart[];
  readonly problems: readonly DescribedProblem[];
  /** The same, as plain text a chat can quote. */
  readonly text: string;
}

export type DescribePlaceResult = { readonly ok: true; readonly description: PlaceDescription } | { readonly ok: false; readonly error: string; readonly places: readonly string[] };
