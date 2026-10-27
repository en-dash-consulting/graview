import type { DescribedPart, DescribedProblem, DescribedVideo } from "@graview/core/describe";
import { placeNamed, placesSaid, quoted, unsureOfViews } from "../host/links-words.js";
import type { ViewRefusal } from "../host/open-draw.js";
import { handedLinks, judgeLink, linkRefusedWords } from "../host/external-links.js";
import { imageRefusedWords, type ImageHost } from "../host/open-judge.js";
import { describeDrawing } from "./describe.js";
import { drawTranscript, type DrawnTranscript } from "./draw.js";
import type { HeadlessFailureReason, HeadlessInput, HeadlessTranscript } from "./protocol.js";

/*
 * WHAT A HEADLESS RUN'S TRANSCRIPT COMES TO (FR-95): the view's messages
 * held to its limits and its manifest, its drawing drawn as a page would
 * draw it, and what was drawn said as a place is said. Pure, and the same
 * code on both sides: the isolate judges what it heard, and the host judges
 * the transcript again in its own context rather than take the isolate's
 * word for what the view drew.
 */

export type Judged =
  /** `drawn`: the drawing itself, for the host to read a press against (0.1.45). */
  | { readonly ok: true; readonly parts: readonly DescribedPart[]; readonly problems: readonly DescribedProblem[]; readonly drawn: DrawnTranscript; readonly videos: readonly DescribedVideo[] }
  | { readonly ok: false; readonly reason: HeadlessFailureReason; readonly detail: string };

/* SMIL sets an attribute after the host judged it, and moves past a person's wish for less motion. */
const SMIL = " SMIL can set an attribute after the host judged it, and runs past a person's reduced-motion setting: animate with CSS @keyframes, which is held to it.";
/** Why the refusals a view's author meets most were made, and what to draw instead (2026-10-23). */
const WHY: Readonly<Record<string, string>> = {
  animate: SMIL,
  animateTransform: SMIL,
  animateMotion: SMIL,
  set: SMIL,
  feImage: " It loads an image: a filter here is made of the view's own pixels.",
  "@property": " It registers a property for the whole page, the app's own --graview-* among them: animate a transform, an opacity or a color in @keyframes.",
  "a href": " An <a> in SVG goes to a record or a place (data-record, data-place); a link out is an HTML <a href>.",
  role: ` A role of the app's chrome or notices is the app's; role="region" is drawn while it has a name (aria-label).`,
};

/** One refusal of the open kit's, said to the author of the view, offering only what its host draws. */
export function sayRefusal(refusal: ViewRefusal, host: ImageHost & { readonly linkOrigins?: readonly string[] } = {}): DescribedProblem {
  const element = "element" in refusal && refusal.element ? `<${refusal.element}>` : "";
  const name = refusal.name ? ` ${refusal.name}` : "";
  const why = (key: string | undefined) => (key && Object.prototype.hasOwnProperty.call(WHY, key) ? WHY[key] : "");
  switch (refusal.reason) {
    case "element":
      return { at: `drawing ${element}`, says: `Not drawn: ${element} is not in the open kit.${why("element" in refusal ? refusal.element : undefined)}` };
    case "attribute":
      return { at: `drawing ${element}${name}`, says: `Not drawn: ${element || "an element"} does not take${name}.${why(`${"element" in refusal ? refusal.element : ""}${name}`)}` };
    case "value":
      return { at: `drawing ${element}${name}`, says: `Not drawn: the value of${name} is not one the open kit takes.${why(refusal.name)}` };
    case "url":
      if ("element" in refusal && refusal.element === "a" && refusal.address !== undefined) return { at: `drawing ${element}${name}`, says: `Not drawn: ${linkRefusedWords(refusal.address, host.linkOrigins)}` };
      return { at: `drawing ${element}${name}`, says: refusal.address !== undefined && "element" in refusal && refusal.element === "img" ? `Not drawn: ${imageRefusedWords(refusal.address, host, "length" in refusal ? refusal.length : undefined)}` : `Not drawn: an address. A view loads nothing; an image is a data: image.` };
    case "child":
      return { at: `drawing ${element}`, says: `Not drawn: ${element} holds nothing.` };
    case "record":
      return { at: "drawing", says: "Not drawn: a record the drawing's format does not know." };
    case "budget":
      return { at: "drawing", says: "Not drawn: more nodes than a view may draw." };
    case "reference": {
      const ids = "ids" in refusal && refusal.ids ? refusal.ids : [];
      const said = ids.length > 0 ? ids.map((id) => `"${id}"`).join(", ") : "no id";
      return { at: `drawing ${element}${name}`, says: `Not drawn: ${element || "an element"}${name} names ${said}, ${ids.length === 1 ? "which is" : "which are"} no element of this view. It names elements the view draws itself, by their id (<h2 id="…">), drawn once each is there.` };
    }
    case "css":
      return { at: `stylesheet${name === " stylesheet" ? "" : name}`, says: `Not drawn: CSS the open kit leaves out${refusal.css ? ` (${refusal.css.reason}${refusal.css.name ? ` ${refusal.css.name}` : ""})` : ""}.${why(refusal.css?.name)}` };
  }
}

export function judgeTranscript(transcript: HeadlessTranscript, input: HeadlessInput): Judged {
  const { limits } = input;
  if (transcript.messages > limits.messages) return { ok: false, reason: "flood", detail: `It sent ${transcript.messages} messages, more than the ${limits.messages} a view may send in a second.` };
  const acts = new Set(input.acts);
  for (const asked of transcript.asked) {
    if (!acts.has(asked.name)) return { ok: false, reason: "act", detail: `It asks for the act "${asked.name}", which its manifest does not name.` };
  }
  /* A link out goes where the records the view was shown say, or to an origin the host lists, as on the page. */
  const handed = handedLinks(input.props);
  /* Nothing loads in a run: the app's own image is drawn as the path the live host resolves, where the host says it does. */
  const drawn = drawTranscript(transcript.renders, transcript.sheets, { maxNodes: limits.maxNodes, ...(input.origin ? { origin: input.origin } : {}), ...(input.imageOrigins ? { imageOrigins: input.imageOrigins } : {}), ...(input.assets ? { asset: (path: string) => path } : {}), link: (value: string) => judgeLink(value, { handed, ...(input.linkOrigins ? { origins: input.linkOrigins } : {}) }) });
  if (drawn.over) return { ok: false, reason: "nodes", detail: `It drew more than the ${limits.maxNodes.toLocaleString("en-US")} things a view may draw.` };
  // A kind's list is somewhere a view may go by name too, by its plural or the kind's name.
  const goes = [...input.places, ...(input.lists ?? []).filter((slug) => !input.places.some((place) => place.as === slug)).map((slug) => ({ as: slug }))];
  const unsure = input.placesUnsure === true;
  const said = describeDrawing(drawn.root, { props: input.props, places: goes, ...(unsure ? { placesUnsure: true } : {}), ...(input.accepts ? { accepts: input.accepts } : {}) });
  for (const act of said.acts) {
    if (!acts.has(act)) return { ok: false, reason: "act", detail: `It binds a press to the act "${act}" (data-act), which its manifest does not name.` };
  }
  const problems: DescribedProblem[] = [...drawn.refused.map((one) => sayRefusal(one, { ...(input.imageOrigins ? { origins: input.imageOrigins } : {}), assets: input.assets === true, ...(input.linkOrigins ? { linkOrigins: input.linkOrigins } : {}) })), ...said.problems];
  for (const went of transcript.went) {
    /* A bare string is a record first, then a place by that slug, as the host follows it. */
    if ("record" in went && !(input.props.node?.id === went.record || (input.props.nodes ?? []).some((node) => node.id === went.record) || placeNamed(goes, went.record)))
      problems.push({
        at: "navigate",
        says: unsure
          ? `It goes to ${quoted(went.record)}, which this seat was not shown and is none of the places this run was told of. A view goes to a record by its id, or to a place by its slug.${placesSaid(goes)}${unsureOfViews}`
          : `It goes to ${quoted(went.record)}, which this seat was not shown and is no place of this app: the host will not follow it. A view goes to a record by its id, or to a place by its slug.${placesSaid(goes)}`,
      });
    if ("place" in went && !placeNamed(goes, went.place))
      problems.push({ at: "navigate", says: unsure ? `It goes to the place ${quoted(went.place)}, which is none of the places this run was told of.${placesSaid(goes)}${unsureOfViews}` : `It goes to the place ${quoted(went.place)}, which this app does not have.${placesSaid(goes)}` });
  }
  return { ok: true, parts: said.parts, problems, drawn, videos: said.videos };
}
