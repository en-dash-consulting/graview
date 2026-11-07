/*
 * WHAT A HOST SAYS OF "OTHER WAYS TO SHOW THIS" (Roadmap
 * f-display-options-switch), shapes alone, so a page's first load carries
 * none of it. An owner flips between a few ways to show a kind's list or a
 * place and keeps one; these are the seam a host stands at: it may hand in
 * further options, say what was chosen before, and hear what was kept.
 */

/** What the options are for: a kind's list, or one of its places by its title. */
export interface DisplayOptionsAsked {
  readonly kind: string;
  /** The place's title, on a place; a kind's list says none. */
  readonly place?: string;
  /** What the page is called, in a person's words: "Tasks". */
  readonly name: string;
}

/** A further way to show the data, handed in by a host: a lens, judged and checked as the others are before anybody sees it. */
export interface DisplayOptionOffer {
  /** The host's own name for it: what it hears back. */
  readonly id: string;
  /** What the switch calls it, in a few plain words. */
  readonly label: string;
  /** The lens, as `add-lens` says one: a shipped lens's name, a title, its bindings and options. */
  readonly lens: {
    readonly lens: string;
    readonly title: string;
    readonly bindings?: Readonly<Record<string, unknown>>;
    readonly options?: Readonly<Record<string, unknown>>;
  };
  /** How much the host would have it first: added to what was chosen here before. */
  readonly weight?: number;
}

/** One option kept, as it is remembered and told. */
export interface DisplayChoice {
  /** Which option: the same on every offer of it. */
  readonly key: string;
  readonly kind: string;
  /** What sort of picture it is: "board", "calendar", "cards" and so on; what ranks the next offer. */
  readonly shape: string;
  /** Who offered it. */
  readonly from: "graview" | "place" | "host" | "model";
  /** The host's own name for it, on a host's option. */
  readonly hostId?: string;
  readonly at: string;
}

/** What a host hears: the option kept and what it was kept from, or that the keeping was undone. */
export interface DisplayChoiceHeard {
  readonly kept: DisplayChoice;
  /** The options that were on offer, by key. */
  readonly offered: readonly string[];
  readonly undone: boolean;
}

/**
 * THE HOST'S SEAM (`displayOptions` on the provider and the embed). All of
 * it is optional, and with none of it the options are the ones the
 * declaration can draw. Graview keeps a person's choices in this browser
 * regardless; `chosen` adds what the host keeps of them.
 */
export interface DisplayOptionsHost {
  /** Further options for this page; a promise joins them when it answers, and what is shown does not move. */
  readonly offers?: (asked: DisplayOptionsAsked) => readonly DisplayOptionOffer[] | Promise<readonly DisplayOptionOffer[]>;
  /** What was chosen before, as the host keeps it: it ranks the offer beside this browser's. */
  readonly chosen?: () => readonly DisplayChoice[];
  /** Told when an option is kept, and again if that keeping is undone. */
  readonly onChoice?: (heard: DisplayChoiceHeard) => void;
}
