import { Chip } from "../primitives/index.js";

/**
 * A RECORD NAMED ON THE BAR, AS SOMETHING THAT GOES THERE — or as a label
 * where there is nowhere to go. A chip with a pick target was a pill that
 * only the scene's own pointer handler answered: on Pages, in a popover, and
 * from the keyboard on either face it looked pressable and did nothing —
 * in Activity, and then in the Suggested tray (FR-225). One that names a
 * record still here is a button that goes to it (the face says how, through
 * `useGoTo`: the record's page on Pages, the record focused and chosen on
 * the scene) and closes the popover it was in; a record since removed, or
 * an argument that is a word rather than a record, is a plain label with no
 * pointer and no focus. The record's name is the button's accessible name;
 * "Go to …" is its title.
 */
export function NamedRecord({ id, label, go, testId }: { readonly id: string; readonly label: string; readonly go: ((id: string) => void) | null; readonly testId: string }) {
  if (!go) return <Chip label={label} />;
  return (
    <button
      type="button"
      data-testid={testId}
      data-record={id}
      title={`Go to ${label}`}
      onClick={() => go(id)}
      // Never wider than the row it is in: a 120-character name is cut by the chip, its whole name in the title.
      style={{ all: "unset", display: "inline-flex", maxWidth: "100%", minWidth: 0, cursor: "pointer", borderRadius: 7 }}
      className="graview-activity-record"
    >
      <Chip label={label} />
    </button>
  );
}
