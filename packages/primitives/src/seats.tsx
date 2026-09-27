import type { AnySchema, Principal } from "@graview/core";
import { useGraview } from "@graview/react";

/**
 * WHO YOU ARE SITTING AS — on the bar, where a policy can be felt.
 *
 * A declared policy that nobody can stand on the other side of is a claim
 * rather than a demonstration: a reader sees one set of acts and has to take
 * it on faith that another seat would see a different one. Sitting down as
 * somebody else re-derives everything from the one principal — what the
 * strip offers and what it withholds with the policy's own sentence, which
 * kinds are drawn at all, whether "Show the installation" is on the bar,
 * what the routed face lists, and what the agent's tool list contains.
 *
 * The embed's strip has had this since it had a policy to feel. The demos
 * people actually open are the apps, not the embeds, which is why it belongs
 * here too and why it reads from the same context rather than from a prop.
 *
 * Nothing renders for an app that offers no seats, or offers only one:
 * a control with one choice is furniture.
 */
export function Seats<S extends AnySchema>() {
  const { seats, principal, takeSeat } = useGraview<S>();
  if (seats.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Seat"
      data-testid="seats"
      /*
       * IT WRAPS. The switcher sits in the profile pane, which is 280
       * wide: three seats in one unwrapping row ran straight off the edge,
       * and the third was a chip with its name cut in half. A row of
       * choices that cannot be read is not a choice.
       */
      style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, rowGap: 4 }}
    >
      <span
        style={{
          fontSize: "0.75rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--graview-ink-faint)",
        }}
      >
        As
      </span>
      {seats.map((seat) => {
        const here = sameSeat(principal, seat.principal);
        return (
          <button
            key={seat.principal.id ?? seat.label}
            type="button"
            aria-pressed={here}
            data-testid={`seat-${seat.principal.id ?? seat.label}`}
            title={`Sit down as ${seat.label}: the acts, the kinds and the pages narrow to what this seat may do`}
            onClick={() => takeSeat(seat.principal)}
            style={{
              padding: "3px 11px",
              borderRadius: 999,
              fontSize: "0.875rem",
              whiteSpace: "nowrap",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: here ? "var(--graview-accent)" : "var(--graview-edge)",
              color: here ? "var(--graview-accent)" : "var(--graview-ink-muted)",
              background: here ? "var(--graview-panel)" : "transparent",
            }}
          >
            {seat.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Two principals are the same seat when they name the same person.
 *
 * By id, not by identity: the seated principal is the very object the seat
 * carries today, and comparing references would be right by accident and
 * wrong the first time a host rebuilt its seat list on a render.
 */
function sameSeat(a: Principal, b: Principal): boolean {
  return a.kind === b.kind && a.id === b.id;
}
