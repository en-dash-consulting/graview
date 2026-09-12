import type { AnySchema } from "@graview/core";
import { withShown } from "@graview/layout";
import { useGraview, useNavigation } from "@graview/react";

/**
 * THE WAY INTO THE INSTALLATION, for those who keep it.
 *
 * A module drawn only for those who administer it is never a district for
 * anyone else. For the seat that may run its acts there is one control, in
 * the bar and on an embed's strip: press it and the installation's own
 * kinds — the people, the invitations — rise into the scene beside the
 * domain, as ordinary districts with ordinary cards and acts; press it
 * again and they are gone. It is a stop (`show=installation` in the
 * address), so Back knows the way out and an embed can open on it.
 *
 * Nothing renders for a seat that may not administer anything: the control
 * is the policy's answer, not a hidden door.
 */
export function ShowInstallation<S extends AnySchema>() {
  const { administered } = useGraview<S>();
  const { view, go } = useNavigation();
  const mine = administered.filter((module) => module.canShow);
  if (mine.length === 0) return null;
  return (
    <div role="group" aria-label="Administered" data-testid="administered" style={{ display: "flex", gap: 6 }}>
      {mine.map((module) => (
        <button
          key={module.name}
          type="button"
          aria-pressed={module.shown}
          data-testid={`show-${module.name}`}
          title={
            module.shown
              ? `Hide the ${module.name}'s own districts again`
              : (module.description ?? `Show the ${module.name}'s own districts beside the domain`)
          }
          onClick={() => go(withShown(view, module.name, !module.shown))}
          style={{
            padding: "3px 11px",
            borderRadius: 999,
            fontSize: "0.78125rem",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: module.shown ? "var(--graview-accent)" : "var(--graview-edge)",
            color: module.shown ? "var(--graview-accent)" : "var(--graview-ink-muted)",
            background: module.shown ? "var(--graview-panel)" : "transparent",
          }}
        >
          {module.shown ? `Hide the ${module.name}` : `Show the ${module.name}`}
        </button>
      ))}
    </div>
  );
}
