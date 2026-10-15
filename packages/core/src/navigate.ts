/**
 * `@graview/core/navigate` — WHERE A VIEW SENDS SOMEBODY, AS AN ADDRESS.
 *
 * A view's `navigate({ place: "features", where: { stage: "building" },
 * section: "Shipping soon" })` arrives at a path narrowed and to a section
 * (`narrowedPath`, `/features?filter=stage%3Abuilding#shipping-soon`), the
 * filter in the words a list's arranging line writes and the section as
 * the address says it (`sectionSlug`). Off the main entry: only the routed
 * face's way of going and a worker view's host reach it, each fetched as
 * it is drawn.
 */
export { narrowedPath, sectionSlug } from "./views/address.js";
