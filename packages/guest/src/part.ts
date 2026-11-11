/*
 * A PART OF A VIEW (`graview.part`, Roadmap f-view-part-fails-alone): the
 * rules the runtime, the host and a headless run read alike, in a module of
 * their own so a page that draws no worker view carries none of them.
 */

/** A part of a view may take this share of a push's time: a quarter of `pushMs`, as fitted to the device. */
export const PART_SHARE = 4;
/** A part's name: letters, digits, `-` and `_`, at most 64. The host drops a failed part named otherwise. */
export const PART_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
/** How many pushes a part that took too long is left as a note before it is tried again. */
export const PART_REST_PUSHES = 3;
