import type { Violation } from "@graview/core";

/**
 * A BROKEN RULE AS A SENTENCE (Roadmap f-inbox-needs-you-first): what the
 * rule says of the record — "Crumbs Bakery is booked but has no quote" — and
 * for a rule that wrote no sentence, the record's name and the rule's title,
 * never its shape: the line (`quote = —`) a judgment may have added to the
 * message comes back off, since it is symbols, and this is for reading.
 */
export function problemSentence(violation: Pick<Violation, "message" | "line">): string {
  const shape = violation.line ? ` \u2014 ${violation.line.text}` : "";
  return shape && violation.message.endsWith(shape) ? violation.message.slice(0, -shape.length) : violation.message;
}
