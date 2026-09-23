import type { AnySchema } from "@graview/core";
import { useGraview } from "@graview/react";


/**
 * WHOSE STOP YOU ARE ADOPTING, said on the bar while it holds — the mirror
 * of a robot following you. Pressing it, or Escape, or going somewhere of
 * your own, lets go.
 */
export function FollowingLine() {
  const { following, follow } = useGraview<AnySchema>();
  if (!following) return null;
  return (
    <button
      type="button"
      data-testid="following-who"
      onClick={() => follow(null)}
      title="Press, or Escape, to stop following"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        minHeight: 24,
        padding: "2px 9px",
        borderRadius: 999,
        border: "1px solid var(--graview-accent)",
        background: "transparent",
        color: "var(--graview-accent)",
        fontSize: "0.78125rem",
        whiteSpace: "nowrap",
      }}
    >
      following {following.name}
    </button>
  );
}
