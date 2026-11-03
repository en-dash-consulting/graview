/*
 * GOING TO THE OTHER FACE WITHOUT A BUTTON ON THE ROW (Roadmap
 * f-app-bar-calm, f-make-any-page-better). The scene and the pages are rows
 * of the app menu, drawn only while it is open, so a part that must switch
 * faces — Better UI asked in the scene, opened on its page — cannot press
 * them. It dispatches this on the app menu's control
 * (`[data-testid="app-menu-open"]`, which says `data-pages` where the bar
 * holds both faces), with the face as its detail, and the bar goes there as
 * the menu's row would.
 */
export const FACE_EVENT = "graview:go-to-face";
