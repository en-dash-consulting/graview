/*
 * WHAT A VIEW'S HOST SAYS WENT WRONG, BY A CODE (HQ f-view-problem-codes).
 *
 * Every problem a view's host reports (`onProblem` on `mountWorkerView`,
 * `mountGuestView`, `guestView` and a registered worker view's definition;
 * `onHeld` on `createGuestHost`) is a sentence for a person, and beside it
 * one of these codes, with the part's name where a part failed. The
 * sentence may be reworded in any version; the code is what a host counts
 * by, and it does not change when the words do. A new kind of problem
 * gets a new code: one is never reused for another.
 */

/** Every code a view's host may say a problem with, in one closed list. */
export const VIEW_PROBLEM_CODES = [
  /** A part the view drew (`graview.part`) threw or took too long: its note is drawn in its place. `part` names it. */
  "part-failed",
  /** A frame guest asked for a height that only tracked its own frame's, and is held at it (the growth guard). */
  "held-by-growth-guard",
  /** A relation the view reads joins a kind its manifest never hands it. */
  "far-kind-not-handed",
  /** The app's stylesheet for its views draws nothing: the open kit leaves all of it out. */
  "views-stylesheet-draws-nothing",
  /** A face the app lends its views (`brand.views.fonts`) is not lent: past the most, a name it may not take, or from nowhere this host serves faces. */
  "face-not-lent",
  /** A face the app lends its views could not be loaded: its file failed, is too large, or is not a font. */
  "face-not-loaded",
  /** A face lent to a frame did not arrive in time, so the frame is drawn without it until it does. */
  "face-late",
  /** One name (family, weight, style) is lent from several files, and this says which one draws. */
  "face-several-files",
  /** A face the view's own stylesheet declares (`@font-face`) was refused by the open kit. */
  "own-face-refused",
  /** A face the view's own stylesheet declares could not be loaded: the browser reads none of its sources. */
  "own-face-not-loaded",
  /** A picture on a record the view is handed was left out: too heavy, past the most, or not loaded. */
  "picture-left-out",
  /** The thumb the host asked pictures be made at is no sound one, so none is made. */
  "picture-thumb-unsound",
  /** An image the view drew by address was refused. */
  "image-refused",
  /** A link out (`<a href>`) the view drew goes nowhere it was handed or the host lists. */
  "link-refused",
  /** A link or `graview.navigate` names no record the viewer may see and no place of the app. */
  "link-goes-nowhere",
  /** A jump within the view (`<a href="#id">`) names no element it drew. */
  "jump-goes-nowhere",
  /** A file link (`<a data-file>`) is not followed: drawn on no `<a>`, naming no record it was shown, or a field that holds no file. */
  "file-link-goes-nowhere",
  /** A record's video or the full-screen viewer the view placed is not drawn. */
  "media-not-drawn",
  /** A video on a provider the view named (`<graview-video data-provider data-video>`, `data-watch`) is refused: a provider not on the list, or no id of a video. */
  "embed-refused",
  /** A video on a provider was not played: the page's own policy allows no frame from the provider's player (`frame-src`), so its link stands alone. */
  "embed-not-allowed",
  /** A drop target the view drew (`data-drop`) is not offered. */
  "drop-not-offered",
  /** The view listens for a wheel, a drag or a pinch its manifest does not say it hears (`gestures`). */
  "gestures-not-declared",
  /** A press the view bound was refused, and the note beside it could not be drawn. */
  "press-refused",
  /** What the view keeps for its viewer (`graview.mine`) could not be read or kept. */
  "viewer-state-refused",
  /** A part of the host the view needs (its player, its drop, its jumps and file links) could not be loaded. */
  "host-part-not-loaded",
] as const;

/** One of `VIEW_PROBLEM_CODES`. */
export type ViewProblemCode = (typeof VIEW_PROBLEM_CODES)[number];

/** What a problem is, beside its sentence: its code, and the part's name where a part failed. */
export interface ViewProblem {
  readonly code: ViewProblemCode;
  /** The part's name (`graview.part(name, …)`), for `part-failed`. */
  readonly part?: string;
  /**
   * What names this one fault, the same in every version of the app and
   * whatever the sentence says (HQ f-view-check-refuses-unread-relation-kind):
   * a host files a standing fault once by it, however often the view is
   * opened. For `far-kind-not-handed`, the view, the relation and the kinds
   * that would hand it, while the relation joins the same kinds (`far-kind-not-handed:phase-board:inPhase:chunk`,
   * `farKindKey`).
   */
  readonly key?: string;
}

/** How a host is told of a problem: the sentence, and what it is. */
export type ViewProblemSaid = (said: string, problem: ViewProblem) => void;
