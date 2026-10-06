import type { DescribedPart, DescribedProblem } from "@graview/core/describe";
import type { ViewRefusal } from "../host/open-draw.js";
import { describeDrawing } from "./describe.js";
import { drawTranscript } from "./draw.js";
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
  | { readonly ok: true; readonly parts: readonly DescribedPart[]; readonly problems: readonly DescribedProblem[] }
  | { readonly ok: false; readonly reason: HeadlessFailureReason; readonly detail: string };

/** One refusal of the open kit's, said to the author of the view. */
export function sayRefusal(refusal: ViewRefusal): DescribedProblem {
  const element = "element" in refusal && refusal.element ? `<${refusal.element}>` : "";
  const name = refusal.name ? ` ${refusal.name}` : "";
  switch (refusal.reason) {
    case "element":
      return { at: `drawing ${element}`, says: `Not drawn: ${element} is not in the open kit.` };
    case "attribute":
      return { at: `drawing ${element}${name}`, says: `Not drawn: ${element || "an element"} does not take${name}.` };
    case "value":
      return { at: `drawing ${element}${name}`, says: `Not drawn: the value of${name} is not one the open kit takes.` };
    case "url":
      return { at: `drawing ${element}${name}`, says: `Not drawn: an address. A view loads nothing; an image is a data: image.` };
    case "child":
      return { at: `drawing ${element}`, says: `Not drawn: ${element} holds nothing.` };
    case "record":
      return { at: "drawing", says: "Not drawn: a record the drawing's format does not know." };
    case "budget":
      return { at: "drawing", says: "Not drawn: more nodes than a view may draw." };
    case "css":
      return { at: `stylesheet${name === " stylesheet" ? "" : name}`, says: `Not drawn: CSS the open kit leaves out${refusal.css ? ` (${refusal.css.reason}${refusal.css.name ? ` ${refusal.css.name}` : ""})` : ""}.` };
  }
}

export function judgeTranscript(transcript: HeadlessTranscript, input: HeadlessInput): Judged {
  const { limits } = input;
  if (transcript.messages > limits.messages) return { ok: false, reason: "flood", detail: `It sent ${transcript.messages} messages, more than the ${limits.messages} a view may send in a second.` };
  const acts = new Set(input.acts);
  for (const asked of transcript.asked) {
    if (!acts.has(asked.name)) return { ok: false, reason: "act", detail: `It asks for the act "${asked.name}", which its manifest does not name.` };
  }
  const drawn = drawTranscript(transcript.renders, transcript.css, { maxNodes: limits.maxNodes });
  if (drawn.over) return { ok: false, reason: "nodes", detail: `It drew more than the ${limits.maxNodes.toLocaleString("en-US")} things a view may draw.` };
  const said = describeDrawing(drawn.root, { props: input.props, places: input.places });
  for (const act of said.acts) {
    if (!acts.has(act)) return { ok: false, reason: "act", detail: `It binds a press to the act "${act}" (data-act), which its manifest does not name.` };
  }
  const problems: DescribedProblem[] = [...drawn.refused.map(sayRefusal), ...said.problems];
  for (const went of transcript.went) {
    if ("record" in went && !(input.props.node?.id === went.record || (input.props.nodes ?? []).some((node) => node.id === went.record))) problems.push({ at: "navigate", says: `It goes to "${went.record}", which this seat was not shown: the host will not follow it.` });
    if ("place" in went && !input.places.includes(went.place)) problems.push({ at: "navigate", says: `It goes to the place "${went.place}", which this app does not have.` });
  }
  return { ok: true, parts: said.parts, problems };
}
