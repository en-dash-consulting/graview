import { numberAsRead, valueWords, type AnyNodeDefinition, type AnySchema } from "@graview/core";
import type { ViewProps } from "@graview/react/provider";

/**
 * WHERE A DISTRICT'S RECORDS STAND, as one bar under its name from
 * altitude: a segment per value of its kind's main choice, in declared
 * order, as wide as its share — done light, waiting mid, active dark — each
 * saying its count, and its value too where the segment has the room. The
 * whole is said in words to a screen reader and on hover.
 */
export function StatesBar({ states, definition }: { readonly states: NonNullable<ViewProps<AnySchema>["states"]>; readonly definition: AnyNodeDefinition | undefined }) {
  const total = states.values.reduce((sum, one) => sum + one.count, 0);
  const words = (value: string | null) => (value === null ? "with none" : valueWords(definition, states.field, value).toLowerCase());
  const said = states.values.filter((one) => one.count > 0).map((one) => `${numberAsRead(one.count)} ${words(one.value)}`).join(", ");
  if (total === 0) return null;
  return (
    <div className="graview-district-states" role="img" aria-label={said} title={said}>
      {states.values.map((one, i) => {
        if (one.count === 0) return null;
        // The room a segment has, at the bar's least width and its 10px figures.
        const room = (one.count / total) * 168;
        const count = numberAsRead(one.count);
        const long = `${count} ${words(one.value)}`;
        return (
          <span key={i} data-graview-tier={one.tier} style={{ flexGrow: one.count }}>
            {long.length * 5.2 + 6 <= room ? long : count.length * 5.2 + 6 <= room ? count : ""}
          </span>
        );
      })}
    </div>
  );
}

