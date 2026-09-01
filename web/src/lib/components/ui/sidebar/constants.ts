export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "16rem";
/*
  LOCAL MODIFICATION: upstream ships 18rem. Narrowed to 9rem on mobile so off-canvas
  nav items fit text tightly without excessive horizontal negative space.
  Re-running `shadcn-svelte add sidebar` will revert it.
*/
export const SIDEBAR_WIDTH_MOBILE = "9rem";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";
