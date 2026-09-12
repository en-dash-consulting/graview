import { connectorKitFor, resolveKit, type ConnectorKit, type Kit, type KitOverrides } from "@graview/core";
import { connectorStyle, type ConnectorStyle } from "@graview/render";
import { useMemo } from "react";
import { useGraview } from "./context.js";

/*
 * THE KIT AS THE SCENE ASKS FOR IT.
 *
 * The brand declares a kit; the scene never reads the brand. It asks for
 * one edge kind's connector — the kit's `all`, the kind's own entry over
 * it — and gets the render style with the kit's colour, pattern, weight
 * and cap laid over the hash-derived treatment. A kind the kit keeps quiet
 * is `visible: false`, and the scene draws nothing for it.
 */

/** The brand's kit, resolved once per brand. */
export function useKit(): Kit {
  const { brand } = useGraview();
  const overrides: KitOverrides | undefined = brand?.kit;
  return useMemo(() => resolveKit(overrides), [overrides]);
}

/** The render style for one edge kind, with what the kit says laid over the derived treatment. */
export function kitConnector(kit: Kit, kind: string): { readonly connector: ConnectorKit; readonly style: ConnectorStyle } {
  const connector = connectorKitFor(kit, kind);
  const over: Partial<ConnectorStyle> = {
    ...(connector.colour !== undefined ? { colour: connector.colour } : {}),
    ...(connector.pattern !== undefined ? { pattern: connector.pattern } : {}),
    ...(connector.width !== undefined ? { width: connector.width } : {}),
    ...(connector.cap !== undefined ? { cap: connector.cap } : {}),
    ...(connector.opacity !== undefined ? { opacity: connector.opacity } : {}),
  };
  return { connector, style: connectorStyle(kind, { [kind]: over }) };
}
