import type { Principal } from "@graview/core";
import { MenuSections } from "@graview/react/drawing";
import { useGraview, type MenuSection, type MenuSectionSource, type MenuTarget } from "@graview/react/provider";
import { useMemo, type ReactNode } from "react";

/**
 * "MOVE TO ›" ON A CARD'S MENU (Roadmap f-board-move-without-buttons).
 *
 * A Move… button under every card doubled a board's height, so a card on a
 * status board is moved by dragging it, by carrying it with the keyboard, or
 * from its own context menu: "Move to ›" opens the board's other columns —
 * the ones this seat may move it to, and the ones withheld, struck through
 * with the reason a press would have met.
 *
 * The board says it is drawn (`holdBoard`) and draws the section itself,
 * with the lens's own reading of the moves (`columnChoices`) and its own
 * way of moving a card — said and undone where the board says it. This is
 * only the registry and the menu's source, so the menu costs a page that
 * draws no board nothing but these lines.
 */

/** A board while it is drawn: the kind it moves, where it stands, and its part of a card's menu. */
export interface BoardHere {
  readonly store: object;
  readonly kind: string;
  readonly root: () => HTMLElement | null;
  readonly section: (id: string, principal: Principal) => MenuSection | null;
}

const BOARDS = new Set<BoardHere>();

/** Says a board is drawn, until the returned function says it is gone. */
export function holdBoard(board: BoardHere): () => void {
  BOARDS.add(board);
  return () => void BOARDS.delete(board);
}

/** "Move to ›" on the menu of a card on a board: the board around the element it was opened from, else one drawn for its kind. */
export function useBoardMoveSection(): MenuSectionSource {
  const { store, principal } = useGraview();
  return useMemo<MenuSectionSource>(
    () => (target: MenuTarget) => {
      const node = target.on === undefined ? undefined : store.graph.getNode(target.on);
      if (!node) return null;
      const drawn = [...BOARDS].filter((board) => board.store === store && board.kind === node.kind);
      const board = target.element ? drawn.find((one) => one.root()?.contains(target.element!) ?? false) : drawn[0];
      return board?.section(node.id, principal) ?? null;
    },
    [store, principal],
  );
}

/** The context menu drawn inside, with "Move to ›" on a card on a board. */
export function BoardMoveSections({ children }: { readonly children: ReactNode }) {
  const section = useBoardMoveSection();
  const sections = useMemo(() => [section], [section]);
  return <MenuSections sections={sections}>{children}</MenuSections>;
}
